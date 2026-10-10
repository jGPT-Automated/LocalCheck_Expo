import React from "react";

import {
  type Challenge,
  challengeAction,
  challengeSubtitle,
  otherPlayer,
} from "@/lib/challengeModel";

import { InboxActionRow } from "./InboxActionRow";

/** Inbox row for an open challenge. Incoming ones can be answered in place. */
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
  return (
    <InboxActionRow
      busy={busy}
      decline={
        action === "accept_decline"
          ? { label: `Decline ${other.name}'s challenge`, onPress: () => onRespond(false) }
          : undefined
      }
      onOpen={onOpen}
      openLabel={`Open challenge with ${other.name}`}
      player={other}
      primary={
        action === "accept_decline"
          ? { label: "ACCEPT", onPress: () => onRespond(true) }
          : action === "log_score"
            ? { label: "LOG SCORE", onPress: onOpen }
            : undefined
      }
      subtitle={challengeSubtitle(challenge, viewerId)}
      title={other.name}
    />
  );
}
