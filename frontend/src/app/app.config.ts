import { ApplicationConfig, provideAppInitializer } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { adminApiAuthInterceptor } from './core/http/admin-api-auth.interceptor';
import { provideApollo } from 'apollo-angular';
import { routes } from './app.routes';
import { apolloOptionsFactory } from './core/graphql/apollo.provider';
import { loadFirebaseWebConfigFromBackend } from './core/auth/firebase-web.config';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAppInitializer(() => loadFirebaseWebConfigFromBackend()),
    provideRouter(routes),
    provideHttpClient(withInterceptors([adminApiAuthInterceptor])),
    provideApollo(() => apolloOptionsFactory()), // ✅ passe la factory ici
  ],
};