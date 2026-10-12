import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import React, { useEffect, useMemo, useRef } from "react";
import { Dimensions, StyleSheet, Text, View } from "react-native";

import { Feather } from "@expo/vector-icons";

import { Colors, Radius } from "@/constants/colors";
import { TextStyles } from "@/constants/typography";

import { AppBottomSheetModal, useSheetBottomPadding } from "./AppBottomSheetModal";

/** Run-only task drawer. It deliberately replaces the old custom Modal for
 * this flow so swipe-down, backdrop close, and drag interruption are native to
 * the already-installed bottom-sheet stack. */
export function RunFlowSheet({
  visible,
  onClose,
  title,
  eyebrow,
  icon,
  subtitle,
  backdropOpacity,
  contentBottomPadding = 44,
  snapPoints: providedSnapPoints,
  dynamic = false,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: string;
  /** A Feather icon in an accent box before the title, with `subtitle` under it. */
  icon?: React.ComponentProps<typeof Feather>["name"];
  subtitle?: string;
  /** Keep the underlying surface visible when the drawer is part of it. */
  backdropOpacity?: number;
  /** Minimum breathing room below the final action. */
  contentBottomPadding?: number;
  /** Compact task drawers may opt into a smaller fixed detent. Schedule keeps 88%. */
  snapPoints?: Array<string | number>;
  /** Size the sheet to its content — no fixed detent, no inner scroll. For
   *  short single-action forms (Add Court steps). */
  dynamic?: boolean;
  children: React.ReactNode;
}) {
  const modalRef = useRef<BottomSheetModal>(null);
  const floorPadding = useSheetBottomPadding();
  const presentedRef = useRef(false);
  const snapPoints = useMemo<Array<string | number>>(
    () => providedSnapPoints ?? ["88%"],
    [providedSnapPoints],
  );

  useEffect(() => {
    if (visible && !presentedRef.current) {
      presentedRef.current = true;
      requestAnimationFrame(() => modalRef.current?.present());
    } else if (!visible && presentedRef.current) {
      modalRef.current?.dismiss();
    }
  }, [visible]);

  // The sheet itself clears the tab bar (AppBottomSheetModal); this only adds
  // room below the last action.
  const paddingBottom = Math.max(contentBottomPadding, floorPadding);

  // No close button — the sheet's own drag handle (swipe down) and tapping
  // the backdrop already dismiss it; a redundant X was the odd one out.
  const header = (
    <View style={styles.header}>
      {icon ? (
        <View style={styles.iconBox}>
          <Feather color={Colors.accent} name={icon} size={20} />
        </View>
      ) : null}
      <View style={styles.headingCopy}>
        <Text numberOfLines={1} style={styles.title}>
          {title}
        </Text>
        {subtitle ? (
          <Text numberOfLines={1} style={styles.subtitle}>
            {subtitle}
          </Text>
        ) : null}
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      </View>
    </View>
  );

  return (
    <AppBottomSheetModal
      ref={modalRef}
      snapPoints={snapPoints}
      dynamic={dynamic}
      maxDynamicContentSize={Dimensions.get("window").height * 0.82}
      backdropOpacity={backdropOpacity}
      onDismiss={() => {
        presentedRef.current = false;
        onClose();
      }}
    >
      {dynamic ? (
        <BottomSheetView style={{ paddingBottom }}>
          {header}
          <View style={styles.content}>{children}</View>
        </BottomSheetView>
      ) : (
        <>
          {header}
          <BottomSheetScrollView
            contentContainerStyle={[styles.content, { paddingBottom }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {children}
          </BottomSheetScrollView>
        </>
      )}
    </AppBottomSheetModal>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  headingCopy: { flex: 1, minWidth: 0, gap: 3 },
  iconBox: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.accentBorder,
    borderRadius: Radius.md,
    backgroundColor: Colors.accentDim,
  },
  subtitle: { ...TextStyles.metadata, color: Colors.textSecondary },
  eyebrow: {
    ...TextStyles.labelSmall,
    color: Colors.accent,
    letterSpacing: 1.4,
  },
  title: {
    ...TextStyles.title,
    color: Colors.text,
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  content: { paddingHorizontal: 20, paddingTop: 18 },
});
