import { Feather } from "@expo/vector-icons";
import { Camera, CircleLayer, MapView, ShapeSource } from "@rnmapbox/maps";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Alert, Animated, Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { compactCourtLabel, normalizeState } from "@/components/addCourtModel";
import { BrutalistButton } from "@/components/BrutalistButton";
import { Colors, Radius } from "@/constants/colors";
import { Layout, Space } from "@/constants/layout";
import { Typography } from "@/constants/typography";
import { useApp } from "@/context/AppContext";
import type { CourtSubmissionResult } from "@/services/courtService";

type Step = 1 | 2 | 3;

function addressFrom(place: Location.LocationGeocodedAddress) {
  return [place.streetNumber, place.street].filter(Boolean).join(" ").trim() || place.name?.trim() || "";
}

export default function AddCourtRoute() {
  const router = useRouter();
  const { bottom } = useSafeAreaInsets();
  const { addCourt } = useApp();
  const cameraRef = React.useRef<React.ElementRef<typeof Camera>>(null);
  const pinDrop = React.useRef(new Animated.Value(-18)).current;
  const [step, setStep] = useState<Step>(1);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [suggestedOfficialName, setSuggestedOfficialName] = useState("");
  const [suggestedShortName, setSuggestedShortName] = useState("");
  const [officialName, setOfficialName] = useState("");
  const [shortName, setShortName] = useState("");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CourtSubmissionResult | null>(null);

  const reverseGeocode = useCallback(async (latitude: number, longitude: number) => {
    if (Platform.OS === "web") return;
    try {
      const [place] = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (!place) return;
      const street = addressFrom(place);
      const official = place.name?.trim() || street;
      const compact = compactCourtLabel(official, street);
      setAddress(street);
      setCity(place.city?.trim() || place.district?.trim() || "");
      setState(normalizeState(place.region));
      setSuggestedOfficialName(official);
      setSuggestedShortName(compact);
      setOfficialName((value) => !value || value === suggestedOfficialName ? official : value);
      setShortName((value) => !value || value === suggestedShortName ? compact : value);
    } catch { /* keep coordinates editable when geocoding is unavailable */ }
  }, [officialName, shortName, suggestedOfficialName, suggestedShortName]);

  const locate = useCallback(async () => {
    setBusy(true);
    try {
      if (Platform.OS === "web") {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 }));
        setLat(position.coords.latitude); setLng(position.coords.longitude);
      } else {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== "granted") { Alert.alert("Location needed", "Allow location to place the pin at the court."); return; }
        const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        setLat(location.coords.latitude); setLng(location.coords.longitude);
        pinDrop.setValue(-18);
        Animated.spring(pinDrop, { toValue: 0, useNativeDriver: true, damping: 14, stiffness: 180 }).start();
        cameraRef.current?.setCamera({ centerCoordinate: [location.coords.longitude, location.coords.latitude], zoomLevel: 16, animationDuration: 500 });
        await reverseGeocode(location.coords.latitude, location.coords.longitude);
      }
    } catch { Alert.alert("Location unavailable", "Move closer to the court and try again."); }
    finally { setBusy(false); }
  }, [reverseGeocode]);

  const takePhoto = useCallback(async () => {
    if (Platform.OS === "web") { Alert.alert("Live photo required", "Open LocalCheck on an iPhone to take the verification photo."); return; }
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (permission.status !== "granted") { Alert.alert("Camera access needed", "Allow camera access to photograph the court."); return; }
    const captured = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.65, base64: true, allowsEditing: true, aspect: [4, 3] });
    if (!captured.canceled && captured.assets[0]?.base64) { setPhotoUri(captured.assets[0].uri); setPhotoBase64(captured.assets[0].base64); }
  }, []);

  const submit = async () => {
    if (lat == null || lng == null || !photoBase64 || !officialName.trim() || !shortName.trim()) return;
    setBusy(true);
    const next = await addCourt({ suggestedOfficialName, suggestedShortName, officialName: officialName.trim(), shortName: shortName.trim(), name: officialName.trim(), address: address.trim(), city: city.trim(), state: state.trim().toUpperCase(), latitude: lat, longitude: lng, imageBase64: photoBase64, imageMimeType: "image/jpeg" });
    setResult(next); setBusy(false);
  };

  const canPlace = lat != null && lng != null && address.trim().length > 1 && city.trim().length > 1 && /^[A-Za-z]{2}$/.test(state);
  const edited = officialName.trim() !== suggestedOfficialName.trim() || shortName.trim() !== suggestedShortName.trim();
  return <View style={styles.root}>
    <View style={[styles.header, { paddingTop: Math.max(12, useSafeAreaInsets().top) }]}>
      <Pressable onPress={() => router.back()} accessibilityLabel="Close add court" accessibilityRole="button" style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}><Feather name="x" size={22} color={Colors.text} /></Pressable>
      <View><Text style={styles.eyebrow}>ADD COURT · STEP {result ? 3 : step} OF 3</Text><Text style={styles.title}>{result ? "Submitted for review" : "Add a court"}</Text></View>
    </View>
    {!result && <View style={styles.progress}><View style={[styles.progressFill, { width: `${(step / 3) * 100}%` }]} /></View>}
    {result ? <View style={styles.result}><View style={styles.resultIcon}><Feather name={result.court ? "check" : "x"} size={30} color={result.court ? Colors.win : Colors.loss} /></View><Text style={styles.resultTitle}>{result.court ? "PENDING REVIEW" : "SUBMISSION NOT SENT"}</Text><Text style={styles.body}>{result.court ? "Thanks — LocalCheck will review this court before it appears publicly." : result.reason}</Text><BrutalistButton label="DONE" onPress={() => router.back()} variant="accent" /></View> : <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottom + 30 }]} keyboardShouldPersistTaps="handled">
      <Text style={styles.body}>{step === 1 ? "Add a real court where you are standing. Place the pin, take a live photo, then review the details before submitting." : step === 2 ? "The live camera photo confirms the playable court. Existing photos and screenshots are not accepted." : "Check the place and names. New courts stay private to you until review is complete."}</Text>
      <View style={styles.steps}>{([[1, "Place pin"], [2, "Take live photo"], [3, "Review & submit"]] as Array<[number, string]>).map(([number, label]) => <View key={String(number)} style={styles.stepRow}><View style={[styles.stepNumber, step >= number && styles.stepNumberActive]}><Text style={styles.stepNumberText}>{number}</Text></View><Text style={[styles.stepText, step === number && styles.stepTextActive]}>{label}</Text></View>)}</View>
      {step === 1 && <><Pressable onPress={locate} style={styles.location} disabled={busy}><Feather name="map-pin" size={20} color={Colors.accent} /><View style={{ flex: 1 }}><Text style={styles.actionTitle}>{busy ? "LOCATING…" : lat == null ? "USE MY LOCATION" : "REFRESH LIVE LOCATION"}</Text><Text style={styles.meta}>{lat == null ? "Location is requested only when you tap here" : "Live GPS pin · refresh to update"}</Text></View><Feather name="crosshair" size={18} color={Colors.accent} /></Pressable>{Platform.OS === "web" ? <View style={{height:130,alignItems:"center",justifyContent:"center",gap:8,backgroundColor:Colors.surface,borderRadius:Radius.md,borderWidth:1,borderColor:Colors.border}}><Feather name="map-pin" size={24} color={Colors.accent} /><Text style={styles.meta}>The native map preview is available in the iPhone app.</Text></View> : <View style={{height:250,overflow:"hidden",borderRadius:Radius.md,borderWidth:1,borderColor:Colors.border,position:"relative"}}><MapView style={StyleSheet.absoluteFill} styleURL="mapbox://styles/mapbox/dark-v11" logoEnabled={false} scrollEnabled={false} zoomEnabled={false} rotateEnabled={false} pitchEnabled={false}><Camera ref={cameraRef} defaultSettings={{ centerCoordinate: [lng ?? -96, lat ?? 37.5], zoomLevel: lat == null ? 3 : 16 }} />{lat != null && lng != null ? <ShapeSource id="selected-court-pin" shape={{ type: "Feature", geometry: { type: "Point", coordinates: [lng, lat] }, properties: {} }}><CircleLayer id="selected-court-pin-layer" style={{ circleColor: Colors.accent, circleRadius: 11, circleStrokeColor: Colors.white, circleStrokeWidth: 2 }} /></ShapeSource> : null}</MapView><Animated.View pointerEvents="none" style={{position:"absolute",top:"50%",left:"50%",marginLeft:-14,marginTop:-24,transform:[{translateY:pinDrop}]}}><Feather name="map-pin" size={28} color={Colors.accent} /></Animated.View></View>}<Text style={styles.meta}>{lat == null ? "Place the pin at the playable court, then confirm it." : `${lat.toFixed(5)}, ${lng?.toFixed(5)} · confirm this pin before continuing`}</Text><TextInput style={styles.input} value={address} onChangeText={setAddress} placeholder="Street address or park name" placeholderTextColor={Colors.mutedDark} /><View style={styles.row}><TextInput style={[styles.input, { flex: 1 }]} value={city} onChangeText={setCity} placeholder="City" placeholderTextColor={Colors.mutedDark} /><TextInput style={[styles.input, { width: 74 }]} value={state} onChangeText={(v) => setState(v.replace(/[^A-Za-z]/g, "").toUpperCase())} maxLength={2} placeholder="ST" placeholderTextColor={Colors.mutedDark} /></View><BrutalistButton label="CONFIRM PIN & CONTINUE" disabled={!canPlace} onPress={async () => { if (lat != null && lng != null) await reverseGeocode(lat, lng); setStep(2); }} variant="accent" /></>}
      {step === 2 && <><Pressable onPress={takePhoto} style={styles.photo}>{photoUri ? <Image source={{ uri: photoUri }} style={styles.photoImage} /> : <><Feather name="camera" size={30} color={Colors.accent} /><Text style={styles.actionTitle}>TAKE LIVE PHOTO</Text><Text style={styles.meta}>{Platform.OS === "web" ? "Available in the iPhone app" : "Camera only · uploads disabled"}</Text></>}</Pressable><View style={styles.info}><Feather name="shield" size={16} color={Colors.accent} /><Text style={styles.meta}>Show the playable surface, lines, and hoops or net.</Text></View><View style={styles.actions}><BrutalistButton label="BACK" onPress={() => setStep(1)} variant="outline" /><BrutalistButton label="REVIEW" disabled={!photoBase64} onPress={() => setStep(3)} variant="accent" /></View></>}
      {step === 3 && <><Image source={{ uri: photoUri! }} style={styles.reviewPhoto} /><View style={styles.summary}><Text style={styles.actionTitle}>{address || "Pinned court"}</Text><Text style={styles.meta}>{city}, {state} · {lat?.toFixed(5)}, {lng?.toFixed(5)}</Text></View><Text style={styles.label}>OFFICIAL NAME</Text><TextInput style={styles.input} value={officialName} onChangeText={setOfficialName} /><Text style={styles.label}>SHORT CARD NAME</Text><TextInput style={styles.input} value={shortName} onChangeText={setShortName} maxLength={32} /><Text style={styles.meta}>Suggested: {suggestedShortName || "—"}</Text>{edited && <View style={styles.info}><Feather name="info" size={16} color={Colors.accent} /><Text style={styles.meta}>Edited names are checked by AI and manually reviewed before appearing publicly.</Text></View>}<View style={styles.actions}><BrutalistButton label="BACK" onPress={() => setStep(2)} variant="outline" /><BrutalistButton label={busy ? "SUBMITTING…" : "SUBMIT FOR REVIEW"} disabled={busy || !officialName.trim() || !shortName.trim()} onPress={submit} variant="accent" /></View></>}
    </ScrollView>}
  </View>;
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: Colors.background }, header: { flexDirection: "row", alignItems: "center", gap: 16, paddingHorizontal: Layout.screenGutter, paddingBottom: 14, backgroundColor: Colors.background }, eyebrow: { color: Colors.muted, fontFamily: Typography.bodyBold, fontSize: 10, letterSpacing: 1.4 }, title: { color: Colors.text, fontFamily: Typography.heading, fontSize: 26, marginTop: 2 }, progress: { height: 3, backgroundColor: Colors.surfaceHigh }, progressFill: { height: 3, backgroundColor: Colors.accent }, content: { padding: Layout.screenGutter, gap: Space.md }, body: { color: Colors.textSecondary, fontFamily: Typography.body, fontSize: 14, lineHeight: 21 }, steps: { gap: 10, padding: 14, backgroundColor: Colors.surface, borderColor: Colors.border, borderWidth: 1, borderRadius: Radius.md }, stepRow: { flexDirection: "row", alignItems: "center", gap: 10 }, stepNumber: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.border }, stepNumberActive: { backgroundColor: Colors.accent, borderColor: Colors.accent }, stepNumberText: { color: Colors.text, fontFamily: Typography.bodyBold, fontSize: 12 }, stepText: { color: Colors.muted, fontFamily: Typography.bodyMedium, fontSize: 13 }, stepTextActive: { color: Colors.text }, location: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.accent, borderRadius: Radius.md }, actionTitle: { color: Colors.text, fontFamily: Typography.bodyBold, fontSize: 12, letterSpacing: 1 }, meta: { color: Colors.muted, fontFamily: Typography.body, fontSize: 12, lineHeight: 18 }, input: { minHeight: 46, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.sm, paddingHorizontal: 12, color: Colors.text, fontFamily: Typography.body, fontSize: 14, backgroundColor: Colors.surface }, row: { flexDirection: "row", gap: 8 }, photo: { minHeight: 230, alignItems: "center", justifyContent: "center", gap: 10, borderWidth: 1, borderColor: Colors.accent, borderRadius: Radius.md, backgroundColor: Colors.surface, overflow: "hidden" }, photoImage: { width: "100%", height: 230 }, info: { flexDirection: "row", gap: 10, padding: 12, backgroundColor: Colors.surfaceHigh, borderRadius: Radius.sm }, actions: { flexDirection: "row", gap: 10 }, reviewPhoto: { width: "100%", height: 190, borderRadius: Radius.md }, summary: { gap: 4, padding: 12, backgroundColor: Colors.surface }, label: { color: Colors.muted, fontFamily: Typography.bodyBold, fontSize: 10, letterSpacing: 1.2 }, result: { flex: 1, padding: Layout.screenGutter, justifyContent: "center", alignItems: "center", gap: 16 }, resultIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.surfaceHigh, alignItems: "center", justifyContent: "center" }, resultTitle: { color: Colors.text, fontFamily: Typography.heading, fontSize: 22, letterSpacing: 1 }, });
