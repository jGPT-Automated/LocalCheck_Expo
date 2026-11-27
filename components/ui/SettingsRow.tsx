import { Feather } from "@expo/vector-icons";
import React from "react";
import { Platform, Pressable, StyleSheet, Switch, Text, View } from "react-native";

import { Colors } from "@/constants/colors";
import { Layout, Space } from "@/constants/layout";
import { TextStyles } from "@/constants/typography";

type CommonProps = {
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  detail?: string;
  value?: string;
  valueMuted?: boolean;
  last?: boolean;
};
type Props = CommonProps & (
  | { onPress: () => void; toggle?: never }
  | { onPress?: never; toggle: { value: boolean; disabled?: boolean; onValueChange: (value: boolean) => void } }
);

/** One Settings row layout: intrinsic accessory, flexible copy, shared gutters. */
export function SettingsRow(props: Props) {
  const { icon, label, detail, value, valueMuted, last, toggle } = props;
  const testID = `settings-row-${label.toLowerCase().replace(/\W+/g, "-")}`;
  const body = (
    <>
      <View testID="settings-row-icon" style={styles.icon}>
        <Feather name={icon} size={17} color={Colors.textSecondary} />
      </View>
      <View testID="settings-row-copy" style={styles.copy}>
        {value !== undefined ? (
          <View style={styles.valueLine}>
            <Text testID="settings-row-label" style={[styles.label, styles.flexibleLabel]}>{label}</Text>
            <Text testID="settings-row-value" style={[styles.value, valueMuted && styles.muted]}>{value}</Text>
          </View>
        ) : (
          <>
            <Text testID="settings-row-label" style={styles.label}>{label}</Text>
            {detail ? <Text testID="settings-row-detail" style={styles.detail}>{detail}</Text> : null}
          </>
        )}
      </View>
      <View testID="settings-row-accessory" style={[styles.accessory, toggle && styles.switchAccessory]}>
        {toggle ? (
          <Switch
            // RN Web has a separate enabled-thumb property; native uses thumbColor.
            {...(Platform.OS === "web" ? { activeThumbColor: Colors.white } : {})}
            accessibilityLabel={label}
            accessibilityHint={`Turns ${label.toLowerCase()} on or off`}
            disabled={toggle.disabled}
            ios_backgroundColor={Colors.borderLight}
            onValueChange={toggle.onValueChange}
            thumbColor={Colors.white}
            trackColor={{ false: Colors.borderLight, true: Colors.accent }}
            value={toggle.value}
          />
        ) : <Feather name="chevron-right" size={17} color={Colors.muted} />}
      </View>
    </>
  );
  const rowStyle = [styles.row, detail && styles.withDetail, last && styles.last];
  if (toggle) return <View testID={testID} style={rowStyle}>{body}</View>;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={value !== undefined ? `${label}. Currently ${value}.` : undefined}
      onPress={props.onPress}
      style={({ pressed }) => [rowStyle, pressed && styles.pressed]}
    >{body}</Pressable>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: Layout.minTouchTarget + Space.sm, paddingHorizontal: Space.lg, paddingVertical: Space.md,
    flexDirection: "row", alignItems: "center", gap: Space.md,
    borderBottomWidth: 1, borderBottomColor: Colors.borderSubtle },
  withDetail: { minHeight: Layout.minTouchTarget + Space.lg },
  last: { borderBottomWidth: 0 },
  icon: { width: Space.xl, flexShrink: 0, alignItems: "center", justifyContent: "center" },
  copy: { flex: 1, minWidth: 0 },
  label: { ...TextStyles.label, color: Colors.text, letterSpacing: 0.4 },
  detail: { ...TextStyles.caption, lineHeight: 16, color: Colors.muted, marginTop: Space.xs },
  valueLine: { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", columnGap: Space.md, rowGap: Space.xs },
  flexibleLabel: { flexGrow: 1, flexShrink: 1, minWidth: 0 },
  value: { ...TextStyles.metadata, flexGrow: 1, flexShrink: 1, maxWidth: "100%", textAlign: "right", color: Colors.textSecondary },
  muted: { color: Colors.muted },
  // No fixed width or scale: reserve the control's actual layout size.
  accessory: { flexShrink: 0, alignItems: "center", justifyContent: "center" },
  switchAccessory: { minHeight: Layout.minTouchTarget },
  pressed: { opacity: 0.65 },
});
