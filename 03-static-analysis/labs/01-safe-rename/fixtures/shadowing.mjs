// переименовать: cache (стр. 3) → store

const cache = new Map();

function reset(cache) {
  cache.clear();
  return cache.size;
}

export function main() {
  cache.set('a', 1);
  cache.set('b', 2);
  return { size: cache.size, cleared: reset(new Map([['x', 1]])) };
}
