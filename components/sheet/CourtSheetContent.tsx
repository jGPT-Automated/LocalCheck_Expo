import { AutoCheckInNote } from "@/components/autoCheckIn/AutoCheckInNote";
import { BottomSheetView } from "@gorhom/bottom-sheet";
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

import { PlayerAvatar } from "@/components/PlayerAvatar";
import { CourtArt } from "@/components/court/CourtArt";
import { CourtBusyChart } from "@/components/court/CourtBusyChart";
import {
  CheckInButton,
  CourtLinkButton,
  LocalPill,
  MetricStrip,
  SectionHead,
  SportLabel,
} from "@/components/court/CourtParts";
import { formatForMaxPlayers } from "@/components/schedule/scheduledGameModel";
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
import { courtHours, formatCourtHours, formatTimeOnCourt } from "@/lib/courtHours";
import { drawerDetailHeight, drawerFooterGap } from "@/lib/courtDrawerLayout";
import { formatCooldownRemaining, getLocalCourtCooldown } from "@/lib/localCourtCooldown";
import { PRIVACY_URL, TERMS_URL } from "@/lib/planModel";
import { fetchCourtById, fetchCourtWeekSpans } from "@/services/courtService";
import { fetchFeed } from "@/services/feedService";

const HERE_MAX = 4;
const DRAWER_CHIPS = [
  { label: "Games", tab: "games" },
  { label: "Players", tab: "players" },
  { label: "Feed", tab: "live" },
  { label: "Week", tab: "week" },
] as const;

function dayShort(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return "Today";
  return date.toLocaleDateString("en-US", { weekday: "short" });
}

