import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PlayerAvatar } from "@/components/PlayerAvatar";
import { DetailHeader } from "@/components/DetailHeader";
import { Colors } from "@/constants/colors";
import { getTierColor, Player } from "@/constants/data";
import { Typography } from "@/constants/typography";
import { useApp } from "@/context/AppContext";
import { searchPlayers } from "@/services/profileService";

export default function FriendsScreen() {
  const router = useRouter();
  const {
    isFriend,
    isFriendPending,
    addFriend,
    removeFriend,
    acceptFriendRequest,
    incomingFriendRequests,
    getFriendsList,
    currentUser,
  } = useApp();
  const { bottom } = useSafeAreaInsets();

  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"FRIENDS" | "DISCOVER">("FRIENDS");
  const [discoverResults, setDiscoverResults] = useState<Player[]>([]);
  const [discoverLoading, setDiscoverLoading] = useState(false);

  const friends = getFriendsList();

  // Search real players in Supabase when typing in DISCOVER tab
  useEffect(() => {
    if (activeTab !== "DISCOVER") return;
    let mounted = true;
    const query = search.trim().toLowerCase();
    if (query.length < 2) {
      setDiscoverResults([]);
      return;
    }
    setDiscoverLoading(true);
    searchPlayers(query).then((results) => {
      if (!mounted) return;
      setDiscoverResults(results.filter((p) => p.id !== currentUser.id));
      setDiscoverLoading(false);
    });
    return () => { mounted = false; };
  }, [activeTab, search, currentUser.id]);

  const filtered = activeTab === "FRIENDS"
    ? friends.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    : discoverResults;

  return (
    <View style={styles.container}>
      <DetailHeader title="FRIENDS" onBack={() => router.back()} />

      <View style={styles.tabRow}>
        {(["FRIENDS", "DISCOVER"] as const).map((t) => (
          <Pressable
            key={t}
            style={[styles.tabBtn, activeTab === t && styles.tabBtnActive]}
            onPress={() => setActiveTab(t)}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === t }}
          >
            <Text style={[styles.tabBtnText, activeTab === t && styles.tabBtnTextActive]}>
              {t}
            </Text>
            {t === "FRIENDS" && friends.length > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{friends.length}</Text>
              </View>
            )}
          </Pressable>
        ))}
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search" size={16} color={Colors.muted} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder={activeTab === "FRIENDS" ? "Search friends" : "Find players"}
          placeholderTextColor={Colors.mutedDark}
          autoCapitalize="none"
        />
        {search.length > 0 && (
          <Pressable
            onPress={() => setSearch("")}
            style={styles.clearSearchButton}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
          >
            <Ionicons name="close-circle" size={16} color={Colors.muted} />
          </Pressable>
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 84 : bottom + 100 }}
      >
        {activeTab === "FRIENDS" && incomingFriendRequests.length > 0 && (
          <View style={styles.requestSection}>
            <Text style={styles.requestTitle}>FRIEND REQUESTS</Text>
            {incomingFriendRequests.map((player) => (
              <View key={player.id} style={styles.requestRow}>
                <Pressable
                  style={styles.requestIdentity}
                  onPress={() => router.push(`/player/${player.id}`)}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${player.name}'s profile`}
                >
                  <PlayerAvatar initials={player.avatar} size={40} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowName}>{player.name.toUpperCase()}</Text>
                    <Text style={styles.rowElo}>{player.elo} ELO</Text>
                  </View>
                </Pressable>
                <Pressable
                  style={styles.acceptButton}
                  onPress={() => void acceptFriendRequest(player.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Accept ${player.name}'s friend request`}
                >
                  <Text style={styles.acceptButtonText}>ACCEPT</Text>
                </Pressable>
                <Pressable
                  style={styles.declineButton}
                  onPress={() => void removeFriend(player.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Decline ${player.name}'s friend request`}
                >
                  <Ionicons name="close" size={15} color={Colors.muted} />
                </Pressable>
              </View>
            ))}
          </View>
        )}

        {activeTab === "FRIENDS" && friends.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="people" size={32} color={Colors.mutedDark} />
            <Text style={styles.emptyTitle}>NO FRIENDS YET</Text>
            <Text style={styles.emptySub}>
              Add friends from the Discover tab to see their activity and head-to-head stats
            </Text>
          </View>
        )}

        {activeTab === "DISCOVER" && filtered.length === 0 && search.length > 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>NO PLAYERS FOUND</Text>
            <Text style={styles.emptySub}>Try a different name</Text>
          </View>
        )}

        {filtered.map((player) => (
          <FriendRow
            key={player.id}
            player={player}
            isFriend={isFriend(player.id)}
            isPending={isFriendPending(player.id)}
            onPress={() => router.push(`/player/${player.id}`)}
            onToggleFriend={() =>
              isFriend(player.id) ? removeFriend(player.id) : addFriend(player.id)
            }
          />
        ))}
      </ScrollView>
    </View>
  );
}

