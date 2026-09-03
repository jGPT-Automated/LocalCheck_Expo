import { Feather } from "@expo/vector-icons";
import * as Location from "expo-location";
import React, { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";

import { useCourtSheet } from "@/components/sheet/CourtSheetHost";
import { Colors } from "@/constants/colors";
import { Court, CourtSport, getCourtIdentityColor } from "@/constants/data";
import { Layout } from "@/constants/layout";
import { Typography } from "@/constants/typography";
import { useApp } from "@/context/AppContext";
import { useCourtCounts } from "@/context/CourtPresenceContext";
import { useDeviceLocation } from "@/context/DeviceLocationContext";
import type { DeviceCoordinate } from "@/context/deviceLocationModel";
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

const ROUTE_SOURCE_ID = "explore-nearest-route";
const ROUTE_GLOW_LAYER_ID = "explore-nearest-route-glow";
const ROUTE_LINE_LAYER_ID = "explore-nearest-route-line";
const ROUTE_TARGET_LAYER_ID = "explore-nearest-route-target";

declare global {
  interface Window {
    mapboxgl: any;
  }
}

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? "";
const HAS_TOKEN = MAPBOX_TOKEN && MAPBOX_TOKEN !== "YOUR_MAPBOX_TOKEN_HERE";

const SOURCE_ID = "explore-courts";
const CLUSTER_LAYER_ID = "explore-court-clusters";
const CLUSTER_COUNT_LAYER_ID = "explore-court-cluster-count";
const QUIET_GLOW_LAYER_ID = "explore-court-quiet-glow";
const QUIET_LAYER_ID = "explore-court-quiet";
const ACTIVE_GLOW_LAYER_ID = "explore-court-active-glow";
const ACTIVE_LAYER_ID = "explore-court-active";
const ACTIVE_COUNT_LAYER_ID = "explore-court-active-count";
const LOCAL_RING_LAYER_ID = "explore-court-local-ring";

function buildCourtGeoJSON(courts: Court[], localCourtId: string | null) {
  return {
    type: "FeatureCollection" as const,
    features: courts.map((court) => ({
      type: "Feature" as const,
      id: court.id,
      geometry: {
        type: "Point" as const,
        coordinates: [court.longitude, court.latitude],
      },
      properties: {
        id: court.id,
        active: court.activeCount ?? 0,
        confirmed: court.status === "confirmed",
        isLocal: court.id === localCourtId,
        sportColor: getCourtIdentityColor(court.sport),
      },
    })),
  };
}

function MapboxMap({
  courts,
  onCourtSelect,
  onBoundsChange,
  initialCenter,
  initialZoom,
  localCourtId,
  focusCourt,
  focusCoordinate,
  route,
  onMapTap,
}: {
  courts: Court[];
  onCourtSelect: (c: Court) => void;
  onBoundsChange?: (
    sw: { lat: number; lng: number },
    ne: { lat: number; lng: number },
  ) => void;
  initialCenter: [number, number];
  initialZoom: number;
  localCourtId: string | null;
  focusCourt: Court | null;
  focusCoordinate: DeviceCoordinate | null;
  route: NearestRoute | null;
  onMapTap?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const onBoundsChangeRef = useRef(onBoundsChange);
  const onCourtSelectRef = useRef(onCourtSelect);
  const onMapTapRef = useRef(onMapTap);
  const courtsRef = useRef(courts);
  const [mapReady, setMapReady] = useState(false);
  const overlayOpacity = useRef(new Animated.Value(1)).current;
  const addCourtMarkerRef = useRef<any>(null);

  onBoundsChangeRef.current = onBoundsChange;
  onCourtSelectRef.current = onCourtSelect;
  onMapTapRef.current = onMapTap;
  courtsRef.current = courts;

  useEffect(() => {
    if (!HAS_TOKEN || !containerRef.current) return;

    let cancelled = false;
    const cssId = "localcheck-mapbox-css";
    if (!document.getElementById(cssId)) {
      const link = document.createElement("link");
      link.id = cssId;
      link.rel = "stylesheet";
      link.href = "https://api.mapbox.com/mapbox-gl-js/v3.12.0/mapbox-gl.css";
      document.head.appendChild(link);
    }

    const controlStyleId = "localcheck-mapbox-controls";
    if (!document.getElementById(controlStyleId)) {
      const controlStyle = document.createElement("style");
      controlStyle.id = controlStyleId;
      controlStyle.textContent = `
        .mapboxgl-ctrl-group {
          background: rgba(13,13,15,0.75) !important;
          border-radius: 0 !important;
          border: 1px solid rgba(255,255,255,0.08) !important;
          backdrop-filter: blur(8px);
        }
        .mapboxgl-ctrl button { background-color: transparent !important; }
        .mapboxgl-ctrl button .mapboxgl-ctrl-icon { filter: invert(0.6) !important; }
        .mapboxgl-ctrl button:hover .mapboxgl-ctrl-icon { filter: invert(1) !important; }
        .mapboxgl-ctrl-top-right { top: 12px !important; right: 12px !important; }
      `;
      document.head.appendChild(controlStyle);
    }

    const bootMap = () => {
      if (cancelled || !containerRef.current || mapRef.current) return;
      const mapboxgl = window.mapboxgl;
      mapboxgl.accessToken = MAPBOX_TOKEN;

      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/dark-v11",
        center: initialCenter,
        zoom: initialZoom,
        attributionControl: false,
      });

      // Controls live in a right-side column BELOW the search bar — never
      // bottom-right, where they overlapped the add-court FAB.
      map.addControl(
        new mapboxgl.NavigationControl({ showCompass: false }),
        "top-right",
      );
      map.addControl(
        new mapboxgl.GeolocateControl({
          positionOptions: { enableHighAccuracy: true },
          trackUserLocation: true,
        }),
        "top-right",
      );

      const emitBounds = () => {
        const b = map.getBounds();
        onBoundsChangeRef.current?.(
          { lat: b.getSouth(), lng: b.getWest() },
          { lat: b.getNorth(), lng: b.getEast() },
        );
      };

      map.on("load", () => {
        if (cancelled) return;
        mapRef.current = map;

        map.addSource(SOURCE_ID, {
          type: "geojson",
          data: buildCourtGeoJSON(courtsRef.current, localCourtId),
          cluster: true,
          clusterRadius: 46,
          clusterMaxZoom: 13,
        });
        map.addLayer({
          id: CLUSTER_LAYER_ID,
          type: "circle",
          source: SOURCE_ID,
          filter: ["has", "point_count"],
          paint: {
            "circle-color": Colors.surfaceHigh,
            "circle-radius": [
              "step",
              ["get", "point_count"],
              15,
              25,
              19,
              100,
              24,
            ],
            "circle-stroke-width": 1.5,
            "circle-stroke-color": Colors.accent,
            "circle-opacity": 0.94,
          },
        });
        map.addLayer({
          id: CLUSTER_COUNT_LAYER_ID,
          type: "symbol",
          source: SOURCE_ID,
          filter: ["has", "point_count"],
          layout: {
            "text-field": ["get", "point_count_abbreviated"],
            "text-size": 12,
            "text-allow-overlap": true,
          },
          paint: { "text-color": Colors.text },
        });
        map.addLayer({
          id: QUIET_GLOW_LAYER_ID,
          type: "circle",
          source: SOURCE_ID,
          filter: [
            "all",
            ["!", ["has", "point_count"]],
            ["==", ["get", "active"], 0],
          ],
          paint: {
            "circle-color": ["get", "sportColor"],
            "circle-radius": 15,
            "circle-opacity": 0.14,
            "circle-blur": 0.7,
          },
        });
        map.addLayer({
          id: QUIET_LAYER_ID,
          type: "circle",
          source: SOURCE_ID,
          filter: [
            "all",
            ["!", ["has", "point_count"]],
            ["==", ["get", "active"], 0],
          ],
          paint: {
            "circle-color": ["get", "sportColor"],
            "circle-radius": 7,
            "circle-stroke-width": 1.75,
            "circle-stroke-color": Colors.text,
            "circle-opacity": ["case", ["get", "confirmed"], 0.95, 0.68],
          },
        });
        map.addLayer({
          id: ACTIVE_GLOW_LAYER_ID,
          type: "circle",
          source: SOURCE_ID,
          filter: [
            "all",
            ["!", ["has", "point_count"]],
            [">", ["get", "active"], 0],
          ],
          paint: {
            "circle-color": Colors.accent,
            "circle-radius": 20,
            "circle-opacity": 0.24,
            "circle-blur": 0.85,
          },
        });
        map.addLayer({
          id: ACTIVE_LAYER_ID,
          type: "circle",
          source: SOURCE_ID,
          filter: [
            "all",
            ["!", ["has", "point_count"]],
            [">", ["get", "active"], 0],
          ],
          paint: {
            "circle-color": Colors.accent,
            "circle-radius": 12,
            "circle-stroke-width": 1.5,
            "circle-stroke-color": Colors.background,
          },
        });
        map.addLayer({
          id: ACTIVE_COUNT_LAYER_ID,
          type: "symbol",
          source: SOURCE_ID,
          filter: [
            "all",
            ["!", ["has", "point_count"]],
            [">", ["get", "active"], 0],
          ],
          layout: {
            "text-field": ["to-string", ["get", "active"]],
            "text-size": 12,
            "text-allow-overlap": true,
          },
          paint: { "text-color": Colors.black },
        });
        map.addLayer({
          id: LOCAL_RING_LAYER_ID,
          type: "circle",
          source: SOURCE_ID,
          filter: [
            "all",
            ["!", ["has", "point_count"]],
            ["==", ["get", "isLocal"], true],
          ],
          paint: {
            "circle-color": "rgba(0,0,0,0)",
            "circle-radius": 17,
            "circle-stroke-width": 2,
            "circle-stroke-color": Colors.text,
          },
        });

        map.on("click", CLUSTER_LAYER_ID, (event: any) => {
          const feature = map.queryRenderedFeatures(event.point, {
            layers: [CLUSTER_LAYER_ID],
          })[0];
          if (!feature) return;
          const source = map.getSource(SOURCE_ID);
          source.getClusterExpansionZoom(
            feature.properties.cluster_id,
            (error: Error | null, zoom: number) => {
              if (error) return;
              map.easeTo({
                center: feature.geometry.coordinates,
                zoom,
                duration: 450,
                essential: true,
              });
            },
          );
        });
        const selectCourt = (event: any) => {
          const feature = event.features?.[0];
          const court = courtsRef.current.find(
            (item) => item.id === feature?.properties?.id,
          );
          if (!court) return;
          onCourtSelectRef.current(court);
          map.easeTo({
            center: [court.longitude, court.latitude],
            zoom: Math.max(map.getZoom(), 14),
            duration: 550,
            essential: true,
          });
        };
        map.on("click", QUIET_LAYER_ID, selectCourt);
        map.on("click", ACTIVE_LAYER_ID, selectCourt);
        map.on("click", (event: any) => {
          const interactive = [
            CLUSTER_LAYER_ID,
            QUIET_LAYER_ID,
            ACTIVE_LAYER_ID,
          ].filter((layerId) => map.getLayer(layerId));
          const hits = map.queryRenderedFeatures(event.point, {
            layers: interactive,
          });
          if (!hits.length) onMapTapRef.current?.();
        });
        [CLUSTER_LAYER_ID, QUIET_LAYER_ID, ACTIVE_LAYER_ID].forEach(
          (layerId) => {
            map.on("mouseenter", layerId, () => {
              map.getCanvas().style.cursor = "pointer";
            });
            map.on("mouseleave", layerId, () => {
              map.getCanvas().style.cursor = "";
            });
          },
        );

        setMapReady(true);
        emitBounds();
        map.on("moveend", emitBounds);
        Animated.timing(overlayOpacity, {
          toValue: 0,
          duration: 350,
          useNativeDriver: false,
        }).start();
      });
    };

    let script: HTMLScriptElement | null = null;
    if (window.mapboxgl) {
      bootMap();
    } else {
      script = document.createElement("script");
      script.src = "https://api.mapbox.com/mapbox-gl-js/v3.12.0/mapbox-gl.js";
      script.onload = bootMap;
      document.head.appendChild(script);
    }

    return () => {
      cancelled = true;
      addCourtMarkerRef.current?.remove();
      addCourtMarkerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      if (script?.parentNode) script.parentNode.removeChild(script);
    };
  }, []);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    mapRef.current.easeTo({
      center: initialCenter,
      zoom: 12.5,
      duration: 650,
      essential: true,
    });
  }, [mapReady, initialCenter[0], initialCenter[1]]);

  useEffect(() => {
    if (!mapReady || !mapRef.current || !HAS_TOKEN) return;
    const source = mapRef.current.getSource(SOURCE_ID);
    source?.setData(buildCourtGeoJSON(courts, localCourtId));
  }, [mapReady, courts, localCourtId]);

  useEffect(() => {
    if (!mapReady || !mapRef.current || !focusCourt) return;
    mapRef.current.easeTo({
      center: [focusCourt.longitude, focusCourt.latitude],
      zoom: 14,
      duration: 700,
      essential: true,
    });
  }, [focusCourt?.id, mapReady]);

  // "Find nearest court" connector: draw the path, mark the destination, and
  // frame both the user and the court above the drawer.
  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;
    const data = route
      ? {
          type: "FeatureCollection" as const,
          features: [
            { type: "Feature" as const, properties: {}, geometry: route.path },
            {
              type: "Feature" as const,
              properties: { marker: true },
              geometry: { type: "Point" as const, coordinates: route.to },
            },
          ],
        }
      : { type: "FeatureCollection" as const, features: [] };

    const existing = map.getSource(ROUTE_SOURCE_ID);
    if (existing) {
      existing.setData(data);
    } else {
      map.addSource(ROUTE_SOURCE_ID, { type: "geojson", data });
      map.addLayer({
        id: ROUTE_GLOW_LAYER_ID,
        type: "line",
        source: ROUTE_SOURCE_ID,
        filter: ["==", ["geometry-type"], "LineString"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": Colors.accent,
          "line-opacity": 0.22,
          "line-width": 12,
        },
      });
      map.addLayer({
        id: ROUTE_LINE_LAYER_ID,
        type: "line",
        source: ROUTE_SOURCE_ID,
        filter: ["==", ["geometry-type"], "LineString"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": Colors.accent, "line-width": 3.5 },
      });
      map.addLayer({
        id: ROUTE_TARGET_LAYER_ID,
        type: "circle",
        source: ROUTE_SOURCE_ID,
        filter: ["==", ["get", "marker"], true],
        paint: {
          "circle-color": Colors.accent,
          "circle-radius": 7,
          "circle-stroke-width": 3,
          "circle-stroke-color": Colors.background,
        },
      });
    }

    if (map.getLayer(ROUTE_LINE_LAYER_ID)) {
      map.setPaintProperty(
        ROUTE_LINE_LAYER_ID,
        "line-dasharray",
        route && route.distanceKm > ROUTE_MAX_KM ? [1.5, 1.5] : [1],
      );
    }

    if (route) {
      const { ne, sw } = boundsFor([route.from, route.to]);
      map.fitBounds([sw, ne], {
        padding: { top: 90, right: 60, bottom: 360, left: 60 },
        duration: 900,
        essential: true,
      });
    }
  }, [mapReady, route]);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    addCourtMarkerRef.current?.remove();
    addCourtMarkerRef.current = null;
    if (!focusCoordinate) return;

    mapRef.current.flyTo({
      center: [focusCoordinate.lng, focusCoordinate.lat],
      zoom: 17,
      pitch: 58,
      bearing: -22,
      padding: { top: 1, right: 1, bottom: 220, left: 1 },
      duration: 1100,
      essential: true,
    });
    addCourtMarkerRef.current = new window.mapboxgl.Marker({
      color: Colors.accent,
    })
      .setLngLat([focusCoordinate.lng, focusCoordinate.lat])
      .addTo(mapRef.current);
  }, [focusCoordinate?.lat, focusCoordinate?.lng, mapReady]);

  if (!HAS_TOKEN) {
    return (
      <View style={styles.noTokenBox}>
        <Text style={styles.noTokenTitle}>MAPBOX KEY NEEDED</Text>
        <Text style={styles.noTokenSub}>
          Add your key to EXPO_PUBLIC_MAPBOX_TOKEN in Secrets to enable the live
          map.{"\n"}
          Get a free key at mapbox.com
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <div
        ref={containerRef as any}
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 0,
          background: Colors.surfaceDark,
        }}
      />
      <Animated.View
        style={[
          styles.mapLoadingOverlay,
          { opacity: overlayOpacity, pointerEvents: "none" },
        ]}
      >
        <View style={styles.mapLoadingSpinner}>
          <View style={styles.spinnerRing} />
          <Text style={styles.mapLoadingText}>LOADING MAP</Text>
        </View>
      </Animated.View>
    </View>
  );
}

