const STORAGE_KEY = "momentum-v1";
const STARTED_KEY = "momentum-started-v1";

const defaultState = {
  primaryRewardId: "sony",
  todayCoins: 42,
  unlocked: false,
  profile: { name: "" },
  comments: [
    { author: "Founder note", text: "Coins should feel like a real progression system, not a gamification gimmick." },
    { author: "Design note", text: "Keep dark mode high-contrast — especially for the progress bars and habit states." }
  ],
  rewards: [
    { id: "sony", name: "Sony WH-1000XM5", emoji: "🎧", price: 399, currency: "USD", current: 742, target: 1995, eta: "~9 wks", img: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&q=80" },
    { id: "trip", name: "Weekend in Chiang Mai", emoji: "✈️", price: 680, currency: "USD", current: 0, target: 3400, eta: "~24 wks", img: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=400&q=80" },
    { id: "kindle", name: "Kindle Scribe", emoji: "📖", price: 340, currency: "USD", current: 0, target: 1700, eta: "Later", img: "https://images.unsplash.com/photo-1512820790803-83ca734da794?w=400&q=80" },
    { id: "camera", name: "New Camera", emoji: "📷", price: 700, currency: "USD", current: 560, target: 7000, eta: "Later", img: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=400&q=80" }
  ],
  habits: [
    { id: "gym", name: "Gym", emoji: "🏋️", target: 1, count: 0, coins: 25, streak: "56 days", difficulty: "Hard" },
    { id: "read", name: "Read", emoji: "📖", target: 1, count: 0, coins: 15, streak: "5 days", difficulty: "Medium" },
    { id: "water", name: "Drink water", emoji: "💧", target: 8, count: 6, coins: 5, streak: "12 days", difficulty: "Easy" },
    { id: "clean", name: "No phone in bed", emoji: "🌙", target: 1, count: 0, coins: 15, streak: "Check at 10 PM", difficulty: "Medium" },
    { id: "meditate", name: "Meditate", emoji: "🧘", target: 1, count: 1, coins: 12, streak: "20 days", difficulty: "Medium" }
  ]
};

let state = structuredClone(defaultState);
let deferredInstall = null;

function primaryReward() {
  return state.rewards.find(r => r.id === state.primaryRewardId) || state.rewards[0];
}

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && typeof saved === "object") {
      Object.assign(state, saved);
      state.habits ||= [];
      state.rewards ||= [];
      state.comments ||= [];
    }
  } catch { localStorage.removeItem(STORAGE_KEY); }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function reset() {
  state = structuredClone(defaultState);
  localStorage.removeItem(STARTED_KEY);
  save();
  renderAll();
  switchScreen("onboarding");
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
function switchScreen(name) {
  document.querySelectorAll(".screen").forEach(s => s.classList.toggle("active", s.id === `screen-${name}`));
  document.querySelectorAll("[data-screen]").forEach(b => b.classList.toggle("active", b.dataset.screen === name));
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
      <div class="reward-card-meta">$${r.price.toLocaleString()} · ${isPrimary ? "Primary" : r.eta}</div>
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
  set("#heroMeta", `$${r.price.toLocaleString()} · ${r.current.toLocaleString()} / ${r.target.toLocaleString()} coins`);
  set("#heroCoins", r.current.toLocaleString());
  set("#coinsToGo", remaining.toLocaleString());
  set("#todayCoins", state.todayCoins);
  set("#rewardsName", r.name);
  set("#rewardsMeta", `$${r.price.toLocaleString()} · estimated unlock in ${r.eta}`);
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
  document.querySelector("#rewardCurrency").value = r?.currency || "USD";
  document.querySelector("#rewardEmoji").value = r?.emoji || "🎁";
  document.querySelector("#deleteReward").hidden = !r;
  updateConversion();
  document.querySelector("#rewardModal")?.showModal();
}

function updateConversion() {
  const price = Math.max(0, Number(document.querySelector("#rewardPrice")?.value) || 0);
  const el = document.querySelector("#conversionVal");
  if (el) el.textContent = `$${price.toLocaleString()} = ${(price * 5).toLocaleString()} coins`;
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

// ── Start app ──
function startApp() {
  const nameEl = document.querySelector("#onboardName");
  if (nameEl?.value.trim()) state.profile.name = nameEl.value.trim();
  localStorage.setItem(STARTED_KEY, "1");
  save();
  switchScreen("today");
}

// ── Render all ──
function renderAll() {
  renderHabits();
  updateRewardUI();
  renderComments();
  renderHeatmap();
}

// ── Events ──
function bindEvents() {
  document.addEventListener("click", e => {
    // Screen nav
    const screenBtn = e.target.closest("[data-screen]");
    if (screenBtn) { switchScreen(screenBtn.dataset.screen); return; }

    // Start
    if (e.target.closest("[data-start]")) { startApp(); return; }

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
    const payload = { name, emoji, price, currency: document.querySelector("#rewardCurrency").value, target: price * 5, eta: "New", img: "" };
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

  // PWA install (Chrome/Edge fires this when app is installable)
  window.addEventListener("beforeinstallprompt", e => {
    e.preventDefault();
    deferredInstall = e;
    document.querySelector("#installBtn").hidden = false;
  });

  // Hide install UI once installed
  window.addEventListener("appinstalled", () => {
    deferredInstall = null;
    document.querySelectorAll("#headerInstallBtn, #installBtn, .install-banner").forEach(el => { if (el) el.hidden = true; });
  });

  // System theme
  window.matchMedia?.("(prefers-color-scheme: dark)")?.addEventListener("change", () => {
    if ((document.documentElement.dataset.themeMode || "system") === "system") applyTheme("system");
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

const urlScreen = new URLSearchParams(location.search).get("screen");
const started = localStorage.getItem(STARTED_KEY) === "1";
switchScreen(started ? (urlScreen || "today") : "onboarding");

// Hide install UI if already running as installed app
if (window.matchMedia("(display-mode: standalone)").matches || navigator.standalone) {
  document.querySelectorAll("#headerInstallBtn, #installBtn, .install-banner").forEach(el => { if (el) el.hidden = true; });
}
