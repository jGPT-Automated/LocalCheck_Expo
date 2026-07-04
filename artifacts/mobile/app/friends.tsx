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
import { Colors } from "@/constants/colors";
import { getTierColor, Player } from "@/constants/data";
import { Typography } from "@/constants/typography";
import { useApp } from "@/context/AppContext";
import { searchPlayers } from "@/services/profileService";

export default function FriendsScreen() {
  const router = useRouter();
  const { friendIds, isFriend, addFriend, removeFriend, getFriendsList, currentUser } = useApp();
  const { top, bottom } = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : top;

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
      <View style={[styles.header, { paddingTop: topPad + 12 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>FRIENDS</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={styles.tabRow}>
        {(["FRIENDS", "DISCOVER"] as const).map((t) => (
          <Pressable
            key={t}
            style={[styles.tabBtn, activeTab === t && styles.tabBtnActive]}
            onPress={() => setActiveTab(t)}
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
          <Pressable onPress={() => setSearch("")} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color={Colors.muted} />
          </Pressable>
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 84 : bottom + 100 }}
      >
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
  onPress,
  onToggleFriend,
}: {
  player: Player;
  isFriend: boolean;
  onPress: () => void;
  onToggleFriend: () => void;
}) {
  const tierColor = getTierColor(player.tier);

  return (
    <Pressable style={styles.row} onPress={onPress}>
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
        style={[styles.rowAction, friendStatus && styles.rowActionRemove]}
        onPress={(e) => {
          e.stopPropagation();
          onToggleFriend();
        }}
        hitSlop={10}
      >
        <Ionicons
          name={friendStatus ? "remove" : "add"}
          size={16}
          color={friendStatus ? Colors.loss : Colors.win}
        />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: Colors.surface,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontFamily: Typography.heading,
    fontSize: 14,
    color: Colors.text,
    letterSpacing: 3,
  },

  tabRow: {
    flexDirection: "row",
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tabBtn: {
    flex: 1,
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
    width: 32,
    height: 32,
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
