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
- From the court page a player can check in or out and plan a visit (Week ›
  I'm coming), see upcoming games, and read the court's details: courts,
  lights, access, court hours this week and average session (D55, Oct 14).
- From the court drawer a player sees who's here, the next game, today's
  planned visits and recent activity, jumps to any court page tab, and can
  make the court their local. Explore lists live courts first (D56, Oct 15).
- Orange identifies LocalCheck, live truth, check-in and selection. Other
  primary actions are white (D56).
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

### Scroll behavior (D62, approved Oct 29; on branch)

Back on pushed pages starts at the screen edge. List search and scope controls
stay visible while results scroll. Friends' profile summary yields space while
the native search keyboard is open, then returns. Explore's drawer scrolls as one page
with its destination chips pinned. Log game does not scroll when the form
fits; extra content and keyboard can enable scrolling. These changes add no
manual refresh to realtime data.
