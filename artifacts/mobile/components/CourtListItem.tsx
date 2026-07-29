import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";

import { Colors, Radius } from "@/constants/colors";
import {
  Court,
  getCourtIdentityColor,
} from "@/constants/data";
import { Typography } from "@/constants/typography";
import { LivePulse } from "./LivePulse";

interface CourtListItemProps {
  court: Court;
  onPress?: (court: Court) => void;
  isCheckedIn?: boolean;
  isLocalCourt?: boolean;
  featured?: boolean;
  onCheckIn?: (court: Court) => void;
  onView?: (court: Court) => void;
  onSetLocalCourt?: (court: Court) => void;
  stats?: Array<{
    label: string;
    value: string | number;
    live?: boolean;
  }>;
}

function SportGlyph({ sport, color }: { sport: Court["sport"]; color: string }) {
  const icon = sport === "BASKETBALL"
    ? "basketball"
    : sport === "PICKLEBALL"
      ? "table-tennis"
      : sport === "TENNIS"
        ? "tennis"
        : "circle-outline";
  return <MaterialCommunityIcons name={icon} size={14} color={color} />;
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
  onView,
  onSetLocalCourt,
  stats,
}: CourtListItemProps) {
  const isActive = court.activeCount > 0;
  const identityColor = getCourtIdentityColor(court.sport);
  const cardStats = stats ?? [
    { label: "ACTIVE NOW", value: court.activeCount ?? 0, live: isActive },
    { label: "LOCALS", value: court.localCount ?? 0 },
  ];

  return (
    <View
      style={[
        styles.container,
        { borderLeftColor: identityColor },
        featured && styles.containerFeatured,
      ]}
      testID={`court-${court.id}`}
    >
      <View pointerEvents="none" style={[styles.smokeOrb, { backgroundColor: `${identityColor}10` }]} />
      <CourtGeometry sport={court.sport} color={identityColor} />

      <Pressable
        onPress={onPress ? () => onPress(court) : undefined}
        disabled={!onPress}
        style={({ pressed }) => [styles.body, pressed && styles.pressed]}
        accessibilityRole={onPress ? "button" : undefined}
        accessibilityLabel={onPress ? `Open ${court.name}` : undefined}
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
          {isLocalCourt ? (
            <View style={styles.localBadge}>
              <Text style={styles.localBadgeText}>MY LOCAL COURT</Text>
            </View>
          ) : onSetLocalCourt ? (
            <Pressable
              style={({ pressed }) => [styles.localBadge, styles.localBadgeDim, pressed && styles.localBadgePressed]}
              onPress={(event) => {
                event.stopPropagation();
                onSetLocalCourt(court);
              }}
              accessibilityRole="button"
              accessibilityLabel={`Set ${court.name} as my local court`}
            >
              <Text style={[styles.localBadgeText, styles.localBadgeTextDim]}>SET LOCAL</Text>
            </Pressable>
          ) : null}
        </View>

        <Text
          style={[styles.name, featured && styles.nameFeatured]}
          numberOfLines={featured ? 2 : 1}
        >
          {court.name}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {court.neighborhood || court.address || court.market || "Court details"}
        </Text>

        <View style={styles.statsRow}>
          {cardStats.map((stat, index) => (
            <React.Fragment key={stat.label}>
              {index > 0 && <View style={styles.statDivider} />}
              <View style={styles.statBlock}>
                <View style={styles.statValueRow}>
                  {stat.live ? <LivePulse size={7} color={Colors.accent} /> : null}
                  <Text style={[styles.statValue, stat.live && styles.statValueLive]}>
                    {stat.value}
                  </Text>
                </View>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </View>
            </React.Fragment>
          ))}
          {isCheckedIn && (
            <View style={styles.checkedInBadge}>
              <Text style={styles.checkedInText}>HERE ✓</Text>
            </View>
          )}
        </View>
      </Pressable>

      {onCheckIn || onView ? (
        <View style={[styles.actionRow, !onView && styles.actionRowSolo]}>
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
          {onView ? (
            <Pressable
              style={({ pressed }) => [styles.viewButton, pressed && styles.checkInButtonPressed]}
              onPress={() => onView(court)}
              accessibilityRole="button"
              accessibilityLabel={`View ${court.name}`}
            >
              <Feather name="chevron-right" size={19} color={Colors.textSecondary} />
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 134,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderLeftWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    marginHorizontal: 16,
    marginVertical: 5,
    overflow: "hidden",
  },
  containerFeatured: { minHeight: 158 },
  pressed: { opacity: 0.84 },
  body: { flex: 1, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 4, zIndex: 2 },
  smokeOrb: {
    position: "absolute",
    width: 150,
    height: 150,
    borderRadius: 75,
    right: -44,
    top: -54,
  },
  topline: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 18 },
  sportEmblem: {
    width: 19,
    height: 19,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  sportLabel: {
    fontFamily: Typography.bodyBold,
    fontSize: 8,
    color: Colors.textSecondary,
    letterSpacing: 1.5,
    textTransform: "uppercase" as const,
  },
  localBadge: {
    marginLeft: "auto",
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 3,
    backgroundColor: "rgba(12,12,12,0.72)",
  },
  localBadgeText: {
    fontFamily: Typography.bodyBold,
    fontSize: 7,
    color: Colors.textSecondary,
    letterSpacing: 1.2,
  },
  localBadgeDim: { borderColor: Colors.borderSubtle, backgroundColor: "rgba(12,12,12,0.42)" },
  localBadgeTextDim: { color: Colors.mutedDark },
  localBadgePressed: { borderColor: Colors.accent, opacity: 0.9 },
  name: {
    maxWidth: "76%",
    fontFamily: Typography.headingRegular,
    fontSize: 17,
    lineHeight: 19,
    color: Colors.text,
    letterSpacing: 0.1,
    marginTop: 7,
    textTransform: "uppercase" as const,
  },
  nameFeatured: { fontSize: 20, lineHeight: 22, maxWidth: "82%" },
  meta: {
    maxWidth: "72%",
    fontFamily: Typography.body,
    fontSize: 10,
    color: Colors.muted,
    marginTop: 3,
  },
  statsRow: {
    marginTop: 7,
    minHeight: 32,
    flexDirection: "row",
    alignItems: "stretch",
    borderTopWidth: 1,
    borderTopColor: Colors.borderSubtle,
  },
  // Four-stat cards must still fit the narrowest supported iPhone width.
  statBlock: { minWidth: 0, flex: 1, justifyContent: "center", paddingHorizontal: 4 },
  statValueRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  statValue: {
    fontFamily: Typography.heading,
    fontSize: 19,
    lineHeight: 20,
    color: Colors.text,
  },
  statValueLive: { color: Colors.accent },
  statLabel: {
    fontFamily: Typography.bodyBold,
    fontSize: 7,
    color: Colors.muted,
    letterSpacing: 1.1,
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
  actionRow: {
    flexDirection: "row",
    gap: 8,
    marginHorizontal: 14,
    marginBottom: 9,
    zIndex: 3,
  },
  actionRowSolo: { width: "72%", alignSelf: "center" },
  checkInButton: {
    flex: 1,
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.sm,
    backgroundColor: Colors.accent,
    shadowColor: Colors.accent,
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  checkInButtonActive: {
    backgroundColor: Colors.surfaceHigh,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  checkInButtonPressed: { opacity: 0.82 },
  checkInText: {
    fontFamily: Typography.bodyBold,
    fontSize: 10,
    color: Colors.black,
    letterSpacing: 1.6,
  },
  checkInTextActive: { color: Colors.text },
  viewButton: {
    width: 42,
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.surfaceHigh,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
  },
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
