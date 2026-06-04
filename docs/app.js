const storeKey = "mobile-workdesk-sync-v1";
const roomKey = "mobile-workdesk-room";
const apiBase = "";
const text = {
  normal: "普通",
  important: "重要",
  urgent: "紧急",
  remind: "提醒",
  completed: "完成",
  added: "已加入清单。",
  emptyTitle: "先写一点内容。",
  notifyOn: "提醒已开启。若已部署推送服务，应用没打开时也可收到通知。",
  share: "这是给朋友的新清单链接，对方会使用独立数据。",
  copied: "朋友独立链接已复制。",
  backup: "备份已下载。",
  localOnly: "本机保存",
  syncing: "同步中",
  synced: "已同步",
  syncError: "同步稍后重试",
  roomSet: "同步房间已设置。"
};

let state = loadState();
let editingId = null;
let syncRoom = getRoomFromUrl() || localStorage.getItem(roomKey) || "";
let syncTimer = null;
let lastPulledAt = 0;
let isApplyingRemote = false;
const supabaseConfig = window.WORKDESK_SUPABASE || {};
const hasSupabase = Boolean(supabaseConfig.url && supabaseConfig.anonKey);

const $ = (id) => document.querySelector(id);
const els = {
  dateLabel: $("#dateLabel"),
  syncButton: $("#syncButton"),
  progressText: $("#progressText"),
  progressFill: $("#progressFill"),
  taskInput: $("#taskInput"),
  taskPriority: $("#taskPriority"),
  taskDate: $("#taskDate"),
  taskTime: $("#taskTime"),
  addTaskButton: $("#addTaskButton"),
  todayList: $("#todayList"),
  plannedList: $("#plannedList"),
  reminderList: $("#reminderList"),
  archiveList: $("#archiveList"),
  emptyToday: $("#emptyToday"),
  emptyPlanned: $("#emptyPlanned"),
  emptyReminders: $("#emptyReminders"),
  emptyArchive: $("#emptyArchive"),
  notesInput: $("#notesInput"),
  shareButton: $("#shareButton"),
  installGuideButton: $("#installGuideButton"),
  exportButton: $("#exportButton"),
  enableNotifyButton: $("#enableNotifyButton"),
  archiveDay: $("#archiveDay"),
  archiveFrom: $("#archiveFrom"),
  archiveTo: $("#archiveTo"),
  archiveAllButton: $("#archiveAllButton"),
  editDialog: $("#editDialog"),
  installDialog: $("#installDialog"),
  editTitle: $("#editTitle"),
  editDate: $("#editDate"),
  editTime: $("#editTime"),
  editPriority: $("#editPriority"),
  saveEditButton: $("#saveEditButton"),
  cancelEditButton: $("#cancelEditButton"),
  closeInstallGuideButton: $("#closeInstallGuideButton"),
  toast: $("#toast")
};

function makeId() {
  if (crypto && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function todayValue() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function loadState() {
  try {
    return normalize(JSON.parse(localStorage.getItem(storeKey)));
  } catch {
    return normalize(null);
  }
}

function normalize(value) {
  const fallback = { tasks: [], notes: "", reminderLog: {}, updatedAt: Date.now() };
  if (!value || !Array.isArray(value.tasks)) return fallback;
  return {
    tasks: value.tasks.map((task) => ({
      id: task.id || makeId(),
      title: task.title || "",
      priority: task.priority || "normal",
      dueDate: normalizeDate(task.dueDate),
      time: task.time || "",
      done: Boolean(task.done),
      completedAt: task.completedAt || null,
      createdAt: task.createdAt || Date.now()
    })),
    notes: value.notes || "",
    reminderLog: value.reminderLog || {},
    updatedAt: Number(value.updatedAt || Date.now())
  };
}

function saveState(options = {}) {
  if (!isApplyingRemote) state.updatedAt = Date.now();
  localStorage.setItem(storeKey, JSON.stringify(state));
  if (!isApplyingRemote && options.sync !== false) queueCloudSave();
}

function normalizeDate(value) {
  if (!value) return todayValue();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const match = String(value).match(/^(\d{4})[\/.-](\d{1,2})[\/.-](\d{1,2})$/);
  if (!match) return todayValue();
  return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
}

function formatDate(value) {
  const [year, month, day] = normalizeDate(value).split("-").map(Number);
  return new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "short" }).format(new Date(year, month - 1, day));
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function timestampDay(value) {
  const d = new Date(value || Date.now());
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function priorityText(value) {
  return { normal: text.normal, important: text.important, urgent: text.urgent }[value] || text.normal;
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => els.toast.classList.remove("show"), 2200);
}

function sortTasks(tasks) {
  return [...tasks].sort((a, b) => `${a.dueDate} ${a.time || "99:99"}`.localeCompare(`${b.dueDate} ${b.time || "99:99"}`));
}

function render() {
  els.dateLabel.textContent = new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "long" }).format(new Date());
  els.taskDate.value = els.taskDate.value || todayValue();
  els.notesInput.value = state.notes || "";
  renderSyncStatus(syncRoom ? text.synced : text.localOnly);
  renderLists();
  renderProgress();
}

