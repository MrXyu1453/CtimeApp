import { useColorScheme as useSystemColorScheme } from 'react-native';

/**
 * The web build is a client-only SPA (`web.output: single`), so the system
 * scheme is already correct on the first render and needs no hydration shim.
 */
export function useColorScheme() {
  return useSystemColorScheme();
}
