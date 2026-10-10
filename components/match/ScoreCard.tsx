import { Feather } from "@expo/vector-icons";
import { NumberFlow } from "number-flow-react-native";
import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";

import { PlayerAvatar } from "@/components/PlayerAvatar";
import { RollingNumber } from "@/components/ui/RollingNumber";
import { ShareLine } from "@/components/ui/ShareLine";
import { Colors, Radius } from "@/constants/colors";
import { Space } from "@/constants/layout";
import { TextStyles } from "@/constants/typography";

import { GameStateBanner } from "./GameStateBanner";
import {
  cardTitle,
  eloDelta,
  formatCardDate,
  formatEloDelta,
  gameBannerKind,
  marginSplit,
  sideEloDelta,
} from "./gameCardModel";

const ELO_NUMBER_FORMAT = { useGrouping: false } as const;

/** Rating tile edge: one size for 1v1 and teams (two fit per side at 375). */
const TILE = 60;

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
  /** Shown as the change inside the player's tile once the game is settled. */
  elo?: { before: number; after: number } | null;
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

const firstName = (name: string) => (name.trim().split(/\s+/)[0] ?? "").toUpperCase();

// ── Rating tile ─────────────────────────────────────────────────────────────

/**
 * "+15" in green or "-15" in red, inside the player's tile. The count only
 * runs when the change appears while the card is open (the viewer just
 * approved the game); a card opened on a settled game shows it as it is.
 */
function EloTileValue({
  delta,
  countUp,
}: {
  delta: number;
  countUp: boolean;
}) {
  const color = delta > 0 ? Colors.win : delta < 0 ? Colors.loss : Colors.textSecondary;
  const textStyle = StyleSheet.flatten([
    TextStyles.stat,
    styles.tileText,
    { color },
  ]);
  const abs = Math.abs(delta);
  const [shown, setShown] = React.useState(countUp ? 0 : abs);
  React.useEffect(() => {
    setShown(abs);
  }, [abs]);
  if (delta === 0) return <Text style={textStyle}>0</Text>;
  return (
    <NumberFlow
      animated={countUp}
      format={ELO_NUMBER_FORMAT}
      prefix={delta > 0 ? "+" : "-"}
      respectMotionPreference
      style={textStyle}
      value={shown}
    />
  );
}

/**
 * The player's tile: their rating change once there is one, their initials
 * until then (casual game, or a score still in review).
 */
function PlayerTile({
  player,
  size,
  countUp,
}: {
  player: ScoreCardPlayer;
  size: number;
  countUp: boolean;
}) {
  const delta = eloDelta(player.elo);
  if (delta == null) {
    return <PlayerAvatar name={player.name} playerId={player.id} size={size} />;
  }
  return (
    <View
      accessibilityLabel={`Rating ${formatEloDelta(delta)}`}
      accessible
      style={[
        styles.tile,
        {
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.18),
          backgroundColor:
            delta > 0 ? Colors.winDim : delta < 0 ? Colors.lossDim : Colors.surfaceHigh,
        },
      ]}
    >
      <EloTileValue countUp={countUp} delta={delta} />
    </View>
  );
}

function PlayerColumn({
  player,
  size,
  solo,
  side,
  win,
  countUp,
  onPress,
}: {
  player: ScoreCardPlayer;
  size: number;
  /** 1v1: the name has the whole half to itself and sits on the edge. */
  solo: boolean;
  side: "left" | "right";
  win: boolean;
  countUp: boolean;
  onPress?: () => void;
}) {
  const edge: ViewStyle["alignItems"] = side === "left" ? "flex-start" : "flex-end";
  const content = (
    <>
      <PlayerTile countUp={countUp} player={player} size={size} />
      <Text
        numberOfLines={1}
        style={[
          styles.playerName,
          win ? styles.playerNameWin : null,
          solo
            ? { alignSelf: "stretch", textAlign: side }
            : { width: size + Space.xs, textAlign: "center" },
        ]}
      >
        {firstName(player.name)}
      </Text>
    </>
  );
  const columnStyle: ViewStyle[] = [
    styles.playerColumn,
    solo
      ? { alignItems: edge, flexShrink: 1, minWidth: 0 }
      : { width: size, alignItems: "center" },
  ];
  if (!onPress) return <View style={columnStyle}>{content}</View>;
  return (
    <Pressable
      accessibilityHint="Opens this player's profile"
      accessibilityLabel={player.name}
      accessibilityRole="link"
      onPress={onPress}
      style={({ pressed }) => [columnStyle, pressed ? styles.pressed : null]}
    >
      {content}
    </Pressable>
  );
}

