import DateTimePicker from "@react-native-community/datetimepicker";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { FormSheet } from "@/components/sheet/FormSheet";
import { CompactSelect } from "@/components/ui/CompactSelect";
import { StickyActionBar } from "@/components/ui/StickyActionBar";
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
  visible,
  working,
}: {
  courts: Court[];
  match: MatchReview;
  onClose: () => void;
  onSubmit: (change: { courtId: string; scoreA: number; scoreB: number; playedOn: string }) => void;
  visible: boolean;
  working: boolean;
}) {
  const supportedCourts = React.useMemo(
    () => courts.filter((court) => court.sport === "BASKETBALL" || court.sport === "PICKLEBALL"),
    [courts],
  );
  const courtOptions = React.useMemo(() => {
    const options = supportedCourts.map((court) => ({ label: court.name, value: court.id }));
    if (!options.some((option) => option.value === match.courtId)) {
      options.unshift({ label: match.courtName, value: match.courtId });
    }
    return options;
  }, [match.courtId, match.courtName, supportedCourts]);
  const [courtId, setCourtId] = React.useState(match.courtId);
  const [scoreA, setScoreA] = React.useState(String(match.scoreA));
  const [scoreB, setScoreB] = React.useState(String(match.scoreB));
  const [playedOn, setPlayedOn] = React.useState(localDateValue(new Date(match.playedAt)));
  const [showDate, setShowDate] = React.useState(false);
  const a = Number(scoreA);
  const b = Number(scoreB);
  const valid = Number.isInteger(a) && Number.isInteger(b) && a >= 0 && b >= 0 && a !== b && Boolean(courtId);

  React.useEffect(() => {
    if (!visible) return;
    setCourtId(match.courtId);
    setScoreA(String(match.scoreA));
    setScoreB(String(match.scoreB));
    setPlayedOn(localDateValue(new Date(match.playedAt)));
    setShowDate(false);
  }, [match, visible]);

  return (
    <FormSheet eyebrow="DISPUTE RESOLUTION" onClose={onClose} title="UPDATE GAME" visible={visible}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
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

        <View style={styles.field}>
          <Text style={styles.label}>DATE</Text>
          <Pressable onPress={() => setShowDate(true)} style={styles.dateField}>
            <View style={styles.dateCopy}>
              <Feather color={Colors.accent} name="calendar" size={16} />
              <Text style={styles.dateText}>{new Date(`${playedOn}T12:00:00`).toLocaleDateString()}</Text>
            </View>
            <Feather color={Colors.muted} name="chevron-down" size={16} />
          </Pressable>
          {showDate ? (
            <DateTimePicker
              display={Platform.OS === "ios" ? "inline" : "default"}
              maximumDate={new Date()}
              mode="date"
              onChange={(_, date) => {
                if (Platform.OS !== "ios") setShowDate(false);
                if (date) setPlayedOn(localDateValue(date));
              }}
              value={new Date(`${playedOn}T12:00:00`)}
            />
          ) : null}
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
            Submitting this correction notifies every player and starts a new 3-day review.
          </Text>
        </View>
      </ScrollView>
      <StickyActionBar
        primary={{
          disabled: !valid || working,
          icon: "send",
          label: working ? "SUBMITTING…" : "SUBMIT UPDATE",
          onPress: () => onSubmit({ courtId, scoreA: a, scoreB: b, playedOn }),
        }}
        secondary={{ label: "CANCEL", onPress: onClose }}
      />
    </FormSheet>
  );
}

function ScoreInput({ label, onChange, value }: { label: string; onChange: (value: string) => void; value: string }) {
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
  content: { padding: Space.xl, paddingBottom: Space.xxl, gap: Space.xl },
  field: { gap: Space.sm },
  label: { ...TextStyles.labelSmall, color: Colors.textSecondary, letterSpacing: 1.5 },
  dateField: {
    minHeight: 48,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceHigh,
  },
  dateCopy: { flexDirection: "row", alignItems: "center", gap: Space.sm },
  dateText: { ...TextStyles.listName, color: Colors.text },
  scoreRow: { flexDirection: "row", alignItems: "center", gap: Space.md },
  scoreSide: { flex: 1, alignItems: "center", gap: Space.sm },
  scoreLabel: { ...TextStyles.labelSmall, color: Colors.textSecondary, letterSpacing: 1 },
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
  notice: { flexDirection: "row", alignItems: "flex-start", gap: Space.md, padding: Space.lg, borderRadius: Radius.lg, backgroundColor: Colors.accentDim },
  noticeText: { ...TextStyles.bodySmall, flex: 1, color: Colors.textSecondary },
});
