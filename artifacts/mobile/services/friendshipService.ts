import { Player } from "@/constants/data";
import { supabase } from "@/lib/supabase";

import { mapProfileToPlayer, SupabaseProfile } from "./profileService";

/**
 * `friendships.status` in LocalCheckProd. `request_friend` always creates
 * 'pending' — there is no client path that produces 'accepted' directly.
 */
export type FriendshipStatus = "pending" | "accepted" | "blocked";

export interface FriendshipState {
  status: FriendshipStatus;
  /** True when the signed-in user sent the request and is awaiting a reply. */
  outgoing: boolean;
}

// ─── Public API ─────────────────────────────────────────────────────────────

export async function fetchFriends(userId: string): Promise<Player[]> {
  try {
    const { data, error } = await supabase
      .from("friendships")
      .select("addressee_id, requester_id, addressee:profiles!friendships_addressee_id_fkey(*), requester:profiles!friendships_requester_id_fkey(*)")
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
      .eq("status", "accepted");

    if (error || !data) return [];

    const friends: Player[] = [];
    for (const row of data as unknown as Array<{
      requester_id: string;
      addressee_id: string;
      requester: SupabaseProfile | null;
      addressee: SupabaseProfile | null;
    }>) {
      const other = row.requester_id === userId ? row.addressee : row.requester;
      if (other) friends.push(mapProfileToPlayer(other));
    }
    return friends;
  } catch {
    return [];
  }
}

export async function fetchFriendIds(userId: string): Promise<string[]> {
  const friends = await fetchFriends(userId);
  return friends.map((f) => f.id);
}

/** Pending requests addressed to the signed-in user, with requester profiles. */
export async function fetchIncomingFriendRequests(userId: string): Promise<Player[]> {
  const { data, error } = await supabase
    .from("friendships")
    .select("requester:profiles!friendships_requester_id_fkey(*)")
    .eq("addressee_id", userId)
    .eq("status", "pending");
  if (error || !data) {
    if (error) console.warn("fetchIncomingFriendRequests failed", error.message);
    return [];
  }
  return (data as unknown as Array<{ requester: SupabaseProfile | null }>)
    .flatMap((row) => row.requester ? [mapProfileToPlayer(row.requester)] : []);
}

/**
 * Every friendship row involving this user, keyed by the *other* user's id,
 * including 'pending' ones. `fetchFriends` deliberately returns only accepted
 * friends; this is what lets a profile button say "REQUESTED" instead of
 * silently reverting to "ADD FRIEND" after a request succeeds.
 */
export async function fetchFriendshipStates(
  userId: string
): Promise<Record<string, FriendshipState>> {
  const { data, error } = await supabase
    .from("friendships")
    .select("requester_id, addressee_id, status")
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);

  if (error || !data) {
    if (error) console.warn("fetchFriendshipStates failed", error.message);
    return {};
  }

  const states: Record<string, FriendshipState> = {};
  for (const row of data as Array<{
    requester_id: string;
    addressee_id: string;
    status: FriendshipStatus;
  }>) {
    const outgoing = row.requester_id === userId;
    const otherId = outgoing ? row.addressee_id : row.requester_id;
    states[otherId] = { status: row.status, outgoing };
  }
  return states;
}

/**
 * Send a friend request.
 *
 * This used to `insert` into `friendships` directly with status 'accepted',
 * which is why Add Friend silently did nothing from build 9 onward: the v2
 * backend grants `authenticated` SELECT-only on `friendships` and routes every
 * write through a SECURITY DEFINER RPC, so the insert was rejected with 42501.
 * The old code neither destructured `error` nor could its `catch` fire —
 * supabase-js returns errors, it does not throw — so the failure vanished while
 * the UI optimistically showed success.
 *
 * `request_friend` creates the row as **'pending'**, not 'accepted'. Callers
 * must not treat a resolved promise as "now friends"; use the returned status.
 */
export async function addFriend(
  _requesterId: string,
  addresseeId: string
): Promise<FriendshipStatus | null> {
  const { data, error } = await supabase
    .rpc("request_friend", { p_addressee_id: addresseeId })
    .single();
  if (error) {
    console.warn("request_friend failed", error.message);
    return null;
  }
  return ((data as { status?: string } | null)?.status as FriendshipStatus) ?? null;
}

/** Accept a request someone else sent us. Returns false if none was pending. */
export async function acceptFriendRequest(requesterId: string): Promise<boolean> {
  const { error } = await supabase
    .rpc("accept_friend_request", { p_requester_id: requesterId })
    .single();
  if (error) {
    console.warn("accept_friend_request failed", error.message);
    return false;
  }
  return true;
}

/** Remove a friendship or withdraw/decline a request, in either direction. */
export async function removeFriend(_userId: string, otherId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("remove_friendship", {
    p_other_user_id: otherId,
  });
  if (error) {
    console.warn("remove_friendship failed", error.message);
    return false;
  }
  return data === true;
}
