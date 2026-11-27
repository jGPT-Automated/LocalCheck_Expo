import React from "react";
import { View } from "react-native";
import { CourtListItem } from "@/components/CourtListItem";
import type { Court } from "@/constants/data";
import { useLocalList } from "@/context/LocalListContext";
import { useCourtCounts } from "@/context/CourtPresenceContext";

export function LocalListCards({ onSelect }: { onSelect: (court: Court) => void }) {
  const { courts, defaultCourt } = useLocalList();
  const counts = useCourtCounts(courts);
  return (
    <View testID="local-list-cards">
      {courts.map(court => (
        <View key={court.id} testID={`local-list-${court.id}`}>
          <CourtListItem court={{ ...court, ...counts[court.id] }} isDefaultCourt={court.id === defaultCourt?.id} onPress={onSelect} />
        </View>
      ))}
    </View>
  );
}
