// Small shared pieces of the court flow (Claude Design handoff): the live
// dot, the sport label, the Your local pill, the 3-number strip and the tab
// bar. Used by the Home court card and the court page so both read the same.
import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Pressable,
  type StyleProp,
  StyleSheet,
  Text,
  type TextStyle,
  View,
  type ViewStyle,
} from "react-native";

import { PressableScale } from "@/components/ui/PressableScale";
import { Colors, Radius } from "@/constants/colors";
import type { CourtSport } from "@/constants/data";
import { Typography } from "@/constants/typography";

export function LiveDot() {
  const pulse = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled || reduce) return;
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1, duration: 1200, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 0, duration: 1200, useNativeDriver: true }),
        ]),
      );
      loop.start();
    });
    return () => {
      cancelled = true;
      loop?.stop();
    };
  }, [pulse]);
  return (
    <Animated.View
      style={[
        styles.liveDot,
        {
          opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1] }),
          transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1.08] }) }],
        },
      ]}
    />
  );
}

export function SportLabel({ sport, suffix }: { sport: CourtSport; suffix?: string }) {
  const pickleball = sport === "PICKLEBALL";
  return (
    <View style={styles.sportRow}>
      <View style={[styles.sportDot, { backgroundColor: pickleball ? Colors.pickleballMeta : Colors.basketballMeta }]} />
      <Text numberOfLines={1} style={[styles.sportText, { color: pickleball ? Colors.pickleballLabel : Colors.basketballLabel }]}>
        {pickleball ? "Pickleball" : "Basketball"}
        {suffix ? ` · ${suffix}` : ""}
      </Text>
    </View>
  );
}

/**
 * Small glass icon button that sits beside Check in: a frosted fill and a
 * hairline, no solid colour, so it never competes with the main action.
 */
function GlassIconButton({
  icon,
  accessibilityLabel,
  accessibilityHint,
  onPress,
  active = false,
  height = 50,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  accessibilityLabel: string;
  accessibilityHint?: string;
  onPress?: () => void;
  active?: boolean;
  height?: number;
}) {
  return (
    <PressableScale
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled: !onPress, selected: active }}
      disabled={!onPress}
      onPress={onPress}
      style={[styles.glass, { height }, active && styles.glassOn]}
    >
      <Feather color={active ? Colors.accent : Colors.inkSoft} name={icon} size={20} />
    </PressableScale>
  );
}

/**
 * Your local court. Orange once it is; before that a tap makes this court your
 * local (Settings changes it afterwards). The slot beside Check in is also
 * where saved courts will live.
 */
export function LocalButton({
  active,
  onPress,
  courtName,
  height,
}: {
  active: boolean;
  onPress?: () => void;
  courtName: string;
  height?: number;
}) {
  return (
    <GlassIconButton
      accessibilityHint={active ? undefined : "Sets this as your local court"}
      accessibilityLabel={active ? `${courtName} is your local court` : `Set ${courtName} as your local court`}
      active={active}
      height={height}
      icon="home"
      onPress={active ? undefined : onPress}
    />
  );
}

/**
 * The line under a court's name, centred: city · distance, and a small house +
 * LOCAL beside it when it is your local court. Not a button.
 */
export function PlaceLine({ place, local = false, style }: { place: string; local?: boolean; style?: StyleProp<ViewStyle> }) {
  if (!place && !local) return null;
  return (
    <View style={[styles.placeLine, style]}>
      {place ? <Text numberOfLines={1} style={styles.placeText}>{place}</Text> : null}
      {local ? (
        <View accessibilityLabel="Your local court" accessible style={styles.localTag}>
          {place ? <Text style={styles.placeText}>·</Text> : null}
          <Feather color={Colors.accent} name="home" size={12} />
          <Text style={styles.localTagText}>Local</Text>
        </View>
      ) : null}
    </View>
  );
}

export interface StripCell {
  label: string;
  value: string | number;
  live?: boolean;
}

