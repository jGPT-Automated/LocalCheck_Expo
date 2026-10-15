import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BrutalistButton } from "@/components/BrutalistButton";
import { LogoLockup, LogoMark } from "@/components/brand/LogoMark";
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
  cleanUsername,
  courtPickerDetail,
  farCourtNote,
  inviteErrorMessage,
  isCityQuery,
  isValidUsername,
  normalizeInviter,
  USERNAME_MAX,
} from "@/lib/onboardingModel";
import { coordinateForPlace } from "@/lib/placeLocation";
import { fetchClosestCourts } from "@/services/courtService";
import { useAutoCheckIn } from "@/context/AutoCheckInContext";
import { CourtPickerMap } from "@/components/onboarding/CourtPickerMap";
import { GeofenceVisual } from "@/components/autoCheckIn/GeofenceVisual";
import type { LatLng } from "@/lib/courtPickerMapModel";
import { AUTO_CHECK_IN_RADIUS_M } from "@/lib/autoCheckInModel";
import { redeemInviter, updateProfileFields } from "@/services/profileService";

const SPORT_ROWS: { value: CourtSport; label: string }[] = [
  { value: "BASKETBALL", label: "Basketball" },
  { value: "PICKLEBALL", label: "Pickleball" },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { top, bottom } = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { profile, updateUsername, refreshProfile } = useAuth();
  const { setPreferredSport, setLocalCourt } = useApp();
  const { enablePush } = useNotifications();
  const {
    refresh: refreshLocation,
    suppressNextAutoResolve,
  } = useDeviceLocation();

  // 0 is the welcome; 1 name + sport; 2 court; 3 auto check-in; 4 alerts.
  const [step, setStep] = React.useState<0 | 1 | 2 | 3 | 4>(0);
  const autoCheckIn = useAutoCheckIn();
  const [autoBusy, setAutoBusy] = React.useState(false);
  const [youCoord, setYouCoord] = React.useState<LatLng | null>(null);

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
  // What the current court list is measured from: the typed city, or null for
  // the device location.
  const [searchedPlace, setSearchedPlace] = React.useState<string | null>(null);
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
    if (!username && profile?.username) setUsername(cleanUsername(profile.username));
  }, [profile?.username, username]);

  const usernameValid = isValidUsername(username.trim());
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
    const courts = await fetchClosestCourts(lat, lng, sport, 8);
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
    // Drop the previous list now: if this lookup fails, the old origin's
    // courts must not stay on screen under a failure notice.
    setCourtOptions([]);
    setSearched(false);
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
    setSearchedPlace(null);
    setYouCoord(coord);
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
    setSearchedPlace(city);
    setYouCoord(null);
    setCityMode(false);
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
    // Auto check-in watches the local court, so it only comes up with one.
    setStep(selectedCourt ? 3 : 4);
  }

  async function handleAutoCheckIn() {
    if (autoBusy) return;
    if (autoCheckIn.state !== "unavailable") {
      setAutoBusy(true);
      await autoCheckIn.turnOn();
      setAutoBusy(false);
    }
    setStep(4);
  }

  async function handleFinish(withAlerts: boolean) {
    if (finishing || !profile) return;
    setFinishing(true);
    setFinishError(null);
    // iOS shows its own Allow / Don't Allow; either answer continues.
    if (withAlerts) await enablePush();
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
    if (step === 4) setStep(selectedCourt ? 3 : 2);
    else if (step === 3) setStep(2);
    else if (step === 2) setStep(1);
    else if (step === 1) setStep(0);
  }

  const farNote = farCourtNote(courtOptions, searchedPlace);
  const hasCourtStep = Boolean(selectedCourt);
  const totalSteps = hasCourtStep ? 4 : 3;
  const shownStep = step === 4 ? totalSteps : step;
  const courtName = selectedCourt ? selectedCourt.shortName || selectedCourt.name : "your court";
  // Small phones list two rows so the map keeps its room.
  const nearest = courtOptions.slice(0, windowHeight < 760 ? 2 : 3);

  const primary =
    step === 0
      ? { label: "Get started", onPress: () => setStep(1) }
      : step === 1
        ? {
            label: savingStep1 ? "Saving…" : step1Error ? "Retry" : "Continue",
            onPress: () => void handleContinueStep1(),
            disabled: !step1Ready || savingStep1,
          }
        : step === 2
          ? {
              label: savingStep2
                ? "Saving…"
                : step2Error
                  ? "Retry"
                  : selectedCourt
                    ? `Make ${courtName} my court`
                    : searched && courtOptions.length === 0
                      ? "Continue without a court"
                      : "Pick a court to continue",
              onPress: () => void handleContinueStep2(),
              disabled: !step2Ready || savingStep2,
            }
          : step === 3
            ? {
                label: autoBusy ? "Turning on…" : autoCheckIn.state === "unavailable" ? "Continue" : "Turn on auto check-in",
                onPress: () => void handleAutoCheckIn(),
                disabled: autoBusy,
              }
            : {
                label: finishing ? "Finishing…" : finishError ? "Retry" : "Turn on alerts",
                onPress: () => void handleFinish(true),
                disabled: finishing,
              };
  const secondary =
    step === 3 && autoCheckIn.state !== "unavailable"
      ? { label: "Not now", onPress: () => setStep(4), disabled: autoBusy }
      : step === 4
        ? { label: "Not now", onPress: () => void handleFinish(false), disabled: finishing }
        : undefined;

  const header =
    step === 0 ? null : (
      <View style={[styles.header, { paddingTop: top + Space.md }]}>
        <Pressable
          accessibilityHint="Back to the previous step"
          accessibilityLabel="Back"
          accessibilityRole="button"
          onPress={goBack}
          style={({ pressed }) => [styles.backAction, pressed && styles.pressed]}
        >
          <LogoMark size={24} variant="back" />
        </Pressable>
        <View style={styles.progressRow}>
          {Array.from({ length: totalSteps }, (_, i) => (
            <View key={i} style={[styles.progressSegment, i < shownStep && styles.progressFilled]} />
          ))}
        </View>
      </View>
    );

  return (
    <View style={styles.screen}>
      {header}

      {step === 0 ? (
        <View style={[styles.welcome, { paddingTop: top + Space.xxl }]}>
          <LogoLockup width={176} />
          <View style={styles.welcomeCopy}>
            <Text style={styles.title}>
              Know who's{"\n"}running<Text style={styles.titleDot}>.</Text>
            </Text>
            <Text style={styles.subtitle}>
              LocalCheck is your court, live: who's on now, who's coming this week, and where you rank.
            </Text>
          </View>
          <View style={styles.howList}>
            <HowRow
              body="Tap in at the court, or let it happen when you walk up. Locals see who's on now."
              icon="map-pin"
              title="Check in"
            />
            <HowRow
              body="Tap the hours you'll play this week. Everyone sees when your court gets busy."
              icon="calendar"
              title="Plan the week"
            />
            <HowRow
              body="Log the score after you play. Wins move you up your court's ranking."
              icon="award"
              title="Log games, rank up"
            />
          </View>
        </View>
      ) : null}

      {step === 1 ? (
        <KeyboardAwareScrollViewCompat
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <StepTitle line1="Claim your" line2="name" step={shownStep} total={totalSteps} />
          <Text style={styles.subtitle}>This is how locals will know you.</Text>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Username</Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              editable={!savingStep1}
              maxLength={USERNAME_MAX}
              onChangeText={(text) => {
                setUsername(cleanUsername(text));
                setUsernameError(null);
              }}
              placeholder="username"
              placeholderTextColor={Colors.mutedDark}
              style={[styles.input, savingStep1 && styles.inputDisabled]}
              value={username}
            />
            {usernameError ? (
              <Text style={styles.fieldError}>{usernameError}</Text>
            ) : (
              <Text style={styles.fieldHint}>3 to 10 letters or numbers. First name + last initial works well.</Text>
            )}
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Your sport</Text>
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
            <Text style={styles.fieldHint}>Courts, games and rankings follow your sport. Change it anytime in Settings.</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Invite code (optional)</Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              editable={!savingStep1 && !inviterSaved}
              maxLength={32}
              onChangeText={(text) => {
                setInviter(normalizeInviter(text));
                setInviterError(null);
              }}
              placeholder="friend's code or username"
              placeholderTextColor={Colors.mutedDark}
              style={[styles.input, (savingStep1 || inviterSaved) && styles.inputDisabled]}
              value={inviter}
            />
            {inviterError ? <Text style={styles.fieldError}>{inviterError}</Text> : null}
          </View>

          {step1Error ? <ErrorBanner message={step1Error} /> : null}
        </KeyboardAwareScrollViewCompat>
      ) : null}

      {step === 2 ? (
        <View style={styles.fixedStep}>
          <StepTitle line1="Pick your" line2="court" step={shownStep} total={totalSteps} />
          <Text style={styles.subtitleTight}>Your local court is home: it's always free to see who's there and who's coming.</Text>

          <CourtPickerMap
            courts={courtOptions}
            onSelect={setSelectedCourt}
            selectedId={selectedCourt?.id ?? null}
            you={youCoord}
          >
            {cityMode ? (
              <View style={styles.cityBar}>
                <TextInput
                  autoCapitalize="words"
                  autoCorrect={false}
                  autoFocus
                  onChangeText={setCity}
                  onSubmitEditing={() => void handleFindCity()}
                  placeholder="City, State"
                  placeholderTextColor={Colors.mutedDark}
                  returnKeyType="search"
                  style={styles.cityInput}
                  value={city}
                />
                <Pressable
                  accessibilityRole="button"
                  disabled={!isCityQuery(city) || searching}
                  onPress={() => void handleFindCity()}
                  style={({ pressed }) => [styles.cityGo, (!isCityQuery(city) || searching) && styles.disabled, pressed && styles.pressed]}
                >
                  <Feather color={Colors.background} name="search" size={16} />
                </Pressable>
              </View>
            ) : null}
            {!searched && !searching && !cityMode ? (
              <View style={styles.askCard}>
                <Text style={styles.askTitle}>Find courts near you</Text>
                <Text style={styles.askBody}>
                  We use your location once to find nearby courts. It isn't shared with other players.
                </Text>
                <BrutalistButton
                  icon={<Feather color={Colors.background} name="navigation" size={14} />}
                  label="Use my location"
                  loading={locating}
                  onPress={() => void handleUseLocation()}
                  style={styles.fullButton}
                  variant="primary"
                />
                <Pressable
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={() => setCityMode(true)}
                  style={({ pressed }) => [styles.cityLink, pressed && styles.pressed]}
                >
                  <Text style={styles.cityLinkText}>Search by city instead</Text>
                </Pressable>
              </View>
            ) : null}
            {searching ? (
              <View style={styles.mapCenter} pointerEvents="none">
                <ActivityIndicator color={Colors.text} />
              </View>
            ) : null}
            {searched && !cityMode ? (
              <View style={styles.mapTools}>
                <Pressable
                  accessibilityLabel="Use my location"
                  accessibilityRole="button"
                  onPress={() => void handleUseLocation()}
                  style={({ pressed }) => [styles.mapTool, pressed && styles.pressed]}
                >
                  <Feather color={Colors.text} name="navigation" size={15} />
                </Pressable>
                <Pressable
                  accessibilityLabel="Search by city"
                  accessibilityRole="button"
                  onPress={() => setCityMode(true)}
                  style={({ pressed }) => [styles.mapTool, pressed && styles.pressed]}
                >
                  <Feather color={Colors.text} name="search" size={15} />
                </Pressable>
              </View>
            ) : null}
          </CourtPickerMap>

          {locationNotice ? <Text style={styles.locationNotice}>{locationNotice}</Text> : null}
          {searched ? (
            courtOptions.length > 0 ? (
              <View style={styles.pickList}>
                <Text style={styles.fieldLabel}>{farNote ?? "Closest courts · tap a pin or a row"}</Text>
                {nearest.map((court) => (
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
                {selectedCourt && !nearest.some((court) => court.id === selectedCourt.id) ? (
                  <OptionRow
                    description={courtPickerDetail(selectedCourt)}
                    icon={<SportEmblem sport={selectedCourt.sport} size={18} />}
                    label={selectedCourt.name}
                    onPress={() => undefined}
                    selected
                  />
                ) : null}
              </View>
            ) : (
              <Text style={styles.locationNotice}>No courts here yet. You can add yours from Explore after setup.</Text>
            )
          ) : null}
          {step2Error ? <ErrorBanner message={step2Error} /> : null}
        </View>
      ) : null}

      {step === 3 ? (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} style={styles.scroll}>
          <StepTitle line1="Check in" line2="hands-free" step={shownStep} total={totalSteps} />
          <Text style={styles.subtitle}>
            Walk onto {courtName} and you're checked in. Walk off and you're checked out. No app to open.
          </Text>
          <GeofenceVisual courtName={courtName} />
          <View style={styles.howList}>
            <HowRow body={`You get a notice each time, with Hide if you'd rather not show.`} icon="bell" title="You stay in control" />
            <HowRow
              body={`iPhone watches the ${AUTO_CHECK_IN_RADIUS_M} m circle for us. LocalCheck only hears when you cross it, never where you are otherwise.`}
              icon="lock"
              title="Only this circle"
            />
            <HowRow body="Turn it off anytime in Settings." icon="toggle-right" title="Your choice" />
          </View>
          <View style={styles.permissionNote}>
            <Feather color={Colors.textSecondary} name="info" size={14} />
            <Text style={styles.permissionText}>
              {autoCheckIn.state === "unavailable"
                ? "Auto check-in works in the App Store app. You can turn it on later in Settings."
                : "iPhone asks for location next. Choose Allow While Using, then Change to Always Allow when it asks, so it works with your phone in your pocket."}
            </Text>
          </View>
        </ScrollView>
      ) : null}

      {step === 4 ? (
        <View style={[styles.fixedStep, styles.alertsStep]}>
          <StepTitle line1="Get game" line2="alerts" step={shownStep} total={totalSteps} />
          <Text style={styles.subtitle}>Only what matters at your court. Change it anytime in Settings.</Text>
          <View style={styles.howList}>
            <HowRow body="When friends check in at your court." icon="map-pin" title="Friends on court" />
            <HowRow body="When someone invites or challenges you." icon="zap" title="Games and challenges" />
            <HowRow body="When a score you played in needs a look." icon="check-square" title="Score reviews" />
          </View>
          {finishError ? <ErrorBanner message={finishError} /> : null}
        </View>
      ) : null}

      <StickyActionBar bottomInset={bottom} primary={primary} secondary={secondary} />
    </View>
  );
}

function StepTitle({ line1, line2, step, total }: { line1: string; line2: string; step: number; total: number }) {
  return (
    <View style={styles.stepTitle}>
      <Text style={styles.eyebrow}>Step {step} of {total}</Text>
      <Text style={styles.title}>
        {line1}
        {"\n"}
        {line2}
        <Text style={styles.titleDot}>.</Text>
      </Text>
    </View>
  );
}

function HowRow({
  icon,
  title,
  body,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  title: string;
  body: string;
}) {
  return (
    <View style={styles.howRow}>
      <View style={styles.howIcon}>
        <Feather color={Colors.text} name={icon} size={16} />
      </View>
      <View style={styles.howCopy}>
        <Text style={styles.howTitle}>{title}</Text>
        <Text style={styles.howBody}>{body}</Text>
      </View>
    </View>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <View style={styles.errorBanner}>
      <Feather color={Colors.loss} name="alert-circle" size={16} />
      <Text style={styles.errorBannerText}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  content: { paddingHorizontal: Layout.screenGutter, paddingTop: Space.sm, paddingBottom: Space.xl, gap: Space.lg },
  fixedStep: { flex: 1, minHeight: 0, paddingHorizontal: Layout.screenGutter, paddingTop: Space.sm, paddingBottom: Space.md, gap: Space.md },
  alertsStep: { gap: Space.lg },
  header: { flexDirection: "row", alignItems: "center", gap: Space.lg, paddingHorizontal: Layout.screenGutter },
  pressed: { opacity: 0.68 },
  disabled: { opacity: 0.4 },
  backAction: {
    width: Layout.minTouchTarget,
    height: Layout.minTouchTarget,
    marginLeft: -10,
    alignItems: "center",
    justifyContent: "center",
  },
  progressRow: { flex: 1, flexDirection: "row", gap: Space.sm },
  progressSegment: { flex: 1, height: 3, borderRadius: 2, backgroundColor: Colors.surfaceHigh },
  progressFilled: { backgroundColor: Colors.accent },

  welcome: { flex: 1, paddingHorizontal: Layout.screenGutter, gap: Space.xxl },
  welcomeCopy: { gap: Space.md },

  stepTitle: { gap: Space.sm },
  eyebrow: { fontFamily: Typography.bodyBold, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: Colors.textSecondary },
  title: {
    fontFamily: Typography.headingBold,
    fontSize: 38,
    lineHeight: 40,
    letterSpacing: -1.2,
    textTransform: "uppercase",
    color: Colors.text,
  },
  titleDot: { color: Colors.accent },
  subtitle: { fontFamily: Typography.bodyMedium, fontSize: 14, lineHeight: 20, color: Colors.textSecondary },
  subtitleTight: { fontFamily: Typography.bodyMedium, fontSize: 13, lineHeight: 18, color: Colors.textSecondary },

  howList: { gap: Space.lg },
  howRow: { flexDirection: "row", alignItems: "flex-start", gap: Space.md },
  howIcon: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.chip,
    borderWidth: 1,
    borderColor: Colors.hairlineCard,
    backgroundColor: Colors.panel,
  },
  howCopy: { flex: 1, minWidth: 0, gap: 3 },
  howTitle: { fontFamily: Typography.bodyBold, fontSize: 10.5, letterSpacing: 1.3, textTransform: "uppercase", color: Colors.text },
  howBody: { fontFamily: Typography.bodyMedium, fontSize: 13, lineHeight: 18, color: Colors.textSecondary },

  field: { gap: Space.sm },
  fieldLabel: { fontFamily: Typography.bodyBold, fontSize: 9, letterSpacing: 1.3, textTransform: "uppercase", color: Colors.textSecondary },
  input: {
    borderWidth: 1,
    borderColor: Colors.hairlineCard,
    backgroundColor: Colors.panel,
    color: Colors.text,
    fontFamily: Typography.bodyMedium,
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: Radius.chip,
  },
  inputDisabled: { opacity: 0.5 },
  fieldHint: { fontFamily: Typography.bodyMedium, fontSize: 12, lineHeight: 17, color: Colors.muted },
  fieldError: { fontFamily: Typography.bodyMedium, fontSize: 12, color: Colors.loss },
  sportList: { gap: Space.sm },
  fullButton: { alignSelf: "stretch" },

  askCard: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 14,
    padding: Space.lg,
    gap: Space.sm,
    borderRadius: Radius.row,
    borderWidth: 1,
    borderColor: "rgba(242,242,246,0.13)",
    backgroundColor: "rgba(19,19,23,0.94)",
  },
  askTitle: { fontFamily: Typography.headingSemiBold, fontSize: 20, lineHeight: 22, textTransform: "uppercase", color: Colors.text },
  askBody: { fontFamily: Typography.bodyMedium, fontSize: 12.5, lineHeight: 18, color: Colors.textSecondary, marginBottom: Space.xs },
  cityLink: { alignSelf: "center", minHeight: 36, justifyContent: "center", paddingHorizontal: Space.md },
  cityLinkText: { fontFamily: Typography.bodySemiBold, fontSize: 12, color: Colors.textSecondary, textDecorationLine: "underline" },
  cityBar: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    flexDirection: "row",
    gap: Space.sm,
  },
  cityInput: {
    flex: 1,
    height: 46,
    paddingHorizontal: 14,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: "rgba(242,242,246,0.13)",
    backgroundColor: "rgba(19,19,23,0.94)",
    color: Colors.text,
    fontFamily: Typography.bodyMedium,
    fontSize: 15,
  },
  cityGo: { width: 46, height: 46, alignItems: "center", justifyContent: "center", borderRadius: Radius.lg, backgroundColor: Colors.text },
  mapCenter: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  mapTools: { position: "absolute", top: 12, right: 12, gap: Space.sm },
  mapTool: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(242,242,246,0.13)",
    backgroundColor: "rgba(19,19,23,0.92)",
  },
  pickList: { gap: Space.sm },
  locationNotice: { fontFamily: Typography.bodyMedium, fontSize: 12, lineHeight: 17, color: Colors.textSecondary },

  permissionNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Space.sm,
    padding: Space.md,
    borderRadius: Radius.row,
    borderWidth: 1,
    borderColor: Colors.hairlineCard,
    backgroundColor: Colors.panel,
  },
  permissionText: { flex: 1, fontFamily: Typography.bodyMedium, fontSize: 12, lineHeight: 17, color: Colors.textSecondary },

  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.sm,
    padding: Space.md,
    borderWidth: 1,
    borderColor: Colors.loss,
    borderRadius: Radius.row,
    backgroundColor: Colors.lossDim,
  },
  errorBannerText: { flex: 1, fontFamily: Typography.bodyMedium, fontSize: 12, lineHeight: 16, color: Colors.text },
});
