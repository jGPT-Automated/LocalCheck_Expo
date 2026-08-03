import { Feather } from "@expo/vector-icons";
import React from "react";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";

import { PlayerAvatar } from "@/components/PlayerAvatar";
import { Colors, Radius } from "@/constants/colors";
import { Player } from "@/constants/data";
import { Spacing } from "@/constants/layout";
import { Typography, TypeScale } from "@/constants/typography";

export type ProfileStat = {
  key: string;
  label: string;
  value: string | number;
};

export function ProfileScaffold({
  header,
  player,
  username,
  courtName,
  supportingText,
  stats,
  presentation,
  bottomInset,
  children,
  footer,
}: {
  header: React.ReactNode;
  player: Player;
  username?: string;
  courtName?: string;
  supportingText?: string;
  stats: readonly ProfileStat[];
  presentation: "tab" | "detail";
  bottomInset: number;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const bottomPadding = Platform.OS === "web"
    ? 92
    : bottomInset + (presentation === "tab" ? 104 : 40);

  return (
    <View style={styles.screen}>
      {header}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomPadding }}
      >
        <View style={styles.identity}>
          <View style={styles.avatarFrame}>
            <PlayerAvatar initials={player.avatar || "LC"} size={56} />
          </View>
          <View style={styles.identityCopy}>
            <Text style={styles.displayName} numberOfLines={2}>{player.name}</Text>
            {username ? <Text style={styles.username}>@{username}</Text> : null}
            <View style={styles.metaRow}>
              <View style={styles.metaLabel}>
                <Text style={styles.metaText}>{player.tier}</Text>
              </View>
              {courtName ? (
                <View style={styles.metaLabel}>
                  <Feather name="map-pin" size={10} color={Colors.textSecondary} />
                  <Text style={styles.metaText} numberOfLines={1}>{courtName}</Text>
                </View>
              ) : supportingText ? (
                <Text style={styles.supportingText} numberOfLines={1}>{supportingText}</Text>
              ) : null}
            </View>
          </View>
          <View style={styles.eloBlock}>
            <Text style={styles.eloLabel}>ELO</Text>
            <Text style={styles.eloValue}>{player.elo}</Text>
          </View>
        </View>

        <View style={styles.stats}>
          {stats.map((stat, index) => (
            <View key={stat.key} style={[styles.stat, index > 0 && styles.statBorder]}>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel} numberOfLines={1}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {children}
        {footer}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  identity: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.screen,
    paddingVertical: 14,
    gap: Spacing.sm,
  },
  avatarFrame: {
    padding: 2,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.accent,
  },
  identityCopy: { flex: 1, minWidth: 0 },
  displayName: {
    fontFamily: Typography.headingRegular,
    ...TypeScale.titleMedium,
    color: Colors.text,
    textTransform: "uppercase",
  },
  username: {
    fontFamily: Typography.body,
    ...TypeScale.supporting,
    color: Colors.textSecondary,
  },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  metaLabel: {
    minHeight: 22,
    maxWidth: 142,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surfaceHigh,
  },
  metaText: {
    flexShrink: 1,
    fontFamily: Typography.bodyBold,
    ...TypeScale.label,
    color: Colors.textSecondary,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  supportingText: {
    flexShrink: 1,
    fontFamily: Typography.bodyMedium,
    ...TypeScale.label,
    color: Colors.muted,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  eloBlock: { alignItems: "flex-end", alignSelf: "flex-start", paddingTop: 2 },
  eloLabel: {
    fontFamily: Typography.bodyBold,
    ...TypeScale.label,
    color: Colors.muted,
    letterSpacing: 1,
  },
  eloValue: {
    fontFamily: Typography.headingRegular,
    ...TypeScale.metricLarge,
    color: Colors.text,
    fontVariant: ["tabular-nums"],
  },
  stats: {
    flexDirection: "row",
    marginHorizontal: Spacing.screen,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    overflow: "hidden",
  },
  stat: { flex: 1, minHeight: 58, alignItems: "center", justifyContent: "center", paddingHorizontal: 3 },
  statBorder: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: Colors.border },
  statValue: {
    fontFamily: Typography.headingRegular,
    ...TypeScale.metric,
    color: Colors.text,
    fontVariant: ["tabular-nums"],
  },
  statLabel: {
    fontFamily: Typography.bodyBold,
    ...TypeScale.label,
    color: Colors.muted,
    letterSpacing: 0.5,
    marginTop: 2,
    textTransform: "uppercase",
  },
});
