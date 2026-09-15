import { Feather } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Colors, Radius } from "@/constants/colors";
import { TextStyles } from "@/constants/typography";

/** Canonical radio-row control for a single choice in a list: settings
 *  editor sheets (privacy, sport) and onboarding's sport picker both use
 *  this rather than maintaining page-local copies. */
export function OptionRow({
  label,
  description,
  icon,
  selected,
  onPress,
}: {
  label: string;
  description?: string;
  icon?: React.ReactNode;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.option,
        selected && styles.optionSelected,
        pressed && styles.pressed,
      ]}
      onPress={onPress}
    >
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <View style={styles.copy}>
        <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
      </View>
      <View style={[styles.radio, selected && styles.radioSelected]}>
        {selected ? <Feather color={Colors.black} name="check" size={13} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  option: {
    minHeight: 64,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surface,
  },
  optionSelected: {
    borderColor: Colors.accentBorder,
    backgroundColor: Colors.accentDim,
  },
  pressed: { opacity: 0.65 },
  icon: { width: 22, alignItems: "center" },
  copy: { flex: 1, gap: 3 },
  label: {
    ...TextStyles.label,
    color: Colors.textSecondary,
    letterSpacing: 1,
  },
  labelSelected: { color: Colors.text },
  description: {
    ...TextStyles.caption,
    color: Colors.muted,
    lineHeight: 15,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    alignItems: "center",
    justifyContent: "center",
  },
  radioSelected: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accent,
  },
});
