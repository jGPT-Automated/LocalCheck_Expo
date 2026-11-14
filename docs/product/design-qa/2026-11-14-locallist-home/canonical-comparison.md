# Same-fixture visual comparison

27 canonical screen/size combinations, exact #91 base versus this branch.
The runner used identical fixtures, time and viewports for both exports.

- Layout failures: **1 → 0** (375px court-name truncation fixed).
- Small text observations: **221 → 216**.
- Small target observations: **16 → 16**.
- Low contrast observations: **0 → 0**.
- No debt count increased on any individual screen/size.

The scoped runner exits nonzero against its older checked-in debt baseline:
Home already shows more small text and the existing Going control in the
unchanged #91 export. The raw before/after reports retain these warnings.
No baseline threshold was increased to hide them. The table below compares
actual renders of the selected base and new branch.

| Screen/size | Before failures | After failures | Small text | Small targets | Low contrast |
| --- | --- | --- | --- | --- | --- |
| 375x667/home-feed ([before](before/canonical-home-feed-375.png) / [after](after/canonical-home-feed-375.png)) | 0 | 0 | 13 → 11 | 0 → 0 | 0 → 0 |
| 375x667/home-scrolled ([before](before/canonical-home-scrolled-375.png) / [after](after/canonical-home-scrolled-375.png)) | 0 | 0 | 18 → 18 | 1 → 1 | 0 → 0 |
| 375x667/court-live ([before](before/canonical-court-live-375.png) / [after](after/canonical-court-live-375.png)) | 0 | 0 | 6 → 6 | 1 → 1 | 0 → 0 |
| 375x667/schedule-court-picker ([before](before/canonical-schedule-court-picker-375.png) / [after](after/canonical-schedule-court-picker-375.png)) | 0 | 0 | 1 → 1 | 0 → 0 | 0 → 0 |
| 375x667/explore ([before](before/canonical-explore-375.png) / [after](after/canonical-explore-375.png)) | 1 | 0 | 12 → 11 | 0 → 0 | 0 → 0 |
| 375x667/explore-drawer ([before](before/canonical-explore-drawer-375.png) / [after](after/canonical-explore-drawer-375.png)) | 0 | 0 | 5 → 5 | 0 → 0 | 0 → 0 |
| 375x667/explore-drawer-expanded ([before](before/canonical-explore-drawer-expanded-375.png) / [after](after/canonical-explore-drawer-expanded-375.png)) | 0 | 0 | 13 → 13 | 2 → 2 | 0 → 0 |
| 375x667/settings ([before](before/canonical-settings-375.png) / [after](after/canonical-settings-375.png)) | 0 | 0 | 1 → 1 | 0 → 0 | 0 → 0 |
| 375x667/notifications ([before](before/canonical-notifications-375.png) / [after](after/canonical-notifications-375.png)) | 0 | 0 | 0 → 0 | 0 → 0 | 0 → 0 |
| 393x852/home-feed ([before](before/canonical-home-feed-393.png) / [after](after/canonical-home-feed-393.png)) | 0 | 0 | 18 → 18 | 1 → 1 | 0 → 0 |
| 393x852/home-scrolled ([before](before/canonical-home-scrolled-393.png) / [after](after/canonical-home-scrolled-393.png)) | 0 | 0 | 18 → 18 | 1 → 1 | 0 → 0 |
| 393x852/court-live ([before](before/canonical-court-live-393.png) / [after](after/canonical-court-live-393.png)) | 0 | 0 | 8 → 8 | 1 → 1 | 0 → 0 |
| 393x852/schedule-court-picker ([before](before/canonical-schedule-court-picker-393.png) / [after](after/canonical-schedule-court-picker-393.png)) | 0 | 0 | 1 → 1 | 0 → 0 | 0 → 0 |
| 393x852/explore ([before](before/canonical-explore-393.png) / [after](after/canonical-explore-393.png)) | 0 | 0 | 12 → 11 | 0 → 0 | 0 → 0 |
| 393x852/explore-drawer ([before](before/canonical-explore-drawer-393.png) / [after](after/canonical-explore-drawer-393.png)) | 0 | 0 | 5 → 5 | 0 → 0 | 0 → 0 |
| 393x852/explore-drawer-expanded ([before](before/canonical-explore-drawer-expanded-393.png) / [after](after/canonical-explore-drawer-expanded-393.png)) | 0 | 0 | 13 → 13 | 2 → 2 | 0 → 0 |
| 393x852/settings ([before](before/canonical-settings-393.png) / [after](after/canonical-settings-393.png)) | 0 | 0 | 1 → 1 | 1 → 1 | 0 → 0 |
| 393x852/notifications ([before](before/canonical-notifications-393.png) / [after](after/canonical-notifications-393.png)) | 0 | 0 | 0 → 0 | 0 → 0 | 0 → 0 |
| 430x932/home-feed ([before](before/canonical-home-feed-430.png) / [after](after/canonical-home-feed-430.png)) | 0 | 0 | 18 → 18 | 1 → 1 | 0 → 0 |
| 430x932/home-scrolled ([before](before/canonical-home-scrolled-430.png) / [after](after/canonical-home-scrolled-430.png)) | 0 | 0 | 18 → 18 | 1 → 1 | 0 → 0 |
| 430x932/court-live ([before](before/canonical-court-live-430.png) / [after](after/canonical-court-live-430.png)) | 0 | 0 | 8 → 8 | 1 → 1 | 0 → 0 |
| 430x932/schedule-court-picker ([before](before/canonical-schedule-court-picker-430.png) / [after](after/canonical-schedule-court-picker-430.png)) | 0 | 0 | 1 → 1 | 0 → 0 | 0 → 0 |
| 430x932/explore ([before](before/canonical-explore-430.png) / [after](after/canonical-explore-430.png)) | 0 | 0 | 12 → 11 | 0 → 0 | 0 → 0 |
| 430x932/explore-drawer ([before](before/canonical-explore-drawer-430.png) / [after](after/canonical-explore-drawer-430.png)) | 0 | 0 | 5 → 5 | 0 → 0 | 0 → 0 |
| 430x932/explore-drawer-expanded ([before](before/canonical-explore-drawer-expanded-430.png) / [after](after/canonical-explore-drawer-expanded-430.png)) | 0 | 0 | 13 → 13 | 2 → 2 | 0 → 0 |
| 430x932/settings ([before](before/canonical-settings-430.png) / [after](after/canonical-settings-430.png)) | 0 | 0 | 1 → 1 | 1 → 1 | 0 → 0 |
| 430x932/notifications ([before](before/canonical-notifications-430.png) / [after](after/canonical-notifications-430.png)) | 0 | 0 | 0 → 0 | 0 → 0 | 0 → 0 |
