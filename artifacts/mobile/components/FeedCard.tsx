import * as Haptics from "expo-haptics";
import React from "react";
import { ImageBackground, Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { Colors, Radius } from "@/constants/colors";
import { FeedItem, getSportColor } from "@/constants/data";
import { Typography } from "@/constants/typography";
import { useApp } from "@/context/AppContext";
import { PlayerAvatar } from "./PlayerAvatar";

const FEED_TYPE_LABELS: Record<FeedItem["type"], string> = {
  checkin: "CHECKED IN",
  checkout: "CHECKED OUT",
  game_result: "GAME",
  run_result: "RESULT",
  new_court: "NEW COURT",
  run_started: "RUN",
};

interface FeedCardProps {
  item: FeedItem;
}

export function FeedCard({ item }: FeedCardProps) {
  const { hypeItem } = useApp();

  const handleHype = () => {
    hypeItem(item.id);
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const initials = item.playerName.replace(/[^A-Z]/g, "").slice(0, 2);
  const sportColor = item.sport ? getSportColor(item.sport) : Colors.accent;
  const typeLabel = FEED_TYPE_LABELS[item.type] || item.type;
  const isResult = item.type === "run_result";
  const isWin = isResult && item.message.includes("WON");

  const messageText = item.message
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  // For game results, tint the winner's name with Colors.win.
  const renderMessage = (style: object) => {
    if (item.type === "game_result" && item.winnerName) {
      const idx = messageText.toUpperCase().indexOf(item.winnerName.toUpperCase());
      if (idx >= 0) {
        const end = idx + item.winnerName.length;
        return (
          <Text style={style}>
            {messageText.slice(0, idx)}
            <Text style={{ color: Colors.win }}>{messageText.slice(idx, end)}</Text>
            {messageText.slice(end)}
          </Text>
        );
      }
    }
    return <Text style={style}>{messageText}</Text>;
  };

  return (
    <View style={styles.container}>
      <View style={[styles.sportLine, { backgroundColor: sportColor }]} />

      {item.imageUri ? (
        <ImageBackground source={{ uri: item.imageUri }} style={styles.imageArea} resizeMode="cover">
          <View style={styles.imageOverlay}>
            <View style={styles.typeRow}>
              <View style={styles.typeChip}>
                <Text style={styles.typeChipText}>{typeLabel}</Text>
              </View>
            </View>
            <View style={styles.bottomMeta}>
              <PlayerAvatar initials={initials} size={30} invert />
              <Text style={styles.messageOnImage}>{item.message}</Text>
            </View>
          </View>
        </ImageBackground>
      ) : (
        <View style={styles.textArea}>
          <View style={styles.topRow}>
            <PlayerAvatar initials={initials} size={40} />
            <View style={styles.topRowText}>
              <View style={styles.typeRow}>
                <View style={[
                  styles.typeChip,
                  { backgroundColor: isWin ? Colors.winDim : isResult ? Colors.lossDim : Colors.surfaceHigh },
                ]}>
                  <Text style={[
                    styles.typeChipText,
                    { color: isWin ? Colors.win : isResult ? Colors.loss : Colors.muted },
                  ]}>
                    {typeLabel}
                  </Text>
                </View>
                {item.sport && (
                  <View style={[styles.sportChip, { borderColor: sportColor + "50" }]}>
                    <Text style={[styles.sportChipText, { color: sportColor }]}>{item.sport}</Text>
                  </View>
                )}
              </View>
              {renderMessage(styles.messageText)}
              {item.courtName && (
                <Text style={styles.courtRef}>@ {item.courtName.replace(/\s+/g, " ")
                  .split(" ")
                  .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
                  .join(" ")}
                </Text>
              )}
            </View>
          </View>
        </View>
      )}

      <View style={styles.footer}>
        <Text style={styles.timestamp}>{item.timestamp}</Text>
        <Pressable onPress={handleHype} style={styles.hypeBtn} testID={`hype-${item.id}`}>
          <Text style={styles.hypeIcon}>🔥</Text>
          <Text style={styles.hypeCount}>{item.hypeCount}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    marginVertical: 4,
    marginHorizontal: 12,
    borderRadius: Radius.md,
    borderWidth: 0.5,
    borderColor: Colors.border,
    overflow: "hidden",
  },
  sportLine: { height: 2 },
  imageArea: { height: 260, justifyContent: "space-between" },
  imageOverlay: { flex: 1, justifyContent: "space-between", padding: 14 },
  typeRow: { flexDirection: "row", gap: 6, alignItems: "center" },
  typeChip: {
    backgroundColor: Colors.surfaceHigh,
    paddingHorizontal: 7, paddingVertical: 3,
    alignSelf: "flex-start",
    borderRadius: Radius.xs,
  },
  typeChipText: {
    fontFamily: Typography.bodyMedium, fontSize: 10, color: Colors.muted,
    letterSpacing: 0.3,
  },
  sportChip: {
    paddingHorizontal: 7, paddingVertical: 3,
    borderWidth: 0.5, alignSelf: "flex-start",
    borderRadius: Radius.xs,
  },
  sportChipText: {
    fontFamily: Typography.bodyMedium, fontSize: 10,
    letterSpacing: 0.5, textTransform: "uppercase" as const,
  },
  bottomMeta: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: Colors.overlay,
    marginHorizontal: -14, marginBottom: -14,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  messageOnImage: {
    fontFamily: Typography.bodyBold, fontSize: 13, color: Colors.white,
    flex: 1, letterSpacing: 0.2,
  },
  textArea: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 14 },
  topRow: { flexDirection: "row", gap: 14 },
  topRowText: { flex: 1, gap: 8 },
  messageText: {
    fontFamily: Typography.bodyMedium, fontSize: 15, color: Colors.text,
    letterSpacing: 0.1, lineHeight: 22,
  },
  courtRef: {
    fontFamily: Typography.body, fontSize: 12, color: Colors.muted, marginTop: 1,
  },
  footer: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 10,
    borderTopWidth: 0.5, borderColor: Colors.border,
  },
  timestamp: {
    fontFamily: Typography.body, fontSize: 11, color: Colors.muted,
    letterSpacing: 0.5,
  },
  hypeBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    borderWidth: 0.5, borderColor: Colors.border,
    borderRadius: Radius.xs,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  hypeIcon: { fontSize: 13 },
  hypeCount: { fontFamily: Typography.heading, fontSize: 13, color: Colors.text },
});
