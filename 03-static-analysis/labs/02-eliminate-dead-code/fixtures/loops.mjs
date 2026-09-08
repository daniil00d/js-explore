// Строки, которые обязан убрать оптимизатор, помечены комментарием «мёртвый».

export function firstNegative(numbers) {
  let index = 0;
  while (true) {
    if (numbers[index] < 0) return index;
    index += 1;
    if (index >= numbers.length) return -1;
  }
  return null; // мёртвый
}

export function keepFilled(rows) {
  const kept = [];
  for (const row of rows) {
    if (row.length === 0) {
      continue;
      kept.push('пусто'); // мёртвый
    }
    kept.push(row);
  }
  return kept;
}

export function main() {
  return { first: firstNegative([1, -2]), kept: keepFilled(['a', '', 'b']) };
}
