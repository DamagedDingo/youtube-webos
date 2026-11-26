# AGENTS.md

Rules for AI agents working in this fork. Read this before your first write. It assumes several agents
(and one human) may touch the same repository and the same TV, possibly at the same time.

## What this repository is

A personal fork of [NicholasBly/youtube-webos](https://github.com/NicholasBly/youtube-webos), carrying a
small number of patches on top of it, plus its own Homebrew Channel repository entry at `repo.json`.

## Upstream policy

- **Only `NicholasBly/youtube-webos` is upstream.** Add it once:

  ```sh
  git remote add upstream https://github.com/NicholasBly/youtube-webos.git
  ```

- `webosbrew/youtube-webos` is the pre-rewrite ancestor (0.5.3, last commit 2026-07-19, 105 commits that
  NicholasBly's tree does not contain because it replaced them). Never merge or rebase onto it.
- Keep local work as commits on top of upstream, and bring it forward with:

  ```sh
  git fetch upstream && git rebase upstream/main
  ```

## One writer per branch

- Each agent works in its **own clone or `git worktree`**. Never edit a checkout another agent is using.
- Branch names are `agent/<topic>`; never push straight to `main`.
- `main` moves only by pull request, so two agents can only ever produce two PRs, never a corrupted history.
- Rebase before pushing your own branch. Never force-push a branch someone else may have based work on.

## Claim shared resources before touching them

Two things exist in exactly one copy and cannot be cloned:

- **The TV** (hostname `LGwebOSTV`).
- **Releases and tags** on this repository.

Claim one in the Kanban board `youtube-webos` (`hermes kanban --board youtube-webos list`) before you start,
and record who holds it. Release the claim when you are done. Claims are advisory between humans but they
are the only channel that survives a session that does not know about you.

For the TV, `scripts/tv-lock.sh` wraps the SSH call in an `flock`, so a second agent waits instead of
installing over you:

```sh
scripts/tv-lock.sh 'luna-send -n 1 -f luna://com.webos.applicationManager/launch {"id":"youtube.leanback.v4"} </dev/null'
```

## The TV

- OLED C2, webOS TV 10.2.2, aarch64 kernel with a 32-bit webOS userland.
- Reachable at `100.80.141.50` (Tailscale) and `192.168.0.114` (LAN). Root SSH with `~/.ssh/id_ed25519`.
- Developer-mode SSH on port 9922 is usually closed; the Homebrew Channel's dropbear on port 22 is what
  answers. Do not re-enable developer mode just to install a package — install from a local path instead:

  ```sh
  scp dist/*.ipk root@$TV:/tmp/app.ipk
  ssh root@$TV 'luna-send -n 1 -f luna://com.webos.appInstallService/dev/install \
      "{\"id\":\"testing\",\"ipkUrl\":\"/tmp/app.ipk\"}" </dev/null'
  ```

  It answers `returnValue:true` without a subscription. Verify by the installed file's mtime and by
  grepping the installed bundle for the new code, never by that return value alone.
- The app id is `youtube.leanback.v4` for both `_all` and `_all_webOS22+` ipks; `.webos22` is a
  `repo.json` catalogue alias only, not an installed app id, so never pass it to `addDevice`.
- Settings live in the shared WebAppMgr profile, not in the package:
  `/var/lib/wam/Default/Local Storage/leveldb`, key `ytaf-configuration` (owner `wam:composit`). Installing
  over the app preserves them; a full uninstall can drop them.
- Never reboot, factory reset, or write to `/usr` or any signed partition for an app change. Close only the
  app you are changing: `luna-send -n 1 -f luna://com.webos.applicationManager/closeByAppId '{"id":"…"}' </dev/null`.

## Build and test

```sh
npm install                 # once per clone
npm run build:modern        # webOS 22+ bundle (what the C2 needs)
npm run package             # ares-package → dist/*.ipk
npm test                    # format, lint, types, codemap, legacy + modern builds, all scripts
```

- **Builds are killed at 120 s and test scripts at three times their previous run, with a 30 s floor.** On a
  loaded machine every step dies at 30.3 s and looks like a code failure. Run `--jobs=1` (or `--jobs=2`)
  when more than one agent is working, and delete `node_modules/.cache/run-all-timings.json` after an
  aborted run, or the poisoned timings keep the budgets at the floor.
- A single suite: `node tests/run-all.mjs --only=<name> --jobs=1`.
- **A green `npm test` on this laptop proves little while another agent is building.** The full parallel
  run dies at the 30 s floor (30.2-30.5 s, no assertion failure) while `--jobs=1` and per-group `--only=`
  runs of the same tree are clean. Prefer those, and let CI (`main.yml`) own the full parallel run: it
  takes about 70 s on a runner, and `smoke/perf-mon-test` runs there in 8.2 s. A 30 s death for that
  suite here is load, not a code failure.
- `npm run codemap` after touching a module; `npm run codemap:check` is part of `npm test`.

## Commits

Conventional commits (`feat(adblock): …`, `fix(panel): …`). If an agent did the work, say so in a trailer:

```
Co-authored-by: Hermes Agent <agent@nousresearch.com>
```

## Releases

One owner at a time, claimed as above.

**Versioning.** A fork release is the next patch above the upstream release it contains: upstream 0.8.5
plus these fork commits is 0.8.6, tagged `v0.8.6`. Fork-only test builds keep a build number
(`v0.8.5-b2`), are pre-releases, and are produced by `auto-discussion.yml`; they are never a release.

**Bumping.** Set `package.json` `"version"`, run `node tools/sync-version.cjs` (it writes
`assets/appinfo.json` from it), move the `## [Unreleased]` changelog entries under the new
`## [X.Y.Z] - YYYY/MM/DD` heading, and land it by PR. `release.yml` re-checks that the tag agrees with
`assets/appinfo.json` and fails *before* building if they disagree, so a forgotten `sync-version.cjs` is a
red run, not a mislabelled package. Push the tag only at a commit that is on `main`.

**Size budget.** The legacy (webOS 3-6) bundle budget is **250 KiB** (`tests/smoke/bundle-check.cjs`),
raised from 240 KiB in 0.8.6 because the Filters work ships to both flavours and the legacy bundle landed
at 247,287 bytes.

**`release.yml` owns a release.** Push a `v*.*` tag, or `gh workflow run release.yml -f tag=v<version>`
for an existing tag. It builds both bundles, packages both flavours, attaches them plus the manifest to a
**draft**, then un-drafts it - the draft is what makes the published release carry final assets from the
first second it is visible. `build_repo.yml` is dispatched at the end (see below), and the run fails if
`repo.json` on `main` does not end up naming both assets with matching SHA-256s. If only that last part
failed, finish it with `-f recatalogue=true` rather than cutting a new version (see below).

Doing it by hand is still allowed, but keep the same order:

1. Build both bundles and package each: legacy → `youtube.leanback.v4_<version>_all.ipk`,
   `build:modern` → `youtube.leanback.v4_<version>_all_webOS22+.ipk`.
2. Create the release **as a draft** on tag `v<version>` (or `v<version>-<suffix>`) with both ipks
   attached. Assets on a published release are a one-way door, so they must be there before it is visible.
3. Publish the draft (`gh release edit v<version> --draft=false`). `build_repo.yml` runs on
   `release: published` (the event fires when a *person* publishes, not when a workflow does),
   regenerates `repo.json` from the published asset URLs and their SHA-256s, and commits it to `main`.
   Watch it happen: `gh run list --limit 5`.
4. Verify like a consumer: download both `ipkUrl`s from the committed `repo.json` and match their SHA-256s.
5. If no run appears, `gh workflow run build_repo.yml --ref main` and repeat step 4. A release is not done
   until `repo.json` on `main` names it.

**Never replace an `.ipk` on a published release.** `repo.json` records its SHA-256 and Homebrew Channel
verifies it: a rebuilt asset leaves a stale hash and installs fail. A rebuild is a new version and a new
release.

**`ares-package` is not byte-reproducible.** Two runs of `npm run package` over the same `dist/` produced
`04ffd84e…` and `825bb1fe…` (zip timestamps), so a rebuild could never keep `repo.json`'s hash valid.
`release.yml` therefore never re-uploads: a second run for an already-published tag says so and exits 0
without touching either asset. A leftover *draft* is deleted and rebuilt - nothing has hashed a draft.

**A workflow cannot wake another workflow through an event.** GitHub starts no run for an event raised by
`GITHUB_TOKEN`, with `workflow_dispatch` and `repository_dispatch` as the documented exceptions. A release
published by `release.yml` therefore does *not* fire `build_repo.yml`'s `release: published` trigger - the
only release-event run this fork ever produced came from a hand-published release - so `release.yml` runs
`gh workflow run build_repo.yml --ref main` itself and watches it. `build_repo.yml` has a `build-repo`
concurrency group so a dispatched run and an event run cannot race each other's commit to `main`.

**That dispatch needs `actions: write` on the calling workflow, and its absence fails after publishing.**
`gh workflow run` uses the Actions API, so the token needs the `actions` scope. `release.yml` shipped with
`permissions: contents: write` only (which zeroes every other scope) and 0.8.7 published both ipks and then
died on the next step with `could not create workflow dispatch event: HTTP 403: Resource not accessible by
integration`, leaving `repo.json` on the previous version. The probe that had "proved" the dispatch route
declared `permissions: actions: write`; the permission was lost when the real workflow was written, and a
`workflow_dispatch`-triggered probe does not exercise the release job's permission block. Anything that
must start a workflow therefore carries both scopes:

```yaml
permissions:
  contents: write   # tags, releases, assets
  actions: write    # gh workflow run
```

The order matters: the 403 arrives *after* the assets are public, which is why the recovery path below
exists and why the release must never be retried by rebuilding.

**If the catalogue step is the only thing that failed, re-catalogue; do not re-tag.** Once a release is
published its assets are final, so `release.yml` refuses to touch them. Pick the catalogue up instead:

```sh
gh workflow run release.yml --ref main -f tag=v<version> -f recatalogue=true
```

That path downloads the published ipks, dispatches and watches `build_repo.yml`, and runs the same
`repo.json` verification - it never builds, packages or uploads, so no hash can move. Without
`recatalogue=true` a second run for a published tag is the plain no-op ("already published") and the
catalogue is never dispatched. Verify the recovery by checking that `repo.json` on `main` names the tag and
that its hashes match the bytes you download from the `ipkUrl`s.

**`gh` calls in a step that runs before the checkout must pass `-R "$GITHUB_REPOSITORY"`.** A
`workflow_dispatch` job starts with an empty workspace, so `gh` cannot infer the repository from the cwd
and fails with `fatal: not a git repository` (`gh release download`) or `failed to determine base repo`
(`gh run watch`). The leftover-draft `gh release delete` has the same problem - it runs before
`actions/checkout` too. Any *new* step that runs before the checkout needs the explicit `-R`.

**`gh run rerun` on a release run is safe and is the idempotency test.** GitHub re-runs the workflow file
from the run's own commit, and the first thing it does is ask the API whether the tag is already published.
For a real non-pre-release that answers yes, the run takes "Already published - nothing to do", skips every
build step and exits 0 with both asset digests unchanged. If a rerun ever rebuilds, the asset hashes move
and `repo.json` is stale - stop and fix the workflow, do not re-upload.

**Events do start workflows now, but the flag does not tell you.** From the fork's creation until
2026-11-26 09:30 UTC, pushes, PRs, tags and releases produced no run at all while `workflow_dispatch`
worked, and `GET /repos/{owner}/{repo}/actions/permissions` still said `enabled: true`.
`PUT /repos/{owner}/{repo}/actions/permissions -F enabled=true` fixed it. After any push or release,
check `gh run list` rather than assuming, and never use the `enabled` flag as evidence that events work.

**`.github/workflows/**` needs the `workflow` scope, which the `gh` OAuth token here does not have.**
`git push` over HTTPS is refused with "refusing to allow an OAuth App to create or update workflow
… without `workflow` scope" and the contents API answers 404. Git pushes over **SSH** are not affected:
`~/.ssh/id_ed25519` is registered on the account as "hermes@KDE-laptop", so push workflow changes with
`git push git@github.com:DamagedDingo/youtube-webos.git HEAD:refs/heads/<branch>` (`gh auth refresh
-s workflow` also works but wants a browser).

