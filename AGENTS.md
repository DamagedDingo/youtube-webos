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
- `npm run codemap` after touching a module; `npm run codemap:check` is part of `npm test`.

## Commits

Conventional commits (`feat(adblock): …`, `fix(panel): …`). If an agent did the work, say so in a trailer:

```
Co-authored-by: Hermes Agent <agent@nousresearch.com>
```

## Releases

One owner at a time, claimed as above.

1. Build both bundles and package each: legacy → `youtube.leanback.v4_<version>_all.ipk`,
   `build:modern` → `youtube.leanback.v4_<version>_all_webOS22+.ipk`.
2. Tag `v<version>` (or `v<version>-<suffix>` for a fork-only build) and attach **both** ipks.
3. Regenerate `repo.json` with the asset URLs and their SHA-256s, and commit it.
