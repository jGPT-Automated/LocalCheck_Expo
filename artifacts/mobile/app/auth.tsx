import * as AppleAuthentication from "expo-apple-authentication";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
// expo-image, not react-native's Image — required by
// .agents/skills/vercel-react-native-skills/rules/ui-expo-image.md (HIGH).
import { Image } from "expo-image";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LogoMark } from "@/components/brand/LogoMark";
import {
  ARTWORK_HEIGHT_RATIO,
  ARTWORK_TOP_RATIO,
  BRAND_TAGLINE,
  MARK_GAP,
  MARK_SIZE,
} from "@/components/onboarding/brandLockup";
import { OnboardingIntro } from "@/components/onboarding/OnboardingIntro";
import { Colors } from "@/constants/colors";
import { Typography } from "@/constants/typography";
import { useAuth } from "@/context/AuthContext";

// Swap the sign-in artwork by replacing assets/brand/splash-artwork.png —
// same modular contract as the logo (see DESIGN.md §Brand assets). The PNG is
// transparent, so it composites straight onto Colors.background.
const AUTH_GRAPHIC = require("@/assets/brand/splash-artwork.png");

/**
 * The brand intro is a launch moment, not a screen transition. Keeping this
 * flag at module scope means signing out and returning — or any remount of
 * this route — does not replay it. Only a cold start does.
 */
let hasPlayedIntro = false;


/**
 * Dev-only inspection hooks for the brand intro, read from the web preview's
 * query string:
 *
 *   ?intro=1            replay the intro even though it already played
 *   ?intro=1&introSlow=6  run it at one-sixth speed
 *
 * The sequence is shorter than a single automated screenshot round-trip, so
 * without a stretch factor its middle beats cannot be inspected at all.
 *
 * Deliberately gated on web rather than `__DEV__`: the local preview
 * (`script/start_local_preview.sh`) serves a production `expo export`, where
 * `__DEV__` is false, so a dev-only guard would disable this in the one place
 * it is needed. Web is a preview surface for this app — iOS is what ships —
 * and the parameters do nothing without being typed into the URL by hand.
 */
function introDevOverrides(): { replay: boolean; timeScale: number } {
  if (Platform.OS !== "web" || typeof window === "undefined") {
    return { replay: false, timeScale: 1 };
  }
  const params = new URLSearchParams(window.location.search);
  const slow = Number(params.get("introSlow"));
  return {
    replay: params.get("intro") === "1",
    timeScale: Number.isFinite(slow) && slow > 0 ? slow : 1,
  };
}

/**
 * Auth errors surface to real users — never show raw fetch/JSON dumps
 * (a Supabase 522 once printed a full response object on this screen).
 */
function humanizeAuthError(raw: string): string {
  if (!raw) return "SOMETHING WENT WRONG. TRY AGAIN.";
  if (raw.length > 140 || raw.trim().startsWith("{") || raw.includes('"status"')) {
    return "CAN'T REACH LOCALCHECK. CHECK YOUR CONNECTION AND TRY AGAIN.";
  }
  if (/invalid login credentials/i.test(raw)) return "WRONG EMAIL OR PASSWORD.";
  if (/already registered|already exists/i.test(raw)) {
    return "THAT EMAIL ALREADY HAS AN ACCOUNT — SIGN IN INSTEAD.";
  }
  if (/at least 6 characters/i.test(raw)) return "PASSWORD NEEDS AT LEAST 6 CHARACTERS.";
  return raw.toUpperCase();
}

