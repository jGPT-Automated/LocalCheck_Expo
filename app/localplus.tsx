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
import type { PurchasesPackage } from "react-native-purchases";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LogoMark } from "@/components/brand/LogoMark";
import { DetailHeader } from "@/components/ui/DetailHeader";
import { StickyActionBar } from "@/components/ui/StickyActionBar";
import { Colors, Radius } from "@/constants/colors";
import { Layout, Space } from "@/constants/layout";
import { TextStyles, Typography } from "@/constants/typography";
import { LocalPlusFlags } from "@/constants/flags";
import { useAuth } from "@/context/AuthContext";
import { useLocalPlus } from "@/hooks/useLocalPlus";
import { PressableScale } from "@/components/ui/PressableScale";
import {
  buttonLabel,
  introLine,
  monthlyEquivalent,
  type PlanId,
  type PlanPrice,
  PRIVACY_URL,
  renewalDisclosure,
  TERMS_URL,
  yearlySavingsPercent,
} from "@/lib/planModel";
import {
  fetchLocalPlusPackages,
  getIdentityState,
  purchaseLocalPlus,
  redeemOfferCode,
  restorePurchases,
  retryIdentifyPurchaser,
  subscribeIdentityState,
} from "@/services/purchasesService";

const PERKS: { icon: React.ComponentProps<typeof Feather>["name"]; title: string; body: string }[] = [
  {
    icon: "users",
    title: "COURT VISIBILITY",
    body: "See the full locals list, schedule, and rankings at any court — not just your own.",
  },
  {
    icon: "bar-chart-2",
    title: "LEADERBOARD",
    body: "Show up on the local, regional, and global boards. LocalLite accounts stay unranked.",
  },
  {
    icon: "clock",
    title: "FULL MATCH HISTORY",
    body: `Every game on your profile, not just the last ${LocalPlusFlags.freeHistoryCount}. Older games always count toward your rating and stats either way.`,
  },
  {
    icon: "award",
    title: "FOUNDING SUPPORT",
    body: "Back LocalCheck early and help shape what gets built next.",
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

  const [packages, setPackages] = React.useState<{
    yearly: PurchasesPackage | null;
    monthly: PurchasesPackage | null;
  }>({ yearly: null, monthly: null });
  // Yearly is preselected (decision D13 / plans spec).
  const [plan, setPlan] = React.useState<PlanId>("yearly");
  const pkg = packages[plan] ?? null;
  const [offeringChecked, setOfferingChecked] = React.useState(false);
  const [purchasing, setPurchasing] = React.useState(false);
  const [restoring, setRestoring] = React.useState(false);
  const [identityState, setIdentityState] = React.useState(getIdentityState());

  React.useEffect(() => subscribeIdentityState(setIdentityState), []);

  React.useEffect(() => {
    if (hasLocalPlus) return; // nothing to buy — skip the network round trip
    let cancelled = false;
    void fetchLocalPlusPackages().then((found) => {
      if (!cancelled) {
        setPackages(found);
        // If only one plan exists in this store, select it.
        if (!found.yearly && found.monthly) setPlan("monthly");
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

  const purchaseDisabled = purchasing || (identityState === "ready" && !pkg);
  const purchaseLabel =
    identityState === "pending"
      ? "SIGNING YOU IN…"
      : identityState === "error"
        ? "COULDN'T VERIFY YOUR ACCOUNT — TAP TO RETRY"
        : purchasing
          ? "SUBSCRIBING…"
          : pkg
            ? buttonLabel(planPrice(pkg), plan)
            : offeringChecked
              ? "NOT AVAILABLE YET"
              : "LOADING…";
  const yearlyPrice = packages.yearly ? planPrice(packages.yearly) : null;
  const monthlyPrice = packages.monthly ? planPrice(packages.monthly) : null;
  const savings = yearlyPrice && monthlyPrice ? yearlySavingsPercent(yearlyPrice, monthlyPrice) : null;
  const selectedIntro = pkg ? introLine(planPrice(pkg), plan) : null;

  return (
    <View style={styles.screen}>
      <DetailHeader
        onBack={() =>
          router.canGoBack() ? router.back() : router.replace("/settings")
        }
        title="LOCALPLUS"
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <LogoMark size={56} variant="plus" />
        </View>

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
        ) : null}

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

        {!hasLocalPlus && (yearlyPrice || monthlyPrice) ? (
          <View style={styles.plans}>
            <Text style={styles.plansLabel}>CHOOSE A PLAN</Text>
            {yearlyPrice ? (
              <PlanCard
                badge="BEST VALUE"
                detail={`${monthlyEquivalent(yearlyPrice)}/mo${savings ? ` · Save ${savings}%` : ""}`}
                onPress={() => setPlan("yearly")}
                price={`${yearlyPrice.priceString}/yr`}
                selected={plan === "yearly"}
                title="YEARLY"
              />
            ) : null}
            {monthlyPrice ? (
              <PlanCard
                detail="Cancel anytime"
                onPress={() => setPlan("monthly")}
                price={`${monthlyPrice.priceString}/mo`}
                selected={plan === "monthly"}
                title="MONTHLY"
              />
            ) : null}
            {selectedIntro ? <Text style={styles.intro}>{selectedIntro}</Text> : null}
            <Text style={styles.disclosure}>
              {renewalDisclosure(pkg ? planPrice(pkg) : null, plan)}
            </Text>
            <View style={styles.legalLinks}>
              <Pressable accessibilityRole="link" hitSlop={12} onPress={() => void Linking.openURL(TERMS_URL)}>
                <Text style={styles.legalLink}>Terms of Use</Text>
              </Pressable>
              <Text style={styles.legalDot}>·</Text>
              <Pressable accessibilityRole="link" hitSlop={12} onPress={() => void Linking.openURL(PRIVACY_URL)}>
                <Text style={styles.legalLink}>Privacy Policy</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <Text style={styles.fine}>
          Older games are only hidden from the profile feed — they still move
          your rating, your win-loss record, and every head-to-head.
        </Text>

        {/* Pinned to the bottom of the screen, right above the button. */}
        {!hasLocalPlus ? (
          <View style={styles.footerLinks}>
            <Pressable
              accessibilityRole="button"
              disabled={restoring}
              hitSlop={10}
              onPress={() => void handleRestore()}
              style={({ pressed }) => [pressed && styles.linkPressed]}
            >
              <Text style={styles.restoreText}>
                {restoring ? "RESTORING…" : "RESTORE PURCHASES"}
              </Text>
            </Pressable>
            <View style={styles.footerDivider} />
            <Pressable
              accessibilityRole="button"
              hitSlop={10}
              onPress={() => void handleRedeemOfferCode()}
              style={({ pressed }) => [pressed && styles.linkPressed]}
            >
              {/* The primary button already surfaces the identity error in
                  full — repeating it here read as the same message twice. */}
              <Text style={styles.restoreText}>HAVE AN OFFER CODE?</Text>
            </Pressable>
          </View>
        ) : isComped ? (
          <Text style={[styles.manageNote, styles.footerNote]}>
            {isFounder
              ? "LocalPlus is comped on your account — there's nothing to manage."
              : tag === "STARTER"
                ? "Your Starter year is on us. It ends with no charge and never turns into a paid plan on its own; nothing to cancel."
                : "LocalPlus is active on this account — there's nothing to manage."}
          </Text>
        ) : null}
      </ScrollView>

      {!hasLocalPlus ? (
        <StickyActionBar
          bottomInset={bottom}
          primary={{
            label: purchaseLabel,
            onPress: () => void handlePurchase(),
            disabled: purchaseDisabled,
          }}
        />
      ) : !isComped ? (
        <StickyActionBar
          bottomInset={bottom}
          primary={{
            label: "MANAGE / CANCEL SUBSCRIPTION",
            icon: "external-link",
            onPress: () =>
              void Linking.openURL("https://apps.apple.com/account/subscriptions"),
          }}
        />
      ) : null}
    </View>
  );
}

function planPrice(pkg: PurchasesPackage): PlanPrice {
  const product = pkg.product;
  return {
    price: product.price,
    priceString: product.priceString,
    currencyCode: product.currencyCode,
    intro: product.introPrice
      ? {
          price: product.introPrice.price,
          priceString: product.introPrice.priceString,
          periodUnit: product.introPrice.periodUnit,
          periodNumberOfUnits: product.introPrice.periodNumberOfUnits,
        }
      : null,
  };
}

function PlanCard({
  title,
  price,
  detail,
  badge,
  selected,
  onPress,
}: {
  title: string;
  price: string;
  detail: string;
  badge?: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <PressableScale
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.planCard, selected && styles.planCardSelected]}
    >
      <View style={[styles.radio, selected && styles.radioSelected]}>
        {selected ? <View style={styles.radioDot} /> : null}
      </View>
      <View style={styles.planCopy}>
        <View style={styles.planTitleRow}>
          <Text style={styles.planTitle}>{title}</Text>
          {badge ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.planDetail}>{detail}</Text>
      </View>
      <Text style={[styles.planPrice, selected && styles.planPriceSelected]}>{price}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  plans: { gap: Space.sm, paddingTop: Space.md },
  plansLabel: {
    fontFamily: Typography.bodyBold,
    fontSize: 11,
    letterSpacing: 2,
    color: Colors.muted,
    marginBottom: 2,
  },
  planCard: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    gap: Space.md,
    paddingHorizontal: Space.lg,
    paddingVertical: Space.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  planCardSelected: { borderColor: Colors.accent, backgroundColor: Colors.accentGhost },
  radio: {
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.borderLight,
  },
  radioSelected: { borderColor: Colors.accent },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.accent },
  planCopy: { flex: 1, minWidth: 0, gap: 3 },
  planTitleRow: { flexDirection: "row", alignItems: "center", gap: Space.sm },
  planTitle: { fontFamily: Typography.heading, fontSize: 17, letterSpacing: 0.8, color: Colors.text },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radius.sm,
    backgroundColor: Colors.accent,
  },
  badgeText: { fontFamily: Typography.bodyBold, fontSize: 9, letterSpacing: 1.2, color: Colors.black },
  planDetail: { ...TextStyles.caption, color: Colors.textSecondary },
  planPrice: { fontFamily: Typography.headingBold, fontSize: 20, color: Colors.textSecondary },
  planPriceSelected: { color: Colors.text },
  intro: { ...TextStyles.bodySmall, color: Colors.accent, textAlign: "center", marginTop: Space.xs },
  disclosure: { ...TextStyles.caption, lineHeight: 15, color: Colors.muted, marginTop: Space.xs },
  legalLinks: { flexDirection: "row", justifyContent: "center", gap: Space.sm, marginTop: 2 },
  legalLink: {
    ...TextStyles.caption,
    color: Colors.textSecondary,
    textDecorationLine: "underline",
  },
  legalDot: { ...TextStyles.caption, color: Colors.muted },
  screen: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  // flexGrow lets the footer links sit at the bottom, next to the button,
  // instead of leaving an empty band under the copy.
  content: {
    flexGrow: 1,
    paddingHorizontal: Layout.screenGutter,
    paddingTop: Space.xxl,
    paddingBottom: Space.md,
    gap: Space.lg,
  },
  hero: { alignItems: "center", paddingBottom: Space.md },
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
  perks: { gap: Space.lg, paddingTop: Space.sm },
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
  linkPressed: { opacity: 0.6 },
  footerLinks: {
    marginTop: "auto",
    paddingTop: Space.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Space.md,
  },
  footerDivider: { width: 1, height: 12, backgroundColor: Colors.border },
  footerNote: { marginTop: "auto" },
  restoreText: {
    fontFamily: Typography.bodyBold,
    fontSize: 11,
    letterSpacing: 1.2,
    textAlign: "center",
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
