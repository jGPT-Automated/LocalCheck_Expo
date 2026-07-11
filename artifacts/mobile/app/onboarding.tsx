import * as Location from "expo-location";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "@/constants/colors";
import { CourtSport, SPORT_ICONS } from "@/constants/data";
import { Typography } from "@/constants/typography";
import { useAuth } from "@/context/AuthContext";
import { updateProfileFields } from "@/services/profileService";

const SPORTS: CourtSport[] = [
  "BASKETBALL",
  "PICKLEBALL",
  "TENNIS",
  "SOCCER",
  "VOLLEYBALL",
];

type Step = "username" | "sport" | "location" | "ready";

export default function OnboardingScreen() {
  const router = useRouter();
  const { bottom, top } = useSafeAreaInsets();
  const { user, profile, refreshProfile } = useAuth();
  const [step, setStep] = useState<Step>("username");
  const [username, setUsername] = useState(
    profile?.username?.replace(/_[a-f0-9]{8}$/i, "") ?? "",
  );
  const [sport, setSport] = useState<CourtSport | null>(
    (profile?.preferred_sport?.toUpperCase() as CourtSport) ?? null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locationLabel, setLocationLabel] = useState("Waiting for permission");

  const progress = useMemo(
    () => ["username", "sport", "location", "ready"].indexOf(step) + 1,
    [step],
  );

  async function saveUsername() {
    const clean = username.trim();
    if (!/^[A-Za-z0-9_]{3,32}$/.test(clean)) {
      setError("Use 3–32 letters, numbers, or underscores.");
      return;
    }
    if (!user) return;
    setBusy(true);
    setError(null);
    await updateProfileFields(user.id, {
      username: clean,
      display_name: clean,
    });
    await refreshProfile();
    setBusy(false);
    setStep("sport");
  }

  async function saveSport(next: CourtSport) {
    if (!user) return;
    setSport(next);
    setBusy(true);
    setError(null);
    await updateProfileFields(user.id, { preferred_sport: next.toLowerCase() });
    await refreshProfile();
    setBusy(false);
    setStep("location");
  }

  async function requestLocation() {
    setBusy(true);
    setError(null);
    setLocationLabel("Opening location prompt");
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      setBusy(false);
      setLocationLabel("Permission skipped");
      setStep("ready");
      return;
    }
    setLocationLabel("Finding nearby courts");
    await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    setBusy(false);
    setLocationLabel("Local map centered");
    setStep("ready");
  }

  function finish() {
    router.replace("/(tabs)");
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View
        style={[
          styles.container,
          { paddingTop: top + 18, paddingBottom: bottom + 28 },
        ]}
      >
        <View style={styles.progressRow}>
          {[1, 2, 3, 4].map((i) => (
            <View
              key={i}
              style={[
                styles.progressDot,
                i <= progress && styles.progressDotActive,
              ]}
            />
          ))}
        </View>
        <CourtConstellation active={step} />

        {step === "username" && (
          <View style={styles.panel}>
            <Text style={styles.kicker}>PLAYER CARD</Text>
            <Text style={styles.title}>Claim your court name.</Text>
            <Text style={styles.copy}>
              This is how players see you in live rosters, game logs, and Elo
              rankings.
            </Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="username"
              placeholderTextColor={Colors.mutedDark}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <PrimaryButton
              label="SAVE NAME"
              onPress={saveUsername}
              busy={busy}
            />
          </View>
        )}

        {step === "sport" && (
          <View style={styles.panel}>
            <Text style={styles.kicker}>HOME SPORT</Text>
            <Text style={styles.title}>What are you checking first?</Text>
            <Text style={styles.copy}>
              We will tune nearby courts, runs, and rankings around this sport.
            </Text>
            <View style={styles.sportGrid}>
              {SPORTS.map((item) => (
                <Pressable
                  key={item}
                  style={[
                    styles.sportPill,
                    sport === item && styles.sportPillActive,
                  ]}
                  onPress={() => saveSport(item)}
                  disabled={busy}
                >
                  <Text style={styles.sportIcon}>{SPORT_ICONS[item]}</Text>
                  <Text style={styles.sportText}>{item}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {step === "location" && (
          <View style={styles.panel}>
            <Text style={styles.kicker}>LOCAL MAP</Text>
            <Text style={styles.title}>See who is at your court.</Text>
            <Text style={styles.copy}>
              Share location to zoom the map into nearby courts, live check-ins,
              and pickup runs.
            </Text>
            <View style={styles.mapPreview}>
              <View style={styles.zoomRing} />
              <Text style={styles.mapPin}>⌖</Text>
              <Text style={styles.mapLabel}>{locationLabel}</Text>
            </View>
            <PrimaryButton
              label="SHARE LOCATION"
              onPress={requestLocation}
              busy={busy}
            />
            <Pressable onPress={() => setStep("ready")}>
              <Text style={styles.skip}>SKIP FOR NOW</Text>
            </Pressable>
          </View>
        )}

        {step === "ready" && (
          <View style={styles.panel}>
            <Text style={styles.kicker}>READY</Text>
            <Text style={styles.title}>Your local run starts here.</Text>
            <Text style={styles.copy}>
              Open the map to find nearby courts, check in, log games, and climb
              the board.
            </Text>
            <View style={styles.readyCard}>
              <Text style={styles.readyStat}>1200</Text>
              <Text style={styles.readyLabel}>
                STARTING ELO · {sport ?? "ALL SPORTS"}
              </Text>
            </View>
            <PrimaryButton label="SHOW MY MAP" onPress={finish} busy={busy} />
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

function PrimaryButton({
  label,
  onPress,
  busy,
}: {
  label: string;
  onPress: () => void;
  busy: boolean;
}) {
  return (
    <Pressable
      style={[styles.button, busy && styles.buttonDisabled]}
      onPress={onPress}
      disabled={busy}
    >
      {busy ? (
        <ActivityIndicator color={Colors.black} />
      ) : (
        <Text style={styles.buttonText}>{label}</Text>
      )}
    </Pressable>
  );
}

function CourtConstellation({ active }: { active: Step }) {
  const dots = Array.from({ length: 18 });
  return (
    <View style={styles.hero}>
      <Text style={styles.logo}>LC</Text>
      <View style={styles.court}>
        <View style={styles.courtLine} />
        <View style={styles.courtCircle} />
        {dots.map((_, i) => (
          <View
            key={i}
            style={[
              styles.playerDot,
              {
                transform: [
                  { rotate: `${i * 20}deg` },
                  { translateY: i % 3 === 0 ? -68 : -46 },
                ],
              },
            ]}
          />
        ))}
        <Text style={styles.heroGlyph}>
          {active === "location" ? "⌖" : active === "ready" ? "↗" : "●"}
        </Text>
      </View>
      <View style={styles.scoreChip}>
        <Text style={styles.scoreText}>LIVE 8 · GAMES 3 · ELO +24</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  container: {
    flex: 1,
    paddingHorizontal: 22,
    justifyContent: "space-between",
  },
  progressRow: { flexDirection: "row", gap: 8, alignSelf: "center" },
  progressDot: { width: 28, height: 3, backgroundColor: Colors.border },
  progressDotActive: { backgroundColor: Colors.accent },
  hero: { height: 278, justifyContent: "center", alignItems: "center" },
  logo: {
    position: "absolute",
    top: 22,
    left: 2,
    fontFamily: Typography.heading,
    fontSize: 26,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.text,
    paddingHorizontal: 10,
  },
  court: {
    width: 210,
    height: 210,
    borderRadius: 105,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,85,0,0.08)",
  },
  courtLine: {
    position: "absolute",
    width: 148,
    height: 148,
    borderRadius: 74,
    borderWidth: 1,
    borderColor: Colors.accentGlow,
  },
  courtCircle: {
    position: "absolute",
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  playerDot: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.win,
  },
  heroGlyph: {
    fontFamily: Typography.heading,
    fontSize: 58,
    color: Colors.accent,
  },
  scoreChip: {
    position: "absolute",
    bottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  scoreText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 10,
    color: Colors.text,
    letterSpacing: 1.4,
  },
  panel: { gap: 14 },
  kicker: {
    fontFamily: Typography.bodyMedium,
    fontSize: 10,
    letterSpacing: 3,
    color: Colors.accent,
  },
  title: {
    fontFamily: Typography.heading,
    fontSize: 44,
    lineHeight: 48,
    color: Colors.text,
    letterSpacing: -0.5,
  },
  copy: {
    fontFamily: Typography.body,
    fontSize: 14,
    lineHeight: 21,
    color: Colors.textSecondary,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    color: Colors.text,
    fontFamily: Typography.heading,
    fontSize: 24,
    padding: 16,
    letterSpacing: 1,
  },
  error: {
    fontFamily: Typography.bodyMedium,
    color: Colors.loss,
    fontSize: 12,
  },
  button: {
    minHeight: 52,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },
  buttonDisabled: { opacity: 0.65 },
  buttonText: {
    fontFamily: Typography.heading,
    color: Colors.black,
    fontSize: 14,
    letterSpacing: 2,
  },
  sportGrid: { gap: 10 },
  sportPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    padding: 14,
  },
  sportPillActive: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentDim,
  },
  sportIcon: { fontSize: 20 },
  sportText: {
    fontFamily: Typography.heading,
    fontSize: 15,
    color: Colors.text,
    letterSpacing: 1.2,
  },
  mapPreview: {
    height: 128,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  zoomRing: {
    position: "absolute",
    width: 190,
    height: 190,
    borderRadius: 95,
    borderWidth: 1,
    borderColor: Colors.accentGlow,
  },
  mapPin: {
    fontFamily: Typography.heading,
    fontSize: 44,
    color: Colors.accent,
  },
  mapLabel: {
    fontFamily: Typography.bodyMedium,
    fontSize: 11,
    letterSpacing: 2,
    color: Colors.textSecondary,
  },
  skip: {
    textAlign: "center",
    color: Colors.muted,
    fontFamily: Typography.bodyMedium,
    fontSize: 11,
    letterSpacing: 2,
    padding: 10,
  },
  readyCard: {
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 18,
    backgroundColor: Colors.surface,
  },
  readyStat: {
    fontFamily: Typography.heading,
    fontSize: 52,
    color: Colors.text,
    lineHeight: 58,
  },
  readyLabel: {
    fontFamily: Typography.bodyMedium,
    fontSize: 11,
    color: Colors.muted,
    letterSpacing: 2,
  },
});
