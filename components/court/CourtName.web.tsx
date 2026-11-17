import React, { useLayoutEffect, useRef, useState } from "react";
import { StyleSheet, Text, type TextProps } from "react-native";

/** RN Web ignores adjustsFontSizeToFit. Measure the loaded face, not character counts. */
export function CourtName({ children, style, ...props }: TextProps & { children: string }) {
  const ref = useRef<Text>(null);
  const baseSize = StyleSheet.flatten(style)?.fontSize ?? 30;
  const [fontSize, setFontSize] = useState(baseSize);
  useLayoutEffect(() => {
    const element = ref.current as unknown as HTMLElement | null;
    if (!element) return;
    let active = true;
    const canvas = document.createElement("canvas").getContext("2d");
    const fit = () => {
      if (!active || !canvas) return;
      const css = getComputedStyle(element);
      canvas.font = `${css.fontStyle} ${css.fontWeight} ${baseSize}px ${css.fontFamily}`;
      const text = css.textTransform === "uppercase" ? children.toUpperCase() : children;
      const tracking = (parseFloat(css.letterSpacing) || 0) * Math.max(0, text.length - 1);
      const naturalWidth = canvas.measureText(text).width;
      const available = element.getBoundingClientRect().width;
      if (available <= 0 || naturalWidth <= 0) return;
      const scale = Math.min(1, (available - tracking - 1) / naturalWidth);
      setFontSize(Math.max(11, Math.floor(baseSize * scale * 100) / 100));
    };
    fit();
    void document.fonts.ready.then(fit);
    document.fonts.addEventListener("loadingdone", fit);
    const observer = new ResizeObserver(fit);
    observer.observe(element);
    return () => {
      active = false;
      observer.disconnect();
      document.fonts.removeEventListener("loadingdone", fit);
    };
  }, [baseSize, children, style]);
  return <Text {...props} ref={ref} numberOfLines={1} style={[style, { fontSize }]}>{children}</Text>;
}
