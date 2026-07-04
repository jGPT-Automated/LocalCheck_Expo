import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FeedCard } from "@/components/FeedCard";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { Colors, Radius } from "@/constants/colors";
import { CourtSport, Player } from "@/constants/data";
import { Typography } from "@/constants/typography";
import { useApp } from "@/context/AppContext";
import { fetchLeaderboard } from "@/services/profileService";

type Section = "ACTIVITY" | "LEADERS";
const SPORT_FILTERS: (CourtSport | "ALL")[] = ["ALL", "BASKETBALL", "PICKLEBALL"];

const TIER_COLORS: Record<string, string> = {
  PLATINUM: "#E8E8FF",
  GOLD: "#FFD53D",
  SILVER: "#9A9AAA",
  BRONZE: "#CF8558",
  UNRANKED: "#3A3A50",
};

export default function FeedScreen() {
  const { feed, localCourtId, localCourt } = useApp();
  const { top } = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : top;
  const [section, setSection] = useState<Section>("ACTIVITY");
  const [sportFilter, setSportFilter] = useState<CourtSport | "ALL">("ALL");
  const [selectedCourtId, setSelectedCourtId] = useState<string | null>(null);
  const [leaderboardPlayers, setLeaderboardPlayers] = useState<Player[]>([]);
  const [leadersLoading, setLeadersLoading] = useState(false);

  // Filter feed to local court activity when in ACTIVITY mode and local court is set
  const baseFeed =
    localCourtId && section === "ACTIVITY"
      ? feed.filter((item) => item.courtId === localCourtId)
      : feed;

  const filteredFeed =
    sportFilter === "ALL" ? baseFeed : baseFeed.filter((item) => item.sport === sportFilter);

  // Fetch real leaderboard for the LEADERS tab
  useEffect(() => {
    let mounted = true;
    setLeadersLoading(true);
    fetchLeaderboard(
      selectedCourtId ? "LOCAL" : "GLOBAL",
      selectedCourtId,
      sportFilter === "ALL" ? null : sportFilter
    )
      .then((players) => {
        if (!mounted) return;
        setLeaderboardPlayers(players);
      })
      .finally(() => { if (mounted) setLeadersLoading(false); });
    return () => { mounted = false; };
  }, [selectedCourtId, sportFilter]);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad + 16 }]}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>FEED</Text>
            <Text style={styles.headerSub}>
              {localCourt
                ? `${localCourt.name.toUpperCase()} ACTIVITY`
                : "ALL COURTS"}
            </Text>
          </View>
        </View>

        <View style={styles.sectionTabs}>
          {(["ACTIVITY", "LEADERS"] as Section[]).map((s) => (
            <Pressable
              key={s}
              onPress={() => setSection(s)}
              style={[styles.sectionTab, section === s && styles.sectionTabActive]}
            >
              <Text style={[styles.sectionTabText, section === s && styles.sectionTabTextActive]}>
                {s}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.sportFilters}>
          {SPORT_FILTERS.map((f) => (
            <Pressable
              key={f}
              onPress={() => setSportFilter(f)}
              style={[styles.filterPill, sportFilter === f && styles.filterPillActive]}
            >
              <Text style={[styles.filterPillText, sportFilter === f && styles.filterPillTextActive]}>
                {f === "ALL" ? "All" : f === "BASKETBALL" ? "Basketball" : "Pickleball"}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {section === "ACTIVITY" ? (
        <FlatList
          data={filteredFeed}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <FeedCard item={item} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                {localCourt
                  ? `No activity at ${localCourt.name} yet.\nGo play.`
                  : "No activity yet.\nSet a local court to see updates."}
              </Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            filteredFeed.length === 0 ? styles.emptyList : undefined,
            { paddingBottom: Platform.OS === "web" ? 84 : 100, paddingTop: 4 },
          ]}
          testID="feed-list"
        />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 84 : 100 }}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.courtFilterRow}
          >
            <Pressable
              onPress={() => setSelectedCourtId(null)}
              style={[
                styles.courtPill,
                selectedCourtId === null && styles.courtPillActive,
              ]}
            >
              <Text style={[styles.courtPillText, selectedCourtId === null && styles.courtPillTextActive]}>
                All Courts
              </Text>
            </Pressable>
          </ScrollView>

          {leadersLoading ? (
            <View style={styles.empty}>
              <ActivityIndicator color={Colors.accent} />
            </View>
          ) : leaderboardPlayers.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No players for this court.</Text>
            </View>
          ) : (
            leaderboardPlayers.map((player, index) => {
              const tierColor = TIER_COLORS[player.tier] ?? Colors.muted;
              const isTop3 = index < 3;
              return (
                <View
                  key={player.id}
                  style={[styles.leaderRow, isTop3 && styles.leaderRowTop]}
                >
                  <View style={styles.rankCol}>
                    <Text style={[styles.rankNum, isTop3 && { color: Colors.accent }]}>
                      {index + 1}
                    </Text>
                  </View>

                  <PlayerAvatar initials={player.avatar} size={40} />

                  <View style={styles.leaderInfo}>
                    <Text style={styles.leaderName}>{player.name}</Text>
                    <View style={styles.leaderMeta}>
                      <View style={[styles.tierBadge, { borderColor: tierColor + "60" }]}>
                        <Text style={[styles.tierText, { color: tierColor }]}>{player.tier}</Text>
                      </View>
                      <Text style={styles.wlText}>
                        {player.wins}W · {player.losses}L
                      </Text>
                    </View>
                  </View>

                  <View style={styles.eloCol}>
                    <Text style={styles.eloValue}>{player.elo}</Text>
                    <Text style={styles.eloLabel}>ELO</Text>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 0,
    backgroundColor: Colors.surface,
    borderBottomWidth: 0.5,
    borderColor: Colors.border,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  headerTitle: {
    fontFamily: Typography.heading, fontSize: 34, color: Colors.text, letterSpacing: 0.5,
  },
  headerSub: {
    fontFamily: Typography.bodyMedium, fontSize: 10, color: Colors.muted,
    letterSpacing: 2, textTransform: "uppercase" as const, marginTop: 2, marginBottom: 12,
  },
  sectionTabs: {
    flexDirection: "row",
    gap: 2,
    marginBottom: 12,
  },
  sectionTab: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: Radius.sm,
    borderWidth: 0.5,
    borderColor: Colors.border,
  },
  sectionTabActive: {
    backgroundColor: Colors.surfaceHigh,
    borderColor: Colors.accent,
  },
  sectionTabText: {
    fontFamily: Typography.heading, fontSize: 11, color: Colors.muted, letterSpacing: 1.5,
  },
  sectionTabTextActive: { color: Colors.text },
  sportFilters: {
    flexDirection: "row",
    gap: 6,
    paddingBottom: 14,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    borderColor: Colors.border,
    backgroundColor: "transparent",
  },
  filterPillActive: {
    backgroundColor: Colors.accentDim,
    borderColor: Colors.accent,
  },
  filterPillText: {
    fontFamily: Typography.bodyMedium, fontSize: 12, color: Colors.muted,
  },
  filterPillTextActive: { color: Colors.accent },
  emptyList: { flex: 1 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 80 },
  emptyText: {
    fontFamily: Typography.bodyMedium, fontSize: 16, color: Colors.muted,
    textAlign: "center", letterSpacing: 0.3, lineHeight: 24,
  },

  courtFilterRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  courtPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  courtPillActive: {
    backgroundColor: Colors.surfaceHigh,
    borderColor: Colors.text,
  },
  courtPillText: {
    fontFamily: Typography.bodyMedium, fontSize: 12, color: Colors.muted,
  },
  courtPillTextActive: { color: Colors.text },
  courtScopeLabel: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  courtScopeLabelText: {
    fontFamily: Typography.bodyBold,
    fontSize: 10,
    color: Colors.muted,
    letterSpacing: 2,
  },

  leaderRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
    marginVertical: 4,
    marginHorizontal: 12,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 0.5,
    borderColor: Colors.border,
  },
  leaderRowTop: {
    borderColor: Colors.accent + "40",
  },
  rankCol: {
    width: 28,
    alignItems: "center",
  },
  rankNum: {
    fontFamily: Typography.heading,
    fontSize: 18,
    color: Colors.muted,
    lineHeight: 22,
  },
  leaderInfo: { flex: 1 },
  leaderName: {
    fontFamily: Typography.bodyMedium,
    fontSize: 15,
    color: Colors.text,
    letterSpacing: 0.1,
    marginBottom: 4,
  },
  leaderMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
  tierBadge: {
    borderWidth: 0.5,
    borderRadius: Radius.xs,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tierText: {
    fontFamily: Typography.bodyBold,
    fontSize: 9,
    letterSpacing: 1,
    textTransform: "uppercase" as const,
  },
  wlText: {
    fontFamily: Typography.body,
    fontSize: 11,
    color: Colors.muted,
  },
  eloCol: { alignItems: "flex-end", minWidth: 50 },
  eloValue: {
    fontFamily: Typography.heading,
    fontSize: 20,
    color: Colors.text,
    lineHeight: 22,
  },
  eloLabel: {
    fontFamily: Typography.bodyBold,
    fontSize: 8,
    color: Colors.muted,
    letterSpacing: 1.5,
    textTransform: "uppercase" as const,
    marginTop: 1,
  },
});
