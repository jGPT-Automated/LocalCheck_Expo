import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BrutalistButton } from "@/components/BrutalistButton";
import { LogoMark } from "@/components/brand/LogoMark";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { OptionRow } from "@/components/ui/OptionRow";
import { SportEmblem } from "@/components/ui/SportEmblem";
import { StickyActionBar } from "@/components/ui/StickyActionBar";
import { Colors, Radius } from "@/constants/colors";
import type { CourtSport } from "@/constants/data";
import { Layout, Space } from "@/constants/layout";
import { Typography } from "@/constants/typography";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { useDeviceLocation } from "@/context/DeviceLocationContext";
import { coordinateForLocationAction } from "@/context/deviceLocationModel";
import { updateProfileFields } from "@/services/profileService";

const SPORT_ROWS: { value: CourtSport; label: string }[] = [
  { value: "BASKETBALL", label: "Basketball" },
  { value: "PICKLEBALL", label: "Pickleball" },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { top, bottom } = useSafeAreaInsets();
  const { profile, updateUsername, refreshProfile } = useAuth();
  const { setPreferredSport } = useApp();
  const {
    coord: deviceCoord,
    status: locationStatus,
    refresh: refreshLocation,
    suppressNextAutoResolve,
  } = useDeviceLocation();

  const [step, setStep] = React.useState<1 | 2>(1);

  const [username, setUsername] = React.useState(profile?.username ?? "");
  const [sport, setSport] = React.useState<CourtSport | null>(null);
  const [savingStep1, setSavingStep1] = React.useState(false);
  const [usernameError, setUsernameError] = React.useState<string | null>(null);
  const [step1Error, setStep1Error] = React.useState<string | null>(null);

  const [locating, setLocating] = React.useState(false);
  const [locationNotice, setLocationNotice] = React.useState<string | null>(null);
  const [zipMode, setZipMode] = React.useState(false);
  const [zip, setZip] = React.useState("");
  const [finishing, setFinishing] = React.useState(false);
  const [finishError, setFinishError] = React.useState<string | null>(null);

  const usernameValid = username.trim().length >= 3;
  const step1Ready = usernameValid && sport !== null;

  const hasLocation = coordinateForLocationAction(locationStatus, deviceCoord) !== null;
  const zipValid = /^\d{5}$/.test(zip.trim());
  const step2Ready = hasLocation || zipValid;

  async function handleContinueStep1() {
    if (!step1Ready || savingStep1 || !profile) return;
    setSavingStep1(true);
    setUsernameError(null);
    setStep1Error(null);
    const trimmed = username.trim();
    if (trimmed !== profile.username) {
      const { error } = await updateUsername(trimmed);
      if (error) {
        setSavingStep1(false);
        setUsernameError(error);
        return;
      }
    }
    const sportSaved = await setPreferredSport(sport);
    setSavingStep1(false);
    if (!sportSaved) {
      setStep1Error("Couldn't save your sport — check your connection and try again.");
      return;
    }
    setStep(2);
  }

  async function handleShareLocation() {
    setLocationNotice(null);
    setLocating(true);
    const result = await refreshLocation();
    setLocating(false);
    if (coordinateForLocationAction(result.status, result.coord) === null) {
      setLocationNotice("Location access is off. Turn it on, or enter your ZIP instead.");
    }
  }

  async function handleFinish() {
    if (!step2Ready || finishing || !profile) return;
    setFinishing(true);
    setFinishError(null);
    const usedZip = !hasLocation && zipValid;
    const fields: Parameters<typeof updateProfileFields>[1] = {
      onboarding_completed: true,
    };
    if (usedZip) {
      fields.postal_code = zip.trim();
    }
    const saved = await updateProfileFields(profile.id, fields);
    if (!saved) {
      setFinishing(false);
      setFinishError("Couldn't save that — check your connection and try again.");
      return;
    }
    // Completing onboarding flips autoResolve back on app-wide — without
    // this, choosing ZIP here would immediately trigger the native location
    // prompt anyway, right after explicitly opting out of sharing it.
    if (usedZip) suppressNextAutoResolve();
    await refreshProfile();
    setFinishing(false);
    // No device fix to anchor Explore's "nearby" query on — hand the ZIP to
    // its existing court search (already matches on postal code) instead of
    // guessing a coordinate.
    if (usedZip) {
      router.replace({ pathname: "/(tabs)/explore", params: { q: zip.trim() } });
    } else {
      router.replace("/(tabs)");
    }
  }

  return (
    <View style={styles.screen}>
      <KeyboardAwareScrollViewCompat
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: top + Space.lg }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          {step === 2 ? (
            <Pressable
              accessibilityHint="Back to claim your name"
              accessibilityLabel="Back"
              accessibilityRole="button"
              onPress={() => setStep(1)}
              style={({ pressed }) => [
                styles.backAction,
                pressed && styles.pressed,
              ]}
            >
              <LogoMark size={24} variant="back" />
            </Pressable>
          ) : (
            <View style={styles.backAction}>
              <LogoMark size={24} />
            </View>
          )}
          <View style={styles.progressRow}>
            <View style={[styles.progressSegment, styles.progressFilled]} />
            <View
              style={[
                styles.progressSegment,
                step === 2 && styles.progressFilled,
              ]}
            />
          </View>
        </View>

        {step === 1 ? (
          <>
            <Text style={styles.eyebrow}>STEP 1 OF 2</Text>
            <Text style={styles.title}>
              CLAIM YOUR{"\n"}NAME<Text style={styles.titleDot}>.</Text>
            </Text>
            <Text style={styles.subtitle}>This is how locals will know you.</Text>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>USERNAME</Text>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                editable={!savingStep1}
                maxLength={32}
                onChangeText={(text) => {
                  setUsername(text.replace(/[^A-Za-z0-9_]/g, ""));
                  setUsernameError(null);
                }}
                placeholder="username"
                placeholderTextColor={Colors.mutedDark}
                style={[styles.input, savingStep1 && styles.inputDisabled]}
                value={username}
              />
              {usernameError ? (
                <Text style={styles.fieldError}>{usernameError}</Text>
              ) : null}
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>YOUR SPORT</Text>
              <View style={styles.sportList}>
                {SPORT_ROWS.map((row) => (
                  <OptionRow
                    key={row.value}
                    disabled={savingStep1}
                    icon={<SportEmblem sport={row.value} size={18} />}
                    label={row.label}
                    onPress={() => setSport(row.value)}
                    selected={sport === row.value}
                  />
                ))}
              </View>
            </View>

            {step1Error ? (
              <View style={styles.errorBanner}>
                <LogoMark size={18} />
                <Text style={styles.errorBannerText}>{step1Error}</Text>
              </View>
            ) : null}
          </>
        ) : (
          <>
            <Text style={styles.eyebrow}>STEP 2 OF 2</Text>
            <Text style={styles.title}>
              KNOW YOUR{"\n"}COURTS<Text style={styles.titleDot}>.</Text>
            </Text>
            <Text style={styles.subtitle}>See which ones have locals right now.</Text>

            <BrutalistButton
              icon={<Feather color={Colors.black} name="crosshair" size={15} />}
              label="SHARE LOCATION"
              loading={locating}
              onPress={() => void handleShareLocation()}
              style={styles.fullButton}
              variant="accent"
            />
            {hasLocation ? (
              <Text style={styles.locationConfirmed}>
                <Feather color={Colors.accent} name="check-circle" size={12} /> Location
                ready.
              </Text>
            ) : locationNotice ? (
              <Text style={styles.locationNotice}>{locationNotice}</Text>
            ) : null}

            {!zipMode ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => setZipMode(true)}
                style={({ pressed }) => [styles.zipLink, pressed && styles.pressed]}
              >
                <Text style={styles.zipLinkText}>Enter zip code instead</Text>
              </Pressable>
            ) : (
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>ZIP CODE</Text>
                <TextInput
                  keyboardType="number-pad"
                  maxLength={5}
                  onChangeText={(text) => setZip(text.replace(/[^0-9]/g, ""))}
                  placeholder="90001"
                  placeholderTextColor={Colors.mutedDark}
                  style={styles.input}
                  value={zip}
                />
              </View>
            )}

            {finishError ? (
              <View style={styles.errorBanner}>
                <LogoMark size={18} />
                <Text style={styles.errorBannerText}>{finishError}</Text>
              </View>
            ) : null}
          </>
        )}
      </KeyboardAwareScrollViewCompat>

      <StickyActionBar
        bottomInset={bottom}
        primary={
          step === 1
            ? {
                label: savingStep1 ? "SAVING…" : step1Error ? "RETRY" : "CONTINUE",
                onPress: () => void handleContinueStep1(),
                disabled: !step1Ready || savingStep1,
              }
            : {
                label: finishing ? "FINISHING…" : finishError ? "RETRY" : "CONTINUE",
                onPress: () => void handleFinish(),
                disabled: !step2Ready || finishing,
              }
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: Layout.screenGutter,
    paddingBottom: Space.xl,
    gap: Space.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.lg,
  },
  pressed: { opacity: 0.68 },
  backAction: {
    width: Layout.minTouchTarget,
    height: Layout.minTouchTarget,
    marginLeft: -10,
    alignItems: "center",
    justifyContent: "center",
  },
  progressRow: { flex: 1, flexDirection: "row", gap: Space.sm },
  progressSegment: {
    flex: 1,
    height: 3,
    borderRadius: Radius.xs,
    backgroundColor: Colors.border,
  },
  progressFilled: { backgroundColor: Colors.accent },
  eyebrow: {
    fontFamily: Typography.bodyBold,
    fontSize: 11,
    color: Colors.accent,
    letterSpacing: 1.5,
    marginTop: Space.md,
  },
  title: {
    fontFamily: Typography.headingBold,
    fontSize: 34,
    lineHeight: 38,
    color: Colors.text,
    letterSpacing: 0.3,
    marginTop: Space.xs,
  },
  titleDot: { color: Colors.accent },
  subtitle: {
    fontFamily: Typography.body,
    fontSize: 15,
    lineHeight: 20,
    color: Colors.textSecondary,
    marginTop: Space.sm,
  },
  field: { marginTop: Space.md, gap: Space.sm },
  fieldLabel: {
    fontFamily: Typography.bodyMedium,
    fontSize: 10,
    color: Colors.muted,
    letterSpacing: 2,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    color: Colors.text,
    fontFamily: Typography.body,
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: Radius.md,
  },
  inputDisabled: { opacity: 0.5 },
  fieldError: {
    fontFamily: Typography.body,
    fontSize: 12,
    color: Colors.loss,
  },
  sportList: { gap: Space.sm },
  fullButton: { width: "100%", marginTop: Space.md },
  locationConfirmed: {
    fontFamily: Typography.bodyMedium,
    fontSize: 12,
    color: Colors.accent,
    marginTop: Space.sm,
  },
  locationNotice: {
    fontFamily: Typography.body,
    fontSize: 12,
    color: Colors.muted,
    marginTop: Space.sm,
  },
  zipLink: {
    marginTop: Space.lg,
    alignSelf: "center",
    minHeight: Layout.minTouchTarget,
    paddingHorizontal: Space.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  zipLinkText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 12,
    color: Colors.textSecondary,
    textDecorationLine: "underline",
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.sm,
    marginTop: Space.lg,
    padding: Space.md,
    borderWidth: 1,
    borderColor: Colors.loss,
    borderRadius: Radius.md,
    backgroundColor: Colors.lossDim,
  },
  errorBannerText: {
    flex: 1,
    fontFamily: Typography.body,
    fontSize: 12,
    lineHeight: 16,
    color: Colors.text,
  },
});
