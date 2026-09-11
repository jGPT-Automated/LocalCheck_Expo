import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { PurchasesPackage } from "react-native-purchases";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DetailHeader } from "@/components/ui/DetailHeader";
import { Colors, Radius } from "@/constants/colors";
import { Layout, Space } from "@/constants/layout";
import { TextStyles, Typography } from "@/constants/typography";
import { LocalPlusFlags } from "@/constants/flags";
import { useAuth } from "@/context/AuthContext";
import { useLocalPlus } from "@/hooks/useLocalPlus";
import {
  fetchLocalPlusPackage,
  getIdentityState,
  purchaseLocalPlus,
  redeemOfferCode,
  restorePurchases,
  retryIdentifyPurchaser,
  subscribeIdentityState,
} from "@/services/purchasesService";

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
  const { profile, refreshProfile } = useAuth();
  const hasLocalPlus = useLocalPlus();
  const tag = profile?.account_tag ?? null;
  const isFounder = tag === "FOUNDER";
  // Which lineage is actually granting LocalPlus right now — NOT the same
  // question as account_tag. A STARTER who redeemed their offer code has a
  // real, billing 'app_store' row despite the tag never changing, and must
  // see the manage/cancel link, not "nothing to manage." Falls back to the
  // tag heuristic only until the migration that adds this column is applied.
  const billingProvider = profile?.plus_billing_provider;
  const hasRealSubscription = billingProvider != null && billingProvider !== "promo";
  const isComped =
    billingProvider !== undefined
      ? hasLocalPlus && !hasRealSubscription
      : isFounder || tag === "STARTER";

  const [pkg, setPkg] = React.useState<PurchasesPackage | null>(null);
  const [offeringChecked, setOfferingChecked] = React.useState(false);
  const [purchasing, setPurchasing] = React.useState(false);
  const [restoring, setRestoring] = React.useState(false);
  const [identityState, setIdentityState] = React.useState(getIdentityState());

  React.useEffect(() => subscribeIdentityState(setIdentityState), []);

  React.useEffect(() => {
    if (hasLocalPlus) return; // nothing to buy — skip the network round trip
    let cancelled = false;
    void fetchLocalPlusPackage().then((found) => {
      if (!cancelled) {
        setPkg(found);
        setOfferingChecked(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [hasLocalPlus]);

  const handlePurchase = async () => {
    if (purchasing) return;
    // Identification not ready — a purchase now would charge the App Store
    // but land on RevenueCat's anonymous id with no account to credit. Retry
    // identifying instead of buying.
    if (identityState !== "ready") {
      if (identityState === "error") void retryIdentifyPurchaser();
      return;
    }
    if (!pkg) return;
    setPurchasing(true);
    const result = await purchaseLocalPlus(pkg);
    setPurchasing(false);
    if (result.outcome === "error") {
      Alert.alert("Couldn't complete purchase", result.message);
      return;
    }
    if (result.outcome === "purchased") {
      void refreshProfile();
    }
  };

  const handleRestore = async () => {
    if (restoring) return;
    setRestoring(true);
    const result = await restorePurchases();
    setRestoring(false);
    if (result.outcome === "error") {
      Alert.alert("Couldn't restore purchases", result.message);
      return;
    }
    if (result.outcome === "purchased" && result.isLocalPlus) {
      void refreshProfile();
    } else {
      Alert.alert("Nothing to restore", "No active LocalPlus purchase was found for this Apple ID.");
    }
  };

  const handleRedeemOfferCode = async () => {
    // Same reasoning as handlePurchase, sharper stakes: offer codes are
    // scarce and one-time-use — redeeming one while unidentified burns it
    // with no account to credit.
    if (identityState !== "ready") {
      if (identityState === "error") void retryIdentifyPurchaser();
      return;
    }
    const result = await redeemOfferCode();
    if (result.outcome === "unavailable") {
      Alert.alert("Couldn't open redemption", result.message);
    }
  };

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
          <View style={{ gap: Space.md }}>
            <Pressable
              accessibilityRole="button"
              disabled={
                purchasing || (identityState === "ready" && !pkg)
              }
              onPress={() => void handlePurchase()}
              style={({ pressed }) => [
                styles.cta,
                identityState !== "error" &&
                  (!pkg || purchasing) &&
                  styles.ctaDisabled,
                pressed && styles.ctaPressed,
              ]}
            >
              {purchasing ? (
                <ActivityIndicator color={Colors.black} />
              ) : (
                <Text
                  style={[
                    styles.ctaText,
                    identityState !== "error" &&
                      !pkg &&
                      styles.ctaTextDisabled,
                  ]}
                >
                  {identityState === "pending"
                    ? "SIGNING YOU IN…"
                    : identityState === "error"
                      ? "COULDN'T VERIFY YOUR ACCOUNT — TAP TO RETRY"
                      : pkg
                        ? `SUBSCRIBE — ${pkg.product.priceString}/MO`
                        : offeringChecked
                          ? "NOT AVAILABLE YET"
                          : "LOADING…"}
                </Text>
              )}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={restoring}
              onPress={() => void handleRestore()}
              style={({ pressed }) => [pressed && styles.ctaPressed]}
            >
              <Text style={styles.restoreText}>
                {restoring ? "RESTORING…" : "RESTORE PURCHASES"}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => void handleRedeemOfferCode()}
              style={({ pressed }) => [pressed && styles.ctaPressed]}
            >
              <Text style={styles.restoreText}>
                {identityState === "error"
                  ? "COULDN'T VERIFY YOUR ACCOUNT — TAP TO RETRY"
                  : "HAVE AN OFFER CODE?"}
              </Text>
            </Pressable>
          </View>
        ) : isComped ? (
          <Text style={styles.manageNote}>
            {isFounder
              ? "LocalPlus is comped on your account — there's nothing to manage."
              : tag === "STARTER"
                ? "Your Starter year is on us — there's no subscription to cancel. LocalPlus simply lapses at the end of the year unless you start one."
                : "LocalPlus is active on this account — there's nothing to manage."}
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
  perks: { gap: Space.lg },
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
  perkCopy: { flex: 1, gap: 5 },
  perkTitle: {
    fontFamily: Typography.heading,
    fontSize: 17,
    lineHeight: 21,
    color: Colors.text,
    letterSpacing: 0.8,
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
  ctaDisabled: { backgroundColor: Colors.surfaceHigh },
  ctaText: {
    fontFamily: Typography.heading,
    fontSize: 13,
    letterSpacing: 1.6,
    color: Colors.black,
  },
  ctaTextDisabled: { color: Colors.muted },
  restoreText: {
    fontFamily: Typography.bodyBold,
    fontSize: 11,
    letterSpacing: 1.2,
    textAlign: "center",
    color: Colors.textSecondary,
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
