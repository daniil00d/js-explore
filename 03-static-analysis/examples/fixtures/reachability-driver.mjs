// Драйвер для сбора покрытия: вызывает функции из reachability.mjs.
//
// Вызовы подобраны так, чтобы часть достижимых ветвей осталась невыполненной:
// `route` ни разу не получает неизвестный метод, `summarize` — пустой список,
// а `retry` не доходит до исчерпания попыток. Ровно на этой разнице и видно,
// чем «недостижимо» отличается от «не покрыто».

import { classify, retry, route, summarize, withHoisting } from './reachability.mjs';

classify(1);
classify(-1);
retry((attempt) => (attempt >= 2 ? 'готово' : null), 5);
route('get');
route('post');
summarize([
  { ok: true, id: 1 },
  { ok: false, id: 2 },
]);
withHoisting(true);