function SideTiles({
  players,
  side,
  win,
  countUp,
  onPlayerPress,
}: {
  players: ScoreCardPlayer[];
  side: "left" | "right";
  win: boolean;
  countUp: boolean;
  onPlayerPress?: (playerId: string) => void;
}) {
  const solo = players.length === 1;
  return (
    <View
      style={[
        styles.sideTiles,
        { justifyContent: side === "left" ? "flex-start" : "flex-end" },
      ]}
    >
      {players.map((player, index) => (
        <PlayerColumn
          countUp={countUp}
          key={player.id ?? `${player.name}-${index}`}
          onPress={
            player.id && onPlayerPress ? () => onPlayerPress(player.id as string) : undefined
          }
          player={player}
          side={side}
          size={TILE}
          solo={solo}
          win={win}
        />
      ))}
    </View>
  );
}

// ── Margin line ─────────────────────────────────────────────────────────────


/** Where the line would be when the score is hidden: say so, quietly. */
function HiddenScoreNote() {
  return (
    <View style={styles.hiddenNote}>
      <Feather color={Colors.muted} name="eye-off" size={13} />
      <Text numberOfLines={1} style={styles.hiddenNoteText}>
        Score hidden
      </Text>
    </View>
  );
}

function ScoreText({
  value,
  win,
}: {
  value: number | string;
  win: boolean;
}) {
  return (
    <RollingNumber
      delay={0}
      rollOnMount={false}
      style={[styles.score, win ? styles.scoreWin : styles.scoreLose]}
      value={value}
    />
  );
}

// ── Compact (inbox) ─────────────────────────────────────────────────────────

function CompactEloDelta({ delta }: { delta: number }) {
  const color = delta < 0 ? Colors.loss : delta > 0 ? Colors.win : Colors.textSecondary;
  return (
    <View style={styles.compactEloRow}>
      <Feather
        color={color}
        name={delta < 0 ? "arrow-down-right" : delta > 0 ? "arrow-up-right" : "minus"}
        size={11}
      />
      <Text style={[styles.compactElo, { color }]}>{Math.abs(delta)}</Text>
    </View>
  );
}

/** One line per side: name(s) left, rating move, score right. */
function CompactRow({
  fallbackLabel,
  score,
  players,
  winner,
}: {
  fallbackLabel: string;
  score: number | string;
  players: ScoreCardPlayer[];
  winner: boolean;
}) {
  const name =
    players.length > 0
      ? players.map((player) => firstName(player.name)).join(" & ")
      : fallbackLabel;
  const delta = sideEloDelta(players);
  return (
    <View style={styles.compactRow}>
      <Text
        numberOfLines={1}
        style={[styles.compactName, winner ? styles.compactNameWin : null]}
      >
        {name}
      </Text>
      <View style={styles.compactEloSlot}>
        {delta != null ? <CompactEloDelta delta={delta} /> : null}
      </View>
      <Text style={[styles.compactScore, winner ? styles.compactScoreWin : null]}>
        {score}
      </Text>
    </View>
  );
}

// ── The card ────────────────────────────────────────────────────────────────

