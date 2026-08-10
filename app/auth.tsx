import * as AppleAuthentication from "expo-apple-authentication";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LogoMark } from "@/components/brand/LogoMark";
import { Colors } from "@/constants/colors";
import { Typography } from "@/constants/typography";
import { useAuth } from "@/context/AuthContext";

// Swap the sign-in artwork by replacing assets/brand/auth-graphic.png —
// same modular contract as the logo (see DESIGN.md §Brand assets).
const AUTH_GRAPHIC = require("@/assets/brand/auth-graphic.png");

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
  const { user, profile, signInWithEmail, signUpWithEmail, signInWithApple, signOut, isLoading } = useAuth();
  const { top, bottom } = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : top;

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

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator color={Colors.accent} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.hero, { paddingTop: topPad + 12 }]}>
        <View style={styles.brandRow}>
          <LogoMark size={40} />
          <Text style={styles.brandName}>LOCALCHECK</Text>
        </View>
        <Image
          source={AUTH_GRAPHIC}
          style={styles.heroGraphic}
          resizeMode="contain"
          accessibilityLabel="An illuminated overhead sports court"
        />
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

        <Text style={styles.note}>Your account stays signed in on this device.</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  hero: {
    flex: 1,
    paddingHorizontal: 24,
    overflow: "hidden",
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    zIndex: 2,
  },
  brandName: {
    fontFamily: Typography.heading,
    fontSize: 18,
    color: Colors.text,
    letterSpacing: 1.8,
  },
  heroGraphic: {
    position: "absolute",
    width: "95%",
    height: "86%",
    right: -30,
    top: 44,
    opacity: 0.9,
  },
  heroCopy: {
    marginTop: "auto",
    paddingBottom: 18,
    maxWidth: 320,
    zIndex: 2,
  },
  formPanel: {
    flexShrink: 0,
    paddingHorizontal: 24,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background,
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
