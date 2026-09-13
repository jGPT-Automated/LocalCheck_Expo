import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import React, { useEffect, useMemo, useRef } from "react";
import { Dimensions, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "@/constants/colors";
import { TextStyles } from "@/constants/typography";

import { AppBottomSheetModal } from "./AppBottomSheetModal";

/** Run-only task drawer. It deliberately replaces the old custom Modal for
 * this flow so swipe-down, backdrop close, and drag interruption are native to
 * the already-installed bottom-sheet stack. */
export function RunFlowSheet({
  visible,
  onClose,
  title,
  eyebrow,
  backdropOpacity,
  bottomClearance = 0,
  contentBottomPadding = 44,
  snapPoints: providedSnapPoints,
  dynamic = false,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: string;
  /** Keep the underlying surface visible when the drawer is part of it. */
  backdropOpacity?: number;
  bottomClearance?: number;
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
  const { bottom } = useSafeAreaInsets();
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

  const paddingBottom = Math.max(contentBottomPadding, bottom + bottomClearance);

  // No close button — the sheet's own drag handle (swipe down) and tapping
  // the backdrop already dismiss it; a redundant X was the odd one out.
  const header = (
    <View style={styles.header}>
      <View style={styles.headingCopy}>
        <Text style={styles.title}>{title}</Text>
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
  headingCopy: { flex: 1, gap: 3 },
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
