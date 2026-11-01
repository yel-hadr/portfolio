# Game Mode audit: open follow-ups (PR 6)

Put this file at `docs/GAME_AUDIT_FOLLOWUPS.md` and ask Claude Code:

> Fix every item in docs/GAME_AUDIT_FOLLOWUPS.md, in order, in one PR. Tick each box in this file as you
> finish it, and list every ID in the commit message. Do not start the P1/P2 game proposals in this PR.

Checked against `main` at f7b6f36 (after PR 5, #50). Line numbers are approximate; search for the names.
Paths are under `src/components/Cub3D/` unless given.

## Medium first

- [x] **H1 Memory Leak beside the lit path.** `rooms.js:68` has e5 at `[40, 10]`, 2 cells from the route
  Skills → Projects → Experience (slow radius 2.5), so following the chevrons slows the player. Move e5 to
  `[36, 15]` (3 cells from both routes and every terminal). Re-check it is floor and off `PROP_CELLS`.
- [x] **F2 Clicks act during Access granted.** `interact` (~2143), `fire` (~2208), `onPointerDown` (~2604)
  and `onClick` (~2649) in `Cub3DWorld.jsx` have no `access` guard: a click re-runs `openTerminal` (the
  700 ms hand-off restarts, "Access granted" is announced again) or fires and spends energy. Return early
  when `access` is set in all four.
- [x] **G1 "Tap again to exit" is never announced.** `ExitButton` (`GameHud.jsx` ~589) only swaps its
  label, and the first tap moves focus to the view. Announce `demos.game.exitConfirm` through the status
  live region, and keep focus on the button between the two taps.

## Low

- [x] **F1 Lasers fade unseen.** `read` is set when the Projects dossier opens (`Cub3DWorld.jsx` ~2134), so
  `discovered` starts the fade (`Facility.jsx` ~1193) behind the dossier. Start the fade from `closePanel`
  when Projects closes (a `vaultOpen` prop); keep the mount-time state from `discovered` for a world back
  from a demo.
- [x] **F3 Early Esc on the end dialogs.** `useModalDialog.close()` releases inert before MissionComplete's
  guarded `onClose` (`GameHud.jsx` ~705), so an Esc or backdrop click in the first 400 ms leaves the dialog
  open but Game Mode interactive. Check the `armed` guard before `close()`. SystemFailure's Escape has no
  guard at all: add it.
- [x] **F4 MISSION COMPLETE lost to Text-only or Exit.** `onTextMode(snapshot())` (~3053) and `onExit`
  ignore `missionPending`; the snapshot already says `missionDone`, so the dialog never shows. Ignore both
  while `missionPending`.
- [x] **F5 High contrast dims unaimed terminal edges.** `Facility.jsx` ~577 sets the edge to 0.55 when not
  aimed. Keep 1 for unaimed edges; mark the aimed one with the foreground color instead.
- [x] **F6 Key-only prompt at a read terminal.** `promptKeyOnly` (~3044) ignores whether the terminal was
  read; a read terminal's screen shows a tick, not "Press E". Use the key-only chip only while unread.
- [x] **F7 Flashlight distance.** `onTick` (~1822) casts its own ray beside `aimAt`'s, center line only.
  Take the wall distance from `aimAt`, and add one short side probe toward the lens (left shoulder).
- [x] **G2 French Exit label too wide.** "Touchez encore pour quitter" widens the row about 220 px and
  covers the mission tracker on ~667 px phones. Use "Encore pour quitter" or a fixed button width.
- [x] **G3 Lone "|" when the status bar wraps** (`GameHud.jsx` ~540, the separator is its own flex item).
  Use a left border with padding on items 2+ instead of text separators.
- [x] **G4 Sound state invisible during play.** M only gives an sr-only announcement. Show a brief chip on M
  and/or a small sound icon in the status bar. Remove the stale "The button shows the state" comment.
- [x] **G5 Hum before Start.** Turning Sound on in the main menu starts the hum (now ducked to 30%). Start
  the hum on Start, not in the menu.
- [x] **G6 Touch players can't see the weapon held.** The weapon card is hidden on coarse pointers. Show the
  weapon's short name next to the slim integrity meter (or on the Weapon button).
- [x] **G7 Radar on a landscape phone.** It is `sm:block` (`Cub3DWorld.jsx` ~2882) and with its legend
  covers about a third of an 844×390 view; the fact toast overlaps it. On short screens hide the legend and
  shrink the radar (or put it behind a tap).
- [x] **H3 Pause resets the damage wind-up.** Pause writes `pressure = 0`, which resets `hp.since`, so
  pausing every half second avoids all damage. Keep the wind-up across a pause (count it in game time).
- [x] **H4 Threat against a rack.** It is close enough to hurt but the crosshair and blaster can't reach it
  through the rack (`seen()`, `Enemies.jsx` ~510, has no prop check). Keep threats 0.5 cell off props, or
  let point-blank shots through.
- [x] **H5 Out-of-range label.** It reads "click or press F to shoot · Out of range". Drop the shoot hint
  when out of range; re-announce on a weapon switch or when walking into range.
- [x] **H6 Queued facts take 8 s each** (`TOAST_MS`), so a 3-kill blast fills 24 s. Show each for 4 s while
  others wait.
- [x] **H7 Per-frame callbacks.** `propAlong` `forEach` (~329), Scene's `free`/`onProp` `.some` (~636–648),
  and a `seen` closure per threat per frame. Use plain `for` loops.
- [x] **I1 Hum cuts out on an early duck.** `sfx.js` ~110: `duck` calls `cancelScheduledValues(now)` without
  holding the value. Use `cancelAndHoldAtTime(now)` (or `setValueAtTime(gain.gain.value, now)` after the
  cancel, as `stopHum` does).
- [x] **I2 Hardcoded percentage.** `GameHud.jsx` ~924 shows `Integrity: 0%` in SYSTEM FAILURE. Use
  `t('demos.game.percent', { value: 0 })`; French wants a space before the colon.
- [x] **I3 Relock after a demo can fail silently.** It runs on a fixed 120 ms timer (~2494); if the controls
  aren't mounted, `relock` (~2108) clears the flag and does nothing. Clear it only after a request was made,
  or relock when the controls mount.
- [x] **I4 Contact me resets the relock flag**, so play after the Contact dossier doesn't capture the mouse
  again. Keep `relockRef` through that path.

## Docs (CLAUDE.md)

- [x] The High contrast toggle is in the settings (main menu and pause menu), not the HUD.
- [x] `interact` refuses during Access granted only once F2 lands; say so accurately.

## Before merging

- [x] `npm run lint`, `npm run format:check`, `npm run compiler:report` (Skipped: none), en/fr key parity.
- [ ] Play: read Projects and watch the lasers fall after closing the dossier (F1); click during Access
  granted (F2); follow the lit path Skills → Experience without "Slowed" (H1); on a phone, tap Exit once
  with a screen reader on (G1).
  Automated (real GPU, production build, `.playwright-mcp/pr7-check.js`): F1, F2, H1 and G1 pass there
  (G1 checks the live region's text and the focus in touch emulation). Still to do by hand: a real
  phone with a screen reader.

# PR 8: the finale, the shortcut, the Memory Leak

Checked against `main` at d76d92f (after PR 7, #52). The list sent for this PR stopped after the
three items below; J4–J12 and K2–K6 come in a later one.

## Medium

- [x] **J2 + K1 Clicks and kills during the finale.** During "Deploy to production" a click captured
  the mouse and the next one fired; the deploy's end opened MISSION COMPLETE with the mouse captured;
  a last kill could open MISSION COMPLETE for the threats while the pipeline ran. `missionPending`
  now holds for the whole finale, and `fire`, `onPointerDown`, `onClick`, `lookWithMouse` and the
  wheel check it; the Mouse look button is not offered during the deploy; the deploy's end calls
  `setPauseOpen(false)` and `holdView()` before `completeMission`; the threats' MISSION COMPLETE
  waits for a running deploy (`deploying`) and the deploy's end does not focus or capture behind
  it (`completing`).
- [x] **J3 Contact is still a dead end.** A shortcut door between Contact and About (x 2–3,
  rows 7–9), closed at the start, labelled from both sides. Also found: `openAllDoors` set every
  door to `true`, which is *closed* in the door state, so the finale closed every door; it now
  opens them.
- [x] **H1 (rest) Memory Leak beside two routes.** No cell in Projects keeps 2.5 cells from every
  lit-path route (the best is 2.0), so e5 stays at [36, 15] and the lit path steers round its pull
  while it is alive (`LEAK_ZONES`, one per leak, only the live ones), re-laid as it falls; `SLOW_RANGE` moved to rooms.js.

## Before merging

- [x] `npm run lint`, `npm run format:check`, `npm run compiler:report` (Skipped: none), build.
- [x] `.playwright-mcp/pr8-check.js` (real GPU, production build) and the earlier suites.
