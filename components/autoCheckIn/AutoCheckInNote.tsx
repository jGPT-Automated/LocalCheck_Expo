import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useToast } from "@/components/ui/Toast";
import { Colors } from "@/constants/colors";
import { Space } from "@/constants/layout";
import { TextStyles, Typography } from "@/constants/typography";
import { useApp } from "@/context/AppContext";
import { undoAutoCheckIn } from "@/services/autoCheckInService";

/**
 * One quiet line under a court's check-in button when the check-in came from
 * auto check-in (D35): "Checked in automatically · Not here?". Tapping
 * "Not here?" removes it as if it never happened, so an auto check-in always
 * feels easy to take back.
 */
export function AutoCheckInNote({ courtId }: { courtId: string }) {
  const { checkedInCourtId, checkedInAuto, refreshCheckedIn, refreshFeed } = useApp();
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);

  if (!checkedInAuto || checkedInCourtId !== courtId) return null;

  const remove = async () => {
    if (busy) return;
    setBusy(true);
    const ok = await undoAutoCheckIn();
    setBusy(false);
    await refreshCheckedIn();
    refreshFeed();
    showToast(
      ok
        ? { title: "REMOVED", body: "You're not checked in.", icon: "rotate-ccw" }
        : { title: "COULDN'T REMOVE", body: "Tap CHECKED IN to check out instead.", icon: "alert-circle" },
    );
  };

  return (
    <View style={styles.row}>
      <Text style={styles.text}>Checked in automatically ·</Text>
      <Pressable
        accessibilityLabel="Not here? Remove this auto check-in"
        accessibilityRole="button"
        disabled={busy}
        hitSlop={12}
        onPress={() => void remove()}
      >
        <Text style={styles.link}>{busy ? "Removing…" : "Not here?"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: Space.sm },
  text: { ...TextStyles.metadata, color: Colors.textSecondary },
  link: { ...TextStyles.metadata, fontFamily: Typography.bodyBold, color: Colors.text, textDecorationLine: "underline" },
});
