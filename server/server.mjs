// «Штурман» — рабочее место Леры: проекты, входящие из памяти Claude, заметки Влада, трекер.
// Без зависимостей: node:http + встроенный node:sqlite (Node 22.13+).
// Пароли и ключ синка приходят из окружения (/etc/shturman/env на сервере), в репозитории их нет.
import http from "node:http";
import { DatabaseSync } from "node:sqlite";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { mkdirSync, writeFileSync, createReadStream, unlinkSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8841);
const DB_PATH = process.env.DB_PATH || join(HERE, "shturman.db");
const SYNC_KEY = process.env.SYNC_KEY || "";
const USERS = {
  lera: { name: "Лера", role: "lera", pass: process.env.LERA_PASS || "" },
  vlad: { name: "Влад", role: "vlad", pass: process.env.VLAD_PASS || "" },
};
const ORIGINS = (process.env.ALLOWED_ORIGINS || "https://shumniyvlad-cell.github.io,http://localhost:5207")
  .split(",").map((s) => s.trim()).filter(Boolean);
const SESSION_DAYS = 45;

export const KINDS = ["client", "own", "tools"];
export const STAGES = {
  client: ["Знакомство", "Стратегия", "Упаковка", "Запуск", "Ведём", "Пауза"],
  own: ["Идея", "Сборка", "Тест продаж", "Продаётся", "Пауза"],
  tools: ["В сборке", "Работает", "Пауза"],
};
const STATUSES = ["inbox", "active", "dropped", "purged"];
const ITEM_STATUSES = ["todo", "doing", "done"];

const db = new DatabaseSync(DB_PATH);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY, login TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'client',
    client TEXT NOT NULL DEFAULT '',
    stage TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'inbox',
    summary TEXT NOT NULL DEFAULT '',
    body TEXT NOT NULL DEFAULT '',
    links TEXT NOT NULL DEFAULT '[]',
    files TEXT NOT NULL DEFAULT '[]',
    next_step TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    checklist TEXT NOT NULL DEFAULT '[]',
    source TEXT NOT NULL DEFAULT 'memory',
    is_fresh INTEGER NOT NULL DEFAULT 0,
    drop_reason TEXT NOT NULL DEFAULT '',
    dropped_at TEXT NOT NULL DEFAULT '',
    purged_at TEXT NOT NULL DEFAULT '',
    mem_updated_at TEXT NOT NULL DEFAULT '',
    synced_at TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL DEFAULT 'task',
    author TEXT NOT NULL,
    text TEXT NOT NULL,
    reply TEXT NOT NULL DEFAULT '',
    project_id TEXT NOT NULL DEFAULT '',
    date TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'todo',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    done_at TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS activity (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    at TEXT NOT NULL, who TEXT NOT NULL, project_id TEXT NOT NULL DEFAULT '', text TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY, project_id TEXT NOT NULL, name TEXT NOT NULL, label TEXT NOT NULL DEFAULT '',
    size INTEGER NOT NULL, mime TEXT NOT NULL DEFAULT 'application/octet-stream', sha TEXT NOT NULL,
    source TEXT NOT NULL, created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sync_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, added INTEGER NOT NULL, updated INTEGER NOT NULL
  );
