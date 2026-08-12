import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { courtDetailsReady, normalizeState } from "@/components/addCourtModel";
import { BrutalistButton } from "@/components/BrutalistButton";
import { FormSheet } from "@/components/sheet/FormSheet";
import { SportEmblem } from "@/components/ui/SportEmblem";
import { Colors, Radius } from "@/constants/colors";
import type { Court } from "@/constants/data";
import { Layout, Space } from "@/constants/layout";
import { Typography } from "@/constants/typography";
import { useApp } from "@/context/AppContext";
import type {
  CourtAccessType,
  CourtSubmissionResult,
  VerifiedCourtSubmission,
} from "@/services/courtService";

type Step = "details" | "photo" | "verifying" | "result";

const ACCESS_OPTIONS: Array<{ value: CourtAccessType; label: string }> = [
  { value: "public_free", label: "FREE" },
  { value: "public_paid", label: "PAID" },
  { value: "private_paid", label: "PRIVATE" },
];

function buildAddress(place: Location.LocationGeocodedAddress): string {
  const street = [place.streetNumber, place.street].filter(Boolean).join(" ").trim();
  return street || place.name?.trim() || place.formattedAddress?.split(",")[0]?.trim() || "";
}

export function AddCourtModal({
  visible,
  onClose,
  onAdded,
  initialLatitude,
  initialLongitude,
}: {
  visible: boolean;
  onClose: () => void;
  onAdded?: (court: Court) => void | Promise<void>;
  initialLatitude?: number;
  initialLongitude?: number;
}) {
  const { addCourt } = useApp();
  const { bottom } = useSafeAreaInsets();
  const [step, setStep] = useState<Step>("details");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [stateCode, setStateCode] = useState("");
  const [accessType, setAccessType] = useState<CourtAccessType>("public_free");
  const [latitude, setLatitude] = useState<number | null>(initialLatitude ?? null);
  const [longitude, setLongitude] = useState<number | null>(initialLongitude ?? null);
  const [locating, setLocating] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [photoMimeType, setPhotoMimeType] = useState("image/jpeg");
  const [result, setResult] = useState<CourtSubmissionResult | null>(null);

  const fillAddress = useCallback(async (lat: number, lng: number) => {
    if (Platform.OS === "web") return;
    try {
      const [place] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (!place) return;
      setAddress((current) => current || buildAddress(place));
      setCity((current) => current || place.city?.trim() || place.district?.trim() || "");
      setStateCode((current) => current || normalizeState(place.region));
    } catch {
      // Coordinates remain valid; every derived address field is editable.
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    setStep("details");
    setName("");
    setAddress("");
    setCity("");
    setStateCode("");
    setAccessType("public_free");
    setPhotoUri(null);
    setPhotoBase64(null);
    setPhotoMimeType("image/jpeg");
    setResult(null);
    const nextLat = initialLatitude ?? null;
    const nextLng = initialLongitude ?? null;
    setLatitude(nextLat);
    setLongitude(nextLng);
    if (nextLat != null && nextLng != null) void fillAddress(nextLat, nextLng);
  }, [fillAddress, initialLatitude, initialLongitude, visible]);

  const getLocation = useCallback(async () => {
    setLocating(true);
    try {
      let lat: number;
      let lng: number;
      if (Platform.OS === "web") {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10_000,
          });
        });
        lat = position.coords.latitude;
        lng = position.coords.longitude;
      } else {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== "granted") {
          Alert.alert("Location needed", "Allow location to pin the court you are standing at.");
          return;
        }
        const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        lat = location.coords.latitude;
        lng = location.coords.longitude;
      }
      setLatitude(lat);
      setLongitude(lng);
      await fillAddress(lat, lng);
    } catch {
      Alert.alert("Location unavailable", "Move closer to the court and try again.");
    } finally {
      setLocating(false);
    }
  }, [fillAddress]);

  const savePhoto = useCallback((asset: ImagePicker.ImagePickerAsset) => {
    if (!asset.base64) {
      Alert.alert("Photo unavailable", "LocalCheck could not read this photo. Choose another one.");
      return;
    }
    setPhotoUri(asset.uri);
    setPhotoBase64(asset.base64);
    setPhotoMimeType(asset.mimeType ?? "image/jpeg");
  }, []);

  const takePhoto = useCallback(async () => {
    if (Platform.OS === "web") {
      Alert.alert("Live photo required", "Open LocalCheck on your iPhone to take the verification photo.");
      return;
    }
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (permission.status !== "granted") {
      Alert.alert("Camera access needed", "Allow camera access to photograph the court.");
      return;
    }
    const captured = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.65,
      base64: true,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (!captured.canceled && captured.assets[0]) savePhoto(captured.assets[0]);
  }, [savePhoto]);

  const detailsReady = courtDetailsReady({ latitude, longitude, address, city, stateCode });

  const submit = useCallback(async () => {
    if (!detailsReady || latitude == null || longitude == null || !photoBase64) return;
    const submission: VerifiedCourtSubmission = {
      name: name.trim() || undefined,
      address: address.trim(),
      city: city.trim(),
      state: stateCode.trim().toUpperCase(),
      latitude,
      longitude,
      accessType,
      imageBase64: photoBase64,
      imageMimeType: photoMimeType,
    };
    setStep("verifying");
    const nextResult = await addCourt(submission);
    if (nextResult.court) await onAdded?.(nextResult.court);
    setResult(nextResult);
    setStep("result");
  }, [
    accessType,
    addCourt,
    address,
    city,
    detailsReady,
    latitude,
    longitude,
    name,
    onAdded,
    photoBase64,
    photoMimeType,
    stateCode,
  ]);

  const resetPhoto = useCallback(() => {
    setPhotoUri(null);
    setPhotoBase64(null);
    setResult(null);
    setStep("photo");
  }, []);

  const eyebrow = step === "details"
    ? "STEP 1 OF 2 · DETAILS"
    : step === "photo"
    ? "STEP 2 OF 2 · PHOTO"
    : step === "verifying"
    ? "GEMINI VISION"
    : "VERIFICATION RESULT";

  return (
    <FormSheet visible={visible} onClose={onClose} title="Add a court" eyebrow={eyebrow}>
      {step === "details" ? (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: bottom + Space.xxl }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.requirements}>
            <View style={styles.requirementRow}>
              <View style={styles.requirementIcon}>
                <Feather color={Colors.accent} name="map-pin" size={18} />
              </View>
              <View style={styles.requirementCopy}>
                <Text style={styles.requirementTitle}>LIVE LOCATION PIN</Text>
                <Text style={styles.requirementMeta}>Drop it while standing at the court.</Text>
              </View>
            </View>
            <View style={styles.requirementRow}>
              <View style={styles.sportIcons}>
                <SportEmblem size={15} sport="BASKETBALL" />
                <SportEmblem size={15} sport="PICKLEBALL" />
              </View>
              <View style={styles.requirementCopy}>
                <Text style={styles.requirementTitle}>BASKETBALL OR PICKLEBALL</Text>
                <Text style={styles.requirementMeta}>The live photo confirms the sport.</Text>
              </View>
            </View>
            <View style={styles.requirementRow}>
              <View style={styles.requirementIcon}>
                <Feather color={Colors.accent} name="camera" size={18} />
              </View>
              <View style={styles.requirementCopy}>
                <Text style={styles.requirementTitle}>LIVE PHOTO</Text>
                <Text style={styles.requirementMeta}>Camera only. Existing uploads are not accepted.</Text>
              </View>
            </View>
          </View>

          <Text style={styles.fieldLabel}>COURT NAME · OPTIONAL</Text>
          <TextInput
            accessibilityLabel="Court name"
            autoCapitalize="words"
            maxLength={120}
            onChangeText={setName}
            placeholder="West Side Courts"
            placeholderTextColor={Colors.mutedDark}
            style={styles.input}
            value={name}
          />

          <Text style={styles.fieldLabel}>LOCATION</Text>
          <Pressable
            accessibilityLabel="Use my current location"
            accessibilityRole="button"
            disabled={locating}
            onPress={getLocation}
            style={({ pressed }) => [styles.locationAction, pressed && styles.pressed]}
          >
            {locating ? (
              <ActivityIndicator color={Colors.accent} />
            ) : (
              <Feather color={Colors.accent} name="crosshair" size={18} />
            )}
            <View style={styles.locationCopy}>
              <Text style={styles.locationTitle}>
                {locating ? "LOCATING…" : latitude == null ? "USE MY LOCATION" : "REFRESH LOCATION"}
              </Text>
              <Text style={styles.locationMeta}>
                {latitude == null || longitude == null
                  ? "Required to place the court"
                  : `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`}
              </Text>
            </View>
          </Pressable>

          <TextInput
            accessibilityLabel="Court street address"
            autoCapitalize="words"
            maxLength={250}
            onChangeText={setAddress}
            placeholder="Street address or park name"
            placeholderTextColor={Colors.mutedDark}
            style={styles.input}
            value={address}
          />
          <View style={styles.locationFields}>
            <TextInput
              accessibilityLabel="Court city"
              autoCapitalize="words"
              maxLength={80}
              onChangeText={setCity}
              placeholder="City"
              placeholderTextColor={Colors.mutedDark}
              style={[styles.input, styles.cityInput]}
              value={city}
            />
            <TextInput
              accessibilityLabel="Court state abbreviation"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={2}
              onChangeText={(value) => setStateCode(value.replace(/[^A-Za-z]/g, "").toUpperCase())}
              placeholder="ST"
              placeholderTextColor={Colors.mutedDark}
              style={[styles.input, styles.stateInput]}
              value={stateCode}
            />
          </View>

          <Text style={styles.fieldLabel}>ACCESS</Text>
          <View accessibilityRole="radiogroup" style={styles.segmented}>
            {ACCESS_OPTIONS.map((option) => (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked: accessType === option.value }}
                key={option.value}
                onPress={() => setAccessType(option.value)}
                style={[styles.segment, accessType === option.value && styles.segmentActive]}
              >
                <Text style={[styles.segmentText, accessType === option.value && styles.segmentTextActive]}>
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <BrutalistButton
            disabled={!detailsReady}
            label="CONTINUE TO PHOTO"
            onPress={() => setStep("photo")}
            variant="accent"
          />
          {!detailsReady ? (
            <Text style={styles.helper}>Add your location, address, city, and two-letter state.</Text>
          ) : null}
        </ScrollView>
      ) : null}

      {step === "photo" ? (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: bottom + Space.xxl }]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.intro}>
            Show the playable surface, lines, and hoops or net. The image is analyzed for this submission and is not stored.
          </Text>
          {photoUri ? (
            <View style={styles.photoPreviewWrap}>
              <Image resizeMode="cover" source={{ uri: photoUri }} style={styles.photoPreview} />
              <Pressable onPress={resetPhoto} style={styles.retakeButton}>
                <Text style={styles.retakeText}>RETAKE</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.photoOptions}>
              <Pressable onPress={takePhoto} style={({ pressed }) => [styles.photoButton, pressed && styles.pressed]}>
                <Feather color={Colors.accent} name="camera" size={26} />
                <Text style={styles.photoButtonTitle}>TAKE LIVE PHOTO</Text>
                <Text style={styles.photoButtonMeta}>
                  {Platform.OS === "web" ? "Available in the iPhone app" : "Camera only · uploads disabled"}
                </Text>
              </Pressable>
            </View>
          )}

          <View style={styles.infoBox}>
            <Feather color={Colors.accent} name="shield" size={16} />
            <Text style={styles.infoText}>
              Screenshots, renderings, other sports, damaged courts, and unclear photos are rejected.
            </Text>
          </View>

          <View style={styles.actionRow}>
            <BrutalistButton label="BACK" onPress={() => setStep("details")} style={styles.secondaryAction} variant="outline" />
            <BrutalistButton disabled={!photoBase64} label="VERIFY & ADD" onPress={submit} style={styles.primaryAction} variant="accent" />
          </View>
        </ScrollView>
      ) : null}

      {step === "verifying" ? (
        <View style={[styles.centerContent, { paddingBottom: bottom + Space.xxl }]}>
          <ActivityIndicator color={Colors.accent} size="large" />
          <Text style={styles.stateTitle}>CHECKING THE COURT</Text>
          <Text style={styles.stateBody}>Verifying the photo, checking nearby duplicates, and creating the court.</Text>
        </View>
      ) : null}

      {step === "result" && result ? (
        <View style={[styles.centerContent, { paddingBottom: bottom + Space.xxl }]}>
          <View style={[styles.resultIcon, result.court ? styles.resultSuccess : styles.resultFailure]}>
            <Feather color={result.court ? Colors.win : Colors.loss} name={result.court ? "check" : "x"} size={30} />
          </View>
          <Text style={styles.stateTitle}>{result.court ? "COURT ADDED" : "PHOTO NOT VERIFIED"}</Text>
          <Text style={styles.stateBody}>{result.reason}</Text>
          {result.court ? (
            <View style={styles.courtSummary}>
              <Text style={styles.courtName}>{result.court.name.toUpperCase()}</Text>
              <Text style={styles.courtMeta}>{result.sport} · {result.confidence}% CONFIDENCE</Text>
              <Text style={styles.courtAddress}>{result.court.address}</Text>
            </View>
          ) : null}
          <BrutalistButton
            label={result.court ? "DONE" : "TRY ANOTHER PHOTO"}
            onPress={result.court ? onClose : resetPhoto}
            style={styles.resultAction}
            variant={result.court ? "accent" : "outline"}
          />
        </View>
      ) : null}
    </FormSheet>
  );
}

