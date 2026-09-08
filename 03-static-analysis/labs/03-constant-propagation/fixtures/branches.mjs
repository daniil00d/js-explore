// Значение переменной на выходе из функции помечено комментарием «→».

export function pick(mode) {
  const debug = false; // → false
  const limit = 100; // → 100
  let level; // → "warn"
  let shown; // → ⊤
  let unit; // → "мс"

  // Условие — константа, поэтому ветка then в программе не участвует.
  if (debug) {
    level = 'debug';
    shown = limit;
  } else {
    level = 'warn';
    shown = 0;
  }

  // Условие неизвестно, поэтому обе ветки нужно объединить: unit в них
  // совпадает и остаётся константой, shown расходится и становится ⊤.
  if (mode === 'quiet') {
    shown = 0;
    unit = 'мс';
  } else {
    shown = limit;
    unit = 'мс';
  }

  return { debug, limit, level, shown, unit };
}

export function main() {
  return [pick('quiet'), pick('loud')];
}
