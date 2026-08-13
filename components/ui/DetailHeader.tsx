import React from "react";

import { ScreenHeader } from "@/components/ScreenHeader";

export function DetailHeader({
  title,
  onBack,
  right,
}: {
  title: string;
  onBack: () => void;
  right?: React.ReactNode;
}) {
  return <ScreenHeader onBack={onBack} right={right} title={title} />;
}
