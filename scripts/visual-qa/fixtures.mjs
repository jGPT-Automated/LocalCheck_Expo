// Fixture rows for the visual QA run (scripts/visual-qa). Shapes follow the
// Supabase tables the app reads; times are relative to a pinned "now"
// (6:30 PM Central on a Saturday) so every run renders the same screens.
// Names include the longest a username can be (10 characters, the signup
// limit) and four-digit ratings, so a layout that can't hold them fails.
const now = Number(process.env.FAKE_NOW || Date.now());
const H = 3600_000;
const D = 24 * H;
const iso = (t) => new Date(t).toISOString();
const atHour = (dayOffset, hour, minute = 0) => {
  const d = new Date(now);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d.getTime();
};

export const ME = "11111111-1111-4111-8111-111111111111";
const U = {
  me: ME,
  p2: "22222222-2222-4222-8222-222222222222",
  tired: "33333333-3333-4333-8333-333333333333",
  jl: "44444444-4444-4444-8444-444444444444",
  phone: "55555555-5555-4555-8555-555555555555",
  jesse: "66666666-6666-4666-8666-666666666666",
  long: "77777777-7777-4777-8777-777777777777",
  marcus: "88888888-8888-4888-8888-888888888888",
  kofi: "99999999-9999-4999-8999-999999999999",
  luis: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  dw: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
};
export const COURT = "abe05196-a2d2-469e-b919-0435a056d9a3";
const COURT2 = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const COURT3 = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

function profile(id, name, elo, wins, losses, extra = {}) {
  return {
    id,
    email: null,
    display_name: name,
    username: name,
    avatar_url: null,
    elo_rating: elo,
    wins,
    losses,
    elo_basketball: elo,
    elo_pickleball: 1200,
    basketball_wins: wins,
    basketball_losses: losses,
    pickleball_wins: 0,
    pickleball_losses: 0,
    total_court_time_minutes: 300,
    local_court_id: COURT,
    preferred_sport: "basketball",
    postal_code: "77301",
    is_pro: false,
    account_tag: null,
    visibility: "public",
    onboarding_completed: true,
    push_notifications_enabled: true,
    created_at: iso(now - 60 * D),
    updated_at: iso(now - D),
    ...extra,
  };
}

const profiles = [
  profile(U.me, "chatgpt", 1184, 0, 1),
  profile(U.p2, "Player2", 1216, 1, 0),
  profile(U.tired, "tired2", 1213, 1, 0),
  profile(U.jl, "jlvasouthm", 1200, 0, 0),
  profile(U.phone, "phonetest", 1200, 0, 0),
  profile(U.jesse, "JESSE", 1133, 0, 1, { account_tag: "FOUNDER" }),
  profile(U.long, "Alessandro", 1999, 12, 9),
  profile(U.marcus, "Marcus R.", 1250, 4, 2),
  profile(U.kofi, "Kofi O.", 1190, 2, 3),
  profile(U.luis, "Luis B.", 1175, 1, 4),
  profile(U.dw, "Dwayne", 1230, 3, 3),
];

function court(id, name, short, city, sport, extra = {}) {
  return {
    id,
    name,
    short_name: short,
    address: "1 Park Way",
    postal_code: "77301",
    latitude: 30.31,
    longitude: -95.45,
    sport_type: sport,
    image_url: null,
    is_archived: false,
    location: null,
    city,
    state: "TX",
    market: city,
    added_by: U.jesse,
    created_at: iso(now - 90 * D),
    access_type: "public",
    court_count: 2,
    has_lights: true,
    active_check_in_count: 0,
    total_check_ins: 40,
    local_player_count: 10,
    is_confirmed: true,
    is_test: false,
    ...extra,
  };
}

const courts = [
  court(COURT, "Kasmiersky Park", "Kasmiersky Park", "Conroe", "basketball", { active_check_in_count: 4 }),
  court(COURT2, "Rancho Cienega Sports Complex", "Rancho Cienega", "Los Angeles", "basketball", { active_check_in_count: 2 }),
  court(COURT3, "Candy Cane Park Pickleball", "Candy Cane", "Conroe", "pickleball"),
];

let ci = 0;
function checkIn(user, court_id, start, end) {
  ci += 1;
  return {
    id: `ci-${ci}`,
    user_id: user,
    court_id,
    checked_in_at: iso(start),
    checked_out_at: end == null ? null : iso(end),
    visibility: "public",
    source: "manual",
    note: null,
  };
}
const check_ins = [
  // Here now.
  checkIn(U.marcus, COURT, now - 38 * 60_000, null),
  checkIn(U.dw, COURT, now - 24 * 60_000, null),
  checkIn(U.kofi, COURT, now - 17 * 60_000, null),
  checkIn(U.luis, COURT, now - 12 * 60_000, null),
  // Earlier this week.
  ...[1, 2, 3, 4, 5, 6].flatMap((back) => [
    checkIn(U.tired, COURT, atHour(-back, 17), atHour(-back, 19)),
    checkIn(U.p2, COURT, atHour(-back, 18), atHour(-back, 20, 30)),
    checkIn(U.jl, COURT, atHour(-back, 9), atHour(-back, 10, 15)),
  ]),
  checkIn(U.me, COURT, now - 4 * H, now - 3.25 * H),
  checkIn(U.p2, COURT, atHour(0, 11), atHour(0, 12)),
  checkIn(U.tired, COURT2, now - 50 * 60_000, null),
  checkIn(U.jesse, COURT2, now - 30 * 60_000, null),
];

