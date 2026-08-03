# Add Court — implementation and activation handoff

Status: source complete; production Edge Function deployment and physical photo proof remain
Last updated: 2026-08-03
Canonical repo: `/Users/JesseH/Projects/LocalCheck_Expo`
Base commit: `81ff0a497641ae5b3548c1cda5585e1c248e6f39`
Supabase project: LocalCheckProd (`qkrnmyexzvaxiqfxwwfb`)

## What changed

The old Add Court path was nonfunctional: the drawer posted to a nonexistent
`/api/courts/verify` route, trusted a client-selected sport, manufactured a
confirmed client ID, and then attempted a direct `courts` insert that the
production access model correctly rejects.

The candidate replaces that boundary end to end:

- `AddCourtModal.tsx` uses `@gorhom/bottom-sheet`'s modal, scroll, and text-input
  primitives through the shared `TaskBottomSheet` shell.
- The sport selector is gone. Gemini classifies only basketball or pickleball;
  other sports and unclear/non-court images are rejected.
- Expo Location captures the pin and reverse-geocodes editable address, city,
  and state fields. Access remains an explicit user report because a photo
  cannot prove whether a property is public, paid, or private.
- `courtService.createCourt()` invokes the authenticated `verify-court` Edge
  Function. The client no longer writes `courts` directly.
- The Edge Function authenticates the Supabase user, validates and bounds the
  request, enforces five submissions per user per UTC day, calls Gemini with a
  structured JSON schema, applies an 80% acceptance threshold, rejects a
  same-sport court within 150 meters, and inserts the complete production row
  with the service role.
- The submitted photo is analyzed inline and is not persisted. The Gemini API
  key remains in the Supabase secret named `GEMINI_API_KEY`.

No database migration or new native dependency is required. The installed
`@gorhom/bottom-sheet`, `expo-location`, and `expo-image-picker` packages are
reused, so this client change is OTA-compatible with the current binary.

## Source map

| Concern | Source |
| --- | --- |
| Library-backed task drawer | `artifacts/mobile/components/sheet/TaskBottomSheet.tsx` |
| Two-step Add Court flow | `artifacts/mobile/components/AddCourtModal.tsx` |
| Authenticated client contract | `artifacts/mobile/services/courtService.ts` |
| In-session court-list update | `artifacts/mobile/context/AppContext.tsx` |
| Gemini verification and authorized insert | `supabase/functions/verify-court/index.ts` |

## Activation boundary

The source was not deployed in this session. Both the Supabase connector and
the CLI approval path were blocked by the Codex account usage limit before a
deployment could begin; no production function, schema, or row changed.

From a session with Supabase access, deploy only this function with JWT
verification enabled:

```bash
cd /Users/JesseH/Projects/LocalCheck_Expo
supabase functions deploy verify-court --project-ref qkrnmyexzvaxiqfxwwfb
```

The function defaults to the current documented `gemini-3.6-flash` model. An
optional Supabase secret named `GEMINI_VISION_MODEL` can override the model
without a client release. Never add either secret value to Git, Expo public
environment variables, logs, or PR text.

## Required post-deploy proof

1. Confirm `verify-court` is listed with `verify_jwt=true`.
2. Anonymous invocation returns `401`; a signed-in invalid body returns the
   field-specific `400` response without calling Gemini or writing a row.
3. On a physical iPhone, confirm the sheet opens over Explore, drags and
   dismisses cleanly, scrolls as one surface, and keeps the active input visible
   above the keyboard.
4. Submit one clear basketball photo and one clear pickleball photo at real,
   distinct courts. Confirm the detected sport, setting, coordinates, complete
   address, `added_by`, `source_and_detection` status, and immediate map/list
   appearance.
5. Confirm an unrelated image and an unsupported-sport image are rejected with
   no `courts` row.
6. Resubmit at the accepted court and confirm the 150-meter duplicate guard
   rejects it with the existing court name.
7. Inspect Edge Function logs for status/codes only. The implementation does
   not log image data, the Gemini key, auth headers, or user payloads.

Any accepted production photo test creates a real court row. Use an actual
venue that should remain in LocalCheck, or obtain explicit approval before
creating and later removing QA data.

## Verification already completed

- `pnpm --filter @workspace/mobile run check:release` — passed TypeScript,
  five Realtime tests, and two notification-route tests.
- `git diff --check` — passed.
- TypeScript syntax transpilation of `supabase/functions/verify-court/index.ts`
  — passed.
- Fresh Expo web export — bundled and served successfully on ports 8082 and
  8083. The in-app browser controller then blocked localhost navigation by
  policy, so this is bundle/runtime-start proof, not a visual acceptance claim.

## Primary references

- [Gorhom Bottom Sheet modal](https://gorhom.dev/react-native-bottom-sheet/modal)
- [Gorhom BottomSheetScrollView](https://gorhom.dev/react-native-bottom-sheet/components/bottomsheetscrollview)
- [Gorhom BottomSheetTextInput](https://gorhom.dev/react-native-bottom-sheet/components/bottomsheettextinput)
- [Expo Location reverse geocoding](https://docs.expo.dev/versions/latest/sdk/location/)
- [Supabase Edge Function authentication](https://supabase.com/docs/guides/functions/auth)
- [Gemini image understanding](https://ai.google.dev/gemini-api/docs/image-understanding)
- [Gemini structured outputs](https://ai.google.dev/gemini-api/docs/structured-output)
