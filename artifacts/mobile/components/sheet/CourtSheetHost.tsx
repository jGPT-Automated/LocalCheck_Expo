import {
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
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
import { StyleSheet } from "react-native";

import { Colors } from "@/constants/colors";
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

export function useCourtSheet() {
  return useContext(CourtSheetContext);
}

export function CourtSheetProvider({ children }: { children: React.ReactNode }) {
  const modalRef = useRef<BottomSheetModal>(null);
  const [args, setArgs] = useState<OpenArgs | null>(null);

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
          backgroundStyle={styles.sheetBackground}
          handleIndicatorStyle={styles.grabber}
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
  sheetBackground: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  grabber: {
    backgroundColor: Colors.muted,
    width: 36,
    height: 4,
  },
});
