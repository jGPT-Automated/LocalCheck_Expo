import { BottomSheetModal, type BottomSheetFooterProps } from "@gorhom/bottom-sheet";
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { drawerPeekHeight } from "@/lib/courtDrawerLayout";
import { Springs } from "@/constants/motion";

import { AppBottomSheetModal } from "./AppBottomSheetModal";
import { CourtSheetContent, CourtSheetFooter } from "./CourtSheetContent";

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
 * velocity handoff, snap points at a stable peek / full (92%), swipe-down or
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

export function CourtSheetProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const modalRef = useRef<BottomSheetModal>(null);
  const [args, setArgs] = useState<OpenArgs | null>(null);
  const { height } = useWindowDimensions();
  const { bottom } = useSafeAreaInsets();

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
    [openCourtSheet, closeCourtSheet],
  );

  // Stable before presentation: asynchronous data and content layout never
  // move the opening detent. Window changes alone can update the size budget.
  const snapPoints = useMemo<Array<string | number>>(
    () => [drawerPeekHeight(height, bottom), "92%"],
    [height, bottom],
  );
  const renderFooter = useCallback(
    (props: BottomSheetFooterProps) => args ? (
      <CourtSheetFooter {...props} courtId={args.courtId} onNavigate={closeCourtSheet} />
    ) : null,
    [args, closeCourtSheet],
  );

  return (
    <CourtSheetContext.Provider value={api}>
      {children}
      <AppBottomSheetModal
        ref={modalRef}
        snapPoints={snapPoints}
        compactHandle
        footerComponent={renderFooter}
        animationConfigs={Springs.sheet}
        onDismiss={() => setArgs(null)}
      >
        {args && (
          <CourtSheetContent
            key={args.courtId}
            courtId={args.courtId}
            distanceKm={args.distanceKm}
            onNavigate={closeCourtSheet}
            onExpand={expandCourtSheet}
          />
        )}
      </AppBottomSheetModal>
    </CourtSheetContext.Provider>
  );
}
