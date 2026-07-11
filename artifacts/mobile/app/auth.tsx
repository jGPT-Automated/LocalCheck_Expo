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

import { Colors } from "@/constants/colors";
import { Typography } from "@/constants/typography";
import { useAuth } from "@/context/AuthContext";

export default function AuthScreen() {
  const router = useRouter();
  const {
    user,
    profile,
    signInWithEmail,
    signUpWithEmail,
    signInWithApple,
    signOut,
    isLoading,
  } = useAuth();
  const { top, bottom } = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : top;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const canGoBack = router.canGoBack();

  function goHome() {
    router.replace("/(tabs)");
  }

  async function handleSignIn() {
    if (!email || !password) {
      setErrorMsg("Enter email and password.");
      return;
    }
    setBusy(true);
    setErrorMsg(null);
    const { error } = await signInWithEmail(email.trim(), password);
    setBusy(false);
    if (error) {
      setErrorMsg(error);
    } else {
      goHome();
    }
  }

  async function handleSignUp() {
    if (!email || !password) {
      setErrorMsg("Enter email and password.");
      return;
    }
    setBusy(true);
    setErrorMsg(null);
    const { error, needsEmailConfirmation } = await signUpWithEmail(
      email.trim(),
      password,
    );
    setBusy(false);
    if (error) {
      setErrorMsg(error);
    } else if (needsEmailConfirmation) {
      Alert.alert(
        "Account created",
        "Check your email to confirm, then sign in.",
        [{ text: "OK" }],
      );
    } else {
      goHome();
    }
  }

  async function handleAppleSignIn() {
    setBusy(true);
    setErrorMsg(null);
    const { error } = await signInWithApple();
    setBusy(false);
    if (error) {
      setErrorMsg(error);
    } else {
      goHome();
    }
  }

  async function handleSignOut() {
    setBusy(true);
    await signOut();
    setBusy(false);
  }

  if (isLoading) {
    return (
      <View
        style={[
          styles.container,
          { justifyContent: "center", alignItems: "center" },
        ]}
      >
        <ActivityIndicator color={Colors.accent} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: topPad + 16, paddingBottom: bottom + 34 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {canGoBack && (
          <View style={styles.headerRow}>
            <Pressable onPress={() => router.back()} hitSlop={12}>
              <Text style={styles.backText}>← BACK</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.hero}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>LC</Text>
          </View>
          <View style={styles.liveMap}>
            <View style={styles.mapLineVertical} />
            <View style={styles.mapLineHorizontal} />
            <View style={[styles.courtNode, styles.courtNodePrimary]}>
              <Text style={styles.nodeText}>8</Text>
            </View>
            <View style={[styles.courtNode, { left: 34, top: 54 }]}>
              <Text style={styles.nodeText}>3</Text>
            </View>
            <View style={[styles.courtNode, { right: 28, bottom: 48 }]}>
              <Text style={styles.nodeText}>5</Text>
            </View>
            <View style={styles.rankCard}>
              <Text style={styles.rankText}>ELO +24</Text>
            </View>
          </View>
          <Text style={styles.title}>See who is at your local court.</Text>
          <Text style={styles.subtitle}>
            Check in, log games, join runs, and climb the local rankings.
          </Text>
        </View>

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
          <View style={styles.authCard}>
            {errorMsg ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            ) : null}

            {Platform.OS === "ios" && (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={
                  AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
                }
                buttonStyle={
                  AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                }
                cornerRadius={3}
                style={styles.appleBtn}
                onPress={handleAppleSignIn}
              />
            )}

            <View style={styles.orRow}>
              <View style={styles.orLine} />
              <Text style={styles.orText}>OR EMAIL</Text>
              <View style={styles.orLine} />
            </View>

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
              style={[styles.btn, busy && styles.btnDisabled]}
              onPress={handleSignUp}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color={Colors.black} size="small" />
              ) : (
                <Text style={styles.btnText}>CREATE ACCOUNT</Text>
              )}
            </Pressable>

            <Pressable
              style={[
                styles.btn,
                styles.btnOutline,
                busy && styles.btnDisabled,
              ]}
              onPress={handleSignIn}
              disabled={busy}
            >
              <Text style={styles.btnTextOutline}>SIGN IN</Text>
            </Pressable>
          </View>
        )}

        <Text style={styles.note}>
          By continuing, you agree to use real account data for courts, Elo, and
          check-ins.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: 22,
  },
  headerRow: { marginBottom: 10 },
  backText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 11,
    color: Colors.muted,
    letterSpacing: 2,
  },
  hero: { marginBottom: 22 },
  logo: {
    width: 54,
    borderWidth: 1,
    borderColor: Colors.text,
    alignItems: "center",
    paddingVertical: 3,
    marginBottom: 22,
  },
  logoText: {
    fontFamily: Typography.heading,
    color: Colors.text,
    fontSize: 25,
    letterSpacing: 1,
  },
  liveMap: {
    height: 220,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    marginBottom: 22,
    overflow: "hidden",
  },
  mapLineVertical: {
    position: "absolute",
    left: "50%",
    top: -30,
    width: 1,
    height: 280,
    backgroundColor: Colors.border,
    transform: [{ rotate: "24deg" }],
  },
  mapLineHorizontal: {
    position: "absolute",
    left: -20,
    top: "48%",
    width: 420,
    height: 1,
    backgroundColor: Colors.border,
    transform: [{ rotate: "-12deg" }],
  },
  courtNode: {
    position: "absolute",
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 1,
    borderColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.background,
  },
  courtNodePrimary: {
    left: "50%",
    top: "50%",
    marginLeft: -27,
    marginTop: -27,
    backgroundColor: Colors.accent,
  },
  nodeText: {
    fontFamily: Typography.heading,
    color: Colors.text,
    fontSize: 22,
  },
  rankCard: {
    position: "absolute",
    right: 14,
    top: 14,
    borderWidth: 1,
    borderColor: Colors.win,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: Colors.background,
  },
  rankText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 10,
    letterSpacing: 2,
    color: Colors.win,
  },
  title: {
    fontFamily: Typography.heading,
    fontSize: 47,
    lineHeight: 50,
    color: Colors.text,
    letterSpacing: -0.8,
  },
  subtitle: {
    fontFamily: Typography.body,
    fontSize: 14,
    lineHeight: 21,
    color: Colors.textSecondary,
    marginTop: 10,
  },
  authCard: {
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    backgroundColor: Colors.card,
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
    borderColor: Colors.loss,
    padding: 12,
    marginBottom: 14,
  },
  errorText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 12,
    color: Colors.loss,
    letterSpacing: 0.5,
  },
  field: { marginBottom: 13 },
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
    minHeight: 48,
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
  appleBtn: { height: 48, marginBottom: 14 },
  orRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  orLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  orText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 9,
    color: Colors.muted,
    letterSpacing: 2,
  },
  note: {
    fontFamily: Typography.body,
    fontSize: 11,
    color: Colors.mutedDark,
    letterSpacing: 0.3,
    lineHeight: 18,
    marginTop: 18,
  },
});
