import { Feather } from "@expo/vector-icons";
import * as Location from "expo-location";
import React from "react";
import { Platform, Pressable, StyleSheet, Switch, Text, View } from "react-native";

import { GeofenceVisual } from "@/components/autoCheckIn/GeofenceVisual";
import { RunFlowSheet } from "@/components/sheet/RunFlowSheet";
import { Colors } from "@/constants/colors";
import { Layout, Space } from "@/constants/layout";
import { TextStyles } from "@/constants/typography";
import { locationPermissionLabel, type LocationPermissionLabel } from "@/lib/locationPermission";

/**
 * Settings > Auto check-in (D48): everything about it in one drawer. The
 * circle it watches, the switch, what iPhone allows for location, and the two
 * friend alerts. Replaces the separate Location row and the two alert rows.
 */
export function AutoCheckInSettingsSheet({
  visible,
  onClose,
  courtName,
  on,
  canToggle,
  onToggle,
  shareAlerts,
  receiveAlerts,
  alertsSaving,
  onShareAlerts,
  onReceiveAlerts,
  onOpenSettings,
}: {
  visible: boolean;
  onClose: () => void;
  courtName: string | null;
  on: boolean;
  canToggle: boolean;
  onToggle: (next: boolean) => void;
  shareAlerts: boolean;
  receiveAlerts: boolean;
  alertsSaving: boolean;
  onShareAlerts: (next: boolean) => void;
  onReceiveAlerts: (next: boolean) => void;
  onOpenSettings: () => void;
}) {
  const [permission, setPermission] = React.useState<LocationPermissionLabel | null>(null);

  React.useEffect(() => {
    if (!visible || Platform.OS === "web") return;
    let cancelled = false;
    void Promise.all([
      Location.getForegroundPermissionsAsync().catch(() => null),
      Location.getBackgroundPermissionsAsync().catch(() => null),
    ]).then(([fg, bg]) => {
      if (cancelled) return;
      setPermission(
        locationPermissionLabel({
          foregroundGranted: fg?.granted === true,
          backgroundGranted: bg?.granted === true,
        }),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  return (
    <RunFlowSheet
      contentBottomPadding={Space.lg}
      dynamic
      eyebrow={courtName ? courtName.toUpperCase() : "SET A LOCAL COURT FIRST"}
      onClose={onClose}
      title="AUTO CHECK-IN"
      visible={visible}
    >
      <View style={styles.content}>
        {courtName ? <GeofenceVisual courtName={courtName} /> : null}
        <View>
          <ToggleRow
            disabled={!canToggle}
            label="Auto check-in"
            onChange={onToggle}
            value={on}
          />
          <View style={styles.row}>
            <Text style={styles.label}>Location</Text>
            <Text style={[styles.value, permission === "ALWAYS" ? styles.valueGood : null]}>
              {permission ?? "—"}
            </Text>
            {permission && permission !== "ALWAYS" ? (
              <Pressable accessibilityRole="link" hitSlop={8} onPress={onOpenSettings} style={styles.link}>
                <Text style={styles.linkText}>CHANGE</Text>
                <Feather color={Colors.accent} name="external-link" size={12} />
              </Pressable>
            ) : null}
          </View>
          <ToggleRow
            disabled={alertsSaving}
            label="Share my check-ins"
            onChange={onShareAlerts}
            value={shareAlerts}
          />
          <ToggleRow
            disabled={alertsSaving}
            label="Friends' check-ins"
            last
            onChange={onReceiveAlerts}
            value={receiveAlerts}
          />
        </View>
        <Text style={styles.note}>
          Auto check-in needs Always. LocalCheck only learns when you enter or leave this circle.
        </Text>
      </View>
    </RunFlowSheet>
  );
}

function ToggleRow({
  label,
  value,
  onChange,
  disabled = false,
  last = false,
}: {
  label: string;
  value: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  last?: boolean;
}) {
  return (
    <View style={[styles.row, last ? styles.rowLast : null]}>
      <Text style={styles.label}>{label}</Text>
      <Switch
        accessibilityLabel={label}
        disabled={disabled}
        onValueChange={onChange}
        thumbColor={Colors.white}
        trackColor={{ false: Colors.borderLight, true: Colors.accent }}
        value={value}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: Space.md },
  row: {
    minHeight: Layout.minTouchTarget + Space.xs,
    flexDirection: "row",
    alignItems: "center",
    gap: Space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  rowLast: { borderBottomWidth: 0 },
  label: { ...TextStyles.listName, flex: 1, color: Colors.text },
  value: { ...TextStyles.labelSmall, color: Colors.textSecondary, letterSpacing: 1 },
  valueGood: { color: Colors.accent },
  link: { flexDirection: "row", alignItems: "center", gap: 4 },
  linkText: { ...TextStyles.labelSmall, color: Colors.accent, letterSpacing: 1 },
  note: { ...TextStyles.caption, color: Colors.muted },
});
