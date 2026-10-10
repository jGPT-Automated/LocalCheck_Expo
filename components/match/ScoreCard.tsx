import { Feather } from "@expo/vector-icons";
import { NumberFlow } from "number-flow-react-native";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { PlayerAvatar } from "@/components/PlayerAvatar";
import { RollingNumber } from "@/components/ui/RollingNumber";
import { ShareLine } from "@/components/ui/ShareLine";
import { Colors, Radius } from "@/constants/colors";
import { Space } from "@/constants/layout";
import { TextStyles } from "@/constants/typography";

import { GameStateBanner } from "./GameStateBanner";
import {
  bannerTrailing,
  cardTitle,
  eloDelta,
  formatCardDate,
  gameBannerKind,
  marginSplit,
  sideEloDelta,
} from "./gameCardModel";

const ELO_NUMBER_FORMAT = { useGrouping: false } as const;

/** 1v1 faceoff avatar edge. */
const FACEOFF_AVATAR = 56;
/** Gap between the two faceoff players ("VS"); the score row keeps it too. */
const VERSUS_WIDTH = 32;
/** Roster avatar edge: five rows a side still fit at 375. */
const ROSTER_AVATAR = 24;

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
  /** Shown as the player's rating move once the game is settled. */
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

// ── Rating move ─────────────────────────────────────────────────────────────

function eloTone(delta: number) {
  return {
    color: delta < 0 ? Colors.loss : delta > 0 ? Colors.win : Colors.textSecondary,
    icon: (delta < 0 ? "arrow-down-right" : delta > 0 ? "arrow-up-right" : "minus") as
      | "arrow-down-right"
      | "arrow-up-right"
      | "minus",
  };
}

/** Starts at `from` and settles on `to`, so a count only runs when the value
 *  arrives while the card is open; a card opened on a settled game shows `to`. */
function useSettled(from: number, to: number, countUp: boolean): number {
  const [shown, setShown] = React.useState(countUp ? from : to);
  React.useEffect(() => {
    setShown(to);
  }, [to]);
  return shown;
}

/**
 * The player's rating move: a green up arrow and the points gained, a red down
 * arrow and the points lost. The count only runs when the change appears while
 * the card is open (the viewer just approved the game).
 */
function EloDelta({ delta, countUp }: { delta: number; countUp: boolean }) {
  const { color, icon } = eloTone(delta);
  const abs = Math.abs(delta);
  const shown = useSettled(0, abs, countUp);
  const textStyle = StyleSheet.flatten([TextStyles.label, styles.eloText, { color }]);
  return (
    <View
      accessibilityLabel={`Rating ${delta > 0 ? "up" : delta < 0 ? "down" : "unchanged"} ${abs}`}
      accessible
      style={styles.eloDelta}
    >
      <Feather color={color} name={icon} size={12} />
      {delta === 0 ? (
        <Text style={textStyle}>0</Text>
      ) : (
        <NumberFlow
          animated={countUp}
          format={ELO_NUMBER_FORMAT}
          respectMotionPreference
          style={textStyle}
          value={shown}
        />
      )}
    </View>
  );
}

/** 1v1: the rating, then its move beside it. */
function EloLine({
  elo,
  countUp,
}: {
  elo: { before: number; after: number };
  countUp: boolean;
}) {
  const rating = useSettled(elo.before, elo.after, countUp);
  const textStyle = StyleSheet.flatten([TextStyles.label, styles.eloText, styles.eloRating]);
  return (
    <View style={styles.eloLine}>
      <NumberFlow
        animated={countUp}
        format={ELO_NUMBER_FORMAT}
        respectMotionPreference
        style={textStyle}
        value={rating}
      />
      <EloDelta countUp={countUp} delta={elo.after - elo.before} />
    </View>
  );
}

// ── Scores and the margin line ──────────────────────────────────────────────

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

/** The line under the scores, or a quiet note in its place. Same height either
 *  way, so hiding the score does not move the card. */
function MarginSlot({
  hidden,
  split,
}: {
  hidden: boolean;
  split: ReturnType<typeof marginSplit>;
}) {
  return (
    <View style={styles.lineSlot}>
      {hidden ? (
        <HiddenScoreNote />
      ) : split ? (
        <ShareLine leader={split.leader} leftShare={split.share} />
      ) : null}
    </View>
  );
}

// ── 1v1: two players facing off ─────────────────────────────────────────────

function FaceoffPlayer({
  player,
  win,
  countUp,
  onPress,
}: {
  player: ScoreCardPlayer;
  win: boolean;
  countUp: boolean;
  onPress?: () => void;
}) {
  const content = (
    <>
      <PlayerAvatar name={player.name} playerId={player.id} size={FACEOFF_AVATAR} />
      <Text numberOfLines={1} style={[styles.faceoffName, win ? styles.nameWin : null]}>
        {firstName(player.name)}
      </Text>
      {player.elo ? <EloLine countUp={countUp} elo={player.elo} /> : null}
    </>
  );
  if (!onPress) return <View style={styles.faceoffPlayer}>{content}</View>;
  return (
    <Pressable
      accessibilityHint="Opens this player's profile"
      accessibilityLabel={player.name}
      accessibilityRole="link"
      onPress={onPress}
      style={({ pressed }) => [styles.faceoffPlayer, pressed ? styles.pressed : null]}
    >
      {content}
    </Pressable>
  );
}

