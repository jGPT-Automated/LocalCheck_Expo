import React from "react";
import { Platform, Switch, type SwitchProps } from "react-native";
import { Colors } from "@/constants/colors";

/** The installed native Switch, with the same thumb color on web and native.
 * react-native-web separates the active thumb prop; native uses thumbColor
 * for both states. Keep this platform detail out of Settings and forms.
 */
export function AppSwitch(props: SwitchProps) {
  const thumbColor = props.thumbColor ?? Colors.white;
  return <Switch {...props} hitSlop={props.hitSlop ?? 8} thumbColor={thumbColor}
    {...(Platform.OS === "web" ? { activeThumbColor: thumbColor } : {})} />;
}
