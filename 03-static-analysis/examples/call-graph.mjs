// Граф вызовов и его неполнота. Статический граф строится по дереву, настоящий
// снимается с выполнения того же модуля, и разница между ними — главное, что
// стоит унести из этого примера.
//
// Запуск: node 03-static-analysis/examples/call-graph.mjs

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as acorn from 'acorn';
import * as walk from 'acorn-walk';
import { parse as babelParse } from '@babel/parser';
import _traverse from '@babel/traverse';
import _generate from '@babel/generator';
import { line, note, raw, section, table } from '../../tools/format.mjs';
import { analyzeScopes } from './scope.mjs';

const traverse = _traverse.default ?? _traverse;
const generate = _generate.default ?? _generate;

const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(here, 'fixtures', 'pipeline.mjs');
const source = readFileSync(fixturePath, 'utf8');
const ast = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'module', locations: true });
const { references } = analyzeScopes(ast);

const referenceAt = new Map(references.map((reference) => [reference.start, reference]));

/** Имя функции для графа: у объявлений своё, у стрелок — по месту в коде. */
const functionName = (node) => node?.id?.name ?? (node ? `стрелка (стр. ${node.loc.start.line})` : 'верхний уровень');

section('Модуль, для которого строим граф');

source
  .split('\n')
  .slice(6)
  .forEach((text, index) => raw(`  ${String(index + 7).padStart(2)} | ${text}`));

section('Статический граф вызовов');

const FUNCTION_TYPES = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);

const callSites = [];
walk.ancestor(ast, {
  CallExpression(node, _state, ancestors) {
    const enclosing = [...ancestors].reverse().find((ancestor) => FUNCTION_TYPES.has(ancestor.type));
    const caller = functionName(enclosing);
    const callee = node.callee;

    if (callee.type === 'Identifier') {
      const reference = referenceAt.get(callee.start);
      const binding = reference?.resolved;
      if (!binding) {
        callSites.push({ caller, target: callee.name, kind: 'внешнее имя', line: node.loc.start.line });
        return;
      }
      if (binding.kind === 'function') {
        callSites.push({ caller, target: binding.name, kind: 'прямой вызов', line: node.loc.start.line });
        return;
      }
      if (binding.kind === 'param') {
        callSites.push({ caller, target: `${binding.name}(?)`, kind: 'через параметр', line: node.loc.start.line });
        return;
      }
      callSites.push({ caller, target: `${binding.name}(?)`, kind: 'через переменную', line: node.loc.start.line });
      return;
    }

    if (callee.type === 'MemberExpression') {
      const text = source.slice(callee.start, callee.end);
      callSites.push({
        caller,
        target: text,
        kind: callee.computed ? 'через вычисленный ключ' : 'метод объекта',
        line: node.loc.start.line,
      });
      return;
    }

    callSites.push({ caller, target: source.slice(callee.start, callee.end), kind: 'иное', line: node.loc.start.line });
  },
});

table(
  ['вызывающая', 'строка', 'что вызывается', 'как это видно анализу'],
  callSites.map((site) => [site.caller, site.line, site.target, site.kind]),
);

const resolved = callSites.filter((site) => site.kind === 'прямой вызов');
line('всего мест вызова', callSites.length);
line('разрешено до имени функции', resolved.length);

note(
  'Разрешились только вызовы по имени функции, объявленной в этом же модуле. Всё',
  'остальное — не лень анализатора, а честный ответ «не знаю»:',
  '',
  '`middleware(normalized)` — вызов через параметр. Что придёт в этот параметр,',
  'решает вызывающая сторона, и таких сторон может быть сколько угодно.',
  '',
  '`handler(checked)` — вызов через переменную, в которую положили результат',
  '`handlers[checked.kind]`. Чтобы узнать, что это за функция, нужно знать значение',
  '`checked.kind` — то есть выполнить программу.',
  '',
  '`requests.map(...)` — метод чужого объекта. Что он делает с переданной функцией,',
  'из этого модуля не видно вообще: вызовет один раз, сто раз или ни разу.',
);

section('Ссылки на функции, которые вызовами не являются');

