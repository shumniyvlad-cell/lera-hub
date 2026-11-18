// Карточка проекта сбоку: этап, следующий шаг, регламент этапа, чек-лист, ссылки, заметки Леры, задачи, память Claude.
import {useEffect, useState} from 'react';
import {Drawer, DrawerHeader} from '@astryxdesign/core/Drawer';
import {Layout, LayoutContent} from '@astryxdesign/core/Layout';
import {VStack} from '@astryxdesign/core/VStack';
import {HStack} from '@astryxdesign/core/HStack';
import {Text} from '@astryxdesign/core/Text';
import {Heading} from '@astryxdesign/core/Heading';
import {Button} from '@astryxdesign/core/Button';
import {Banner} from '@astryxdesign/core/Banner';
import {Selector} from '@astryxdesign/core/Selector';
import {TextInput} from '@astryxdesign/core/TextInput';
import {TextArea} from '@astryxdesign/core/TextArea';
import {CheckboxInput} from '@astryxdesign/core/CheckboxInput';
import {Token} from '@astryxdesign/core/Token';
import {Divider} from '@astryxdesign/core/Divider';
import {Card} from '@astryxdesign/core/Card';
import {useToast} from '@astryxdesign/core/Toast';
import {ArrowTopRightOnSquareIcon, PlusIcon, XMarkIcon} from '@heroicons/react/24/outline';
import {saveProject, useData} from './store';
import {ago, guideFor, KIND_NAME, type Check, type Kind, type Project} from './model';
import {ItemRow, QuickAdd} from './parts';

const WHO: Record<string, string> = {lera: 'Лера', vlad: 'Влад', claude: 'Claude'};

export function ProjectDrawer({id, onClose}: {id: string | null; onClose: () => void}) {
  const data = useData();
  const [last, setLast] = useState<string | null>(id);
  useEffect(() => { if (id) setLast(id); }, [id]);
  const p = data.projects.find((x) => x.id === (id ?? last));
  return (
    <Drawer isOpen={!!id && !!p} onOpenChange={(o) => !o && onClose()} label={p?.title || 'Проект'} width={560}
      experimental={{isFullWidthOnMobile: true}}>
      {p && <Body key={p.id} p={p} onClose={onClose} />}
    </Drawer>
  );
}

