import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getDatabase } from 'firebase-admin/database';
import { getMessaging } from 'firebase-admin/messaging';
import { env } from 'src/configs/env.config';

const firebaseApp = () => {
  if (!env.firebaseDatabaseUrl || !env.firebaseProjectId) {
    throw new Error('FIREBASE_DATABASE_URL and FIREBASE_PROJECT_ID are required for chat and push');
  }
  const existing = getApps().find((app) => app.name === 'chat-backend');
  return (
    existing ||
    initializeApp(
      {
        credential: applicationDefault(),
        projectId: env.firebaseProjectId,
        databaseURL: env.firebaseDatabaseUrl,
      },
      'chat-backend',
    )
  );
};

export const firebaseDatabase = () => getDatabase(firebaseApp());
export const firebaseMessaging = () => getMessaging(firebaseApp());
export const verifyFirebaseIdToken = (token: string) =>
  getAuth(firebaseApp()).verifyIdToken(token, true);
