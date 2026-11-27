import { Feather } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { CourtListItem } from "@/components/CourtListItem";
import type { Court } from "@/constants/data";
import { Colors, Radius } from "@/constants/colors";
import { Layout, Space } from "@/constants/layout";
import { useLocalList } from "@/context/LocalListContext";
import { useCourtCounts } from "@/context/CourtPresenceContext";

/** Existing court hero with a consistent default marker and optional management controls. */
export function LocalListCards({
  onSelect,
  manage = false,
  selectedId,
  inset = false,
}: {
  onSelect: (court: Court) => void;
  manage?: boolean;
  selectedId?: string;
  inset?: boolean;
}) {
  const { courts, defaultCourt, setDefaultCourt, removeCourt, canEdit } =
    useLocalList();
  const counts = useCourtCounts(courts);
  return (
    <View testID="local-list-cards">
      {courts.map((court) => {
        const isDefault = court.id === defaultCourt?.id;
        return (
          <View
            key={court.id}
            testID={`local-list-${court.id}`}
            style={[manage && styles.managementCard, manage && !inset && styles.outset]}
          >
            {court.id === selectedId ? (
              <View style={styles.selection}>
                <Feather name="check" size={14} color={Colors.text} />
              </View>
            ) : null}
            <CourtListItem
              isDefaultCourt={isDefault}
              court={
                counts[court.id]
                  ? {
                      ...court,
                      activeCount: counts[court.id].activeCount,
                      localCount: counts[court.id].localCount,
                    }
                  : court
              }
              onPress={onSelect}
              style={manage ? styles.managementHero : inset ? { marginHorizontal: 0 } : undefined}
            />
            {manage && canEdit && !isDefault ? (
              <View style={styles.actions}>
                <Pressable accessibilityRole="button" accessibilityLabel={`Make ${court.name} default`}
                  onPress={() => setDefaultCourt(court.id)} style={styles.target}>
                  <Feather name="star" size={18} color={Colors.textSecondary} />
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${court.name} from LocalList`}
                  onPress={() => removeCourt(court.id)} style={styles.target}>
                  <Feather name="x" size={18} color={Colors.textSecondary} />
                </Pressable>
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}
const styles = StyleSheet.create({
  managementCard: {
    marginTop: Space.md,
    borderRadius: Radius.courtCard,
    borderWidth: 1,
    borderColor: Colors.hairlineCard,
    backgroundColor: Colors.sheet,
    overflow: "hidden",
  },
  managementHero: { marginHorizontal: 0, marginVertical: 0, borderWidth: 0 },
  outset: { marginHorizontal: Space.lg },
  selection: { minHeight: 28, marginHorizontal: Layout.screenGutter, justifyContent: "center" },
  actions: { flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: Space.sm,
    borderTopWidth: 1, borderTopColor: Colors.hairline },
  target: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
});