function renderSyncStatus(label, kind = "") {
  els.syncButton.textContent = syncRoom ? `${label} · ${syncRoom}` : label;
  els.syncButton.classList.toggle("offline", !syncRoom);
  els.syncButton.classList.toggle("error", kind === "error");
}

function renderLists() {
  const today = todayValue();
  renderList(els.todayList, els.emptyToday, sortTasks(state.tasks.filter((task) => !task.done && task.dueDate === today)));
  renderList(els.plannedList, els.emptyPlanned, sortTasks(state.tasks.filter((task) => !task.done && task.dueDate > today)));
  renderList(els.reminderList, els.emptyReminders, sortTasks(state.tasks.filter((task) => !task.done && task.time)));
  renderArchive();
}

function renderArchive() {
  const day = els.archiveDay.value;
  const from = els.archiveFrom.value || day;
  const to = els.archiveTo.value || day;
  const completed = state.tasks.filter((task) => {
    if (!task.done) return false;
    const completedDay = timestampDay(task.completedAt);
    if (from && completedDay < from) return false;
    if (to && completedDay > to) return false;
    return true;
  }).sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));
  renderList(els.archiveList, els.emptyArchive, completed);
}

function renderList(list, empty, tasks) {
  list.innerHTML = "";
  tasks.forEach((task) => list.appendChild(createTaskItem(task)));
  empty.style.display = tasks.length ? "none" : "block";
}

function renderProgress() {
  const today = state.tasks.filter((task) => task.dueDate === todayValue());
  const done = today.filter((task) => task.done).length;
  const total = today.length;
  els.progressText.textContent = `${done} / ${total}`;
  els.progressFill.style.width = `${total ? Math.round((done / total) * 100) : 0}%`;
}

function createTaskItem(task) {
  const li = document.createElement("li");
  li.className = `task-item ${task.done ? "done" : ""}`;

  const check = document.createElement("button");
  check.className = "check-button";
  check.textContent = task.done ? "✓" : "";
  check.addEventListener("click", () => toggleDone(task.id));

  const body = document.createElement("div");
  const title = document.createElement("div");
  title.className = "task-title";
  title.textContent = task.title;
  body.appendChild(title);

  const meta = document.createElement("div");
  meta.className = "meta";
  meta.appendChild(badge(priorityText(task.priority), task.priority));
  meta.appendChild(badge(formatDate(task.dueDate)));
  if (task.time) meta.appendChild(badge(`${text.remind} ${task.time}`));
  if (task.done && task.completedAt) meta.appendChild(badge(`${text.completed} ${formatDateTime(task.completedAt)}`));
  body.appendChild(meta);

  const edit = document.createElement("button");
  edit.className = "edit-button";
  edit.textContent = "✎";
  edit.addEventListener("click", () => openEdit(task.id));

  const remove = document.createElement("button");
  remove.className = "delete-button";
  remove.textContent = "×";
  remove.addEventListener("click", () => deleteTask(task.id));

  li.append(check, body, edit, remove);
  return li;
}

function badge(label, type = "") {
  const span = document.createElement("span");
  span.className = `badge ${type}`;
  span.textContent = label;
  return span;
}

function addTask() {
  const title = els.taskInput.value.trim();
  if (!title) return showToast(text.emptyTitle);
  state.tasks.unshift({
    id: makeId(),
    title,
    priority: els.taskPriority.value,
    dueDate: normalizeDate(els.taskDate.value),
    time: els.taskTime.value,
    done: false,
    completedAt: null,
    createdAt: Date.now()
  });
  els.taskInput.value = "";
  els.taskTime.value = "";
  saveState();
  render();
  showToast(text.added);
}

function toggleDone(id) {
  const task = state.tasks.find((item) => item.id === id);
  state.tasks = state.tasks.map((item) => item.id === id ? { ...item, done: !item.done, completedAt: item.done ? null : Date.now() } : item);
  saveState();
  render();
  if (task && !task.done) switchView("archive");
}

function deleteTask(id) {
  state.tasks = state.tasks.filter((task) => task.id !== id);
  saveState();
  render();
}

function openEdit(id) {
  const task = state.tasks.find((item) => item.id === id);
  if (!task) return;
  editingId = id;
  els.editTitle.value = task.title;
  els.editDate.value = task.dueDate;
  els.editTime.value = task.time || "";
  els.editPriority.value = task.priority;
  els.editDialog.showModal();
}

