// Типы, этапы и регламент «Штурмана». Регламент — что Лера делает на каждом этапе, где это лежит и когда этап закрыт.

export type Kind = 'client' | 'own' | 'tools';
export type Status = 'inbox' | 'active' | 'dropped' | 'purged';
export type Link = {label: string; url: string};
export type Check = {id: string; text: string; done: boolean};

export type Project = {
  id: string;
  title: string;
  kind: Kind;
  client: string;
  stage: string;
  status: Status;
  summary: string;
  body: string;
  links: Link[];
  files: string[];
  next_step: string;
  notes: string;
  checklist: Check[];
  source: 'memory' | 'manual';
  is_fresh: boolean;
  drop_reason: string;
  dropped_at: string;
  purged_at: string;
  mem_updated_at: string;
  synced_at: string;
  created_at: string;
  updated_at: string;
};

export type Item = {
  id: number;
  kind: 'note' | 'task';
  author: 'lera' | 'vlad' | string;
  text: string;
  reply: string;
  project_id: string;
  date: string;
  status: 'todo' | 'doing' | 'done';
  created_at: string;
  updated_at: string;
  done_at: string;
};

export type Activity = {id: number; at: string; who: string; project_id: string; text: string};
export type Me = {login: string; name: string; role: 'lera' | 'vlad'};

export type State = {
  me: Me;
  kinds: Kind[];
  stages: Record<Kind, string[]>;
  projects: Project[];
  purged: Pick<Project, 'id' | 'title' | 'kind' | 'client' | 'drop_reason' | 'dropped_at' | 'purged_at'>[];
  items: Item[];
  activity: Activity[];
  lastSync: {at: string; added: number; updated: number} | null;
  serverTime: string;
};

export const KIND_NAME: Record<Kind, string> = {client: 'Продюсирование', own: 'Продукты Влада', tools: 'Кухня'};
export const KIND_HINT: Record<Kind, string> = {
  client: 'Эксперты, которых Влад ведёт к запуску',
  own: 'Что Влад запускает сам как эксперт',
  tools: 'Наши боты, серверы и шаблоны',
};

export type Guide = {stage: string; what: string; where: string; done: string; checklist: string[]};

