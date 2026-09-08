// Значение переменной на выходе из функции помечено комментарием «→».

export function sum(items) {
  const start = 0; // → 0
  const step = 1; // → 1
  let total = start; // → ⊤
  let seen = start; // → ⊤
  let ready = false; // → true

  for (const item of items) {
    total = total + item;
    seen = seen + step;
  }

  ready = true;
  const label = 'шаг ' + step; // → "шаг 1"
  const average = total / seen; // → ⊤

  return { start, step, total, seen, ready, label, average };
}

export function main() {
  return [sum([1, 2, 3]), sum([]), sum([-5])];
}
