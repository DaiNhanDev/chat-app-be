import { readFileSync } from 'node:fs';
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { Database, getDatabase } from 'firebase-admin/database';
import { getMessaging } from 'firebase-admin/messaging';
import { env } from 'src/configs/env.config';

const credentials = () => {
  const file = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  if (!file) return applicationDefault();
  const data = JSON.parse(readFileSync(file, 'utf8')) as { type?: string; project_id?: string };
  if (data.type !== 'service_account') return applicationDefault();
  if (data.project_id !== env.firebaseProjectId)
    throw new Error('Firebase Admin credentials must match FIREBASE_PROJECT_ID');
  // cert() signs locally with the supplied key, without requiring the IAM
  // Credentials API or copying any credential material into source or the FE.
  return cert(file);
};

const firebaseApp = () => {
  if (!env.firebaseDatabaseUrl || !env.firebaseProjectId) {
    throw new Error('FIREBASE_DATABASE_URL and FIREBASE_PROJECT_ID are required for chat and push');
  }
  const existing = getApps().find((app) => app.name === 'chat-backend');
  return (
    existing ||
    initializeApp(
      {
        credential: credentials(),
        projectId: env.firebaseProjectId,
        databaseURL: env.firebaseDatabaseUrl,
      },
      'chat-backend',
    )
  );
};

export const firebaseAuth = () => getAuth(firebaseApp());
export const createFirebaseReadToken = (uid: string) =>
  firebaseAuth().createCustomToken(uid, { chatRead: true });
export const firebaseDatabase = () => getDatabase(firebaseApp());

export async function firebaseRoomIds(database: Database): Promise<string[]> {
  // The REST shallow option returns room keys without reading any message histories.
  const configuredUrl = database.app.options.databaseURL;
  if (!configuredUrl) throw new Error('Missing Firebase database URL');
  const origin = new URL(configuredUrl);
  const url = new URL('/rooms.json', origin);
  const emulator = process.env.FIREBASE_DATABASE_EMULATOR_HOST;
  let token: string;
  if (emulator) {
    url.searchParams.set('ns', origin.searchParams.get('ns') || origin.hostname.split('.')[0]!);
    url.protocol = 'http:';
    url.host = emulator;
    token = 'owner';
  } else {
    const credential = firebaseApp().options.credential;
    if (url.protocol !== 'https:' || !credential)
      throw new Error('Cannot authenticate Firebase room lookup');
    token = (await credential.getAccessToken()).access_token;
  }
  url.searchParams.set('shallow', 'true');
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10_000),
    redirect: 'error',
  });
  if (!response.ok) throw new Error(`Firebase room lookup failed with HTTP ${response.status}`);
  const rooms: unknown = await response.json();
  if (rooms === null) return [];
  if (typeof rooms !== 'object' || Array.isArray(rooms))
    throw new Error('Invalid Firebase room inventory');
  return Object.keys(rooms);
}

export const firebaseMessaging = () => getMessaging(firebaseApp());
export const verifyFirebaseIdToken = (token: string) =>
  getAuth(firebaseApp()).verifyIdToken(token, true);
