import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

import { Colors } from "@/constants/colors";
import { Space } from "@/constants/layout";
import { TextStyles } from "@/constants/typography";

const SIZE = 34;
const STROKE = 3;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** "2d 4h 11m", or "4h 11m 05s" in the last day. */
export function countdownParts(deadline: string, now: number): string {
  const ms = Math.max(0, Date.parse(deadline) - now);
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  return `${hours}h ${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

/**
 * The game's clock (D47): a ring that empties as the window closes and the
 * time left, ticking every second. Pending: "Auto-approves in". Disputed:
 * "Resolve within". Sits above the card on the game page.
 */
export function ReviewCountdown({
  label,
  deadline,
  windowMs,
}: {
  label: string;
  deadline: string;
  /** The full window (3 days to review, 7 to resolve), for the ring. */
  windowMs: number;
}) {
  const [now, setNow] = React.useState(Date.now());
  React.useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const remaining = Math.max(0, Date.parse(deadline) - now);
  const fraction = windowMs > 0 ? Math.min(1, remaining / windowMs) : 0;
  const text = countdownParts(deadline, now);
  return (
    <View
      accessibilityLabel={`${label} ${text}`}
      accessibilityRole="timer"
      style={styles.row}
    >
      <Svg height={SIZE} width={SIZE}>
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          fill="none"
          r={RADIUS}
          stroke={Colors.borderLight}
          strokeWidth={STROKE}
        />
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          fill="none"
          r={RADIUS}
          stroke={Colors.accent}
          strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
          strokeDashoffset={CIRCUMFERENCE * (1 - fraction)}
          strokeLinecap="round"
          strokeWidth={STROKE}
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        />
      </Svg>
      <View style={styles.copy}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.time}>{text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Space.md,
  },
  copy: { gap: 1 },
  label: { ...TextStyles.caption, color: Colors.textSecondary },
  time: {
    ...TextStyles.statSmall,
    color: Colors.text,
    fontVariant: ["tabular-nums"],
  },
});
