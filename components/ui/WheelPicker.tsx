import React from "react";
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Colors, Radius } from "@/constants/colors";
import { Space } from "@/constants/layout";
import { TextStyles } from "@/constants/typography";

export type WheelItem = { value: string; label: string; disabled?: boolean };

const ITEM_HEIGHT = 36;
const ROWS = 5;
const SETTLE_MS = 110;

/**
 * Two or more scroll-snap wheels side by side, like the iOS date and time
 * picker, built from plain ScrollViews so the same code runs on iOS, Android
 * and the web build (the native DateTimePicker does not exist on web).
 *
 * Each column snaps to its rows. Disabled rows (a time that already passed) are
 * dimmed and never end up selected: the wheel moves on to the next row that is
 * allowed. Tapping a row also selects it, which is how a mouse user picks one.
 */
export function WheelPicker({
  columns,
}: {
  columns: Array<{
    label: string;
    items: WheelItem[];
    value: string;
    onChange: (value: string) => void;
    /** Relative width; the date column is wider than the time column. */
    flex?: number;
  }>;
}) {
  return (
    <View style={styles.frame}>
      <View pointerEvents="none" style={styles.band} />
      {columns.map((column) => (
        <Wheel
          items={column.items}
          key={column.label}
          label={column.label}
          onChange={column.onChange}
          style={{ flex: column.flex ?? 1 }}
          value={column.value}
        />
      ))}
    </View>
  );
}

function Wheel({
  items,
  value,
  onChange,
  label,
  style,
}: {
  items: WheelItem[];
  value: string;
  onChange: (value: string) => void;
  label: string;
  style: { flex: number };
}) {
  const ref = React.useRef<ScrollView>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragging = React.useRef(false);
  const selectedIndex = Math.max(
    0,
    items.findIndex((item) => item.value === value),
  );
  const [centre, setCentre] = React.useState(selectedIndex);

  const scrollToIndex = React.useCallback((index: number, animated: boolean) => {
    ref.current?.scrollTo({ y: index * ITEM_HEIGHT, animated });
  }, []);

  // Put the wheel on the selected row when it mounts, and follow the value when
  // something else changes it (a past time pushed forward).
  const laidOut = React.useRef(false);
  React.useEffect(() => {
    if (laidOut.current) scrollToIndex(selectedIndex, true);
    setCentre(selectedIndex);
  }, [selectedIndex, scrollToIndex]);

  React.useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const nearestAllowed = (index: number): number => {
    for (let step = 0; step < items.length; step += 1) {
      const after = index + step;
      if (after < items.length && !items[after].disabled) return after;
      const before = index - step;
      if (before >= 0 && !items[before].disabled) return before;
    }
    return index;
  };

  const settle = (y: number) => {
    const raw = Math.min(items.length - 1, Math.max(0, Math.round(y / ITEM_HEIGHT)));
    const index = nearestAllowed(raw);
    scrollToIndex(index, true);
    setCentre(index);
    if (items[index] && items[index].value !== value) onChange(items[index].value);
  };

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = event.nativeEvent.contentOffset.y;
    const index = Math.min(items.length - 1, Math.max(0, Math.round(y / ITEM_HEIGHT)));
    setCentre((current) => (current === index ? current : index));
    if (timer.current) clearTimeout(timer.current);
    // react-native-web has no snapToInterval and no momentum events: settle once
    // the scroll has been quiet for a moment. On a phone, wait for the finger.
    timer.current = setTimeout(() => {
      if (!dragging.current) settle(y);
    }, SETTLE_MS);
  };

  const web = Platform.OS === "web";
  return (
    <View style={[styles.column, style]}>
      <ScrollView
        accessibilityLabel={label}
        accessibilityRole="adjustable"
        contentContainerStyle={styles.content}
        decelerationRate="fast"
        nestedScrollEnabled
        onContentSizeChange={() => {
          if (laidOut.current) return;
          laidOut.current = true;
          scrollToIndex(selectedIndex, false);
        }}
        onScroll={onScroll}
        onScrollBeginDrag={() => {
          dragging.current = true;
        }}
        onScrollEndDrag={(event) => {
          dragging.current = false;
          if (timer.current) clearTimeout(timer.current);
          const y = event.nativeEvent.contentOffset.y;
          timer.current = setTimeout(() => settle(y), SETTLE_MS);
        }}
        ref={ref}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        style={[styles.scroll, web ? ({ scrollSnapType: "y mandatory" } as object) : null]}
      >
        {items.map((item, index) => {
          const active = index === centre;
          return (
            <Pressable
              accessibilityLabel={item.label}
              accessibilityRole="button"
              accessibilityState={{ disabled: item.disabled, selected: item.value === value }}
              disabled={item.disabled}
              key={item.value}
              onPress={() => {
                scrollToIndex(index, true);
                setCentre(index);
                if (item.value !== value) onChange(item.value);
              }}
              style={[styles.item, web ? ({ scrollSnapAlign: "center" } as object) : null]}
            >
              <Text
                numberOfLines={1}
                style={[
                  styles.itemText,
                  active && styles.itemTextActive,
                  item.disabled && styles.itemTextDisabled,
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    height: ITEM_HEIGHT * ROWS,
    flexDirection: "row",
    gap: Space.sm,
    overflow: "hidden",
  },
  band: {
    position: "absolute",
    left: 0,
    right: 0,
    top: ITEM_HEIGHT * ((ROWS - 1) / 2),
    height: ITEM_HEIGHT,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surfaceHigh,
  },
  column: { minWidth: 0 },
  scroll: { flex: 1 },
  content: { paddingVertical: ITEM_HEIGHT * ((ROWS - 1) / 2) },
  item: { height: ITEM_HEIGHT, alignItems: "center", justifyContent: "center" },
  itemText: { ...TextStyles.listName, color: Colors.muted },
  itemTextActive: { color: Colors.text },
  itemTextDisabled: { color: Colors.mutedDark, opacity: 0.6 },
});
