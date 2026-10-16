import React from "react";
import {
  AccessibilityInfo,
  Animated,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";

import { Colors, Radius } from "@/constants/colors";
import type { Court } from "@/constants/data";
import { Typography } from "@/constants/typography";
import { mapView, projectToView, type LatLng, type MapViewport } from "@/lib/courtPickerMapModel";

const TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? "";

function staticUrl(view: MapViewport, width: number, height: number): string | null {
  if (!TOKEN || width <= 0 || height <= 0) return null;
  const w = Math.min(1280, Math.round(width));
  const h = Math.min(1280, Math.round(height));
  const { lat, lng } = view.center;
  return `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/${lng.toFixed(5)},${lat.toFixed(5)},${view.zoom.toFixed(2)},0/${w}x${h}@2x?access_token=${TOKEN}`;
}

/**
 * Onboarding's court picker map. A Mapbox static map (dark) fitted to you and
 * the courts near you, with a tappable pin for each court placed by its real
 * coordinates. Works the same in Expo Go, on the web and in the App Store
 * build, and without a token it still draws the pins on a plain grid. When
 * the view changes (location found, city searched) it zooms in: the new map
 * fades in from slightly larger.
 */
export function CourtPickerMap({
  courts,
  you,
  selectedId,
  onSelect,
  children,
}: {
  courts: Court[];
  you: LatLng | null;
  selectedId: string | null;
  onSelect: (court: Court) => void;
  /** Overlay (the location ask) laid over the map. */
  children?: React.ReactNode;
}) {
  const [size, setSize] = React.useState({ width: 0, height: 0 });
  const points = React.useMemo(
    () => [
      ...(you ? [you] : []),
      ...courts.map((court) => ({ lat: court.latitude, lng: court.longitude })),
    ],
    [courts, you],
  );
  const view = mapView(points, size.width, size.height);
  const url = staticUrl(view, size.width, size.height);

  const reveal = React.useRef(new Animated.Value(1)).current;
  const viewKey = `${view.center.lat.toFixed(4)}:${view.center.lng.toFixed(4)}:${view.zoom.toFixed(2)}`;
  React.useEffect(() => {
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled || reduce) return;
      reveal.setValue(0);
      Animated.timing(reveal, { toValue: 1, duration: 520, useNativeDriver: true }).start();
    });
    return () => { cancelled = true; };
  }, [viewKey, reveal]);

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (Math.abs(width - size.width) > 1 || Math.abs(height - size.height) > 1) setSize({ width, height });
  };

  const youPoint = you ? projectToView(you, view, size.width, size.height) : null;

  return (
    <View onLayout={onLayout} style={styles.wrap}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={styles.grid} />
      </View>
      <Animated.View
        pointerEvents="box-none"
        style={[
          StyleSheet.absoluteFill,
          {
            opacity: reveal,
            transform: [{ scale: reveal.interpolate({ inputRange: [0, 1], outputRange: [1.12, 1] }) }],
          },
        ]}
      >
        {url ? <Image resizeMode="cover" source={{ uri: url }} style={StyleSheet.absoluteFill} /> : null}
        {youPoint ? (
          <View pointerEvents="none" style={[styles.you, { left: youPoint.x - 9, top: youPoint.y - 9 }]}>
            <View style={styles.youDot} />
          </View>
        ) : null}
        {courts.map((court) => {
          const point = projectToView({ lat: court.latitude, lng: court.longitude }, view, size.width, size.height);
          if (point.x < -20 || point.y < -20 || point.x > size.width + 20 || point.y > size.height + 20) return null;
          const selected = court.id === selectedId;
          return (
            <Pressable
              accessibilityLabel={`Pick ${court.name}`}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              hitSlop={6}
              key={court.id}
              onPress={() => onSelect(court)}
              style={[styles.pinHit, { left: point.x - 22, top: point.y - 22 }, selected && styles.pinHitSelected]}
            >
              <View style={[styles.pin, selected && styles.pinSelected]} />
              {selected ? (
                <View style={styles.pinLabel}>
                  <Text numberOfLines={1} style={styles.pinLabelText}>{court.shortName || court.name}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </Animated.View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    minHeight: 200,
    overflow: "hidden",
    borderRadius: Radius.panel,
    borderWidth: 1,
    borderColor: Colors.hairlineCard,
    backgroundColor: Colors.surface,
  },
  // Same faint map texture the court page uses before tiles load.
  grid: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.surface,
    borderWidth: 0,
  },
  you: {
    position: "absolute",
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(242,242,246,0.18)",
  },
  youDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: Colors.background, backgroundColor: Colors.text },
  pinHit: { position: "absolute", width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  pinHitSelected: { zIndex: 2 },
  pin: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.surface,
    backgroundColor: Colors.inkSoft,
  },
  pinSelected: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.accent,
    shadowColor: Colors.accent,
    shadowOpacity: 0.7,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  pinLabel: {
    position: "absolute",
    top: 36,
    maxWidth: 160,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(242,242,246,0.13)",
    backgroundColor: "rgba(19,19,23,0.92)",
  },
  pinLabelText: { fontFamily: Typography.bodyBold, fontSize: 9, letterSpacing: 1, textTransform: "uppercase", color: Colors.text },
});
