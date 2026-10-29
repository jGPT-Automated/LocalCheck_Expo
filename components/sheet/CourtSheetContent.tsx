import { AutoCheckInNote } from "@/components/autoCheckIn/AutoCheckInNote";
import { BottomSheetScrollView, BottomSheetView } from "@gorhom/bottom-sheet";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CourtArt } from "@/components/court/CourtArt";
import { CourtBusyChart } from "@/components/court/CourtBusyChart";
import { HereNowSection, UpNextSection } from "@/components/court/CourtOverviewSections";
import {
  CheckInButton,
  CourtLinkButton,
  LocalButton,
  PlaceLine,
  MetricStrip,
  SectionHead,
  SportLabel,
} from "@/components/court/CourtParts";
import { PressableScale } from "@/components/ui/PressableScale";
import { useToast } from "@/components/ui/Toast";
import { Colors, Radius } from "@/constants/colors";
import type { Court, FeedItem, GameRun } from "@/constants/data";
import { Typography } from "@/constants/typography";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { usePresence } from "@/context/CourtPresenceContext";
import { useLocalPlus } from "@/hooks/useLocalPlus";
import { useLocalPlusPurchase } from "@/hooks/useLocalPlusPurchase";
import { describeTimelineItem } from "@/lib/activityPresentation";
import { courtHours, formatCourtHours } from "@/lib/courtHours";
import { drawerDetailHeight, drawerFooterGap } from "@/lib/courtDrawerLayout";
import { formatCooldownRemaining, getLocalCourtCooldown } from "@/lib/localCourtCooldown";
import { PRIVACY_URL, TERMS_URL } from "@/lib/planModel";
import { fetchCourtById, fetchCourtWeekSpans } from "@/services/courtService";
import { fetchFeed } from "@/services/feedService";

const DRAWER_CHIPS = [
  { label: "Games", tab: "games" },
  { label: "Players", tab: "players" },
  { label: "Feed", tab: "live" },
  { label: "Week", tab: "week" },
] as const;

/**
 * Court drawer content (Claude Design court flow), rendered inside the root
 * BottomSheetModal (CourtSheetHost). Two detents on one sheet:
 *
 * - Drawer: sport + Your local, the court name, city · distance, On court /
 *   Court hours · wk / Locals, then Check in and Court ↗. Always free.
 * - Expanded: Here now, Up next, Today (planned visits by hour) and Recent
 *   activity in a fixed area that never scrolls, then Games / Players / Feed
 *   / Week chips into the court page. A court that isn't your local, without
 *   LocalPlus, shows that area blurred under the LocalPlus panel.
 *
 * `onNavigate` dismisses the sheet before any router.push so the pushed
 * screen isn't buried under the modal.
 */
