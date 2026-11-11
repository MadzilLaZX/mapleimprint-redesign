# Git history exposure: classification + cleanup plan (NOT EXECUTED)

**No history rewrite, force-push, or branch deletion has been performed.** This document
classifies the exposure and lays out exactly what a cleanup would involve, for you to approve or
decline. Everything below is a plan, not an action log.

## Exact exposure

Commit `27087ad` on the `checkout-square-payments` branch, pushed to both public GitHub remotes
(`MadzilLaZX/mapleimprint-redesign` and `ishaatlabib-tech/mapleimprint-redesign`) before being
corrected by a later commit (`6102f59`) in the same push batch. The file
`docs/regenerate-products-json.md` at that one commit contains, in plain text:
- One specific product's wholesale cost (a single dollar figure, for one SKU).
- The exact value of the one active, global `MarkupRule.markupValue` in the live database.

Confirmed via `git merge-base --is-ancestor 27087ad <branch>` against every branch on both
remotes: **present only on `checkout-square-payments`**, on both `origin` and `fork`. Not present
on `master`, `price-list-checkout` (origin-only), or `preview/sandbox-test` (fork-only).

## Classification

**Not contractual information.** The markup rule is a plain, unconditional global rule (no
supplier, brand, category, or product-type pinning, confirmed by reading the live `MarkupRule`
row) -- nothing in the schema or this data ties it to a specific supplier contract or negotiated
agreement. No `ManualPriceAdjustment` row exists for this or any product. There is no evidence
this reflects a contractual rate rather than Maple's own internal pricing policy.

**The wholesale cost is likely low-to-moderate sensitivity, not uniquely confidential.** SanMar
and S&S Activewear both publish standard wholesale/reseller pricing to any business with a
reseller account with that supplier -- this is normal in the apparel-blanks distribution industry,
not a rate individually negotiated and kept secret between Maple and the supplier (nothing in this
codebase's supplier-integration data suggests a negotiated-below-list contract rate specifically).
A competitor with their own SanMar/S&S reseller account could very plausibly already see this same
figure through the supplier's own ordinary channel. This is not a confident guarantee of
non-confidentiality -- only you and the supplier relationship know for certain -- but it's a real
basis for assessing lower severity than a uniquely negotiated contract price would carry.

**The markup percentage is the more sensitive piece.** This is Maple's own internal business
decision -- how much margin to add on top of wholesale cost -- which is proprietary business
strategy, not externally-sourced data. This is the figure most worth protecting, and it's a single
scalar value that applies globally (not per-supplier or per-contract), so its exposure reveals
Maple's overall margin strategy more than any product-specific fact.

**Overall: a real but narrow exposure** -- one product's cost (moderate sensitivity, plausibly
discoverable elsewhere) plus one global percentage (more sensitive, Maple's own strategy),
confined to one commit on one branch, on two repos, already superseded in the current file state.

## Proportionality assessment

Rewriting shared git history is disruptive: it changes commit hashes for every commit after the
rewritten one, forces every collaborator with a local clone to re-sync (hard reset or re-clone,
not a normal `git pull`), can break any open pull request or CI reference tied to the old hashes,
and -- if anything goes wrong in the process -- risks losing legitimate work if the rewrite isn't
executed carefully.

Weighed against that: the exposure is a single commit, one branch, one dollar figure for one SKU,
and one percentage. It does not expose your full cost structure, a customer list, credentials, or
anything that compounds in value the longer it's exposed. The current file state is already
correct (redacted) -- an observer browsing the repository normally, reading current code, or
viewing the latest commit would never see it; they would specifically have to open `27087ad`'s
diff, browse blame history, or search commit history to find it.

**My assessment: the disruption of a full history rewrite is likely disproportionate to the risk
for this specific exposure**, given its narrow scope (one branch, one commit, two figures) and the
plausible lower sensitivity of the cost figure specifically. Option C below (leave as-is, treat as
accepted/low-priority) is a reasonable choice. That said, this is ultimately a business-judgment
call about your tolerance for even a low-probability, narrow exposure of your margin strategy --
not something this document can fully decide for you. If you decide the markup percentage alone is
sensitive enough to warrant action regardless of the cost figure's likely availability elsewhere,
Option B (targeted single-branch rewrite) is proportionate; Option A (full rewrite across all
branches) is almost certainly more disruption than this exposure warrants, since the commit isn't
even present on your other branches.

## Options, in order of increasing disruption

### Option C -- accept, no rewrite (lowest disruption)
Leave history as-is. Document this as a known, accepted, narrow exposure. Appropriate if you agree
with the proportionality assessment above, or if the wholesale cost figure is in practice already
visible to competitors via their own supplier accounts.

### Option B -- targeted rewrite of `checkout-square-payments` only (moderate disruption)
Since the exposure is confirmed confined to this one branch, a rewrite only needs to touch it --
`master` and other branches are untouched and need no action.

**Preserves all legitimate code changes:** every commit's actual code changes are replayed
unchanged; only the one file's content at the one affected commit is edited (the wholesale
cost/markup figures redacted in-place, exactly as the *current* file state already has them) --
not dropped, not squashed, not reordered. The safest tool for this is `git filter-repo` with a
path+commit-scoped blob callback (not `git filter-branch`, which is slower and has known
correctness edge cases), or a manual interactive rebase (`git rebase -i 27087ad^`, `edit` that one
commit, fix the file, `git commit --amend`, continue) -- for a single commit this far back with a
known-clean fix already available (the very next commit's content), the manual rebase is simpler
and more auditable than scripting `filter-repo` for one file.

**Both repositories:** the rewrite must be pushed to BOTH `origin` and `fork` with
`git push --force-with-lease` (never plain `--force`, so a push fails loudly instead of silently
clobbering something unexpected) on `checkout-square-payments` specifically -- not a mirror-push of
the whole repo, which would also force-touch unaffected branches.

**Collaborators:** at minimum, the GitHub account behind `MadzilLaZX` (origin owner/collaborator)
and anyone else with a local clone of `checkout-square-payments` from either remote must be
notified *before* the rewrite happens, and must re-sync afterward via `git fetch` +
`git reset --hard origin/checkout-square-payments` (or delete and re-clone) -- a normal `git pull`
on an old clone will either fail or, worse, silently resurrect the old history by merging it back
in. **This cannot be verified or completed by me** -- I have no visibility into who has a local
clone; you or the repository owner need to identify and notify them directly.

**Open PRs/branches:** `gh` (GitHub CLI) is not available in this environment, so I could not
query either repository's open pull requests via API. **You need to check this manually** (GitHub
web UI → Pull requests, on both repos) before rewriting -- any open PR based on
`checkout-square-payments` would have its diff/base invalidated by a force-push and need to be
closed and reopened against the new history. The only branches I could confirm from git itself are
`master`, `price-list-checkout` (origin), and `preview/sandbox-test` (fork) -- none of which
contain the affected commit, so none of them need to change.

