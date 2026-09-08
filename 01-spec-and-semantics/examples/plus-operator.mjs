// Оператор + под микроскопом: проверяем, что движок делает ровно то, что написано
// в алгоритмах спецификации. Разбор по шагам — в spec-walkthrough.md.
//
// Запуск: node 01-spec-and-semantics/examples/plus-operator.mjs

import { line, note, section, show, table } from './harness.mjs';

section('Порядок шагов при вычислении a + b');

const steps = [];
const operand = (name, value) => ({
  [Symbol.toPrimitive](hint) {
    steps.push(`ToPrimitive(${name}, "${hint}")`);
    return value;
  },
});

const operands = {
  get left() {
    steps.push('вычисление левого операнда');
    return operand('left', 1);
  },
  get right() {
    steps.push('вычисление правого операнда');
    return operand('right', 2);
  },
};

const sum = operands.left + operands.right;
steps.forEach((step, index) => line(`${index + 1}.`, step, 3));
line('   результат:', sum, 3);

note(
  'Порядок не «сначала полностью левый операнд, потом правый». Спецификация делит',
  'работу на два этапа: EvaluateStringOrNumericBinaryExpression вычисляет оба',
  'операнда слева направо, и только потом ApplyStringOrNumericBinaryOperator',
  'приводит их к примитивам — снова слева направо.',
  '',
  'Разница видна, когда побочные эффекты есть и там, и там: сначала отработали оба',
  'геттера, и лишь затем оба ToPrimitive.',
);

section('Какую подсказку получает объект');

const hints = [];
const spy = {
  [Symbol.toPrimitive](hint) {
    hints.push(hint);
    return 1;
  },
};

const operations = [
  ['spy + 1', () => spy + 1],
  ['spy - 1', () => spy - 1],
  ['spy * 2', () => spy * 2],
  ['`${spy}`', () => `${spy}`],
  ['String(spy)', () => String(spy)],
  ['spy == 1', () => spy == 1],
  ['[spy].join("")', () => [spy].join('')],
];

table(
  ['операция', 'hint', 'результат'],
  operations.map(([label, run]) => {
    hints.length = 0;
    const result = run();
    return [label, hints.join(', '), show(result)];
  }),
);

note(
  'Подсказок ровно три: "string", "number" и "default". Она передаётся только',
  'в Symbol.toPrimitive и означает не «во что превратить», а «что предпочтительнее».',
  'Объект вправе вернуть что угодно — например, всегда строку.',
  '',
  'Отдельная тонкость: у + подсказка "default", а не "number", потому что + умеет',
  'и складывать, и склеивать. Тот же "default" получает нестрогое сравнение ==.',
);

section('Если Symbol.toPrimitive не задан');

const calls = [];
const legacy = {
  valueOf() {
    calls.push('valueOf');
    return 10;
  },
  toString() {
    calls.push('toString');
    return 'десять';
  },
};

const probes = [
  ['legacy + 1', () => legacy + 1],
  ['`${legacy}`', () => `${legacy}`],
  ['legacy * 2', () => legacy * 2],
];

table(
  ['операция', 'что вызвано', 'результат'],
  probes.map(([label, run]) => {
    calls.length = 0;
    const result = run();
    return [label, calls.join(' → '), show(result)];
  }),
);

note(
  'Это OrdinaryToPrimitive: при подсказке "string" сначала пробуется toString, иначе —',
  'valueOf, а если метод вернул объект, берётся следующий. Не нашлось примитива —',
  'TypeError.',
);

section('Откуда берутся «странности» JS');

table(
  ['выражение', 'результат', 'почему'],
  [
    ['1 + 2 + "3"', show(1 + 2 + '3'), 'левая ассоциативность: (1 + 2) + "3"'],
    ['"1" + 2 + 3', show('1' + 2 + 3), 'первая же операция дала строку'],
    ['[] + []', show([] + []), 'обе стороны привелись к ""'],
    ['[] + {}', show([] + {}), '"" + "[object Object]"'],
    ['[1, 2] + [3]', show([1, 2] + [3]), 'join(",") с обеих сторон'],
    ['1 + null', show(1 + null), 'null не строка, значит ToNumeric: 1 + 0'],
    ['1 + undefined', show(1 + undefined), 'ToNumber(undefined) — это NaN'],
    ['"5" - 2', show('5' - 2), 'у минуса нет строкового пути вовсе'],
  ],
);

note(
  'Ни одного исключения из правил здесь нет: работает один и тот же алгоритм из',
  'четырёх шагов. Сначала оба операнда приводятся к примитивам, затем — если хотя бы',
  'один оказался строкой — обе стороны переводятся в строки и склеиваются, иначе обе',
  'переводятся в числа и складываются.',
  '',
  'Практический вывод для компилятора: чтобы соптимизировать a + b в машинное',
  'сложение, надо доказать, что оба операнда — числа. Пока это не доказано, за плюсом',
  'стоит вызов ToPrimitive, который может выполнить произвольный пользовательский код.',
  'Это и есть та спекуляция, на которую опирается TurboFan в разделе 11.',
);

console.log();
