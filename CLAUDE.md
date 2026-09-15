# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Currency Radar is a **Manifest V3 Chrome extension** that tracks EUR/BRL and USD/BRL exchange rates. It fetches live market rates and 6-month PTAX historical data, then runs a statistical analysis to suggest whether the current rate is a good buying opportunity.

There is no build step, no bundler, no test framework, and no linter configured. The extension uses native ES modules loaded directly by the browser.

## Loading the extension

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select this directory

After any JS/HTML/CSS change, click the reload icon on the extension card in `chrome://extensions`.

## Architecture

### Data sources (two separate APIs)

- **Live rates** — `services/currentRates.js` hits `economia.awesomeapi.com.br`. Returns `ask` (used when buying foreign currency with BRL) and `bid` (used when selling foreign currency back to BRL), plus today's `pctChange`.
- **Historical PTAX** — `services/exchangeRate.js` hits `api.frankfurter.dev/v2` with `providers=BCB`, fetching ~6 months of daily closing rates.
- **Market consensus** — `services/focus.js` hits the BCB Focus survey (`olinda.bcb.gov.br`, OData), the central bank's weekly poll of ~100 institutions. Cached 12h in `chrome.storage.local`; the survey only publishes weekly.

All three send permissive CORS (the BCB reflects the requesting origin), so **no `host_permissions` are needed** — a plain `fetch` from the popup works. A `HEAD` to the BCB returns 403; that is the method, not the origin.

### Analysis pipeline (`services/analysis.js`)

Called in sequence inside `loadCurrency()` in `popup.js`:

1. `calculateStatistics(history)` — computes mean, min, max, median, and percentiles P10/P25/P50/P75/P90 over the sorted historical rates.
2. `calculateTrend(history)` — computes 7-day and 30-day changes against the most recent PTAX entry; classifies direction as `"up"`, `"down"`, or `"stable"` with a ±0.15% neutral threshold.
3. `analyzeOpportunity(currentRate, statistics)` — maps the current rate to a percentile in the historical distribution; returns a score and a plain-language `message`.
4. `analyzeRadar(currentRate, statistics, trend)` — combines historical zone (quartile bands) with trend direction into a combined icon + message.
5. `analyzeDecision(currentRate, statistics, trend, todayChange)` — **engine 1**: final suggested action (BOA HORA PARA COMPRAR / MOMENTO FAVORÁVEL / AGUARDA UM POUCO / PREÇO ALTO — ESPERA / PREÇO MUITO ALTO) driven primarily by the historical percentile zone.
6. `calculateForecast(history, daysAhead = 30)` — **engine 2**: least-squares regression over two windows (60 and 15 observations), projected `daysAhead` forward. Returns `null` below 10 observations. `direction` is one of `down` / `up` / `stable` / `turning`.
7. `combineEngines(decision, forecast)` — cross-checks both engines and returns the verdict shown to the user (`agreement`: buy / wait / mixed / neutral / unknown).
8. `calculateRanges(history)` — lowest and highest rate over 1 month and over 6 months, for the stats row. The 1-month cut is **by real date, not by row count**: PTAX has only trading days, so "the last 30 rows" would span nearly seven calendar weeks.

**Why the two engines are separate:** engine 1 answers "is the price low *relative to history*", engine 2 answers "which way is it *heading*". They can disagree (cheap but rising), and that disagreement is itself the signal — it is surfaced rather than averaged away.

#### Engine 2 guardrails — do not loosen without re-measuring

Forecasting FX direction from price history alone is near the limit of what the data supports. Every guard below was added after measuring a specific failure; the numbers are calibrated, not guessed. Real EUR/BRL over 6 months fits a line with R² ≈ 0.28 — the honest answer for real data is usually "no trend", and the code is built to say so.

