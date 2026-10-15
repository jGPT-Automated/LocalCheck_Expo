import { supabase } from "@/lib/supabase";

const DELETE_FAILED =
  "We couldn't delete your account just now. Check your connection and try again.";

export interface DeleteAccountResult {
  ok: boolean;
  error?: string;
}

/**
 * Permanently deletes the authenticated account through a server-side Edge
 * Function. The service-role credential never enters the app. Apple accounts
 * pass a fresh authorization code so the function can revoke Apple's token
 * before removing the Supabase user.
 */
export async function deleteCurrentAccount(
  appleAuthorizationCode?: string | null
): Promise<DeleteAccountResult> {
  try {
    const { data, error } = await supabase.functions.invoke("delete-account", {
      body: { appleAuthorizationCode: appleAuthorizationCode ?? null },
    });
    if (error || !data?.ok) {
      console.warn("delete-account failed", error?.message ?? data?.error);
      return { ok: false, error: DELETE_FAILED };
    }

    // Supabase JWTs remain valid until expiry after admin deletion, so clear
    // the local session immediately on the deleting device.
    await supabase.auth.signOut({ scope: "local" });
    return { ok: true };
  } catch (error) {
    console.warn("delete-account threw", error);
    return { ok: false, error: DELETE_FAILED };
  }
}
