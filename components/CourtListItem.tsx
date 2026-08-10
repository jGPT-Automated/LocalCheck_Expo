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
  const sportTint = court.sport === "PICKLEBALL"
    ? Colors.pickleballTint
    : Colors.basketballTint;
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
        colors={[Colors.courtCardStart, Colors.courtCardEnd]}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={[sportTint, "transparent"]}
        end={{ x: 0.25, y: 0.8 }}
        start={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.topline}>
        <View style={styles.sportMeta}>
          <SportEmblem glow={false} size={15} sport={court.sport} />
          <Text style={[styles.sportText, { color: sportMeta }]}>{court.sport}</Text>
        </View>
        {isLocalCourt ? (
          <View accessibilityLabel="My local court" style={styles.localMark}>
            <Feather color={Colors.textSecondary} name="star" size={14} />
          </View>
        ) : null}
      </View>

      <Text numberOfLines={1} style={[styles.name, featured && styles.nameFeatured]}>
        {court.shortName || court.name}
      </Text>
      <Text numberOfLines={1} style={styles.meta}>
        {court.neighborhood || court.market || court.city || "Court details"}
      </Text>

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
        <View style={styles.openButton}>
          <Feather color={Colors.textSecondary} name="arrow-right" size={20} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 172,
    marginHorizontal: Layout.screenGutter,
    marginVertical: Space.sm,
    paddingHorizontal: Space.lg,
    paddingVertical: Space.md,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(242,242,246,0.09)",
    borderRadius: Radius.card,
    shadowColor: Colors.black,
    shadowOpacity: 0.13,
    shadowRadius: 19,
    shadowOffset: { width: 0, height: 14 },
  },
  featured: { minHeight: 184 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.992 }] },
  topline: { minHeight: 26, flexDirection: "row", alignItems: "center" },
  sportMeta: { flexDirection: "row", alignItems: "center", gap: 5 },
  sportText: { fontFamily: Typography.bodyBold, fontSize: 9, letterSpacing: 1.5 },
  localMark: { marginLeft: "auto", width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  name: { marginTop: Space.sm, fontFamily: Typography.headingBold, fontSize: 23, lineHeight: 27, color: Colors.text, textTransform: "uppercase" },
  nameFeatured: { fontSize: 27, lineHeight: 31 },
  meta: { marginTop: 2, fontFamily: Typography.body, fontSize: 11, color: Colors.muted },
  bottomRow: { marginTop: "auto", paddingTop: Space.md, flexDirection: "row", alignItems: "center", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.borderLight },
  statsRow: { minWidth: 0, flex: 1, flexDirection: "row", alignItems: "center" },
  statBlock: { minWidth: 78, alignItems: "center", justifyContent: "center" },
  statValueRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  statValue: { fontFamily: Typography.headingBold, fontSize: 24, lineHeight: 27, color: Colors.text },
  liveValue: { color: Colors.accent },
  statLabel: { marginTop: 1, fontFamily: Typography.bodyMedium, fontSize: 7, color: Colors.muted, letterSpacing: 1.1 },
  statDivider: { width: StyleSheet.hairlineWidth, height: 30, backgroundColor: Colors.borderLight },
  hereBadge: { marginLeft: Space.sm, paddingHorizontal: 7, paddingVertical: 5, flexDirection: "row", alignItems: "center", gap: 3, borderRadius: Radius.sm, backgroundColor: Colors.accent },
  hereText: { fontFamily: Typography.bodyBold, fontSize: 7, color: Colors.black, letterSpacing: 0.9 },
  openButton: { width: 46, height: 46, marginLeft: Space.md, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.borderLight, borderRadius: 23, backgroundColor: "rgba(30,30,38,0.78)" },
});
