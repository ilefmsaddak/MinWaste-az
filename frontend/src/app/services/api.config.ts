/** Same port as Nest backend in Docker (see backend/.env) */
const DEFAULT_API_URL = 'https://minwaste-app.thankfulocean-0d5f73fc.westeurope.azurecontainerapps.io/api';

function getApiBaseUrl(): string {
  if (typeof window === 'undefined') {
    return DEFAULT_API_URL;
  }
  const envUrl = (window as any).__API_URL__;
  if (envUrl) {
    return envUrl;
  }
  const storedUrl = localStorage.getItem('API_BASE_URL');
  if (storedUrl) {
    return storedUrl;
  }
  return DEFAULT_API_URL;
}

export const API_CONFIG = {
  BASE_URL: getApiBaseUrl(),

  ENDPOINTS: {
    ITEMS: '/items',
    USERS: '/users',
    TRANSACTIONS: '/transactions',
    REVIEWS: '/reviews',
    MESSAGES: '/messages',
  },

  TIMEOUT: 30000,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000,
};

export const getApiConfig = () => {
  if (typeof window === 'undefined') {
    return API_CONFIG;
  }
  const hostname = window.location.hostname;

  if (hostname === 'yourdomain.com' || hostname.includes('production')) {
    return {
      ...API_CONFIG,
      BASE_URL: 'https://api.yourdomain.com/api',
    };
  }

  if (hostname === 'staging.yourdomain.com' || hostname.includes('staging')) {
    return {
      ...API_CONFIG,
      BASE_URL: 'https://api.staging.yourdomain.com/api',
    };
  }

  return {
    ...API_CONFIG,
    BASE_URL: getApiBaseUrl(),
  };
};

export function setApiUrl(url: string): void {
  localStorage.setItem('API_BASE_URL', url);
  location.reload();
}

/** e.g. `http://localhost:4000` from `http://localhost:4000/api` — for `/chat` and Socket.IO */
export function getHttpOriginFromApiBase(): string {
  const base = getApiBaseUrl().replace(/\/$/, '');
  const withoutApi = base.replace(/\/api\/?$/i, '');
  return withoutApi || base;
}
