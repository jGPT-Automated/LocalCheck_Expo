import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import MapView, { Marker, PROVIDER_DEFAULT, Region, UrlTile } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AddCourtModal } from "@/components/AddCourtModal";
import { CourtListItem } from "@/components/CourtListItem";
import { Colors, Radius } from "@/constants/colors";
import { Court, CourtSport, CourtStatus, getSportColor } from "@/constants/data";
import { Typography } from "@/constants/typography";
import { useApp } from "@/context/AppContext";
import { useCourtCounts } from "@/context/CourtPresenceContext";
import { LivePulse } from "./LivePulse";

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? "";
const HAS_TOKEN = MAPBOX_TOKEN && MAPBOX_TOKEN !== "YOUR_MAPBOX_TOKEN_HERE";

// Dark tile source resolved at module load so the style is fixed before the
// first render — never derived from state/effects (that's what caused the
// default-tiles flash).
const DARK_TILE_URL = `https://api.mapbox.com/styles/v1/mapbox/dark-v11/tiles/{z}/{x}/{y}?access_token=${MAPBOX_TOKEN}`;

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : `http://localhost:3001/api`;

// ─── Zoom helpers ──────────────────────────────────────────────────────────────

function regionToZoom(region: Region): number {
  return Math.round(Math.log(360 / region.longitudeDelta) / Math.LN2);
}

function zoomToGridSize(zoom: number): number {
  if (zoom <= 5) return 4.0;
  if (zoom <= 7) return 2.0;
  if (zoom <= 9) return 0.6;
  if (zoom <= 11) return 0.15;
  if (zoom <= 12) return 0.05;
  return 0; // no clustering
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ClusterItem {
  type: "cluster";
  id: string;
  latitude: number;
  longitude: number;
  count: number;
  topCourt: Court;
}

type MapItem = Court | ClusterItem;

function isCluster(item: MapItem): item is ClusterItem {
  return (item as ClusterItem).type === "cluster";
}

// ─── Map API court mapper ─────────────────────────────────────────────────────

function mapApiCourt(row: Record<string, unknown>): Court {
  // Map only fields the API actually returned — no invented defaults.
  return {
    id: String(row.id),
    name: String(row.name),
    sport: (row.sport as CourtSport) ?? "BASKETBALL",
    neighborhood: String(row.city ?? ""),
    city: String(row.city ?? ""),
    address: String(row.address ?? ""),
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    activeCount: Number(row.activeCount ?? row.active_count ?? 0),
    ratingCount: Number(row.ratingCount ?? row.rating_count ?? 0),
    surface: row.surface != null ? String(row.surface) : undefined,
    lights: row.lights != null ? Boolean(row.lights) : undefined,
    covered: row.covered != null ? Boolean(row.covered) : undefined,
    status: row.status != null ? (row.status as CourtStatus) : undefined,
    localCount: row.localCount != null || row.local_count != null ? Number(row.localCount ?? row.local_count) : undefined,
  };
}

// ─── Clustering algorithm ─────────────────────────────────────────────────────

function clusterCourts(courts: Court[], zoom: number, localCourtId?: string | null): MapItem[] {
  const gridSize = zoomToGridSize(zoom);

  if (gridSize === 0) return courts;

  const grid = new Map<string, Court[]>();
  courts.forEach((court) => {
    const cellLat = Math.floor(court.latitude / gridSize);
    const cellLng = Math.floor(court.longitude / gridSize);
    const key = `${cellLat}_${cellLng}`;
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key)!.push(court);
  });

  const result: MapItem[] = [];
  grid.forEach((group) => {
    if (group.length === 1) {
      result.push(group[0]);
      return;
    }

    // Check if local court is in this group — if so, keep it separate
    const localIdx = localCourtId ? group.findIndex((c) => c.id === localCourtId) : -1;
    let clusterGroup = group;
    if (localIdx !== -1) {
      result.push(group[localIdx]);
      clusterGroup = group.filter((_, i) => i !== localIdx);
      if (clusterGroup.length === 0) return;
      if (clusterGroup.length === 1) {
        result.push(clusterGroup[0]);
        return;
      }
    }

    const avgLat = clusterGroup.reduce((s, c) => s + c.latitude, 0) / clusterGroup.length;
    const avgLng = clusterGroup.reduce((s, c) => s + c.longitude, 0) / clusterGroup.length;
    // Top court = most active, then most visited
    const topCourt = [...clusterGroup].sort(
      (a, b) => b.activeCount - a.activeCount || (b.ratingCount ?? 0) - (a.ratingCount ?? 0)
    )[0];

    result.push({
      type: "cluster",
      id: `cluster_${avgLat.toFixed(4)}_${avgLng.toFixed(4)}`,
      latitude: avgLat,
      longitude: avgLng,
      count: clusterGroup.length,
      topCourt,
    });
  });

  return result;
}

