// Эталонное решение лабы «Собери сложение по спецификации».
//
// Разбор алгоритмов, которые здесь повторяются, — в
// ../../examples/spec-walkthrough.md, а трассировка настоящего `+` —
// в ../../examples/plus-operator.mjs.

const isPrimitive = (value) => value === null || (typeof value !== 'object' && typeof value !== 'function');

/** OrdinaryToPrimitive (7.1.1.1): порядок методов зависит от подсказки. */
function ordinaryToPrimitive(value, hint) {
  const order = hint === 'string' ? ['toString', 'valueOf'] : ['valueOf', 'toString'];
  for (const name of order) {
    const method = value[name];
    if (typeof method === 'function') {
      const result = method.call(value);
      if (isPrimitive(result)) return result;
    }
  }
  throw new TypeError('Cannot convert object to primitive value');
}

/** ToPrimitive (7.1.1). */
export function toPrimitive(value, hint = 'default') {
  if (isPrimitive(value)) return value;

  const exotic = value[Symbol.toPrimitive];
  if (exotic !== undefined && exotic !== null) {
    const result = exotic.call(value, hint);
    if (isPrimitive(result)) return result;
    throw new TypeError('Cannot convert object to primitive value');
  }

  // Подсказка 'default' ведёт себя как 'number' — единственное место,
  // где эти две подсказки различаются, это Symbol.toPrimitive у Date.
  return ordinaryToPrimitive(value, hint === 'default' ? 'number' : hint);
}

/** ToNumeric (7.1.4): BigInt остаётся собой, остальное идёт в ToNumber. */
export function toNumeric(value) {
  const primitive = toPrimitive(value, 'number');
  if (typeof primitive === 'bigint') return primitive;
  return Number(primitive); // Number(Symbol()) сам бросает TypeError
}

/**
 * ToString (7.1.17) для примитива.
 *
 * Отдельная функция нужна из-за символов: `String(Symbol())` возвращает
 * 'Symbol()', а ToString по спецификации бросает TypeError. Поэтому
 * 'a' + Symbol() — ошибка, а String(Symbol()) — нет.
 */
function toStringValue(primitive) {
  if (typeof primitive === 'symbol') throw new TypeError('Cannot convert a Symbol value to a string');
  return String(primitive);
}

/** ApplyStringOrNumericBinaryOperator (13.15.3) для оператора +. */
export function add(left, right) {
  // Порядок важен: сначала полностью приводится левый операнд, потом правый.
  // Именно поэтому побочные эффекты в valueOf видны в предсказуемом порядке.
  const leftPrimitive = toPrimitive(left);
  const rightPrimitive = toPrimitive(right);

  if (typeof leftPrimitive === 'string' || typeof rightPrimitive === 'string') {
    return toStringValue(leftPrimitive) + toStringValue(rightPrimitive);
  }

  const leftNumeric = toNumeric(leftPrimitive);
  const rightNumeric = toNumeric(rightPrimitive);

  // Типы должны совпасть: BigInt складывается только с BigInt.
  if (typeof leftNumeric !== typeof rightNumeric) {
    throw new TypeError('Cannot mix BigInt and other types, use explicit conversions');
  }

  return leftNumeric + rightNumeric;
}