/**
 * The one score + state card. Log Game's review step, the Inbox, the game
 * drawer and the Final Score screen all render this, so a game reads the same
 * everywhere:
 *
 *  - a state banner across the top edge (needs you / waiting / FINAL / held)
 *  - date, then "2V2 AT RANCHO" on one line
 *  - each player's tile (their rating change once settled) with their name
 *  - the two scores at the ends of one margin line
 *
 * `compact` is the inbox density: caption + one line per side.
 * `statusPlacement="none"` leaves the banner to the screen.
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
  footnote,
  scoresHidden = false,
}: {
  status: ScoreCardStatus;
  /** Viewer-aware override for the banner text ("WAITING ON YOU", "WAITING ON
   * JESSE"…). Colour comes from `status` and `emphasis`. Falls back to
   * STATUS_LABEL. */
  statusLabel?: string;
  /** The viewer's seat on a pending game: "action" = their move (accent
   * banner), "waiting" = pending someone else (neutral). Omit for the tone
   * `status` alone gives. */
  emphasis?: "action" | "waiting";
  statusPlacement?: "card" | "none";
  /** Court short slug. */
  courtName: string;
  /** "1V1", "2V2"… the title reads "2V2 AT RANCHO". */
  format?: string;
  playedOn: string;
  /** Names a side only when it has no players to show (compact fallback). */
  leftLabel: string;
  rightLabel: string;
  leftScore: number | string;
  rightScore: number | string;
  leftPlayers?: ScoreCardPlayer[];
  rightPlayers?: ScoreCardPlayer[];
  /** A short line under the card body: the countdown, what happens next. */
  note?: string;
  /** Extra caption text after the date ("CASUAL"). */
  rightMeta?: string;
  compact?: boolean;
  /** Tapping a player's tile calls this with their id (full card only). */
  onPlayerPress?: (playerId: string) => void;
  /** Kept for callers that still pass it; the card has one look. */
  variant?: "card" | "sheet";
  /** Quiet line under the scores, e.g. "You're 2–5 all-time vs Jesse". */
  footnote?: string;
  /** A player hid the score: W / L instead of numbers, no margin line (D40). */
  scoresHidden?: boolean;
}) {
  // In list contexts the whole card is one tap target (it opens the match), so
  // players are only links on the full card.
  const namePress = compact ? undefined : onPlayerPress;
  const leftNum = Number(leftScore);
  const rightNum = Number(rightScore);
  const decided =
    Number.isFinite(leftNum) && Number.isFinite(rightNum) && leftNum !== rightNum;
  const leftWins = decided && leftNum > rightNum;
  const rightWins = decided && rightNum > leftNum;
  // Hidden scores: the winner still reads at a glance, the numbers don't.
  const shownLeft = scoresHidden && decided ? (leftWins ? "W" : "L") : leftScore;
  const shownRight = scoresHidden && decided ? (rightWins ? "W" : "L") : rightScore;
  // Both sides read as winners on a tie, so neither is dimmed.
  const leftStrong = leftWins || !decided;
  const rightStrong = rightWins || !decided;

  const hasElo = [...leftPlayers, ...rightPlayers].some((player) => player.elo);
  // A change that is already there when the card opens is shown, not counted.
  const [hadEloAtOpen] = React.useState(hasElo);
  const countUp = !hadEloAtOpen;

  const split = scoresHidden ? null : marginSplit(leftScore, rightScore);
  const kind = gameBannerKind(status, emphasis);
  const banner =
    statusPlacement === "card" ? (
      <GameStateBanner kind={kind} label={statusLabel ?? STATUS_LABEL[status]} />
    ) : null;
  const caption = [formatCardDate(playedOn), rightMeta].filter(Boolean).join(" · ");

  if (compact) {
    return (
      <View style={[styles.card, kind === "action" ? styles.cardAction : null]}>
        {banner}
        <View style={styles.compactBody}>
          <Text numberOfLines={1} style={styles.compactCaption}>
            {[cardTitle(format, courtName), caption].join(" · ")}
          </Text>
          <View style={styles.compactRows}>
            <CompactRow
              fallbackLabel={leftLabel}
              players={leftPlayers}
              score={shownLeft}
              winner={leftWins}
            />
            <CompactRow
              fallbackLabel={rightLabel}
              players={rightPlayers}
              score={shownRight}
              winner={rightWins}
            />
          </View>
          {note ? (
            <Text numberOfLines={1} style={styles.compactNote}>
              {note}
            </Text>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.card, kind === "action" ? styles.cardAction : null]}>
      {banner}
      <View style={styles.body}>
        <View style={styles.titleBlock}>
          <Text numberOfLines={1} style={styles.caption}>
            {caption}
          </Text>
          <Text
            adjustsFontSizeToFit
            minimumFontScale={0.75}
            numberOfLines={1}
            style={styles.title}
          >
            {cardTitle(format, courtName)}
          </Text>
        </View>

        <View style={styles.sidesRow}>
          <SideTiles
            countUp={countUp}
            onPlayerPress={namePress}
            players={leftPlayers}
            side="left"
            win={leftStrong}
          />
          <SideTiles
            countUp={countUp}
            onPlayerPress={namePress}
            players={rightPlayers}
            side="right"
            win={rightStrong}
          />
        </View>

        <View style={styles.scoreRow}>
          <ScoreText value={shownLeft} win={leftStrong} />
          <View style={styles.lineSlot}>
            {scoresHidden ? (
              <HiddenScoreNote />
            ) : split ? (
              <ShareLine leader={split.leader} leftShare={split.share} />
            ) : null}
          </View>
          <ScoreText value={shownRight} win={rightStrong} />
        </View>

        {note || footnote ? (
          <View style={styles.footer}>
            {note ? <Text style={styles.note}>{note}</Text> : null}
            {footnote ? (
              <Text numberOfLines={1} style={styles.footnote}>
                {footnote}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: Radius.card,
    backgroundColor: Colors.surface,
    overflow: "hidden",
  },
  cardAction: { borderColor: Colors.accentBorder },
  pressed: { opacity: 0.55 },

  // ── Full card ──
  body: { padding: Space.lg, gap: Space.lg },
  titleBlock: { alignItems: "center", gap: Space.xs },
  caption: {
    ...TextStyles.labelSmall,
    color: Colors.muted,
    letterSpacing: 1.2,
    textAlign: "center",
  },
  title: {
    ...TextStyles.title,
    alignSelf: "stretch",
    color: Colors.text,
    letterSpacing: 0.6,
    textAlign: "center",
  },

  // Tiles at the two edges, names under them.
  sidesRow: { flexDirection: "row", alignItems: "flex-start", gap: Space.md },
  sideTiles: { flex: 1, minWidth: 0, flexDirection: "row", gap: Space.sm },
  playerColumn: { gap: Space.xs + 2 },
  tile: { alignItems: "center", justifyContent: "center" },
  tileText: { fontVariant: ["tabular-nums"], textAlign: "center" },
  playerName: { ...TextStyles.label, color: Colors.textSecondary },
  playerNameWin: { color: Colors.text },

  // Scores flank the margin line, all on one middle line.
  scoreRow: { flexDirection: "row", alignItems: "center", gap: Space.md },
  score: { ...TextStyles.displayLarge, fontVariant: ["tabular-nums"] },
  scoreWin: { color: Colors.text },
  scoreLose: { color: Colors.textSecondary },
  lineSlot: { flex: 1, minWidth: 0, justifyContent: "center" },
  hiddenNote: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Space.xs + 2,
  },
  hiddenNoteText: { ...TextStyles.metadata, color: Colors.muted },

  footer: { alignItems: "center", gap: Space.xs },
  note: { ...TextStyles.bodySmall, color: Colors.textSecondary, textAlign: "center" },
  footnote: {
    ...TextStyles.metadata,
    alignSelf: "stretch",
    color: Colors.muted,
    textAlign: "center",
  },

  // ── Compact (inbox) ──
  compactBody: { padding: Space.md, gap: Space.sm },
  compactCaption: { ...TextStyles.labelSmall, color: Colors.muted, letterSpacing: 0.8 },
  compactRows: { gap: Space.xs },
  compactRow: { minHeight: 28, flexDirection: "row", alignItems: "center", gap: Space.sm },
  compactName: { ...TextStyles.label, flex: 1, minWidth: 0, color: Colors.textSecondary },
  compactNameWin: { color: Colors.text },
  // Fixed width so the two rows' rating moves line up under each other.
  compactEloSlot: { width: 40, alignItems: "flex-end" },
  compactEloRow: { flexDirection: "row", alignItems: "center", gap: 2 },
  compactElo: { ...TextStyles.labelSmall, fontVariant: ["tabular-nums"] },
  compactScore: {
    ...TextStyles.statSmall,
    minWidth: 40,
    color: Colors.textSecondary,
    fontVariant: ["tabular-nums"],
    textAlign: "right",
  },
  compactScoreWin: { color: Colors.text },
  compactNote: { ...TextStyles.metadata, color: Colors.muted },
});
