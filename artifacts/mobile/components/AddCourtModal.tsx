import { Ionicons } from "@expo/vector-icons";
import {
  BottomSheetScrollView,
  BottomSheetTextInput,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppTabs } from "@/components/AppTabs";
import { BrutalistButton } from "@/components/BrutalistButton";
import { TaskBottomSheet } from "@/components/sheet/TaskBottomSheet";
import { Colors, Radius } from "@/constants/colors";
import { ControlSize, Spacing } from "@/constants/layout";
import { Typography, TypeScale } from "@/constants/typography";
import { useApp } from "@/context/AppContext";
import type {
  CourtAccessType,
  CourtSubmissionResult,
  VerifiedCourtSubmission,
} from "@/services/courtService";

type Step = "details" | "photo" | "verifying" | "result";

interface Props {
  visible: boolean;
  onClose: () => void;
  initialLatitude?: number;
  initialLongitude?: number;
}

const ACCESS_OPTIONS = [
  { value: "public_free", label: "Free" },
  { value: "public_paid", label: "Paid" },
  { value: "private_paid", label: "Private" },
] as const;

const US_STATE_CODES: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA",
  colorado: "CO", connecticut: "CT", delaware: "DE", florida: "FL", georgia: "GA",
  hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA",
  kansas: "KS", kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD",
  massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS",
  missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV",
  "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY",
  "north carolina": "NC", "north dakota": "ND", ohio: "OH", oklahoma: "OK",
  oregon: "OR", pennsylvania: "PA", "rhode island": "RI", "south carolina": "SC",
  "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT",
  virginia: "VA", washington: "WA", "west virginia": "WV", wisconsin: "WI",
  wyoming: "WY", "district of columbia": "DC",
};

function normalizeState(region: string | null | undefined): string {
  const trimmed = region?.trim() ?? "";
  if (/^[a-z]{2}$/i.test(trimmed)) return trimmed.toUpperCase();
  return US_STATE_CODES[trimmed.toLowerCase()] ?? "";
}

function buildAddress(place: Location.LocationGeocodedAddress): string {
  const street = [place.streetNumber, place.street].filter(Boolean).join(" ").trim();
  return street || place.name?.trim() || place.formattedAddress?.split(",")[0]?.trim() || "";
}

