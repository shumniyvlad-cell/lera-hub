import {VStack} from '@astryxdesign/core/VStack';
import {HStack} from '@astryxdesign/core/HStack';
import {Card} from '@astryxdesign/core/Card';
import {Text} from '@astryxdesign/core/Text';
import {Button} from '@astryxdesign/core/Button';
import {EmptyState} from '@astryxdesign/core/EmptyState';
import {Grid} from '@astryxdesign/core/Grid';
import {InboxIcon} from '@heroicons/react/24/outline';
import {useData} from '../store';
import {ago, KIND_NAME} from '../model';
import {Page} from '../parts';

export function Inbox({onOpen}: {onOpen: (id: string) => void}) {
  const data = useData();
  const list = data.projects.filter((p) => p.status === 'inbox').sort((a, b) => b.created_at.localeCompare(a.created_at));
  return (
    <Page title="Входящие" sub="Сюда каждый вечер сами приходят новые проекты из памяти Claude. Изучи карточку, потом возьми в работу или отметь «Не работаем».">
      {list.length === 0 ? (
        <EmptyState headingLevel={2} icon={<InboxIcon width={40} height={40} />} title="Всё разобрано"
          description={`Новые проекты придут вечером в 21:00.${data.lastSync ? ` Последний синк ${ago(data.lastSync.at)}.` : ''}`} />
      ) : (
        <Grid columns={{minWidth: 300}} gap={3}>
          {list.map((p) => (
            <Card key={p.id} padding={4}>
              <VStack gap={3}>
                <VStack gap={1}>
                  <Text weight="semibold" size="lg">{p.title}</Text>
                  <Text size="sm" color="secondary">Пришёл {ago(p.created_at)}, похоже на «{KIND_NAME[p.kind]}»</Text>
                </VStack>
                <Text maxLines={4}>{p.summary || 'Описания нет, загляни в память Claude в карточке.'}</Text>
                <HStack gap={2}>
                  <Button label="Изучить" variant="primary" onClick={() => onOpen(p.id)} />
                </HStack>
              </VStack>
            </Card>
          ))}
        </Grid>
      )}
    </Page>
  );
}