`);

for (const [col, def] of [["passport", "'{}'"], ["access", "'[]'"], ["mem_links", "'[]'"]]) {
  if (!db.prepare("PRAGMA table_info(projects)").all().some((c) => c.name === col)) {
    db.exec(`ALTER TABLE projects ADD COLUMN ${col} TEXT NOT NULL DEFAULT ${def}`);
    // ссылки из памяти раньше лежали в links — переносим, links остаются только для ручных ссылок Леры
    if (col === "mem_links") db.exec("UPDATE projects SET mem_links = links, links = '[]' WHERE source = 'memory'");
  }
}
const FILES_DIR = process.env.FILES_DIR || join(dirname(DB_PATH), "files");
mkdirSync(FILES_DIR, { recursive: true });
const MAX_FILE = 30 * 1024 * 1024;
const MIME = { pdf: "application/pdf", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", txt: "text/plain; charset=utf-8", md: "text/markdown; charset=utf-8", zip: "application/zip", mp3: "audio/mpeg", csv: "text/csv; charset=utf-8" };

const now = () => new Date().toISOString();
const sha = (s) => createHash("sha256").update(String(s)).digest();
const same = (a, b) => a.length > 0 && b.length > 0 && timingSafeEqual(sha(a), sha(b));
const clip = (v, n) => String(v ?? "").slice(0, n);
const pick = (o, keys) => Object.fromEntries(keys.map((k) => [k, o[k]]));
const J = (v, fallback) => { try { return JSON.parse(v); } catch { return fallback; } };

// ── сессии ──
const q = {
  sessionGet: db.prepare("SELECT login, expires_at FROM sessions WHERE token_hash = ?"),
  sessionAdd: db.prepare("INSERT INTO sessions (token_hash, login, created_at, expires_at) VALUES (?, ?, ?, ?)"),
  sessionDel: db.prepare("DELETE FROM sessions WHERE token_hash = ?"),
  sessionGc: db.prepare("DELETE FROM sessions WHERE expires_at < ?"),
  projects: db.prepare("SELECT * FROM projects WHERE status != 'purged' ORDER BY updated_at DESC"),
  purged: db.prepare("SELECT id, title, kind, client, drop_reason, dropped_at, purged_at FROM projects WHERE status = 'purged' ORDER BY purged_at DESC LIMIT 200"),
  project: db.prepare("SELECT * FROM projects WHERE id = ?"),
  projectAdd: db.prepare(`INSERT INTO projects (id, title, kind, client, stage, status, summary, body, mem_links, files, next_step, source, is_fresh, mem_updated_at, synced_at, created_at, updated_at)
    VALUES (@id, @title, @kind, @client, @stage, @status, @summary, @body, @links, @files, @next_step, @source, @is_fresh, @mem_updated_at, @synced_at, @now, @now)`),
  items: db.prepare("SELECT * FROM items WHERE status != 'done' OR done_at >= ? OR date >= ? ORDER BY date, id"),
  item: db.prepare("SELECT * FROM items WHERE id = ?"),
  itemAdd: db.prepare(`INSERT INTO items (kind, author, text, project_id, date, status, created_at, updated_at)
    VALUES (@kind, @author, @text, @project_id, @date, 'todo', @now, @now)`),
  itemDel: db.prepare("DELETE FROM items WHERE id = ?"),
  activity: db.prepare("SELECT * FROM activity ORDER BY id DESC LIMIT 300"),
  log: db.prepare("INSERT INTO activity (at, who, project_id, text) VALUES (?, ?, ?, ?)"),
  lastSync: db.prepare("SELECT * FROM sync_runs ORDER BY id DESC LIMIT 1"),
  syncRun: db.prepare("INSERT INTO sync_runs (at, added, updated) VALUES (?, ?, ?)"),
  filesAll: db.prepare("SELECT id, project_id, name, label, size, mime, sha, source, created_at FROM files ORDER BY created_at"),
  fileGet: db.prepare("SELECT * FROM files WHERE id = ?"),
  fileBySha: db.prepare("SELECT id FROM files WHERE project_id = ? AND sha = ?"),
  fileAdd: db.prepare("INSERT INTO files (id, project_id, name, label, size, mime, sha, source, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"),
  fileDel: db.prepare("DELETE FROM files WHERE id = ?"),
  dropped: db.prepare("SELECT id, title, kind, client, files, drop_reason, dropped_at FROM projects WHERE status = 'dropped' ORDER BY dropped_at"),
};

function sessionFrom(req) {
  const m = /^Bearer\s+([A-Za-z0-9_-]{20,})$/.exec(req.headers.authorization || "");
  if (!m) return null;
  const row = q.sessionGet.get(sha(m[1]).toString("hex"));
  if (!row || row.expires_at < now()) return null;
  const u = USERS[row.login];
  return u ? { login: row.login, name: u.name, role: u.role, tokenHash: sha(m[1]).toString("hex") } : null;
}

// ── защита входа: не больше 8 попыток в 10 минут с адреса ──
const attempts = new Map();
function tooMany(ip) {
  const t = Date.now();
  const list = (attempts.get(ip) || []).filter((x) => t - x < 10 * 60_000);
  attempts.set(ip, list);
  return list.length >= 8;
}

// ── разбор запроса ──
async function readJson(req, limit = 2_000_000) {
  let size = 0;
  const chunks = [];
  for await (const c of req) {
    size += c.length;
    if (size > limit) throw Object.assign(new Error("too big"), { code: 413 });
    chunks.push(c);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function send(res, code, data, origin) {
  const headers = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", vary: "Origin" };
  if (origin) Object.assign(headers, { "access-control-allow-origin": origin });
  res.writeHead(code, headers);
  res.end(JSON.stringify(data));
}

function projectOut(p) {
  return { ...p, links: J(p.links, []), mem_links: J(p.mem_links, []), files: J(p.files, []), checklist: J(p.checklist, []), passport: J(p.passport, {}), access: J(p.access, []), is_fresh: !!p.is_fresh };
}

function validKindStage(kind, stage) {
  return KINDS.includes(kind) && STAGES[kind].includes(stage);
}

function sanitizeChecklist(list) {
  if (!Array.isArray(list)) return "[]";
  return JSON.stringify(list.slice(0, 60).map((c) => ({ id: clip(c.id || randomBytes(4).toString("hex"), 16), text: clip(c.text, 300), done: !!c.done })));
}
function sanitizeLinks(list) {
  if (!Array.isArray(list)) return "[]";
  return JSON.stringify(list.slice(0, 30)
    .map((l) => ({ label: clip(l.label, 80), url: clip(l.url, 500) }))
    .filter((l) => /^https?:\/\//.test(l.url)));
}

function sanitizeAccess(list) {
  return JSON.stringify(list.slice(0, 40).map((a) => ({ id: clip(a.id || randomBytes(4).toString("hex"), 16), label: clip(a.label, 120), url: clip(a.url, 500),
    login: clip(a.login, 200), password: clip(a.password, 300), note: clip(a.note, 500) })).filter((a) => a.label || a.login || a.password));
}
function sanitizePassport(p) {
  const arr = (v, n, f) => (Array.isArray(v) ? v.slice(0, n).map(f) : []);
  const str = (v, n) => clip(typeof v === "string" ? v : "", n);
  return JSON.stringify({
    about: str(p.about, 3000), offer: str(p.offer, 2000), status: str(p.status, 2000), money: str(p.money, 2000), updated: str(p.updated, 20),
    done: arr(p.done, 60, (x) => str(x, 600)), next: arr(p.next, 30, (x) => str(x, 600)),
    contacts: arr(p.contacts, 20, (c) => ({ label: str(c.label, 80), value: str(c.value, 200), url: /^https?:\/\/|^mailto:|^tel:/.test(c.url || "") ? str(c.url, 500) : "" })),
    links: arr(p.links, 40, (l) => ({ label: str(l.label, 120), url: str(l.url, 500), note: str(l.note, 300), ok: l.ok !== false })).filter((l) => /^https?:\/\//.test(l.url)),
    access: arr(p.access, 40, (a) => ({ label: str(a.label, 120), url: str(a.url, 500), login: str(a.login, 200), password: str(a.password, 300), note: str(a.note, 500) })),
    where: arr(p.where, 30, (w) => ({ label: str(w.label, 120), value: str(w.value, 500) })),
  });
}
function saveFile(projectId, name, label, buf, source) {
  const sha = createHash("sha256").update(buf).digest("hex");
  const dup = q.fileBySha.get(projectId, sha);
  if (dup) return q.fileGet.get(dup.id);
  const id = randomBytes(9).toString("base64url");
  const clean = clip(name, 160).replace(/[\\/\0]/g, "_") || "file";
  const ext = (clean.split(".").pop() || "").toLowerCase();
  writeFileSync(join(FILES_DIR, id), buf);
  q.fileAdd.run(id, projectId, clean, clip(label, 200), buf.length, MIME[ext] || "application/octet-stream", sha, source, now());
  return q.fileGet.get(id);
}
async function readRaw(req, limit) {
  const chunks = []; let size = 0;
  for await (const c of req) { size += c.length; if (size > limit) throw Object.assign(new Error("too big"), { code: 413 }); chunks.push(c); }
  return Buffer.concat(chunks);
}
const hdr = (req, k) => { try { return decodeURIComponent(String(req.headers[k] || "")); } catch { return ""; } };

function state(user) {
  const since = new Date(Date.now() - 14 * 86400_000).toISOString().slice(0, 10);
  return {
    me: { login: user.login, name: user.name, role: user.role },
    kinds: KINDS, stages: STAGES,
    projects: q.projects.all().map(projectOut),
    purged: q.purged.all(),
    items: q.items.all(since, since),
    activity: q.activity.all(),
    attachments: q.filesAll.all(),
    lastSync: q.lastSync.get() || null,
    serverTime: now(),
  };
}

// ── синк с мака (ключ синка) ──
function syncIn(body) {
  const list = Array.isArray(body.projects) ? body.projects.slice(0, 1000) : [];
  const t = now();
  let added = 0, updated = 0;
  db.exec("BEGIN");
  try {
    for (const g of list) {
      const id = clip(g.id, 80).replace(/[^a-z0-9_-]/gi, "");
      if (!id) continue;
      const ex = q.project.get(id);
      const links = sanitizeLinks(g.links);
      const files = JSON.stringify(Array.isArray(g.files) ? g.files.slice(0, 40).map((f) => clip(f, 120)) : []);
      const memAt = clip(g.mem_updated_at, 40);
      if (!ex) {
        const kind = KINDS.includes(g.kind) ? g.kind : "client";
        const seeded = !!g.seed && validKindStage(kind, g.stage);
        q.projectAdd.run({
          id, title: clip(g.title || id, 160), kind, client: clip(g.client, 120),
          stage: seeded ? g.stage : STAGES[kind][0],
          status: seeded ? (STATUSES.includes(g.status) && g.status !== "purged" ? g.status : "active") : "inbox",
          summary: clip(g.summary, 2000), body: clip(g.body, 20000), links, files,
          next_step: clip(g.next_step, 500), source: "memory", is_fresh: seeded ? 0 : 1,
          mem_updated_at: memAt, synced_at: t, now: t,
        });
        if (seeded && g.status === "dropped") db.prepare("UPDATE projects SET drop_reason = ?, dropped_at = ? WHERE id = ?").run(clip(g.drop_reason, 300), t, id);
        q.log.run(t, "claude", id, seeded ? "Перенесён из памяти Claude" : "Пришёл во входящие из памяти Claude");
        added++;
      } else if (ex.status !== "purged") {
        const changed = memAt && memAt !== ex.mem_updated_at;
        db.prepare(`UPDATE projects SET summary = ?, body = ?, mem_links = ?, files = ?, mem_updated_at = ?, synced_at = ?,
          is_fresh = CASE WHEN ? THEN 1 ELSE is_fresh END, updated_at = CASE WHEN ? THEN ? ELSE updated_at END WHERE id = ?`)
          .run(clip(g.summary, 2000), clip(g.body, 20000), links, files, memAt || ex.mem_updated_at, t, changed ? 1 : 0, changed ? 1 : 0, t, id);
        if (changed) { q.log.run(t, "claude", id, "Claude обновил заметки по проекту"); updated++; }
      }
    }
    q.syncRun.run(t, added, updated);
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
  return { ok: true, added, updated, dropped: q.dropped.all().map((p) => ({ ...p, files: J(p.files, []) })) };
}

// ── правки с сайта ──
function patchProject(user, id, b) {
  const p = q.project.get(id);
  if (!p || p.status === "purged") return null;
  const t = now();
  const next = { ...p };
  const notes = [];
  if (typeof b.title === "string" && b.title.trim()) next.title = clip(b.title.trim(), 160);
  if (typeof b.client === "string") next.client = clip(b.client.trim(), 120);
  if (typeof b.next_step === "string") next.next_step = clip(b.next_step, 500);
  if (typeof b.notes === "string") next.notes = clip(b.notes, 20000);
  if (b.checklist) next.checklist = sanitizeChecklist(b.checklist);
  if (b.links) next.links = sanitizeLinks(b.links);
  if (Array.isArray(b.access)) next.access = sanitizeAccess(b.access);
  if (b.seen) next.is_fresh = 0;
  const kind = KINDS.includes(b.kind) ? b.kind : next.kind;
  const stage = typeof b.stage === "string" ? b.stage : (kind !== next.kind ? STAGES[kind][0] : next.stage);
  if (validKindStage(kind, stage) && (kind !== next.kind || stage !== next.stage)) {
    if (stage !== next.stage) notes.push(`Этап: ${next.stage || "—"} → ${stage}`);
    if (kind !== next.kind) notes.push(`Раздел: ${kindName(next.kind)} → ${kindName(kind)}`);
    next.kind = kind; next.stage = stage;
  }
  if (typeof b.status === "string" && b.status !== next.status && ["inbox", "active", "dropped"].includes(b.status)) {
    if (b.status === "dropped") {
      next.drop_reason = clip(b.drop_reason, 300); next.dropped_at = t;
      notes.push(`Не работаем${next.drop_reason ? `: ${next.drop_reason}` : ""}`);
    } else if (next.status === "dropped") {
      next.drop_reason = ""; next.dropped_at = "";
      notes.push("Вернули в работу");
    } else if (b.status === "active" && next.status === "inbox") {
      notes.push("Взяли в работу из входящих");
    }
    next.status = b.status;
    next.is_fresh = 0;
  }
  db.prepare(`UPDATE projects SET title=@title, client=@client, kind=@kind, stage=@stage, status=@status, next_step=@next_step,
    notes=@notes, checklist=@checklist, links=@links, access=@access, is_fresh=@is_fresh, drop_reason=@drop_reason, dropped_at=@dropped_at, updated_at=@updated_at WHERE id=@id`)
    .run(pick({ ...next, updated_at: t }, ["title", "client", "kind", "stage", "status", "next_step", "notes", "checklist", "links", "access", "is_fresh", "drop_reason", "dropped_at", "updated_at", "id"]));
  for (const n of notes) q.log.run(t, user.login, id, n);
  return projectOut(q.project.get(id));
}
const kindName = (k) => ({ client: "Продюсирование", own: "Продукты Влада", tools: "Кухня" })[k] || k;

function createProject(user, b) {
  const kind = KINDS.includes(b.kind) ? b.kind : "client";
  const stage = STAGES[kind].includes(b.stage) ? b.stage : STAGES[kind][0];
  const title = clip(String(b.title || "").trim(), 160);
  if (!title) return null;
  const base = title.toLowerCase().replace(/[^a-zа-яё0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 40) || "p";
  const id = `m-${translit(base)}-${randomBytes(2).toString("hex")}`;
  const t = now();
  q.projectAdd.run({ id, title, kind, client: clip(b.client, 120), stage, status: "active", summary: clip(b.summary, 2000), body: "",
    links: sanitizeLinks(b.links || []), files: "[]", next_step: clip(b.next_step, 500), source: "manual", is_fresh: 0,
    mem_updated_at: "", synced_at: "", now: t });
  q.log.run(t, user.login, id, "Проект заведён вручную");
  return projectOut(q.project.get(id));
}
function translit(s) {
  const m = { а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya" };
  return s.replace(/[а-яё]/g, (c) => m[c] ?? "");
}

function addItem(user, b) {
  const text = clip(String(b.text || "").trim(), 4000);
  if (!text) return null;
  const kind = user.role === "vlad" && b.kind !== "task" ? "note" : "task";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(b.date || "") ? b.date : "";
  const t = now();
  const r = q.itemAdd.run({ kind, author: user.login, text, project_id: clip(b.project_id, 80), date, now: t });
  return q.item.get(r.lastInsertRowid);
}
function patchItem(user, id, b) {
  const it = q.item.get(id);
  if (!it) return null;
  const t = now();
  const next = { ...it };
  const own = it.author === user.login;
  if (typeof b.text === "string" && b.text.trim() && own) next.text = clip(b.text.trim(), 4000);
  if (typeof b.reply === "string") next.reply = clip(b.reply, 2000);
  if (typeof b.project_id === "string") next.project_id = clip(b.project_id, 80);
  if (typeof b.date === "string" && (b.date === "" || /^\d{4}-\d{2}-\d{2}$/.test(b.date))) next.date = b.date;
  if (ITEM_STATUSES.includes(b.status) && b.status !== it.status) {
    next.status = b.status;
    next.done_at = b.status === "done" ? t : "";
  }
  db.prepare("UPDATE items SET text=@text, reply=@reply, project_id=@project_id, date=@date, status=@status, done_at=@done_at, updated_at=@u WHERE id=@id")
    .run(pick({ ...next, u: t }, ["text", "reply", "project_id", "date", "status", "done_at", "u", "id"]));
  return q.item.get(id);
}

// ── маршруты ──
const server = http.createServer(async (req, res) => {
  const origin = ORIGINS.includes(req.headers.origin) ? req.headers.origin : "";
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "access-control-allow-origin": origin || "null",
      "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
      "access-control-allow-headers": "authorization,content-type,x-file-name,x-file-label",
      "access-control-max-age": "86400",
      vary: "Origin",
    });
    return res.end();
  }
  const url = new URL(req.url, "http://x");
  const path = url.pathname.replace(/^\/shturman-api/, "").replace(/^\/api/, "") || "/";
  const ip = String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();
  try {
    if (path === "/health") return send(res, 200, { ok: true }, origin);

    // синк с мака: ключ в заголовке, без браузера
    if (path.startsWith("/sync")) {
      const key = String(req.headers["x-sync-key"] || "");
      if (!SYNC_KEY || !same(key, SYNC_KEY)) return send(res, 401, { error: "sync key" }, "");
      if (path === "/sync" && req.method === "POST") return send(res, 200, syncIn(await readJson(req, 8_000_000)), "");
      if (path === "/sync/dropped" && req.method === "GET") return send(res, 200, { dropped: q.dropped.all().map((p) => ({ ...p, files: J(p.files, []) })) }, "");
      if (path === "/sync/purged" && req.method === "POST") {
        const b = await readJson(req);
        const t = now();
        const ids = Array.isArray(b.ids) ? b.ids.slice(0, 500).map((x) => clip(x, 80)) : [];
        for (const id of ids) {
          db.prepare("UPDATE projects SET status = 'purged', purged_at = ?, body = '', updated_at = ? WHERE id = ? AND status = 'dropped'").run(t, t, id);
          q.log.run(t, "vlad", id, "Влад удалил проект из памяти Claude");
        }
        return send(res, 200, { ok: true, purged: ids.length }, "");
      }
      if (path === "/sync/passport" && req.method === "POST") {
        const b = await readJson(req, 2_000_000);
        const p = q.project.get(clip(b.id, 80));
        if (!p || p.status === "purged") return send(res, 404, { error: "no project" }, "");
        const pass = sanitizePassport(b.passport || {});
        if (pass !== p.passport) {
          db.prepare("UPDATE projects SET passport = ?, updated_at = ? WHERE id = ?").run(pass, now(), p.id);
          if (p.passport === "{}") q.log.run(now(), "claude", p.id, "Claude собрал паспорт проекта");
        }
        const have = new Set(db.prepare("SELECT sha FROM files WHERE project_id = ?").all(p.id).map((r) => r.sha));
        return send(res, 200, { ok: true, have: [...have] }, "");
      }
      if (path === "/sync/file" && req.method === "POST") {
        const pid = clip(url.searchParams.get("project"), 80);
        if (!q.project.get(pid)) return send(res, 404, { error: "no project" }, "");
        const f = saveFile(pid, hdr(req, "x-file-name"), hdr(req, "x-file-label"), await readRaw(req, MAX_FILE), "claude");
        return send(res, 200, f, "");
      }
      if (path === "/sync/note" && req.method === "POST") {
        const it = addItem({ login: "vlad", role: "vlad" }, await readJson(req));
        return it ? send(res, 200, it, "") : send(res, 400, { error: "text" }, "");
      }
      return send(res, 404, { error: "not found" }, "");
    }

    if (path === "/login" && req.method === "POST") {
      if (tooMany(ip)) return send(res, 429, { error: "Слишком много попыток. Подожди 10 минут." }, origin);
      const b = await readJson(req, 10_000);
      const login = String(b.login || "").trim().toLowerCase();
      const u = USERS[login];
      if (!u || !u.pass || !same(String(b.password || ""), u.pass)) {
        attempts.get(ip)?.push(Date.now()) ?? attempts.set(ip, [Date.now()]);
        return send(res, 401, { error: "Логин или пароль не подходят" }, origin);
      }
      const token = randomBytes(32).toString("base64url");
      const t = new Date();
      q.sessionGc.run(t.toISOString());
      q.sessionAdd.run(sha(token).toString("hex"), login, t.toISOString(), new Date(t.getTime() + SESSION_DAYS * 86400_000).toISOString());
      return send(res, 200, { token, me: { login, name: u.name, role: u.role } }, origin);
    }

    const user = sessionFrom(req);
    if (!user) return send(res, 401, { error: "Нужно войти" }, origin);

    if (path === "/logout" && req.method === "POST") { q.sessionDel.run(user.tokenHash); return send(res, 200, { ok: true }, origin); }
    if (path === "/state" && req.method === "GET") return send(res, 200, state(user), origin);

    if (path === "/projects" && req.method === "POST") {
      const p = createProject(user, await readJson(req));
      return p ? send(res, 200, p, origin) : send(res, 400, { error: "Нужно название" }, origin);
    }
    let m = /^\/projects\/([A-Za-z0-9_-]+)$/.exec(path);
    if (m && req.method === "PATCH") {
      const p = patchProject(user, m[1], await readJson(req));
      return p ? send(res, 200, p, origin) : send(res, 404, { error: "Проект не найден" }, origin);
    }

    m = /^\/projects\/([A-Za-z0-9_-]+)\/files$/.exec(path);
    if (m && req.method === "POST") {
      if (!q.project.get(m[1])) return send(res, 404, { error: "Проект не найден" }, origin);
      const f = saveFile(m[1], hdr(req, "x-file-name"), hdr(req, "x-file-label"), await readRaw(req, MAX_FILE), user.login);
      q.log.run(now(), user.login, m[1], `Загружен файл ${f.name}`);
      return send(res, 200, f, origin);
    }
    m = /^\/files\/([A-Za-z0-9_-]+)$/.exec(path);
    if (m && req.method === "GET") {
      const f = q.fileGet.get(m[1]);
      if (!f || !existsSync(join(FILES_DIR, f.id))) return send(res, 404, { error: "Файл не найден" }, origin);
      res.writeHead(200, { "content-type": f.mime, "content-length": f.size, "cache-control": "private, no-store", vary: "Origin",
        "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(f.name)}`, ...(origin ? { "access-control-allow-origin": origin, "access-control-expose-headers": "content-disposition" } : {}) });
      return createReadStream(join(FILES_DIR, f.id)).pipe(res);
    }
    if (m && req.method === "DELETE") {
      const f = q.fileGet.get(m[1]);
      if (!f) return send(res, 404, { error: "Файл не найден" }, origin);
      if (f.source === "claude") return send(res, 403, { error: "Файлы от Claude обновляются сами, их не удаляем" }, origin);
      q.fileDel.run(f.id); try { unlinkSync(join(FILES_DIR, f.id)); } catch { /* уже нет */ }
      q.log.run(now(), user.login, f.project_id, `Удалён файл ${f.name}`);
      return send(res, 200, { ok: true }, origin);
    }

    if (path === "/items" && req.method === "POST") {
      const it = addItem(user, await readJson(req));
      return it ? send(res, 200, it, origin) : send(res, 400, { error: "Пустой текст" }, origin);
    }
    m = /^\/items\/(\d+)$/.exec(path);
    if (m && req.method === "PATCH") {
      const it = patchItem(user, Number(m[1]), await readJson(req));
      return it ? send(res, 200, it, origin) : send(res, 404, { error: "Не найдено" }, origin);
    }
    if (m && req.method === "DELETE") {
      const it = q.item.get(Number(m[1]));
      if (!it) return send(res, 404, { error: "Не найдено" }, origin);
      if (it.author !== user.login) return send(res, 403, { error: "Удалить может только автор" }, origin);
      q.itemDel.run(it.id);
      return send(res, 200, { ok: true, item: it }, origin);
    }
    if (path === "/items/restore" && req.method === "POST") {
      const b = await readJson(req);
      const it = b.item;
      if (!it || it.author !== user.login) return send(res, 400, { error: "Нечего вернуть" }, origin);
      const r = db.prepare(`INSERT INTO items (kind, author, text, reply, project_id, date, status, created_at, updated_at, done_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(it.kind === "note" ? "note" : "task", user.login, clip(it.text, 4000), clip(it.reply, 2000),
        clip(it.project_id, 80), clip(it.date, 10), ITEM_STATUSES.includes(it.status) ? it.status : "todo", clip(it.created_at, 40) || now(), now(), clip(it.done_at, 40));
      return send(res, 200, q.item.get(r.lastInsertRowid), origin);
    }
    return send(res, 404, { error: "not found" }, origin);
  } catch (e) {
    if (e.code === 413) return send(res, 413, { error: "Слишком большой запрос" }, origin);
    if (e instanceof SyntaxError) return send(res, 400, { error: "Плохой JSON" }, origin);
    console.error(e);
    return send(res, 500, { error: "Ошибка сервера" }, origin);
  }
});

server.listen(PORT, "127.0.0.1", () => console.log(`shturman on 127.0.0.1:${PORT}`));
