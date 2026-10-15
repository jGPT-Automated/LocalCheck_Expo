import {
  KeyboardAwareScrollView,
  KeyboardAwareScrollViewProps,
} from "react-native-keyboard-controller";
import { Platform, ScrollView, ScrollViewProps } from "react-native";

type Props = KeyboardAwareScrollViewProps & ScrollViewProps;

export function KeyboardAwareScrollViewCompat({
  children,
  bottomOffset = 96,
  keyboardShouldPersistTaps = "handled",
  // A screen whose content fits must not move when dragged; it only scrolls
  // when the content is taller than the screen.
  alwaysBounceVertical = false,
  ...props
}: Props) {
  if (Platform.OS === "web") {
    return (
      <ScrollView
        alwaysBounceVertical={alwaysBounceVertical}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        {...props}
      >
        {children}
      </ScrollView>
    );
  }
  return (
    <KeyboardAwareScrollView
      alwaysBounceVertical={alwaysBounceVertical}
      bottomOffset={bottomOffset}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      {...props}
    >
      {children}
    </KeyboardAwareScrollView>
  );
}
