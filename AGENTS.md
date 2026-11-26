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

**Size budget.** The legacy (webOS 3-6) bundle budget is **250 KiB** (`tests/smoke/bundle-check.cjs`),
raised from 240 KiB in 0.8.6 because the Filters work ships to both flavours and the legacy bundle landed
at 247,287 bytes.

1. Build both bundles and package each: legacy → `youtube.leanback.v4_<version>_all.ipk`,
   `build:modern` → `youtube.leanback.v4_<version>_all_webOS22+.ipk`.
2. Create the release **as a draft** on tag `v<version>` (or `v<version>-<suffix>`) with both ipks
   attached. Assets on a published release are a one-way door, so they must be there before it is visible.
3. Publish the draft (`gh release edit v<version> --draft=false`). `build_repo.yml` runs on
   `release: published`, regenerates `repo.json` from the published asset URLs and their SHA-256s, and
   commits it to `main`. Watch it happen: `gh run list --limit 5`.
4. Verify like a consumer: download both `ipkUrl`s from the committed `repo.json` and match their SHA-256s.
5. If no run appears, `gh workflow run build_repo.yml --ref main` and repeat step 4. A release is not done
   until `repo.json` on `main` names it.

**Never replace an `.ipk` on a published release.** `repo.json` records its SHA-256 and Homebrew Channel
verifies it: a rebuilt asset leaves a stale hash and installs fail. A rebuild is a new version and a new
release.

**`release.yml` is disabled on this fork** (`gh workflow list --all` shows `disabled_manually`). Its tag
trigger builds only the legacy bundle and uploads with `allowUpdates: true`, so it would overwrite both
assets of a release after `build_repo.yml` hashed them. Leave it disabled until it builds both flavours;
publishing a release is the only path that produces assets here.

**Events do start workflows now, but the flag does not tell you.** From the fork's creation until
2026-11-26 09:30 UTC, pushes, PRs, tags and releases produced no run at all while `workflow_dispatch`
worked, and `GET /repos/{owner}/{repo}/actions/permissions` still said `enabled: true`.
`PUT /repos/{owner}/{repo}/actions/permissions -F enabled=true` fixed it. After any push or release,
check `gh run list` rather than assuming, and never use the `enabled` flag as evidence that events work.

**`.github/workflows/**` cannot be pushed with the `gh` OAuth token on this machine.** It lacks the
`workflow` scope: `git push` is refused with "refusing to allow an OAuth App to create or update workflow
… without `workflow` scope" and the contents API answers 404. Run `gh auth refresh -s workflow` before
changing a workflow file.
