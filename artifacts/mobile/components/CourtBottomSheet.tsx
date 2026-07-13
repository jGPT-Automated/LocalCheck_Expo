import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors, Radius } from "@/constants/colors";
import { Court, getSportColor, Player } from "@/constants/data";
import { Typography } from "@/constants/typography";
import { useApp } from "@/context/AppContext";
import { fetchActiveCheckIns } from "@/services/checkInService";
import { BrutalistButton } from "./BrutalistButton";
import { LivePulse } from "./LivePulse";
import { PlayerAvatar } from "./PlayerAvatar";
import { StatBlock } from "./StatBlock";

interface CourtBottomSheetProps {
  court: Court | null;
  onClose: () => void;
}

export function CourtBottomSheet({ court, onClose }: CourtBottomSheetProps) {
  const { checkIn, checkedInCourtId, checkOut, setLocalCourt, localCourtId } = useApp();
  const { bottom } = useSafeAreaInsets();
  // Real live roster for this court — never render placeholder players
  const [roster, setRoster] = useState<Player[]>([]);
  useEffect(() => {
    let live = true;
    if (court?.id) {
      fetchActiveCheckIns(court.id).then((players) => {
        if (live) setRoster(players);
      });
    } else {
      setRoster([]);
    }
    return () => {
      live = false;
    };
  }, [court?.id, checkedInCourtId]);
  const slideAnim = useRef(new Animated.Value(500)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (court) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 65,
          friction: 11,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 500,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [court]);

  if (!court) return null;

  const isCheckedIn = checkedInCourtId === court.id;
  const isMyLocal = localCourtId === court.id;
  const sportColor = getSportColor(court.sport);

  const handleCheckIn = async () => {
    if (isCheckedIn) {
      await checkOut();
    } else {
      await checkIn(court.id);
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    }
  };

  const sheetPaddingBottom = Platform.OS === "web" ? 100 : bottom + 52 + 16;

  return (
    <>
      {/* Tappable backdrop to dismiss */}
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[
          styles.container,
          { paddingBottom: sheetPaddingBottom },
          { transform: [{ translateY: slideAnim }] },
        ]}
      >
        <View style={styles.handle} />

        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.sportTag}>
              <View style={[styles.sportDot, { backgroundColor: sportColor }]} />
              <Text style={[styles.sportText, { color: sportColor }]}>{court.sport}</Text>
            </View>
            <Text style={styles.courtName}>{court.name}</Text>
            <Text style={styles.neighborhood}>
              {court.neighborhood} · {court.city}
            </Text>
          </View>
          <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={16}>
            <Text style={styles.closeBtnText}>✕</Text>
          </Pressable>
        </View>

        {/* ── Stats (real data only: live presence + lifetime check-ins) ── */}
        <View style={styles.statsRow}>
          <StatBlock value={court.activeCount} label="On Court" />
          <View style={styles.statDiv} />
          <StatBlock value={court.ratingCount ?? 0} label="Visits" />
        </View>

        {/* ── Tags ── */}
        <View style={styles.tagsRow}>
          {/* LIVE: only tag that uses accent color — signals real-time activity */}
          {court.activeCount > 0 && (
            <View style={styles.liveTag}>
              <LivePulse size={4} color={Colors.black} style={{ marginRight: 4 }} />
              <Text style={styles.liveTagText}>LIVE</Text>
            </View>
          )}

          {/* Status tags use neutral/outlined styles to avoid competing with LIVE */}
          {court.status === "community" && (
            <View style={styles.communityTag}>
              <View style={styles.communityDot} />
              <Text style={styles.communityTagText}>COMMUNITY</Text>
            </View>
          )}
          {court.status === "confirmed" && (
            <View style={styles.confirmedTag}>
              <View style={styles.confirmedRing} />
              <Text style={styles.confirmedTagText}>CONFIRMED</Text>
            </View>
          )}
          {court.status === "pending" && (
            <View style={styles.tag}>
              <Text style={styles.tagText}>PENDING</Text>
            </View>
          )}

          {court.surface != null && (
            <View style={styles.tag}>
              <Text style={styles.tagText}>{court.surface}</Text>
            </View>
          )}
          {court.lights && (
            <View style={styles.tag}>
              <Text style={styles.tagText}>LIGHTS</Text>
            </View>
          )}
          {court.localCount != null && (
            <View style={styles.tag}>
              <Text style={styles.tagText}>
                {court.localCount} LOCAL{court.localCount !== 1 ? "S" : ""}
              </Text>
            </View>
          )}
        </View>

        {/* ── Active Roster (real check-ins only — no placeholder players) ── */}
        {roster.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.roster}
            contentContainerStyle={styles.rosterContent}
          >
            {roster.slice(0, 8).map((p) => (
              <Pressable
                key={p.id}
                onPress={() => {
                  onClose();
                  router.push(`/player/${p.id}`);
                }}
              >
                <PlayerAvatar initials={p.avatar} size={34} />
              </Pressable>
            ))}
            {roster.length > 8 && (
              <View style={styles.moreCount}>
                <Text style={styles.moreCountText}>+{roster.length - 8}</Text>
              </View>
            )}
          </ScrollView>
        )}

        {/* ── Actions ── */}
        <View style={styles.actions}>
          <BrutalistButton
            label={isCheckedIn ? "CHECKED IN ✓" : "CHECK IN"}
            onPress={handleCheckIn}
            variant={isCheckedIn ? "outline" : "accent"}
            style={styles.checkInBtn}
            testID="check-in-btn"
          />
          <BrutalistButton
            label={isMyLocal ? "MY LOCAL ★" : "MY LOCAL"}
            onPress={() => setLocalCourt(court.id, court)}
            variant={isMyLocal ? "accent" : "dark"}
            style={styles.localBtn}
          />
          <BrutalistButton
            label="→"
            onPress={() => {
              onClose();
              router.push(`/court/${court.id}`);
            }}
            variant="dark"
            style={styles.viewBtn}
          />
        </View>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
    zIndex: 99,
  },
  container: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.surface,
    // Zero top radius — consistent with the app's flat aesthetic
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 10,
    paddingHorizontal: 20,
    zIndex: 100,
  },
  handle: {
    width: 36,
    height: 3,
    backgroundColor: Colors.border,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 14,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  headerLeft: { flex: 1 },
  sportTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 4,
  },
  sportDot: { width: 6, height: 6, borderRadius: 3 },
  sportText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: "uppercase" as const,
  },
  courtName: {
    fontFamily: Typography.heading,
    fontSize: 24,
    color: Colors.text,
    lineHeight: 28,
    letterSpacing: 0.3,
  },
  neighborhood: {
    fontFamily: Typography.body,
    fontSize: 12,
    color: Colors.muted,
    marginTop: 3,
  },
  closeBtn: { padding: 4, marginLeft: 12, marginTop: 4 },
  closeBtnText: {
    fontFamily: Typography.bodyBold,
    fontSize: 16,
    color: Colors.muted,
  },

  // ── Stats ──
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 0.5,
    borderBottomWidth: 0.5,
    borderColor: Colors.border,
    paddingVertical: 14,
    marginBottom: 14,
  },
  statDiv: { width: 0.5, height: 28, backgroundColor: Colors.border },

  // ── Tags ──
  tagsRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 14,
    flexWrap: "wrap",
  },
  // LIVE: accent orange — the one and only use of accent in tags (signals active players NOW)
  liveTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.accent,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.xs,
  },
  liveTagText: {
    fontFamily: Typography.bodyBold,
    fontSize: 9,
    color: Colors.black,
    letterSpacing: 1.5,
    textTransform: "uppercase" as const,
  },
  // COMMUNITY: neutral outlined — different from LIVE to avoid confusion
  communityTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 0.5,
    borderColor: Colors.textSecondary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.xs,
  },
  communityDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: Colors.textSecondary,
  },
  communityTagText: {
    fontFamily: Typography.bodyBold,
    fontSize: 9,
    color: Colors.textSecondary,
    letterSpacing: 1.2,
    textTransform: "uppercase" as const,
  },
  // CONFIRMED: faint white-bordered ring — subtle "verified" indicator
  confirmedTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.3)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.xs,
  },
  confirmedRing: {
    width: 6,
    height: 6,
    borderRadius: 3,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.5)",
  },
  confirmedTagText: {
    fontFamily: Typography.bodyBold,
    fontSize: 9,
    color: Colors.muted,
    letterSpacing: 1.2,
    textTransform: "uppercase" as const,
  },
  // Generic neutral tag
  tag: {
    borderWidth: 0.5,
    borderColor: Colors.border,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.xs,
  },
  tagText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 9,
    color: Colors.muted,
    letterSpacing: 1,
    textTransform: "uppercase" as const,
  },

  // ── Roster ──
  roster: { marginBottom: 14 },
  rosterContent: { gap: 6, paddingVertical: 2 },
  moreCount: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0.5,
    borderColor: Colors.border,
    borderRadius: Radius.xs,
  },
  moreCountText: {
    fontFamily: Typography.heading,
    fontSize: 11,
    color: Colors.muted,
  },

  // ── Actions ──
  actions: { flexDirection: "row", gap: 10 },
  checkInBtn: { flex: 2 },
  localBtn: { flex: 1.5 },
  viewBtn: { width: 48 },
});
