import {
  BottomSheetBackdrop,
  type BottomSheetBackgroundProps,
  type BottomSheetBackdropProps,
  type BottomSheetHandleProps,
  BottomSheetModal,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { Feather } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors, Radius } from "@/constants/colors";
import { ControlSize, Spacing } from "@/constants/layout";
import { Typography } from "@/constants/typography";

function SheetBackground({ style }: BottomSheetBackgroundProps) {
  return <Animated.View pointerEvents="none" style={[style, styles.background]} />;
}

function SheetHandle(_props: BottomSheetHandleProps) {
  return (
    <View
      accessible
      accessibilityLabel="Bottom sheet handle"
      accessibilityRole="adjustable"
      style={styles.handle}
    >
      <View style={styles.grabber} />
    </View>
  );
}

/**
 * Standard library-backed shell for focused tasks that should remain in the
 * current map context. It deliberately owns the drag gesture, backdrop,
 * keyboard handoff, safe area, header, and dismissal behavior so task drawers
 * do not hand-roll those interactions screen by screen.
 */
export function TaskBottomSheet({
  visible,
  onClose,
  title,
  eyebrow,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
}) {
  const modalRef = useRef<BottomSheetModal>(null);
  const { top } = useSafeAreaInsets();
  const snapPoints = useMemo(() => ["92%"], []);

  useEffect(() => {
    if (visible) {
      requestAnimationFrame(() => modalRef.current?.present());
    } else {
      modalRef.current?.dismiss();
    }
  }, [visible]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.75}
        pressBehavior="close"
      />
    ),
    []
  );

  return (
    <BottomSheetModal
      ref={modalRef}
      index={0}
      snapPoints={snapPoints}
      enableDynamicSizing={false}
      enablePanDownToClose
      topInset={top}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      backdropComponent={renderBackdrop}
      backgroundComponent={SheetBackground}
      handleComponent={SheetHandle}
      onDismiss={onClose}
    >
      <BottomSheetView style={styles.header}>
        <View style={styles.headerText}>
          {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          hitSlop={8}
          onPress={onClose}
          style={({ pressed }) => [styles.close, pressed && styles.pressed]}
          testID="task-sheet-close"
        >
          <Feather name="x" size={20} color={Colors.textSecondary} />
        </Pressable>
      </BottomSheetView>
      {children}
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  background: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    overflow: "hidden",
  },
  handle: {
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.background,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
  },
  grabber: {
    width: 32,
    height: 3,
    borderRadius: 2,
    backgroundColor: Colors.borderLight,
  },
  header: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingLeft: Spacing.screen,
    paddingRight: Spacing.sm,
    paddingBottom: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  headerText: { flex: 1, gap: 3 },
  eyebrow: {
    fontFamily: Typography.bodyBold,
    fontSize: 9,
    lineHeight: 12,
    color: Colors.accent,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  title: {
    fontFamily: Typography.heading,
    fontSize: 18,
    lineHeight: 23,
    color: Colors.text,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  close: {
    width: ControlSize.minimum,
    height: ControlSize.minimum,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.sm,
  },
  pressed: { opacity: 0.68 },
});
