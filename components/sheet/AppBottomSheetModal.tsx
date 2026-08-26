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
    children: React.ReactNode;
    index?: number;
    onDismiss?: () => void;
    snapPoints: Array<string | number>;
  }
>(function AppBottomSheetModal(
  { children, index = 0, onDismiss, snapPoints },
  ref,
) {
  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.72}
        pressBehavior="close"
      />
    ),
    [],
  );

  return (
    <BottomSheetModalProvider>
      <BottomSheetModal
        ref={ref}
        index={index}
        snapPoints={snapPoints}
        enableDynamicSizing={false}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        backgroundStyle={styles.background}
        handleIndicatorStyle={styles.handle}
        onDismiss={onDismiss}
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
  handle: {
    width: 38,
    height: 4,
    backgroundColor: Colors.muted,
  },
});
