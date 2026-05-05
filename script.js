const STORAGE_KEY  = "momentum-v1";
const STARTED_KEY  = "momentum-started-v1";
const ACCOUNTS_KEY = "momentum-accounts-v1";
const SESSION_KEY  = "momentum-session-v1";

function isInstalledPWA() {
  return window.matchMedia("(display-mode: standalone)").matches || !!navigator.standalone;
}

// ── Local account auth ──
function loadAccounts() {
  try { return JSON.parse(localStorage.getItem(ACCOUNTS_KEY)) || []; } catch { return []; }
}
function saveAccounts(a) { localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(a)); }

async function hashPwd(pwd) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pwd));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function getSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch { return null; }
}
function setSession(data) { localStorage.setItem(SESSION_KEY, JSON.stringify(data)); }
function clearSession()   { localStorage.removeItem(SESSION_KEY); }

function showAuthError(id, msg) {
  const el = document.querySelector(`#${id}`);
  if (!el) return;
  el.textContent = msg;
  el.hidden = false;
}
function clearAuthError(id) {
  const el = document.querySelector(`#${id}`);
  if (el) el.hidden = true;
}

// Exchange rates: how many units of each currency = 1 USD
// 1 USD = 5 coins, so coins = price / rate * 5
const FX = {
  USD: { rate: 1,    symbol: "$",  name: "US Dollar"        },
  THB: { rate: 33,   symbol: "฿",  name: "Thai Baht"        },
  EUR: { rate: 0.93, symbol: "€",  name: "Euro"             },
  GBP: { rate: 0.79, symbol: "£",  name: "British Pound"    },
  JPY: { rate: 149,  symbol: "¥",  name: "Japanese Yen"     },
  SGD: { rate: 1.35, symbol: "S$", name: "Singapore Dollar" },
  AUD: { rate: 1.55, symbol: "A$", name: "Australian Dollar"},
  CNY: { rate: 7.25, symbol: "¥",  name: "Chinese Yuan"     },
};

const defaultState = {
  primaryRewardId: null,
  currency: "USD",
  todayCoins: 0,
  unlocked: false,
  profile: { name: "" },
  comments: [],
  rewards: [],
  habits: [],
  sleep: []
};

let state = structuredClone(defaultState);
let deferredInstall = null;

function primaryReward() {
  return state.rewards.find(r => r.id === state.primaryRewardId) || state.rewards[0];
}

function coinsFromPrice(price, currency) {
  const rate = FX[currency]?.rate ?? 1;
  return Math.max(1, Math.round(price / rate * 5));
}

function fmtPrice(price, currency) {
  const sym = FX[currency]?.symbol ?? "$";
  return sym + price.toLocaleString();
}

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && typeof saved === "object") {
      Object.assign(state, saved);
      state.habits ||= [];
      state.rewards ||= [];
      state.comments ||= [];
      state.sleep ||= [];
    }
  } catch { localStorage.removeItem(STORAGE_KEY); }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function reset() {
  state = structuredClone(defaultState);
  localStorage.removeItem(STARTED_KEY);
  clearSession();
  save();
  renderAll();
  switchScreen(isInstalledPWA() ? "login" : "install");
}

// ── Theme ──
function applyTheme(mode = localStorage.getItem("momentum-theme") || "dark") {
  const resolved = mode === "system"
    ? (window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    : mode;
  document.documentElement.dataset.theme = resolved;
  document.documentElement.dataset.themeMode = mode;
  localStorage.setItem("momentum-theme", mode);

  const moonPath = '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>';
  const sunPath = '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>';

  document.querySelectorAll("#themeIcon, #headerThemeIcon").forEach(icon => {
    icon.innerHTML = resolved === "dark" ? sunPath : moonPath;
  });
  document.querySelector("#themeLabel").textContent = resolved === "dark" ? "Light mode" : "Dark mode";

  document.querySelectorAll("[data-set-theme]").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.setTheme === mode);
  });
}

function cycleTheme() {
  const cur = document.documentElement.dataset.themeMode || "dark";
  applyTheme(cur === "dark" ? "light" : "dark");
}

// ── Screen routing ──
const PREAUTH_SCREENS = new Set(["install", "login", "signup"]);
function switchScreen(name) {
  document.querySelectorAll(".screen").forEach(s => s.classList.toggle("active", s.id === `screen-${name}`));
  document.querySelectorAll("[data-screen]").forEach(b => b.classList.toggle("active", b.dataset.screen === name));
  document.querySelector(".shell").classList.toggle("hide-sidebar", PREAUTH_SCREENS.has(name));
}

// ── Date ──
function setDate() {
  const now = new Date();
  const fmt = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const el = document.querySelector("#todayDate");
  if (el) el.textContent = fmt;
}

// ── Render habits ──
function renderHabits() {
  ["habitList", "allHabitList"].forEach(id => {
    const el = document.querySelector(`#${id}`);
    if (!el) return;
    el.innerHTML = "";
    state.habits.forEach(habit => {
      const done = habit.count >= habit.target;
      const partial = habit.count > 0 && !done;
      const row = document.createElement("div");
      row.className = `habit-item${done ? " done" : ""}${partial ? " partial" : ""}`;

      const control = habit.target === 1
        ? `<button class="check-btn${done ? " done" : ""}" data-toggle="${habit.id}" aria-label="${done ? "Uncheck" : "Complete"}">
            <svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"/></svg>
           </button>`
        : `<div class="counter" aria-label="${habit.name} count">
            <button data-dec="${habit.id}">−</button>
            <span class="counter-val">${habit.count}</span>
            <button data-inc="${habit.id}">+</button>
           </div>`;

      row.innerHTML = `
        <div class="habit-icon-wrap">${habit.emoji}</div>
        <div>
          <div class="habit-name">${esc(habit.name)}</div>
          <div class="habit-desc">${habit.count}/${habit.target} today · ${esc(habit.streak)}</div>
        </div>
        <div class="habit-actions">
          <span class="chip chip-gold">+${habit.coins} coins</span>
          <button class="btn-text" data-edit-habit="${habit.id}">Edit</button>
          ${control}
        </div>`;
      el.appendChild(row);
    });
  });
  updateCompletion();
}

// ── Render rewards ──
function renderRewards() {
  const grid = document.querySelector("#rewardGrid");
  if (!grid) return;
  grid.innerHTML = "";
  state.rewards.forEach(r => {
    const pct = Math.min(100, Math.round(r.current / r.target * 100));
    const isPrimary = r.id === state.primaryRewardId;
    const card = document.createElement("div");
    card.className = "card reward-card";
    card.innerHTML = `
      <div class="reward-card-img" style="background-image:url('${r.img}')">${r.img ? "" : r.emoji}</div>
      <div class="reward-card-name">${esc(r.name)}</div>
      <div class="reward-card-meta">${fmtPrice(r.price, r.currency)} · ${isPrimary ? "Primary" : r.eta}</div>
      <div class="mini-progress"><div class="mini-progress-fill" style="width:${pct}%"></div></div>
      <div class="reward-card-footer">
        <span style="font-size:12px;color:var(--muted)">${r.current.toLocaleString()} / ${r.target.toLocaleString()} · ${pct}%</span>
        <div class="reward-card-actions">
          ${!isPrimary ? `<button class="btn-text btn-sm" data-make-primary="${r.id}">Set primary</button>` : ""}
          <button class="btn-text btn-sm" data-edit-reward="${r.id}">Edit</button>
        </div>
      </div>`;
    grid.appendChild(card);
  });
}

