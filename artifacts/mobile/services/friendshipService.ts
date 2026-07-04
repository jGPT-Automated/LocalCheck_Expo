import { Player } from "@/constants/data";
import { supabase } from "@/lib/supabase";

import { mapProfileToPlayer, SupabaseProfile } from "./profileService";

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

export async function addFriend(requesterId: string, addresseeId: string): Promise<void> {
  try {
    await supabase.from("friendships").insert({
      requester_id: requesterId,
      addressee_id: addresseeId,
      status: "accepted",
    });
  } catch {
    // Best-effort; UI already optimistically updates
  }
}

export async function removeFriend(userId: string, otherId: string): Promise<void> {
  try {
    await supabase
      .from("friendships")
      .delete()
      .or(
        `and(requester_id.eq.${userId},addressee_id.eq.${otherId}),and(requester_id.eq.${otherId},addressee_id.eq.${userId})`
      );
  } catch {
    // Best-effort
  }
}