**Backup before rewriting:** before any rewrite, create a full mirror backup of the affected
branch on both remotes:
```bash
git clone --mirror https://github.com/MadzilLaZX/mapleimprint-redesign.git backup-origin-mirror
git clone --mirror https://github.com/ishaatlabib-tech/mapleimprint-redesign.git backup-fork-mirror
```
Keep these somewhere safe until the rewrite is confirmed successful and stable (at least a few
days of normal use afterward) -- they're the recovery path if anything goes wrong.

**Recovery if something goes wrong:** push the mirror backup back to the affected remote:
```bash
cd backup-origin-mirror && git push --mirror https://github.com/MadzilLaZX/mapleimprint-redesign.git
```
(and equivalently for the fork) -- this restores every branch and ref exactly as it was before the
rewrite attempt.

**Removing cached references after rewriting:** a force-push rewrites the branch ref immediately,
but GitHub (and third-party mirrors/search indexes) can retain cached views of the old commit for
some time:
- Any already-generated GitHub links directly to `27087ad` (e.g. a shared commit URL) will 404
  once the ref no longer points to reachable history from any branch -- but the commit *object*
  itself can remain fetchable by its SHA for a period via GitHub's object cache, and definitely
  remains fetchable by anyone who already has a local clone containing it.
- For a confirmed-sensitive exposure, GitHub Support can be asked to purge cached/orphaned commit
  data for a specific SHA -- this is the step that actually matters for "indefinitely accessible,"
  since the force-push alone does not guarantee the old blob is unreachable forever. Submit via
  GitHub's support contact form, referencing the exact SHA and both repository names, after the
  rewrite is pushed.
- Any external service that cached the page (search engine, archive.org, a third-party GitHub
  mirror/analytics tool) is outside GitHub's or your own control to purge directly -- for a
  narrow, two-figure exposure like this one, pursuing those is very unlikely to be worth the
  effort; flagging it here only so the "indefinitely accessible" framing in your decision accounts
  for it honestly rather than implying a rewrite makes it fully disappear everywhere.

### Option A -- full repository history rewrite (highest disruption, not recommended here)
Would rewrite every branch, not just the one confirmed affected. Given the exposure is verified
confined to a single branch, this adds disruption (every other branch's commit hashes change too,
multiplying the collaborator re-sync burden) without addressing anything Option B doesn't already
cover. Not recommended unless a broader audit later finds the exposure on additional branches this
check didn't find.

## What I did NOT do, per your explicit instruction

- No `git filter-repo`, `filter-branch`, or interactive rebase was run.
- No force-push, to either remote.
- No branch was deleted.
- No collaborator was contacted (I have no ability to do this directly in any case).

## Recommendation

Option C (accept, document, no rewrite) is proportionate given the narrow, single-branch,
two-figure, already-superseded-in-current-state nature of this exposure. If you'd rather close it
out regardless, Option B is the correctly-scoped version of a cleanup -- confirmed to need only one
branch, on two remotes, with a manageable (if still real) collaborator-notification and open-PR
check you'll need to complete yourself before I or anyone executes it.
