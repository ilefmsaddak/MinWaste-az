import {
  Controller,
  Get,
  ServiceUnavailableException,
} from '@nestjs/common';
import * as fs from 'fs';
import {
  type FirebaseWebPublicDto,
  readStandaloneWebAppJson,
  resolveFirebaseJsonPaths,
  resolveFirebaseWebAppJsonPaths,
  tryReadWebFromServiceAccountJson,
} from './firebase-web-config.util';

@Controller('api/conf')
export class FirebaseWebPublicController {
  @Get('firebase-web')
  getFirebaseWeb(): Record<string, string> {
    let saBad: 'incomplete' | 'placeholder' | null = null;
    const saPath = resolveFirebaseJsonPaths().find((p) => fs.existsSync(p));
    if (saPath) {
      const fromSa = tryReadWebFromServiceAccountJson(saPath);
      if (fromSa && typeof fromSa === 'object') return fromSa;
      if (fromSa === 'incomplete' || fromSa === 'placeholder') saBad = fromSa;
    }

    let st: FirebaseWebPublicDto | 'incomplete' | 'placeholder' | undefined;
    const webPath = resolveFirebaseWebAppJsonPaths().find((p) =>
      fs.existsSync(p),
    );
    if (webPath) st = readStandaloneWebAppJson(webPath);

    if (st && typeof st === 'object') return st;

    if (saBad === 'incomplete') {
      throw new ServiceUnavailableException(
        'Ajoutez dans secrets/firebase.json un objet "web" avec apiKey, appId, messagingSenderId (console Firebase → projet minwaste-app → Paramètres → Vos applications). Les tokens doivent être du même projet que FIREBASE_PROJECT_ID.',
      );
    }
    if (saBad === 'placeholder') {
      throw new ServiceUnavailableException(
        'secrets/firebase.json → web : remplacez les valeurs modèle par les vraies clés du projet minwaste-app.',
      );
    }
    if (st === 'incomplete') {
      throw new ServiceUnavailableException(
        'firebase-web-app.json incomplet (apiKey, appId, projectId requis).',
      );
    }
    if (st === 'placeholder') {
      throw new ServiceUnavailableException(
        'firebase-web-app.json : remplacez les valeurs modèle par les clés minwaste-app.',
      );
    }

    throw new ServiceUnavailableException(
      'Config Web Firebase absente : ajoutez "web" { apiKey, appId, … } dans secrets/firebase.json (même projet que le compte de service / minwaste-app).',
    );
  }
}