const runs = [];
const run_participants = [];
function run(id, organizer, title, start, max, players, extra = {}) {
  runs.push({
    id,
    court_id: COURT,
    organizer_id: organizer,
    title,
    start_time: iso(start),
    max_players: max,
    status: "scheduled",
    team_assignment_mode: "elo_balance",
    skill_level: "all",
    note: null,
    created_at: iso(now - 2 * D),
    ...extra,
  });
  players.forEach((user, index) =>
    run_participants.push({
      id: `${id}-p${index}`,
      run_id: id,
      user_id: user,
      status: "going",
      team_side: max >= 4 ? (index % 2 === 0 ? "a" : "b") : null,
      joined_at: iso(now - D),
    }),
  );
}
export const RUN3V3 = "2257e97a-1116-4317-a2a1-3c0261b6e8f8";
export const RUN5V5 = "e5e5e5e5-5555-4555-8555-555555555555";
export const RUN5V5_LIVE = "f5f5f5f5-5555-4555-8555-555555555555";
run(RUN3V3, U.phone, "phonetest", atHour(2, 17), 6, [U.me, U.jl, U.tired, U.phone]);
run(RUN5V5, U.me, "chatgpt", atHour(0, 20), 10, [U.me, U.p2, U.tired, U.jl, U.phone, U.jesse, U.marcus]);
run(RUN5V5_LIVE, U.me, "Saturday run", now - 70 * 60_000, 10, [U.me, U.p2, U.tired, U.jl, U.phone, U.jesse, U.marcus, U.kofi, U.luis, U.long]);

let pv = 0;
const planned_visits = [];
function plan(user, start) {
  pv += 1;
  planned_visits.push({
    id: `pv-${pv}`,
    user_id: user,
    court_id: COURT,
    planned_at: iso(start),
    note: null,
    visibility: "public",
    created_at: iso(now - D),
  });
}
plan(U.phone, atHour(0, 20));
plan(U.p2, atHour(0, 20));
plan(U.long, atHour(0, 20));
plan(U.jl, atHour(1, 19));
plan(U.tired, atHour(1, 19));
plan(U.p2, atHour(2, 18));
plan(U.me, atHour(4, 20));

