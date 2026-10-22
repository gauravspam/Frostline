# India Calendar Split Ranges Design

**Date:** 2026-10-22
**Status:** Approved in chat; awaiting written-spec review
**Scope:** Frostline calendar data and rendering

## Context

The India calendar currently lists Diwali as a single public holiday on Nov 8, while the
Indian - Hindu calendar lists Diwali as one Nov 6-11 range. The range is correct as a
festival period, but the row label makes Nov 6 look like the main Diwali date.

The user wants the multi-day festivals split into their named observances for list rows and
selected-date details, while keeping one continuous band across the whole festival range.
The India calendar must also become the combined view of the India, Indian - Hindu, and
Indian - Muslim calendars.

## Goal

- Split multi-day festivals into named observances and explicit start/end anchors.
- Keep the band, rounded row ends, and start/end brackets tied to the full parent range.
- Make India the combined calendar containing all three India-related calendars.
- Keep Indian - Hindu and Indian - Muslim available as focused calendars.
- Preserve the current dark-glass visual language and the 35% bracket opacity.

## Non-goals

- No new permissions, remote calls, APIs, or dependencies.
- No visual redesign beyond the existing calendar band and list rows.
- No changes to non-India country calendars.
- No unrelated changes to the earlier Only Video work.
- No correction of existing festival date ranges unless needed to place named days inside
  the already-approved range.

## Data model

Each multi-day festival keeps one parent range plus an optional `obs` array:

```js
{
  n: 'Diwali',
  i: '🪔',
  s: '11-06',
  e: '11-11',
  v: 'Dhanteras to Bhai Dooj',
  obs: [
    { d: '11-06', n: 'Dhanteras' },
    { d: '11-07', n: 'Choti Diwali' },
    { d: '11-08', n: 'Diwali' },
    { d: '11-10', n: 'Govardhan Puja' },
    { d: '11-11', n: 'Bhai Dooj' }
  ]
}
```

Rules:

- `s` and `e` remain the inclusive parent range and always drive the band.
- `obs` entries are single-day rows. They inherit the parent icon unless an `i` is present.
- A parent with `obs` does not also render its parent row in the holiday list.
- A parent without `obs` keeps the current single range row behavior.
- Observation dates are explicit per year, not generated from day offsets. This handles
  years such as 2026 where Govardhan Puja skips Nov 9.
- A day inside a parent band with no observation remains band-only and has no row or dot.
- The parent range name and dates remain available as context for band-only days.

## Split mapping

| Parent | Named days / anchors |
| --- | --- |
| Diwali | Dhanteras; Choti Diwali; Diwali; Govardhan Puja; Bhai Dooj |
| Chhath Puja | Nahay Khay; Kharna; Sandhya Arghya; Usha Arghya |
| Holi | Holika Dahan; Holi |
| Pongal | Bhogi Pongal; Thai Pongal; Mattu Pongal; Kaanum Pongal |
| Chaitra Navratri | Chaitra Navratri begins; Chaitra Navratri ends |
| Sharad Navratri | Sharad Navratri begins; Sharad Navratri ends |
| Onam | Atham; Thiruvonam |
| Ganesh Chaturthi | Ganesh Chaturthi; Anant Chaturdashi |
| Durga Puja | Durga Puja begins; Durga Puja ends |
| Ramadan | Ramadan begins; Ramadan ends |

Diwali 2026 is the reference example:

- Nov 6: Dhanteras
- Nov 7: Choti Diwali
- Nov 8: Diwali
- Nov 9: band-only, no row
- Nov 10: Govardhan Puja
- Nov 11: Bhai Dooj

The band still runs Nov 6-11 with brackets at Nov 6 and Nov 11.

## India union

`calFestivals('India', year)` merges these groups at render time:

- `FESTIVALS.India`
- `FESTIVALS['Indian - Hindu']`
- `FESTIVALS['Indian - Muslim']`

Deduplication rules:

- Parent festivals with the same name merge into one parent. The merged range is the widest
  start/end span, and `obs` arrays merge by date + name.
- Single-day festivals with the same name and date collapse to one row.
- A single-day entry that shares a name with a parent and falls inside its range becomes an
  observation if that observation does not already exist. This prevents a second Diwali row
  when India's public-holiday Diwali overlaps the Hindu Diwali range.
- An observation with the same date and name appears once.
- If a merged parent has observations, the parent row is hidden as usual.

The specialized calendars keep their current behavior, including shared India public
holidays. India is additive and becomes the complete combined view.

## Rendering behavior

### Calendar grid

- Bands come from parent ranges, not from observation rows.
- A band cell gets `multi` even when that day has no named observation.
- Dots come from display events only. Single-day festivals keep dots; multi-day band days
  remain dot-free.
- Start/end brackets remain on the true start and end of the parent range, at 35% accent.
- Bracket CSS must no longer require the `hol` class, because a band boundary can be a
  band-only day. Today's filled circle continues to suppress its own bracket.
- Existing overlap behavior is unchanged: one band is shown when ranges overlap.

### Selected date

- Dates with observations show those observation names.
- Dates inside a band with no observation show the parent range as context, for example
  "Diwali · Nov 6-11".
- Existing selected-date outline and detail panel behavior remain.

### Holiday list

- Rows are display events: named observations when present, otherwise the parent range.
- The current-month "Coming up" list shows the next five events from today onward.
- Future-month lists show the first five events in that month.
- Row text stays the existing `icon + name` and `date · relative time` format.
- Modal scrolling handles any additional height. No new panel or collapsible UI is added.

## Files

- `js/holidays.js`: add `obs` arrays for every multi-day festival in 2026, 2027, 2028 and
  the annual Pongal entry.
- `js/app.js`: add parent/observation expansion, band helper, India union, deduplication,
  band-only grid cells, selected-day parent fallback, and five-row list cap.
- `css/style.css`: adjust bracket selectors so boundaries work without a dot/`hol` class.
- `newtab.html`: bump `js/app.js` and `js/holidays.js` cache-busters.

## Verification

Static:

- `node --check js/app.js`
- `node --check js/holidays.js`
- `python -m json.tool manifest.json`
- `git diff --check`

Browser (installed Helium, India selected):

- November 2026: Dhanteras, Choti Diwali, Diwali, Govardhan Puja, Bhai Dooj rows; one
  continuous Nov 6-11 band; Nov 9 shows parent context; Chhath shows four rows and a
  Nov 13-16 band; no duplicate Diwali row.
- October 2026: India includes Gandhi Jayanti, Navratri anchors, Durga Puja anchors,
  Dussehra, and Karwa Chauth; bands and brackets still render.
- "Coming up" shows at most five rows.
- Single-day festivals keep dots; band days do not.
- Indian - Hindu and Indian - Muslim still render their focused calendars.
- 2027 and 2028 spot checks confirm the split observations fall inside their parent bands.
- No page errors.

## Assumptions

- "Show next five" means five rows for both current and future months.
- The parent range remains the source of truth for the band, even when observations do not
  cover every day in the range.
- Existing festival dates and names are retained except for the new observation labels.
- The existing 35% bracket treatment is final.
