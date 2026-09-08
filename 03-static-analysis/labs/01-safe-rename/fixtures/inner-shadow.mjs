// переименовать: total (стр. 5) → item
// ожидается: отказ, в причине — «item»: внутри цикла это имя занято, ссылка попадёт в него

export function main() {
  let total = 0;
  for (const item of [1, 2, 3]) {
    total += item;
  }
  return { total };
}
