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
import type { AccountTag } from "@/constants/data";
import { identifyPurchaser, resetPurchaser } from "@/services/purchasesService";

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
  elo_basketball: number;
  elo_pickleball: number;
  basketball_wins: number;
  basketball_losses: number;
  pickleball_wins: number;
  pickleball_losses: number;
  total_court_time_minutes: number;
  apple_private_email: boolean;
  push_notifications_enabled: boolean;
  check_in_reminders_enabled: boolean;
  game_alerts_enabled: boolean;
  local_court_id: string | null;
  preferred_sport: string | null;
  postal_code: string | null;
  is_pro: boolean;
  /** Persistent identity-level privacy: governs check-ins, schedule, and the
   *  leaderboard. Absent until the profile-visibility migration is applied. */
  visibility?: "public" | "friends" | "private";
  created_at: string;
  updated_at: string;
  /** Account classification tag — FOUNDER | STARTER | REVIEWER | TEST | null.
   *  Source of truth: profiles.account_tag. See docs/runbooks/ACCOUNT_TAGS.md. */
  account_tag?: AccountTag | null;
  // PR #43 additions — absent until the founding/referral migration is applied.
  referral_code?: string | null;
  recruited_by?: string | null;
  recruits_count?: number;
  local_court_changed_at?: string | null;
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
  signUpWithEmail: (
    email: string,
    password: string,
    displayName?: string,
  ) => Promise<SignUpResult>;
  signInWithEmail: (email: string, password: string) => Promise<AuthResult>;
  signInWithApple: () => Promise<AuthResult>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadProfile = useCallback(
    async (userId: string): Promise<UserProfile | null> => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();
      return (data as UserProfile) ?? null;
    },
    [],
  );

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
        (meta.display_name as string) ||
        (meta.full_name as string) ||
        emailLocal ||
        "Player";
      // Mirrors private.generate_username: prefer the clean handle, fall back to
      // an id-tailed one only if it's taken. This path only runs when the DB
      // trigger hasn't provisioned the row yet, so a 23505 usually just means
      // the trigger won the race — reload and use its (friendly) handle.
      const idTail = authUser.id.replace(/-/g, "");
      let base =
        (displayName || "player")
          .toLowerCase()
          .replace(/[^a-z0-9_]+/g, "")
          .slice(0, 20) || "player";
      if (base.length < 3) base = `${base}xxx`.slice(0, 20);

      const tryInsert = (username: string) =>
        supabase.from("profiles").insert({
          id: authUser.id,
          display_name: displayName,
          username,
        });

      let { error: insertError } = await tryInsert(base);
      if (insertError && insertError.code === "23505") {
        const created = await loadProfile(authUser.id);
        if (created) {
          setProfile(created);
          return { error: null };
        }
        // Row still absent: the clash is on the handle, not the id — take a
        // unique id-tailed handle.
        ({ error: insertError } = await tryInsert(`${base}_${idTail.slice(0, 6)}`));
      }

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
    [loadProfile],
  );

  useEffect(() => {
    // Restore session on mount
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      // Authenticate the Realtime socket before private Broadcast channels
      // subscribe. Without this JWT, realtime.messages RLS rejects every
      // scoped invalidation. setAuth is synchronous (no API call).
      supabase.realtime.setAuth(s?.access_token ?? null);
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        await waitForProfile(s.user);
      }
      setIsLoading(false);
    });

    // Listen for auth state changes
    // Callback stays SYNCHRONOUS — Supabase documents that awaiting other
    // supabase calls inside onAuthStateChange can deadlock every subsequent
    // API request. Profile provisioning is deferred to the next tick.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      // Keep the Realtime socket's JWT fresh on SIGNED_IN + TOKEN_REFRESHED
      // (and clear it on SIGNED_OUT). Synchronous — safe inside the callback.
      supabase.realtime.setAuth(s?.access_token ?? null);
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        const u = s.user;
        setTimeout(() => {
          waitForProfile(u).finally(() => setIsLoading(false));
        }, 0);
      } else {
        setProfile(null);
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [waitForProfile]);

  // Ties RevenueCat's app_user_id to the signed-in Supabase user, so the
  // revenuecat-webhook can write purchases straight onto profiles.id. A
  // dedicated effect (not the synchronous auth-state-change callback above,
  // which must stay sync) so it fires once per real identity change, on both
  // the cold-start restore and a live sign-in/out.
  useEffect(() => {
    if (user?.id) {
      void identifyPurchaser(user.id);
    } else {
      void resetPurchaser();
    }
  }, [user?.id]);

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
    [waitForProfile],
  );

  const signInWithEmail = useCallback(
    async (email: string, password: string) => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        return { error: error.message };
      }
      if (data.user) {
        return await waitForProfile(data.user);
      }
      return { error: null };
    },
    [waitForProfile],
  );

  const signInWithApple = useCallback(async () => {
    if (Platform.OS !== "ios") {
      return { error: "Apple Sign-In is only available on iOS" };
    }
    try {
      const nonce = Crypto.randomUUID();
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        nonce,
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

  // Re-read the profile row (e.g. after log_game updates elo/wins server-side).
  const refreshProfile = useCallback(async () => {
    if (!user?.id) return;
    const fresh = await loadProfile(user.id);
    if (fresh) setProfile(fresh);
  }, [user?.id, loadProfile]);

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
        refreshProfile,
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
