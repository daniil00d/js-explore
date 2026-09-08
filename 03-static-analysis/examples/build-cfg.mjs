// Граф потока управления и недостижимый код. Вывод анализа сверяется с тем,
// что о выполнении этого же файла думает сам V8: покрытие собирается через
// NODE_V8_COVERAGE, и «никогда не выполнялось» приходит не от нас.
//
// Запуск: node 03-static-analysis/examples/build-cfg.mjs

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as acorn from 'acorn';
import { line, note, raw, section, table } from '../../tools/format.mjs';
import { buildCfg, reachableBlocks, renderCfg } from './cfg.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(here, 'fixtures', 'reachability.mjs');
const source = readFileSync(fixturePath, 'utf8');
const ast = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'module', locations: true });

/** Функции верхнего уровня, включая экспортированные. */
const functions = ast.body.flatMap((statement) => {
  if (statement.type === 'FunctionDeclaration') return [statement];
  if (statement.type === 'ExportNamedDeclaration' && statement.declaration?.type === 'FunctionDeclaration') {
    return [statement.declaration];
  }
  return [];
});

const graphs = functions.map((node) => {
  const cfg = buildCfg(node, source);
  const reachable = reachableBlocks(cfg);
  return { node, cfg, reachable };
});

const byName = new Map(graphs.map((graph) => [graph.cfg.name, graph]));

section('Из дерева в граф: одна функция целиком');

const retry = byName.get('retry');
source
  .slice(retry.node.start, retry.node.end)
  .split('\n')
  .forEach((text, index) => raw(`  ${String(retry.node.loc.start.line + index).padStart(3)} | ${text}`));

raw('');
renderCfg(retry.cfg, { reachable: retry.reachable }).forEach((text) => raw(`  ${text}`));

note(
  'Слева от блока стоит «!», если до него нет пути от входа. Здесь это B7 —',
  'инструкция `return null` после цикла. Причина видна по рёбрам: у блока',
  '«условие while» есть выход «да» в тело и нет выхода «нет», потому что условие',
  'цикла — литерал `true`. Выйти из такого цикла можно только через `return`',
  'или `throw`, а они ведут прямо в выход функции.',
  '',
  'Обратите внимание, что в графе не осталось ничего от вложенности исходника:',
  '`while` и `if` превратились в блоки и рёбра. Именно поэтому вопрос «может ли',
  'управление дойти до этой строки» на графе решается обходом, а на дереве не',
  'решается вообще.',
);

section('switch в графе: провал между case');

const route = byName.get('route');
renderCfg(route.cfg, { reachable: route.reachable }).forEach((text) => raw(`  ${text}`));

note(
  'У блока `switch` столько исходящих рёбер, сколько case, плюс ребро «ничего не',
  'совпало», если нет default. Здесь default есть, поэтому такого ребра нет.',
  '',
  'Ребро «проваливается» — это забытый `break`: из блока `case \'put\'` управление',
  'уходит в следующий case, а не за switch. В графе такое ребро видно сразу, и',
  'ровно по нему работает правило `no-fallthrough`. А `break` после `return` в',
  'первом case недостижим — предшественников у его блока нет.',
);

section('Сводка по всем функциям');

table(
  ['функция', 'блоков', 'рёбер', 'недостижимых блоков', 'инструкций в них'],
  graphs.map(({ cfg, reachable }) => {
    const dead = cfg.blocks.filter((block) => !reachable.has(block));
    return [
      cfg.name,
      cfg.blocks.length,
      cfg.blocks.reduce((sum, block) => sum + block.successors.length, 0),
      dead.length,
      dead.reduce((sum, block) => sum + block.statements.length, 0),
    ];
  }),
);

section('Недостижимые инструкции');

const deadStatements = [];
for (const { cfg, reachable } of graphs) {
  for (const block of cfg.blocks) {
    if (reachable.has(block)) continue;
    for (const statement of block.statements) {
      deadStatements.push({ function: cfg.name, ...statement });
    }
  }
}

// Объявления в недостижимом блоке — особый случай: сама инструкция не
// выполняется, но привязка создаётся при входе в область видимости.
const hoisted = deadStatements.filter((statement) =>
  ['FunctionDeclaration', 'ClassDeclaration', 'VariableDeclaration'].includes(statement.node.type),
);
const plainDead = deadStatements.filter((statement) => !hoisted.includes(statement));

table(
  ['функция', 'строка', 'инструкция', 'что это'],
  deadStatements.map((statement) => [
    statement.function,
    statement.line,
    statement.label,
    hoisted.includes(statement) ? 'объявление: всплывает' : 'мёртвый код',
  ]),
);

note(
  'Первые три строки — то, что можно выбросить из программы, не изменив её',
  'поведения: `no-unreachable` в ESLint покажет то же самое, а минификатор просто',
  'удалит. Четвёртая строка — ловушка.',
  '',
  '`function helper()` внутри `withHoisting` стоит после `return`, и как инструкция',
  'она недостижима. Но объявление функции всплывает: привязка `helper` создаётся при',
  'входе в функцию, а не в той точке, где написана. Поэтому вызов `helper()` выше',
  'работает, и удалить это «мёртвое» объявление нельзя.',
  '',
  'Отсюда правило, которое стоит запомнить: недостижимость инструкции и',
  'бесполезность объявления — разные утверждения. То же касается `var`: сам',
  '`var x = 1` после `return` не выполнится, а привязка `x` в функции появится.',
);

section('Сверка с покрытием V8');

