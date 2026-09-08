// Приоритеты операторов: разбор выражений методом Пратта и сверка с acorn.
//
// Запуск: node 02-lexing-parsing-ast/examples/precedence.mjs

import * as acorn from 'acorn';
import { note, section, table, truncate } from '../../tools/format.mjs';
import { tokenize } from './lexer.mjs';

// Приоритет тем выше, чем сильнее оператор «притягивает» операнды.
// Числа взяты из таблицы выражений ECMA-262 и специально идут с шагом 1.
const BINARY_PRECEDENCE = {
  '??': 1,
  '||': 2,
  '&&': 3,
  '|': 4,
  '^': 5,
  '&': 6,
  '==': 7, '!=': 7, '===': 7, '!==': 7,
  '<': 8, '>': 8, '<=': 8, '>=': 8, in: 8, instanceof: 8,
  '<<': 9, '>>': 9, '>>>': 9,
  '+': 10, '-': 10,
  '*': 11, '/': 11, '%': 11,
  '**': 12,
};

const RIGHT_ASSOCIATIVE = new Set(['**']);
const UNARY = new Set(['-', '+', '!', '~', 'typeof', 'void', 'delete']);

/**
 * Разбор выражений методом Пратта (precedence climbing).
 * Вся таблица приоритетов — в BINARY_PRECEDENCE, самого рекурсивного спуска
 * по одной функции на каждый уровень приоритета здесь нет.
 */
export function parseExpression(source) {
  const { tokens } = tokenize(source);
  let position = 0;

  const peek = () => tokens[position];
  const next = () => tokens[position++];
  const eat = (value) => {
    if (peek()?.value === value) {
      position += 1;
      return true;
    }
    return false;
  };
  const expect = (value) => {
    if (!eat(value)) throw new SyntaxError(`Ожидался ${value}, а встретился ${peek()?.value ?? 'конец ввода'}`);
  };

  const parsePrimary = () => {
    const token = next();
    if (!token) throw new SyntaxError('Неожиданный конец выражения');
    if (token.value === '(') {
      const inner = parseBinary(0);
      expect(')');
      return inner;
    }
    if (UNARY.has(token.value)) {
      // Приоритет унарных операторов выше любого бинарного, кроме **:
      // именно поэтому -2 ** 2 запрещено спецификацией как двусмысленное.
      return { kind: 'unary', op: token.value, argument: parseUnaryOperand() };
    }
    if (token.type === 'number') return { kind: 'number', value: token.value };
    if (token.type === 'string') return { kind: 'string', value: token.value };
    if (token.type === 'name' || token.type === 'keyword') return { kind: 'name', name: token.value };
    throw new SyntaxError(`Не выражение: ${token.value}`);
  };

  const parseUnaryOperand = () => {
    let node = parsePrimary();
    // Возведение в степень связывает сильнее унарного минуса справа: -x ** y
    // спецификация запрещает, но 2 ** -1 разрешено, поэтому справа разбор продолжается.
    while (peek()?.value === '**') {
      next();
      node = { kind: 'binary', op: '**', left: node, right: parseBinary(BINARY_PRECEDENCE['**']) };
    }
    return node;
  };

  const parseBinary = (minPrecedence) => {
    let left = parsePrimary();
    for (;;) {
      const token = peek();
      if (!token) break;
      const precedence = BINARY_PRECEDENCE[token.value];
      if (precedence === undefined || precedence < minPrecedence) break;
      next();
      const nextMinimum = RIGHT_ASSOCIATIVE.has(token.value) ? precedence : precedence + 1;
      const right = parseBinary(nextMinimum);
      left = { kind: 'binary', op: token.value, left, right };
    }
    return parseTail(left, minPrecedence);
  };

  const parseTail = (left, minPrecedence) => {
    if (minPrecedence > 0) return left;
    if (eat('?')) {
      const consequent = parseBinary(0);
      expect(':');
      const alternate = parseTail(parseBinary(0), 0);
      return { kind: 'conditional', test: left, consequent, alternate };
    }
    if (peek()?.value === '=') {
      next();
      // Присваивание правоассоциативно: a = b = c читается как a = (b = c).
      return { kind: 'assign', target: left, value: parseTail(parseBinary(0), 0) };
    }
    return left;
  };

  const result = parseTail(parseBinary(0), 0);
  if (position < tokens.length) {
    throw new SyntaxError(`Лишний хвост: ${tokens.slice(position).map((token) => token.value).join(' ')}`);
  }
  return result;
}

/** Одинаковая запись дерева для обоих парсеров — так их можно сравнивать строками. */
function sexpr(node) {
  switch (node.kind) {
    case 'number':
    case 'string':
      return node.value;
    case 'name':
      return node.name;
    case 'unary':
      return `(${node.op}. ${sexpr(node.argument)})`;
    case 'binary':
      return `(${node.op} ${sexpr(node.left)} ${sexpr(node.right)})`;
    case 'conditional':
      return `(?: ${sexpr(node.test)} ${sexpr(node.consequent)} ${sexpr(node.alternate)})`;
    case 'assign':
      return `(= ${sexpr(node.target)} ${sexpr(node.value)})`;
    default:
      throw new Error(`Неизвестный узел: ${node.kind}`);
  }
}

