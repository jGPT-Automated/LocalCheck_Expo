import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
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

import { Colors, Radius } from "@/constants/colors";
import type { Court } from "@/constants/data";
import { Layout, Space } from "@/constants/layout";
import { TextStyles, Typography } from "@/constants/typography";
import { SportEmblem } from "@/components/ui/SportEmblem";

export function HomeCourtHero({
  court,
  activeCount,
  localCount,
  visitCount,
  isCheckedIn,
  isChecking,
  onCheckIn,
  onViewCourt,
}: {
  court: Court;
  activeCount: string;
  localCount: number;
  visitCount: number;
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

  return (
    <View style={styles.hero}>
      <LinearGradient
        colors={[Colors.courtCardStart, Colors.courtCardEnd]}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={[
          court.sport === "PICKLEBALL"
            ? Colors.pickleballTint
            : Colors.basketballTint,
          "transparent",
        ]}
        end={{ x: 0.25, y: 0.8 }}
        start={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.metaRow}>
        <View style={styles.sportLabel}>
          <SportEmblem sport={court.sport} size={17} />
          <Text
            style={[
              styles.sportText,
              {
                color:
                  court.sport === "PICKLEBALL"
                    ? Colors.pickleballMeta
                    : Colors.basketballMeta,
              },
            ]}
          >
            {court.sport}
          </Text>
        </View>
        <Text numberOfLines={1} style={styles.cityText}>
          {court.city || court.market || court.neighborhood || ""}
        </Text>
      </View>

      <View style={styles.titleRow}>
        <Text numberOfLines={2} style={styles.name}>
          {court.name}
        </Text>
      </View>

      <View style={styles.stats}>
        <HeroStat label="Active" value={activeCount} />
        <View style={styles.divider} />
        <HeroStat label="Locals" value={localCount} />
        <View style={styles.divider} />
        <HeroStat label="Visits" value={visitCount} />
      </View>

      <View style={styles.actions}>
        <Animated.View
          style={[
            styles.actionSlot,
            { transform: [{ scale: confirmationScale }] },
          ]}
        >
          <Pressable
            accessibilityLabel={
              isCheckedIn
                ? `Check out of ${court.name}`
                : `Check in to ${court.name}`
            }
            accessibilityRole="button"
            accessibilityState={{ busy: isChecking, selected: isCheckedIn }}
            disabled={isChecking}
            onPress={onCheckIn}
            style={({ pressed }) => [
              styles.action,
              styles.primaryAction,
              isCheckedIn && styles.checkedAction,
              pressed && styles.pressed,
            ]}
          >
            {isChecking ? (
              <ActivityIndicator
                color={isCheckedIn ? Colors.text : Colors.black}
                size="small"
              />
            ) : (
              <View style={styles.actionCopy}>
                <Text
                  style={[
                    styles.actionText,
                    isCheckedIn && styles.checkedActionText,
                  ]}
                >
                  {isCheckedIn ? "CHECKED IN" : "CHECK IN"}
                </Text>
                {isCheckedIn ? (
                  <Feather color={Colors.text} name="check" size={14} />
                ) : null}
              </View>
            )}
          </Pressable>
        </Animated.View>
        <View style={styles.actionSlot}>
          <Pressable
            accessibilityHint="Opens the full court profile"
            accessibilityLabel={`View ${court.name}`}
            accessibilityRole="button"
            onPress={onViewCourt}
            style={({ pressed }) => [
              styles.action,
              styles.secondaryAction,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.secondaryActionText}>VIEW COURT</Text>
            <Feather color={Colors.text} name="chevron-right" size={15} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function HeroStat({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    overflow: "hidden",
    backgroundColor: Colors.courtCardEnd,
    borderBottomWidth: 1,
    borderBottomColor: Colors.accentDim,
  },
  metaRow: {
    minHeight: 34,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 5,
  },
  sportLabel: { flexDirection: "row", alignItems: "center", gap: 5 },
  sportText: {
    fontFamily: Typography.bodyBold,
    fontSize: 11,
    letterSpacing: 1.2,
  },
  cityText: {
    minWidth: 0,
    flexShrink: 1,
    fontFamily: Typography.bodyBold,
    fontSize: 11,
    color: Colors.textSecondary,
    letterSpacing: 1,
    textTransform: "uppercase",
    textAlign: "right",
  },
  titleRow: {
    minHeight: 70,
    paddingHorizontal: Layout.screenGutter,
    alignItems: "center",
    justifyContent: "center",
  },
  name: {
    width: "100%",
    fontFamily: Typography.headingBold,
    fontSize: 25,
    lineHeight: 28,
    color: Colors.text,
    letterSpacing: 0.3,
    textAlign: "center",
    textTransform: "uppercase",
  },
  stats: {
    minHeight: 62,
    marginTop: Space.xs,
    paddingHorizontal: Layout.screenGutter,
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderSubtle,
  },
  stat: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    fontFamily: Typography.headingBold,
    fontSize: 24,
    lineHeight: 27,
    color: Colors.text,
  },
  statLabel: {
    marginTop: 2,
    fontFamily: Typography.headingRegular,
    fontSize: 11,
    lineHeight: 13,
    color: Colors.muted,
    letterSpacing: 0.45,
    textTransform: "uppercase",
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    height: 28,
    backgroundColor: Colors.border,
  },
  actions: {
    paddingHorizontal: 20,
    paddingVertical: Space.md,
    flexDirection: "row",
    gap: Space.sm,
  },
  actionSlot: {
    flex: 1,
  },
  actionCopy: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  action: {
    width: "100%",
    minHeight: 48,
    borderRadius: Radius.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Space.sm,
  },
  primaryAction: {
    backgroundColor: Colors.accent,
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  checkedAction: {
    backgroundColor: Colors.surfaceHigh,
    borderColor: Colors.borderLight,
  },
  secondaryAction: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pressed: {
    opacity: 0.76,
    transform: [{ scale: 0.985 }],
  },
  actionText: {
    ...TextStyles.label,
    color: Colors.black,
    letterSpacing: 0.7,
  },
  checkedActionText: {
    color: Colors.text,
  },
  secondaryActionText: {
    ...TextStyles.label,
    color: Colors.text,
    letterSpacing: 0.7,
  },
});
