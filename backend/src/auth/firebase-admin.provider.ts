import { Provider } from '@nestjs/common';
import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

export const FIREBASE_ADMIN = 'FIREBASE_ADMIN';

export const firebaseAdminProvider: Provider = {
  provide: FIREBASE_ADMIN,
  useFactory: () => {
    if (admin.apps.length) return admin.app();

    const candidates = [
      process.env.FIREBASE_SERVICE_ACCOUNT_PATH,
      path.resolve(process.cwd(), 'secrets', 'firebase.json'),
      path.resolve(process.cwd(), 'backend', 'secrets', 'firebase.json'),
      path.resolve(__dirname, '../../secrets/firebase.json'),
    ].filter(Boolean) as string[];

    const filePath = candidates.find((p) => fs.existsSync(p));
    if (filePath) {
      const parsed = JSON.parse(
        fs.readFileSync(filePath, 'utf-8'),
      ) as Record<string, unknown>;
      const { web: _omitWeb, ...rawAccount } = parsed;
      const serviceAccount = rawAccount as admin.ServiceAccount & {
        project_id?: string;
      };

      const envProjectId = process.env.FIREBASE_PROJECT_ID?.trim();
      const resolvedProjectId =
        envProjectId ||
        serviceAccount.projectId ||
        serviceAccount.project_id;

      const options: admin.AppOptions = {
        credential: admin.credential.cert(serviceAccount),
      };
      if (resolvedProjectId) {
        options.projectId = resolvedProjectId;
      }

      return admin.initializeApp(options);
    }

    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (projectId && clientEmail && privateKey) {
      return admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
    }

    console.error('Firebase paths attempted:', candidates);
    throw new Error(
      'Firebase Admin: place secrets/firebase.json OR set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY in .env',
    );
  },
};
