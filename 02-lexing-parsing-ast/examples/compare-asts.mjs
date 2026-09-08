// Один и тот же код — три разных дерева: ESTree (acorn), Babel и TypeScript.
//
// Запуск: node 02-lexing-parsing-ast/examples/compare-asts.mjs

import * as acorn from 'acorn';
import { parse as babelParse } from '@babel/parser';
import ts from 'typescript';
import { line, note, raw, section, table, truncate } from '../../tools/format.mjs';

// Обратное отображение SyntaxKind отдаёт последний псевдоним, а не имя узла:
// у NumericLiteral, FirstLiteralToken и ещё пары имён одно и то же значение 9.
const KIND_NAMES = new Map();
for (const [name, value] of Object.entries(ts.SyntaxKind)) {
  if (typeof value !== 'number') continue;
  if (/^(First|Last|Count)/.test(name)) continue;
  if (!KIND_NAMES.has(value)) KIND_NAMES.set(value, name);
}
const kindName = (kind) => KIND_NAMES.get(kind) ?? ts.SyntaxKind[kind];

const acornTree = (code) => acorn.parse(code, { ecmaVersion: 'latest', sourceType: 'module' });
const babelTree = (code) => babelParse(code, { sourceType: 'module' });
const tsTree = (code) => ts.createSourceFile('example.ts', code, ts.ScriptTarget.Latest, true);

function estreeTypes(node, depth = 0, out = []) {
  out.push({ depth, name: node.type });
  for (const [key, value] of Object.entries(node)) {
    if (['type', 'start', 'end', 'loc', 'range', 'extra', 'leadingComments', 'trailingComments'].includes(key)) continue;
    if (Array.isArray(value)) {
      for (const item of value) if (item && typeof item.type === 'string') estreeTypes(item, depth + 1, out);
    } else if (value && typeof value.type === 'string') {
      estreeTypes(value, depth + 1, out);
    }
  }
  return out;
}

function tsTypes(node, depth = 0, out = []) {
  out.push({ depth, name: kindName(node.kind) });
  ts.forEachChild(node, (child) => tsTypes(child, depth + 1, out));
  return out;
}

section('Одно выражение — три дерева');

const snippet = 'const point = { x: 1 };';
raw(`  Код: ${snippet}`);
raw('');

const columns = [
  ['acorn (ESTree)', estreeTypes(acornTree(snippet))],
  ['@babel/parser', estreeTypes(babelTree(snippet).program).map((entry, index) => (index === 0 ? { depth: 0, name: 'File → Program' } : entry))],
  ['typescript', tsTypes(tsTree(snippet)).filter((entry) => entry.name !== 'EndOfFileToken')],
];

const height = Math.max(...columns.map(([, entries]) => entries.length));
table(
  columns.map(([title]) => title),
  Array.from({ length: height }, (_, row) =>
    columns.map(([, entries]) => {
      const entry = entries[row];
      return entry ? `${'  '.repeat(entry.depth)}${entry.name}` : '';
    }),
  ),
);

note(
  'Структура почти одинаковая, имена — нет. Babel в целом следует ESTree, но переименовывает',
  'часть узлов и оборачивает программу в `File`. TypeScript живёт в своей системе понятий:',
  'узлы называются по-декларативному (`VariableStatement`, `PropertyAssignment`), а вместо',
  'строкового `type` у них числовой `kind`.',
);

section('Таблица соответствий для частых конструкций');

// Для каждой конструкции указано, как достать интересующий узел из каждого дерева:
// автоматически их не сопоставить, формы слишком разные.
const constructs = [
  {
    label: 'строковый литерал',
    code: 'const s = "текст";',
    estree: (t) => t.body[0].declarations[0].init,
    ts: (t) => t.statements[0].declarationList.declarations[0].initializer,
  },
  {
    label: 'числовой литерал',
    code: 'const n = 42;',
    estree: (t) => t.body[0].declarations[0].init,
    ts: (t) => t.statements[0].declarationList.declarations[0].initializer,
  },
  {
    label: 'свойство объекта',
    code: 'const o = { a: 1 };',
    estree: (t) => t.body[0].declarations[0].init.properties[0],
    ts: (t) => t.statements[0].declarationList.declarations[0].initializer.properties[0],
  },
  {
    label: 'метод класса',
    code: 'class C { m() {} }',
    estree: (t) => t.body[0].body.body[0],
    ts: (t) => t.statements[0].members[0],
  },
  {
    label: 'поле класса',
    code: 'class C { x = 1; }',
    estree: (t) => t.body[0].body.body[0],
    ts: (t) => t.statements[0].members[0],
  },
  {
    label: 'присваивание',
    code: 'x = 1;',
    estree: (t) => t.body[0].expression,
    ts: (t) => t.statements[0].expression,
  },
  {
    label: 'унарный минус',
    code: 'const n = -1;',
    estree: (t) => t.body[0].declarations[0].init,
    ts: (t) => t.statements[0].declarationList.declarations[0].initializer,
  },
  {
    label: 'опциональная цепочка',
    code: 'a?.b;',
    estree: (t) => t.body[0].expression,
    ts: (t) => t.statements[0].expression,
  },
  {
    label: 'шаблонная строка',
    code: 'const t = `итого ${x}`;',
    estree: (t) => t.body[0].declarations[0].init,
    ts: (t) => t.statements[0].declarationList.declarations[0].initializer,
  },
  {
    label: 'spread в вызове',
    code: 'f(...args);',
    estree: (t) => t.body[0].expression.arguments[0],
    ts: (t) => t.statements[0].expression.arguments[0],
  },
];

