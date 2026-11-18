import {useState} from 'react';
import {VStack} from '@astryxdesign/core/VStack';
import {HStack} from '@astryxdesign/core/HStack';
import {Card} from '@astryxdesign/core/Card';
import {Text} from '@astryxdesign/core/Text';
import {Button} from '@astryxdesign/core/Button';
import {TextArea} from '@astryxdesign/core/TextArea';
import {TextInput} from '@astryxdesign/core/TextInput';
import {DateInput} from '@astryxdesign/core/DateInput';
import {CheckboxInput} from '@astryxdesign/core/CheckboxInput';
import {Token} from '@astryxdesign/core/Token';
import {EmptyState} from '@astryxdesign/core/EmptyState';
import {useToast} from '@astryxdesign/core/Toast';
import {ChatBubbleLeftEllipsisIcon, TrashIcon} from '@heroicons/react/24/outline';
import {addItem, deleteItem, restoreItem, saveItem, useData} from '../store';
import {ago, dayLabel, todayISO, type Item} from '../model';
import {Block, Page, ProjectPicker, useProjectName} from '../parts';

export function Notes({onOpen}: {onOpen: (id: string) => void}) {
  const data = useData();
  const isVlad = data.me.role === 'vlad';
  const notes = data.items.filter((i) => i.kind === 'note').sort((a, b) => b.created_at.localeCompare(a.created_at));
  const open = notes.filter((n) => n.status !== 'done');
  const done = notes.filter((n) => n.status === 'done');
  return (
    <Page title="Заметки Влада" sub={isVlad ? 'Пиши Лере: заметка сразу встанет ей в план на выбранный день.' : 'Что Влад просит сделать. Каждая заметка стоит у тебя в плане дня. Сделала — отметь и ответь, если нужно.'}>
      {isVlad && <Composer />}
      <Block title={`Ждут: ${open.length}`}>
        {open.length === 0 ? (
          <EmptyState icon={<ChatBubbleLeftEllipsisIcon width={36} height={36} />} isCompact title="Новых заметок нет"
            description={isVlad ? 'Напиши первую выше.' : 'Влад пишет заметки здесь или командой с мака. Они сразу появятся.'} />
        ) : (
          <VStack gap={3}>{open.map((n) => <Note key={n.id} n={n} onOpen={onOpen} />)}</VStack>
        )}
      </Block>
      {done.length > 0 && (
        <Block title="Сделано">
          <VStack gap={3}>{done.slice(0, 30).map((n) => <Note key={n.id} n={n} onOpen={onOpen} />)}</VStack>
        </Block>
      )}
    </Page>
  );
}

function Composer() {
  const [text, setText] = useState('');
  const [date, setDate] = useState<string | undefined>(todayISO());
  const [project, setProject] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const toast = useToast();
  const send = async () => {
    if (!text.trim()) return setErr('Что передать Лере?');
    setBusy(true);
    try {
      await addItem({kind: 'note', text: text.trim(), date: date || todayISO(), project_id: project});
      setText(''); setErr('');
      toast({body: 'Заметка у Леры в плане'});
    } catch (e) { setErr(e instanceof Error ? e.message : 'Не сохранилось'); } finally { setBusy(false); }
  };
  return (
    <Card padding={4}>
      <VStack gap={3}>
        <TextArea label="Заметка Лере" rows={3} value={text} onChange={(v) => { setText(v); setErr(''); }}
          status={err ? {type: 'error', message: err} : undefined} />
        <HStack gap={3} wrap="wrap" vAlign="end">
          <DateInput label="На какой день" value={date as Parameters<typeof DateInput>[0]["value"]} onChange={(v) => setDate(v)} weekStartsOn="mon" width={200} />
          <VStack className="grow"><ProjectPicker value={project} onChange={setProject} /></VStack>
          <Button label="Отправить Лере" variant="primary" isLoading={busy} onClick={send} />
        </HStack>
      </VStack>
    </Card>
  );
}

function Note({n, onOpen}: {n: Item; onOpen: (id: string) => void}) {
  const data = useData();
  const name = useProjectName();
  const toast = useToast();
  const [reply, setReply] = useState(n.reply);
  const mine = n.author === data.me.login;
  const remove = async () => {
    const gone = await deleteItem(n.id);
    toast({body: 'Заметка удалена', endContent: <Button label="Вернуть" variant="ghost" size="sm" onClick={() => restoreItem(gone)} />});
  };
  return (
    <Card padding={4} variant={n.status === 'done' ? 'muted' : 'default'}>
      <VStack gap={3}>
        <HStack gap={3} vAlign="start" justify="between">
          <HStack gap={3} vAlign="start">
            <CheckboxInput label={n.status === 'done' ? 'Вернуть' : 'Сделано'} isLabelHidden value={n.status === 'done'}
              onChange={(v) => saveItem(n.id, {status: v ? 'done' : 'todo'})} />
            <VStack gap={1}>
              <Text className="pre">{n.text}</Text>
              <HStack gap={2} wrap="wrap" vAlign="center">
                <Text size="sm" color="secondary">{ago(n.created_at)}{n.date ? `, на ${dayLabel(n.date, {day: 'numeric', month: 'short'})}` : ''}</Text>
                {n.project_id && name(n.project_id) && <Token size="sm" label={name(n.project_id)} onClick={() => onOpen(n.project_id)} />}
              </HStack>
            </VStack>
          </HStack>
          {mine && <Button label="Удалить заметку" variant="ghost" size="sm" isIconOnly icon={<TrashIcon />} onClick={remove} />}
        </HStack>
        {data.me.role === 'lera' ? (
          <TextInput label="Ответ Владу" isLabelHidden placeholder="Ответить Владу (сохранится само)" value={reply} width="100%"
            onChange={setReply} onBlur={() => reply !== n.reply && saveItem(n.id, {reply})}
            onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()} />
        ) : n.reply ? (
          <Text size="sm"><strong>Лера:</strong> {n.reply}</Text>
        ) : null}
      </VStack>
    </Card>
  );
}
