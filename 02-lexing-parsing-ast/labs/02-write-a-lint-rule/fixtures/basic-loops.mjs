// Простые случаи: await прямо в теле цикла.
//
// Строки, которые правило должно пометить, отмечены комментарием «линтер».

export async function loadAll(ids) {
  const items = [];
  for (const id of ids) {
    items.push(await fetchItem(id)); // линтер
  }
  return items;
}

export async function drain(queue) {
  while (queue.length > 0) {
    const task = queue.shift();
    await task(); // линтер
  }
}

export async function retry(attempt) {
  do {
    await attempt(); // линтер
  } while (!attempt.done);
}

export async function countdown(from) {
  for (let index = from; index > 0; index -= 1) {
    await tick(index); // линтер
  }
}
