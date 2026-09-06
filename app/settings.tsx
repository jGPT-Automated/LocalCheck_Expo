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
import { ScreenHeader } from "@/components/ScreenHeader";
import { RunFlowSheet } from "@/components/sheet/RunFlowSheet";
import { Colors, Radius } from "@/constants/colors";
import { Court, CourtSport } from "@/constants/data";
import { Space } from "@/constants/layout";
import { TextStyles, Typography } from "@/constants/typography";
import { useApp, Visibility } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/context/NotificationContext";
import { deleteCurrentAccount } from "@/services/accountService";
import { searchCourts } from "@/services/courtService";

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
    description:
      "Anyone at the court sees your name, avatar, and rank when you check in.",
  },
  {
    value: "friends",
    label: "FRIENDS",
    description:
      "Only accepted friends see your identity. Everyone else sees an anonymous check-in.",
  },
  {
    value: "private",
    label: "PRIVATE",
    description:
      "You still count as active, but your name, avatar, and rank stay hidden from everyone — including on the leaderboard.",
  },
];

const SPORT_OPTIONS: Array<{
  value: CourtSport;
  label: string;
  description: string;
}> = [
  {
    value: "BASKETBALL",
    label: "BASKETBALL",
    description: "Explore, rankings, and Log Game open on basketball.",
  },
  {
    value: "PICKLEBALL",
    label: "PICKLEBALL",
    description: "Explore, rankings, and Log Game open on pickleball.",
  },
];

function sportLabel(sport: CourtSport | null): string {
  if (sport === "BASKETBALL") return "BASKETBALL";
  if (sport === "PICKLEBALL") return "PICKLEBALL";
  return "NOT SET";
}

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
  const { user, profile, signOut } = useAuth();
  const { bottom } = useSafeAreaInsets();
  const [deleting, setDeleting] = useState(false);
  const [pushSaving, setPushSaving] = useState(false);
  const { pushEnabled, enablePush, disablePush } = useNotifications();
  const [pushValue, setPushValue] = useState(pushEnabled);
  const [editor, setEditor] = useState<null | "privacy" | "sport" | "court">(
    null,
  );

  useEffect(() => {
    if (!pushSaving) setPushValue(pushEnabled);
  }, [pushEnabled, pushSaving]);

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

  const isPrivate = visibility === "private";
  const isFriendsOnly = visibility === "friends";
  const privacyLabel =
    VISIBILITY_OPTIONS.find((option) => option.value === visibility)?.label ??
    "PUBLIC";

  return (
    <View style={styles.screen}>
      <ScreenHeader title="SETTINGS" onBack={() => router.back()} />

      <KeyboardAwareScrollViewCompat
        bottomOffset={104}
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: Platform.OS === "web" ? 90 : bottom + 80,
        }}
      >
        <View style={[styles.profileRow, isPrivate && styles.profileRowHidden]}>
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

        {isPrivate ? (
          <View style={styles.visibilityBanner}>
            <Feather name="eye-off" size={13} color={Colors.muted} />
            <Text style={styles.visibilityBannerText}>
              HIDDEN — you won't appear in court rosters or the leaderboard
            </Text>
          </View>
        ) : isFriendsOnly ? (
          <View style={styles.visibilityBanner}>
            <Feather name="users" size={13} color={Colors.muted} />
            <Text style={styles.visibilityBannerText}>
              FRIENDS ONLY — players who aren't your friends see an anonymous
              check-in
            </Text>
          </View>
        ) : null}

        <Section title="PROFILE">
          <DrillRow
            icon="eye"
            label="CHECK-IN PRIVACY"
            value={privacyLabel}
            onPress={() => setEditor("privacy")}
          />
          <DrillRow
            icon="target"
            label="PRIMARY SPORT"
            value={sportLabel(preferredSport)}
            valueMuted={!preferredSport}
            onPress={() => setEditor("sport")}
          />
          <DrillRow
            icon="map-pin"
            label="LOCAL COURT"
            value={
              localCourt
                ? (localCourt.shortName || localCourt.name).toUpperCase()
                : "NOT SET"
            }
            valueMuted={!localCourt}
            onPress={() => setEditor("court")}
            last
          />
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
            last
          />
        </Section>

        <Section title="SAFETY">
          <SettingsRow
            icon="slash"
            label="BLOCKED PLAYERS"
            detail="Review or unblock players"
            onPress={() => router.push("/blocked-users" as Href)}
            last
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
            last
          />
        </Section>

        <Section title="ACCOUNT">
          <SettingsRow
            icon="log-out"
            label="LOG OUT"
            onPress={handleLogout}
            last
          />
          <Pressable
            style={({ pressed }) => [styles.deleteRow, pressed && styles.pressed]}
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

      <PrivacyEditorSheet
        visible={editor === "privacy"}
        value={visibility}
        onSelect={(next) => void setVisibility(next)}
        onClose={() => setEditor(null)}
      />
      <SportEditorSheet
        visible={editor === "sport"}
        value={preferredSport}
        onSelect={(next) => void setPreferredSport(next)}
        onClose={() => setEditor(null)}
      />
      <LocalCourtEditorSheet
        visible={editor === "court"}
        current={localCourt}
        onChoose={(court) => setLocalCourt(court.id, court)}
        onRemove={() => setLocalCourt(null)}
        onClose={() => setEditor(null)}
      />
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

