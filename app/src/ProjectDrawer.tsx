// Карточка проекта: всё по проекту во вкладках — обзор, ссылки и файлы, доступы, задачи, заметки, память Claude.
import {useEffect, useRef, useState, type ReactNode} from 'react';
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
import {TabList, Tab} from '@astryxdesign/core/TabList';
import {Divider} from '@astryxdesign/core/Divider';
import {useToast} from '@astryxdesign/core/Toast';
import {
  ArrowTopRightOnSquareIcon, PlusIcon, XMarkIcon, DocumentArrowDownIcon, ArrowUpTrayIcon, EyeIcon, EyeSlashIcon,
  ClipboardDocumentIcon, TrashIcon,
} from '@heroicons/react/24/outline';
import {removeFile, saveProject, uploadFile, useData} from './store';
import {api} from './api';
import {ago, fileSize, guideFor, KIND_NAME, type Access, type Attachment, type Check, type Kind, type Project} from './model';
import {ItemRow, QuickAdd} from './parts';

const WHO: Record<string, string> = {lera: 'Лера', vlad: 'Влад', claude: 'Claude'};
type TabId = 'overview' | 'links' | 'access' | 'tasks' | 'notes' | 'memory';

export function ProjectDrawer({id, onClose}: {id: string | null; onClose: () => void}) {
  const data = useData();
  const [last, setLast] = useState<string | null>(id);
  useEffect(() => { if (id) setLast(id); }, [id]);
  const p = data.projects.find((x) => x.id === (id ?? last));
  return (
    <Drawer isOpen={!!id && !!p} onOpenChange={(o) => !o && onClose()} label={p?.title || 'Проект'} width={760}
      experimental={{isFullWidthOnMobile: true}}>
      {p && <Body key={p.id} p={p} onClose={onClose} />}
    </Drawer>
  );
}

function Body({p, onClose}: {p: Project; onClose: () => void}) {
  const data = useData();
  const toast = useToast();
  const [tab, setTab] = useState<TabId>('overview');
  const [busy, setBusy] = useState('');
  const pass = p.passport || {};
  const files = data.attachments.filter((a) => a.project_id === p.id);
  const tasks = data.items.filter((i) => i.project_id === p.id);
  const accessCount = (pass.access?.length || 0) + p.access.length;
  const linkCount = (pass.links?.length || p.mem_links?.length || 0) + p.links.length + files.length;

  const save = async (patch: Record<string, unknown>, what = '') => {
    setBusy(what);
    try { await saveProject(p.id, patch); } catch (e) { toast({body: e instanceof Error ? e.message : 'Не сохранилось'}); } finally { setBusy(''); }
  };
  const take = async (kind: Kind, stage: string) => {
    await save({status: 'active', kind, stage}, 'take');
    toast({body: `${p.title} в работе: ${KIND_NAME[kind]}, ${stage}`});
  };

  return (
    <Layout
      header={
        <VStack gap={0}>
          <DrawerHeader title={p.title} onOpenChange={(o) => !o && onClose()}
            subtitle={[KIND_NAME[p.kind], p.status === 'inbox' ? 'во входящих' : p.status === 'dropped' ? 'не работаем' : p.stage, p.client].filter(Boolean).join(', ')} />
          <TabList value={tab} onChange={(v) => setTab(v as TabId)} hasDivider size="sm">
            <Tab value="overview" label="Обзор" />
            <Tab value="links" label="Ссылки и файлы" endContent={count(linkCount)} />
            <Tab value="access" label="Доступы" endContent={count(accessCount)} />
            <Tab value="tasks" label="Задачи" endContent={count(tasks.filter((t) => t.status !== 'done').length)} />
            <Tab value="notes" label="Заметки" />
            <Tab value="memory" label="Память" />
          </TabList>
        </VStack>
      }
      content={
        <LayoutContent>
          <VStack gap={5} paddingBlock={4}>
            {p.status === 'inbox' && <TakeIn p={p} onTake={take} busy={busy === 'take'} onDrop={() => setTab('notes')} />}
            {p.status === 'dropped' && (
              <Banner status="warning" title="Не работаем" description={`${p.drop_reason || 'Без причины'}. Влад подтвердит и удалит память по проекту.`}
                endContent={<Button label="Вернуть в работу" variant="secondary" size="sm" isLoading={busy === 'back'} onClick={() => save({status: 'active'}, 'back')} />} />
            )}
            {p.is_fresh && p.status === 'active' && (
              <Banner status="info" title="Claude обновил данные" description={`Изменения ${ago(p.mem_updated_at)}.`}
                endContent={<Button label="Прочитала" variant="secondary" size="sm" onClick={() => save({seen: true})} />} />
            )}
            {tab === 'overview' && <Overview p={p} save={save} busy={busy} />}
            {tab === 'links' && <LinksFiles p={p} files={files} save={save} />}
            {tab === 'access' && <AccessTab p={p} save={save} />}
            {tab === 'tasks' && (
              <VStack gap={2}>
                <VStack gap={0} className="rows">
                  {tasks.sort((a, b) => Number(a.status === 'done') - Number(b.status === 'done') || (a.date || '9').localeCompare(b.date || '9'))
                    .map((it) => <ItemRow key={it.id} it={it} showDate />)}
                </VStack>
                {tasks.length === 0 && <Text color="secondary">Задач по проекту пока нет.</Text>}
                <QuickAdd projectId={p.id} placeholder="Задача на сегодня по проекту" />
              </VStack>
            )}
            {tab === 'notes' && <NotesTab p={p} save={save} busy={busy} onClose={onClose} />}
            {tab === 'memory' && <MemoryTab p={p} />}
          </VStack>
        </LayoutContent>
      }
    />
  );
}

