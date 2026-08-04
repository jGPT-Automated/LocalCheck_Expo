# Apple submission owner checklist

Use this only after the exact release candidate is installed and accepted on
TestFlight. This is intentionally limited to work that requires Jesse's
accounts, credentials, legal approval, or App Store Connect access. It is not
an engineering backlog and it does not include Google Play.

## 1. Publish the public pages

- Publish `/privacy`, `/terms`, and `/support` on the production LocalCheck
  website over HTTPS.
- Starting from a reputable template is fine. Replace every placeholder,
  company name, contact, data category, vendor, retention statement, and
  deletion instruction with LocalCheck's actual behavior.
- Confirm each URL from a signed-out/private browser window, then use those
  exact URLs in Settings and App Store Connect.
- Keep the support page usable: support email/contact form plus a clear account
  deletion request path. The in-app Delete Account control remains primary.

## 2. Complete App Store Connect App Privacy

Use the canonical answers in
`LocalCheck_Expo - Production Privacy Manifest & App Store Compliance Assets.txt`:

- Data collected: **Yes**.
- Precise Location — App Functionality; linked to user: Yes; tracking: No.
- Name — App Functionality; linked to user: Yes; tracking: No.
- Email Address — App Functionality; linked to user: Yes; tracking: No.
- Photos or Videos — App Functionality; linked to user: Yes; tracking: No.
- User ID — App Functionality; linked to user: Yes; tracking: No.

Recheck this list if the final build adds analytics, advertising, crash
reporting, payment, or another data-processing SDK. Do not guess at the form.

## 3. Create the reviewer account after the build is final

- Create a permanent Supabase email/password account such as
  `appreview@localchecksports.com`.
- Confirm its email ahead of time. Do not require Apple Sign-In, an emailed
  one-time link, or two-factor authentication for the reviewer path.
- Give it a completed profile, a local court, one friend, representative inbox
  items, one scheduled run, and enough history to inspect the main surfaces.
- Put the credentials only in App Store Connect's App Review Information. Never
  commit them to this repository.
- Test those exact credentials against the exact submitted TestFlight build
  immediately before submission.

Suggested review-note map:

1. Home: live/local-court activity and check-in.
2. Schedule: planned court times and runs.
3. Compete: MVP leaderboard and score flow; Elo mechanics are intentionally
   early-stage.
4. Explore: location-backed court discovery and court details.
5. Me: activity, friends, notification inbox, Settings, and Delete Account.
6. Add Court: camera/photo + location are used only when the reviewer opens
   that feature.
7. LocalPlus: describe the final purchasable or non-purchasable state exactly.

## 4. Final Apple account and credential checks

- Confirm the EAS production project still uses the correct bundle ID,
  `com.realjess.localcheck`, Apple team, App Store Connect app, and APNs key.
- If LocalPlus is purchasable in the submitted build, create/approve its App
  Store product and map it to the RevenueCat entitlement used by that build.
  If it is not purchasable yet, the build must not present a fake purchase
  completion.
- If Add Court is enabled, add the selected vision-provider key only as a
  Supabase Edge Function secret. Never put a secret API key in `EXPO_PUBLIC_*`
  or mobile source.
- Approve the final backend migration/Edge Function/webhook deployment only
  after the matching source diff and rollback plan are reviewed.

## 5. Final release acceptance before pressing Submit

- Install the submitted build on two physical iPhones.
- Prove friend request/accept, run invite, notification inbox, background push
  receipt/tap destination, opt-out/re-enable, and account deletion.
- Delete one email test account and one Apple test account; confirm the user can
  no longer sign in and the profile/social/push-token rows are gone.
- Generate/inspect the final archive's merged privacy report and confirm it
  matches the App Privacy answers above.
- Confirm screenshots, description, support URL, privacy URL, age rating,
  review notes, and version/build all describe that exact binary.