export default function AuthScreen() {
  const router = useRouter();
  const { user, profile, signInWithEmail, signUpWithEmail, signInWithApple, signOut, isLoading } = useAuth();
  const { top, bottom } = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : top;

  const [introOverrides] = useState(introDevOverrides);
  const [introDone, setIntroDone] = useState(
    hasPlayedIntro && !introOverrides.replay
  );
  const finishIntro = useCallback(() => {
    hasPlayedIntro = true;
    setIntroDone(true);
  }, []);

  // Where the intro's lockup must come to rest: the ScrollView's top padding
  // plus the header's own top margin.
  const restingTop = topPad + 20 + 4;

  // The form is laid out at the bottom and stays there. It only rises the last
  // 24pt into place while fading in — it never travels down the screen, which
  // is what a preset like FadeInDown would have done.
  const formOpacity = useSharedValue(0);
  const formRise = useSharedValue(24);
  useEffect(() => {
    if (!introDone) return;
    formOpacity.value = withTiming(1, { duration: 460 });
    formRise.value = withTiming(0, {
      duration: 520,
      easing: Easing.out(Easing.cubic),
    });
  }, [formOpacity, formRise, introDone]);
  const formStyle = useAnimatedStyle(() => ({
    opacity: formOpacity.value,
    transform: [{ translateY: formRise.value }],
  }));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function goHome() {
    router.replace("/(tabs)");
  }

  async function handleSignIn() {
    if (!email || !password) { setErrorMsg("Enter email and password."); return; }
    setBusy(true); setErrorMsg(null);
    const { error } = await signInWithEmail(email.trim(), password);
    setBusy(false);
    if (error) { setErrorMsg(humanizeAuthError(error)); }
    else { goHome(); }
  }

  async function handleSignUp() {
    if (!email || !password) { setErrorMsg("Enter email and password."); return; }
    setBusy(true); setErrorMsg(null);
    const { error, needsEmailConfirmation } = await signUpWithEmail(email.trim(), password);
    setBusy(false);
    if (error) { setErrorMsg(humanizeAuthError(error)); }
    else if (needsEmailConfirmation) {
      Alert.alert("Account created", "Check your email to confirm, then sign in.", [{ text: "OK" }]);
    } else {
      goHome();
    }
  }

  async function handleAppleSignIn() {
    setBusy(true); setErrorMsg(null);
    const { error } = await signInWithApple();
    setBusy(false);
    if (error) { setErrorMsg(humanizeAuthError(error)); }
    else { goHome(); }
  }

  async function handleSignOut() {
    setBusy(true);
    await signOut();
    setBusy(false);
  }

  // The intro paints over everything, including the auth bootstrap spinner, so
  // a slow session restore never shows a bare loader on a cold start.
  const intro = introDone ? null : (
    <OnboardingIntro
      onDone={finishIntro}
      restingTop={restingTop}
      timeScale={introOverrides.timeScale}
    />
  );

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator color={Colors.accent} />
        {intro}
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* Transparent PNG, so this composites onto Colors.background and lands
          exactly where the intro's shader reveal leaves it. */}
      <View style={styles.artwork} pointerEvents="none">
        <Image
          source={AUTH_GRAPHIC}
          style={styles.artworkImage}
          contentFit="contain"
        />
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View
        style={[styles.container, { paddingTop: topPad + 20, paddingBottom: bottom + 20 }]}
      >
        {/* Auth is the app's front door — no back button, nothing to go back to. */}
        <View style={styles.header}>
          <LogoMark size={MARK_SIZE} />
          <Text style={styles.title}>LOCALCHECK</Text>
        </View>

        {/* Everything after this is pushed to the bottom of the screen. */}
        <View style={styles.spacer} />

        {/* Mounted only after the intro hands off, so the sign-in surface
            genuinely arrives rather than being uncovered. */}
        {introDone && (
        <Animated.View style={formStyle}>

        {/* Signed-in state */}
        {user && (
          <View style={styles.statusBanner}>
            <Text style={styles.statusLabel}>SIGNED IN AS</Text>
            <Text style={styles.statusValue}>{user.email}</Text>
            {profile && (
              <Text style={styles.statusValue}>
                {profile.display_name ?? "—"} · {profile.elo_rating} ELO
              </Text>
            )}
            <Pressable
              style={[styles.btn, styles.btnOutline, { marginTop: 12 }]}
              onPress={handleSignOut}
              disabled={busy}
            >
              <Text style={styles.btnTextOutline}>SIGN OUT</Text>
            </Pressable>
          </View>
        )}

        {/* Sign-in / sign-up form */}
        {!user && (
          <>
            {errorMsg && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            )}

            <View style={styles.field}>
              <Text style={styles.label}>EMAIL</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                placeholder="you@example.com"
                placeholderTextColor={Colors.mutedDark}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>PASSWORD</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                placeholder="••••••••"
                placeholderTextColor={Colors.mutedDark}
              />
            </View>

            <Pressable style={[styles.btn, busy && styles.btnDisabled]} onPress={handleSignIn} disabled={busy}>
              {busy ? <ActivityIndicator color={Colors.black} size="small" /> : <Text style={styles.btnText}>SIGN IN</Text>}
            </Pressable>

            <Pressable style={[styles.btn, styles.btnOutline, busy && styles.btnDisabled]} onPress={handleSignUp} disabled={busy}>
              <Text style={styles.btnTextOutline}>CREATE ACCOUNT</Text>
            </Pressable>

            {Platform.OS === "ios" && (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                cornerRadius={0}
                style={styles.appleBtn}
                onPress={handleAppleSignIn}
              />
            )}
          </>
        )}

        </Animated.View>
        )}
      </View>
      </KeyboardAvoidingView>
      {intro}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  // Top band only — see ARTWORK_HEIGHT_RATIO. Full-bleed put the figure behind
  // the form fields.
  artwork: {
    position: "absolute",
    top: `${ARTWORK_TOP_RATIO * 100}%`,
    left: 0,
    right: 0,
    height: `${ARTWORK_HEIGHT_RATIO * 100}%`,
  },
  artworkImage: {
    width: "100%",
    height: "100%",
    // Must match ARTWORK_RESTING_OPACITY in OnboardingIntro, or the handoff
    // from the intro to this screen visibly steps.
    opacity: 0.45,
  },
  container: {
    flexGrow: 1,
    // The background lives on `root` so the artwork stays visible behind the
    // scrolling content.
    backgroundColor: "transparent",
    paddingHorizontal: 24,
  },
  // Top-centre lockup: this is where the intro's mark and wordmark come to
  // rest, so the two must stay aligned.
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  spacer: { flex: 1, minHeight: 24 },
  title: {
    fontFamily: Typography.heading,
    fontSize: 32,
    color: Colors.text,
    letterSpacing: 2,
    lineHeight: 36,
    textAlign: "center",
    marginLeft: MARK_GAP,
  },
  statusBanner: {
    borderWidth: 1,
    borderColor: Colors.accent,
    padding: 16,
    marginBottom: 24,
  },
  statusLabel: {
    fontFamily: Typography.bodyMedium,
    fontSize: 9,
    color: Colors.muted,
    letterSpacing: 3,
    marginBottom: 6,
  },
  statusValue: {
    fontFamily: Typography.heading,
    fontSize: 13,
    color: Colors.text,
    letterSpacing: 1,
    marginBottom: 2,
  },
  errorBox: {
    backgroundColor: "rgba(255,80,80,0.1)",
    borderWidth: 1,
    borderColor: "#FF5050",
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 12,
    color: "#FF5050",
    letterSpacing: 0.5,
  },
  field: { marginBottom: 12 },
  label: {
    fontFamily: Typography.bodyMedium,
    fontSize: 10,
    color: Colors.muted,
    letterSpacing: 3,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    color: Colors.text,
    fontFamily: Typography.body,
    fontSize: 16,
    paddingHorizontal: 14,
    // 48 is the standard iOS text-field height. 16pt text also stops Safari
    // and iOS from zooming the page when a field takes focus.
    height: 48,
  },
  btn: {
    backgroundColor: Colors.accent,
    // 50 is the standard iOS primary-button height, comfortably above the
    // 44pt minimum tap target in Apple's HIG.
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: {
    fontFamily: Typography.heading,
    fontSize: 13,
    color: Colors.black,
    letterSpacing: 2,
  },
  btnOutline: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  btnTextOutline: {
    fontFamily: Typography.heading,
    fontSize: 13,
    color: Colors.text,
    letterSpacing: 2,
  },
  appleBtn: { height: 48, marginBottom: 12 },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 24,
  },
  note: {
    fontFamily: Typography.body,
    fontSize: 11,
    color: Colors.mutedDark,
    letterSpacing: 0.3,
    lineHeight: 18,
  },
});
