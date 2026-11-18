import {lazy, Suspense, useEffect, useMemo, useState} from 'react';
import {AppShell} from '@astryxdesign/core/AppShell';
import {SideNav, SideNavHeading, SideNavItem, SideNavSection} from '@astryxdesign/core/SideNav';
import {VStack} from '@astryxdesign/core/VStack';
import {HStack} from '@astryxdesign/core/HStack';
import {Text} from '@astryxdesign/core/Text';
import {Button} from '@astryxdesign/core/Button';
import {Badge} from '@astryxdesign/core/Badge';
import {Banner} from '@astryxdesign/core/Banner';
import {Skeleton} from '@astryxdesign/core/Skeleton';
import {Avatar} from '@astryxdesign/core/Avatar';
import {CommandPalette} from '@astryxdesign/core/CommandPalette';
import {createStaticSource} from '@astryxdesign/core/Typeahead';
import {
  SunIcon, InboxArrowDownIcon, BriefcaseIcon, RocketLaunchIcon, WrenchScrewdriverIcon, CalendarDaysIcon,
  ChatBubbleLeftEllipsisIcon, BookOpenIcon, ArchiveBoxIcon, MagnifyingGlassIcon, ArrowRightStartOnRectangleIcon, MoonIcon,
} from '@heroicons/react/24/outline';
import {refresh, setMode, signOut, useData, useLoad, useMode} from './store';
import {KIND_NAME, todayISO, type Kind} from './model';
import {Login} from './screens/Login';
import {Today} from './screens/Today';
import {useSheetBack} from './useSheetBack';

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
  useSheetBack(openId !== null, () => setOpenId(null));

  useEffect(() => {
    const on = () => { setRoute(fromHash()); document.querySelector('main')?.scrollTo({top: 0}); };
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
  const item = (r: Route, label: string, icon: typeof SunIcon, n?: number, tone?: 'accent') => (
    <SideNavItem label={label} icon={icon} isSelected={route === r} href={`#/${r}`}
      endContent={n ? <Badge label={String(n)} variant={tone ? 'teal' : 'neutral'} /> : undefined} />
  );

  return (
    <>
      <AppShell
        variant="elevated"
        contentPadding={0}
        sideNav={
          <SideNav
            header={<SideNavHeading heading="Штурман" icon={<img src="./favicon.svg" width={28} height={28} alt="" />} />}
            topContent={
              <Button label="Найти проект" variant="secondary" width="100%" icon={<MagnifyingGlassIcon />}
                onClick={() => setIsSearch(true)} />
            }
            footer={
              <HStack gap={2} vAlign="center" justify="between" paddingInline={2}>
                <HStack gap={2} vAlign="center">
                  <Avatar name={data.me.name} size="sm" tooltip={false} />
                  <Text weight="medium">{data.me.name}</Text>
                </HStack>
                <HStack gap={1}>
                  <Button label={mode === 'dark' ? 'Светлая тема' : 'Тёмная тема'} variant="ghost" size="sm" isIconOnly
                    icon={mode === 'dark' ? <SunIcon /> : <MoonIcon />}
                    onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')} />
                  <Button label="Выйти" variant="ghost" size="sm" isIconOnly icon={<ArrowRightStartOnRectangleIcon />} onClick={signOut} />
                </HStack>
              </HStack>
            }>
            <SideNavSection title="День">
              {item('today', 'Сегодня', SunIcon, count.today, 'accent')}
              {item('inbox', 'Входящие', InboxArrowDownIcon, count.inbox, 'accent')}
              {item('notes', 'Заметки Влада', ChatBubbleLeftEllipsisIcon, count.notes)}
              {item('tracker', 'Трекер недели', CalendarDaysIcon)}
            </SideNavSection>
            <SideNavSection title="Проекты">
              {item('client', KIND_NAME.client, BriefcaseIcon, count.kind('client'))}
              {item('own', KIND_NAME.own, RocketLaunchIcon, count.kind('own'))}
              {item('tools', KIND_NAME.tools, WrenchScrewdriverIcon, count.kind('tools'))}
            </SideNavSection>
            <SideNavSection title="Порядок">
              {item('guide', 'Регламент', BookOpenIcon)}
              {item('archive', 'Не работаем', ArchiveBoxIcon, count.dropped)}
            </SideNavSection>
          </SideNav>
        }>
        <Suspense fallback={<Booting />}>
          {route === 'today' && <Today onOpen={open} />}
          {route === 'inbox' && <Inbox onOpen={open} />}
          {(route === 'client' || route === 'own' || route === 'tools') && <Projects kind={route} onOpen={open} />}
          {route === 'tracker' && <Tracker onOpen={open} />}
          {route === 'notes' && <Notes onOpen={open} />}
          {route === 'guide' && <Guide />}
          {route === 'archive' && <Archive onOpen={open} />}
        </Suspense>
      </AppShell>

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
