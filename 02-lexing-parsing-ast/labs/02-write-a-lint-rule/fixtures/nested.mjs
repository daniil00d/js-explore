// Вложенные случаи: где именно проходит граница функции.

export async function walkTree(roots) {
  for (const root of roots) {
    for (const child of root.children) {
      await visit(child); // линтер
    }
  }
}

export async function outerOnly(ids) {
  for (const id of ids) {
    const load = async (items) => {
      // Внутри функции — но эта функция сама лежит в цикле,
      // а её собственный цикл создаёт последовательность заново.
      for (const item of items) {
        await fetchItem(item); // линтер
      }
    };
    schedule(load);
  }
}

export async function conditionAwait(source) {
  // Проверка условия выполняется на каждой итерации.
  while (await source.hasNext()) { // линтер
    handle(source.next());
  }
}

export class Loader {
  async loadAll(ids) {
    for (const id of ids) {
      this.items.push(await fetchItem(id)); // линтер
    }
  }
}