export function AddCourtModal({ visible, onClose, initialLatitude, initialLongitude }: Props) {
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
      // Coordinates remain usable. The editable fields make a failed device
      // geocoder recoverable instead of blocking the submission.
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
  }, [visible, initialLatitude, initialLongitude, fillAddress]);

  const getLocation = useCallback(async () => {
    setLocating(true);
    try {
      if (Platform.OS === "web") {
        await new Promise<void>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              setLatitude(position.coords.latitude);
              setLongitude(position.coords.longitude);
              resolve();
            },
            () => reject(new Error("Location unavailable")),
            { enableHighAccuracy: true, timeout: 10000 }
          );
        });
      } else {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== "granted") {
          Alert.alert("Location needed", "Allow location to pin the court you are standing at.");
          return;
        }
        const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        setLatitude(location.coords.latitude);
        setLongitude(location.coords.longitude);
        await fillAddress(location.coords.latitude, location.coords.longitude);
      }
    } catch {
      Alert.alert("Location unavailable", "Move closer to the court and try again.");
    } finally {
      setLocating(false);
    }
  }, [fillAddress]);

  const savePhoto = useCallback((asset: ImagePicker.ImagePickerAsset) => {
    if (!asset.base64) {
      Alert.alert("Photo unavailable", "LocalCheck could not read this photo. Please choose another one.");
      return;
    }
    setPhotoUri(asset.uri);
    setPhotoBase64(asset.base64);
    setPhotoMimeType(asset.mimeType ?? "image/jpeg");
  }, []);

  const pickPhoto = useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== "granted") {
      Alert.alert("Photo access needed", "Allow photo access to choose a court photo.");
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      quality: 0.65,
      base64: true,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (!picked.canceled && picked.assets[0]) savePhoto(picked.assets[0]);
  }, [savePhoto]);

  const takePhoto = useCallback(async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (permission.status !== "granted") {
      Alert.alert("Camera access needed", "Allow camera access to photograph the court.");
      return;
    }
    const captured = await ImagePicker.launchCameraAsync({
      mediaTypes: "images",
      quality: 0.65,
      base64: true,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (!captured.canceled && captured.assets[0]) savePhoto(captured.assets[0]);
  }, [savePhoto]);

  const detailsReady =
    latitude != null &&
    longitude != null &&
    address.trim().length >= 2 &&
    city.trim().length >= 2 &&
    /^[A-Za-z]{2}$/.test(stateCode.trim());

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
    setResult(nextResult);
    setStep("result");
  }, [detailsReady, latitude, longitude, photoBase64, name, address, city, stateCode, accessType, photoMimeType, addCourt]);

  const resetPhoto = useCallback(() => {
    setPhotoUri(null);
    setPhotoBase64(null);
    setResult(null);
    setStep("photo");
  }, []);

  const renderDetails = () => (
    <BottomSheetScrollView
      contentContainerStyle={[styles.content, { paddingBottom: bottom + Spacing.xl }]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.intro}>Pin the court where you are standing. Gemini identifies basketball or pickleball from your photo.</Text>

      <Text style={styles.fieldLabel}>COURT NAME — OPTIONAL</Text>
      <BottomSheetTextInput
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
        accessibilityRole="button"
        accessibilityLabel="Use my current location"
        disabled={locating}
        onPress={getLocation}
        style={({ pressed }) => [styles.locationAction, pressed && styles.pressed]}
      >
        {locating ? <ActivityIndicator color={Colors.accent} /> : <Ionicons name="locate" size={18} color={Colors.accent} />}
        <View style={styles.locationCopy}>
          <Text style={styles.locationActionTitle}>{locating ? "LOCATING…" : latitude == null ? "USE MY LOCATION" : "REFRESH LOCATION"}</Text>
          <Text style={styles.locationActionMeta}>
            {latitude == null || longitude == null ? "Required to place the court" : `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`}
          </Text>
        </View>
      </Pressable>

      <BottomSheetTextInput
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
        <BottomSheetTextInput
          accessibilityLabel="Court city"
          autoCapitalize="words"
          maxLength={80}
          onChangeText={setCity}
          placeholder="City"
          placeholderTextColor={Colors.mutedDark}
          style={[styles.input, styles.cityInput]}
          value={city}
        />
        <BottomSheetTextInput
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
      <AppTabs items={ACCESS_OPTIONS} value={accessType} onChange={setAccessType} variant="segmented" style={styles.accessTabs} />

      <BrutalistButton
        accessibilityHint="Continue to photograph the court"
        disabled={!detailsReady}
        icon={<Ionicons name="arrow-forward" size={17} color={Colors.black} />}
        label="Continue to photo"
        onPress={() => setStep("photo")}
        variant="accent"
      />
      {!detailsReady ? <Text style={styles.helper}>Add your current location, address, city, and two-letter state.</Text> : null}
    </BottomSheetScrollView>
  );

  const renderPhoto = () => (
    <BottomSheetScrollView
      contentContainerStyle={[styles.content, { paddingBottom: bottom + Spacing.xl }]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.intro}>Show the playable surface, lines, and hoops or net. The photo is analyzed for this submission and is not stored.</Text>
      {photoUri ? (
        <View style={styles.photoPreviewWrap}>
          <Image source={{ uri: photoUri }} style={styles.photoPreview} resizeMode="cover" />
          <Pressable accessibilityRole="button" onPress={resetPhoto} style={styles.retakeButton}>
            <Text style={styles.retakeText}>RETAKE</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.photoOptions}>
          <Pressable accessibilityRole="button" onPress={takePhoto} style={({ pressed }) => [styles.photoButton, pressed && styles.pressed]}>
            <Ionicons name="camera" size={27} color={Colors.accent} />
            <Text style={styles.photoButtonTitle}>TAKE PHOTO</Text>
            <Text style={styles.photoButtonMeta}>Best verification</Text>
          </Pressable>
          <View style={styles.photoDivider} />
          <Pressable accessibilityRole="button" onPress={pickPhoto} style={({ pressed }) => [styles.photoButton, pressed && styles.pressed]}>
            <Ionicons name="images" size={27} color={Colors.textSecondary} />
            <Text style={styles.photoButtonTitle}>PHOTO LIBRARY</Text>
            <Text style={styles.photoButtonMeta}>Choose a clear photo</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.infoBox}>
        <Ionicons name="sparkles" size={16} color={Colors.accent} />
        <Text style={styles.infoText}>Gemini detects the sport and court setting. Other sports, screenshots, renderings, or unclear photos are rejected.</Text>
      </View>

      <View style={styles.actionRow}>
        <BrutalistButton label="Back" onPress={() => setStep("details")} style={styles.secondaryAction} variant="outline" />
        <BrutalistButton
          disabled={!photoBase64}
          icon={<Ionicons name="shield-checkmark" size={17} color={Colors.black} />}
          label="Verify & add"
          onPress={submit}
          style={styles.primaryAction}
          variant="accent"
        />
      </View>
    </BottomSheetScrollView>
  );

  const renderVerifying = () => (
    <BottomSheetView style={[styles.centerContent, { paddingBottom: bottom + Spacing.xl }]}>
      <ActivityIndicator size="large" color={Colors.accent} />
      <Text style={styles.stateTitle}>CHECKING THE COURT</Text>
      <Text style={styles.stateBody}>Verifying the photo, checking nearby duplicates, and creating the court.</Text>
    </BottomSheetView>
  );

  const renderResult = () => {
    if (!result) return null;
    const added = result.verified && result.court;
    return (
      <BottomSheetView style={[styles.resultContent, { paddingBottom: bottom + Spacing.xl }]}>
        <View style={[styles.resultIcon, added ? styles.resultIconSuccess : styles.resultIconFailure]}>
          <Ionicons name={added ? "checkmark" : "close"} size={34} color={added ? Colors.accent : Colors.loss} />
        </View>
        <Text style={styles.stateTitle}>{added ? "COURT ADDED" : "PHOTO NOT VERIFIED"}</Text>
        <Text style={styles.stateBody}>{result.reason}</Text>
        {added ? (
          <View style={styles.courtSummary}>
            <Text style={styles.courtName}>{result.court?.name}</Text>
            <Text style={styles.detectedSport}>{result.sport} · {result.confidence}% confidence</Text>
            <Text style={styles.courtAddress}>{result.court?.address}</Text>
          </View>
        ) : null}
        <BrutalistButton
          label={added ? "Done" : "Try another photo"}
          onPress={added ? onClose : resetPhoto}
          style={styles.resultAction}
          variant={added ? "accent" : "outline"}
        />
      </BottomSheetView>
    );
  };

  const eyebrow = step === "details" ? "STEP 1 OF 2 · DETAILS" : step === "photo" ? "STEP 2 OF 2 · PHOTO" : step === "verifying" ? "GEMINI VISION" : "VERIFICATION RESULT";

  return (
    <TaskBottomSheet visible={visible} onClose={onClose} title="Add a court" eyebrow={eyebrow}>
      {step === "details" && renderDetails()}
      {step === "photo" && renderPhoto()}
      {step === "verifying" && renderVerifying()}
      {step === "result" && renderResult()}
    </TaskBottomSheet>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.screen, gap: Spacing.sm },
  intro: {
    fontFamily: Typography.body,
    ...TypeScale.bodyMedium,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  fieldLabel: {
    fontFamily: Typography.bodyBold,
    ...TypeScale.label,
    color: Colors.muted,
    letterSpacing: 1.4,
    marginTop: Spacing.xs,
  },
  input: {
    minHeight: ControlSize.regular,
    backgroundColor: Colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.text,
    fontFamily: Typography.body,
    fontSize: 15,
  },
  locationAction: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: 14,
    paddingVertical: Spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.accent,
    borderRadius: Radius.sm,
    backgroundColor: Colors.accentDim,
  },
  locationCopy: { flex: 1, gap: 2 },
  locationActionTitle: { fontFamily: Typography.heading, fontSize: 13, color: Colors.text, letterSpacing: 1.2 },
  locationActionMeta: { fontFamily: Typography.body, ...TypeScale.supporting, color: Colors.textSecondary },
  locationFields: { flexDirection: "row", gap: Spacing.sm },
  cityInput: { flex: 1 },
  stateInput: { width: 72, textAlign: "center" },
  accessTabs: { marginBottom: Spacing.sm },
  helper: { fontFamily: Typography.body, ...TypeScale.supporting, color: Colors.muted, textAlign: "center" },
  photoOptions: {
    height: 176,
    flexDirection: "row",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    overflow: "hidden",
    backgroundColor: Colors.surface,
  },
  photoButton: { flex: 1, alignItems: "center", justifyContent: "center", gap: 7, padding: Spacing.sm },
  photoDivider: { width: StyleSheet.hairlineWidth, backgroundColor: Colors.border },
  photoButtonTitle: { fontFamily: Typography.heading, fontSize: 12, color: Colors.text, letterSpacing: 1.2 },
  photoButtonMeta: { fontFamily: Typography.body, ...TypeScale.supporting, color: Colors.muted, textAlign: "center" },
  photoPreviewWrap: { borderRadius: Radius.md, overflow: "hidden", backgroundColor: Colors.surface },
  photoPreview: { width: "100%", height: 238 },
  retakeButton: { position: "absolute", right: Spacing.sm, bottom: Spacing.sm, minHeight: 36, justifyContent: "center", paddingHorizontal: 14, borderRadius: Radius.sm, backgroundColor: Colors.overlay },
  retakeText: { fontFamily: Typography.heading, fontSize: 11, color: Colors.text, letterSpacing: 1.2 },
  infoBox: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.sm, padding: Spacing.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border, borderRadius: Radius.sm, backgroundColor: Colors.surface },
  infoText: { flex: 1, fontFamily: Typography.body, ...TypeScale.supporting, color: Colors.textSecondary },
  actionRow: { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.xs },
  secondaryAction: { flex: 0.42 },
  primaryAction: { flex: 1 },
  centerContent: { flex: 1, alignItems: "center", justifyContent: "center", gap: Spacing.md, padding: Spacing.xl },
  resultContent: { flex: 1, alignItems: "center", padding: Spacing.xl, paddingTop: Spacing.xxl },
  resultIcon: { width: 76, height: 76, borderRadius: 38, alignItems: "center", justifyContent: "center", marginBottom: Spacing.md, borderWidth: 1 },
  resultIconSuccess: { borderColor: Colors.accent, backgroundColor: Colors.accentDim },
  resultIconFailure: { borderColor: Colors.loss, backgroundColor: Colors.lossDim },
  stateTitle: { fontFamily: Typography.heading, fontSize: 21, lineHeight: 26, color: Colors.text, letterSpacing: 1.8, textAlign: "center" },
  stateBody: { maxWidth: 330, fontFamily: Typography.body, ...TypeScale.bodyMedium, color: Colors.textSecondary, textAlign: "center" },
  courtSummary: { alignSelf: "stretch", gap: 4, marginTop: Spacing.lg, padding: Spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border, borderRadius: Radius.md, backgroundColor: Colors.surface },
  courtName: { fontFamily: Typography.heading, fontSize: 17, lineHeight: 22, color: Colors.text, letterSpacing: 0.8 },
  detectedSport: { fontFamily: Typography.bodyBold, ...TypeScale.label, color: Colors.accent, letterSpacing: 1, textTransform: "uppercase" },
  courtAddress: { fontFamily: Typography.body, ...TypeScale.supporting, color: Colors.textSecondary },
  resultAction: { alignSelf: "stretch", marginTop: Spacing.lg },
  pressed: { opacity: 0.72 },
});