export const MATCH_FINAL = "9e8e21c8-175b-4ed5-9732-3e67194cf4c9";
export const MATCH_TIMELINE = "c5fc9aac-810c-44f5-808c-fbf76ccb6c69";
export const MATCH_PENDING = "abababab-abab-4bab-8bab-abababababab";
export const MATCH_TEAM = "cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd";
const yesterday = new Date(now - D).toISOString().slice(0, 10);
const matches = [
  {
    id: MATCH_FINAL, court_id: COURT, created_by: U.p2, opponent_id: U.me, played_at: yesterday,
    score_a: 0, score_b: 50, winner_side: "b", sport: "basketball", status: "confirmed", run_id: null, team_size: 1,
    confirmation_method: "manual", review_due_at: iso(now + 2 * D), confirmed_at: iso(now - 3 * H), notes: null,
    is_ranked: true, created_at: iso(now - 9 * H), updated_at: iso(now - 3 * H), last_submitted_by: U.p2,
  },
  {
    id: MATCH_TIMELINE, court_id: COURT, created_by: U.tired, opponent_id: U.jesse, played_at: yesterday,
    score_a: 11, score_b: 0, winner_side: "a", sport: "basketball", status: "confirmed", run_id: null, team_size: 1,
    confirmation_method: "manual", review_due_at: null, confirmed_at: iso(now - 2 * H), notes: null,
    is_ranked: true, created_at: iso(now - 5 * H), updated_at: iso(now - 2 * H), last_submitted_by: U.tired,
  },
  {
    id: MATCH_PENDING, court_id: COURT, created_by: U.long, opponent_id: U.me, played_at: new Date(now).toISOString().slice(0, 10),
    score_a: 21, score_b: 17, winner_side: "a", sport: "basketball", status: "pending", run_id: null, team_size: 1,
    confirmation_method: null, review_due_at: iso(now + 2 * D + 5 * H), confirmed_at: null, notes: null,
    is_ranked: true, created_at: iso(now - 2 * H), updated_at: iso(now - 2 * H), last_submitted_by: U.long, revision_number: 1, dispute_count: 0,
  },
  {
    id: MATCH_TEAM, court_id: COURT, created_by: U.marcus, opponent_id: U.kofi, played_at: yesterday,
    score_a: 21, score_b: 15, winner_side: "a", sport: "basketball", status: "confirmed", run_id: null, team_size: 2,
    confirmation_method: "automatic", review_due_at: null, confirmed_at: iso(now - 6 * H), notes: null,
    is_ranked: true, created_at: iso(now - 30 * H), updated_at: iso(now - 6 * H), last_submitted_by: U.marcus,
  },
];
const match_participants = [
  { id: "mp1", match_id: MATCH_FINAL, user_id: U.me, side: "a", display_order: 0, elo_before: 1200, elo_after: 1184, hide_score: false },
  { id: "mp2", match_id: MATCH_FINAL, user_id: U.p2, side: "b", display_order: 0, elo_before: 1200, elo_after: 1216, hide_score: false },
  { id: "mp3", match_id: MATCH_TIMELINE, user_id: U.tired, side: "a", display_order: 0, elo_before: 1200, elo_after: 1213, hide_score: false },
  { id: "mp4", match_id: MATCH_TIMELINE, user_id: U.jesse, side: "b", display_order: 0, elo_before: 1146, elo_after: 1133, hide_score: false },
  { id: "mp5", match_id: MATCH_PENDING, user_id: U.long, side: "a", display_order: 0, elo_before: null, elo_after: null, hide_score: false },
  { id: "mp6", match_id: MATCH_PENDING, user_id: U.me, side: "b", display_order: 0, elo_before: null, elo_after: null, hide_score: false },
  { id: "mp7", match_id: MATCH_TEAM, user_id: U.marcus, side: "a", display_order: 0, elo_before: 1240, elo_after: 1250, hide_score: false },
  { id: "mp8", match_id: MATCH_TEAM, user_id: U.dw, side: "a", display_order: 1, elo_before: 1220, elo_after: 1230, hide_score: false },
  { id: "mp9", match_id: MATCH_TEAM, user_id: U.kofi, side: "b", display_order: 0, elo_before: 1200, elo_after: 1190, hide_score: false },
  { id: "mp10", match_id: MATCH_TEAM, user_id: U.luis, side: "b", display_order: 1, elo_before: 1185, elo_after: 1175, hide_score: false },
];
const match_participant_reviews = [
  { id: "r1", match_id: MATCH_FINAL, user_id: U.me, decision: "approved", decided_at: iso(now - 3 * H) },
  { id: "r2", match_id: MATCH_TIMELINE, user_id: U.jesse, decision: "approved", decided_at: iso(now - 2 * H) },
  { id: "r3", match_id: MATCH_PENDING, user_id: U.me, decision: "pending", decided_at: null },
];

let ae = 0;
const activity_events = [];
function event(type, actor, t, extra = {}) {
  ae += 1;
  activity_events.push({ id: ae, event_type: type, actor_id: actor, occurred_at: iso(t), court_id: COURT, visibility: "public", payload: {}, match_id: null, run_id: null, ...extra });
}
event("check_in", U.marcus, now - 38 * 60_000);
event("check_in", U.dw, now - 24 * 60_000);
event("check_in", U.kofi, now - 17 * 60_000);
event("check_in", U.luis, now - 12 * 60_000);
event("match_result", U.p2, now - 7 * 60_000, { match_id: MATCH_FINAL });
event("run_created", U.me, now - 5 * H, { run_id: RUN5V5 });
event("check_in", U.me, now - 4 * H);
event("check_out", U.me, now - 3.25 * H);
event("match_result", U.marcus, now - 6 * H, { match_id: MATCH_TEAM });
event("match_result", U.tired, now - 26 * H, { match_id: MATCH_TIMELINE });
event("check_in", U.tired, atHour(-1, 17));
event("check_out", U.tired, atHour(-1, 19));

const friendships = [
  { id: "f1", requester_id: U.me, addressee_id: U.p2, status: "accepted", created_at: iso(now - 10 * D) },
  { id: "f2", requester_id: U.tired, addressee_id: U.me, status: "accepted", created_at: iso(now - 10 * D) },
];

/** Onboarding screens need a player who hasn't finished setup. */
export function setOnboarding(on) {
  Object.assign(profiles[0], on ? { onboarding_completed: false, local_court_id: null } : { onboarding_completed: true, local_court_id: COURT });
}

export const tables = {
  profiles,
  courts,
  courts_with_stats: courts,
  check_ins,
  runs,
  run_participants,
  planned_visits,
  matches,
  match_participants,
  match_participant_reviews,
  activity_events,
  activity_event_likes: [],
  friendships,
  notifications: [],
  challenges: [],
  subscriptions: [],
  blocked_users: [],
  user_blocks: [],
};
