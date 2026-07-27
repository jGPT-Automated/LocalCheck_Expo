import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { Colors, Radius } from "@/constants/colors";
import {
  Court,
  getCourtIdentityColor,
} from "@/constants/data";
import { Typography } from "@/constants/typography";
import { LivePulse } from "./LivePulse";

interface CourtListItemProps {
  court: Court;
  onPress: (court: Court) => void;
  isCheckedIn?: boolean;
  isLocalCourt?: boolean;
  featured?: boolean;
  onCheckIn?: (court: Court) => void;
}

function SportGlyph({ sport, color }: { sport: Court["sport"]; color: string }) {
  if (sport === "BASKETBALL") {
    return (
      <View style={[styles.glyphBall, { borderColor: color }]}>
        <View style={[styles.glyphBallVertical, { backgroundColor: color }]} />
        <View style={[styles.glyphBallHorizontal, { backgroundColor: color }]} />
      </View>
    );
  }
  if (sport === "PICKLEBALL" || sport === "TENNIS") {
    return (
      <View style={styles.glyphPaddleWrap}>
        <View style={[styles.glyphPaddle, { borderColor: color }]} />
        <View style={[styles.glyphPaddleHandle, { backgroundColor: color }]} />
        <View style={[styles.glyphPaddleBall, { backgroundColor: color }]} />
      </View>
    );
  }
  return <Feather name="circle" size={13} color={color} />;
}

function CourtGeometry({ sport, color }: { sport: Court["sport"]; color: string }) {
  if (sport === "BASKETBALL") {
    return (
      <View pointerEvents="none" style={styles.artLayer}>
        <View style={[styles.basketballArc, { borderColor: `${color}55` }]} />
        <View style={[styles.basketballKey, { borderColor: `${color}3D` }]} />
        <View style={[styles.basketballCircle, { borderColor: `${color}66` }]} />
        <View style={[styles.basketballBaseline, { backgroundColor: `${color}3D` }]} />
      </View>
    );
  }

  if (sport === "PICKLEBALL" || sport === "TENNIS") {
    return (
      <View pointerEvents="none" style={styles.artLayer}>
        <View style={[styles.courtOutline, { borderColor: `${color}3D` }]} />
        <View style={[styles.courtNet, { backgroundColor: `${color}66` }]} />
        <View style={[styles.courtCenter, { backgroundColor: `${color}3D` }]} />
        {Array.from({ length: 5 }).map((_, index) => (
          <View
            key={index}
            style={[
              styles.courtDot,
              {
                backgroundColor: `${color}42`,
                top: 24 + index * 22,
                right: 18 + (index % 2) * 22,
              },
            ]}
          />
        ))}
      </View>
    );
  }

  return (
    <View pointerEvents="none" style={styles.artLayer}>
      <View style={[styles.genericRing, { borderColor: `${color}4D` }]} />
      <View style={[styles.genericLine, { backgroundColor: `${color}3D` }]} />
    </View>
  );
}

