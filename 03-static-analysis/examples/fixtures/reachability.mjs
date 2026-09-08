// Подопытный модуль для build-cfg.mjs: в нём намеренно есть недостижимый код.
//
// Строки, до которых управление не может дойти ни при каких входных данных,
// помечены комментарием `// недостижимо`. Пример не читает эти пометки — они
// здесь для того, чтобы читатель мог сверить их со списком, который анализ
// выведет сам.

export function classify(value) {
  if (value > 0) {
    return 'плюс';
  } else {
    return 'ноль или минус';
  }
  return 'сюда не дойти'; // недостижимо
}

export function retry(task, limit) {
  let attempt = 0;
  while (true) {
    attempt += 1;
    const result = task(attempt);
    if (result !== null) return result;
    if (attempt >= limit) throw new Error('попытки исчерпаны');
  }
  return null; // недостижимо
}

export function route(method) {
  switch (method) {
    case 'get':
      return 'чтение';
      break; // недостижимо
    case 'put':
    case 'post':
      return 'запись';
    default:
      return 'неизвестный метод';
  }
}

export function summarize(items) {
  const ids = [];
  for (const item of items) {
    if (!item.ok) continue;
    ids.push(item.id);
    if (ids.length > 100) break;
  }
  if (ids.length === 0) {
    return 'пусто';
  }
  return ids.join(',');
}

export function withHoisting(flag) {
  if (flag) return helper();
  return 'нет';
  // Инструкция недостижима, но привязка `helper` создаётся при входе в функцию,
  // поэтому вызов выше работает. Удалять такое «мёртвое» объявление нельзя.
  function helper() {
    return 'да';
  }
}
