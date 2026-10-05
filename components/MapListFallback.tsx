import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CourtListItem } from "@/components/CourtListItem";
import { useCourtSheet } from "@/components/sheet/CourtSheetHost";
import { Colors } from "@/constants/colors";
import { Typography } from "@/constants/typography";
import { useApp } from "@/context/AppContext";

/** Nearby-court list shown where the map can't run: a build without a Mapbox
 *  token, or Expo Go (which has no Mapbox native code). */
export function MapListFallback({ message }: { message: string }) {
  const { courts } = useApp();
  const { bottom } = useSafeAreaInsets();
  const { openCourtSheet } = useCourtSheet();
  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 24,
          paddingBottom: bottom + 96,
        }}
      >
        <Text style={styles.emptyText}>{message}</Text>
        {courts.map((c) => (
          <CourtListItem
            key={c.id}
            court={c}
            onPress={() => openCourtSheet({ courtId: c.id, distanceKm: c.distanceKm })}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  emptyText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 11,
    color: Colors.muted,
    letterSpacing: 1,
    textAlign: "center",
    marginTop: 40,
  },
});
