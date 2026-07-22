import * as AppleAuthentication from "expo-apple-authentication";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
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
    if (error) { setErrorMsg(error); }
    else { goHome(); }
  }

  async function handleSignUp() {
    if (!email || !password) { setErrorMsg("Enter email and password."); return; }
    setBusy(true); setErrorMsg(null);
    const { error, needsEmailConfirmation } = await signUpWithEmail(email.trim(), password);
    setBusy(false);
    if (error) { setErrorMsg(error); }
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
    if (error) { setErrorMsg(error); }
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
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: topPad + 20, paddingBottom: bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Auth is the app's front door — no back button, nothing to go back to. */}
        <LogoMark size={72} style={styles.logo} />
        <Text style={styles.title}>LOCALCHECK</Text>
        <Text style={styles.subtitle}>
          {user ? "ACCOUNT" : "KNOW WHO'S RUNNING. SHOW UP. RANK UP."}
        </Text>

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

        <View style={styles.divider} />
        <Text style={styles.note}>
          Your session persists across launches. Courts, ELO, and check-ins sync to the cloud when signed in.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: 24,
  },
  logo: { marginTop: 24, marginBottom: 20 },
  title: {
    fontFamily: Typography.heading,
    fontSize: 32,
    color: Colors.text,
    letterSpacing: 2,
    lineHeight: 36,
  },
  subtitle: {
    fontFamily: Typography.bodyMedium,
    fontSize: 11,
    color: Colors.muted,
    letterSpacing: 4,
    marginTop: 4,
    marginBottom: 32,
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
  field: { marginBottom: 16 },
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
  btn: {
    backgroundColor: Colors.accent,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
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
