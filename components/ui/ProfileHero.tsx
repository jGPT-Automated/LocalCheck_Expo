import { Feather } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { PlayerAvatar } from "@/components/PlayerAvatar";
import { Colors } from "@/constants/colors";
import { Space } from "@/constants/layout";
import { TextStyles, Typography } from "@/constants/typography";

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
        <View style={styles.headlineRow}>
          <Text numberOfLines={1} style={styles.name}>{headline || name}</Text>
          <EloStat delta={eloDelta} hero value={elo} />
        </View>
        {username ? <Text numberOfLines={1} style={styles.username}>@{username}</Text> : null}
        {memberSince ? <Text style={styles.member}>MEMBER SINCE {memberSince}</Text> : null}
        {courtLabel ? (
          <View style={styles.courtLabel}>
            <Feather color={Colors.textSecondary} name="map-pin" size={10} />
            <Text numberOfLines={1} style={styles.courtText}>{courtLabel}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { minHeight: 144, paddingHorizontal: 20, paddingVertical: 20, flexDirection: "row", alignItems: "center", gap: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
  avatarColumn: { alignItems: "center" },
  qrHint: { marginTop: 6, flexDirection: "row", alignItems: "center", gap: 4 },
  qrHintText: { fontFamily: Typography.bodyBold, fontSize: 7, color: Colors.accent, letterSpacing: 1 },
  identity: { flex: 1, minWidth: 0, justifyContent: "center" },
  headlineRow: { minHeight: 54, flexDirection: "row", alignItems: "center", gap: Space.md },
  name: { flex: 1, ...TextStyles.display, color: Colors.text, letterSpacing: 0.4, textTransform: "uppercase" },
  username: { marginTop: 2, fontFamily: Typography.body, fontSize: 11, color: Colors.textSecondary },
  member: { marginTop: 5, ...TextStyles.caption, color: Colors.muted, letterSpacing: 0.4 },
  courtLabel: { alignSelf: "flex-start", maxWidth: "100%", marginTop: Space.sm, paddingHorizontal: 8, minHeight: 28, flexDirection: "row", alignItems: "center", gap: 5, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.borderLight, borderRadius: 14, backgroundColor: Colors.surfaceHigh },
  courtText: { flexShrink: 1, ...TextStyles.labelSmall, color: Colors.textSecondary, letterSpacing: 0 },
});
