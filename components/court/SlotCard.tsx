import { router } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";

import { PlayerAvatar } from "@/components/PlayerAvatar";
import { ScheduledGameCard } from "@/components/court/CourtGamesPanel";
import { PressableScale } from "@/components/ui/PressableScale";
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
  embedded = false,
  onJoinRun,
  joiningRunId,
  onPlayerPress,
  onRunPress,
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
  /** Condensed timeline row; dashboard selection uses the full card. */
  compact?: boolean;
  /** The dashboard planner already owns the surrounding panel. */
  embedded?: boolean;
  onJoinRun?: (game: GameRun) => void;
  joiningRunId?: string | null;
  onPlayerPress?: (playerId: string) => void;
  onRunPress?: (runId: string) => void;
}) {
  const total = attendees.length + hidden;
  const extra = Math.max(0, attendees.length - AVATARS_MAX);
  const acts = mode !== "view";
  const openPlayer = (id: string) =>
    onPlayerPress ? onPlayerPress(id) : router.push(`/player/${id}`);
  const openRun = (id: string) =>
    onRunPress ? onRunPress(id) : router.push(`/run/${id}`);
  const spokenAttendees = [
    ...attendees.map((p) => (p.isMine ? "You" : p.name)),
    ...(hidden ? [`${hidden} private`] : []),
  ].join(" · ");
  const gameRows = runs.map((game) => (
    <ScheduledGameCard
      compact
      disabled={mode === "plan" && !onJoinRun}
      openOnly={!acts}
      game={game}
      joining={joiningRunId === game.id}
      key={game.id}
      onJoin={onJoinRun ?? ((selectedGame) => openRun(selectedGame.id))}
      onOpen={(selectedGame) => openRun(selectedGame.id)}
      onPlayer={openPlayer}
    />
  ));
  if (compact)
    return (
      <View>
        <View style={styles.timelineRow}>
          <Text style={styles.hour}>{title}</Text>
          {attendees.length ? (
            <View
              testID="slot-attendee-stack"
              style={styles.stack}
              pointerEvents="none"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              {attendees.slice(0, 3).map((person, index) => (
                <View
                  key={person.id}
                  style={[styles.stackFace, index > 0 && styles.overlap]}
                >
                  <PlayerAvatar
                    initials={person.initials}
                    name={person.name}
                    playerId={person.id}
                    size={34}
                  />
                </View>
              ))}
            </View>
          ) : null}
          <View style={styles.timelineInfo}>
            <Text style={styles.timelineCount}>
              {total ? `${total} going` : "Nobody yet"}
            </Text>
            {attendees.length || hidden ? (
              <Text
                accessibilityLabel={spokenAttendees}
                style={styles.timelineNames}
              >
                {[
                  ...attendees
                    .slice(0, 2)
                    .map((p) => (p.isMine ? "You" : p.name)),
                  ...(attendees.length > 2 ? [`+${attendees.length - 2}`] : []),
                  ...(hidden ? [`${hidden} private`] : []),
                ].join(" · ")}
              </Text>
            ) : null}
            {notice ? (
              <Text accessibilityLiveRegion="polite" style={styles.notice}>
                {notice}
              </Text>
            ) : null}
          </View>
          {acts ? (
            <AttendanceAction
              mine={mine}
              saving={saving}
              current={current}
              onToggle={onToggle}
            />
          ) : null}
        </View>
        {gameRows}
      </View>
    );
  return (
    <View style={[styles.card, embedded && styles.embedded]}>
      {!embedded ? (
        <View style={styles.head}>
          <Text numberOfLines={1} style={styles.title}>
            {title}
          </Text>
          <Text style={styles.meta}>{total} planning to go</Text>
        </View>
      ) : null}
      <View style={[styles.body, embedded && styles.embeddedBody]}>
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
                onPress={() => openPlayer(attendee.id)}
                style={styles.avatarTarget}
              >
                <PlayerAvatar
                  initials={attendee.initials}
                  name={attendee.name}
                  playerId={attendee.id}
                  size={34}
                />
              </Pressable>
            ))}
            {extra > 0 ? (
              <View style={styles.more}>
                <Text style={styles.moreText}>+{extra}</Text>
              </View>
            ) : null}
            {hidden > 0 ? (
              <Text style={styles.privateCount}>{hidden} private</Text>
            ) : null}
          </ScrollView>
          {acts ? (
            <AttendanceAction
              mine={mine}
              saving={saving}
              current={current}
              onToggle={onToggle}
            />
          ) : null}
      </View>
      <View style={styles.gameRows}>
        {gameRows.length ? gameRows : onCreate && acts ? (
          <View style={styles.emptyGameRow}>
            <PressableScale accessibilityRole="button" accessibilityLabel="Create a game" onPress={onCreate} containerStyle={styles.gameActionTarget} style={styles.actionLine}>
              <Text style={styles.actionLineText}>Create</Text>
            </PressableScale>
          </View>
        ) : null}
      </View>
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
    </View>
  );
}

function AttendanceAction({
  mine,
  saving,
  current,
  onToggle,
}: {
  mine: boolean;
  saving: boolean;
  current: boolean;
  onToggle?: () => void;
}) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={
        mine ? "I'm not coming" : current ? "I'm here" : "I'm going"
      }
      accessibilityState={{ busy: saving, selected: mine }}
      disabled={saving || !onToggle}
      onPress={onToggle}
      containerStyle={styles.actionTarget}
      style={[styles.action, mine && styles.actionOn]}
    >
      {saving ? (
        <ActivityIndicator
          size="small"
          color={mine ? Colors.background : Colors.text}
        />
      ) : (
        <Feather
          name={mine ? "check" : "plus"}
          size={20}
          color={mine ? Colors.background : Colors.text}
        />
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  timelineRow: {
    minHeight: 80,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.hairline,
  },
  stack: { flexDirection: "row", flexShrink: 0, paddingVertical: 4 },
  stackFace: {
    borderWidth: 2,
    borderColor: Colors.background,
    borderRadius: Radius.chip,
  },
  overlap: { marginLeft: -10 },
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
  card: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: Radius.panel,
    borderWidth: 1,
    borderColor: Colors.hairlineCard,
    backgroundColor: Colors.panel,
  },
  embedded: {
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 0,
    borderWidth: 0,
    borderTopWidth: 0,
    borderRadius: 0,
    marginTop: 0,
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
    flexShrink: 1,
    fontFamily: Typography.bodySemiBold,
    fontSize: 11,
    color: Colors.muted,
  },
  body: {
    marginTop: 10,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  embeddedBody: { marginTop: 0 },
  gameRows: { minHeight: 44 },
  emptyGameRow: { minHeight: 44, alignItems: "flex-end" },
  gameActionTarget: { minWidth: 64, height: 44, alignItems: "center", justifyContent: "center" },
  avatarScroll: { flex: 2, flexBasis: 0, minWidth: 0 },
  avatars: { flexDirection: "row", alignItems: "center", gap: 6 },
  avatarTarget: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  actionTarget: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  privateCount: {
    fontFamily: Typography.bodyMedium,
    fontSize: 11,
    color: Colors.textSecondary,
  },
  action: {
    width: 34,
    height: 34,
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: Colors.hairlineChrome,
    alignItems: "center",
    justifyContent: "center",
  },
  actionOn: { backgroundColor: Colors.text, borderColor: Colors.text },
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
  actionLine: {
    minWidth: 64,
    height: 34,
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
