import { Feather } from "@expo/vector-icons";
import React from "react";
import { AccessibilityInfo, Animated, StyleSheet, Text, View } from "react-native";

import { CourtArt } from "@/components/court/CourtArt";
import { CheckInButton, LocalPill, MetricStrip, SportLabel } from "@/components/court/CourtParts";
import { PressableScale } from "@/components/ui/PressableScale";
import { Colors, Radius } from "@/constants/colors";
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
          <CheckInButton
            busy={isChecking}
            checkedIn={isCheckedIn}
            courtName={court.shortName || court.name}
            onPress={onCheckIn}
          />
        </Animated.View>
        <View style={styles.actionSlot}>
          <PressableScale
            accessibilityHint="Opens the full court page"
            accessibilityLabel={`View ${court.shortName || court.name}`}
            accessibilityRole="button"
            onPress={onViewCourt}
            style={[styles.action, styles.secondaryAction]}
          >
            <Text style={styles.secondaryActionText}>View court</Text>
            <Feather color={Colors.text} name="arrow-right" size={14} />
          </PressableScale>
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
    borderRadius: Radius.courtCard,
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
  action: {
    height: 50,
    borderRadius: Radius.button,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  secondaryAction: { backgroundColor: Colors.panel, borderWidth: 1, borderColor: Colors.hairlineChrome },
  secondaryActionText: {
    fontFamily: Typography.bodyBold,
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: Colors.text,
  },
});
