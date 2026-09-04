import { Feather, Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Crypto from "expo-crypto";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";

import { PlayerAvatar } from "@/components/PlayerAvatar";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { ScreenHeader } from "@/components/ScreenHeader";
import { CompactSelect } from "@/components/ui/CompactSelect";
import { EloStat } from "@/components/ui/EloStat";
import { ModeTabs } from "@/components/ui/ModeTabs";
import { parsePlayerQrCode } from "@/components/ui/playerIdentity";
import { WeekDatePicker } from "@/components/ui/WeekDatePicker";
import { Colors, Radius } from "@/constants/colors";
import {
  Court,
  CourtSport,
  getSportColor,
  getTierColor,
  Player,
} from "@/constants/data";
import { TextStyles, Typography } from "@/constants/typography";
import { useApp } from "@/context/AppContext";
import { usePresence } from "@/context/CourtPresenceContext";
import {
  fetchLeaderboard,
  fetchProfile,
  searchPlayers,
} from "@/services/profileService";
import { logGame, logTeamGame } from "@/services/gameService";
import { searchCourts } from "@/services/courtService";

// BACKEND NOTE:

type Scope = "GLOBAL" | "REGIONAL" | "LOCAL";
type CompeteMode = "RANKINGS" | "LOG_GAME";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function CountdownRing({ seconds }: { seconds: number }) {
  const size = 54;
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = useSharedValue(1);

  useEffect(() => {
    progress.value = withTiming(0, {
      duration: 5000,
      easing: Easing.linear,
      reduceMotion: ReduceMotion.System,
    });
  }, [progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  return (
    <View
      accessibilityLabel={`Sending in ${seconds} seconds`}
      style={styles.reviewCountdown}
    >
      <Svg height={size} style={StyleSheet.absoluteFill} width={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          fill="transparent"
          r={radius}
          stroke={Colors.border}
          strokeWidth={strokeWidth}
        />
        <AnimatedCircle
          animatedProps={animatedProps}
          cx={size / 2}
          cy={size / 2}
          fill="transparent"
          origin={`${size / 2}, ${size / 2}`}
          r={radius}
          rotation="-90"
          stroke={Colors.accent}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeLinecap="round"
          strokeWidth={strokeWidth}
        />
      </Svg>
      <Text style={styles.reviewCountdownValue}>{seconds}</Text>
    </View>
  );
}

export default function CompeteScreen() {
  const {
    localCourtId,
    localCourt,
    courts,
    currentUser,
    isLocalPlus,
    visibility,
    preferredSport,
    preferredCourtId,
  } = useApp();
  const { bottom } = useSafeAreaInsets();

  // Deep-link support: /(tabs)/compete?tab=log&courtId=... opens Log Game
  // pre-scoped to a court (used by the run screen's LOG A GAME button).
  // ?opponentId=... additionally preselects the opponent (used by the
  // player profile's LOG GAME button).
  const params = useLocalSearchParams<{
    tab?: string;
    courtId?: string;
    opponentId?: string;
  }>();

  const [mode, setMode] = useState<CompeteMode>(
    params.tab === "log" ? "LOG_GAME" : "RANKINGS",
  );
  const [scope, setScope] = useState<Scope>("LOCAL");
  const [rankingSport, setRankingSport] = useState<CourtSport>(
    preferredSport ?? localCourt?.sport ?? "BASKETBALL",
  );
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [deepLinkedOpponent, setDeepLinkedOpponent] = useState<Player | null>(
    null,
  );
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);

  useEffect(() => {
    if (params.tab === "log") setMode("LOG_GAME");
  }, [params.tab]);

  useEffect(() => {
    if (preferredSport) setRankingSport(preferredSport);
    else if (
      localCourt?.sport === "BASKETBALL" ||
      localCourt?.sport === "PICKLEBALL"
    ) {
      setRankingSport(localCourt.sport);
    }
  }, [localCourt?.sport, preferredSport]);

  useEffect(() => {
    let mounted = true;
    setLeaderboardLoading(true);
    fetchLeaderboard(
      scope,
      scope === "GLOBAL" ? null : localCourtId,
      rankingSport,
    )
      .then((players) => {
        if (!mounted) return;
        setAllPlayers(players);
      })
      .finally(() => {
        if (mounted) setLeaderboardLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [scope, localCourtId, rankingSport, currentUser.elo]);

  // Profile/QR deep links are identity lookups, not leaderboard lookups. A
  // valid opponent can be outside the current local/regional/ranked scope.
  useEffect(() => {
    let mounted = true;
    const opponentId =
      typeof params.opponentId === "string" ? params.opponentId : null;
    if (!opponentId || opponentId === currentUser.id) {
      setDeepLinkedOpponent(null);
      return () => {
        mounted = false;
      };
    }
    void fetchProfile(opponentId).then((opponent) => {
      if (mounted) setDeepLinkedOpponent(opponent);
    });
    return () => {
      mounted = false;
    };
  }, [currentUser.id, params.opponentId]);

  const myRank = allPlayers.findIndex((p) => p.id === currentUser.id) + 1;
  const rankedCurrentUser =
    allPlayers.find((p) => p.id === currentUser.id) ?? currentUser;
  const amIVisible = visibility === "public" && isLocalPlus;
  const showMyRank = myRank > 0 && amIVisible;
  const rankContext = showMyRank
    ? "LOCALPLUS"
    : visibility === "public"
      ? "HIDDEN — LOCALPLUS"
      : "HIDDEN — PRIVATE";
  const leaderboardPlayers = useMemo(
    () =>
      showMyRank
        ? allPlayers
        : allPlayers.filter((player) => player.id !== currentUser.id),
    [allPlayers, currentUser.id, showMyRank],
  );

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="COMPETE"
        right={
          <View style={styles.headerTools}>
            {myRank > 0 ? (
              <View style={styles.myRankBadge}>
                <Text
                  style={[styles.myRankNum, !showMyRank && styles.myRankNumDim]}
                >
                  #{myRank}
                </Text>
                <Text style={styles.myRankLabel}>{rankContext}</Text>
              </View>
            ) : null}
          </View>
        }
      />

      <ModeTabs
        prominent
        items={[
          { label: "LEADERBOARD", value: "RANKINGS" },
          {
            label: "LOG GAME",
            value: "LOG_GAME",
            accessibilityLabel: "Log a game",
          },
        ]}
        onChange={setMode}
        value={mode}
      />

      {mode === "RANKINGS" ? (
        <LeaderboardView
          players={leaderboardPlayers}
          myRank={myRank}
          showMyRank={showMyRank}
          currentUserId={currentUser.id}
          currentUser={rankedCurrentUser}
          scope={scope}
          setScope={setScope}
          sport={rankingSport}
          setSport={setRankingSport}
          localCourt={localCourt}
          bottom={bottom}
          loading={leaderboardLoading}
        />
      ) : (
        <LogGameView
          currentUser={currentUser}
          courts={courts}
          bottom={0}
          preferredSport={localCourt?.sport ?? preferredSport}
          preferredCourtId={
            (typeof params.courtId === "string" ? params.courtId : null) ??
            preferredCourtId
          }
          preselectedOpponent={deepLinkedOpponent}
          localCourtId={localCourtId}
        />
      )}
    </View>
  );
}

// ─── Leaderboard ──────────────────────────────────────────────────────────────

function LeaderboardView({
  players,
  myRank,
  showMyRank,
  currentUserId,
  currentUser,
  scope,
  setScope,
  sport,
  setSport,
  localCourt,
  bottom,
  loading,
}: {
  players: Player[];
  myRank: number;
  showMyRank: boolean;
  currentUserId: string;
  currentUser: Player;
  scope: Scope;
  setScope: (s: Scope) => void;
  sport: CourtSport;
  setSport: (sport: CourtSport) => void;
  localCourt: {
    id: string;
    name: string;
    shortName?: string;
    sport: CourtSport;
    city: string;
  } | null;
  bottom: number;
  loading?: boolean;
}) {
  const router = useRouter();
  const { isFriend } = useApp();
  const rankedRows = useMemo(() => {
    const rows: Array<
      | { kind: "player"; player: Player; rank: number }
      | { kind: "hidden"; rank: number }
    > = players.map((player, index) => ({
      kind: "player",
      player,
      rank: index + 1,
    }));

    // The owner sees a private placeholder at their would-be position, while
    // the public players keep their own 1..N rank sequence. The placeholder
    // therefore does not push anyone else down the public leaderboard.
    if (!showMyRank && myRank > 0 && currentUserId) {
      rows.splice(Math.min(myRank - 1, rows.length), 0, {
        kind: "hidden",
        rank: myRank,
      });
    }
    return rows.map((row, index) => ({ ...row, rank: index + 1 }));
  }, [currentUserId, myRank, players, showMyRank]);

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        paddingBottom: Platform.OS === "web" ? 84 : bottom + 100,
      }}
    >
      {/* Sport and scope are one filter decision, presented on one row. */}
      <View style={styles.filterRow}>
        <View style={styles.sportFilter}>
          <CompactSelect
            accessibilityLabel="Switch leaderboard sport"
            align="start"
            dense
            onChange={setSport}
            options={[
              { label: "BB", value: "BASKETBALL" },
              { label: "PB", value: "PICKLEBALL" },
            ]}
            value={sport}
            variant="plain"
          />
        </View>
        <View accessibilityRole="tablist" style={styles.scopeRow}>
          {(["LOCAL", "REGIONAL", "GLOBAL"] as Scope[]).map((s) => (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: scope === s }}
              hitSlop={{ top: 2, bottom: 2, left: 0, right: 0 }}
              key={s}
              onPress={() => setScope(s)}
              style={[styles.scopeSeg, scope === s && styles.scopeSegActive]}
            >
              <Text
                style={[
                  styles.scopeSegText,
                  scope === s && styles.scopeSegTextActive,
                ]}
              >
                {s}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* The current place anchors the ranking list below the filters. */}
      <View style={styles.scopeLabel}>
        {scope === "LOCAL" && localCourt ? (
          <>
            <View
              style={[
                styles.scopeDot,
                { backgroundColor: getSportColor(localCourt.sport) },
              ]}
            />
            <Text style={styles.scopeLabelText} numberOfLines={1}>
              {(localCourt.shortName || localCourt.name).toUpperCase()}
            </Text>
          </>
        ) : scope === "REGIONAL" ? (
          <Text style={styles.scopeLabelText} numberOfLines={1}>
            {(localCourt?.city || "REGIONAL").toUpperCase()}
          </Text>
        ) : (
          <Text style={styles.scopeLabelText}>UNITED STATES</Text>
        )}
      </View>

      {loading ? (
        <View style={styles.emptyState}>
          <ActivityIndicator color={Colors.accent} />
        </View>
      ) : rankedRows.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>NO PLAYERS IN THIS SCOPE</Text>
        </View>
      ) : (
        rankedRows.map((row) => {
          if (row.kind === "hidden") {
            return (
              <View
                key="current-user-hidden"
                style={[styles.leaderRow, styles.hiddenLeaderRow]}
              >
                <Text style={styles.rank}>{row.rank}</Text>
                <PlayerAvatar
                  initials={currentUser.avatar}
                  name={currentUser.name}
                  playerId={currentUser.id}
                  size={40}
                />
                <View style={styles.playerInfo}>
                  <Text numberOfLines={1} style={styles.playerName}>
                    {currentUser.name}
                  </Text>
                  <View style={styles.playerBadges}>
                    <Text style={styles.wlText}>
                      {currentUser.wins}W · {currentUser.losses}L
                    </Text>
                  </View>
                </View>
                <EloStat leaderboard value={currentUser.elo} />
              </View>
            );
          }

          const { player, rank } = row;
          return (
            <Pressable
              key={player.id}
              style={[styles.leaderRow, rank === 1 && styles.leaderRowFirst]}
              onPress={() => router.push(`/player/${player.id}`)}
            >
              <Text style={styles.rank}>{rank}</Text>
              <PlayerAvatar
                initials={player.avatar}
                name={player.name}
                playerId={player.id}
                size={40}
                foregroundColor={rank === 1 ? Colors.black : undefined}
                friend={isFriend(player.id)}
                style={rank === 1 ? styles.leaderAvatarFirst : undefined}
              />
              <View style={styles.playerInfo}>
                <View style={styles.playerNameRow}>
                  <Text style={styles.playerName} numberOfLines={1}>
                    {player.name}
                  </Text>
                </View>
                <View style={styles.playerBadges}>
                  <Text
                    style={[
                      styles.tierText,
                      { color: getTierColor(player.tier) },
                    ]}
                  >
                    {player.tier}
                  </Text>
                  <Text style={styles.wlText}>
                    {player.wins}W · {player.losses}L
                  </Text>
                </View>
              </View>
              <EloStat leaderboard value={player.elo} />
            </Pressable>
          );
        })
      )}
    </ScrollView>
  );
}

// ─── Log Game ────────────────────────────────────────────────────────────────

type GameLog = {
  sport: CourtSport | "";
  myScore: string;
  theirScore: string;
  courtId: string;
  playedOn: string;
  teamSize: 1 | 2 | 3 | 5;
  teammates: Player[];
  opponents: Player[];
};

type PlayerSlot = { side: "mine" | "theirs"; index: number };

function localDateValue(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isValidPlayedOn(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value &&
    value <= localDateValue()
  );
}

function GameDateField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return <WeekDatePicker onChange={onChange} value={value} />;
}

