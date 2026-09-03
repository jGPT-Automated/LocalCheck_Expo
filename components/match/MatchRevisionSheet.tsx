import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { FormSheet } from "@/components/sheet/FormSheet";
import { CompactSelect } from "@/components/ui/CompactSelect";
import { StickyActionBar } from "@/components/ui/StickyActionBar";
import { WeekDatePicker } from "@/components/ui/WeekDatePicker";
import { Colors, Radius } from "@/constants/colors";
import type { Court } from "@/constants/data";
import { Space } from "@/constants/layout";
import { TextStyles } from "@/constants/typography";
import type { MatchReview } from "@/services/gameService";

function localDateValue(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

export function MatchRevisionSheet({
  courts,
  match,
  onClose,
  onSubmit,
  mode = "update",
  visible,
  working,
}: {
  courts: Court[];
  match: MatchReview;
  onClose: () => void;
  onSubmit: (change: {
    courtId: string;
    scoreA: number;
    scoreB: number;
    playedOn: string;
    note: string;
  }) => void;
  mode?: "update" | "dispute";
  visible: boolean;
  working: boolean;
}) {
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
  const a = Number(scoreA);
  const b = Number(scoreB);
  const valid =
    Number.isInteger(a) &&
    Number.isInteger(b) &&
    a >= 0 &&
    b >= 0 &&
    a !== b &&
    Boolean(courtId);

  React.useEffect(() => {
    if (!visible) return;
    setCourtId(match.courtId);
    setScoreA(String(match.scoreA));
    setScoreB(String(match.scoreB));
    setPlayedOn(localDateValue(new Date(match.playedAt)));
    setNote("");
  }, [match, visible]);

  const changed =
    courtId !== match.courtId ||
    a !== match.scoreA ||
    b !== match.scoreB ||
    playedOn !== localDateValue(new Date(match.playedAt));
  const canSubmit =
    valid && (changed || (mode === "dispute" && note.trim().length > 0));

  return (
    <FormSheet
      eyebrow="DISPUTE RESOLUTION"
      onClose={onClose}
      title={mode === "dispute" ? "DISPUTE SCORE" : "UPDATE GAME"}
      visible={visible}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
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
              <Text style={styles.label}>NOTE (OPTIONAL)</Text>
              <TextInput
                accessibilityLabel="Dispute note"
                multiline
                maxLength={280}
                onChangeText={setNote}
                placeholder="What needs correcting?"
                placeholderTextColor={Colors.muted}
                style={styles.noteInput}
                textAlignVertical="top"
                value={note}
              />
              <Text style={styles.helper}>
                Add a note or change a game detail to submit.
              </Text>
            </View>
          ) : null}

          <View style={styles.field}>
            <Text style={styles.label}>DATE</Text>
            <WeekDatePicker
              accessibilityLabel="Corrected game date"
              onChange={setPlayedOn}
              value={playedOn}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>CORRECTED FINAL SCORE</Text>
            <View style={styles.scoreRow}>
              <ScoreInput label="SIDE A" onChange={setScoreA} value={scoreA} />
              <Text style={styles.dash}>–</Text>
              <ScoreInput label="SIDE B" onChange={setScoreB} value={scoreB} />
            </View>
          </View>

          <View style={styles.notice}>
            <Feather color={Colors.accent} name="refresh-cw" size={16} />
            <Text style={styles.noticeText}>
              Submitting this correction notifies every player and starts a new
              3-day review.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <StickyActionBar
        primary={{
          disabled: !canSubmit || working,
          icon: "send",
          label: working ? "SUBMITTING…" : "SUBMIT UPDATE",
          onPress: () =>
            onSubmit({
              courtId,
              scoreA: a,
              scoreB: b,
              playedOn,
              note: note.trim(),
            }),
        }}
        secondary={{ label: "CANCEL", onPress: onClose }}
      />
    </FormSheet>
  );
}

function ScoreInput({
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
      <Text style={styles.scoreLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={`${label} corrected score`}
        keyboardType="number-pad"
        maxLength={3}
        onChangeText={(next) => onChange(next.replace(/\D/g, ""))}
        selectTextOnFocus
        style={styles.scoreInput}
        value={value}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: Space.xl, paddingBottom: Space.xxl, gap: Space.xl },
  field: { gap: Space.sm },
  label: {
    ...TextStyles.labelSmall,
    color: Colors.textSecondary,
    letterSpacing: 1.5,
  },
  scoreRow: { flexDirection: "row", alignItems: "center", gap: Space.md },
  scoreSide: { flex: 1, alignItems: "center", gap: Space.sm },
  scoreLabel: {
    ...TextStyles.labelSmall,
    color: Colors.textSecondary,
    letterSpacing: 1,
  },
  scoreInput: {
    width: "100%",
    minHeight: 74,
    paddingHorizontal: 12,
    borderBottomWidth: 2,
    borderBottomColor: Colors.borderLight,
    ...TextStyles.displayLarge,
    color: Colors.text,
    textAlign: "center",
    backgroundColor: Colors.surface,
  },
  dash: { ...TextStyles.title, color: Colors.mutedDark },
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
    ...TextStyles.body,
    color: Colors.text,
  },
  helper: { ...TextStyles.caption, color: Colors.muted },
});
