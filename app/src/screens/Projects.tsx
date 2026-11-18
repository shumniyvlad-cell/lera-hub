import {useMemo, useState} from 'react';
import {VStack} from '@astryxdesign/core/VStack';
import {HStack} from '@astryxdesign/core/HStack';
import {Text} from '@astryxdesign/core/Text';
import {Button} from '@astryxdesign/core/Button';
import {Badge} from '@astryxdesign/core/Badge';
import {TextInput} from '@astryxdesign/core/TextInput';
import {Selector} from '@astryxdesign/core/Selector';
import {Dialog} from '@astryxdesign/core/Dialog';
import {Heading} from '@astryxdesign/core/Heading';
import {useToast} from '@astryxdesign/core/Toast';
import {MagnifyingGlassIcon, PlusIcon} from '@heroicons/react/24/outline';
import {createProject, saveProject, useData} from '../store';
import {KIND_HINT, KIND_NAME, type Kind, type Project} from '../model';
import {Page} from '../parts';

export function Projects({kind, onOpen}: {kind: Kind; onOpen: (id: string) => void}) {
  const data = useData();
  const [q, setQ] = useState('');
  const [isNew, setIsNew] = useState(false);
  const [dragOver, setDragOver] = useState('');
  const toast = useToast();
  const stages = data.stages[kind];
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return data.projects.filter((p) => p.status === 'active' && p.kind === kind &&
      (!s || `${p.title} ${p.client} ${p.next_step} ${p.summary}`.toLowerCase().includes(s)));
  }, [data.projects, kind, q]);

  const drop = async (stage: string, id: string) => {
    setDragOver('');
    const p = data.projects.find((x) => x.id === id);
    if (!p || p.stage === stage) return;
    try {
      await saveProject(id, {stage});
      toast({body: `${p.title}: ${stage}`, endContent: <Button label="Вернуть" variant="ghost" size="sm" onClick={() => saveProject(id, {stage: p.stage})} />});
    } catch (e) { toast({body: e instanceof Error ? e.message : 'Не сохранилось'}); }
  };

  return (
    <Page title={KIND_NAME[kind]} sub={`${KIND_HINT[kind]}. Перетащи карточку в другой этап или открой её.`}
      actions={
        <HStack gap={2} wrap="wrap">
          <TextInput label="Поиск по проектам" isLabelHidden placeholder="Поиск" startIcon={MagnifyingGlassIcon} value={q} onChange={setQ} />
          <Button label="Новый проект" variant="primary" icon={<PlusIcon />} onClick={() => setIsNew(true)} />
        </HStack>
      }>
      <section className="board" aria-label="Этапы">
        {stages.map((stage) => {
          const col = list.filter((p) => p.stage === stage);
          return (
            <section key={stage} className={`lane${dragOver === stage ? ' is-over' : ''}`} aria-label={stage}
              onDragOver={(e) => { e.preventDefault(); setDragOver(stage); }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(''); }}
              onDrop={(e) => { e.preventDefault(); drop(stage, e.dataTransfer.getData('text/plain')); }}>
              <HStack justify="between" vAlign="center" className="lane__head">
                <Text weight="semibold">{stage}</Text>
                <Text color="secondary" hasTabularNumbers>{col.length}</Text>
              </HStack>
              <VStack gap={2}>
                {col.map((p) => <ProjectCard key={p.id} p={p} onOpen={onOpen} />)}
                {col.length === 0 && <Text size="sm" color="secondary" className="lane__empty">{q ? 'Ничего не нашлось' : 'Пусто'}</Text>}
              </VStack>
            </section>
          );
        })}
      </section>
      <NewProject kind={kind} isOpen={isNew} onClose={() => setIsNew(false)} onMade={(id) => { setIsNew(false); onOpen(id); }} />
    </Page>
  );
}

export function ProjectCard({p, onOpen}: {p: Project; onOpen: (id: string) => void}) {
  const done = p.checklist.filter((c) => c.done).length;
  return (
    <article className="pcard tap" draggable onDragStart={(e) => { e.dataTransfer.setData('text/plain', p.id); e.dataTransfer.effectAllowed = 'move'; }}>
      <button type="button" className="cover" onClick={() => onOpen(p.id)} aria-label={`Открыть ${p.title}`} />
      <VStack gap={1}>
        <HStack justify="between" vAlign="start" gap={2}>
          <Text weight="semibold" className="pcard__title">{p.title}</Text>
          {p.is_fresh && <Badge label="новое" variant="teal" />}
        </HStack>
        {p.client && <Text size="sm" color="secondary" maxLines={1}>{p.client}</Text>}
        {p.next_step && <Text size="sm" maxLines={2} className="pcard__next">{p.next_step}</Text>}
        {p.checklist.length > 0 && (
          <Text size="sm" color="secondary" hasTabularNumbers>Чек-лист {done} из {p.checklist.length}</Text>
        )}
      </VStack>
    </article>
  );
}

function NewProject({kind, isOpen, onClose, onMade}: {kind: Kind; isOpen: boolean; onClose: () => void; onMade: (id: string) => void}) {
  const data = useData();
  const [title, setTitle] = useState('');
  const [client, setClient] = useState('');
  const [k, setK] = useState<Kind>(kind);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!title.trim()) return setErr('Как назовём проект?');
    setBusy(true);
    try {
      const p = await createProject({title, client, kind: k, stage: data.stages[k][0]});
      setTitle(''); setClient(''); setErr('');
      onMade(p.id);
    } catch (e2) { setErr(e2 instanceof Error ? e2.message : 'Не сохранилось'); } finally { setBusy(false); }
  };
  return (
    <Dialog isOpen={isOpen} onOpenChange={(o) => !o && onClose()} purpose="form">
      <form onSubmit={submit} noValidate>
        <VStack gap={4} padding={1}>
          <Heading level={2}>Новый проект</Heading>
          <TextInput label="Название" value={title} onChange={(v) => { setTitle(v); setErr(''); }} width="100%" hasAutoFocus
            status={err ? {type: 'error', message: err} : undefined} />
          <TextInput label="Клиент или для кого" isOptional value={client} onChange={setClient} width="100%" />
          <Selector label="Раздел" value={k} onChange={(v) => setK(v as Kind)} width="100%"
            options={data.kinds.map((x) => ({value: x, label: KIND_NAME[x]}))} />
          <HStack gap={2} justify="end">
            <Button label="Отмена" variant="ghost" onClick={onClose} />
            <Button label="Завести" variant="primary" type="submit" isLoading={busy} />
          </HStack>
        </VStack>
      </form>
    </Dialog>
  );
}
