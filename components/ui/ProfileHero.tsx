import { Feather } from "@expo/vector-icons";
import React, { type ReactNode } from "react";
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
  sportLabel,
  elo,
  eloDelta,
  friend = false,
  onOpenQr,
  compact = false,
  actions,
}: {
  playerId: string;
  name: string;
  headline?: string | null;
  username?: string | null;
  initials?: string;
  memberSince?: string | null;
  courtLabel?: string | null;
  sportLabel?: string | null;
  elo: number;
  eloDelta?: number | null;
  friend?: boolean;
  onOpenQr: () => void;
  compact?: boolean;
  actions?: ReactNode;
}) {
  if (compact) {
    const handle = profileHandle(username, name);
    const locationLine = courtLabel
      ? `${sportLabel ? `${sportLabel} · ` : ""}${courtLabel}`
      : `@${handle}`;

    return (
      <View style={styles.compactHero}>
        <Pressable
          accessibilityHint="Shows a scannable player code"
          accessibilityLabel={`Open ${name}'s player QR code`}
          accessibilityRole="button"
          hitSlop={6}
          onPress={onOpenQr}
          style={({ pressed }) => [
            styles.compactAvatarAction,
            pressed && styles.compactAvatarPressed,
          ]}
        >
          <PlayerAvatar
            friend={friend}
            initials={initials}
            name={name}
            playerId={playerId}
            size={72}
            style={styles.compactAvatar}
          />
        </Pressable>
        <View style={styles.compactIdentity}>
          <Text
            adjustsFontSizeToFit
            minimumFontScale={0.82}
            numberOfLines={1}
            style={styles.compactName}
          >
            {headline || name}
          </Text>
          <View style={styles.compactMeta}>
            <Text numberOfLines={1} style={styles.compactHandle}>
              {locationLine}
            </Text>
          </View>
        </View>
        <View style={styles.compactActions}>
          {actions || (
            <View accessibilityLabel={`${elo} ELO`} style={styles.compactElo}>
              <Text style={styles.compactEloLabel}>ELO</Text>
              <Text
                adjustsFontSizeToFit
                minimumFontScale={0.82}
                numberOfLines={1}
                style={styles.compactEloValue}
              >
                {elo}
              </Text>
              {eloDelta != null ? (
                <Text
                  style={[
                    styles.compactEloDelta,
                    eloDelta < 0 && styles.compactEloDeltaNegative,
                  ]}
                >
                  {eloDelta > 0 ? "▲ " : "▼ "}
                  {Math.abs(eloDelta)}
                </Text>
              ) : null}
            </View>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.hero}>
      <Pressable
        accessibilityHint="Shows a scannable player code"
        accessibilityLabel={`Open ${name}'s player QR code`}
        accessibilityRole="button"
        onPress={onOpenQr}
        style={styles.avatarColumn}
      >
        <PlayerAvatar
          accent
          friend={friend}
          initials={initials}
          name={name}
          playerId={playerId}
          size={72}
        />
        <View style={styles.qrHint}>
          <Feather color={Colors.accent} name="grid" size={9} />
          <Text style={styles.qrHintText}>TAP FOR QR</Text>
        </View>
      </Pressable>

      <View style={styles.identity}>
        <View style={styles.headlineRow}>
          <Text
            adjustsFontSizeToFit
            minimumFontScale={0.78}
            numberOfLines={2}
            style={styles.name}
          >
            {headline || name}
          </Text>
          <EloStat delta={eloDelta} hero value={elo} />
        </View>
        {username ? (
          <Text numberOfLines={1} style={styles.username}>
            @{username}
          </Text>
        ) : null}
        {memberSince ? (
          <Text style={styles.member}>MEMBER SINCE {memberSince}</Text>
        ) : null}
        {courtLabel ? (
          <View style={styles.courtLabel}>
            <Feather color={Colors.textSecondary} name="map-pin" size={10} />
            <Text numberOfLines={1} style={styles.courtText}>
              {courtLabel}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function profileHandle(
  username: string | null | undefined,
  name: string,
): string {
  const raw = (username || name).trim().replace(/^@/, "").split("@")[0];
  const withoutGeneratedSuffix = raw.replace(/_[a-f0-9]{12,}$/i, "");
  const fallback = name.trim().split(/\s+/)[0] || "local";
  return (
    (withoutGeneratedSuffix || fallback)
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, "") || "local"
  );
}

const styles = StyleSheet.create({
  compactHero: {
    minHeight: 116,
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    columnGap: Space.xl,
    backgroundColor: Colors.background,
  },
  compactAvatarAction: {
    borderRadius: 15,
  },
  compactAvatarPressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
  compactAvatar: {
    borderColor: Colors.accentBorderStrong,
    backgroundColor: Colors.surfaceHigh,
  },
  compactIdentity: {
    flex: 1,
    minWidth: 0,
    justifyContent: "flex-start",
    alignSelf: "stretch",
    paddingTop: 20,
  },
  compactName: {
    minWidth: 0,
    flexShrink: 1,
    ...TextStyles.title,
    fontSize: 24,
    lineHeight: 28,
    color: Colors.text,
    letterSpacing: 0.45,
    textTransform: "uppercase",
  },
  compactMeta: {
    minWidth: 0,
    marginTop: 5,
    flexDirection: "row",
    alignItems: "center",
  },
  compactHandle: {
    minWidth: 0,
    flexShrink: 1,
    fontFamily: Typography.bodyMedium,
    fontSize: 11,
    lineHeight: 13,
    color: Colors.muted,
    letterSpacing: 0.5,
  },
  compactActions: {
    flexShrink: 0,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  compactElo: { minWidth: 72, alignItems: "flex-end" },
  compactEloLabel: {
    marginRight: 2,
    marginBottom: 1,
    fontFamily: Typography.bodyMedium,
    fontSize: 11,
    lineHeight: 13,
    color: Colors.muted,
    letterSpacing: 2,
  },
  compactEloValue: {
    fontFamily: Typography.headingBold,
    fontSize: 36,
    lineHeight: 40,
    color: Colors.text,
    textAlign: "right",
  },
  compactEloDelta: {
    marginTop: 1,
    ...TextStyles.labelSmall,
    color: Colors.accent,
    letterSpacing: 0.4,
  },
  compactEloDeltaNegative: { color: Colors.loss },
  hero: {
    minHeight: 152,
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  avatarColumn: { alignItems: "center" },
  qrHint: { marginTop: 6, flexDirection: "row", alignItems: "center", gap: 4 },
  qrHintText: {
    fontFamily: Typography.bodyBold,
    fontSize: 7,
    color: Colors.accent,
    letterSpacing: 1,
  },
  identity: { flex: 1, minWidth: 0, justifyContent: "center" },
  headlineRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Space.md,
  },
  name: {
    flex: 1,
    minWidth: 0,
    ...TextStyles.title,
    lineHeight: 25,
    color: Colors.text,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  username: {
    alignSelf: "stretch",
    marginTop: 2,
    fontFamily: Typography.body,
    fontSize: 11,
    color: Colors.textSecondary,
  },
  member: {
    marginTop: 5,
    ...TextStyles.caption,
    color: Colors.muted,
    letterSpacing: 0.4,
  },
  courtLabel: {
    alignSelf: "flex-start",
    maxWidth: "100%",
    marginTop: Space.sm,
    paddingHorizontal: 8,
    minHeight: 28,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderLight,
    borderRadius: 14,
    backgroundColor: Colors.surfaceHigh,
  },
  courtText: {
    flexShrink: 1,
    ...TextStyles.labelSmall,
    color: Colors.textSecondary,
    letterSpacing: 0,
  },
});
