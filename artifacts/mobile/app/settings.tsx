import { Feather } from "@expo/vector-icons";
import * as AppleAuthentication from "expo-apple-authentication";
import { Href, useRouter } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PlayerAvatar } from "@/components/PlayerAvatar";
import { Colors, Radius } from "@/constants/colors";
import { CourtSport } from "@/constants/data";
import { Typography } from "@/constants/typography";
import { useApp, Visibility } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/context/NotificationContext";
import { deleteCurrentAccount } from "@/services/accountService";

const WEBSITE_URL = process.env.EXPO_PUBLIC_WEBSITE_URL ?? "https://localchecksports.com";

const VISIBILITY_OPTIONS: Array<{ value: Visibility; label: string; description: string }> = [
  { value: "public", label: "PUBLIC", description: "Anyone at the court can see your live check-in." },
  { value: "friends", label: "FRIENDS", description: "Only accepted friends can see your identity." },
  { value: "private", label: "PRIVATE", description: "Count me as active without showing my profile." },
];

export default function SettingsScreen() {
  const router = useRouter();
  const { currentUser, visibility, setVisibility, preferredSport, setPreferredSport, localCourt } = useApp();
  const { user, profile, signOut } = useAuth();
  const { top, bottom } = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : top;
  const [deleting, setDeleting] = useState(false);
  const { pushEnabled, enablePush, disablePush } = useNotifications();

  const openWebsitePath = (path: string) => {
    void Linking.openURL(`${WEBSITE_URL}${path}`);
  };

  const handleLogout = () => {
    Alert.alert("Log out?", "You can sign back in at any time.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log Out",
        style: "destructive",
        onPress: async () => {
          await signOut();
          router.replace("/auth");
        },
      },
    ]);
  };

  const executeDelete = async () => {
    if (!user || deleting) return;
    setDeleting(true);
    let appleAuthorizationCode: string | null = null;

    try {
      const usesApple = user.app_metadata?.provider === "apple"
        || user.identities?.some((identity) => identity.provider === "apple");
      if (usesApple) {
        if (Platform.OS !== "ios") {
          Alert.alert("Use your iPhone", "Apple accounts must be reauthenticated on iPhone before deletion.");
          return;
        }
        const credential = await AppleAuthentication.signInAsync({ requestedScopes: [] });
        appleAuthorizationCode = credential.authorizationCode;
        if (!appleAuthorizationCode) {
          Alert.alert("Could not verify Apple account", "Please try again before deleting your account.");
          return;
        }
      }

      const result = await deleteCurrentAccount(appleAuthorizationCode);
      if (!result.ok) {
        Alert.alert("Account not deleted", result.error ?? "Please try again.");
        return;
      }
      router.replace("/auth");
    } catch (error: any) {
      if (error?.code !== "ERR_REQUEST_CANCELED") {
        Alert.alert("Account not deleted", "We could not verify the request. Please try again.");
      }
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Permanently delete account?",
      "This removes your LocalCheck account, profile, social connections, and activity tied to it. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete Account", style: "destructive", onPress: () => void executeDelete() },
      ]
    );
  };

  const togglePush = async () => {
    if (pushEnabled) {
      const ok = await disablePush();
      if (!ok) Alert.alert("Could not turn off alerts", "Please try again.");
      return;
    }
    const result = await enablePush();
    if (!result.ok) Alert.alert("Alerts are not on", result.message ?? "Please try again.");
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: topPad + 10 }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={12}>
          <Feather name="chevron-left" size={20} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>SETTINGS</Text>
        <View style={{ width: 34 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 90 : bottom + 80 }}
      >
        <View style={styles.profileRow}>
          <PlayerAvatar initials={currentUser.avatar || "LC"} size={52} />
          <View style={{ flex: 1 }}>
            <Text style={styles.profileName}>{currentUser.name.toUpperCase()}</Text>
            <Text style={styles.profileMeta}>@{profile?.username || "player"} · {currentUser.elo} ELO</Text>
          </View>
        </View>

        <Section title="CHECK-IN PRIVACY">
          <View style={styles.segmented}>
            {VISIBILITY_OPTIONS.map((option) => {
              const active = visibility === option.value;
              return (
                <Pressable
                  key={option.value}
                  style={[styles.segment, active && styles.segmentActive]}
                  onPress={() => void setVisibility(option.value)}
                >
                  <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.explanation}>
            {VISIBILITY_OPTIONS.find((option) => option.value === visibility)?.description}
          </Text>
        </Section>

        <Section title="SPORT">
          <View style={styles.segmented}>
            {(["BASKETBALL", "PICKLEBALL"] as CourtSport[]).map((sport) => {
              const active = preferredSport === sport;
              return (
                <Pressable
                  key={sport}
                  style={[styles.segment, active && styles.segmentActive]}
                  onPress={() => void setPreferredSport(sport)}
                >
                  <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                    {sport === "BASKETBALL" ? "BASKETBALL" : "PICKLEBALL"}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Section>

        <Section title="LOCAL COURT">
          <SettingsRow
            icon="map-pin"
            label={localCourt?.name ?? "CHOOSE A LOCAL COURT"}
            detail={localCourt ? "Your home base" : "Find it in Explore"}
            onPress={() => router.push("/(tabs)/explore")}
          />
        </Section>

        <Section title="ALERTS">
          <SettingsRow
            icon="bell"
            label="PUSH NOTIFICATIONS"
            detail={pushEnabled ? "Run invites, friend updates, and score reviews" : "Off"}
            onPress={() => void togglePush()}
          />
          <SettingsRow
            icon="inbox"
            label="NOTIFICATION INBOX"
            detail="See all LocalCheck alerts"
            onPress={() => router.push("/notifications" as Href)}
          />
        </Section>

        <Section title="LEGAL & SUPPORT">
          <SettingsRow icon="shield" label="PRIVACY POLICY" onPress={() => openWebsitePath("/privacy")} />
          <SettingsRow icon="file-text" label="TERMS OF SERVICE" onPress={() => openWebsitePath("/terms")} />
          <SettingsRow icon="help-circle" label="HELP & SUPPORT" onPress={() => openWebsitePath("/support")} />
        </Section>

        <Section title="ACCOUNT">
          <SettingsRow icon="log-out" label="LOG OUT" onPress={handleLogout} />
          <Pressable style={({ pressed }) => [styles.deleteRow, pressed && styles.pressed]} onPress={handleDeleteAccount} disabled={deleting}>
            {deleting ? <ActivityIndicator color={Colors.loss} size="small" /> : <Feather name="trash-2" size={17} color={Colors.loss} />}
            <Text style={styles.deleteText}>{deleting ? "DELETING…" : "DELETE ACCOUNT"}</Text>
          </Pressable>
        </Section>

        <Text style={styles.version}>LOCALCHECK 1.0.0</Text>
      </ScrollView>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionSurface}>{children}</View>
    </View>
  );
}

function SettingsRow({ icon, label, detail, onPress }: { icon: React.ComponentProps<typeof Feather>["name"]; label: string; detail?: string; onPress: () => void }) {
  return (
    <Pressable style={({ pressed }) => [styles.settingsRow, pressed && styles.pressed]} onPress={onPress}>
      <Feather name={icon} size={17} color={Colors.textSecondary} />
      <View style={{ flex: 1 }}>
        <Text style={styles.settingsLabel} numberOfLines={1}>{label}</Text>
        {detail ? <Text style={styles.settingsDetail}>{detail}</Text> : null}
      </View>
      <Feather name="chevron-right" size={17} color={Colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  header: { minHeight: 94, paddingHorizontal: 16, paddingBottom: 14, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: Colors.border },
  backButton: { width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: 17, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  headerTitle: { fontFamily: Typography.heading, fontSize: 19, color: Colors.text, letterSpacing: 1.2 },
  profileRow: { paddingHorizontal: 20, paddingVertical: 22, flexDirection: "row", alignItems: "center", gap: 13 },
  profileName: { fontFamily: Typography.heading, fontSize: 20, lineHeight: 22, color: Colors.text, letterSpacing: 0.4 },
  profileMeta: { fontFamily: Typography.bodyMedium, fontSize: 9, color: Colors.muted, letterSpacing: 0.8, marginTop: 4 },
  section: { paddingHorizontal: 20, marginBottom: 21 },
  sectionTitle: { fontFamily: Typography.bodyBold, fontSize: 8, color: Colors.muted, letterSpacing: 1.8, marginBottom: 8 },
  sectionSurface: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, overflow: "hidden" },
  segmented: { flexDirection: "row", margin: 10, gap: 6 },
  segment: { flex: 1, minHeight: 38, alignItems: "center", justifyContent: "center", borderRadius: Radius.sm, backgroundColor: Colors.surfaceHigh, borderWidth: 1, borderColor: "transparent", paddingHorizontal: 5 },
  segmentActive: { borderColor: Colors.accent, backgroundColor: Colors.accentDim },
  segmentText: { fontFamily: Typography.bodyBold, fontSize: 7, color: Colors.muted, letterSpacing: 0.9, textAlign: "center" },
  segmentTextActive: { color: Colors.text },
  explanation: { fontFamily: Typography.body, fontSize: 11, lineHeight: 16, color: Colors.muted, paddingHorizontal: 13, paddingBottom: 13 },
  settingsRow: { minHeight: 58, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1, borderBottomColor: Colors.borderSubtle },
  settingsLabel: { fontFamily: Typography.bodySemiBold, fontSize: 11, color: Colors.text, letterSpacing: 0.55 },
  settingsDetail: { fontFamily: Typography.body, fontSize: 9, color: Colors.muted, marginTop: 3 },
  deleteRow: { minHeight: 58, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  deleteText: { fontFamily: Typography.bodyBold, fontSize: 9, color: Colors.loss, letterSpacing: 1.2 },
  pressed: { opacity: 0.65 },
  version: { fontFamily: Typography.bodyMedium, fontSize: 7, color: Colors.mutedDark, letterSpacing: 1.3, textAlign: "center", marginTop: 2 },
});
