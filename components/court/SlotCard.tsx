import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { PlayerAvatar } from "@/components/PlayerAvatar";
import { formatForMaxPlayers } from "@/components/schedule/scheduledGameModel";
import { Colors, Radius } from "@/constants/colors";
import type { GameRun } from "@/constants/data";
import { Typography } from "@/constants/typography";

export interface SlotAttendee {
  id: string;
  name: string;
  initials: string;
  isMine: boolean;
  visitId?: string;
}

const AVATARS_MAX = 5;

/**
 * Who's going in one time slot, and the games in it. The + (add or remove
 * yourself) and Join sit on the left so they stay put however many people or
 * games there are. Shared by the court page's Week and Home's hourly chart.
 */
export function SlotCard({
  title,
  attendees,
  hidden,
  mine,
  canToggle,
  saving,
  notice,
  onToggle,
  runs,
}: {
  title: string;
  attendees: SlotAttendee[];
  /** Planned visits that keep their name private. */
  hidden: number;
  mine: boolean;
  canToggle: boolean;
  saving: boolean;
  notice: string | null;
  onToggle: () => void;
  runs: GameRun[];
}) {
  const total = attendees.length + hidden;
  const extra = hidden + Math.max(0, attendees.length - AVATARS_MAX);
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.meta}>{total} planning to go</Text>
      </View>
      <View style={styles.peopleRow}>
        {canToggle ? (
          <Pressable
            accessibilityLabel={mine ? "I'm not coming" : "I'm coming"}
            accessibilityRole="button"
            accessibilityState={{ busy: saving, selected: mine }}
            disabled={saving}
            onPress={onToggle}
            style={[styles.add, mine && styles.addOn]}
          >
            <Feather color={mine ? Colors.background : Colors.textSecondary} name={mine ? "check" : "plus"} size={16} />
          </Pressable>
        ) : null}
        <ScrollView contentContainerStyle={styles.avatars} horizontal showsHorizontalScrollIndicator={false} style={styles.avatarScroll}>
          {attendees.slice(0, AVATARS_MAX).map((attendee) => (
            <Pressable
              accessibilityLabel={attendee.isMine ? "You" : attendee.name}
              accessibilityRole="button"
              key={attendee.id}
              onPress={() => router.push(`/player/${attendee.id}`)}
              style={styles.avatar}
            >
              <PlayerAvatar accent={attendee.isMine} initials={attendee.initials} name={attendee.name} playerId={attendee.id} size={36} />
            </Pressable>
          ))}
          {extra > 0 ? (
            <View style={styles.more}>
              <Text style={styles.moreText}>+{extra}</Text>
            </View>
          ) : null}
        </ScrollView>
      </View>
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      <View style={styles.divider} />
      {runs.length > 0 ? (
        runs.map((run) => {
          const format = formatForMaxPlayers(run.maxPlayers);
          const skill = run.skillLevel.charAt(0) + run.skillLevel.slice(1).toLowerCase();
          return (
            <View key={run.id} style={styles.gameRow}>
              <Pressable
                accessibilityLabel={`Open ${run.title}`}
                accessibilityRole="button"
                onPress={() => router.push(`/run/${run.id}`)}
                style={({ pressed }) => [styles.join, pressed && styles.pressed]}
              >
                <Text style={styles.joinText}>Join</Text>
              </Pressable>
              <View style={styles.gameCopy}>
                <View style={styles.gameTitleRow}>
                  <View style={styles.gameDot} />
                  <Text numberOfLines={1} style={styles.gameTitle}>{run.title}</Text>
                </View>
                <Text numberOfLines={1} style={styles.gameSub}>
                  {[format?.toLowerCase(), skill, `${run.participants.length}/${run.maxPlayers} spots`].filter(Boolean).join(" · ")}
                </Text>
              </View>
            </View>
          );
        })
      ) : (
        <Text style={styles.noGame}>No game at this time</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14, borderRadius: 20, borderWidth: 1, borderColor: Colors.hairlineCard, backgroundColor: Colors.panel },
  head: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 10 },
  title: { flexShrink: 1, fontFamily: Typography.headingBold, fontSize: 24, lineHeight: 28, letterSpacing: -0.4, textTransform: "uppercase", color: Colors.text },
  meta: { flexShrink: 0, fontFamily: Typography.bodySemiBold, fontSize: 11, color: Colors.muted },
  peopleRow: { marginTop: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  avatarScroll: { flex: 1, minWidth: 0 },
  avatars: { flexDirection: "row", alignItems: "center", gap: 8 },
  avatar: { borderRadius: 8 },
  add: { width: 36, height: 36, borderRadius: 8, borderWidth: 1, borderColor: Colors.hairlineChrome, alignItems: "center", justifyContent: "center" },
  addOn: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  more: { width: 36, height: 36, borderRadius: 8, borderWidth: 1, borderStyle: "dashed", borderColor: Colors.dashed, alignItems: "center", justifyContent: "center" },
  moreText: { fontFamily: Typography.headingSemiBold, fontSize: 12, color: Colors.textSecondary },
  notice: { marginTop: 8, fontFamily: Typography.bodyMedium, fontSize: 11, color: Colors.loss },
  divider: { height: 1, marginVertical: 14, backgroundColor: Colors.hairline },
  gameRow: { minHeight: 48, marginTop: 4, flexDirection: "row", alignItems: "center", gap: 12 },
  join: { minWidth: 84, height: 44, paddingHorizontal: 16, borderRadius: Radius.button, borderWidth: 1, borderColor: Colors.text, alignItems: "center", justifyContent: "center" },
  joinText: { fontFamily: Typography.bodyBold, fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase", color: Colors.text },
  gameCopy: { flex: 1, minWidth: 0, gap: 3 },
  gameTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  gameDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.text },
  gameTitle: { flexShrink: 1, fontFamily: Typography.headingSemiBold, fontSize: 20, lineHeight: 24, textTransform: "uppercase", color: Colors.text },
  gameSub: { fontFamily: Typography.bodyMedium, fontSize: 11, color: Colors.textSecondary },
  noGame: { fontFamily: Typography.bodyMedium, fontSize: 12, color: Colors.textSecondary },
  pressed: { opacity: 0.72 },
});
