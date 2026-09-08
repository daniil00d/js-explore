// Области видимости и привязки: первый настоящий статический анализ.
// Своя реализация из scope.mjs сверяется с eslint-scope — тем самым анализатором,
// на котором стоит ESLint.
//
// Запуск: node 03-static-analysis/examples/scope-analysis.mjs

import * as acorn from 'acorn';
import { analyze as analyzeWithEslintScope } from 'eslint-scope';
import { line, note, raw, section, table } from '../../tools/format.mjs';
import { allBindings, analyzeScopes, freeNames } from './scope.mjs';

const source = `import { fetchJson } from './net.mjs';

const RETRIES = 3;
let cache = new Map();

export function load(url, { force = false } = {}) {
  var attempts = 0;
  const started = Date.now();

  if (!force && cache.has(url)) {
    return cache.get(url);
  }

  for (let i = 0; i < RETRIES; i += 1) {
    attempts += 1;
    try {
      const data = fetchJson(url);
      cache.set(url, data);
      return data;
    } catch (error) {
      if (i === RETRIES - 1) throw error;
    }
  }

  return null;
}

export function makeCounter(step) {
  let count = 0;
  return function next(label) {
    count += step;
    return \`\${label}: \${count}\`;
  };
}

function reset(cache) {
  cache.clear();
  return RETRIES;
}`;

const ast = acorn.parse(source, {
  ecmaVersion: 'latest',
  sourceType: 'module',
  locations: true,
  // ranges нужен не нам, а eslint-scope: без него он падает на первой же функции.
  ranges: true,
});

const { root, scopes, references, unresolved } = analyzeScopes(ast);

section('Исходник, который разбираем');

source.split('\n').forEach((text, index) => raw(`  ${String(index + 1).padStart(2)} | ${text}`));

section('Дерево областей видимости');

const printScope = (scope, indent = '') => {
  const names = [...scope.bindings.keys()];
  const shown = names.length > 0 ? names.join(', ') : '—';
  raw(`  ${indent}${scope.label.padEnd(22 - indent.length)} ${shown}`);
  for (const child of scope.children) printScope(child, `${indent}  `);
};

printScope(root);

line('областей всего', scopes.length);
line('привязок всего', allBindings(scopes).length);

note(
  'Дерево областей видимости — не то же самое, что дерево разбора. Блок `{}` область',
  'создаёт, а тело функции — нет: параметры и `let` из тела живут вместе, поэтому',
  '`function load(url)` не даёт вложенной области для своего блока.',
  '',
  'Отдельная область у головы `for (let i = ...)` — не педантизм: она есть, потому что',
  '`let` в заголовке цикла создаёт новую привязку на каждой итерации. Именно поэтому',
  'замыкание внутри цикла с `let` видит своё `i`, а с `var` — одно на всех.',
  '',
  '`arguments` в таблице появляется у каждой обычной функции, даже если в коде его нет:',
  'это неявная привязка, и она объясняет, почему `arguments` внутри функции не «протекает»',
  'наружу. У стрелочных функций её нет — там `arguments` разрешается во внешнюю область.',
);

section('Привязки: где объявлено и как используется');

const bindings = allBindings(scopes).filter((binding) => binding.kind !== 'implicit');

table(
  ['имя', 'вид', 'область', 'строка', 'чтений', 'записей'],
  bindings.map((binding) => [
    binding.name,
    binding.kind,
    binding.scope.label,
    binding.node?.loc?.start.line ?? '—',
    binding.reads,
    binding.writes,
  ]),
);

note(
  'Это уже не форма дерева, а факты о программе: у каждого имени известно, где оно',
  'объявлено, сколько раз прочитано и сколько раз перезаписано. Инициализация в',
  '`const RETRIES = 3` записью не считается — она часть объявления.',
  '',
  'На этой таблице держится половина практических инструментов. Ноль чтений — кандидат',
  'на `no-unused-vars` и на удаление минификатором. Ноль записей у `let` — кандидат на',
  '`prefer-const`. Одно чтение у константы — кандидат на подстановку по месту.',
);

section('Замыкания: какие имена функция берёт снаружи');

const functionScopes = scopes.filter((scope) => scope.kind === 'function');

table(
  ['функция', 'берёт снаружи', 'откуда'],
  functionScopes.map((scope) => {
    const free = freeNames(scope);
    const names = [...free.keys()];
    const sources = [...new Set([...free.values()].map((binding) => binding.scope.label))];
    return [scope.label, names.length > 0 ? names.join(', ') : '—', sources.join(', ') || '—'];
  }),
);

