// Случаи, которые правило помечать не должно.

export async function loadTogether(ids) {
  // Правильный вариант: все запросы стартуют сразу.
  return Promise.all(ids.map((id) => fetchItem(id)));
}

export async function consume(stream) {
  // for await — это не «await в цикле», а способ читать асинхронный источник.
  for await (const chunk of stream) {
    handle(chunk);
  }
}

export async function afterLoop(ids) {
  const requests = [];
  for (const id of ids) {
    requests.push(fetchItem(id));
  }
  // Здесь цикл уже закончился.
  return await Promise.all(requests);
}

export async function initOnce(source) {
  // Инициализация цикла выполняется один раз, последовательности итераций
  // она не создаёт — этот await помечать не нужно.
  for (let cursor = await source.first(); cursor; cursor = cursor.next) {
    handle(cursor);
  }
}

export function makeHandlers(ids) {
  const handlers = [];
  for (const id of ids) {
    // Граница функции: этот await выполнится когда-нибудь потом и к итерациям
    // цикла отношения не имеет.
    handlers.push(async () => {
      await fetchItem(id);
    });
  }
  return handlers;
}
