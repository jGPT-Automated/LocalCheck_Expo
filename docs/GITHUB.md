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

If `quality` has not run on `main` yet, merge the lifecycle-reset pull request
first, wait for its successful `main` run, then add it as the required check in
the ruleset.