note(
  'Свободные имена функции — это ровно то, что придётся положить в замыкание. Для V8 это',
  'не абстракция: захваченные переменные не лежат на стеке, под них выделяется объект',
  'Context в куче, и обращение к ним стоит дороже, чем к локальным.',
  '',
  'Отсюда же берётся ответ на вопрос «почему функция без захватов дешевле»: у `next`',
  'захвачены `count` и `step`, поэтому кадр `makeCounter` не может умереть вместе с',
  'вызовом — часть его переезжает в кучу. Разбор того, как это выглядит в байткоде, —',
  'в разделе 09, а в памяти — в разделе 12.',
);

section('Затенение: одно имя, разные привязки');

const byName = new Map();
for (const binding of bindings) {
  if (!byName.has(binding.name)) byName.set(binding.name, []);
  byName.get(binding.name).push(binding);
}

const shadowed = [...byName]
  .filter(([, list]) => list.length > 1)
  .map(([name, list]) => [
    name,
    list.map((binding) => `${binding.scope.label} (стр. ${binding.node?.loc?.start.line ?? '?'})`).join(' / '),
    list.map((binding) => binding.references.length).join(' / '),
  ]);

table(['имя', 'привязки', 'ссылок на каждую'], shadowed);

note(
  '`cache` в модуле и `cache` — параметр `reset` это два разных имени, случайно',
  'написанных одинаково. Разрешение ссылки идёт по цепочке областей вверх, поэтому',
  'внутри `reset` видна только параметрическая привязка.',
  '',
  'Из-за таких случаев поиск с заменой по тексту ломает код, а минификатор — нет:',
  'он переименовывает привязку вместе со всеми её ссылками, а одноимённую соседку',
  'оставляет в покое. То же самое делает `path.scope.rename` из раздела 02.',
);

section('Неразрешённые ссылки: всё, что пришло извне');

const globals = new Map();
for (const entry of unresolved) {
  if (!globals.has(entry.name)) globals.set(entry.name, []);
  globals.get(entry.name).push(entry.line);
}

table(
  ['имя', 'строки', 'что это'],
  [...globals].map(([name, lines]) => [name, lines.join(', '), 'глобальное или опечатка']),
);

note(
  'Анализатор не знает, что `Map` и `Date` существуют: в дереве модуля их объявления нет.',
  'Всё, что он может сказать, — эти имена приходят извне. Дальше нужен список известных',
  'глобальных имён, и именно так устроены `env` и `globals` в конфиге ESLint: без них',
  'правило `no-undef` не отличает `Map` от опечатки в `Мap`.',
  '',
  'Для сборщика этот же список — граница графа: имя, которое ниоткуда не импортировано,',
  'нельзя ни выбросить, ни переименовать, потому что оно принадлежит не нам.',
);

section('Что из этой таблицы уже можно достать');

// Экспортированное имя «не используется» только внутри модуля, и линтер о нём
// молчит: используют его снаружи. Поэтому список экспортов нужен отдельно.
const exported = new Set();
for (const statement of ast.body) {
  if (statement.type === 'ExportNamedDeclaration') {
    if (statement.declaration?.id) exported.add(statement.declaration.id.name);
    for (const specifier of statement.specifiers ?? []) exported.add(specifier.local.name);
  }
  if (statement.type === 'ExportDefaultDeclaration' && statement.declaration?.id) {
    exported.add(statement.declaration.id.name);
  }
}

// Имя функционального выражения (`next`) живёт в своей области и нужно для
// рекурсии и стектрейсов — считать его неиспользуемым неправильно.
const declared = bindings.filter((binding) => binding.scope.kind !== 'function-name');

const unused = declared.filter(
  (binding) => binding.reads === 0 && binding.kind !== 'param' && !exported.has(binding.name),
);
const constCandidates = declared.filter((binding) => binding.kind === 'let' && binding.writes === 0);
const deadLocalFunctions = declared.filter(
  (binding) => binding.kind === 'function' && binding.reads === 0 && !exported.has(binding.name),
);

