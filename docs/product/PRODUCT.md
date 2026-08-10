# Product context

LocalCheck is the live layer for local pickup sports. It helps players
understand a court before leaving home, check in when they arrive, organize the
next run, and recognize the people who make a court a community. Launch sports
are basketball and pickleball.

## Primary users

- Regular players who loosely plan their week around a home court.
- Players deciding whether a nearby court is active enough to visit now.
- Newcomers who need honest venue facts and a legible local community.

## Core jobs

1. Know before you go: see court identity, current activity, access facts, and
   the next likely run.
2. Check in: improve the live picture without exposing private identities.
3. Plan: signal intent, coordinate runs, and reduce group-message overhead.
4. Belong: recognize friends, locals, and a player's home-court relationship.
5. Compete: submit reviewed results and maintain sport-specific standings.

## Non-negotiable truths

- A court is a shared destination and community identity, not a name plus two
  counters.
- Home, Explore, the map sheet, and Court detail use one court identity model at
  different densities.
- Orange identifies LocalCheck, live truth, selection, and primary action.
  Sport is metadata, not a competing theme.
- Counts and venue attributes are real. Empty states explain confirmed zeroes;
  failures do not masquerade as zero.
- Generated media may be atmospheric only. It never represents a real venue.
- Durable product state lives in Supabase and is protected by RLS.
- Privacy is enforced by data access and aggregation, not by hiding a control.

## Brand register and accessibility

The register is premium athletic and editorial: confident, direct, sharp,
physical, and useful. Avoid generic dashboards, hacker neon, gaming tropes, or
decorative card collections.

Meet WCAG AA contrast, support bright outdoor use, provide 44x44 minimum touch
targets, label controls, communicate state without color alone, and replace
spatial motion with concise alternatives when reduced motion is enabled.
