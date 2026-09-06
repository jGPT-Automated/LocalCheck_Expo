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
      {/* ELO is a rating, not a quantity — no thousands separator. */}
      <NumberFlow
        format={ELO_NUMBER_FORMAT}
        style={styles.eloValue}
        value={display}
      />
      <Text style={[styles.eloDelta, delta < 0 && styles.eloDeltaNegative]}>
        {delta >= 0 ? "+" : ""}
        {delta}
      </Text>
    </View>
  );
}

const ELO_NUMBER_FORMAT = { useGrouping: false } as const;

export type ScoreCardStatus =
  | "draft"
  | "pending"
  | "held"
  | "confirmed"
  | "voided";

export type ScoreCardRole = "you" | "opponent" | null;
export type ScoreCardAvatar = { id?: string; name: string };
type ScoreCardElo = { before: number; after: number } | null;

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

/**
 * One side of the compact box score. The name (and its ELO line on a
 * confirmed game) sit in the middle column; the score is the middle-aligned
 * hero on the right. No "YOU / OPPONENT" text — the accent ring on the
 * viewer's avatar carries that.
 */
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
        {elo ? <EloChangeLine after={elo.after} before={elo.before} /> : null}
      </View>
      <View style={styles.scoreRowRight}>
        <Text
          style={[styles.scoreRowScore, winner && styles.scoreRowScoreWin]}
        >
          {score}
        </Text>
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
  statusPlacement = "card",
}: {
  status: ScoreCardStatus;
  /** Viewer-aware override for the badge text ("YOUR APPROVAL", "WAITING ON
   * JESSE"…). Tone still comes from `status`. Falls back to STATUS_LABEL. */
  statusLabel?: string;
  /** "card" = a thin status banner across the card's top edge. "none" = the
   * screen owns the status (and any timer/explainer) above the card, so the
   * card is only the game. */
  statusPlacement?: "card" | "none";
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
            {courtName.toUpperCase()} ·{" "}
            {sport === "BASKETBALL" ? "BB" : "PB"} · {formatPlayedOn(playedOn)}
            {rightMeta ? ` · ${rightMeta}` : ""}
          </Text>

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
      </View>
    );
  }

  // Every caller passes participant identities now, so the box score above is
  // the only path. Fall back to a bare labelled score if that ever changes.
  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
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
        <View style={styles.cardBody}>
          <Text numberOfLines={1} style={styles.contextLine}>
            {courtName.toUpperCase()} ·{" "}
            {sport === "BASKETBALL" ? "BB" : "PB"} · {formatPlayedOn(playedOn)}
          </Text>
          <View style={styles.boxScore}>
            <ScoreRow
              avatars={[]}
              elo={confirmedElo ? leftElo ?? null : null}
              name={leftLabel}
              role={leftRole}
              score={leftScore}
              winner={decided && leftNum > rightNum}
            />
            <View style={styles.boxDivider} />
            <ScoreRow
              avatars={[]}
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
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: Radius.card,
    backgroundColor: Colors.surface,
    overflow: "hidden",
  },
  cardBody: { padding: Space.lg, gap: Space.sm },
  cardBodyCompact: { padding: Space.md, gap: Space.xs },
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

  // ── Compact box score (avatars + name + score per side) ──
  boxScore: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceDark,
  },
  boxDivider: { height: 1, backgroundColor: Colors.border },
  scoreRow: {
    minHeight: 58,
    paddingHorizontal: Space.md,
    paddingVertical: Space.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: Space.sm,
  },
  avatarStack: { flexDirection: "row", alignItems: "center" },
  scoreRowIdentity: { flex: 1, minWidth: 0, gap: 3 },
  scoreRowName: {
    ...TextStyles.label,
    color: Colors.text,
  },
  scoreRowRight: { minWidth: 40, alignItems: "flex-end" },
  scoreRowScore: {
    fontFamily: TextStyles.displayLarge.fontFamily,
    fontSize: 32,
    lineHeight: 34,
    color: Colors.textSecondary,
    fontVariant: ["tabular-nums"],
  },
  scoreRowScoreWin: { color: Colors.text },

  eloLine: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
  },
  eloValue: {
    ...TextStyles.labelSmall,
    color: Colors.textSecondary,
    fontVariant: ["tabular-nums"],
  },
  eloDelta: {
    ...TextStyles.labelSmall,
    color: Colors.accent,
  },
  eloDeltaNegative: { color: Colors.loss },
  note: {
    ...TextStyles.bodySmall,
    color: Colors.textSecondary,
    textAlign: "center",
  },
});
