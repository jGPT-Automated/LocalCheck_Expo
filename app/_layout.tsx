import {
  Inter_200ExtraLight,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts as useInterFonts,
} from "@expo-google-fonts/inter";
import {
  Oswald_500Medium,
  Oswald_600SemiBold,
  Oswald_700Bold,
} from "@expo-google-fonts/oswald";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, usePathname, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useCallback, useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { LogoMark } from "@/components/brand/LogoMark";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LaunchTransition } from "@/components/onboarding/LaunchTransition";
import { CourtSheetProvider } from "@/components/sheet/CourtSheetHost";
import { Colors, Radius } from "@/constants/colors";
import { Layout } from "@/constants/layout";
import { Typography } from "@/constants/typography";
import { AppProvider } from "@/context/AppContext";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { CourtPresenceProvider } from "@/context/CourtPresenceContext";
import { DeviceLocationProvider } from "@/context/DeviceLocationContext";
import { NotificationProvider } from "@/context/NotificationContext";
import { RealtimeHubProvider } from "@/context/RealtimeHubContext";
import { profileNeedsOnboarding } from "@/lib/onboardingGate";
import {
  installGlobalErrorHandler,
  reportClientError,
  setCurrentRoute,
} from "@/services/errorReportService";
import { initPurchases } from "@/services/purchasesService";

SplashScreen.preventAutoHideAsync();
installGlobalErrorHandler();
initPurchases();

// Already-signed-in cold open has no real async work to tie the spinner to
// — there's nothing to await — so this starts loading, flips it off on the
// next tick, and LaunchTransition's own minimum-rotation floor takes it
// from there. Same component, same ~2s floor, as the post-sign-in path.
function SignedInLaunch({ onDone }: { onDone: () => void }) {
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 0);
    return () => clearTimeout(t);
  }, []);
  return <LaunchTransition loading={loading} onDone={onDone} />;
}

const queryClient = new QueryClient();
let hasPlayedSignedInLaunch = false;

const detailScreenOptions = {
  headerShown: false,
  presentation: "card" as const,
  animation: "slide_from_right" as const,
  gestureEnabled: true,
  fullScreenGestureEnabled: true,
  animationMatchesGesture: true,
};

/**
 * Gates the app behind authentication. Every Supabase RLS policy requires an
 * authenticated role, so a signed-out user can't load any data — we send them
 * to the auth screen and only render the tabs once a session exists.
 */
function AuthGate({ children }: { children: React.ReactNode }) {
  const { session, profile, isLoading, profileError, retryProfileLoad } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [signedInLaunchDone, setSignedInLaunchDone] = useState(
    hasPlayedSignedInLaunch,
  );
  const finishSignedInLaunch = useCallback(() => {
    hasPlayedSignedInLaunch = true;
    setSignedInLaunchDone(true);
  }, []);

  useEffect(() => {
    if (isLoading) return;
    const onAuthScreen = segments[0] === "auth";
    const onOnboardingScreen = segments[0] === "onboarding";
    if (!session && !onAuthScreen) {
      router.replace("/auth");
      return;
    }
    if (!session) return;
    // A fresh signup lands on the tabs first (auth.tsx's own goHome), then
    // gets corrected here once `profile` is known — same mechanism this
    // effect already used for the auth-screen redirect above.
    const needsOnboarding = profile ? profileNeedsOnboarding(profile) : false;
    if (needsOnboarding && !onOnboardingScreen) {
      router.replace("/onboarding");
    } else if (!needsOnboarding && onOnboardingScreen) {
      router.replace("/(tabs)");
    } else if (!needsOnboarding && onAuthScreen) {
      router.replace("/(tabs)");
    }
  }, [session, profile, isLoading, segments, router]);

  // Boot screen shown while loading AND while redirecting a signed-out user —
  // tab routes must never render without a session: the data providers aren't
  // mounted then, so useApp() would throw on the one pre-redirect frame. No
  // spinner and no launch ceremony here — this is not "entering the app,"
  // just the brief, usually sub-frame gap before we know where to send the
  // user. The LaunchTransition plays exactly once, only for an
  // already-signed-in session below.
  const onAuthScreen = segments[0] === "auth";
  const onOnboardingScreen = segments[0] === "onboarding";
  const pendingOnboardingRedirect =
    !!session && !!profile && profileNeedsOnboarding(profile) && !onOnboardingScreen;
  // `isLoading` only reliably covers the very first session restore — a
  // *live* sign-in event can publish `session` synchronously while leaving
  // `isLoading` at whatever it already was (false, if the user was sitting
  // on /auth). Without this, a route decision could be made — and (tabs)
  // could render with AppContext's EMPTY_PLAYER fallback — before the
  // profile, and therefore whether onboarding is needed, is even known.
  const profileUnresolved = !!session && profile === null;
  // A terminal failure (retries + the client-side provisioning fallback both
  // exhausted), not "still loading" — profileUnresolved alone can't tell
  // those apart, and blocking on it forever with no way out is exactly the
  // "stuck on a screen with no escape" pattern to avoid.
  if (!isLoading && profileUnresolved && profileError) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: Colors.background,
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          paddingHorizontal: 32,
        }}
      >
        <LogoMark size={64} />
        <Text
          style={{
            fontFamily: Typography.body,
            fontSize: 14,
            color: Colors.textSecondary,
            textAlign: "center",
          }}
        >
          {profileError}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => void retryProfileLoad()}
          style={({ pressed }) => ({
            minHeight: Layout.minTouchTarget,
            paddingHorizontal: 24,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: Radius.md,
            backgroundColor: Colors.accent,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text
            style={{
              fontFamily: Typography.heading,
              fontSize: 13,
              letterSpacing: 1.5,
              color: Colors.black,
            }}
          >
            TRY AGAIN
          </Text>
        </Pressable>
      </View>
    );
  }

  if (
    isLoading ||
    (!session && !onAuthScreen) ||
    pendingOnboardingRedirect ||
    profileUnresolved
  ) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: Colors.background,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <LogoMark size={88} />
      </View>
    );
  }

  if (session && !signedInLaunchDone) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background }}>
        <SignedInLaunch onDone={finishSignedInLaunch} />
      </View>
    );
  }

  return <>{children}</>;
}