/** Покрытие того же файла, собранное движком на драйвере из fixtures/. */
function collectCoverage() {
  const directory = mkdtempSync(join(tmpdir(), 'js-explore-coverage-'));
  try {
    execFileSync(process.execPath, [join(here, 'fixtures', 'reachability-driver.mjs')], {
      env: { ...process.env, NODE_V8_COVERAGE: directory },
      stdio: 'ignore',
    });
    const url = pathToFileURL(fixturePath).href;
    for (const file of readdirSync(directory).filter((name) => name.startsWith('coverage-'))) {
      const data = JSON.parse(readFileSync(join(directory, file), 'utf8'));
      const script = data.result.find((entry) => entry.url === url);
      if (script) return script;
    }
    return null;
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

const coverage = collectCoverage();

/**
 * Сколько раз выполнялась точка внутри функции. Диапазоны V8 вложены друг в
 * друга, поэтому берём самый узкий: он и описывает конкретный блок.
 * Диапазоны вложенных функций сюда не попадают — у них своя запись в покрытии,
 * и смешивать их нельзя, иначе объявление функции сойдёт за выполненное.
 */
function countAt(entry, offset) {
  const containing = entry.ranges
    .filter((range) => range.startOffset <= offset && offset < range.endOffset)
    .sort((left, right) => left.endOffset - left.startOffset - (right.endOffset - right.startOffset));
  return containing.length > 0 ? containing[0].count : null;
}

const coverageByFunction = new Map();
if (coverage) {
  for (const { node, cfg } of graphs) {
    const entry = coverage.functions.find((item) => item.ranges[0]?.startOffset === node.start);
    if (entry) coverageByFunction.set(cfg.name, entry);
  }
}

line('покрытие собрано', coverage ? 'да' : 'нет');
line('функций сопоставлено', `${coverageByFunction.size} из ${graphs.length}`);

const verdicts = [];
for (const { cfg, reachable } of graphs) {
  const entry = coverageByFunction.get(cfg.name);
  if (!entry) continue;
  for (const block of cfg.blocks) {
    for (const statement of block.statements) {
      const count = countAt(entry, statement.start);
      verdicts.push({
        function: cfg.name,
        line: statement.line,
        label: statement.label,
        node: statement.node,
        reachable: reachable.has(block),
        count,
      });
    }
  }
}

const deadAndUnexecuted = verdicts.filter((verdict) => !verdict.reachable && verdict.count === 0);
const deadButExecuted = verdicts.filter((verdict) => !verdict.reachable && verdict.count > 0);
const liveButUnexecuted = verdicts.filter((verdict) => verdict.reachable && verdict.count === 0);

table(
  ['утверждение', 'инструкций', 'сходится'],
  [
    ['недостижимо и ни разу не выполнялось', deadAndUnexecuted.length, 'ожидаемо'],
    ['недостижимо, но выполнялось', deadButExecuted.length, deadButExecuted.length === 0 ? 'да' : 'разбор ниже'],
    ['достижимо, но ни разу не выполнялось', liveButUnexecuted.length, 'так и должно быть'],
  ],
);

raw('');
table(
  ['функция', 'строка', 'инструкция', 'выполнений'],
  liveButUnexecuted.map((verdict) => [verdict.function, verdict.line, verdict.label, verdict.count]),
);

const helperEntry = coverage?.functions.find((item) => item.functionName === 'helper');

note(
  'Первая строка сводки — проверка на корректность анализа: ни одна из инструкций,',
  'которые мы назвали недостижимыми, при запуске не выполнилась. Обратной ошибки тоже',
  'нет, и это не случайность: недостижимость по графу — утверждение обо всех возможных',
  'запусках, поэтому один запуск может его опровергнуть, но не может подтвердить.',
  '',
  'Вторая таблица — то, из-за чего покрытие нельзя принимать за «мёртвый код». Все',
  'инструкции в ней достижимы: `throw` в `retry` сработает, если попытки кончатся,',
  '`default` в `route` — если придёт незнакомый метод, `return \'пусто\'` — на пустом',
  'списке. Драйвер просто не подал таких данных. Покрытие говорит «не выполнялось при',
  'этих входных данных», анализ — «не выполнится ни при каких». Первое зависит от',
  'тестов, второе — нет.',
  '',
  helperEntry
    ? `И отдельно про ловушку с всплытием: функция helper в покрытии есть, с ${helperEntry.ranges[0].count} вызовом,`
    : 'И отдельно про ловушку с всплытием:',
  'хотя объявляющая её инструкция лежит в блоке, куда управление не заходило. Движок',
  'считает вызовы функции, а не выполнения её объявления — потому что объявление и не',
  'выполняется, оно обрабатывается при входе в область видимости.',
);

section('Что с этим делают инструменты');

table(
  ['инструмент', 'что делает с недостижимым кодом'],
  [
    ['ESLint', 'правило no-unreachable — предупреждение, кода не меняет'],
    ['Terser, esbuild', 'удаляют вместе с зависимыми объявлениями'],
    ['Closure Compiler', 'удаляет и распространяет вывод дальше по графу'],
    ['V8', 'не генерирует байткод для блоков, до которых нет пути'],
    ['покрытие тестов', 'не различает «недостижимо» и «не покрыто» — это не его задача'],
  ],
);

note(
  'Граф потока управления — то место, где статический анализ перестаёт быть',
  'разглядыванием дерева. На нём считаются доминаторы (ssa.mjs), живость переменных',
  'и достигающие определения (dataflow.mjs), а внутри V8 — то же самое, только для',
  'байткода и графа TurboFan из раздела 11.',
  '',
  'И тут же видно, где граф врёт. Ребро в `catch` мы проводим одно, из входа в try,',
  'хотя исключение может случиться на любой инструкции. Вложенные функции в графе —',
  'одна инструкция, хотя внутри у них свой поток управления. Оба упрощения делают',
  'граф читаемым и оба стоят точности: подробнее — в limits-of-analysis.md.',
);

console.log();
