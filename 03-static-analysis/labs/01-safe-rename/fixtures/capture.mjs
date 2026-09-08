// переименовать: value (стр. 7) → limit
// ожидается: отказ, в причине — «limit»: имя приходит извне, новое объявление его затенит

const limit = 10;

export function main() {
  let value = 3;
  const inner = () => value + limit;
  value += 1;
  return { total: inner() };
}
