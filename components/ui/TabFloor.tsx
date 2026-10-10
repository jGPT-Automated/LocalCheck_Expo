import React from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * The tab bar is a hard floor (DESIGN.md, "Layout rules"). Screens and sheets
 * never draw content under it.
 *
 * The tab layout provides its real bar height here. Anything rendered inside
 * a tab reads it; stack screens pushed above the tabs (player, match, court)
 * get 0 and fall back to the safe area.
 */
const TabFloorContext = React.createContext(0);

export function TabFloorProvider({ height, children }: { height: number; children: React.ReactNode }) {
  return <TabFloorContext.Provider value={height}>{children}</TabFloorContext.Provider>;
}

/** Height of the tab bar under this screen, 0 when there is none. */
export function useTabFloor(): number {
  return React.useContext(TabFloorContext);
}

/**
 * Bottom padding for a scroll view's content: clears the tab bar when there is
 * one, otherwise the home indicator. `extra` is breathing room above it.
 */
export function useBottomFloor(extra = 0): number {
  const tabFloor = useTabFloor();
  const { bottom } = useSafeAreaInsets();
  return Math.max(tabFloor, bottom) + extra;
}
