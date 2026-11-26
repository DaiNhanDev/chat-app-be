const { readFileSync, writeFileSync } = require('node:fs');

const required = [
  'NODE_ENV',
  'MONGODB_URI',
  'JWT_SECRET',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_DATABASE_URL',
  'PWA_BASE_URL',
];

function quote(key, value) {
  if (/[\r\n\0]/.test(value)) throw new Error(`${key} must be a single line`);
  for (const delimiter of ["'", '`', '"']) {
    if (!value.includes(delimiter) && (delimiter !== '"' || !/\\[nr]/.test(value))) {
      return `${delimiter}${value}${delimiter}`;
    }
  }
  throw new Error(`Cannot encode ${key} as a dotenv value`);
}

const example = readFileSync('.env.example', 'utf8');
const keys = [...example.matchAll(/^([A-Z_][A-Z0-9_]*)=/gm)].map((match) => match[1]);
const missing = required.filter((key) => !process.env[key]?.trim());
if (missing.length) throw new Error(`Missing production configuration: ${missing.join(', ')}`);

const lines = keys.map((key) => {
  if (!Object.hasOwn(process.env, key)) throw new Error(`Missing workflow mapping: ${key}`);
  return `${key}=${quote(key, process.env[key])}`;
});
writeFileSync('.env', `${lines.join('\n')}\n`, { flag: 'wx', mode: 0o600 });
