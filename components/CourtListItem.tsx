import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Colors, Radius } from "@/constants/colors";
import type { Court } from "@/constants/data";
import { Layout, Space } from "@/constants/layout";
import { Typography } from "@/constants/typography";

import { LivePulse } from "./LivePulse";
import { SportEmblem } from "./ui/SportEmblem";

interface CourtListItemProps {
  court: Court;
  onPress?: (court: Court) => void;
  isCheckedIn?: boolean;
  isLocalCourt?: boolean;
  featured?: boolean;
  stats?: Array<{ label: string; value: string | number; live?: boolean }>;
}

/**
 * Canonical Explore court card. Actions intentionally live in the court sheet,
 * so cards stay concise and every court opens the same progressive drawer.
 */
export function CourtListItem({
  court,
  onPress,
  isCheckedIn,
  isLocalCourt,
  featured,
  stats,
}: CourtListItemProps) {
  const cardStats = stats ?? [
    { label: "ACTIVE NOW", value: court.activeCount ?? 0, live: (court.activeCount ?? 0) > 0 },
    { label: "LOCALS", value: court.localCount ?? 0 },
  ];
  const sportMeta = court.sport === "PICKLEBALL"
    ? Colors.pickleballMeta
    : Colors.basketballMeta;

  return (
    <Pressable
      accessibilityLabel={onPress ? `Open ${court.name}` : undefined}
      accessibilityRole={onPress ? "button" : undefined}
      disabled={!onPress}
      onPress={onPress ? () => onPress(court) : undefined}
      style={({ pressed }) => [
        styles.container,
        featured && styles.featured,
        pressed && styles.pressed,
      ]}
      testID={`court-${court.id}`}
    >
      <LinearGradient
        colors={["#202027", "#211E20"]}
        end={{ x: 1, y: 0.75 }}
        start={{ x: 0, y: 0 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.topline}>
        <View style={styles.sportMeta}>
          <SportEmblem glow={false} size={15} sport={court.sport} />
          <Text style={[styles.sportText, { color: sportMeta }]}>{court.sport}</Text>
        </View>
      </View>

      <Text numberOfLines={1} style={styles.name}>
        {court.shortName || court.name}
      </Text>
      <Text numberOfLines={1} style={styles.meta}>
        {court.city || court.market || court.neighborhood || "Court details"}
      </Text>

      <View style={styles.separator} />

      <View style={styles.bottomRow}>
        <View style={styles.statsRow}>
          {cardStats.map((stat, index) => (
            <React.Fragment key={stat.label}>
              {index > 0 ? <View style={styles.statDivider} /> : null}
              <View style={styles.statBlock}>
                <View style={styles.statValueRow}>
                  {stat.live ? <LivePulse color={Colors.accent} size={6} /> : null}
                  <Text style={[styles.statValue, stat.live && styles.liveValue]}>{stat.value}</Text>
                </View>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </View>
            </React.Fragment>
          ))}
          {isCheckedIn ? (
            <View style={styles.hereBadge}>
              <Feather color={Colors.black} name="check" size={11} />
              <Text style={styles.hereText}>HERE</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.arrowButton}>
          <Feather color={Colors.textSecondary} name="arrow-right" size={21} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 164,
    marginHorizontal: Layout.screenGutter,
    marginVertical: 6,
    paddingHorizontal: 18,
    paddingVertical: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(242,242,246,0.09)",
    borderRadius: Radius.card,
    shadowColor: Colors.black,
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 9 },
  },
  featured: { minHeight: 164 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.992 }] },
  topline: { minHeight: 20, flexDirection: "row", alignItems: "center" },
  sportMeta: { flexDirection: "row", alignItems: "center", gap: 5 },
  sportText: { fontFamily: Typography.bodyBold, fontSize: 9, letterSpacing: 1.5 },
  name: { marginTop: 14, fontFamily: Typography.headingBold, fontSize: 21, lineHeight: 24, color: Colors.text, textTransform: "uppercase" },
  meta: { marginTop: 4, fontFamily: Typography.body, fontSize: 12, lineHeight: 16, color: Colors.muted },
  separator: { marginTop: 14, height: StyleSheet.hairlineWidth, backgroundColor: Colors.border },
  bottomRow: { marginTop: "auto", paddingTop: 12, flexDirection: "row", alignItems: "center" },
  statsRow: { minWidth: 0, maxWidth: "68%", flex: 1, flexDirection: "row", alignItems: "center" },
  statBlock: { flex: 1, minWidth: 0, alignItems: "center", justifyContent: "center" },
  statValueRow: { minHeight: 19, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
  statValue: { fontFamily: Typography.headingBold, fontSize: 24, lineHeight: 27, color: Colors.text },
  liveValue: { color: Colors.accent },
  statLabel: { marginTop: 2, fontFamily: Typography.bodyMedium, fontSize: 11, lineHeight: 13, color: Colors.muted, letterSpacing: 1.1, textAlign: "center" },
  statDivider: { width: StyleSheet.hairlineWidth, height: 29, marginHorizontal: 5, backgroundColor: Colors.borderLight },
  arrowButton: { marginLeft: "auto", width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: Colors.borderLight, alignItems: "center", justifyContent: "center" },
  hereBadge: { marginLeft: Space.sm, paddingHorizontal: 7, paddingVertical: 4, flexDirection: "row", alignItems: "center", gap: 3, borderRadius: Radius.sm, backgroundColor: Colors.accent },
  hereText: { fontFamily: Typography.bodyBold, fontSize: 7, color: Colors.black, letterSpacing: 0.9 },
});
