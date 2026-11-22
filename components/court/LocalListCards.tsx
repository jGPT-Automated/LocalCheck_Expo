import { Feather } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { CourtListItem } from "@/components/CourtListItem";
import type { Court } from "@/constants/data";
import { Colors } from "@/constants/colors";
import { Typography } from "@/constants/typography";
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
          <View key={court.id} testID={`local-list-${court.id}`}>
            {manage || court.id === selectedId ? (
              <View style={[styles.meta, inset && { marginHorizontal: 0 }]}>
                <View style={styles.defaultLabel}>
                  {manage && isDefault ? (
                    <>
                      <Feather name="star" size={12} color={Colors.liveInk} />
                      <Text style={styles.label}>Default</Text>
                    </>
                  ) : null}
                  {court.id === selectedId ? (
                    <Feather name="check" size={14} color={Colors.text} />
                  ) : null}
                </View>
                {manage && canEdit ? (
                  <View style={styles.actions}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Make ${court.name} default`}
                      accessibilityState={{
                        selected: isDefault,
                        disabled: isDefault,
                      }}
                      disabled={isDefault}
                      onPress={() => setDefaultCourt(court.id)}
                      style={styles.target}
                    >
                      <Feather
                        name="star"
                        size={18}
                        color={
                          isDefault ? Colors.liveInk : Colors.textSecondary
                        }
                      />
                    </Pressable>
                    {!isDefault ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${court.name} from LocalList`}
                        onPress={() => removeCourt(court.id)}
                        style={styles.target}
                      >
                        <Feather
                          name="x"
                          size={18}
                          color={Colors.textSecondary}
                        />
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}
              </View>
            ) : null}
            <CourtListItem
              isDefaultCourt={!manage && isDefault}
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
              style={inset ? { marginHorizontal: 0 } : undefined}
            />
          </View>
        );
      })}
    </View>
  );
}
const styles = StyleSheet.create({
  meta: {
    minHeight: 28,
    marginHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  defaultLabel: { flexDirection: "row", alignItems: "center", gap: 6 },
  label: {
    fontFamily: Typography.bodySemiBold,
    fontSize: 11,
    color: Colors.textSecondary,
  },
  actions: { flexDirection: "row", alignItems: "center" },
  target: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
});
