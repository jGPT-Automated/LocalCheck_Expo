import { Feather } from "@expo/vector-icons";
import Mapbox, {
  Camera,
  CircleLayer,
  LineLayer,
  LocationPuck,
  MapView,
  ShapeSource,
  SymbolLayer,
} from "@rnmapbox/maps";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CourtListItem } from "@/components/CourtListItem";
import { useCourtSheet } from "@/components/sheet/CourtSheetHost";
import { Colors, Radius } from "@/constants/colors";
import { Court, CourtSport, getCourtIdentityColor } from "@/constants/data";
import { Layout } from "@/constants/layout";
import { Typography } from "@/constants/typography";
import { useApp } from "@/context/AppContext";
import { useCourtCounts } from "@/context/CourtPresenceContext";
import { useDeviceLocation } from "@/context/DeviceLocationContext";
import {
  coordinateForLocationAction,
  type DeviceCoordinate,
} from "@/context/deviceLocationModel";
import {
  fetchCourtsInBounds,
  fetchNearbyCourts,
} from "@/services/courtService";
import {
  boundsFor,
  fetchWalkingPath,
  kmBetween,
  type LngLat,
  type NearestRoute,
  ROUTE_MAX_KM,
  straightPath,
} from "@/lib/nearestRoute";

/**
 * Native map — @rnmapbox/maps with the dark style applied at the SDK level
 * (opens dark, no overlay tricks). Courts stream from Supabase per viewport
 * (fetchCourtsInBounds); clustering is Mapbox-native via the ShapeSource.
 * Swap the whole look by publishing a Mapbox Studio style and setting
 * EXPO_PUBLIC_MAPBOX_STYLE_URL — falls back to dark-v11.
 *
 * NATIVE MODULE: changes to this file ship OTA, but @rnmapbox/maps itself
 * requires a full EAS build (see app.config.js).
 */

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? "";
// Initializing the native SDK with an empty token crashes/black-screens the
// map view — only configure it when the env var is actually set, and render
// the list fallback below otherwise.
if (MAPBOX_TOKEN) {
  Mapbox.setAccessToken(MAPBOX_TOKEN);
}

const STYLE_URL =
  process.env.EXPO_PUBLIC_MAPBOX_STYLE_URL || "mapbox://styles/mapbox/dark-v11";

// Continental-US overview used only until we know where the user is.
const FALLBACK_CENTER: [number, number] = [-96.0, 37.5];

// The native Mapbox SDK aborts the process on a NaN / out-of-range coordinate
// passed to setCamera — a bad row (0,0 or null lat/lng) must never reach it.
const isLngLat = (c?: [number, number] | null): c is [number, number] =>
  !!c &&
  Number.isFinite(c[0]) &&
  Number.isFinite(c[1]) &&
  Math.abs(c[0]) <= 180 &&
  Math.abs(c[1]) <= 90 &&
  !(c[0] === 0 && c[1] === 0);

