// Клиент API «Штурмана». Токен входа живёт в localStorage этого браузера.
import type {Item, Project, State} from './model';

const BASE = (import.meta.env.VITE_API as string | undefined) ??
  (location.hostname === 'localhost' || location.hostname === '127.0.0.1' ? 'http://localhost:8841' : 'https://marchvlv.ru/shturman-api');
const KEY = 'shturman:token';

export const token = {
  get: () => { try { return localStorage.getItem(KEY) || ''; } catch { return ''; } },
  set: (t: string) => { try { t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY); } catch { /* приватный режим */ } },
};

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  let r: Response;
  try {
    r = await fetch(BASE + path, {
      ...init,
      headers: {'content-type': 'application/json', ...(token.get() ? {authorization: `Bearer ${token.get()}`} : {}), ...init.headers},
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new ApiError(0, 'Нет связи с сервером. Проверь интернет и нажми «Повторить».');
  }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new ApiError(r.status, data.error || `Ошибка ${r.status}`);
  return data as T;
}
const body = (b: unknown) => JSON.stringify(b);

export const api = {
  login: (login: string, password: string) => call<{token: string; me: State['me']}>('/login', {method: 'POST', body: body({login, password})}),
  logout: () => call('/logout', {method: 'POST'}).catch(() => null),
  state: () => call<State>('/state'),
  createProject: (p: Partial<Project>) => call<Project>('/projects', {method: 'POST', body: body(p)}),
  patchProject: (id: string, p: Record<string, unknown>) => call<Project>(`/projects/${id}`, {method: 'PATCH', body: body(p)}),
  addItem: (i: Partial<Item>) => call<Item>('/items', {method: 'POST', body: body(i)}),
  patchItem: (id: number, i: Partial<Item>) => call<Item>(`/items/${id}`, {method: 'PATCH', body: body(i)}),
  deleteItem: (id: number) => call<{ok: true; item: Item}>(`/items/${id}`, {method: 'DELETE'}),
  restoreItem: (item: Item) => call<Item>('/items/restore', {method: 'POST', body: body({item})}),
};
