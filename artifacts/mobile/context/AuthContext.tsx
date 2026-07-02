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
  created_at: string;
  updated_at: string;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  isLoading: boolean;
  signUpWithEmail: (email: string, password: string, displayName?: string) => Promise<{ error: string | null }>;
  signInWithEmail: (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithApple: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  ensureProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Generate a username candidate from email or display name */
function generateUsername(email: string | undefined, displayName: string | undefined): string {
  const base = (email?.split("@")[0] ?? displayName ?? "player")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .slice(0, 20);
  const suffix = Math.floor(Math.random() * 9000 + 1000); // 4-digit number
  return `${base}_${suffix}`;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();
      if (data) {
        setProfile(data as UserProfile);
      }
    } catch {
      // Profile may not exist yet
    }
  }, []);

  const ensureProfile = useCallback(async () => {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) return;

    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", currentUser.id)
      .single();

    if (!existing) {
      const displayName =
        currentUser.user_metadata?.display_name ??
        currentUser.user_metadata?.full_name ??
        currentUser.email?.split("@")[0] ??
        "Player";

      const username = generateUsername(currentUser.email, displayName);

      await supabase.from("profiles").insert({
        id: currentUser.id,
        email: currentUser.email ?? null,
        display_name: displayName,
        username,
        avatar_url: currentUser.user_metadata?.avatar_url ?? null,
        elo_rating: 1200,
        wins: 0,
        losses: 0,
        total_court_time_minutes: 0,
        apple_private_email: false,
        push_notifications_enabled: true,
        check_in_reminders_enabled: true,
        game_alerts_enabled: true,
        local_court_id: null,
      });
    }

    await fetchProfile(currentUser.id);
  }, [fetchProfile]);

  useEffect(() => {
    // Restore session on mount
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        fetchProfile(s.user.id);
      }
      setIsLoading(false);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, s) => {
        setSession(s);
        setUser(s?.user ?? null);
        if (s?.user) {
          await fetchProfile(s.user.id);
        } else {
          setProfile(null);
        }
        setIsLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const signUpWithEmail = useCallback(
    async (email: string, password: string, displayName?: string) => {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: displayName },
        },
      });
      if (!error) {
        await ensureProfile();
      }
      return { error: error?.message ?? null };
    },
    [ensureProfile]
  );

  const signInWithEmail = useCallback(
    async (email: string, password: string) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (!error) {
        await ensureProfile();
      }
      return { error: error?.message ?? null };
    },
    [ensureProfile]
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

      const { error } = await supabase.auth.signInWithIdToken({
        provider: "apple",
        token: credential.identityToken!,
        nonce,
      });

      if (!error) {
        await ensureProfile();
      }
      return { error: error?.message ?? null };
    } catch (err: any) {
      // ERR_REQUEST_CANCELED means the user dismissed the sheet — not a real error
      if (err?.code === "ERR_REQUEST_CANCELED") {
        return { error: null };
      }
      return { error: err?.message ?? "Apple Sign-In failed" };
    }
  }, [ensureProfile]);

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
        ensureProfile,
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