// ── Update reward UI ──
function updateRewardUI() {
  const r = primaryReward();
  const pct = Math.min(100, Math.round(r.current / r.target * 100));
  const remaining = Math.max(0, r.target - r.current);

  const set = (id, val) => { const el = document.querySelector(id); if (el) el.textContent = val; };
  const setStyle = (id, prop, val) => { const el = document.querySelector(id); if (el) el.style[prop] = val; };

  set("#heroName", r.name);
  set("#heroMeta", `${fmtPrice(r.price, r.currency)} · ${r.current.toLocaleString()} / ${r.target.toLocaleString()} coins`);
  set("#heroCoins", r.current.toLocaleString());
  set("#coinsToGo", remaining.toLocaleString());
  set("#todayCoins", state.todayCoins);
  set("#rewardsName", r.name);
  set("#rewardsMeta", `${fmtPrice(r.price, r.currency)} · estimated unlock in ${r.eta}`);
  set("#rewardsCoins", r.current.toLocaleString());
  set("#rewardsPct", `${pct}% earned`);

  setStyle("#heroProgress", "width", `${pct}%`);
  setStyle("#rewardsProgress", "width", `${pct}%`);

  if (r.img) {
    setStyle("#heroThumb", "backgroundImage", `url('${r.img}')`);
    setStyle("#rewardsThumb", "backgroundImage", `url('${r.img}')`);
  }

  if (r.current >= r.target && !state.unlocked) {
    state.unlocked = true;
    const modal = document.querySelector("#celebrationModal");
    document.querySelector("#celebrationSub").textContent = `You've unlocked ${r.name} through consistent daily habits.`;
    document.querySelector("#celebCoins").textContent = r.current.toLocaleString();
    modal?.showModal();
  }

  renderRewards();
}

function updateCompletion() {
  const ratio = state.habits.reduce((t, h) => t + Math.min(1, h.count / h.target), 0) / Math.max(1, state.habits.length);
  const pct = Math.round(ratio * 100);
  const el = document.querySelector("#todayPct");
  if (el) el.textContent = `${pct}%`;
}

// ── Habit actions ──
function completeHabit(id) {
  const h = state.habits.find(h => h.id === id);
  if (!h || h.count >= h.target) return;
  h.count++;
  state.todayCoins += h.coins;
  primaryReward().current += h.coins;
  state.unlocked = primaryReward().current < primaryReward().target ? false : state.unlocked;
  renderHabits();
  updateRewardUI();
  save();
}

function decrementHabit(id) {
  const h = state.habits.find(h => h.id === id);
  if (!h || h.count <= 0) return;
  h.count--;
  state.todayCoins = Math.max(0, state.todayCoins - h.coins);
  primaryReward().current = Math.max(0, primaryReward().current - h.coins);
  renderHabits();
  updateRewardUI();
  save();
}

function toggleHabit(id) {
  const h = state.habits.find(h => h.id === id);
  if (!h) return;
  if (h.count >= h.target) decrementHabit(id);
  else completeHabit(id);
}

// ── Habit form ──
let selectedDiff = 25;

function openHabitForm(id = "") {
  const h = state.habits.find(h => h.id === id);
  document.querySelector("#habitModalTitle").textContent = h ? "Edit habit" : "New habit";
  document.querySelector("#habitEditId").value = id;
  document.querySelector("#habitName").value = h?.name || "Walk after lunch";
  document.querySelector("#habitTarget").value = h?.target || 1;
  document.querySelector("#habitEmoji").value = h?.emoji || "⭐";
  document.querySelector("#deleteHabit").hidden = !h;
  selectedDiff = h?.coins || 25;
  document.querySelectorAll(".diff-btn").forEach(btn => {
    btn.classList.toggle("sel", Number(btn.dataset.diff) === selectedDiff);
  });
  document.querySelector("#habitModal")?.showModal();
}

function openRewardForm(id = "") {
  const r = state.rewards.find(r => r.id === id);
  document.querySelector("#rewardModalTitle").textContent = r ? "Edit reward" : "New reward";
  document.querySelector("#rewardEditId").value = id;
  document.querySelector("#rewardName").value = r?.name || "New running shoes";
  document.querySelector("#rewardPrice").value = r?.price || 150;
  document.querySelector("#rewardCurrency").value = r?.currency || state.currency || "USD";
  document.querySelector("#rewardEmoji").value = r?.emoji || "🎁";
  document.querySelector("#deleteReward").hidden = !r;
  updateConversion();
  document.querySelector("#rewardModal")?.showModal();
}

function updateConversion() {
  const price = Math.max(0, Number(document.querySelector("#rewardPrice")?.value) || 0);
  const currency = document.querySelector("#rewardCurrency")?.value || state.currency || "USD";
  const coins = coinsFromPrice(price, currency);
  const el = document.querySelector("#conversionVal");
  if (el) el.textContent = `${fmtPrice(price, currency)} = ${coins.toLocaleString()} coins`;
}

// ── Comments ──
function renderComments() {
  const list = document.querySelector("#commentList");
  if (!list) return;
  list.innerHTML = "";
  state.comments.forEach(c => {
    const item = document.createElement("div");
    item.className = "comment-item";
    item.innerHTML = `<div class="comment-author">${esc(c.author)}</div><div class="comment-text">${esc(c.text)}</div>`;
    list.appendChild(item);
  });
}

// ── Heatmap ──
function renderHeatmap() {
  const hm = document.querySelector("#heatmap");
  if (!hm) return;
  hm.innerHTML = "";
  const levels = [2,3,1,4,2,0,3, 3,2,4,4,1,2,0, 1,4,3,2,4,3,2, 4,3,2,4,4,1,3];
  levels.forEach(l => {
    const cell = document.createElement("div");
    cell.className = "hm-cell";
    if (l > 0) cell.dataset.l = l;
    hm.appendChild(cell);
  });
}

// ── Export ──
function exportJson() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  dl(`momentum-backup-${today()}.json`, blob);
}

function exportCsv() {
  const rows = [["type","name","current","target","coins","status"]];
  state.habits.forEach(h => rows.push(["habit", h.name, h.count, h.target, h.coins, h.count >= h.target ? "done" : "open"]));
  state.rewards.forEach(r => rows.push(["reward", r.name, r.current, r.target, "", r.id === state.primaryRewardId ? "primary" : "active"]));
  const csv = rows.map(r => r.map(c => `"${String(c).replaceAll('"','""')}"`).join(",")).join("\n");
  dl(`momentum-export-${today()}.csv`, new Blob([csv], { type: "text/csv" }));
}

