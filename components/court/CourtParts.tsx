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
} from "react-native";

import Svg, { Path } from "react-native-svg";

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
 * Your local court: a + while it isn't your local, a glowing orange check
 * (like the logo's) once it is. A plain 44pt icon with no arc; the caller
 * places it (the court page's back-arrow row, the expanded drawer's top-right,
 * Home's top-right). Where it isn't your local, a tap makes it your local and
 * the check springs in; once it is, the mark does nothing (Settings changes it).
 */
export function LocalMark({ active, onPress }: { active: boolean; onPress?: () => void }) {
  const pop = React.useRef(new Animated.Value(active ? 1 : 0)).current;
  const wasActive = React.useRef(active);
  React.useEffect(() => {
    if (active && !wasActive.current) {
      pop.setValue(0);
      void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
        if (reduce) pop.setValue(1);
        else Animated.spring(pop, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }).start();
      });
    } else if (!active) {
      pop.setValue(0);
    } else {
      pop.setValue(1);
    }
    wasActive.current = active;
  }, [active, pop]);

  const tappable = Boolean(onPress) && !active;
  const body = (
    <View style={styles.markBox}>
      {active ? (
        <Animated.View
          style={{ opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }] }}
        >
          <Feather color={Colors.accent} name="check" size={22} style={styles.markCheckGlow} />
        </Animated.View>
      ) : (
        <Feather color={Colors.textSecondary} name="plus" size={22} />
      )}
    </View>
  );
  return (
    <View pointerEvents="box-none">
      {tappable ? (
        <Pressable
          accessibilityHint="Sets this as your local court"
          accessibilityLabel="Set as local court"
          accessibilityRole="button"
          onPress={onPress}
          style={({ pressed }) => pressed && styles.pressed}
        >
          {body}
        </Pressable>
      ) : (
        <View accessibilityLabel={active ? "Your local court" : "Not your local court"} accessible>
          {body}
        </View>
      )}
    </View>
  );
}

/**
 * The court's title row, shared by the Explore card, the court drawer and the
 * court page so a court reads the same from list to drawer to page: sport,
 * name and city · distance on the left, the live On court number on the
 * right. `card` is the Explore card and drawer, `page` the court page.
 */