/** `[icon]  LABEL ......... value  ›` — taps open a focused editor. */
function DrillRow({
  icon,
  label,
  value,
  valueMuted,
  onPress,
  last,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  value: string;
  valueMuted?: boolean;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}. Currently ${value}.`}
      style={({ pressed }) => [
        styles.row,
        last && styles.rowLast,
        pressed && styles.pressed,
      ]}
      onPress={onPress}
    >
      <Feather name={icon} size={17} color={Colors.textSecondary} />
      <Text style={styles.rowLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text
        style={[styles.rowValue, valueMuted && styles.rowValueMuted]}
        numberOfLines={1}
      >
        {value}
      </Text>
      <Feather name="chevron-right" size={17} color={Colors.muted} />
    </Pressable>
  );
}

function SettingsRow({
  icon,
  label,
  detail,
  onPress,
  last,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  detail?: string;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        last && styles.rowLast,
        pressed && styles.pressed,
      ]}
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
    <View style={styles.row}>
      <Feather name={icon} size={17} color={Colors.textSecondary} />
      <View style={{ flex: 1 }}>
        <Text style={styles.settingsLabel} numberOfLines={1}>
          {label}
        </Text>
        {detail ? <Text style={styles.settingsDetail}>{detail}</Text> : null}
      </View>
      <View style={styles.notificationSwitchFrame}>
        <Switch
          accessibilityLabel={label}
          accessibilityHint={`Turns ${label.toLowerCase()} on or off`}
          disabled={disabled}
          ios_backgroundColor={Colors.borderLight}
          onValueChange={onValueChange}
          style={styles.notificationSwitch}
          trackColor={{ false: Colors.borderLight, true: Colors.accent }}
          value={value}
        />
      </View>
    </View>
  );
}

// ─── Focused editors ─────────────────────────────────────────────────────────

function OptionRow({
  label,
  description,
  selected,
  onPress,
}: {
  label: string;
  description: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.option,
        selected && styles.optionSelected,
        pressed && styles.pressed,
      ]}
      onPress={onPress}
    >
      <View style={styles.optionCopy}>
        <Text
          style={[styles.optionLabel, selected && styles.optionLabelSelected]}
        >
          {label}
        </Text>
        <Text style={styles.optionDescription}>{description}</Text>
      </View>
      <View style={[styles.radio, selected && styles.radioSelected]}>
        {selected ? (
          <Feather name="check" size={13} color={Colors.black} />
        ) : null}
      </View>
    </Pressable>
  );
}

function PrivacyEditorSheet({
  visible,
  value,
  onSelect,
  onClose,
}: {
  visible: boolean;
  value: Visibility;
  onSelect: (value: Visibility) => void;
  onClose: () => void;
}) {
  return (
    <RunFlowSheet
      visible={visible}
      onClose={onClose}
      title="CHECK-IN PRIVACY"
      eyebrow="WHO SEES YOU AT A COURT"
      snapPoints={["62%"]}
    >
      <View style={styles.optionList}>
        {VISIBILITY_OPTIONS.map((option) => (
          <OptionRow
            key={option.value}
            label={option.label}
            description={option.description}
            selected={value === option.value}
            onPress={() => {
              onSelect(option.value);
              onClose();
            }}
          />
        ))}
      </View>
    </RunFlowSheet>
  );
}

function SportEditorSheet({
  visible,
  value,
  onSelect,
  onClose,
}: {
  visible: boolean;
  value: CourtSport | null;
  onSelect: (value: CourtSport) => void;
  onClose: () => void;
}) {
  return (
    <RunFlowSheet
      visible={visible}
      onClose={onClose}
      title="PRIMARY SPORT"
      eyebrow="YOUR DEFAULT ACROSS LOCALCHECK"
      snapPoints={["46%"]}
    >
      <View style={styles.optionList}>
        {SPORT_OPTIONS.map((option) => (
          <OptionRow
            key={option.value}
            label={option.label}
            description={option.description}
            selected={value === option.value}
            onPress={() => {
              onSelect(option.value);
              onClose();
            }}
          />
        ))}
      </View>
    </RunFlowSheet>
  );
}

function LocalCourtEditorSheet({
  visible,
  current,
  onChoose,
  onRemove,
  onClose,
}: {
  visible: boolean;
  current: Court | null;
  onChoose: (court: Court) => Promise<boolean>;
  onRemove: () => Promise<boolean>;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Court[]>([]);
  const [searching, setSearching] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setQuery("");
      setResults([]);
      setSearching(false);
      setBusyId(null);
    }
  }, [visible]);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    let active = true;
    setSearching(true);
    const timer = setTimeout(() => {
      void searchCourts(term, null, 8).then((found) => {
        if (!active) return;
        setResults(found);
        setSearching(false);
      });
    }, 220);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);

  const pick = async (court: Court) => {
    if (busyId) return;
    setBusyId(court.id);
    const ok = await onChoose(court);
    setBusyId(null);
    if (ok) {
      onClose();
    } else {
      Alert.alert(
        "Local court couldn't be updated",
        "Check your connection and try selecting the court again.",
      );
    }
  };

  const clear = async () => {
    if (busyId) return;
    setBusyId("__remove__");
    const ok = await onRemove();
    setBusyId(null);
    if (ok) {
      onClose();
    } else {
      Alert.alert(
        "Local court couldn't be updated",
        "Check your connection and try again.",
      );
    }
  };

  const term = query.trim();

  return (
    <RunFlowSheet
      visible={visible}
      onClose={onClose}
      title="LOCAL COURT"
      eyebrow="ANCHORS YOUR RANKINGS & LOG GAME"
      snapPoints={["82%"]}
      contentBottomPadding={64}
    >
      {current ? (
        <View style={styles.currentCourtCard}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.currentCourtEyebrow}>CURRENT</Text>
            <Text style={styles.currentCourtName} numberOfLines={1}>
              {current.name.toUpperCase()}
            </Text>
            <Text style={styles.currentCourtMeta} numberOfLines={1}>
              {[
                current.city,
                current.sport === "BASKETBALL" ? "BASKETBALL" : "PICKLEBALL",
              ]
                .filter(Boolean)
                .join(" · ")}
            </Text>
          </View>
          <Pressable
            accessibilityLabel="Remove local court"
            accessibilityRole="button"
            disabled={Boolean(busyId)}
            hitSlop={8}
            onPress={() => void clear()}
            style={({ pressed }) => [
              styles.removeCourt,
              pressed && styles.pressed,
            ]}
          >
            {busyId === "__remove__" ? (
              <ActivityIndicator color={Colors.loss} size="small" />
            ) : (
              <Text style={styles.removeCourtText}>REMOVE</Text>
            )}
          </Pressable>
        </View>
      ) : null}

      <View style={styles.searchBox}>
        <Feather name="search" size={16} color={Colors.muted} />
        <TextInput
          accessibilityLabel="Search for a court"
          autoCapitalize="words"
          autoCorrect={false}
          onChangeText={setQuery}
          placeholder="Court name, city, or ZIP"
          placeholderTextColor={Colors.mutedDark}
          returnKeyType="search"
          style={styles.searchInput}
          value={query}
        />
        {searching ? (
          <ActivityIndicator color={Colors.accent} size="small" />
        ) : null}
      </View>

      {term.length >= 2 ? (
        <View style={styles.results}>
          {results.length > 0 ? (
            results.map((court) => {
              const active = court.id === current?.id;
              return (
                <Pressable
                  key={court.id}
                  accessibilityLabel={`Set ${court.name} as local court`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  disabled={Boolean(busyId)}
                  onPress={() => void pick(court)}
                  style={({ pressed }) => [
                    styles.resultRow,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.resultName} numberOfLines={1}>
                      {court.name}
                    </Text>
                    <Text style={styles.resultMeta} numberOfLines={1}>
                      {[
                        court.city,
                        court.postalCode,
                        court.sport === "BASKETBALL" ? "BB" : "PB",
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </Text>
                  </View>
                  {busyId === court.id ? (
                    <ActivityIndicator color={Colors.accent} size="small" />
                  ) : (
                    <Feather
                      color={active ? Colors.accent : Colors.muted}
                      name={active ? "check" : "chevron-right"}
                      size={17}
                    />
                  )}
                </Pressable>
              );
            })
          ) : !searching ? (
            <Text style={styles.resultsEmpty}>
              NO COURTS MATCH “{term.toUpperCase()}”
            </Text>
          ) : null}
        </View>
      ) : (
        <Text style={styles.searchHint}>
          Your local court anchors your ranking scope and prefills the court when
          you log a game.
        </Text>
      )}
    </RunFlowSheet>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  profileRow: {
    paddingHorizontal: 20,
    paddingVertical: 22,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
  },
  profileRowHidden: { opacity: 0.48 },
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
  visibilityBanner: {
    marginHorizontal: 20,
    marginBottom: 18,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surface,
  },
  visibilityBannerText: {
    ...TextStyles.caption,
    flex: 1,
    color: Colors.muted,
    letterSpacing: 0.3,
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
  row: {
    minHeight: 58,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
  },
  rowLast: { borderBottomWidth: 0 },
  rowLabel: {
    flex: 1,
    fontFamily: Typography.bodySemiBold,
    fontSize: 11,
    color: Colors.text,
    letterSpacing: 0.55,
  },
  rowValue: {
    maxWidth: "44%",
    ...TextStyles.label,
    color: Colors.textSecondary,
    letterSpacing: 0.4,
    textAlign: "right",
  },
  rowValueMuted: { color: Colors.mutedDark },
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
  notificationSwitchFrame: {
    width: 52,
    height: 44,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
  },
  notificationSwitch: {
    transform: [{ scale: Platform.OS === "ios" ? 0.82 : 1 }],
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

  // ── Editor sheets ──
  optionList: { gap: Space.sm },
  option: {
    minHeight: 64,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surface,
  },
  optionSelected: {
    borderColor: Colors.accentBorder,
    backgroundColor: Colors.accentDim,
  },
  optionCopy: { flex: 1, gap: 3 },
  optionLabel: {
    ...TextStyles.label,
    color: Colors.textSecondary,
    letterSpacing: 1,
  },
  optionLabelSelected: { color: Colors.text },
  optionDescription: {
    ...TextStyles.caption,
    color: Colors.muted,
    lineHeight: 15,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    alignItems: "center",
    justifyContent: "center",
  },
  radioSelected: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accent,
  },
  currentCourtCard: {
    marginBottom: Space.md,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.accentBorder,
    borderRadius: Radius.sm,
    backgroundColor: Colors.accentDim,
  },
  currentCourtEyebrow: {
    ...TextStyles.labelSmall,
    color: Colors.accent,
    letterSpacing: 1.4,
  },
  currentCourtName: {
    ...TextStyles.title,
    color: Colors.text,
    marginTop: 2,
  },
  currentCourtMeta: {
    ...TextStyles.caption,
    color: Colors.muted,
    marginTop: 3,
    letterSpacing: 0.6,
  },
  removeCourt: {
    minHeight: 40,
    minWidth: 72,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surface,
  },
  removeCourtText: {
    ...TextStyles.labelSmall,
    color: Colors.loss,
    letterSpacing: 1,
  },
  searchBox: {
    minHeight: 46,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surface,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 0,
    ...TextStyles.bodySmall,
    color: Colors.text,
  },
  searchHint: {
    ...TextStyles.caption,
    color: Colors.muted,
    marginTop: 12,
    lineHeight: 16,
  },
  results: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    overflow: "hidden",
  },
  resultRow: {
    minHeight: 58,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
  },
  resultName: {
    ...TextStyles.listName,
    color: Colors.text,
  },
  resultMeta: {
    marginTop: 3,
    ...TextStyles.metadata,
    color: Colors.muted,
  },
  resultsEmpty: {
    padding: 18,
    ...TextStyles.metadata,
    color: Colors.muted,
    textAlign: "center",
  },
});
