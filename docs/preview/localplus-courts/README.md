# LocalPlus court preview evidence

Screenshots show the actual preview app at 375×667, 393×852 and 430×932,
with isolated authenticated fixtures. They are not production account data.
Production migration `20261029103544_localplus_saved_courts.sql` is pending.

The interactive route was Explore card → drawer → court, then add/reload →
Home selector → switched court/check-in target → Settings toggle/reload and
removal. Empty lists, failed reads/retry, unavailable metadata, all five slots,
and the unchanged free Home/Settings controls were also exercised at each size.

The 393px captures show the main flow; 375/430px captures and long court names
show the layout bounds. `court-plus` and `court-added` show the same header
before and after a confirmed save. `settings-unavailable` retains a removable
membership when court metadata is inaccessible. Recovery captures show a real
refetch and its visible loading state. OS geofence events are not browser QA.

These captures supersede the rejected art-removal captures in
`../native-ui-polish/`. Earlier main screenshots remain there as before evidence.
