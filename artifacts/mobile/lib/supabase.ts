import "react-native-url-polyfill/auto";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

// Use AsyncStorage for session persistence — works in Expo Go and standalone builds.
// SecureStore requires a native dev build; for now AsyncStorage is sufficient.
const AsyncStorageAdapter = {
  getItem: (key: string): string | null | Promise<string | null> => {
    return AsyncStorage.getItem(key);
  },
  setItem: (key: string, value: string): void | Promise<void> => {
    return AsyncStorage.setItem(key, value);
  },
  removeItem: (key: string): void | Promise<void> => {
    return AsyncStorage.removeItem(key);
  },
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
