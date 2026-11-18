import {useMemo} from 'react';
import {VStack} from '@astryxdesign/core/VStack';
import {HStack} from '@astryxdesign/core/HStack';
import {Text} from '@astryxdesign/core/Text';
import {Button} from '@astryxdesign/core/Button';
import {EmptyState} from '@astryxdesign/core/EmptyState';
import {List, ListItem} from '@astryxdesign/core/List';
import {Badge} from '@astryxdesign/core/Badge';
import {Icon} from '@astryxdesign/core/Icon';
import {ChatBubbleLeftEllipsisIcon, CheckCircleIcon} from '@heroicons/react/24/outline';
import {useData} from '../store';
import {ago, dayLabel, greeting, KIND_NAME, nextOf, plural, todayISO} from '../model';
import {Block, ItemRow, QuickAdd} from '../parts';

export function Today({onOpen}: {onOpen: (id: string) => void}) {
  const data = useData();
  const today = todayISO();
  const v = useMemo(() => {
    const open = (k: 'note' | 'task') => data.items.filter((i) => i.kind === k && (i.status !== 'done' ? (!i.date || i.date <= today) : i.done_at.slice(0, 10) === today || i.date === today));
    const notes = open('note').sort((a, b) => Number(a.status === 'done') - Number(b.status === 'done') || b.created_at.localeCompare(a.created_at));
    const tasks = open('task').filter((i) => i.date).sort((a, b) => Number(a.status === 'done') - Number(b.status === 'done') || a.date.localeCompare(b.date) || a.id - b.id);
    const all = [...notes, ...tasks];
    const next = data.projects
      .filter((p) => p.status === 'active' && nextOf(p) && !/Пауза/.test(p.stage))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    const fresh = data.projects.filter((p) => p.status === 'active' && p.is_fresh);
    return {notes, tasks, done: all.filter((i) => i.status === 'done').length, total: all.length, next, fresh,
      inbox: data.projects.filter((p) => p.status === 'inbox').length};
  }, [data, today]);

  const isLera = data.me.role === 'lera';
  const pct = v.total ? Math.round((v.done / v.total) * 100) : 0;
  return (
    <VStack className="page" gap={8}>
      <section className="hero">
        <img className="hero__img" src="./img/sea.webp" srcSet="./img/sea-960.webp 960w, ./img/sea.webp 1536w" sizes="(max-width: 900px) 100vw, 1200px" alt="" width={1536} height={1024} />
        <VStack className="hero__text" gap={3}>
          <p className="hero__date">{dayLabel(today, {weekday: 'long', day: 'numeric', month: 'long'})}</p>
          <h1 className="hero__title">{greeting()},<br />{data.me.name}</h1>
          <p className="hero__sub">
            {v.total ? `На сегодня ${v.total} ${plural(v.total, 'дело', 'дела', 'дел')}. ${v.done ? `Сделано ${v.done}.` : 'Поехали.'}` : 'Дел на сегодня пока нет. Добавь первое ниже.'}
          </p>
        </VStack>
        <Compass pct={pct} done={v.done} total={v.total} />
        <HStack className="hero__chips" gap={2} wrap="wrap">
          <a className="chip glass-photo" href="#/inbox"><b>{v.inbox}</b> {plural(v.inbox, 'новый проект', 'новых проекта', 'новых проектов')}</a>
          <a className="chip glass-photo" href="#/notes"><b>{v.notes.filter((n) => n.status !== 'done').length}</b> от Влада</a>
          <a className="chip glass-photo" href="#/tracker"><b>{v.done}/{v.total}</b> план дня</a>
        </HStack>
      </section>

      <section className="split">
        <VStack gap={6}>
          <Block title="От Влада" end={<Button label="Все заметки" variant="ghost" size="sm" href="#/notes" />}>
            {v.notes.length === 0 ? (
              <EmptyState icon={<ChatBubbleLeftEllipsisIcon width={36} height={36} />} title="Заметок на сегодня нет"
                description={isLera ? 'Когда Влад оставит заметку, она появится здесь и в плане дня.' : 'Напиши Лере заметку, она появится у неё в плане дня.'}
                actions={!isLera ? <Button label="Написать заметку" variant="secondary" href="#/notes" /> : undefined} isCompact />
            ) : (
              <VStack gap={0} className="rows">{v.notes.map((it) => <ItemRow key={it.id} it={it} onOpen={onOpen} />)}</VStack>
            )}
          </Block>

          <Block title={isLera ? 'Мой план на сегодня' : 'План Леры на сегодня'} end={<Button label="Неделя" variant="ghost" size="sm" href="#/tracker" />}>
            <VStack gap={0} className="rows">
              {v.tasks.map((it) => <ItemRow key={it.id} it={it} onOpen={onOpen} />)}
            </VStack>
            {v.tasks.length === 0 && <Text color="secondary">Пусто. Впиши первое дело дня: Enter сохраняет.</Text>}
            <QuickAdd date={today} placeholder="Добавить дело на сегодня" />
          </Block>
        </VStack>

        <VStack gap={6}>
          {v.fresh.length > 0 && (
            <Block title="Claude обновил">
              <List hasDividers edge="outset">
                {v.fresh.slice(0, 6).map((p) => (
                  <ListItem key={p.id} itemKey={p.id} label={p.title} onClick={() => onOpen(p.id)}
                    description={<Text size="sm" color="secondary">{KIND_NAME[p.kind]}, {p.stage}, {ago(p.mem_updated_at)}</Text>}
                    endContent={<Badge label="новое" variant="teal" />} />
                ))}
              </List>
            </Block>
          )}
          <Block title="Следующие шаги по проектам">
            {v.next.length === 0 ? (
              <EmptyState icon={<CheckCircleIcon width={36} height={36} />} isCompact title="Шаги не записаны"
                description="Открой проект и впиши «Следующий шаг»: он появится здесь, чтобы ничего не потерялось." />
            ) : (
              <List hasDividers edge="outset">
                {v.next.slice(0, 12).map((p) => (
                  <ListItem key={p.id} itemKey={p.id} label={p.title} onClick={() => onOpen(p.id)}
                    description={<Text size="sm" color="secondary" maxLines={2}>{p.stage}: {nextOf(p)}</Text>}
                    endContent={<Icon icon="chevronRight" size="sm" color="secondary" />} />
                ))}
              </List>
            )}
          </Block>
          <Text size="sm" color="secondary">
            Проекты из памяти Claude приходят сами каждый вечер в 21:00. {data.lastSync ? `Последний раз ${ago(data.lastSync.at)}: новых ${data.lastSync.added}, обновлено ${data.lastSync.updated}.` : 'Синка ещё не было.'}
          </Text>
        </VStack>
      </section>
    </VStack>
  );
}