/** Tap to switch the game's sport. It sits to the left of the court field and
 * drives which courts the picker suggests. */
function SportToggle({
  sport,
  onToggle,
}: {
  sport: CourtSport | "";
  onToggle: () => void;
}) {
  const resolved: CourtSport = sport === "PICKLEBALL" ? "PICKLEBALL" : "BASKETBALL";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Sport: ${resolved === "PICKLEBALL" ? "pickleball" : "basketball"}. Tap to switch.`}
      onPress={onToggle}
      style={({ pressed }) => [styles.sportToggle, pressed && styles.pressed]}
    >
      <View
        style={[
          styles.sportToggleDot,
          { backgroundColor: getSportColor(resolved) },
        ]}
      />
      <Text style={styles.sportToggleText}>
        {resolved === "PICKLEBALL" ? "PB" : "BB"}
      </Text>
    </Pressable>
  );
}

/** Court field: shows the current court; tapping opens a search with the
 * nearest few courts for the chosen sport, then live typeahead. */
function CourtPickerField({
  courts,
  localCourt,
  sport,
  valueId,
  onSelect,
}: {
  courts: Court[];
  localCourt: Court | null;
  sport: CourtSport | "";
  valueId: string;
  onSelect: (court: Court) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Court[]>([]);
  const [searching, setSearching] = useState(false);
  const activeSport: CourtSport = sport === "PICKLEBALL" ? "PICKLEBALL" : "BASKETBALL";
  const selected =
    courts.find((court) => court.id === valueId) ??
    (localCourt?.id === valueId ? localCourt : null);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setSearching(false);
    }
  }, [open]);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    let active = true;
    setSearching(true);
    const timer = setTimeout(() => {
      void searchCourts(term, activeSport, 8).then((found) => {
        if (!active) return;
        setResults(found);
        setSearching(false);
      });
    }, 220);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, activeSport]);

  const nearby = useMemo(() => {
    const seen = new Set<string>();
    const list: Court[] = [];
    if (localCourt && localCourt.sport === activeSport) {
      list.push(localCourt);
      seen.add(localCourt.id);
    }
    for (const court of courts) {
      if (court.sport !== activeSport || seen.has(court.id)) continue;
      list.push(court);
      seen.add(court.id);
      if (list.length >= 4) break;
    }
    return list;
  }, [courts, localCourt, activeSport]);

  const term = query.trim();
  const rows = term.length >= 2 ? results : nearby;

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Choose court"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((shown) => !shown)}
        style={styles.courtTrigger}
      >
        <Text
          numberOfLines={1}
          style={selected ? styles.courtTriggerValue : styles.courtTriggerPlaceholder}
        >
          {selected?.name ?? "Choose a court"}
        </Text>
        <Feather
          color={Colors.muted}
          name={open ? "chevron-up" : "chevron-down"}
          size={16}
        />
      </Pressable>
      {open ? (
        <View style={styles.courtPanel}>
          <View style={styles.courtSearch}>
            <Feather color={Colors.muted} name="search" size={14} />
            <TextInput
              accessibilityLabel="Search courts"
              autoCorrect={false}
              autoFocus
              onChangeText={setQuery}
              placeholder="Search courts"
              placeholderTextColor={Colors.mutedDark}
              returnKeyType="search"
              style={styles.courtSearchInput}
              value={query}
            />
            {searching ? (
              <ActivityIndicator color={Colors.accent} size="small" />
            ) : null}
          </View>
          {term.length < 2 ? (
            <Text style={styles.courtSectionLabel}>NEAREST</Text>
          ) : null}
          {rows.map((court) => {
            const isLocal = court.id === localCourt?.id;
            const active = court.id === valueId;
            return (
              <Pressable
                accessibilityLabel={`Pick ${court.name}`}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                key={court.id}
                onPress={() => {
                  onSelect(court);
                  setOpen(false);
                }}
                style={({ pressed }) => [
                  styles.courtRow,
                  pressed && styles.pressed,
                ]}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={styles.courtRowName}>
                    {court.name}
                  </Text>
                  <Text numberOfLines={1} style={styles.courtRowMeta}>
                    {[
                      court.city,
                      court.distanceKm != null
                        ? `${(court.distanceKm * 0.621371).toFixed(1)} MI`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </Text>
                </View>
                {isLocal ? (
                  <Text style={styles.courtRowTag}>YOUR COURT</Text>
                ) : null}
                {active ? (
                  <Feather color={Colors.accent} name="check" size={15} />
                ) : null}
              </Pressable>
            );
          })}
          {term.length >= 2 && !searching && rows.length === 0 ? (
            <Text style={styles.courtEmpty}>NO COURTS FOUND</Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function LogGameView({
  currentUser,
  courts,
  bottom,
  preferredSport,
  preferredCourtId,
  preselectedOpponent,
  localCourtId,
  inSheet = false,
}: {
  currentUser: ReturnType<typeof useApp>["currentUser"];
  courts: ReturnType<typeof useApp>["courts"];
  bottom: number;
  preferredSport: CourtSport | null;
  preferredCourtId: string | null;
  preselectedOpponent: Player | null;
  localCourtId: string | null;
  inSheet?: boolean;
}) {
  const { isFriend, getFriendsList, localCourt } = useApp();

  // Default court: preferredCourtId > localCourtId > empty
  const supportedCourts = useMemo(
    () =>
      courts.filter(
        (court) => court.sport === "BASKETBALL" || court.sport === "PICKLEBALL",
      ),
    [courts],
  );
  const defaultCourtId =
    preferredCourtId ?? localCourtId ?? supportedCourts[0]?.id ?? "";
  const defaultCourt = supportedCourts.find(
    (court) => court.id === defaultCourtId,
  );
  const defaultSport: CourtSport =
    defaultCourt?.sport ?? preferredSport ?? "BASKETBALL";

  const [form, setForm] = useState<GameLog>({
    sport: defaultSport,
    myScore: "",
    theirScore: "",
    courtId: defaultCourtId,
    playedOn: localDateValue(),
    teamSize: 1,
    teammates: [],
    opponents: [],
  });
  const [reviewGame, setReviewGame] = useState<GameLog | null>(null);
  const [reviewSeconds, setReviewSeconds] = useState(5);
  const [submittedGame, setSubmittedGame] = useState<GameLog | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showOpponentPicker, setShowOpponentPicker] = useState(false);
  const [activePlayerSlot, setActivePlayerSlot] = useState<PlayerSlot>({
    side: "theirs",
    index: 0,
  });
  const [opponentQuery, setOpponentQuery] = useState("");
  const [opponentSuggestions, setOpponentSuggestions] = useState<Player[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [clientRequestId, setClientRequestId] = useState(() =>
    Crypto.randomUUID(),
  );

  // The sport toggle is the creator's call once they've touched it. Until then,
  // the game follows its court: fill in the creator's local court on open, and
  // keep the sport in agreement with a chosen court (including one that hydrates
  // after the screen mounts).
  const sportTouchedRef = React.useRef(false);
  useEffect(() => {
    const nextCourtId =
      form.courtId || (sportTouchedRef.current ? "" : defaultCourtId);
    if (!nextCourtId) return;
    const selectedCourt = supportedCourts.find(
      (court) => court.id === nextCourtId,
    );
    if (!selectedCourt) return;
    setForm((current) => {
      const sport = sportTouchedRef.current ? current.sport : selectedCourt.sport;
      return current.courtId === nextCourtId && current.sport === sport
        ? current
        : { ...current, courtId: nextCourtId, sport };
    });
  }, [defaultCourtId, form.courtId, supportedCourts]);

  const toggleSport = () => {
    sportTouchedRef.current = true;
    setForm((current) => {
      const next: CourtSport =
        current.sport === "PICKLEBALL" ? "BASKETBALL" : "PICKLEBALL";
      const court = supportedCourts.find((c) => c.id === current.courtId);
      return {
        ...current,
        sport: next,
        courtId: court && court.sport === next ? current.courtId : "",
      };
    });
  };

  const selectCourt = (court: Court) => {
    setForm((current) => ({
      ...current,
      courtId: court.id,
      sport: sportTouchedRef.current ? current.sport : court.sport,
    }));
  };

  // Apply the deep-linked opponent once it resolves from the loaded player
  // list. Never clobbers a manually chosen (or cleared) opponent.
  const appliedOpponentIdRef = React.useRef<string | null>(null);
  useEffect(() => {
    if (!preselectedOpponent) return;
    if (appliedOpponentIdRef.current === preselectedOpponent.id) return;
    appliedOpponentIdRef.current = preselectedOpponent.id;
    setForm((f) =>
      f.opponents.length > 0
        ? f
        : {
            ...f,
            opponents: [preselectedOpponent],
          },
    );
  }, [preselectedOpponent]);

  const myScoreNum = Number(form.myScore);
  const theirScoreNum = Number(form.theirScore);
  const scoresEntered = form.myScore !== "" && form.theirScore !== "";
  const scoresValid =
    scoresEntered &&
    Number.isInteger(myScoreNum) &&
    Number.isInteger(theirScoreNum) &&
    myScoreNum >= 0 &&
    theirScoreNum >= 0;
  const isTie = scoresValid && myScoreNum === theirScoreNum;
  const isWin = scoresValid && myScoreNum > theirScoreNum;
  const isLoss = scoresValid && myScoreNum < theirScoreNum;

  const chosenPlayers = [...form.teammates, ...form.opponents];
  const chosenIds = chosenPlayers.map((player) => player.id);
  const rosterComplete =
    form.teammates.length === form.teamSize - 1 &&
    form.opponents.length === form.teamSize &&
    new Set(chosenIds).size === chosenIds.length &&
    !chosenIds.includes(currentUser.id);
  const canSubmit =
    form.sport !== "" &&
    scoresValid &&
    !isTie &&
    rosterComplete &&
    form.courtId !== "" &&
    isValidPlayedOn(form.playedOn) &&
    !submitting;
  const selectedCourt = supportedCourts.find(
    (court) => court.id === form.courtId,
  );
  const { roster: activeCourtPlayers } = usePresence(selectedCourt?.id);
  const courtPlayers = useMemo(
    () => activeCourtPlayers.filter((player) => player.id !== currentUser.id),
    [activeCourtPlayers, currentUser.id],
  );

  const handleReview = () => {
    if (!canSubmit || !form.opponents[0]?.id || !form.courtId) return;
    setSubmitError(null);
    setReviewSeconds(5);
    setReviewGame({ ...form });
  };

  const handleSubmit = async () => {
    if (!reviewGame || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    let result: { ok: boolean; matchId?: string } = { ok: false };
    try {
      result =
        reviewGame.teamSize === 1
          ? await logGame({
              courtId: reviewGame.courtId,
              createdBy: currentUser.id,
              myScore: Number(reviewGame.myScore),
              theirScore: Number(reviewGame.theirScore),
              opponentId: reviewGame.opponents[0].id,
              sport: reviewGame.sport as CourtSport,
              playedOn: reviewGame.playedOn,
              clientRequestId,
            })
          : await logTeamGame({
              courtId: reviewGame.courtId,
              teamAIds: [
                currentUser.id,
                ...reviewGame.teammates.map((player) => player.id),
              ],
              teamBIds: reviewGame.opponents.map((player) => player.id),
              scoreA: Number(reviewGame.myScore),
              scoreB: Number(reviewGame.theirScore),
              playedOn: reviewGame.playedOn,
              clientRequestId,
            });
    } catch (e) {
      console.warn("logGame failed", e);
      result = { ok: false };
    }
    setSubmitting(false);
    if (!result.ok) {
      // Keep the form intact so the user can retry.
      setSubmitError("COULD NOT LOG GAME — NOTHING WAS SAVED. TRY AGAIN.");
      setReviewGame(null);
      return;
    }
    // The score is pending. The opponent receives a review action; ratings and
    // public history remain unchanged until confirmation.
    setSubmittedGame({ ...reviewGame });
    setReviewGame(null);
    setClientRequestId(Crypto.randomUUID());
    setTimeout(() => setSubmittedGame(null), 5000);
    setForm({
      sport: defaultSport,
      myScore: "",
      theirScore: "",
      courtId: defaultCourtId,
      playedOn: localDateValue(),
      teamSize: 1,
      teammates: [],
      opponents: [],
    });
  };

  useEffect(() => {
    if (!reviewGame) return;
    if (reviewSeconds <= 0) {
      if (!submitting) void handleSubmit();
      return;
    }
    const timer = setTimeout(
      () => setReviewSeconds((seconds) => Math.max(0, seconds - 1)),
      1000,
    );
    return () => clearTimeout(timer);
  }, [reviewGame, reviewSeconds, submitting]);

  const placePlayer = (player: Player, slot = activePlayerSlot) => {
    setForm((current) => {
      const alreadyChosen = [...current.teammates, ...current.opponents].some(
        (chosen) => chosen.id === player.id,
      );
      if (player.id === currentUser.id || alreadyChosen) return current;
      const key = slot.side === "mine" ? "teammates" : "opponents";
      const next = [...current[key]];
      next[slot.index] = player;
      return { ...current, [key]: next.filter(Boolean) };
    });
    setOpponentQuery("");
    setShowOpponentPicker(false);
  };

  const clearPlayer = (slot: PlayerSlot) => {
    setForm((current) => {
      const key = slot.side === "mine" ? "teammates" : "opponents";
      return {
        ...current,
        [key]: current[key].filter((_, index) => index !== slot.index),
      };
    });
  };

  useEffect(() => {
    if (!scannerOpen) return;
    let handled = false;
    const subscription = CameraView.onModernBarcodeScanned(({ data }) => {
      if (handled) return;
      const playerId = parsePlayerQrCode(data);
      handled = true;
      subscription.remove();
      void CameraView.dismissScanner();
      setScannerOpen(false);
      if (!playerId || playerId === currentUser.id) {
        setSubmitError("THAT IS NOT ANOTHER LOCALCHECK PLAYER QR CODE.");
        return;
      }
      void fetchProfile(playerId).then((player) => {
        if (!player) {
          setSubmitError("PLAYER NOT FOUND. TRY ANOTHER QR CODE.");
          return;
        }
        placePlayer(player);
      });
    });
    void CameraView.launchScanner({
      barcodeTypes: ["qr"],
      isGuidanceEnabled: true,
      isHighlightingEnabled: true,
    }).catch(() => {
      subscription.remove();
      setScannerOpen(false);
      setSubmitError("QR SCANNER UNAVAILABLE. SELECT THE PLAYER INSTEAD.");
    });
    return () => subscription.remove();
  }, [activePlayerSlot, currentUser.id, scannerOpen]);

  const handleScanOpponent = async () => {
    setSubmitError(null);
    if (Platform.OS === "web" || !CameraView.isModernBarcodeScannerAvailable) {
      setSubmitError("QR SCANNING IS AVAILABLE IN THE IOS APP.");
      return;
    }
    const permission = cameraPermission?.granted
      ? cameraPermission
      : await requestCameraPermission();
    if (!permission.granted) {
      setSubmitError("CAMERA ACCESS IS NEEDED TO SCAN A PLAYER QR CODE.");
      return;
    }
    setScannerOpen(true);
  };

  // Opponent typeahead: search real players via Supabase
  const friends = getFriendsList();
  const query = opponentQuery.toLowerCase().trim();
  useEffect(() => {
    let mounted = true;
    const courtIds = new Set(courtPlayers.map((player) => player.id));
    const friendIds = new Set(friends.map((friend) => friend.id));
    const prioritize = (players: Player[]) => {
      const unique = new Map<string, Player>();
      players.forEach((player) => {
        if (player.id !== currentUser.id && !unique.has(player.id)) {
          unique.set(player.id, player);
        }
      });
      return Array.from(unique.values())
        .sort((a, b) => {
          const score = (player: Player) =>
            (courtIds.has(player.id) ? 2 : 0) +
            (friendIds.has(player.id) ? 1 : 0);
          return score(b) - score(a);
        })
        .slice(0, 10);
    };
    if (query.length === 0) {
      setOpponentSuggestions(
        prioritize(courtPlayers.length > 0 ? courtPlayers : friends),
      );
      return;
    }
    searchPlayers(query).then((results) => {
      if (!mounted) return;
      setOpponentSuggestions(prioritize(results));
    });
    return () => {
      mounted = false;
    };
  }, [query, friends, courtPlayers, currentUser.id]);

  const availableSuggestions = opponentSuggestions.filter(
    (player) => !chosenIds.includes(player.id),
  );

  const openPlayerPicker = (slot: PlayerSlot) => {
    setActivePlayerSlot(slot);
    setSubmitError(null);
    setOpponentQuery("");
    setShowOpponentPicker(true);
  };

  const renderPlayerSlot = (slot: PlayerSlot, placeholder: string) => {
    const roster = slot.side === "mine" ? form.teammates : form.opponents;
    const player = roster[slot.index];
    const pickerActive =
      showOpponentPicker &&
      activePlayerSlot.side === slot.side &&
      activePlayerSlot.index === slot.index;
    return (
      <View key={`${slot.side}-${slot.index}`}>
        <View style={styles.opponentTriggerShell}>
          <Pressable
            accessibilityLabel={`Scan ${placeholder} player QR code`}
            accessibilityRole="button"
            onPress={() => {
              setActivePlayerSlot(slot);
              void handleScanOpponent();
            }}
            style={styles.scanOpponent}
          >
            <Feather color={Colors.accent} name="maximize" size={17} />
          </Pressable>
          {pickerActive ? (
            <View style={styles.opponentTriggerMain}>
              <Ionicons color={Colors.muted} name="search" size={15} />
              <TextInput
                accessibilityLabel={`Search ${placeholder.toLowerCase()}`}
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
                onChangeText={setOpponentQuery}
                placeholder={`Search ${placeholder.toLowerCase()}`}
                placeholderTextColor={Colors.mutedDark}
                style={styles.opponentInlineInput}
                value={opponentQuery}
              />
              <Pressable
                accessibilityLabel="Close player search"
                hitSlop={8}
                onPress={() => setShowOpponentPicker(false)}
              >
                <Ionicons color={Colors.muted} name="close" size={17} />
              </Pressable>
            </View>
          ) : (
            <Pressable
              accessibilityLabel={
                player ? `Change ${player.name}` : `Select ${placeholder}`
              }
              accessibilityRole="button"
              accessibilityState={{ expanded: false }}
              onPress={() => openPlayerPicker(slot)}
              style={styles.opponentTriggerMain}
            >
              <Text
                numberOfLines={1}
                style={
                  player
                    ? styles.opponentSelectedText
                    : styles.opponentPlaceholder
                }
              >
                {player?.name.toUpperCase() ?? placeholder}
              </Text>
              <Ionicons color={Colors.muted} name="chevron-down" size={16} />
            </Pressable>
          )}
          {player && !pickerActive ? (
            <Pressable
              accessibilityLabel={`Remove ${player.name}`}
              accessibilityRole="button"
              onPress={() => clearPlayer(slot)}
              style={styles.clearOpponent}
            >
              <Ionicons color={Colors.muted} name="close" size={17} />
            </Pressable>
          ) : null}
        </View>

        {pickerActive ? (
          <View style={styles.opponentDropdown}>
            <Text style={styles.opponentSection}>
              {query
                ? "BEST MATCHES"
                : selectedCourt && courtPlayers.length > 0
                  ? `AT ${selectedCourt.shortName ?? selectedCourt.name}`
                  : "YOUR FRIENDS"}
            </Text>
            {availableSuggestions.map((suggestion) => (
              <Pressable
                key={suggestion.id}
                onPress={() => placePlayer(suggestion, slot)}
                style={styles.opponentOption}
              >
                <PlayerAvatar
                  initials={suggestion.avatar}
                  name={suggestion.name}
                  playerId={suggestion.id}
                  size={28}
                />
                <View style={styles.opponentOptionInfo}>
                  <Text numberOfLines={1} style={styles.opponentOptionName}>
                    {suggestion.name.toUpperCase()}
                  </Text>
                  <Text style={styles.opponentOptionMeta}>
                    {suggestion.tier} · {suggestion.elo} ELO
                  </Text>
                </View>
                {isFriend(suggestion.id) ? (
                  <View style={styles.opponentFriendBadge}>
                    <Text style={styles.opponentFriendBadgeText}>FRIEND</Text>
                  </View>
                ) : null}
              </Pressable>
            ))}
            {availableSuggestions.length === 0 ? (
              <Text style={styles.opponentEmpty}>
                {query
                  ? "No players found"
                  : "No available players at this court"}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
    );
  };

  if (reviewGame) {
    const reviewCourt = supportedCourts.find(
      (court) => court.id === reviewGame.courtId,
    );
    return (
      <View style={styles.successState}>
        <CountdownRing seconds={reviewSeconds} />
        <Text style={styles.successTitle}>REVIEW SCORE</Text>
        <Text style={styles.successSub}>
          Check the matchup. It sends automatically when the timer ends.
        </Text>
        <View style={styles.successCard}>
          <View style={styles.successCardHeader}>
            <Text numberOfLines={1} style={styles.successCourt}>
              {reviewGame.sport === "BASKETBALL" ? "BB" : "PB"}
              {` · ${reviewCourt?.shortName || reviewCourt?.name || "COURT"}`}
            </Text>
            <Text style={styles.reviewDate}>{reviewGame.playedOn}</Text>
          </View>
          <View style={styles.successScoreRow}>
            <View style={styles.reviewPlayer}>
              <Text numberOfLines={1} style={styles.successPlayerName}>
                {reviewGame.teamSize === 1
                  ? currentUser.name
                  : [currentUser, ...reviewGame.teammates]
                      .map((player) => player.name.split(" ")[0])
                      .join(" · ")}
              </Text>
              <Text style={styles.successScore}>{reviewGame.myScore}</Text>
            </View>
            <Text style={styles.successDash}>–</Text>
            <View style={styles.reviewPlayer}>
              <Text numberOfLines={1} style={styles.successPlayerName}>
                {reviewGame.opponents
                  .map((player) => player.name.split(" ")[0])
                  .join(" · ")}
              </Text>
              <Text style={styles.successScore}>{reviewGame.theirScore}</Text>
            </View>
          </View>
        </View>
        <View style={styles.reviewActions}>
          <Pressable
            accessibilityLabel="Edit score"
            accessibilityRole="button"
            disabled={submitting}
            onPress={() => setReviewGame(null)}
            style={styles.reviewEditButton}
          >
            <Text style={styles.reviewEditText}>EDIT</Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Confirm and send score"
            accessibilityRole="button"
            accessibilityState={{ busy: submitting }}
            disabled={submitting}
            onPress={() => void handleSubmit()}
            style={styles.reviewConfirmButton}
          >
            <Text style={styles.reviewConfirmText}>
              {submitting ? "SENDING…" : "CONFIRM"}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (submittedGame) {
    const submittedCourt = supportedCourts.find(
      (court) => court.id === submittedGame.courtId,
    );
    return (
      <View style={styles.successState}>
        <View style={styles.successIcon}>
          <Feather color={Colors.black} name="check" size={28} />
        </View>
        <Text style={styles.successTitle}>SCORE SENT FOR REVIEW</Text>
        <Text style={styles.successSub}>
          {submittedGame.teamSize === 1
            ? "Your opponent can confirm or object. No rating changes yet."
            : "Every player can review the result. No rating changes yet."}
        </Text>
        <View style={styles.successCard}>
          <View style={styles.successCardHeader}>
            <Text numberOfLines={1} style={styles.successCourt}>
              {submittedGame.sport === "BASKETBALL" ? "BB" : "PB"}
              {` · ${submittedCourt?.shortName || submittedCourt?.name || "COURT"}`}
            </Text>
            <View style={styles.pendingBadge}>
              <Text style={styles.pendingText}>PENDING</Text>
            </View>
          </View>
          <View style={styles.successScoreRow}>
            <View style={styles.successPlayer}>
              <Text numberOfLines={1} style={styles.successPlayerName}>
                {submittedGame.teamSize === 1
                  ? currentUser.name
                  : [currentUser, ...submittedGame.teammates]
                      .map((player) => player.name.split(" ")[0])
                      .join(" · ")}
              </Text>
              <Text style={styles.successScore}>{submittedGame.myScore}</Text>
            </View>
            <Text style={styles.successDash}>–</Text>
            <View style={[styles.successPlayer, styles.successPlayerRight]}>
              <Text numberOfLines={1} style={styles.successPlayerName}>
                {submittedGame.opponents
                  .map((player) => player.name.split(" ")[0])
                  .join(" · ")}
              </Text>
              <Text style={styles.successScore}>
                {submittedGame.theirScore}
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAwareScrollViewCompat
      bottomOffset={112}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        padding: 20,
        gap: 20,
        // Must come AFTER `padding` (shorthand would reset it to 20) so the
        // submit button clears the bottom tab bar: 84px fixed bar on web
        // (50 + 34), safe-area inset + bar height on native. +20 breathing room.
        paddingBottom: inSheet
          ? 32
          : 20 + (Platform.OS === "web" ? 84 : bottom + 80),
      }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
    >
      {/* Sport drives which courts the picker suggests, so it leads the row. */}
      <View style={styles.fieldRow}>
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>SPORT</Text>
          <SportToggle sport={form.sport} onToggle={toggleSport} />
        </View>
        <View style={[styles.fieldGroup, styles.courtField]}>
          <Text style={styles.fieldLabel}>COURT</Text>
          <CourtPickerField
            courts={supportedCourts}
            localCourt={localCourt}
            sport={form.sport}
            valueId={form.courtId}
            onSelect={selectCourt}
          />
        </View>
      </View>

      <View style={styles.fieldRow}>
        <View style={[styles.fieldGroup, styles.dateField]}>
          <Text style={styles.fieldLabel}>DATE</Text>
          <GameDateField
            onChange={(playedOn) =>
              setForm((current) => ({ ...current, playedOn }))
            }
            value={form.playedOn}
          />
        </View>
        <View style={[styles.fieldGroup, styles.formatField]}>
          <Text style={styles.fieldLabel}>FORMAT</Text>
          <View accessibilityRole="tablist" style={styles.formatOptions}>
            {([1, 2, 3, 5] as const).map((size) => (
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected: form.teamSize === size }}
                key={size}
                onPress={() =>
                  setForm((current) => ({
                    ...current,
                    teamSize: size,
                    teammates: current.teammates.slice(0, size - 1),
                    opponents: current.opponents.slice(0, size),
                  }))
                }
                style={[
                  styles.formatOption,
                  form.teamSize === size && styles.formatOptionActive,
                ]}
              >
                <Text
                  style={[
                    styles.formatOptionText,
                    form.teamSize === size && styles.formatOptionTextActive,
                  ]}
                >
                  {size}V{size}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>

      {/* Player selection uses one shared typeahead/QR contract for solo and teams. */}
      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>
          {form.teamSize === 1 ? "OPPONENT" : "PLAYERS"}
        </Text>
        {form.teamSize > 1 ? (
          <View style={styles.rosterGroup}>
            <Text style={styles.rosterLabel}>YOUR TEAM</Text>
            <View style={styles.lockedPlayer}>
              <PlayerAvatar
                initials={currentUser.avatar}
                name={currentUser.name}
                playerId={currentUser.id}
                size={28}
              />
              <Text numberOfLines={1} style={styles.lockedPlayerName}>
                {currentUser.name.toUpperCase()}
              </Text>
              <Text style={styles.youBadge}>YOU</Text>
            </View>
            {Array.from({ length: form.teamSize - 1 }, (_, index) =>
              renderPlayerSlot(
                { side: "mine", index },
                `ADD TEAMMATE ${index + 1}`,
              ),
            )}
            <Text style={[styles.rosterLabel, styles.rosterLabelOpponents]}>
              OTHER TEAM
            </Text>
            {Array.from({ length: form.teamSize }, (_, index) =>
              renderPlayerSlot(
                { side: "theirs", index },
                `ADD OPPONENT ${index + 1}`,
              ),
            )}
          </View>
        ) : (
          renderPlayerSlot({ side: "theirs", index: 0 }, "SELECT OPPONENT")
        )}
      </View>

      {/* Score */}
      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>FINAL SCORE</Text>
        <View style={styles.scoreRow}>
          <View style={styles.scoreBlock}>
            <Text style={styles.scorePlayerLabel}>
              {form.teamSize === 1
                ? currentUser.name.split(" ")[0].toUpperCase()
                : "YOUR TEAM"}
            </Text>
            <TextInput
              style={[
                styles.scoreInput,
                isWin && styles.scoreInputWin,
                isLoss && styles.scoreInputLoss,
              ]}
              value={form.myScore}
              accessibilityLabel={`${currentUser.name} final score`}
              onChangeText={(v) =>
                setForm((f) => ({ ...f, myScore: v.replace(/\D/g, "") }))
              }
              keyboardType="number-pad"
              maxLength={3}
              placeholder="—"
              placeholderTextColor={Colors.mutedDark}
            />
          </View>
          <Text style={styles.scoreDash}>:</Text>
          <View style={styles.scoreBlock}>
            <Text style={styles.scorePlayerLabel}>
              {form.teamSize === 1 ? "OPPONENT" : "OTHER TEAM"}
            </Text>
            <TextInput
              style={[
                styles.scoreInput,
                isLoss && styles.scoreInputWin,
                isWin && styles.scoreInputLoss,
              ]}
              value={form.theirScore}
              accessibilityLabel="Opponent final score"
              onChangeText={(v) =>
                setForm((f) => ({ ...f, theirScore: v.replace(/\D/g, "") }))
              }
              keyboardType="number-pad"
              maxLength={3}
              placeholder="—"
              placeholderTextColor={Colors.mutedDark}
            />
          </View>
        </View>
        {(isWin || isLoss) && (
          <Text
            style={[
              styles.resultHint,
              { color: isWin ? Colors.win : Colors.loss },
            ]}
          >
            {isWin ? "WIN — POSITIVE ELO CHANGE" : "LOSS — NEGATIVE ELO CHANGE"}
          </Text>
        )}
        {isTie && (
          <Text style={[styles.resultHint, { color: Colors.loss }]}>
            TIES CAN'T BE LOGGED — ENTER A WINNING SCORE
          </Text>
        )}
      </View>

      {/* Submit */}
      {submitError && <Text style={styles.submitError}>{submitError}</Text>}
      <Pressable
        accessibilityLabel="Log game for opponent review"
        accessibilityRole="button"
        accessibilityState={{
          busy: submitting,
          disabled: !canSubmit || submitting,
        }}
        style={[
          styles.submitBtn,
          (!canSubmit || submitting) && styles.submitBtnDisabled,
        ]}
        onPress={handleReview}
        disabled={!canSubmit || submitting}
      >
        <Text
          style={[
            styles.submitBtnText,
            (!canSubmit || submitting) && styles.submitBtnTextDisabled,
          ]}
        >
          {submitting ? "LOGGING..." : "LOG GAME"}
        </Text>
      </Pressable>
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  headerTools: { flexDirection: "row", alignItems: "center", gap: 8 },
  logGameAction: {
    minHeight: 30,
    paddingHorizontal: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    borderRadius: Radius.xs,
    backgroundColor: Colors.accent,
  },
  logGameActionText: {
    fontFamily: Typography.bodyBold,
    fontSize: 8,
    color: Colors.black,
    letterSpacing: 1,
  },
  pressed: { opacity: 0.72 },

  // ── Header ──
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: Colors.surface,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  headerEyebrow: {
    fontFamily: Typography.bodyBold,
    fontSize: 9,
    color: Colors.accent,
    letterSpacing: 2.5,
    textTransform: "uppercase" as const,
    marginBottom: 2,
  },
  headerTitle: {
    fontFamily: Typography.heading,
    fontSize: 32,
    color: Colors.text,
    letterSpacing: 0.5,
    lineHeight: 34,
  },
  headerSub: {
    fontFamily: Typography.bodyMedium,
    fontSize: 9,
    color: Colors.muted,
    letterSpacing: 2,
    textTransform: "uppercase" as const,
    marginTop: 2,
  },
  myRankBadge: {
    alignItems: "center",
    paddingBottom: 2,
  },
  myRankNum: {
    fontFamily: Typography.heading,
    fontSize: 22,
    color: Colors.accent,
    letterSpacing: 0.5,
    lineHeight: 24,
  },
  myRankNumDim: {
    color: Colors.muted,
  },
  myRankLabel: {
    fontFamily: Typography.bodyMedium,
    fontSize: 8,
    color: Colors.muted,
    letterSpacing: 1.5,
    textTransform: "uppercase" as const,
  },

  // ── Inline private position indicator ──
  hiddenLeaderRow: {
    backgroundColor: Colors.surfaceHigh,
    opacity: 0.48,
  },
  yourPositionRank: {
    fontFamily: Typography.heading,
    fontSize: 16,
    color: Colors.muted,
    width: 28,
    textAlign: "center" as const,
  },
  hiddenAvatar: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  yourPositionText: {
    fontFamily: Typography.heading,
    fontSize: 13,
    color: Colors.muted,
    letterSpacing: 0.5,
  },
  yourPositionSub: {
    ...TextStyles.caption,
    color: Colors.mutedDark,
    letterSpacing: 0,
    textTransform: "uppercase" as const,
    marginTop: 3,
  },
  hiddenBadge: {
    fontFamily: Typography.bodyBold,
    fontSize: 8,
    color: Colors.mutedDark,
    letterSpacing: 1.2,
  },

  // ── Tabs ──
  tabRow: {
    flexDirection: "row",
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tabBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 3,
    borderBottomColor: "transparent",
  },
  tabBtnActive: { borderBottomColor: Colors.accent },
  tabBtnText: {
    fontFamily: Typography.heading,
    fontSize: 12,
    color: Colors.muted,
    letterSpacing: 2,
  },
  tabBtnTextActive: { color: Colors.text },

  // ── Filters ──
  filterRow: {
    // 14px above the controls, then 7px below + 7px inside the court row:
    // the visible gap to the court name is the same 14px on both sides.
    minHeight: 61,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 7,
    flexDirection: "row",
    alignItems: "stretch",
    gap: 8,
  },
  sportFilter: {
    width: 72,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.accentBorder,
    borderRadius: 10,
    backgroundColor: Colors.accentGhost,
  },
  scopeRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    minHeight: 40,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    backgroundColor: Colors.surface,
  },
  scopeSeg: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scopeSegActive: {
    backgroundColor: Colors.surfaceHigh,
  },
  scopeSegText: {
    fontFamily: Typography.bodyBold,
    fontSize: 11,
    color: Colors.muted,
    letterSpacing: 1.2,
  },
  scopeSegTextActive: { color: Colors.text },
  scopeLabel: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 6,
    minHeight: 28,
    paddingHorizontal: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  scopeDot: { width: 6, height: 6, borderRadius: 3 },
  scopeLabelText: {
    fontFamily: Typography.bodyBold,
    fontSize: 10,
    color: Colors.muted,
    letterSpacing: 2,
    textTransform: "uppercase" as const,
  },

  // ── Leaderboard Row ──
  leaderRow: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  leaderRowFirst: { backgroundColor: `${Colors.accent}08` },
  leaderAvatarFirst: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  rank: {
    fontFamily: Typography.headingRegular,
    fontSize: 14,
    color: Colors.mutedDark,
    width: 14,
    textAlign: "left" as const,
  },
  playerInfo: { flex: 1, minWidth: 0, justifyContent: "center" },
  playerNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 1,
  },
  playerName: {
    fontFamily: Typography.headingRegular,
    fontSize: 15,
    lineHeight: 19,
    color: Colors.text,
    letterSpacing: 0,
    textTransform: "uppercase",
    flex: 1,
  },
  playerBadges: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    flexWrap: "wrap",
  },
  tierText: {
    fontFamily: Typography.bodyBold,
    fontSize: 9,
    lineHeight: 11,
    letterSpacing: 0.6,
    textTransform: "uppercase" as const,
  },
  rankedText: {
    ...TextStyles.labelSmall,
    color: Colors.accent,
    letterSpacing: 0.6,
  },
  sportText: {
    ...TextStyles.labelSmall,
    letterSpacing: 0.6,
    textTransform: "uppercase" as const,
  },
  wlText: {
    ...TextStyles.caption,
    fontSize: 9,
    lineHeight: 11,
    color: Colors.muted,
    letterSpacing: 0,
  },
  eloBlock: { alignItems: "flex-end" },
  eloVal: {
    fontFamily: Typography.heading,
    fontSize: 20,
    color: Colors.text,
    lineHeight: 22,
  },
  eloValHidden: { color: Colors.textSecondary },
  eloLbl: {
    fontFamily: Typography.bodyMedium,
    fontSize: 8,
    color: Colors.muted,
    letterSpacing: 2,
    textTransform: "uppercase" as const,
  },
  leaderFriendBadge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderWidth: 0.5,
    borderColor: Colors.win,
    borderRadius: 2,
  },
  leaderFriendBadgeText: {
    fontFamily: Typography.bodyBold,
    fontSize: 7,
    color: Colors.win,
    letterSpacing: 0.5,
  },
  emptyState: {
    paddingVertical: 64,
    alignItems: "center",
  },
  emptyText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 12,
    color: Colors.muted,
    letterSpacing: 2,
    textTransform: "uppercase" as const,
  },

  // ── Log Game ──
  fieldGroup: { gap: 8 },
  fieldRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    zIndex: 2,
  },
  courtField: { flex: 1, minWidth: 0 },
  dateField: { flex: 1, minWidth: 0 },
  formatField: { flex: 1, minWidth: 0 },
  fieldLabel: {
    fontFamily: Typography.heading,
    fontSize: 11,
    color: Colors.muted,
    letterSpacing: 2.5,
    textTransform: "uppercase" as const,
  },
  sportToggle: {
    minHeight: 48,
    minWidth: 62,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderWidth: 1,
    borderColor: Colors.accentBorder,
    borderRadius: Radius.xs,
    backgroundColor: Colors.accentDim,
  },
  sportToggleDot: { width: 8, height: 8, borderRadius: 4 },
  sportToggleText: {
    fontFamily: Typography.heading,
    fontSize: 13,
    color: Colors.text,
    letterSpacing: 1,
  },
  courtTrigger: {
    minHeight: 48,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderRadius: Radius.xs,
    backgroundColor: Colors.surface,
  },
  courtTriggerValue: {
    flex: 1,
    fontFamily: Typography.bodySemiBold,
    fontSize: 14,
    color: Colors.text,
    letterSpacing: 0.4,
  },
  courtTriggerPlaceholder: {
    flex: 1,
    fontFamily: Typography.bodyMedium,
    fontSize: 14,
    color: Colors.muted,
  },
  courtPanel: {
    marginTop: 6,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderRadius: Radius.xs,
    backgroundColor: Colors.surface,
  },
  courtSearch: {
    minHeight: 44,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  courtSearchInput: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 0,
    fontFamily: Typography.bodyMedium,
    fontSize: 13,
    color: Colors.text,
  },
  courtSectionLabel: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 2,
    fontFamily: Typography.bodyBold,
    fontSize: 9,
    color: Colors.muted,
    letterSpacing: 1.6,
  },
  courtRow: {
    minHeight: 52,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  courtRowName: {
    fontFamily: Typography.bodySemiBold,
    fontSize: 13,
    color: Colors.text,
    letterSpacing: 0.3,
  },
  courtRowMeta: {
    marginTop: 2,
    fontFamily: Typography.bodyMedium,
    fontSize: 11,
    color: Colors.muted,
    letterSpacing: 0.4,
  },
  courtRowTag: {
    fontFamily: Typography.bodyBold,
    fontSize: 8,
    color: Colors.accent,
    letterSpacing: 1,
  },
  courtEmpty: {
    padding: 16,
    fontFamily: Typography.bodyMedium,
    fontSize: 11,
    color: Colors.muted,
    letterSpacing: 0.6,
    textAlign: "center",
  },
  formatOptions: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "stretch",
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderRadius: Radius.xs,
    backgroundColor: Colors.surface,
  },
  formatOption: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  formatOptionActive: { backgroundColor: Colors.accentDim },
  formatOptionText: {
    fontFamily: Typography.bodyBold,
    fontSize: 9,
    color: Colors.muted,
  },
  formatOptionTextActive: { color: Colors.accent },
  dateTrigger: {
    minHeight: 48,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderRadius: Radius.xs,
    backgroundColor: Colors.surface,
  },
  dateTriggerCopy: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  dateTriggerText: {
    fontFamily: Typography.bodySemiBold,
    fontSize: 14,
    color: Colors.text,
    letterSpacing: 0.8,
  },
  dateDone: {
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderRadius: Radius.xs,
    backgroundColor: Colors.surface,
  },
  dateDoneText: {
    fontFamily: Typography.bodyBold,
    fontSize: 11,
    color: Colors.accent,
    letterSpacing: 1.4,
  },
  rosterGroup: { gap: 8 },
  rosterLabel: {
    marginTop: 2,
    fontFamily: Typography.bodyBold,
    fontSize: 9,
    color: Colors.textSecondary,
    letterSpacing: 1.4,
  },
  rosterLabelOpponents: { marginTop: 8 },
  lockedPlayer: {
    minHeight: 48,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderRadius: Radius.xs,
    backgroundColor: Colors.surface,
  },
  lockedPlayerName: {
    flex: 1,
    fontFamily: Typography.bodySemiBold,
    fontSize: 13,
    color: Colors.text,
  },
  youBadge: {
    fontFamily: Typography.bodyBold,
    fontSize: 8,
    color: Colors.accent,
    letterSpacing: 1,
  },

  scoreRow: {
    width: "100%",
    maxWidth: 330,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  scoreBlock: { flex: 1, alignItems: "center", gap: 6 },
  scorePlayerLabel: {
    fontFamily: Typography.bodyMedium,
    fontSize: 9,
    color: Colors.muted,
    letterSpacing: 1.5,
    textTransform: "uppercase" as const,
  },
  scoreInput: {
    fontFamily: Typography.heading,
    fontSize: 48,
    color: Colors.text,
    textAlign: "center" as const,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    width: "100%",
    paddingVertical: 4,
    lineHeight: 56,
  },
  scoreInputWin: { borderBottomColor: Colors.win, color: Colors.win },
  scoreInputLoss: { borderBottomColor: Colors.loss, color: Colors.loss },
  scoreDash: {
    fontFamily: Typography.heading,
    fontSize: 28,
    color: Colors.mutedDark,
  },
  resultHint: {
    fontFamily: Typography.bodyBold,
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: "uppercase" as const,
    textAlign: "center" as const,
    marginTop: 4,
  },

  courtPills: { gap: 8, paddingVertical: 4 },
  courtPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 0.5,
    borderColor: Colors.border,
    borderRadius: Radius.xs,
    backgroundColor: Colors.surface,
  },
  courtPillActive: {
    borderColor: Colors.text,
    backgroundColor: Colors.surfaceHigh,
  },
  courtPillText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 12,
    color: Colors.muted,
  },
  courtPillTextActive: { color: Colors.text },

  submitBtn: {
    width: 220,
    alignSelf: "center",
    minHeight: 52,
    backgroundColor: Colors.accent,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.xs,
    marginTop: 8,
  },
  submitBtnDisabled: {
    backgroundColor: Colors.surfaceHigh,
  },
  submitBtnText: {
    fontFamily: Typography.heading,
    fontSize: 15,
    color: Colors.black,
    letterSpacing: 2,
  },
  submitBtnTextDisabled: { color: Colors.muted },
  submitError: {
    fontFamily: Typography.bodyBold,
    fontSize: 10,
    color: Colors.loss,
    letterSpacing: 1.5,
    textAlign: "center" as const,
    marginBottom: 10,
  },

  successState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 48,
  },
  reviewCountdown: {
    width: 54,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 27,
  },
  reviewCountdownValue: {
    fontFamily: Typography.headingBold,
    fontSize: 19,
    lineHeight: 22,
    color: Colors.accent,
  },
  successIcon: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 28,
    backgroundColor: Colors.accent,
  },
  successTitle: {
    fontFamily: Typography.heading,
    fontSize: 24,
    color: Colors.text,
    letterSpacing: 3,
  },
  successSub: {
    fontFamily: Typography.body,
    fontSize: 13,
    color: Colors.muted,
    textAlign: "center" as const,
  },
  successCard: {
    width: "100%",
    marginTop: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: 12,
    backgroundColor: Colors.surface,
  },
  successCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  successCourt: {
    flex: 1,
    minWidth: 0,
    fontFamily: Typography.bodySemiBold,
    fontSize: 12,
    lineHeight: 16,
    color: Colors.textSecondary,
  },
  pendingBadge: {
    minHeight: 24,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 3,
    backgroundColor: Colors.accentDim,
  },
  pendingText: {
    fontFamily: Typography.bodyBold,
    fontSize: 10,
    color: Colors.accent,
    letterSpacing: 1,
  },
  successScoreRow: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "flex-end",
  },
  successPlayer: { flex: 1, minWidth: 0, alignItems: "flex-start" },
  successPlayerRight: { alignItems: "flex-end" },
  reviewPlayer: { flex: 1, minWidth: 0, alignItems: "center" },
  successPlayerName: {
    maxWidth: "100%",
    fontFamily: Typography.bodySemiBold,
    fontSize: 12,
    lineHeight: 16,
    color: Colors.textSecondary,
    textTransform: "uppercase" as const,
  },
  successScore: {
    marginTop: 4,
    fontFamily: Typography.headingBold,
    fontSize: 38,
    lineHeight: 42,
    color: Colors.text,
  },
  successDash: {
    paddingBottom: 5,
    fontFamily: Typography.headingRegular,
    fontSize: 28,
    color: Colors.mutedDark,
  },
  reviewDate: {
    fontFamily: Typography.bodyMedium,
    fontSize: 10,
    color: Colors.muted,
    letterSpacing: 0.6,
  },
  reviewActions: {
    width: "100%",
    maxWidth: 330,
    flexDirection: "row",
    gap: 10,
  },
  reviewEditButton: {
    flex: 1,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surface,
  },
  reviewEditText: {
    fontFamily: Typography.bodyBold,
    fontSize: 11,
    color: Colors.textSecondary,
    letterSpacing: 1.4,
  },
  reviewConfirmButton: {
    flex: 1,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.sm,
    backgroundColor: Colors.accent,
  },
  reviewConfirmText: {
    fontFamily: Typography.bodyBold,
    fontSize: 11,
    color: Colors.black,
    letterSpacing: 1.4,
  },

  // Opponent selector
  opponentTriggerShell: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "stretch",
    overflow: "hidden",
    borderWidth: 0.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xs,
  },
  scanOpponent: {
    width: 48,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: Colors.border,
  },
  opponentTriggerMain: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    paddingLeft: 14,
    paddingRight: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  opponentInlineInput: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 0,
    fontFamily: Typography.bodyMedium,
    fontSize: 13,
    color: Colors.text,
  },
  clearOpponent: {
    width: 44,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: Colors.border,
  },
  opponentSelected: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  opponentSelectedText: {
    fontFamily: Typography.heading,
    fontSize: 14,
    color: Colors.text,
    letterSpacing: 0.5,
  },
  opponentPlaceholder: {
    fontFamily: Typography.body,
    fontSize: 14,
    color: Colors.mutedDark,
  },
  opponentDropdown: {
    borderWidth: 0.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    marginTop: 6,
    maxHeight: 280,
    overflow: "hidden",
  },
  opponentSearch: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  opponentSearchInput: {
    flex: 1,
    fontFamily: Typography.bodyMedium,
    fontSize: 13,
    color: Colors.text,
    paddingVertical: 2,
  },
  opponentSection: {
    fontFamily: Typography.bodyBold,
    fontSize: 9,
    color: Colors.muted,
    letterSpacing: 1.5,
    textTransform: "uppercase" as const,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
  },
  opponentOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  opponentOptionInfo: { flex: 1 },
  opponentOptionName: {
    fontFamily: Typography.bodyBold,
    fontSize: 13,
    color: Colors.text,
    letterSpacing: 0.3,
  },
  opponentOptionMeta: {
    fontFamily: Typography.bodyMedium,
    fontSize: 10,
    color: Colors.muted,
    marginTop: 1,
  },
  opponentFriendBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 0.5,
    borderColor: Colors.win,
  },
  opponentFriendBadgeText: {
    fontFamily: Typography.bodyBold,
    fontSize: 8,
    color: Colors.win,
    letterSpacing: 1,
  },
  opponentEmpty: {
    fontFamily: Typography.bodyMedium,
    fontSize: 12,
    color: Colors.muted,
    textAlign: "center",
    paddingVertical: 20,
  },
});
