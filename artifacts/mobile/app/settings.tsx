import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PlayerAvatar } from "@/components/PlayerAvatar";
import { Colors, Radius } from "@/constants/colors";
import { CourtSport, getSportColor } from "@/constants/data";
import { Typography } from "@/constants/typography";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";

type Visibility = "public" | "friends" | "private";

const VISIBILITY_OPTIONS: { value: Visibility; label: string; icon: string; desc: string }[] = [
  { value: "public", label: "PUBLIC", icon: "globe-outline", desc: "Anyone can see your profile and rank" },
  { value: "friends", label: "FRIENDS", icon: "people-outline", desc: "Only friends see your activity" },
  { value: "private", label: "PRIVATE", icon: "lock-closed-outline", desc: "Your profile is hidden from rankings" },
];

function LocalPlusModal({
  visible,
  onClose,
  onUpgrade,
}: {
  visible: boolean;
  onClose: () => void;
  onUpgrade: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>LOCALPLUS</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={22} color={Colors.muted} />
            </Pressable>
          </View>

          <View style={styles.plusHero}>
            <Ionicons name="star" size={32} color={Colors.accent} />
            <Text style={styles.plusPrice}>$4.99/mo</Text>
          </View>

          <View style={styles.plusBenefits}>
            <View style={styles.benefitRow}>
              <Ionicons name="infinite" size={16} color={Colors.accent} />
              <Text style={styles.benefitText}>Full match history — every game</Text>
            </View>
            <View style={styles.benefitRow}>
              <Ionicons name="trophy" size={16} color={Colors.accent} />
              <Text style={styles.benefitText}>Public leaderboard visibility</Text>
            </View>
            <View style={styles.benefitRow}>
              <Ionicons name="analytics" size={16} color={Colors.accent} />
              <Text style={styles.benefitText}>Advanced stats & trends</Text>
            </View>
            <View style={styles.benefitRow}>
              <Ionicons name="color-wand" size={16} color={Colors.accent} />
              <Text style={styles.benefitText}>Custom profile badge</Text>
            </View>
          </View>

          <Pressable style={styles.upgradeBtn} onPress={onUpgrade}>
            <Text style={styles.upgradeBtnText}>UPGRADE TO LOCALPLUS</Text>
          </Pressable>
          <Pressable style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelBtnText}>MAYBE LATER</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const { currentUser, isLocalPlus, setVisibility, visibility, preferredSport, setPreferredSport, preferredCourtId, setPreferredCourtId, localCourt } = useApp();
  const { user, profile, signOut } = useAuth();
  const { top, bottom } = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : top;

  const [showPlusModal, setShowPlusModal] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [locationSharing, setLocationSharing] = useState(true);
  const [haptics, setHaptics] = useState(true);
  const [darkMode, setDarkMode] = useState(true);

  const handleUpgrade = () => {
    setShowPlusModal(false);
    // In a real app, this would trigger an IAP flow
    Alert.alert("LocalPlus", "This would open the App Store purchase flow.", [{ text: "OK" }]);
  };

  const handleLogout = () => {
    Alert.alert("Log Out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log Out",
        style: "destructive",
        onPress: async () => {
          await signOut();
          router.push("/auth");
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "This permanently deletes all your data. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => Alert.alert("Account deletion request sent.", "", [{ text: "OK" }]),
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 12 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>SETTINGS</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 84 : bottom + 100 }}
      >
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <PlayerAvatar initials={currentUser.avatar} size={56} />
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{currentUser.name.toUpperCase()}</Text>
            <View style={styles.profileBadges}>
              <Text style={[styles.profileTier, { color: getTierColor(currentUser.tier) }]}>
                {currentUser.tier}
              </Text>
              {isLocalPlus && (
                <View style={styles.plusBadge}>
                  <Ionicons name="star" size={10} color={Colors.accent} />
                  <Text style={styles.plusBadgeText}>LOCALPLUS</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Visibility Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PROFILE VISIBILITY</Text>
          <View style={styles.sectionCard}>
            {VISIBILITY_OPTIONS.map((opt) => {
              const active = visibility === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  style={[styles.visibilityRow, active && styles.visibilityRowActive]}
                  onPress={() => setVisibility(opt.value)}
                >
                  <View style={styles.visibilityLeft}>
                    <Ionicons
                      name={opt.icon as any}
                      size={18}
                      color={active ? Colors.text : Colors.muted}
                    />
                    <View>
                      <Text style={[styles.visibilityLabel, active && styles.visibilityLabelActive]}>
                        {opt.label}
                      </Text>
                      <Text style={styles.visibilityDesc}>{opt.desc}</Text>
                    </View>
                  </View>
                  {active && <Ionicons name="checkmark" size={18} color={Colors.accent} />}
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* LocalPlus Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SUBSCRIPTION</Text>
          <View style={styles.sectionCard}>
            {isLocalPlus ? (
              <View style={styles.plusActiveRow}>
                <View style={styles.plusActiveLeft}>
                  <Ionicons name="star" size={20} color={Colors.accent} />
                  <View>
                    <Text style={styles.plusActiveTitle}>LOCALPLUS ACTIVE</Text>
                    <Text style={styles.plusActiveSub}>Renews on Jul 20, 2026</Text>
                  </View>
                </View>
                <Text style={styles.plusActivePrice}>$4.99/mo</Text>
              </View>
            ) : (
              <Pressable style={styles.plusUpgradeRow} onPress={() => setShowPlusModal(true)}>
                <View style={styles.plusUpgradeLeft}>
                  <Ionicons name="star-outline" size={20} color={Colors.accent} />
                  <View>
                    <Text style={styles.plusUpgradeTitle}>UPGRADE TO LOCALPLUS</Text>
                    <Text style={styles.plusUpgradeSub}>Unlock full history & public rank</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Colors.muted} />
              </Pressable>
            )}
          </View>
        </View>

        {/* Preferences Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PREFERENCES</Text>
          <View style={styles.sectionCard}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleLeft}>
                <Ionicons name="notifications-outline" size={18} color={Colors.text} />
                <Text style={styles.toggleLabel}>Push Notifications</Text>
              </View>
              <Switch
                value={notifications}
                onValueChange={setNotifications}
                trackColor={{ false: Colors.mutedDark, true: Colors.accentDim }}
                thumbColor={notifications ? Colors.accent : Colors.muted}
              />
            </View>
            <View style={styles.divider} />
            <View style={styles.toggleRow}>
              <View style={styles.toggleLeft}>
                <Ionicons name="location-outline" size={18} color={Colors.text} />
                <Text style={styles.toggleLabel}>Location Sharing</Text>
              </View>
              <Switch
                value={locationSharing}
                onValueChange={setLocationSharing}
                trackColor={{ false: Colors.mutedDark, true: Colors.accentDim }}
                thumbColor={locationSharing ? Colors.accent : Colors.muted}
              />
            </View>
            <View style={styles.divider} />
            <View style={styles.toggleRow}>
              <View style={styles.toggleLeft}>
                <Ionicons name="pulse-outline" size={18} color={Colors.text} />
                <Text style={styles.toggleLabel}>Haptic Feedback</Text>
              </View>
              <Switch
                value={haptics}
                onValueChange={setHaptics}
                trackColor={{ false: Colors.mutedDark, true: Colors.accentDim }}
                thumbColor={haptics ? Colors.accent : Colors.muted}
              />
            </View>
            <View style={styles.divider} />
            <View style={styles.toggleRow}>
              <View style={styles.toggleLeft}>
                <Ionicons name="moon-outline" size={18} color={Colors.text} />
                <Text style={styles.toggleLabel}>Dark Mode</Text>
              </View>
              <Switch
                value={darkMode}
                onValueChange={setDarkMode}
                trackColor={{ false: Colors.mutedDark, true: Colors.accentDim }}
                thumbColor={darkMode ? Colors.accent : Colors.muted}
              />
            </View>
          </View>
        </View>

        {/* Sport Preferences Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SPORT PREFERENCES</Text>
          <View style={styles.sectionCard}>
            <View style={styles.prefRow}>
              <View style={styles.prefLeft}>
                <Ionicons name="basketball-outline" size={18} color={Colors.text} />
                <View>
                  <Text style={styles.prefLabel}>PREFERRED SPORT</Text>
                  <Text style={styles.prefDesc}>Default sport for compete & log game</Text>
                </View>
              </View>
            </View>
            <View style={styles.prefSportRow}>
              {(["BASKETBALL", "PICKLEBALL"] as CourtSport[]).map((s) => (
                <Pressable
                  key={s}
                  style={[
                    styles.prefSportPill,
                    preferredSport === s && styles.prefSportPillActive,
                  ]}
                  onPress={() => setPreferredSport(preferredSport === s ? null : s)}
                >
                  <View style={[styles.prefSportDot, { backgroundColor: getSportColor(s) }]} />
                  <Text style={[styles.prefSportText, preferredSport === s && styles.prefSportTextActive]}>
                    {s === "BASKETBALL" ? "BB" : "PB"}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.divider} />

            {/* Local court — set via Explore, not a list */}
            <Pressable style={styles.actionRow} onPress={() => router.push("/(tabs)/explore")}>
              <View style={styles.actionLeft}>
                <Ionicons name="location-outline" size={18} color={Colors.text} />
                <View>
                  <Text style={styles.prefLabel}>LOCAL COURT</Text>
                  <Text style={styles.prefDesc}>
                    {localCourt ? localCourt.name : "Not set — tap to explore"}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.muted} />
            </Pressable>
          </View>
        </View>

        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ACCOUNT</Text>
          <View style={styles.sectionCard}>
            <Pressable style={styles.actionRow} onPress={() => router.push("/auth")}>
              <View style={styles.actionLeft}>
                <Ionicons name="person-circle-outline" size={18} color={Colors.text} />
                <View>
                  <Text style={styles.actionLabel}>{user ? "MANAGE ACCOUNT" : "SIGN IN"}</Text>
                  {user && (
                    <Text style={[styles.actionLabel, { fontSize: 10, color: Colors.muted, letterSpacing: 0.5 }]}>
                      {profile?.display_name ?? user.email}
                    </Text>
                  )}
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.muted} />
            </Pressable>
            <View style={styles.divider} />
            <Pressable style={styles.actionRow}>
              <View style={styles.actionLeft}>
                <Ionicons name="shield-outline" size={18} color={Colors.text} />
                <Text style={styles.actionLabel}>Privacy Policy</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.muted} />
            </Pressable>
            <View style={styles.divider} />
            <Pressable style={styles.actionRow}>
              <View style={styles.actionLeft}>
                <Ionicons name="document-text-outline" size={18} color={Colors.text} />
                <Text style={styles.actionLabel}>Terms of Service</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.muted} />
            </Pressable>
            <View style={styles.divider} />
            <Pressable style={styles.actionRow}>
              <View style={styles.actionLeft}>
                <Ionicons name="help-circle-outline" size={18} color={Colors.text} />
                <Text style={styles.actionLabel}>Support & FAQ</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.muted} />
            </Pressable>
          </View>
        </View>

        {/* Danger Zone */}
        <View style={styles.section}>
          <View style={[styles.sectionCard, styles.dangerCard]}>
            <Pressable style={styles.dangerRow} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={18} color={Colors.loss} />
              <Text style={styles.dangerLabel}>Log Out</Text>
            </Pressable>
            <View style={styles.divider} />
            <Pressable style={styles.dangerRow} onPress={handleDeleteAccount}>
              <Ionicons name="trash-outline" size={18} color={Colors.loss} />
              <Text style={styles.dangerLabel}>Delete Account</Text>
            </Pressable>
          </View>
        </View>

        <Text style={styles.version}>LocalCheck v1.0.0</Text>
      </ScrollView>

      <LocalPlusModal visible={showPlusModal} onClose={() => setShowPlusModal(false)} onUpgrade={handleUpgrade} />
    </View>
  );
}

