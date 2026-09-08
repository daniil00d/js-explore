// Проверка лабы: эталон для сравнения — настоящий оператор `+` и настоящие
// приведения, а не заранее записанные ответы.
//
//   node 01-spec-and-semantics/labs/02-implement-addition/check.mjs
//   node 01-spec-and-semantics/labs/02-implement-addition/check.mjs --solution

import { inspect } from 'node:util';
import { equals, labTarget, report } from '../../../tools/lab.mjs';

const target = await import(labTarget(import.meta.url, 'addition.mjs'));

/** Результат вызова в сравнимом виде: либо значение, либо имя ошибки. */
function outcome(fn) {
  try {
    const value = fn();
    return typeof value === 'symbol' ? value.toString() : value;
  } catch (error) {
    return `${error.constructor.name}`;
  }
}

const symbol = Symbol('метка');

/** Пары для сравнения с настоящим `+`. Каждая — функция, чтобы объекты были свежими. */
const additionCases = [
  ['числа', () => [1, 2]],
  ['строка и число', () => ['1', 2]],
  ['число и строка', () => [1, '2']],
  ['строки', () => ['раз', 'два']],
  ['логическое и число', () => [true, 1]],
  ['null и число', () => [null, 1]],
  ['undefined и число', () => [undefined, 1]],
  ['пустой массив и объект', () => [[], {}]],
  ['массив и строка', () => [[1, 2], '3']],
  ['объект и пустая строка', () => [{}, '']],
  ['дробные числа', () => [0.1, 0.2]],
  ['NaN', () => [Number.NaN, 1]],
  ['минус ноль', () => [-0, 0]],
  ['BigInt и BigInt', () => [1n, 2n]],
  ['BigInt и число', () => [1n, 1]],
  ['BigInt и строка', () => [1n, '1']],
  ['символ и число', () => [symbol, 1]],
  ['строка и символ', () => ['метка: ', symbol]],
  ['дата и число', () => [new Date(0), 1]],
  ['valueOf возвращает число', () => [{ valueOf: () => 40 }, 2]],
  ['только toString', () => [{ toString: () => 'текст' }, '!']],
  ['Symbol.toPrimitive', () => [{ [Symbol.toPrimitive]: (hint) => (hint === 'string' ? 'строка' : 7) }, 1]],
  ['Symbol.toPrimitive возвращает объект', () => [{ [Symbol.toPrimitive]: () => ({}) }, 1]],
  ['valueOf возвращает объект', () => [{ valueOf: () => ({}), toString: () => 'через toString' }, '!']],
  ['ни valueOf, ни toString', () => [Object.create(null), 1]],
  ['вложенные массивы', () => [[[1], [2]], '']],
];

const results = additionCases.map(([name, makePair]) => {
  const [nativeLeft, nativeRight] = makePair();
  const expected = outcome(() => nativeLeft + nativeRight);
  const [ourLeft, ourRight] = makePair();
  const actual = outcome(() => target.add(ourLeft, ourRight));
  return equals(name, expected, actual, 'Сверься с шагами ApplyStringOrNumericBinaryOperator в шапке заготовки.');
});

// Порядок приведений: сначала левый операнд целиком, потом правый.
{
  const trace = [];
  const probe = (name) => ({
    [Symbol.toPrimitive](hint) {
      trace.push(`${name}(${hint})`);
      return 1;
    },
  });

  const nativeTrace = (() => {
    trace.length = 0;
    void (probe('левый') + probe('правый'));
    return [...trace];
  })();

  const ourTrace = (() => {
    trace.length = 0;
    try {
      target.add(probe('левый'), probe('правый'));
    } catch {
      // порядок важнее результата
    }
    return [...trace];
  })();

  results.push(
    equals(
      'порядок Symbol.toPrimitive',
      nativeTrace,
      ourTrace,
      'Подсказка при сложении — default, и левый операнд приводится первым.',
    ),
  );
}

// Порядок valueOf и toString внутри одного объекта.
{
  const trace = [];
  const probe = (name) => ({
    valueOf() {
      trace.push(`${name}:valueOf`);
      return {};
    },
    toString() {
      trace.push(`${name}:toString`);
      return name;
    },
  });

  const nativeTrace = (() => {
    trace.length = 0;
    void (probe('левый') + probe('правый'));
    return [...trace];
  })();

  const ourTrace = (() => {
    trace.length = 0;
    try {
      target.add(probe('левый'), probe('правый'));
    } catch {
      // порядок важнее результата
    }
    return [...trace];
  })();

  results.push(
    equals(
      'порядок valueOf и toString',
      nativeTrace,
      ourTrace,
      'valueOf пробуется первым, и только если он вернул объект — очередь toString.',
    ),
  );
}

// toPrimitive отдельно: подсказка меняет порядок методов.
const primitiveCases = [
  ['примитив проходит насквозь', () => [42, 'default'], () => 42],
  ['строка проходит насквозь', () => ['уже строка', 'number'], () => 'уже строка'],
  ['символ проходит насквозь', () => [symbol, 'string'], () => symbol.toString()],
  [
    'подсказка number',
    () => [{ valueOf: () => 1, toString: () => 'строка' }, 'number'],
    () => 1,
  ],
  [
    'подсказка string',
    () => [{ valueOf: () => 1, toString: () => 'строка' }, 'string'],
    () => 'строка',
  ],
  [
    'подсказка default как number',
    () => [{ valueOf: () => 1, toString: () => 'строка' }, 'default'],
    () => 1,
  ],
  ['массив с подсказкой number', () => [[1, 2], 'number'], () => '1,2'],
  ['объект с подсказкой number', () => [{}, 'number'], () => '[object Object]'],
  ['дата с подсказкой default', () => [new Date(0), 'default'], () => new Date(0).toString()],
  ['дата с подсказкой number', () => [new Date(0), 'number'], () => 0],
];

for (const [name, makeArgs, expectedValue] of primitiveCases) {
  const [value, hint] = makeArgs();
  results.push(
    equals(
      `toPrimitive: ${name}`,
      outcome(expectedValue),
      outcome(() => target.toPrimitive(value, hint)),
      'Подсказка string меняет порядок на toString → valueOf; default ведёт себя как number.',
    ),
  );
}

// toNumeric: эталон — Number, кроме BigInt.
const numericCases = [5, '5', '', '  12  ', '0x10', 'не число', true, false, null, undefined, 5n, -0, symbol];

for (const value of numericCases) {
  const label = inspect(value);
  results.push(
    equals(
      `toNumeric: ${label}`,
      outcome(() => (typeof value === 'bigint' ? value : Number(value))),
      outcome(() => target.toNumeric(value)),
      'BigInt возвращается как есть, остальное — через Number; символ даёт TypeError.',
    ),
  );
}

report('Лаба 01-2: собери сложение по спецификации', results);
