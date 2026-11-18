// Общее состояние: всё приходит одним запросом /state, правки уходят сразу и подменяют строку у себя.
import {useSyncExternalStore} from 'react';
import {api, ApiError, token} from './api';
import type {Item, Me, Project, State} from './model';

export type Load = {kind: 'anon'} | {kind: 'loading'} | {kind: 'error'; message: string} | {kind: 'ready'; data: State};

let load: Load = token.get() ? {kind: 'loading'} : {kind: 'anon'};
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
const set = (next: Load) => { load = next; emit(); };

export function useLoad() {
  return useSyncExternalStore((f) => (subs.add(f), () => subs.delete(f)), () => load);
}
export function useData(): State {
  const l = useLoad();
  if (l.kind !== 'ready') throw new Error('state not ready');
  return l.data;
}

function patchData(fn: (d: State) => State) {
  if (load.kind === 'ready') set({kind: 'ready', data: fn(load.data)});
}

function onFail(e: unknown): never {
  if (e instanceof ApiError && e.status === 401) { token.set(''); set({kind: 'anon'}); }
  throw e;
}

export async function refresh(quiet = false) {
  if (!token.get()) return set({kind: 'anon'});
  if (!quiet || load.kind !== 'ready') set({kind: 'loading'});
  try {
    set({kind: 'ready', data: await api.state()});
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) { token.set(''); return set({kind: 'anon'}); }
    if (load.kind !== 'ready') set({kind: 'error', message: e instanceof Error ? e.message : 'Ошибка'});
  }
}

export async function signIn(login: string, password: string): Promise<Me> {
  const r = await api.login(login, password);
  token.set(r.token);
  await refresh();
  return r.me;
}
export async function signOut() {
  await api.logout();
  token.set('');
  set({kind: 'anon'});
}

export async function saveProject(id: string, patch: Record<string, unknown>) {
  const p = await api.patchProject(id, patch).catch(onFail);
  patchData((d) => ({...d, projects: d.projects.map((x) => (x.id === id ? p : x))}));
  refreshActivitySoon();
  return p;
}
export async function createProject(p: Partial<Project>) {
  const made = await api.createProject(p).catch(onFail);
  patchData((d) => ({...d, projects: [made, ...d.projects]}));
  return made;
}
export async function addItem(i: Partial<Item>) {
  const it = await api.addItem(i).catch(onFail);
  patchData((d) => ({...d, items: [...d.items, it]}));
  return it;
}
export async function saveItem(id: number, patch: Partial<Item>) {
  // сначала у себя, чтобы галочка ставилась мгновенно
  patchData((d) => ({...d, items: d.items.map((x) => (x.id === id ? {...x, ...patch, done_at: patch.status === 'done' ? new Date().toISOString() : patch.status ? '' : x.done_at} : x))}));
  const it = await api.patchItem(id, patch).catch((e) => { refresh(true); return onFail(e); });
  patchData((d) => ({...d, items: d.items.map((x) => (x.id === id ? it : x))}));
  return it;
}
export async function deleteItem(id: number) {
  const r = await api.deleteItem(id).catch(onFail);
  patchData((d) => ({...d, items: d.items.filter((x) => x.id !== id)}));
  return r.item;
}
export async function restoreItem(item: Item) {
  const it = await api.restoreItem(item).catch(onFail);
  patchData((d) => ({...d, items: [...d.items, it]}));
}

let actTimer = 0;
function refreshActivitySoon() {
  clearTimeout(actTimer);
  actTimer = window.setTimeout(() => refresh(true), 600);
}

// тема: системная или выбранная, хранится только в этом браузере
export type Mode = 'system' | 'light' | 'dark';
let mode: Mode = (() => { try { return (localStorage.getItem('shturman:mode') as Mode) || 'dark'; } catch { return 'dark'; } })();
const modeSubs = new Set<() => void>();
export function useMode() {
  return useSyncExternalStore((f) => (modeSubs.add(f), () => modeSubs.delete(f)), () => mode);
}
export function setMode(m: Mode) {
  mode = m;
  try { localStorage.setItem('shturman:mode', m); } catch { /* пусто */ }
  modeSubs.forEach((f) => f());
}

export async function uploadFile(projectId: string, file: File) {
  const f = await api.upload(projectId, file).catch(onFail);
  patchData((d) => ({...d, attachments: d.attachments.some((x) => x.id === f.id) ? d.attachments : [...d.attachments, f]}));
  refreshActivitySoon();
  return f;
}
export async function removeFile(id: string) {
  await api.deleteFile(id).catch(onFail);
  patchData((d) => ({...d, attachments: d.attachments.filter((x) => x.id !== id)}));
}
