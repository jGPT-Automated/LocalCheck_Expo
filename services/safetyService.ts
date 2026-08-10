import { supabase } from "@/lib/supabase";

export type ReportReason = "spam" | "harassment" | "impersonation" | "unsafe_behavior" | "other";

interface BlockedUserRow {
  blocked_id: string;
  display_name: string;
  username: string;
  avatar_url: string | null;
  blocked_at: string;
}

export interface BlockedUser {
  id: string;
  name: string;
  username: string;
  avatarUrl: string | null;
  blockedAt: string;
}

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

export async function fetchBlockedUsers(): Promise<BlockedUser[] | null> {
  const { data, error } = await supabase.rpc("list_blocked_users");
  if (error) {
    console.warn("list_blocked_users failed", error.message);
    return null;
  }
  return ((data ?? []) as BlockedUserRow[]).map((row) => ({
    id: row.blocked_id,
    name: row.display_name || row.username || "Player",
    username: row.username,
    avatarUrl: row.avatar_url,
    blockedAt: row.blocked_at,
  }));
}

export async function unblockUser(userId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("unblock_user", { p_blocked_id: userId });
  if (error) {
    console.warn("unblock_user failed", error.message);
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