// ─── Pin Components ───────────────────────────────────────────────────────────

function ClusterPin({ count, isLarge }: { count: number; isLarge: boolean }) {
  return (
    <View style={[styles.cluster, isLarge && styles.clusterLarge]}>
      <Text style={[styles.clusterCount, isLarge && styles.clusterCountLarge]}>
        {count > 999 ? "999+" : count}
      </Text>
    </View>
  );
}

function CourtPin({
  court,
  isSelected,
  isLocal,
}: {
  court: Court;
  isSelected: boolean;
  isLocal: boolean;
}) {
  const isCommunity = court.status === "community";
  const isConfirmed = court.status === "confirmed";
  const isPending = court.status === "pending";
  const isActive = court.activeCount > 0;
  const sportColor = getSportColor(court.sport);

  return (
    <View
      style={[
        styles.pin,
        isCommunity && styles.pinCommunity,
        isConfirmed && styles.pinConfirmed,
        isPending && styles.pinPending,
        isSelected && styles.pinSelected,
        isLocal && !isSelected && styles.pinLocal,
        isActive && !isCommunity && !isSelected && !isLocal && styles.pinActiveGlow,
      ]}
    >
      {isLocal && !isSelected ? (
        <Text style={styles.pinLocalLabel}>MY</Text>
      ) : isActive ? (
        <>
          <Text style={[styles.pinCount, (isCommunity || isSelected) && styles.pinCountDark]}>
            {court.activeCount}
          </Text>
          <View style={[styles.activeDot, { backgroundColor: sportColor }]} />
        </>
      ) : (
        <View
          style={[
            styles.pinSportDot,
            { backgroundColor: isPending ? Colors.mutedDark : sportColor, opacity: isPending ? 0.4 : 1 },
          ]}
        />
      )}
    </View>
  );
}

// ─── Main Map Screen ──────────────────────────────────────────────────────────

const INITIAL_REGION: Region = {
  latitude: 37.5,
  longitude: -96.0,
  latitudeDelta: 38,
  longitudeDelta: 52,
};