const valueReferences = [];
walk.ancestor(ast, {
  Identifier(node, _state, ancestors) {
    const parent = ancestors[ancestors.length - 2];
    if (!parent || (parent.type === 'CallExpression' && parent.callee === node)) return;
    const binding = referenceAt.get(node.start)?.resolved;
    if (!binding || binding.kind !== 'function') return;
    valueReferences.push([binding.name, node.loc.start.line, source.slice(parent.start, parent.end).split('\n')[0].trim()]);
  },
});

table(['функция', 'строка', 'где упомянута'], valueReferences);

note(
  'Три обработчика нигде не вызываются по имени — они просто лежат значениями в',
  'таблице `handlers`. Для графа вызовов это ничего не значит, а для сборщика',
  'значит всё: функция, на которую есть ссылка, из бандла не выбрасывается, даже',
  'если вызова не видно.',
  '',
  'Разница между «упомянута» и «вызвана» — причина, по которой tree shaking',
  'работает по ссылкам, а не по вызовам. Иначе первым же деревом, которое он',
  'вытряхнет, окажется рабочий код.',
);

const declaredFunctions = new Set();
walk.full(ast, (node) => {
  if (node.type === 'FunctionDeclaration' && node.id) declaredFunctions.add(node.id.name);
});

const staticEdges = new Map();
for (const site of resolved) {
  if (!staticEdges.has(site.caller)) staticEdges.set(site.caller, new Set());
  staticEdges.get(site.caller).add(site.target);
}

const exported = new Set();
for (const statement of ast.body) {
  if (statement.type === 'ExportNamedDeclaration' && statement.declaration?.id) {
    exported.add(statement.declaration.id.name);
  }
}

const reachableStatically = new Set();
const queue = [...exported];
while (queue.length > 0) {
  const name = queue.shift();
  if (reachableStatically.has(name)) continue;
  reachableStatically.add(name);
  for (const callee of staticEdges.get(name) ?? []) queue.push(callee);
}

section('Настоящий граф вызовов: снимаем с выполнения');

/** Инструментируем каждую функцию входом и выходом, сохраняя семантику. */
function instrument(code) {
  const tree = babelParse(code, { sourceType: 'module' });

  traverse(tree, {
    Function(path) {
      if (path.node.__instrumented) return;
      path.node.__instrumented = true;

      const name = path.node.id?.name ?? `стрелка (стр. ${path.node.loc.start.line})`;

      // Стрелка с выражением вместо тела: разворачиваем в блок с return, иначе
      // некуда вставить вход и выход.
      if (path.node.body.type !== 'BlockStatement') {
        path.node.body = {
          type: 'BlockStatement',
          directives: [],
          body: [{ type: 'ReturnStatement', argument: path.node.body }],
        };
      }

      // try/finally, а не просто две вставки: иначе выход не отметится при
      // раннем return или исключении, и стек вызовов разъедется.
      path.node.body = {
        type: 'BlockStatement',
        directives: [],
        body: [
          {
            type: 'ExpressionStatement',
            expression: {
              type: 'CallExpression',
              callee: { type: 'Identifier', name: 'globalThis.__enter' },
              arguments: [{ type: 'StringLiteral', value: name }],
            },
          },
          {
            type: 'TryStatement',
            block: path.node.body,
            handler: null,
            finalizer: {
              type: 'BlockStatement',
              directives: [],
              body: [
                {
                  type: 'ExpressionStatement',
                  expression: {
                    type: 'CallExpression',
                    callee: { type: 'Identifier', name: 'globalThis.__exit' },
                    arguments: [],
                  },
                },
              ],
            },
          },
        ],
      };
    },
  });

  return generate(tree).code;
}

const observedEdges = new Map();
const stack = [];
globalThis.__enter = (name) => {
  const caller = stack.at(-1) ?? 'драйвер';
  if (!observedEdges.has(caller)) observedEdges.set(caller, new Set());
  observedEdges.get(caller).add(name);
  stack.push(name);
};
globalThis.__exit = () => stack.pop();

const instrumented = instrument(source);
const instrumentedModule = await import(
  `data:text/javascript;base64,${Buffer.from(instrumented, 'utf8').toString('base64')}`
);
const { run } = await import(pathToFileURL(join(here, 'fixtures', 'pipeline-driver.mjs')).href);
const traced = run(instrumentedModule);

