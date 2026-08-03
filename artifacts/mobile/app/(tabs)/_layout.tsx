import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import { SymbolView } from "expo-symbols";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { Platform, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "@/constants/colors";
import { AppShell } from "@/constants/layout";

function ClassicTabLayout() {
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";
  const { bottom } = useSafeAreaInsets();

  const TAB_ICON_AREA = AppShell.tabBarIconArea;
  const tabBarHeight = isWeb ? 84 : TAB_ICON_AREA + bottom;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.accent,
        tabBarInactiveTintColor: Colors.muted,
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : Colors.surfaceDark,
          borderTopWidth: 0.5,
          borderTopColor: Colors.border,
          elevation: 0,
          height: tabBarHeight,
          paddingBottom: isWeb ? 10 : bottom + 4,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontFamily: "Inter_600SemiBold",
          fontSize: 10,
          letterSpacing: 0.5,
          textTransform: "uppercase",
          marginBottom: 0,
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={90}
              tint="dark"
              style={StyleSheet.absoluteFill}
            />
          ) : null,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="house" tintColor={color} size={22} />
            ) : (
              <Feather name="home" size={21} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: "Schedule",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="calendar" tintColor={color} size={22} />
            ) : (
              <Feather name="calendar" size={21} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="compete"
        options={{
          title: "Compete",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="trophy" tintColor={color} size={22} />
            ) : (
              <Feather name="award" size={21} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: "Explore",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="map" tintColor={color} size={22} />
            ) : (
              <Feather name="map" size={21} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="elo"
        options={{
          title: "Me",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="person" tintColor={color} size={22} />
            ) : (
              <Feather name="user" size={21} color={color} />
            ),
        }}
      />
      {/* Feed is still accessible as a route but hidden from tab bar */}
      <Tabs.Screen name="feed" options={{ href: null }} />
    </Tabs>
  );
}

export default function TabLayout() {
  // Always use ClassicTabLayout for consistent styling across platforms
  // NativeTabs creates a floating pill nav on iOS which doesn't match our design
  return <ClassicTabLayout />;
}
