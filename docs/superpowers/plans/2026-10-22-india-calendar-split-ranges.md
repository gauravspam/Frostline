# India Calendar Split Ranges Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split multi-day festivals into named observations with one continuous parent band, and make India the combined view of the India, Indian-Hindu, and Indian-Muslim calendars.

**Architecture:** `calFestivals()` keeps returning parent events (the band's source of truth) but gains an `ev` array of single-day display events built from a new `obs` field in the data, with union/dedup for India. New `calDisplay()` flattens the display events; `calHolidays()`, the coming-up list, and `renderSel()` switch onto it. Bands/brackets come from parents only, so the bracket CSS stops requiring the `hol` class.

**Tech Stack:** Vanilla JS in `js/holidays.js` (data) and `js/app.js` (render), one CSS rule family, existing Playwright/Helium probe harness. No build step.

**Spec:** `docs/superpowers/specs/2026-10-22-india-calendar-split-ranges-design.md` (committed at f9957f8)

## Global Constraints

- No new permissions, remote calls, APIs, or dependencies (spec Non-goals; AGENTS hard rule on manifest.json).
- No correction of existing festival date ranges; observation dates only nest inside already-approved ranges, except Diwali 2027/2028 dates already corrected in the v0.4 commit (spec Non-goals).
- Keyboard commands, storage keys, and the onboarding picker are untouched.
- Minimal diffs; comments explain why, never what (AGENTS code style).
- Cache busters bump: `js/app.js` -> `?v=14` (currently 13), `js/holidays.js` -> `?v=3` (currently 2) in `newtab.html:421-422`.
- `.agent/` stays untracked. `pre-commit run --all-files` gates pass on every commit (AI-tell gate scans added lines; no em dashes in added comments).
- Visual language unchanged: 15% band fill, 35% brackets, dark glass (spec Goal).

## Review Focus

Conditions the spec implies but no single task test alone pins; each line here is tested by the task named after the pin.

1. Band-only day (Diwali Nov 9 2026): cell keeps the band, shows no dot, has no list row, and selecting it shows parent context "Diwali · Nov 6-11". Pinned in Task 3's probe.
2. Focused calendars absorb shared India singles: with `Indian - Hindu` selected there is exactly one Diwali display row (the obs), not a rotated duplicate of India's 11-08 holiday. Pinned in Task 2's merge check.
3. Non-India calendars unchanged: Japan/General/US months render the same rows as before and no country crashes on the new code path. Pinned in Task 3's probe.
4. Today inside a band keeps its filled circle; the band fill stays hidden behind it (existing `#cal-grid span.today.multi::before{display:none}`, style.css:249), and with brackets going hol-free today must also stay bracketless via the widened `:not`-pair rule (execution ruling: specificity). Pinned as a CSS text assertion in Task 3's probe.
5. A country-month with no festivals at all renders an empty coming-up list without errors (Japan, February 2027). Pinned in Task 3's probe.

---

### Task 1: Observation data in `js/holidays.js`

**Files:**
- Modify: `js/holidays.js` (Hindu group `annual` line ~14, `years` 2026 lines 21-42, 2027 lines 43-63, 2028 lines 64-84; Muslim group `years` 2026-2028 lines 89-114)
- Test: `%TEMP%\opencode\split-data-check.cjs`

**Interfaces:**
- Consumes: existing shape `{ n, i, s, e, v }` per festival; new optional field `obs:[{ d:'MM-DD', n:'Name' }]` (day-own icon optional `i`).
- Produces: for Task 2, parents whose `obs` entries all fall inside `s..e`, names verbatim from the spec mapping table.

Obs mapping (all names verbatim from the spec's Split mapping table; dates inside each parent's existing range):

| Parent | obs pattern |
| --- | --- |
| Diwali | Dhanteras (s); Choti Diwali (s+1); Diwali (s+2); Govardhan Puja (s+3; s+4 in 2026, its preceding day stays band-only); Bhai Dooj (e) |
| Chhath Puja | Nahay Khay (s); Kharna (s+1); Sandhya Arghya (s+2); Usha Arghya (e) |
| Holi | Holika Dahan (s); Holi (e) |
| Chaitra Navratri | Chaitra Navratri begins (s); Chaitra Navratri ends (e) |
| Sharad Navratri | Sharad Navratri begins (s); Sharad Navratri ends (e) |
| Onam | Atham (s); Thiruvonam (e) |
| Ganesh Chaturthi | Ganesh Chaturthi (s); Anant Chaturdashi (e) |
| Durga Puja | Durga Puja begins (s); Durga Puja ends (e) |
| Ramadan | Ramadan begins (s); Ramadan ends (e) |
| Pongal (annual) | Bhogi Pongal (01-14); Thai Pongal (01-15); Mattu Pongal (01-16); Kaanum Pongal (01-17) |

Per-year pinned dates:

- Diwali 2026 `11-06..11-11`: Dhanteras 11-06, Choti Diwali 11-07, Diwali 11-08, Govardhan Puja 11-10, Bhai Dooj 11-11 (Nov 9 band-only, per spec reference example). 2027 `10-27..10-31`: Dhanteras 10-27, Choti 10-28, Diwali 10-29, Govardhan 10-30, Bhai Dooj 10-31. 2028 `10-15..10-19`: Dhanteras 10-15, Choti 10-16, Diwali 10-17, Govardhan 10-18, Bhai Dooj 10-19.
- Chhath 2026 `11-13..11-16`: 11-13/14/15/16. 2027 `11-02..11-05`: 11-02/03/04/05. 2028 `10-21..10-24`: 10-21/22/23/24.
- Holi 2026 `03-03|03-04`: Holika Dahan 03-03, Holi 03-04. 2027 `03-21|03-22`. 2028 `03-10|03-11`.
- Chaitra Navratri: 2026 `03-19..03-27`, 2027 `04-07..04-15`, 2028 `03-27..04-04`.
- Sharad Navratri: 2026 `10-11..10-19`, 2027 `09-30..10-08`, 2028 `09-19..09-27`.
- Onam: 2026 `08-17..08-26`, 2027 `09-03..09-12`, 2028 `08-23..09-01`.
- Ganesh Chaturthi: 2026 `09-14..09-25`, 2027 `09-04..09-15`, 2028 `08-23..09-03`.
- Durga Puja: 2026 `10-17..10-19`, 2027 `10-06..10-08`, 2028 `09-25..09-27`.
- Ramadan: 2026 `02-18..03-19`, 2027 `02-08..03-08`, 2028 `01-28..02-25`.
- Pongal (Hindu `annual`, `01-14..01-17`): Bhogi 01-14, Thai 01-15, Mattu 01-16, Kaanum 01-17.

- [x] **Step 1: Write the failing data check**

`split-data-check.cjs` loads `js/holidays.js` standalone (`vm.runInThisContext(req('utf8').slice(src.indexOf('const FESTIVALS')))`), then asserts for every year 2026-2028: every parent carrying `obs` has each obs date `>= s && <= e` (string compare on MM-DD after same-year range check), every obs name in the parent's mapping set, exactly the mapping count of obs entries, Pongal annual has the 4 fixed obs, and no parent in the Japan/General/UK/Canada/Australia/Germany/France/US groups or FESTIVALS.India has `obs` at all. Fail with a named list of missing/wrong entries.

- [x] **Step 2: Run it, expect FAIL**

Run: `node %TEMP%\opencode\split-data-check.cjs`
Expected: FAIL, first message lists existing parents missing `obs`.

- [x] **Step 3: Add the `obs` arrays**

Edit `js/holidays.js` in place per the tables above; keep line-level style (single-line `{ n: 'Diwali', i: '🪔', s: '11-06', e: '11-11', v: 'Dhanteras to Bhai Dooj', obs: [...] }` wrapped as the file's own formatting dictates). Do not touch other groups.

- [x] **Step 4: Run the check, expect ALL PASS**

Run: `node %TEMP%\opencode\split-data-check.cjs`
Expected: ALL PASS.

- [x] **Step 5: Commit**

```bash
git add js/holidays.js
git commit -m "Split ranges data: named observations for every multi-day festival, 2026-2028"
```

---

### Task 2: Parent/view-event expansion, India union, dedup in `js/app.js`

**Files:**
- Modify: `js/app.js:355-378` (`calFestivals`) and insert `calDisplay` after line 378. `calHolidays` (379) and the renderers stay untouched in this task.
- Test: `%TEMP%\opencode\split-merge-check.cjs`

**Interfaces:**
- Consumes: Task 1's `obs` field via `FESTIVALS`.
- Produces (Task 3 consumes these):
  - `calFestivals(country, year)` -> array of PARENT events `{ name, icon, a, b, days, ev }`, sorted by `a`; `a`/`b` are Dates, `days` as today; `ev` = array of single-day display events `{ name, icon, a, b, days:1, parent:{ name, a, b } }` (the obs, or `[self]` without obs, self excluding `ev`/`parent` fields).
  - `calDisplay(country, year)` -> flat array of all display events from every parent, sorted by `a`.
  - `calHolidays(country, year)` -> UNCHANGED in this task (still expands full parent spans for dots); Task 3 rewrites it onto `calDisplay`.

Union/dedup rules for `India` (verbatim from spec, applied when `gk==='India'`): merge the three group streams before expansion; same-name parents merge to the widest `s..e` with obs merged by date+name; singles with same name+date collapse; a single whose name matches a parent and whose date falls inside the parent range is absorbed (becomes an obs only if that obs date+name is missing); obs date+name appear once. Focused Hindu/Muslim views keep today's `shared=FESTIVALS.India` merge (its annual singles still collapse by name+date); their year-singles were never loaded there, so the absorption rules only bind the India view.

Implementation notes (interface does not determine them): parents with obs skip the day-by-day `span()` merge path; single-day obs are built directly from MM-DD. Keep the existing `put`/`span` path for parents without obs so all non-India behavior is unchanged. Cross-year ends (e<s, Ramadan-style) keep working for both paths.

- [x] **Step 1: Write the failing merge check**

`split-merge-check.cjs` loads `js/holidays.js` via `vm`, then loads `js/app.js` sliced from `function holEaster` (line 348: `calFestivals` calls it, plus its helper `holNth`, and both sit outside the function itself) up to (excluding) `let calSel` (line 380). This region is DOM-free; `vm.runInThisContext`s it. Asserts, for `calFestivals('India',2026)` and `calDisplay('India',2026)`:

- One parent named Diwali with `a: Nov 6` / `b: Nov 11`, `ev` exactly `[Dhanteras 11-06, Choti Diwali 11-07, Diwali 11-08, Govardhan Puja 11-10, Bhai Dooj 11-11]`.
- Chhath parent `11-13..11-16` with 4 obs; no obs on Nov 9 anywhere in `calDisplay` (band-only).
- Display list contains Dhanteras/Choti/Diwali/Govardhan/Bhai Dooj rows AND single-day India rows (Gandhi Jayanti, Dussehra, Karwa Chauth via Hindu union) and NO second Diwali row for 11-08 beyond the obs.
- Jan 2027-style spot: `calDisplay('India',2027)` has Diwali obs `10-27..10-31` and Chhath `11-02..11-05`; 2028 likewise `10-15..10-19` / `10-21..10-24`.
- Focused: `calDisplay('Indian - Hindu',2026)` has exactly one Diwali display row for Nov 8 (the obs; India's year-singles are never loaded into focused views) and `calDisplay('Indian - Muslim',2026)` shows Ramadan Begins/Ends rows and keeps `Eid al-Fitr` `03-20`.
- Unchanged non-India path: `calDisplay('Japan',2026)` length equals `calFestivals('Japan',2026)` length (every parent emits exactly itself; no pinned count) and every Japan display event has `parent:null`; `calHolidays('India',2026)` still contains the Nov 9 Diwali key (dots untouched until Task 3).

- [x] **Step 2: Run it, expect FAIL**

Run: `node %TEMP%\opencode\split-merge-check.cjs`
Expected: FAIL ("ev missing" or "Diwali has no ev").

- [x] **Step 3: Implement `calFestivals` extension and `calDisplay`**

Per the Interfaces block and union rules above. Keep `holEaster`, `holNth`, country regex routing, and the Good Friday / Makar Sankranti manual ones exactly as they are.

Step 3 heading note (ruled at execution): the original heading said "and the `calHolidays` rewrite"; that wording is stale against the corrected Files/Interfaces lines - `calHolidays` stays parent-span-based in this task and is rewritten in Task 3. Cost if wrong: doing it here would drop Nov 9 keys while the grid still requires hol, leaving a visible band gap on main mid-plan.

- [x] **Step 4: Run it, expect ALL PASS**

Run: `node %TEMP%\opencode\split-merge-check.cjs`
Expected: ALL PASS.

- [x] **Step 5: Commit**

```bash
git add js/app.js
git commit -m "Split ranges logic: display events, India union, dedup"
```

---

### Task 3: Grid, selected-date, and list rendering on display events

**Files:**
- Modify: `js/app.js:379-388` (rewrite `calHolidays` at 379 onto `calDisplay`, then its consumers in `renderSel` 383 and `renderCal` 384), `css/style.css:250-253`
- Test: `%TEMP%\opencode\frostline-split-check.cjs` (browser probe, installed Helium, serves the tree on `127.0.0.1:8769`)

**Interfaces:**
- Consumes: Task 2's `calFestivals` (parents, for bands) and `calDisplay` (rows/dots).
- Produces: the rendering behavior the spec's Rendering behavior section pins, verbatim:
  - Rewrite `calHolidays` (379) onto `calDisplay`: keys only where display events land (obs days and single-day parents; multi parents excluded). The `hol` key set in `renderCal` then follows automatically, and band-only days (Nov 9) stop getting `hol`.
  - Grid band/multi class from `calFestivals(...).filter(f=>f.days>1)` regardless of `hol` (current `mf` condition drops `hol&&`).
  - Coming-up list: iterate `calDisplay` instead of `calFestivals`; current month shows the next 5 display events from today onward (`f.b >= t0`), future months the first 5 of that month; `.slice(0,isCurView?3:6)` becomes cap 5 both ways.
  - `renderSel`: display events matching the selected day win; when none match but a parent band covers the day, the row is the parent (`icon name · span`).
  - CSS: bracket `::after` no longer requires `.hol` (line 251 selectors lose `.hol`; line 250's dot suppression on band cells stays later-win); add a rule AFTER line 253: `#cal-grid span.today.multi:not(.open-l)::after,#cal-grid span.today.multi:not(.open-r)::after{display:none}` (ruled at execution: the plain pair loses on specificity to the 1-3-1 bracket rules; this :not mirror is 1-4-1 and wins).

- [x] **Step 1: Write the failing rendering probe**

`frostline-split-check.cjs` opens the served new tab with India preselected, opens the calendar modal, then asserts:

- November 2026 (future month, today Oct 22) grid: the Nov 9 cell carries `multi` but not `hol` and shows no dot; Nov 6 and Nov 11 carry the bracket (computed `::after` border style); Nov 7/8/10 are band cells with keys whose dots the band rule suppresses.
- Coming-up caps at 5: the opening current-month view (October, from today Oct 22 onward) shows exactly 5 rows, Karwa Chauth first then the Diwali obs (Dhanteras, Choti Diwali, Diwali, Govardhan Puja); navigating to November shows exactly 5: Dhanteras, Choti Diwali, Diwali, Govardhan Puja, Bhai Dooj, with the Chhath anchors capped out and no parent-only Diwali row.
- Selecting Nov 9 renders exactly `Diwali · Nov 6-11`; selecting Nov 6 renders `Dhanteras`; selecting Nov 8 renders one row `Diwali` (obs, not the India duplicate).
- October 2026: Gandhi Jayanti, Navratri anchors, Durga Puja anchors, Dussehra, Karwa Chauth rows exist; Sharad Navratri brackets on Oct 11/19 unchanged; band and today suppression intact.
- Japan 2026 renders as many coming-up rows as `calFestivals('Japan',2026)` has parents, checked as data equality (`calDisplay('Japan',2026).length === calFestivals('Japan',2026).length`, since the 5-cap bounds the visible list) and a General group month renders; Japan's eventless month (found data-side; ruled at execution: Feb holds National Foundation + Emperor's Birthday and December gains the auto-added Christmas, so neither is empty) shows the muted empty-list row.
- `#cal-grid span.today.multi:not(.open-l)::after,#cal-grid span.today.multi:not(.open-r)::after{display:none}` exists in `css/style.css` (raw text assertion).
- No page errors (console noise filters as in the existing probes: news CORS, github rate-limits, favicon 404).

- [x] **Step 2: Run it, expect targeted FAILs**

Run: `node %TEMP%\opencode\frostline-split-check.cjs`
Expected: FAIL on Nov 9 band-only, 5-cap, brackets without hol, selected-day context.

- [x] **Step 3: Implement the grid/selection/list changes and the CSS change**

Per the Interfaces block. Band/bracket logic stays inside `renderCal`; no new DOM or CSS class names.

- [x] **Step 4: Run it, expect ALL PASS + screenshots**

Run: `node %TEMP%\opencode\frostline-split-check.cjs`
Expected: ALL PASS. Save `%TEMP%\opencode\frostline-split-nov.png` and `frostline-split-oct.png`.

- [x] **Step 5: Commit**

```bash
git add js/app.js css/style.css
git commit -m "Split ranges rendering: obs rows, band-only days, five-row list, hol-free brackets"
```

---

### Task 4: Cache busters and full verification battery

**Files:**
- Modify: `newtab.html:421-422` (`js/holidays.js?v=2` -> `3`, `js/app.js?v=13` -> `14`)

- [ ] **Step 1: Bump the cache busters** in the script tags.

- [ ] **Step 2: Run the whole battery**

```bash
node --check js/app.js
node --check js/holidays.js
node -e "JSON.parse(require('fs').readFileSync('manifest.json','utf8'));console.log('manifest OK')" (python is absent on this machine; node JSON.parse is the substitute)
git diff --check
node %TEMP%\opencode\split-data-check.cjs
node %TEMP%\opencode\split-merge-check.cjs
node %TEMP%\opencode\frostline-split-check.cjs
```

Expected: all green; probe reports ALL PASS; screenshots from Task 3 are current.

- [ ] **Step 3: Re-read the full diff for runtime errors** (per AGENTS: the diff review is the safety net; also confirm no comment narration/em-dash additions that the gate would dislike).

- [ ] **Step 4: Commit**

```bash
git add newtab.html
git commit -m "Bump calendar cache busters for split ranges"
```

- [ ] **Step 5: Flush session state**

Update `.agent/STATE.md` and `.agent/verification-notes.md` with the harness traps and results learned during execution. Do not commit `.agent/`.
