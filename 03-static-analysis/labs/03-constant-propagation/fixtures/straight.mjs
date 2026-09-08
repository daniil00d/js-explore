// Значение переменной на выходе из функции помечено комментарием «→».

export function measure(width, factor) {
  const base = 10; // → 10
  const doubled = base * 2; // → 20
  const label = 'ш' + '×'; // → "ш×"
  const scaled = doubled * factor; // → ⊤
  let total = doubled + 5; // → 15
  const flag = !(base > 3); // → false
  const size = width; // → ⊤

  total = total - base;

  return { base, doubled, label, scaled, total, flag, size };
}

export function main() {
  return [measure(4, 2), measure(0, -1), measure(7, 0)];
}