export function CourtListItem({
  court,
  onPress,
  isCheckedIn,
  isLocalCourt,
  featured,
  onCheckIn,
}: CourtListItemProps) {
  const isActive = court.activeCount > 0;
  const identityColor = getCourtIdentityColor(court.sport);

  return (
    <View
      style={[styles.container, featured && styles.containerFeatured]}
      testID={`court-${court.id}`}
    >
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(21,21,25,0)", `${identityColor}18`, "rgba(21,21,25,0.96)"]}
        start={{ x: 0.1, y: 0.9 }}
        end={{ x: 1, y: 0.15 }}
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="none" style={[styles.smokeOrb, { backgroundColor: `${identityColor}10` }]} />
      <CourtGeometry sport={court.sport} color={identityColor} />

      <Pressable
        onPress={() => onPress(court)}
        style={({ pressed }) => [styles.body, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={`Open ${court.name}`}
      >
        <View style={styles.topline}>
          <View
            style={[
              styles.sportEmblem,
              {
                borderColor: `${identityColor}66`,
                backgroundColor: `${identityColor}12`,
              },
            ]}
          >
            <SportGlyph sport={court.sport} color={identityColor} />
          </View>
          <Text style={styles.sportLabel}>{court.sport}</Text>
          {isLocalCourt && (
            <View style={[styles.localBadge, { borderColor: `${identityColor}80` }]}>
              <Text style={[styles.localBadgeText, { color: identityColor }]}>MY LOCAL COURT</Text>
            </View>
          )}
        </View>

        <Text style={[styles.name, featured && styles.nameFeatured]} numberOfLines={2}>
          {court.name}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {court.neighborhood || court.address || court.market || "Court details"}
        </Text>

        <View style={styles.statsRow}>
          <View style={styles.statBlock}>
            <View style={styles.statValueRow}>
              {isActive ? (
                <LivePulse size={7} color={Colors.accent} />
              ) : (
                <View style={styles.quietDot} />
              )}
              <Text style={[styles.statValue, isActive && styles.statValueLive]}>
                {court.activeCount ?? 0}
              </Text>
            </View>
            <Text style={styles.statLabel}>ACTIVE NOW</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBlock}>
            <Text style={styles.statValue}>{court.localCount ?? 0}</Text>
            <Text style={styles.statLabel}>LOCALS</Text>
          </View>
          {isCheckedIn && (
            <View style={styles.checkedInBadge}>
              <Text style={styles.checkedInText}>HERE ✓</Text>
            </View>
          )}
        </View>
      </Pressable>

      {onCheckIn ? (
        <Pressable
          style={({ pressed }) => [
            styles.checkInButton,
            isCheckedIn && styles.checkInButtonActive,
            pressed && styles.checkInButtonPressed,
          ]}
          onPress={() => onCheckIn(court)}
          accessibilityRole="button"
          accessibilityLabel={isCheckedIn ? `Check out of ${court.name}` : `Check in to ${court.name}`}
          testID={`court-check-in-${court.id}`}
        >
          <Text style={[styles.checkInText, isCheckedIn && styles.checkInTextActive]}>
            {isCheckedIn ? "CHECKED IN ✓" : "CHECK IN"}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 176,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    marginHorizontal: 16,
    marginVertical: 5,
    overflow: "hidden",
  },
  containerFeatured: { minHeight: 202 },
  pressed: { opacity: 0.84 },
  body: { flex: 1, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 10, zIndex: 2 },
  smokeOrb: {
    position: "absolute",
    width: 190,
    height: 190,
    borderRadius: 95,
    right: -58,
    top: -62,
  },
  topline: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 28 },
  sportEmblem: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  sportLabel: {
    fontFamily: Typography.bodyBold,
    fontSize: 9,
    color: Colors.textSecondary,
    letterSpacing: 1.9,
    textTransform: "uppercase" as const,
  },
  localBadge: {
    marginLeft: "auto",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "rgba(12,12,12,0.72)",
  },
  localBadgeText: {
    fontFamily: Typography.bodyBold,
    fontSize: 7,
    letterSpacing: 1.2,
  },
  name: {
    maxWidth: "76%",
    fontFamily: Typography.heading,
    fontSize: 20,
    lineHeight: 22,
    color: Colors.text,
    letterSpacing: 0.1,
    marginTop: 14,
    textTransform: "uppercase" as const,
  },
  nameFeatured: { fontSize: 25, lineHeight: 27, maxWidth: "82%" },
  meta: {
    maxWidth: "72%",
    fontFamily: Typography.body,
    fontSize: 11,
    color: Colors.muted,
    marginTop: 5,
  },
  statsRow: {
    marginTop: 14,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "stretch",
    borderTopWidth: 1,
    borderTopColor: Colors.borderSubtle,
  },
  statBlock: { minWidth: 82, flex: 1, justifyContent: "center", paddingHorizontal: 4 },
  statValueRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  statValue: {
    fontFamily: Typography.heading,
    fontSize: 22,
    lineHeight: 23,
    color: Colors.text,
  },
  statValueLive: { color: Colors.accent },
  statLabel: {
    fontFamily: Typography.bodyBold,
    fontSize: 7,
    color: Colors.muted,
    letterSpacing: 1.4,
    marginTop: 2,
  },
  statDivider: { width: 1, height: 28, alignSelf: "center", backgroundColor: Colors.borderSubtle },
  quietDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.mutedDark },
  checkedInBadge: {
    alignSelf: "center",
    marginRight: 9,
    backgroundColor: Colors.accent,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: Radius.xs,
  },
  checkedInText: {
    fontFamily: Typography.bodyBold,
    fontSize: 8,
    color: Colors.black,
    letterSpacing: 1.2,
  },
  checkInButton: {
    minHeight: 44,
    marginHorizontal: 16,
    marginBottom: 14,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.sm,
    backgroundColor: Colors.accent,
    zIndex: 3,
  },
  checkInButtonActive: {
    backgroundColor: Colors.surfaceHigh,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  checkInButtonPressed: { opacity: 0.82 },
  checkInText: {
    fontFamily: Typography.heading,
    fontSize: 11,
    color: Colors.black,
    letterSpacing: 1.6,
  },
  checkInTextActive: { color: Colors.text },
  glyphBall: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    overflow: "hidden",
  },
  glyphBallVertical: { position: "absolute", width: 1, height: 14, left: 6 },
  glyphBallHorizontal: { position: "absolute", height: 1, width: 14, top: 6 },
  glyphPaddleWrap: { width: 16, height: 16, position: "relative", transform: [{ rotate: "-22deg" }] },
  glyphPaddle: {
    position: "absolute",
    width: 9,
    height: 11,
    borderRadius: 5,
    borderWidth: 1,
    left: 1,
    top: 0,
  },
  glyphPaddleHandle: { position: "absolute", width: 2, height: 6, left: 8, top: 9 },
  glyphPaddleBall: { position: "absolute", width: 3, height: 3, borderRadius: 2, right: 0, top: 2 },
  artLayer: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.27,
  },
  basketballArc: {
    position: "absolute",
    width: 174,
    height: 174,
    borderRadius: 87,
    borderWidth: 1,
    right: -56,
    top: 5,
  },
  basketballKey: {
    position: "absolute",
    width: 84,
    height: 106,
    borderWidth: 1,
    right: -2,
    top: 36,
  },
  basketballCircle: {
    position: "absolute",
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    right: 58,
    top: 65,
  },
  basketballBaseline: {
    position: "absolute",
    width: 1,
    height: 120,
    right: 14,
    top: 28,
  },
  courtOutline: {
    position: "absolute",
    width: 142,
    height: 126,
    borderWidth: 1,
    right: -14,
    top: 22,
  },
  courtNet: {
    position: "absolute",
    width: 1,
    height: 126,
    right: 57,
    top: 22,
  },
  courtCenter: {
    position: "absolute",
    width: 142,
    height: 1,
    right: -14,
    top: 85,
  },
  courtDot: { position: "absolute", width: 3, height: 3, borderRadius: 2 },
  genericRing: {
    position: "absolute",
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 1,
    right: -28,
    top: 18,
  },
  genericLine: { position: "absolute", width: 1, height: 120, right: 36, top: 24 },
});