const original = await import(pathToFileURL(fixturePath).href);
const untraced = run(original);

line(
  'результат после инструментации',
  JSON.stringify(traced) === JSON.stringify(untraced) ? 'тот же, что без неё' : 'ИЗМЕНИЛСЯ',
);
line('рёбер записано', [...observedEdges.values()].reduce((sum, set) => sum + set.size, 0));

const allNames = [
  ...new Set([...declaredFunctions, ...exported, ...staticEdges.keys(), ...observedEdges.keys()]),
].filter((name) => name !== 'драйвер').sort();

table(
  ['функция', 'вызывает статически', 'вызывала при запуске'],
  allNames.map((name) => [
    name,
    [...(staticEdges.get(name) ?? [])].sort().join(', ') || '—',
    [...(observedEdges.get(name) ?? [])].sort().join(', ') || '—',
  ]),
);

const observedCalled = new Set([...observedEdges.values()].flatMap((set) => [...set]));
const missed = [...observedCalled].filter((name) => !reachableStatically.has(name) && declaredFunctions.has(name));

table(
  ['вопрос', 'ответ'],
  [
    ['функций объявлено', String(declaredFunctions.size)],
    ['достижимо от экспортов по статическому графу', [...reachableStatically].filter((name) => declaredFunctions.has(name)).sort().join(', ')],
    ['выполнялось при запуске', [...observedCalled].filter((name) => declaredFunctions.has(name)).sort().join(', ')],
    ['статический граф пропустил', missed.sort().join(', ') || '—'],
  ],
);

const reachableCount = [...reachableStatically].filter((name) => declaredFunctions.has(name)).length;
const executedCount = [...observedCalled].filter((name) => declaredFunctions.has(name)).length;

note(
  'Вот и цена неполноты, в конкретных именах. Функций, достижимых от экспортов по',
  `статическому графу, — ${reachableCount}; функций, которые реально выполнились, — ${executedCount}.`,
  'В пропущенных — три обработчика, до которых управление доходит через',
  '`handlers[checked.kind]`, и всё, что они вызывают дальше: `store`, `drop`, `audit`.',
  '',
  'Инструмент, который на таком графе решит удалить «недостижимый» код, сломает',
  'программу. Поэтому серьёзные оптимизаторы либо требуют доказательства (Closure',
  'Compiler с аннотациями типов), либо считают достижимым всё, на что есть ссылка',
  '(сборщики и tree shaking), либо не строят граф вызовов вовсе.',
  '',
  'Последний вариант — про V8. Движку не нужно знать граф заранее: он смотрит, кого',
  'вызывали на этом месте в прошлый раз, и подставляет догадку с проверкой. Это',
  'инлайн-кеши из раздела 10 и спекулятивные оптимизации из раздела 11 — ровно тот',
  'подход, который статическому анализу недоступен, потому что он не запускает код.',
);

section('Почему в JavaScript граф вызовов принципиально неполон');

table(
  ['конструкция', 'почему вызов не разрешается'],
  [
    ['fn(x), где fn — параметр', 'значение приходит от вызывающего, вариантов сколько угодно'],
    ['table[key](x)', 'нужно знать значение ключа, то есть выполнить код'],
    ['obj.method(x)', 'какой метод — зависит от прототипа и от того, что записали в obj'],
    ['array.map(callback)', 'вызов происходит внутри чужого кода'],
    ['addEventListener("click", handler)', 'вызовет среда, а не программа'],
    ['await import(path)', 'модуль выбирается в рантайме'],
    ['new Proxy(target, { apply })', 'вызов можно перехватить и подменить'],
    ['eval("f()")', 'код появляется во время выполнения'],
  ],
);

note(
  'Каждая строка этой таблицы — законный, повседневный JavaScript, и почти каждая',
  'встречается в любом фреймворке. Отсюда практический вывод: точный граф вызовов',
  'для JavaScript не строится не потому, что инструменты плохие, а потому, что в',
  'языке вызов — это операция над значением, а значения статически неизвестны.',
  '',
  'Что с этим делать — вопрос выбора приближения. Разбор вариантов и цены каждого —',
  'в limits-of-analysis.md.',
);

console.log();
