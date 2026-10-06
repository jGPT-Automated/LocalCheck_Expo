import React, { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { BrutalistButton } from "@/components/BrutalistButton";
import { RunFlowSheet } from "@/components/sheet/RunFlowSheet";
import { Colors } from "@/constants/colors";
import { Space } from "@/constants/layout";
import { TextStyles, Typography } from "@/constants/typography";
import { dayLabel, firstName, upcomingDays } from "@/lib/challengeModel";
import { createChallenge } from "@/services/challengeService";

import { ChoiceChips } from "./ChoiceChips";

type CourtOption = { id: string; name: string };

const ANY = "any";

/**
 * Send a challenge from another player's profile: court (optional), day
 * (optional), ranked or casual. Friends only — the profile screen checks that
 * before opening this.
 */
export function ChallengeSheet({
  visible,
  onClose,
  opponent,
  courts,
  onSent,
}: {
  visible: boolean;
  onClose: () => void;
  opponent: { id: string; name: string };
  /** Court choices in order: your local court, then theirs if different. */
  courts: CourtOption[];
  onSent: (challengeId: string) => void;
}) {
  const days = useMemo(() => upcomingDays(7), []);
  const [courtId, setCourtId] = useState<string>(courts[0]?.id ?? ANY);
  const [playOn, setPlayOn] = useState<string>(ANY);
  const [ranked, setRanked] = useState<"ranked" | "casual">("ranked");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = firstName(opponent.name);

  const send = async () => {
    if (sending) return;
    setSending(true);
    setError(null);
    const result = await createChallenge({
      opponentId: opponent.id,
      courtId: courtId === ANY ? null : courtId,
      playOn: playOn === ANY ? null : playOn,
      ranked: ranked === "ranked",
    });
    setSending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onSent(result.value);
  };

  return (
    <RunFlowSheet
      dynamic
      eyebrow="1V1"
      onClose={onClose}
      title={`Challenge ${name}`}
      visible={visible}
    >
      <Text style={styles.label}>COURT</Text>
      <ChoiceChips
        choices={[
          ...courts.map((court) => ({ value: court.id, label: court.name })),
          { value: ANY, label: "Decide later" },
        ]}
        onChange={setCourtId}
        scroll
        value={courtId}
      />

      <Text style={styles.label}>DAY</Text>
      <ChoiceChips
        choices={[
          { value: ANY, label: "Any day" },
          ...days.map((day) => ({ value: day, label: dayLabel(day) })),
        ]}
        onChange={setPlayOn}
        scroll
        value={playOn}
      />

      <Text style={styles.label}>GAME</Text>
      <ChoiceChips
        choices={[
          { value: "ranked", label: "Ranked" },
          { value: "casual", label: "Casual" },
        ]}
        onChange={setRanked}
        value={ranked}
      />
      <Text style={styles.hint}>
        {ranked === "ranked"
          ? `ELO moves once ${name} confirms the score.`
          : "Counts in your head to head. No ELO change."}
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <BrutalistButton
        label={sending ? "SENDING…" : "SEND CHALLENGE"}
        onPress={() => void send()}
        style={styles.send}
        variant="accent"
      />
      <Text style={styles.footnote}>
        {name} gets it in their inbox. After you play, either of you logs the score.
      </Text>
    </RunFlowSheet>
  );
}

const styles = StyleSheet.create({
  label: {
    marginTop: Space.xl,
    marginBottom: Space.sm,
    fontFamily: Typography.bodyBold,
    fontSize: 11,
    letterSpacing: 2,
    color: Colors.muted,
  },
  hint: { ...TextStyles.metadata, marginTop: Space.sm, color: Colors.textSecondary },
  error: { ...TextStyles.metadata, marginTop: Space.lg, color: Colors.loss },
  send: { marginTop: Space.xl, minHeight: 52 },
  footnote: { ...TextStyles.caption, marginTop: Space.md, color: Colors.muted, textAlign: "center" },
});
