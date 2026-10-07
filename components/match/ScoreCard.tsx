import { NumberFlow } from "number-flow-react-native";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { PlayerAvatar } from "@/components/PlayerAvatar";
import { Colors, Radius } from "@/constants/colors";
import { Layout, Space } from "@/constants/layout";
import { TextStyles, Typography } from "@/constants/typography";

const ELO_NUMBER_FORMAT = { useGrouping: false } as const;

/** Plays the before -> after ELO transition once the row mounts. This is the
 * one deliberate place ELO animates: the moment a score is confirmed. */
function EloChangeLine({
  before,
  after,
  compact,
}: {
  before: number;
  after: number;
  compact?: boolean;
}) {
  const [display, setDisplay] = React.useState(before);
  React.useEffect(() => {
    const timer = setTimeout(() => setDisplay(after), 500);
    return () => clearTimeout(timer);
  }, [after]);
  const delta = after - before;
  const down = delta < 0;
  return (
    <View style={styles.eloLine}>
      {/* ELO is a rating, not a quantity — no thousands separator. */}
      <NumberFlow
        format={ELO_NUMBER_FORMAT}
        style={compact ? styles.eloValueCompact : styles.eloValue}
        value={display}
      />
      {/* An arrow + colour so "my rating moved, and which way" reads at a
          glance — nobody remembers their old number. */}
      <Text
        style={[
          styles.eloDelta,
          compact && styles.eloDeltaCompact,
          down && styles.eloDeltaNegative,
        ]}
      >
        {down ? "▼" : "▲"} {Math.abs(delta)}
      </Text>
    </View>
  );
}

export type ScoreCardStatus =
  | "draft"
  | "pending"
  | "held"
  | "confirmed"
  | "voided";

export type ScoreCardRole = "you" | "opponent" | null;
export type ScoreCardPlayer = {
  id?: string;
  name: string;
  /** Rendered with an animated transition only when the game is confirmed. */
  elo?: { before: number; after: number } | null;
};

export type ScoreCardTone = { bg: string; border: string; text: string };

/** Shared status colour so a screen-level status banner (statusPlacement
 * "none") matches the one the card would have drawn. */
export function scoreCardTone(status: ScoreCardStatus): ScoreCardTone {
  return TONE[status];
}

/** Pending, but not the viewer's move — a status to monitor, not act on.
 *  Deliberately the quiet neutral treatment so the "YOUR APPROVAL" card
 *  next to it in the Inbox is the only one wearing accent. */
const WAITING_TONE: ScoreCardTone = {
  bg: Colors.surfaceHigh,
  border: Colors.borderLight,
  text: Colors.textSecondary,
};

const TONE: Record<ScoreCardStatus, ScoreCardTone> = {
  draft: {
    bg: Colors.surfaceHigh,
    border: Colors.borderLight,
    text: Colors.textSecondary,
  },
  pending: {
    bg: Colors.accentDim,
    border: Colors.accentBorder,
    text: Colors.accent,
  },
  held: {
    bg: Colors.accentDim,
    border: Colors.accentBorder,
    text: Colors.accent,
  },
  confirmed: { bg: Colors.winDim, border: Colors.win, text: Colors.win },
  voided: {
    bg: Colors.surfaceHigh,
    border: Colors.borderLight,
    text: Colors.textSecondary,
  },
};

const STATUS_LABEL: Record<ScoreCardStatus, string> = {
  draft: "NOT SENT",
  pending: "IN REVIEW",
  held: "ON HOLD",
  confirmed: "FINAL",
  voided: "VOIDED",
};

export function scoreCardStatusLabel(status: ScoreCardStatus): string {
  return STATUS_LABEL[status];
}

function formatPlayedOn(value: string): string {
  const date =
    value.length === 10 ? new Date(`${value}T12:00:00`) : new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date
    .toLocaleDateString("en-US", { month: "short", day: "numeric" })
    .toUpperCase();
}

