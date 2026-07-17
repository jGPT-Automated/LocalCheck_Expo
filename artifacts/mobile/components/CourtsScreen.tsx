import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import { router } from "expo-router";
import { CourtListItem } from "@/components/CourtListItem";
import { MapScreen } from "@/components/MapScreen";
import { Colors, Radius } from "@/constants/colors";
import { Court, CourtSport } from "@/constants/data";
import { Typography } from "@/constants/typography";
import { useApp } from "@/context/AppContext";
import { useCourtCounts } from "@/context/CourtPresenceContext";
import { fetchNearbyCourts, searchCourts } from "@/services/courtService";

type SportFilter = CourtSport | "ALL";

export function CourtsScreen() {
  const { checkedInCourtId, lastVisitedCourtId, checkIn, checkOut, visitCourt, preferredSport, setLocalCourt, localCourtId } = useApp();
  const { top } = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : top;

  // ── View state ──────────────────────────────────────────────────────────────
  const [mode, setMode] = useState<"COURTS" | "MAP">("COURTS");
  const [sportFilter, setSportFilter] = useState<SportFilter>(preferredSport ?? "ALL");
  const openCourtSheet = (c: Court) => {
    router.push({ // "as never": .expo/types regenerate on next `expo start`; route exists (app/court-sheet.tsx)
      pathname: "/court-sheet" as never, params: { id: c.id, ...(c.distanceKm != null ? { distanceKm: String(c.distanceKm) } : {}) } });
  };
  const mapAnim = useRef(new Animated.Value(0)).current;
  const [mapMounted, setMapMounted] = useState(false);

  // ── Courts data (own state, not AppContext) ─────────────────────────────────
  const [nearbyCourts, setNearbyCourts] = useState<Court[]>([]);
  const [loading, setLoading] = useState(true);
  const userLoc = useRef<{ lat: number; lng: number } | null>(null);

  // ── Search state ────────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Court[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load nearby courts ───────────────────────────────────────────────────────
  const loadNearby = useCallback(async (sport: SportFilter) => {
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      let lat = 34.0522; // LA default
      let lng = -118.2437;
      if (status === "granted") {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        lat = loc.coords.latitude;
        lng = loc.coords.longitude;
      }
      // Always store coords (fallback or real) so sport-filter reloads work
      userLoc.current = { lat, lng };
      const courts = await fetchNearbyCourts(lat, lng, sport === "ALL" ? null : sport, 20);
      setNearbyCourts(courts);
    } catch {
      setNearbyCourts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNearby(sportFilter);
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  // Reload when sport filter changes (skip first render, handled above)
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    // userLoc.current is always set (real or fallback LA coords)
    const loc = userLoc.current ?? { lat: 34.0522, lng: -118.2437 };
    setLoading(true);
    fetchNearbyCourts(loc.lat, loc.lng, sportFilter === "ALL" ? null : sportFilter, 20)
      .then((c) => setNearbyCourts(c))
      .finally(() => setLoading(false));
  }, [sportFilter]);

  // ── Typeahead search with 300ms debounce ─────────────────────────────────────
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    const q = searchQuery.trim();
    if (q.length < 2) { setSearchResults([]); setSearchLoading(false); return; }
    setSearchLoading(true);
    searchTimerRef.current = setTimeout(async () => {
      const results = await searchCourts(q, sportFilter === "ALL" ? null : sportFilter, 15);
      setSearchResults(results);
      setSearchLoading(false);
    }, 300);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [searchQuery, sportFilter]);

  // ── Map animation ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (mode === "MAP" && !mapMounted) setMapMounted(true);
    Animated.timing(mapAnim, {
      toValue: mode === "MAP" ? 1 : 0,
      duration: 240,
      useNativeDriver: true,
    }).start();
  }, [mode, mapAnim, mapMounted]);

  const mapOpacity = mapAnim;
  const mapTranslateX = mapAnim.interpolate({ inputRange: [0, 1], outputRange: [50, 0] });

  // ── Derived ──────────────────────────────────────────────────────────────────
  const isSearchMode = searchQuery.trim().length >= 2;
  const displayListRaw = isSearchMode ? searchResults : nearbyCourts;

  // Overlay live counts from the shared presence store onto the fetched
  // snapshots, so cards update in real time when anyone checks in/out or
  // switches local court — the snapshot alone goes stale the moment it lands.
  const liveCounts = useCourtCounts(displayListRaw.map((c) => c.id));
  const displayList = displayListRaw.map((c) => {
    const live = liveCounts[c.id];
    return live
      ? { ...c, activeCount: live.activeCount, localCount: live.localCount }
      : c;
  });

  const featuredCourt = !isSearchMode && displayList.length > 0 ? displayList[0] : null;
  const listCourts = !isSearchMode ? displayList.slice(1) : displayList;
  const isCheckedIn = checkedInCourtId === featuredCourt?.id;

  const handleCheckIn = async () => {
    if (!featuredCourt) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (isCheckedIn) {
      await checkOut();
    } else {
      await checkIn(featuredCourt.id);
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  return (
    <View style={styles.container}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: topPad + 12 }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerEyebrow}>LOCALCHECK</Text>
          <Text style={styles.headerTitle}>EXPLORE</Text>
        </View>
        <Pressable onPress={() => setMode("MAP")} style={styles.mapToggleBtn}>
          <Feather name="map" size={14} color={Colors.muted} />
          <Text style={styles.mapToggleText}>MAP</Text>
        </Pressable>
      </View>

      {/* ── Search bar ─────────────────────────────────────────────────────── */}
      <View style={styles.searchRow}>
        <Feather name="search" size={15} color={Colors.muted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search courts..."
          placeholderTextColor={Colors.mutedDark}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        {searchLoading && <ActivityIndicator size="small" color={Colors.muted} style={{ marginRight: 12 }} />}
      </View>

      {/* ── Sport filter ───────────────────────────────────────────────────── */}
      <View style={styles.filterStrip}>
        {(["ALL", "BASKETBALL", "PICKLEBALL"] as SportFilter[]).map((s) => (
          <Pressable
            key={s}
            style={[styles.filterPill, sportFilter === s && styles.filterPillActive]}
            onPress={() => setSportFilter(s)}
          >
            <Text style={[styles.filterPillText, sportFilter === s && styles.filterPillTextActive]}>
              {s === "ALL" ? "ALL" : s === "BASKETBALL" ? "BB" : "PB"}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* ── Courts list ────────────────────────────────────────────────────── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 84 : 100 }}
        keyboardShouldPersistTaps="handled"
      >
        {loading && !isSearchMode && (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={Colors.accent} />
            <Text style={styles.loadingText}>FINDING NEARBY COURTS...</Text>
          </View>
        )}

        {/* Featured / nearest court */}
        {!isSearchMode && featuredCourt && (
          <View style={styles.featuredSection}>
            <Text style={styles.sectionLabel}>NEAREST COURT</Text>
            <Pressable
              style={[styles.featuredCard, { borderLeftColor: Colors.accent }]}
              onPress={() => { openCourtSheet(featuredCourt); visitCourt(featuredCourt.id); }}
            >
              <View style={styles.featuredTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.featuredName}>{featuredCourt.name}</Text>
                  <Text style={styles.featuredMeta}>
                    {featuredCourt.address}
                  </Text>
                  <Text style={styles.featuredSport}>{featuredCourt.sport}</Text>
                </View>
                {featuredCourt.activeCount > 0 && (
                  <View style={styles.liveChip}>
                    <Text style={styles.liveCount}>{featuredCourt.activeCount}</Text>
                    <Text style={styles.liveLabel}>LIVE</Text>
                  </View>
                )}
              </View>
              <View style={styles.featuredActions}>
                <Pressable
                  style={[styles.actionBtn, styles.actionBtnAccent]}
                  onPress={handleCheckIn}
                >
                  <Text style={styles.actionBtnAccentText}>
                    {isCheckedIn ? "CHECKED IN ✓" : "CHECK IN"}
                  </Text>
                </Pressable>
                {localCourtId !== featuredCourt.id && (
                  <Pressable
                    style={[styles.actionBtn, styles.actionBtnGhost]}
                    onPress={() => setLocalCourt(featuredCourt.id, featuredCourt)}
                  >
                    <Feather name="home" size={12} color={Colors.muted} />
                    <Text style={styles.actionBtnGhostText}>SET AS MY COURT</Text>
                  </Pressable>
                )}
                {localCourtId === featuredCourt.id && (
                  <View style={[styles.actionBtn, styles.actionBtnGhost, { opacity: 0.5 }]}>
                    <Feather name="home" size={12} color={Colors.accent} />
                    <Text style={[styles.actionBtnGhostText, { color: Colors.accent }]}>MY COURT</Text>
                  </View>
                )}
              </View>
            </Pressable>
          </View>
        )}

        {/* Nearby / search list */}
        {(listCourts.length > 0 || isSearchMode) && (
          <View style={styles.nearbySection}>
            <Text style={styles.sectionLabel}>
              {isSearchMode
                ? `${searchResults.length} RESULT${searchResults.length !== 1 ? "S" : ""}`
                : `NEARBY COURTS (${listCourts.length})`}
            </Text>
            {listCourts.map((court) => (
              <CourtListItem
                key={court.id}
                court={court}
                onPress={(c) => { openCourtSheet(c); visitCourt(c.id); }}
                isCheckedIn={checkedInCourtId === court.id}
              />
            ))}
            {isSearchMode && listCourts.length === 0 && !searchLoading && (
              <Text style={styles.emptyText}>NO COURTS MATCH "{searchQuery.toUpperCase()}"</Text>
            )}
          </View>
        )}

        {!loading && !isSearchMode && nearbyCourts.length === 0 && (
          <View style={styles.emptyState}>
            <Feather name="map-pin" size={28} color={Colors.mutedDark} />
            <Text style={styles.emptyText}>NO COURTS FOUND NEARBY</Text>
            <Text style={styles.emptySubText}>Try a different sport or enable location</Text>
          </View>
        )}
      </ScrollView>

      {/* Court detail sheet */}

      {/* Map overlay */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            opacity: mapOpacity,
            transform: [{ translateX: mapTranslateX }],
            pointerEvents: mode === "MAP" ? "auto" : "none",
          },
        ]}
      >
        {mapMounted && <MapScreen />}
        <Pressable
          style={[styles.mapBackBtn, { top: topPad + 14 }]}
          onPress={() => setMode("COURTS")}
          hitSlop={12}
        >
          <Feather name="arrow-left" size={16} color={Colors.white} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: Colors.surface,
    borderBottomWidth: 0.5,
    borderColor: Colors.border,
  },
  headerEyebrow: {
    fontFamily: Typography.bodyBold,
    fontSize: 9,
    color: Colors.accent,
    letterSpacing: 2.5,
    textTransform: "uppercase" as const,
    marginBottom: 3,
  },
  headerTitle: {
    fontFamily: Typography.heading,
    fontSize: 32,
    color: Colors.text,
    letterSpacing: 0.5,
    lineHeight: 34,
  },
  mapToggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: Colors.surfaceHigh,
    borderWidth: 0.5,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 3,
  },
  mapToggleText: {
    fontFamily: Typography.heading,
    fontSize: 11,
    color: Colors.muted,
    letterSpacing: 1.5,
  },

  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderBottomWidth: 0.5,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  searchIcon: { marginLeft: 2 },
  searchInput: {
    flex: 1,
    fontFamily: Typography.body,
    fontSize: 14,
    color: Colors.text,
    paddingVertical: 4,
  },

  filterStrip: {
    flexDirection: "row",
    backgroundColor: Colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderWidth: 0.5,
    borderColor: Colors.border,
    borderRadius: Radius.xs,
  },
  filterPillActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  filterPillText: {
    fontFamily: Typography.heading,
    fontSize: 11,
    color: Colors.muted,
    letterSpacing: 1.5,
  },
  filterPillTextActive: { color: Colors.black },

  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 32,
  },
  loadingText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 11,
    color: Colors.muted,
    letterSpacing: 2,
  },

  featuredSection: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 4 },
  sectionLabel: {
    fontFamily: Typography.bodyBold,
    fontSize: 10,
    color: Colors.muted,
    letterSpacing: 2.5,
    textTransform: "uppercase" as const,
    marginBottom: 10,
  },
  featuredCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 0.5,
    borderColor: Colors.border,
    borderLeftWidth: 3,
    padding: 16,
    gap: 14,
  },
  featuredTop: { flexDirection: "row", gap: 12 },
  featuredName: {
    fontFamily: Typography.heading,
    fontSize: 20,
    color: Colors.text,
    letterSpacing: 0.2,
    lineHeight: 24,
    marginBottom: 4,
  },
  featuredMeta: {
    fontFamily: Typography.body,
    fontSize: 12,
    color: Colors.muted,
    marginBottom: 4,
  },
  featuredSport: {
    fontFamily: Typography.bodyMedium,
    fontSize: 10,
    color: Colors.accent,
    letterSpacing: 2,
    textTransform: "uppercase" as const,
  },
  liveChip: { alignItems: "center", minWidth: 44 },
  liveCount: {
    fontFamily: Typography.heading,
    fontSize: 28,
    color: Colors.text,
    lineHeight: 30,
  },
  liveLabel: {
    fontFamily: Typography.bodyMedium,
    fontSize: 8,
    color: Colors.muted,
    letterSpacing: 1.5,
    textTransform: "uppercase" as const,
    marginTop: 2,
  },
  featuredActions: { flexDirection: "row", gap: 8 },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    gap: 5,
    borderRadius: Radius.xs,
  },
  actionBtnAccent: { backgroundColor: Colors.accent },
  actionBtnAccentText: {
    fontFamily: Typography.heading,
    fontSize: 11,
    color: Colors.black,
    letterSpacing: 1.5,
  },
  actionBtnGhost: {
    borderWidth: 0.5,
    borderColor: Colors.border,
    backgroundColor: "transparent",
  },
  actionBtnGhostText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 10,
    color: Colors.muted,
    letterSpacing: 1,
  },

  nearbySection: { marginTop: 22 },

  emptyState: {
    alignItems: "center",
    paddingVertical: 48,
    gap: 12,
  },
  emptyText: {
    fontFamily: Typography.heading,
    fontSize: 12,
    color: Colors.muted,
    letterSpacing: 2,
    textAlign: "center",
    paddingHorizontal: 32,
    marginTop: 8,
  },
  emptySubText: {
    fontFamily: Typography.body,
    fontSize: 11,
    color: Colors.mutedDark,
    letterSpacing: 0.3,
  },

  mapBackBtn: {
    position: "absolute",
    left: 16,
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(13,13,16,0.88)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    zIndex: 200,
  },
});
