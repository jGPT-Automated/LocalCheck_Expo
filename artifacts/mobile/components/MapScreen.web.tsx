import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AddCourtModal } from "@/components/AddCourtModal";
import { CourtBottomSheet } from "@/components/CourtBottomSheet";
import { CourtListItem } from "@/components/CourtListItem";
import { Colors } from "@/constants/colors";
import { Court, getSportColor } from "@/constants/data";
import { Typography } from "@/constants/typography";
import { useApp } from "@/context/AppContext";
import { useCourtCounts } from "@/context/CourtPresenceContext";

declare global {
  interface Window {
    mapboxgl: any;
  }
}

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? "";
const HAS_TOKEN = MAPBOX_TOKEN && MAPBOX_TOKEN !== "YOUR_MAPBOX_TOKEN_HERE";

function buildPinElement(court: Court, isSelected: boolean): HTMLElement {
  const isCommunity = court.status === "community";
  const isConfirmed = court.status === "confirmed";
  const isPending = court.status === "pending";
  const isActive = court.activeCount > 0;
  const sportColor = getSportColor(court.sport);

  const wrapper = document.createElement("div");
  wrapper.style.cssText = `
    width: 36px;
    height: 36px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    position: relative;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
    ${isCommunity
      ? `border: 2px solid ${Colors.accent}; background: ${Colors.accent};`
      : isConfirmed
      ? `border: 2px solid rgba(255,255,255,0.75); background: rgba(13,13,16,0.88);`
      : `border: 2px dashed rgba(255,255,255,0.25); background: rgba(13,13,16,0.5);`
    }
    ${isSelected
      ? `border: 2.5px solid #fff; background: #fff; transform: scale(1.25);`
      : isActive && !isCommunity
      ? `box-shadow: 0 0 10px rgba(255,85,0,0.6); border-color: ${Colors.accent};`
      : ""
    }
  `;

  if (isActive) {
    const countEl = document.createElement("div");
    countEl.style.cssText = `
      font-family: 'Oswald', sans-serif;
      font-size: 13px;
      font-weight: 700;
      line-height: 1;
      color: ${isCommunity || isSelected ? "#000" : "#fff"};
    `;
    countEl.textContent = String(court.activeCount);
    wrapper.appendChild(countEl);

    const dot = document.createElement("div");
    dot.style.cssText = `
      position: absolute;
      top: -2px; right: -2px;
      width: 8px; height: 8px; border-radius: 50%;
      background: ${sportColor};
      border: 1.5px solid #0d0d10;
      animation: pulse 2s infinite;
    `;
    wrapper.appendChild(dot);
  } else {
    const sportDot = document.createElement("div");
    sportDot.style.cssText = `
      width: 10px; height: 10px; border-radius: 50%;
      background: ${sportColor};
      opacity: ${isPending ? 0.35 : 1};
    `;
    wrapper.appendChild(sportDot);
  }

  return wrapper;
}

function MapboxMap({
  courts,
  onCourtSelect,
  selectedId,
  onAddCourt,
}: {
  courts: Court[];
  onCourtSelect: (c: Court) => void;
  selectedId: string | null;
  onAddCourt: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const [mapReady, setMapReady] = useState(false);
  const overlayOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!HAS_TOKEN || !containerRef.current) return;

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://api.mapbox.com/mapbox-gl-js/v3.12.0/mapbox-gl.css";
    document.head.appendChild(link);

    const animStyle = document.createElement("style");
    animStyle.textContent = `@keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.4;transform:scale(1.8)} }`;
    document.head.appendChild(animStyle);

    const script = document.createElement("script");
    script.src = "https://api.mapbox.com/mapbox-gl-js/v3.12.0/mapbox-gl.js";
    script.onload = () => {
      const mapboxgl = window.mapboxgl;
      mapboxgl.accessToken = MAPBOX_TOKEN;

      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/dark-v11",
        center: [-73.97, 40.76],
        zoom: 11,
        attributionControl: false,
      });

      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "bottom-right");
      map.addControl(new mapboxgl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
      }), "bottom-right");

      const controlStyle = document.createElement("style");
      controlStyle.textContent = `
        .mapboxgl-ctrl-group {
          background: rgba(13,13,15,0.75) !important;
          border-radius: 0 !important;
          border: 1px solid rgba(255,255,255,0.08) !important;
          backdrop-filter: blur(8px);
        }
        .mapboxgl-ctrl button {
          background-color: transparent !important;
        }
        .mapboxgl-ctrl button .mapboxgl-ctrl-icon {
          filter: invert(0.6) !important;
        }
        .mapboxgl-ctrl button:hover .mapboxgl-ctrl-icon {
          filter: invert(1) !important;
        }
        .mapboxgl-ctrl-bottom-right {
          bottom: 110px !important;
          right: 12px !important;
        }
      `;
      document.head.appendChild(controlStyle);

      map.on("load", () => {
        mapRef.current = map;
        setMapReady(true);
        Animated.timing(overlayOpacity, {
          toValue: 0,
          duration: 350,
          useNativeDriver: false,
        }).start();
      });
    };
    document.head.appendChild(script);

    return () => {
      mapRef.current?.remove();
      document.head.removeChild(link);
    };
  }, []);

  useEffect(() => {
    if (!mapReady || !mapRef.current || !HAS_TOKEN) return;
    const mapboxgl = window.mapboxgl;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current.clear();

    courts.forEach((court) => {
      const isSelected = court.id === selectedId;
      const el = buildPinElement(court, isSelected);

      el.onmouseenter = () => {
        if (!isSelected) {
          el.style.transform = "scale(1.15)";
          el.style.zIndex = "10";
        }
      };
      el.onmouseleave = () => {
        if (!isSelected) {
          el.style.transform = "scale(1)";
          el.style.zIndex = "1";
        }
      };
      el.onclick = (e) => {
        e.stopPropagation();
        onCourtSelect(court);
        mapRef.current?.flyTo({
          center: [court.longitude, court.latitude],
          zoom: 14,
          duration: 800,
          essential: true,
        });
      };

      const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
        .setLngLat([court.longitude, court.latitude])
        .addTo(mapRef.current);

      markersRef.current.set(court.id, marker);
    });
  }, [mapReady, courts, selectedId]);

  if (!HAS_TOKEN) {
    return (
      <View style={styles.noTokenBox}>
        <Text style={styles.noTokenTitle}>MAPBOX KEY NEEDED</Text>
        <Text style={styles.noTokenSub}>
          Add your key to EXPO_PUBLIC_MAPBOX_TOKEN in Secrets to enable the live map.{"\n"}
          Get a free key at mapbox.com
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <div
        ref={containerRef as any}
        style={{ position: "absolute", inset: 0, zIndex: 0 }}
      />
      <Animated.View
        style={[styles.mapLoadingOverlay, { opacity: overlayOpacity, pointerEvents: "none" }]}
      >
        <View style={styles.mapLoadingSpinner}>
          <View style={styles.spinnerRing} />
          <Text style={styles.mapLoadingText}>LOADING MAP</Text>
        </View>
      </Animated.View>
    </View>
  );
}

export function MapScreen() {
  const { courts: rawCourts, checkedInCourtId } = useApp();
  const { top } = useSafeAreaInsets();
  const [selectedCourt, setSelectedCourt] = useState<Court | null>(null);
  const [view, setView] = useState<"MAP" | "LIST">("MAP");
  const [showAddModal, setShowAddModal] = useState(false);
  const topPad = 67;

  // Overlay live counts from the shared presence store onto the fetched
  // snapshots, so markers/cards update in real time when anyone checks in/out
  // or switches local court — the snapshot alone goes stale the moment it lands.
  const courtIds = React.useMemo(() => rawCourts.map((c) => c.id), [rawCourts]);
  const liveCounts = useCourtCounts(courtIds);
  const courts = React.useMemo(
    () =>
      rawCourts.map((c) => {
        const live = liveCounts[c.id];
        return live
          ? { ...c, activeCount: live.activeCount, localCount: live.localCount }
          : c;
      }),
    [rawCourts, liveCounts]
  );

  const activeCourts = courts.filter((c) => c.activeCount > 0);

  // The bottom sheet holds a snapshot from when the marker was clicked —
  // overlay live counts onto it too so the selected-court card stays current.
  const selectedLive = selectedCourt ? liveCounts[selectedCourt.id] : undefined;
  const selectedCourtLive =
    selectedCourt && selectedLive
      ? { ...selectedCourt, activeCount: selectedLive.activeCount, localCount: selectedLive.localCount }
      : selectedCourt;

  return (
    <View style={styles.container}>
      <View style={[styles.topBar, { paddingTop: topPad + 12 }]}>
        <View style={styles.searchBar}>
          <Text style={styles.searchPlaceholder}>SEARCH COURTS...</Text>
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

      {view === "MAP" ? (
        <View style={StyleSheet.absoluteFill}>
          <MapboxMap
            courts={courts}
            onCourtSelect={setSelectedCourt}
            selectedId={selectedCourt?.id ?? null}
            onAddCourt={() => setShowAddModal(true)}
          />

          {activeCourts.length > 0 && !selectedCourt && (
            <View style={[styles.liveBar, { top: topPad + 70 }]}>
              <Text style={styles.liveBarText}>
                {activeCourts.length} COURTS LIVE
              </Text>
              <View style={styles.liveDot} />
            </View>
          )}

          <Pressable
            style={styles.addCourtFab}
            onPress={() => setShowAddModal(true)}
          >
            <Ionicons name="add" size={22} color={Colors.black} />
          </Pressable>

          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendPin, styles.legendConfirmed]} />
              <Text style={styles.legendText}>CONFIRMED</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendPin, styles.legendCommunity]} />
              <Text style={styles.legendText}>COMMUNITY</Text>
            </View>
          </View>
        </View>
      ) : (
        <ScrollView
          style={[styles.list, { marginTop: topPad + 68 }]}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.listHeader}>{courts.length} COURTS NEARBY</Text>
          {courts.map((court) => (
            <CourtListItem
              key={court.id}
              court={court}
              onPress={(c) => { setSelectedCourt(c); setView("MAP"); }}
              isCheckedIn={checkedInCourtId === court.id}
            />
          ))}
          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      {view === "MAP" && (
        <CourtBottomSheet court={selectedCourtLive} onClose={() => setSelectedCourt(null)} />
      )}

      <AddCourtModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surfaceDark },
  topBar: {
    position: "absolute", top: 0, left: 0, right: 0, zIndex: 20,
    paddingHorizontal: 16, paddingBottom: 12,
    flexDirection: "row", alignItems: "flex-end", gap: 10,
  },
  searchBar: {
    flex: 1,
    backgroundColor: Colors.surfaceDark,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  searchPlaceholder: { fontFamily: Typography.heading, fontSize: 13, color: Colors.mutedDark, letterSpacing: 1.5 },
  viewToggle: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceDark,
  },
  toggleBtn: { paddingHorizontal: 12, paddingVertical: 10 },
  toggleBtnActive: { backgroundColor: Colors.accent },
  toggleText: { fontFamily: Typography.heading, fontSize: 11, color: Colors.mutedDark, letterSpacing: 1.5 },
  toggleTextActive: { color: Colors.black },
  list: { flex: 1, backgroundColor: Colors.background },
  listContent: { paddingBottom: 100 },
  listHeader: {
    fontFamily: Typography.heading, fontSize: 11, color: Colors.muted, letterSpacing: 3,
    paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1,
    borderColor: Colors.borderLight, textTransform: "uppercase" as const,
    backgroundColor: Colors.white,
  },
  liveBar: {
    position: "absolute",
    left: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.surfaceDark,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 7,
    zIndex: 10,
  },
  liveBarText: { fontFamily: Typography.heading, fontSize: 11, color: Colors.white, letterSpacing: 2 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.accent },
  addCourtFab: {
    position: "absolute",
    right: 16,
    bottom: 210,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 20,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  legend: {
    position: "absolute",
    bottom: 160,
    left: 16,
    backgroundColor: "rgba(13,13,16,0.88)",
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 5,
    zIndex: 10,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 8 },
  legendPin: { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5 },
  legendConfirmed: { borderColor: "rgba(255,255,255,0.7)", backgroundColor: "rgba(13,13,16,0.88)" },
  legendCommunity: { borderColor: Colors.accent, backgroundColor: Colors.accent },
  legendText: { fontFamily: Typography.heading, fontSize: 8, color: Colors.muted, letterSpacing: 1.5 },
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