function saveEdit(event) {
  event.preventDefault();
  const title = els.editTitle.value.trim();
  if (!editingId || !title) return showToast(text.emptyTitle);
  state.tasks = state.tasks.map((task) => task.id === editingId ? { ...task, title, dueDate: normalizeDate(els.editDate.value), time: els.editTime.value, priority: els.editPriority.value } : task);
  editingId = null;
  els.editDialog.close();
  saveState();
  render();
}

function switchView(view) {
  document.querySelectorAll(".view").forEach((panel) => panel.classList.toggle("active", panel.id === `${view}View`));
  document.querySelectorAll(".bottom-nav button").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
}

function openInstallGuide() {
  els.installDialog.showModal();
}

async function enableNotifications() {
  if (!("Notification" in window)) return showToast("这个浏览器不支持通知。");
  if (Notification.permission !== "granted") {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return showToast("通知没有开启。");
  }
  playTone();
  if (navigator.vibrate) navigator.vibrate([180, 90, 180]);
  await subscribePush();
  showToast(text.notifyOn);
}

function checkReminders() {
  const now = new Date();
  const keyMinute = `${todayValue()} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  state.tasks.forEach((task) => {
    if (task.done || !task.time || `${task.dueDate} ${task.time}` !== keyMinute) return;
    const key = `${task.id}|${keyMinute}`;
    if (state.reminderLog[key]) return;
    state.reminderLog[key] = true;
    saveState();
    fireReminder();
  });
}

function fireReminder() {
  playTone();
  if (navigator.vibrate) navigator.vibrate([250, 100, 250, 100, 250]);
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification("叮咚，小主人，提醒时间到啦！", { body: "打开清单小桌看看吧。" });
  }
  showToast("叮咚，小主人，提醒时间到啦！");
}

function playTone() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioContext();
    const gain = ctx.createGain();
    const notes = [784, 988, 1175, 988];
    gain.gain.value = 0.07;
    gain.connect(ctx.destination);
    notes.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      osc.connect(gain);
      osc.start(ctx.currentTime + index * 0.13);
      osc.stop(ctx.currentTime + index * 0.13 + 0.1);
    });
    setTimeout(() => ctx.close(), 800);
  } catch {}
}

async function shareApp() {
  const url = buildFriendShareUrl();
  if (navigator.share) {
    await navigator.share({ title: "清单小桌", text: text.share, url });
  } else if (navigator.clipboard) {
    await navigator.clipboard.writeText(url);
    showToast(text.copied);
  } else {
    showToast(text.share);
  }
}

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `workdesk-sync-${todayValue()}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
  showToast(text.backup);
}

function getRoomFromUrl() {
  return new URLSearchParams(location.search).get("room") || "";
}

function buildShareUrl() {
  const url = new URL(location.href);
  if (syncRoom) url.searchParams.set("room", syncRoom);
  return url.href.split("#")[0];
}

function buildFriendShareUrl() {
  const url = new URL(location.href);
  url.searchParams.set("room", `friend-${Math.random().toString(36).slice(2, 8)}`);
  url.searchParams.set("fresh", "friend");
  return url.href.split("#")[0];
}

async function chooseRoom() {
  const current = syncRoom || `room-${Math.random().toString(36).slice(2, 8)}`;
  const value = prompt("输入一个同步房间名。同一个房间名会同步同一份清单。", current);
  if (!value) return;
  syncRoom = value.trim();
  localStorage.setItem(roomKey, syncRoom);
  history.replaceState(null, "", buildShareUrl());
  showToast(text.roomSet);
  await pullCloudState(true);
  await pushCloudState();
  render();
}

function queueCloudSave() {
  if (!syncRoom) return renderSyncStatus(text.localOnly);
  renderSyncStatus(text.syncing);
  clearTimeout(syncTimer);
  syncTimer = setTimeout(pushCloudState, 500);
}

