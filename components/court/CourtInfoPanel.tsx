// Court page › Info (Claude Design handoff): map with Directions, three
// numbers, then the details Jesse asked for (Oct 14): Courts, Lights, Access.
// A detail the database doesn't have yet shows a dash, never a guess.
import { Feather } from "@expo/vector-icons";
import React from "react";
import { AccessibilityInfo, Animated, Pressable, StyleSheet, Text, View } from "react-native";

import { Colors } from "@/constants/colors";
import type { Court } from "@/constants/data";
import { Typography } from "@/constants/typography";
import { AUTO_CHECK_IN_RADIUS_M } from "@/lib/autoCheckInModel";
import { geofenceOverlay } from "@/lib/geofenceShape";

function accessLabel(value?: string): string {
  if (!value) return "—";
  if (value.startsWith("public")) return "Public";
  if (value.startsWith("private") || value.includes("member")) return "Members";
  return value.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

export function CourtInfoPanel({
  court,
  hoursLabel,
  averageSession,
  locals,
  onDirections,
}: {
  court: Court;
  hoursLabel: string;
  averageSession: string;
  locals: number;
  onDirections: () => void;
}) {
  const token = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
  const pin = court.sport === "PICKLEBALL" ? "9ccfbe" : "d8b58d";
  const validCoordinates = Number.isFinite(court.longitude) && Number.isFinite(court.latitude);
  // Tilted (bearing 20, pitch 55) with the auto check-in circle drawn in
  // orange around the court, a soft glow under a crisp line.
  const ring = validCoordinates
    ? geofenceOverlay(court.latitude, court.longitude, AUTO_CHECK_IN_RADIUS_M, Colors.accent)
    : "";
  const uri = token && validCoordinates
    ? `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/${ring},pin-s+${pin}(${court.longitude},${court.latitude})/${court.longitude},${court.latitude},15.4,20,55/800x300@2x?access_token=${token}`
    : null;
  // The map eases in from slightly larger, like the camera settling.
  const settle = React.useRef(new Animated.Value(0)).current;
  const onMapLoad = () => {
    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (reduce) settle.setValue(1);
      else Animated.timing(settle, { toValue: 1, duration: 700, useNativeDriver: true }).start();
    });
  };
  const details: Array<[string, string]> = [
    ["Courts", court.courtCount != null ? String(court.courtCount) : "—"],
    ["Lights", court.lights == null ? "—" : court.lights ? "Yes" : "No"],
    ["Access", accessLabel(court.access)],
  ];

  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityHint="Opens the court in your maps app"
        accessibilityLabel={`Directions to ${court.name}`}
        accessibilityRole="button"
        onPress={onDirections}
        style={({ pressed }) => [styles.map, pressed && styles.pressed]}
      >
        {uri ? (
          <Animated.Image
            onLoad={onMapLoad}
            resizeMode="cover"
            source={{ uri }}
            style={[
              StyleSheet.absoluteFill,
              {
                opacity: settle,
                transform: [{ scale: settle.interpolate({ inputRange: [0, 1], outputRange: [1.18, 1] }) }],
              },
            ]}
          />
        ) : null}
        <View style={styles.mapScrim} />
        <Text numberOfLines={1} style={styles.address}>{court.address || court.name}</Text>
        <View style={styles.directions}>
          <Text style={styles.directionsText}>Directions</Text>
        </View>
      </Pressable>

      <View style={styles.stats}>
        {[
          [hoursLabel, "Court hours · wk"],
          [averageSession, "Avg session"],
          [String(locals), "Locals"],
        ].map(([value, label], index) => (
          <View key={label} style={[styles.stat, index > 0 && styles.statDivider]}>
            <Text style={styles.statValue}>{value}</Text>
            <Text style={styles.statLabel}>{label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.details}>
        {details.map(([label, value], index) => (
          <View key={label} style={[styles.detailRow, index > 0 && styles.detailDivider]}>
            <Text style={styles.detailLabel}>{label}</Text>
            <Text style={styles.detailValue}>{value}</Text>
          </View>
        ))}
      </View>

      {court.status === "confirmed" ? (
        <View style={styles.verified}>
          <Feather color={Colors.textSecondary} name="check" size={12} />
          <Text style={styles.verifiedText}>Verified</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 20, paddingTop: 16, gap: 14 },
  map: { height: 150, borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: Colors.hairlineCard, backgroundColor: Colors.surface },
  mapScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.22)" },
  address: { position: "absolute", left: 12, right: 120, bottom: 16, fontFamily: Typography.bodySemiBold, fontSize: 11, color: Colors.text },
  directions: {
    position: "absolute",
    right: 10,
    bottom: 8,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 999,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(242,242,246,0.13)",
    backgroundColor: "rgba(19,19,23,0.9)",
  },
  directionsText: { fontFamily: Typography.bodyBold, fontSize: 9.5, letterSpacing: 1.1, textTransform: "uppercase", color: Colors.text },
  stats: { flexDirection: "row", borderRadius: 13, borderWidth: 1, borderColor: Colors.hairlineCard, backgroundColor: Colors.panel },
  stat: { flex: 1, padding: 12, gap: 4, alignItems: "center" },
  statDivider: { borderLeftWidth: 1, borderLeftColor: Colors.hairline },
  statValue: { fontFamily: Typography.headingSemiBold, fontSize: 21, lineHeight: 23, color: Colors.text },
  statLabel: { fontFamily: Typography.bodyBold, fontSize: 7.5, letterSpacing: 0.9, textTransform: "uppercase", color: Colors.textSecondary },
  details: { borderRadius: 16, borderWidth: 1, borderColor: Colors.hairlineCard, backgroundColor: Colors.panel, overflow: "hidden" },
  detailRow: { minHeight: 50, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  detailDivider: { borderTopWidth: 1, borderTopColor: Colors.hairline },
  detailLabel: { fontFamily: Typography.bodyBold, fontSize: 9, letterSpacing: 1.1, textTransform: "uppercase", color: Colors.muted },
  detailValue: { fontFamily: Typography.bodyMedium, fontSize: 12.5, color: Colors.text, textAlign: "right" },
  verified: { flexDirection: "row", alignItems: "center", gap: 6 },
  verifiedText: { fontFamily: Typography.bodyMedium, fontSize: 10.5, color: Colors.textSecondary },
  pressed: { opacity: 0.8 },
});
