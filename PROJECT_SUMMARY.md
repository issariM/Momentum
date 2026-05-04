# Momentum — Project Summary

## What it is
A habit tracking PWA (Progressive Web App) that turns daily habits into coins toward real-world rewards. Installable on iPhone/Android from the browser — no app store needed.

## File Structure
```
Projects/Momentum/
├── index.html          # Full UI — all screens, modals, navigation
├── styles.css          # Design system — light/dark mode, responsive layout
├── script.js           # All logic — state, habits, rewards, routing, events
├── sw.js               # Service worker — offline caching
├── manifest.webmanifest # PWA manifest — install metadata
├── icon.svg            # App icon
└── PROJECT_SUMMARY.md  # This file
```

## Tech Stack
- **Pure HTML/CSS/JS** — no framework, no build step
- **PWA** — service worker + manifest = installable on any device
- **localStorage** — local-first, data persists in browser (no backend)
- **Unsplash** — reward images via URL (no upload needed)

## Architecture: State + Render
```
state {}  →  render functions  →  DOM
              ↑ events mutate state + call save() + re-render
```
- `state` object holds all data (habits, rewards, coins, comments, profile)
- `save()` / `load()` sync to `localStorage` key `momentum-v1`
- `renderHabits()`, `renderRewards()`, `updateRewardUI()`, `renderComments()` rebuild DOM on change
- `switchScreen(name)` toggles `.active` class on screens and nav links

## Coin System
- 1 USD = 5 coins (configurable)
- Each habit has a coin value (Easy=10, Medium=25, Hard=50, Very hard=100)
- Completing a habit adds coins to today's total AND primary reward progress
- Reward unlocks when `current >= target` → celebration modal fires

## Screens (sidebar nav + mobile tabbar)
| Screen | Key content |
|---|---|
| `onboarding` | 3-phone mockup, name input, starter habits, reward setup |
| `today` | Hero reward bar, 4 stat cards, habit list |
| `rewards` | Primary detail, all rewards grid, earned history |
| `insights` | Stats, line chart, bar chart, 28-day heatmap |
| `habits` | Full habit directory |
| `tasks` | Task list with status chips |
| `projects` | Multi-tracker project cards |
| `fitness` | Workout log, volume chart, body metrics |
| `sleep` | Sleep score, stages bar, suggestions |
| `pricing` | Free vs Plus comparison |
| `integrations` | 8 integration cards |
| `feedback` | Comment box + comment list |
| `settings` | Appearance, notifications, rewards, privacy, data |

## Responsive Behavior
- **Desktop (>860px):** sidebar + content grid
- **Mobile (≤860px):** sidebar hidden, bottom tabbar shown (5 tabs), single-column layout

## Modals
- `#habitModal` — add/edit habit: name, frequency, target, difficulty (coin value), emoji
- `#rewardModal` — add/edit reward: name, price, currency, emoji → auto-converts to coin target
- `#celebrationModal` — fires when primary reward coins reach target

## Key State Shape
```js
state = {
  primaryRewardId: "sony",
  todayCoins: 42,
  unlocked: false,
  profile: { name: "" },
  rewards: [{ id, name, emoji, price, currency, current, target, eta, img }],
  habits:  [{ id, name, emoji, target, count, coins, streak, difficulty }],
  comments: [{ author, text }]
}
```

## To Deploy (free, no domain needed)
1. **Netlify Drop:** drag the `Momentum/` folder to app.netlify.com/drop → get a `.netlify.app` URL
2. **Vercel:** import folder → deploy → get a `.vercel.app` URL
3. Open the URL on phone → install via Share > Add to Home Screen (iPhone) or browser menu (Android)

## What's NOT built yet (future)
- Backend / cloud sync
- User accounts / auth
- Push notifications
- Real health app integrations (Apple Health, etc.)
- Cross-device data sync
- Payments / subscription enforcement