export function CourtSheetContent({
  courtId,
  distanceKm,
  onNavigate,
  onExpand,
  onPeekHeight,
}: {
  courtId: string;
  distanceKm?: number;
  onNavigate: () => void;
  onExpand: () => void;
  onPeekHeight: (height: number) => void;
}) {
  const {
    courts, localCourt, checkIn, checkOut, checkedInCourtId, currentUser, runs,
    localCourtId, isFriend, setLocalCourt, pendingAutoCheckIn, hideAutoCheckIn,
  } = useApp();
  const { bottom } = useSafeAreaInsets();
  const { profile } = useAuth();
  const hasLocalPlus = useLocalPlus();
  const { showToast } = useToast();
  const { height: windowHeight } = useWindowDimensions();
  const [peekHeight, setPeekHeight] = useState(0);
  const [isChecking, setIsChecking] = useState(false);

  const cached =
    courts.find((c) => c.id === courtId) ??
    (localCourt?.id === courtId ? localCourt : null);
  const [court, setCourt] = useState<Court | null>(cached);
  const [courtMissing, setCourtMissing] = useState(false);
  const [hoursLabel, setHoursLabel] = useState("—");
  const [recent, setRecent] = useState<FeedItem[]>([]);
  const { roster, localCount } = usePresence(courtId || null);

  useEffect(() => {
    if (!courtId || court) return;
    fetchCourtById(courtId)
      .then((c) => (c ? setCourt(c) : setCourtMissing(true)))
      .catch(() => setCourtMissing(true));
  }, [courtId, court]);

  useEffect(() => {
    if (!courtId) return;
    let cancelled = false;
    void Promise.all([fetchCourtWeekSpans(courtId), fetchFeed(courtId, currentUser.id)]).then(([spans, feed]) => {
      if (cancelled) return;
      setHoursLabel(formatCourtHours(courtHours(spans).hours));
      setRecent(feed.slice(0, 3));
    });
    return () => { cancelled = true; };
  }, [courtId, currentUser.id, roster.length]); // re-pull when presence changes

  const go = (path: string) => {
    onNavigate();
    router.push(path as never);
  };

  if (!court) {
    return (
      <View style={styles.loading}>
        <Text style={styles.emptyText}>{courtMissing ? "Couldn't load this court" : "Loading…"}</Text>
      </View>
    );
  }

  const name = court.shortName || court.name;
  // An auto check-in waiting to post counts as checked in for the player.
  const waitingToPost = pendingAutoCheckIn?.courtId === court.id && checkedInCourtId !== court.id;
  const isCheckedIn = checkedInCourtId === court.id || waitingToPost;
  const isMyLocal = localCourtId === court.id;
  // Same rule as the court page: your own local court is always free, every
  // other court's player-level detail is LocalPlus.
  const gated = !isMyLocal && !hasLocalPlus;
  const cooldown = getLocalCourtCooldown(hasLocalPlus, profile?.local_court_changed_at);
  const detailHeight = drawerDetailHeight({
    windowHeight,
    peekHeight,
    bottomInset: bottom,
    showViewAll: !gated,
  });
  const activeCount = roster.length;
  const live = activeCount > 0;
  const km = court.distanceKm ?? distanceKm ?? null;
  const distance = km != null && !Number.isNaN(km) ? `${(km * 0.621371).toFixed(1)} mi` : null;
  const place = [court.city || court.market || court.neighborhood, distance].filter(Boolean).join(" · ");
  const now = Date.now();
  const upcoming: GameRun[] = runs
    .filter((run) => run.courtId === court.id && Date.parse(run.startTimeIso) >= now - 60 * 60_000)
    .sort((a, b) => a.startTimeIso.localeCompare(b.startTimeIso));

  const handleCheckIn = async () => {
    if (isChecking) return;
    setIsChecking(true);
    try {
      if (waitingToPost) {
        // Not posted yet: checking out means it never happened.
        await hideAutoCheckIn();
      } else if (isCheckedIn) {
        await checkOut();
      } else if (await checkIn(court.id)) {
        // The toast carries the success haptic.
        showToast({
          title: `CHECKED IN · ${name.toUpperCase()}`,
          body: "Check out when you leave.",
          icon: "map-pin",
        });
      }
    } finally {
      setIsChecking(false);
    }
  };

  // The drawer sets a local court; removing it lives on the court page.
  const setAsLocal = () => {
    if (isMyLocal || cooldown.restricted) return;
    void setLocalCourt(court.id, court).then((ok) => {
      if (ok) showToast({ title: `${name.toUpperCase()} IS YOUR LOCAL`, icon: "home" });
    });
  };

  return (
    <BottomSheetView>
      <CourtArt sport={court.sport} />
      {/* ── Drawer: its measured height owns the first sheet detent ── */}
      <View
        onLayout={(event) => {
          const height = event.nativeEvent.layout.height;
          setPeekHeight(height);
          onPeekHeight(height);
        }}
      >
        <Pressable
          accessibilityHint="Shows who's here, games and today's plans"
          accessibilityLabel={`${name}, expand`}
          onPress={onExpand}
        >
          <View style={styles.metaRow}>
            <SportLabel sport={court.sport} />
          </View>
          <Text adjustsFontSizeToFit minimumFontScale={0.6} numberOfLines={1} style={styles.name}>
            {name}
          </Text>
          <PlaceLine local={isMyLocal} place={place} style={styles.place} />
          <View style={styles.strip}>
            <MetricStrip
              cells={[
                { label: "On court", value: activeCount, live },
                { label: "Court hours · wk", value: hoursLabel },
                { label: "Locals", value: localCount },
              ]}
              size="drawer"
            />
          </View>
        </Pressable>

        <View style={styles.actions}>
          <LocalButton
            active={isMyLocal}
            courtName={name}
            onPress={cooldown.restricted ? undefined : setAsLocal}
          />
          <View style={styles.checkSlot}>
            <CheckInButton
              busy={isChecking}
              checkedIn={isCheckedIn}
              courtName={name}
              onPress={() => void handleCheckIn()}
            />
          </View>
          <CourtLinkButton courtName={name} onPress={() => go(gated ? "/localplus" : `/court/${court.id}`)} />
        </View>
        <AutoCheckInNote courtId={court.id} />
        <View style={styles.peekFoot} />
      </View>

      {/* ── Expanded: a fixed-height window that scrolls ── */}
      <BottomSheetScrollView
        contentContainerStyle={styles.detailContent}
        showsVerticalScrollIndicator={false}
        style={{ height: detailHeight }}
      >
        <CourtDrawerGate
          cooldown={cooldown}
          courtName={name}
          gated={gated}
          onOpenLocalPlus={() => go("/localplus")}
          onSetLocal={setAsLocal}
        >
          <HereNowSection
            isFriend={isFriend}
            onMore={() => go(`/court/${court.id}?tab=players`)}
            onPlayer={(id) => go(`/player/${id}`)}
            roster={roster}
          />
          <UpNextSection
            onOpenRun={(id) => go(`/run/${id}`)}
            onSeeAll={() => go(`/court/${court.id}?tab=games`)}
            upcoming={upcoming}
          />

          <View style={styles.section}>
            <CourtBusyChart courtId={court.id} games={upcoming} refreshKey={roster.length} title="Today" />
          </View>

          <View style={styles.section}>
            <SectionHead meta="Feed" onMetaPress={() => go(`/court/${court.id}?tab=live`)} title="Recent activity" />
            {recent.length > 0 ? (
              recent.map((item) => <RecentLine item={item} key={item.id} />)
            ) : (
              <Text style={styles.emptyText}>The first check-in or game here will start the feed.</Text>
            )}
          </View>
        </CourtDrawerGate>
      </BottomSheetScrollView>

      {!gated ? (
        <View style={[styles.chips, { paddingBottom: drawerFooterGap(bottom) }]}>
          {DRAWER_CHIPS.map((chip) => (
            <PressableScale
              accessibilityRole="button"
              key={chip.tab}
              onPress={() => go(`/court/${court.id}?tab=${chip.tab}`)}
              style={styles.chip}
            >
              <Text style={styles.chipText}>{chip.label}</Text>
            </PressableScale>
          ))}
        </View>
      ) : null}
    </BottomSheetView>
  );
}