function dl(name, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

function today() { return new Date().toISOString().slice(0, 10); }
function esc(t) { return String(t).replace(/[<>&"]/g, c => ({"<":"&lt;",">":"&gt;","&":"&amp;",'"':"&quot;"})[c]); }

// ── Install ──
async function requestInstall() {
  if (deferredInstall) {
    deferredInstall.prompt();
    await deferredInstall.userChoice;
    deferredInstall = null;
    document.querySelector("#installBtn")?.remove();
  }
}

// ── Platform detection ──
function detectPlatform() {
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isAndroid = /Android/.test(ua);
  const isFirefox = /Firefox|FxiOS/.test(ua);
  const isSafari = /Safari/.test(ua) && !/Chrome|CriOS|FxiOS/.test(ua);
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone;

  if (isStandalone) return "installed";
  if (isIOS && isSafari) return "ios-safari";
  if (isIOS) return "ios-other";
  if (isAndroid && isFirefox) return "android-firefox";
  if (isAndroid) return "android-chrome";
  if (isSafari) return "desktop-safari";
  if (isFirefox) return "desktop-firefox";
  return "desktop-chrome";
}

const INSTALL_GUIDE = {
  "ios-safari": {
    title: "Install on iPhone / iPad",
    steps: [
      { n: "1", text: "Tap the <strong>Share ⬆</strong> button at the bottom of Safari" },
      { n: "2", text: "Scroll down and tap <strong>Add to Home Screen</strong>" },
      { n: "3", text: "Tap <strong>Add</strong> in the top-right corner" }
    ],
    note: "Make sure you are using Safari — it's the only browser on iOS that can install web apps."
  },
  "ios-other": {
    title: "Install on iPhone / iPad",
    steps: [
      { n: "!", text: "<strong>Open this page in Safari</strong> — iOS only installs apps from Safari" },
      { n: "2", text: "Tap the <strong>Share ⬆</strong> button at the bottom" },
      { n: "3", text: "Tap <strong>Add to Home Screen</strong>, then <strong>Add</strong>" }
    ],
    note: "Copy the URL, open Safari, paste it, then follow the steps above."
  },
  "android-chrome": {
    title: "Install on Android",
    steps: [
      { n: "1", text: "Tap the <strong>menu ⋮</strong> in the top-right of Chrome" },
      { n: "2", text: "Tap <strong>Add to Home Screen</strong> or <strong>Install app</strong>" },
      { n: "3", text: "Tap <strong>Install</strong> to confirm" }
    ],
    note: "You may also see an install icon ⊕ appear directly in the address bar."
  },
  "android-firefox": {
    title: "Install on Android",
    steps: [
      { n: "1", text: "Tap the <strong>menu ⋮</strong> at the bottom of Firefox" },
      { n: "2", text: "Tap <strong>Install</strong>" },
      { n: "3", text: "Tap <strong>Add</strong> to confirm" }
    ]
  },
  "desktop-safari": {
    title: "Add to your Mac",
    steps: [
      { n: "1", text: "Click <strong>File</strong> in the menu bar" },
      { n: "2", text: "Click <strong>Add to Dock</strong>" },
      { n: "3", text: "Momentum launches like a native app from your Dock" }
    ],
    note: "Requires macOS Sonoma (14) or later with Safari 17+."
  },
  "desktop-firefox": {
    title: "Using Momentum in Firefox",
    steps: [
      { n: "★", text: "Press <strong>Ctrl+D</strong> (Cmd+D on Mac) to bookmark this page for quick access" },
      { n: "→", text: "For a full installed app, open this page in <strong>Chrome or Edge</strong> instead" }
    ],
    note: "Firefox on desktop does not support installing Progressive Web Apps."
  },
  "desktop-chrome": {
    title: "Install on your computer",
    steps: [
      { n: "1", text: "Click the <strong>install icon ⊕</strong> in the address bar (right side)" },
      { n: "or", text: "Click the <strong>menu ⋮</strong> → <strong>Cast, save and share</strong> → <strong>Install page as app</strong>" },
      { n: "3", text: "Click <strong>Install</strong> — Momentum opens like a native app" }
    ]
  },
  "installed": {
    title: "Already installed!",
    steps: [
      { n: "✓", text: "Momentum is installed on your device" },
      { n: "🚀", text: "Find it on your home screen or in your app launcher" }
    ]
  }
};

function showInstallModal() {
  const platform = detectPlatform();
  const guide = INSTALL_GUIDE[platform] || INSTALL_GUIDE["desktop-chrome"];

  document.querySelector("#installGuideTitle").textContent = guide.title;
  document.querySelector("#installGuideSteps").innerHTML = guide.steps.map(s =>
    `<div class="install-step">
      <div class="install-step-n">${s.n}</div>
      <div class="install-step-text">${s.text}</div>
    </div>`
  ).join("");

  const noteEl = document.querySelector("#installGuideNote");
  noteEl.hidden = !guide.note;
  if (guide.note) noteEl.textContent = guide.note;

  const nativeBtn = document.querySelector("#installGuideNativeBtn");
  nativeBtn.hidden = !deferredInstall;

  document.querySelector("#installGuideModal")?.showModal();
}

// ── Starter habit templates ──
const STARTER_TEMPLATES = {
  "Drink water": { id: "water",    emoji: "💧", target: 8, coins: 5,  difficulty: "Easy"   },
  "Workout":     { id: "workout",  emoji: "🏋️", target: 1, coins: 25, difficulty: "Hard"   },
  "Read":        { id: "read",     emoji: "📖", target: 1, coins: 15, difficulty: "Medium" },
  "Meditate":    { id: "meditate", emoji: "🧘", target: 1, coins: 12, difficulty: "Medium" },
};

// ── Start app ──
function startApp() {
  // Name captured at sign-in; nothing to read here

  // Build habits from selected starters
  const selected = document.querySelectorAll(".starter-btn.sel");
  if (selected.length > 0) {
    state.habits = [];
    selected.forEach(btn => {
      const name = btn.querySelector(".starter-name")?.textContent?.trim();
      const tmpl = STARTER_TEMPLATES[name];
      if (tmpl) state.habits.push({ ...tmpl, name, count: 0, streak: "New today" });
    });
  }

  // Build reward from onboarding form
  const rName = document.querySelector("#onboardRewardName")?.value.trim();
  const rPrice = parseFloat(document.querySelector("#onboardRewardPrice")?.value) || 0;
  const rCurrency = document.querySelector("#onboardRewardCurrency")?.value || "USD";
  state.currency = rCurrency;
  if (rName && rPrice > 0) {
    const reward = { id: "r1", name: rName, emoji: "🎯", price: rPrice, currency: rCurrency, current: 0, target: coinsFromPrice(rPrice, rCurrency), eta: "Set by you", img: "" };
    state.rewards = [reward];
    state.primaryRewardId = "r1";
  }

  localStorage.setItem(STARTED_KEY, "1");
  save();
  switchScreen("today");
}

function updateStarterCount() {
  const count = document.querySelectorAll(".starter-btn.sel").length;
  const btn = document.querySelector("[data-starter-continue]");
  if (btn) btn.textContent = `Continue · ${count} selected`;
}

// ════════════════════════════════════════
// SLEEP ANALYSIS
// ════════════════════════════════════════
const SLEEP_TARGET_MIN = 420; // 7 hours
let currentSleepZoom = "day";

function sleepRecs() {
  return (state.sleep || []).slice().sort((a, b) => b.wake_date.localeCompare(a.wake_date));
}

function parseDT(s) { return s ? new Date(s) : null; }

function calcSleepFields(bedtime, wakeTime, latency = 0) {
  const b = parseDT(bedtime), w = parseDT(wakeTime);
  if (!b || !w || w <= b) return null;
  const tib = Math.round((w - b) / 60000);
  const tst = Math.max(0, tib - (latency || 0));
  return { time_in_bed_min: tib, total_sleep_min: tst, sleep_efficiency_pct: tib > 0 ? Math.round(tst / tib * 100) : 0 };
}

function flagSleepRecord(r) {
  const f = [];
  if (r.total_sleep_min < 180 || r.total_sleep_min > 720) f.push("outlier");
  if (r.sleep_efficiency_pct < 50 || r.sleep_efficiency_pct > 99) f.push("outlier");
  return f;
}

function fmtDur(min) {
  if (min == null || isNaN(min)) return "—";
  return `${Math.floor(min / 60)}h ${String(Math.round(min % 60)).padStart(2, "0")}m`;
}

function fmtBedtime(dt) {
  const d = parseDT(dt);
  return d ? d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "—";
}

function meanOf(arr) { return arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null; }
function medianOf(arr) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function sdOf(arr) {
  if (arr.length < 2) return 0;
  const m = meanOf(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length);
}

function bedtimeMins(bedtime) {
  const d = parseDT(bedtime);
  if (!d) return null;
  let m = d.getHours() * 60 + d.getMinutes();
  if (m < 720) m += 1440; // treat early-morning (1am) as 25h for variability calc
  return m;
}

function isoWeek(d) {
  const dt = new Date(+d);
  dt.setHours(0, 0, 0, 0);
  dt.setDate(dt.getDate() + 3 - (dt.getDay() + 6) % 7);
  const w1 = new Date(dt.getFullYear(), 0, 4);
  const wn = 1 + Math.round(((dt - w1) / 86400000 - 3 + (w1.getDay() + 6) % 7) / 7);
  return `${dt.getFullYear()}-W${String(wn).padStart(2, "0")}`;
}

function validSleepRecs(recs) {
  return recs.filter(r => !r.flags?.includes("outlier") && r.total_sleep_min > 0);
}

function sleepStats(recs) {
  const valid = validSleepRecs(recs);
  if (!valid.length) return { n: recs.length, nValid: 0, avgSleep: null, avgEff: null, bedVariability: null, socialJetLag: null, pctGoodSleep: 0, avgRating: null, medianLatency: null };
  const bedMins = valid.map(r => bedtimeMins(r.bedtime)).filter(Boolean);
  const isWeekday = r => { const wd = new Date(r.wake_date + "T12:00").getDay(); return wd >= 1 && wd <= 5; };
  const wdBed = valid.filter(r => isWeekday(r)).map(r => bedtimeMins(r.bedtime)).filter(Boolean);
  const weBed = valid.filter(r => !isWeekday(r)).map(r => bedtimeMins(r.bedtime)).filter(Boolean);
  return {
    n: recs.length,
    nValid: valid.length,
    avgSleep: meanOf(valid.map(r => r.total_sleep_min)),
    avgEff: meanOf(valid.map(r => r.sleep_efficiency_pct)),
    bedVariability: Math.round(sdOf(bedMins)),
    socialJetLag: wdBed.length && weBed.length ? Math.round(Math.abs(meanOf(weBed) - meanOf(wdBed))) : null,
    pctGoodSleep: Math.round(valid.filter(r => r.total_sleep_min >= SLEEP_TARGET_MIN).length / valid.length * 100),
    avgRating: meanOf(valid.map(r => r.subjective_rating).filter(Boolean)),
    medianLatency: medianOf(valid.map(r => r.sleep_latency_min).filter(v => v != null))
  };
}

// ── Insights engine (from PDF Section 7) ──
function getSleepInsights() {
  const recs = sleepRecs();
  if (recs.length < 2) return [];
  const insights = [];
  const recent = recs.slice(0, 14);
  const s = sleepStats(recent);
  if (s.bedVariability > 45)
    insights.push({ type: "warn", text: `Bedtime varies ±${s.bedVariability} min this fortnight — consistency is the #1 evidence-based predictor of sleep quality (stronger than duration).` });
  else if (s.bedVariability <= 20 && s.n >= 5)
    insights.push({ type: "good", text: `Strong bedtime consistency (±${s.bedVariability} min). Research confirms this predicts sleep quality better than duration.` });
  if (s.avgSleep && s.avgSleep < SLEEP_TARGET_MIN - 30)
    insights.push({ type: "warn", text: `Averaging ${fmtDur(Math.round(s.avgSleep))} — ${fmtDur(Math.round(SLEEP_TARGET_MIN - s.avgSleep))} below the 7h target.` });
  if (s.socialJetLag > 60)
    insights.push({ type: "warn", text: `Social jet lag: bedtime shifts ~${Math.round(s.socialJetLag / 6) / 10}h on weekends. This fragments your circadian rhythm.` });
  if (s.avgEff && s.avgEff < 85)
    insights.push({ type: "info", text: `Avg efficiency ${Math.round(s.avgEff)}% (target ≥85%). Possible causes: late caffeine after 2pm, irregular schedule, screen use before bed.` });
  const outliers = recs.filter(r => r.flags?.includes("outlier"));
  if (outliers.length)
    insights.push({ type: "info", text: `${outliers.length} night${outliers.length > 1 ? "s" : ""} flagged as outliers and excluded from averages. Review notes for those dates.` });
  if (!insights.length && s.n >= 7)
    insights.push({ type: "good", text: `${s.n} nights logged. Keep going — you need ≥15 for a reliable monthly average, ≥45 for quarterly.` });
  return insights;
}

// ── Sleep render ──
function renderSleep() {
  renderSleepInsights();
  renderSleepZoom(currentSleepZoom);
}

function renderSleepInsights() {
  const el = document.querySelector("#sleepInsights");
  if (!el) return;
  const ins = getSleepInsights();
  el.innerHTML = ins.map(i => `
    <div class="sleep-insight sleep-insight-${i.type}">
      <span class="si-icon">${i.type === "good" ? "✓" : i.type === "warn" ? "!" : "i"}</span>
      <span>${i.text}</span>
    </div>`).join("");
}

function renderSleepZoom(zoom) {
  currentSleepZoom = zoom;
  document.querySelectorAll(".zoom-tab").forEach(t => t.classList.toggle("active", t.dataset.zoom === zoom));
  const el = document.querySelector("#sleepContent");
  if (!el) return;
  const recs = sleepRecs();
  if (!recs.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">😴</div><div class="empty-title">No sleep logged yet</div><div class="empty-sub">Tap "+ Log sleep" to start. More nights = more meaningful patterns.</div></div>`;
    return;
  }
  if (zoom === "day") el.innerHTML = renderSleepDay(recs);
  else if (zoom === "week") el.innerHTML = renderSleepWeek(recs);
  else if (zoom === "month") el.innerHTML = renderSleepMonth(recs);
  else if (zoom === "quarter") el.innerHTML = renderSleepQuarter(recs);
  else if (zoom === "year") el.innerHTML = renderSleepYear(recs);
}

function statCard(val, lbl, cls = "") {
  return `<div class="sleep-stat"><div class="sleep-stat-val ${cls}">${val}</div><div class="sleep-stat-lbl">${lbl}</div></div>`;
}

function renderSleepDay(recs) {
  const valid = validSleepRecs(recs);
  const bestIds = new Set([...valid].sort((a, b) => (b.subjective_rating || 0) - (a.subjective_rating || 0) || b.total_sleep_min - a.total_sleep_min).slice(0, 3).map(r => r.id));
  const worstIds = new Set([...valid].sort((a, b) => (a.subjective_rating || 10) - (b.subjective_rating || 10) || a.total_sleep_min - b.total_sleep_min).slice(0, 3).map(r => r.id));
  const s = sleepStats(recs.slice(0, 14));
  const rows = recs.slice(0, 21).map(r => {
    const isOut = r.flags?.includes("outlier");
    const cls = isOut ? "sleep-row outlier" : bestIds.has(r.id) ? "sleep-row best" : worstIds.has(r.id) ? "sleep-row worst" : "sleep-row";
    const badge = isOut ? `<span class="sleep-badge badge-out">Outlier</span>` : bestIds.has(r.id) ? `<span class="sleep-badge badge-best">Top</span>` : worstIds.has(r.id) ? `<span class="sleep-badge badge-low">Low</span>` : "";
    const rating = r.subjective_rating ? `<span class="sleep-chip">${r.subjective_rating}/10</span>` : "";
    return `<div class="${cls}" data-edit-sleep="${r.id}">
      <div class="sleep-row-top"><span class="sleep-row-date">${r.wake_date}${badge}</span><span class="sleep-row-times">${fmtBedtime(r.bedtime)} → ${fmtBedtime(r.wake_time)}</span></div>
      <div class="sleep-row-metrics"><span class="sleep-chip">${fmtDur(r.total_sleep_min)}</span><span class="sleep-chip">${r.sleep_efficiency_pct != null ? r.sleep_efficiency_pct + "% eff" : "—"}</span>${rating}</div>
      ${r.notes ? `<div class="sleep-row-notes">${esc(r.notes)}</div>` : ""}
    </div>`;
  }).join("");
  return `<div class="sleep-stat-row">
    ${statCard(fmtDur(Math.round(s.avgSleep || 0)), "Avg duration", s.avgSleep >= SLEEP_TARGET_MIN ? "good" : s.avgSleep ? "warn" : "")}
    ${statCard(s.avgEff ? Math.round(s.avgEff) + "%" : "—", "Avg efficiency", s.avgEff >= 85 ? "good" : s.avgEff ? "warn" : "")}
    ${statCard(s.pctGoodSleep + "%", "Nights ≥ 7h")}
    ${statCard(s.avgRating ? (Math.round(s.avgRating * 10) / 10) + "/10" : "—", "Avg rating")}
  </div><div class="sleep-log">${rows}</div>`;
}

function weekRow(label, s, note = "") {
  const bvCls = s.bedVariability > 45 ? "warn" : s.bedVariability <= 20 ? "good" : "";
  const sjlCls = s.socialJetLag > 60 ? "warn" : "";
  return `<div class="sleep-period-row">
    <div class="sleep-period-label">${label} <span class="sleep-period-n">${s.n} night${s.n !== 1 ? "s" : ""}</span></div>
    ${note ? `<div class="sleep-period-note">${note}</div>` : ""}
    <div class="swg">
      ${statCard(fmtDur(Math.round(s.avgSleep || 0)), "Avg sleep", s.avgSleep >= SLEEP_TARGET_MIN ? "good" : s.avgSleep ? "warn" : "")}
      ${statCard(s.bedVariability != null ? "±" + s.bedVariability + " min" : "—", "Bedtime variability", bvCls)}
      ${statCard(s.socialJetLag != null ? s.socialJetLag + " min" : "—", "Social jet lag", sjlCls)}
      ${statCard(s.pctGoodSleep + "%", "Nights ≥ 7h")}
    </div>
  </div>`;
}

function renderSleepWeek(recs) {
  const weeks = {};
  recs.forEach(r => { const k = isoWeek(new Date(r.wake_date + "T12:00")); (weeks[k] = weeks[k] || []).push(r); });
  const keys = Object.keys(weeks).sort().reverse().slice(0, 12);
  return `<div class="sleep-section-hdr">Weekly <span class="sleep-section-sub">ISO weeks Mon–Sun · Bedtime variability is the #1 predictor of quality</span></div>
    ${keys.map(k => weekRow(k, sleepStats(weeks[k]))).join("")}`;
}

function renderSleepMonth(recs) {
  const months = {};
  recs.forEach(r => { const k = r.wake_date.slice(0, 7); (months[k] = months[k] || []).push(r); });
  const keys = Object.keys(months).sort().reverse().slice(0, 12);
  return `<div class="sleep-section-hdr">Monthly <span class="sleep-section-sub">≥ 15 nights/month for reliable averages</span></div>
    ${keys.map(k => {
      const s = sleepStats(months[k]);
      const label = new Date(k + "-15").toLocaleDateString("en-US", { month: "long", year: "numeric" });
      const daysInMonth = new Date(+k.slice(0, 4), +k.slice(5, 7), 0).getDate();
      const comp = Math.round(s.n / daysInMonth * 100);
      const compNote = comp < 70 ? `<span class="warn">⚠ ${comp}% complete — low completeness risks survivorship bias</span>` : `${comp}% complete`;
      return weekRow(label, s, compNote);
    }).join("")}`;
}

function renderSleepQuarter(recs) {
  if (recs.length < 45) return `<div class="empty-state"><div class="empty-icon">📊</div><div class="empty-title">Need ${45 - recs.length} more nights</div><div class="empty-sub">Quarterly view needs ≥ 45 nights for a meaningful comparison. You have ${recs.length} so far.</div></div>`;
  const quarters = {};
  recs.forEach(r => { const d = new Date(r.wake_date + "T12:00"); const k = `${d.getFullYear()}-Q${Math.ceil((d.getMonth() + 1) / 3)}`; (quarters[k] = quarters[k] || []).push(r); });
  return `<div class="sleep-section-hdr">Quarterly <span class="sleep-section-sub">Good for seasonal patterns (hot · rainy · cool season)</span></div>
    ${Object.keys(quarters).sort().reverse().map(k => weekRow(k, sleepStats(quarters[k]))).join("")}`;
}

function renderSleepYear(recs) {
  if (recs.length < 200) return `<div class="empty-state"><div class="empty-icon">📈</div><div class="empty-title">Need ${200 - recs.length} more nights</div><div class="empty-sub">Yearly view needs ≥ 200 same-device nights for a strong comparison. You have ${recs.length} so far — keep logging!</div></div>`;
  const years = {};
  recs.forEach(r => { const k = r.wake_date.slice(0, 4); (years[k] = years[k] || []).push(r); });
  const yr = new Date().getFullYear().toString();
  return `<div class="sleep-section-hdr">Yearly trajectory <span class="sleep-section-sub">Cross-device stage/HRV comparisons are unreliable</span></div>
    ${Object.keys(years).sort().reverse().map(k => weekRow(k + (k === yr && years[k].length < 365 ? " (YTD)" : ""), sleepStats(years[k]))).join("")}`;
}

// ── Sleep modal ──
function openSleepModal(id = "") {
  const r = (state.sleep || []).find(s => s.id === id);
  const now = new Date();
  const toLocal = d => new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  document.querySelector("#sleepEditId").value = id;
  document.querySelector("#sleepBedtime").value = r?.bedtime || toLocal(new Date(now - 8 * 3600000));
  document.querySelector("#sleepWakeTime").value = r?.wake_time || toLocal(now);
  document.querySelector("#sleepLatency").value = r?.sleep_latency_min ?? "";
  document.querySelector("#sleepAwakenings").value = r?.awakenings ?? "";
  document.querySelector("#sleepSource").value = r?.source || "manual";
  document.querySelector("#sleepNotes").value = r?.notes || "";
  document.querySelector("#deleteSleepBtn").hidden = !r;
  const rr = document.querySelector("#sleepRatingRow");
  rr.innerHTML = Array.from({ length: 10 }, (_, i) => i + 1).map(n =>
    `<button type="button" class="rating-btn${r?.subjective_rating === n ? " sel" : ""}" data-rating="${n}">${n}</button>`).join("");
  updateSleepCalc();
  document.querySelector("#sleepModal")?.showModal();
}

function updateSleepCalc() {
  const bed = document.querySelector("#sleepBedtime")?.value;
  const wake = document.querySelector("#sleepWakeTime")?.value;
  const lat = parseInt(document.querySelector("#sleepLatency")?.value) || 0;
  const calc = calcSleepFields(bed, wake, lat);
  const el = document.querySelector("#sleepCalc");
  if (!el) return;
  if (!calc) { el.innerHTML = ""; return; }
  const ec = calc.sleep_efficiency_pct >= 85 ? "good" : calc.sleep_efficiency_pct >= 70 ? "" : "warn";
  el.innerHTML = `<div class="sleep-calc"><span>In bed: <strong>${fmtDur(calc.time_in_bed_min)}</strong></span><span>Asleep: <strong>${fmtDur(calc.total_sleep_min)}</strong></span><span class="${ec}">Efficiency: <strong>${calc.sleep_efficiency_pct}%</strong></span></div>`;
}

function saveSleepRecord(e) {
  e.preventDefault();
  const bed = document.querySelector("#sleepBedtime").value;
  const wake = document.querySelector("#sleepWakeTime").value;
  const lat = parseInt(document.querySelector("#sleepLatency").value) || 0;
  const calc = calcSleepFields(bed, wake, lat);
  if (!calc) { alert("Check bedtime and wake time — wake must be after bedtime."); return; }
  const rating = parseInt(document.querySelector(".rating-btn.sel")?.dataset.rating) || null;
  const record = {
    id: document.querySelector("#sleepEditId").value || `sleep-${Date.now()}`,
    wake_date: wake.slice(0, 10),
    bedtime: bed, wake_time: wake,
    ...calc,
    sleep_latency_min: lat || null,
    awakenings: parseInt(document.querySelector("#sleepAwakenings").value) || null,
    subjective_rating: rating,
    source: document.querySelector("#sleepSource").value,
    notes: document.querySelector("#sleepNotes").value.trim(),
    flags: []
  };
  record.flags = flagSleepRecord(record);
  state.sleep = state.sleep || [];
  const idx = state.sleep.findIndex(r => r.id === record.id);
  if (idx >= 0) state.sleep[idx] = record; else state.sleep.push(record);
  save();
  renderSleep();
  e.target.closest("dialog")?.close();
}

function deleteSleepRecord(id) {
  if (!id || !confirm("Delete this sleep entry?")) return;
  state.sleep = (state.sleep || []).filter(r => r.id !== id);
  save();
  renderSleep();
  document.querySelector("#sleepModal")?.close();
}

// ── Render all ──
function renderAll() {
  renderHabits();
  updateRewardUI();
  renderComments();
  renderHeatmap();
  renderSleep();
}

// ── Login ──
async function doLogin() {
  clearAuthError("loginError");
  const email = document.querySelector("#loginEmail")?.value.trim();
  const pwd   = document.querySelector("#loginPassword")?.value;
  if (!email || !pwd) { showAuthError("loginError", "Please enter your email and password."); return; }

  const hash     = await hashPwd(pwd);
  const accounts = loadAccounts();
  const account  = accounts.find(a => a.email === email && a.hash === hash);
  if (!account) { showAuthError("loginError", "Email or password is incorrect."); return; }

  state.profile.name = account.name;
  setSession({ id: account.id, email: account.email, name: account.name });
  save();
  enterApp(account.name);
}

// ── Sign up ──
async function doSignup() {
  clearAuthError("signupError");
  const name = document.querySelector("#signupName")?.value.trim();
  const email = document.querySelector("#signupEmail")?.value.trim();
  const pwd   = document.querySelector("#signupPassword")?.value;

  if (!name)                         { showAuthError("signupError", "Please enter your name."); return; }
  if (!email || !email.includes("@")){ showAuthError("signupError", "Please enter a valid email."); return; }
  if (!pwd || pwd.length < 6)        { showAuthError("signupError", "Password must be at least 6 characters."); return; }

  const accounts = loadAccounts();
  if (accounts.find(a => a.email === email)) {
    showAuthError("signupError", "An account with this email already exists."); return;
  }

  const hash    = await hashPwd(pwd);
  const account = { id: `u-${Date.now()}`, name, email, hash };
  accounts.push(account);
  saveAccounts(accounts);

  state.profile.name = name;
  setSession({ id: account.id, email, name });
  save();
  enterApp(name);
}

function enterApp(name) {
  const nameEl = document.querySelector("#activateName");
  if (nameEl) nameEl.textContent = name;
  const started = localStorage.getItem(STARTED_KEY) === "1";
  switchScreen(started ? "today" : "onboarding");
}

// ── Events ──
function bindEvents() {
  document.addEventListener("click", e => {
    // Screen nav
    const screenBtn = e.target.closest("[data-screen]");
    if (screenBtn) { switchScreen(screenBtn.dataset.screen); return; }

    // Start (activate screen)
    if (e.target.closest("[data-start]")) { startApp(); return; }

    // Install screen: native prompt
    if (e.target.closest("#installScreenNativeBtn")) { requestInstall(); return; }

    // Install screen: already installed / skip
    if (e.target.closest("#installDoneBtn") || e.target.closest("#installSkipBtn")) {
      switchScreen("login");
      setTimeout(() => document.querySelector("#loginEmail")?.focus(), 50);
      return;
    }

    // Login / Signup
    if (e.target.closest("#loginBtn"))    { doLogin(); return; }
    if (e.target.closest("#signupBtn"))   { doSignup(); return; }
    if (e.target.closest("#goSignupBtn")) {
      switchScreen("signup");
      setTimeout(() => document.querySelector("#signupName")?.focus(), 50);
      return;
    }
    if (e.target.closest("#goLoginBtn")) {
      switchScreen("login");
      setTimeout(() => document.querySelector("#loginEmail")?.focus(), 50);
      return;
    }
    if (e.target.closest("#googleSigninBtn")) {
      alert("Google sign-in is coming in the cloud version of Momentum!");
      return;
    }
    if (e.target.closest("#forgotPasswordBtn")) {
      alert("This is a local account — passwords cannot be recovered.\n\nTo start fresh: Settings → Reset all data.");
      return;
    }

    // Install guide modal
    if (e.target.closest("[data-install-guide]")) { showInstallModal(); return; }

    // Native Chrome install (banner button)
    if (e.target.closest("#installBtn")) { requestInstall(); return; }

    // Install now from guide modal
    if (e.target.closest("#installGuideNativeBtn")) {
      document.querySelector("#installGuideModal")?.close();
      requestInstall();
      return;
    }

    // Theme
    if (e.target.closest("[data-theme-toggle]")) { cycleTheme(); return; }
    const themeBtn = e.target.closest("[data-set-theme]");
    if (themeBtn) { applyTheme(themeBtn.dataset.setTheme); return; }

    // Habit toggle
    const toggleBtn = e.target.closest("[data-toggle]");
    if (toggleBtn) { e.stopPropagation(); toggleHabit(toggleBtn.dataset.toggle); return; }

    // Counter
    const incBtn = e.target.closest("[data-inc]");
    if (incBtn) { completeHabit(incBtn.dataset.inc); return; }
    const decBtn = e.target.closest("[data-dec]");
    if (decBtn) { decrementHabit(decBtn.dataset.dec); return; }

    // Row click (only for target=1 habits)
    const row = e.target.closest(".habit-item");
    if (row && !e.target.closest("button")) {
      const nameEl = row.querySelector(".habit-name");
      if (nameEl) {
        const habit = state.habits.find(h => h.name === nameEl.textContent);
        if (habit && habit.target === 1) toggleHabit(habit.id);
      }
      return;
    }

    // Open modals
    const openModal = e.target.closest("[data-open-modal]");
    if (openModal) {
      if (openModal.dataset.openModal === "habitModal") openHabitForm();
      if (openModal.dataset.openModal === "rewardModal") openRewardForm();
      return;
    }

    // Edit habit
    const editHabit = e.target.closest("[data-edit-habit]");
    if (editHabit) { e.preventDefault(); openHabitForm(editHabit.dataset.editHabit); return; }

    // Edit reward
    const editReward = e.target.closest("[data-edit-reward]");
    if (editReward) { e.preventDefault(); openRewardForm(editReward.dataset.editReward); return; }

    // Make primary
    const makePrimary = e.target.closest("[data-make-primary]");
    if (makePrimary) {
      state.primaryRewardId = makePrimary.dataset.makePrimary;
      state.unlocked = false;
      updateRewardUI();
      save();
      return;
    }

    // Close dialog
    if (e.target.closest("[data-close-dialog]")) {
      e.target.closest("dialog")?.close();
      return;
    }

    // Difficulty buttons
    const diffBtn = e.target.closest(".diff-btn");
    if (diffBtn) {
      document.querySelectorAll(".diff-btn").forEach(b => b.classList.remove("sel"));
      diffBtn.classList.add("sel");
      selectedDiff = Number(diffBtn.dataset.diff);
      return;
    }

    // Sleep: log button
    if (e.target.closest("#logSleepBtn")) { openSleepModal(); return; }

    // Sleep: zoom tabs
    const zoomTab = e.target.closest(".zoom-tab");
    if (zoomTab) { renderSleepZoom(zoomTab.dataset.zoom); return; }

    // Sleep: click row to edit
    const sleepRow = e.target.closest("[data-edit-sleep]");
    if (sleepRow) { openSleepModal(sleepRow.dataset.editSleep); return; }

    // Sleep: rating buttons
    const ratingBtn = e.target.closest(".rating-btn");
    if (ratingBtn) {
      document.querySelectorAll(".rating-btn").forEach(b => b.classList.remove("sel"));
      ratingBtn.classList.add("sel");
      return;
    }

    // Sleep: delete button
    if (e.target.closest("#deleteSleepBtn")) {
      const id = document.querySelector("#sleepEditId")?.value;
      deleteSleepRecord(id);
      return;
    }
  });

  // Habit form submit
  document.querySelector("#habitForm")?.addEventListener("submit", e => {
    e.preventDefault();
    const editId = document.querySelector("#habitEditId").value;
    const name = document.querySelector("#habitName").value.trim() || "New habit";
    const target = Math.max(1, Number(document.querySelector("#habitTarget").value) || 1);
    const emoji = document.querySelector("#habitEmoji").value || "⭐";
    const diff = document.querySelector(".diff-btn.sel");
    const coins = diff ? Number(diff.dataset.diff) : selectedDiff;
    const difficulty = diff?.textContent.split("+")[0].trim() || "Medium";

    const payload = { name, emoji, target, coins, difficulty, streak: "New today" };
    const existing = state.habits.find(h => h.id === editId);
    if (existing) {
      Object.assign(existing, payload);
      existing.count = Math.min(existing.count, existing.target);
    } else {
      state.habits.unshift({ id: `habit-${Date.now()}`, count: 0, ...payload });
    }
    renderHabits();
    save();
    e.target.closest("dialog")?.close();
  });

  // Reward form submit
  document.querySelector("#rewardForm")?.addEventListener("submit", e => {
    e.preventDefault();
    const editId = document.querySelector("#rewardEditId").value;
    const name = document.querySelector("#rewardName").value.trim() || "New reward";
    const price = Math.max(1, Number(document.querySelector("#rewardPrice").value) || 1);
    const emoji = document.querySelector("#rewardEmoji").value || "🎁";
    const currency = document.querySelector("#rewardCurrency").value || state.currency || "USD";
    const payload = { name, emoji, price, currency, target: coinsFromPrice(price, currency), eta: "New", img: "" };
    const existing = state.rewards.find(r => r.id === editId);
    if (existing) {
      Object.assign(existing, payload);
      existing.current = Math.min(existing.current, existing.target);
    } else {
      const r = { id: `reward-${Date.now()}`, current: 0, ...payload };
      state.rewards.push(r);
      state.primaryRewardId = r.id;
    }
    state.unlocked = false;
    updateRewardUI();
    save();
    e.target.closest("dialog")?.close();
  });

  // Sleep form submit
  document.querySelector("#sleepForm")?.addEventListener("submit", saveSleepRecord);

  // Delete habit
  document.querySelector("#deleteHabit")?.addEventListener("click", () => {
    const id = document.querySelector("#habitEditId").value;
    const h = state.habits.find(h => h.id === id);
    if (!h || !confirm(`Delete "${h.name}"?`)) return;
    state.habits = state.habits.filter(h => h.id !== id);
    save(); renderAll();
    document.querySelector("#habitModal")?.close();
  });

  // Delete reward
  document.querySelector("#deleteReward")?.addEventListener("click", () => {
    const id = document.querySelector("#rewardEditId").value;
    if (state.rewards.length <= 1) { alert("Keep at least one reward."); return; }
    const r = state.rewards.find(r => r.id === id);
    if (!r || !confirm(`Delete "${r.name}"?`)) return;
    state.rewards = state.rewards.filter(r => r.id !== id);
    if (state.primaryRewardId === id) state.primaryRewardId = state.rewards[0]?.id;
    save(); renderAll();
    document.querySelector("#rewardModal")?.close();
  });

  // Reward price → conversion
  document.querySelector("#rewardPrice")?.addEventListener("input", updateConversion);

  // Comments
  document.querySelector("#addComment")?.addEventListener("click", () => {
    const input = document.querySelector("#commentInput");
    const text = input.value.trim();
    if (!text) return;
    state.comments.unshift({ author: "You", text });
    renderComments();
    save();
    input.value = "";
  });

  // Unlock demo
  document.querySelector("#unlockDemo")?.addEventListener("click", () => {
    primaryReward().current = primaryReward().target;
    state.unlocked = false;
    updateRewardUI();
    save();
  });

  // Export / import
  document.querySelector("#exportJson")?.addEventListener("click", exportJson);
  document.querySelector("#exportCsv")?.addEventListener("click", exportCsv);
  document.querySelector("#importJson")?.addEventListener("change", async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const imported = JSON.parse(await file.text());
      if (!Array.isArray(imported.habits) || !Array.isArray(imported.rewards)) { alert("Not a Momentum backup."); return; }
      Object.assign(state, imported);
      save(); renderAll();
      alert("Imported successfully.");
    } catch { alert("Could not import that file."); }
    finally { e.target.value = ""; }
  });

  // Reset
  document.querySelector("#resetData")?.addEventListener("click", () => {
    if (confirm("Reset all data on this device?")) reset();
  });

  // Login / signup: Enter key
  document.querySelector("#loginPassword")?.addEventListener("keydown", e => {
    if (e.key === "Enter") doLogin();
  });
  document.querySelector("#signupPassword")?.addEventListener("keydown", e => {
    if (e.key === "Enter") doSignup();
  });

  // PWA install (Chrome/Edge fires this when app is installable)
  window.addEventListener("beforeinstallprompt", e => {
    e.preventDefault();
    deferredInstall = e;
    document.querySelectorAll("#installBtn, #installScreenNativeBtn").forEach(el => { if (el) el.hidden = false; });
  });

  // After install: advance from install screen to signin
  window.addEventListener("appinstalled", () => {
    deferredInstall = null;
    document.querySelectorAll("#headerInstallBtn, #installBtn, .install-banner").forEach(el => { if (el) el.hidden = true; });
    if (document.querySelector("#screen-install.active")) {
      switchScreen("login");
      setTimeout(() => document.querySelector("#loginEmail")?.focus(), 50);
    }
  });

  // System theme
  window.matchMedia?.("(prefers-color-scheme: dark)")?.addEventListener("change", () => {
    if ((document.documentElement.dataset.themeMode || "system") === "system") applyTheme("system");
  });

  // Settings default currency
  document.querySelector("#settingsCurrency")?.addEventListener("change", e => {
    state.currency = e.target.value;
    save();
  });
}

// ── Dialog polyfill (browsers without native <dialog> support) ──
if (typeof HTMLDialogElement === "undefined") {
  document.querySelectorAll("dialog").forEach(d => {
    d.showModal = function () {
      this.setAttribute("open", "");
      if (!this._scrim) {
        this._scrim = Object.assign(document.createElement("div"), { onclick: () => this.close() });
        this._scrim.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:99";
        this.style.cssText += ";position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:100;margin:0";
      }
      document.body.appendChild(this._scrim);
      document.body.style.overflow = "hidden";
    };
    d.close = function () {
      this.removeAttribute("open");
      this._scrim?.remove();
      document.body.style.overflow = "";
    };
  });
}

// ── Init ──
applyTheme();
load();
setDate();
bindEvents();
renderAll();

// Sync settings currency select to saved state
const settingsCurrEl = document.querySelector("#settingsCurrency");
if (settingsCurrEl) settingsCurrEl.value = state.currency || "USD";

const urlScreen = new URLSearchParams(location.search).get("screen");
const _started  = localStorage.getItem(STARTED_KEY) === "1";
const _session  = getSession();
const _pwa      = isInstalledPWA();

if (_session && _started) {
  const nameEl = document.querySelector("#activateName");
  if (nameEl && state.profile.name) nameEl.textContent = state.profile.name;
  switchScreen(urlScreen || "today");
} else if (!_pwa && !_session) {
  switchScreen("install");
} else if (!_session) {
  switchScreen("login");
  setTimeout(() => document.querySelector("#loginEmail")?.focus(), 50);
} else {
  // Session exists but not yet activated
  const nameEl = document.querySelector("#activateName");
  if (nameEl && state.profile.name) nameEl.textContent = state.profile.name;
  switchScreen("onboarding");
}

if (_pwa) {
  document.querySelectorAll("#headerInstallBtn, #installBtn, .install-banner").forEach(el => { if (el) el.hidden = true; });
}
