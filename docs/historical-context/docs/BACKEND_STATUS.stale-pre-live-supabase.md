# LocalCheck Backend Status

## Auth
- **Email/Password Sign-Up**: ✅ Implemented via `supabase.auth.signUp`
- **Email/Password Sign-In**: ✅ Implemented via `supabase.auth.signInWithPassword`
- **Apple Sign-In**: ✅ Implemented (iOS only) via `expo-apple-authentication` + Supabase `signInWithIdToken`
- **Persisted session**: ✅ Uses `expo-secure-store` adapter — survives app restarts
- **Profile creation**: ✅ `ensureProfile()` auto-creates a row in `profiles` table on first sign-in/sign-up

## Courts Backend
- **Primary source**: `courts_with_stats` view (if it exists in Supabase)
- **Fallback**: `courts` table
- **Row limit**: 5000 rows
- **Local fallback**: Sample courts from `constants/data.ts` are used if Supabase is unavailable or returns 0 rows
- **App never goes blank**: ✅ Fallback guaranteed

## Mapbox
- Token: `EXPO_PUBLIC_MAPBOX_TOKEN`
- Map still renders on web via Mapbox GL JS
- Not refactored — same behavior as before

## Supabase Tables Required

### `profiles`
```sql
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  elo integer default 1200,
  wins integer default 0,
  losses integer default 0,
  check_ins integer default 0,
  tier text default 'BRONZE',
  created_at timestamptz default now()
);
-- RLS
alter table profiles enable row level security;
create policy "Users can read their own profile"
  on profiles for select using (auth.uid() = id);
create policy "Users can upsert their own profile"
  on profiles for insert with check (auth.uid() = id);
create policy "Users can update their own profile"
  on profiles for update using (auth.uid() = id);
```

### `courts` (already seeded with 5000 rows)
```sql
-- Key columns expected by courtService.ts:
-- id, name, sport, neighborhood, city, address, latitude, longitude,
-- active_count, max_capacity, rating, rating_count, surface, lights, covered,
-- image_uri, status, local_count, added_by, court_count, hoop_count,
-- net_type, rim_type, water_fountain, added_date
```

### `courts_with_stats` (optional enriched view)
```sql
create view courts_with_stats as select * from courts;
-- Extend with joins to check-ins, active player counts, etc.
```

## Environment Secrets (in Replit)
- `EXPO_PUBLIC_SUPABASE_URL` ✅
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` ✅
- `EXPO_PUBLIC_MAPBOX_TOKEN` ✅

## Packages Added
```
@supabase/supabase-js
react-native-url-polyfill
expo-secure-store
expo-apple-authentication
expo-crypto
```

## What Remains for TestFlight / App Store

1. **Apple Sign-In capability**: Must be enabled in Apple Developer portal → Identifiers → com.realjess.localcheck → Sign In with Apple ✓
2. **Bundle ID**: Set to `com.realjess.localcheck` in `app.json`
3. **EAS build**: Run `npx eas-cli build -p ios --profile production`
4. **Supabase Apple OAuth**: Enable Apple provider in Supabase dashboard → Auth → Providers → Apple
5. **Email confirmation**: Configure or disable email confirmation in Supabase Auth settings for smoother dev experience
6. **RLS policies**: Add RLS to `courts` table appropriate to your access model
7. **Push notifications**: Not yet implemented
8. **Full match/ELO persistence**: Currently local AsyncStorage; needs server-side tables
