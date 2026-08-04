import {
  BottomSheetBackdrop,
  type BottomSheetBackgroundProps,
  type BottomSheetBackdropProps,
  type BottomSheetHandleProps,
  BottomSheetModal,
  BottomSheetModalProvider,
} from "@gorhom/bottom-sheet";
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors, Radius } from "@/constants/colors";
import { CourtSheetContent } from "./CourtSheetContent";

/**
 * The app-wide court drawer, done the standard way: one @gorhom/bottom-sheet
 * modal hosted at the root, opened imperatively from anywhere via
 * `useCourtSheet().openCourtSheet({ courtId, distanceKm? })`.
 *
 * Why this and not a formSheet route: the native-detent route (sprint 2)
 * rendered as a blank sheet on device and a dead-end full page on web.
 * @gorhom/bottom-sheet runs on reanimated + gesture-handler (both already in
 * the shipped binary → OTA-safe) and gives the DESIGN.md sheet contract on
 * every platform: draggable both directions, interruptible mid-gesture,
 * velocity handoff, snap points at peek (46%) / full (92%), swipe-down or
 * backdrop-tap to dismiss.
 */

type OpenArgs = { courtId: string; distanceKm?: number };

type CourtSheetApi = {
  openCourtSheet: (args: OpenArgs) => void;
  closeCourtSheet: () => void;
};

const CourtSheetContext = createContext<CourtSheetApi>({
  openCourtSheet: () => {},
  closeCourtSheet: () => {},
});

/**
 * One background owns the complete sheet surface. Keeping the radii and
 * hairline on this animated layer prevents the handle and scroll content from
 * reading as separate panels while the sheet moves between detents.
 */
function CourtSheetBackground({ style }: BottomSheetBackgroundProps) {
  return (
    <Animated.View
      pointerEvents="none"
      style={[style, styles.sheetBackground]}
    />
  );
}

function CourtSheetHandle(_props: BottomSheetHandleProps) {
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

export function useCourtSheet() {
  return useContext(CourtSheetContext);
}

export function CourtSheetProvider({ children }: { children: React.ReactNode }) {
  const modalRef = useRef<BottomSheetModal>(null);
  const [args, setArgs] = useState<OpenArgs | null>(null);
  const { top } = useSafeAreaInsets();

  const openCourtSheet = useCallback((next: OpenArgs) => {
    setArgs(next);
    // present() after state lands so content renders with the right court
    requestAnimationFrame(() => modalRef.current?.present());
  }, []);

  const closeCourtSheet = useCallback(() => {
    modalRef.current?.dismiss();
  }, []);

  // Tap-to-expand affordance — the swipe gesture has no mouse equivalent on web
  const expandCourtSheet = useCallback(() => {
    modalRef.current?.snapToIndex(1);
  }, []);

  const api = useMemo(
    () => ({ openCourtSheet, closeCourtSheet }),
    [openCourtSheet, closeCourtSheet]
  );

  const snapPoints = useMemo(() => ["46%", "92%"], []);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
        opacity={0.75}
      />
    ),
    []
  );

  return (
    <BottomSheetModalProvider>
      <CourtSheetContext.Provider value={api}>
        {children}
        <BottomSheetModal
          ref={modalRef}
          index={0}
          snapPoints={snapPoints}
          enableDynamicSizing={false}
          enablePanDownToClose
          onDismiss={() => setArgs(null)}
          backdropComponent={renderBackdrop}
          backgroundComponent={CourtSheetBackground}
          handleComponent={CourtSheetHandle}
          topInset={top}
          // gorhom's own surface defaults to white. The custom background
          // component covers most of it, but the modal's container still
          // showed white at the rounded corners — these three clip and colour
          // the actual container so nothing light can peek through.
          style={styles.sheet}
          backgroundStyle={styles.sheetBackground}
          containerStyle={styles.sheetContainer}
        >
          {args && (
            <CourtSheetContent
              courtId={args.courtId}
              distanceKm={args.distanceKm}
              onNavigate={closeCourtSheet}
              onExpand={expandCourtSheet}
            />
          )}
        </BottomSheetModal>
      </CourtSheetContext.Provider>
    </BottomSheetModalProvider>
  );
}

const styles = StyleSheet.create({
  // The modal container itself. Clipping here is what stops a light corner
  // showing outside the rounded surface.
  sheet: {
    overflow: "hidden",
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
  },
  sheetContainer: { backgroundColor: "transparent" },
  sheetBackground: {
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
    backgroundColor: Colors.borderLight,
    width: 32,
    height: 3,
    borderRadius: 2,
  },
});