function Faceoff({
  left,
  right,
  leftScore,
  rightScore,
  leftStrong,
  rightStrong,
  hidden,
  split,
  countUp,
  onPlayerPress,
}: {
  left: ScoreCardPlayer;
  right: ScoreCardPlayer;
  leftScore: number | string;
  rightScore: number | string;
  leftStrong: boolean;
  rightStrong: boolean;
  hidden: boolean;
  split: ReturnType<typeof marginSplit>;
  countUp: boolean;
  onPlayerPress?: (playerId: string) => void;
}) {
  const press = (player: ScoreCardPlayer) =>
    player.id && onPlayerPress ? () => onPlayerPress(player.id as string) : undefined;
  return (
    <View style={styles.faceoffBlock}>
      <View style={styles.faceoff}>
        <FaceoffPlayer countUp={countUp} onPress={press(left)} player={left} win={leftStrong} />
        <View style={styles.versus}>
          <Text style={styles.versusText}>VS</Text>
        </View>
        <FaceoffPlayer countUp={countUp} onPress={press(right)} player={right} win={rightStrong} />
      </View>
      <View style={styles.faceoff}>
        <View style={styles.faceoffScore}>
          <ScoreText value={leftScore} win={leftStrong} />
        </View>
        <View style={styles.versus} />
        <View style={styles.faceoffScore}>
          <ScoreText value={rightScore} win={rightStrong} />
        </View>
      </View>
      <MarginSlot hidden={hidden} split={split} />
    </View>
  );
}

// ── Teams: two columns, a roster each ───────────────────────────────────────

function RosterRow({
  player,
  win,
  countUp,
  onPress,
}: {
  player: ScoreCardPlayer;
  win: boolean;
  countUp: boolean;
  onPress?: () => void;
}) {
  const delta = eloDelta(player.elo);
  const content = (
    <>
      <PlayerAvatar name={player.name} playerId={player.id} size={ROSTER_AVATAR} />
      <Text numberOfLines={1} style={[styles.rosterName, win ? styles.nameWin : null]}>
        {player.name.trim().split(/\s+/)[0] ?? player.name}
      </Text>
      {delta != null ? <EloDelta countUp={countUp} delta={delta} /> : null}
    </>
  );
  if (!onPress) return <View style={styles.rosterRow}>{content}</View>;
  return (
    <Pressable
      accessibilityHint="Opens this player's profile"
      accessibilityLabel={player.name}
      accessibilityRole="link"
      onPress={onPress}
      style={({ pressed }) => [styles.rosterRow, pressed ? styles.pressed : null]}
    >
      {content}
    </Pressable>
  );
}

function Roster({
  players,
  win,
  countUp,
  onPlayerPress,
}: {
  players: ScoreCardPlayer[];
  win: boolean;
  countUp: boolean;
  onPlayerPress?: (playerId: string) => void;
}) {
  return (
    <View style={styles.roster}>
      {players.map((player, index) => (
        <RosterRow
          countUp={countUp}
          key={player.id ?? `${player.name}-${index}`}
          onPress={
            player.id && onPlayerPress ? () => onPlayerPress(player.id as string) : undefined
          }
          player={player}
          win={win}
        />
      ))}
    </View>
  );
}

function Teams({
  leftPlayers,
  rightPlayers,
  leftScore,
  rightScore,
  leftStrong,
  rightStrong,
  hidden,
  split,
  countUp,
  onPlayerPress,
}: {
  leftPlayers: ScoreCardPlayer[];
  rightPlayers: ScoreCardPlayer[];
  leftScore: number | string;
  rightScore: number | string;
  leftStrong: boolean;
  rightStrong: boolean;
  hidden: boolean;
  split: ReturnType<typeof marginSplit>;
  countUp: boolean;
  onPlayerPress?: (playerId: string) => void;
}) {
  return (
    <View style={styles.teams}>
      <View style={styles.teamColumns}>
        <View style={styles.teamScore}>
          <ScoreText value={leftScore} win={leftStrong} />
        </View>
        <View style={styles.teamScore}>
          <ScoreText value={rightScore} win={rightStrong} />
        </View>
      </View>
      <MarginSlot hidden={hidden} split={split} />
      <View style={styles.teamColumns}>
        <Roster
          countUp={countUp}
          onPlayerPress={onPlayerPress}
          players={leftPlayers}
          win={leftStrong}
        />
        <Roster
          countUp={countUp}
          onPlayerPress={onPlayerPress}
          players={rightPlayers}
          win={rightStrong}
        />
        <View pointerEvents="none" style={styles.teamDivider} />
      </View>
    </View>
  );
}

