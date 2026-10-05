import * as AppleAuthentication from "expo-apple-authentication";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LogoLockup, LogoMark } from "@/components/brand/LogoMark";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { LaunchTransition } from "@/components/onboarding/LaunchTransition";
import { Colors } from "@/constants/colors";
import { Typography } from "@/constants/typography";
import { useAuth } from "@/context/AuthContext";
import {
  RESET_CODE_LENGTH,
  humanizeResetError,
  normalizeEmail,
  normalizeResetCode,
  resetCodeError,
  resetEmailError,
} from "@/lib/passwordReset";

// Swap the sign-in artwork by replacing assets/brand/auth-graphic.png —
// same modular contract as the logo (see DESIGN.md §Brand assets).
const AUTH_GRAPHIC = require("@/assets/brand/splash-artwork.png");

/**
 * Auth errors surface to real users — never show raw fetch/JSON dumps
 * (a Supabase 522 once printed a full response object on this screen).
 */
function humanizeAuthError(raw: string): string {
  if (!raw) return "Something went wrong. Try again.";
  if (raw.length > 140 || raw.trim().startsWith("{") || raw.includes('"status"')) {
    return "Can't reach LocalCheck. Check your connection and try again.";
  }
  if (/failed to fetch|network request failed|fetch failed/i.test(raw)) {
    return "Can't reach LocalCheck. Check your connection and try again.";
  }
  if (/invalid login credentials/i.test(raw)) return "Wrong email or password.";
  if (/already registered|already exists/i.test(raw)) {
    return "That email already has an account — sign in instead.";
  }
  if (/at least 6 characters/i.test(raw)) return "Password needs at least 6 characters.";
  return raw;
}

