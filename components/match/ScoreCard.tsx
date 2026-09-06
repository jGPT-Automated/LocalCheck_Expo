import { NumberFlow } from "number-flow-react-native";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { PlayerAvatar } from "@/components/PlayerAvatar";
import { Colors, Radius } from "@/constants/colors";
import { Layout, Space } from "@/constants/layout";
import { TextStyles } from "@/constants/typography";
import type { CourtSport } from "@/constants/data";

/** Plays the before -> after ELO transition once the card mounts. This is
 * the one deliberate place ELO animates: the moment a score is confirmed,
 * not an ambient live number that ticks anywhere ELO happens to render.
 * `big` renders it prominently inside the player box (the animation is the
 * point of the confirmed card); the small variant sits under a bare score. */
function EloChangeLine({
  before,
  after,
  big = false,
}: {
  before: number;
  after: number;
  big?: boolean;
}) {
  const [display, setDisplay] = React.useState(before);
  React.useEffect(() => {
    const timer = setTimeout(() => setDisplay(after), 500);
    return () => clearTimeout(timer);
  }, [after]);
  const delta = after - before;
  return (
    <View style={[styles.eloLine, big && styles.eloLineBig]}>
      <NumberFlow
        style={big ? styles.eloValueBig : styles.eloValue}
        value={display}
      />
      <Text
        style={[
          big ? styles.eloDeltaBig : styles.eloDelta,
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
export type ScoreCardAvatar = { id?: string; name: string };
type ScoreCardElo = { before: number; after: number } | null;

const TONE: Record<
  ScoreCardStatus,
  { bg: string; border: string; text: string }
> = {
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

function formatPlayedOn(value: string): string {
  const date =
    value.length === 10 ? new Date(`${value}T12:00:00`) : new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date
    .toLocaleDateString("en-US", { month: "short", day: "numeric" })
    .toUpperCase();
}

function PlayerColumn({
  avatars,
  label,
  role,
  elo,
  compact,
}: {
  avatars: ScoreCardAvatar[];
  label: string;
  role: ScoreCardRole;
  elo: ScoreCardElo;
  compact: boolean;
}) {
  const size = compact ? 30 : 46;
  return (
    <View style={styles.playerCol}>
      <View style={styles.avatarStack}>
        {avatars.slice(0, 3).map((avatar, index) => (
          <PlayerAvatar
            accent={role === "you"}
            key={avatar.id ?? `${avatar.name}-${index}`}
            name={avatar.name}
            playerId={avatar.id}
            size={size}
            style={index > 0 ? { marginLeft: -size * 0.34 } : undefined}
          />
        ))}
      </View>
      <Text numberOfLines={1} style={styles.playerName}>
        {label}
      </Text>
      {role ? (
        <Text style={styles.playerRole}>
          {role === "you" ? "YOU" : "OPPONENT"}
        </Text>
      ) : null}
      {elo ? (
        <EloChangeLine after={elo.after} before={elo.before} big />
      ) : null}
    </View>
  );
}

/**
 * The one score + status card. Log Game's review step, the Inbox, and the
 * FINAL SCORE screen all render this so a game looks the same everywhere it
 * appears. Callers map their own data onto these props; the card owns the
 * status tone, the score hierarchy, and the optional countdown above it.
 *
 * When `leftAvatars` is supplied the card is player-first: a box of avatars +
 * YOU / OPPONENT role above the score, and the confirmed-ELO animation moves
 * into that box (see PlayerColumn). Callers without participant identities
 * (older Log Game paths) keep the plain name-in-scoreboard layout.
 */
export function ScoreCard({
  status,
  statusLabel,
  courtName,
  sport,
  playedOn,
  leftLabel,
  rightLabel,
  leftScore,
  rightScore,
  leftElo,
  rightElo,
  leftAvatars,
  rightAvatars,
  leftRole = null,
  rightRole = null,
  note,
  countdown,
  rightMeta,
  compact = false,
}: {
  status: ScoreCardStatus;
  /** Viewer-aware override for the badge text ("YOUR APPROVAL", "WAITING ON
   * JESSE"…). Tone still comes from `status`. Falls back to STATUS_LABEL. */
  statusLabel?: string;
  courtName: string;
  sport: CourtSport;
  playedOn: string;
  leftLabel: string;
  rightLabel: string;
  leftScore: number | string;
  rightScore: number | string;
  /** Only rendered (with an animated transition) when status is "confirmed". */
  leftElo?: ScoreCardElo;
  rightElo?: ScoreCardElo;
  leftAvatars?: ScoreCardAvatar[];
  rightAvatars?: ScoreCardAvatar[];
  leftRole?: ScoreCardRole;
  rightRole?: ScoreCardRole;
  note?: string;
  countdown?: { label: string; value: string } | null;
  rightMeta?: string;
  compact?: boolean;
}) {
  const tone = TONE[status];
  const showPlayerBox = Boolean(leftAvatars && leftAvatars.length > 0);
  const confirmedElo = status === "confirmed";
  return (
    <View style={styles.wrap}>
      {countdown ? (
        <View accessibilityLiveRegion="polite" style={styles.countdown}>
          <Text style={styles.countdownLabel}>{countdown.label}</Text>
          <Text style={styles.countdownValue}>{countdown.value}</Text>
        </View>
      ) : null}

      <View style={[styles.card, compact && styles.cardCompact]}>
        <View style={styles.metaRow}>
          <View
            style={[
              styles.badge,
              { backgroundColor: tone.bg, borderColor: tone.border },
            ]}
          >
            <Text numberOfLines={1} style={[styles.badgeText, { color: tone.text }]}>
              {statusLabel ?? STATUS_LABEL[status]}
            </Text>
          </View>
          {rightMeta ? <Text style={styles.rightMeta}>{rightMeta}</Text> : null}
        </View>

        <Text numberOfLines={2} style={styles.court}>
          {courtName.toUpperCase()}
        </Text>
        <Text style={styles.detail}>
          {sport === "BASKETBALL" ? "BB" : "PB"} · {formatPlayedOn(playedOn)}
        </Text>

        {showPlayerBox ? (
          <View
            style={[styles.playerBox, compact && styles.playerBoxCompact]}
          >
            <PlayerColumn
              avatars={leftAvatars ?? []}
              compact={compact}
              elo={confirmedElo ? leftElo ?? null : null}
              label={leftLabel}
              role={leftRole}
            />
            <Text style={styles.vs}>VS</Text>
            <PlayerColumn
              avatars={rightAvatars ?? []}
              compact={compact}
              elo={confirmedElo ? rightElo ?? null : null}
              label={rightLabel}
              role={rightRole}
            />
          </View>
        ) : null}

        <View style={[styles.scoreboard, compact && styles.scoreboardCompact]}>
          <View style={styles.side}>
            {showPlayerBox ? null : (
              <Text numberOfLines={2} style={styles.sideName}>
                {leftLabel}
              </Text>
            )}
            <Text style={[styles.score, compact && styles.scoreCompact]}>
              {leftScore}
            </Text>
            {!showPlayerBox && confirmedElo && leftElo ? (
              <EloChangeLine after={leftElo.after} before={leftElo.before} />
            ) : null}
          </View>
          <Text style={[styles.divider, compact && styles.dividerCompact]}>
            –
          </Text>
          <View style={styles.side}>
            {showPlayerBox ? null : (
              <Text numberOfLines={2} style={styles.sideName}>
                {rightLabel}
              </Text>
            )}
            <Text style={[styles.score, compact && styles.scoreCompact]}>
              {rightScore}
            </Text>
            {!showPlayerBox && confirmedElo && rightElo ? (
              <EloChangeLine after={rightElo.after} before={rightElo.before} />
            ) : null}
          </View>
        </View>

        {note ? <Text style={styles.note}>{note}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    maxWidth: Layout.maxContentWidth,
    alignSelf: "center",
    gap: Space.lg,
  },
  countdown: { alignItems: "center", gap: Space.xs, paddingTop: Space.sm },
  countdownLabel: {
    ...TextStyles.labelSmall,
    color: Colors.textSecondary,
    letterSpacing: 1.8,
  },
  countdownValue: {
    ...TextStyles.display,
    color: Colors.text,
    fontVariant: ["tabular-nums"],
  },
  card: {
    gap: Space.sm,
    padding: Space.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: Radius.card,
    backgroundColor: Colors.surface,
  },
  cardCompact: { padding: Space.md, gap: Space.xs },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Space.md,
  },
  badge: {
    minHeight: 26,
    maxWidth: "72%",
    justifyContent: "center",
    paddingHorizontal: 10,
    borderWidth: 1,
    borderRadius: 13,
  },
  badgeText: { ...TextStyles.labelSmall, letterSpacing: 1.2 },
  rightMeta: {
    ...TextStyles.labelSmall,
    color: Colors.textSecondary,
    letterSpacing: 1.1,
  },
  court: {
    ...TextStyles.title,
    color: Colors.text,
    marginTop: Space.xs,
  },
  detail: { ...TextStyles.metadata, color: Colors.textSecondary },

  // ── Player box: avatars + role, player-first per the score-review mock ──
  playerBox: {
    marginTop: Space.md,
    paddingVertical: Space.md,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: Space.sm,
  },
  playerBoxCompact: { marginTop: Space.sm, paddingVertical: Space.sm },
  playerCol: { flex: 1, minWidth: 0, alignItems: "center", gap: 6 },
  avatarStack: { flexDirection: "row", alignItems: "center" },
  playerName: {
    ...TextStyles.label,
    color: Colors.text,
    textAlign: "center",
  },
  playerRole: {
    ...TextStyles.labelSmall,
    color: Colors.textSecondary,
    letterSpacing: 1.4,
  },
  vs: {
    ...TextStyles.labelSmall,
    marginTop: 18,
    color: Colors.mutedDark,
    letterSpacing: 1.5,
  },

  scoreboard: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Space.md,
    paddingVertical: Space.lg,
  },
  scoreboardCompact: { marginTop: Space.xs, paddingVertical: Space.sm },
  side: { flex: 1, minWidth: 0, alignItems: "center", gap: Space.sm },
  sideName: {
    ...TextStyles.label,
    minHeight: 32,
    color: Colors.textSecondary,
    textAlign: "center",
  },
  score: {
    ...TextStyles.displayLarge,
    fontSize: 60,
    lineHeight: 68,
    color: Colors.text,
    fontVariant: ["tabular-nums"],
  },
  scoreCompact: { fontSize: 34, lineHeight: 40 },
  eloLine: {
    marginTop: 2,
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
  },
  eloLineBig: { marginTop: 4, gap: 6 },
  eloValue: {
    ...TextStyles.labelSmall,
    color: Colors.textSecondary,
  },
  eloValueBig: {
    ...TextStyles.metadata,
    fontSize: 15,
    color: Colors.text,
  },
  eloDelta: {
    ...TextStyles.labelSmall,
    color: Colors.accent,
  },
  eloDeltaBig: {
    ...TextStyles.label,
    fontSize: 13,
    color: Colors.accent,
  },
  eloDeltaNegative: { color: Colors.loss },
  divider: { ...TextStyles.title, color: Colors.mutedDark },
  dividerCompact: { ...TextStyles.body, color: Colors.mutedDark },
  note: {
    ...TextStyles.bodySmall,
    color: Colors.textSecondary,
    textAlign: "center",
  },
});
