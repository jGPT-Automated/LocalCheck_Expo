# GitHub merge policy

Repository files provide CI and the pull-request handoff. Configure `main` once
in GitHub Settings → Rules → Rulesets with:

- pull requests required before merge;
- required status check `quality`;
- branch must be up to date before merge;
- all review conversations resolved;
- force pushes and branch deletion blocked;
- no direct bypass for routine agent work.

For the current single-owner MVP, an approval count of zero is acceptable when
the owner performs the runtime review; required CI and resolved conversations
still protect `main`. Increase required approvals when another regular reviewer
joins.

Use squash merge for task branches so each pull request becomes one traceable
outcome. Delete the remote task branch after merge. Large stale pull requests
must not be rebased and merged wholesale; extract one independently reviewed
change onto current `main`.

For the current reset, PR #28 is the only merge candidate. It targets `main`
directly and contains PR #27 plus every later MVP commit. Close #27 as
superseded after #28 is current and green; do not stack or merge both. After
#28's first successful `main` run, select `quality` as the required check if the
ruleset has not already been enabled.

Closing old pull requests and deleting merged task branches keeps the active
repository clean without deleting incorporated Git history. A ZIP or safety
fork is optional insurance, not part of the normal merge procedure.
