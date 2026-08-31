import { Feather } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { Colors } from "@/constants/colors";
import { Layout, Space } from "@/constants/layout";
import { Typography } from "@/constants/typography";

export type SpeedDialAction = {
  label: string;
  icon: React.ComponentProps<typeof Feather>["name"];
  onPress: () => void;
};

const CLOSED_SIZE = 56;
const OPEN_WIDTH = 188;
const ROW_HEIGHT = 48;

/**
 * Reachable action menu adapted from Nexvyn's gooey trigger-to-panel behavior.
 * React Native cannot use its CSS shape/SVG filter, so one Reanimated surface
 * springs from the trigger into a cohesive native menu. PanelUI's menu pattern
 * informs the full-width rows, co-located icons/labels and dismiss-on-select.
 */
export function SpeedDialFab({
  accessibilityLabel,
  actions,
  bottom,
  icon = "plus",
}: {
  accessibilityLabel: string;
  actions: SpeedDialAction[];
  bottom: number;
  icon?: React.ComponentProps<typeof Feather>["name"];
}) {
  const [open, setOpen] = React.useState(false);
  const progress = useSharedValue(0);
  const reduceMotion = useReducedMotion();
  const expandedHeight = CLOSED_SIZE + actions.length * ROW_HEIGHT + Space.sm;

  const setExpanded = React.useCallback(
    (next: boolean) => {
      setOpen(next);
      progress.value = reduceMotion
        ? next
          ? 1
          : 0
        : withSpring(next ? 1 : 0, {
            damping: 20,
            stiffness: 280,
            mass: 0.5,
          });
    },
    [progress, reduceMotion],
  );

  const panelStyle = useAnimatedStyle(() => ({
    width: interpolate(progress.value, [0, 1], [CLOSED_SIZE, OPEN_WIDTH]),
    height: interpolate(progress.value, [0, 1], [CLOSED_SIZE, expandedHeight]),
    borderRadius: interpolate(progress.value, [0, 1], [CLOSED_SIZE / 2, 18]),
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [Colors.accent, Colors.accent],
    ),
    borderColor: interpolateColor(
      progress.value,
      [0, 1],
      [Colors.accent, Colors.accent],
    ),
  }));

  const menuStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: interpolate(progress.value, [0, 1], [10, 0]) }],
  }));

  const triggerIconStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${interpolate(progress.value, [0, 1], [0, 45])}deg` },
    ],
  }));

  const triggerFillStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [Colors.accent, Colors.accent],
    ),
  }));

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {open ? (
        <Pressable
          accessibilityLabel="Close action menu"
          onPress={() => setExpanded(false)}
          style={styles.backdrop}
        />
      ) : null}

      <Animated.View style={[styles.panel, { bottom }, panelStyle]}>
        <Animated.View
          pointerEvents={open ? "auto" : "none"}
          style={[
            styles.menu,
            { paddingBottom: CLOSED_SIZE + Space.xs },
            menuStyle,
          ]}
        >
          {actions.map((action) => (
            <Pressable
              accessibilityLabel={action.label}
              accessibilityRole="button"
              key={action.label}
              onPress={() => {
                setExpanded(false);
                action.onPress();
              }}
              style={({ pressed }) => [
                styles.actionRow,
                pressed && styles.actionRowPressed,
              ]}
            >
              <Feather color={Colors.black} name={action.icon} size={17} />
              <Text
                adjustsFontSizeToFit
                minimumFontScale={0.8}
                numberOfLines={1}
                style={styles.actionLabel}
              >
                {action.label.toUpperCase()}
              </Text>
            </Pressable>
          ))}
        </Animated.View>

        <Pressable
          accessibilityLabel={accessibilityLabel}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          onPress={() => setExpanded(!open)}
          style={({ pressed }) => [
            styles.mainButton,
            pressed && styles.mainButtonPressed,
          ]}
        >
          <Animated.View style={[styles.mainButtonFill, triggerFillStyle]} />
          <Animated.View style={triggerIconStyle}>
            <Feather color={Colors.black} name={icon} size={23} />
          </Animated.View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.overlayLight,
  },
  panel: {
    position: "absolute",
    right: Space.lg,
    overflow: "hidden",
    borderWidth: 1,
    shadowColor: Colors.black,
    shadowOpacity: 0.42,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 18,
  },
  menu: {
    ...StyleSheet.absoluteFillObject,
    paddingTop: Space.xs,
    paddingHorizontal: Space.xs,
  },
  actionRow: {
    minHeight: ROW_HEIGHT,
    paddingHorizontal: Space.md,
    flexDirection: "row",
    alignItems: "center",
    gap: Space.md,
    borderRadius: 13,
  },
  actionRowPressed: { backgroundColor: Colors.brandMark },
  actionLabel: {
    flex: 1,
    fontFamily: Typography.heading,
    fontSize: 12,
    color: Colors.black,
    letterSpacing: 1.2,
  },
  mainButton: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: CLOSED_SIZE,
    height: CLOSED_SIZE,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: CLOSED_SIZE / 2,
    minWidth: Layout.minTouchTarget,
    minHeight: Layout.minTouchTarget,
  },
  mainButtonFill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: CLOSED_SIZE / 2,
  },
  mainButtonPressed: { opacity: 0.82, transform: [{ scale: 0.97 }] },
});
