# Nocturne

**Is tonight worth driving to a dark-sky site — and if not, which night this week?**

Live at **[nocturne.markselvadurai.com](https://nocturne.markselvadurai.com)**

Nocturne is a stargazing planner for Ontario's dark-sky sites. It computes tonight's true-darkness window, moon interference, and cloud cover for seven curated locations, fuses them into a single 0–100 score, and answers the only question that matters before a two-hour drive: *go, or wait for Thursday.*

<!-- SCREENSHOT: tinted map, overlay on — the Golden Horseshoe glow with markers in the dark gaps -->

No ads, no accounts, no login. One screen, one answer.

---

## What it does

Every site marker is tinted with **tonight's score tier** before you click anything — the map answers at a glance. Selecting a site opens the observing panel: a verdict pill, the **Night Strip** (the app's signature element — one bar from civil dusk to civil dawn showing the true-darkness window, moon-up intervals, and hourly cloud cover as layered bands), the numeric readouts behind the score, and a 7-night row of tier-colored dots for the week ahead. Clicking any dot re-derives the entire panel for that night.

A light-pollution overlay (David Lorenz's 2024 atlas) can be toggled over the basemap — the before/after makes the *why* of dark-sky travel visible: the Golden Horseshoe burns, and every curated site sits deliberately in the dark voids north of it.

<!-- SCREENSHOT: panel with strip, a real night -->

## How it works

The architecture is three layers, strictly ordered: **pure engines → a reactive store → derived display state.** Nothing downstream re-computes what upstream owns.

### Engines (`src/app/engines/`)

Pure functions, no Angular, fully unit-tested:

- **`getDarknessWindow(site, date)`** — computes the astronomical-darkness window (sun below −18°) and the civil twilight boundaries (−6°) for the night *starting on* a given date. Because an observing night straddles the calendar boundary, it makes two SunCalc calls — day N for dusk-side events, day N+1 for dawn-side — and converts everything into the site's IANA timezone via Luxon. Returns a discriminated union: nights with no true darkness (high latitudes in summer) are a first-class state, not an error.
- **`getMoonOverlap(site, window: Interval)`** — computes how much of *any* window the moon is up for, via a state-machine walk: query the moon's altitude at window start, collect rise/set events inside the window, sweep them in order flipping an up/down state, accumulating up-time and emitting the up-intervals as `segments`. Taking the window as a parameter (rather than computing darkness internally) lets the scorer ask about the astronomical window while the Night Strip asks about the wider civil window — same engine, different questions.
- **`avgCloudDuring(forecast, window)`** — averages hourly cloud cover across a window, reporting a coverage fraction so partial data is distinguishable from complete data.
- **`computeScore(...)`** — the fusion. See below.

### Weather store (`WeatherService`)

Open-Meteo hourly cloud cover (8 forecast days — night 7's dawn needs day 8's hours), cached per-site in `localStorage` with a 3-hour TTL and a **stale-while-revalidate** load: cached data renders immediately, a background fetch replaces it when fresh data lands. The store holds a `Map<siteId, Forecast>` in an Angular signal; every consumer that reads it re-derives automatically when a forecast arrives. Corrupt cache entries are detected on parse and evicted.

The visible consequence: on a cold cache, the app opens **astronomy-only** — scores render immediately from sun/moon math with an explicit caveat — and upgrades live, site by site, as forecasts land. Under network throttling you can watch the map's rings solidify one at a time. Offline at a field site, the last cached forecast still serves.

<!-- SCREENSHOT PAIR: loading transition — caveated pill → settled pill -->

### Derived state (`SitesService`)

Angular signals end-to-end; every piece of display data is a `computed` deriving from three roots: the site list, the selected site, and the selected night.

- **`nightInfo`** — the selected site + night, fully derived: windows, moon segments, cloud hours, score, tier, formatted display strings. The panel and strip render it directly.
- **`tonightScores`** — a `Map<siteId, score>` fan-out across all seven sites for *tonight* (markers always mean tonight, deliberately, even while the panel shows another night).
- **`weekScores` / `bestNight`** — seven nights of scores for the selected site, and the winner (ties resolve to the earlier night: forecast certainty decays with distance).

Selecting a night is one signal write; the entire panel — strip geometry, readouts, pill — re-derives with zero additional wiring.

## The scoring model

```
score = 100 × f(darkness) × g(moon) × h(clouds)
```

- **f — darkness duration**: a clamped ramp. Nights below 3h of true darkness are floored hard; 7h+ saturates. A short window isn't proportionally bad — it's disqualifying — so the ramp has a floor of 0.85 at the minimum rather than sliding to zero.
- **g — moon penalty**: `1 − 0.7 × overlap × illumination`. A full moon up all night costs 70% of the score, never 100% — bright targets (planets, doubles, the moon itself) survive moonlight, so the floor is 0.3.
- **h — cloud penalty**: `(1 − cover/100)^1.25`. The exponent makes mid-range cloud hurt more than linearly — 50% cloud is much worse than half a clear night. 100% cloud is a hard gate: score 0 regardless of everything else.
- If no forecast is available, the score is `100 × f × g`, flagged — the UI renders it in a muted caveat style reading "astronomy only" rather than hiding a working degraded mode.

**Calibration honesty:** the darkness ramp and the two penalty exponents are reasoned estimates, not fitted parameters. The cloud exponent especially (`k = 1.25`) is a field-calibration candidate — the plan is to observe real nights against their scores and adjust from measurement. Until then the README says so instead of pretending.

Tier thresholds: **≥65 clear · 35–64 marginal · <35 poor**, shared by the pill, markers, and dots from one function.

## Decision log

A curated sample of the engineering decisions this project turned on — the full reasoning lives in commit history.

1. **Windows as parameters, not internal computations.** `getMoonOverlap` originally computed its own darkness window. Refactored to take an `Interval` — which made the moon suite independent of the darkness engine (tests author synthetic windows), and enabled the strip's civil-axis rendering (score against the astro window, draw against the civil one) with the same function.
2. **Discriminated unions where impossibility is real; flat types where it isn't.** `DarknessWindow` and `NightInfo` are unions because darkless nights genuinely exist. `MoonOverlap` and the scorer's return *were* unions and got collapsed — once the caller gates on darkness, no unscoreable input can reach them, and a union defending against an unrepresentable state is ceremony.
3. **The UTC day-seam bug.** Every date built in the evening carries *tomorrow's* UTC day; somewhere in the SunCalc chain the UTC day won, so every 7-night dot derived the next day's night. Every test passed — all test dates were authored at noon. Fix: anchor derived dates to local noon (`setHours(12,0,0,0)`), pinning day-identity. Lesson: test data that avoids the hostile region proves nothing about it.
4. **Civil axis for the Night Strip.** The strip spans civil dusk→dawn rather than the darkness window itself, so the twilight "shoulders" are real data (the −6°→−18° descent) and a darkless night still has an axis to draw. Cost: the strip shows cloud/moon data outside the scored region — deliberate, commented.
5. **Score-tinted markers with honest choreography.** Astronomy is synchronous, so markers tint *immediately* from astronomy-only scores with a dashed ring, solidifying as forecasts land — loading and fetch-failure share one rendering on purpose, because the user's question ("trust this score?") depends on what's known, not why.
6. **Red is selection, never a score.** The palette's red-shift accent is reserved for selection/brand; a fourth tier color (`--poor`, desaturated brick) exists specifically so a selected poor-night marker isn't ambiguous.
7. **`localStorage` serialization is a designed boundary.** Luxon DateTimes serialize to ISO strings with offsets and re-parse with `setZone: true`; a typed `StoredForecast` shape and a poison-entry eviction path make the cache corruption-safe.
8. **Ties go to the earlier night.** `bestNight` uses strict `>` — two 82s resolve to the sooner one, because forecast certainty decays and plans prefer sooner. (v1.1 note: surface clear-band ties as a list — two-night trips are real.)
9. **Reverse-engineering the overlay tiles.** The light-pollution tile source is an undocumented personal site that restructured mid-build. Every working parameter — path, 1024px tile size, zoom offset, pyramid ceiling — was transcribed from the author's own viewer via the Network tab rather than guessed. The full-resolution 2024 atlas is archived locally as the self-hosting exit if the source moves again.
10. **Third-party DOM styles live where the DOM lives.** Leaflet renders markers outside Angular's view encapsulation; marker styling uses `:host ::ng-deep` deliberately, with the tradeoff documented, rather than scattering global styles.

## States

The app has three non-happy states, all first-class:

| State | Behavior |
|---|---|
| **Loading** (cold cache) | Instant astronomy-only render with caveat pill + dashed rings; upgrades live as forecasts land |
| **Degraded** (fetch failed / no data) | Same rendering as loading, but stable — the app keeps answering on what it has |
| **No true darkness** | Explicit "no astronomical darkness tonight" panel state; hollow dashed markers and dots |

<!-- SCREENSHOTS: the six audit frames, captioned -->

## Stack

Angular 21 (signals-first, standalone components) · TypeScript · Leaflet + CARTO dark basemap · SunCalc · Luxon · Open-Meteo · Vitest · deployed on Cloudflare Pages.

```bash
npm install
npm start        # dev server
npm test         # engine suites
```

## What's deliberately not here (v1)

Search, arbitrary-point Bortle estimation, accounts, saved sites, routing, drag-physics on the mobile sheet, and global site coverage (the architecture is ready — IANA timezones and a global weather model — but curation standards matter more than site count; internationals land post-v1).