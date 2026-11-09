# Notifications: compact log preview

Scope: `/notifications`, existing notification data only. Reuses DetailHeader,
Feather, canonical typography/colors, FlatList and installed React Query.
No schema application, push behavior change, OTA or native build.

Jesse's original [device screenshot](device-inbox-before.png) is unchanged.
It proves a custom diagnostic row appeared in his inbox, not a manual
check-in trigger or privacy path. It is a visual reference, not the automated
before capture (the viewport/data differ).

The UI renders stored own-event visibility only; no legacy audience is inferred.
Private/Friends/Public examples in isolated captures are synthetic metadata
examples, not live privacy snapshots or proof the backend records them today.
Complete manual-event history and snapshot capture are a separate backend slice.

Paging: 20 visible rows, one-row lookahead, created_at/id descending cursor.
Unread count covers all history separately from the loaded pages. Errors keep
loaded rows with retry. Phone-alert preference does not filter inbox history.

Validation and actual rendered captures will be appended after the export runs.
