# Momentum — Habit Tracker PWA

**Live URL:** https://habittrackerfromclaudecode.netlify.app
**GitHub:** https://github.com/issariM/Momentum
**Deploy:** Push to `main` via GitHub Desktop → Netlify auto-deploys (~1 min)

---

## What it is
A Progressive Web App for habit tracking with a coin-reward motivation system. Complete daily habits → earn coins → unlock real-world rewards from your wishlist.

---

## Install on any device
| Device | How |
|---|---|
| iPhone / iPad | Safari → Share button → Add to Home Screen |
| Mac | Safari → Share button → Add to Dock |
| Android Chrome | Browser menu → Install app (or tap banner) |
| Desktop Chrome / Edge | Install icon in address bar |
| Firefox (any) | Bookmark it — Firefox does not support PWA install |

---

## Features

### Habits
- Add habits with emoji, difficulty, coin reward, and daily target
- Tap to complete (binary) or use +/− counter (quantity-based)
- Streaks tracked per habit

### Rewards / Wishlist
- Add rewards with name, price, and currency
- Coins accumulate toward your primary reward
- Celebrate unlock with confetti animation

### Multi-Currency
Supported: USD ($), THB (฿), EUR (€), GBP (£), JPY (¥), SGD (S$), AUD (A$), CNY (¥)

**Coin conversion — 1 USD = 5 coins base rate:**
| Currency | FX Rate (to USD) | Example |
|---|---|---|
| USD | 1 | $100 → 500 coins |
| THB | 33 | ฿3,300 → 500 coins |
| EUR | 0.93 | €93 → 500 coins |
| GBP | 0.79 | £79 → 500 coins |
| JPY | 149 | ¥14,900 → 500 coins |

Currency set globally in Settings or per-reward when adding/editing.

---

### Sleep Analysis (Multi-Resolution Method)
Based on peer-reviewed sleep research (PSG validation studies, social jet lag literature).

**5 zoom levels — each reveals what the others hide:**
- **Day** — each logged night: duration, efficiency, rating, notes. Best/worst flagged.
- **Week** — bedtime variability (±min), social jet lag, % nights ≥7h
- **Month** — monthly averages + completeness % (warns survivorship bias if < 70%)
- **Quarter** — seasonal patterns; needs ≥45 nights
- **Year** — multi-year trajectory; needs ≥200 same-device nights

**Log each night:**
- Bedtime + wake time → auto-calculates duration and efficiency
- Subjective rating 1–10 (research shows this tracks recovery better than device scores)
- Minutes to fall asleep, times woken up
- Data source: Apple Watch / Fitbit / Garmin / Oura / Phone app / Manual
- Free-text notes (illness, alcohol, travel, stress)

**Auto-insights engine:**
- Bedtime variability warning (> ±45 min)
- Social jet lag alert (weekday vs weekend bedtime shift > 1h)
- Sleep duration below 7h target
- Efficiency below 85% threshold
- Outlier detection: < 3h or > 12h flagged, excluded from averages

**Key research finding:** Bedtime/wake-time *consistency* predicts sleep quality better than total duration. Watch the variability column at every zoom level.

---

### PWA & Offline
- Works fully offline (service worker, cache-first strategy)
- Installable on all platforms with platform-specific install guide modal
- App shortcuts for Today and Rewards screens
- iOS meta tags for full-screen standalone mode

---

## Onboarding
New users see a 3-panel welcome screen:
1. Enter name
2. Pick starter habits (Drink water, Workout, Read, Meditate)
3. Set first reward — choose currency and price

Starts completely clean — no demo data.

---

## File Structure
```
index.html            — all UI markup
script.js             — all app logic (vanilla JS, localStorage)
styles.css            — design system + component styles
sw.js                 — service worker (cache-first, offline fallback)
manifest.webmanifest  — PWA manifest with app shortcuts
icon-192.png          — required for Chrome/Android install prompt
icon-512.png          — required for splash screens
icon.svg              — vector icon (any size)
PROJECT_SUMMARY.md    — this file
```

## Data Storage
All data in browser `localStorage` under key `momentum-v1`. No server, no account.

Export via Settings → Export (JSON or CSV).

---

*Last updated: May 5, 2026*
