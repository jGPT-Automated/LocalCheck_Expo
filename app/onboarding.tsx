import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BrutalistButton } from "@/components/BrutalistButton";
import { LogoMark } from "@/components/brand/LogoMark";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { OptionRow } from "@/components/ui/OptionRow";
import { SportEmblem } from "@/components/ui/SportEmblem";
import { StickyActionBar } from "@/components/ui/StickyActionBar";
import { Colors, Radius } from "@/constants/colors";
import type { Court, CourtSport } from "@/constants/data";
import { Layout, Space } from "@/constants/layout";
import { Typography } from "@/constants/typography";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { useDeviceLocation } from "@/context/DeviceLocationContext";
import { coordinateForLocationAction } from "@/context/deviceLocationModel";
import { useNotifications } from "@/context/NotificationContext";
import {
  courtPickerDetail,
  inviteErrorMessage,
  isCityQuery,
  normalizeInviter,
  ONBOARDING_STEPS,
} from "@/lib/onboardingModel";
import { coordinateForPlace } from "@/lib/placeLocation";
import { fetchNearbyCourts } from "@/services/courtService";
import { redeemInviter, updateProfileFields } from "@/services/profileService";

const SPORT_ROWS: { value: CourtSport; label: string }[] = [
  { value: "BASKETBALL", label: "Basketball" },
  { value: "PICKLEBALL", label: "Pickleball" },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { top, bottom } = useSafeAreaInsets();
  const { profile, updateUsername, refreshProfile } = useAuth();
  const { setPreferredSport, setLocalCourt } = useApp();
  const { enablePush } = useNotifications();
  const {
    refresh: refreshLocation,
    suppressNextAutoResolve,
  } = useDeviceLocation();

  const [step, setStep] = React.useState<1 | 2 | 3>(1);

  // Step 1: name, sport, inviter
  const [username, setUsername] = React.useState(profile?.username ?? "");
  const [sport, setSport] = React.useState<CourtSport | null>(null);
  const [inviter, setInviter] = React.useState("");
  const [inviterSaved, setInviterSaved] = React.useState(false);
  const [savingStep1, setSavingStep1] = React.useState(false);
  const [usernameError, setUsernameError] = React.useState<string | null>(null);
  const [inviterError, setInviterError] = React.useState<string | null>(null);
  const [step1Error, setStep1Error] = React.useState<string | null>(null);

  // Step 2: local court
  const [locating, setLocating] = React.useState(false);
  const [locationNotice, setLocationNotice] = React.useState<string | null>(null);
  const [cityMode, setCityMode] = React.useState(false);
  const [city, setCity] = React.useState("");
  const [usedCity, setUsedCity] = React.useState(false);
  // Only the newest lookup may fill the picker (an older, slower one is dropped).
  const lookupRef = React.useRef(0);
  // The sport the current court list was loaded for.
  const [courtsSport, setCourtsSport] = React.useState<CourtSport | null>(null);
  const [searching, setSearching] = React.useState(false);
  const [searched, setSearched] = React.useState(false);
  const [courtOptions, setCourtOptions] = React.useState<Court[]>([]);
  const [selectedCourt, setSelectedCourt] = React.useState<Court | null>(null);
  const [savingStep2, setSavingStep2] = React.useState(false);
  const [step2Error, setStep2Error] = React.useState<string | null>(null);

  // Step 3: alerts, then finish
  const [finishing, setFinishing] = React.useState(false);
  const [finishError, setFinishError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!username && profile?.username) setUsername(profile.username);
  }, [profile?.username, username]);

  const usernameValid = username.trim().length >= 3;
  const step1Ready = usernameValid && sport !== null;
  // No courts nearby yet is not a dead end: they can continue and add one later.
  const step2Ready = selectedCourt !== null || (searched && courtOptions.length === 0);

  async function handleContinueStep1() {
    if (!step1Ready || savingStep1 || !profile) return;
    setSavingStep1(true);
    setUsernameError(null);
    setInviterError(null);
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
    if (!sportSaved) {
      setSavingStep1(false);
      setStep1Error("Couldn't save your sport. Check your connection and try again.");
      return;
    }
    if (inviter && !inviterSaved) {
      const message = inviteErrorMessage(await redeemInviter(inviter));
      if (message) {
        setSavingStep1(false);
        setInviterError(message);
        return;
      }
      setInviterSaved(true);
    }
    setSavingStep1(false);
    // A different sport makes the loaded courts (and any pick) stale.
    if (courtsSport !== null && courtsSport !== sport) {
      lookupRef.current += 1;
      setCourtOptions([]);
      setSelectedCourt(null);
      setSearched(false);
      setCourtsSport(null);
    }
    setStep(2);
  }

  async function loadCourtsNear(lookup: number, lat: number, lng: number) {
    const courts = await fetchNearbyCourts(lat, lng, sport, 8);
    if (lookup !== lookupRef.current) return;
    setCourtOptions(courts);
    setCourtsSport(sport);
    setSearched(true);
    setSearching(false);
  }

  function startLookup(): number {
    lookupRef.current += 1;
    setSearching(true);
    setSelectedCourt(null);
    setLocationNotice(null);
    return lookupRef.current;
  }

  async function handleUseLocation() {
    setLocating(true);
    const lookup = startLookup();
    const result = await refreshLocation();
    setLocating(false);
    if (lookup !== lookupRef.current) return;
    const coord = coordinateForLocationAction(result.status, result.coord);
    if (!coord) {
      setSearching(false);
      setLocationNotice("Location access is off. Turn it on in Settings, or search by city instead.");
      return;
    }
    setUsedCity(false);
    await loadCourtsNear(lookup, coord.lat, coord.lng);
  }

  // Runs on the keyboard's Search key or the FIND COURTS button, never per
  // keystroke.
  async function handleFindCity() {
    if (!isCityQuery(city) || searching) return;
    const lookup = startLookup();
    const coord = await coordinateForPlace(city);
    if (lookup !== lookupRef.current) return;
    if (!coord) {
      setSearching(false);
      setLocationNotice("Couldn't find that city. Try \"City, State\".");
      return;
    }
    setUsedCity(true);
    await loadCourtsNear(lookup, coord.lat, coord.lng);
  }

  async function handleContinueStep2() {
    if (!step2Ready || savingStep2 || !profile) return;
    setSavingStep2(true);
    setStep2Error(null);
    if (selectedCourt) {
      const saved = await setLocalCourt(selectedCourt.id, selectedCourt);
      if (!saved) {
        setSavingStep2(false);
        setStep2Error("Couldn't save your court. Check your connection and try again.");
        return;
      }
    }
    setSavingStep2(false);
    setStep(3);
  }

  async function handleFinish() {
    if (finishing || !profile) return;
    setFinishing(true);
    setFinishError(null);
    // iOS shows its own Allow / Don't Allow; either answer continues.
    await enablePush();
    const saved = await updateProfileFields(profile.id, { onboarding_completed: true });
    if (!saved) {
      setFinishing(false);
      setFinishError("Couldn't finish setup. Check your connection and try again.");
      return;
    }
    // Finishing turns automatic location back on app-wide. Someone who chose
    // a city instead of sharing location shouldn't get the native prompt now.
    if (usedCity) suppressNextAutoResolve();
    await refreshProfile();
    setFinishing(false);
    router.replace("/(tabs)");
  }

  function goBack() {
    if (step === 3) setStep(2);
    else if (step === 2) setStep(1);
  }

  const primary =
    step === 1
      ? {
          label: savingStep1 ? "SAVING…" : step1Error ? "RETRY" : "CONTINUE",
          onPress: () => void handleContinueStep1(),
          disabled: !step1Ready || savingStep1,
        }
      : step === 2
        ? {
            label: savingStep2
              ? "SAVING…"
              : step2Error
                ? "RETRY"
                : selectedCourt || !searched
                  ? "CONTINUE"
                  : "CONTINUE WITHOUT A COURT",
            onPress: () => void handleContinueStep2(),
            disabled: !step2Ready || savingStep2,
          }
        : {
            label: finishing ? "FINISHING…" : finishError ? "RETRY" : "TURN ON ALERTS",
            onPress: () => void handleFinish(),
            disabled: finishing,
          };

  return (
    <View style={styles.screen}>
      <KeyboardAwareScrollViewCompat
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: top + Space.lg }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          {step > 1 ? (
            <Pressable
              accessibilityHint="Back to the previous step"
              accessibilityLabel="Back"
              accessibilityRole="button"
              onPress={goBack}
              style={({ pressed }) => [styles.backAction, pressed && styles.pressed]}
            >
              <LogoMark size={24} variant="back" />
            </Pressable>
          ) : (
            <View style={styles.backAction}>
              <LogoMark size={24} />
            </View>
          )}
          <View style={styles.progressRow}>
            {Array.from({ length: ONBOARDING_STEPS }, (_, i) => (
              <View
                key={i}
                style={[styles.progressSegment, i < step && styles.progressFilled]}
              />
            ))}
          </View>
        </View>

        <Text style={styles.eyebrow}>
          STEP {step} OF {ONBOARDING_STEPS}
        </Text>

        {step === 1 ? (
          <>
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
              {usernameError ? <Text style={styles.fieldError}>{usernameError}</Text> : null}
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
              <Text style={styles.fieldHint}>You can change this anytime in Settings.</Text>
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>INVITED BY (OPTIONAL)</Text>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                editable={!savingStep1 && !inviterSaved}
                maxLength={32}
                onChangeText={(text) => {
                  setInviter(normalizeInviter(text));
                  setInviterError(null);
                }}
                placeholder="their username"
                placeholderTextColor={Colors.mutedDark}
                style={[styles.input, (savingStep1 || inviterSaved) && styles.inputDisabled]}
                value={inviter}
              />
              {inviterError ? <Text style={styles.fieldError}>{inviterError}</Text> : null}
            </View>

            {step1Error ? <ErrorBanner message={step1Error} /> : null}
          </>
        ) : step === 2 ? (
          <>
            <Text style={styles.title}>
              PICK YOUR{"\n"}COURT<Text style={styles.titleDot}>.</Text>
            </Text>
            <Text style={styles.subtitle}>
              Your home court. See who's there and who's coming.
            </Text>

            <BrutalistButton
              icon={<Feather color={Colors.black} name="crosshair" size={15} />}
              label="USE MY LOCATION"
              loading={locating}
              onPress={() => void handleUseLocation()}
              style={styles.fullButton}
              variant="accent"
            />

            {!cityMode ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => setCityMode(true)}
                style={({ pressed }) => [styles.zipLink, pressed && styles.pressed]}
              >
                <Text style={styles.zipLinkText}>Search by city instead</Text>
              </Pressable>
            ) : (
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>CITY</Text>
                <TextInput
                  autoCapitalize="words"
                  autoCorrect={false}
                  onChangeText={setCity}
                  onSubmitEditing={() => void handleFindCity()}
                  placeholder="Conroe, TX"
                  placeholderTextColor={Colors.mutedDark}
                  returnKeyType="search"
                  style={styles.input}
                  value={city}
                />
                <BrutalistButton
                  disabled={!isCityQuery(city) || searching}
                  label="FIND COURTS"
                  onPress={() => void handleFindCity()}
                  style={styles.fullButton}
                  variant="outline"
                />
              </View>
            )}

            {locationNotice ? <Text style={styles.locationNotice}>{locationNotice}</Text> : null}

            {searching ? (
              <ActivityIndicator color={Colors.accent} style={styles.searching} />
            ) : searched ? (
              courtOptions.length > 0 ? (
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>COURTS NEAR YOU</Text>
                  <View style={styles.sportList}>
                    {courtOptions.map((court) => (
                      <OptionRow
                        key={court.id}
                        disabled={savingStep2}
                        icon={<SportEmblem sport={court.sport} size={18} />}
                        label={court.name}
                        description={courtPickerDetail(court)}
                        onPress={() => setSelectedCourt(court)}
                        selected={selectedCourt?.id === court.id}
                      />
                    ))}
                  </View>
                </View>
              ) : (
                <Text style={styles.locationNotice}>
                  No courts near you yet. You can add your court after setup.
                </Text>
              )
            ) : null}

            {step2Error ? <ErrorBanner message={step2Error} /> : null}
          </>
        ) : (
          <>
            <Text style={styles.title}>
              GET GAME{"\n"}ALERTS<Text style={styles.titleDot}>.</Text>
            </Text>
            <Text style={styles.subtitle}>
              Know when locals check in at your court, and when someone invites you to play.
              Change it anytime in Settings.
            </Text>
            {finishError ? <ErrorBanner message={finishError} /> : null}
          </>
        )}
      </KeyboardAwareScrollViewCompat>

      <StickyActionBar bottomInset={bottom} primary={primary} />
    </View>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <View style={styles.errorBanner}>
      <LogoMark size={18} />
      <Text style={styles.errorBannerText}>{message}</Text>
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
  fieldHint: {
    fontFamily: Typography.body,
    fontSize: 12,
    color: Colors.muted,
  },
  fieldError: {
    fontFamily: Typography.body,
    fontSize: 12,
    color: Colors.loss,
  },
  sportList: { gap: Space.sm },
  fullButton: { width: "100%", marginTop: Space.md },
  searching: { marginTop: Space.lg },
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