const count = (n: number) => (n ? <Text size="sm" color="secondary" hasTabularNumbers>{n}</Text> : undefined);

function Section({title, children, end}: {title: string; children: ReactNode; end?: ReactNode}) {
  return (
    <VStack gap={2}>
      <HStack justify="between" vAlign="center"><Heading level={3}>{title}</Heading>{end}</HStack>
      {children}
    </VStack>
  );
}

function Overview({p, save, busy}: {p: Project; save: (patch: Record<string, unknown>, what?: string) => Promise<void>; busy: string}) {
  const data = useData();
  const pass = p.passport || {};
  const [nextStep, setNextStep] = useState(p.next_step);
  const [client, setClient] = useState(p.client);
  const guide = guideFor(p.kind, p.stage);
  const empty = !pass.about && !pass.status && !(pass.done || []).length;
  return (
    <VStack gap={5}>
      {pass.about && <Text className="lead">{pass.about}</Text>}
      {empty && <Text color="secondary">Паспорта проекта пока нет: Claude соберёт его вечером. Ссылки, доступы и заметки можно добавить самой.</Text>}

      {(pass.status || pass.offer || pass.money) && (
        <section className="facts">
          {pass.status && <Fact label="Сейчас" value={pass.status} />}
          {pass.offer && <Fact label="Что продаём" value={pass.offer} />}
          {pass.money && <Fact label="Деньги" value={pass.money} />}
        </section>
      )}

      {p.status === 'active' && (
        <HStack gap={3} wrap="wrap">
          <Selector label="Этап" value={p.stage} width={220} isLoading={busy === 'stage'}
            onChange={(v) => save({stage: v}, 'stage')} options={data.stages[p.kind].map((s) => ({value: s, label: s}))} />
          <Selector label="Раздел" value={p.kind} width={220}
            onChange={(v) => save({kind: v}, 'stage')} options={data.kinds.map((k) => ({value: k, label: KIND_NAME[k]}))} />
        </HStack>
      )}
      <TextInput label="Следующий шаг" description="Один шаг, видно на главной." value={nextStep} width="100%"
        placeholder={pass.next?.[0] || ''} onChange={setNextStep} onBlur={() => nextStep !== p.next_step && save({next_step: nextStep})}
        onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()} />

      {!!pass.next?.length && (
        <Section title="Что дальше">
          <VStack gap={1} className="ticks">{pass.next.map((x) => <Text key={x}>{x}</Text>)}</VStack>
        </Section>
      )}
      {!!pass.done?.length && (
        <Section title="Что уже сделано">
          <VStack gap={1} className="ticks is-done">{pass.done.map((x) => <Text key={x} color="secondary">{x}</Text>)}</VStack>
        </Section>
      )}

      <Section title="Контакты">
        <TextInput label="Клиент" value={client} width="100%" onChange={setClient} onBlur={() => client !== p.client && save({client})} />
        {!!pass.contacts?.length && (
          <HStack gap={2} wrap="wrap">
            {pass.contacts.map((c) => (
              <a key={c.label + c.value} className="pill" href={/^(https?:|mailto:|tel:)/i.test(c.url || '') ? c.url : undefined} target="_blank" rel="noreferrer">
                <span>{c.label}</span><b>{c.value}</b>
              </a>
            ))}
          </HStack>
        )}
      </Section>

      {guide && p.status === 'active' && (
        <section className="guide">
          <Text weight="semibold">Этап «{guide.stage}»: что делаем</Text>
          <Text>{guide.what}</Text>
          <Text size="sm" color="secondary"><strong>Где:</strong> {guide.where}</Text>
          <Text size="sm" color="secondary"><strong>Этап закрыт, когда:</strong> {guide.done}</Text>
        </section>
      )}
    </VStack>
  );
}

