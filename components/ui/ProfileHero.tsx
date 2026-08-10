import { Feather } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { PlayerAvatar } from "@/components/PlayerAvatar";
import { Colors } from "@/constants/colors";
import { Space } from "@/constants/layout";
import { Typography } from "@/constants/typography";

import { EloStat } from "./EloStat";

export function ProfileHero({
  playerId,
  name,
  headline,
  username,
  initials,
  memberSince,
  courtLabel,
  elo,
  eloDelta,
  friend = false,
  onOpenQr,
}: {
  playerId: string;
  name: string;
  headline?: string | null;
  username?: string | null;
  initials?: string;
  memberSince?: string | null;
  courtLabel?: string | null;
  elo: number;
  eloDelta?: number | null;
  friend?: boolean;
  onOpenQr: () => void;
}) {
  return (
    <View style={styles.hero}>
      <Pressable
        accessibilityHint="Shows a scannable player code"
        accessibilityLabel={`Open ${name}'s player QR code`}
        accessibilityRole="button"
        onPress={onOpenQr}
        style={styles.avatarColumn}
      >
        <PlayerAvatar friend={friend} initials={initials} name={name} playerId={playerId} size={72} />
        <View style={styles.qrHint}>
          <Feather color={Colors.accent} name="grid" size={9} />
          <Text style={styles.qrHintText}>TAP FOR QR</Text>
        </View>
      </Pressable>

      <View style={styles.identity}>
        <Text numberOfLines={1} style={styles.name}>{headline || name}</Text>
        {username ? <Text numberOfLines={1} style={styles.username}>@{username}</Text> : null}
        {memberSince ? <Text style={styles.member}>MEMBER SINCE {memberSince}</Text> : null}
        {courtLabel ? (
          <View style={styles.courtLabel}>
            <Feather color={Colors.textSecondary} name="map-pin" size={10} />
            <Text numberOfLines={1} style={styles.courtText}>{courtLabel}</Text>
          </View>
        ) : null}
      </View>

      <EloStat delta={eloDelta} hero value={elo} />
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { minHeight: 144, paddingHorizontal: 20, paddingVertical: 22, flexDirection: "row", alignItems: "center", gap: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
  avatarColumn: { alignItems: "center" },
  qrHint: { marginTop: 6, flexDirection: "row", alignItems: "center", gap: 4 },
  qrHintText: { fontFamily: Typography.bodyBold, fontSize: 7, color: Colors.accent, letterSpacing: 1 },
  identity: { flex: 1, minWidth: 0 },
  name: { fontFamily: Typography.headingBold, fontSize: 23, lineHeight: 27, color: Colors.text, letterSpacing: 0.4, textTransform: "uppercase" },
  username: { marginTop: 2, fontFamily: Typography.body, fontSize: 11, color: Colors.textSecondary },
  member: { marginTop: 5, fontFamily: Typography.bodyMedium, fontSize: 7, color: Colors.muted, letterSpacing: 1.15 },
  courtLabel: { maxWidth: 148, marginTop: Space.sm, paddingVertical: 3, flexDirection: "row", alignItems: "center", gap: 5 },
  courtText: { flexShrink: 1, fontFamily: Typography.bodyMedium, fontSize: 9, color: Colors.textSecondary, letterSpacing: 0.35 },
});
