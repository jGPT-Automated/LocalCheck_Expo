import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { Colors, Radius } from "@/constants/colors";
import { Layout } from "@/constants/layout";
import { Typography } from "@/constants/typography";

type SelectAnchor = { x: number; y: number; width: number; height: number };

/**
 * Shared compact value selector. The menu is rendered in a native Modal so it
 * sits above lists and receives its own touches instead of falling through to
 * a row underneath. This follows PanelUI's portal/popover ownership pattern
 * without pulling its SDK 57+/Uniwind runtime into the current SDK 54 app.
 */
export function CompactSelect<T extends string>({
  accessibilityLabel,
  align = "end",
  options,
  onChange,
  value,
  variant = "contained",
  dense = false,
  wide = false,
}: {
  accessibilityLabel: string;
  align?: "start" | "end";
  options: ReadonlyArray<{ label: string; value: T }>;
  onChange: (value: T) => void;
  value: T;
  variant?: "contained" | "plain";
  dense?: boolean;
  /** Full-width form-field treatment; the menu follows the measured trigger. */
  wide?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [anchor, setAnchor] = React.useState<SelectAnchor | null>(null);
  const triggerRef = React.useRef<View>(null);
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();
  const selected = options.find((option) => option.value === value) ?? options[0];
  const menuWidth = wide
    ? Math.min(anchor?.width ?? 280, viewportWidth - 16)
    : 132;
  const menuHeight = options.length * 44 + 12;

  const openMenu = React.useCallback(() => {
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y, width, height });
      setOpen(true);
    });
  }, []);

  const menuLeft = anchor
    ? Math.min(
        Math.max(8, align === "end" ? anchor.x + anchor.width - menuWidth : anchor.x),
        viewportWidth - menuWidth - 8
      )
    : 8;
  const menuTop = anchor
    ? anchor.y + anchor.height + 6 + menuHeight > viewportHeight
      ? Math.max(8, anchor.y - menuHeight - 6)
      : anchor.y + anchor.height + 6
    : 8;

  return (
    <>
      <View collapsable={false} ref={triggerRef}>
        <Pressable
          accessibilityLabel={accessibilityLabel}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          hitSlop={variant === "plain" ? 4 : 7}
          onPress={open ? () => setOpen(false) : openMenu}
          style={({ pressed }) => [
            styles.trigger,
            variant === "plain" ? styles.triggerPlain : styles.triggerContained,
            dense && styles.triggerDense,
            wide && styles.triggerWide,
            pressed && styles.pressed,
          ]}
        >
          <Text
            numberOfLines={1}
            style={[styles.triggerText, dense && styles.triggerTextDense, wide && styles.triggerTextWide]}
          >
            {selected?.label}
          </Text>
          <Feather
            color={Colors.textSecondary}
            name={open ? "chevron-up" : "chevron-down"}
            size={13}
          />
        </Pressable>
      </View>

      <Modal
        animationType="fade"
        onRequestClose={() => setOpen(false)}
        presentationStyle="overFullScreen"
        statusBarTranslucent
        transparent
        visible={open && Boolean(anchor)}
      >
        <View style={styles.overlay}>
          <Pressable
            accessibilityLabel="Close selector"
            onPress={() => setOpen(false)}
            style={StyleSheet.absoluteFill}
          />
          <View
            accessibilityRole="menu"
            style={[styles.menu, { left: menuLeft, top: menuTop, width: menuWidth }]}
          >
            {options.map((option) => (
              <Pressable
                accessibilityRole="menuitem"
                accessibilityState={{ selected: option.value === value }}
                key={option.value}
                onPress={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                style={({ pressed }) => [
                  styles.option,
                  option.value === value && styles.optionSelected,
                  pressed && styles.pressed,
                ]}
              >
                <Text numberOfLines={1} style={[styles.optionText, option.value === value && styles.optionTextSelected]}>
                  {option.label}
                </Text>
                {option.value === value ? (
                  <Feather color={Colors.accent} name="check" size={13} />
                ) : null}
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  triggerContained: {
    minWidth: 58,
    height: 30,
    paddingHorizontal: 9,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceHigh,
  },
  triggerPlain: {
    minWidth: 52,
    minHeight: Layout.minTouchTarget,
    paddingHorizontal: 2,
    backgroundColor: "transparent",
  },
  triggerDense: { minHeight: 40 },
  triggerWide: {
    width: "100%",
    minHeight: Layout.minTouchTarget,
    paddingHorizontal: 14,
  },
  triggerText: {
    fontFamily: Typography.bodyBold,
    fontSize: 9,
    color: Colors.text,
    letterSpacing: 1,
  },
  triggerTextDense: {
    fontFamily: Typography.heading,
    fontSize: 14,
    lineHeight: 18,
  },
  triggerTextWide: {
    flex: 1,
    fontFamily: Typography.bodySemiBold,
    fontSize: 13,
    letterSpacing: 0,
  },
  overlay: {
    flex: 1,
    backgroundColor: Platform.OS === "web" ? "rgba(0,0,0,0.01)" : "transparent",
  },
  menu: {
    position: "absolute",
    padding: 6,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: 16,
    backgroundColor: Colors.surfaceHigh,
    shadowColor: Colors.black,
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 24,
  },
  option: {
    minHeight: Layout.minTouchTarget,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderRadius: 10,
  },
  optionSelected: { backgroundColor: Colors.surfaceSelected },
  optionText: {
    flex: 1,
    fontFamily: Typography.bodyMedium,
    fontSize: 11,
    color: Colors.textSecondary,
    letterSpacing: 0.5,
  },
  optionTextSelected: { color: Colors.text },
  pressed: { opacity: 0.72 },
});
