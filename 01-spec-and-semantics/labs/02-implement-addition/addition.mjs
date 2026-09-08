// Заготовка для лабы «Собери сложение по спецификации».
//
// Нужно реализовать три функции. Они соответствуют трём абстрактным операциям
// ECMA-262, и вместе дают поведение оператора `+`:
//
//   ToPrimitive                          → toPrimitive
//   ToNumeric                            → toNumeric
//   ApplyStringOrNumericBinaryOperator   → add
//
// Проверка сверяет результат с настоящим `+` на нескольких десятках случаев,
// включая порядок вызовов valueOf и toString.
//
//   node 01-spec-and-semantics/labs/02-implement-addition/check.mjs
//
// Пользоваться `left + right` внутри add не запрещено — сложение чисел где-то
// сделать всё равно нужно. Интерес не в этом, а в том, что происходит до него.

/**
 * ToPrimitive: превратить значение в примитив.
 *
 * Шаги по спецификации (7.1.1):
 *   1. Если значение не объект — вернуть как есть.
 *   2. Если у объекта есть метод Symbol.toPrimitive — вызвать его с подсказкой hint.
 *      Если вернулся примитив — это результат, иначе TypeError.
 *   3. Иначе OrdinaryToPrimitive: подсказка 'string' пробует toString, потом valueOf;
 *      'number' и 'default' — наоборот. Первый вызов, вернувший примитив, побеждает.
 *      Если оба вернули объекты — TypeError.
 *
 * @param {unknown} value
 * @param {'default' | 'number' | 'string'} hint
 */
export function toPrimitive(value, hint = 'default') {
  throw new Error('toPrimitive не реализована');
}

/**
 * ToNumeric: примитив → число или BigInt.
 *
 * BigInt остаётся BigInt, всё остальное проходит через ToNumber.
 * Symbol в число не превращается — это TypeError.
 *
 * @param {unknown} value
 */
export function toNumeric(value) {
  throw new Error('toNumeric не реализована');
}

/**
 * Оператор `+` целиком.
 *
 * Шаги по спецификации (13.15.3):
 *   1. Привести оба операнда к примитивам — сначала левый, потом правый.
 *   2. Если хотя бы один примитив оказался строкой — привести оба к строкам
 *      и склеить. Внимание: ToString от Symbol — это TypeError, хотя String()
 *      от него работает.
 *   3. Иначе привести оба к числовым типам и сложить. Смешивать BigInt
 *      с обычным числом нельзя — TypeError.
 *
 * @param {unknown} left
 * @param {unknown} right
 */
export function add(left, right) {
  throw new Error('add не реализована');
}
