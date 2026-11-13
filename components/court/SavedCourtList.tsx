import { Feather } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Court } from "@/constants/data";
import { Colors } from "@/constants/colors";
import { Typography } from "@/constants/typography";
import { useApp } from "@/context/AppContext";

/** The same server-owned list in Home, court drawers and court fields. */
export function SavedCourtList({ selectedId, onSelect }: { selectedId?: string; onSelect: (court: Court) => void }) {
  const { savedCourts, savedCourtsError, refreshSavedCourts } = useApp();
  return <View>
    {savedCourts.map(court => <Pressable key={court.id} accessibilityRole="button"
      accessibilityLabel={`Pick ${court.name}`} accessibilityState={{ selected: selectedId === court.id }}
      onPress={() => onSelect(court)} style={styles.row}>
      <Text style={styles.name}>{court.shortName || court.name}</Text>
      {selectedId === court.id ? <Feather name="check" size={18} color={Colors.accent} /> : null}
    </Pressable>)}
    {savedCourtsError ? <Pressable accessibilityRole="button" onPress={() => void refreshSavedCourts()} style={styles.row}>
      <Text style={styles.error}>Couldn't load courts. Try again.</Text>
    </Pressable> : null}
  </View>;
}
const styles = StyleSheet.create({
  row: { minHeight: 52, paddingHorizontal: 20, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
  name: { flex: 1, fontFamily: Typography.bodySemiBold, fontSize: 14, color: Colors.text },
  error: { fontFamily: Typography.bodyMedium, fontSize: 12, color: Colors.textSecondary },
});
