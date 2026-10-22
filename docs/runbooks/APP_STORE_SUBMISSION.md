# App Store submission

Everything App Store Connect needs that is not in the binary: listing text,
privacy answers, age rating, review notes, and the checks that were run. Use it
with `docs/RELEASE.md` (which builds and submits the binary).

Each claim is marked **verified** (with how and when) or **belief** (not
checked). Checked 2026-10-22.

## What the repo already satisfies

| Item | Status |
|------|--------|
| Bundle id `com.realjess.localcheck`, Apple team `6HHLJVQC6W`, ASC app id `6786909608` | verified: `app.json`, `eas.json` |
| Built with Xcode 26 / iOS 26 SDK (Apple requires it for uploads since 2026-04-28) | verified: Apple "Upcoming Requirements"; `eas.json` image `macos-sequoia-15.6-xcode-26.0` |
| Expo config valid | verified: `npx expo-doctor` 18/18 on 2026-10-22 (was 17/18; see below) |
| Export compliance | verified: `ITSAppUsesNonExemptEncryption: false` in `app.json` |
| Sign in with Apple offered next to email sign-in | verified: `app/auth.tsx` |
| Account deletion in the app (Guideline 5.1.1(v)), incl. Apple token revocation | verified: `app/settings.tsx`, `services/accountService.ts`, `delete-account` function |
| Report and block for user content (Guideline 1.2) | verified: `services/safetyService.ts`, `app/blocked-users.tsx`; terms section 9 |
| Privacy policy, terms, support pages live (HTTP 200) | verified: scraped 2026-10-22 |
| Usage strings: location (when in use, always), camera | verified: `app.json`, `app.config.js` |
| Latest EAS iOS build | verified (EAS build list): 1.0.4 (45), 2026-10-15, from #70. Newer main (#77) is not in any build. |

## Fixed in this change

- `app.json` had `ios.buildProperties.privacyManifestAggregationEnabled`. It
  failed `expo-doctor` (not in the config schema) and nothing reads it
  (searched `@expo/config-plugins`). Removed. SDK 54 aggregates SDK privacy
  manifests on its own.
- The app privacy manifest declared only Precise Location, Crash Data and Other
  Diagnostic Data. The app also collects email, display name, user id, purchase
  history (RevenueCat), the push token (device id) and gameplay content. Added
  `EmailAddress`, `Name`, `UserID`, `PurchaseHistory`, `DeviceID`,
  `OtherUserContent`, all linked, not tracking, app functionality. The
  App Store Connect answers below must match.

## Needs the owner before submitting

1. **Privacy policy and support page contradict the app.** Both say location is
   used "only while the app is in use" / "foreground precise location". The app
   asks for Always location and the `location` background mode for opt-in auto
   check-in (D35). App Review compares the policy with the binary
   (Guidelines 5.1.1, 5.1.2). The website is not in this repo; add a sentence
   such as: *"If you turn on auto check-in, LocalCheck uses background location
   only to detect when you arrive at or leave your one local court. It does not
   keep a location trail."* Only true if the geofence code does that (belief;
   `lib/autoCheckInModel.ts`, `services/autoCheckInService.ts` were not audited
   for this).
2. **Terms mention only a monthly subscription;** the app sells Monthly and
   Yearly (`docs/RELEASE.md`). Update the terms.
3. **Install a build with auto check-in** (1.0.4 build 45 predates #67 per
   `docs/CURRENT_STATE.md`; belief, not diffed) and run `docs/TESTING.md`
   native checks before submitting.
4. Reviewer account (email + password, with data in it), screenshots, and the
   ASC age-rating answers are entered in App Store Connect by the account owner.

## Listing text (draft)

