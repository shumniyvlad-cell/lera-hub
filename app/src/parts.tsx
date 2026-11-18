// Общие куски экранов: шапка страницы, строка задачи, быстрое добавление, выбор проекта.
import {useState, type ReactNode} from 'react';
import {VStack} from '@astryxdesign/core/VStack';
import {HStack} from '@astryxdesign/core/HStack';
import {Heading} from '@astryxdesign/core/Heading';
import {Text} from '@astryxdesign/core/Text';
import {Button} from '@astryxdesign/core/Button';
import {Token} from '@astryxdesign/core/Token';
import {TextInput} from '@astryxdesign/core/TextInput';
import {Selector} from '@astryxdesign/core/Selector';
import {CheckboxInput} from '@astryxdesign/core/CheckboxInput';
import {useToast} from '@astryxdesign/core/Toast';
import {TrashIcon, PlusIcon} from '@heroicons/react/24/outline';
import {addItem, deleteItem, restoreItem, saveItem, useData} from './store';
import {dayLabel, todayISO, type Item} from './model';

export function Page({title, sub, actions, children}: {title: string; sub?: ReactNode; actions?: ReactNode; children: ReactNode}) {
  return (
    <VStack className="page" gap={6}>
      <HStack justify="between" vAlign="end" gap={3} wrap="wrap">
        <VStack gap={1}>
          <Heading level={1}>{title}</Heading>
          {sub && <Text color="secondary">{sub}</Text>}
        </VStack>
        {actions}
      </HStack>
      {children}
    </VStack>
  );
}

export function Block({title, end, children}: {title: string; end?: ReactNode; children: ReactNode}) {
  return (
    <VStack gap={3} className="block">
      <HStack justify="between" vAlign="center" gap={2}>
        <Heading level={2}>{title}</Heading>
        {end}
      </HStack>
      {children}
    </VStack>
  );
}

export function useProjectName() {
  const {projects} = useData();
  return (id: string) => projects.find((p) => p.id === id)?.title || '';
}

export function ItemRow({it, onOpen, showDate}: {it: Item; onOpen?: (id: string) => void; showDate?: boolean}) {
  const {me} = useData();
  const name = useProjectName();
  const toast = useToast();
  const today = todayISO();
  const late = it.status !== 'done' && it.date && it.date < today;
  const remove = async () => {
    const gone = await deleteItem(it.id);
    toast({body: 'Удалено', endContent: <Button label="Вернуть" variant="ghost" size="sm" onClick={() => restoreItem(gone)} />});
  };
  return (
    <HStack className={`row${it.status === 'done' ? ' is-done' : ''}`} gap={3} vAlign="start">
      <CheckboxInput label={it.status === 'done' ? 'Вернуть в работу' : 'Сделано'} isLabelHidden value={it.status === 'done'}
        onChange={(v) => saveItem(it.id, {status: v ? 'done' : 'todo'})} />
      <VStack gap={1} className="row__main">
        <Text className="row__text">{it.text}</Text>
        <HStack gap={2} wrap="wrap" vAlign="center">
          {it.kind === 'note' && <Token size="sm" color="teal" label={it.author === 'vlad' ? 'от Влада' : 'заметка'} />}
          {it.project_id && name(it.project_id) && (
            <Token size="sm" label={name(it.project_id)} onClick={onOpen ? () => onOpen(it.project_id) : undefined} />
          )}
          {(showDate || late) && it.date && (
            <Text size="sm" color={late ? 'accent' : 'secondary'} hasTabularNumbers>
              {late ? 'просрочено, ' : ''}{dayLabel(it.date, {day: 'numeric', month: 'short'})}
            </Text>
          )}
          {it.reply && <Text size="sm" color="secondary">Ответ Леры: {it.reply}</Text>}
        </HStack>
      </VStack>
      {it.author === me.login && (
        <Button label="Удалить" variant="ghost" size="sm" isIconOnly icon={<TrashIcon />} onClick={remove} />
      )}
    </HStack>
  );
}

export function QuickAdd({date, projectId, placeholder = 'Что сделать?'}: {date?: string; projectId?: string; placeholder?: string}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const submit = async () => {
    if (!text.trim()) return setErr('Напиши, что сделать');
    setBusy(true); setErr('');
    try {
      await addItem({text: text.trim(), date: date ?? todayISO(), project_id: projectId ?? '', kind: 'task'});
      setText('');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Не сохранилось');
    } finally { setBusy(false); }
  };
  return (
    <HStack gap={2} vAlign="start">
      <TextInput label="Новая задача" isLabelHidden placeholder={placeholder} value={text} width="100%"
        onChange={(v) => { setText(v); if (err) setErr(''); }}
        onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && submit()}
        status={err ? {type: 'error', message: err} : undefined} />
      <Button label="Добавить" variant="secondary" isIconOnly icon={<PlusIcon />} isLoading={busy} onClick={submit} />
    </HStack>
  );
}

export function ProjectPicker({value, onChange, label = 'Проект'}: {value: string; onChange: (id: string) => void; label?: string}) {
  const {projects} = useData();
  const live = projects.filter((p) => p.status === 'active' || p.status === 'inbox');
  return (
    <Selector label={label} value={value} hasClear hasSearch searchPlaceholder="Найти проект" placeholder="Без проекта"
      emptySearchText="Не нашла" width="100%" presentation="adaptive"
      onChange={(v) => onChange(v ?? '')}
      options={live.map((p) => ({value: p.id, label: p.title}))} />
  );
}
