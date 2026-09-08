// Из токенов — дерево. Что в нём есть, чего в нём нет и как на него смотреть.
//
// Запуск: node 02-lexing-parsing-ast/examples/parse-with-acorn.mjs

import * as acorn from 'acorn';
import { line, note, raw, section, show, table, truncate } from '../../tools/format.mjs';

const source = `const greet = (name) => {
  // приветствие
  return \`привет, \${name}\`;
};
greet("мир");`;

const ast = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'module' });

section('Дерево целиком');

/** Компактная печать дерева: отступ по глубине, тип узла и его ключевое поле. */
function printTree(node, depth = 0) {
  const detail =
    node.name ??
    (node.type === 'Literal' ? JSON.stringify(node.value) : undefined) ??
    node.operator ??
    node.kind ??
    '';
  raw(`  ${'  '.repeat(depth)}${node.type}${detail !== '' ? ` · ${detail}` : ''}`);

  for (const [key, value] of Object.entries(node)) {
    if (['type', 'start', 'end', 'loc', 'range'].includes(key)) continue;
    if (Array.isArray(value)) {
      for (const item of value) if (item && typeof item.type === 'string') printTree(item, depth + 1);
    } else if (value && typeof value.type === 'string') {
      printTree(value, depth + 1);
    }
  }
}

raw('  Исходник:');
source.split('\n').forEach((text, index) => raw(`    ${String(index + 1).padStart(2)} | ${text}`));
raw('');
printTree(ast);

note(
  'Каждый узел — объект с полем `type` и ссылками на дочерние узлы. Ничего кроме',
  'этого в ESTree нет: ни классов, ни методов, ни ссылок на родителя. Обход дерева',
  'пишется вручную за десять строк, и именно так работают линтеры и кодмоды.',
  '',
  'Комментария в дереве не видно — по умолчанию acorn их не собирает. Это не потеря',
  'информации, а разделение задач: комментарии живут отдельным списком, а на дерево',
  'их натягивают по позициям, если нужно.',
);

section('Позиции: единственная связь дерева с текстом');

const withLocations = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'module', locations: true });
const declaration = withLocations.body[0];
const arrow = declaration.declarations[0].init;

table(
  ['узел', 'смещения', 'строка:столбец', 'фрагмент исходника'],
  [
    ['Program', `${withLocations.start}–${withLocations.end}`, `${withLocations.loc.start.line}:${withLocations.loc.start.column}`, truncate(source, 24)],
    ['VariableDeclaration', `${declaration.start}–${declaration.end}`, `${declaration.loc.start.line}:${declaration.loc.start.column}`, truncate(source.slice(declaration.start, declaration.end), 24)],
    ['ArrowFunctionExpression', `${arrow.start}–${arrow.end}`, `${arrow.loc.start.line}:${arrow.loc.start.column}`, truncate(source.slice(arrow.start, arrow.end), 24)],
    ['Identifier (name)', `${arrow.params[0].start}–${arrow.params[0].end}`, `${arrow.params[0].loc.start.line}:${arrow.params[0].loc.start.column}`, source.slice(arrow.params[0].start, arrow.params[0].end)],
  ],
);

note(
  'Смещения есть всегда, `loc` со строками и столбцами — по флагу `locations`.',
  'Из них получается всё остальное: подчёркивание в сообщении линтера, source map',
  'после трансформации, точная замена фрагмента текста в кодмоде.',
  '',
  'Обратное преобразование тоже работает: `source.slice(node.start, node.end)`',
  'возвращает исходный текст узла — с пробелами, комментариями и форматированием,',
  'то есть ровно то, чего в дереве нет.',
);

section('Комментарии и токены — по запросу');

const comments = [];
const collectedTokens = [];
acorn.parse(source, {
  ecmaVersion: 'latest',
  sourceType: 'module',
  onComment: (isBlock, text, start, end) => comments.push({ isBlock, text: text.trim(), start, end }),
  onToken: (token) => collectedTokens.push(token),
});

line('собрано комментариев', comments.length);
line('собрано токенов', collectedTokens.length);
line('первый комментарий', `${show(comments[0].text)} на позиции ${comments[0].start}`);

note(
  'Один и тот же разбор может отдать и дерево, и поток токенов, и комментарии —',
  'это дешевле, чем сканировать текст дважды. ESLint пользуется всеми тремя: правила',
  'ходят по дереву, директивы вроде `eslint-disable` берутся из комментариев,',
  'а правила форматирования смотрят на токены.',
);

section('Что значит «абстрактное» в abstract syntax tree');

const equivalent = [
  ['1 + 2', '(1) + (2)'],
  ['x = 1', 'x=1  /* комментарий */'],
  ['if (a) b();', 'if (a) { b(); }'],
  ['const a = 1;', 'const a = 1'],
];

const shape = (code) => JSON.stringify(acorn.parse(code, { ecmaVersion: 'latest' }), (key, value) =>
  ['start', 'end'].includes(key) ? undefined : value,
);

table(
  ['вариант 1', 'вариант 2', 'деревья совпадают'],
  equivalent.map(([left, right]) => [left, right, shape(left) === shape(right) ? 'да' : 'нет']),
);

note(
  'Скобки, лишние пробелы, комментарии и необязательная точка с запятой в дерево не',
  'попадают: они влияли на разбор, но результат разбора от них не зависит. А вот',
  '`if (a) b()` и `if (a) { b() }` дают разные деревья — во втором случае появляется',
  'BlockStatement, и это уже разница в структуре, а не в оформлении.',
  '',
  'Отсюда практическое следствие: печать кода из дерева не восстанавливает исходник.',
  'Именно поэтому у форматтеров и кодмодов деревья свои — с сохранением оформления',
  '(Prettier строит собственный CST, recast достраивает ESTree позициями).',
);

section('Опции разбора, от которых зависит результат');

const options = [
  ['ecmaVersion: 2015', 'const x = a ?? b', { ecmaVersion: 2015 }],
  ['ecmaVersion: latest', 'const x = a ?? b', { ecmaVersion: 'latest' }],
  ['sourceType: script', 'import x from "m"', { ecmaVersion: 'latest', sourceType: 'script' }],
  ['sourceType: module', 'import x from "m"', { ecmaVersion: 'latest', sourceType: 'module' }],
  ['sourceType: script', 'var eval = 1', { ecmaVersion: 'latest', sourceType: 'script' }],
  ['sourceType: module', 'var eval = 1', { ecmaVersion: 'latest', sourceType: 'module' }],
  ['allowReturnOutsideFunction', 'return 1', { ecmaVersion: 'latest', allowReturnOutsideFunction: true }],
];

table(
  ['опции', 'код', 'результат'],
  options.map(([label, code, config]) => {
    try {
      const parsed = acorn.parse(code, config);
      return [label, code, `${parsed.body[0].type}`];
    } catch (error) {
      return [label, code, truncate(error.message.replace(/\s*\(\d+:\d+\)$/, ''), 40)];
    }
  }),
);

note(
  'Парсер — не константа: тот же текст при разных настройках либо дерево, либо ошибка.',
  'Отсюда типичная путаница в инструментах: ESLint жалуется на синтаксис, который',
  'браузер понимает, — почти всегда это несовпадение `ecmaVersion` или `sourceType`',
  'в конфиге, а не «неподдерживаемая фича».',
  '',
  'Последняя строка — про то, что парсеры умеют быть мягче спецификации: acorn по',
  'просьбе разберёт `return` вне функции, хотя это ранняя ошибка из раздела 01.',
  'Инструментам это нужно, чтобы разбирать фрагменты кода, а не только целые файлы.',
);

console.log();