/** One quiet feed line: dot, "Name did this", time. */
function RecentLine({ item }: { item: FeedItem }) {
  const model = describeTimelineItem(item, { showActor: true });
  const dot =
    model.marker === "game"
      ? item.sport === "PICKLEBALL" ? Colors.pickleballMeta : Colors.basketballMeta
      : item.type === "checkin" || item.type === "checkin_burst"
        ? Colors.accent
        : Colors.checkOutDot;
  let who = "";
  let what = "";
  if (model.kind === "game") {
    const [win, lose] = model.lines;
    who = win.name;
    what = `def. ${lose.name} ${win.score}–${lose.score}`;
  } else {
    const nameSegment = model.segments.find((segment) => segment.tone === "name");
    who = nameSegment?.text ?? "";
    what = model.segments.filter((segment) => segment !== nameSegment).map((segment) => segment.text).join(" ").trim();
  }
  return (
    <View accessibilityLabel={model.accessibilityLabel} style={styles.recentRow}>
      <View style={[styles.recentDot, { backgroundColor: dot }]} />
      <Text numberOfLines={1} style={styles.recentText}>
        {who ? <Text style={styles.recentWho}>{who} </Text> : null}
        {what}
      </Text>
      <Text style={styles.recentAgo}>{item.timestamp}</Text>
    </View>
  );
}

