import { supabase } from "@/lib/supabase";

export type NotificationType =
  | "friend_request"
  | "friend_accepted"
  | "run_invite"
  | "match_review"
  | "match_confirmed"
  | "match_rejected";

export interface AppNotification {
  id: string;
  type: NotificationType;
  actorId: string | null;
  friendshipId: string | null;
  runId: string | null;
  matchId: string | null;
  title: string;
  body: string;
  path: string | null;
  readAt: string | null;
  createdAt: string;
}
interface NotificationRow {
  id: string;
  type: NotificationType;
  actor_id: string | null;
  friendship_id: string | null;
  run_id: string | null;
  match_id: string | null;
  title: string;
  body: string;
  data: { path?: unknown } | null;
  read_at: string | null;
  created_at: string;
}

function mapNotification(row: NotificationRow): AppNotification {
  return {
    id: row.id,
    type: row.type,
    actorId: row.actor_id,
    friendshipId: row.friendship_id,
    runId: row.run_id,
    matchId: row.match_id,
    title: row.title,
    body: row.body,
    path: typeof row.data?.path === "string" ? row.data.path : null,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

export async function fetchNotifications(limit = 50): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("id,type,actor_id,friendship_id,run_id,match_id,title,body,data,read_at,created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) {
    if (error && error.code !== "42P01") console.warn("fetchNotifications failed", error.message);
    return [];
  }
  return (data as NotificationRow[]).map(mapNotification);
}

export async function markNotificationRead(notificationId: string): Promise<boolean> {
  const { error } = await supabase.rpc("mark_notification_read", {
    p_notification_id: notificationId,
  });
  if (error) {
    console.warn("markNotificationRead failed", error.message);
    return false;
  }
  return true;
}

export async function markAllNotificationsRead(): Promise<boolean> {
  const { error } = await supabase.rpc("mark_all_notifications_read");
  if (error) {
    console.warn("markAllNotificationsRead failed", error.message);
    return false;
  }
  return true;
}

export async function setPushPreference(enabled: boolean): Promise<boolean> {
  const { data, error } = await supabase.rpc("set_push_notifications_enabled", {
    p_enabled: enabled,
  });
  if (error) {
    console.warn("setPushPreference failed", error.message);
    return false;
  }
  return data === enabled;
}

export async function savePushToken(
  token: string,
  platform: "ios" | "android"
): Promise<boolean> {
  const { error } = await supabase.rpc("register_push_token", {
    p_expo_push_token: token,
    p_platform: platform,
    p_device_id: null,
  });
  if (error) {
    console.warn("savePushToken failed", error.message);
    return false;
  }
  return true;
}

export async function inviteFriendToRun(runId: string, friendId: string): Promise<boolean> {
  const { error } = await supabase.rpc("invite_to_run", {
    p_run_id: runId,
    p_invitee_id: friendId,
  });
  if (error) {
    console.warn("inviteFriendToRun failed", error.message);
    return false;
  }
  return true;
}