export function MapScreen({
  sportFilter = "ALL",
  addCourtMode = false,
  focusCoordinate = null,
}: {
  sportFilter?: CourtSport | "ALL";
  addCourtMode?: boolean;
  focusCoordinate?: DeviceCoordinate | null;
}) {
  const { courts: contextCourts, localCourtId, localCourt } = useApp();
  const { bottom } = useSafeAreaInsets();
  const { openCourtSheet } = useCourtSheet();

  const mapRef = useRef<MapView>(null);
  const cameraRef = useRef<Camera>(null);
  const sourceRef = useRef<ShapeSource>(null);
  // Once the user taps "center on me" or "find nearest court", stop the
  // hydration reconcile effect from yanking the camera back to the home court.
  const userCameraOverride = useRef(false);

  const [viewportCourts, setViewportCourts] = useState<Court[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [locationNotice, setLocationNotice] = useState<string | null>(null);
  const [nearestRoute, setNearestRoute] = useState<NearestRoute | null>(null);
  const fetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The "find nearest court" flow opens the court sheet on a delay so the
  // camera can settle first. Track it so a sport switch or an unmount cancels
  // it — otherwise the previous sport's court drawer fires over the new view.
  const sheetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (fetchTimer.current) clearTimeout(fetchTimer.current);
      if (sheetTimer.current) clearTimeout(sheetTimer.current);
    },
    [],
  );

  // ── Shared device location — same resolved coordinate as Explore's list and
  // AppContext's nearby-court fetch, so all three surfaces agree. ──
  const {
    coord: deviceCoord,
    status: locationStatus,
    refresh: refreshDeviceLocation,
  } = useDeviceLocation();
  const userCoord: [number, number] | null = deviceCoord
    ? [deviceCoord.lng, deviceCoord.lat]
    : null;
  // Explore answers "what's near me now". Anchor on a real permission-backed
  // device fix when we have one; the saved local court (often another city)
  // and the continental overview are fallbacks, not the default.
  const locationIsTrusted = locationStatus === "granted" && userCoord != null;
  const localCourtCenter: [number, number] | null = localCourt
    ? [localCourt.longitude, localCourt.latitude]
    : null;

  const initialCenter: [number, number] =
    (locationIsTrusted ? userCoord : null) ??
    localCourtCenter ??
    userCoord ??
    FALLBACK_CENTER;
  const initialZoom =
    locationIsTrusted || localCourt ? 12 : userCoord ? 9 : 3.4;

  // ── Viewport-driven Supabase fetch (400ms debounce, sequenced) ──
  // Responses can arrive out of order while panning; only the newest request
  // may write state or a slow stale response overwrites fresher courts.
  const fetchSeq = useRef(0);
  const refetchViewport = useCallback(() => {
    if (fetchTimer.current) clearTimeout(fetchTimer.current);
    fetchTimer.current = setTimeout(async () => {
      // The map can report no bounds for a beat right after it loads — retry a
      // few times rather than giving up, or the pins never appear until the
      // next camera move (which may never come if the map opens already idle).
      let bounds: number[][] | null = null;
      for (let attempt = 0; attempt < 6 && !bounds; attempt++) {
        bounds =
          (await mapRef.current?.getVisibleBounds().catch(() => null)) ?? null;
        if (!bounds) await new Promise((r) => setTimeout(r, 250));
      }
      if (!bounds || bounds.length < 2) return;
      const seq = ++fetchSeq.current;
      const [[neLng, neLat], [swLng, swLat]] = bounds;
      const latPad = (neLat - swLat) * 0.15;
      const lngPad = (neLng - swLng) * 0.15;
      // A wide, zoomed-out viewport should still return a full spread of pins
      // for Mapbox to cluster — 250 was leaving whole metros blank at national
      // zoom. The clustering layers keep the render cheap.
      const courts = await fetchCourtsInBounds(
        swLat - latPad,
        swLng - lngPad,
        neLat + latPad,
        neLng + lngPad,
        sportFilter,
        1500,
      );
      if (seq !== fetchSeq.current) return;
      // Never blank the map on an empty response while we still have pins —
      // an empty result is as likely a transient read failure as a genuinely
      // court-free viewport. A later non-empty fetch replaces them.
      setViewportCourts((prev) =>
        courts.length === 0 && prev.length > 0 ? prev : courts,
      );
    }, 400);
  }, [sportFilter]);

  // ── Courts on the map are whatever the viewport fetch returned, plus the
  // saved local court (always pinned) and the nearby context set. No market
  // scoping here — a map you can pan and zoom *is* the scope, and scoping by
  // the saved local court's market was the reason zooming out never revealed
  // courts in other cities. Sport is the only filter. ──
  const mergedCourts = useMemo(() => {
    const merged = new Map<string, Court>();
    viewportCourts.forEach((c) => merged.set(c.id, c));
    contextCourts.forEach((c) => {
      merged.set(c.id, merged.has(c.id) ? { ...merged.get(c.id)!, ...c } : c);
    });
    if (localCourt && !merged.has(localCourt.id)) {
      merged.set(localCourt.id, localCourt);
    }
    return Array.from(merged.values()).filter(
      (court) => sportFilter === "ALL" || court.sport === sportFilter,
    );
  }, [viewportCourts, contextCourts, localCourt, sportFilter]);

  // Belt-and-braces: whenever the SDK reports ready, or we somehow have no
  // pins at all, re-run the viewport fetch. onMapIdle alone has missed the
  // first load in the field.
  useEffect(() => {
    if (mapReady) refetchViewport();
  }, [mapReady, sportFilter, refetchViewport]);

  // Switching sport invalidates any drawn route / pending court drawer from a
  // prior "find nearest" on the other sport.
  useEffect(() => {
    if (sheetTimer.current) clearTimeout(sheetTimer.current);
    setNearestRoute(null);
    setLocationNotice(null);
  }, [sportFilter]);

  const liveCounts = useCourtCounts(mergedCourts);
  const allCourts = useMemo(
    () =>
      mergedCourts.map((c) => {
        const live = liveCounts[c.id];
        return live
          ? { ...c, activeCount: live.activeCount, localCount: live.localCount }
          : c;
      }),
    [mergedCourts, liveCounts],
  );

  const liveCourtCount = allCourts.filter((c) => c.activeCount > 0).length;

  // ── GeoJSON for the ShapeSource ──
  // One court row with a null / NaN / (0,0) coordinate can make the native
  // source reject the whole collection — filter them out here.
  const courtsGeoJSON = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: allCourts
        .filter((c) => isLngLat([c.longitude, c.latitude]))
        .map((c) => ({
          type: "Feature" as const,
          id: c.id,
          geometry: {
            type: "Point" as const,
            coordinates: [c.longitude, c.latitude],
          },
          properties: {
            id: c.id,
            active: c.activeCount ?? 0,
            confirmed: c.status === "confirmed",
            isLocal: c.id === localCourtId,
            sportColor: getCourtIdentityColor(c.sport),
          },
        })),
    }),
    [allCourts, localCourtId],
  );

  // ── Interactions ──
  const onSourcePress = useCallback(
    async (e: any) => {
      const feature = e.features?.[0];
      if (!feature) return;
      if (feature.properties?.cluster) {
        const coords = feature.geometry?.coordinates as
          | [number, number]
          | undefined;
        if (!isLngLat(coords ?? null)) return;
        let zoom: number | null = null;
        try {
          zoom =
            (await sourceRef.current
              ?.getClusterExpansionZoom(feature)
              .catch(() => null)) ?? null;
        } catch {
          zoom = null;
        }
        cameraRef.current?.setCamera({
          centerCoordinate: coords,
          zoomLevel: (zoom ?? 12) + 0.5,
          animationDuration: 500,
        });
        return;
      }
      const court = allCourts.find((c) => c.id === feature.properties?.id);
      if (court)
        openCourtSheet({ courtId: court.id, distanceKm: court.distanceKm });
    },
    [allCourts, openCourtSheet],
  );

  const flyToUser = useCallback(async () => {
    // An explicit "center on me" tap should trust a live fix, not a cached one
    // from the user's last city. Fall back to the cached coordinate only if the
    // refresh yields nothing.
    const fresh = await refreshDeviceLocation().catch(() => null);
    const resolved =
      (fresh ? coordinateForLocationAction(fresh.status, fresh.coord) : null) ??
      coordinateForLocationAction(locationStatus, deviceCoord);
    if (resolved && isLngLat([resolved.lng, resolved.lat])) {
      userCameraOverride.current = true;
      setNearestRoute(null);
      cameraRef.current?.setCamera({
        centerCoordinate: [resolved.lng, resolved.lat],
        zoomLevel: 13,
        animationDuration: 700,
      });
    } else {
      setLocationNotice("LOCATION PERMISSION NEEDED TO CENTER THE MAP");
    }
  }, [deviceCoord, locationStatus, refreshDeviceLocation]);

  const findNearestCourt = useCallback(async () => {
    setLocationNotice("FINDING NEAREST COURT…");
    if (sheetTimer.current) clearTimeout(sheetTimer.current);
    try {
      // Same as center-on-me: refresh the fix before routing anywhere.
      const fresh = await refreshDeviceLocation().catch(() => null);
      const resolved =
        (fresh
          ? coordinateForLocationAction(fresh.status, fresh.coord)
          : null) ?? coordinateForLocationAction(locationStatus, deviceCoord);
      if (!resolved) {
        setLocationNotice("LOCATION NEEDED TO FIND THE NEAREST COURT");
        return;
      }
      const [nearest] = await fetchNearbyCourts(
        resolved.lat,
        resolved.lng,
        sportFilter === "ALL" ? null : sportFilter,
        1,
      );
      if (!nearest) {
        setLocationNotice("NO COURT FOUND NEAR THIS LOCATION");
        return;
      }

      const from: LngLat = [resolved.lng, resolved.lat];
      const to: LngLat = [nearest.longitude, nearest.latitude];
      if (!isLngLat(from) || !isLngLat(to)) {
        setLocationNotice("LOCATION UNAVAILABLE — TRY AGAIN");
        return;
      }
      const distanceKm = nearest.distanceKm ?? kmBetween(from, to);

      // Zoom out to frame both the puck and the court, leaving room for the
      // drawer that opens over the lower third of the screen. setCamera(bounds)
      // is used here rather than fitBounds() because it shares the exact path
      // as the working "center on me" control.
      userCameraOverride.current = true;
      const { ne, sw } = boundsFor([from, to]);
      cameraRef.current?.setCamera({
        bounds: { ne, sw },
        padding: {
          paddingTop: 110,
          paddingRight: 56,
          paddingBottom: 380,
          paddingLeft: 56,
        },
        animationDuration: 900,
      });
      setLocationNotice(null);

      // Show a straight connector immediately; upgrade to the walking route
      // when the court is close enough for one to make sense.
      setNearestRoute({ from, to, path: straightPath(from, to), distanceKm });
      if (distanceKm <= ROUTE_MAX_KM) {
        void fetchWalkingPath(from, to, MAPBOX_TOKEN)
          .then((path) => {
            setNearestRoute((prev) =>
              prev && prev.to[0] === to[0] && prev.to[1] === to[1]
                ? { ...prev, path }
                : prev,
            );
          })
          .catch(() => {
            /* keep the straight connector already shown */
          });
      }

      sheetTimer.current = setTimeout(() => {
        openCourtSheet({ courtId: nearest.id, distanceKm });
      }, 950);
    } catch {
      setLocationNotice("LOCATION UNAVAILABLE — TRY AGAIN");
    }
  }, [
    deviceCoord,
    locationStatus,
    openCourtSheet,
    refreshDeviceLocation,
    sportFilter,
  ]);

  // The map can finish mounting before profile/location hydration. Reapply the
  // scoped camera only after the SDK is ready; otherwise setCamera is dropped
  // and the user gets stuck on the continent fallback with no visible pins.
  useEffect(() => {
    if (!mapReady) return;
    if (
      focusCoordinate &&
      isLngLat([focusCoordinate.lng, focusCoordinate.lat])
    ) {
      userCameraOverride.current = false;
      setNearestRoute(null);
      cameraRef.current?.setCamera({
        centerCoordinate: [focusCoordinate.lng, focusCoordinate.lat],
        zoomLevel: 17,
        pitch: 58,
        heading: -22,
        padding: {
          paddingTop: 1,
          paddingRight: 1,
          paddingBottom: 220,
          paddingLeft: 1,
        },
        animationMode: "flyTo",
        animationDuration: 1100,
      });
      return;
    }
    // A tap on "center on me" / "find nearest court" takes precedence — don't
    // reset the camera underneath the user when location or the local court
    // hydrates a moment later.
    if (userCameraOverride.current) return;
    const center =
      (locationIsTrusted ? userCoord : null) ?? localCourtCenter ?? userCoord;
    if (!isLngLat(center)) return;
    cameraRef.current?.setCamera({
      centerCoordinate: center,
      zoomLevel: 12.5,
      animationDuration: 650,
    });
  }, [
    focusCoordinate?.lat,
    focusCoordinate?.lng,
    mapReady,
    locationIsTrusted,
    deviceCoord?.lat,
    deviceCoord?.lng,
    localCourt?.id,
    localCourt?.latitude,
    localCourt?.longitude,
  ]);

  // Missing-token guard: a build without EXPO_PUBLIC_MAPBOX_TOKEN degrades to
  // the nearby-court list instead of mounting an SDK that was never configured.
  if (!MAPBOX_TOKEN) {
    return (
      <View style={styles.container}>
        <View style={styles.listOverlay}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: 20,
              paddingTop: 24,
              paddingBottom: bottom + 96,
            }}
          >
            <Text style={styles.emptyText}>
              MAP UNAVAILABLE — SHOWING NEARBY COURTS
            </Text>
            {contextCourts.map((c) => (
              <CourtListItem
                key={c.id}
                court={c}
                onPress={() =>
                  openCourtSheet({ courtId: c.id, distanceKm: c.distanceKm })
                }
              />
            ))}
          </ScrollView>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        styleURL={STYLE_URL}
        logoEnabled={false}
        attributionPosition={{ bottom: 8, left: 96 }}
        scaleBarEnabled={false}
        compassEnabled={false}
        onMapIdle={refetchViewport}
        onCameraChanged={() => {
          if (!mapReady) return;
          refetchViewport();
        }}
        onPress={() => setNearestRoute(null)}
        onDidFinishLoadingMap={() => {
          setMapReady(true);
          refetchViewport();
        }}
      >
        <Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: initialCenter,
            zoomLevel: initialZoom,
          }}
        />
        <LocationPuck
          visible
          pulsing={{ isEnabled: true, color: Colors.accent }}
        />

        {nearestRoute ? (
          <ShapeSource
            id="nearest-route"
            shape={{
              type: "FeatureCollection",
              features: [
                {
                  type: "Feature",
                  properties: {},
                  geometry: nearestRoute.path,
                },
                {
                  type: "Feature",
                  properties: { marker: true },
                  geometry: { type: "Point", coordinates: nearestRoute.to },
                },
              ],
            }}
          >
            {/* Neon LocalCheck-orange path: wide soft glow → tight glow → core */}
            <LineLayer
              id="nearest-route-halo"
              filter={["==", ["geometry-type"], "LineString"]}
              style={{
                lineColor: Colors.accent,
                lineOpacity: 0.18,
                lineWidth: 22,
                lineBlur: 6,
                lineCap: "round",
                lineJoin: "round",
              }}
            />
            <LineLayer
              id="nearest-route-glow"
              filter={["==", ["geometry-type"], "LineString"]}
              style={{
                lineColor: Colors.accent,
                lineOpacity: 0.45,
                lineWidth: 10,
                lineBlur: 2.5,
                lineCap: "round",
                lineJoin: "round",
              }}
            />
            <LineLayer
              id="nearest-route-line"
              filter={["==", ["geometry-type"], "LineString"]}
              style={{
                lineColor: Colors.accent,
                lineWidth: 4,
                lineCap: "round",
                lineJoin: "round",
                lineDasharray:
                  nearestRoute.distanceKm > ROUTE_MAX_KM ? [1.6, 1.4] : [1],
              }}
            />
            <CircleLayer
              id="nearest-route-target-glow"
              filter={["==", ["get", "marker"], true]}
              style={{
                circleColor: Colors.accent,
                circleOpacity: 0.28,
                circleRadius: 18,
                circleBlur: 0.8,
              }}
            />
            <CircleLayer
              id="nearest-route-target"
              filter={["==", ["get", "marker"], true]}
              style={{
                circleColor: Colors.accent,
                circleRadius: 7,
                circleStrokeWidth: 3,
                circleStrokeColor: Colors.background,
              }}
            />
          </ShapeSource>
        ) : null}

        <ShapeSource
          ref={sourceRef}
          id="courts"
          shape={courtsGeoJSON}
          cluster
          clusterRadius={46}
          clusterMaxZoomLevel={13}
          onPress={onSourcePress}
        >
          {/* Clusters: dark disc, hairline border, count */}
          <CircleLayer
            id="court-clusters"
            filter={["has", "point_count"]}
            style={{
              circleColor: Colors.surfaceHigh,
              circleRadius: [
                "step",
                ["get", "point_count"],
                14,
                25,
                18,
                100,
                24,
              ],
              circleStrokeWidth: 1.5,
              circleStrokeColor: Colors.accent,
              circleOpacity: 0.92,
            }}
          />
          <SymbolLayer
            id="court-cluster-count"
            filter={["has", "point_count"]}
            style={{
              textField: ["get", "point_count_abbreviated"],
              textSize: 12,
              textColor: Colors.text,
              textAllowOverlap: true,
            }}
          />

          {/* Quiet courts: visible sport-identity pin; orange remains live-only. */}
          <CircleLayer
            id="court-quiet"
            filter={[
              "all",
              ["!", ["has", "point_count"]],
              ["==", ["get", "active"], 0],
            ]}
            style={{
              circleColor: ["get", "sportColor"],
              circleRadius: 8,
              circleStrokeWidth: 2,
              circleStrokeColor: Colors.white,
              circleOpacity: ["case", ["get", "confirmed"], 0.95, 0.72],
            }}
          />

          {/* Active courts: accent glow + disc + live count */}
          <CircleLayer
            id="court-active-glow"
            filter={[
              "all",
              ["!", ["has", "point_count"]],
              [">", ["get", "active"], 0],
            ]}
            style={{
              circleColor: Colors.accent,
              circleRadius: 20,
              circleOpacity: 0.25,
              circleBlur: 0.9,
            }}
          />
          <CircleLayer
            id="court-active"
            filter={[
              "all",
              ["!", ["has", "point_count"]],
              [">", ["get", "active"], 0],
            ]}
            style={{
              circleColor: Colors.accent,
              circleRadius: 12,
              circleStrokeWidth: 1.5,
              circleStrokeColor: Colors.background,
            }}
          />
          <SymbolLayer
            id="court-active-count"
            filter={[
              "all",
              ["!", ["has", "point_count"]],
              [">", ["get", "active"], 0],
            ]}
            style={{
              textField: ["to-string", ["get", "active"]],
              textSize: 12,
              textColor: Colors.black,
              textAllowOverlap: true,
            }}
          />

          {/* My local court: white ring so it reads at any zoom */}
          <CircleLayer
            id="court-my-local-ring"
            filter={["all", ["!", ["has", "point_count"]], ["get", "isLocal"]]}
            style={{
              circleColor: "rgba(0,0,0,0)",
              circleRadius: 16,
              circleStrokeWidth: 2,
              circleStrokeColor: Colors.white,
            }}
          />
        </ShapeSource>
      </MapView>

      {!addCourtMode ? (
        <>
          <View style={[styles.topBar, { top: 12 }]}>
            <View
              style={[
                styles.liveBadge,
                liveCourtCount === 0 && styles.liveBadgeQuiet,
              ]}
            >
              <View style={styles.liveDot} />
              <Text style={styles.liveBadgeText}>
                {liveCourtCount > 0
                  ? `${liveCourtCount} LIVE NOW`
                  : "NO ACTIVE CHECK-INS IN VIEW"}
              </Text>
            </View>
          </View>

          {/* ── Legend ── */}
          <View
            style={[
              styles.legend,
              { bottom: bottom + Layout.tabBarClearance + 60 },
            ]}
          >
            <View style={styles.legendRow}>
              <View
                style={[styles.legendDot, { backgroundColor: Colors.accent }]}
              />
              <Text style={styles.legendText}>ACTIVE NOW</Text>
            </View>
            <View style={styles.legendRow}>
              <View
                style={[
                  styles.legendDot,
                  { backgroundColor: getCourtIdentityColor("BASKETBALL") },
                ]}
              />
              <Text style={styles.legendText}>BASKETBALL</Text>
            </View>
            <View style={styles.legendRow}>
              <View
                style={[
                  styles.legendDot,
                  { backgroundColor: getCourtIdentityColor("PICKLEBALL") },
                ]}
              />
              <Text style={styles.legendText}>PICKLEBALL</Text>
            </View>
          </View>

          {/* ── Right-side control: center the map on the current device ── */}
          <Pressable
            style={[
              styles.roundBtn,
              { bottom: bottom + Layout.tabBarClearance + 60 },
            ]}
            onPress={flyToUser}
            accessibilityLabel="Center on my location"
          >
            <Feather name="navigation" size={18} color={Colors.text} />
          </Pressable>

          <Pressable
            accessibilityLabel="Find nearest court"
            accessibilityRole="button"
            onPress={findNearestCourt}
            style={({ pressed }) => [
              styles.nearestButton,
              { bottom: bottom + Layout.tabBarClearance + 10 },
              pressed && styles.nearestButtonPressed,
            ]}
          >
            <Feather color={Colors.black} name="navigation" size={15} />
            <Text style={styles.nearestButtonText}>FIND NEAREST COURT</Text>
          </Pressable>
          {locationNotice ? (
            <View
              style={[
                styles.locationNotice,
                { bottom: bottom + Layout.tabBarClearance + 60 },
              ]}
            >
              <Text style={styles.locationNoticeText}>{locationNotice}</Text>
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  topBar: {
    position: "absolute",
    left: 20,
    right: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(16,16,16,0.85)",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  liveBadgeQuiet: { backgroundColor: "rgba(16,16,16,0.52)", opacity: 0.72 },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.accent,
  },
  liveBadgeText: {
    fontFamily: Typography.bodySemiBold,
    fontSize: 10,
    color: Colors.text,
    letterSpacing: 1.2,
  },
  mapScope: {
    fontFamily: Typography.bodyBold,
    fontSize: 8,
    color: Colors.textSecondary,
    letterSpacing: 1.5,
    backgroundColor: "rgba(16,16,16,0.85)",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },

  listOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.background,
  },
  emptyText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 11,
    color: Colors.muted,
    letterSpacing: 1,
    textAlign: "center",
    marginTop: 40,
  },

  legend: {
    position: "absolute",
    left: 20,
    backgroundColor: "rgba(16,16,16,0.85)",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    paddingHorizontal: 9,
    paddingVertical: 7,
    gap: 4,
  },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 7, height: 7, borderRadius: 4 },
  legendText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 8,
    color: Colors.textSecondary,
    letterSpacing: 1.5,
  },

  roundBtn: {
    position: "absolute",
    right: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.surfaceHigh,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  nearestButton: {
    position: "absolute",
    alignSelf: "center",
    minWidth: 190,
    minHeight: 44,
    paddingHorizontal: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.accent,
    borderRadius: Radius.sm,
  },
  nearestButtonPressed: { opacity: 0.78 },
  nearestButtonText: {
    fontFamily: Typography.heading,
    fontSize: 12,
    color: Colors.black,
    letterSpacing: 1.4,
  },
  locationNotice: {
    position: "absolute",
    alignSelf: "center",
    maxWidth: "82%",
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "rgba(13,13,16,0.9)",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  locationNoticeText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 11,
    color: Colors.text,
    textAlign: "center",
  },
});
