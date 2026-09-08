// Значение переменной на выходе из функции помечено комментарием «→».

export function collect(source) {
  const limit = 3; // → 3
  let count = 0; // → ⊤
  const bump = () => { // → ⊤
    count += 1;
  };

  source.forEach(bump);

  const cap = limit * 2; // → 6
  const size = source.length; // → ⊤
  const name = String(limit); // → ⊤
  const dynamic = source[limit]; // → ⊤

  return { limit, count, bump, cap, size, name, dynamic };
}

export function main() {
  return [collect(['a', 'b']), collect([])];
}
