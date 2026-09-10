import Constants from "expo-constants";
import * as Updates from "expo-updates";
import { Platform } from "react-native";

import { supabase } from "@/lib/supabase";

/**
 * Best-effort client error capture. The RN ErrorBoundary and the global JS
 * handler call `reportClientError`; it writes one row to `public.client_errors`
 * and swallows every failure — reporting must never itself crash or recurse.
 *
 * The table stores NO user id (crash diagnostics are a code path, not user
 * data). Inserts are authenticated-only, size-capped, and rate-limited
 * server-side. Nothing in the app reads the table — inspect it from the
 * Supabase console. A real crash/perf reporter (Sentry) is still the intended
 * replacement; fatal native crashes are not captured here.
 */

let currentRoute: string | null = null;
/** Set synchronously from the router tree so a report knows the screen even
 *  when that screen throws during its first render. */
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
    const err = error instanceof Error ? error : new Error(safeString(error));
    await supabase.from("client_errors").insert({
      message: (err.message || "unknown").slice(0, 2000),
      error_stack: err.stack ? err.stack.slice(0, 12000) : null,
      component_stack: opts.componentStack
        ? opts.componentStack.slice(0, 12000)
        : null,
      route: currentRoute ? currentRoute.slice(0, 300) : null,
      source: opts.source ?? "boundary",
      platform: Platform.OS,
      app_version: Constants.expoConfig?.version ?? null,
      update_id: Updates.isEmbeddedLaunch ? "embedded" : Updates.updateId,
      channel: Updates.channel ?? null,
      runtime_version: Updates.runtimeVersion ?? null,
    });
  } catch {
    /* offline, RLS, rate cap, whatever — drop it */
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
 * Catch non-React JS errors: the global handler (event handlers, timers) and
 * unhandled promise rejections. Call once at startup.
 *
 * Hermes only wires rejection tracking under __DEV__, so we enable the bundled
 * `promise` polyfill's tracker explicitly for release builds.
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
    // A fatal handler may reload/terminate the JS runtime before the async
    // insert lands — fatal capture here is best-effort only.
    prev?.(e, isFatal);
  });

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const tracking = require("promise/setimmediate/rejection-tracking");
    tracking.enable({
      allRejections: true,
      onUnhandled: (_id: unknown, err: unknown) =>
        void reportClientError(err, { source: "unhandled-rejection" }),
      onHandled: () => {},
    });
  } catch {
    /* polyfill shape changed — skip rejection tracking */
  }
}
