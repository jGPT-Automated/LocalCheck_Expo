export function backLogoContainerStyle(size: number) {
  return {
    width: size,
    height: size,
    overflow: "hidden" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  };
}

export function backLogoFrameStyle(size: number) {
  return {
    position: "absolute" as const,
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    width: size,
    height: size,
  };
}
