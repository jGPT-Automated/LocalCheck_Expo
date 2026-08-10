import { Feather } from "@expo/vector-icons";
import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { Colors, Radius } from "@/constants/colors";
import type { Court } from "@/constants/data";
import { Typography } from "@/constants/typography";

export function CourtMapPreview({ court, onPress }: { court: Court; onPress: () => void }) {
  const token = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
  const validCoordinates = Number.isFinite(court.longitude) && Number.isFinite(court.latitude);
  const uri = token && validCoordinates
    ? `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/pin-s+ff5500(${court.longitude},${court.latitude})/${court.longitude},${court.latitude},15,0/800x320@2x?access_token=${token}`
    : null;

  return (
    <Pressable
      accessibilityHint="Opens the court in your maps app"
      accessibilityLabel={`Open ${court.name} location`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.wrap, pressed && styles.pressed]}
    >
      {uri ? <Image resizeMode="cover" source={{ uri }} style={StyleSheet.absoluteFill} /> : <View style={styles.fallback} />}
      <View style={styles.scrim} />
      <View style={styles.caption}>
        <View>
          <Text style={styles.label}>COURT MAP</Text>
          <Text numberOfLines={1} style={styles.address}>{court.address || court.name}</Text>
        </View>
        <View style={styles.openIcon}><Feather color={Colors.text} name="external-link" size={14} /></View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { height: 156, marginTop: 16, overflow: "hidden", borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  fallback: { ...StyleSheet.absoluteFillObject, backgroundColor: Colors.surfaceHigh },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.26)" },
  caption: { position: "absolute", left: 12, right: 12, bottom: 11, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12 },
  label: { fontFamily: Typography.bodyBold, fontSize: 8, color: Colors.accent, letterSpacing: 1.2 },
  address: { maxWidth: 270, marginTop: 3, fontFamily: Typography.bodySemiBold, fontSize: 11, color: Colors.text },
  openIcon: { width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: 17, backgroundColor: "rgba(13,13,16,0.82)" },
  pressed: { opacity: 0.8 },
});