export function CourtTitleRow({
  sport,
  name,
  place,
  liveValue,
  live,
  liveAccessibilityLabel,
  size = "card",
}: {
  sport: CourtSport;
  name: string;
  place?: string;
  liveValue: string | number;
  live: boolean;
  liveAccessibilityLabel?: string;
  size?: "card" | "page";
}) {
  const page = size === "page";
  return (
    <View style={styles.titleRow}>
      <View style={styles.titleBlock}>
        <SportLabel sport={sport} />
        <Text
          adjustsFontSizeToFit
          minimumFontScale={0.6}
          numberOfLines={1}
          style={[styles.titleName, page && styles.titleNamePage]}
        >
          {name}
        </Text>
        {place ? <Text numberOfLines={1} style={styles.titlePlace}>{place}</Text> : null}
      </View>
      <View
        accessibilityLabel={liveAccessibilityLabel ?? `${liveValue} on court`}
        accessible
        style={styles.liveBlock}
      >
        <Text style={[styles.liveValue, page && styles.liveValuePage, live && styles.liveValueOn]}>{liveValue}</Text>
        <View style={styles.liveLabelRow}>
          {live ? <LiveDot /> : null}
          <Text style={styles.liveLabel}>On court</Text>
        </View>
      </View>
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

/** A centred ">" that opens the full court page. */
export function CourtLinkButton({ onPress, courtName }: { onPress: () => void; courtName: string }) {
  return (
    <PressableScale
      accessibilityHint="Opens the full court page"
      accessibilityLabel={`Open ${courtName}`}
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.action, styles.courtLink]}
    >
      <Feather color={Colors.text} name="chevron-right" size={24} />
    </PressableScale>
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
  markBox: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  markCheckGlow: { textShadowColor: Colors.accent, textShadowRadius: 10 },
  pressed: { opacity: 0.72 },
  strip: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.hairline,
  },
  cell: { flex: 1, height: 58, alignItems: "center", justifyContent: "center", gap: 6 },
  cellDivider: { borderLeftWidth: 1, borderLeftColor: Colors.hairline },
  cellValue: { height: 27, fontFamily: Typography.headingSemiBold, fontSize: 25, lineHeight: 27, letterSpacing: -0.6, color: Colors.text },
  cellValueLive: { color: Colors.liveInk },
  cellUnit: { fontSize: 16, lineHeight: 16, letterSpacing: 0 },
  stripCard: { borderBottomWidth: 0, backgroundColor: "rgba(12,12,15,0.38)" },
  cellDrawer: { height: 62 },
  cellCard: { height: 54, gap: 4 },
  cellValueDrawer: { height: 30, fontSize: 28, lineHeight: 30 },
  // The drawer's strip: quieter than the court name and live number, and a
  // fixed value height so a unit ("1h") can't push its cell off the line.
  cellValueCard: { fontSize: 18, lineHeight: 22, height: 22 },
  sectionHead: { height: 16, marginBottom: 8, flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 },
  sectionTitle: { fontFamily: Typography.bodyBold, fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase", color: Colors.text },
  sectionMeta: { flexShrink: 1, fontFamily: Typography.bodySemiBold, fontSize: 11, color: Colors.muted },
  action: { borderRadius: Radius.button, alignItems: "center", justifyContent: "center", flexDirection: "row" },
  actionRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 10 },
  checkIn: { backgroundColor: Colors.accent },
  checkOut: { borderWidth: 1.5, borderColor: Colors.accentBorderStrong, backgroundColor: Colors.surfaceDark },
  checkInText: { fontFamily: Typography.bodyBold, fontSize: 12, letterSpacing: 1.7, textTransform: "uppercase", color: Colors.background },
  checkOutText: { flexShrink: 1, fontFamily: Typography.bodyBold, fontSize: 11, letterSpacing: 1.3, textTransform: "uppercase", color: Colors.liveInk },
  courtLink: { width: 64, height: 50, backgroundColor: Colors.panel, borderWidth: 1, borderColor: Colors.hairlineChrome },
  cellLabelRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  titleRow: { flexDirection: "row", alignItems: "flex-end", gap: 16, paddingHorizontal: 20 },
  titleBlock: { flex: 1, minWidth: 0, gap: 6 },
  titleName: {
    fontFamily: Typography.headingBold,
    fontSize: 30,
    lineHeight: 33,
    letterSpacing: -0.9,
    textTransform: "uppercase",
    color: Colors.text,
    textShadowColor: Colors.sheet,
    textShadowRadius: 6,
  },
  titleNamePage: { fontSize: 34, lineHeight: 37, letterSpacing: -1.1 },
  titlePlace: { fontFamily: Typography.bodyMedium, fontSize: 11, color: Colors.textSecondary },
  liveBlock: { flexShrink: 0, alignItems: "flex-end", paddingBottom: 1 },
  liveValue: { fontFamily: Typography.headingBold, fontSize: 40, lineHeight: 42, letterSpacing: -1.2, color: Colors.text, fontVariant: ["tabular-nums"] },
  liveValuePage: { fontSize: 46, lineHeight: 48, letterSpacing: -1.4 },
  liveValueOn: { color: Colors.liveInk },
  liveLabelRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 },
  liveLabel: { fontFamily: Typography.bodyBold, fontSize: 9, letterSpacing: 1.2, textTransform: "uppercase", color: Colors.textSecondary },
  cellLabel: { fontFamily: Typography.bodyBold, fontSize: 7.5, letterSpacing: 0.9, textTransform: "uppercase", color: Colors.textSecondary },
  tabs: { flexDirection: "row", paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: Colors.hairline },
  tab: { flex: 1, height: 44, alignItems: "center", justifyContent: "center", borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabActive: { borderBottomColor: Colors.accent },
  tabText: { fontFamily: Typography.bodyBold, fontSize: 9.5, letterSpacing: 1, textTransform: "uppercase", color: Colors.muted },
  tabTextActive: { color: Colors.text },
});