export default function AuthScreen() {
  const router = useRouter();
  const {
    user,
    profile,
    signInWithEmail,
    signUpWithEmail,
    signInWithApple,
    signOut,
    requestPasswordReset,
    resetPasswordWithCode,
    isLoading,
  } = useAuth();
  const { top, bottom } = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : top;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // The LaunchTransition overlay only mounts once a sign-in/sign-up actually
  // succeeds — it's the "you're in" moment, never a pre-form ceremony. `busy`
  // doubles as its `loading` prop: the corner sweep runs for exactly as long
  // as the real request is in flight, then resolves once busy flips false.
  const [showTransition, setShowTransition] = useState(false);
  // Forgot password lives in this same panel: request a code, then enter the
  // code with a new password. Verifying the code signs the user in, so both
  // happen in one submit — AuthGate leaves /auth as soon as a session exists.
  const [mode, setMode] = useState<"signIn" | "resetRequest" | "resetVerify">("signIn");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  function openReset() {
    setErrorMsg(null);
    setNotice(null);
    setResetCode("");
    setNewPassword("");
    setMode("resetRequest");
  }

  function backToSignIn() {
    setErrorMsg(null);
    setNotice(null);
    setMode("signIn");
  }

  function goHome() {
    router.replace("/(tabs)");
  }

  async function handleSignIn() {
    if (!email || !password) { setErrorMsg("Enter email and password."); return; }
    setBusy(true); setErrorMsg(null); setShowTransition(true);
    const { error } = await signInWithEmail(email.trim(), password);
    if (error) { setBusy(false); setShowTransition(false); setErrorMsg(humanizeAuthError(error)); }
    else { setBusy(false); }
  }

  async function handleSignUp() {
    if (!email || !password) { setErrorMsg("Enter email and password."); return; }
    setBusy(true); setErrorMsg(null); setShowTransition(true);
    const { error, needsEmailConfirmation } = await signUpWithEmail(email.trim(), password);
    if (error) {
      setBusy(false); setShowTransition(false); setErrorMsg(humanizeAuthError(error));
    } else if (needsEmailConfirmation) {
      setBusy(false); setShowTransition(false);
      Alert.alert("Account created", "Check your email to confirm, then sign in.", [{ text: "OK" }]);
    } else {
      setBusy(false);
    }
  }

  async function handleAppleSignIn() {
    setBusy(true); setErrorMsg(null); setShowTransition(true);
    const { error } = await signInWithApple();
    if (error) { setBusy(false); setShowTransition(false); setErrorMsg(humanizeAuthError(error)); }
    else { setBusy(false); }
  }

  async function handleSendResetCode() {
    const invalid = resetEmailError(email);
    if (invalid) { setErrorMsg(invalid); return; }
    const address = normalizeEmail(email);
    setBusy(true); setErrorMsg(null);
    const { error } = await requestPasswordReset(address);
    setBusy(false);
    if (error) { setErrorMsg(humanizeResetError(error)); return; }
    setEmail(address);
    setNotice(`If ${address} has a LocalCheck account, a ${RESET_CODE_LENGTH}-digit code is on its way. It expires in 1 hour.`);
    setMode("resetVerify");
  }

  async function handleResetPassword() {
    const invalid = resetCodeError(resetCode, newPassword);
    if (invalid) { setErrorMsg(invalid); return; }
    setBusy(true); setErrorMsg(null); setShowTransition(true);
    const { error, signedIn } = await resetPasswordWithCode(
      normalizeEmail(email),
      normalizeResetCode(resetCode),
      newPassword,
    );
    setBusy(false);
    if (!error) return; // LaunchTransition → home, same as a normal sign-in
    if (signedIn) {
      // The code worked, so they're in; only the new password didn't save.
      // An Alert survives the redirect AuthGate makes now that a session exists.
      Alert.alert(
        "You're signed in",
        `Your new password wasn't saved (${humanizeResetError(error)}). Change it in Settings, under Password.`,
      );
      return;
    }
    setShowTransition(false);
    setErrorMsg(humanizeResetError(error));
  }

  async function handleSignOut() {
    setBusy(true);
    await signOut();
    setBusy(false);
  }

  // LaunchTransition renders once, at a single stable position in this tree,
  // regardless of what else is happening — no separate early-return branch
  // for it, so nothing can unmount/remount it mid-animation. It only mounts
  // after a real sign-in/sign-up/Apple submit (showTransition), never as a
  // pre-form ceremony, and it's the only thing "loading" ever looks like on
  // this screen — no bare spinner anywhere.
  return (
    <View style={styles.root}>
      {isLoading ? (
        <View style={styles.loadingCenter}>
          <LogoMark size={88} />
        </View>
      ) : (
        <>
          <View style={styles.backgroundArtwork}>
            <Image
              accessibilityLabel="An abstract basketball player rising toward the rim"
              resizeMode="contain"
              source={AUTH_GRAPHIC}
              style={styles.backgroundArtworkImage}
            />
          </View>
          <KeyboardAwareScrollViewCompat
            style={styles.container}
            contentContainerStyle={styles.content}
            bounces={false}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={[styles.hero, { paddingTop: topPad + 12 }]}>
              <View style={styles.brandRow}>
                <LogoLockup width={184} />
              </View>
              <View style={styles.heroCopy}>
                <Text style={styles.title}>{user ? "WELCOME BACK" : "KNOW BEFORE YOU GO."}</Text>
                <Text style={styles.subtitle}>
                  {user ? "YOUR LOCAL GAME IS WAITING." : "SEE WHO'S PLAYING. SHOW UP READY."}
                </Text>
              </View>
            </View>

            <View style={[styles.formPanel, { paddingBottom: Math.max(bottom, 20) }]}>

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

              {!user && (errorMsg || notice) && (
                <View style={errorMsg ? styles.errorBox : styles.noticeBox}>
                  <Text style={errorMsg ? styles.errorText : styles.noticeText}>{errorMsg ?? notice}</Text>
                </View>
              )}

              {!user && mode === "signIn" && (
                <>
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

                  <Pressable
                    accessibilityRole="button"
                    hitSlop={8}
                    onPress={openReset}
                    style={styles.linkRow}
                  >
                    <Text style={styles.linkText}>FORGOT PASSWORD?</Text>
                  </Pressable>

                  <View style={styles.actions}>
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
                  </View>
                </>
              )}

              {!user && mode === "resetRequest" && (
                <>
                  <Text style={styles.resetTitle}>RESET YOUR PASSWORD</Text>
                  <Text style={styles.resetBody}>
                    Enter your account email. We'll send a {RESET_CODE_LENGTH}-digit code.
                  </Text>
                  <View style={styles.field}>
                    <Text style={styles.label}>EMAIL</Text>
                    <TextInput
                      style={styles.input}
                      value={email}
                      onChangeText={setEmail}
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoComplete="email"
                      keyboardType="email-address"
                      textContentType="emailAddress"
                      placeholder="you@example.com"
                      placeholderTextColor={Colors.mutedDark}
                    />
                  </View>
                  <View style={styles.actions}>
                    <Pressable
                      style={[styles.btn, busy && styles.btnDisabled]}
                      onPress={handleSendResetCode}
                      disabled={busy}
                    >
                      {busy ? <ActivityIndicator color={Colors.black} size="small" /> : <Text style={styles.btnText}>SEND CODE</Text>}
                    </Pressable>
                    <Pressable style={[styles.btn, styles.btnOutline]} onPress={backToSignIn} disabled={busy}>
                      <Text style={styles.btnTextOutline}>BACK TO SIGN IN</Text>
                    </Pressable>
                  </View>
                </>
              )}

              {!user && mode === "resetVerify" && (
                <>
                  <Text style={styles.resetTitle}>ENTER YOUR CODE</Text>
                  <View style={styles.field}>
                    <Text style={styles.label}>{RESET_CODE_LENGTH}-DIGIT CODE</Text>
                    <TextInput
                      style={[styles.input, styles.codeInput]}
                      value={resetCode}
                      onChangeText={(value) => setResetCode(normalizeResetCode(value))}
                      keyboardType="number-pad"
                      textContentType="oneTimeCode"
                      autoComplete="one-time-code"
                      maxLength={RESET_CODE_LENGTH}
                      placeholder={"0".repeat(RESET_CODE_LENGTH)}
                      placeholderTextColor={Colors.mutedDark}
                    />
                  </View>
                  <View style={styles.field}>
                    <Text style={styles.label}>NEW PASSWORD</Text>
                    <TextInput
                      style={styles.input}
                      value={newPassword}
                      onChangeText={setNewPassword}
                      secureTextEntry
                      autoCapitalize="none"
                      textContentType="newPassword"
                      autoComplete="new-password"
                      placeholder="At least 6 characters"
                      placeholderTextColor={Colors.mutedDark}
                    />
                  </View>
                  <View style={styles.actions}>
                    <Pressable
                      style={[styles.btn, busy && styles.btnDisabled]}
                      onPress={handleResetPassword}
                      disabled={busy}
                    >
                      {busy ? <ActivityIndicator color={Colors.black} size="small" /> : <Text style={styles.btnText}>SET NEW PASSWORD</Text>}
                    </Pressable>
                    <Pressable style={[styles.btn, styles.btnOutline]} onPress={handleSendResetCode} disabled={busy}>
                      <Text style={styles.btnTextOutline}>SEND A NEW CODE</Text>
                    </Pressable>
                  </View>
                  <Pressable accessibilityRole="button" hitSlop={8} onPress={backToSignIn} style={styles.linkRowCenter}>
                    <Text style={styles.linkText}>BACK TO SIGN IN</Text>
                  </Pressable>
                </>
              )}

              <Text style={styles.note}>Your account stays signed in on this device.</Text>
            </View>
          </KeyboardAwareScrollViewCompat>
        </>
      )}
      {showTransition && (
        <LaunchTransition
          loading={busy}
          onDone={() => {
            setShowTransition(false);
            goHome();
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  container: {
    flex: 1,
    backgroundColor: "transparent",
  },
  content: {
    alignItems: "center",
    flexGrow: 1,
    backgroundColor: "transparent",
  },
  backgroundArtwork: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.34,
    pointerEvents: "none",
  },
  backgroundArtworkImage: {
    width: "100%",
    height: "100%",
    transform: [{ translateY: -56 }],
  },
  hero: {
    flex: 1,
    maxWidth: 720,
    paddingHorizontal: 24,
    overflow: "hidden",
    width: "100%",
  },
  brandRow: {
    alignItems: "center",
    zIndex: 2,
  },
  heroCopy: {
    marginTop: "auto",
    paddingBottom: 18,
    maxWidth: 320,
    zIndex: 2,
  },
  formPanel: {
    flexShrink: 0,
    maxWidth: 720,
    paddingHorizontal: 24,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    // Was solid Colors.background — the panel sits as its own layer on top
    // of the artwork and blocked it outright with a hard edge. Slightly
    // transparent instead of fully opaque, so the image and dark backdrop
    // color both still read faintly through, softening that cutoff.
    backgroundColor: "rgba(13,13,16,0.92)",
    width: "100%",
  },
  title: {
    fontFamily: Typography.heading,
    fontSize: 28,
    color: Colors.text,
    letterSpacing: 1.4,
    lineHeight: 32,
  },
  subtitle: {
    fontFamily: Typography.bodyMedium,
    fontSize: 10,
    color: Colors.muted,
    letterSpacing: 2.4,
    marginTop: 5,
  },
  statusBanner: {
    borderWidth: 1,
    borderColor: Colors.accent,
    padding: 16,
    marginBottom: 12,
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
    borderColor: Colors.loss,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 12,
    color: Colors.loss,
    letterSpacing: 0.5,
  },
  noticeBox: {
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    padding: 12,
    marginBottom: 16,
  },
  noticeText: {
    fontFamily: Typography.body,
    fontSize: 12,
    color: Colors.text,
    letterSpacing: 0.3,
    lineHeight: 17,
  },
  resetTitle: {
    fontFamily: Typography.heading,
    fontSize: 18,
    color: Colors.text,
    letterSpacing: 1.4,
    marginBottom: 6,
  },
  resetBody: {
    fontFamily: Typography.body,
    fontSize: 12,
    color: Colors.muted,
    lineHeight: 17,
    marginBottom: 14,
  },
  codeInput: {
    fontFamily: Typography.heading,
    fontSize: 20,
    letterSpacing: 8,
  },
  linkRow: {
    alignSelf: "flex-end",
    marginTop: -4,
    marginBottom: 12,
    minHeight: 24,
    justifyContent: "center",
  },
  linkRowCenter: {
    alignSelf: "center",
    marginBottom: 10,
    minHeight: 24,
    justifyContent: "center",
  },
  linkText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 10,
    color: Colors.muted,
    letterSpacing: 2,
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
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  actions: { marginTop: 2 },
  btn: {
    backgroundColor: Colors.accent,
    minHeight: 48,
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
  appleBtn: { height: 48, marginBottom: 10 },
  note: {
    fontFamily: Typography.body,
    fontSize: 10,
    color: Colors.mutedDark,
    letterSpacing: 0.3,
    lineHeight: 14,
    textAlign: "center",
    marginTop: 2,
  },
});