- **`MIN_R2 = 0.55`, `NEUTRAL_THRESHOLD = 1.5`.** Benchmarked against random walks (series with no trend by construction, the closest synthetic analogue to real FX). At the original 0.35 / 0.8% the engine asserted a direction on **97 of 300** random walks — 32% pure invention. At 0.55 / 1.5% that falls to 19% while genuine trend detection stays at 117/120. Tightening further (2.5%) drops real detection to 68% and is not worth it.
- **Only the long window asserts direction.** The short window exists *solely* to contradict the long one. Letting it decide when the long window is undecided was tried and produced false directions on **666 of 1008** lateral series: 15 points of a sine wave are locally a straight line with high R², so oscillation reads as trend.
- **`turning`** fires when the two windows disagree. A single line fitted across a bend stays hostage to the pre-bend data: on a measured reversal the 60-day line took 35 days to notice, and asserted the *old* direction with high confidence for the first 15.
- **`MAX_DEVIATION = 3.5` (structural break).** `fitLine` reports how far the newest price sits from the line, in standard errors of the residuals. Past 3.5 the line describes a regime that has ended, and direction is forced to `turning`. Without it, the day after a 5% single-day crash the engine still said "tende a subir" — the crash is the most informative point in the series but regression treats it as 1 of 60, so the verdict hedged exactly when engine 1 was clear. Measured: deviation is 7.2 on the break day and 4.0 three days later, while normal series average 1.3 and the worst random walk reached 3.21. This is what cut the confidently-wrong window from 8 days to **1**, at zero false breaks across 1428 normal series.
- **`SHORT_WINDOW` must stay ≥ 15.** Below that it starts calling direction on pure lateral noise — the exact failure the R² gate exists to prevent.

**Reaction speeds are intentionally different** — each layer answers a different question, and a slow answer is not a stale one:

| Layer | Reacts in | Question |
|---|---|---|
| `background.js` alerts | 30 minutes | did it hit my target / crash? |
| Engine 1 | same day | is it cheap *right now*? |
| Engine 2 | weeks | is there a *sustained* trend? |
| Focus consensus | weekly | where do analysts think it goes? |

Engine 1 re-ranks the live rate against the 6-month distribution on every popup open, so a crash flips it to BUY the next day. Engine 2 is slow by construction — a trend cannot be established from one day — and the break detector is what stops that slowness from turning into a wrong answer.

**Measured value of engine 2, so nobody oversells it later.** Backtested over 3 years of real PTAX: it stays silent ("sem tendência clara") on **68% of days for EUR and 65% for USD**, and of the 8 occasions it committed to a direction on EUR it was right **5 times**. On that sample size that is not distinguishable from chance. Its worth is defensive — refusing to falsely confirm engine 1, and flagging structural breaks — not predictive. Price history does not forecast FX; do not add UI that implies otherwise.

### Focus consensus (`services/focus.js`)

Displayed as its own block, deliberately **outside** `combineEngines`: the Focus horizon is months out while both engines speak about now, so mixing them would blur two different questions. It is supplementary — every failure path returns `null` and the block simply hides.

**USD only. Do not add a euro figure.** Focus polls exactly these indicators — IPCA (and its sub-indices), `Câmbio`, IGP-M, Taxa de desocupação — and `Câmbio` is USD/BRL. There is no euro in the survey, and no free official substitute: the ECB's Survey of Professional Forecasters covers inflation, GDP and unemployment, not FX, and the ECB publishes EUR/BRL only as historical reference rates. A derived euro figure (`EUR/BRL = cross × USD/BRL_focus`) was built and then removed: it assumes EUR/USD frozen, and needed a paragraph of on-screen caveat to avoid reading as a Banco Central forecast. `projectFromFocus` returns `null` for anything but USD, and the block simply does not render on the euro tab.

**The text is present-tense advice, not a future number.** The user's horizon is "the opportunity could be tomorrow", so the headline reads "Esperar tende a sair mais caro", with the projected rate demoted to supporting detail. `HORIZON_MONTHS = 3` because the consensus is flat across horizons anyway (in Sep 2026 the median was 5.20 for every month from Oct/26 to Mar/27) — the horizon changes only how remote the number feels, and 3 months is where the most institutions respond.

**UI consequence:** when `direction` is `stable` (or the forecast is `null`), `popup.js` hides the whole engine-2 card *and* the combined verdict, and engine 1 takes the full row. Stable is the answer on most days, and in that case the verdict only restated engine 1 — the user asked for it to disappear rather than repeat "sem tendência clara" every day. When `turning`, the card stays but the projected number is hidden. A figure the model does not trust invites acting on it. Note also that "confiança alta" describes confidence *in the direction* — never print it next to "sem tendência clara", which says there is no direction to be confident about.

### UI (popup.js + popup.html)

