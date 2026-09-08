// переименовать: total (стр. 5) → sum

export function main() {
  const items = [3, 4, 5];
  let total = 0;
  for (const item of items) {
    total += item;
  }
  return { total, average: total / items.length };
}
