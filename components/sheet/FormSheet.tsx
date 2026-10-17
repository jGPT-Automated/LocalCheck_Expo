import React from "react";

import { RunFlowSheet } from "@/components/sheet/RunFlowSheet";

/**
 * The shell for task forms presented over a screen (Pick a court, I'll be
 * there, Log game from a profile). Since Oct 17 it is the same swipeable
 * bottom sheet as the Explore court drawer and the challenge drawer
 * (RunFlowSheet → AppBottomSheetModal): one drawer everywhere, dragged down
 * or tapped outside to close. The form keeps its own scroll view and
 * keyboard handling; the sheet gives it the space under the title.
 */
export function FormSheet({
  visible,
  onClose,
  title,
  eyebrow,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  /** Small line under the title, e.g. "vs Marcus". */
  eyebrow?: string;
  children: React.ReactNode;
}) {
  return (
    <RunFlowSheet
      eyebrow={eyebrow}
      onClose={onClose}
      scroll={false}
      snapPoints={["92%"]}
      title={title}
      visible={visible}
    >
      {children}
    </RunFlowSheet>
  );
}
