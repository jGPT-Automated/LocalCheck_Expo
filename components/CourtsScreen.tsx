import { Feather } from "@expo/vector-icons";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useRouter } from "expo-router";
import { CourtListItem } from "@/components/CourtListItem";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { MapScreen } from "@/components/MapScreen";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AddCourtIntroSheet } from "@/components/add-court/AddCourtIntroSheet";
import { AddCourtLocationSheet } from "@/components/add-court/AddCourtLocationSheet";
import { useCourtSheet } from "@/components/sheet/CourtSheetHost";
import { CompactSelect } from "@/components/ui/CompactSelect";
import { ModeTabs } from "@/components/ui/ModeTabs";
import { Colors, Radius } from "@/constants/colors";
import { Court, CourtSport } from "@/constants/data";
import { Typography } from "@/constants/typography";
import { useApp } from "@/context/AppContext";
import { useCourtCounts } from "@/context/CourtPresenceContext";
import { useDeviceLocation } from "@/context/DeviceLocationContext";
import type { DeviceCoordinate } from "@/context/deviceLocationModel";
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
  const { coord: deviceCoord } = useDeviceLocation();

  const [mode, setMode] = useState<ExploreMode>("LIST");
  const [sportFilter, setSportFilter] = useState<SportFilter>(
    preferredSport ?? "ALL",
  );
  const [nearbyCourts, setNearbyCourts] = useState<Court[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [addCourtIntroVisible, setAddCourtIntroVisible] = useState(false);
  const [addCourtLocationVisible, setAddCourtLocationVisible] = useState(false);
  const [addCourtCoordinate, setAddCourtCoordinate] =
    useState<DeviceCoordinate | null>(null);
  const addCourtTransitionRef = useRef<"intro" | "location" | null>(null);
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Court[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openCourt = useCallback(
    (court: Court) => {
      presentCourtSheet({
        courtId: court.id,
        distanceKm: court.distanceKm ?? undefined,
      });
      void visitCourt(court.id);
    },
    [presentCourtSheet, visitCourt],
  );

  // Local court (if set) is always the discovery anchor. Otherwise this reads
  // the one shared device coordinate — no local caching here, so a real GPS
  // fix that lands after mount is picked up instead of frozen at whatever
  // resolved first (or the LA fallback). Memoized on primitives so identity
  // is stable across renders that don't actually change the origin.
  const localCourtLat = localCourt?.latitude;
  const localCourtLng = localCourt?.longitude;
  const discoveryOrigin = useMemo(() => {
    if (localCourtLat != null && localCourtLng != null) {
      return { lat: localCourtLat, lng: localCourtLng };
    }
    return deviceCoord;
  }, [localCourtLat, localCourtLng, deviceCoord]);

  const loadDiscovery = useCallback(async () => {
    if (!discoveryOrigin) return;
    setLoading(true);
    try {
      const origin = discoveryOrigin;
      const courts = localCourt?.market
        ? await fetchCourtsByMarket(
            localCourt.market,
            origin,
            sportFilter === "ALL" ? null : sportFilter,
            DISCOVERY_LIMIT,
          )
        : await fetchNearbyCourts(
            origin.lat,
            origin.lng,
            sportFilter === "ALL" ? null : sportFilter,
            DISCOVERY_LIMIT,
          );
      setNearbyCourts(courts);
    } catch {
      setNearbyCourts([]);
    } finally {
      setLoading(false);
    }
  }, [discoveryOrigin, localCourt?.id, localCourt?.market, sportFilter]);

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
        DISCOVERY_LIMIT,
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
    for (const court of isSearchMode ? searchResults : nearbyCourts)
      byId.set(court.id, court);
    return Array.from(byId.values());
  }, [isSearchMode, localCourt, nearbyCourts, searchResults]);
  const liveCounts = useCourtCounts(countTargets);
  const withLiveCounts = useCallback(
    (court: Court) => {
      const live = liveCounts[court.id];
      return live
        ? {
            ...court,
            activeCount: live.activeCount,
            localCount: live.localCount,
          }
        : court;
    },
    [liveCounts],
  );

  const localCourtLive = localCourt ? withLiveCounts(localCourt) : null;
  const listSource = (isSearchMode ? searchResults : nearbyCourts)
    .filter((court) => court.id !== localCourtId)
    .map(withLiveCounts);
  const visibleCourts =
    isSearchMode || showAll ? listSource : listSource.slice(0, COLLAPSED_LIMIT);

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="EXPLORE"
        right={
          <Pressable
            accessibilityLabel="Add a court"
            accessibilityRole="button"
            onPress={() => {
              setMode("MAP");
              setAddCourtIntroVisible(true);
            }}
            style={({ pressed }) => [
              styles.addCourtAction,
              pressed && styles.addCourtActionPressed,
            ]}
            testID="add-court-action"
          >
            <Feather color={Colors.accent} name="plus" size={15} />
            <Text style={styles.addCourtActionText}>ADD</Text>
          </Pressable>
        }
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
          {searchLoading && (
            <ActivityIndicator size="small" color={Colors.muted} />
          )}
        </View>
      </View>

      <ModeTabs
        items={[
          { label: "LIST", value: "LIST", icon: "list" },
          { label: "MAP", value: "MAP", icon: "map" },
        ]}
        onChange={setMode}
        value={mode}
      />

      {mode === "MAP" ? (
        <View style={styles.mapStage}>
          <MapScreen
            sportFilter={sportFilter}
            addCourtMode={addCourtLocationVisible}
            focusCoordinate={addCourtCoordinate}
          />
        </View>
      ) : (
        <KeyboardAwareScrollViewCompat
          bottomOffset={104}
          style={styles.list}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingBottom: Platform.OS === "web" ? 84 : 110,
          }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={
            Platform.OS === "ios" ? "interactive" : "on-drag"
          }
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
              <Text style={styles.noLocalCopy}>
                Open a court and make it yours to pin it here.
              </Text>
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
                <Text style={styles.resultCount}>
                  {visibleCourts.length} OF {listSource.length}
                </Text>
              )}
            </View>

            {loading && !isSearchMode ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={Colors.accent} />
                <Text style={styles.loadingText}>
                  FINDING RELEVANT COURTS...
                </Text>
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
                {isSearchMode
                  ? "NO COURTS MATCH THIS SEARCH"
                  : "NO OTHER COURTS IN THIS SCOPE"}
              </Text>
            )}

            {!isSearchMode && listSource.length > COLLAPSED_LIMIT && (
              <Pressable
                style={styles.viewAllButton}
                onPress={() => setShowAll((value) => !value)}
              >
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
        </KeyboardAwareScrollViewCompat>
      )}

      <AddCourtIntroSheet
        visible={addCourtIntroVisible}
        onClose={() => {
          setAddCourtIntroVisible(false);
          if (addCourtTransitionRef.current === "location") {
            addCourtTransitionRef.current = null;
            setAddCourtLocationVisible(true);
          }
        }}
        onStart={() => {
          addCourtTransitionRef.current = "location";
          setAddCourtIntroVisible(false);
        }}
      />
      <AddCourtLocationSheet
        visible={addCourtLocationVisible}
        onCoordinate={setAddCourtCoordinate}
        onBack={() => {
          addCourtTransitionRef.current = "intro";
          setAddCourtLocationVisible(false);
        }}
        onClose={() => {
          setAddCourtLocationVisible(false);
          if (addCourtTransitionRef.current === "intro") {
            addCourtTransitionRef.current = null;
            setAddCourtIntroVisible(true);
          } else {
            setAddCourtCoordinate(null);
          }
        }}
        onContinue={(coordinate) => {
          router.push({
            pathname: "/add-court",
            params: {
              start: "camera",
              lat: String(coordinate.lat),
              lng: String(coordinate.lng),
            },
          });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  addCourtAction: {
    minHeight: 44,
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
  sportMenuButtonText: {
    fontFamily: Typography.bodyBold,
    fontSize: 9,
    color: Colors.textSecondary,
    letterSpacing: 1.2,
  },
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
  sportMenuItem: {
    minHeight: 38,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: Radius.xs,
  },
  sportMenuItemActive: { backgroundColor: Colors.surface },
  sportMenuItemText: {
    fontFamily: Typography.bodySemiBold,
    fontSize: 9,
    color: Colors.textSecondary,
    letterSpacing: 1.2,
  },
  sportMenuItemTextActive: { color: Colors.text },
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
  noLocalCopy: {
    fontFamily: Typography.body,
    fontSize: 11,
    color: Colors.muted,
  },
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
