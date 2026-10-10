import "react-native-url-polyfill/auto";

import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

// SecureStore adapter for Supabase auth session persistence.
//
// Readable after the first unlock, not only while unlocked: auto check-in
// (D35) runs when iOS wakes the app for a geofence, usually with the phone
// locked in a pocket, and it needs the session to call Supabase.
// SecureStore only sets accessibility when an item is created (an update
// keeps the old setting), so writes delete first. Existing sessions move
// over at their next token refresh.
const KEYCHAIN = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK };

const ExpoSecureStoreAdapter = {
  getItem: (key: string): string | null | Promise<string | null> => {
    return SecureStore.getItemAsync(key, KEYCHAIN);
  },
  setItem: async (key: string, value: string): Promise<void> => {
    await SecureStore.deleteItemAsync(key, KEYCHAIN);
    await SecureStore.setItemAsync(key, value, KEYCHAIN);
  },
  removeItem: (key: string): void | Promise<void> => {
    return SecureStore.deleteItemAsync(key, KEYCHAIN);
  },
};

// SecureStore is native-only and throws on web (breaks every Supabase call,
// including anonymous court reads). On web, persist the auth session in
// localStorage so the Expo web preview works; native still uses SecureStore.
const WebStorageAdapter = {
  getItem: (key: string) =>
    typeof localStorage !== "undefined" ? localStorage.getItem(key) : null,
  setItem: (key: string, value: string) => {
    if (typeof localStorage !== "undefined") localStorage.setItem(key, value);
  },
  removeItem: (key: string) => {
    if (typeof localStorage !== "undefined") localStorage.removeItem(key);
  },
};
const AuthStorageAdapter =
  Platform.OS === "web" ? WebStorageAdapter : ExpoSecureStoreAdapter;

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AuthStorageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
