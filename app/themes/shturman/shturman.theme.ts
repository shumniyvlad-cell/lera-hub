// The shturman theme. `astryx experimental theme editor` wrote this file once and never changes it again.
// The checked settings live in shturman.settings.json and the generated shturman.settings.ts;
// change them with `astryx experimental theme editor set shturman ...`. Add your own changes below: they win over the settings.
import {defineTheme} from '@astryxdesign/core/theme';
import {shturmanSettings} from './shturman.settings';

export const shturmanTheme = defineTheme({
  extends: shturmanSettings,
  name: 'shturman',
});
