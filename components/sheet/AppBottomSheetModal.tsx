import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
} from "@gorhom/bottom-sheet";
import React, { forwardRef, useCallback } from "react";
import { StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors, Radius } from "@/constants/colors";
import { Space } from "@/constants/layout";

/**
 * Bottom padding for content inside an AppBottomSheetModal. Sheets open in
 * front of the tab bar (one host at the app root), so content only clears the
 * home indicator. Use this instead of the safe area or Layout.tabBarClearance.
 */
export function useSheetBottomPadding(): number {
  const { bottom } = useSafeAreaInsets();
  return Math.max(bottom, Space.md) + Space.sm;
}

/** Shared LocalCheck drawer shell. Flows own their height and content; this
 * component owns the gesture, backdrop, surface, and grabber treatment. It
 * renders through the app-wide BottomSheetModalProvider (app/_layout.tsx DataProviders), so
 * every sheet opens in front of the tab bar. */
export const AppBottomSheetModal = forwardRef<
  BottomSheetModal,
  {
    backdropOpacity?: number;
    children: React.ReactNode;
    index?: number;
    onDismiss?: () => void;
    snapPoints: Array<string | number>;
    /** Size to content instead of the fixed detents. */
    dynamic?: boolean;
    maxDynamicContentSize?: number;
    /** Tighter grabber row, so content can start near the top edge. */
    compactHandle?: boolean;
  }
>(function AppBottomSheetModal(
  {
    backdropOpacity = 0.72,
    children,
    index = 0,
    onDismiss,
    snapPoints,
    dynamic = false,
    maxDynamicContentSize,
    compactHandle = false,
  },
  ref,
) {
  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={backdropOpacity}
        pressBehavior="close"
      />
    ),
    [backdropOpacity],
  );

  return (
      <BottomSheetModal
        ref={ref}
        index={index}
        snapPoints={dynamic ? undefined : snapPoints}
        enableDynamicSizing={dynamic}
        maxDynamicContentSize={maxDynamicContentSize}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        backgroundStyle={styles.background}
        handleIndicatorStyle={styles.handle}
        handleStyle={compactHandle ? styles.handleRowCompact : undefined}
        onDismiss={onDismiss}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize"
      >
        {children}
      </BottomSheetModal>
  );
});

const styles = StyleSheet.create({
  // Court-flow sheet: #121216, 22pt corners, one hairline along the top.
  background: {
    backgroundColor: Colors.sheet,
    borderTopLeftRadius: Radius.sheet,
    borderTopRightRadius: Radius.sheet,
    borderTopWidth: 1,
    borderColor: Colors.hairlineCard,
  },
  // 8 above the 4pt grabber, nothing below: a 12pt row (DRAWER_HANDLE_HEIGHT).
  handleRowCompact: { paddingTop: 8, paddingBottom: 0 },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: Colors.grabber,
  },
});
