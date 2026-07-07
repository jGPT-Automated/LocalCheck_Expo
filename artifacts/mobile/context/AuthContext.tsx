import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { Platform } from "react-native";

import { supabase } from "@/lib/supabase";

import type { Session, User } from "@supabase/supabase-js";

// Matches the actual `profiles` table schema
export interface UserProfile {
  id: string;
  email: string | null;
  display_name: string;
  username: string;
  avatar_url: string | null;
  elo_rating: number;
  wins: number;
  losses: number;
  total_court_time_minutes: number;
  apple_private_email: boolean;
  push_notifications_enabled: boolean;
  check_in_reminders_enabled: boolean;
  game_alerts_enabled: boolean;
  local_court_id: string | null;
  preferred_sport: string | null;
  is_pro: boolean;
  created_at: string;
  updated_at: string;
}

interface AuthResult {
  error: string | null;
}

interface SignUpResult extends AuthResult {
  needsEmailConfirmation: boolean;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  isLoading: boolean;
  signUpWithEmail: (email: string, password: string, displayName?: string) => Promise<SignUpResult>;
  signInWithEmail: (email: string, password: string) => Promise<AuthResult>;
  signInWithApple: () => Promise<AuthResult>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadProfile = useCallback(async (userId: string): Promise<UserProfile | null> => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    return (data as UserProfile) ?? null;
  }, []);

  // The `handle_new_user` DB trigger creates the profile row on signup. It fires
  // a beat after the client gets its session, so we poll briefly; if it still
  // hasn't appeared we insert the row ourselves (allowed by profiles_insert_self)
  // so a profile is always guaranteed.
  const waitForProfile = useCallback(
    async (authUser: User): Promise<{ error: string | null }> => {
      const maxAttempts = 5;
      const retryDelayMs = 300;

      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const existing = await loadProfile(authUser.id);
        if (existing) {
          setProfile(existing);
          return { error: null };
        }
        if (attempt < maxAttempts - 1) {
          await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
        }
      }

      // Fallback: provision the profile client-side.
      const meta = authUser.user_metadata ?? {};
      const emailLocal = (authUser.email ?? "").split("@")[0];
      const displayName =
        (meta.display_name as string) || (meta.full_name as string) || emailLocal || "Player";
      const base = (displayName || "player").toLowerCase().replace(/[^a-z0-9_]+/g, "").slice(0, 23) || "player";
      const username = `${base}_${authUser.id.replace(/-/g, "").slice(0, 8)}`;

      const { error: insertError } = await supabase
        .from("profiles")
        .insert({
          id: authUser.id,
          email: authUser.email,
          display_name: displayName,
          username,
        });

      if (!insertError || insertError.code === "23505") {
        const created = await loadProfile(authUser.id);
        if (created) {
          setProfile(created);
          return { error: null };
        }
      }

      setProfile(null);
      return { error: "Could not set up your profile. Please try again." };
    },
    [loadProfile]
  );

  useEffect(() => {
    // Restore session on mount
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        await waitForProfile(s.user);
      }
      setIsLoading(false);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, s) => {
        setSession(s);
        setUser(s?.user ?? null);
        if (s?.user) {
          await waitForProfile(s.user);
        } else {
          setProfile(null);
        }
        setIsLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, [waitForProfile]);

  const signUpWithEmail = useCallback(
    async (email: string, password: string, displayName?: string) => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: displayName },
        },
      });
      if (error) {
        return { error: error.message, needsEmailConfirmation: false };
      }
      if (!data.session) {
        return { error: null, needsEmailConfirmation: true };
      }
      const profileResult = await waitForProfile(data.session.user);
      return { ...profileResult, needsEmailConfirmation: false };
    },
    [waitForProfile]
  );

  const signInWithEmail = useCallback(
    async (email: string, password: string) => {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        return { error: error.message };
      }
      if (data.user) {
        return await waitForProfile(data.user);
      }
      return { error: null };
    },
    [waitForProfile]
  );

  const signInWithApple = useCallback(async () => {
    if (Platform.OS !== "ios") {
      return { error: "Apple Sign-In is only available on iOS" };
    }
    try {
      const nonce = Crypto.randomUUID();
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        nonce
      );

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });

      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: "apple",
        token: credential.identityToken!,
        nonce,
      });

      if (error) {
        return { error: error.message };
      }
      if (data.user) {
        return await waitForProfile(data.user);
      }
      return { error: null };
    } catch (err: any) {
      // ERR_REQUEST_CANCELED means the user dismissed the sheet — not a real error
      if (err?.code === "ERR_REQUEST_CANCELED") {
        return { error: null };
      }
      return { error: err?.message ?? "Apple Sign-In failed" };
    }
  }, [waitForProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        isLoading,
        signUpWithEmail,
        signInWithEmail,
        signInWithApple,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