function getTierColor(tier: string): string {
  switch (tier) {
    case "PLATINUM": return "#E8E8FF";
    case "GOLD": return "#FFD53D";
    case "SILVER": return "#C8C8D0";
    case "BRONZE": return "#CF8558";
    default: return "#555566";
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: Colors.surface,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontFamily: Typography.heading,
    fontSize: 16,
    color: Colors.text,
    letterSpacing: 2,
  },

  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  profileInfo: { gap: 4 },
  profileName: {
    fontFamily: Typography.heading,
    fontSize: 20,
    color: Colors.white,
    letterSpacing: 0.5,
  },
  profileBadges: { flexDirection: "row", gap: 8, alignItems: "center" },
  profileTier: {
    fontFamily: Typography.bodyBold,
    fontSize: 11,
    letterSpacing: 1.5,
  },
  plusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.accentDim,
    borderWidth: 1,
    borderColor: Colors.accent,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.xs,
  },
  plusBadgeText: {
    fontFamily: Typography.bodyBold,
    fontSize: 9,
    color: Colors.accent,
    letterSpacing: 1,
  },

  section: { paddingHorizontal: 20, marginBottom: 20 },
  sectionTitle: {
    fontFamily: Typography.bodyMedium,
    fontSize: 10,
    color: Colors.muted,
    letterSpacing: 2.5,
    marginBottom: 8,
    textTransform: "uppercase" as const,
  },
  sectionCard: {
    backgroundColor: Colors.surface,
    borderWidth: 0.5,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    overflow: "hidden",
  },

  visibilityRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  visibilityRowActive: {
    backgroundColor: Colors.surfaceHigh,
  },
  visibilityLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  visibilityLabel: {
    fontFamily: Typography.heading,
    fontSize: 13,
    color: Colors.muted,
    letterSpacing: 1,
  },
  visibilityLabelActive: {
    color: Colors.text,
  },
  visibilityDesc: {
    fontFamily: Typography.body,
    fontSize: 11,
    color: Colors.mutedDark,
    marginTop: 2,
  },

  plusUpgradeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  plusUpgradeLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  plusUpgradeTitle: {
    fontFamily: Typography.heading,
    fontSize: 13,
    color: Colors.accent,
    letterSpacing: 1,
  },
  plusUpgradeSub: {
    fontFamily: Typography.body,
    fontSize: 11,
    color: Colors.muted,
    marginTop: 2,
  },

  plusActiveRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  plusActiveLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  plusActiveTitle: {
    fontFamily: Typography.heading,
    fontSize: 13,
    color: Colors.accent,
    letterSpacing: 1,
  },
  plusActiveSub: {
    fontFamily: Typography.body,
    fontSize: 11,
    color: Colors.muted,
    marginTop: 2,
  },
  plusActivePrice: {
    fontFamily: Typography.heading,
    fontSize: 14,
    color: Colors.text,
  },

  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  toggleLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  toggleLabel: {
    fontFamily: Typography.body,
    fontSize: 14,
    color: Colors.text,
  },

  divider: {
    height: 0.5,
    backgroundColor: Colors.border,
    marginLeft: 48,
  },

  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  actionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  actionLabel: {
    fontFamily: Typography.body,
    fontSize: 14,
    color: Colors.text,
  },

  dangerCard: {
    borderColor: Colors.lossDim,
  },
  dangerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  dangerLabel: {
    fontFamily: Typography.body,
    fontSize: 14,
    color: Colors.loss,
  },

  version: {
    fontFamily: Typography.body,
    fontSize: 11,
    color: Colors.mutedDark,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 20,
  },

  // Sport Preferences
  prefRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 4,
    gap: 12,
  },
  prefLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  prefLabel: {
    fontFamily: Typography.heading,
    fontSize: 12,
    color: Colors.text,
    letterSpacing: 1,
  },
  prefDesc: {
    fontFamily: Typography.body,
    fontSize: 11,
    color: Colors.mutedDark,
    marginTop: 2,
  },
  prefSportRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  prefSportPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 0.5,
    borderColor: Colors.border,
    padding: 10,
    borderRadius: Radius.xs,
    backgroundColor: Colors.surface,
    justifyContent: "center",
  },
  prefSportPillActive: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentDim,
  },
  prefSportDot: { width: 8, height: 8, borderRadius: 4 },
  prefSportText: {
    fontFamily: Typography.heading,
    fontSize: 12,
    color: Colors.muted,
    letterSpacing: 1,
  },
  prefSportTextActive: { color: Colors.text },
  prefCourtRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  prefCourtPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 0.5,
    borderColor: Colors.border,
    borderRadius: Radius.xs,
    backgroundColor: Colors.surface,
  },
  prefCourtPillActive: {
    borderColor: Colors.text,
    backgroundColor: Colors.surfaceHigh,
  },
  prefCourtText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 11,
    color: Colors.muted,
  },
  prefCourtTextActive: { color: Colors.text },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 20,
    gap: 12,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalTitle: {
    fontFamily: Typography.heading,
    fontSize: 14,
    color: Colors.text,
    letterSpacing: 2,
  },
  plusHero: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  plusPrice: {
    fontFamily: Typography.heading,
    fontSize: 28,
    color: Colors.text,
    letterSpacing: -0.5,
  },
  plusBenefits: {
    gap: 10,
    paddingVertical: 4,
  },
  benefitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  benefitText: {
    fontFamily: Typography.body,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  upgradeBtn: {
    backgroundColor: Colors.accent,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  upgradeBtnText: {
    fontFamily: Typography.heading,
    fontSize: 13,
    color: Colors.white,
    letterSpacing: 1.5,
  },
  cancelBtn: {
    paddingVertical: 12,
    alignItems: "center",
  },
  cancelBtnText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 12,
    color: Colors.muted,
    letterSpacing: 1,
  },
});
