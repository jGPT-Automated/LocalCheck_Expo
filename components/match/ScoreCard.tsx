import { NumberFlow } from "number-flow-react-native";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { PlayerAvatar } from "@/components/PlayerAvatar";
import { Colors, Radius } from "@/constants/colors";
import { Layout, Space } from "@/constants/layout";
import { TextStyles } from "@/constants/typography";

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
  return (
    <View style={styles.eloLine}>
      {/* ELO is a rating, not a quantity — no thousands separator. */}
      <NumberFlow
        format={ELO_NUMBER_FORMAT}
        style={compact ? styles.eloValueCompact : styles.eloValue}
        value={display}
      />
      <Text
        style={[
          styles.eloDelta,
          compact && styles.eloValueCompact,
          delta < 0 && styles.eloDeltaNegative,
        ]}
      >
        {delta >= 0 ? "+" : ""}
        {delta}
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

const firstName = (name: string) => name.split(" ")[0].toUpperCase();

function WinBadge() {
  return (
    <View style={styles.winBadge}>
      <Text style={styles.winBadgeText}>WIN</Text>
    </View>
  );
}

/**
 * One side of the matchup, centred in its half of the box. The identity
 * cluster (avatar, name, ELO move) sits above the big score:
 *  - 1v1: one avatar, the player's name, their ELO line, then the score.
 *    No "YOU / OPPONENT" — the accent ring on the viewer's avatar is the tell.
 *  - team: `teamLabel` over the score, then an avatar + name + ELO row per
 *    member.
 */
function SideColumn({
  teamLabel,
  score,
  players,
  isYou,
  winner,
  winBadge,
  compact,
}: {
  teamLabel: string;
  score: number | string;
  players: ScoreCardPlayer[];
  isYou: boolean;
  winner: boolean;
  winBadge: boolean;
  compact: boolean;
}) {
  const solo = players.length === 1 ? players[0] : null;
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
        <PlayerAvatar
          accent={isYou}
          name={solo.name}
          playerId={solo.id}
          size={compact ? 30 : 40}
        />
        <Text numberOfLines={1} style={styles.sideName}>
          {firstName(solo.name)}
        </Text>
        {solo.elo ? (
          <EloChangeLine
            after={solo.elo.after}
            before={solo.elo.before}
            compact={compact}
          />
        ) : null}
        {scoreEl}
        {winBadge ? <WinBadge /> : null}
      </View>
    );
  }

  return (
    <View style={styles.sideCol}>
      <Text numberOfLines={1} style={styles.sideLabel}>
        {teamLabel}
      </Text>
      {scoreEl}
      {winBadge ? <WinBadge /> : null}
      <View style={styles.sidePlayers}>
        {players.map((player, index) => (
          <View
            key={player.id ?? `${player.name}-${index}`}
            style={styles.playerRow}
          >
            <PlayerAvatar
              accent={isYou}
              name={player.name}
              playerId={player.id}
              size={compact ? 20 : 24}
            />
            <View style={styles.playerText}>
              <Text numberOfLines={1} style={styles.playerName}>
                {firstName(player.name)}
              </Text>
              {player.elo ? (
                <EloChangeLine
                  after={player.elo.after}
                  before={player.elo.before}
                  compact={compact}
                />
              ) : null}
            </View>
          </View>
        ))}
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
  leftRole = null,
  rightRole = null,
  note,
  rightMeta,
  compact = false,
}: {
  status: ScoreCardStatus;
  /** Viewer-aware override for the banner text ("YOUR APPROVAL", "WAITING ON
   * JESSE"…). Tone still comes from `status`. Falls back to STATUS_LABEL. */
  statusLabel?: string;
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
  leftRole?: ScoreCardRole;
  rightRole?: ScoreCardRole;
  note?: string;
  rightMeta?: string;
  compact?: boolean;
}) {
  const tone = TONE[status];
  const leftNum = Number(leftScore);
  const rightNum = Number(rightScore);
  const decided =
    Number.isFinite(leftNum) && Number.isFinite(rightNum) && leftNum !== rightNum;

  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        {statusPlacement === "card" ? (
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
          <Text numberOfLines={1} style={styles.contextLine}>
            {courtName.toUpperCase()}
            {format ? ` · ${format}` : ""} · {formatPlayedOn(playedOn)}
            {rightMeta ? ` · ${rightMeta}` : ""}
          </Text>

          <View style={styles.matchup}>
            <SideColumn
              compact={compact}
              isYou={leftRole === "you"}
              players={leftPlayers}
              score={leftScore}
              teamLabel={leftLabel}
              winBadge={decided && leftNum > rightNum && status === "confirmed"}
              winner={decided && leftNum > rightNum}
            />
            <View style={styles.sideDivider} />
            <SideColumn
              compact={compact}
              isYou={rightRole === "you"}
              players={rightPlayers}
              score={rightScore}
              teamLabel={rightLabel}
              winBadge={decided && rightNum > leftNum && status === "confirmed"}
              winner={decided && rightNum > leftNum}
            />
          </View>

          {note ? <Text style={styles.note}>{note}</Text> : null}
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
  cardBody: { padding: Space.lg, gap: Space.md },
  cardBodyCompact: { padding: Space.md, gap: Space.sm },

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

  // ── Matchup: two side-by-side columns ──
  matchup: {
    flexDirection: "row",
    alignItems: "stretch",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceDark,
    overflow: "hidden",
  },
  sideDivider: { width: 1, backgroundColor: Colors.border },
  sideCol: {
    flex: 1,
    minWidth: 0,
    paddingVertical: Space.md,
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
  winBadge: {
    marginTop: 2,
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
  playerRow: {
    maxWidth: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  playerText: { flexShrink: 1, minWidth: 0, alignItems: "center" },
  playerName: {
    fontFamily: TextStyles.label.fontFamily,
    fontSize: 11,
    letterSpacing: 0.4,
    color: Colors.text,
    textAlign: "center",
  },

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
  eloDelta: { ...TextStyles.labelSmall, color: Colors.accent },
  eloDeltaNegative: { color: Colors.loss },
  note: {
    ...TextStyles.bodySmall,
    color: Colors.textSecondary,
    textAlign: "center",
  },
});
