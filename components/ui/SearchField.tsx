import { Feather } from "@expo/vector-icons";
import React, { type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  type StyleProp,
  TextInput,
  type TextInputProps,
  View,
  type ViewStyle,
} from "react-native";

import { Colors, Radius } from "@/constants/colors";
import { Typography } from "@/constants/typography";

/**
 * The one search input. Every "search courts / players / your inbox" field is
 * this component so the text is vertically centred and never clipped — the bug
 * that came from seven page-local `TextInput`s each guessing at padding.
 *
 * `variant="box"` (default) is the standalone bordered field.
 * `variant="bare"` is icon + input only, for dropping into an existing filter
 * strip that already owns the border (Explore, the Me-tab inbox).
 */
export interface SearchFieldProps
  extends Pick<
    TextInputProps,
    | "autoCapitalize"
    | "autoCorrect"
    | "autoFocus"
    | "keyboardType"
    | "onSubmitEditing"
    | "returnKeyType"
    | "testID"
  > {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  /** Show a ✕ that clears the field once there is text. Ignored if `trailing`
   *  or `loading` is set. */
  onClear?: () => void;
  loading?: boolean;
  /** Replace the trailing slot entirely (e.g. a "close picker" button). */
  trailing?: ReactNode;
  variant?: "box" | "bare";
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

export function SearchField({
  value,
  onChangeText,
  placeholder,
  onClear,
  loading = false,
  trailing,
  variant = "box",
  style,
  accessibilityLabel,
  autoCapitalize = "none",
  autoCorrect = false,
  autoFocus,
  keyboardType,
  onSubmitEditing,
  returnKeyType = "search",
  testID,
}: SearchFieldProps) {
  const showClear = !trailing && !loading && Boolean(onClear) && value.length > 0;

  return (
    <View style={[variant === "box" ? styles.box : styles.bare, style]}>
      <Feather color={Colors.muted} name="search" size={15} />
      <TextInput
        accessibilityLabel={accessibilityLabel ?? placeholder}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        autoFocus={autoFocus}
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmitEditing}
        placeholder={placeholder}
        placeholderTextColor={Colors.mutedDark}
        returnKeyType={returnKeyType}
        style={styles.input}
        testID={testID}
        underlineColorAndroid="transparent"
        value={value}
      />
      {trailing ??
        (loading ? (
          <ActivityIndicator color={Colors.muted} size="small" />
        ) : showClear ? (
          <Pressable
            accessibilityLabel="Clear search"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onClear}
          >
            <Feather color={Colors.muted} name="x" size={15} />
          </Pressable>
        ) : null)}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    minHeight: 44,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surface,
  },
  bare: {
    flex: 1,
    minWidth: 0,
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  input: {
    flex: 1,
    minWidth: 0,
    // Zero the platform's own vertical padding and let the centred row + an
    // explicit line height place the text. This is the whole fix.
    paddingTop: 0,
    paddingBottom: 0,
    paddingVertical: 0,
    textAlignVertical: "center",
    includeFontPadding: false,
    fontFamily: Typography.bodyMedium,
    fontSize: 14,
    lineHeight: 18,
    color: Colors.text,
  },
});
