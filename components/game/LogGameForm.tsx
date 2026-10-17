import { Feather, Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Crypto from "expo-crypto";
import { router, useFocusEffect } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  AppState,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { parsePlayerQrCode } from "@/components/ui/playerIdentity";
import { RecentDatePicker } from "@/components/ui/RecentDatePicker";
import { SearchField } from "@/components/ui/SearchField";
import { useBottomFloor } from "@/components/ui/TabFloor";
import { useToast } from "@/components/ui/Toast";
import { formatCardDate } from "@/components/match/gameCardModel";
import { ScoreCard } from "@/components/match/ScoreCard";
import { Colors, Radius } from "@/constants/colors";
import {
  Court,
  CourtSport,
  getSportColor,
  Player,
  playerRankLabel,
} from "@/constants/data";
import { TextStyles, Typography } from "@/constants/typography";
import { useApp } from "@/context/AppContext";
import { usePresence } from "@/context/CourtPresenceContext";
import { fetchProfile, searchCourtPlayersRecent, searchPlayers } from "@/services/profileService";
import { logGame, logTeamGame } from "@/services/gameService";
import { searchCourts } from "@/services/courtService";
import { logChallengeResult } from "@/services/challengeService";

/**
 * The Log Game form (moved out of the Compete tab so a player profile can
 * open it in a sheet, prefilled, without leaving the profile). Compete's Log
 * game tab and the profile's sheet both render this one form.
 */
// ─── Log Game ────────────────────────────────────────────────────────────────

type GameLog = {
  sport: CourtSport | "";
  myScore: string;
  theirScore: string;
  courtId: string;
  playedOn: string;
  teamSize: number;
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
  sport,
}: {
  value: string;
  onChange: (value: string) => void;
  sport: CourtSport | "";
}) {
  return <RecentDatePicker daysBack={7} onChange={onChange} sport={sport || null} value={value} />;
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
  selectedCourt,
  sport,
  valueId,
  onSelect,
}: {
  courts: Court[];
  localCourt: Court | null;
  /** The resolved court for `valueId`, including one picked from search that
   *  isn't in `courts` — so the field never blanks after a typeahead pick. */
  selectedCourt?: Court | null;
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
    (localCourt?.id === valueId ? localCourt : null) ??
    (selectedCourt?.id === valueId ? selectedCourt : null);

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
          {selected
            ? selected.shortName || selected.name
            : "Choose a court"}
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
            <SearchField
              variant="bare"
              autoFocus
              accessibilityLabel="Search courts"
              placeholder="Search courts"
              value={query}
              onChangeText={setQuery}
              onClear={() => setQuery("")}
              loading={searching}
            />
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
                    {court.shortName || court.name}
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

export function LogGameView({
  currentUser,
  courts,
  bottom: bottomProp,
  preferredSport,
  preferredCourtId,
  preselectedOpponent,
  challenge = null,
  localCourtId,
  hasLocalPlus,
  inSheet = false,
  onLogged,
}: {
  currentUser: ReturnType<typeof useApp>["currentUser"];
  courts: ReturnType<typeof useApp>["courts"];
  bottom: number;
  preferredSport: CourtSport | null;
  preferredCourtId: string | null;
  preselectedOpponent: Player | null;
  /** An accepted ranked challenge this game settles: opponent, court and day
   *  come from it, and logging goes through log_challenge_result so the
   *  challenge closes with the game. */
  challenge?: {
    id: string;
    opponentId: string;
    court: Court | null;
    playOn: string | null;
  } | null;
  localCourtId: string | null;
  /** Discovery search (any name, any court) is a LocalPlus perk. LocalLite
   * logging a game away from their own local court gets a narrower search
   * instead — see the opponent-typeahead effect below. */
  hasLocalPlus: boolean;
  inSheet?: boolean;
  /** Fires once the post-submit confirmation has had its moment on screen. */
  onLogged?: () => void;
}) {
  const { isFriend, getFriendsList, localCourt } = useApp();
  const insets = useSafeAreaInsets();
  // The parent passes 0 for the sheet case; on the tab it needs the real
  // inset so pinned actions clear the floating tab bar.
  const bottom = inSheet ? bottomProp : Math.max(bottomProp, insets.bottom);

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
  const { showToast } = useToast();
  // The court picked from typeahead search may not be in the nearby `courts`
  // array — hold onto the full object so the field, the review card, and the
  // submit all agree on which court is being logged.
  const [pickedCourt, setPickedCourt] = useState<Court | null>(null);
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
    setPickedCourt(court);
    setForm((current) => ({
      ...current,
      courtId: court.id,
      sport: sportTouchedRef.current ? current.sport : court.sport,
    }));
  };

  // A court is valid whether it came from the nearby list or from search.
  const courtForId = (id: string): Court | null =>
    supportedCourts.find((c) => c.id === id) ??
    (pickedCourt?.id === id ? pickedCourt : null) ??
    (localCourt?.id === id ? localCourt : null);

  const addPlayerRow = () => {
    setForm((current) => ({
      ...current,
      teamSize: Math.min(5, current.teamSize + 1),
    }));
  };

  const removePlayerRow = () => {
    setForm((current) => {
      const next = Math.max(1, current.teamSize - 1);
      return {
        ...current,
        teamSize: next,
        teammates: current.teammates.slice(0, next - 1),
        opponents: current.opponents.slice(0, next),
      };
    });
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

  // An accepted challenge fills in where and when once its court has loaded:
  // the day it was planned for, or today if that day is still ahead or is
  // older than the 7 days Log Game offers.
  const appliedChallengeRef = React.useRef<string | null>(null);
  useEffect(() => {
    if (!challenge?.court || appliedChallengeRef.current === challenge.id) return;
    appliedChallengeRef.current = challenge.id;
    selectCourt(challenge.court);
    const today = localDateValue();
    const weekAgo = localDateValue(new Date(Date.now() - 6 * 86_400_000));
    const playOn = challenge.playOn;
    setForm((current) => ({
      ...current,
      playedOn: playOn && playOn >= weekAgo && playOn <= today ? playOn : today,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challenge?.id, challenge?.court]);

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
  const selectedCourt = courtForId(form.courtId);
  const { roster: activeCourtPlayers } = usePresence(selectedCourt?.id);
  const courtPlayers = useMemo(
    () => activeCourtPlayers.filter((player) => player.id !== currentUser.id),
    [activeCourtPlayers, currentUser.id],
  );

  const handleReview = () => {
    Keyboard.dismiss();
    if (!canSubmit || !form.opponents[0]?.id || !form.courtId) return;
    setSubmitError(null);
    setReviewGame({ ...form });
  };

  const gameCardProps = (game: GameLog) => {
    const court = courtForId(game.courtId) ?? localCourt ?? null;
    const playerOf = (player: Player) => ({ id: player.id, name: player.name });
    return {
      courtName: court?.shortName || court?.name || "COURT",
      format: `${game.teamSize}V${game.teamSize}`,
      playedOn: game.playedOn,
      leftLabel: "YOUR TEAM",
      rightLabel: "OTHER TEAM",
      leftScore: game.myScore || "0",
      rightScore: game.theirScore || "0",
      leftPlayers: [
        { id: currentUser.id, name: currentUser.name },
        ...game.teammates.map(playerOf),
      ],
      rightPlayers: game.opponents.map(playerOf),
    };
  };

  const handleSubmit = async () => {
    if (!reviewGame || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    let result: { ok: boolean; matchId?: string } = { ok: false };
    try {
      const settlesChallenge =
        challenge != null &&
        reviewGame.teamSize === 1 &&
        reviewGame.opponents[0]?.id === challenge.opponentId;
      if (settlesChallenge && challenge) {
        // The game and the accepted challenge are one thing: the RPC logs the
        // 1v1 and closes the challenge together.
        const logged = await logChallengeResult({
          challengeId: challenge.id,
          myScore: Number(reviewGame.myScore),
          theirScore: Number(reviewGame.theirScore),
          courtId: reviewGame.courtId,
          playedOn: reviewGame.playedOn,
          clientRequestId,
        });
        result = logged.ok ? { ok: true, matchId: logged.value } : { ok: false };
      } else
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
    // Hide score (D30) is set right after the game exists; the game logs
    // either way, so a failure here only leaves the score visible.
    // The score is pending. The opponent receives a review action; ratings and
    // public history remain unchanged until confirmation.
    // A swipe-away toast instead of a 5-second confirmation screen; the
    // viewer lands on the leaderboard right away.
    const firstOpponent = reviewGame.opponents[0]?.name.split(" ")[0] ?? "Your opponent";
    showToast({
      title: "SCORE SENT",
      body:
        reviewGame.teamSize === 1
          ? `${firstOpponent} confirms or disputes it. No rating change until then.`
          : "Any player can confirm or dispute it. No rating change until then.",
    });
    setReviewGame(null);
    setClientRequestId(Crypto.randomUUID());
    onLogged?.();
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
    Keyboard.dismiss();
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

  // The modern barcode scanner is a native modal with no "user dismissed"
  // event — if they swipe it away instead of scanning, nothing here fires and
  // the camera (plus the green privacy indicator) keeps running. Force it shut
  // on every path we *can* observe: state flip / unmount, the app leaving the
  // foreground, this screen losing focus, and the next touch on the form.
  const killScanner = useCallback(() => {
    void CameraView.dismissScanner().catch(() => {});
    setScannerOpen(false);
  }, []);

  useEffect(() => {
    if (!scannerOpen) return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") killScanner();
    });
    return () => sub.remove();
  }, [scannerOpen, killScanner]);

  useFocusEffect(
    useCallback(
      () => () => {
        killScanner();
      },
      [killScanner],
    ),
  );

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
    return () => {
      subscription.remove();
      void CameraView.dismissScanner().catch(() => {});
    };
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

  // Opponent typeahead: search real players via Supabase.
  // - No query yet: friends, always — not an ambient roster of whoever's at
  //   the selected court, which needed zero typing to reveal who's active
  //   somewhere that isn't even the viewer's own court.
  // - Query typed, own local court or LocalPlus: broad, fuzzy discovery
  //   across the whole player base — this is the actual LocalPlus perk
  //   (or the always-free case at your own court).
  // - Query typed, LocalLite at another court: narrowed to that specific
  //   court's check-ins in the trailing 7 days (matches Log Game's own
  //   daysBack={7} window) instead of open discovery-by-ELO.
  const friends = getFriendsList();
  const query = opponentQuery.toLowerCase().trim();
  const isMyLocalCourt = selectedCourt?.id != null && selectedCourt.id === localCourtId;
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
      setOpponentSuggestions(prioritize(friends));
      return;
    }
    const search =
      isMyLocalCourt || hasLocalPlus
        ? searchPlayers(query)
        : selectedCourt
          ? searchCourtPlayersRecent(selectedCourt.id, query)
          : Promise.resolve([]);
    search.then((results) => {
      if (!mounted) return;
      setOpponentSuggestions(prioritize(results));
    });
    return () => {
      mounted = false;
    };
  }, [query, friends, courtPlayers, currentUser.id, isMyLocalCourt, hasLocalPlus, selectedCourt]);

  const availableSuggestions = opponentSuggestions.filter(
    (player) => !chosenIds.includes(player.id),
  );

  const openPlayerPicker = (slot: PlayerSlot) => {
    setActivePlayerSlot(slot);
    setSubmitError(null);
    setOpponentQuery("");
    setShowOpponentPicker(true);
  };

  // Compact trigger that lives inside a half-width matchup column. Tapping it
  // opens the shared full-width picker panel below the columns (renderPlayer
  // Picker) — a search field + suggestions can't fit in the column itself.
  const renderSlotTrigger = (slot: PlayerSlot, placeholder: string) => {
    const roster = slot.side === "mine" ? form.teammates : form.opponents;
    const player = roster[slot.index];
    const isActive =
      showOpponentPicker &&
      activePlayerSlot.side === slot.side &&
      activePlayerSlot.index === slot.index;
    return (
      <View key={`${slot.side}-${slot.index}`} style={styles.slotShell}>
        <Pressable
          accessibilityLabel={
            player ? `Change ${player.name}` : `Select ${placeholder}`
          }
          accessibilityRole="button"
          onPress={() => openPlayerPicker(slot)}
          style={[styles.slotMain, isActive && styles.slotMainActive]}
        >
          {player ? (
            <PlayerAvatar
              initials={player.avatar}
              name={player.name}
              playerId={player.id}
              size={20}
            />
          ) : null}
          <Text
            numberOfLines={1}
            style={player ? styles.slotName : styles.slotPlaceholder}
          >
            {player
              ? player.name.split(" ")[0].toUpperCase()
              : isActive
                ? "SELECTING…"
                : placeholder}
          </Text>
          {player ? (
            <Pressable
              accessibilityLabel={`Remove ${player.name}`}
              hitSlop={6}
              onPress={() => clearPlayer(slot)}
            >
              <Ionicons color={Colors.muted} name="close" size={14} />
            </Pressable>
          ) : (
            <Ionicons color={Colors.muted} name="chevron-down" size={14} />
          )}
        </Pressable>
        <Pressable
          accessibilityLabel={`Scan ${placeholder} player QR code`}
          accessibilityRole="button"
          onPress={() => {
            setActivePlayerSlot(slot);
            void handleScanOpponent();
          }}
          style={styles.slotScan}
        >
          <Feather color={Colors.inkSoft} name="maximize" size={14} />
        </Pressable>
      </View>
    );
  };

  const renderPlayerPicker = () => {
    if (!showOpponentPicker) return null;
    const side = activePlayerSlot.side === "mine" ? "teammate" : "opponent";
    return (
      <View style={styles.pickerPanel}>
        <View style={styles.pickerSearchRow}>
          <SearchField
            variant="bare"
            autoFocus
            accessibilityLabel={`Search ${side}`}
            placeholder={`Search ${side}`}
            value={opponentQuery}
            onChangeText={setOpponentQuery}
            trailing={
              <Pressable
                accessibilityLabel="Close player search"
                hitSlop={8}
                onPress={() => setShowOpponentPicker(false)}
              >
                <Ionicons color={Colors.muted} name="close" size={17} />
              </Pressable>
            }
          />
        </View>
        <Text style={styles.opponentSection}>
          {query ? "BEST MATCHES" : "YOUR FRIENDS"}
        </Text>
        {availableSuggestions.map((suggestion) => (
          <Pressable
            key={suggestion.id}
            onPress={() => placePlayer(suggestion, activePlayerSlot)}
            style={styles.opponentOption}
          >
            <PlayerAvatar
              initials={suggestion.avatar}
              name={suggestion.name}
              playerId={suggestion.id}
              size={26}
              tag={suggestion.tag}
            />
            <View style={styles.opponentOptionInfo}>
              <Text numberOfLines={1} style={styles.opponentOptionName}>
                {suggestion.name.toUpperCase()}
              </Text>
              <Text style={styles.opponentOptionMeta}>
                {playerRankLabel(suggestion)} · {suggestion.elo} ELO
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
            {query ? "No players found" : "No available players at this court"}
          </Text>
        ) : null}
      </View>
    );
  };

  // These two views aren't inside the KeyboardAwareScrollView, so they pad
  // for the tab bar themselves — otherwise the pinned actions sit under it.
  const tabFloor = useBottomFloor(16);
  const successPadBottom = inSheet ? 16 : tabFloor;

  if (reviewGame) {
    return (
      <View style={[styles.successState, { paddingBottom: successPadBottom }]}>
        <Text style={styles.successTitle}>REVIEW SCORE</Text>
        <Text style={styles.successSub}>
          Check the matchup, then send it in. Ratings don&apos;t move until it&apos;s
          confirmed.
        </Text>
        <ScrollView
          contentContainerStyle={styles.successScrollContent}
          showsVerticalScrollIndicator={false}
          style={styles.successScroll}
        >
          <ScoreCard
            compact
            status="draft"
            note="Ratings don't move until this is confirmed."
            onPlayerPress={(id) => router.push(`/player/${id}`)}
            {...gameCardProps(reviewGame)}
          />
        </ScrollView>
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

  return (
    <View style={styles.formShell}>
    <KeyboardAwareScrollViewCompat
      bottomOffset={112}
      style={styles.formShell}
      onTouchStart={scannerOpen ? killScanner : undefined}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        paddingHorizontal: 16,
        paddingTop: 14,
        gap: 12,
        // The submit button clears the tab bar (TabFloor), or the home
        // indicator in a sheet.
        paddingBottom: 16,
      }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
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
            selectedCourt={selectedCourt}
            sport={form.sport}
            valueId={form.courtId}
            onSelect={selectCourt}
          />
        </View>
      </View>

      {/* The tab (or sheet) already says Log game: court first, then the day. */}
      <View style={styles.fieldGroup}>
        <View style={styles.dateHead}>
          <Text style={styles.fieldLabel}>Played</Text>
          <Text style={styles.formDate}>{formatCardDate(form.playedOn)}</Text>
        </View>
        <GameDateField
          onChange={(playedOn) => {
            Keyboard.dismiss();
            setForm((current) => ({ ...current, playedOn }));
          }}
          sport={form.sport}
          value={form.playedOn}
        />
      </View>

      {/* Two columns so the matchup stays tight as players are added: YOU on
          the left, OPPONENT on the right. The picker opens full-width below. */}
      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>
          {form.teamSize === 1 ? "MATCHUP" : `${form.teamSize}V${form.teamSize}`}
        </Text>
        <View style={styles.matchColumns}>
          <View style={styles.matchColumn}>
            <Text style={styles.matchColHeading}>
              {form.teamSize === 1 ? "YOU" : "YOUR SIDE"}
            </Text>
            <View style={styles.lockedPlayer}>
              <PlayerAvatar
                initials={currentUser.avatar}
                name={currentUser.name}
                playerId={currentUser.id}
                size={20}
              />
              <Text numberOfLines={1} style={styles.lockedPlayerName}>
                {currentUser.name.split(" ")[0].toUpperCase()}
              </Text>
              <Text style={styles.youBadge}>YOU</Text>
            </View>
            {Array.from({ length: form.teamSize - 1 }, (_, index) =>
              renderSlotTrigger({ side: "mine", index }, `TEAMMATE ${index + 1}`),
            )}
          </View>
          <View style={styles.vs}>
            <Text style={styles.vsText}>VS</Text>
          </View>
          <View style={styles.matchColumn}>
            <Text style={styles.matchColHeading}>
              {form.teamSize === 1 ? "OPPONENT" : "OTHER SIDE"}
            </Text>
            {Array.from({ length: form.teamSize }, (_, index) =>
              renderSlotTrigger(
                { side: "theirs", index },
                form.teamSize === 1 ? "SELECT" : `OPPONENT ${index + 1}`,
              ),
            )}
          </View>
        </View>

        {renderPlayerPicker()}

        <View style={styles.rosterActions}>
          {form.teamSize < 5 ? (
            <Pressable
              accessibilityLabel="Add a player to each side"
              accessibilityRole="button"
              onPress={addPlayerRow}
              style={({ pressed }) => [
                styles.rosterAdd,
                pressed && styles.pressed,
              ]}
            >
              <Feather color={Colors.inkSoft} name="plus" size={13} />
              <Text style={styles.rosterAddText}>
                ADD PLAYER · {form.teamSize + 1}V{form.teamSize + 1}
              </Text>
            </Pressable>
          ) : null}
          {form.teamSize > 1 ? (
            <Pressable
              accessibilityLabel="Remove the last player row"
              accessibilityRole="button"
              onPress={removePlayerRow}
              style={({ pressed }) => [
                styles.rosterRemove,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.rosterRemoveText}>REMOVE</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Score */}
      <View style={styles.scoreGroup}>
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
              { color: isWin ? Colors.text : Colors.textSecondary },
            ]}
          >
            {isWin ? "WIN — POSITIVE ELO CHANGE" : "LOSS — NEGATIVE ELO CHANGE"}
          </Text>
        )}
        {isTie && (
          <Text style={[styles.resultHint, { color: Colors.text }]}>
            TIES CAN'T BE LOGGED — ENTER A WINNING SCORE
          </Text>
        )}
      </View>

    </KeyboardAwareScrollViewCompat>
    {/* Log game stays put at the bottom, right above the tab bar. */}
    <View style={[styles.submitBar, { paddingBottom: inSheet ? 24 : tabFloor }]}>
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
            {submitting ? "LOGGING…" : "LOG GAME"}
          </Text>
        </Pressable>
    </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.72 },

  // ── Log Game ──
  fieldGroup: { gap: 8 },
  // Same title and date line as the game card.
  dateHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  formDate: {
    ...TextStyles.labelSmall,
    textAlign: "center",
    letterSpacing: 1.2,
    color: Colors.muted,
  },
  fieldRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    zIndex: 2,
  },
  courtField: { flex: 1, minWidth: 0 },
  fieldLabel: {
    fontFamily: Typography.bodyBold,
    fontSize: 9,
    color: Colors.textSecondary,
    letterSpacing: 1.3,
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
    borderColor: Colors.hairlineCard,
    borderRadius: Radius.chip,
    backgroundColor: Colors.panel,
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
    borderWidth: 1,
    borderColor: Colors.hairlineCard,
    borderRadius: Radius.chip,
    backgroundColor: Colors.panel,
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
    borderWidth: 1,
    borderColor: Colors.hairlineCard,
    borderRadius: Radius.row,
    backgroundColor: Colors.panel,
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
  // ── Matchup: two side-by-side columns ──
  matchColumns: { flexDirection: "row", gap: 8 },
  vs: { width: 22, paddingTop: 22, height: 62, alignItems: "center", justifyContent: "center" },
  vsText: { fontFamily: Typography.headingSemiBold, fontSize: 12, color: Colors.muted },
  formShell: { flex: 1, minHeight: 0 },
  submitBar: {
    paddingTop: 10,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.hairline,
    backgroundColor: Colors.background,
  },
  matchColumn: { flex: 1, minWidth: 0, gap: 6 },
  matchColHeading: {
    fontFamily: Typography.bodyBold,
    fontSize: 9,
    color: Colors.textSecondary,
    letterSpacing: 1.4,
  },
  slotShell: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "stretch",
    gap: 4,
  },
  slotScan: {
    width: 34,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.hairlineCard,
    borderRadius: Radius.chip,
    backgroundColor: Colors.panel,
  },
  slotMain: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderColor: Colors.hairlineCard,
    borderRadius: Radius.chip,
    backgroundColor: Colors.panel,
  },
  slotMainActive: { borderColor: Colors.accent, backgroundColor: Colors.accentDim },
  slotName: {
    flex: 1,
    minWidth: 0,
    fontFamily: Typography.bodySemiBold,
    fontSize: 12,
    color: Colors.text,
  },
  slotPlaceholder: {
    flex: 1,
    fontFamily: Typography.bodyMedium,
    fontSize: 11,
    color: Colors.muted,
    letterSpacing: 0.4,
  },
  pickerPanel: {
    marginTop: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surface,
    overflow: "hidden",
  },
  pickerSearchRow: {
    minHeight: 42,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  scoreGroup: { gap: 12 },
  rosterActions: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rosterAdd: {
    flex: 1,
    minHeight: 40,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderWidth: 1,
    borderColor: Colors.hairlineChrome,
    borderRadius: Radius.button,
    backgroundColor: Colors.panel,
  },
  rosterAddText: {
    fontFamily: Typography.bodyBold,
    fontSize: 10,
    color: Colors.inkSoft,
    letterSpacing: 1,
  },
  rosterRemove: {
    minHeight: 44,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.hairlineChrome,
    borderRadius: Radius.button,
  },
  rosterRemoveText: {
    fontFamily: Typography.bodyBold,
    fontSize: 10,
    color: Colors.muted,
    letterSpacing: 1,
  },
  lockedPlayer: {
    minHeight: 40,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.hairlineChrome,
    borderRadius: Radius.chip,
    backgroundColor: Colors.tile,
  },
  lockedPlayerName: {
    flex: 1,
    fontFamily: Typography.bodySemiBold,
    fontSize: 12,
    color: Colors.text,
  },
  youBadge: {
    fontFamily: Typography.bodyBold,
    fontSize: 8,
    color: Colors.inkSoft,
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
    fontSize: 40,
    color: Colors.text,
    textAlign: "center" as const,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    width: "100%",
    paddingVertical: 2,
    lineHeight: 46,
  },
  // Winner orange, loser grey (no green or red).
  scoreInputWin: { borderBottomColor: Colors.text, color: Colors.text },
  scoreInputLoss: { borderBottomColor: Colors.borderLight, color: Colors.textSecondary },
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

  submitBtn: {
    alignSelf: "stretch",
    minHeight: 52,
    backgroundColor: Colors.text,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.button,
    marginTop: 0,
  },
  submitBtnDisabled: {
    backgroundColor: Colors.panel,
    borderWidth: 1,
    borderColor: Colors.hairlineCard,
  },
  submitBtnText: {
    fontFamily: Typography.bodyBold,
    fontSize: 12,
    color: Colors.background,
    letterSpacing: 1.7,
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
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  successScroll: { flex: 1, alignSelf: "stretch", marginTop: 4 },
  successScrollContent: { paddingBottom: 12, gap: 12 },
  successTitle: {
    fontFamily: Typography.heading,
    fontSize: 24,
    color: Colors.text,
    letterSpacing: 3,
    textAlign: "center" as const,
  },
  successSub: {
    fontFamily: Typography.body,
    fontSize: 13,
    color: Colors.muted,
    textAlign: "center" as const,
  },
  reviewActions: {
    width: "100%",
    maxWidth: 360,
    alignSelf: "center",
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
