export interface ActivityLikeIdentity {
  user_id: string;
}

export function summarizeActivityHype(
  likes: ActivityLikeIdentity[] | null | undefined,
  currentUserId?: string | null,
): { hypeCount: number; hypedByCurrentUser: boolean } {
  const visibleLikes = likes ?? [];
  return {
    hypeCount: visibleLikes.length,
    hypedByCurrentUser: Boolean(
      currentUserId && visibleLikes.some((like) => like.user_id === currentUserId),
    ),
  };
}
