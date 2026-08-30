import { Feather } from "@expo/vector-icons";
import * as AppleAuthentication from "expo-apple-authentication";
import { Href, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { Colors, Radius } from "@/constants/colors";
import { Court, CourtSport } from "@/constants/data";
import { TextStyles, Typography } from "@/constants/typography";
import { useApp, Visibility } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/context/NotificationContext";
import { deleteCurrentAccount } from "@/services/accountService";
import { searchCourts } from "@/services/courtService";
import { updateProfileFields } from "@/services/profileService";

const WEBSITE_URL =
  process.env.EXPO_PUBLIC_WEBSITE_URL ?? "https://localchecksports.com";

const VISIBILITY_OPTIONS: Array<{
  value: Visibility;
  label: string;
  description: string;
}> = [
  {
    value: "public",
    label: "PUBLIC",
    description: "Anyone at the court can see your live check-in.",
  },
  {
    value: "friends",
    label: "FRIENDS",
    description: "Only accepted friends can see your identity.",
  },
  {
    value: "private",
    label: "PRIVATE",
    description: "Count me as active without showing my profile.",
  },
];

export default function SettingsScreen() {
  const router = useRouter();
  const {
    currentUser,
    visibility,
    setVisibility,
    preferredSport,
    setPreferredSport,
    localCourt,
    setLocalCourt,
  } = useApp();
  const { user, profile, refreshProfile, signOut } = useAuth();
  const { top, bottom } = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : top;
  const [deleting, setDeleting] = useState(false);
  const [postalCode, setPostalCode] = useState(profile?.postal_code ?? "");
  const [postalSaving, setPostalSaving] = useState(false);
  const [postalSaved, setPostalSaved] = useState(false);
  const [courtQuery, setCourtQuery] = useState("");
  const [courtFocused, setCourtFocused] = useState(false);
  const [courtResults, setCourtResults] = useState<Court[]>([]);
  const [courtSearching, setCourtSearching] = useState(false);
  const [courtSavingId, setCourtSavingId] = useState<string | null>(null);
  const [pushSaving, setPushSaving] = useState(false);
  const { pushEnabled, enablePush, disablePush } = useNotifications();
  const [pushValue, setPushValue] = useState(pushEnabled);

  useEffect(() => {
    setPostalCode(profile?.postal_code ?? "");
  }, [profile?.postal_code]);

  useEffect(() => {
    if (!pushSaving) setPushValue(pushEnabled);
  }, [pushEnabled, pushSaving]);

  useEffect(() => {
    const term =
      courtQuery.trim() || (postalCode.length === 5 ? postalCode : "");
    if (term.length < 2) {
      setCourtResults([]);
      setCourtSearching(false);
      return;
    }
    let active = true;
    setCourtSearching(true);
    const timer = setTimeout(() => {
      void searchCourts(term, null, 8).then((results) => {
        if (!active) return;
        setCourtResults(results);
        setCourtSearching(false);
      });
    }, 180);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [courtQuery, postalCode]);

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
      const usesApple =
        user.app_metadata?.provider === "apple" ||
        user.identities?.some((identity) => identity.provider === "apple");
      if (usesApple) {
        if (Platform.OS !== "ios") {
          Alert.alert(
            "Use your iPhone",
            "Apple accounts must be reauthenticated on iPhone before deletion.",
          );
          return;
        }
        const credential = await AppleAuthentication.signInAsync({
          requestedScopes: [],
        });
        appleAuthorizationCode = credential.authorizationCode;
        if (!appleAuthorizationCode) {
          Alert.alert(
            "Could not verify Apple account",
            "Please try again before deleting your account.",
          );
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
        Alert.alert(
          "Account not deleted",
          "We could not verify the request. Please try again.",
        );
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
        {
          text: "Delete Account",
          style: "destructive",
          onPress: () => void executeDelete(),
        },
      ],
    );
  };

  const setPushNotifications = async (nextValue: boolean) => {
    if (pushSaving || nextValue === pushValue) return;
    setPushValue(nextValue);
    setPushSaving(true);
    if (nextValue) {
      const result = await enablePush();
      if (!result.ok) {
        setPushValue(false);
        Alert.alert(
          "Push notifications are off",
          result.message ??
            "Open iPhone Settings to allow notifications, then try again.",
        );
      }
    } else {
      const ok = await disablePush();
      if (!ok) {
        setPushValue(true);
        Alert.alert(
          "Push notifications are still on",
          "We couldn't update this setting. Check your connection and try again.",
        );
      }
    }
    setPushSaving(false);
  };

  const savePostalCode = async () => {
    if (!user || postalSaving) return;
    const next = postalCode.trim();
    if (next && !/^\d{5}$/.test(next)) {
      Alert.alert("Check ZIP code", "Enter a five-digit ZIP code.");
      return;
    }
    if ((profile?.postal_code ?? "") === next) {
      setPostalSaved(true);
      return;
    }
    setPostalSaving(true);
    setPostalSaved(false);
    const ok = await updateProfileFields(user.id, {
      postal_code: next || null,
    });
    if (ok) await refreshProfile();
    setPostalSaving(false);
    if (!ok) {
      Alert.alert(
        "ZIP code couldn't be saved",
        "Check your connection and try again. You can still use this ZIP to search for a local court now.",
      );
      return;
    }
    setPostalSaved(true);
  };

  const chooseLocalCourt = async (court: Court) => {
    if (courtSavingId) return;
    setCourtSavingId(court.id);
    const ok = await setLocalCourt(court.id, court);
    setCourtSavingId(null);
    if (!ok) {
      Alert.alert(
        "Local court couldn't be updated",
        "Check your connection and try selecting the court again.",
      );
      return;
    }
    setCourtQuery("");
    setCourtResults([]);
    setCourtFocused(false);
  };

  const normalizedPostalCode = postalCode.trim();
  const postalChanged = normalizedPostalCode !== (profile?.postal_code ?? "");
  const postalValid =
    normalizedPostalCode.length === 0 || /^\d{5}$/.test(normalizedPostalCode);
  const courtSearchTerm =
    courtQuery.trim() ||
    (/^\d{5}$/.test(normalizedPostalCode) ? normalizedPostalCode : "");

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: topPad + 10 }]}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={12}
        >
          <Feather name="chevron-left" size={20} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>SETTINGS</Text>
        <View style={{ width: 34 }} />
      </View>

      <KeyboardAwareScrollViewCompat
        bottomOffset={104}
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: Platform.OS === "web" ? 90 : bottom + 80,
        }}
      >
        <View style={styles.profileRow}>
          <PlayerAvatar
            initials={currentUser.avatar || "LC"}
            name={currentUser.name}
            playerId={currentUser.id}
            size={52}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.profileName}>
              {currentUser.name.toUpperCase()}
            </Text>
            <Text style={styles.profileMeta}>
              @{profile?.username || "player"} · {currentUser.elo} ELO
            </Text>
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
                  <Text
                    style={[
                      styles.segmentText,
                      active && styles.segmentTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.explanation}>
            {
              VISIBILITY_OPTIONS.find((option) => option.value === visibility)
                ?.description
            }
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
                  <Text
                    style={[
                      styles.segmentText,
                      active && styles.segmentTextActive,
                    ]}
                  >
                    {sport === "BASKETBALL" ? "BASKETBALL" : "PICKLEBALL"}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Section>

        <Section title="LOCATION">
          <View style={styles.locationField}>
            <Text style={styles.locationLabel}>ZIP CODE</Text>
            <View style={styles.locationInputRow}>
              <Feather color={Colors.textSecondary} name="map-pin" size={17} />
              <TextInput
                accessibilityLabel="Home ZIP code"
                autoComplete="postal-code"
                keyboardType="number-pad"
                maxLength={5}
                onChangeText={(value) => {
                  setPostalCode(value.replace(/\D/g, "").slice(0, 5));
                  setPostalSaved(false);
                }}
                onSubmitEditing={() => void savePostalCode()}
                placeholder="Enter ZIP code"
                placeholderTextColor={Colors.mutedDark}
                returnKeyType="done"
                style={styles.locationInput}
                value={postalCode}
              />
              {postalSaving ? (
                <ActivityIndicator color={Colors.accent} size="small" />
              ) : postalChanged ? (
                <Pressable
                  accessibilityLabel="Save home ZIP code"
                  accessibilityRole="button"
                  disabled={!postalValid}
                  hitSlop={8}
                  onPress={() => void savePostalCode()}
                  style={({ pressed }) => [
                    styles.inlineSave,
                    !postalValid && styles.inlineSaveDisabled,
                    pressed && postalValid && styles.pressed,
                  ]}
                >
                  <Text style={styles.inlineSaveText}>SAVE</Text>
                </Pressable>
              ) : postalSaved || normalizedPostalCode.length === 5 ? (
                <Feather color={Colors.win} name="check" size={17} />
              ) : null}
            </View>
            <Text style={styles.locationHelp}>
              Enter a ZIP to find courts without sharing your device location.
            </Text>
          </View>

          <View style={styles.locationField}>
            <Text style={styles.locationLabel}>LOCAL COURT</Text>
            <View style={styles.locationInputRow}>
              <Feather color={Colors.textSecondary} name="search" size={17} />
              <TextInput
                accessibilityLabel="Search for a local court"
                autoCapitalize="words"
                autoCorrect={false}
                clearButtonMode="while-editing"
                onChangeText={(value) => {
                  setCourtQuery(value);
                  setCourtFocused(true);
                }}
                onFocus={() => setCourtFocused(true)}
                placeholder="Name, city, or ZIP"
                placeholderTextColor={Colors.mutedDark}
                returnKeyType="search"
                style={styles.locationInput}
                value={courtQuery}
              />
              {courtSearching ? (
                <ActivityIndicator color={Colors.accent} size="small" />
              ) : null}
            </View>
            {localCourt ? (
              <Text style={styles.currentCourt}>
                CURRENT COURT · {localCourt.name.toUpperCase()}
              </Text>
            ) : null}
            {courtFocused && courtSearchTerm.length >= 2 ? (
              <View style={styles.courtResults}>
                {courtResults.length > 0 ? (
                  courtResults.map((court) => (
                    <Pressable
                      accessibilityLabel={`Set ${court.name} as local court`}
                      accessibilityRole="button"
                      accessibilityState={{
                        selected: court.id === localCourt?.id,
                      }}
                      disabled={Boolean(courtSavingId)}
                      key={court.id}
                      onPress={() => void chooseLocalCourt(court)}
                      style={({ pressed }) => [
                        styles.courtResult,
                        pressed && styles.pressed,
                      ]}
                    >
                      <View style={styles.courtResultCopy}>
                        <Text numberOfLines={1} style={styles.courtResultName}>
                          {court.name}
                        </Text>
                        <Text numberOfLines={1} style={styles.courtResultMeta}>
                          {[
                            court.city,
                            court.postalCode,
                            court.sport === "BASKETBALL" ? "BB" : "PB",
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </Text>
                      </View>
                      {courtSavingId === court.id ? (
                        <ActivityIndicator color={Colors.accent} size="small" />
                      ) : (
                        <Feather
                          color={
                            court.id === localCourt?.id
                              ? Colors.accent
                              : Colors.muted
                          }
                          name={
                            court.id === localCourt?.id
                              ? "check"
                              : "chevron-right"
                          }
                          size={17}
                        />
                      )}
                    </Pressable>
                  ))
                ) : !courtSearching ? (
                  <Text style={styles.noCourtResults}>
                    {/^\d{5}$/.test(courtSearchTerm)
                      ? `No courts found near ${courtSearchTerm}`
                      : `No courts match “${courtSearchTerm}”`}
                  </Text>
                ) : null}
              </View>
            ) : null}
          </View>
        </Section>

        <Section title="ALERTS">
          <ToggleSettingsRow
            icon="bell"
            label="PUSH NOTIFICATIONS"
            detail="Run invites, friend updates, and score reviews"
            disabled={pushSaving}
            onValueChange={(value) => void setPushNotifications(value)}
            value={pushValue}
          />
          <SettingsRow
            icon="inbox"
            label="NOTIFICATION INBOX"
            detail="See all LocalCheck alerts"
            onPress={() => router.push("/notifications" as Href)}
          />
        </Section>

        <Section title="SAFETY">
          <SettingsRow
            icon="slash"
            label="BLOCKED PLAYERS"
            detail="Review or unblock players"
            onPress={() => router.push("/blocked-users" as Href)}
          />
        </Section>

        <Section title="LEGAL & SUPPORT">
          <SettingsRow
            icon="shield"
            label="PRIVACY POLICY"
            onPress={() => openWebsitePath("/privacy")}
          />
          <SettingsRow
            icon="file-text"
            label="TERMS OF SERVICE"
            onPress={() => openWebsitePath("/terms")}
          />
          <SettingsRow
            icon="help-circle"
            label="HELP & SUPPORT"
            onPress={() => openWebsitePath("/support")}
          />
        </Section>

        <Section title="ACCOUNT">
          <SettingsRow icon="log-out" label="LOG OUT" onPress={handleLogout} />
          <Pressable
            style={({ pressed }) => [
              styles.deleteRow,
              pressed && styles.pressed,
            ]}
            onPress={handleDeleteAccount}
            disabled={deleting}
          >
            {deleting ? (
              <ActivityIndicator color={Colors.loss} size="small" />
            ) : (
              <Feather name="trash-2" size={17} color={Colors.loss} />
            )}
            <Text style={styles.deleteText}>
              {deleting ? "DELETING…" : "DELETE ACCOUNT"}
            </Text>
          </Pressable>
        </Section>

        <Text style={styles.version}>LOCALCHECK 1.0.0</Text>
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionSurface}>{children}</View>
    </View>
  );
}

