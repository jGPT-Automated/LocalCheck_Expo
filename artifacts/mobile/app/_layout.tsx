import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts as useInterFonts,
} from "@expo-google-fonts/inter";
import { Oswald_400Regular, Oswald_700Bold } from "@expo-google-fonts/oswald";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Colors } from "@/constants/colors";
import { AppProvider } from "@/context/AppContext";
import { AuthProvider, useAuth } from "@/context/AuthContext";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

/**
 * Gates the app behind authentication. Every Supabase RLS policy requires an
 * authenticated role, so a signed-out user can't load any data — we send them
 * to the auth screen and only render the tabs once a session exists.
 */
function AuthGate({ children }: { children: React.ReactNode }) {
  const { session, profile, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    const onAuthScreen = segments[0] === "auth";
    const onOnboardingScreen = segments[0] === "onboarding";
    const needsOnboarding = !!session && !profile?.preferred_sport;

    if (!session && !onAuthScreen) {
      router.replace("/auth");
    } else if (needsOnboarding && !onOnboardingScreen) {
      router.replace("/onboarding");
    } else if (
      session &&
      !needsOnboarding &&
      (onAuthScreen || onOnboardingScreen)
    ) {
      router.replace("/(tabs)");
    }
  }, [session, profile?.preferred_sport, isLoading, segments, router]);

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: Colors.background,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator color={Colors.accent} />
      </View>
    );
  }

  return <>{children}</>;
}

function RootLayoutNav() {
  return (
    <AuthGate>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="court/[id]"
          options={{ headerShown: false, presentation: "card" }}
        />
        <Stack.Screen
          name="run/[id]"
          options={{ headerShown: false, presentation: "card" }}
        />
        <Stack.Screen
          name="player/[id]"
          options={{ headerShown: false, presentation: "card" }}
        />
        <Stack.Screen
          name="friends"
          options={{ headerShown: false, presentation: "card" }}
        />
        <Stack.Screen
          name="settings"
          options={{ headerShown: false, presentation: "card" }}
        />
        <Stack.Screen name="auth" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      </Stack>
    </AuthGate>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useInterFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Oswald_400Regular,
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
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
              <AuthProvider>
                <AppProvider>
                  <RootLayoutNav />
                </AppProvider>
              </AuthProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