export const GUIDE: Record<Kind, Guide[]> = {
  client: [
    {stage: 'Знакомство', what: 'Созвон-распаковка с экспертом: кто он, что продаёт, сколько зарабатывает, чего хочет.',
      where: 'Zoom, записи и расшифровки в облаке Влада. Контакты и соцсети клиента — в карточку проекта.',
      done: 'Есть расшифровка созвона и Влад сказал «берём».',
      checklist: ['Назначить созвон в Zoom', 'Собрать соцсети и ссылки клиента', 'Скачать расшифровку созвона', 'Узнать у Влада: берём или нет']},
    {stage: 'Стратегия', what: 'Влад с Claude собирает стратегию: продукт, цена, воронка, площадки. Лера следит за сроком и отправкой.',
      where: 'PDF стратегии и сайт-черновик, ссылки — в карточке.',
      done: 'Клиент согласовал стратегию и оплатил.',
      checklist: ['Получить PDF стратегии от Влада', 'Отправить клиенту и собрать правки', 'Подтвердить оплату', 'Договориться о дате запуска']},
    {stage: 'Упаковка', what: 'Сайт, бот, кодовые слова в Instagram, оплата, домен, продукт.',
      where: 'Сайт на GitHub Pages или marchvlv.ru, боты в Telegram, кодовые слова в Chatplace, оплата Lava.',
      done: 'Можно купить: каждая кнопка ведёт куда надо, оплата проходит.',
      checklist: ['Сайт согласован клиентом', 'Бот отвечает и выдаёт заявку', 'Кодовое слово в Chatplace работает', 'Оплата проходит тестом', 'Домен подключён']},
    {stage: 'Запуск', what: 'Прогрев и продажи. Влад гоняет проверку «Запускать», Лера держит контент-план и сроки.',
      where: 'Контент-план, эфиры, сторис клиента; заявки в боте.',
      done: 'Поток продаж закрыт, есть цифры: заявки, оплаты, выручка.',
      checklist: ['Прогнать «Запускать» с Владом', 'Контент-план на неделю у клиента', 'Эфир или вебинар в календаре', 'Считать заявки и оплаты каждый день']},
    {stage: 'Ведём', what: 'Сопровождение после запуска: контент, лиды, отчёт клиенту, следующий поток.',
      where: 'Отчёты, таблицы лидов, бот клиента.',
      done: 'Договорились о следующем потоке или закрыли работу.',
      checklist: ['Отчёт клиенту раз в неделю', 'Проверить, что бот и оплата живы', 'Посчитать % с запуска']},
    {stage: 'Пауза', what: 'Сейчас ничего не делаем. Раз в две недели проверить, не пора ли вернуть или закрыть.',
      where: '—', done: 'Решили: вернуть в работу или «Не работаем».', checklist: ['Спросить Влада: вернуть или закрыть']},
  ],
  own: [
    {stage: 'Идея', what: 'Влад придумал продукт. Записать суть, для кого и сколько стоит.', where: 'Заметки Влада, память Claude.',
      done: 'Влад решил собирать.', checklist: ['Записать суть в одну строку', 'Для кого и цена']},
    {stage: 'Сборка', what: 'Собираем лендинг, бота, оплату и сам продукт.', where: 'Лендинг на marchvlv.ru, бот, Lava.',
      done: 'Можно купить.', checklist: ['Лендинг', 'Бот выдаёт продукт', 'Оплата Lava', 'Кодовое слово']},
    {stage: 'Тест продаж', what: 'Первые продажи: посты, сторис, Threads. Считаем, сколько купили.', where: 'Соцсети Влада, отчёт Lava.',
      done: 'Первые оплаты пришли или решили менять оффер.', checklist: ['Пост или тред с оффером', 'Считать переходы и оплаты']},
    {stage: 'Продаётся', what: 'Продукт живой. Следить, что всё работает и продажи идут.', where: 'Lava, бот, лендинг.',
      done: '—', checklist: ['Раз в неделю: оплаты и заявки', 'Бот и ссылки живы']},
    {stage: 'Пауза', what: 'Отложили.', where: '—', done: 'Вернуть или закрыть.', checklist: ['Спросить Влада: вернуть или закрыть']},
  ],
  tools: [
    {stage: 'В сборке', what: 'Влад с Claude собирает внутренний инструмент.', where: 'Серверы Aeza, папки проекта.', done: 'Работает каждый день.', checklist: []},
    {stage: 'Работает', what: 'Инструмент работает. Если сломался — написать Владу.', where: 'Ссылки в карточке.', done: '—', checklist: ['Проверить, что открывается']},
    {stage: 'Пауза', what: 'Выключен или не нужен.', where: '—', done: 'Вернуть или закрыть.', checklist: []},
  ],
};

export const guideFor = (kind: Kind, stage: string) => GUIDE[kind].find((g) => g.stage === stage);

// ── даты в часовом поясе Москвы, без библиотек ──
const TZ = 'Europe/Moscow';
export const todayISO = (d = new Date()) => new Intl.DateTimeFormat('en-CA', {timeZone: TZ}).format(d);
export const addDays = (iso: string, n: number) => {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
export const weekStart = (iso: string) => {
  const d = new Date(iso + 'T12:00:00Z');
  return addDays(iso, -((d.getUTCDay() + 6) % 7));
};
export const dayLabel = (iso: string, opts: Intl.DateTimeFormatOptions = {weekday: 'short', day: 'numeric', month: 'short'}) =>
  new Intl.DateTimeFormat('ru-RU', {...opts, timeZone: 'UTC'}).format(new Date(iso + 'T12:00:00Z'));
export const ago = (at: string) => {
  if (!at) return '';
  const s = (Date.now() - new Date(at).getTime()) / 1000;
  if (s < 90) return 'только что';
  if (s < 3600) return `${Math.round(s / 60)} мин назад`;
  if (s < 86400) return `${Math.round(s / 3600)} ч назад`;
  if (s < 86400 * 7) return `${Math.round(s / 86400)} дн назад`;
  return new Intl.DateTimeFormat('ru-RU', {day: 'numeric', month: 'short', timeZone: TZ}).format(new Date(at));
};
export const greeting = () => {
  const h = Number(new Intl.DateTimeFormat('en-GB', {hour: 'numeric', hour12: false, timeZone: TZ}).format(new Date()));
  return h < 5 ? 'Доброй ночи' : h < 12 ? 'Доброе утро' : h < 18 ? 'Добрый день' : 'Добрый вечер';
};
export const plural = (n: number, one: string, few: string, many: string) => {
  const m10 = n % 10, m100 = n % 100;
  return m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many;
};
