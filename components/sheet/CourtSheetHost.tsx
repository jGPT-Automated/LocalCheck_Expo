import { BottomSheetModal } from "@gorhom/bottom-sheet";
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppBottomSheetModal } from "./AppBottomSheetModal";
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
 * velocity handoff, snap points at peek (40%) / full (92%), swipe-down or
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
  const [peekHeight, setPeekHeight] = useState(332);

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

  // The collapsed drawer ends at the disclosure rail rather than exposing the
  // beginning of the expanded content. CourtSheetContent reports its actual
  // compact height so long names and platform font metrics remain supported.
  const snapPoints = useMemo<Array<string | number>>(
    () => [peekHeight, "92%"],
    [peekHeight],
  );

  return (
    <CourtSheetContext.Provider value={api}>
      {children}
      <AppBottomSheetModal
        ref={modalRef}
        snapPoints={snapPoints}
        onDismiss={() => setArgs(null)}
      >
        {args && (
          <CourtSheetContent
            courtId={args.courtId}
            distanceKm={args.distanceKm}
            onNavigate={closeCourtSheet}
            onExpand={expandCourtSheet}
            onPeekHeight={(height) => setPeekHeight(Math.ceil(height + 24))}
          />
        )}
      </AppBottomSheetModal>
    </CourtSheetContext.Provider>
  );
}