export function MapScreen() {
  const { courts: localCourts, checkedInCourtId, localCourtId } = useApp();
  const { top, bottom } = useSafeAreaInsets();

  const [selectedCourt, setSelectedCourt] = useState<Court | null>(null);
  // Selecting a court opens the native court-sheet route (formSheet detents).
  useEffect(() => {
    if (!selectedCourt) return;
    router.push({ // "as never": .expo/types regenerate on next `expo start`; route exists (app/court-sheet.tsx)
      pathname: "/court-sheet" as never, params: { id: selectedCourt.id, ...(selectedCourt.distanceKm != null ? { distanceKm: String(selectedCourt.distanceKm) } : {}) } });
    setSelectedCourt(null);
  }, [selectedCourt]);
  const [view, setView] = useState<"MAP" | "LIST">("MAP");
  const [showAddModal, setShowAddModal] = useState(false);

  const [region, setRegion] = useState<Region>(INITIAL_REGION);
  const [zoom, setZoom] = useState(4);
  const [apiCourts, setApiCourts] = useState<Court[]>([]);
  const [loading, setLoading] = useState(false);
  const [mapTilesReady, setMapTilesReady] = useState(false);
  const tileReadyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mapOverlayOpacity = useRef(new Animated.Value(1)).current;

  const fetchAbort = useRef<AbortController | null>(null);
  const fetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mapRef = useRef<MapView>(null);

  const handleMapReady = useCallback(() => {
    if (tileReadyTimer.current) clearTimeout(tileReadyTimer.current);
    tileReadyTimer.current = setTimeout(() => {
      setMapTilesReady(true);
      Animated.timing(mapOverlayOpacity, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start();
    }, 600);
  }, [mapOverlayOpacity]);

  // Merge local + API courts (local takes precedence by id)
  const mergedCourts = React.useMemo(() => {
    const merged = new Map<string, Court>();
    apiCourts.forEach((c) => merged.set(c.id, c));
    localCourts.forEach((c) => merged.set(c.id, c)); // local overrides API
    return Array.from(merged.values());
  }, [apiCourts, localCourts]);

  // Overlay live counts from the shared presence store onto the fetched
  // snapshots, so pins/cards update in real time when anyone checks in/out or
  // switches local court — the snapshot alone goes stale the moment it lands.
  const courtIds = React.useMemo(() => mergedCourts.map((c) => c.id), [mergedCourts]);
  const liveCounts = useCourtCounts(courtIds);
  const allCourts = React.useMemo(
    () =>
      mergedCourts.map((c) => {
        const live = liveCounts[c.id];
        return live
          ? { ...c, activeCount: live.activeCount, localCount: live.localCount }
          : c;
      }),
    [mergedCourts, liveCounts]
  );

  const mapItems = React.useMemo(
    () => clusterCourts(allCourts, zoom, localCourtId),
    [allCourts, zoom, localCourtId]
  );

  const activeCourts = allCourts.filter((c) => c.activeCount > 0);

  // The bottom sheet holds a snapshot from when the pin was tapped — overlay
  // live counts onto it too so the selected-court card stays current.
  const selectedLive = selectedCourt ? liveCounts[selectedCourt.id] : undefined;
  const selectedCourtLive =
    selectedCourt && selectedLive
      ? { ...selectedCourt, activeCount: selectedLive.activeCount, localCount: selectedLive.localCount }
      : selectedCourt;

  // Fetch courts from API based on current region + zoom
  const fetchCourts = useCallback(
    (r: Region, z: number) => {
      if (fetchTimer.current) clearTimeout(fetchTimer.current);
      fetchTimer.current = setTimeout(async () => {
        if (fetchAbort.current) fetchAbort.current.abort();
        const ctrl = new AbortController();
        fetchAbort.current = ctrl;

        const latPad = r.latitudeDelta * 0.1;
        const lngPad = r.longitudeDelta * 0.1;
        const params = new URLSearchParams({
          minLat: String(r.latitude - r.latitudeDelta / 2 - latPad),
          maxLat: String(r.latitude + r.latitudeDelta / 2 + latPad),
          minLng: String(r.longitude - r.longitudeDelta / 2 - lngPad),
          maxLng: String(r.longitude + r.longitudeDelta / 2 + lngPad),
          zoom: String(z),
          ...(localCourtId ? { localCourtId } : {}),
        });

        setLoading(true);
        try {
          const res = await fetch(`${API_BASE}/courts?${params}`, { signal: ctrl.signal });
          if (!res.ok) throw new Error(`API ${res.status}`);
          const data = await res.json();
          const courts = (data.courts ?? []).map(mapApiCourt);
          setApiCourts(courts);
        } catch (err: unknown) {
          if ((err as Error).name !== "AbortError") {
            console.warn("Courts fetch error:", err);
          }
        } finally {
          setLoading(false);
        }
      }, 400);
    },
    [localCourtId]
  );

  // Initial fetch on mount
  useEffect(() => {
    fetchCourts(INITIAL_REGION, 4);
  }, []);

  const onRegionChangeComplete = useCallback(
    (r: Region) => {
      const z = regionToZoom(r);
      setRegion(r);
      setZoom(z);
      fetchCourts(r, z);
    },
    [fetchCourts]
  );

  const handleClusterPress = useCallback((cluster: ClusterItem) => {
    // Zoom into the cluster
    mapRef.current?.animateToRegion(
      {
        latitude: cluster.latitude,
        longitude: cluster.longitude,
        latitudeDelta: region.latitudeDelta * 0.35,
        longitudeDelta: region.longitudeDelta * 0.35,
      },
      350
    );
  }, [region]);

  return (
    <View style={styles.container}>
      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: top + 12 }]}>
        <View style={styles.searchBar}>
          <Text style={styles.searchPlaceholder}>Search courts...</Text>
        </View>
        <View style={styles.viewToggle}>
          <Pressable
            onPress={() => setView("MAP")}
            style={[styles.toggleBtn, view === "MAP" && styles.toggleBtnActive]}
          >
            <Text style={[styles.toggleText, view === "MAP" && styles.toggleTextActive]}>MAP</Text>
          </Pressable>
          <Pressable
            onPress={() => setView("LIST")}
            style={[styles.toggleBtn, view === "LIST" && styles.toggleBtnActive]}
          >
            <Text style={[styles.toggleText, view === "LIST" && styles.toggleTextActive]}>LIST</Text>
          </Pressable>
        </View>
      </View>

      {/* Map view */}
      {view === "MAP" ? (
        <View style={styles.mapWrapper}>
          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFill}
            provider={PROVIDER_DEFAULT}
            initialRegion={INITIAL_REGION}
            onRegionChangeComplete={onRegionChangeComplete}
            onMapReady={handleMapReady}
            mapType={HAS_TOKEN ? "none" : "mutedStandard"}
            loadingEnabled
            loadingBackgroundColor={Colors.surfaceDark}
            loadingIndicatorColor={Colors.accent}
            showsPointsOfInterest={false}
            showsTraffic={false}
            showsBuildings={false}
            showsCompass={false}
            showsScale={false}
          >
            {HAS_TOKEN && (
              <UrlTile
                urlTemplate={DARK_TILE_URL}
                maximumZ={19}
                flipY={false}
                shouldReplaceMapContent
              />
            )}

            {mapItems.map((item) => {
              if (isCluster(item)) {
                return (
                  <Marker
                    key={item.id}
                    coordinate={{ latitude: item.latitude, longitude: item.longitude }}
                    onPress={() => handleClusterPress(item)}
                    anchor={{ x: 0.5, y: 0.5 }}
                    tracksViewChanges={false}
                  >
                    <ClusterPin count={item.count} isLarge={item.count > 50} />
                  </Marker>
                );
              }

              const court = item as Court;
              const isSelected = selectedCourt?.id === court.id;
              const isLocal = localCourtId === court.id;
              return (
                <Marker
                  key={court.id}
                  coordinate={{ latitude: court.latitude, longitude: court.longitude }}
                  onPress={() => setSelectedCourt(court)}
                  anchor={{ x: 0.5, y: 0.5 }}
                  tracksViewChanges={false}
                >
                  <CourtPin court={court} isSelected={isSelected} isLocal={isLocal} />
                </Marker>
              );
            })}
          </MapView>

          {!HAS_TOKEN && <View style={styles.noTokenOverlay} />}

          {/* Map loading overlay — fades out once tiles are compiled */}
          <Animated.View
            style={[styles.mapLoadingOverlay, { opacity: mapOverlayOpacity, pointerEvents: mapTilesReady ? "none" : "box-none" }]}
          >
            <View style={styles.mapLoadingInner}>
              <ActivityIndicator size="small" color={Colors.accent} />
              <Text style={styles.mapLoadingText}>LOADING MAP</Text>
            </View>
          </Animated.View>

          {/* Loading indicator for court data fetches — below the top bar */}
          {loading && (
            <View style={[styles.loadingBadge, { top: top + 112 }]}>
              <ActivityIndicator size="small" color={Colors.accent} />
            </View>
          )}

          {/* FAB — bottom-right corner, above every other map overlay */}
          <Pressable
            style={[styles.addCourtFab, { bottom: bottom + 20 }]}
            onPress={() => setShowAddModal(true)}
            accessibilityLabel="Add a court"
          >
            <Ionicons name="add" size={22} color={Colors.black} />
          </Pressable>

          {/* Zoom level indicator (dev helper) — stacked above the FAB, no overlap */}
          <View style={[styles.zoomBadge, { bottom: bottom + 80 }]}>
            <Text style={styles.zoomText}>Z{zoom} · {mapItems.length} shown</Text>
          </View>

          {/* Legend */}
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendPin, styles.legendConfirmed]} />
              <Text style={styles.legendText}>CONFIRMED</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendPin, styles.legendCommunity]} />
              <Text style={styles.legendText}>COMMUNITY</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendPin, styles.legendLocal]} />
              <Text style={styles.legendText}>MY COURT</Text>
            </View>
          </View>
        </View>
      ) : (
        <ScrollView
          style={[styles.list, { marginTop: top + 112 }]}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.listHeader}>{allCourts.length} courts loaded</Text>
          {allCourts.map((court) => (
            <CourtListItem
              key={court.id}
              court={court}
              onPress={(c) => {
                setSelectedCourt(c);
                setView("MAP");
              }}
              isCheckedIn={checkedInCourtId === court.id}
            />
          ))}
          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      {/* Live courts bar */}
      {view === "MAP" && activeCourts.length > 0 && !selectedCourt && (
        <View style={[styles.liveBar, { top: top + 112 }]}>
          <LivePulse size={5} color={Colors.accent} />
          <Text style={styles.liveBarText}>{activeCourts.length} courts live</Text>
        </View>
      )}

      <AddCourtModal visible={showAddModal} onClose={() => setShowAddModal(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surfaceDark },

  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  searchBar: {
    alignSelf: "stretch",
    backgroundColor: "rgba(13,13,16,0.93)",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  searchPlaceholder: {
    fontFamily: Typography.body,
    fontSize: 13,
    color: Colors.mutedDark,
  },
  viewToggle: {
    alignSelf: "flex-end",
    flexDirection: "row",
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: "rgba(13,13,16,0.93)",
    borderRadius: Radius.sm,
    overflow: "hidden",
  },
  toggleBtn: { paddingHorizontal: 12, paddingVertical: 10 },
  toggleBtnActive: { backgroundColor: Colors.accent },
  toggleText: {
    fontFamily: Typography.heading,
    fontSize: 11,
    color: Colors.mutedDark,
    letterSpacing: 1.5,
  },
  toggleTextActive: { color: Colors.black },

  mapWrapper: { ...StyleSheet.absoluteFillObject, backgroundColor: Colors.surfaceDark },
  noTokenOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(13,13,16,0.55)",
    zIndex: 1,
    pointerEvents: "none" as const,
  },
  mapLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(13,13,16,0.96)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 5,
  },
  mapLoadingInner: {
    alignItems: "center",
    gap: 12,
  },
  mapLoadingText: {
    fontFamily: Typography.heading,
    fontSize: 11,
    color: Colors.mutedDark,
    letterSpacing: 3,
  },

  // Individual court pin
  pin: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.4)",
    backgroundColor: "rgba(13,13,16,0.7)",
  },
  pinConfirmed: {
    borderColor: "rgba(255,255,255,0.7)",
    backgroundColor: "rgba(13,13,16,0.85)",
  },
  pinCommunity: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accent,
  },
  pinPending: {
    borderColor: "rgba(255,255,255,0.2)",
    borderStyle: "dashed" as const,
    backgroundColor: "rgba(13,13,16,0.5)",
  },
  pinSelected: {
    borderColor: Colors.white,
    backgroundColor: Colors.white,
    transform: [{ scale: 1.25 }],
  },
  pinLocal: {
    borderColor: "#A855F7",
    backgroundColor: "#A855F7",
    borderWidth: 2.5,
  },
  pinActiveGlow: {
    borderColor: Colors.accent,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 6,
    elevation: 6,
  },
  pinCount: {
    fontFamily: Typography.heading,
    fontSize: 12,
    color: Colors.white,
    lineHeight: 14,
  },
  pinCountDark: { color: Colors.black },
  pinLocalLabel: {
    fontFamily: Typography.heading,
    fontSize: 10,
    color: Colors.white,
    letterSpacing: 0.5,
  },
  pinSportDot: { width: 10, height: 10, borderRadius: 5 },
  activeDot: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: Colors.surfaceDark,
  },

  // Cluster pin
  cluster: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(13,13,16,0.92)",
    borderWidth: 2,
    borderColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  clusterLarge: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 2.5,
  },
  clusterCount: {
    fontFamily: Typography.heading,
    fontSize: 13,
    color: Colors.accent,
    letterSpacing: -0.5,
  },
  clusterCountLarge: {
    fontSize: 15,
  },

  // FAB
  addCourtFab: {
    position: "absolute",
    right: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 30,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 12,
  },

  // Loading
  loadingBadge: {
    position: "absolute",
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(13,13,16,0.9)",
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 12,
  },

  // Zoom badge
  zoomBadge: {
    position: "absolute",
    right: 20,
    backgroundColor: "rgba(13,13,16,0.7)",
    borderRadius: Radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
    zIndex: 10,
  },
  zoomText: {
    fontFamily: Typography.body,
    fontSize: 10,
    color: Colors.mutedDark,
    letterSpacing: 0.3,
  },

  // Legend
  legend: {
    position: "absolute",
    bottom: 110,
    left: 16,
    backgroundColor: "rgba(13,13,16,0.88)",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 5,
    zIndex: 10,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 8 },
  legendPin: { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5 },
  legendConfirmed: { borderColor: "rgba(255,255,255,0.7)", backgroundColor: "rgba(13,13,16,0.85)" },
  legendCommunity: { borderColor: Colors.accent, backgroundColor: Colors.accent },
  legendLocal: { borderColor: "#A855F7", backgroundColor: "#A855F7" },
  legendText: {
    fontFamily: Typography.heading,
    fontSize: 8,
    color: Colors.muted,
    letterSpacing: 1.5,
  },

  // Live bar
  liveBar: {
    position: "absolute",
    left: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(13,13,16,0.93)",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 7,
    zIndex: 10,
  },
  liveBarText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 12,
    color: Colors.white,
    letterSpacing: 0.5,
  },

  // List view
  list: { flex: 1, backgroundColor: Colors.background },
  listContent: { paddingBottom: 100 },
  listHeader: {
    fontFamily: Typography.bodyMedium,
    fontSize: 12,
    color: Colors.muted,
    letterSpacing: 0.5,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderColor: Colors.border,
  },
});
