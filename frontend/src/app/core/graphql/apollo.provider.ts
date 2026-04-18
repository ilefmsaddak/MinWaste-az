import { HttpHeaders } from '@angular/common/http';
import { ApolloClientOptions, InMemoryCache } from '@apollo/client/core';
import { setContext } from '@apollo/client/link/context';
import { inject } from '@angular/core';
import { HttpLink } from 'apollo-angular/http';
import { FirebaseAuthService } from '../auth/firebase-auth.service';

/** Same port as Nest backend (see backend/src/main.ts) */
const GRAPHQL_URI = 'http://localhost:3000/graphql';

function headersToRecord(
  headers: unknown,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!headers || typeof headers !== 'object') return out;
  if (headers instanceof Headers) {
    headers.forEach((value, key) => {
      out[key] = value;
    });
    return out;
  }
  // Angular HttpHeaders: ne pas utiliser Object.entries (expose normalizedNames → CORS).
  if (headers instanceof HttpHeaders) {
    headers.keys().forEach((name) => {
      const v = headers.get(name);
      if (v != null) out[name] = v;
    });
    return out;
  }
  for (const [k, v] of Object.entries(headers as Record<string, string>)) {
    if (v != null) out[k] = String(v);
  }
  return out;
}

export function apolloOptionsFactory(): ApolloClientOptions {
  const http = inject(HttpLink);
  const auth = inject(FirebaseAuthService);

  // Utiliser HttpLink (Angular HttpClient) au lieu de createHttpLink(fetch) — évite "Invalid value" sur fetch sous Angular.
  const authLink = setContext(async (_, { headers }) => {
    const token = await auth.getIdToken();
    const h = headersToRecord(headers);
    if (token) {
      h['Authorization'] = `Bearer ${token}`;
    }
    return { headers: h };
  });

  return {
    link: authLink.concat(
      http.create({
        uri: GRAPHQL_URI,
      }),
    ),
    cache: new InMemoryCache({
      typePolicies: {
        Query: {
          fields: {
            myTransactions: {
              // Replace list on refresh/query instead of attempting array merge.
              merge: false,
            },
            myNotifications: {
              // Replace list instead of merging (avoids cache data loss warning)
              merge: false,
            },
          },
        },
      },
    }),
  };
}