function clock(iso: string): string {
  const date = new Date(iso);
  const h = date.getHours() % 12 === 0 ? 12 : date.getHours() % 12;
  const m = date.getMinutes();
  return m === 0 ? `${h}` : `${h}:${String(m).padStart(2, "0")}`;
}

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
  const weekAhead = upcoming.filter((run) => Date.parse(run.startTimeIso) < now + 7 * 86_400_000);
  const next = upcoming[0];

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
            <LocalPill isLocal={isMyLocal} onPress={isMyLocal || cooldown.restricted ? undefined : setAsLocal} />
          </View>
          <Text adjustsFontSizeToFit minimumFontScale={0.6} numberOfLines={1} style={styles.name}>
            {name}
          </Text>
          {place ? <Text numberOfLines={1} style={styles.place}>{place}</Text> : null}
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

      {/* ── Expanded: fixed height, never scrolls ── */}
      <View style={[styles.detailArea, { height: detailHeight }]}>
        <CourtDrawerGate
          cooldown={cooldown}
          courtName={name}
          gated={gated}
          onOpenLocalPlus={() => go("/localplus")}
          onSetLocal={setAsLocal}
        >
          <View style={styles.section}>
            <SectionHead meta={live ? `${activeCount} on court` : "Live check-ins"} title="Here now" />
            {live ? (
              <View style={styles.hereRow}>
                {roster.slice(0, HERE_MAX).map((player) => (
                  <Pressable
                    accessibilityLabel={player.name}
                    accessibilityRole="button"
                    key={player.id}
                    onPress={() => go(`/player/${player.id}`)}
                    style={styles.hereItem}
                  >
                    <PlayerAvatar
                      friend={isFriend(player.id)}
                      initials={player.avatar}
                      name={player.name}
                      playerId={player.id}
                      size={40}
                      status="active"
                    />
                    <Text numberOfLines={1} style={styles.hereName}>{player.name.split(" ")[0]}</Text>
                    <Text style={styles.hereSub}>{formatTimeOnCourt(player.checkedInAt) ?? player.elo}</Text>
                  </Pressable>
                ))}
                {roster.length > HERE_MAX ? (
                  <Pressable
                    accessibilityLabel={`${roster.length - HERE_MAX} more on court`}
                    accessibilityRole="button"
                    onPress={() => go(`/court/${court.id}?tab=players`)}
                    style={styles.hereItem}
                  >
                    <View style={styles.moreTile}>
                      <Text style={styles.moreTileText}>+{roster.length - HERE_MAX}</Text>
                    </View>
                    <Text style={styles.hereSub}>More</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : (
              <View style={styles.emptyBox}>
                <Text numberOfLines={2} style={styles.emptyText}>Nobody yet. Check in and you're first.</Text>
              </View>
            )}
          </View>

          <View style={styles.section}>
            <SectionHead
              meta={weekAhead.length ? `${weekAhead.length} this week` : "None this week"}
              onMetaPress={weekAhead.length ? () => go(`/court/${court.id}?tab=games`) : undefined}
              title="Up next"
            />
            {next ? (
              <PressableScale
                accessibilityLabel={`${next.title}, ${next.participants.length} of ${next.maxPlayers} going`}
                accessibilityRole="button"
                onPress={() => go(`/run/${next.id}`)}
                style={styles.nextRow}
              >
                <View style={styles.nextWhen}>
                  <Text style={styles.nextDay}>{dayShort(next.startTimeIso)}</Text>
                  <Text style={styles.nextTime}>
                    {clock(next.startTimeIso)}
                    {new Date(next.startTimeIso).getHours() >= 12 ? "P" : "A"}
                  </Text>
                </View>
                <View style={styles.nextBody}>
                  <Text numberOfLines={1} style={styles.nextTitle}>{next.title}</Text>
                  <Text numberOfLines={1} style={styles.nextSub}>
                    {[formatForMaxPlayers(next.maxPlayers), `${next.participants.length} of ${next.maxPlayers} going`]
                      .filter(Boolean)
                      .join(" · ")}
                  </Text>
                </View>
                <View style={styles.faces}>
                  {next.participants.slice(0, 3).map((player, index) => (
                    <View key={player.id} style={[styles.face, index > 0 && styles.faceOverlap]}>
                      <PlayerAvatar initials={player.avatar} name={player.name} playerId={player.id} size={24} />
                    </View>
                  ))}
                </View>
              </PressableScale>
            ) : (
              <View style={styles.emptyBox}>
                <Text numberOfLines={2} style={styles.emptyText}>No games scheduled. Post one and locals see it.</Text>
              </View>
            )}
          </View>

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
      </View>

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
    paddingLeft: 20,
    paddingRight: 16,
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
  place: {
    paddingTop: 6,
    paddingHorizontal: 20,
    textAlign: "center",
    fontFamily: Typography.bodyMedium,
    fontSize: 11,
    color: Colors.textSecondary,
  },
  strip: { paddingHorizontal: 20, paddingTop: 12 },
  actions: { flexDirection: "row", gap: 10, paddingHorizontal: 20, paddingTop: 14 },
  checkSlot: { flex: 1, minWidth: 0 },
  peekFoot: { height: 16 },

  detailArea: { overflow: "hidden" },
  section: { paddingHorizontal: 20, paddingBottom: 16 },
  hereRow: { height: 62, flexDirection: "row", gap: 8, overflow: "hidden" },
  hereItem: { width: 58, alignItems: "center", gap: 4 },
  hereName: { maxWidth: 58, fontFamily: Typography.bodySemiBold, fontSize: 10, color: Colors.inkSoft },
  hereSub: { fontFamily: Typography.bodySemiBold, fontSize: 9, lineHeight: 10, color: Colors.muted },
  moreTile: {
    width: 40,
    height: 40,
    borderRadius: 11,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: Colors.dashed,
    alignItems: "center",
    justifyContent: "center",
  },
  moreTileText: { fontFamily: Typography.headingSemiBold, fontSize: 13, color: Colors.textSecondary },
  emptyBox: {
    height: 60,
    paddingHorizontal: 14,
    justifyContent: "center",
    borderRadius: Radius.row,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: Colors.dashed,
  },
  emptyText: { fontFamily: Typography.bodyMedium, fontSize: 12, color: Colors.textSecondary },

  nextRow: {
    height: 60,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: Radius.row,
    borderWidth: 1,
    borderColor: Colors.hairlineCard,
    backgroundColor: Colors.panel,
  },
  nextWhen: { width: 52, paddingRight: 10, alignItems: "center", borderRightWidth: 1, borderRightColor: Colors.hairline },
  nextDay: { fontFamily: Typography.bodyBold, fontSize: 8, letterSpacing: 1, textTransform: "uppercase", color: Colors.textSecondary },
  nextTime: { fontFamily: Typography.headingSemiBold, fontSize: 17, lineHeight: 19, color: Colors.text },
  nextBody: { flex: 1, minWidth: 0 },
  nextTitle: { fontFamily: Typography.bodyBold, fontSize: 12.5, color: Colors.text },
  nextSub: { marginTop: 2, fontFamily: Typography.bodyMedium, fontSize: 10.5, color: Colors.textSecondary },
  faces: { flexDirection: "row", flexShrink: 0 },
  face: { borderRadius: 9, borderWidth: 2, borderColor: Colors.panel },
  faceOverlap: { marginLeft: -8 },


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

  gateWrap: { flex: 1 },
  gateShade: { backgroundColor: "rgba(18,18,22,0.55)" },
  gateOverlay: { alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 34 },
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
