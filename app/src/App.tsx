import {lazy, Suspense, useEffect, useMemo, useState} from 'react';
import {BottomSheet} from '@astryxdesign/core/BottomSheet';
import {VStack} from '@astryxdesign/core/VStack';
import {HStack} from '@astryxdesign/core/HStack';
import {Text} from '@astryxdesign/core/Text';
import {Button} from '@astryxdesign/core/Button';
import {Banner} from '@astryxdesign/core/Banner';
import {Skeleton} from '@astryxdesign/core/Skeleton';
import {Avatar} from '@astryxdesign/core/Avatar';
import {CommandPalette} from '@astryxdesign/core/CommandPalette';
import {createStaticSource} from '@astryxdesign/core/Typeahead';
import {
  SunIcon, InboxArrowDownIcon, BriefcaseIcon, RocketLaunchIcon, WrenchScrewdriverIcon, CalendarDaysIcon,
  ChatBubbleLeftEllipsisIcon, BookOpenIcon, ArchiveBoxIcon, MagnifyingGlassIcon, ArrowRightStartOnRectangleIcon, MoonIcon, Bars3Icon,
} from '@heroicons/react/24/outline';
import {refresh, setMode, signOut, useData, useLoad, useMode} from './store';
import {KIND_NAME, todayISO, type Kind} from './model';
import {Login} from './screens/Login';
import {Today} from './screens/Today';
import {useSheetBack} from './useSheetBack';
import {useTilt} from './useTilt';

const Projects = lazy(() => import('./screens/Projects').then((m) => ({default: m.Projects})));
const Inbox = lazy(() => import('./screens/Inbox').then((m) => ({default: m.Inbox})));
const Tracker = lazy(() => import('./screens/Tracker').then((m) => ({default: m.Tracker})));
const Notes = lazy(() => import('./screens/Notes').then((m) => ({default: m.Notes})));
const Archive = lazy(() => import('./screens/Archive').then((m) => ({default: m.Archive})));
const Guide = lazy(() => import('./screens/Guide').then((m) => ({default: m.Guide})));
const ProjectDrawer = lazy(() => import('./ProjectDrawer').then((m) => ({default: m.ProjectDrawer})));

