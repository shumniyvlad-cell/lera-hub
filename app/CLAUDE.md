@AGENTS.md

# Штурман: рабочее место Леры

React 19 + Vite + Astryx (копия шаблона starter), тема `shturman` (морская волна #0B7A75, графит #5F6B78, системный шрифт).
Данные — API на «Часе» `https://marchvlv.ru/shturman-api` (`../server/server.mjs`), локально `http://localhost:8841`.
Сайт — GitHub Pages, собирается экшеном из `app/` на каждый push в main.

Экраны: Сегодня, Входящие (проекты из памяти Claude, синк `../sync/sync.mjs` каждый вечер в 21:00), Заметки Влада,
Трекер недели, доски Продюсирование / Продукты Влада / Кухня, Регламент (этапы в `src/model.ts` → GUIDE), Не работаем.
Свой CSS только в `src/app.css`, цвета из токенов. Новый компонент Astryx — дописать в optimizeDeps в vite.config.ts.

Проверка: `npx tsc -b && npm run build && npx astryx doctor --built dist`.
