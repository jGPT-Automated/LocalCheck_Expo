import type { FeedItem, GameRun, PlannedVisit } from "../constants/data";

export interface CourtHourPick {
  dayOffset: number;
  hour: number;
}

/** Calendar arithmetic (rather than 24-hour offsets) keeps DST days aligned. */
export function courtHourStart(pick: CourtHourPick, now: number): Date {
  const date = new Date(now);
  date.setDate(date.getDate() + pick.dayOffset);
  date.setHours(pick.hour, 0, 0, 0);
  return date;
}

export function courtHourSlot(input: {
  courtId: string;
  pick: CourtHourPick;
  now: number;
  visits: PlannedVisit[];
  anonymousTimes: Date[];
  games: GameRun[];
  meId: string;
}) {
  const { courtId, pick, now, visits, anonymousTimes, games, meId } = input;
  const from = courtHourStart(pick, now).getTime();
  const end = courtHourStart({ ...pick, hour: pick.hour + 1 }, now).getTime();
  const inSlot = (iso: string) =>
    Date.parse(iso) >= from && Date.parse(iso) < end;
  const slotVisits = visits.filter(
    (v) => v.courtId === courtId && inSlot(v.plannedAtIso),
  );
  const slotGames = games.filter(
    (g) => g.courtId === courtId && inSlot(g.startTimeIso),
  ).sort((a, b) => a.startTimeIso.localeCompare(b.startTimeIso));
  const people = new Map<
    string,
    {
      id: string;
      name: string;
      initials: string;
      isMine: boolean;
      visitId?: string;
    }
  >();
  for (const visit of slotVisits) {
    if (!people.has(visit.userId))
      people.set(visit.userId, {
        id: visit.userId,
        name: visit.player.name,
        initials: visit.player.avatar,
        isMine: visit.userId === meId,
        visitId: visit.id,
      });
  }
  for (const game of slotGames)
    for (const p of game.participants) {
      if (!people.has(p.id))
        people.set(p.id, {
          id: p.id,
          name: p.name,
          initials: p.avatar,
          isMine: p.id === meId,
        });
    }
  // The aggregate is a list of visits, not distinct people. Subtract every
  // visible visit before de-duplicating names; never invent private identities.
  const hidden = Math.max(
    0,
    anonymousTimes.filter((t) => t.getTime() >= from && t.getTime() < end)
      .length - slotVisits.length,
  );
  return {
    from,
    end,
    attendees: [...people.values()],
    hidden,
    games: slotGames,
    mine: slotVisits.filter((v) => v.userId === meId),
    total: people.size + hidden,
  };
}

export function courtHourEvents(
  items: FeedItem[],
  pick: CourtHourPick,
  now: number,
): FeedItem[] {
  const from = courtHourStart(pick, now).getTime();
  const end = courtHourStart({ ...pick, hour: pick.hour + 1 }, now).getTime();
  return items.filter(
    (item) =>
      Date.parse(item.occurredAtIso) >= from &&
      Date.parse(item.occurredAtIso) < end,
  );
}

export function chartHourAt(
  x: number,
  width: number,
  first = 6,
  last = 22,
): number {
  return Math.min(
    last,
    Math.max(
      first,
      first + Math.floor((x / Math.max(1, width)) * (last - first + 1)),
    ),
  );
}
