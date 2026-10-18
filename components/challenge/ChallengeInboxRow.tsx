import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { GameStateBanner } from "@/components/match/GameStateBanner";
import { waitingBannerLabel } from "@/components/match/gameCardModel";
import { PressableScale } from "@/components/ui/PressableScale";
import { Colors, Radius } from "@/constants/colors";
import { Space } from "@/constants/layout";
import { TextStyles } from "@/constants/typography";
import {
  type Challenge,
  challengeAction,
  challengeBanner,
  challengeCardLines,
  otherPlayer,
} from "@/lib/challengeModel";

import { InboxIconActions } from "./InboxActionRow";

type Banner = { kind: React.ComponentProps<typeof GameStateBanner>["kind"]; label: string };

/** The banner is the same family as a game waiting for review: orange when it is your move. */
function bannerFor(challenge: Challenge, viewerId: string, otherName: string): Banner {
  const action = challengeAction(challenge, viewerId);
  if (action === "accept_decline") return { kind: "action", label: "WAITING ON YOU" };
  if (action === "waiting") return { kind: "waiting", label: waitingBannerLabel(otherName) };
  // Once the game time has passed it is the viewer's move: log the score.
  if (action === "log_score" || action === "casual_on") return { kind: "action", label: "GAME ON" };
  return challengeBanner(challenge, viewerId);
}

/**
 * Inbox card for an open challenge. Same shell as a game waiting for review
 * (state banner on top, quiet body with no avatar, no arrow), minus the scores:
 * line 1 is "Ranked game with Name", line 2 is where and when. Incoming ones
 * are answered in place with a check or an X; tapping the card opens it.
 */
export function ChallengeInboxRow({
  challenge,
  viewerId,
  onOpen,
  onRespond,
  busy = false,
}: {
  challenge: Challenge;
  viewerId: string;
  onOpen: () => void;
  onRespond: (accept: boolean) => void;
  busy?: boolean;
}) {
  const other = otherPlayer(challenge, viewerId);
  const action = challengeAction(challenge, viewerId);
  const banner = bannerFor(challenge, viewerId, other.name);
  const lines = challengeCardLines(challenge, viewerId);
  return (
    <PressableScale
      accessibilityLabel={`${lines.title}, ${lines.subtitle}. ${banner.label}`}
      accessibilityRole="button"
      onPress={onOpen}
      style={[styles.card, banner.kind === "action" && styles.cardAction]}
    >
      <GameStateBanner kind={banner.kind} label={banner.label} />
      <View style={styles.body}>
        <View style={styles.copy}>
          <Text numberOfLines={1} style={styles.title}>
            {lines.title}
          </Text>
          <Text numberOfLines={1} style={styles.subtitle}>
            {lines.subtitle}
          </Text>
        </View>
        {action === "accept_decline" ? (
          <InboxIconActions
            acceptLabel={`Accept ${other.name}'s challenge`}
            busy={busy}
            declineLabel={`Decline ${other.name}'s challenge`}
            onAccept={() => onRespond(true)}
            onDecline={() => onRespond(false)}
          />
        ) : null}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  // The same shell as the compact game card (ScoreCard).
  card: {
    width: "100%",
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: Radius.card,
    backgroundColor: Colors.surface,
    overflow: "hidden",
  },
  cardAction: { borderColor: Colors.accentBorder },
  body: { padding: Space.md, flexDirection: "row", alignItems: "center", gap: Space.md },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  title: { ...TextStyles.listName, color: Colors.text },
  subtitle: { ...TextStyles.caption, color: Colors.muted },
});
