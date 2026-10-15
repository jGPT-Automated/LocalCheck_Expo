import { Feather } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { PlayerAvatar } from "@/components/PlayerAvatar";
import { Colors, Radius } from "@/constants/colors";
import { Space } from "@/constants/layout";
import { TextStyles } from "@/constants/typography";

const ICON_BUTTON = 36;

/**
 * The answer to a request, as two compact icon buttons: a check to accept and
 * an X to decline. Used on friend requests and on incoming challenge cards.
 */
export function InboxIconActions({
  onAccept,
  onDecline,
  acceptLabel,
  declineLabel,
  busy = false,
}: {
  onAccept: () => void;
  onDecline: () => void;
  acceptLabel: string;
  declineLabel: string;
  busy?: boolean;
}) {
  return (
    <View style={styles.actions}>
      <Pressable
        accessibilityLabel={acceptLabel}
        accessibilityRole="button"
        disabled={busy}
        hitSlop={4}
        onPress={onAccept}
        style={({ pressed }) => [styles.icon, styles.iconAccept, pressed && styles.pressed]}
      >
        <Feather color={Colors.accent} name="check" size={16} />
      </Pressable>
      <Pressable
        accessibilityLabel={declineLabel}
        accessibilityRole="button"
        disabled={busy}
        hitSlop={4}
        onPress={onDecline}
        style={({ pressed }) => [styles.icon, styles.iconDecline, pressed && styles.pressed]}
      >
        <Feather color={Colors.muted} name="x" size={16} />
      </Pressable>
    </View>
  );
}

/**
 * One inbox row for a person (a friend request): a 44 tile, a name line, one
 * detail line, and the check / X on the right. The name is always its own
 * truncating line.
 */
export function InboxActionRow({
  player,
  title,
  subtitle,
  openLabel,
  onOpen,
  onAccept,
  onDecline,
  acceptLabel,
  declineLabel,
  busy = false,
}: {
  player: { id: string; name: string; initials?: string };
  title: string;
  subtitle: string;
  openLabel: string;
  onOpen: () => void;
  onAccept: () => void;
  onDecline: () => void;
  acceptLabel: string;
  declineLabel: string;
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
      <InboxIconActions
        acceptLabel={acceptLabel}
        busy={busy}
        declineLabel={declineLabel}
        onAccept={onAccept}
        onDecline={onDecline}
      />
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
  actions: { flexDirection: "row", alignItems: "center", gap: 8 },
  icon: {
    width: ICON_BUTTON,
    height: ICON_BUTTON,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  iconAccept: { borderColor: Colors.accentBorder, backgroundColor: Colors.accentDim },
  iconDecline: { borderColor: Colors.border },
  pressed: { opacity: 0.7 },
});
