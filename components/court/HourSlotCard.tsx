import React from "react";

import { SlotCard, type SlotAttendee } from "@/components/court/SlotCard";
import type { Court } from "@/constants/data";
import { useApp } from "@/context/AppContext";
import { fetchCourtPlannedTimes } from "@/services/plannedVisitService";

function dayName(dayOffset: number, date: Date): string {
  if (dayOffset === 0) return "Today";
  if (dayOffset === 1) return "Tomorrow";
  return date.toLocaleDateString("en-US", { weekday: "short" });
}

function hourName(hour: number): string {
  return `${hour % 12 === 0 ? 12 : hour % 12} ${hour < 12 ? "AM" : "PM"}`;
}

/**
 * Who's going in one hour of one day at a court: Home's chart shows it under
 * the bar you tap. Same card as the court page's Week.
 */
export function HourSlotCard({ court, dayOffset, hour }: { court: Court; dayOffset: number; hour: number }) {
  const { currentUser, plannedVisits, runs, addPlannedVisit, removePlannedVisit } = useApp();
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

  const attendees: SlotAttendee[] = [];
  let plannedVisible = 0;
  for (const visit of plannedVisits) {
    if (visit.courtId !== court.id || !inSlot(visit.plannedAtIso)) continue;
    if (attendees.some((a) => a.id === visit.userId)) continue;
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
      if (attendees.some((a) => a.id === player.id)) continue;
      attendees.push({ id: player.id, name: player.name, initials: player.avatar, isMine: player.id === currentUser.id });
    }
  }
  const mine = attendees.find((a) => a.isMine && a.visitId);
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
      current={from <= Date.now() && Date.now() < to}
      hidden={Math.max(0, anonymous - plannedVisible)}
      mine={Boolean(mine)}
      mode={over ? "view" : "plan"}
      notice={notice}
      onToggle={() => void toggle()}
      runs={slotRuns}
      saving={saving}
      title={`${dayName(dayOffset, start)} · ${hourName(hour)}`}
    />
  );
}
