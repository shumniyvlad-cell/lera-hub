#!/usr/bin/env node
// Синк «Штурмана» с памятью Claude на маке Влада.
//   node sync.mjs              — отправить проекты (новые лягут Лере во входящие)
//   node sync.mjs --dry        — показать, что уйдёт, ничего не отправляя
//   node sync.mjs dropped      — что Лера отметила «Не работаем»
//   node sync.mjs purge        — по каждому такому проекту спросить и удалить его память (в Корзину)
//   node sync.mjs note "текст" [--date 2026-11-19] [--project id] — заметка Лере в план
// Ключ и адрес: ~/.config/shturman/env (SHTURMAN_API, SHTURMAN_SYNC_KEY).
import { readFileSync, readdirSync, statSync, existsSync, renameSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";

const HERE = dirname(fileURLToPath(import.meta.url));
const MEM = process.env.SHTURMAN_MEMORY || join(homedir(), ".claude/projects/-Users-vladshuma-Documents-New-project/memory");
const ENV_FILE = join(homedir(), ".config/shturman/env");
const env = { ...readEnv(ENV_FILE), ...process.env };
const API = (env.SHTURMAN_API || "https://marchvlv.ru/shturman-api").replace(/\/$/, "");
const KEY = env.SHTURMAN_SYNC_KEY || "";
const map = JSON.parse(readFileSync(join(HERE, "map.json"), "utf8"));

function readEnv(f) {
  if (!existsSync(f)) return {};
  return Object.fromEntries(readFileSync(f, "utf8").split("\n")
    .map((l) => l.trim()).filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^["']|["']$/g, "")]));
}

// ── память → проекты ──
function titlesFromIndex() {
  const out = {};
  const f = join(MEM, "MEMORY.md");
  if (!existsSync(f)) return out;
  for (const m of readFileSync(f, "utf8").matchAll(/^- \[([^\]]+)\]\(([^)]+)\.md\)/gm)) out[m[2]] = m[1];
  return out;
}

function parseMemory(file) {
  const raw = readFileSync(join(MEM, file + ".md"), "utf8");
  const fm = /^---\n([\s\S]*?)\n---\n?/.exec(raw);
  const head = fm ? fm[1] : "";
  const body = fm ? raw.slice(fm[0].length) : raw;
  const description = (/^description:\s*(.*)$/m.exec(head)?.[1] || "").replace(/^["']|["']$/g, "").replace(/\\"/g, '"');
  const modified = /modified:\s*(\S+)/.exec(head)?.[1] || "";
  const mtime = statSync(join(MEM, file + ".md")).mtime.toISOString();
  return { file, description, body, mtime: modified > mtime ? modified : mtime };
}

// строки с доступами, ключами и адресами серверов на сайт не уходят
const SECRET = /(парол|password|passwd|токен|token|ключ|key=|api[_ -]?key|secret|секрет|\.env\b|ssh\s|root@|id_ed25519|api_id|bearer|cookie|кук[аиу]|доступ[ыа]? в|basic-auth|ACCESS\.txt|долг|прожиточн)/i;
function redact(text) {
  return text.split("\n")
    .filter((l) => !SECRET.test(l))
    .map((l) => l
      .replace(/\b\d{1,3}(\.\d{1,3}){3}\b(:\d+)?/g, "сервер")
      .replace(/\[\[([^\]]+)\]\]/g, "$1")
      .replace(/\*\*(Why|How to apply):\*\*/g, (_, w) => (w === "Why" ? "**Почему:**" : "**Как применять:**")))
    .join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function linksFrom(text) {
  const seen = new Set();
  const out = [];
  const add = (url, label) => {
    url = url.replace(/[).,;:»"'`]+$/, "");
    label = label.replace(/[).,;:»"'`]+$/, "");
    if (/#key=|token|\/enter\/|key=|\/api\//i.test(url)) return;
    if (/^https?:\/\/(www\.)?(github\.io|github\.com|reg\.ru|t\.me|instagram\.com|threads\.net|zoom\.us|google\.com|youtube\.com|sslip\.io|beget\.com|aeza\.net)\/?$/i.test(url)) return;
    if (/\d{1,3}(\.\d{1,3}){3}/.test(url) && !/sslip\.io/.test(url)) return;
    if (seen.has(url)) return;
    seen.add(url);
    out.push({ label, url });
  };
  for (const m of text.matchAll(/https?:\/\/[^\s<>`"'«»)\]]+/g)) add(m[0], prettyLabel(m[0]));
  for (const m of text.matchAll(/(?<![\w/.@-])((?:[a-z0-9-]+\.)+(?:ru|online|com|kz|io|expert|pro|app|dev)(?:\/[^\s<>`"'«»)\],;]*)?)/gi)) {
    if (/\.(md|js|mjs|json|py|sh|png|jpg|html|txt|db|sqlite)$/i.test(m[1]) || /^(node|package|index|server)\./i.test(m[1])) continue;
    add("https://" + m[1], prettyLabel(m[1]));
  }
  for (const m of text.matchAll(/(?<![\w/.])@([A-Za-z0-9_]{4,}bot)\b/g)) add(`https://t.me/${m[1]}`, "@" + m[1]);
  return out.slice(0, 20);
}
function prettyLabel(url) {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "").slice(0, 60);
}

function collect() {
  const titles = titlesFromIndex();
  const excluded = new Set(map.exclude);
  const files = readdirSync(MEM).filter((f) => /^project[-_].+\.md$/.test(f)).map((f) => f.replace(/\.md$/, "")).filter((f) => !excluded.has(f));
  const groups = new Map();
  const groupOf = (f) => map.groups.find((g) => g.files?.includes(f)) || map.groups.find((g) => g.prefixes?.some((p) => f.startsWith(p)));
  for (const f of files) {
    const g = groupOf(f);
    const id = g ? g.id : f.replace(/^project[-_]/, "");
    if (!groups.has(id)) groups.set(id, { def: g, files: [] });
    groups.get(id).files.push(parseMemory(f));
  }
  const out = [];
  for (const [id, { def, files: mem }] of groups) {
    mem.sort((a, b) => b.mtime.localeCompare(a.mtime));
    const fileTitle = (m) => titles[m.file] || m.description.split(/[—:(]/)[0].trim() || m.file;
    const body = mem.map((m) => `### ${fileTitle(m)}\n\n${redact(m.body)}`).join("\n\n");
    const summary = mem.map((m) => redact(m.description)).filter(Boolean).join("\n");
    out.push({
      id,
      title: def?.title || fileTitle(mem[0]),
      kind: def?.kind || guessKind(mem.map((m) => m.description).join(" ")),
      client: def?.client || "",
      stage: def?.stage || "",
      status: def?.status || "active",
      drop_reason: def?.drop_reason || "",
      next_step: def?.next_step || "",
      seed: !!def,
      summary,
      body,
      links: linksFrom(mem.map((m) => m.description + "\n" + m.body).join("\n")),
      files: mem.map((m) => m.file),
      mem_updated_at: mem[0].mtime,
    });
  }
  return out;
}
function guessKind(text) {
  if (/свой продукт|продукт Влада|Влада:/i.test(text)) return "own";
  if (/сервер|бот-помощник|инструмент|шаблон/i.test(text) && !/клиент/i.test(text)) return "tools";
  return "client";
}

// ── сеть ──
async function call(path, init = {}) {
  if (!KEY) throw new Error(`Нет ключа синка: ${ENV_FILE} → SHTURMAN_SYNC_KEY`);
  const r = await fetch(API + path, {
    ...init,
    headers: { "content-type": "application/json", "x-sync-key": KEY, ...(init.headers || {}) },
    signal: AbortSignal.timeout(30_000),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${r.status} ${path}: ${text.slice(0, 200)}`);
  return JSON.parse(text);
}

function arg(name) {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
}

// ── удаление памяти после «Не работаем» ──
function removeFromIndex(files) {
  const f = join(MEM, "MEMORY.md");
  const lines = readFileSync(f, "utf8").split("\n");
  const keep = lines.filter((l) => !files.some((x) => l.includes(`(${x}.md)`)));
  if (keep.length !== lines.length) writeFileSync(f, keep.join("\n"));
  return lines.length - keep.length;
}
function toTrash(file) {
  const src = join(MEM, file + ".md");
  if (!existsSync(src)) return false;
  const trash = join(homedir(), ".Trash");
  mkdirSync(trash, { recursive: true });
  renameSync(src, join(trash, `${basename(file)}-${Date.now()}.md`));
  return true;
}

async function main() {
  const cmd = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : "push";
  if (cmd === "push") {
    const projects = collect();
    if (process.argv.includes("--dry")) {
      for (const p of projects) console.log(`${p.seed ? "  " : "+ "}${p.kind.padEnd(6)} ${p.stage.padEnd(12)} ${p.title}  [${p.files.length}]  ${p.links.length} ссылок`);
      console.log(`всего ${projects.length}, без разметки (во входящие) ${projects.filter((p) => !p.seed).length}`);
      return;
    }
    const r = await call("/sync", { method: "POST", body: JSON.stringify({ projects }) });
    console.log(`${new Date().toLocaleString("ru-RU")}: отправлено ${projects.length}, новых ${r.added}, обновлено ${r.updated}, ждут удаления ${r.dropped.length}`);
    for (const d of r.dropped) console.log(`  · ${d.title} — ${d.drop_reason || "без причины"}`);
    return;
  }
  if (cmd === "dropped") {
    const r = await call("/sync/dropped");
    if (!r.dropped.length) return console.log("Лера ничего не отметила «Не работаем».");
    for (const d of r.dropped) console.log(`${d.title}  (${d.id})\n  причина: ${d.drop_reason || "—"}\n  файлы: ${d.files.join(", ") || "—"}`);
    return;
  }
  if (cmd === "purge") {
    const r = await call("/sync/dropped");
    if (!r.dropped.length) return console.log("Удалять нечего.");
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const done = [];
    for (const d of r.dropped) {
      console.log(`\n${d.title}\n  причина Леры: ${d.drop_reason || "—"}\n  память: ${d.files.join(", ") || "файлов нет"}`);
      const a = (await rl.question("  Удалить память по проекту? Файлы уйдут в Корзину [y/N] ")).trim().toLowerCase();
      if (a !== "y" && a !== "д") continue;
      let moved = 0;
      for (const f of d.files) if (toTrash(f)) moved++;
      const lines = removeFromIndex(d.files);
      console.log(`  в Корзине ${moved} файл(ов), из MEMORY.md убрано строк: ${lines}`);
      done.push(d.id);
    }
    rl.close();
    if (done.length) {
      await call("/sync/purged", { method: "POST", body: JSON.stringify({ ids: done }) });
      console.log(`\nГотово: ${done.length}. Папки с кодом не трогал — их удаляй сам, если нужно.`);
    }
    return;
  }
  if (cmd === "note") {
    const text = process.argv.slice(3).filter((x, i, a) => !x.startsWith("--") && !(a[i - 1] || "").startsWith("--")).join(" ").trim();
    if (!text) throw new Error('Пустая заметка: node sync.mjs note "текст"');
    const date = arg("--date") || new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10);
    const it = await call("/sync/note", { method: "POST", body: JSON.stringify({ text, date, project_id: arg("--project") || "" }) });
    console.log(`Заметка #${it.id} ушла Лере на ${it.date}`);
    return;
  }
  throw new Error(`Не знаю команду ${cmd}`);
}

main().catch((e) => {
  console.error("Синк не прошёл:", e.message);
  process.exit(1);
});
