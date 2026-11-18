import {useState} from 'react';
import {VStack} from '@astryxdesign/core/VStack';
import {Grid} from '@astryxdesign/core/Grid';
import {Card} from '@astryxdesign/core/Card';
import {Text} from '@astryxdesign/core/Text';
import {Heading} from '@astryxdesign/core/Heading';
import {TabList, Tab} from '@astryxdesign/core/TabList';
import {GUIDE, KIND_HINT, KIND_NAME, type Kind} from '../model';
import {Block, Page} from '../parts';

const FLOW = [
  ['Входящие', 'Вечером Claude сам присылает новые проекты из памяти Влада. Утром изучаешь и решаешь: берём в работу или нет.'],
  ['В работу', 'В карточке выбираешь раздел и этап. Проект появляется на доске и на главной.'],
  ['Следующий шаг', 'У каждого живого проекта записан один следующий шаг. Главная собирает их в список.'],
  ['План дня', 'Заметки Влада сами падают в план на сегодня. Свои дела добавляешь в «Сегодня» или в «Трекер недели».'],
  ['Не работаем', 'Закончили или клиент ушёл — отмечаешь «Не работаем». Влад подтверждает, и Claude забывает проект.'],
];

export function Guide() {
  const [kind, setKind] = useState<Kind>('client');
  return (
    <Page title="Регламент" sub="Как устроена работа: что делаем на каждом этапе, где лежит и когда этап закрыт.">
      <Block title="Как пользоваться Штурманом">
        <Grid columns={{minWidth: 200}} gap={3}>
          {FLOW.map(([t, d], i) => (
            <Card key={t} padding={4}>
              <VStack gap={2}>
                <Text color="secondary" hasTabularNumbers>{i + 1}</Text>
                <Text weight="semibold">{t}</Text>
                <Text size="sm" color="secondary">{d}</Text>
              </VStack>
            </Card>
          ))}
        </Grid>
      </Block>
      <VStack gap={4}>
        <TabList value={kind} onChange={(v) => setKind(v as Kind)} hasDivider>
          {(Object.keys(GUIDE) as Kind[]).map((k) => <Tab key={k} value={k} label={KIND_NAME[k]} />)}
        </TabList>
        <Text color="secondary">{KIND_HINT[kind]}.</Text>
        <VStack gap={3}>
          {GUIDE[kind].map((g, i) => (
            <Card key={g.stage} padding={5}>
              <Grid columns={{minWidth: 260}} gap={4}>
                <VStack gap={2}>
                  <Text color="secondary" hasTabularNumbers>Этап {i + 1}</Text>
                  <Heading level={2}>{g.stage}</Heading>
                  <Text>{g.what}</Text>
                </VStack>
                <VStack gap={2}>
                  <Text size="sm"><strong>Где:</strong> {g.where}</Text>
                  <Text size="sm"><strong>Закрыт, когда:</strong> {g.done}</Text>
                  {g.checklist.length > 0 && (
                    <VStack gap={1} className="ticks">
                      {g.checklist.map((c) => <Text key={c} size="sm" color="secondary">{c}</Text>)}
                    </VStack>
                  )}
                </VStack>
              </Grid>
            </Card>
          ))}
        </VStack>
      </VStack>
    </Page>
  );
}