function Compass({pct, done, total}: {pct: number; done: number; total: number}) {
  const r = 62, c = 2 * Math.PI * r;
  return (
    <figure className="compass" aria-label={`Курс дня: сделано ${done} из ${total}`}>
      <svg viewBox="0 0 160 160" width="160" height="160" aria-hidden="true">
        <circle cx="80" cy="80" r="74" className="compass__rim" />
        {Array.from({length: 36}, (_, i) => (
          <line key={i} x1="80" y1={i % 9 === 0 ? 10 : 13} x2="80" y2="18" className={i % 9 === 0 ? 'compass__tick is-major' : 'compass__tick'} transform={`rotate(${i * 10} 80 80)`} />
        ))}
        <circle cx="80" cy="80" r={r} className="compass__track" />
        <circle cx="80" cy="80" r={r} className="compass__arc" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} transform="rotate(-90 80 80)" />
        <g className="compass__needle" style={{transform: `rotate(${pct * 3.6}deg)`}}>
          <path d="M80 34 L85 80 L80 86 L75 80 Z" className="compass__north" />
          <path d="M80 102 L85 80 L80 74 L75 80 Z" className="compass__south" />
        </g>
        <circle cx="80" cy="80" r="4" className="compass__hub" />
      </svg>
      <figcaption><b>{pct}%</b><span>курс дня</span></figcaption>
    </figure>
  );
}