function sexprFromAcorn(node) {
  switch (node.type) {
    case 'Literal':
      return node.raw;
    case 'Identifier':
      return node.name;
    case 'UnaryExpression':
      return `(${node.operator}. ${sexprFromAcorn(node.argument)})`;
    case 'BinaryExpression':
    case 'LogicalExpression':
      return `(${node.operator} ${sexprFromAcorn(node.left)} ${sexprFromAcorn(node.right)})`;
    case 'ConditionalExpression':
      return `(?: ${sexprFromAcorn(node.test)} ${sexprFromAcorn(node.consequent)} ${sexprFromAcorn(node.alternate)})`;
    case 'AssignmentExpression':
      return `(${node.operator} ${sexprFromAcorn(node.left)} ${sexprFromAcorn(node.right)})`;
    default:
      throw new Error(`Неизвестный узел acorn: ${node.type}`);
  }
}

const viaAcorn = (code) => {
  const parsed = acorn.parse(code, { ecmaVersion: 'latest' });
  return sexprFromAcorn(parsed.body[0].expression);
};

const attempt = (fn) => {
  try {
    return { ok: true, value: fn() };
  } catch (error) {
    return { ok: false, value: truncate(error.message.replace(/\s*\(\d+:\d+\)$/, ''), 34) };
  }
};

section('Как приоритеты выглядят в дереве');

const expressions = [
  'a + b * c',
  '(a + b) * c',
  'a - b - c',
  '2 ** 3 ** 2',
  'a && b || c',
  'a ?? b',
  '-a * b',
  '2 ** -1',
  'typeof a + b',
  'a < b === c',
  'a ? b : c ? d : e',
  'x = y = z',
  'a = b ? c : d',
];

table(
  ['выражение', 'наш парсер', 'acorn', 'совпало'],
  expressions.map((code) => {
    const ours = attempt(() => sexpr(parseExpression(code)));
    const theirs = attempt(() => viaAcorn(code));
    const same = ours.ok && theirs.ok && ours.value === theirs.value;
    return [code, ours.value, theirs.value, same ? 'да' : 'нет'];
  }),
);

note(
  'Таблица приоритетов из двадцати строк заменяет двадцать функций рекурсивного спуска:',
  'разбор Пратта берёт левый операнд, смотрит на оператор и решает, забирать его себе',
  'или отдать наверх. Ассоциативность задаётся тем же числом — для правоассоциативных',
  'операторов в рекурсию передаётся тот же приоритет, а не приоритет плюс один.',
  '',
  'Проверка здесь не декоративная: дерево нашего парсера сравнивается с деревом acorn',
  'посимвольно. Ошибись в таблице на единицу — и `a - b - c` соберётся вправо, а',
  'колонка «совпало» это покажет.',
);

section('Случаи, которые спецификация запрещает');

const forbidden = ['-2 ** 2', 'a ?? b || c', 'a || b ?? c', 'typeof a ** 2'];

table(
  ['выражение', 'наш парсер', 'acorn'],
  forbidden.map((code) => {
    const ours = attempt(() => sexpr(parseExpression(code)));
    const theirs = attempt(() => viaAcorn(code));
    return [code, ours.ok ? `разобрал: ${ours.value}` : ours.value, theirs.ok ? `разобрал: ${theirs.value}` : theirs.value];
  }),
);

note(
  'Здесь наш парсер расходится с языком, и это полезное расхождение. Приоритеты сами',
  'по себе позволяют разобрать `-2 ** 2` и `a ?? b || c` — а спецификация их запрещает',
  'именно потому, что читатель прочтёт их неоднозначно. Запрет живёт не в таблице',
  'приоритетов, а в отдельном правиле грамматики: `**` требует, чтобы слева стоял',
  'UpdateExpression, а не UnaryExpression.',
  '',
  'Это ровно те ранние ошибки из раздела 01, только замеченные с другой стороны:',
  'разбор возможен, но грамматика его не разрешает.',
);

section('Cover grammar: когда парсеру приходится перечитывать');

const covers = [
  ['(a, b)', 'выражение с запятой'],
  ['(a, b) => a', 'параметры стрелки'],
  ['({ a: 1 })', 'литерал объекта'],
  ['({ a } = obj)', 'цель деструктуризации'],
  ['async (x)', 'вызов функции с именем async'],
  ['async (x) => x', 'асинхронная стрелка'],
];

table(
  ['код', 'что это оказалось', 'тип узла в acorn'],
  covers.map(([code, label]) => {
    const parsed = attempt(() => acorn.parse(code, { ecmaVersion: 'latest' }).body[0].expression.type);
    return [code, label, parsed.value];
  }),
);

note(
  'Первые символы у этих пар совпадают, а смысл разный, и понять его можно только',
  'дочитав до `=>` или `=`. Спецификация решает это через cover grammar: сначала текст',
  'разбирается по более широкому правилу (CoverParenthesizedExpressionAndArrowParameterList),',
  'а потом, когда всё прояснилось, переинтерпретируется по нужному.',
  '',
  'В реализациях это стоит денег: парсер либо возвращается назад и перечитывает участок,',
  'либо строит дерево, которое потом переписывает. Заметно это, например, в логах V8 из',
  'lazy-parsing.mjs: стрелочные функции отмечаются там отдельным событием `parse`,',
  'не так, как обычные функции.',
);

console.log();
