import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MatchReviewCard } from "@/components/match/MatchReviewCard";
import { CompactSelect } from "@/components/ui/CompactSelect";
import { RecentDatePicker } from "@/components/ui/RecentDatePicker";
import { StickyActionBar } from "@/components/ui/StickyActionBar";
import { Colors, Radius } from "@/constants/colors";
import type { Court } from "@/constants/data";
import { Layout, Space } from "@/constants/layout";
import { TextStyles } from "@/constants/typography";
import type { MatchReview } from "@/services/gameService";

function localDateValue(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

/**
 * The dispute / update step of the FINAL SCORE screen. It is the screen body
 * while editing — not a drawer over it — so the flow stays on one surface: the
 * game up top for reference, the correction below it, one sticky action bar.
 */
export function MatchRevisionForm({
  courts,
  match,
  viewerId,
  onCancel,
  onSubmit,
  mode = "update",
  working,
}: {
  courts: Court[];
  match: MatchReview;
  viewerId?: string;
  onCancel: () => void;
  onSubmit: (change: {
    courtId: string;
    scoreA: number;
    scoreB: number;
    playedOn: string;
    note: string;
  }) => void;
  mode?: "update" | "dispute";
  working: boolean;
}) {
  const { bottom } = useSafeAreaInsets();
  const supportedCourts = React.useMemo(
    () =>
      courts.filter(
        (court) => court.sport === "BASKETBALL" || court.sport === "PICKLEBALL",
      ),
    [courts],
  );
  const courtOptions = React.useMemo(() => {
    const options = supportedCourts.map((court) => ({
      label: court.name,
      value: court.id,
    }));
    if (!options.some((option) => option.value === match.courtId)) {
      options.unshift({ label: match.courtName, value: match.courtId });
    }
    return options;
  }, [match.courtId, match.courtName, supportedCourts]);

  const [courtId, setCourtId] = React.useState(match.courtId);
  const [scoreA, setScoreA] = React.useState(String(match.scoreA));
  const [scoreB, setScoreB] = React.useState(String(match.scoreB));
  const [playedOn, setPlayedOn] = React.useState(
    localDateValue(new Date(match.playedAt)),
  );
  const [note, setNote] = React.useState("");

  const nameFor = (side: "a" | "b") =>
    match.participants
      .filter((participant) => participant.side === side)
      .map((participant) =>
        participant.id === viewerId
          ? "YOU"
          : participant.name.split(" ")[0].toUpperCase(),
      )
      .join(" · ") || (side === "a" ? "SIDE A" : "SIDE B");

  const a = Number(scoreA);
  const b = Number(scoreB);
  const valid =
    Number.isInteger(a) &&
    Number.isInteger(b) &&
    a >= 0 &&
    b >= 0 &&
    a !== b &&
    Boolean(courtId);
  const changed =
    courtId !== match.courtId ||
    a !== match.scoreA ||
    b !== match.scoreB ||
    playedOn !== localDateValue(new Date(match.playedAt));
  const canSubmit =
    valid && (changed || (mode === "dispute" && note.trim().length > 0));

  return (
    <View style={styles.flex}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 150 + bottom }]}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <MatchReviewCard compact match={match} viewerId={viewerId} />

        <View style={styles.field}>
          <Text style={styles.label}>CORRECTED SCORE</Text>
          <View style={styles.scoreRow}>
            <ScoreBox label={nameFor("a")} onChange={setScoreA} value={scoreA} />
            <Text style={styles.dash}>–</Text>
            <ScoreBox label={nameFor("b")} onChange={setScoreB} value={scoreB} />
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>DATE</Text>
          <RecentDatePicker
            accessibilityLabel="Corrected game date"
            daysBack={14}
            onChange={setPlayedOn}
            value={playedOn}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>COURT</Text>
          <CompactSelect
            accessibilityLabel="Select corrected court"
            onChange={setCourtId}
            options={courtOptions}
            value={courtId}
            wide
          />
        </View>

        {mode === "dispute" ? (
          <View style={styles.field}>
            <Text style={styles.label}>WHAT CHANGED? (OPTIONAL)</Text>
            <TextInput
              accessibilityLabel="Dispute note"
              maxLength={280}
              multiline
              onChangeText={setNote}
              placeholder="Wrong score, wrong court, wrong day…"
              placeholderTextColor={Colors.muted}
              style={styles.noteInput}
              textAlignVertical="top"
              value={note}
            />
            <Text style={styles.helper}>
              Add a note or change a detail above to submit.
            </Text>
          </View>
        ) : null}

        <View style={styles.notice}>
          <Feather color={Colors.accent} name="refresh-cw" size={16} />
          <Text style={styles.noticeText}>
            Submitting notifies every player and starts a fresh 3-day review.
          </Text>
        </View>
      </ScrollView>

      <StickyActionBar
        bottomInset={bottom}
        primary={{
          disabled: !canSubmit || working,
          icon: "send",
          label: working
            ? "SUBMITTING…"
            : mode === "dispute"
              ? "SUBMIT DISPUTE"
              : "SUBMIT UPDATE",
          onPress: () =>
            onSubmit({
              courtId,
              scoreA: a,
              scoreB: b,
              playedOn,
              note: note.trim(),
            }),
        }}
        secondary={{ label: "CANCEL", onPress: onCancel }}
      />
    </View>
  );
}

function ScoreBox({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <View style={styles.scoreSide}>
      <Text numberOfLines={1} style={styles.scoreLabel}>
        {label}
      </Text>
      <View style={styles.scoreBox}>
        <TextInput
          accessibilityLabel={`${label} corrected score`}
          keyboardType="number-pad"
          maxLength={3}
          onChangeText={(next) => onChange(next.replace(/\D/g, ""))}
          selectTextOnFocus
          style={styles.scoreBoxInput}
          value={value}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    width: "100%",
    maxWidth: Layout.maxContentWidth + Layout.screenGutter * 2,
    alignSelf: "center",
    padding: Layout.screenGutter,
    gap: Space.xl,
  },
  field: { gap: Space.sm },
  label: {
    ...TextStyles.labelSmall,
    color: Colors.textSecondary,
    letterSpacing: 1.5,
  },
  scoreRow: { flexDirection: "row", alignItems: "flex-end", gap: Space.md },
  scoreSide: { flex: 1, alignItems: "center", gap: Space.sm },
  scoreLabel: {
    ...TextStyles.labelSmall,
    color: Colors.textSecondary,
    letterSpacing: 1,
    textAlign: "center",
    maxWidth: "100%",
  },
  scoreBox: {
    width: "100%",
    height: 84,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
  },
  scoreBoxInput: {
    width: "100%",
    padding: 0,
    ...TextStyles.display,
    color: Colors.text,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  dash: { ...TextStyles.title, color: Colors.mutedDark, paddingBottom: 28 },
  notice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Space.md,
    padding: Space.lg,
    borderRadius: Radius.lg,
    backgroundColor: Colors.accentDim,
  },
  noticeText: { ...TextStyles.bodySmall, flex: 1, color: Colors.textSecondary },
  noteInput: {
    minHeight: 88,
    padding: Space.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    ...TextStyles.bodySmall,
    color: Colors.text,
  },
  helper: { ...TextStyles.caption, color: Colors.muted },
});
