import { supabase } from "@/lib/supabase";

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
    if (error) return { ok: false, error: error.message };
    if (!data?.ok) return { ok: false, error: data?.error ?? "Account deletion failed." };

    // Supabase JWTs remain valid until expiry after admin deletion, so clear
    // the local session immediately on the deleting device.
    await supabase.auth.signOut({ scope: "local" });
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Account deletion failed.",
    };
  }
}