const styles = StyleSheet.create({
  content: { padding: Layout.screenGutter, gap: Space.md },
  intro: {
    fontFamily: Typography.body,
    fontSize: 13,
    lineHeight: 20,
    color: Colors.textSecondary,
    marginBottom: Space.sm,
  },
  requirements: {
    gap: Space.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    padding: Space.md,
  },
  requirementRow: { flexDirection: "row", alignItems: "center", gap: Space.md },
  requirementIcon: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.sm,
    backgroundColor: Colors.accentDim,
  },
  sportIcons: {
    width: 38,
    height: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 0,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surfaceHigh,
  },
  requirementCopy: { flex: 1 },
  requirementTitle: {
    fontFamily: Typography.bodyBold,
    fontSize: 10,
    color: Colors.text,
    letterSpacing: 1.1,
  },
  requirementMeta: {
    fontFamily: Typography.body,
    fontSize: 11,
    lineHeight: 16,
    color: Colors.muted,
    marginTop: 2,
  },
  fieldLabel: {
    fontFamily: Typography.bodyBold,
    fontSize: 10,
    lineHeight: 14,
    color: Colors.muted,
    letterSpacing: 1.4,
    marginTop: Space.xs,
  },
  input: {
    minHeight: Layout.minTouchTarget,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surface,
    color: Colors.text,
    fontFamily: Typography.bodyMedium,
    fontSize: 14,
    paddingHorizontal: Space.md,
    paddingVertical: Space.sm,
  },
  locationAction: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    gap: Space.md,
    borderWidth: 1,
    borderColor: Colors.accentBorder,
    borderRadius: Radius.md,
    backgroundColor: Colors.accentDim,
    paddingHorizontal: Space.lg,
  },
  locationCopy: { flex: 1 },
  locationTitle: {
    fontFamily: Typography.bodyBold,
    fontSize: 11,
    color: Colors.text,
    letterSpacing: 1.2,
  },
  locationMeta: { fontFamily: Typography.body, fontSize: 11, color: Colors.muted, marginTop: 3 },
  locationFields: { flexDirection: "row", gap: Space.sm },
  cityInput: { flex: 1 },
  stateInput: { width: 72, textAlign: "center" },
  segmented: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    overflow: "hidden",
  },
  segment: {
    flex: 1,
    minHeight: Layout.minTouchTarget,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.surface,
  },
  segmentActive: { backgroundColor: Colors.surfaceHigh },
  segmentText: {
    fontFamily: Typography.bodyBold,
    fontSize: 10,
    color: Colors.muted,
    letterSpacing: 1,
  },
  segmentTextActive: { color: Colors.accent },
  helper: { fontFamily: Typography.body, fontSize: 11, color: Colors.muted, textAlign: "center" },
  photoPreviewWrap: {
    height: 250,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    overflow: "hidden",
  },
  photoPreview: { width: "100%", height: "100%" },
  retakeButton: {
    position: "absolute",
    right: Space.sm,
    top: Space.sm,
    minHeight: 36,
    justifyContent: "center",
    borderRadius: Radius.sm,
    backgroundColor: Colors.overlay,
    paddingHorizontal: Space.md,
  },
  retakeText: { fontFamily: Typography.bodyBold, fontSize: 10, color: Colors.text, letterSpacing: 1 },
  photoOptions: { flexDirection: "row", gap: Space.sm },
  photoButton: {
    flex: 1,
    minHeight: 150,
    alignItems: "center",
    justifyContent: "center",
    gap: Space.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    padding: Space.lg,
  },
  photoButtonTitle: {
    fontFamily: Typography.bodyBold,
    fontSize: 11,
    color: Colors.text,
    letterSpacing: 1,
  },
  photoButtonMeta: { fontFamily: Typography.body, fontSize: 11, color: Colors.muted },
  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Space.sm,
    borderLeftWidth: 2,
    borderLeftColor: Colors.accent,
    backgroundColor: Colors.accentGhost,
    padding: Space.md,
  },
  infoText: { flex: 1, fontFamily: Typography.body, fontSize: 11, lineHeight: 17, color: Colors.textSecondary },
  actionRow: { flexDirection: "row", gap: Space.sm },
  secondaryAction: { flex: 1 },
  primaryAction: { flex: 1.5 },
  centerContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Space.md,
    paddingHorizontal: Layout.screenGutter,
  },
  stateTitle: {
    fontFamily: Typography.heading,
    fontSize: 22,
    color: Colors.text,
    letterSpacing: 1.5,
    textAlign: "center",
  },
  stateBody: {
    maxWidth: 380,
    fontFamily: Typography.body,
    fontSize: 13,
    lineHeight: 20,
    color: Colors.textSecondary,
    textAlign: "center",
  },
  resultIcon: {
    width: 68,
    height: 68,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 34,
    borderWidth: 1,
  },
  resultSuccess: { borderColor: Colors.win, backgroundColor: Colors.winDim },
  resultFailure: { borderColor: Colors.loss, backgroundColor: Colors.lossDim },
  courtSummary: {
    width: "100%",
    maxWidth: 380,
    gap: Space.xs,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    padding: Space.lg,
  },
  courtName: { fontFamily: Typography.heading, fontSize: 18, color: Colors.text, letterSpacing: 1 },
  courtMeta: { fontFamily: Typography.bodyBold, fontSize: 9, color: Colors.accent, letterSpacing: 1.2 },
  courtAddress: { fontFamily: Typography.body, fontSize: 12, color: Colors.textSecondary },
  resultAction: { width: "100%", maxWidth: 380 },
  pressed: { opacity: 0.7 },
});
