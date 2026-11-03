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

/**
 * view: just look (the court page's Week). plan: Here / Going (Home's chart).
 * full: Here / Going and Join / Create (the Schedule page).
 */
export type SlotMode = "view" | "plan" | "full";

const AVATARS_MAX = 6;

/**
 * Who's going in one time slot, on one thin row: title and count on top, then
 * the people (or the game's third on the right). With nothing in the slot and
 * nothing to do, only the title row shows.
 */
export function SlotCard({
  title,
  attendees,
  hidden,
  mine,
  mode,
  current = false,
  saving = false,
  notice = null,
  onToggle,
  onCreate,
  runs,
  compact = false,
}: {
  title: string;
  attendees: SlotAttendee[];
  /** Planned visits that keep their name private. */
  hidden: number;
  mine: boolean;
  mode: SlotMode;
  /** The slot is happening now: the button says Here, otherwise Going. */
  current?: boolean;
  saving?: boolean;
  notice?: string | null;
  onToggle?: () => void;
  onCreate?: () => void;
  runs: GameRun[];
  /** Timeline uses names; square avatars remain on presence/game surfaces. */
  compact?: boolean;
}) {
  const total = attendees.length + hidden;
  const extra = hidden + Math.max(0, attendees.length - AVATARS_MAX);
  const acts = mode !== "view";
  const run = runs[0];
  const showBody = acts || total > 0 || Boolean(run);
  if (compact)
    return (
      <View style={styles.timelineRow}>
        <Text style={styles.hour}>{title}</Text>
        <View style={styles.timelineInfo}>
          <Text style={styles.timelineCount}>
            {total ? `${total} going` : "Nobody yet"}
          </Text>
          {attendees.length || hidden ? (
            <Text style={styles.timelineNames}>
              {[
                ...attendees.map((p) => (p.isMine ? "You" : p.name)),
                ...(hidden ? [`${hidden} private`] : []),
              ].join(" · ")}
            </Text>
          ) : null}
          {runs.map((game) => (
            <Pressable
              key={game.id}
              accessibilityRole="button"
              accessibilityLabel={`Open ${game.title}`}
              onPress={() => router.push(`/run/${game.id}`)}
              style={styles.timelineGame}
            >
              <Text style={styles.timelineGameText}>
                {game.title} · {game.participants.length}/{game.maxPlayers}
              </Text>
            </Pressable>
          ))}
          {notice ? (
            <Text accessibilityLiveRegion="polite" style={styles.notice}>
              {notice}
            </Text>
          ) : null}
        </View>
        {acts ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={mine ? "I'm not coming" : "I'm going"}
            accessibilityState={{ busy: saving, selected: mine }}
            disabled={saving}
            onPress={onToggle}
            style={[styles.timelineAction, mine && styles.actionOn]}
          >
            <Text style={[styles.actionText, mine && styles.actionTextOn]}>
              {saving ? "Saving…" : "Going"}
            </Text>
          </Pressable>
        ) : null}
      </View>
    );
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text numberOfLines={1} style={styles.title}>
          {title}
        </Text>
        <Text style={styles.meta}>{total} planning to go</Text>
      </View>
      {showBody ? (
        <View style={styles.body}>
          {acts ? (
            <Pressable
              accessibilityLabel={
                mine ? "I'm not coming" : current ? "I'm here" : "I'm going"
              }
              accessibilityRole="button"
              accessibilityState={{ busy: saving, selected: mine }}
              disabled={saving}
              onPress={onToggle}
              style={[styles.action, mine && styles.actionOn]}
            >
              <Text style={[styles.actionText, mine && styles.actionTextOn]}>
                {current ? "Here" : "Going"}
              </Text>
            </Pressable>
          ) : null}
          <ScrollView
            contentContainerStyle={styles.avatars}
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.avatarScroll}
          >
            {attendees.slice(0, AVATARS_MAX).map((attendee) => (
              <Pressable
                accessibilityLabel={attendee.isMine ? "You" : attendee.name}
                accessibilityRole="button"
                key={attendee.id}
                onPress={() => router.push(`/player/${attendee.id}`)}
              >
                <PlayerAvatar
                  accent={attendee.isMine}
                  initials={attendee.initials}
                  name={attendee.name}
                  playerId={attendee.id}
                  size={32}
                />
              </Pressable>
            ))}
            {extra > 0 ? (
              <View style={styles.more}>
                <Text style={styles.moreText}>+{extra}</Text>
              </View>
            ) : null}
          </ScrollView>
          {run || mode === "full" ? (
            <View style={styles.gameCell}>
              {mode === "view" && run ? (
                <Pressable
                  accessibilityLabel={`Open ${run.title}`}
                  accessibilityRole="button"
                  onPress={() => router.push(`/run/${run.id}`)}
                  style={styles.gameInfo}
                >
                  <Text numberOfLines={1} style={styles.gameInfoText}>
                    {[
                      formatForMaxPlayers(run.maxPlayers)?.toLowerCase(),
                      `${run.participants.length}/${run.maxPlayers}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </Text>
                </Pressable>
              ) : run ? (
                <Pressable
                  accessibilityLabel={`Open ${run.title}`}
                  accessibilityRole="button"
                  onPress={() => router.push(`/run/${run.id}`)}
                  style={styles.actionLine}
                >
                  <Text style={styles.actionLineText}>Join</Text>
                </Pressable>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  onPress={onCreate}
                  style={styles.actionLine}
                >
                  <Text style={styles.actionLineText}>Create</Text>
                </Pressable>
              )}
            </View>
          ) : null}
        </View>
      ) : null}
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  timelineRow: {
    minHeight: 66,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.hairline,
  },
  hour: {
    width: 44,
    fontFamily: Typography.headingSemiBold,
    fontSize: 16,
    color: Colors.textSecondary,
  },
  timelineInfo: { flex: 1, minWidth: 0, gap: 4 },
  timelineCount: {
    fontFamily: Typography.bodyMedium,
    fontSize: 13,
    color: Colors.text,
  },
  timelineNames: {
    fontFamily: Typography.bodyMedium,
    fontSize: 11,
    lineHeight: 16,
    color: Colors.textSecondary,
  },
  timelineGame: { minHeight: 44, justifyContent: "center" },
  timelineGameText: {
    fontFamily: Typography.bodySemiBold,
    fontSize: 12,
    lineHeight: 17,
    color: Colors.text,
  },
  timelineAction: {
    minWidth: 68,
    minHeight: 44,
    paddingHorizontal: 10,
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: Colors.hairlineChrome,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: Radius.panel,
    borderWidth: 1,
    borderColor: Colors.hairlineCard,
    backgroundColor: Colors.panel,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  title: {
    flexShrink: 1,
    fontFamily: Typography.headingSemiBold,
    fontSize: 15,
    letterSpacing: 0.2,
    textTransform: "uppercase",
    color: Colors.text,
  },
  meta: {
    flexShrink: 0,
    fontFamily: Typography.bodySemiBold,
    fontSize: 11,
    color: Colors.muted,
  },
  body: {
    marginTop: 10,
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  avatarScroll: { flex: 2, flexBasis: 0, minWidth: 0 },
  avatars: { flexDirection: "row", alignItems: "center", gap: 6 },
  action: {
    minWidth: 64,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: Colors.hairlineChrome,
    alignItems: "center",
    justifyContent: "center",
  },
  actionOn: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  actionText: {
    fontFamily: Typography.bodyBold,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: Colors.text,
  },
  actionTextOn: { color: Colors.background },
  more: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: Colors.dashed,
    alignItems: "center",
    justifyContent: "center",
  },
  moreText: {
    fontFamily: Typography.headingSemiBold,
    fontSize: 11,
    color: Colors.textSecondary,
  },
  gameCell: { flex: 1, flexBasis: 0, minWidth: 0 },
  gameInfo: {
    height: 36,
    paddingHorizontal: 8,
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: Colors.hairlineChrome,
    alignItems: "center",
    justifyContent: "center",
  },
  gameInfoText: {
    fontFamily: Typography.bodyBold,
    fontSize: 11,
    color: Colors.textSecondary,
  },
  actionLine: {
    height: 36,
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: Colors.text,
    alignItems: "center",
    justifyContent: "center",
  },
  actionLineText: {
    fontFamily: Typography.bodyBold,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: Colors.text,
  },
  notice: {
    marginTop: 8,
    fontFamily: Typography.bodyMedium,
    fontSize: 11,
    color: Colors.loss,
  },
});