// ── Compact (inbox) ─────────────────────────────────────────────────────────

function CompactEloDelta({ delta }: { delta: number }) {
  const { color, icon } = eloTone(delta);
  return (
    <View style={styles.compactEloRow}>
      <Feather color={color} name={icon} size={11} />
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
 *  - a state banner across the top edge, with the date: "FINAL · SEP 6"
 *  - "2V2 AT RANCHO" on one line
 *  - 1v1: the two players facing off (avatar, name, rating and its move), the
 *    scores under them, the margin line under that
 *  - teams: two columns, each with its score on top and a roster of players
 *    with their rating moves; the margin line between scores and rosters
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
  /** Tapping a player calls this with their id (full card only). */
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
      <GameStateBanner
        kind={kind}
        label={statusLabel ?? STATUS_LABEL[status]}
        trailing={compact ? undefined : bannerTrailing(playedOn, rightMeta)}
      />
    ) : null;

  if (compact) {
    const caption = [formatCardDate(playedOn), rightMeta].filter(Boolean).join(" · ");
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

  const solo = leftPlayers.length === 1 && rightPlayers.length === 1;

  return (
    <View style={[styles.card, kind === "action" ? styles.cardAction : null]}>
      {banner}
      <View style={styles.body}>
        <Text
          adjustsFontSizeToFit
          minimumFontScale={0.75}
          numberOfLines={1}
          style={styles.title}
        >
          {cardTitle(format, courtName)}
        </Text>

        {solo ? (
          <Faceoff
            countUp={countUp}
            hidden={scoresHidden}
            left={leftPlayers[0]}
            leftScore={shownLeft}
            leftStrong={leftStrong}
            onPlayerPress={namePress}
            right={rightPlayers[0]}
            rightScore={shownRight}
            rightStrong={rightStrong}
            split={split}
          />
        ) : (
          <Teams
            countUp={countUp}
            hidden={scoresHidden}
            leftPlayers={leftPlayers}
            leftScore={shownLeft}
            leftStrong={leftStrong}
            onPlayerPress={namePress}
            rightPlayers={rightPlayers}
            rightScore={shownRight}
            rightStrong={rightStrong}
            split={split}
          />
        )}

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
  title: {
    ...TextStyles.title,
    alignSelf: "stretch",
    color: Colors.text,
    letterSpacing: 0.6,
    textAlign: "center",
  },

  // Rating move: arrow + points, in green or red.
  eloLine: { flexDirection: "row", alignItems: "center", gap: Space.sm },
  eloDelta: { flexDirection: "row", alignItems: "center", gap: 2 },
  eloText: { fontVariant: ["tabular-nums"] },
  eloRating: { color: Colors.textSecondary },

  // Scores: the winner reads at full strength, the loser steps back.
  score: { ...TextStyles.displayLarge, fontVariant: ["tabular-nums"] },
  scoreWin: { color: Colors.text },
  scoreLose: { color: Colors.textSecondary },
  nameWin: { color: Colors.text },
  lineSlot: { minHeight: 16, justifyContent: "center" },
  hiddenNote: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Space.xs + 2,
  },
  hiddenNoteText: { ...TextStyles.metadata, color: Colors.muted },

  // 1v1: avatars facing off, the scores centred under each, the line below.
  faceoffBlock: { gap: Space.md },
  faceoff: { flexDirection: "row", alignItems: "flex-start" },
  faceoffPlayer: { flex: 1, minWidth: 0, alignItems: "center", gap: Space.xs + 2 },
  faceoffName: {
    ...TextStyles.label,
    alignSelf: "stretch",
    color: Colors.textSecondary,
    textAlign: "center",
  },
  faceoffScore: { flex: 1, minWidth: 0, alignItems: "center" },
  versus: {
    width: VERSUS_WIDTH,
    height: FACEOFF_AVATAR,
    alignItems: "center",
    justifyContent: "center",
  },
  versusText: { ...TextStyles.labelSmall, color: Colors.muted, letterSpacing: 1.2 },

  // Teams: score on top of each column, the line, then the rosters.
  teams: { gap: Space.md },
  teamColumns: { flexDirection: "row", gap: Space.lg },
  teamScore: { flex: 1, minWidth: 0, alignItems: "flex-start" },
  roster: { flex: 1, minWidth: 0, gap: Space.sm },
  rosterRow: {
    minHeight: ROSTER_AVATAR + Space.xs,
    flexDirection: "row",
    alignItems: "center",
    gap: Space.sm,
  },
  rosterName: {
    ...TextStyles.label,
    flex: 1,
    minWidth: 0,
    color: Colors.textSecondary,
  },
  teamDivider: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: "50%",
    width: StyleSheet.hairlineWidth,
    backgroundColor: Colors.borderLight,
  },

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
