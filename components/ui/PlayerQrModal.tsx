import React from "react";
import { StyleSheet, Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";

import { RunFlowSheet } from "@/components/sheet/RunFlowSheet";
import { Colors, Radius } from "@/constants/colors";
import { Space } from "@/constants/layout";
import { Typography } from "@/constants/typography";

/** A player's QR code, in the same drawer as every other sheet (Oct 17). */
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
  const value = `localcheck://player/${playerId}`;

  return (
    <RunFlowSheet dynamic eyebrow="Player QR" onClose={onClose} title={playerName} visible={visible}>
      <View style={styles.qrWrap}>
        <QRCode backgroundColor={Colors.white} color={Colors.black} size={220} value={value} />
      </View>
      <Text style={styles.body}>
        Scan with the phone camera to open this player for a quick friend request or game.
      </Text>
    </RunFlowSheet>
  );
}

const styles = StyleSheet.create({
  qrWrap: { padding: 18, alignSelf: "center", borderRadius: Radius.lg, backgroundColor: Colors.white },
  body: { marginTop: Space.lg, fontFamily: Typography.body, fontSize: 12, lineHeight: 18, color: Colors.textSecondary, textAlign: "center" },
});