function FriendRow({
  player,
  isFriend: friendStatus,
  isPending,
  onPress,
  onToggleFriend,
}: {
  player: Player;
  isFriend: boolean;
  isPending: boolean;
  onPress: () => void;
  onToggleFriend: () => void;
}) {
  const tierColor = getTierColor(player.tier);

  return (
    <Pressable
      style={styles.row}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open ${player.name}'s profile`}
    >
      <PlayerAvatar initials={player.avatar} size={44} />
      <View style={styles.rowInfo}>
        <Text style={styles.rowName}>{player.name.toUpperCase()}</Text>
        <View style={styles.rowBadges}>
          <Text style={[styles.rowTier, { color: tierColor }]}>{player.tier}</Text>
          <Text style={styles.rowElo}>{player.elo} ELO</Text>
          <Text style={styles.rowWL}>
            {player.wins}W · {player.losses}L
          </Text>
        </View>
      </View>
      <Pressable
        style={[styles.rowAction, (friendStatus || isPending) && styles.rowActionRemove]}
        onPress={(e) => {
          e.stopPropagation();
          onToggleFriend();
        }}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={friendStatus ? `Remove ${player.name} as a friend` : isPending ? `Friend request to ${player.name} pending` : `Add ${player.name} as a friend`}
      >
        <Ionicons
          name={friendStatus ? "remove" : isPending ? "time-outline" : "add"}
          size={16}
          color={friendStatus ? Colors.loss : isPending ? Colors.muted : Colors.accent}
        />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  tabRow: {
    flexDirection: "row",
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tabBtn: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 3,
    borderBottomColor: "transparent",
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  tabBtnActive: { borderBottomColor: Colors.accent },
  tabBtnText: {
    fontFamily: Typography.heading,
    fontSize: 12,
    color: Colors.muted,
    letterSpacing: 2,
  },
  tabBtnTextActive: { color: Colors.text },
  tabBadge: {
    backgroundColor: Colors.accent,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 18,
    alignItems: "center",
  },
  tabBadgeText: {
    fontFamily: Typography.bodyBold,
    fontSize: 9,
    color: Colors.black,
  },

  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  requestSection: {
    margin: 16,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  requestTitle: {
    fontFamily: Typography.bodyBold,
    fontSize: 10,
    color: Colors.accent,
    letterSpacing: 1.5,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 8,
  },
  requestRow: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.borderSubtle,
  },
  requestIdentity: { flex: 1, minWidth: 0, minHeight: 44, flexDirection: "row", alignItems: "center", gap: 10 },
  acceptButton: { minHeight: 44, justifyContent: "center", paddingHorizontal: 11, backgroundColor: Colors.accent },
  acceptButtonText: { fontFamily: Typography.bodyBold, fontSize: 10, color: Colors.black, letterSpacing: 1 },
  declineButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.border },
  clearSearchButton: { width: 44, height: 44, marginVertical: -8, alignItems: "center", justifyContent: "center" },
  searchInput: {
    flex: 1,
    fontFamily: Typography.bodyMedium,
    fontSize: 14,
    color: Colors.text,
    paddingVertical: 4,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  rowInfo: { flex: 1 },
  rowName: {
    fontFamily: Typography.heading,
    fontSize: 14,
    color: Colors.text,
    letterSpacing: 0.3,
    marginBottom: 3,
  },
  rowBadges: { flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap" },
  rowTier: {
    fontFamily: Typography.bodyBold,
    fontSize: 9,
    letterSpacing: 1.5,
    textTransform: "uppercase" as const,
  },
  rowElo: {
    fontFamily: Typography.body,
    fontSize: 10,
    color: Colors.muted,
  },
  rowWL: {
    fontFamily: Typography.body,
    fontSize: 10,
    color: Colors.muted,
  },
  rowAction: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0.5,
    borderColor: Colors.border,
  },
  rowActionRemove: {
    borderColor: Colors.loss,
  },

  emptyState: {
    alignItems: "center",
    paddingVertical: 64,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontFamily: Typography.heading,
    fontSize: 14,
    color: Colors.muted,
    letterSpacing: 2,
    marginTop: 12,
  },
  emptySub: {
    fontFamily: Typography.bodyMedium,
    fontSize: 12,
    color: Colors.mutedDark,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 18,
  },
});