/**
 * The 3-number strip. `page` is the court page header (58 tall, 25pt
 * numbers), `drawer` the court drawer (62, 28pt) and `card` the Explore card
 * (54, 22pt, sits on a darker band along the card's bottom edge).
 */
export function MetricStrip({ cells, size = "page" }: { cells: StripCell[]; size?: "page" | "drawer" | "card" }) {
  return (
    <View style={[styles.strip, size === "card" && styles.stripCard]}>
      {cells.map((cell, index) => (
        <View
          key={cell.label}
          style={[styles.cell, size === "drawer" && styles.cellDrawer, size === "card" && styles.cellCard, index > 0 && styles.cellDivider]}
        >
          <MetricValue
            style={[
              styles.cellValue,
              size === "drawer" && styles.cellValueDrawer,
              size === "card" && styles.cellValueCard,
              cell.live && styles.cellValueLive,
            ]}
            value={cell.value}
          />
          <View style={styles.cellLabelRow}>
            {cell.live ? <LiveDot /> : null}
            <Text numberOfLines={1} style={styles.cellLabel}>{cell.label}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

/**
 * A strip number. A trailing unit ("38h", "8P") is set a size smaller with a
 * hair of space, so it reads as the unit of the number instead of touching it.
 */
function MetricValue({ value, style }: { value: string | number; style: StyleProp<TextStyle> }) {
  const match = /^(~?\d+)([A-Za-z]+)$/.exec(String(value));
  if (!match) return <Text style={style}>{value}</Text>;
  return (
    <Text style={style}>
      {match[1]}
      <Text style={styles.cellUnit}>{"\u2009"}{match[2]}</Text>
    </Text>
  );
}

/** Section heading inside the drawer and court page: label left, quiet meta right. */
export function SectionHead({ title, meta, onMetaPress }: { title: string; meta?: string; onMetaPress?: () => void }) {
  return (
    <View style={styles.sectionHead}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {meta ? (
        onMetaPress ? (
          <Pressable accessibilityRole="button" hitSlop={10} onPress={onMetaPress}>
            <Text numberOfLines={1} style={styles.sectionMeta}>{meta} ›</Text>
          </Pressable>
        ) : (
          <Text numberOfLines={1} style={styles.sectionMeta}>{meta}</Text>
        )
      ) : null}
    </View>
  );
}

/**
 * The one Check in / Check out button. Orange and solid to check in; outlined
 * with the live dot once you're in ("Check out"; the dot says you're in, so
 * the label stays short and never spills out of the button).
 */
export function CheckInButton({
  checkedIn,
  busy,
  onPress,
  courtName,
  checkedLabel = "Check out",
  height = 50,
}: {
  checkedIn: boolean;
  busy: boolean;
  onPress: () => void;
  courtName: string;
  checkedLabel?: string;
  height?: number;
}) {
  return (
    <PressableScale
      accessibilityLabel={checkedIn ? `Check out of ${courtName}` : `Check in to ${courtName}`}
      accessibilityRole="button"
      accessibilityState={{ busy, selected: checkedIn }}
      disabled={busy}
      onPress={onPress}
      style={[styles.action, { height }, checkedIn ? styles.checkOut : styles.checkIn]}
      testID="check-in-btn"
    >
      {busy ? (
        <ActivityIndicator color={checkedIn ? Colors.text : Colors.black} size="small" />
      ) : checkedIn ? (
        <View style={styles.actionRow}>
          <LiveDot />
          <Text numberOfLines={1} style={styles.checkOutText}>{checkedLabel}</Text>
        </View>
      ) : (
        <Text style={styles.checkInText}>Check in</Text>
      )}
    </PressableScale>
  );
}

/** A small glass ">" that opens the full court page. */
export function CourtLinkButton({ onPress, courtName, height }: { onPress: () => void; courtName: string; height?: number }) {
  return (
    <GlassIconButton
      accessibilityHint="Opens the full court page"
      accessibilityLabel={`Open ${courtName}`}
      height={height}
      icon="chevron-right"
      onPress={onPress}
    />
  );
}

export function CourtTabBar<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: ReadonlyArray<{ value: T; label: string }>;
  active: T;
  onChange: (tab: T) => void;
}) {
  return (
    <View accessibilityRole="tablist" style={styles.tabs}>
      {tabs.map((tab) => {
        const selected = tab.value === active;
        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            key={tab.value}
            onPress={() => onChange(tab.value)}
            style={[styles.tab, selected && styles.tabActive]}
          >
            <Text style={[styles.tabText, selected && styles.tabTextActive]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.accent,
    shadowColor: Colors.accent,
    shadowOpacity: 0.7,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  sportRow: { flexDirection: "row", alignItems: "center", gap: 7, flexShrink: 1 },
  sportDot: { width: 6, height: 6, borderRadius: 3 },
  sportText: { fontFamily: Typography.bodyBold, fontSize: 9.5, letterSpacing: 1.5, textTransform: "uppercase", flexShrink: 1 },
  pressed: { opacity: 0.72 },
  strip: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.hairline,
  },
  cell: { flex: 1, height: 58, alignItems: "center", justifyContent: "center", gap: 6 },
  cellDivider: { borderLeftWidth: 1, borderLeftColor: Colors.hairline },
  cellValue: { fontFamily: Typography.headingSemiBold, fontSize: 25, lineHeight: 27, letterSpacing: -0.6, color: Colors.text },
  cellValueLive: { color: Colors.liveInk },
  cellUnit: { fontSize: 16, letterSpacing: 0 },
  stripCard: { borderBottomWidth: 0, backgroundColor: "rgba(12,12,15,0.38)" },
  cellDrawer: { height: 62 },
  cellCard: { height: 54, gap: 4 },
  cellValueDrawer: { fontSize: 28, lineHeight: 30 },
  cellValueCard: { fontSize: 22, lineHeight: 24 },
  sectionHead: { height: 16, marginBottom: 8, flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 },
  sectionTitle: { fontFamily: Typography.bodyBold, fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase", color: Colors.text },
  sectionMeta: { flexShrink: 1, fontFamily: Typography.bodySemiBold, fontSize: 11, color: Colors.muted },
  action: { borderRadius: Radius.button, alignItems: "center", justifyContent: "center", flexDirection: "row" },
  actionRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 10 },
  checkIn: { backgroundColor: Colors.accent },
  checkOut: { borderWidth: 1.5, borderColor: Colors.accentBorderStrong, backgroundColor: Colors.surfaceDark },
  checkInText: { fontFamily: Typography.bodyBold, fontSize: 12, letterSpacing: 1.7, textTransform: "uppercase", color: Colors.background },
  checkOutText: { flexShrink: 1, fontFamily: Typography.bodyBold, fontSize: 11, letterSpacing: 1.3, textTransform: "uppercase", color: Colors.liveInk },
  glass: {
    width: 48,
    borderRadius: Radius.chip,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.glass,
    borderWidth: 1,
    borderColor: Colors.hairlineChrome,
  },
  glassOn: { backgroundColor: Colors.liveQuiet, borderColor: Colors.accentBorder },
  placeLine: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  placeText: { flexShrink: 1, fontFamily: Typography.bodyMedium, fontSize: 11, color: Colors.textSecondary },
  localTag: { flexDirection: "row", alignItems: "center", gap: 5, flexShrink: 0 },
  localTagText: { fontFamily: Typography.bodyBold, fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase", color: Colors.liveInk },
  cellLabelRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  cellLabel: { fontFamily: Typography.bodyBold, fontSize: 7.5, letterSpacing: 0.9, textTransform: "uppercase", color: Colors.textSecondary },
  tabs: { flexDirection: "row", paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: Colors.hairline },
  tab: { flex: 1, height: 44, alignItems: "center", justifyContent: "center", borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabActive: { borderBottomColor: Colors.accent },
  tabText: { fontFamily: Typography.bodyBold, fontSize: 9.5, letterSpacing: 1, textTransform: "uppercase", color: Colors.muted },
  tabTextActive: { color: Colors.text },
});