function Body({p, onClose}: {p: Project; onClose: () => void}) {
  const data = useData();
  const toast = useToast();
  const [nextStep, setNextStep] = useState(p.next_step);
  const [notes, setNotes] = useState(p.notes);
  const [client, setClient] = useState(p.client);
  const [newCheck, setNewCheck] = useState('');
  const [link, setLink] = useState({label: '', url: ''});
  const [linkErr, setLinkErr] = useState('');
  const [isDropping, setIsDropping] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState('');
  const [isMemOpen, setIsMemOpen] = useState(false);
  const guide = guideFor(p.kind, p.stage);
  const tasks = data.items.filter((i) => i.project_id === p.id).sort((a, b) => Number(a.status === 'done') - Number(b.status === 'done') || (a.date || '9').localeCompare(b.date || '9'));
  const log = data.activity.filter((a) => a.project_id === p.id).slice(0, 12);

  const save = async (patch: Record<string, unknown>, what = '') => {
    setBusy(what);
    try { await saveProject(p.id, patch); } catch (e) { toast({body: e instanceof Error ? e.message : 'Не сохранилось'}); } finally { setBusy(''); }
  };
  const blurSave = (field: 'next_step' | 'notes' | 'client', value: string) => value !== p[field] && save({[field]: value});

  const setChecks = (list: Check[]) => save({checklist: list});
  const addCheck = () => {
    if (!newCheck.trim()) return;
    setChecks([...p.checklist, {id: crypto.randomUUID().slice(0, 8), text: newCheck.trim(), done: false}]);
    setNewCheck('');
  };
  const fillFromGuide = () => {
    if (!guide) return;
    const have = new Set(p.checklist.map((c) => c.text));
    setChecks([...p.checklist, ...guide.checklist.filter((t) => !have.has(t)).map((t) => ({id: crypto.randomUUID().slice(0, 8), text: t, done: false}))]);
  };
  const addLink = () => {
    const url = link.url.trim().replace(/^(?!https?:\/\/)/, 'https://');
    if (!/^https?:\/\/[^\s.]+\.[^\s]+$/.test(url)) return setLinkErr('Нужна ссылка вида https://…');
    save({links: [...p.links, {label: link.label.trim() || url.replace(/^https?:\/\//, ''), url}]});
    setLink({label: '', url: ''}); setLinkErr('');
  };

  const take = async (kind: Kind, stage: string) => {
    await save({status: 'active', kind, stage}, 'take');
    toast({body: `${p.title} в работе: ${KIND_NAME[kind]}, ${stage}`});
  };
  const drop = async () => {
    const prev = p.status;
    await save({status: 'dropped', drop_reason: reason.trim()}, 'drop');
    setIsDropping(false);
    toast({body: 'Перенесён в «Не работаем». Влад подтвердит удаление.', endContent: <Button label="Вернуть" variant="ghost" size="sm" onClick={() => saveProject(p.id, {status: prev})} />});
    onClose();
  };

  return (
    <Layout
      header={
        <DrawerHeader title={p.title} hasDivider onOpenChange={(o) => !o && onClose()}
          subtitle={`${KIND_NAME[p.kind]}${p.status === 'inbox' ? ', во входящих' : p.status === 'dropped' ? ', не работаем' : `, ${p.stage}`}`} />
      }
      content={
        <LayoutContent>
          <VStack gap={5} paddingBlock={4}>
            {p.status === 'inbox' && <TakeIn p={p} onTake={take} busy={busy === 'take'} onDrop={() => setIsDropping(true)} />}
            {p.status === 'dropped' && (
              <Banner status="warning" title="Не работаем" description={`${p.drop_reason || 'Без причины'}. Влад подтвердит и удалит память по проекту.`}
                endContent={<Button label="Вернуть в работу" variant="secondary" size="sm" isLoading={busy === 'back'} onClick={() => save({status: 'active'}, 'back')} />} />
            )}
            {p.is_fresh && p.status === 'active' && (
              <Banner status="info" title="Claude обновил заметки" description={`Изменения ${ago(p.mem_updated_at)}. Посмотри «Из памяти Claude» внизу.`}
                endContent={<Button label="Прочитала" variant="secondary" size="sm" onClick={() => save({seen: true})} />} />
            )}

            {p.status === 'active' && (
              <HStack gap={3} wrap="wrap">
                <Selector label="Этап" value={p.stage} width={220} isLoading={busy === 'stage'}
                  onChange={(v) => save({stage: v}, 'stage')} options={data.stages[p.kind].map((s) => ({value: s, label: s}))} />
                <Selector label="Раздел" value={p.kind} width={220}
                  onChange={(v) => save({kind: v}, 'stage')} options={data.kinds.map((k) => ({value: k, label: KIND_NAME[k]}))} />
              </HStack>
            )}

            <TextInput label="Следующий шаг" description="Что делаем дальше. Видно на главной." value={nextStep} width="100%"
              onChange={setNextStep} onBlur={() => blurSave('next_step', nextStep)}
              onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()} />
            <TextInput label="Клиент" value={client} width="100%" onChange={setClient} onBlur={() => blurSave('client', client)} />

            {guide && p.status === 'active' && (
              <Card variant="muted" padding={4}>
                <VStack gap={2}>
                  <Text weight="semibold">Этап «{guide.stage}»: что делаем</Text>
                  <Text>{guide.what}</Text>
                  <Text size="sm" color="secondary"><strong>Где:</strong> {guide.where}</Text>
                  <Text size="sm" color="secondary"><strong>Этап закрыт, когда:</strong> {guide.done}</Text>
                </VStack>
              </Card>
            )}

            <VStack gap={2}>
              <HStack justify="between" vAlign="center">
                <Heading level={3}>Чек-лист</Heading>
                {guide && guide.checklist.length > 0 && <Button label="Пункты этапа" variant="ghost" size="sm" onClick={fillFromGuide} />}
              </HStack>
              {p.checklist.map((c) => (
                <HStack key={c.id} gap={2} vAlign="center" justify="between" className="check">
                  <CheckboxInput label={c.text} value={c.done} onChange={(v) => setChecks(p.checklist.map((x) => (x.id === c.id ? {...x, done: v} : x)))} />
                  <Button label="Убрать пункт" variant="ghost" size="sm" isIconOnly icon={<XMarkIcon />}
                    onClick={() => setChecks(p.checklist.filter((x) => x.id !== c.id))} />
                </HStack>
              ))}
              <HStack gap={2}>
                <TextInput label="Новый пункт" isLabelHidden placeholder="Новый пункт" value={newCheck} onChange={setNewCheck} width="100%"
                  onKeyDown={(e) => e.key === 'Enter' && addCheck()} />
                <Button label="Добавить пункт" variant="secondary" isIconOnly icon={<PlusIcon />} onClick={addCheck} />
              </HStack>
            </VStack>

            <VStack gap={2}>
              <Heading level={3}>Где что лежит</Heading>
              <HStack gap={2} wrap="wrap">
                {p.links.map((l) => (
                  <Token key={l.url} label={l.label} href={l.url} icon={<ArrowTopRightOnSquareIcon width={14} height={14} />}
                    onRemove={() => save({links: p.links.filter((x) => x.url !== l.url)})} />
                ))}
                {p.links.length === 0 && <Text color="secondary" size="sm">Ссылок пока нет.</Text>}
              </HStack>
              <HStack gap={2} wrap="wrap" vAlign="start">
                <TextInput label="Подпись" isLabelHidden placeholder="Подпись" value={link.label} onChange={(v) => setLink({...link, label: v})} width={160} />
                <TextInput label="Ссылка" isLabelHidden placeholder="https://…" type="url" value={link.url} width={220}
                  onChange={(v) => { setLink({...link, url: v}); setLinkErr(''); }} onKeyDown={(e) => e.key === 'Enter' && addLink()}
                  status={linkErr ? {type: 'error', message: linkErr} : undefined} />
                <Button label="Добавить ссылку" variant="secondary" isIconOnly icon={<PlusIcon />} onClick={addLink} />
              </HStack>
            </VStack>

            <VStack gap={2}>
              <Heading level={3}>Задачи по проекту</Heading>
              <VStack gap={0} className="rows">{tasks.map((it) => <ItemRow key={it.id} it={it} showDate />)}</VStack>
              <QuickAdd projectId={p.id} placeholder="Задача на сегодня по проекту" />
            </VStack>

            <TextArea label="Мои заметки" description="Договорённости, контакты, что важно не забыть." rows={5} value={notes}
              onChange={setNotes} onBlur={() => blurSave('notes', notes)} />

            {(p.summary || p.body) && (
              <VStack gap={2}>
                <HStack justify="between" vAlign="center">
                  <Heading level={3}>Из памяти Claude</Heading>
                  {p.body && <Button label={isMemOpen ? 'Свернуть' : 'Читать целиком'} variant="ghost" size="sm" onClick={() => setIsMemOpen((v) => !v)} />}
                </HStack>
                <Text color="secondary" className="pre">{p.summary}</Text>
                {isMemOpen && <Text size="sm" className="pre mem">{p.body}</Text>}
              </VStack>
            )}

            {log.length > 0 && (
              <VStack gap={2}>
                <Heading level={3}>История</Heading>
                {log.map((a) => (
                  <Text key={a.id} size="sm" color="secondary">{ago(a.at)}, {WHO[a.who] || a.who}: {a.text}</Text>
                ))}
              </VStack>
            )}

            {p.status !== 'dropped' && (
              <>
                <Divider />
                {isDropping ? (
                  <VStack gap={3}>
                    <Text>Проект уйдёт в «Не работаем». Влад подтвердит, и Claude забудет его, чтобы не тратить память.</Text>
                    <TextInput label="Почему не работаем" isOptional value={reason} onChange={setReason} width="100%" hasAutoFocus />
                    <HStack gap={2}>
                      <Button label="Не работаем" variant="destructive" isLoading={busy === 'drop'} onClick={drop} />
                      <Button label="Отмена" variant="ghost" onClick={() => setIsDropping(false)} />
                    </HStack>
                  </VStack>
                ) : (
                  <Button label="Не работаем с проектом" variant="ghost" onClick={() => setIsDropping(true)} />
                )}
              </>
            )}
          </VStack>
        </LayoutContent>
      }
    />
  );
}

function TakeIn({p, onTake, busy, onDrop}: {p: Project; onTake: (k: Kind, s: string) => void; busy: boolean; onDrop: () => void}) {
  const data = useData();
  const [kind, setKind] = useState<Kind>(p.kind);
  const [stage, setStage] = useState(data.stages[p.kind].includes(p.stage) ? p.stage : data.stages[p.kind][0]);
  return (
    <Card variant="muted" padding={4}>
      <VStack gap={3}>
        <Text weight="semibold">Новый проект из памяти Claude</Text>
        <Text size="sm" color="secondary">Изучи описание ниже. Если работаем, выбери раздел и этап и возьми в работу.</Text>
        <HStack gap={3} wrap="wrap">
          <Selector label="Раздел" value={kind} width={200} onChange={(v) => { setKind(v as Kind); setStage(data.stages[v as Kind][0]); }}
            options={data.kinds.map((k) => ({value: k, label: KIND_NAME[k]}))} />
          <Selector label="Этап" value={stage} width={200} onChange={setStage} options={data.stages[kind].map((s) => ({value: s, label: s}))} />
        </HStack>
        <HStack gap={2} wrap="wrap">
          <Button label="Взять в работу" variant="primary" isLoading={busy} onClick={() => onTake(kind, stage)} />
          <Button label="Не работаем" variant="ghost" onClick={onDrop} />
        </HStack>
      </VStack>
    </Card>
  );
}
