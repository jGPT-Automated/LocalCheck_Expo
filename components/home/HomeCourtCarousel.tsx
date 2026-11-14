import React from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import type { Court } from "@/constants/data";
import { Colors } from "@/constants/colors";
import { useReducedMotion } from "@/hooks/useReducedMotion";

export function HomeCourtCarousel({
  courts,
  selectedId,
  onSelect,
  children,
}: {
  courts: Court[];
  selectedId: string;
  onSelect: (court: Court) => void;
  children: (court: Court) => React.ReactNode;
}) {
  const pager = React.useRef<ScrollView>(null);
  const target = React.useRef<number | null>(null);
  const position = React.useRef(0);
  const [width, setWidth] = React.useState(0);
  const reduced = useReducedMotion();
  const index = Math.max(
    0,
    courts.findIndex((court) => court.id === selectedId),
  );
  React.useEffect(() => {
    if (!width) return;
    if (Math.abs(position.current - index * width) < 2) {
      target.current = null;
      return;
    }
    target.current = index;
    pager.current?.scrollTo({ x: index * width, animated: !reduced });
  }, [index, width, reduced]);
  const scrolled = (x: number) => {
    position.current = x;
    if (!width) return;
    const i = Math.round(x / width);
    if (Math.abs(x - i * width) > 2) return;
    if (target.current !== null && i !== target.current) return;
    target.current = null;
    if (courts[i] && i !== index) onSelect(courts[i]);
  };
  return (
    <View testID="home-court-hero" style={styles.hero}>
      <ScrollView
        ref={pager}
        testID="home-court-carousel"
        horizontal
        pagingEnabled
        bounces={false}
        scrollEnabled={courts.length > 1}
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScrollBeginDrag={() => {
          target.current = null;
        }}
        onScroll={(e) => scrolled(e.nativeEvent.contentOffset.x)}
        onMomentumScrollEnd={(e) => scrolled(e.nativeEvent.contentOffset.x)}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        style={styles.pager}
      >
        {courts.map((court) => (
          <View
            key={court.id}
            style={{ width: width || undefined }}
            accessibilityElementsHidden={court.id !== selectedId}
            aria-hidden={court.id !== selectedId}
            importantForAccessibility={
              court.id === selectedId ? "auto" : "no-hide-descendants"
            }
          >
            {children(court)}
          </View>
        ))}
      </ScrollView>
      {courts.length > 1 ? (
        <View
          style={styles.indicators}
          accessibilityRole="tablist"
          accessibilityLabel="LocalList courts"
        >
          {courts.map((court, i) => (
            <Pressable
              key={court.id}
              accessibilityRole="tab"
              accessibilityLabel={`Show ${court.name}`}
              accessibilityState={{ selected: i === index }}
              aria-selected={i === index}
              onPress={() => onSelect(court)}
              style={styles.indicatorTarget}
            >
              <View style={[styles.line, i === index && styles.lineActive]} />
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  hero: { flexShrink: 0, backgroundColor: Colors.background },
  pager: { flexGrow: 0 },
  indicators: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  indicatorTarget: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  line: {
    width: 22,
    height: 3,
    borderRadius: 2,
    backgroundColor: Colors.borderLight,
  },
  lineActive: { backgroundColor: Colors.accent, width: 30 },
});
