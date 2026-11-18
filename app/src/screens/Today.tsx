import {useMemo} from 'react';
import {VStack} from '@astryxdesign/core/VStack';
import {HStack} from '@astryxdesign/core/HStack';
import {Grid} from '@astryxdesign/core/Grid';
import {Card} from '@astryxdesign/core/Card';
import {Text} from '@astryxdesign/core/Text';
import {Button} from '@astryxdesign/core/Button';
import {ProgressBar} from '@astryxdesign/core/ProgressBar';
import {EmptyState} from '@astryxdesign/core/EmptyState';
import {List, ListItem} from '@astryxdesign/core/List';
import {Badge} from '@astryxdesign/core/Badge';
import {Icon} from '@astryxdesign/core/Icon';
import {ChatBubbleLeftEllipsisIcon, CheckCircleIcon} from '@heroicons/react/24/outline';
import {useData} from '../store';
import {ago, dayLabel, greeting, KIND_NAME, plural, todayISO} from '../model';
import {Block, ItemRow, Page, QuickAdd} from '../parts';
import {go} from '../App';

export function Today({onOpen}: {onOpen: (id: string) => void}) {
  const data = useData();
  const today = todayISO();
  const v = useMemo(() => {
    const open = (k: 'note' | 'task') => data.items.filter((i) => i.kind === k && (i.status !== 'done' ? (!i.date || i.date <= today) : i.done_at.slice(0, 10) === today || i.date === today));
    const notes = open('note').sort((a, b) => Number(a.status === 'done') - Number(b.status === 'done') || b.created_at.localeCompare(a.created_at));
    const tasks = open('task').filter((i) => i.date).sort((a, b) => Number(a.status === 'done') - Number(b.status === 'done') || a.date.localeCompare(b.date) || a.id - b.id);
    const all = [...notes, ...tasks];
    const next = data.projects
      .filter((p) => p.status === 'active' && p.next_step && !/Пауза/.test(p.stage))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    const fresh = data.projects.filter((p) => p.status === 'active' && p.is_fresh);
    return {notes, tasks, done: all.filter((i) => i.status === 'done').length, total: all.length, next, fresh,
      inbox: data.projects.filter((p) => p.status === 'inbox').length};
  }, [data, today]);

  const isLera = data.me.role === 'lera';
  return (
    <Page title={`${greeting()}, ${data.me.name}`}
      sub={`${dayLabel(today, {weekday: 'long', day: 'numeric', month: 'long'})}. ${v.total ? `На сегодня ${v.total} ${plural(v.total, 'дело', 'дела', 'дел')}, сделано ${v.done}.` : 'Дел на сегодня пока нет.'}`}>
      <Grid columns={{minWidth: 200}} gap={3}>
        <Stat label="Новое во входящих" value={v.inbox} hint={v.inbox ? 'Изучить и разобрать' : 'Всё разобрано'} onClick={() => go('inbox')} isHot={v.inbox > 0} />
        <Stat label="Заметки Влада" value={v.notes.filter((n) => n.status !== 'done').length} hint="Ждут ответа или дела" onClick={() => go('notes')} />
        <Card padding={4}>
          <VStack gap={2}>
            <Text color="secondary" size="sm">План дня</Text>
            <Text className="big" hasTabularNumbers>{v.done}<Text color="secondary" className="big__of"> из {v.total}</Text></Text>
            <ProgressBar label="Сделано за день" isLabelHidden value={v.total ? (v.done / v.total) * 100 : 0} />
          </VStack>
        </Card>
      </Grid>

      <Grid columns={{minWidth: 340}} gap={6} className="split">
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
                    description={<Text size="sm" color="secondary" maxLines={2}>{p.stage}: {p.next_step}</Text>}
                    endContent={<Icon icon="chevronRight" size="sm" color="secondary" />} />
                ))}
              </List>
            )}
          </Block>
          <Text size="sm" color="secondary">
            Проекты из памяти Claude приходят сами каждый вечер в 21:00. {data.lastSync ? `Последний раз ${ago(data.lastSync.at)}: новых ${data.lastSync.added}, обновлено ${data.lastSync.updated}.` : 'Синка ещё не было.'}
          </Text>
        </VStack>
      </Grid>
    </Page>
  );
}

function Stat({label, value, hint, onClick, isHot}: {label: string; value: number; hint: string; onClick: () => void; isHot?: boolean}) {
  return (
    <Card padding={4} className="tap">
      <button type="button" className="cover" onClick={onClick} aria-label={`${label}: ${value}`} />
      <VStack gap={2}>
        <HStack justify="between" vAlign="center">
          <Text color="secondary" size="sm">{label}</Text>
          {isHot && <Badge label="новое" variant="teal" />}
        </HStack>
        <Text className="big" hasTabularNumbers>{value}</Text>
        <Text size="sm" color="secondary">{hint}</Text>
      </VStack>
    </Card>
  );
}
