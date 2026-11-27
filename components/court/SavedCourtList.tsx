import { Feather } from "@expo/vector-icons";
import React from "react";
import { Alert, Platform, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { SportEmblem } from "@/components/ui/SportEmblem";
import { Colors, Radius } from "@/constants/colors";
import type { Court } from "@/constants/data";
import { Layout, Space } from "@/constants/layout";
import { TextStyles } from "@/constants/typography";
import { useLocalList } from "@/context/LocalListContext";

function CourtIdentity({ court, isDefault }: { court: Court; isDefault: boolean }) {
  return (
    <View style={styles.identity}>
      <SportEmblem sport={court.sport} size={20} />
      <View style={styles.copy}>
        <Text style={styles.name}>{court.shortName || court.name}</Text>
        <Text style={styles.detail}>{[isDefault ? "Default court" : null, court.city || court.market].filter(Boolean).join(" · ")}</Text>
      </View>
    </View>
  );
}

export function SavedCourtPicker({ selectedId, onSelect }: { selectedId?: string; onSelect: (court: Court) => void }) {
  const { entries } = useLocalList();
  return <View style={styles.list}>{entries.map(({ court, isDefault }) => (
    <Pressable key={court.id} accessibilityRole="button" accessibilityLabel={`Open ${court.name}`}
      accessibilityState={{ selected: court.id === selectedId }} onPress={() => onSelect(court)}
      style={({ pressed }) => [styles.pick, pressed && styles.pressed]}>
      <CourtIdentity court={court} isDefault={isDefault} />
      {court.id === selectedId ? <Feather name="check" size={18} color={Colors.accent} /> : null}
    </Pressable>
  ))}</View>;
}

export function SavedCourtSettings({ defaultFenceOn, onToggle, changing }: {
  defaultFenceOn: boolean;
  changing: boolean;
  onToggle: (id: string, enabled: boolean) => Promise<void>;
}) {
  const list = useLocalList();
  const report = (error: unknown) => Alert.alert("LocalList", error instanceof Error ? error.message : "Try again.");
  const disabled = changing || list.busy || !list.ready;
  return (
    <View style={styles.list}>
      {list.error ? <Pressable accessibilityRole="button" onPress={list.reload} style={styles.action}>
        <Text style={styles.detail}>Couldn’t load LocalList. Retry</Text></Pressable> : null}
      {list.entries.map(({ court, isDefault, autoCheckIn }) => (
        <View key={court.id} style={styles.card} testID={`local-list-${court.id}`}>
          <CourtIdentity court={court} isDefault={isDefault} />
          <View style={styles.toggleRow}>
            <Text style={styles.label}>Auto check-in</Text>
            <Switch accessibilityLabel={`Auto check-in at ${court.name}`} disabled={disabled}
              {...(Platform.OS === "web" ? { activeThumbColor: Colors.white } : {})}
              trackColor={{ false: Colors.borderLight, true: Colors.accent }} thumbColor={Colors.white}
              value={autoCheckIn ?? (isDefault && defaultFenceOn)}
              onValueChange={on => { void onToggle(court.id, on).catch(report); }} />
          </View>
          {!isDefault ? <View style={styles.actions}>
            <Pressable accessibilityRole="button" accessibilityLabel={`Make ${court.name} default`} disabled={disabled}
              onPress={() => { void list.setDefaultCourt(court.id).catch(report); }} style={styles.action}>
              <Text style={styles.actionText}>Make default</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${court.name} from LocalList`} disabled={disabled}
              onPress={() => { void list.removeCourt(court.id).catch(report); }} style={styles.action}>
              <Text style={styles.detail}>Remove</Text>
            </Pressable>
          </View> : null}
        </View>
      ))}
      <Text style={styles.note}>Auto check-in uses Always location access in the iPhone app.</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  list: { gap: Space.sm },
  card: { paddingHorizontal: Space.lg, paddingTop: Space.lg, paddingBottom: Space.xs, borderRadius: Radius.row, backgroundColor: Colors.panel },
  identity: { flexDirection: "row", alignItems: "center", gap: Space.md, flexGrow: 1, flexShrink: 1, minWidth: 0 },
  copy: { flex: 1, minWidth: 0, gap: Space.xs },
  name: { ...TextStyles.listName, color: Colors.text },
  detail: { ...TextStyles.metadata, color: Colors.textSecondary },
  pick: { flexDirection: "row", alignItems: "center", gap: Space.md, backgroundColor: Colors.panel, borderRadius: Radius.row, padding: Space.lg },
  pressed: { opacity: 0.7 },
  toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: Layout.minTouchTarget, marginTop: Space.sm },
  label: { ...TextStyles.label, color: Colors.text },
  actions: { flexDirection: "row", justifyContent: "space-between", borderTopWidth: StyleSheet.hairlineWidth, borderColor: Colors.hairline },
  action: { minHeight: Layout.minTouchTarget, justifyContent: "center" },
  actionText: { ...TextStyles.label, color: Colors.liveInk },
  note: { ...TextStyles.caption, color: Colors.muted, lineHeight: 16, paddingVertical: Space.sm },
});
