import { Feather } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { compactCourtLabel, normalizeState } from "@/components/addCourtModel";
import { BrutalistButton } from "@/components/BrutalistButton";
import { Colors, Radius } from "@/constants/colors";
import { Layout } from "@/constants/layout";
import { Typography } from "@/constants/typography";
import { useApp } from "@/context/AppContext";
import type { CourtSubmissionResult } from "@/services/courtService";

type Screen =
  | "camera"
  | "details"
  | "verifying"
  | "success"
  | "rejected"
  | "cooldown"
  | "error";
type Sport = "BASKETBALL" | "PICKLEBALL";
type Result = CourtSubmissionResult & {
  failureCode?:
    | "not_a_court"
    | "cooldown"
    | "duplicate"
    | "quota"
    | "unauthorized"
    | "unavailable"
    | "invalid"
    | "unknown";
  attemptsUsed?: number;
  attemptLimit?: number;
  cooldownUntil?: string;
};

function addressFrom(place: Location.LocationGeocodedAddress) {
  return (
    [place.streetNumber, place.street].filter(Boolean).join(" ").trim() ||
    place.name?.trim() ||
    ""
  );
}
function displayAddress(address: string, city: string, state: string) {
  return [address, city, state].filter(Boolean).join(", ");
}
function AttemptBox({
  used = 1,
  limit = 2,
}: {
  used?: number;
  limit?: number;
}) {
  return (
    <View style={styles.attemptBox}>
      <View style={styles.dotRow}>
        {Array.from({ length: limit }, (_, index) => (
          <View
            key={index}
            style={[styles.dot, index < used && styles.dotUsed]}
          />
        ))}
      </View>
      <Text style={styles.attemptText}>
        <Text style={styles.attemptBold}>
          {used} of {limit}
        </Text>{" "}
        attempts used
      </Text>
    </View>
  );
}

function CooldownTimer({ until }: { until?: string }) {
  const [now, setNow] = React.useState(Date.now());
  React.useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  const remain = Math.max(0, (until ? new Date(until).getTime() : now) - now);
  const hours = Math.floor(remain / 3_600_000);
  const minutes = Math.floor((remain % 3_600_000) / 60_000);
  return (
    <View style={styles.cooldownTimer}>
      <View>
        <Text style={styles.timerValue}>{String(hours).padStart(2, "0")}</Text>
        <Text style={styles.timerUnit}>HOURS</Text>
      </View>
      <Text style={styles.timerColon}>:</Text>
      <View>
        <Text style={styles.timerValue}>
          {String(minutes).padStart(2, "0")}
        </Text>
        <Text style={styles.timerUnit}>MIN</Text>
      </View>
    </View>
  );
}

