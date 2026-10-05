import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetModalProvider,
} from "@gorhom/bottom-sheet";
import React, { forwardRef, useCallback } from "react";
import { StyleSheet } from "react-native";

import { Colors, Radius } from "@/constants/colors";

/** Shared LocalCheck drawer shell. Flows own their height and content; this
 * component owns the gesture, backdrop, surface, and grabber treatment. */
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
    <BottomSheetModalProvider>
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
    </BottomSheetModalProvider>
  );
});

const styles = StyleSheet.create({
  background: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: Radius.card,
    borderTopRightRadius: Radius.card,
  },
  // 8 above the 4pt grabber, nothing below: a 12pt row (DRAWER_HANDLE_HEIGHT).
  handleRowCompact: { paddingTop: 8, paddingBottom: 0 },
  handle: {
    width: 38,
    height: 4,
    backgroundColor: Colors.muted,
  },
});
