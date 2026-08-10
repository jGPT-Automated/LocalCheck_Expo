import { Feather } from "@expo/vector-icons";
import React from "react";
import { AccessibilityInfo, Animated, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";

import { Colors, Radius } from "@/constants/colors";
import { Space } from "@/constants/layout";
import { Typography } from "@/constants/typography";

export function PlayerQrModal({
  playerId,
  playerName,
  visible,
  onClose,
}: {
  playerId: string;
  playerName: string;
  visible: boolean;
  onClose: () => void;
}) {
  const scale = React.useRef(new Animated.Value(0.92)).current;
  const opacity = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (cancelled) return;
      if (reduced) {
        scale.setValue(1);
        opacity.setValue(1);
        return;
      }
      scale.setValue(0.92);
      opacity.setValue(0);
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, friction: 8, tension: 90, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]).start();
    });
    return () => { cancelled = true; };
  }, [opacity, scale, visible]);

  const value = `localcheck://player/${playerId}`;

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.overlay}>
        <Pressable accessibilityLabel="Close player QR code" onPress={onClose} style={StyleSheet.absoluteFill} />
        <Animated.View style={[styles.card, { opacity, transform: [{ scale }] }]}>
          <View style={styles.header}>
            <View>
              <Text style={styles.kicker}>PLAYER QR</Text>
              <Text numberOfLines={1} style={styles.name}>{playerName}</Text>
            </View>
            <Pressable accessibilityLabel="Close" hitSlop={8} onPress={onClose} style={styles.close}>
              <Feather color={Colors.textSecondary} name="x" size={18} />
            </Pressable>
          </View>
          <View style={styles.qrWrap}>
            <QRCode backgroundColor={Colors.white} color={Colors.black} size={220} value={value} />
          </View>
          <Text style={styles.body}>
            Scan with the phone camera to open this player for a quick friend request or game.
          </Text>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, padding: 24, alignItems: "center", justifyContent: "center", backgroundColor: Colors.overlay },
  card: { width: "100%", maxWidth: 360, padding: Space.xl, borderRadius: Radius.lg, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.borderLight },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: Space.md },
  kicker: { fontFamily: Typography.bodyBold, fontSize: 8, color: Colors.accent, letterSpacing: 1.5 },
  name: { marginTop: 3, fontFamily: Typography.heading, fontSize: 20, color: Colors.text, textTransform: "uppercase" },
  close: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: Radius.md, backgroundColor: Colors.surfaceHigh },
  qrWrap: { marginTop: Space.xl, padding: 18, alignSelf: "center", borderRadius: Radius.lg, backgroundColor: Colors.white },
  body: { marginTop: Space.lg, fontFamily: Typography.body, fontSize: 11, lineHeight: 17, color: Colors.textSecondary, textAlign: "center" },
});
