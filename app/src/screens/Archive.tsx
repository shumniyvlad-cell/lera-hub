import {VStack} from '@astryxdesign/core/VStack';
import {Text} from '@astryxdesign/core/Text';
import {Button} from '@astryxdesign/core/Button';
import {EmptyState} from '@astryxdesign/core/EmptyState';
import {List, ListItem} from '@astryxdesign/core/List';
import {useToast} from '@astryxdesign/core/Toast';
import {ArchiveBoxIcon} from '@heroicons/react/24/outline';
import {saveProject, useData} from '../store';
import {ago, KIND_NAME} from '../model';
import {Block, Page} from '../parts';

export function Archive({onOpen}: {onOpen: (id: string) => void}) {
  const data = useData();
  const toast = useToast();
  const dropped = data.projects.filter((p) => p.status === 'dropped').sort((a, b) => b.dropped_at.localeCompare(a.dropped_at));
  const back = async (id: string) => {
    try { await saveProject(id, {status: 'active'}); toast({body: 'Вернули в работу'}); } catch (e) { toast({body: e instanceof Error ? e.message : 'Не сохранилось'}); }
  };
  return (
    <Page title="Не работаем" sub={data.me.role === 'vlad'
      ? 'Лера отметила эти проекты. Подтверди удаление памяти на маке: node lera-hub/sync/sync.mjs purge — по каждому спросит «да/нет».'
      : 'Проекты, с которыми мы закончили. Влад подтверждает и удаляет их из памяти Claude, чтобы она не забивалась. Пока не удалил, можно вернуть.'}>
      <Block title={`Ждут удаления: ${dropped.length}`}>
        {dropped.length === 0 ? (
          <EmptyState icon={<ArchiveBoxIcon width={36} height={36} />} isCompact title="Пусто"
            description="Открой проект и нажми «Не работаем с проектом» внизу карточки." />
        ) : (
          <List hasDividers edge="outset">
            {dropped.map((p) => (
              <ListItem key={p.id} itemKey={p.id} label={p.title} onClick={() => onOpen(p.id)}
                description={<Text size="sm" color="secondary">{KIND_NAME[p.kind]}, {ago(p.dropped_at)}{p.drop_reason ? `: ${p.drop_reason}` : ''}</Text>}
                endContent={<Button label="Вернуть" variant="secondary" size="sm" onClick={() => back(p.id)} />} />
            ))}
          </List>
        )}
      </Block>
      {data.purged.length > 0 && (
        <Block title="Удалены из памяти Claude">
          <VStack gap={1}>
            {data.purged.map((p) => (
              <Text key={p.id} size="sm" color="secondary">{p.title}, {ago(p.purged_at)}{p.drop_reason ? `: ${p.drop_reason}` : ''}</Text>
            ))}
          </VStack>
        </Block>
      )}
    </Page>
  );
}
