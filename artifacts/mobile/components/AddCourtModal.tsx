import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors, Radius } from "@/constants/colors";
import { Court, CourtSport, SPORT_ICONS } from "@/constants/data";
import { Typography } from "@/constants/typography";
import { useApp } from "@/context/AppContext";

const SPORTS: CourtSport[] = ["BASKETBALL", "PICKLEBALL", "TENNIS", "SOCCER", "VOLLEYBALL"];

type Step = "form" | "photo" | "verifying" | "result";

interface VerifyResult {
  verified: boolean;
  confidence: number;
  reason: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  initialLatitude?: number;
  initialLongitude?: number;
}

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

export function AddCourtModal({ visible, onClose, initialLatitude, initialLongitude }: Props) {
  const { currentUser, addCourt } = useApp();
  const { top, bottom } = useSafeAreaInsets();

  const [step, setStep] = useState<Step>("form");
  const [name, setName] = useState("");
  const [sport, setSport] = useState<CourtSport>("BASKETBALL");
  const [latitude, setLatitude] = useState<number | null>(initialLatitude ?? null);
  const [longitude, setLongitude] = useState<number | null>(initialLongitude ?? null);
  const [locating, setLocating] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);

  useEffect(() => {
    if (visible) {
      setStep("form");
      setName("");
      setSport("BASKETBALL");
      setPhotoUri(null);
      setPhotoBase64(null);
      setVerifyResult(null);
      if (initialLatitude && initialLongitude) {
        setLatitude(initialLatitude);
        setLongitude(initialLongitude);
      } else {
        setLatitude(null);
        setLongitude(null);
      }
    }
  }, [visible, initialLatitude, initialLongitude]);

  const getLocation = useCallback(async () => {
    setLocating(true);
    try {
      if (Platform.OS === "web") {
        await new Promise<void>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              setLatitude(pos.coords.latitude);
              setLongitude(pos.coords.longitude);
              resolve();
            },
            () => reject(new Error("Location unavailable")),
            { enableHighAccuracy: true, timeout: 10000 }
          );
        });
      } else {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          Alert.alert("Permission Denied", "Location permission is needed to pin your court.");
          return;
        }
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        setLatitude(loc.coords.latitude);
        setLongitude(loc.coords.longitude);
      }
    } catch {
      Alert.alert("Error", "Could not get your location. Please try again.");
    } finally {
      setLocating(false);
    }
  }, []);

  const pickPhoto = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Denied", "Photo library permission is needed.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      quality: 0.6,
      base64: true,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
      setPhotoBase64(result.assets[0].base64 ?? null);
    }
  }, []);

  const takePhoto = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Denied", "Camera permission is needed to verify the court.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: "images",
      quality: 0.6,
      base64: true,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
      setPhotoBase64(result.assets[0].base64 ?? null);
    }
  }, []);

  const verifyPhoto = useCallback(async () => {
    if (!photoBase64) return;
    setStep("verifying");
    try {
      const res = await fetch(`${API_BASE}/courts/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: photoBase64, sport }),
      });
      const data: VerifyResult = await res.json();
      setVerifyResult(data);
      setStep("result");
    } catch {
      setVerifyResult({
        verified: false,
        confidence: 0,
        reason: "Could not connect to verification service. Please check your connection.",
      });
      setStep("result");
    }
  }, [photoBase64, sport]);

  const confirmAddCourt = useCallback(async () => {
    if (!latitude || !longitude || !verifyResult?.verified) return;
    const courtName = name.trim() || `${sport.charAt(0) + sport.slice(1).toLowerCase()} Court`;
    const newCourt: Court = {
      id: `uc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: courtName,
      sport,
      neighborhood: "",
      city: "",
      address: "",
      latitude,
      longitude,
      activeCount: 0,
      status: "confirmed",
      addedBy: currentUser.id,
      verificationPhoto: photoUri ?? undefined,
    };
    await addCourt(newCourt);
    onClose();
  }, [name, sport, latitude, longitude, verifyResult, photoUri, currentUser, addCourt, onClose]);

  const renderForm = () => (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingBottom: bottom + 24 }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.stepLabel}>STEP 1 OF 2 — COURT DETAILS</Text>
      <Text style={styles.title}>ADD A COURT</Text>
      <Text style={styles.subtitle}>Pin a real court to the map. A photo is required for AI verification.</Text>

      <Text style={styles.fieldLabel}>COURT NAME (OPTIONAL)</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="e.g. West Side Courts"
        placeholderTextColor={Colors.mutedDark}
        autoCapitalize="words"
      />

      <Text style={styles.fieldLabel}>SPORT</Text>
      <View style={styles.sportRow}>
        {SPORTS.map((s) => (
          <Pressable
            key={s}
            style={[styles.sportBtn, sport === s && styles.sportBtnActive]}
            onPress={() => setSport(s)}
          >
            <Text style={styles.sportIcon}>{SPORT_ICONS[s]}</Text>
            <Text style={[styles.sportText, sport === s && styles.sportTextActive]}>
              {s.slice(0, 4)}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.fieldLabel}>YOUR LOCATION</Text>
      {latitude && longitude ? (
        <View style={styles.locationBox}>
          <Ionicons name="location" size={16} color={Colors.accent} />
          <Text style={styles.locationText}>
            {latitude.toFixed(5)}, {longitude.toFixed(5)}
          </Text>
          <Pressable onPress={getLocation} style={styles.refreshBtn}>
            <Ionicons name="refresh" size={14} color={Colors.muted} />
          </Pressable>
        </View>
      ) : (
        <Pressable style={styles.locationCta} onPress={getLocation} disabled={locating}>
          {locating ? (
            <ActivityIndicator size="small" color={Colors.accent} />
          ) : (
            <Ionicons name="locate" size={18} color={Colors.accent} />
          )}
          <Text style={styles.locationCtaText}>
            {locating ? "LOCATING..." : "DROP PIN AT MY LOCATION"}
          </Text>
        </Pressable>
      )}

      <Pressable
        style={[styles.nextBtn, (!latitude || !longitude) && styles.nextBtnDisabled]}
        onPress={() => setStep("photo")}
        disabled={!latitude || !longitude}
      >
        <Text style={styles.nextBtnText}>NEXT — TAKE PHOTO</Text>
        <Ionicons name="arrow-forward" size={16} color={Colors.black} />
      </Pressable>
    </ScrollView>
  );

  const renderPhoto = () => (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingBottom: bottom + 24 }]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.stepLabel}>STEP 2 OF 2 — VERIFY COURT</Text>
      <Text style={styles.title}>PHOTOGRAPH THE COURT</Text>
      <Text style={styles.subtitle}>
        Take a clear photo showing the court. AI will verify this is a real, accessible court.
      </Text>

      {photoUri ? (
        <View style={styles.photoPreviewWrap}>
          <Image source={{ uri: photoUri }} style={styles.photoPreview} resizeMode="cover" />
          <Pressable style={styles.retakeBtn} onPress={() => { setPhotoUri(null); setPhotoBase64(null); }}>
            <Text style={styles.retakeBtnText}>RETAKE</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.photoOptions}>
          <Pressable style={styles.photoBtn} onPress={takePhoto}>
            <Ionicons name="camera" size={28} color={Colors.accent} />
            <Text style={styles.photoBtnText}>TAKE PHOTO</Text>
          </Pressable>
          <View style={styles.photoDivider} />
          <Pressable style={styles.photoBtn} onPress={pickPhoto}>
            <Ionicons name="images" size={28} color={Colors.muted} />
            <Text style={styles.photoBtnText}>CHOOSE FROM LIBRARY</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.tipBox}>
        <Ionicons name="information-circle" size={14} color={Colors.accent} />
        <Text style={styles.tipText}>
          Make sure the court markings, hoops, or nets are clearly visible. Selfies or street photos will be rejected.
        </Text>
      </View>

      <View style={styles.rowBtns}>
        <Pressable style={styles.backBtn} onPress={() => setStep("form")}>
          <Ionicons name="arrow-back" size={16} color={Colors.muted} />
          <Text style={styles.backBtnText}>BACK</Text>
        </Pressable>
        <Pressable
          style={[styles.verifyBtn, !photoBase64 && styles.nextBtnDisabled]}
          onPress={verifyPhoto}
          disabled={!photoBase64}
        >
          <Text style={styles.nextBtnText}>VERIFY WITH AI</Text>
          <Ionicons name="shield-checkmark" size={16} color={Colors.black} />
        </Pressable>
      </View>
    </ScrollView>
  );

  const renderVerifying = () => (
    <View style={[styles.content, styles.centerContent, { paddingBottom: bottom + 24 }]}>
      <ActivityIndicator size="large" color={Colors.accent} />
      <Text style={styles.verifyingTitle}>ANALYZING PHOTO...</Text>
      <Text style={styles.verifyingText}>
        Our AI is checking that this is a real, accessible court. This takes just a moment.
      </Text>
    </View>
  );

  const renderResult = () => {
    if (!verifyResult) return null;
    const { verified, confidence, reason } = verifyResult;
    return (
      <View style={[styles.content, { paddingBottom: bottom + 24 }]}>
        <View style={[styles.resultBadge, verified ? styles.resultBadgeOk : styles.resultBadgeFail]}>
          <Ionicons
            name={verified ? "checkmark-circle" : "close-circle"}
            size={48}
            color={verified ? Colors.accent : "#FF3B30"}
          />
        </View>
        <Text style={styles.resultTitle}>{verified ? "COURT VERIFIED!" : "NOT VERIFIED"}</Text>
        <Text style={styles.resultReason}>{reason}</Text>
        {verified && (
          <Text style={styles.resultConfidence}>{confidence}% confidence</Text>
        )}

        {verified ? (
          <>
            <View style={styles.courtInfoPreview}>
              <Text style={styles.courtPreviewName}>{name.trim() || `${sport.charAt(0) + sport.slice(1).toLowerCase()} Court`}</Text>
              <Text style={styles.courtPreviewCoords}>{latitude?.toFixed(5)}, {longitude?.toFixed(5)}</Text>
              <View style={styles.courtPreviewStatus}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>CONFIRMED COURT</Text>
              </View>
            </View>
            <Pressable style={styles.addBtn} onPress={confirmAddCourt}>
              <Ionicons name="add-circle" size={18} color={Colors.black} />
              <Text style={styles.nextBtnText}>ADD TO MAP</Text>
            </Pressable>
          </>
        ) : (
          <View style={styles.rowBtns}>
            <Pressable style={styles.backBtn} onPress={() => { setStep("photo"); setPhotoUri(null); setPhotoBase64(null); }}>
              <Ionicons name="camera" size={16} color={Colors.muted} />
              <Text style={styles.backBtnText}>NEW PHOTO</Text>
            </Pressable>
            <Pressable style={styles.backBtn} onPress={onClose}>
              <Text style={styles.backBtnText}>CANCEL</Text>
            </Pressable>
          </View>
        )}
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.modal, { paddingTop: Platform.OS === "ios" ? top : top + 12 }]}>
        <View style={styles.header}>
          <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={12}>
            <Ionicons name="close" size={22} color={Colors.muted} />
          </Pressable>
          <View style={styles.progressRow}>
            {["form", "photo", "verifying", "result"].map((s, i) => (
              <View
                key={s}
                style={[
                  styles.progressDot,
                  (step === s ||
                    (step === "verifying" && i <= 2) ||
                    (step === "result" && i <= 3) ||
                    (step === "photo" && i <= 1) ||
                    (step === "form" && i === 0)) && styles.progressDotActive,
                ]}
              />
            ))}
          </View>
        </View>

        {step === "form" && renderForm()}
        {step === "photo" && renderPhoto()}
        {step === "verifying" && renderVerifying()}
        {step === "result" && renderResult()}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: Colors.border,
  },
  closeBtn: { padding: 4 },
  progressRow: { flexDirection: "row", gap: 6 },
  progressDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: Colors.border,
  },
  progressDotActive: { backgroundColor: Colors.accent },
  content: { padding: 24 },
  centerContent: {
    flex: 1, justifyContent: "center", alignItems: "center",
    gap: 16, padding: 24,
  },
  stepLabel: {
    fontFamily: Typography.heading, fontSize: 10, color: Colors.accent,
    letterSpacing: 2, marginBottom: 4,
  },
  title: {
    fontFamily: Typography.heading, fontSize: 26, color: Colors.white,
    letterSpacing: 1, marginBottom: 8,
  },
  subtitle: {
    fontFamily: Typography.body, fontSize: 13, color: Colors.muted,
    lineHeight: 19, marginBottom: 28,
  },
  fieldLabel: {
    fontFamily: Typography.heading, fontSize: 10, color: Colors.mutedDark,
    letterSpacing: 2, marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.white,
    fontFamily: Typography.body,
    fontSize: 15,
    marginBottom: 24,
  },
  sportRow: {
    flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 24,
  },
  sportBtn: {
    alignItems: "center", justifyContent: "center",
    paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: Radius.sm, gap: 2, minWidth: 56,
  },
  sportBtnActive: { borderColor: Colors.accent, backgroundColor: "rgba(255,85,0,0.08)" },
  sportIcon: { fontSize: 18 },
  sportText: {
    fontFamily: Typography.heading, fontSize: 9, color: Colors.mutedDark,
    letterSpacing: 1,
  },
  sportTextActive: { color: Colors.accent },
  locationBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: Colors.card, borderWidth: 1,
    borderColor: Colors.accent, borderRadius: Radius.sm,
    padding: 12, marginBottom: 28,
  },
  locationText: { fontFamily: Typography.body, fontSize: 13, color: Colors.white, flex: 1 },
  refreshBtn: { padding: 4 },
  locationCta: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: Colors.card, borderWidth: 1.5,
    borderColor: Colors.border, borderRadius: Radius.sm,
    padding: 14, marginBottom: 28,
  },
  locationCtaText: {
    fontFamily: Typography.heading, fontSize: 12, color: Colors.white, letterSpacing: 1.5,
  },
  nextBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, backgroundColor: Colors.accent,
    borderRadius: Radius.sm, paddingVertical: 14,
  },
  nextBtnDisabled: { opacity: 0.35 },
  nextBtnText: {
    fontFamily: Typography.heading, fontSize: 13, color: Colors.black, letterSpacing: 2,
  },
  photoOptions: {
    flexDirection: "row", borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.sm, overflow: "hidden", marginBottom: 20,
    height: 160,
  },
  photoBtn: {
    flex: 1, alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: Colors.card,
  },
  photoDivider: { width: 1, backgroundColor: Colors.border },
  photoBtnText: {
    fontFamily: Typography.heading, fontSize: 9, color: Colors.muted, letterSpacing: 1.5,
    textAlign: "center",
  },
  photoPreviewWrap: { marginBottom: 20, borderRadius: Radius.sm, overflow: "hidden" },
  photoPreview: { width: "100%", height: 200, borderRadius: Radius.sm },
  retakeBtn: {
    position: "absolute", bottom: 8, right: 8,
    backgroundColor: "rgba(0,0,0,0.7)", borderRadius: Radius.xs,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  retakeBtnText: {
    fontFamily: Typography.heading, fontSize: 9, color: Colors.white, letterSpacing: 1.5,
  },
  tipBox: {
    flexDirection: "row", gap: 8, alignItems: "flex-start",
    backgroundColor: "rgba(255,85,0,0.06)", borderWidth: 1,
    borderColor: "rgba(255,85,0,0.2)", borderRadius: Radius.sm,
    padding: 12, marginBottom: 24,
  },
  tipText: {
    flex: 1, fontFamily: Typography.body, fontSize: 12, color: Colors.muted,
    lineHeight: 17,
  },
  rowBtns: { flexDirection: "row", gap: 10 },
  backBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.sm,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  backBtnText: {
    fontFamily: Typography.heading, fontSize: 11, color: Colors.muted, letterSpacing: 1.5,
  },
  verifyBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, backgroundColor: Colors.accent, borderRadius: Radius.sm, paddingVertical: 14,
  },
  verifyingTitle: {
    fontFamily: Typography.heading, fontSize: 20, color: Colors.white,
    letterSpacing: 2, textAlign: "center",
  },
  verifyingText: {
    fontFamily: Typography.body, fontSize: 13, color: Colors.muted,
    textAlign: "center", lineHeight: 19, maxWidth: 280,
  },
  resultBadge: {
    width: 100, height: 100, borderRadius: 50,
    alignItems: "center", justifyContent: "center",
    marginBottom: 12, alignSelf: "center",
  },
  resultBadgeOk: { backgroundColor: "rgba(255,85,0,0.1)", borderWidth: 2, borderColor: Colors.accent },
  resultBadgeFail: { backgroundColor: "rgba(255,59,48,0.1)", borderWidth: 2, borderColor: "#FF3B30" },
  resultTitle: {
    fontFamily: Typography.heading, fontSize: 22, color: Colors.white,
    letterSpacing: 2, textAlign: "center", marginBottom: 8,
  },
  resultReason: {
    fontFamily: Typography.body, fontSize: 14, color: Colors.muted,
    textAlign: "center", lineHeight: 20, marginBottom: 6,
  },
  resultConfidence: {
    fontFamily: Typography.bodyMedium, fontSize: 12, color: Colors.accent,
    textAlign: "center", marginBottom: 24, letterSpacing: 0.5,
  },
  courtInfoPreview: {
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.sm, padding: 16, marginBottom: 20, gap: 4,
  },
  courtPreviewName: {
    fontFamily: Typography.heading, fontSize: 16, color: Colors.white, letterSpacing: 1,
  },
  courtPreviewCoords: {
    fontFamily: Typography.body, fontSize: 12, color: Colors.muted,
  },
  courtPreviewStatus: {
    flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4,
  },
  statusDot: {
    width: 8, height: 8, borderRadius: 4, borderWidth: 1.5, borderColor: Colors.accent,
  },
  statusText: {
    fontFamily: Typography.heading, fontSize: 9, color: Colors.accent, letterSpacing: 1.5,
  },
  addBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, backgroundColor: Colors.accent, borderRadius: Radius.sm, paddingVertical: 14,
  },
});
