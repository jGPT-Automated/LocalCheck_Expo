import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { Colors } from "@/constants/colors";
import { Space } from "@/constants/layout";
import { TextStyles } from "@/constants/typography";

import { bannerText, type GameBannerKind } from "./gameCardModel";

type BannerTone = { bg: string; border: string; text: string };

/**
 * One colour per meaning, the same in the inbox, the game drawer and the
 * Final Score page:
 *  - action: it is the viewer's move (accent, filled)
 *  - waiting: pending someone else (neutral)
 *  - final: settled (green)
 *  - held: disputed, paused (accent outline, no fill)
 *  - voided: gone (muted)
 */
const TONES: Record<GameBannerKind, BannerTone> = {
  action: { bg: Colors.accentDim, border: Colors.accentBorder, text: Colors.accent },
  waiting: { bg: Colors.surfaceHigh, border: Colors.borderLight, text: Colors.textSecondary },
  final: { bg: Colors.winDim, border: Colors.win, text: Colors.win },
  held: { bg: Colors.surface, border: Colors.accentBorder, text: Colors.accent },
  voided: { bg: Colors.surface, border: Colors.border, text: Colors.muted },
};

/**
 * The state of a game, as a thin band across the top edge of its card. The
 * card clips it to its rounded corners. `trailing` is quiet text after the
 * state ("FINAL · SEP 6"); it is the first thing cut when the line is long.
 */
export function GameStateBanner({
  kind,
  label,
  trailing,
}: {
  kind: GameBannerKind;
  label: string;
  trailing?: string;
}) {
  const tone = TONES[kind];
  return (
    <View
      accessibilityLabel={bannerText(label, trailing)}
      accessibilityRole="header"
      style={[styles.banner, { backgroundColor: tone.bg, borderBottomColor: tone.border }]}
    >
      <Text numberOfLines={1} style={[styles.text, { color: tone.text }]}>
        {label}
        {trailing ? <Text style={styles.trailing}>{` · ${trailing}`}</Text> : null}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    paddingVertical: Space.sm - 1,
    paddingHorizontal: Space.lg,
    borderBottomWidth: 1,
    alignItems: "center",
  },
  text: { ...TextStyles.labelSmall, letterSpacing: 1.6 },
  trailing: { color: Colors.textSecondary },
});
