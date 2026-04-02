import * as fs from 'fs';
import * as path from 'path';

export type FirebaseWebPublicDto = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  /** Optionnel — Firebase Analytics Web */
  measurementId: string;
};

const pick = (obj: Record<string, unknown>, k: string) =>
  typeof obj[k] === 'string' ? (obj[k] as string) : '';

function isPlaceholderApi(apiKey: string, appId: string): boolean {
  return (
    /COPIER|YOUR_|REPLACE|CHANGEME|example|À_REMPLACER|PASTE/i.test(apiKey) ||
    /COPIER|YOUR_|REPLACE|CHANGEME|example|À_REMPLACER|PASTE/i.test(appId)
  );
}

export function resolveFirebaseJsonPaths(): string[] {
  return [
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH,
    path.resolve(process.cwd(), 'secrets', 'firebase.json'),
    path.resolve(process.cwd(), 'backend', 'secrets', 'firebase.json'),
    path.resolve(__dirname, '../../../secrets/firebase.json'),
  ].filter(Boolean) as string[];
}

export function resolveFirebaseWebAppJsonPaths(): string[] {
  return [
    process.env.FIREBASE_WEB_CONFIG_PATH,
    path.resolve(process.cwd(), 'secrets', 'firebase-web-app.json'),
    path.resolve(process.cwd(), 'backend', 'secrets', 'firebase-web-app.json'),
    path.resolve(__dirname, '../../../secrets/firebase-web-app.json'),
  ].filter(Boolean) as string[];
}

export function tryReadWebFromServiceAccountJson(
  filePath: string,
): FirebaseWebPublicDto | 'incomplete' | 'placeholder' | null {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Record<
    string,
    unknown
  >;
  const web = raw['web'];
  if (!web || typeof web !== 'object' || Array.isArray(web)) return null;

  const w = web as Record<string, unknown>;
  const projectId =
    pick(w, 'projectId') ||
    (typeof raw['project_id'] === 'string' ? raw['project_id'] : '');
  if (!projectId) return 'incomplete';

  const apiKey = pick(w, 'apiKey');
  const appId = pick(w, 'appId');
  if (!apiKey?.trim() || !appId?.trim()) return 'incomplete';

  if (isPlaceholderApi(apiKey, appId)) return 'placeholder';

  const authDomain =
    pick(w, 'authDomain') || `${projectId}.firebaseapp.com`;
  const storageBucket =
    pick(w, 'storageBucket') || `${projectId}.appspot.com`;
  const messagingSenderId = pick(w, 'messagingSenderId');
  const measurementId = pick(w, 'measurementId');

  return {
    apiKey,
    authDomain,
    projectId,
    storageBucket,
    messagingSenderId,
    appId,
    measurementId,
  };
}

export function readStandaloneWebAppJson(
  filePath: string,
): FirebaseWebPublicDto | 'incomplete' | 'placeholder' {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Record<
    string,
    unknown
  >;
  const cfg: FirebaseWebPublicDto = {
    apiKey: pick(raw, 'apiKey'),
    authDomain: pick(raw, 'authDomain'),
    projectId: pick(raw, 'projectId'),
    storageBucket: pick(raw, 'storageBucket'),
    messagingSenderId: pick(raw, 'messagingSenderId'),
    appId: pick(raw, 'appId'),
    measurementId: pick(raw, 'measurementId'),
  };
  if (!cfg.apiKey || !cfg.appId || !cfg.projectId) return 'incomplete';
  if (isPlaceholderApi(cfg.apiKey, cfg.appId)) return 'placeholder';
  return cfg;
}