/** "Sep 4" for the full card's subline. */
function formatPlayedOnShort(value: string): string {
  const date = value.length === 10 ? new Date(`${value}T12:00:00`) : new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const firstName = (name: string) => name.split(" ")[0].toUpperCase();

/**
 * The WIN pill sits directly above the score, and its slot is rendered on the
 * losing side too (empty) so both columns' scores and name lists stay on the
 * same baseline.
 */
function WinBadgeSlot({ win }: { win: boolean }) {
  return (
    <View style={styles.winBadgeSlot}>
      {win ? (
        <View style={styles.winBadge}>
          <Text style={styles.winBadgeText}>WIN</Text>
        </View>
      ) : null}
    </View>
  );
}

/**
 * One side of the matchup, centred in its half. Name-first, no avatars:
 *  - 1v1: the player's name, their ELO move, then the score.
 *  - team: `teamLabel` over the score, then a name + ELO row per member.
 * "YOU / OPPONENT" is never spelled out — the viewer-aware status banner
 * and the score carry that.
 */
function PlayerName({
  name,
  win,
  onPress,
}: {
  name: string;
  win: boolean;
  onPress?: () => void;
}) {
  // No handler → plain text. A disabled Pressable still swallows the tap that
  // should reach the card wrapper (which opens the match), so it must not be
  // in the tree at all in list contexts.
  if (!onPress) {
    return (
      <Text
        numberOfLines={1}
        style={[styles.sideName, win && styles.sideNameWin]}
      >
        {firstName(name)}
      </Text>
    );
  }
  return (
    <Pressable
      accessibilityHint="Opens this player's profile"
      accessibilityRole="link"
      onPress={onPress}
    >
      {({ pressed }) => (
        <Text
          numberOfLines={1}
          style={[
            styles.sideName,
            win && styles.sideNameWin,
            pressed ? styles.namePressed : null,
          ]}
        >
          {firstName(name)}
        </Text>
      )}
    </Pressable>
  );
}

/** Inbox / list density: one line per side — name(s) left, score right. */
function CompactRow({
  teamLabel,
  score,
  players,
  winner,
  onPlayerPress,
}: {
  teamLabel: string;
  score: number | string;
  players: ScoreCardPlayer[];
  winner: boolean;
  onPlayerPress?: (playerId: string) => void;
}) {
  const solo = players.length === 1 ? players[0] : null;
  const name = solo ? firstName(solo.name) : teamLabel;
  const onPress =
    solo?.id && onPlayerPress ? () => onPlayerPress(solo.id as string) : undefined;
  const elo = solo?.elo ?? null;
  const eloDelta = elo ? elo.after - elo.before : 0;
  return (
    <View style={styles.compactRow}>
      {onPress ? (
        <Pressable onPress={onPress} style={styles.compactNameWrap}>
          {({ pressed }) => (
            <Text
              numberOfLines={1}
              style={[
                styles.compactName,
                winner && styles.sideNameWin,
                pressed ? styles.namePressed : null,
              ]}
            >
              {name}
            </Text>
          )}
        </Pressable>
      ) : (
        <View style={styles.compactNameWrap}>
          <Text
            numberOfLines={1}
            style={[styles.compactName, winner && styles.sideNameWin]}
          >
            {name}
          </Text>
        </View>
      )}
      {elo ? (
        <Text
          style={[
            styles.compactElo,
            eloDelta < 0 && styles.eloDeltaNegative,
          ]}
        >
          {eloDelta < 0 ? "▼" : "▲"} {Math.abs(eloDelta)}
        </Text>
      ) : null}
      <Text
        style={[styles.compactScore, winner && styles.sideScoreWin]}
      >
        {score}
      </Text>
    </View>
  );
}

function SideColumn({
  teamLabel,
  score,
  players,
  winner,
  winBadge,
  compact,
  onPlayerPress,
}: {
  teamLabel: string;
  score: number | string;
  players: ScoreCardPlayer[];
  winner: boolean;
  winBadge: boolean;
  compact: boolean;
  onPlayerPress?: (playerId: string) => void;
}) {
  const solo = players.length === 1 ? players[0] : null;
  const press = (player: ScoreCardPlayer) =>
    player.id && onPlayerPress
      ? () => onPlayerPress(player.id as string)
      : undefined;
  const scoreEl = (
    <Text
      style={[
        styles.sideScore,
        compact && styles.sideScoreCompact,
        winner && styles.sideScoreWin,
      ]}
    >
      {score}
    </Text>
  );

  if (solo) {
    return (
      <View style={styles.sideCol}>
        <PlayerName name={solo.name} onPress={press(solo)} win={winner} />
        {solo.elo ? (
          <EloChangeLine
            after={solo.elo.after}
            before={solo.elo.before}
            compact={compact}
          />
        ) : null}
        <WinBadgeSlot win={winBadge} />
        {scoreEl}
      </View>
    );
  }

  return (
    <View style={styles.sideCol}>
      <Text numberOfLines={1} style={styles.sideLabel}>
        {teamLabel}
      </Text>
      <WinBadgeSlot win={winBadge} />
      {scoreEl}
      <View style={styles.sidePlayers}>
        {players.map((player, index) => (
          <View
            key={player.id ?? `${player.name}-${index}`}
            style={styles.playerText}
          >
            <PlayerName
              name={player.name}
              onPress={press(player)}
              win={winner}
            />
            {player.elo ? (
              <EloChangeLine
                after={player.elo.after}
                before={player.elo.before}
                compact={compact}
              />
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}

function sideAverages(players: ScoreCardPlayer[]): { avg: number; delta: number } | null {
  const rated = players.filter((p) => p.elo);
  if (rated.length === 0 || rated.length !== players.length) return null;
  const before = rated.reduce((sum, p) => sum + (p.elo as { before: number }).before, 0) / rated.length;
  const after = rated.reduce((sum, p) => sum + (p.elo as { after: number }).after, 0) / rated.length;
  return { avg: Math.round(before), delta: Math.round(after - before) };
}

/** 1v1 (mocks 3a/3b): two avatars face off, the score below, a margin bar. */
function FaceoffBody({
  left,
  right,
  leftScore,
  rightScore,
  leftWins,
  rightWins,
  onPlayerPress,
}: {
  left: ScoreCardPlayer;
  right: ScoreCardPlayer;
  leftScore: number | string;
  rightScore: number | string;
  leftWins: boolean;
  rightWins: boolean;
  onPlayerPress?: (playerId: string) => void;
}) {
  const l = Number(leftScore);
  const r = Number(rightScore);
  const total = Number.isFinite(l) && Number.isFinite(r) && l + r > 0 ? l + r : 0;
  const share = total > 0 ? l / total : 0.5;
  return (
    <View>
      <View style={styles.faceoff}>
        <FaceoffPlayer onPlayerPress={onPlayerPress} player={left} win={leftWins} />
        <Text style={styles.vs}>VS</Text>
        <FaceoffPlayer onPlayerPress={onPlayerPress} player={right} win={rightWins} />
      </View>
      <View style={styles.bigScoreRow}>
        <Text style={[styles.bigScore, leftWins && styles.bigScoreWin]}>{leftScore}</Text>
        <View style={styles.bigScoreDash} />
        <Text style={[styles.bigScore, rightWins && styles.bigScoreWin]}>{rightScore}</Text>
      </View>
      {total > 0 ? (
      <View style={styles.marginBar}>
        <View style={[styles.marginLeft, leftWins && styles.marginWin, { flex: Math.max(share, 0.001) }]} />
        <View style={[styles.marginRight, rightWins && styles.marginWin, { flex: Math.max(1 - share, 0.001) }]} />
      </View>
      ) : null}
    </View>
  );
}

function FaceoffPlayer({
  player,
  win,
  onPlayerPress,
}: {
  player: ScoreCardPlayer;
  win: boolean;
  onPlayerPress?: (playerId: string) => void;
}) {
  const onPress = player.id && onPlayerPress ? () => onPlayerPress(player.id as string) : undefined;
  return (
    <View style={styles.faceoffPlayer}>
      <View style={[styles.faceoffAvatar, win && styles.faceoffAvatarWin]}>
        <PlayerAvatar name={player.name} playerId={player.id} size={56} />
      </View>
      <PlayerName name={player.name} onPress={onPress} win={win} />
      {player.elo ? <EloChangeLine after={player.elo.after} before={player.elo.before} /> : null}
    </View>
  );
}

/** Team games (mock 3c): two columns, each with its score, average ELO and
 * roster. No head-to-head panel. */
function TeamsBody({
  leftLabel,
  rightLabel,
  leftScore,
  rightScore,
  leftPlayers,
  rightPlayers,
  leftWins,
  rightWins,
  settled,
  onPlayerPress,
}: {
  leftLabel: string;
  rightLabel: string;
  leftScore: number | string;
  rightScore: number | string;
  leftPlayers: ScoreCardPlayer[];
  rightPlayers: ScoreCardPlayer[];
  leftWins: boolean;
  rightWins: boolean;
  settled: boolean;
  onPlayerPress?: (playerId: string) => void;
}) {
  return (
    <View style={styles.teams}>
      <TeamColumn
        align="left"
        label={leftLabel}
        onPlayerPress={onPlayerPress}
        players={leftPlayers}
        result={settled ? (leftWins ? "WON" : rightWins ? "LOST" : null) : null}
        score={leftScore}
        win={leftWins}
      />
      <View style={styles.teamsDivider} />
      <TeamColumn
        align="right"
        label={rightLabel}
        onPlayerPress={onPlayerPress}
        players={rightPlayers}
        result={settled ? (rightWins ? "WON" : leftWins ? "LOST" : null) : null}
        score={rightScore}
        win={rightWins}
      />
    </View>
  );
}

function TeamColumn({
  label,
  result,
  score,
  players,
  win,
  align,
  onPlayerPress,
}: {
  label: string;
  result: "WON" | "LOST" | null;
  score: number | string;
  players: ScoreCardPlayer[];
  win: boolean;
  align: "left" | "right";
  onPlayerPress?: (playerId: string) => void;
}) {
  const averages = sideAverages(players);
  const right = align === "right";
  return (
    <View style={styles.teamCol}>
      <Text numberOfLines={1} style={[styles.teamLabel, win && styles.teamLabelWin]}>
        {result ? `${label} · ${result}` : label}
      </Text>
      <Text style={[styles.teamScore, win && styles.bigScoreWin]}>{score}</Text>
      {averages ? (
        <View style={[styles.avgPill, win && styles.avgPillWin]}>
          <Text style={[styles.avgText, win && styles.avgTextWin]}>
            {averages.avg} avg {averages.delta === 0 ? "" : averages.delta > 0 ? `+${averages.delta}` : `${averages.delta}`}
          </Text>
        </View>
      ) : (
        <View style={styles.avgPillSpacer} />
      )}
      <View style={styles.roster}>
        {players.map((player, index) => {
          const onPress = player.id && onPlayerPress ? () => onPlayerPress(player.id as string) : undefined;
          return (
            <Pressable
              disabled={!onPress}
              key={player.id ?? `${player.name}-${index}`}
              onPress={onPress}
              style={({ pressed }) => [styles.rosterRow, right && styles.rosterRowRight, pressed && styles.namePressed]}
            >
              <PlayerAvatar name={player.name} playerId={player.id} size={30} />
              <Text numberOfLines={1} style={[styles.rosterName, right && styles.rosterNameRight]}>
                {player.name.split(" ")[0]}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/**
 * The one score + status card. Log Game's review step, the Inbox, and the
 * FINAL SCORE screen all render this so a game reads the same everywhere.
 *
 * `statusPlacement`: "card" draws a thin status banner across the card's top
 * edge; "none" leaves the status (and any timer / explainer) to the screen
 * above the card, so the card is only the game.
 */
export function ScoreCard({
  status,
  statusLabel,
  statusPlacement = "card",
  courtName,
  format,
  playedOn,
  leftLabel,
  rightLabel,
  leftScore,
  rightScore,
  leftPlayers = [],
  rightPlayers = [],
  note,
  rightMeta,
  compact = false,
  emphasis,
  onPlayerPress,
  variant = "card",
  footnote,
  scoresHidden = false,
}: {
  status: ScoreCardStatus;
  /** Viewer-aware override for the banner text ("YOUR APPROVAL", "WAITING ON
   * JESSE"…). Tone still comes from `status`. Falls back to STATUS_LABEL. */
  statusLabel?: string;
  /** Inbox-list emphasis, independent of `status`: "action" = the viewer has
   * to do something (loud accent banner + a left accent spine so it stands
   * out in a stack); "waiting" = pending someone else (quiet neutral). Omit
   * and the tone comes straight from `status`. */
  emphasis?: "action" | "waiting";
  statusPlacement?: "card" | "none";
  /** Court short slug — a caption, not a headline. */
  courtName: string;
  /** "1V1", "2V2"… shown next to the court on the caption line. */
  format?: string;
  playedOn: string;
  /** Team label shown above a multi-player side ("YOUR TEAM" / "OTHER TEAM").
   * A solo side uses the player's name instead. */
  leftLabel: string;
  rightLabel: string;
  leftScore: number | string;
  rightScore: number | string;
  leftPlayers?: ScoreCardPlayer[];
  rightPlayers?: ScoreCardPlayer[];
  note?: string;
  rightMeta?: string;
  compact?: boolean;
  /** Tapping a player's name calls this with their id. */
  onPlayerPress?: (playerId: string) => void;
  /** "sheet": no box of its own and a one-line header ("Court · 1v1 · Today"),
   * for the game popup that is already a card (mock 3a). */
  variant?: "card" | "sheet";
  /** Small line under the score, e.g. "You're 2–5 all-time vs Jesse". */
  footnote?: string;
  /** A player hid the score and the viewer wasn't in the game: show W / L
   * instead of numbers (decision D30). */
  scoresHidden?: boolean;
}) {
  const tone =
    emphasis === "action"
      ? TONE.pending
      : emphasis === "waiting"
        ? WAITING_TONE
        : TONE[status];
  // In compact / list contexts the whole card is one tap target — it opens the
  // match. A profile link on the name inside it just steals that tap, so names
  // are only links on the full (non-compact) card.
  const namePress = compact ? undefined : onPlayerPress;
  const leftNum = Number(leftScore);
  const rightNum = Number(rightScore);
  const decided =
    Number.isFinite(leftNum) && Number.isFinite(rightNum) && leftNum !== rightNum;
  // Hidden scores: the winner still reads at a glance, the numbers don't.
  const shownLeft = scoresHidden && decided ? (leftNum > rightNum ? "W" : "L") : leftScore;
  const shownRight = scoresHidden && decided ? (rightNum > leftNum ? "W" : "L") : rightScore;
  const shownFootnote = scoresHidden ? "Score hidden by a player" : footnote;

  return (
    <View style={styles.wrap}>
      <View
        style={[
          styles.card,
          variant === "sheet" && styles.cardSheet,
          emphasis === "action" && styles.cardAction,
        ]}
      >
        {emphasis === "action" ? <View style={styles.actionSpine} /> : null}
        {statusPlacement === "card" && !compact ? (
          <View style={styles.statusLine}>
            <View style={[styles.statusDot, { backgroundColor: status === "confirmed" ? Colors.muted : tone.text }]} />
            <Text
              numberOfLines={1}
              style={[styles.statusLineText, status !== "confirmed" && { color: tone.text }]}
            >
              {statusLabel ?? STATUS_LABEL[status]}
            </Text>
          </View>
        ) : statusPlacement === "card" ? (
          <View
            style={[
              styles.statusBanner,
              { backgroundColor: tone.bg, borderBottomColor: tone.border },
            ]}
          >
            <Text
              numberOfLines={1}
              style={[styles.statusBannerText, { color: tone.text }]}
            >
              {statusLabel ?? STATUS_LABEL[status]}
            </Text>
          </View>
        ) : null}

        <View style={[styles.cardBody, compact && styles.cardBodyCompact]}>
          {compact ? (
            <Text numberOfLines={1} style={styles.contextLine}>
              {courtName.toUpperCase()}
              {format ? ` · ${format}` : ""} · {formatPlayedOn(playedOn)}
              {rightMeta ? ` · ${rightMeta}` : ""}
            </Text>
          ) : variant === "sheet" ? (
            <Text numberOfLines={1} style={styles.sheetHeader}>
              {[courtName, format?.toLowerCase(), formatPlayedOnShort(playedOn), rightMeta]
                .filter(Boolean)
                .join(" · ")}
            </Text>
          ) : (
            <View style={styles.titleBlock}>
              <Text adjustsFontSizeToFit minimumFontScale={0.75} numberOfLines={2} style={styles.courtTitle}>
                {courtName.toUpperCase()}
              </Text>
              <Text numberOfLines={1} style={styles.courtSub}>
                {[format?.toLowerCase(), formatPlayedOnShort(playedOn), rightMeta]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
            </View>
          )}

          {compact ? (
            <View style={styles.compactRows}>
              <CompactRow
                onPlayerPress={namePress}
                players={leftPlayers}
                score={shownLeft}
                teamLabel={leftLabel}
                winner={decided && leftNum > rightNum}
              />
              <CompactRow
                onPlayerPress={namePress}
                players={rightPlayers}
                score={shownRight}
                teamLabel={rightLabel}
                winner={decided && rightNum > leftNum}
              />
            </View>
          ) : leftPlayers.length === 1 && rightPlayers.length === 1 ? (
            <FaceoffBody
              left={leftPlayers[0]}
              leftScore={shownLeft}
              leftWins={decided && leftNum > rightNum}
              onPlayerPress={namePress}
              right={rightPlayers[0]}
              rightScore={shownRight}
              rightWins={decided && rightNum > leftNum}
            />
          ) : leftPlayers.length > 0 && rightPlayers.length > 0 ? (
            <TeamsBody
              leftLabel={leftLabel}
              leftPlayers={leftPlayers}
              leftScore={shownLeft}
              leftWins={decided && leftNum > rightNum}
              onPlayerPress={namePress}
              rightLabel={rightLabel}
              rightPlayers={rightPlayers}
              rightScore={shownRight}
              rightWins={decided && rightNum > leftNum}
              settled={status === "confirmed"}
            />
          ) : (
            <View style={styles.matchup}>
              <SideColumn
                compact={compact}
                onPlayerPress={namePress}
                players={leftPlayers}
                score={shownLeft}
                teamLabel={leftLabel}
                winBadge={
                  decided && leftNum > rightNum && status === "confirmed"
                }
                winner={decided && leftNum > rightNum}
              />
              <View style={styles.sideDivider} />
              <SideColumn
                compact={compact}
                onPlayerPress={namePress}
                players={rightPlayers}
                score={shownRight}
                teamLabel={rightLabel}
                winBadge={
                  decided && rightNum > leftNum && status === "confirmed"
                }
                winner={decided && rightNum > leftNum}
              />
            </View>
          )}

          {shownFootnote && !compact ? <Text style={styles.footnote}>{shownFootnote}</Text> : null}
          {note ? (
            <Text style={[styles.note, compact && styles.noteCompact]}>
              {note}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    maxWidth: Layout.maxContentWidth,
    alignSelf: "center",
  },
  card: {
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: Radius.card,
    backgroundColor: Colors.surface,
    overflow: "hidden",
  },
  cardAction: { borderColor: Colors.accentBorder },
  cardSheet: { borderWidth: 0, backgroundColor: "transparent" },
  statusLine: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusLineText: {
    fontFamily: Typography.bodyBold,
    fontSize: 10,
    letterSpacing: 1.8,
    color: Colors.textSecondary,
  },
  sheetHeader: { ...TextStyles.metadata, textAlign: "center", color: Colors.textSecondary },
  footnote: { ...TextStyles.metadata, textAlign: "center", color: Colors.muted },
  actionSpine: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: Colors.accent,
    zIndex: 2,
  },
  cardBody: { padding: Space.lg, gap: Space.md },
  cardBodyCompact: { padding: Space.md, gap: 6 },

  // ── Compact: one line per side ──
  compactRows: { marginTop: 2, gap: 2 },
  compactRow: {
    minHeight: 28,
    flexDirection: "row",
    alignItems: "center",
    gap: Space.sm,
  },
  compactNameWrap: { flex: 1, minWidth: 0 },
  compactName: {
    ...TextStyles.label,
    fontSize: 12,
    color: Colors.text,
  },
  compactScore: {
    fontFamily: TextStyles.displayLarge.fontFamily,
    fontSize: 20,
    lineHeight: 22,
    color: Colors.textSecondary,
    fontVariant: ["tabular-nums"],
  },
  // Per-game rating move on a settled inbox card — the "did my ELO go up"
  // answer, right where the game is.
  compactElo: {
    ...TextStyles.labelSmall,
    fontFamily: TextStyles.label.fontFamily,
    fontSize: 10,
    color: Colors.win,
    letterSpacing: 0.4,
    fontVariant: ["tabular-nums"],
  },

  // ── Status: a thin bar across the card's top edge, not a pill ──
  statusBanner: {
    paddingVertical: 6,
    paddingHorizontal: Space.lg,
    borderBottomWidth: 1,
    alignItems: "center",
  },
  statusBannerText: { ...TextStyles.labelSmall, letterSpacing: 1.6 },
  contextLine: {
    fontFamily: TextStyles.metadata.fontFamily,
    fontSize: 10,
    letterSpacing: 0.6,
    color: Colors.muted,
  },

  // ── Matchup: two side-by-side columns, no box — sits on the card ──
  matchup: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  sideDivider: { width: 1, alignSelf: "stretch", backgroundColor: Colors.border },
  sideCol: {
    flex: 1,
    minWidth: 0,
    paddingVertical: Space.sm,
    paddingHorizontal: Space.sm,
    alignItems: "center",
    gap: 5,
  },
  sideLabel: {
    ...TextStyles.labelSmall,
    color: Colors.textSecondary,
    letterSpacing: 1.4,
    textAlign: "center",
  },
  sideName: {
    ...TextStyles.label,
    color: Colors.text,
    textAlign: "center",
  },
  sideNameWin: { color: Colors.accent },
  namePressed: { opacity: 0.55 },
  sideScore: {
    fontFamily: TextStyles.displayLarge.fontFamily,
    fontSize: 40,
    lineHeight: 44,
    color: Colors.textSecondary,
    fontVariant: ["tabular-nums"],
    textAlign: "center",
  },
  sideScoreCompact: { fontSize: 30, lineHeight: 34 },
  sideScoreWin: { color: Colors.text },
  // Reserved on both sides so the two scores and name lists share a baseline.
  winBadgeSlot: {
    minHeight: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  winBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radius.xs,
    backgroundColor: Colors.accent,
  },
  winBadgeText: {
    fontFamily: TextStyles.labelSmall.fontFamily,
    fontSize: 8,
    letterSpacing: 1.4,
    color: Colors.black,
  },
  sidePlayers: {
    marginTop: Space.xs,
    alignSelf: "stretch",
    alignItems: "center",
    gap: Space.sm,
  },
  playerText: { maxWidth: "100%", minWidth: 0, alignItems: "center" },

  eloLine: {
    marginTop: 1,
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
    gap: 4,
  },
  eloValue: {
    ...TextStyles.labelSmall,
    color: Colors.textSecondary,
    fontVariant: ["tabular-nums"],
  },
  eloValueCompact: {
    ...TextStyles.labelSmall,
    fontSize: 9,
    color: Colors.textSecondary,
    fontVariant: ["tabular-nums"],
  },
  eloDelta: {
    ...TextStyles.labelSmall,
    fontFamily: TextStyles.label.fontFamily,
    color: Colors.win,
    letterSpacing: 0.4,
  },
  eloDeltaCompact: { fontSize: 10 },
  eloDeltaNegative: { color: Colors.loss },
  // ── Full card: court title (mocks 3a-3c) ──
  titleBlock: { alignItems: "center", gap: 4, paddingTop: Space.xs },
  courtTitle: {
    fontFamily: Typography.heading,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: 0.4,
    color: Colors.text,
    textAlign: "center",
  },
  courtSub: { ...TextStyles.metadata, color: Colors.muted, textAlign: "center" },

  // ── 1v1 faceoff ──
  faceoff: {
    marginTop: Space.md,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-evenly",
  },
  faceoffPlayer: { flex: 1, minWidth: 0, alignItems: "center", gap: 6 },
  faceoffAvatar: { padding: 3, borderRadius: Radius.card, borderWidth: 1.5, borderColor: Colors.surface },
  faceoffAvatarWin: { borderColor: Colors.accent },
  vs: {
    marginTop: 30,
    fontFamily: Typography.heading,
    fontSize: 14,
    letterSpacing: 1,
    color: Colors.muted,
  },
  bigScoreRow: {
    marginTop: Space.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Space.lg,
  },
  bigScore: {
    fontFamily: Typography.headingBold,
    fontSize: 64,
    lineHeight: 74,
    color: Colors.mutedDark,
    fontVariant: ["tabular-nums"],
  },
  bigScoreWin: { color: Colors.accent },
  // Drawn, so it sits on the numbers' middle line instead of the baseline.
  bigScoreDash: { width: 16, height: 4, borderRadius: 2, backgroundColor: Colors.mutedDark },
  marginBar: {
    height: 5,
    marginTop: Space.sm,
    marginHorizontal: Space.xl,
    flexDirection: "row",
    overflow: "hidden",
    borderRadius: 3,
    backgroundColor: Colors.surfaceHigh,
  },
  marginLeft: { backgroundColor: Colors.borderLight },
  marginRight: { backgroundColor: Colors.surfaceHigh },
  marginWin: { backgroundColor: Colors.accent },

  // ── Team columns ──
  teams: { marginTop: Space.md, flexDirection: "row", alignItems: "stretch" },
  teamsDivider: { width: StyleSheet.hairlineWidth, backgroundColor: Colors.border },
  teamCol: { flex: 1, minWidth: 0, alignItems: "center", paddingHorizontal: Space.sm, gap: 6 },
  teamLabel: {
    fontFamily: Typography.bodyBold,
    fontSize: 10,
    letterSpacing: 1.4,
    color: Colors.muted,
  },
  teamLabelWin: { color: Colors.accent },
  teamScore: {
    fontFamily: Typography.headingBold,
    fontSize: 56,
    lineHeight: 64,
    color: Colors.mutedDark,
    fontVariant: ["tabular-nums"],
  },
  avgPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  avgPillWin: { borderColor: Colors.accentBorder, backgroundColor: Colors.accentDim },
  avgPillSpacer: { height: 0 },
  avgText: { ...TextStyles.caption, fontFamily: Typography.bodySemiBold, color: Colors.textSecondary },
  avgTextWin: { color: Colors.accent },
  roster: { alignSelf: "stretch", marginTop: Space.md, gap: Space.sm },
  rosterRow: { flexDirection: "row", alignItems: "center", gap: Space.sm },
  rosterRowRight: { flexDirection: "row-reverse" },
  rosterName: { ...TextStyles.label, flexShrink: 1, color: Colors.text },
  rosterNameRight: { textAlign: "right" },

  note: {
    ...TextStyles.bodySmall,
    color: Colors.textSecondary,
    textAlign: "center",
  },
  // Denser in the inbox — the countdown is a footnote, not a headline.
  noteCompact: { fontSize: 10, lineHeight: 14, color: Colors.muted },
});
