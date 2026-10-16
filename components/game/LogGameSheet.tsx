import React from "react";

import { LogGameView } from "@/components/game/LogGameForm";
import { FormSheet } from "@/components/sheet/FormSheet";
import type { Player } from "@/constants/data";
import { useApp } from "@/context/AppContext";
import { useLocalPlus } from "@/hooks/useLocalPlus";

/**
 * Log game from a player's profile: the same form as Compete's Log game tab,
 * in a sheet over the profile with the opponent already filled in, so logging
 * never leaves the profile. Closes once the game is sent for review.
 */
export function LogGameSheet({
  visible,
  onClose,
  opponent,
}: {
  visible: boolean;
  onClose: () => void;
  opponent: Player;
}) {
  const { currentUser, courts, localCourt, localCourtId, preferredSport, preferredCourtId } = useApp();
  const hasLocalPlus = useLocalPlus();
  return (
    <FormSheet eyebrow={`vs ${opponent.name}`} onClose={onClose} title="Log game" visible={visible}>
      {visible ? (
        <LogGameView
          bottom={0}
          courts={courts}
          currentUser={currentUser}
          hasLocalPlus={hasLocalPlus}
          inSheet
          localCourtId={localCourtId}
          onLogged={onClose}
          preferredCourtId={preferredCourtId}
          preferredSport={localCourt?.sport ?? preferredSport}
          preselectedOpponent={opponent}
        />
      ) : null}
    </FormSheet>
  );
}
