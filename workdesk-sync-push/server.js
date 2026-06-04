const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

let webpush = null;
try {
  webpush = require("web-push");
} catch {}

const root = __dirname;
const dataDir = path.join(root, "data");
const roomsDir = path.join(dataDir, "rooms");
const subsDir = path.join(dataDir, "subscriptions");
const port = Number(process.env.PORT || 8788);

fs.mkdirSync(roomsDir, { recursive: true });
fs.mkdirSync(subsDir, { recursive: true });

const publicKey = process.env.VAPID_PUBLIC_KEY || "";
const privateKey = process.env.VAPID_PRIVATE_KEY || "";
const contact = process.env.VAPID_CONTACT || "mailto:hello@example.com";
if (webpush && publicKey && privateKey) {
  webpush.setVapidDetails(contact, publicKey, privateKey);
}

function safeRoom(value) {
  return String(value || "default").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80) || "default";
}

function roomPath(room) {
  return path.join(roomsDir, `${safeRoom(room)}.json`);
}

function subPath(room) {
  return path.join(subsDir, `${safeRoom(room)}.json`);
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2), "utf8");
}

function normalizeRoom(value) {
  const fallback = { tasks: [], notes: "", reminderLog: {}, updatedAt: Date.now() };
  if (!value || !Array.isArray(value.tasks)) return fallback;
  return {
    tasks: value.tasks.map((task) => ({
      id: task.id || crypto.randomUUID(),
      title: String(task.title || ""),
      priority: task.priority || "normal",
      dueDate: task.dueDate || dateValue(),
      time: task.time || "",
      done: Boolean(task.done),
      completedAt: task.completedAt || null,
      createdAt: task.createdAt || Date.now()
    })),
    notes: String(value.notes || ""),
    reminderLog: value.reminderLog || {},
    updatedAt: Number(value.updatedAt || Date.now())
  };
}

function dateValue(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function minuteValue(date = new Date()) {
  return `${dateValue(date)} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function send(res, status, body, type = "application/json") {
  res.writeHead(status, {
    "Content-Type": type,
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  res.end(type === "application/json" ? JSON.stringify(body) : body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) req.destroy();
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
  });
}

async function handleApi(req, res, url) {
  if (req.method === "OPTIONS") return send(res, 204, {});

  if (url.pathname === "/api/push/public-key" && req.method === "GET") {
    return send(res, 200, { publicKey });
  }

  const roomMatch = url.pathname.match(/^\/api\/rooms\/([^/]+)$/);
  if (roomMatch && req.method === "GET") {
    const room = safeRoom(decodeURIComponent(roomMatch[1]));
    return send(res, 200, normalizeRoom(readJson(roomPath(room), null)));
  }

  if (roomMatch && req.method === "PUT") {
    const room = safeRoom(decodeURIComponent(roomMatch[1]));
    const incoming = normalizeRoom(await readBody(req));
    const existing = normalizeRoom(readJson(roomPath(room), null));
    const next = incoming.updatedAt >= existing.updatedAt ? incoming : existing;
    writeJson(roomPath(room), next);
    return send(res, 200, next);
  }

  const subMatch = url.pathname.match(/^\/api\/rooms\/([^/]+)\/subscriptions$/);
  if (subMatch && req.method === "POST") {
    const room = safeRoom(decodeURIComponent(subMatch[1]));
    const subscription = await readBody(req);
    const list = readJson(subPath(room), []);
    const withoutSame = list.filter((item) => item.endpoint !== subscription.endpoint);
    withoutSame.push(subscription);
    writeJson(subPath(room), withoutSame);
    return send(res, 200, { ok: true });
  }

  return send(res, 404, { error: "not found" });
}

function serveStatic(req, res, url) {
  let filePath = path.join(root, decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname));
  if (!filePath.startsWith(root)) return send(res, 403, "Forbidden", "text/plain");
  fs.stat(filePath, (error, stat) => {
    if (error || !stat.isFile()) filePath = path.join(root, "index.html");
    fs.readFile(filePath, (readError, content) => {
      if (readError) return send(res, 404, "Not found", "text/plain");
      res.writeHead(200, { "Content-Type": mimeType(filePath) });
      res.end(content);
    });
  });
}

function mimeType(file) {
  const ext = path.extname(file).toLowerCase();
  return {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".webmanifest": "application/manifest+json; charset=utf-8",
    ".svg": "image/svg+xml"
  }[ext] || "application/octet-stream";
}

async function sendReminder(subscription) {
  if (!webpush || !publicKey || !privateKey) return false;
  const payload = JSON.stringify({
    title: "叮咚，小主人，提醒时间到啦！",
    body: "打开清单小桌看看吧。",
    tag: `workdesk-${Date.now()}`
  });
  await webpush.sendNotification(subscription, payload);
  return true;
}

async function checkServerReminders() {
  const nowMinute = minuteValue();
  for (const file of fs.readdirSync(roomsDir).filter((name) => name.endsWith(".json"))) {
    const room = path.basename(file, ".json");
    const data = normalizeRoom(readJson(path.join(roomsDir, file), null));
    let changed = false;
    const subscriptions = readJson(subPath(room), []);
    for (const task of data.tasks) {
      if (task.done || !task.time || `${task.dueDate} ${task.time}` !== nowMinute) continue;
      const key = `server|${task.id}|${nowMinute}`;
      if (data.reminderLog[key]) continue;
      data.reminderLog[key] = true;
      changed = true;
      await Promise.allSettled(subscriptions.map((subscription) => sendReminder(subscription)));
    }
    if (changed) {
      data.updatedAt = Date.now();
      writeJson(roomPath(room), data);
    }
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname.startsWith("/api/")) return await handleApi(req, res, url);
    serveStatic(req, res, url);
  } catch (error) {
    send(res, 500, { error: "server error" });
  }
});

server.listen(port, () => {
  console.log(`清单小桌同步推送服务已启动: http://localhost:${port}`);
});

setInterval(checkServerReminders, 30000);
