import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetModalProvider,
  BottomSheetScrollView,
} from "@gorhom/bottom-sheet";
import { Feather } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Colors, Radius } from "@/constants/colors";
import { TextStyles } from "@/constants/typography";

/** Run-only task drawer. It deliberately replaces the old custom Modal for
 * this flow so swipe-down, backdrop close, and drag interruption are native to
 * the already-installed bottom-sheet stack. */
export function RunFlowSheet({
  visible,
  onClose,
  title,
  eyebrow,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
}) {
  const modalRef = useRef<BottomSheetModal>(null);
  const presentedRef = useRef(false);
  const snapPoints = useMemo(() => ["88%"], []);

  useEffect(() => {
    if (visible && !presentedRef.current) {
      presentedRef.current = true;
      requestAnimationFrame(() => modalRef.current?.present());
    } else if (!visible && presentedRef.current) {
      modalRef.current?.dismiss();
    }
  }, [visible]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.72}
        pressBehavior="close"
      />
    ),
    [],
  );

  return (
    <BottomSheetModalProvider>
      <BottomSheetModal
        ref={modalRef}
        index={0}
        snapPoints={snapPoints}
        enableDynamicSizing={false}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        backgroundStyle={styles.background}
        handleIndicatorStyle={styles.handle}
        onDismiss={() => {
          presentedRef.current = false;
          onClose();
        }}
      >
        <View style={styles.header}>
          <View style={styles.headingCopy}>
            {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
            <Text style={styles.title}>{title}</Text>
          </View>
          <Pressable
            accessibilityLabel="Close"
            accessibilityRole="button"
            hitSlop={10}
            onPress={() => modalRef.current?.dismiss()}
            style={styles.close}
          >
            <Feather name="x" size={20} color={Colors.textSecondary} />
          </Pressable>
        </View>
        <BottomSheetScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </BottomSheetScrollView>
      </BottomSheetModal>
    </BottomSheetModalProvider>
  );
}

const styles = StyleSheet.create({
  background: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: Radius.card,
    borderTopRightRadius: Radius.card,
  },
  handle: { width: 38, height: 4, backgroundColor: Colors.muted },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  headingCopy: { flex: 1, gap: 3 },
  eyebrow: {
    ...TextStyles.labelSmall,
    color: Colors.accent,
    letterSpacing: 1.4,
  },
  title: {
    ...TextStyles.title,
    color: Colors.text,
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  close: {
    width: 44,
    height: 44,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  content: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 44 },
});
