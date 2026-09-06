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
 * not an ambient live number that ticks anywhere ELO happens to render. */
function EloChangeLine({ before, after }: { before: number; after: number }) {
  const [display, setDisplay] = React.useState(before);
  React.useEffect(() => {
    const timer = setTimeout(() => setDisplay(after), 500);
    return () => clearTimeout(timer);
  }, [after]);
  const delta = after - before;
  return (
    <View style={styles.eloLine}>
      <NumberFlow style={styles.eloValue} value={display} />
      <Text style={[styles.eloDelta, delta < 0 && styles.eloDeltaNegative]}>
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

/** One side of the compact box score: avatars, name + role, score, ELO. */
function ScoreRow({
  avatars,
  name,
  role,
  score,
  elo,
  winner,
}: {
  avatars: ScoreCardAvatar[];
  name: string;
  role: ScoreCardRole;
  score: number | string;
  elo: ScoreCardElo;
  winner: boolean;
}) {
  return (
    <View style={styles.scoreRow}>
      <View style={styles.avatarStack}>
        {avatars.slice(0, 3).map((avatar, index) => (
          <PlayerAvatar
            accent={role === "you"}
            key={avatar.id ?? `${avatar.name}-${index}`}
            name={avatar.name}
            playerId={avatar.id}
            size={32}
            style={index > 0 ? { marginLeft: -11 } : undefined}
          />
        ))}
      </View>
      <View style={styles.scoreRowIdentity}>
        <Text numberOfLines={1} style={styles.scoreRowName}>
          {name}
        </Text>
        {role ? (
          <Text style={styles.scoreRowRole}>
            {role === "you" ? "YOU" : "OPPONENT"}
          </Text>
        ) : null}
      </View>
      <View style={styles.scoreRowRight}>
        <Text
          style={[styles.scoreRowScore, winner && styles.scoreRowScoreWin]}
        >
          {score}
        </Text>
        {elo ? <EloChangeLine after={elo.after} before={elo.before} /> : null}
      </View>
    </View>
  );
}

/**
 * The one score + status card. Log Game's review step, the Inbox, and the
 * FINAL SCORE screen all render this so a game looks the same everywhere it
 * appears. Callers map their own data onto these props.
 *
 * With `leftAvatars` it's a compact box score: one row per side (avatars +
 * name + role + score, ELO animating in on confirm), context on a single
 * caption line — players first, not the court. Without avatars it keeps the
 * older stacked layout for callers that have no participant identities.
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
  const showBoxScore = Boolean(leftAvatars && leftAvatars.length > 0);
  const confirmedElo = status === "confirmed";
  const leftNum = Number(leftScore);
  const rightNum = Number(rightScore);
  const decided =
    Number.isFinite(leftNum) && Number.isFinite(rightNum) && leftNum !== rightNum;

  if (showBoxScore) {
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
              <Text
                numberOfLines={1}
                style={[styles.badgeText, { color: tone.text }]}
              >
                {statusLabel ?? STATUS_LABEL[status]}
              </Text>
            </View>
            <Text numberOfLines={1} style={styles.contextLine}>
              {courtName.toUpperCase()} ·{" "}
              {sport === "BASKETBALL" ? "BB" : "PB"} · {formatPlayedOn(playedOn)}
              {rightMeta ? ` · ${rightMeta}` : ""}
            </Text>
          </View>

          <View style={styles.boxScore}>
            <ScoreRow
              avatars={leftAvatars ?? []}
              elo={confirmedElo ? leftElo ?? null : null}
              name={leftLabel}
              role={leftRole}
              score={leftScore}
              winner={decided && leftNum > rightNum}
            />
            <View style={styles.boxDivider} />
            <ScoreRow
              avatars={rightAvatars ?? []}
              elo={confirmedElo ? rightElo ?? null : null}
              name={rightLabel}
              role={rightRole}
              score={rightScore}
              winner={decided && rightNum > leftNum}
            />
          </View>

          {note ? <Text style={styles.note}>{note}</Text> : null}
        </View>
      </View>
    );
  }

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
            <Text
              numberOfLines={1}
              style={[styles.badgeText, { color: tone.text }]}
            >
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

        <View style={[styles.scoreboard, compact && styles.scoreboardCompact]}>
          <View style={styles.side}>
            <Text numberOfLines={2} style={styles.sideName}>
              {leftLabel}
            </Text>
            <Text style={[styles.score, compact && styles.scoreCompact]}>
              {leftScore}
            </Text>
            {confirmedElo && leftElo ? (
              <EloChangeLine after={leftElo.after} before={leftElo.before} />
            ) : null}
          </View>
          <Text style={[styles.divider, compact && styles.dividerCompact]}>
            –
          </Text>
          <View style={styles.side}>
            <Text numberOfLines={2} style={styles.sideName}>
              {rightLabel}
            </Text>
            <Text style={[styles.score, compact && styles.scoreCompact]}>
              {rightScore}
            </Text>
            {confirmedElo && rightElo ? (
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
    gap: Space.sm,
  },
  badge: {
    minHeight: 24,
    flexShrink: 0,
    maxWidth: "58%",
    justifyContent: "center",
    paddingHorizontal: 9,
    borderWidth: 1,
    borderRadius: 12,
  },
  badgeText: { ...TextStyles.labelSmall, letterSpacing: 1.1 },
  rightMeta: {
    ...TextStyles.labelSmall,
    color: Colors.textSecondary,
    letterSpacing: 1.1,
  },
  contextLine: {
    flex: 1,
    minWidth: 0,
    textAlign: "right",
    fontFamily: TextStyles.metadata.fontFamily,
    fontSize: 10,
    letterSpacing: 0.6,
    color: Colors.muted,
  },

  // ── Compact box score (avatars + name + score per side) ──
  boxScore: {
    marginTop: Space.xs,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceDark,
  },
  boxDivider: { height: 1, backgroundColor: Colors.border },
  scoreRow: {
    minHeight: 60,
    paddingHorizontal: Space.md,
    paddingVertical: Space.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: Space.sm,
  },
  avatarStack: { flexDirection: "row", alignItems: "center" },
  scoreRowIdentity: { flex: 1, minWidth: 0, gap: 2 },
  scoreRowName: {
    ...TextStyles.label,
    color: Colors.text,
  },
  scoreRowRole: {
    ...TextStyles.labelSmall,
    color: Colors.textSecondary,
    letterSpacing: 1.3,
  },
  scoreRowRight: { alignItems: "flex-end", gap: 2 },
  scoreRowScore: {
    fontFamily: TextStyles.displayLarge.fontFamily,
    fontSize: 34,
    lineHeight: 38,
    color: Colors.textSecondary,
    fontVariant: ["tabular-nums"],
  },
  scoreRowScoreWin: { color: Colors.text },

  court: {
    ...TextStyles.title,
    color: Colors.text,
    marginTop: Space.xs,
  },
  detail: { ...TextStyles.metadata, color: Colors.textSecondary },
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
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
  },
  eloValue: {
    ...TextStyles.labelSmall,
    color: Colors.textSecondary,
  },
  eloDelta: {
    ...TextStyles.labelSmall,
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