export type Route = 'today' | 'inbox' | 'client' | 'own' | 'tools' | 'tracker' | 'notes' | 'guide' | 'archive';
const ROUTES: Route[] = ['today', 'inbox', 'client', 'own', 'tools', 'tracker', 'notes', 'guide', 'archive'];
const fromHash = (): Route => {
  const r = location.hash.replace(/^#\/?/, '').split('?')[0] as Route;
  return ROUTES.includes(r) ? r : 'today';
};
export const go = (r: Route) => { location.hash = `/${r}`; };

export default function App() {
  const load = useLoad();
  if (load.kind === 'anon') return <Login />;
  if (load.kind === 'loading') return <Booting />;
  if (load.kind === 'error') {
    return (
      <VStack className="center" gap={4} padding={6}>
        <Banner status="error" title="Не получилось открыть Штурман" description={load.message}
          endContent={<Button label="Повторить" variant="secondary" size="sm" onClick={() => refresh()} />} />
      </VStack>
    );
  }
  return <Shell />;
}

export function Scene() {
  return (
    <figure className="scene" aria-hidden="true">
      <i className="scene__moon" />
      <i className="scene__beam" />
    </figure>
  );
}

function Booting() {
  return (
    <VStack className="center" gap={3} padding={6} aria-busy="true" aria-label="Загружаем проекты…">
      {[0, 1, 2].map((i) => <Skeleton key={i} height={56} radius={3} index={i} width="100%" />)}
    </VStack>
  );
}

function Shell() {
  const data = useData();
  const mode = useMode();
  const [route, setRoute] = useState<Route>(fromHash);
  const [openId, setOpenId] = useState<string | null>(null);
  const [isSearch, setIsSearch] = useState(false);
  const [isMenu, setIsMenu] = useState(false);
  useSheetBack(openId !== null, () => setOpenId(null));
  useSheetBack(isMenu, () => setIsMenu(false));
  useTilt();

  useEffect(() => {
    const on = () => { setRoute(fromHash()); scrollTo({top: 0}); };
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setIsSearch((v) => !v); }
    };
    addEventListener('keydown', on);
    return () => removeEventListener('keydown', on);
  }, []);
  // раз в 5 минут подтягиваем свежее, пока вкладка открыта
  useEffect(() => {
    const t = setInterval(() => document.visibilityState === 'visible' && refresh(true), 5 * 60_000);
    return () => clearInterval(t);
  }, []);

  const count = useMemo(() => {
    const today = todayISO();
    const live = data.projects.filter((p) => p.status === 'active');
    return {
      inbox: data.projects.filter((p) => p.status === 'inbox').length,
      dropped: data.projects.filter((p) => p.status === 'dropped').length,
      notes: data.items.filter((i) => i.kind === 'note' && i.status !== 'done').length,
      today: data.items.filter((i) => i.status !== 'done' && i.date && i.date <= today).length,
      kind: (k: Kind) => live.filter((p) => p.kind === k).length,
      fresh: (k: Kind) => live.filter((p) => p.kind === k && p.is_fresh).length,
    };
  }, [data]);

  const source = useMemo(() => createStaticSource(
    data.projects.filter((p) => p.status !== 'purged').map((p) => ({id: p.id, label: p.title, auxiliaryData: p})),
    {keywords: (i) => [i.auxiliaryData.client, i.auxiliaryData.stage, i.auxiliaryData.summary.slice(0, 300)]},
  ), [data.projects]);

  const open = (id: string) => setOpenId(id);
  const nav: {r: Route; label: string; icon: typeof SunIcon; n?: number; hot?: boolean}[][] = [
    [
      {r: 'today', label: 'Сегодня', icon: SunIcon, n: count.today, hot: true},
      {r: 'inbox', label: 'Входящие', icon: InboxArrowDownIcon, n: count.inbox, hot: true},
      {r: 'notes', label: 'Заметки Влада', icon: ChatBubbleLeftEllipsisIcon, n: count.notes},
      {r: 'tracker', label: 'Трекер недели', icon: CalendarDaysIcon},
    ],
    [
      {r: 'client', label: KIND_NAME.client, icon: BriefcaseIcon, n: count.kind('client')},
      {r: 'own', label: KIND_NAME.own, icon: RocketLaunchIcon, n: count.kind('own')},
      {r: 'tools', label: KIND_NAME.tools, icon: WrenchScrewdriverIcon, n: count.kind('tools')},
    ],
    [
      {r: 'guide', label: 'Регламент', icon: BookOpenIcon},
      {r: 'archive', label: 'Не работаем', icon: ArchiveBoxIcon, n: count.dropped},
    ],
  ];
  const GROUPS = ['День', 'Проекты', 'Порядок'];
  const isProjects = route === 'client' || route === 'own' || route === 'tools';
  const dock: {r: Route; label: string; icon: typeof SunIcon; n?: number}[] = [
    {r: 'today', label: 'Сегодня', icon: SunIcon},
    {r: 'inbox', label: 'Входящие', icon: InboxArrowDownIcon, n: count.inbox},
    {r: 'client', label: 'Проекты', icon: BriefcaseIcon},
    {r: 'tracker', label: 'Неделя', icon: CalendarDaysIcon},
    {r: 'notes', label: 'Заметки', icon: ChatBubbleLeftEllipsisIcon, n: count.notes},
  ];

  return (
    <>
      <Scene />
      <aside className="rail glass" aria-label="Разделы">
        <a className="brand" href="#/today" aria-label="Штурман, на главную">
          <img src="./favicon.svg" width={30} height={30} alt="" />
          <span>Штурман</span>
        </a>
        <button type="button" className="find" onClick={() => setIsSearch(true)}>
          <MagnifyingGlassIcon aria-hidden="true" />
          <span>Найти проект</span>
          <kbd>⌘K</kbd>
        </button>
        <nav className="rail__nav">
          {nav.map((group, gi) => (
            <section key={GROUPS[gi]} aria-label={GROUPS[gi]}>
              <p className="rail__group">{GROUPS[gi]}</p>
              {group.map((n) => {
                const I = n.icon;
                return (
                  <a key={n.r} href={`#/${n.r}`} className="navi" aria-current={route === n.r ? 'page' : undefined}>
                    <I aria-hidden="true" />
                    <span>{n.label}</span>
                    {!!n.n && <em className={n.hot ? 'is-hot' : ''}>{n.n}</em>}
                  </a>
                );
              })}
            </section>
          ))}
        </nav>
        <footer className="rail__me">
          <Avatar name={data.me.name} size="sm" tooltip={false} />
          <span>{data.me.name}</span>
          <Button label={mode === 'light' ? 'Ночная тема' : 'Дневная тема'} variant="ghost" size="sm" isIconOnly
            icon={mode === 'light' ? <MoonIcon /> : <SunIcon />} onClick={() => setMode(mode === 'light' ? 'dark' : 'light')} />
          <Button label="Выйти" variant="ghost" size="sm" isIconOnly icon={<ArrowRightStartOnRectangleIcon />} onClick={signOut} />
        </footer>
      </aside>

      <header className="topbar glass">
        <a className="brand" href="#/today" aria-label="Штурман, на главную">
          <img src="./favicon.svg" width={28} height={28} alt="" />
          <span>Штурман</span>
        </a>
        <HStack gap={1}>
          <Button label="Найти проект" variant="ghost" isIconOnly icon={<MagnifyingGlassIcon />} onClick={() => setIsSearch(true)} />
          <Button label="Все разделы" variant="ghost" isIconOnly icon={<Bars3Icon />} onClick={() => setIsMenu(true)} />
        </HStack>
      </header>

      <main className="content" id="content">
        <Suspense fallback={<Booting />}>
          {route === 'today' && <Today onOpen={open} />}
          {route === 'inbox' && <Inbox onOpen={open} />}
          {isProjects && <Projects kind={route} onOpen={open} />}
          {route === 'tracker' && <Tracker onOpen={open} />}
          {route === 'notes' && <Notes onOpen={open} />}
          {route === 'guide' && <Guide />}
          {route === 'archive' && <Archive onOpen={open} />}
        </Suspense>
      </main>

      <nav className="dock glass" aria-label="Главные разделы">
        {dock.map((d) => {
          const I = d.icon;
          const on = d.r === 'client' ? isProjects : route === d.r;
          return (
            <a key={d.r} href={`#/${d.r}`} className="dock__item" aria-current={on ? 'page' : undefined}>
              <I aria-hidden="true" />
              <span>{d.label}</span>
              {!!d.n && <em>{d.n}</em>}
            </a>
          );
        })}
      </nav>

      <BottomSheet isOpen={isMenu} onOpenChange={setIsMenu} label="Разделы" height="hug">
        <VStack gap={1} paddingBlockEnd={4}>
          {nav.flat().map((n) => {
            const I = n.icon;
            return (
              <a key={n.r} href={`#/${n.r}`} className="navi" aria-current={route === n.r ? 'page' : undefined} onClick={() => setIsMenu(false)}>
                <I aria-hidden="true" /><span>{n.label}</span>{!!n.n && <em>{n.n}</em>}
              </a>
            );
          })}
          <HStack gap={2} justify="between" vAlign="center" paddingBlockStart={3}>
            <Text color="secondary">{data.me.name}</Text>
            <HStack gap={2}>
              <Button label={mode === 'light' ? 'Ночная тема' : 'Дневная тема'} variant="secondary" size="sm" onClick={() => setMode(mode === 'light' ? 'dark' : 'light')} />
              <Button label="Выйти" variant="ghost" size="sm" onClick={signOut} />
            </HStack>
          </HStack>
        </VStack>
      </BottomSheet>

      <Suspense fallback={null}>
        <ProjectDrawer id={openId} onClose={() => setOpenId(null)} />
      </Suspense>

      <CommandPalette
        isOpen={isSearch}
        onOpenChange={setIsSearch}
        label="Поиск проекта"
        searchSource={source}
        emptySearchText="Такого проекта нет"
        emptyBootstrapText="Начни писать название, клиента или этап"
        onValueChange={(id) => { setIsSearch(false); open(id); }}
        renderItem={(i) => (
          <VStack gap={0}>
            <Text weight="medium">{i.label}</Text>
            <Text size="sm" color="secondary">
              {[KIND_NAME[i.auxiliaryData.kind], i.auxiliaryData.status === 'inbox' ? 'во входящих' : i.auxiliaryData.status === 'dropped' ? 'не работаем' : i.auxiliaryData.stage, i.auxiliaryData.client].filter(Boolean).join(', ')}
            </Text>
          </VStack>
        )}
      />
    </>
  );
}
