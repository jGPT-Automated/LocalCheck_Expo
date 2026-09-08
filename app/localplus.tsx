import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DetailHeader } from "@/components/ui/DetailHeader";
import { Colors, Radius } from "@/constants/colors";
import { Layout, Space } from "@/constants/layout";
import { TextStyles, Typography } from "@/constants/typography";
import { LocalPlusFlags } from "@/constants/flags";
import { useAuth } from "@/context/AuthContext";
import { useLocalPlus } from "@/hooks/useLocalPlus";

const PERKS: { icon: React.ComponentProps<typeof Feather>["name"]; title: string; body: string }[] = [
  {
    icon: "bar-chart-2",
    title: "LEADERBOARD",
    body: "Show up on the local, regional, and global boards. Free accounts stay unranked.",
  },
  {
    icon: "clock",
    title: "FULL MATCH HISTORY",
    body: `Every game on your profile, not just the last ${LocalPlusFlags.freeHistoryCount}. Older games always count toward your rating and stats either way.`,
  },
  {
    icon: "map",
    title: "TRAVEL COURT INSIGHTS",
    body: "Open the players, schedule, and activity for any court — not only your local one.",
  },
  {
    icon: "award",
    title: "FOUNDING SUPPORT",
    body: "Back the app early and lock in the lowest price it will ever be.",
  },
];

export default function LocalPlusScreen() {
  const router = useRouter();
  const { bottom } = useSafeAreaInsets();
  const { profile } = useAuth();
  const hasLocalPlus = useLocalPlus();
  // FOUNDER / STARTER get LocalPlus at no cost — nothing to cancel.
  // See docs/runbooks/ACCOUNT_TAGS.md.
  const tag = profile?.account_tag ?? null;
  const isFounder = tag === "FOUNDER";
  const isComped = isFounder || tag === "STARTER";

  return (
    <View style={styles.screen}>
      <DetailHeader
        onBack={() =>
          router.canGoBack() ? router.back() : router.replace("/settings")
        }
        title="LOCALPLUS"
      />
      <ScrollView
        contentContainerStyle={{
          padding: Layout.screenGutter,
          paddingBottom: bottom + 32,
          gap: Space.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        {hasLocalPlus ? (
          <View style={styles.statusBanner}>
            <Feather color={Colors.accent} name="check-circle" size={15} />
            <Text style={styles.statusText}>
              {isFounder
                ? "You're a founder — LocalPlus is on the house, for good."
                : tag === "STARTER"
                  ? "You're a Starter — LocalPlus is free for your first year."
                  : "LocalPlus is active on this account."}
            </Text>
          </View>
        ) : (
          <Text style={styles.intro}>
            LocalPlus is for players who take their runs seriously — the ranked
            ladder, your whole history, and the read on courts beyond your own.
          </Text>
        )}

        <View style={styles.perks}>
          {PERKS.map((perk) => (
            <View key={perk.title} style={styles.perk}>
              <View style={styles.perkIcon}>
                <Feather color={Colors.accent} name={perk.icon} size={15} />
              </View>
              <View style={styles.perkCopy}>
                <Text style={styles.perkTitle}>{perk.title}</Text>
                <Text style={styles.perkBody}>{perk.body}</Text>
              </View>
            </View>
          ))}
        </View>

        {!hasLocalPlus ? (
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              Alert.alert(
                "Almost there",
                "LocalPlus subscriptions go live shortly. Founding members already have it free for a year.",
              )
            }
            style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
          >
            <Text style={styles.ctaText}>SEE PLANS</Text>
          </Pressable>
        ) : isComped ? (
          <Text style={styles.manageNote}>
            {isFounder
              ? "LocalPlus is comped on your account — there's nothing to manage."
              : "Your Starter year is on us — there's no subscription to cancel. LocalPlus simply lapses at the end of the year unless you start one."}
          </Text>
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              void Linking.openURL(
                "https://apps.apple.com/account/subscriptions",
              )
            }
            style={({ pressed }) => [
              styles.manageButton,
              pressed && styles.ctaPressed,
            ]}
          >
            <Feather color={Colors.textSecondary} name="external-link" size={13} />
            <Text style={styles.manageButtonText}>MANAGE / CANCEL SUBSCRIPTION</Text>
          </Pressable>
        )}

        <Text style={styles.fine}>
          Older games are only hidden from the profile feed — they still move
          your rating, your win-loss record, and every head-to-head.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  intro: {
    ...TextStyles.body,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  statusBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    padding: 13,
    borderWidth: 1,
    borderColor: Colors.accentBorder,
    borderRadius: Radius.md,
    backgroundColor: Colors.accentGhost,
  },
  statusText: { ...TextStyles.bodySmall, color: Colors.text, flex: 1 },
  perks: { gap: Space.md },
  perk: { flexDirection: "row", gap: Space.md },
  perkIcon: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.accentBorder,
    backgroundColor: Colors.accentGhost,
  },
  perkCopy: { flex: 1, gap: 3 },
  perkTitle: {
    ...TextStyles.label,
    color: Colors.text,
    letterSpacing: 1.2,
  },
  perkBody: {
    ...TextStyles.bodySmall,
    color: Colors.muted,
    lineHeight: 17,
  },
  cta: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.md,
    backgroundColor: Colors.accent,
  },
  ctaPressed: { opacity: 0.8 },
  ctaText: {
    fontFamily: Typography.heading,
    fontSize: 13,
    letterSpacing: 1.6,
    color: Colors.black,
  },
  manageButton: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  manageButtonText: {
    fontFamily: Typography.bodyBold,
    fontSize: 11,
    letterSpacing: 1.2,
    color: Colors.textSecondary,
  },
  manageNote: {
    ...TextStyles.bodySmall,
    color: Colors.muted,
    lineHeight: 17,
  },
  fine: {
    ...TextStyles.caption,
    color: Colors.mutedDark,
    lineHeight: 15,
  },
});
