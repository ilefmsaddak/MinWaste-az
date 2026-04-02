import { getHttpOriginFromApiBase } from '../../services/api.config';

export type FirebaseWebPublicShape = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
};

declare global {
  // eslint-disable-next-line no-var
  var __MINWASTE_FIREBASE_WEB__: FirebaseWebPublicShape | undefined;
}

/** Doit correspondre à FIREBASE_PROJECT_ID côté Nest. */
const EXPECTED_PROJECT_ID = 'minwaste-app';

export const firebaseWebAppConfigFallback: FirebaseWebPublicShape = {
  apiKey: '',
  authDomain: `${EXPECTED_PROJECT_ID}.firebaseapp.com`,
  projectId: EXPECTED_PROJECT_ID,
  storageBucket: `${EXPECTED_PROJECT_ID}.appspot.com`,
  messagingSenderId: '',
  appId: '',
};

export async function loadFirebaseWebConfigFromBackend(): Promise<void> {
  try {
    const root = getHttpOriginFromApiBase();
    const res = await fetch(`${root}/api/conf/firebase-web`, {
      cache: 'no-store',
    });
    if (!res.ok) return;
    const cfg = (await res.json()) as Partial<FirebaseWebPublicShape>;
    if (cfg.apiKey && cfg.appId && cfg.projectId) {
      globalThis.__MINWASTE_FIREBASE_WEB__ = cfg as FirebaseWebPublicShape;
    }
  } catch {
    /* backend arrêté / CORS */
  }
}

export function getResolvedFirebaseWebAppConfig(): FirebaseWebPublicShape {
  const fromApi = globalThis.__MINWASTE_FIREBASE_WEB__;
  if (fromApi?.apiKey && fromApi?.appId) {
    const out: FirebaseWebPublicShape = {
      apiKey: fromApi.apiKey,
      authDomain: fromApi.authDomain || firebaseWebAppConfigFallback.authDomain,
      projectId: fromApi.projectId || firebaseWebAppConfigFallback.projectId,
      storageBucket:
        fromApi.storageBucket || firebaseWebAppConfigFallback.storageBucket,
      messagingSenderId:
        fromApi.messagingSenderId ||
        firebaseWebAppConfigFallback.messagingSenderId,
      appId: fromApi.appId,
    };
    const mid = fromApi.measurementId?.trim();
    if (mid) out.measurementId = mid;
    return out;
  }
  return { ...firebaseWebAppConfigFallback };
}
