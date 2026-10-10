import { Feather } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { BrutalistButton } from "@/components/BrutalistButton";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { Colors, Radius } from "@/constants/colors";
import { Space } from "@/constants/layout";
import { TextStyles } from "@/constants/typography";

/** Every inbox row's trailing grid: [primary 72] [gap 6] [32 slot]. */
const PRIMARY_WIDTH = 72;
const SLOT = 32;

/**
 * One inbox row for a person (challenges, friend requests): 44 tile, a name
 * line, one subtitle line, and a trailing action grid. The name is always its
 * own truncating line. The grid is the same for every row, so ACCEPT and LOG
 * SCORE share one size and the decline X and chevron share one column.
 */
export function InboxActionRow({
  player,
  title,
  subtitle,
  openLabel,
  onOpen,
  primary,
  decline,
  busy = false,
}: {
  player: { id: string; name: string; initials?: string };
  title: string;
  subtitle: string;
  openLabel: string;
  onOpen: () => void;
  /** The one thing the row asks of you (ACCEPT, LOG SCORE). */
  primary?: { label: string; onPress: () => void };
  /** Shows the 32x32 decline button in the slot; otherwise a chevron. */
  decline?: { label: string; onPress: () => void };
  busy?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityLabel={openLabel}
        accessibilityRole="button"
        onPress={onOpen}
        style={({ pressed }) => [styles.identity, pressed && styles.pressed]}
      >
        <PlayerAvatar initials={player.initials} name={player.name} playerId={player.id} size={44} />
        <View style={styles.copy}>
          <Text numberOfLines={1} style={styles.title}>
            {title}
          </Text>
          <Text numberOfLines={1} style={styles.subtitle}>
            {subtitle}
          </Text>
        </View>
      </Pressable>
      <View style={styles.actions}>
        {primary ? (
          <BrutalistButton
            disabled={busy}
            label={primary.label}
            onPress={primary.onPress}
            size="sm"
            style={styles.primary}
            variant="accent"
          />
        ) : null}
        {decline ? (
          <Pressable
            accessibilityLabel={decline.label}
            accessibilityRole="button"
            disabled={busy}
            hitSlop={6}
            onPress={decline.onPress}
            style={({ pressed }) => [styles.slot, styles.declineSlot, pressed && styles.pressed]}
          >
            <Feather color={Colors.muted} name="x" size={14} />
          </Pressable>
        ) : (
          <Pressable
            accessibilityElementsHidden
            hitSlop={6}
            importantForAccessibility="no-hide-descendants"
            onPress={onOpen}
            style={styles.slot}
          >
            <Feather color={Colors.muted} name="chevron-right" size={16} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: Space.sm,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  identity: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 10 },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  title: { ...TextStyles.listName, color: Colors.text },
  subtitle: { ...TextStyles.caption, color: Colors.muted },
  actions: { flexDirection: "row", alignItems: "center", gap: 6 },
  primary: { width: PRIMARY_WIDTH, height: SLOT, paddingVertical: 0, paddingHorizontal: 0 },
  slot: { width: SLOT, height: SLOT, alignItems: "center", justifyContent: "center" },
  declineSlot: { borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border },
  pressed: { opacity: 0.7 },
});
