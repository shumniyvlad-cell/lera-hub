import {useMemo, useState} from 'react';
import {VStack} from '@astryxdesign/core/VStack';
import {HStack} from '@astryxdesign/core/HStack';
import {Text} from '@astryxdesign/core/Text';
import {Button} from '@astryxdesign/core/Button';
import {ProgressBar} from '@astryxdesign/core/ProgressBar';
import {ChevronLeftIcon, ChevronRightIcon} from '@heroicons/react/24/outline';
import {saveItem, useData} from '../store';
import {addDays, dayLabel, todayISO, weekStart} from '../model';
import {ItemRow, Page, QuickAdd} from '../parts';

export function Tracker({onOpen}: {onOpen: (id: string) => void}) {
  const data = useData();
  const today = todayISO();
  const [start, setStart] = useState(weekStart(today));
  const [over, setOver] = useState('');
  const days = Array.from({length: 7}, (_, i) => addDays(start, i));
  const inWeek = useMemo(() => data.items.filter((i) => i.date >= days[0] && i.date <= days[6]), [data.items, days]);
  const undated = data.items.filter((i) => !i.date && i.status !== 'done');
  const done = inWeek.filter((i) => i.status === 'done').length;
  const move = (id: string, date: string) => { setOver(''); if (id) saveItem(Number(id), {date}); };

  return (
    <Page title="Трекер недели" sub={`${dayLabel(days[0], {day: 'numeric', month: 'long'})} — ${dayLabel(days[6], {day: 'numeric', month: 'long'})}. Дела Леры и заметки Влада по дням, перетаскиваются между днями.`}
      actions={
        <HStack gap={2} vAlign="center">
          <Button label="Прошлая неделя" variant="secondary" isIconOnly icon={<ChevronLeftIcon />} onClick={() => setStart(addDays(start, -7))} />
          <Button label="Эта неделя" variant="secondary" onClick={() => setStart(weekStart(today))} isDisabled={start === weekStart(today)} />
          <Button label="Следующая неделя" variant="secondary" isIconOnly icon={<ChevronRightIcon />} onClick={() => setStart(addDays(start, 7))} />
        </HStack>
      }>
      <VStack gap={2}>
        <HStack justify="between"><Text color="secondary">Сделано за неделю</Text><Text hasTabularNumbers weight="semibold">{done} из {inWeek.length}</Text></HStack>
        <ProgressBar label="Сделано за неделю" isLabelHidden value={inWeek.length ? (done / inWeek.length) * 100 : 0} />
      </VStack>
      <section className="week" aria-label="Дни недели">
        {days.map((d) => {
          const list = inWeek.filter((i) => i.date === d).sort((a, b) => Number(a.status === 'done') - Number(b.status === 'done') || a.id - b.id);
          return (
            <section key={d} className={`day${d === today ? ' is-today' : ''}${over === d ? ' is-over' : ''}`} aria-label={dayLabel(d, {weekday: 'long', day: 'numeric', month: 'long'})}
              onDragOver={(e) => { e.preventDefault(); setOver(d); }} onDragLeave={() => setOver('')}
              onDrop={(e) => { e.preventDefault(); move(e.dataTransfer.getData('text/item'), d); }}>
              <HStack justify="between" vAlign="center" className="day__head">
                <Text weight="semibold">{dayLabel(d, {weekday: 'short', day: 'numeric'})}</Text>
                {d === today && <Text size="sm" color="accent">сегодня</Text>}
              </HStack>
              <VStack gap={0} className="rows">
                {list.map((it) => (
                  <section key={it.id} draggable onDragStart={(e) => e.dataTransfer.setData('text/item', String(it.id))} aria-label={it.text}>
                    <ItemRow it={it} onOpen={onOpen} />
                  </section>
                ))}
              </VStack>
              <QuickAdd date={d} placeholder="Добавить" />
            </section>
          );
        })}
      </section>
      {undated.length > 0 && (
        <VStack gap={2}>
          <Text weight="semibold">Без даты</Text>
          <VStack gap={0} className="rows">{undated.map((it) => <ItemRow key={it.id} it={it} onOpen={onOpen} />)}</VStack>
        </VStack>
      )}
    </Page>
  );
}
