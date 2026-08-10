import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { PlayerAvatar } from "@/components/PlayerAvatar";
import { DetailHeader } from "@/components/ui/DetailHeader";
import { Colors, Radius } from "@/constants/colors";
import { Layout, Space } from "@/constants/layout";
import { Typography } from "@/constants/typography";
import {
  BlockedUser,
  fetchBlockedUsers,
  unblockUser,
} from "@/services/safetyService";

export default function BlockedUsersScreen() {
  const router = useRouter();
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);

  const loadBlockedUsers = useCallback(async () => {
    setLoading(true);
    const users = await fetchBlockedUsers();
    setLoadFailed(users === null);
    if (users) setBlockedUsers(users);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadBlockedUsers();
  }, [loadBlockedUsers]);

  const confirmUnblock = (player: BlockedUser) => {
    Alert.alert(
      `Unblock ${player.name}?`,
      "You may see each other's public activity again. Friendship is not restored automatically.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Unblock",
          onPress: async () => {
            setUnblockingId(player.id);
            const ok = await unblockUser(player.id);
            setUnblockingId(null);
            if (ok) {
              setBlockedUsers((current) => current.filter((user) => user.id !== player.id));
            } else {
              Alert.alert("Could not unblock player", "Please try again.");
            }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.screen}>
      <DetailHeader
        onBack={() => router.canGoBack() ? router.back() : router.replace("/settings")}
        title="BLOCKED PLAYERS"
      />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.intro}>
          Blocked players cannot find your profile or interact with you. Unblocking does not restore a friendship.
        </Text>

        {loading ? (
          <View style={styles.stateCard}>
            <ActivityIndicator color={Colors.accent} />
            <Text style={styles.stateText}>LOADING BLOCKED PLAYERS</Text>
          </View>
        ) : loadFailed ? (
          <View style={styles.stateCard}>
            <Feather name="alert-circle" size={22} color={Colors.loss} />
            <Text style={styles.stateText}>BLOCKED PLAYERS COULD NOT LOAD</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => void loadBlockedUsers()}
              style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
            >
              <Text style={styles.retryText}>TRY AGAIN</Text>
            </Pressable>
          </View>
        ) : blockedUsers.length === 0 ? (
          <View style={styles.stateCard}>
            <Feather name="shield" size={22} color={Colors.muted} />
            <Text style={styles.stateText}>NO BLOCKED PLAYERS</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {blockedUsers.map((player) => {
              const unblocking = unblockingId === player.id;
              return (
                <View key={player.id} style={styles.row}>
                  <PlayerAvatar name={player.name} playerId={player.id} size={42} />
                  <View style={styles.identity}>
                    <Text numberOfLines={1} style={styles.name}>{player.name}</Text>
                    <Text numberOfLines={1} style={styles.username}>@{player.username}</Text>
                  </View>
                  <Pressable
                    accessibilityLabel={`Unblock ${player.name}`}
                    accessibilityRole="button"
                    disabled={unblocking}
                    onPress={() => confirmUnblock(player)}
                    style={({ pressed }) => [
                      styles.unblockButton,
                      pressed && styles.pressed,
                      unblocking && styles.disabled,
                    ]}
                  >
                    {unblocking ? (
                      <ActivityIndicator color={Colors.text} size="small" />
                    ) : (
                      <Text style={styles.unblockText}>UNBLOCK</Text>
                    )}
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  content: {
    width: "100%",
    maxWidth: Layout.maxContentWidth,
    alignSelf: "center",
    paddingHorizontal: Layout.screenGutter,
    paddingTop: Space.xl,
    paddingBottom: 48,
  },
  intro: {
    fontFamily: Typography.body,
    fontSize: 12,
    lineHeight: 18,
    color: Colors.textSecondary,
    marginBottom: Space.lg,
  },
  list: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    overflow: "hidden",
  },
  row: {
    minHeight: 70,
    paddingHorizontal: Space.md,
    flexDirection: "row",
    alignItems: "center",
    gap: Space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderSubtle,
  },
  identity: { flex: 1, minWidth: 0 },
  name: {
    fontFamily: Typography.headingRegular,
    fontSize: 16,
    lineHeight: 20,
    color: Colors.text,
    textTransform: "uppercase",
  },
  username: {
    fontFamily: Typography.bodyMedium,
    fontSize: 10,
    color: Colors.muted,
    marginTop: 2,
  },
  unblockButton: {
    minWidth: 82,
    minHeight: Layout.minTouchTarget,
    paddingHorizontal: Space.md,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surfaceHigh,
  },
  unblockText: {
    fontFamily: Typography.bodyBold,
    fontSize: 9,
    color: Colors.text,
    letterSpacing: 1,
  },
  stateCard: {
    minHeight: 150,
    padding: Space.xl,
    alignItems: "center",
    justifyContent: "center",
    gap: Space.md,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
  },
  stateText: {
    fontFamily: Typography.bodyBold,
    fontSize: 9,
    color: Colors.muted,
    letterSpacing: 1.2,
    textAlign: "center",
  },
  retryButton: {
    minHeight: Layout.minTouchTarget,
    paddingHorizontal: Space.lg,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.accentBorder,
    borderRadius: Radius.sm,
    backgroundColor: Colors.accentDim,
  },
  retryText: {
    fontFamily: Typography.bodyBold,
    fontSize: 9,
    color: Colors.text,
    letterSpacing: 1.1,
  },
  pressed: { opacity: 0.68 },
  disabled: { opacity: 0.5 },
});
