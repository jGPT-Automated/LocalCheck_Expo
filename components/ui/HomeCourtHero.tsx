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
import { Typography } from "@/constants/typography";
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
  onOpenMap,
}: {
  court: Court;
  activeCount: string;
  localCount: number;
  visitCount: number;
  isCheckedIn: boolean;
  isChecking: boolean;
  onCheckIn: () => void;
  onViewCourt: () => void;
  onOpenMap: () => void;
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
          court.sport === "PICKLEBALL" ? Colors.pickleballTint : Colors.basketballTint,
          "transparent",
        ]}
        end={{ x: 0.25, y: 0.8 }}
        start={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.metaRow}>
        <SportEmblem sport={court.sport} size={17} />
        <View style={styles.localLabel}>
          <Feather color={Colors.textSecondary} name="star" size={15} />
        </View>
      </View>

      <View style={styles.titleRow}>
        <Text numberOfLines={2} style={styles.name}>{court.name}</Text>
        <Pressable
          accessibilityHint="Opens this court in your maps app"
          accessibilityLabel={`Open ${court.name} in maps`}
          accessibilityRole="button"
          hitSlop={8}
          onPress={onOpenMap}
          style={({ pressed }) => [styles.mapAction, pressed && styles.pressed]}
        >
          <Feather color={Colors.textSecondary} name="map-pin" size={14} />
        </Pressable>
      </View>

      <View style={styles.stats}>
        <HeroStat label="On court" value={activeCount} />
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
                <Text style={[styles.actionText, isCheckedIn && styles.checkedActionText]}>
                  {isCheckedIn ? "CHECKED IN" : "CHECK IN"}
                </Text>
                {isCheckedIn ? <Feather color={Colors.text} name="check" size={14} /> : null}
              </View>
            )}
          </Pressable>
        </Animated.View>
        <Pressable
          accessibilityHint="Opens the full court profile"
          accessibilityLabel={`View ${court.name}`}
          accessibilityRole="button"
          onPress={onViewCourt}
          style={({ pressed }) => [
            styles.actionSlot,
            styles.action,
            styles.secondaryAction,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.secondaryActionText}>VIEW COURT</Text>
          <Feather
            color={Colors.text}
            name="chevron-right"
            size={15}
          />
        </Pressable>
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
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 5,
  },
  localLabel: { width: 24, height: 24, alignItems: "center", justifyContent: "center" },
  titleRow: {
    minHeight: 70,
    paddingHorizontal: Layout.screenGutter,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Space.xs,
  },
  name: {
    flexShrink: 1,
    maxWidth: "84%",
    fontFamily: Typography.headingBold,
    fontSize: 25,
    lineHeight: 28,
    color: Colors.text,
    letterSpacing: 0.3,
    textAlign: "center",
    textTransform: "uppercase",
  },
  mapAction: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.md,
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
    fontFamily: Typography.bodyMedium,
    fontSize: 7,
    color: Colors.muted,
    letterSpacing: 1.3,
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
  actionCopy: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  action: {
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
    shadowColor: Colors.accent,
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
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
    fontFamily: Typography.headingBold,
    fontSize: 12,
    color: Colors.black,
    letterSpacing: 1.4,
  },
  checkedActionText: {
    color: Colors.text,
  },
  secondaryActionText: {
    fontFamily: Typography.heading,
    fontSize: 12,
    color: Colors.text,
    letterSpacing: 1.25,
  },
});
