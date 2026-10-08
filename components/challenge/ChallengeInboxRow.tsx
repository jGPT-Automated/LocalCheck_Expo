import { Feather } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { PlayerAvatar } from "@/components/PlayerAvatar";
import { Colors, Radius } from "@/constants/colors";
import { Space } from "@/constants/layout";
import { TextStyles, Typography } from "@/constants/typography";
import {
  type Challenge,
  challengeAction,
  challengePlaceLine,
  challengeStatusLine,
  otherPlayer,
} from "@/lib/challengeModel";

/** Inbox row for an open challenge. Incoming ones can be answered in place. */
export function ChallengeInboxRow({
  challenge,
  viewerId,
  onOpen,
  onRespond,
  busy = false,
}: {
  challenge: Challenge;
  viewerId: string;
  onOpen: () => void;
  onRespond: (accept: boolean) => void;
  busy?: boolean;
}) {
  const other = otherPlayer(challenge, viewerId);
  const action = challengeAction(challenge, viewerId);
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityLabel={`Open challenge with ${other.name}`}
        accessibilityRole="button"
        onPress={onOpen}
        style={({ pressed }) => [styles.identity, pressed && styles.pressed]}
      >
        <PlayerAvatar initials={other.initials} name={other.name} playerId={other.id} size={38} />
        <View style={styles.copy}>
          <Text numberOfLines={1} style={styles.title}>
            {challengeStatusLine(challenge, viewerId)}
          </Text>
          <Text numberOfLines={1} style={styles.meta}>
            {challenge.ranked ? "Ranked 1v1" : "Casual · no score"} · {challengePlaceLine(challenge)}
          </Text>
        </View>
      </Pressable>
      {action === "accept_decline" ? (
        <>
          <Pressable
            accessibilityLabel={`Accept ${other.name}'s challenge`}
            accessibilityRole="button"
            disabled={busy}
            onPress={() => onRespond(true)}
            style={({ pressed }) => [styles.accept, pressed && styles.pressed]}
          >
            <Text style={styles.acceptText}>ACCEPT</Text>
          </Pressable>
          <Pressable
            accessibilityLabel={`Decline ${other.name}'s challenge`}
            accessibilityRole="button"
            disabled={busy}
            hitSlop={6}
            onPress={() => onRespond(false)}
            style={({ pressed }) => [styles.decline, pressed && styles.pressed]}
          >
            <Feather color={Colors.muted} name="x" size={14} />
          </Pressable>
        </>
      ) : action === "log_score" ? (
        <Pressable
          accessibilityRole="button"
          onPress={onOpen}
          style={({ pressed }) => [styles.log, pressed && styles.pressed]}
        >
          <Text style={styles.logText}>LOG SCORE</Text>
        </Pressable>
      ) : (
        <Feather color={Colors.muted} name="chevron-right" size={16} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: Space.sm,
    paddingVertical: Space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  identity: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: Space.md },
  copy: { flex: 1, minWidth: 0 },
  title: { ...TextStyles.listName, color: Colors.text },
  meta: { ...TextStyles.caption, marginTop: 3, color: Colors.muted },
  pressed: { opacity: 0.7 },
  accept: {
    minHeight: 34,
    paddingHorizontal: 12,
    justifyContent: "center",
    borderRadius: Radius.md,
    backgroundColor: Colors.accent,
  },
  acceptText: { fontFamily: Typography.heading, fontSize: 11, letterSpacing: 1.2, color: Colors.black },
  decline: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  log: {
    minHeight: 34,
    paddingHorizontal: 12,
    justifyContent: "center",
    borderRadius: Radius.md,
    backgroundColor: Colors.text,
  },
  logText: { fontFamily: Typography.heading, fontSize: 11, letterSpacing: 1.2, color: Colors.black },
});