table(
  ['конструкция', 'acorn (ESTree)', 'babel', 'typescript'],
  constructs.map(({ label, code, estree, ts: pickTs }) => [
    label,
    estree(acornTree(code)).type,
    estree(babelTree(code).program).type,
    kindName(pickTs(tsTree(code)).kind),
  ]),
);

note(
  'Три различия ломают код инструментов чаще всего. Первое: ESTree держит все литералы',
  'в одном узле `Literal` с полем `value`, а Babel и TypeScript разделяют их по типам',
  '(`StringLiteral`, `NumericLiteral`). Второе: свойство объекта — это `Property`,',
  '`ObjectProperty` и `PropertyAssignment` соответственно. Третье: присваивание',
  'в TypeScript — это `BinaryExpression` с оператором `=`, а не отдельный узел.',
  '',
  'Опциональная цепочка показывает третий подход к одной задаче: ESTree оборачивает',
  'всю цепочку в `ChainExpression` (чтобы было видно, где кончается короткое замыкание),',
  'Babel заводит отдельные `OptionalMemberExpression` и `OptionalCallExpression`,',
  'а TypeScript кладёт `?.` внутрь обычного `PropertyAccessExpression` отдельным токеном.',
  '',
  `Отдельная ловушка: строковый литерал берётся из \`const s = "текст"\`, а не из`,
  '`"текст";` отдельной инструкцией. Строка в начале программы или функции — это',
  `директива вроде "use strict", и в дереве она будет \`Directive\` с \`DirectiveLiteral\`,`,
  'а не выражением.',
);

section('Обёртки и служебные поля');

const identifierOf = {
  acorn: acornTree('total;').body[0].expression,
  babel: babelTree('total;').program.body[0].expression,
  typescript: tsTree('total;').statements[0].expression,
};

table(
  ['парсер', 'корень дерева', 'поля узла Identifier'],
  [
    ['acorn', 'Program', Object.keys(identifierOf.acorn).join(', ')],
    ['babel', 'File → Program', truncate(Object.keys(identifierOf.babel).join(', '), 46)],
    ['typescript', 'SourceFile', truncate(Object.keys(identifierOf.typescript).join(', '), 46)],
  ],
);

line('имя в acorn', identifierOf.acorn.name);
line('имя в babel', identifierOf.babel.name);
line('имя в typescript', identifierOf.typescript.escapedText);

note(
  'Позиции тоже называются по-разному: у acorn это `start`/`end`, у Babel рядом с ними',
  'сразу есть `loc` (а `range` — по опции `ranges`), у TypeScript — `pos`/`end`, причём',
  '`pos` включает предшествующие пробелы и комментарии, а не начало узла. Отсюда',
  'классическая ошибка при миграции кодмода: срез `source.slice(node.pos, node.end)`',
  'в TypeScript захватывает',
  'лишнее, для текста узла нужен `node.getStart()`.',
  '',
  'Имя идентификатора у TypeScript лежит в `escapedText`, а не в `name`. Приставка',
  '«escaped» здесь про внутреннее экранирование служебных имён, а не про юникод-escape',
  'в исходнике.',
);

section('Кто на чём стоит');

table(
  ['инструмент', 'парсер', 'форма дерева'],
  [
    ['ESLint', 'espree (форк acorn)', 'ESTree'],
    ['typescript-eslint', 'TypeScript', 'ESTree после конвертации'],
    ['Babel, jscodeshift', '@babel/parser', 'Babel AST (ESTree с отличиями)'],
    ['Prettier', 'свой набор парсеров', 'собственный CST для печати'],
    ['Rollup 4', 'SWC на Rust (до этого acorn)', 'ESTree для плагинов'],
    ['esbuild, SWC, oxc', 'свои на Go и Rust', 'свои внутренние деревья'],
    ['V8', 'свой парсер и preparser', 'внутреннее дерево, наружу не отдаётся'],
  ],
);

note(
  'Практический вывод: «AST JavaScript» — это не один формат. Правило линтера, написанное',
  'под ESTree, на Babel AST не заработает без правок, а плагин Babel не подойдёт для',
  'TypeScript-дерева. Совместимость с ESTree — отдельная фича, за которую платят',
  'конвертацией: именно это делает typescript-eslint, и именно поэтому он не бесплатный',
  'по времени.',
  '',
  'Проверять форму дерева удобнее всего на astexplorer.net: один и тот же код,',
  'переключатель парсера, дерево рядом. Ровно то же самое делает этот пример,',
  'только в консоли и без интернета.',
);

console.log();
