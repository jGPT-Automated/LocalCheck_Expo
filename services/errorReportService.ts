import Constants from "expo-constants";
import { Platform } from "react-native";

import { supabase } from "@/lib/supabase";

/**
 * Best-effort client error capture. The RN ErrorBoundary and the global JS
 * handler call `reportClientError`; it writes one row to `public.client_errors`
 * and swallows every failure — reporting must never itself crash or recurse.
 * Nothing in the app reads this table; inspect it from the Supabase console.
 */

let currentRoute: string | null = null;
/** Kept current by a tiny hook in the root layout so a report knows the screen. */
export function setCurrentRoute(route: string | null): void {
  currentRoute = route;
}

let inFlight = false;

export async function reportClientError(
  error: unknown,
  opts: { componentStack?: string; source?: string } = {},
): Promise<void> {
  if (inFlight) return;
  inFlight = true;
  try {
    const err =
      error instanceof Error ? error : new Error(safeString(error));
    let userId: string | null = null;
    try {
      const { data } = await supabase.auth.getUser();
      userId = data.user?.id ?? null;
    } catch {
      /* not signed in / offline */
    }
    await supabase.from("client_errors").insert({
      user_id: userId,
      message: (err.message || "unknown").slice(0, 2000),
      error_stack: err.stack ? err.stack.slice(0, 8000) : null,
      component_stack: opts.componentStack
        ? opts.componentStack.slice(0, 8000)
        : null,
      route: currentRoute,
      source: opts.source ?? "boundary",
      platform: Platform.OS,
      app_version: Constants.expoConfig?.version ?? null,
    });
  } catch {
    /* offline, RLS, whatever — drop it */
  } finally {
    inFlight = false;
  }
}

function safeString(value: unknown): string {
  try {
    return typeof value === "string" ? value : JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/**
 * Catch non-React JS errors too (event handlers, timers, rejected promises the
 * app didn't handle). Call once at startup.
 */
export function installGlobalErrorHandler(): void {
  const g = globalThis as unknown as {
    ErrorUtils?: {
      getGlobalHandler?: () => (e: unknown, isFatal?: boolean) => void;
      setGlobalHandler?: (h: (e: unknown, isFatal?: boolean) => void) => void;
    };
  };
  const prev = g.ErrorUtils?.getGlobalHandler?.();
  g.ErrorUtils?.setGlobalHandler?.((e, isFatal) => {
    void reportClientError(e, { source: isFatal ? "global-fatal" : "global" });
    prev?.(e, isFatal);
  });
}
