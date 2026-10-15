import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { CourtArt } from "@/components/court/CourtArt";
import { LocalPill, MetricStrip, SportLabel } from "@/components/court/CourtParts";
import { Colors } from "@/constants/colors";
import type { Court } from "@/constants/data";
import { Typography } from "@/constants/typography";

/**
 * Home's local court card, in the court-flow card style (Claude Design
 * handoff, Explore card): court trace top right, sport + Your local, the name,
 * city · distance, then On court / Court hours · wk / Locals and the two
 * actions. Same pieces as the court page header so both read as one court.
 */
export function HomeCourtHero({
  court,
  activeCount,
  live,
  localCount,
  hoursLabel,
  isCheckedIn,
  isChecking,
  onCheckIn,
  onViewCourt,
}: {
  court: Court;
  activeCount: string;
  live: boolean;
  localCount: number;
  hoursLabel: string;
  isCheckedIn: boolean;
  isChecking: boolean;
  onCheckIn: () => void;
  onViewCourt: () => void;
}) {
  const confirmationScale = React.useRef(new Animated.Value(1)).current;
  const mounted = React.useRef(false);

  React.useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (cancelled || reduceMotion) return;
      confirmationScale.setValue(0.96);
      Animated.spring(confirmationScale, {
        toValue: 1,
        friction: 7,
        tension: 120,
        useNativeDriver: true,
      }).start();
    });
    return () => {
      cancelled = true;
    };
  }, [confirmationScale, isCheckedIn]);

  const distance =
    court.distanceKm != null && !Number.isNaN(court.distanceKm)
      ? `${(court.distanceKm * 0.621371).toFixed(1)} mi`
      : null;
  const place = [court.city || court.market || court.neighborhood, distance].filter(Boolean).join(" · ");

  return (
    <View style={styles.card}>
      <CourtArt sport={court.sport} />
      <View style={styles.top}>
        <View style={styles.metaRow}>
          <SportLabel sport={court.sport} />
          <LocalPill isLocal />
        </View>
        <Text adjustsFontSizeToFit minimumFontScale={0.6} numberOfLines={1} style={styles.name}>
          {court.shortName || court.name}
        </Text>
        {place ? <Text numberOfLines={1} style={styles.place}>{place}</Text> : null}
      </View>

      <MetricStrip
        cells={[
          { label: "On court", value: activeCount, live },
          { label: "Court hours · wk", value: hoursLabel },
          { label: "Locals", value: localCount },
        ]}
      />

      <View style={styles.actions}>
        <Animated.View style={[styles.actionSlot, { transform: [{ scale: confirmationScale }] }]}>
          <Pressable
            accessibilityLabel={
              isCheckedIn
                ? `Check out of ${court.shortName || court.name}`
                : `Check in to ${court.shortName || court.name}`
            }
            accessibilityRole="button"
            accessibilityState={{ busy: isChecking, selected: isCheckedIn }}
            disabled={isChecking}
            onPress={onCheckIn}
            style={({ pressed }) => [
              styles.action,
              isCheckedIn ? styles.checkedAction : styles.primaryAction,
              pressed && styles.pressed,
            ]}
          >
            {isChecking ? (
              <ActivityIndicator color={isCheckedIn ? Colors.text : Colors.black} size="small" />
            ) : (
              <View style={styles.actionCopy}>
                <Text style={[styles.actionText, isCheckedIn && styles.checkedActionText]}>
                  {isCheckedIn ? "Checked in" : "Check in"}
                </Text>
                {isCheckedIn ? <Feather color={Colors.accent} name="check" size={14} /> : null}
              </View>
            )}
          </Pressable>
        </Animated.View>
        <View style={styles.actionSlot}>
          <Pressable
            accessibilityHint="Opens the full court page"
            accessibilityLabel={`View ${court.shortName || court.name}`}
            accessibilityRole="button"
            onPress={onViewCourt}
            style={({ pressed }) => [styles.action, styles.secondaryAction, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryActionText}>View court</Text>
            <Feather color={Colors.text} name="arrow-right" size={14} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 12,
    overflow: "hidden",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.hairlineCard,
    backgroundColor: Colors.sheet,
  },
  top: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 14, gap: 6 },
  metaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  name: {
    marginTop: 4,
    fontFamily: Typography.headingBold,
    fontSize: 30,
    lineHeight: 32,
    letterSpacing: -0.9,
    color: Colors.text,
    textTransform: "uppercase",
    textShadowColor: Colors.sheet,
    textShadowRadius: 6,
  },
  place: { fontFamily: Typography.bodyMedium, fontSize: 11, color: Colors.textSecondary },
  actions: { flexDirection: "row", gap: 10, padding: 14 },
  actionSlot: { flex: 1 },
  actionCopy: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  action: {
    width: "100%",
    height: 46,
    borderRadius: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryAction: { backgroundColor: Colors.accent },
  checkedAction: { borderWidth: 1.5, borderColor: Colors.accentBorderStrong, backgroundColor: Colors.surfaceDark },
  secondaryAction: { backgroundColor: Colors.panel, borderWidth: 1, borderColor: Colors.hairlineChrome },
  pressed: { opacity: 0.76, transform: [{ scale: 0.985 }] },
  actionText: {
    fontFamily: Typography.bodyBold,
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: Colors.background,
  },
  checkedActionText: { color: Colors.accent },
  secondaryActionText: {
    fontFamily: Typography.bodyBold,
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: Colors.text,
  },
});
