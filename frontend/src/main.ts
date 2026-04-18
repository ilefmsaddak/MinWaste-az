import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { loadFirebaseWebConfigFromBackend } from './app/core/auth/firebase-web.config';

(async () => {
  await loadFirebaseWebConfigFromBackend();
  bootstrapApplication(App, appConfig)
    .catch((err) => console.error(err));
})();