- Two views share the same `<main>`: `#radar-view` and `#calculator-view` (toggled via `hidden`).
- Three tabs in `<nav class="tabs">`: EUR radar, USD radar, and calculator.
- The calculator module (`services/calculator/calculator.js`) is **lazy-loaded** via a dynamic `import()` the first time the calculator tab is opened.
- `selectedCurrency` is a module-level variable in `popup.js`; switching tabs re-runs the full data fetch.

### Calculator tab

The calculator has two components rendered in the same card:

1. **Historical chart** — Canvas drawn via the 2D API (no library). Shows EUR/BRL or USD/BRL rate history fetched from the same Frankfurter/BCB source as the Radar, with period selector (1M/3M/6M), gradient fill, green dashed line for the current market ask rate, and a hover crosshair with tooltip. History per pair is cached in-memory for the duration of the popup session.

2. **Converter** — Converts between BRL and EUR or USD. The `from`/`to` buttons toggle the foreign currency between EUR and USD; the swap button (↔) flips the direction. Uses `ask` when buying foreign currency with BRL and `bid` for the reverse.

### background.js

Price-alert service worker. `chrome.alarms` fires `checkAlerts()` every 30 minutes; `chrome.runtime.onStartup` re-runs it so a window missed while the machine was off is caught at next launch; the popup's "Verificar agora" button triggers it on demand via `chrome.runtime.sendMessage({ type: "checkNow" })`.

Four alert tiers, all opening `alert.html` in a new tab (a full-page CSS flash plus a Web Audio chime — `chrome.notifications` was abandoned because its `iconUrl` silently rejects SVG):

- **hit** — rate reached the target
- **abrupt** — rate fell R$ 0.10 or more below target (urgent 5-note chime)
- **proximity** — rate within R$ 0.03 above target, at most once per 6-hour cooldown
- **drop** — fell `DROP_PERCENT` (−1.0%) or more today, *regardless of the target*, once per 20h

Every alert fires only on the way **down**; the user buys foreign currency and has no interest in being told it got more expensive.

**Suggested target (`suggestAlertTarget`) is a flat 1% below the live rate — do not "improve" it into a percentile.** The alert only helps if it is armed before the opportunity, but the form used to demand the user invent a number. Two percentile rules were built, backtested over 4 years of PTAX, and thrown away:

| Rule | Hit in 30d (EUR/USD) | Discount |
|---|---|---|
| P25 of 6 months | 48% / 60% | 2.27% avg, but often **below the current month's low** |
| P10 of 1 month | 60% / 69% | 1.40% avg, **min −1.55%** — inverted |
| **today − 1%** | **67% / 70%** | **exactly 1%, always** |

Percentiles degenerate at the edges: P10-of-month collapsed to a 0.3% discount when the price already sat near the month's low, and its worst case produced a target *above* the current rate — meaningless for a downward-only alert. A flat discount can neither invert nor degenerate. 1.5% was tested and drops the hit rate to 56%/59%.

The label states what the number *is* ("1% abaixo de hoje"), never what it will do. An earlier "preço entra na faixa de boa compra" read as a promise, and the user pushed back on exactly that.

The first three are all target-relative, which left a blind spot: someone who sets an aggressive target (5.50 with the euro at 5.94) gets nothing when the rate drops hard to 5.70 — a move worth seeing, but neither at the target nor within its margin. The **drop** tier closes that. −1.0% was measured over 3 years of PTAX: it fires ~0.9×/month on EUR and ~1.2×/month on USD. −0.8% roughly doubles that; −1.5% would stay silent for whole quarters.

## Key constraints

- The popup uses `type="module"` on its `<script>` tag, so all imports must be relative paths.
- The calculator module is at `services/calculator/calculator.js`. Its imports are `"../currentRates.js"` and `"../exchangeRate.js"` (one level up within `services/`). The dynamic import in `popup.js` is `"./services/calculator/calculator.js"`.
- Rates are always quoted as `X/BRL` (foreign currency per 1 BRL would be inverted; here 1 EUR = ~6 BRL means `rate ≈ 6`).
- `"storage"` holds alert state under the `alerts` key, shaped `{ [currency]: { active, targetPrice, createdAt, triggeredAt?, triggeredRate?, proximityNotifiedAt?, proximityRate? } }`. `"alarms"` drives the 30-minute check.
- The radar deliberately shows **no percentile figures** (P10/P25/…), and no mean or median. They still drive the decision internally, but the user asked for plain language on screen — keep raw statistics out of the UI. The stats row shows lowest/highest over 1 month and 6 months, which is what the user actually reads.