async function pushCloudState() {
  if (!syncRoom) return;
  if (hasSupabase) return pushSupabaseState();
  try {
    const res = await fetch(`${apiBase}/api/rooms/${encodeURIComponent(syncRoom)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state)
    });
    if (!res.ok) throw new Error("sync failed");
    renderSyncStatus(text.synced);
  } catch {
    renderSyncStatus(text.syncError, "error");
  }
}

async function pullCloudState(force = false) {
  if (!syncRoom) return;
  if (hasSupabase) return pullSupabaseState(force);
  try {
    const res = await fetch(`${apiBase}/api/rooms/${encodeURIComponent(syncRoom)}`);
    if (!res.ok) throw new Error("sync failed");
    const remote = normalize(await res.json());
    if (force || remote.updatedAt > state.updatedAt || remote.updatedAt > lastPulledAt) {
      isApplyingRemote = true;
      state = remote;
      lastPulledAt = remote.updatedAt;
      saveState({ sync: false });
      isApplyingRemote = false;
      render();
    }
    renderSyncStatus(text.synced);
  } catch {
    renderSyncStatus(text.syncError, "error");
  }
}

function supabaseHeaders() {
  return {
    "apikey": supabaseConfig.anonKey,
    "Authorization": `Bearer ${supabaseConfig.anonKey}`,
    "Content-Type": "application/json"
  };
}

function supabaseBase() {
  return `${supabaseConfig.url.replace(/\/$/, "")}/rest/v1/workdesk_rooms`;
}

async function pushSupabaseState() {
  try {
    const res = await fetch(supabaseBase(), {
      method: "POST",
      headers: {
        ...supabaseHeaders(),
        "Prefer": "resolution=merge-duplicates,return=representation"
      },
      body: JSON.stringify({
        room: syncRoom,
        data: state,
        updated_at: state.updatedAt || Date.now()
      })
    });
    if (!res.ok) throw new Error("supabase sync failed");
    renderSyncStatus(text.synced);
  } catch {
    renderSyncStatus(text.syncError, "error");
  }
}

async function pullSupabaseState(force = false) {
  try {
    const res = await fetch(`${supabaseBase()}?room=eq.${encodeURIComponent(syncRoom)}&select=data,updated_at`, {
      headers: supabaseHeaders()
    });
    if (!res.ok) throw new Error("supabase sync failed");
    const rows = await res.json();
    if (!rows.length) {
      await pushSupabaseState();
      return;
    }
    const remote = normalize(rows[0].data);
    remote.updatedAt = Number(rows[0].updated_at || remote.updatedAt || Date.now());
    if (force || remote.updatedAt > state.updatedAt || remote.updatedAt > lastPulledAt) {
      isApplyingRemote = true;
      state = remote;
      lastPulledAt = remote.updatedAt;
      saveState({ sync: false });
      isApplyingRemote = false;
      render();
    }
    renderSyncStatus(text.synced);
  } catch {
    renderSyncStatus(text.syncError, "error");
  }
}

async function subscribePush() {
  if (!syncRoom || !("serviceWorker" in navigator) || !("PushManager" in window)) return;
  try {
    const keyRes = await fetch(`${apiBase}/api/push/public-key`);
    if (!keyRes.ok) return;
    const { publicKey } = await keyRes.json();
    if (!publicKey) return;
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey)
    });
    await fetch(`${apiBase}/api/rooms/${encodeURIComponent(syncRoom)}/subscriptions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(subscription)
    });
  } catch {
    renderSyncStatus(text.syncError, "error");
  }
}

function urlBase64ToUint8Array(value) {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

els.addTaskButton.addEventListener("click", addTask);
els.taskInput.addEventListener("keydown", (event) => { if (event.key === "Enter") addTask(); });
els.notesInput.addEventListener("input", () => { state.notes = els.notesInput.value; saveState(); });
els.enableNotifyButton.addEventListener("click", enableNotifications);
els.shareButton.addEventListener("click", shareApp);
els.installGuideButton.addEventListener("click", openInstallGuide);
els.syncButton.addEventListener("click", chooseRoom);
els.exportButton.addEventListener("click", exportData);
els.archiveDay.addEventListener("change", () => { els.archiveFrom.value = els.archiveDay.value; els.archiveTo.value = els.archiveDay.value; renderArchive(); });
els.archiveFrom.addEventListener("change", () => { els.archiveDay.value = ""; renderArchive(); });
els.archiveTo.addEventListener("change", () => { els.archiveDay.value = ""; renderArchive(); });
els.archiveAllButton.addEventListener("click", () => { els.archiveDay.value = ""; els.archiveFrom.value = ""; els.archiveTo.value = ""; renderArchive(); });
els.saveEditButton.addEventListener("click", saveEdit);
els.cancelEditButton.addEventListener("click", (event) => { event.preventDefault(); els.editDialog.close(); });
els.closeInstallGuideButton.addEventListener("click", (event) => { event.preventDefault(); els.installDialog.close(); });
document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => switchView(button.dataset.view)));
document.querySelectorAll("[data-view-jump]").forEach((button) => button.addEventListener("click", () => switchView(button.dataset.viewJump)));

if (syncRoom) {
  localStorage.setItem(roomKey, syncRoom);
  history.replaceState(null, "", buildShareUrl());
}

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js");

els.taskDate.value = todayValue();
render();
pullCloudState();
setInterval(() => pullCloudState(), 5000);
setInterval(checkReminders, 15000);