export default function AddCourtRoute() {
  const router = useRouter();
  const { top, bottom } = useSafeAreaInsets();
  const { addCourt } = useApp();
  const {
    start,
    lat: latParam,
    lng: lngParam,
  } = useLocalSearchParams<{
    start?: string;
    lat?: string;
    lng?: string;
  }>();
  const initialLat = Number(latParam);
  const initialLng = Number(lngParam);
  const hasSeedLocation =
    start === "camera" &&
    Number.isFinite(initialLat) &&
    Number.isFinite(initialLng);
  const liveCameraRef = React.useRef<React.ElementRef<typeof CameraView>>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [screen, setScreen] = React.useState<Screen>("camera");
  const [lat] = React.useState<number | null>(
    hasSeedLocation ? initialLat : null,
  );
  const [lng] = React.useState<number | null>(
    hasSeedLocation ? initialLng : null,
  );
  const [address, setAddress] = React.useState("");
  const [city, setCity] = React.useState("");
  const [state, setState] = React.useState("");
  const [suggestedName, setSuggestedName] = React.useState("");
  const [courtName, setCourtName] = React.useState("");
  const [nameWasEdited, setNameWasEdited] = React.useState(false);
  const [sport, setSport] = React.useState<Sport>("BASKETBALL");
  const [photoUri, setPhotoUri] = React.useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<Result | null>(null);

  const reverseGeocode = React.useCallback(
    async (latitude: number, longitude: number) => {
      try {
        const [place] = await Location.reverseGeocodeAsync({
          latitude,
          longitude,
        });
        if (!place) return;
        const street = addressFrom(place);
        const nextName = compactCourtLabel(
          place.name?.trim() || street,
          street,
        );
        setAddress(street);
        setCity(place.city?.trim() || place.district?.trim() || "");
        setState(normalizeState(place.region));
        setSuggestedName(nextName);
        setCourtName((current) =>
          nameWasEdited || current ? current : nextName,
        );
      } catch {
        /* coordinates remain usable if geocoding is unavailable */
      }
    },
    [nameWasEdited],
  );
  React.useEffect(() => {
    if (!hasSeedLocation) {
      router.replace("/(tabs)/explore");
      return;
    }
    void reverseGeocode(initialLat, initialLng);
  }, [hasSeedLocation, initialLat, initialLng, reverseGeocode, router]);
  const capture = async () => {
    try {
      const photo = await liveCameraRef.current?.takePictureAsync({
        base64: true,
        quality: 0.85,
        exif: false,
      });
      if (!photo?.base64) return;
      setPhotoUri(photo.uri);
      setPhotoBase64(photo.base64);
      setScreen("details");
    } catch {
      setResult({
        verified: false,
        confidence: 0,
        reason: "The camera couldn't capture a photo. Try again.",
        failureCode: "unavailable",
      });
      setScreen("error");
    }
  };
  const submit = async () => {
    if (lat == null || lng == null || !photoBase64 || !courtName.trim()) return;
    setScreen("verifying");
    const response = (await addCourt({
      suggestedOfficialName: suggestedName,
      suggestedShortName: suggestedName,
      officialName: courtName.trim(),
      shortName: courtName.trim(),
      name: courtName.trim(),
      address: address.trim(),
      city: city.trim(),
      state: state.trim().toUpperCase(),
      latitude: lat,
      longitude: lng,
      imageBase64: photoBase64,
      imageMimeType: "image/jpeg",
      sport,
    } as Parameters<typeof addCourt>[0])) as Result;
    setResult(response);
    if (response.verified && response.court) setScreen("success");
    else if (
      response.failureCode === "cooldown" ||
      (response.attemptsUsed ?? 0) >= (response.attemptLimit ?? 3)
    )
      setScreen("cooldown");
    else if (response.failureCode === "not_a_court") setScreen("rejected");
    else setScreen("error");
  };
  const explore = () => router.replace("/(tabs)/explore");
  if (!hasSeedLocation) return <View style={styles.root} />;
  if (screen === "camera") {
    if (!cameraPermission?.granted)
      return (
        <PermissionState
          title="CAMERA ACCESS NEEDED"
          body="Allow camera access to take a live court photo. Gallery photos are not accepted."
          action="ALLOW CAMERA"
          onAction={() => void requestCameraPermission()}
          onBack={explore}
        />
      );
    return (
      <View style={styles.cameraScreen}>
        <CameraView
          ref={liveCameraRef}
          style={StyleSheet.absoluteFill}
          facing="back"
        />
        <CameraFrameOverlay />
        <View style={[styles.cameraShade, { paddingTop: Math.max(12, top) }]}>
          <FlowHeader title="TAKE A PHOTO" step={2} onBack={explore} />
          <View style={styles.cameraBody} />
          <View style={[styles.captureArea, { paddingBottom: bottom + 20 }]}>
            <Text style={styles.liveOnly}>LIVE CAMERA ONLY · NO GALLERY</Text>
            <Pressable
              onPress={() => void capture()}
              accessibilityRole="button"
              accessibilityLabel="Capture live court photo"
              style={styles.shutter}
            >
              <View style={styles.shutterInner} />
            </Pressable>
          </View>
        </View>
      </View>
    );
  }
  return (
    <View style={styles.root}>
      {screen === "details" ? (
        <FlowHeader
          title="CONFIRM DETAILS"
          step={3}
          top={top}
          onBack={() => setScreen("camera")}
        />
      ) : null}
      {screen === "details" ? (
        <Details
          photoUri={photoUri}
          name={courtName}
          address={displayAddress(address, city, state)}
          sport={sport}
          bottom={bottom}
          onNameChange={(next) => {
            setNameWasEdited(true);
            setCourtName(next);
          }}
          onSport={setSport}
          onSubmit={() => void submit()}
        />
      ) : null}
      {screen === "verifying" ? (
        <CenteredState
          icon="map-pin"
          title="VERIFYING COURT"
          body="AI is checking your photo to confirm this is an actual court…"
          progress
        />
      ) : null}
      {screen === "success" && result?.court ? (
        <SuccessState
          result={result}
          onCheckIn={() => router.replace(`/court/${result.court!.id}`)}
          onExplore={explore}
        />
      ) : null}
      {screen === "rejected" ? (
        <RejectedState
          result={result}
          onRetry={() => {
            setPhotoUri(null);
            setPhotoBase64(null);
            setScreen("camera");
          }}
          onCancel={explore}
        />
      ) : null}
      {screen === "cooldown" ? (
        <CooldownState result={result} onExplore={explore} />
      ) : null}
      {screen === "error" ? (
        <ErrorState
          result={result}
          onRetry={() => setScreen("details")}
          onCancel={explore}
        />
      ) : null}
    </View>
  );
}