- Name: `LocalCheck`
- Subtitle (30 max): `Live pickup courts near you`
- Promotional text (170 max): `See who's on the court right now, plan your next run, and build trusted rankings from reviewed games. Basketball and pickleball.`
- Keywords (100 max): `pickup,basketball,pickleball,courts,hoops,check in,games,runs,ranking,local,sports,near me`
- Category: Sports (primary). Secondary: Social Networking (belief; owner's call).
- Support URL: `https://localchecksports.com/support`
- Privacy policy URL: `https://localchecksports.com/privacy`
- Terms: `https://localchecksports.com/terms` (also in the paywall; `lib/planModel.ts`)
- Copyright: `2026 LocalCheck`

Description (4000 max):

```
LocalCheck is the live layer for local pickup basketball and pickleball.

KNOW BEFORE YOU GO
See which courts have players on them right now, how busy a court usually is by hour, and who plans to show up later. No more driving to an empty court.

CHECK IN
Check in when you arrive so your local community can see the court light up. Choose who sees you: Public, Friends Only, or Private.

PLAN AND ORGANIZE
Tell people you're coming, schedule a game, and invite friends so the run happens.

COMPETE
Log games, have results reviewed by the other side, and climb friend, court, and regional rankings built only from reviewed games. Challenge players head to head.

YOUR LOCAL COURT
Pick one court as your local. Optionally turn on auto check-in and your iPhone tells LocalCheck when you arrive at or leave it. Nothing else is tracked.

ADD YOUR COURT
Don't see your court? Add it with a photo taken at the court. Submissions are verified before they appear on the map.

LOCALPLUS
Optional auto-renewing subscription (Monthly or Yearly) unlocks deeper court insights. Payment is charged to your Apple ID, renews automatically unless cancelled at least 24 hours before the end of the period, and can be managed in your Apple ID settings. Terms: https://localchecksports.com/terms  Privacy: https://localchecksports.com/privacy

Report and block tools are on every player profile. You can delete your account in Settings at any time.
```

## App Privacy answers (must match `app.json` privacyManifests)

Tracking: **No.** No data is used for tracking; no ATT prompt.

| Data type | Linked to user | Purpose |
|-----------|---------------|---------|
| Email address | Yes | App functionality |
| Name (display name) | Yes | App functionality |
| User ID | Yes | App functionality |
| Precise location | Yes | App functionality |
| Purchase history | Yes | App functionality |
| Device ID (push token) | Yes | App functionality |
| Other user content (check-ins, games, scores) | Yes | App functionality |
| Crash data, other diagnostic data | No | App functionality |

Belief, owner to confirm: profile image is user-chosen (add Photos or Videos if
it is uploaded); court photos are sent to Google Gemini and not retained, so
they are not "collected" (policy says so).

## Age rating (ASC questionnaire, in force for submissions since 2026-09)

Belief, answer to match the product: no violence, sexual or mature content,
gambling, or alcohol/drugs; **user-generated content: yes** (profiles, game
results; with report and block); **location: yes**; **in-app purchases: yes**;
the new social media questions: the app lets players connect, see each other
and message through invites/challenges, no open chat (confirm). Set a minimum
age of 13 to match the terms. Expect 4+ to 13+ depending on the UGC answers.

## App Review notes (paste into ASC)

```
LocalCheck shows live pickup basketball and pickleball courts and lets players check in.

Sign in: use the demo account below or Sign in with Apple. Email: <REVIEWER EMAIL>  Password: <REVIEWER PASSWORD>.

Location: When In Use is used to find nearby courts. "Always" location and background location are used ONLY for the optional auto check-in feature: the user picks one local court and iOS geofencing wakes the app when they arrive at or leave it. No location history is stored. Auto check-in is off until the user enables it.

Camera: scans a friend's QR code and photographs a court being added.

LocalPlus: auto-renewing subscriptions (Monthly, Yearly) with Restore Purchases on the LocalPlus screen. Terms and Privacy links are on that screen.

Account deletion: Settings > Delete Account. Report / Block: on any player profile.

Sample data: courts near the review location show activity; if none, search "<COURT NAME>".
```

## Submit steps

1. Owner runs `Release iOS to TestFlight` (builds and submits; `docs/RELEASE.md`).
2. After Apple processing, install from TestFlight, run the native checks.
3. In ASC: attach the build, both subscriptions, paste text above, privacy
   answers, age rating, screenshots (6.9-inch iPhone set; app is iPhone only,
   `supportsTablet: false`; sizes are a belief, confirm in ASC), review notes.
4. Submit for review.
