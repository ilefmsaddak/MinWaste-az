import { ApolloClientOptions, InMemoryCache, ErrorPolicy } from '@apollo/client/core';
import { HttpLink } from 'apollo-angular/http';

/** @deprecated Utiliser `core/graphql/apollo.provider` (auth Firebase + port 4000) */
export function apolloOptionsFactory(httpLink: HttpLink) {
  const errorPolicy: ErrorPolicy = 'all';

  return {
    link: httpLink.create({
      uri: 'http://localhost:4000/graphql',
    }),
    cache: new InMemoryCache(),
    defaultOptions: {
      watchQuery: {
        errorPolicy,
      },
      query: {
        errorPolicy,
      },
    },
  };
}
