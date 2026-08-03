import { supabase } from "@/lib/supabase";

export type ReportReason = "spam" | "harassment" | "impersonation" | "unsafe_behavior" | "other";

export async function safetyControlsAvailable(): Promise<boolean> {
  const { data, error } = await supabase.rpc("safety_controls_available");
  return !error && data === true;
}

export async function blockUser(userId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("block_user", { p_blocked_id: userId });
  if (error) {
    console.warn("block_user failed", error.message);
    return false;
  }
  return data === true;
}

export async function reportUser(userId: string, reason: ReportReason): Promise<boolean> {
  const { data, error } = await supabase.rpc("report_user", {
    p_reported_id: userId,
    p_reason: reason,
    p_details: null,
  });
  if (error) {
    console.warn("report_user failed", error.message);
    return false;
  }
  return typeof data === "string" && data.length > 0;
}