function SettingsRow({
  icon,
  label,
  detail,
  onPress,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  detail?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.settingsRow, pressed && styles.pressed]}
      onPress={onPress}
    >
      <Feather name={icon} size={17} color={Colors.textSecondary} />
      <View style={{ flex: 1 }}>
        <Text style={styles.settingsLabel} numberOfLines={1}>
          {label}
        </Text>
        {detail ? <Text style={styles.settingsDetail}>{detail}</Text> : null}
      </View>
      <Feather name="chevron-right" size={17} color={Colors.muted} />
    </Pressable>
  );
}

function ToggleSettingsRow({
  disabled,
  icon,
  label,
  detail,
  onValueChange,
  value,
}: {
  disabled?: boolean;
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  detail?: string;
  onValueChange: (value: boolean) => void;
  value: boolean;
}) {
  return (
    <View style={styles.settingsRow}>
      <Feather name={icon} size={17} color={Colors.textSecondary} />
      <View style={{ flex: 1 }}>
        <Text style={styles.settingsLabel} numberOfLines={1}>
          {label}
        </Text>
        {detail ? <Text style={styles.settingsDetail}>{detail}</Text> : null}
      </View>
      <Switch
        accessibilityLabel={label}
        accessibilityHint={`Turns ${label.toLowerCase()} on or off`}
        disabled={disabled}
        ios_backgroundColor={Colors.borderLight}
        onValueChange={onValueChange}
        trackColor={{ false: Colors.borderLight, true: Colors.accent }}
        value={value}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  header: {
    minHeight: 94,
    paddingHorizontal: 16,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 17,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  headerTitle: {
    fontFamily: Typography.heading,
    fontSize: 19,
    color: Colors.text,
    letterSpacing: 1.2,
  },
  profileRow: {
    paddingHorizontal: 20,
    paddingVertical: 22,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
  },
  profileName: {
    fontFamily: Typography.heading,
    fontSize: 20,
    lineHeight: 22,
    color: Colors.text,
    letterSpacing: 0.4,
  },
  profileMeta: {
    fontFamily: Typography.bodyMedium,
    fontSize: 12,
    color: Colors.muted,
    letterSpacing: 0.8,
    marginTop: 4,
  },
  section: { paddingHorizontal: 20, marginBottom: 21 },
  sectionTitle: {
    fontFamily: Typography.bodyBold,
    fontSize: 11,
    color: Colors.muted,
    letterSpacing: 1.8,
    marginBottom: 8,
  },
  sectionSurface: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    overflow: "hidden",
  },
  segmented: { flexDirection: "row", margin: 10, gap: 6 },
  segment: {
    flex: 1,
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.sm,
    backgroundColor: Colors.surfaceHigh,
    borderWidth: 1,
    borderColor: "transparent",
    paddingHorizontal: 5,
  },
  segmentActive: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentDim,
  },
  segmentText: {
    fontFamily: Typography.bodyBold,
    fontSize: 11,
    color: Colors.muted,
    letterSpacing: 0.9,
    textAlign: "center",
  },
  segmentTextActive: { color: Colors.text },
  explanation: {
    ...TextStyles.bodySmall,
    color: Colors.muted,
    paddingHorizontal: 13,
    paddingBottom: 13,
  },
  locationField: {
    padding: 14,
    gap: 7,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
  },
  locationLabel: {
    ...TextStyles.labelSmall,
    color: Colors.muted,
    letterSpacing: 1.3,
  },
  locationInputRow: {
    minHeight: 44,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    backgroundColor: Colors.background,
  },
  locationInput: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 0,
    ...TextStyles.bodySmall,
    color: Colors.text,
  },
  locationHelp: {
    ...TextStyles.caption,
    color: Colors.muted,
  },
  currentCourt: {
    ...TextStyles.labelSmall,
    color: Colors.accent,
    letterSpacing: 0.7,
  },
  inlineSave: {
    minHeight: 32,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  inlineSaveDisabled: { opacity: 0.35 },
  inlineSaveText: {
    ...TextStyles.labelSmall,
    color: Colors.accent,
    letterSpacing: 0.8,
  },
  courtResults: {
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    backgroundColor: Colors.background,
  },
  courtResult: {
    minHeight: 58,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
  },
  courtResultCopy: { flex: 1, minWidth: 0 },
  courtResultName: {
    ...TextStyles.listName,
    color: Colors.text,
  },
  courtResultMeta: {
    marginTop: 3,
    ...TextStyles.metadata,
    color: Colors.muted,
  },
  noCourtResults: {
    padding: 18,
    ...TextStyles.metadata,
    color: Colors.muted,
    textAlign: "center",
  },
  settingsRow: {
    minHeight: 58,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
  },
  settingsLabel: {
    fontFamily: Typography.bodySemiBold,
    fontSize: 11,
    color: Colors.text,
    letterSpacing: 0.55,
  },
  settingsDetail: {
    ...TextStyles.caption,
    color: Colors.muted,
    marginTop: 3,
  },
  deleteRow: {
    minHeight: 58,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  deleteText: {
    fontFamily: Typography.bodyBold,
    fontSize: 11,
    color: Colors.loss,
    letterSpacing: 1.2,
  },
  pressed: { opacity: 0.65 },
  version: {
    fontFamily: Typography.bodyMedium,
    fontSize: 11,
    color: Colors.mutedDark,
    letterSpacing: 1.3,
    textAlign: "center",
    marginTop: 2,
  },
});
