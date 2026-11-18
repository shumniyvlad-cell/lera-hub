import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import '@astryxdesign/core/reset.css';
import '@astryxdesign/core/astryx.css';
import './app.css';
import {Theme} from '@astryxdesign/core/theme';
import {LayerProvider} from '@astryxdesign/core/Layer';
import {InternationalizationProvider} from '@astryxdesign/core/i18n';
import ruRU from '@astryxdesign/core/locales/ru-RU.generated.js';
import {themes, defaultThemeSlug} from './astryx-themes';
import {refresh, useMode} from './store';
import App from './App';

function Root() {
  const mode = useMode();
  return (
    <Theme theme={themes[defaultThemeSlug]} mode={mode}>
      <LayerProvider>
        <App />
      </LayerProvider>
    </Theme>
  );
}

refresh();
// вкладка вернулась на экран — подтянуть свежее (Влад мог оставить заметку)
addEventListener('visibilitychange', () => document.visibilityState === 'visible' && refresh(true));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <InternationalizationProvider locale="ru-RU" messages={{'ru-RU': ruRU}}>
      <Root />
    </InternationalizationProvider>
  </StrictMode>,
);