function FlowHeader({
  title,
  step,
  top,
  onBack,
}: {
  title: string;
  step: number;
  top?: number;
  onBack: () => void;
}) {
  return (
    <>
      <View
        style={[
          styles.header,
          top != null && { paddingTop: Math.max(12, top) },
        ]}
      >
        <Pressable
          onPress={onBack}
          accessibilityLabel="Go back"
          accessibilityRole="button"
          style={styles.backButton}
        >
          <Feather name="chevron-left" size={30} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{title}</Text>
      </View>
      <FlowProgress step={step} />
    </>
  );
}

function FlowProgress({ step }: { step: number }) {
  return (
    <View style={styles.progress}>
      {[1, 2, 3].map((item) => (
        <View
          key={item}
          style={[
            styles.progressSegment,
            item <= step && styles.progressSegmentActive,
          ]}
        />
      ))}
    </View>
  );
}
// Scanner-style framing overlay: the live preview stays at full brightness
// inside the window; only the surrounding scrim is dimmed, with accent corner
// brackets and one instruction line so the submitter frames the whole court.
function CameraFrameOverlay() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={styles.frameScrimTop}>
        <Text style={styles.frameHint}>Frame the full court</Text>
      </View>
      <View style={styles.frameRow}>
        <View style={styles.frameScrimSide} />
        <View style={styles.frameWindow}>
          <View style={[styles.frameCorner, styles.frameCornerTL]} />
          <View style={[styles.frameCorner, styles.frameCornerTR]} />
          <View style={[styles.frameCorner, styles.frameCornerBL]} />
          <View style={[styles.frameCorner, styles.frameCornerBR]} />
        </View>
        <View style={styles.frameScrimSide} />
      </View>
      <View style={styles.frameScrimBottom} />
    </View>
  );
}
function Details({
  photoUri,
  name,
  address,
  sport,
  bottom,
  onNameChange,
  onSport,
  onSubmit,
}: {
  photoUri: string | null;
  name: string;
  address: string;
  sport: Sport;
  bottom: number;
  onNameChange: (value: string) => void;
  onSport: (value: Sport) => void;
  onSubmit: () => void;
}) {
  return (
    <ScrollView
      contentContainerStyle={[
        styles.detailsContent,
        { paddingBottom: bottom + 28 },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.photoPreview}>
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFill} />
        ) : (
          <View style={styles.photoPreviewEmpty}>
            <Feather name="camera-off" size={20} color={Colors.muted} />
          </View>
        )}
        <View style={styles.liveBadge}>
          <Feather name="camera" size={13} color={Colors.text} />
          <Text style={styles.liveBadgeText}>LIVE</Text>
        </View>
      </View>
      <Text style={styles.fieldLabel}>COURT NAME</Text>
      <View style={styles.nameInputWrap}>
        <TextInput
          value={name}
          onChangeText={onNameChange}
          style={styles.nameInput}
          placeholder="Court name"
          placeholderTextColor={Colors.muted}
          accessibilityLabel="Court name"
        />
        <Feather name="edit-2" size={18} color={Colors.muted} />
      </View>
      <Text style={styles.fieldHelp}>
        Auto-generated from your location · tap to edit
      </Text>
      <Text style={styles.fieldLabel}>SPORT</Text>
      <View style={styles.sportRow}>
        <SportCard
          label="BASKETBALL"
          icon="circle"
          selected={sport === "BASKETBALL"}
          onPress={() => onSport("BASKETBALL")}
        />
        <SportCard
          label="PICKLEBALL"
          icon="search"
          selected={sport === "PICKLEBALL"}
          onPress={() => onSport("PICKLEBALL")}
        />
      </View>
      <Text style={styles.fieldLabel}>ADDRESS</Text>
      <View style={styles.addressBox}>
        <Feather name="map-pin" size={20} color={Colors.muted} />
        <Text style={styles.addressText}>
          {address || "Live location address"}
        </Text>
      </View>
      <BrutalistButton
        label="ADD COURT"
        onPress={onSubmit}
        disabled={!name.trim() || !photoUri}
        variant="accent"
        size="lg"
        style={{ ...styles.fullButton, marginTop: 20 }}
      />
    </ScrollView>
  );
}
function SportCard({
  label,
  icon,
  selected,
  onPress,
}: {
  label: string;
  icon: React.ComponentProps<typeof Feather>["name"];
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={[styles.sportCard, selected && styles.sportCardSelected]}
    >
      <Feather
        name={icon}
        size={32}
        color={selected ? Colors.accent : Colors.muted}
      />
      <Text style={[styles.sportText, selected && styles.sportTextSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}
function CenteredState({
  icon,
  title,
  body,
  progress = false,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  title: string;
  body: string;
  progress?: boolean;
}) {
  return (
    <View style={styles.centered}>
      <View style={styles.stateIcon}>
        <Feather name={icon} size={39} color={Colors.accent} />
      </View>
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateBody}>{body}</Text>
      {progress ? (
        <>
          <View style={styles.verifyLine}>
            <View style={styles.verifyFill} />
          </View>
          <Text style={styles.waitText}>This usually takes a few seconds</Text>
        </>
      ) : null}
    </View>
  );
}
function SuccessState({
  result,
  onCheckIn,
  onExplore,
}: {
  result: Result;
  onCheckIn: () => void;
  onExplore: () => void;
}) {
  const court = result.court!;
  return (
    <View style={styles.centered}>
      <View style={[styles.stateIcon, styles.successIcon]}>
        <Feather name="check" size={38} color={Colors.accent} />
      </View>
      <Text style={styles.stateTitle}>COURT ADDED</Text>
      <Text style={styles.stateBody}>
        {court.shortName || court.name} is now live on LocalCheck
      </Text>
      <View style={styles.courtCard}>
        <Text style={styles.courtCardTitle}>
          {(court.shortName || court.name).toUpperCase()}
        </Text>
        <Text style={styles.courtCardAddress}>
          {displayAddress(court.address || "", court.city || "", "")}
        </Text>
        <View style={styles.tags}>
          <Text style={styles.tag}>
            {court.sport === "PICKLEBALL" ? "PB" : "BB"}
          </Text>
          <Text style={styles.tag}>0 Locals</Text>
          <Text style={styles.tag}>New</Text>
        </View>
      </View>
      <BrutalistButton
        label="CHECK IN NOW"
        onPress={onCheckIn}
        variant="accent"
        size="lg"
        style={styles.fullButton}
      />
      <BrutalistButton
        label="Back to Explore"
        onPress={onExplore}
        variant="outline"
        size="lg"
        style={styles.fullButton}
      />
    </View>
  );
}
function RejectedState({
  result,
  onRetry,
  onCancel,
}: {
  result: Result | null;
  onRetry: () => void;
  onCancel: () => void;
}) {
  const used = result?.attemptsUsed ?? 1;
  const limit = result?.attemptLimit ?? 2;
  return (
    <View style={styles.centered}>
      <View style={[styles.stateIcon, styles.failureIcon]}>
        <Feather name="x" size={38} color={Colors.loss} />
      </View>
      <Text style={styles.stateTitle}>NOT A COURT</Text>
      <Text style={styles.stateBody}>
        {result?.reason ||
          "We couldn't verify a court in your photo. Make sure the court surface, lines, or hoop/net are clearly visible."}
      </Text>
      <AttemptBox used={used} limit={limit} />
      <BrutalistButton
        label="TRY AGAIN"
        onPress={onRetry}
        variant="accent"
        size="lg"
        style={styles.fullButton}
      />
      <Pressable onPress={onCancel} accessibilityRole="button">
        <Text style={styles.cancelText}>Cancel</Text>
      </Pressable>
    </View>
  );
}
function CooldownState({
  result,
  onExplore,
}: {
  result: Result | null;
  onExplore: () => void;
}) {
  const limit = result?.attemptLimit ?? 2;
  return (
    <View style={styles.centered}>
      <View style={styles.stateIcon}>
        <Feather name="clock" size={38} color={Colors.muted} />
      </View>
      <Text style={styles.stateTitle}>COOL DOWN</Text>
      <Text style={styles.stateBody}>
        You’ve used both attempts. You can try adding a court again in:
      </Text>
      <CooldownTimer until={result?.cooldownUntil} />
      <AttemptBox used={result?.attemptsUsed ?? limit} limit={limit} />
      <BrutalistButton
        label="Back to Explore"
        onPress={onExplore}
        variant="outline"
        size="lg"
        style={styles.fullButton}
      />
    </View>
  );
}
function ErrorState({
  result,
  onRetry,
  onCancel,
}: {
  result: Result | null;
  onRetry: () => void;
  onCancel: () => void;
}) {
  return (
    <View style={styles.centered}>
      <View style={styles.stateIcon}>
        <Feather name="alert-circle" size={38} color={Colors.accent} />
      </View>
      <Text style={styles.stateTitle}>CAN’T ADD COURT</Text>
      <Text style={styles.stateBody}>
        {result?.reason ||
          "The court verification service is unavailable. Please try again."}
      </Text>
      <BrutalistButton
        label="TRY AGAIN"
        onPress={onRetry}
        variant="accent"
        size="lg"
        style={styles.fullButton}
      />
      <BrutalistButton
        label="Back to Explore"
        onPress={onCancel}
        variant="outline"
        size="lg"
        style={styles.fullButton}
      />
    </View>
  );
}
function PermissionState({
  title,
  body,
  action,
  onAction,
  onBack,
}: {
  title: string;
  body: string;
  action: string;
  onAction: () => void;
  onBack: () => void;
}) {
  return (
    <View style={styles.root}>
      <View style={styles.centered}>
        <View style={styles.stateIcon}>
          <Feather name="camera" size={38} color={Colors.accent} />
        </View>
        <Text style={styles.stateTitle}>{title}</Text>
        <Text style={styles.stateBody}>{body}</Text>
        <BrutalistButton
          label={action}
          onPress={onAction}
          variant="accent"
          size="lg"
          style={styles.fullButton}
        />
        <BrutalistButton
          label="GO BACK"
          onPress={onBack}
          variant="outline"
          size="lg"
          style={styles.fullButton}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: {
    height: 104,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingHorizontal: Layout.screenGutter,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  headerTitle: {
    color: Colors.text,
    fontFamily: Typography.heading,
    fontSize: 28,
    letterSpacing: 1.1,
  },
  progress: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: Layout.screenGutter,
  },
  progressSegment: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.border,
  },
  progressSegmentActive: { backgroundColor: Colors.accent },
  fullButton: { width: "100%" },
  cancelText: {
    textAlign: "center",
    color: Colors.muted,
    fontFamily: Typography.bodySemiBold,
    fontSize: 17,
    paddingVertical: 7,
  },
  cameraScreen: { flex: 1, backgroundColor: Colors.black },
  cameraShade: { flex: 1 },
  cameraBody: { flex: 1 },
  frameScrimTop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 16,
  },
  frameRow: { flexDirection: "row", alignItems: "stretch" },
  frameScrimSide: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  frameWindow: { width: "88%", aspectRatio: 4 / 3 },
  frameScrimBottom: { flex: 1.35, backgroundColor: "rgba(0,0,0,0.5)" },
  frameCorner: {
    position: "absolute",
    width: 26,
    height: 26,
    borderColor: Colors.accent,
  },
  frameCornerTL: { top: -1, left: -1, borderTopWidth: 3, borderLeftWidth: 3 },
  frameCornerTR: { top: -1, right: -1, borderTopWidth: 3, borderRightWidth: 3 },
  frameCornerBL: {
    bottom: -1,
    left: -1,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
  },
  frameCornerBR: {
    bottom: -1,
    right: -1,
    borderBottomWidth: 3,
    borderRightWidth: 3,
  },
  frameHint: {
    color: Colors.text,
    fontFamily: Typography.bodyBold,
    fontSize: 15,
    letterSpacing: 0.4,
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowRadius: 6,
  },
  captureArea: {
    alignItems: "center",
    gap: 24,
    paddingTop: 18,
    backgroundColor: "rgba(0,0,0,0.72)",
  },
  liveOnly: {
    color: Colors.textSecondary,
    fontFamily: Typography.bodyMedium,
    letterSpacing: 2,
    fontSize: 13,
  },
  shutter: {
    width: 86,
    height: 86,
    borderRadius: 43,
    borderWidth: 6,
    borderColor: Colors.white,
    padding: 8,
  },
  shutterInner: { flex: 1, borderRadius: 40, backgroundColor: Colors.white },
  detailsContent: { padding: Layout.screenGutter, gap: 13 },
  photoPreview: {
    height: 185,
    overflow: "hidden",
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.surfaceDark,
  },
  photoPreviewEmpty: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  liveBadge: {
    position: "absolute",
    right: 14,
    top: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: 12,
    backgroundColor: Colors.black,
    borderRadius: Radius.md,
  },
  liveBadgeText: {
    color: Colors.accent,
    fontFamily: Typography.bodyBold,
    fontSize: 13,
  },
  fieldLabel: {
    marginTop: 13,
    color: Colors.muted,
    fontFamily: Typography.bodyBold,
    fontSize: 13,
    letterSpacing: 2,
  },
  nameInputWrap: {
    minHeight: 70,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.card,
    backgroundColor: Colors.surface,
  },
  nameInput: {
    flex: 1,
    color: Colors.text,
    fontFamily: Typography.heading,
    fontSize: 25,
    letterSpacing: 0.7,
  },
  fieldHelp: { color: Colors.muted, fontFamily: Typography.body, fontSize: 13 },
  sportRow: { flexDirection: "row", gap: 14 },
  sportCard: {
    flex: 1,
    height: 152,
    alignItems: "center",
    justifyContent: "center",
    gap: 17,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.card,
    backgroundColor: Colors.surface,
  },
  sportCardSelected: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentDim,
  },
  sportText: {
    color: Colors.muted,
    fontFamily: Typography.heading,
    fontSize: 21,
    letterSpacing: 0.7,
  },
  sportTextSelected: { color: Colors.accent },
  addressBox: {
    minHeight: 66,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.card,
    backgroundColor: Colors.surface,
  },
  addressText: {
    flex: 1,
    color: Colors.textSecondary,
    fontFamily: Typography.body,
    fontSize: 16,
  },
  centered: {
    flex: 1,
    padding: Layout.screenGutter + 6,
    alignItems: "center",
    justifyContent: "center",
    gap: 22,
  },
  stateIcon: {
    width: 118,
    height: 118,
    borderRadius: 59,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: Colors.border,
  },
  successIcon: {
    borderColor: Colors.accentBorder,
    backgroundColor: Colors.accentDim,
  },
  failureIcon: {
    borderColor: "rgba(255,59,92,0.35)",
    backgroundColor: Colors.lossDim,
  },
  stateTitle: {
    color: Colors.text,
    fontFamily: Typography.heading,
    fontSize: 38,
    letterSpacing: 1.3,
    textAlign: "center",
  },
  stateBody: {
    color: Colors.textSecondary,
    fontFamily: Typography.body,
    fontSize: 18,
    lineHeight: 27,
    textAlign: "center",
    maxWidth: 460,
  },
  verifyLine: {
    width: "90%",
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.border,
    overflow: "hidden",
    marginTop: 22,
  },
  verifyFill: {
    width: "65%",
    height: "100%",
    borderRadius: 4,
    backgroundColor: Colors.accent,
  },
  waitText: { color: Colors.muted, fontFamily: Typography.body, fontSize: 15 },
  courtCard: {
    width: "100%",
    gap: 14,
    padding: 25,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.card,
    backgroundColor: Colors.surface,
  },
  courtCardTitle: {
    color: Colors.text,
    fontFamily: Typography.heading,
    fontSize: 29,
    letterSpacing: 0.8,
  },
  courtCardAddress: {
    color: Colors.textSecondary,
    fontFamily: Typography.body,
    fontSize: 15,
  },
  tags: { flexDirection: "row", gap: 10 },
  tag: {
    color: Colors.textSecondary,
    fontFamily: Typography.bodyMedium,
    fontSize: 13,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: Radius.sm,
  },
  attemptBox: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 17,
    padding: 22,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.card,
    backgroundColor: Colors.surface,
  },
  dotRow: { flexDirection: "row", gap: 10 },
  dot: {
    width: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: Colors.borderLight,
  },
  dotUsed: { backgroundColor: Colors.loss },
  attemptText: {
    color: Colors.textSecondary,
    fontFamily: Typography.body,
    fontSize: 17,
  },
  attemptBold: { color: Colors.text, fontFamily: Typography.bodyBold },
  cooldownTimer: { flexDirection: "row", alignItems: "center", gap: 18 },
  timerValue: {
    color: Colors.text,
    fontFamily: Typography.heading,
    fontSize: 70,
    lineHeight: 75,
  },
  timerUnit: {
    color: Colors.muted,
    fontFamily: Typography.bodyBold,
    fontSize: 13,
    letterSpacing: 2,
    textAlign: "center",
  },
  timerColon: {
    color: Colors.muted,
    fontFamily: Typography.heading,
    fontSize: 52,
  },
});