function Fact({label, value}: {label: string; value: string}) {
  return (
    <VStack gap={1} className="fact">
      <Text size="sm" color="secondary">{label}</Text>
      <Text className="pre">{value}</Text>
    </VStack>
  );
}

function LinksFiles({p, files, save}: {p: Project; files: Attachment[]; save: (patch: Record<string, unknown>) => Promise<void>}) {
  const toast = useToast();
  const pass = p.passport || {};
  const [link, setLink] = useState({label: '', url: ''});
  const [err, setErr] = useState('');
  const [uploading, setUploading] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const addLink = () => {
    const url = link.url.trim().replace(/^(?!https?:\/\/)/, 'https://');
    if (!/^https?:\/\/[^\s.]+\.[^\s]+$/.test(url)) return setErr('Нужна ссылка вида https://…');
    save({links: [...p.links, {label: link.label.trim() || url.replace(/^https?:\/\//, ''), url}]});
    setLink({label: '', url: ''}); setErr('');
  };
  const onFiles = async (list: FileList | null) => {
    if (!list?.length) return;
    setUploading(true);
    try {
      for (const f of Array.from(list)) {
        if (f.size > 30 * 1024 * 1024) { toast({body: `${f.name}: больше 30 МБ`}); continue; }
        await uploadFile(p.id, f);
      }
      toast({body: 'Файлы загружены'});
    } catch (e) { toast({body: e instanceof Error ? e.message : 'Не загрузилось'}); } finally { setUploading(false); if (input.current) input.current.value = ''; }
  };
  const download = async (a: Attachment) => { try { await api.download(a); } catch (e) { toast({body: e instanceof Error ? e.message : 'Не скачалось'}); } };

  const auto = pass.links?.length ? pass.links : (p.mem_links || []).map((l) => ({...l, note: 'из памяти Claude', ok: true}));
  const all = [...auto.map((l) => ({...l, own: false})), ...p.links.map((l) => ({...l, note: '', ok: true, own: true}))];
  return (
    <VStack gap={6}>
      <Section title="Ссылки">
        {all.length === 0 && <Text color="secondary">Ссылок пока нет.</Text>}
        <VStack gap={0} className="rows">
          {all.map((l) => (
            <HStack key={l.url + l.label} gap={3} vAlign="center" className="row">
              <VStack gap={0} className="row__main">
                <a className="linkrow" href={/^https?:\/\//i.test(l.url) ? l.url : undefined} target="_blank" rel="noreferrer">
                  <b>{l.label}</b><ArrowTopRightOnSquareIcon aria-hidden="true" />
                </a>
                <Text size="sm" color="secondary" maxLines={1}>{l.url.replace(/^https?:\/\//, '')}{l.note ? `, ${l.note}` : ''}{!l.ok ? ', не открывается' : ''}</Text>
              </VStack>
              {l.own && <Button label="Убрать ссылку" variant="ghost" size="sm" isIconOnly icon={<XMarkIcon />} onClick={() => save({links: p.links.filter((x) => x.url !== l.url)})} />}
            </HStack>
          ))}
        </VStack>
        <HStack gap={2} wrap="wrap" vAlign="start">
          <TextInput label="Подпись" isLabelHidden placeholder="Подпись" value={link.label} onChange={(v) => setLink({...link, label: v})} width={180} />
          <TextInput label="Ссылка" isLabelHidden placeholder="https://…" type="url" value={link.url} width={260}
            onChange={(v) => { setLink({...link, url: v}); setErr(''); }} onKeyDown={(e) => e.key === 'Enter' && addLink()}
            status={err ? {type: 'error', message: err} : undefined} />
          <Button label="Добавить ссылку" variant="secondary" isIconOnly icon={<PlusIcon />} onClick={addLink} />
        </HStack>
      </Section>

      <Section title="Файлы" end={
        <>
          <input ref={input} type="file" multiple hidden onChange={(e) => onFiles(e.target.files)} />
          <Button label="Загрузить" variant="secondary" size="sm" icon={<ArrowUpTrayIcon />} isLoading={uploading} onClick={() => input.current?.click()} />
        </>
      }>
        {files.length === 0 && <Text color="secondary">Файлов пока нет. Загрузить можно до 30 МБ.</Text>}
        <VStack gap={0} className="rows">
          {files.map((a) => (
            <HStack key={a.id} gap={3} vAlign="center" className="row">
              <button type="button" className="filebtn" onClick={() => download(a)}>
                <DocumentArrowDownIcon aria-hidden="true" />
                <span><b>{a.label || a.name}</b><small>{a.label ? `${a.name}, ` : ''}{fileSize(a.size)}{a.source !== 'claude' ? `, загрузил(а) ${WHO[a.source] || a.source}` : ''}</small></span>
              </button>
              {a.source !== 'claude' && <Button label="Удалить файл" variant="ghost" size="sm" isIconOnly icon={<TrashIcon />} onClick={() => removeFile(a.id)} />}
            </HStack>
          ))}
        </VStack>
      </Section>

      {!!pass.where?.length && (
        <Section title="Где ещё лежит">
          <VStack gap={2}>
            {pass.where.map((w) => <Text key={w.label + w.value} size="sm"><strong>{w.label}:</strong> {w.value}</Text>)}
          </VStack>
        </Section>
      )}
    </VStack>
  );
}

function AccessTab({p, save}: {p: Project; save: (patch: Record<string, unknown>) => Promise<void>}) {
  const pass = p.passport || {};
  const [draft, setDraft] = useState<Access>({label: '', url: '', login: '', password: '', note: ''});
  const [err, setErr] = useState('');
  const add = () => {
    if (!draft.label.trim()) return setErr('Подпиши, от чего доступ');
    save({access: [...p.access, {...draft, id: crypto.randomUUID().slice(0, 8)}]});
    setDraft({label: '', url: '', login: '', password: '', note: ''}); setErr('');
  };
  const list = [...(pass.access || []).map((a) => ({...a, own: false})), ...p.access.map((a) => ({...a, own: true}))];
  return (
    <VStack gap={5}>
      <Text size="sm" color="secondary">Пароли скрыты, нажми на глаз, чтобы увидеть. Никому не пересылай: только ты и Влад.</Text>
      {list.length === 0 && <Text color="secondary">Доступов по проекту пока нет.</Text>}
      <VStack gap={3}>
        {list.map((a, i) => (
          <AccessCard key={(a.id || '') + a.label + i} a={a}
            onRemove={a.own ? () => save({access: p.access.filter((x) => x.id !== a.id)}) : undefined} />
        ))}
      </VStack>
      <Divider />
      <Section title="Добавить доступ">
        <HStack gap={2} wrap="wrap">
          <TextInput label="От чего" value={draft.label} onChange={(v) => { setDraft({...draft, label: v}); setErr(''); }} width={220}
            status={err ? {type: 'error', message: err} : undefined} />
          <TextInput label="Адрес входа" type="url" value={draft.url} onChange={(v) => setDraft({...draft, url: v})} width={280} />
          <TextInput label="Логин" value={draft.login} onChange={(v) => setDraft({...draft, login: v})} width={220} autoComplete="off" hasAutoCorrect={false} />
          <TextInput label="Пароль" value={draft.password} onChange={(v) => setDraft({...draft, password: v})} width={220} autoComplete="new-password" hasAutoCorrect={false} />
        </HStack>
        <HStack><Button label="Сохранить доступ" variant="secondary" icon={<PlusIcon />} onClick={add} /></HStack>
      </Section>
    </VStack>
  );
}

function AccessCard({a, onRemove}: {a: Access; onRemove?: () => void}) {
  const toast = useToast();
  const [show, setShow] = useState(false);
  const copy = async (v: string, what: string) => {
    try { await navigator.clipboard.writeText(v); toast({body: `${what} скопирован`}); } catch { toast({body: 'Не получилось скопировать'}); }
  };
  return (
    <section className="access">
      <HStack justify="between" vAlign="center" gap={2}>
        <Text weight="semibold">{a.label}</Text>
        {onRemove && <Button label="Удалить доступ" variant="ghost" size="sm" isIconOnly icon={<TrashIcon />} onClick={onRemove} />}
      </HStack>
      {/^https?:\/\//i.test(a.url) && <a className="access__url" href={a.url} target="_blank" rel="noreferrer">{a.url.replace(/^https?:\/\//, '')}</a>}
      {a.login && (
        <HStack className="access__row" vAlign="center" gap={2}>
          <span>Логин</span><code>{a.login}</code>
          <Button label="Скопировать логин" variant="ghost" size="sm" isIconOnly icon={<ClipboardDocumentIcon />} onClick={() => copy(a.login, 'Логин')} />
        </HStack>
      )}
      {a.password && (
        <HStack className="access__row" vAlign="center" gap={2}>
          <span>Пароль</span><code>{show ? a.password : '••••••••••'}</code>
          <Button label={show ? 'Скрыть пароль' : 'Показать пароль'} variant="ghost" size="sm" isIconOnly icon={show ? <EyeSlashIcon /> : <EyeIcon />} onClick={() => setShow((v) => !v)} />
          <Button label="Скопировать пароль" variant="ghost" size="sm" isIconOnly icon={<ClipboardDocumentIcon />} onClick={() => copy(a.password, 'Пароль')} />
        </HStack>
      )}
      {a.note && <Text size="sm" color="secondary">{a.note}</Text>}
    </section>
  );
}

function NotesTab({p, save, busy, onClose}: {p: Project; save: (patch: Record<string, unknown>, what?: string) => Promise<void>; busy: string; onClose: () => void}) {
  const toast = useToast();
  const [notes, setNotes] = useState(p.notes);
  const [newCheck, setNewCheck] = useState('');
  const [isDropping, setIsDropping] = useState(false);
  const [reason, setReason] = useState('');
  const guide = guideFor(p.kind, p.stage);
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
  const drop = async () => {
    const prev = p.status;
    await save({status: 'dropped', drop_reason: reason.trim()}, 'drop');
    toast({body: 'Перенесён в «Не работаем». Влад подтвердит удаление.', endContent: <Button label="Вернуть" variant="ghost" size="sm" onClick={() => saveProject(p.id, {status: prev})} />});
    onClose();
  };
  return (
    <VStack gap={5}>
      <TextArea label="Мои заметки" description="Договорённости, нюансы клиента, что важно не забыть." rows={7} value={notes}
        onChange={setNotes} onBlur={() => notes !== p.notes && save({notes})} />
      <Section title="Чек-лист" end={guide && guide.checklist.length > 0 ? <Button label="Пункты этапа" variant="ghost" size="sm" onClick={fillFromGuide} /> : undefined}>
        {p.checklist.map((c) => (
          <HStack key={c.id} gap={2} vAlign="center" justify="between" className="check">
            <CheckboxInput label={c.text} value={c.done} onChange={(v) => setChecks(p.checklist.map((x) => (x.id === c.id ? {...x, done: v} : x)))} />
            <Button label="Убрать пункт" variant="ghost" size="sm" isIconOnly icon={<XMarkIcon />} onClick={() => setChecks(p.checklist.filter((x) => x.id !== c.id))} />
          </HStack>
        ))}
        <HStack gap={2}>
          <TextInput label="Новый пункт" isLabelHidden placeholder="Новый пункт" value={newCheck} onChange={setNewCheck} width="100%" onKeyDown={(e) => e.key === 'Enter' && addCheck()} />
          <Button label="Добавить пункт" variant="secondary" isIconOnly icon={<PlusIcon />} onClick={addCheck} />
        </HStack>
      </Section>
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
            <HStack><Button label="Не работаем с проектом" variant="ghost" onClick={() => setIsDropping(true)} /></HStack>
          )}
        </>
      )}
    </VStack>
  );
}

function MemoryTab({p}: {p: Project}) {
  const data = useData();
  const log = data.activity.filter((a) => a.project_id === p.id).slice(0, 20);
  return (
    <VStack gap={5}>
      <Section title="История">
        {log.length === 0 && <Text color="secondary">Пока пусто.</Text>}
        {log.map((a) => <Text key={a.id} size="sm" color="secondary">{ago(a.at)}, {WHO[a.who] || a.who}: {a.text}</Text>)}
      </Section>
      {(p.summary || p.body) && (
        <Section title="Из памяти Claude">
          <Text size="sm" color="secondary">Сырые заметки Claude по проекту, без паролей. Главное уже собрано во вкладке «Обзор».</Text>
          <Text size="sm" className="pre mem">{p.body || p.summary}</Text>
        </Section>
      )}
    </VStack>
  );
}

function TakeIn({p, onTake, busy, onDrop}: {p: Project; onTake: (k: Kind, s: string) => void; busy: boolean; onDrop: () => void}) {
  const data = useData();
  const [kind, setKind] = useState<Kind>(p.kind);
  const [stage, setStage] = useState(data.stages[p.kind].includes(p.stage) ? p.stage : data.stages[p.kind][0]);
  return (
    <section className="guide">
      <Text weight="semibold">Новый проект из памяти Claude</Text>
      <Text size="sm" color="secondary">Изучи вкладки ниже. Если работаем, выбери раздел и этап и возьми в работу.</Text>
      <HStack gap={3} wrap="wrap">
        <Selector label="Раздел" value={kind} width={200} onChange={(v) => { setKind(v as Kind); setStage(data.stages[v as Kind][0]); }}
          options={data.kinds.map((k) => ({value: k, label: KIND_NAME[k]}))} />
        <Selector label="Этап" value={stage} width={200} onChange={setStage} options={data.stages[kind].map((s) => ({value: s, label: s}))} />
      </HStack>
      <HStack gap={2} wrap="wrap">
        <Button label="Взять в работу" variant="primary" isLoading={busy} onClick={() => onTake(kind, stage)} />
        <Button label="Не работаем" variant="ghost" onClick={onDrop} />
      </HStack>
    </section>
  );
}