export function MapScreen({
  sportFilter = "ALL",
  addCourtMode = false,
  focusCoordinate = null,
}: {
  sportFilter?: CourtSport | "ALL";
  addCourtMode?: boolean;
  focusCoordinate?: DeviceCoordinate | null;
}) {
  const { courts: contextCourts, localCourt } = useApp();
  const { coord: deviceCoord, status: locationStatus } = useDeviceLocation();
  const [selectedCourt, setSelectedCourt] = useState<Court | null>(null);
  const [focusedCourt, setFocusedCourt] = useState<Court | null>(null);
  const [nearestRoute, setNearestRoute] = useState<NearestRoute | null>(null);
  const [locationNotice, setLocationNotice] = useState<string | null>(null);
  // Selecting a court opens the app-wide court drawer (see CourtSheetHost).
  const { openCourtSheet } = useCourtSheet();
  useEffect(() => {
    if (!selectedCourt) return;
    openCourtSheet({
      courtId: selectedCourt.id,
      distanceKm: selectedCourt.distanceKm ?? undefined,
    });
    setSelectedCourt(null);
  }, [selectedCourt]);
  // Courts stream from Supabase per viewport (same source as native) —
  // context courts only overlay extra fields for ids already in view.
  const [viewportCourts, setViewportCourts] = useState<Court[]>([]);
  const boundsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Sequence viewport requests: a slow response from a previous pan must not
  // overwrite courts from a newer one.
  const boundsSeq = useRef(0);
  const handleBoundsChange = React.useCallback(
    (sw: { lat: number; lng: number }, ne: { lat: number; lng: number }) => {
      if (boundsTimer.current) clearTimeout(boundsTimer.current);
      boundsTimer.current = setTimeout(async () => {
        const seq = ++boundsSeq.current;
        const latPad = (ne.lat - sw.lat) * 0.15;
        const lngPad = (ne.lng - sw.lng) * 0.15;
        const found = await fetchCourtsInBounds(
          sw.lat - latPad,
          sw.lng - lngPad,
          ne.lat + latPad,
          ne.lng + lngPad,
          sportFilter,
          250,
        );
        if (seq !== boundsSeq.current) return;
        setViewportCourts(found);
      }, 400);
    },
    [sportFilter],
  );

  const rawCourts = React.useMemo(() => {
    const merged = new Map<string, Court>();
    viewportCourts.forEach((c) => merged.set(c.id, c));
    contextCourts.forEach((c) => {
      const belongsToCurrentMarket =
        !localCourt ||
        c.id === localCourt.id ||
        (!!localCourt.market && c.market === localCourt.market);
      if (merged.has(c.id) || belongsToCurrentMarket) {
        merged.set(c.id, merged.has(c.id) ? { ...merged.get(c.id)!, ...c } : c);
      }
    });
    return Array.from(merged.values()).filter(
      (court) => sportFilter === "ALL" || court.sport === sportFilter,
    );
  }, [viewportCourts, contextCourts, localCourt, sportFilter]);

  // Overlay live counts from the shared presence store onto the fetched
  // snapshots, so markers/cards update in real time when anyone checks in/out
  // or switches local court — the snapshot alone goes stale the moment it lands.
  const liveCounts = useCourtCounts(rawCourts);
  const courts = React.useMemo(
    () =>
      rawCourts.map((c) => {
        const live = liveCounts[c.id];
        return live
          ? { ...c, activeCount: live.activeCount, localCount: live.localCount }
          : c;
      }),
    [rawCourts, liveCounts],
  );

  const activeCourts = courts.filter((c) => c.activeCount > 0);

  // Explore answers "what's near me now": anchor on a real permission-backed
  // device fix when we have one; the saved local court and continental
  // overview are fallbacks, not the default.
  const locationIsTrusted = locationStatus === "granted" && deviceCoord != null;
  const initialCenter = React.useMemo<[number, number]>(
    () =>
      locationIsTrusted
        ? [deviceCoord!.lng, deviceCoord!.lat]
        : localCourt
          ? [localCourt.longitude, localCourt.latitude]
          : contextCourts[0]
            ? [contextCourts[0].longitude, contextCourts[0].latitude]
            : [-96, 37.5],
    [
      locationIsTrusted,
      deviceCoord?.lat,
      deviceCoord?.lng,
      localCourt?.id,
      localCourt?.latitude,
      localCourt?.longitude,
      contextCourts,
    ],
  );
  const initialZoom = locationIsTrusted || localCourt ? 12.5 : 4;

  const findNearestCourt = React.useCallback(async () => {
    setLocationNotice("FINDING NEAREST COURT…");
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocationNotice("LOCATION NEEDED TO FIND THE NEAREST COURT");
        return;
      }
      const last = await Location.getLastKnownPositionAsync();
      const location =
        last ??
        (await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        }));
      const [nearest] = await fetchNearbyCourts(
        location.coords.latitude,
        location.coords.longitude,
        sportFilter === "ALL" ? null : sportFilter,
        1,
      );
      if (!nearest) {
        setLocationNotice("NO COURT FOUND NEAR THIS LOCATION");
        return;
      }

      const from: LngLat = [
        location.coords.longitude,
        location.coords.latitude,
      ];
      const to: LngLat = [nearest.longitude, nearest.latitude];
      const distanceKm = nearest.distanceKm ?? kmBetween(from, to);

      setLocationNotice(null);
      setNearestRoute({ from, to, path: straightPath(from, to), distanceKm });
      if (distanceKm <= ROUTE_MAX_KM) {
        void fetchWalkingPath(from, to, MAPBOX_TOKEN).then((path) => {
          setNearestRoute((prev) =>
            prev && prev.to[0] === to[0] && prev.to[1] === to[1]
              ? { ...prev, path }
              : prev,
          );
        });
      }

      window.setTimeout(() => {
        openCourtSheet({ courtId: nearest.id, distanceKm });
      }, 950);
    } catch {
      setLocationNotice("LOCATION UNAVAILABLE — TRY AGAIN");
    }
  }, [openCourtSheet, sportFilter]);

  return (
    <View style={styles.container}>
      <View style={StyleSheet.absoluteFill}>
        <MapboxMap
          courts={courts}
          onCourtSelect={setSelectedCourt}
          onBoundsChange={handleBoundsChange}
          initialCenter={initialCenter}
          initialZoom={initialZoom}
          localCourtId={localCourt?.id ?? null}
          focusCourt={focusedCourt}
          focusCoordinate={focusCoordinate}
          route={nearestRoute}
          onMapTap={() => setNearestRoute(null)}
        />

        {!addCourtMode ? (
          <>
            <View
              style={[
                styles.liveBar,
                activeCourts.length === 0 && styles.liveBarQuiet,
                { top: 12 },
              ]}
            >
              <Text style={styles.liveBarText}>
                {activeCourts.length > 0
                  ? `${activeCourts.length} COURT${activeCourts.length === 1 ? "" : "S"} LIVE`
                  : "NO ACTIVE CHECK-INS IN VIEW"}
              </Text>
              <View style={styles.liveDot} />
            </View>

            <View style={styles.legend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendPin, styles.legendActive]} />
                <Text style={styles.legendText}>ACTIVE NOW</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendPin, styles.legendBasketball]} />
                <Text style={styles.legendText}>BASKETBALL</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendPin, styles.legendPickleball]} />
                <Text style={styles.legendText}>PICKLEBALL</Text>
              </View>
            </View>

            <Pressable
              accessibilityLabel="Find nearest court"
              accessibilityRole="button"
              onPress={findNearestCourt}
              style={({ pressed }) => [
                styles.nearestButton,
                pressed && styles.nearestButtonPressed,
              ]}
            >
              <Feather color={Colors.black} name="navigation" size={15} />
              <Text style={styles.nearestButtonText}>FIND NEAREST COURT</Text>
            </Pressable>
            {locationNotice ? (
              <View style={styles.locationNotice}>
                <Text style={styles.locationNoticeText}>{locationNotice}</Text>
              </View>
            ) : null}
          </>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surfaceDark },
  liveBar: {
    position: "absolute",
    left: 64,
    right: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.surfaceDark,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 7,
    zIndex: 10,
  },
  liveBarQuiet: { backgroundColor: "rgba(13,13,16,0.52)", opacity: 0.72 },
  liveBarText: {
    fontFamily: Typography.heading,
    fontSize: 11,
    color: Colors.white,
    letterSpacing: 2,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.accent,
  },
  legend: {
    position: "absolute",
    bottom: Layout.tabBarClearance + 60,
    left: 16,
    backgroundColor: "rgba(13,13,16,0.88)",
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 9,
    paddingVertical: 7,
    gap: 4,
    zIndex: 10,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendPin: { width: 9, height: 9, borderRadius: 5, borderWidth: 1 },
  legendActive: { borderColor: Colors.accent, backgroundColor: Colors.accent },
  legendBasketball: {
    borderColor: Colors.text,
    backgroundColor: getCourtIdentityColor("BASKETBALL"),
  },
  legendPickleball: {
    borderColor: Colors.text,
    backgroundColor: getCourtIdentityColor("PICKLEBALL"),
  },
  legendText: {
    fontFamily: Typography.bodySemiBold,
    fontSize: 8,
    color: Colors.textSecondary,
    letterSpacing: 1,
  },
  nearestButton: {
    position: "absolute",
    bottom: Layout.tabBarClearance + 10,
    alignSelf: "center",
    minWidth: 190,
    minHeight: 44,
    paddingHorizontal: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.accent,
    borderRadius: 4,
    zIndex: 10,
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
    bottom: Layout.tabBarClearance + 60,
    alignSelf: "center",
    maxWidth: "82%",
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "rgba(13,13,16,0.9)",
    borderWidth: 1,
    borderColor: Colors.border,
    zIndex: 11,
  },
  locationNoticeText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 11,
    color: Colors.text,
    textAlign: "center",
  },
  noTokenBox: {
    flex: 1,
    backgroundColor: Colors.surfaceDark,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  noTokenTitle: {
    fontFamily: Typography.heading,
    fontSize: 22,
    color: Colors.accent,
    letterSpacing: 3,
    marginBottom: 16,
    textAlign: "center",
  },
  noTokenSub: {
    fontFamily: Typography.body,
    fontSize: 13,
    color: Colors.muted,
    textAlign: "center",
    lineHeight: 20,
  },
  mapLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(13,13,16,0.96)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 5,
  },
  mapLoadingSpinner: {
    alignItems: "center",
    gap: 16,
  },
  spinnerRing: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: Colors.accent,
    borderTopColor: "transparent",
  },
  mapLoadingText: {
    fontFamily: Typography.heading,
    fontSize: 11,
    color: Colors.mutedDark,
    letterSpacing: 3,
  },
});