/**
 * The LocalPlus panel over a blurred copy of the expanded drawer. Real
 * content renders underneath, non-interactive; the API already sends
 * placeholder rows for locked courts where names matter.
 */
function CourtDrawerGate({
  children,
  courtName,
  cooldown,
  gated,
  onSetLocal,
  onOpenLocalPlus,
}: {
  children: React.ReactNode;
  courtName: string;
  cooldown: ReturnType<typeof getLocalCourtCooldown>;
  gated: boolean;
  onSetLocal: () => void;
  /** Fallback when Apple's sheet can't be offered here. Must dismiss this
   * sheet before navigating — see `go()` above. A raw router.push from in
   * here pushes /localplus behind the still-open modal, invisible, and
   * stacks a new one on every repeat tap. */
  onOpenLocalPlus: () => void;
}) {
  // Upgrade opens Apple's purchase sheet for Yearly directly (decision D13).
  const yearly = useLocalPlusPurchase("yearly", gated);
  if (!gated) return <>{children}</>;
  const onUpgrade = () => {
    if (yearly.available) void yearly.buy();
    else onOpenLocalPlus();
  };
  return (
    <View style={styles.gateWrap}>
      <View pointerEvents="none" style={styles.gateWrap}>
        {children}
        <BlurView intensity={28} style={StyleSheet.absoluteFill} tint="dark" />
        <View style={[StyleSheet.absoluteFill, styles.gateShade]} />
      </View>
      <View style={[styles.gateOverlay, StyleSheet.absoluteFill]}>
        <Text style={styles.gateEyebrow}>LocalPlus</Text>
        <Text adjustsFontSizeToFit minimumFontScale={0.7} numberOfLines={2} style={styles.gateTitle}>
          See who runs {courtName}
        </Text>
        <Text style={styles.gateBody}>
          Who's here, upcoming games, rankings and the week ahead at every court in the city.
        </Text>
        <PressableScale
          accessibilityRole="button"
          disabled={yearly.purchasing}
          onPress={onUpgrade}
          style={styles.gateCta}
        >
          {yearly.purchasing ? (
            <ActivityIndicator color={Colors.black} size="small" />
          ) : (
            <Text style={styles.gateCtaText}>
              {yearly.priceString ? `Unlock with LocalPlus · ${yearly.priceString}/yr` : "Unlock with LocalPlus"}
            </Text>
          )}
        </PressableScale>
        {yearly.priceString ? (
          // Apple wants the terms reachable wherever a subscription is sold.
          <View style={styles.gateTermsRow}>
            <Text style={styles.gateTerms}>Renews yearly until you cancel.</Text>
            <Pressable accessibilityRole="link" hitSlop={10} onPress={() => void Linking.openURL(TERMS_URL)}>
              <Text style={[styles.gateTerms, styles.gateTermsLink]}>Terms</Text>
            </Pressable>
            <Pressable accessibilityRole="link" hitSlop={10} onPress={() => void Linking.openURL(PRIVACY_URL)}>
              <Text style={[styles.gateTerms, styles.gateTermsLink]}>Privacy</Text>
            </Pressable>
          </View>
        ) : null}
        <Pressable
          accessibilityRole="button"
          disabled={cooldown.restricted}
          hitSlop={8}
          onPress={onSetLocal}
          style={({ pressed }) => [styles.gateLocalLink, pressed && styles.pressed]}
        >
          {cooldown.restricted ? <Feather color={Colors.textSecondary} name="clock" size={12} /> : null}
          <Text style={styles.gateLocalText}>
            {cooldown.restricted
              ? `You can switch local courts in ${formatCooldownRemaining(cooldown.remainingMs)}`
              : "Or make this your local court — always free"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { alignItems: "center", justifyContent: "center", paddingVertical: 64 },
  metaRow: {
    height: 34,
    paddingTop: 6,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  name: {
    paddingTop: 10,
    paddingHorizontal: 20,
    textAlign: "center",
    fontFamily: Typography.headingBold,
    fontSize: 38,
    lineHeight: 40,
    letterSpacing: -1.3,
    textTransform: "uppercase",
    color: Colors.text,
    textShadowColor: Colors.sheet,
    textShadowRadius: 6,
  },
  place: { paddingTop: 6, paddingHorizontal: 20 },
  strip: { paddingHorizontal: 20, paddingTop: 12 },
  actions: { flexDirection: "row", gap: 8, paddingHorizontal: 20, paddingTop: 14 },
  checkSlot: { flex: 1, minWidth: 0 },
  peekFoot: { height: 16 },

  detailContent: { flexGrow: 1 },
  section: { paddingHorizontal: 20, paddingBottom: 14 },
  emptyText: { fontFamily: Typography.bodyMedium, fontSize: 12, color: Colors.textSecondary },



  recentRow: {
    height: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.hairline,
  },
  recentDot: { width: 7, height: 7, marginHorizontal: 3.5, borderRadius: 4 },
  recentText: { flex: 1, minWidth: 0, fontFamily: Typography.bodyMedium, fontSize: 12.5, color: Colors.textSecondary },
  recentWho: { fontFamily: Typography.bodySemiBold, color: Colors.text },
  recentAgo: { flexShrink: 0, fontFamily: Typography.bodySemiBold, fontSize: 9, letterSpacing: 0.7, textTransform: "uppercase", color: Colors.muted },

  chips: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 20,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.hairline,
    backgroundColor: Colors.sheet,
  },
  chip: {
    flex: 1,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(242,242,246,0.13)",
  },
  chipText: { fontFamily: Typography.bodyBold, fontSize: 9, letterSpacing: 1.1, textTransform: "uppercase", color: Colors.inkSoft },

  gateWrap: { flexGrow: 1 },
  gateShade: { backgroundColor: "rgba(18,18,22,0.55)" },
  // Near the top, not the middle: on a short phone the middle is off screen.
  gateOverlay: { alignItems: "center", justifyContent: "flex-start", gap: 12, paddingTop: 20, paddingHorizontal: 34 },
  gateEyebrow: { fontFamily: Typography.bodyBold, fontSize: 9, letterSpacing: 1.6, textTransform: "uppercase", color: Colors.textSecondary },
  gateTitle: {
    textAlign: "center",
    fontFamily: Typography.headingSemiBold,
    fontSize: 28,
    lineHeight: 30,
    letterSpacing: -0.5,
    textTransform: "uppercase",
    color: Colors.text,
  },
  gateBody: { maxWidth: 280, textAlign: "center", fontFamily: Typography.bodyMedium, fontSize: 12.5, lineHeight: 19, color: Colors.textSecondary },
  gateCta: {
    height: 46,
    marginTop: 4,
    paddingHorizontal: 22,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.button,
    backgroundColor: Colors.text,
  },
  gateCtaText: { fontFamily: Typography.bodyBold, fontSize: 10.5, letterSpacing: 1.4, textTransform: "uppercase", color: Colors.background },
  gateTermsRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  gateTermsLink: { textDecorationLine: "underline", color: Colors.textSecondary },
  gateTerms: { fontFamily: Typography.body, fontSize: 10, color: Colors.mutedDark, textAlign: "center" },
  gateLocalLink: { minHeight: 32, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  gateLocalText: { fontFamily: Typography.bodySemiBold, fontSize: 11, color: Colors.textSecondary, textAlign: "center" },
  pressed: { opacity: 0.6 },
});
