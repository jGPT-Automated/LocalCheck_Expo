import React from "react";

import { SlotCard, type SlotAttendee } from "@/components/court/SlotCard";
import type { Court } from "@/constants/data";
import { useApp } from "@/context/AppContext";
import { usePresence } from "@/context/CourtPresenceContext";
import { fetchCourtPlannedTimes } from "@/services/plannedVisitService";

/** Today's hours are just the hour; other days lead with the day. */
function slotTitle(dayOffset: number, date: Date, hour: number): string {
  if (dayOffset === 0) return hourName(hour);
  return `${date.toLocaleDateString("en-US", { weekday: "short" })} · ${hourName(hour)}`;
}

function hourName(hour: number): string {
  return `${hour % 12 === 0 ? 12 : hour % 12} ${hour < 12 ? "AM" : "PM"}`;
}

/**
 * Who's going in one hour of one day at a court: Home's chart shows it under
 * the bar you tap. Same card as the court page's Week.
 */
export function HourSlotCard({
  court,
  dayOffset,
  hour,
  bare = false,
  onCreate,
}: {
  court: Court;
  dayOffset: number;
  hour: number;
  /** No panel of its own (it sits inside the Today card). */
  bare?: boolean;
  onCreate?: () => void;
}) {
  const { currentUser, plannedVisits, runs, checkedInCourtId, addPlannedVisit, removePlannedVisit } = useApp();
  const { roster } = usePresence(court.id);
  const [anonymous, setAnonymous] = React.useState(0);
  const [saving, setSaving] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);

  const start = new Date();
  start.setHours(hour, 0, 0, 0);
  start.setDate(start.getDate() + dayOffset);
  const from = start.getTime();
  const to = from + 3_600_000;
  const inSlot = (iso: string) => {
    const at = Date.parse(iso);
    return at >= from && at < to;
  };

  React.useEffect(() => {
    let cancelled = false;
    void fetchCourtPlannedTimes(court.id, new Date(from), new Date(to)).then((times) => {
      if (!cancelled) setAnonymous(times.length);
    });
    return () => {
      cancelled = true;
    };
  }, [court.id, from, to, plannedVisits]);

  const current = from <= Date.now() && Date.now() < to;
  const attendees: SlotAttendee[] = [];
  // The hour you are in counts the people on court right now; they are not
  // counted again as planned visits or game players.
  const onCourt = new Set(current ? roster.map((player) => player.id) : []);
  const here = onCourt.size;
  let plannedVisible = 0;
  for (const visit of plannedVisits) {
    if (visit.courtId !== court.id || !inSlot(visit.plannedAtIso)) continue;
    if (onCourt.has(visit.userId) || attendees.some((a) => a.id === visit.userId)) continue;
    plannedVisible += 1;
    attendees.push({
      id: visit.userId,
      name: visit.player.name,
      initials: visit.player.avatar,
      isMine: visit.userId === currentUser.id,
      visitId: visit.id,
    });
  }
  const slotRuns = runs
    .filter((run) => run.courtId === court.id && inSlot(run.startTimeIso))
    .sort((a, b) => a.startTimeIso.localeCompare(b.startTimeIso));
  for (const run of slotRuns) {
    for (const player of run.participants) {
      if (onCourt.has(player.id) || attendees.some((a) => a.id === player.id)) continue;
      attendees.push({ id: player.id, name: player.name, initials: player.avatar, isMine: player.id === currentUser.id });
    }
  }
  const mine = attendees.find((a) => a.isMine && a.visitId);
  const checkedInHere = current && checkedInCourtId === court.id;
  const over = to <= Date.now();

  const toggle = async () => {
    if (saving) return;
    setSaving(true);
    setNotice(null);
    const plannedAt = new Date(Math.max(from, Date.now() + 60_000));
    const ok = mine?.visitId
      ? await removePlannedVisit(mine.visitId)
      : await addPlannedVisit(court.id, plannedAt.toISOString(), undefined, "public");
    setSaving(false);
    if (!ok) setNotice("Could not save your time. Try again.");
  };

  return (
    <SlotCard
      attendees={attendees}
      bare={bare}
      checkedIn={checkedInHere}
      current={current}
      here={here}
      hidden={Math.max(0, anonymous - plannedVisible)}
      mine={Boolean(mine)}
      mode={over ? "view" : "plan"}
      meId={currentUser.id}
      notice={notice}
      onCreate={over ? undefined : onCreate}
      onToggle={() => void toggle()}
      runs={slotRuns}
      saving={saving}
      sport={court.sport}
      title={slotTitle(dayOffset, start, hour)}
    />
  );
}