/**
 * The entire data layer (scoped Realtime, authoritative fetches, court drawer) only
 * exists while a session exists. Signed out ⇒ zero Supabase traffic — the
 * 2026-07-19 outage was unauthenticated web previews polling forever because
 * AppProvider lived outside the auth gate.
 */
function DataProviders({ children }: { children: React.ReactNode }) {
  const { session, profile } = useAuth();
  if (!session) return <>{children}</>;
  // While a fresh signup still needs onboarding, neither location nor push
  // permission should fire on their own — onboarding's own "Share location"
  // button is the only thing allowed to trigger that native prompt, and
  // NotificationProvider's own effect checks this same flag before its
  // (staggered-after-location) push prompt. Defaults to false (not true)
  // while `profile` itself hasn't loaded yet: session publishes before
  // profile does, and eagerly resolving in that gap could fire the OS
  // prompt before we even know whether this is a fresh signup.
  const autoResolveLocation = profile ? !profileNeedsOnboarding(profile) : false;
  return (
    <RealtimeHubProvider>
      <NotificationProvider>
        <CourtPresenceProvider>
          <DeviceLocationProvider autoResolve={autoResolveLocation}>
            <AppProvider>
              <CourtSheetProvider>{children}</CourtSheetProvider>
            </AppProvider>
          </DeviceLocationProvider>
        </CourtPresenceProvider>
      </NotificationProvider>
    </RealtimeHubProvider>
  );
}

function RootLayoutNav() {
  // Set during render, not in an effect: if navigating to a route makes that
  // route's first render throw, an effect would never commit and the crash
  // report would carry the *previous* pathname. This parent renders before the
  // child screen, so the setter runs first. `setCurrentRoute` just assigns a
  // module-level string — safe to call here.
  setCurrentRoute(usePathname());
  return (
    <AuthGate>
      {/* `contentStyle` is what sits behind a card while it is being dragged.
          Without it react-navigation uses its default light theme background,
          which flashed white on every interactive swipe-back. */}
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="court/[id]" options={detailScreenOptions} />
        <Stack.Screen name="run/[id]" options={detailScreenOptions} />
        <Stack.Screen name="player/[id]" options={detailScreenOptions} />
        <Stack.Screen name="notifications" options={detailScreenOptions} />
        <Stack.Screen name="match/[id]" options={detailScreenOptions} />
        <Stack.Screen name="settings" options={detailScreenOptions} />
        <Stack.Screen name="localplus" options={detailScreenOptions} />
        <Stack.Screen name="add-court" options={{ ...detailScreenOptions, presentation: "fullScreenModal" }} />
        <Stack.Screen name="auth" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
      </Stack>
    </AuthGate>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useInterFonts({
    Inter_200ExtraLight,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Oswald_500Medium,
    Oswald_600SemiBold,
    Oswald_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary
        onError={(error, componentStack) =>
          void reportClientError(error, { componentStack })
        }
      >
        <QueryClientProvider client={queryClient}>
          {/* Paints the root native view dark so nothing light is ever exposed
              behind a card mid-gesture or between screen transitions. */}
          <GestureHandlerRootView
            style={{ flex: 1, backgroundColor: Colors.background }}
          >
            <KeyboardProvider>
              <AuthProvider>
                <DataProviders>
                  <RootLayoutNav />
                </DataProviders>
              </AuthProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
