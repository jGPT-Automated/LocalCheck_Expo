import { Feather } from "@expo/vector-icons";
import * as Location from "expo-location";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { AddCourtModal } from "@/components/AddCourtModal";
import { CourtListItem } from "@/components/CourtListItem";
import { MapScreen } from "@/components/MapScreen";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useCourtSheet } from "@/components/sheet/CourtSheetHost";
import { CompactSelect } from "@/components/ui/CompactSelect";
import { Colors, Radius } from "@/constants/colors";
import { Court, CourtSport } from "@/constants/data";
import { Typography } from "@/constants/typography";
import { useApp } from "@/context/AppContext";
import { useCourtCounts } from "@/context/CourtPresenceContext";
import {
  fetchCourtsByMarket,
  fetchNearbyCourts,
  searchCourts,
} from "@/services/courtService";

type SportFilter = CourtSport | "ALL";
type ExploreMode = "LIST" | "MAP";

const DISCOVERY_LIMIT = 10;
const COLLAPSED_LIMIT = 5;

export function CourtsScreen() {
  const {
    checkedInCourtId,
    visitCourt,
    preferredSport,
    localCourt,
    localCourtId,
  } = useApp();
  const { openCourtSheet: presentCourtSheet } = useCourtSheet();

  const [mode, setMode] = useState<ExploreMode>("LIST");
  const [sportFilter, setSportFilter] = useState<SportFilter>(preferredSport ?? "ALL");
  const [nearbyCourts, setNearbyCourts] = useState<Court[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [showAddCourt, setShowAddCourt] = useState(false);
  const userLoc = useRef<{ lat: number; lng: number } | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Court[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openCourt = useCallback(
    (court: Court) => {
      presentCourtSheet({ courtId: court.id, distanceKm: court.distanceKm ?? undefined });
      void visitCourt(court.id);
    },
    [presentCourtSheet, visitCourt]
  );

  const resolveDiscoveryOrigin = useCallback(async () => {
    if (localCourt) {
      const origin = { lat: localCourt.latitude, lng: localCourt.longitude };
      userLoc.current = origin;
      return origin;
    }
    if (userLoc.current) return userLoc.current;

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const last = await Location.getLastKnownPositionAsync();
        const location =
          last ??
          (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
        const origin = { lat: location.coords.latitude, lng: location.coords.longitude };
        userLoc.current = origin;
        return origin;
      }
    } catch {
      // Fall through to the existing LA pilot fallback only when neither a
      // local court nor a device location is available.
    }

    const fallback = { lat: 34.0522, lng: -118.2437 };
    userLoc.current = fallback;
    return fallback;
  }, [localCourt]);

  const loadDiscovery = useCallback(async () => {
    setLoading(true);
    try {
      const origin = await resolveDiscoveryOrigin();
      const courts = localCourt?.market
        ? await fetchCourtsByMarket(
            localCourt.market,
            origin,
            sportFilter === "ALL" ? null : sportFilter,
            DISCOVERY_LIMIT
          )
        : await fetchNearbyCourts(
            origin.lat,
            origin.lng,
            sportFilter === "ALL" ? null : sportFilter,
            DISCOVERY_LIMIT
          );
      setNearbyCourts(courts);
    } catch {
      setNearbyCourts([]);
    } finally {
      setLoading(false);
    }
  }, [localCourt?.id, localCourt?.market, resolveDiscoveryOrigin, sportFilter]);

  useEffect(() => {
    setShowAll(false);
    void loadDiscovery();
  }, [loadDiscovery]);

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    const query = searchQuery.trim();
    if (query.length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    searchTimerRef.current = setTimeout(async () => {
      const results = await searchCourts(
        query,
        sportFilter === "ALL" ? null : sportFilter,
        DISCOVERY_LIMIT
      );
      setSearchResults(results);
      setSearchLoading(false);
    }, 300);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [searchQuery, sportFilter]);

  const isSearchMode = searchQuery.trim().length >= 2;
  const countTargets = useMemo(() => {
    const byId = new Map<string, Court>();
    if (localCourt) byId.set(localCourt.id, localCourt);
    for (const court of isSearchMode ? searchResults : nearbyCourts) byId.set(court.id, court);
    return Array.from(byId.values());
  }, [isSearchMode, localCourt, nearbyCourts, searchResults]);
  const liveCounts = useCourtCounts(countTargets);
  const withLiveCounts = useCallback(
    (court: Court) => {
      const live = liveCounts[court.id];
      return live
        ? { ...court, activeCount: live.activeCount, localCount: live.localCount }
        : court;
    },
    [liveCounts]
  );

  const localCourtLive = localCourt ? withLiveCounts(localCourt) : null;
  const listSource = (isSearchMode ? searchResults : nearbyCourts)
    .filter((court) => court.id !== localCourtId)
    .map(withLiveCounts);
  const visibleCourts = isSearchMode || showAll
    ? listSource
    : listSource.slice(0, COLLAPSED_LIMIT);

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="EXPLORE"
        right={(
          <Pressable
            accessibilityLabel="Add a court"
            accessibilityRole="button"
            onPress={() => setShowAddCourt(true)}
            style={({ pressed }) => [styles.addCourtAction, pressed && styles.addCourtActionPressed]}
            testID="add-court-action"
          >
            <Feather color={Colors.accent} name="plus" size={15} />
            <Text style={styles.addCourtActionText}>ADD</Text>
          </Pressable>
        )}
      />

      <View style={styles.searchArea}>
        <View style={styles.searchRow}>
          <CompactSelect
            accessibilityLabel="Filter courts by sport"
            align="start"
            onChange={setSportFilter}
            options={[
              { label: "ALL", value: "ALL" },
              { label: "BB", value: "BASKETBALL" },
              { label: "PB", value: "PICKLEBALL" },
            ]}
            value={sportFilter}
            variant="plain"
          />
          <View style={styles.searchDivider} />
          <Feather name="search" size={15} color={Colors.muted} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={(value) => {
              setSearchQuery(value);
              if (value.trim().length >= 2) setMode("LIST");
            }}
            placeholder="Search courts..."
            placeholderTextColor={Colors.mutedDark}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {searchLoading && <ActivityIndicator size="small" color={Colors.muted} />}
        </View>
      </View>

      <View style={styles.modeSwitch} accessibilityRole="tablist">
        {(["LIST", "MAP"] as ExploreMode[]).map((item) => (
          <Pressable
            key={item}
            accessibilityRole="tab"
            accessibilityState={{ selected: mode === item }}
            onPress={() => setMode(item)}
            style={[styles.modeTab, mode === item && styles.modeTabActive]}
          >
            <Feather
              name={item === "LIST" ? "list" : "map"}
              size={14}
              color={mode === item ? Colors.text : Colors.muted}
            />
            <Text style={[styles.modeTabText, mode === item && styles.modeTabTextActive]}>
              {item}
            </Text>
          </Pressable>
        ))}
      </View>

      {mode === "MAP" ? (
        <View style={styles.mapStage}>
          <MapScreen sportFilter={sportFilter} />
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 84 : 110 }}
          keyboardShouldPersistTaps="handled"
        >
          {!isSearchMode && localCourtLive && (
            <View style={styles.localSection}>
              <Text style={styles.sectionLabel}>MY LOCAL COURT</Text>
              <CourtListItem
                court={localCourtLive}
                onPress={openCourt}
                isCheckedIn={checkedInCourtId === localCourtLive.id}
                isLocalCourt
                featured
              />
            </View>
          )}

          {!isSearchMode && !localCourtLive && (
            <View style={styles.noLocalState}>
              <Feather name="home" size={20} color={Colors.muted} />
              <Text style={styles.noLocalTitle}>NO LOCAL COURT SET</Text>
              <Text style={styles.noLocalCopy}>Open a court and make it yours to pin it here.</Text>
            </View>
          )}

          <View style={styles.discoverySection}>
            <View style={styles.sectionHeadingRow}>
              <Text style={styles.sectionLabel}>
                {isSearchMode
                  ? `${listSource.length} SEARCH RESULT${listSource.length === 1 ? "" : "S"}`
                  : `${localCourt?.market?.toUpperCase() ?? "NEARBY"} COURTS`}
              </Text>
              {!isSearchMode && listSource.length > COLLAPSED_LIMIT && (
                <Text style={styles.resultCount}>{visibleCourts.length} OF {listSource.length}</Text>
              )}
            </View>

            {loading && !isSearchMode ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={Colors.accent} />
                <Text style={styles.loadingText}>FINDING RELEVANT COURTS...</Text>
              </View>
            ) : (
              visibleCourts.map((court) => (
                <CourtListItem
                  key={court.id}
                  court={court}
                  onPress={openCourt}
                  isCheckedIn={checkedInCourtId === court.id}
                />
              ))
            )}

            {!loading && visibleCourts.length === 0 && (
              <Text style={styles.emptyText}>
                {isSearchMode ? "NO COURTS MATCH THIS SEARCH" : "NO OTHER COURTS IN THIS SCOPE"}
              </Text>
            )}

            {!isSearchMode && listSource.length > COLLAPSED_LIMIT && (
              <Pressable style={styles.viewAllButton} onPress={() => setShowAll((value) => !value)}>
                <Text style={styles.viewAllText}>
                  {showAll ? "SHOW LESS" : `VIEW ALL ${listSource.length}`}
                </Text>
                <Feather
                  name={showAll ? "chevron-up" : "chevron-down"}
                  size={15}
                  color={Colors.textSecondary}
                />
              </Pressable>
            )}
          </View>
        </ScrollView>
      )}

      <AddCourtModal
        initialLatitude={userLoc.current?.lat}
        initialLongitude={userLoc.current?.lng}
        onAdded={() => loadDiscovery()}
        onClose={() => setShowAddCourt(false)}
        visible={showAddCourt}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  addCourtAction: {
    minHeight: 36,
    minWidth: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 5,
  },
  addCourtActionPressed: { opacity: 0.68 },
  addCourtActionText: {
    fontFamily: Typography.bodyBold,
    fontSize: 10,
    color: Colors.textSecondary,
    letterSpacing: 1.2,
  },
  searchArea: { position: "relative", zIndex: 12 },
  searchRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingHorizontal: 16,
    gap: 9,
  },
  searchInput: {
    flex: 1,
    fontFamily: Typography.body,
    fontSize: 14,
    color: Colors.text,
    paddingVertical: 8,
  },
  sportMenuButton: {
    minWidth: 32,
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  sportMenuButtonText: { fontFamily: Typography.bodyBold, fontSize: 9, color: Colors.textSecondary, letterSpacing: 1.2 },
  searchDivider: { width: 1, height: 18, backgroundColor: Colors.border },
  sportMenu: {
    position: "absolute",
    top: 40,
    left: 12,
    width: 172,
    padding: 5,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surfaceHigh,
    shadowColor: Colors.black,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 7 },
    elevation: 10,
  },
  sportMenuItem: { minHeight: 38, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: Radius.xs },
  sportMenuItemActive: { backgroundColor: Colors.surface },
  sportMenuItemText: { fontFamily: Typography.bodySemiBold, fontSize: 9, color: Colors.textSecondary, letterSpacing: 1.2 },
  sportMenuItemTextActive: { color: Colors.text },
  modeSwitch: {
    minHeight: 40,
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
    backgroundColor: Colors.surface,
  },
  modeTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  modeTabActive: { backgroundColor: Colors.surfaceHigh },
  modeTabText: {
    fontFamily: Typography.bodySemiBold,
    fontSize: 10,
    color: Colors.muted,
    letterSpacing: 1.5,
  },
  modeTabTextActive: { color: Colors.text },
  list: { flex: 1 },
  localSection: { paddingTop: 16, paddingBottom: 6 },
  discoverySection: { paddingTop: 14 },
  sectionHeadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionLabel: {
    fontFamily: Typography.bodyBold,
    fontSize: 9,
    color: Colors.textSecondary,
    letterSpacing: 2.2,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  resultCount: {
    marginRight: 16,
    marginBottom: 8,
    fontFamily: Typography.bodyMedium,
    fontSize: 8,
    color: Colors.mutedDark,
    letterSpacing: 1.2,
  },
  noLocalState: {
    marginHorizontal: 16,
    marginTop: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    alignItems: "center",
    gap: 7,
  },
  noLocalTitle: {
    fontFamily: Typography.heading,
    fontSize: 13,
    color: Colors.textSecondary,
    letterSpacing: 1.4,
  },
  noLocalCopy: { fontFamily: Typography.body, fontSize: 11, color: Colors.muted },
  loadingRow: {
    minHeight: 150,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  loadingText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 9,
    color: Colors.muted,
    letterSpacing: 1.6,
  },
  emptyText: {
    marginTop: 30,
    paddingHorizontal: 24,
    textAlign: "center",
    fontFamily: Typography.bodyMedium,
    fontSize: 10,
    color: Colors.muted,
    letterSpacing: 1.5,
  },
  viewAllButton: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surface,
  },
  viewAllText: {
    fontFamily: Typography.heading,
    fontSize: 10,
    color: Colors.textSecondary,
    letterSpacing: 1.5,
  },
  mapStage: { flex: 1, marginTop: 1, overflow: "hidden" },
});
