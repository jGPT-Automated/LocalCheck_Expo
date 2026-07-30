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
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { LogoMark } from "@/components/brand/LogoMark";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { CourtSheetProvider } from "@/components/sheet/CourtSheetHost";
import { Colors } from "@/constants/colors";
import { AppProvider } from "@/context/AppContext";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { CourtPresenceProvider } from "@/context/CourtPresenceContext";
import { NotificationProvider } from "@/context/NotificationContext";
import { RealtimeHubProvider } from "@/context/RealtimeHubContext";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

/**
 * Gates the app behind authentication. Every Supabase RLS policy requires an
 * authenticated role, so a signed-out user can't load any data — we send them
 * to the auth screen and only render the tabs once a session exists.
 */
function AuthGate({ children }: { children: React.ReactNode }) {
  const { session, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    const onAuthScreen = segments[0] === "auth";
    if (!session && !onAuthScreen) {
      router.replace("/auth");
    } else if (session && onAuthScreen) {
      router.replace("/(tabs)");
    }
  }, [session, isLoading, segments, router]);

  // Boot screen shown while loading AND while redirecting a signed-out user —
  // tab routes must never render without a session: the data providers aren't
  // mounted then, so useApp() would throw on the one pre-redirect frame.
  const onAuthScreen = segments[0] === "auth";
  if (isLoading || (!session && !onAuthScreen)) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background, alignItems: "center", justifyContent: "center", gap: 24 }}>
        <LogoMark size={88} />
        <ActivityIndicator color={Colors.accent} />
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
  const { session } = useAuth();
  if (!session) return <>{children}</>;
  return (
    <RealtimeHubProvider>
      <NotificationProvider>
        <CourtPresenceProvider>
          <AppProvider>
            <CourtSheetProvider>{children}</CourtSheetProvider>
          </AppProvider>
        </CourtPresenceProvider>
      </NotificationProvider>
    </RealtimeHubProvider>
  );
}

function RootLayoutNav() {
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
        <Stack.Screen name="court/[id]" options={{ headerShown: false, presentation: "card" }} />
        <Stack.Screen name="run/[id]" options={{ headerShown: false, presentation: "card" }} />
        <Stack.Screen name="player/[id]" options={{ headerShown: false, presentation: "card" }} />
        <Stack.Screen name="friends" options={{ headerShown: false, presentation: "card" }} />
        <Stack.Screen name="notifications" options={{ headerShown: false, presentation: "card" }} />
        <Stack.Screen name="match/[id]" options={{ headerShown: false, presentation: "card" }} />
        <Stack.Screen name="settings" options={{ headerShown: false, presentation: "card" }} />
        <Stack.Screen name="auth" options={{ headerShown: false }} />
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
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          {/* Paints the root native view dark so nothing light is ever exposed
              behind a card mid-gesture or between screen transitions. */}
          <GestureHandlerRootView style={{ flex: 1, backgroundColor: Colors.background }}>
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
