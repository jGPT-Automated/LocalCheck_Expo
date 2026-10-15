import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useToast } from "@/components/ui/Toast";
import { Colors } from "@/constants/colors";
import { Space } from "@/constants/layout";
import { TextStyles, Typography } from "@/constants/typography";
import { useApp } from "@/context/AppContext";
import { clockTime } from "@/lib/autoCheckInModel";

/**
 * One quiet line under a court's check-in button for an auto check-in
 * (D35, D52). While it waits to post: "Checked in automatically · Posts at
 * 4:05 PM · Hide". Once posted: "Checked in automatically · Hide". Hide
 * erases it as if it never happened (friend alerts already sent stay sent).
 */
export function AutoCheckInNote({ courtId }: { courtId: string }) {
  const { checkedInCourtId, checkedInAuto, pendingAutoCheckIn, hideAutoCheckIn } = useApp();
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);

  const waiting = pendingAutoCheckIn?.courtId === courtId && checkedInCourtId !== courtId;
  const posted = checkedInAuto && checkedInCourtId === courtId;
  if (!waiting && !posted) return null;

  const hide = async () => {
    if (busy) return;
    setBusy(true);
    const ok = await hideAutoCheckIn();
    setBusy(false);
    showToast(
      ok
        ? { title: "HIDDEN", body: "You're not checked in.", icon: "eye-off" }
        : { title: "COULDN'T HIDE", body: "Tap CHECKED IN to check out instead.", icon: "alert-circle" },
    );
  };

  const postsAt = waiting && pendingAutoCheckIn ? clockTime(new Date(pendingAutoCheckIn.postsAt)) : null;

  return (
    <View style={styles.row}>
      <Text style={styles.text}>
        {postsAt ? `Checked in automatically · Posts at ${postsAt} ·` : "Checked in automatically ·"}
      </Text>
      <Pressable
        accessibilityLabel="Hide this auto check-in"
        accessibilityRole="button"
        disabled={busy}
        hitSlop={12}
        onPress={() => void hide()}
      >
        <Text style={styles.link}>{busy ? "Hiding…" : "Hide"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: Space.sm },
  text: { ...TextStyles.metadata, color: Colors.textSecondary },
  link: { ...TextStyles.metadata, fontFamily: Typography.bodyBold, color: Colors.text, textDecorationLine: "underline" },
});
