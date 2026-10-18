import { Feather } from "@expo/vector-icons";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Keyboard, Pressable, StyleSheet, Text, View } from "react-native";

import { SearchField } from "@/components/ui/SearchField";
import { Colors } from "@/constants/colors";
import type { Court } from "@/constants/data";
import { Space } from "@/constants/layout";
import { TextStyles } from "@/constants/typography";
import { useDeviceLocation } from "@/context/DeviceLocationContext";
import { fetchClosestCourts, searchCourts } from "@/services/courtService";

export const courtLabel = (court: Court | null) => (court ? court.shortName || court.name : "");

/**
 * The one "where" field: a search box with the nearest three courts, then a
 * standard typeahead. Used by the challenge and scheduled-game drawers. While
 * the box has focus the parent can hide what is below it (`onFocusChange`).
 */
export function CourtSearchPicker({
  court,
  onPick,
  onFocusChange,
}: {
  court: Court | null;
  onPick: (court: Court) => void;
  onFocusChange?: (focused: boolean) => void;
}) {
  const [text, setText] = useState(courtLabel(court));
  const [focused, setFocusedState] = useState(false);
  const setFocused = (next: boolean) => {
    setFocusedState(next);
    onFocusChange?.(next);
  };

  // A court that arrives (or changes) from outside shows in the box.
  const courtId = court?.id;
  useEffect(() => {
    if (!focused) setText(courtLabel(court));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courtId]);

  const { coord } = useDeviceLocation();
  const sport = court?.sport ?? null;
  const [nearest, setNearest] = useState<Court[]>([]);
  useEffect(() => {
    if (!coord) return;
    let active = true;
    void fetchClosestCourts(coord.lat, coord.lng, sport, 3).then((rows) => {
      if (active) setNearest(rows);
    });
    return () => {
      active = false;
    };
  }, [coord, sport]);

  const term = text.trim();
  const typing = focused && term.length >= 2 && term !== courtLabel(court);
  const [results, setResults] = useState<Court[]>([]);
  const [searching, setSearching] = useState(false);
  useEffect(() => {
    if (!typing) {
      setResults([]);
      setSearching(false);
      return;
    }
    let active = true;
    setSearching(true);
    const timer = setTimeout(() => {
      void searchCourts(term, sport, 8).then((rows) => {
        if (!active) return;
        setResults(rows);
        setSearching(false);
      });
    }, 220);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [typing, term, sport]);

  const suggestions = useMemo(() => {
    if (typing) return results;
    const seen = new Set<string>();
    return [court, ...nearest].filter((row): row is Court => {
      if (!row || seen.has(row.id)) return false;
      seen.add(row.id);
      return true;
    });
  }, [typing, results, court, nearest]);

  const courtRef = useRef(court);
  courtRef.current = court;
  const pick = (next: Court) => {
    setText(courtLabel(next));
    setFocused(false);
    Keyboard.dismiss();
    onPick(next);
  };
  // Leaving the box without picking puts the chosen court back. The short wait
  // lets a tap on a suggestion land first.
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onBlur = () => {
    blurTimer.current = setTimeout(() => {
      setFocused(false);
      setText(courtLabel(courtRef.current));
    }, 160);
  };
  useEffect(
    () => () => {
      if (blurTimer.current) clearTimeout(blurTimer.current);
    },
    [],
  );

  return (
    <>
      <SearchField
        accessibilityLabel="Court"
        loading={searching}
        onBlur={onBlur}
        onChangeText={setText}
        onClear={() => setText("")}
        onFocus={() => {
          if (blurTimer.current) clearTimeout(blurTimer.current);
          setFocused(true);
        }}
        placeholder="Search courts"
        selectTextOnFocus
        value={text}
      />
      {focused ? (
        <View style={styles.list}>
          {!typing && suggestions.length > 0 ? <Text style={styles.listLabel}>NEAREST</Text> : null}
          {suggestions.map((row) => (
            <Pressable
              accessibilityLabel={`Pick ${row.name}`}
              accessibilityRole="button"
              key={row.id}
              onPress={() => pick(row)}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <View style={styles.rowCopy}>
                <Text numberOfLines={1} style={styles.rowName}>
                  {courtLabel(row)}
                </Text>
                <Text numberOfLines={1} style={styles.rowMeta}>
                  {[
                    row.city,
                    row.distanceKm != null ? `${(row.distanceKm * 0.621371).toFixed(1)} MI` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
              </View>
              {row.id === court?.id ? <Feather color={Colors.accent} name="check" size={16} /> : null}
            </Pressable>
          ))}
          {typing && !searching && suggestions.length === 0 ? (
            <Text style={styles.empty}>NO COURTS FOUND</Text>
          ) : null}
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  list: { marginTop: Space.sm },
  listLabel: { ...TextStyles.labelSmall, marginVertical: Space.sm, letterSpacing: 1.2, color: Colors.muted },
  row: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: Space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  rowCopy: { flex: 1, minWidth: 0, gap: 2 },
  rowName: { ...TextStyles.listName, color: Colors.text },
  rowMeta: { ...TextStyles.caption, color: Colors.muted },
  pressed: { opacity: 0.7 },
  empty: { ...TextStyles.labelSmall, paddingVertical: Space.lg, color: Colors.muted },
});