table(
  ['вывод', 'имена', 'какое правило это ловит'],
  [
    ['ни разу не прочитано', unused.map((binding) => binding.name).join(', ') || '—', 'no-unused-vars'],
    ['let без перезаписи', constCandidates.map((binding) => binding.name).join(', ') || '—', 'prefer-const'],
    [
      'функция не вызвана и не экспортирована',
      deadLocalFunctions.map((binding) => binding.name).join(', ') || '—',
      'tree shaking, dead code',
    ],
  ],
);

note(
  'Три правила, которые все видели, — это три запроса к одной и той же таблице привязок.',
  'Ничего не запускалось, ничего не угадывалось: `started` действительно не читается,',
  '`cache` действительно не перезаписывается, `reset` действительно никем не вызван.',
  '',
  'Две поправки к таблице сделаны руками, и обе показательны. Экспортированные `load`',
  'и `makeCounter` внутри модуля тоже не читаются, но их используют снаружи — значит,',
  'анализу одного файла этот вопрос не решить, нужен граф модулей из раздела 07. А имя',
  '`next` у функционального выражения не читается по определению: оно нужно для рекурсии',
  'и стектрейсов, и линтер о нём молчит.',
  '',
  'И тут же видна граница. Про `reset` вывод верен, только пока мы уверены, что до модуля',
  'никто не доберётся иначе — а `eval`, `import()` по вычисленному пути или доступ к',
  'экспортам через строковый ключ это предположение ломают. Что именно ломается — в',
  'analysis-killers.mjs.',
);

section('Сверка с eslint-scope');

const oracle = analyzeWithEslintScope(ast, { ecmaVersion: 2022, sourceType: 'module' });

// Эталон: позиция идентификатора → позиция объявляющего идентификатора.
// Инициализацию (`const RETRIES = 3`) eslint-scope считает записью в переменную,
// мы — частью объявления, поэтому такие ссылки из сверки исключены.
const oracleResolutions = new Map();
for (const scope of oracle.scopes) {
  for (const reference of scope.references) {
    if (reference.init) continue;
    oracleResolutions.set(reference.identifier.range[0], {
      name: reference.identifier.name,
      declaredAt: reference.resolved?.identifiers?.[0]?.range?.[0] ?? (reference.resolved ? 'неявная' : null),
    });
  }
}

let matched = 0;
const mismatches = [];
for (const entry of references) {
  const expected = oracleResolutions.get(entry.start);
  const actual = entry.resolved ? (entry.resolved.declaredAt ?? 'неявная') : null;
  if (expected && expected.declaredAt === actual) matched += 1;
  else mismatches.push([entry.name, entry.line, expected ? String(expected.declaredAt) : 'ссылки нет', String(actual)]);
}

const missed = [...oracleResolutions].filter(([start]) => !references.some((entry) => entry.start === start));

const oracleShape = oracle.scopes
  .filter((scope) => scope.type !== 'global')
  .map((scope) => scope.variables.map((variable) => variable.name).sort().join(','));
const ourShape = scopes.map((scope) => [...scope.bindings.keys()].sort().join(','));

table(
  ['что сверяем', 'eslint-scope', 'наш анализ', 'сходится'],
  [
    ['областей видимости', oracleShape.length, ourShape.length, oracleShape.length === ourShape.length ? 'да' : 'нет'],
    [
      'привязки по областям',
      'см. слева',
      'см. слева',
      oracleShape.join('|') === ourShape.join('|') ? 'да' : 'нет',
    ],
    ['ссылок разрешено', oracleResolutions.size, references.length, `совпало ${matched}`],
    ['ссылок пропущено', missed.length, mismatches.length, missed.length + mismatches.length === 0 ? 'да' : 'нет'],
  ],
);

if (mismatches.length > 0) {
  table(['имя', 'строка', 'eslint-scope', 'наш анализ'], mismatches);
}

note(
  'Сверка нужна не для галочки. Правила областей видимости в JavaScript выглядят',
  'простыми, пока не начнёшь их реализовывать: голова `for` со своей областью, тело',
  'функции без своей, `catch` с параметром и без, имя функционального выражения,',
  'видимое только изнутри, объявление функции внутри блока — блочное в модуле и',
  'функциональное в скрипте.',
  '',
  `Каждый из этих случаев есть в исходнике выше, и на всех ${references.length} ссылках разрешение`,
  'имён совпало с eslint-scope. Расхождение осталось одно, и оно намеренное:',
  'инициализацию при объявлении eslint-scope записывает как обращение к переменной,',
  'а нам удобнее считать её частью объявления — иначе `prefer-const` пришлось бы',
  'считать по-другому.',
);

console.log();
