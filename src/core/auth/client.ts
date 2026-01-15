import { oneTapClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

import { envConfigs } from '@/config';

// Ensure baseURL is set correctly, especially for development
const getBaseURL = () => {
  if (envConfigs.auth_url) {
    return envConfigs.auth_url;
  }
  // Fallback for development
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
};

// auth client for client-side use
export const authClient = createAuthClient({
  baseURL: getBaseURL(),
  secret: envConfigs.auth_secret,
  fetchOptions: {
    // Add timeout and error handling
    onError: (error) => {
      // Silently handle network errors to avoid console spam
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (!errorMessage.includes('ERR_NETWORK_IO_SUSPENDED') && 
          !errorMessage.includes('Failed to fetch') &&
          !errorMessage.includes('NetworkError')) {
        console.warn('[Better Auth] Request error:', errorMessage);
      }
    },
  },
});

// export auth client methods
export const { signIn, signUp, signOut, useSession } = authClient;

// get auth client with configs
export function getAuthClient(configs: Record<string, string>) {
  const authClient = createAuthClient({
    baseURL: getBaseURL(),
    secret: envConfigs.auth_secret,
    fetchOptions: {
      // Add timeout and error handling
      onError: (error) => {
        // Silently handle network errors to avoid console spam
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (!errorMessage.includes('ERR_NETWORK_IO_SUSPENDED') && 
            !errorMessage.includes('Failed to fetch') &&
            !errorMessage.includes('NetworkError')) {
          console.warn('[Better Auth] Request error:', errorMessage);
        }
      },
    },
    plugins:
      configs.google_client_id && configs.google_one_tap_enabled === 'true'
        ? [
            oneTapClient({
              clientId: configs.google_client_id,
              // Optional client configuration:
              autoSelect: false,
              cancelOnTapOutside: false,
              context: 'signin',
              additionalOptions: {
                // Any extra options for the Google initialize method
              },
              // Configure prompt behavior and exponential backoff:
              promptOptions: {
                baseDelay: 1000, // Base delay in ms (default: 1000)
                maxAttempts: 1, // Only attempt once to avoid multiple error logs (default: 5)
              },
            }),
          ]
        : [],
  });

  return authClient;
}
