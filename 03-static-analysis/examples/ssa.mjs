// SSA: переписываем функцию так, чтобы каждая переменная присваивалась один раз.
//
// Это не украшение и не академическая формальность. После такой перезаписи вопрос
// «откуда здесь значение» перестаёт требовать анализа: у каждого использования
// ровно одно определение, и оно записано прямо в имени. Всё, что в dataflow.mjs
// приходилось считать итерациями по графу, в SSA видно глазами.
//
// Запуск: node 03-static-analysis/examples/ssa.mjs

import * as acorn from 'acorn';
import * as walk from 'acorn-walk';
import { line, note, raw, section, table } from '../../tools/format.mjs';
import { buildCfg, dominanceFrontiers, dominators, reachableBlocks } from './cfg.mjs';
import { collectVariables } from './variables.mjs';

const source = `function grade(score, bonus) {
  let level = 'низкий';
  if (score > 50) {
    level = 'средний';
    if (bonus > 0) {
      level = 'высокий';
    }
  }

  let points = 0;
  for (let i = 0; i < score; i += 1) {
    points += i;
  }

  return level + ':' + points;
}`;

const ast = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'module', locations: true });
const functionNode = ast.body[0];
const cfg = buildCfg(functionNode, source);
const reachable = reachableBlocks(cfg);
const { definitions, definitionsByBinding, defsOf, usesOf } = collectVariables(ast, functionNode, cfg);

const { dominance, idom } = dominators(cfg);
const frontiers = dominanceFrontiers(cfg, { idom, reachable });

section('Функция, которую переписываем');

source.split('\n').forEach((text, index) => raw(`  ${String(index + 1).padStart(2)} | ${text}`));

section('Доминаторы и дерево доминирования');

const blocks = cfg.blocks.filter((block) => reachable.has(block));

table(
  ['блок', 'что это', 'доминаторы', 'непосредственный', 'фронт доминирования'],
  blocks.map((block) => [
    `B${block.id}`,
    block.label,
    [...dominance.get(block)]
      .map((item) => `B${item.id}`)
      .sort((left, right) => Number(left.slice(1)) - Number(right.slice(1)))
      .join(' '),
    block === cfg.entry ? '—' : `B${idom.get(block).id}`,
    [...frontiers.get(block)].map((item) => `B${item.id}`).join(' ') || '—',
  ]),
);

note(
  'Блок A доминирует над B, если любой путь от входа к B проходит через A. Это',
  'простое определение отвечает на очень практичный вопрос: можно ли в блоке B',
  'полагаться на то, что было сделано в A. Если A доминирует над B — да, потому что',
  'обойти A невозможно.',
  '',
  'Фронт доминирования — там, где влияние блока заканчивается: блоки, куда можно',
  'прийти и через него, и в обход. Это ровно точки слияния разных путей, и потому',
  'ровно те места, где придётся ставить φ-функции.',
);

section('Куда нужны φ-функции');

// Классическое размещение по Cytron: φ для переменной ставится во фронтах
// доминирования всех блоков, где она определяется, и это повторяется, пока
// новые φ (сами являющиеся определениями) не перестанут добавляться.
const phis = new Map(blocks.map((block) => [block, []]));

for (const [binding, list] of definitionsByBinding) {
  const worklist = [...new Set(list.map((definition) => definition.block))].filter((block) => reachable.has(block));
  const placed = new Set();
  while (worklist.length > 0) {
    const block = worklist.pop();
    for (const frontier of frontiers.get(block) ?? []) {
      if (placed.has(frontier)) continue;
      placed.add(frontier);
      phis.get(frontier).push({ binding, version: null, arguments: [] });
      // φ — это тоже определение, поэтому оно порождает φ дальше по графу.
      if (!list.some((definition) => definition.block === frontier)) worklist.push(frontier);
    }
  }
}

table(
  ['блок', 'что это', 'предшественников', 'нужны φ для'],
  blocks.map((block) => [
    `B${block.id}`,
    block.label,
    block.predecessors.filter((edge) => reachable.has(edge.from)).length,
    phis.get(block).map((phi) => phi.binding.name).join(', ') || '—',
  ]),
);

note(
  'φ-функция — не операция, а запись факта: «в этом блоке значение переменной',
  'зависит от того, каким путём мы сюда пришли». Никакого кода она не порождает,',
  'а при выходе из SSA превращается в копии на входящих рёбрах.',
  '',
  'Их всего два места на функцию, и оба неизбежны. Первое — слияние после `if`:',
  '`level` там либо «низкий», либо «средний», либо «высокий», в зависимости от пути.',
  'Второе — голова цикла: значение `points` и `i` приходит либо из инициализации,',
  'либо с предыдущей итерации. Ребро назад — главный источник φ в реальном коде.',
);

section('SSA-форма функции');

const SUBSCRIPTS = '₀₁₂₃₄₅₆₇₈₉';
const subscript = (number) => String(number).split('').map((digit) => SUBSCRIPTS[Number(digit)]).join('');
const versioned = (binding, version) => `${binding.name}${subscript(version)}`;

// Переименование: идём по дереву доминирования и держим для каждой переменной стек
// актуальных версий. Дерево доминирования, а не граф, — потому что версия видна
// ровно там, где определение доминирует над использованием.
const counters = new Map();
const stacks = new Map();
for (const binding of definitionsByBinding.keys()) {
  counters.set(binding, 0);
  stacks.set(binding, []);
}

const nextVersion = (binding) => {
  const version = counters.get(binding) + 1;
  counters.set(binding, version);
  stacks.get(binding).push(version);
  return version;
};
const currentVersion = (binding) => stacks.get(binding).at(-1) ?? 0;

const dominatorChildren = new Map(blocks.map((block) => [block, []]));
for (const block of blocks) {
  if (block === cfg.entry) continue;
  dominatorChildren.get(idom.get(block))?.push(block);
}

// Версии по позициям в исходнике. Карт две, потому что у составного присваивания
// `points += i` одно и то же вхождение — сразу и чтение старой версии, и запись новой.
const useVersionAt = new Map();
const defVersionAt = new Map();

const renameBlock = (block) => {
  const pushed = [];

  for (const phi of phis.get(block)) {
    phi.version = nextVersion(phi.binding);
    pushed.push(phi.binding);
  }

  for (const statement of block.statements) {
    // Сначала использования: `points += i` читает старую версию points.
    for (const use of usesOf(statement)) {
      useVersionAt.set(use.range[0], versioned(use.binding, currentVersion(use.binding)));
    }
    for (const definition of defsOf(statement)) {
      const version = nextVersion(definition.binding);
      pushed.push(definition.binding);
      defVersionAt.set(definition.range[0], versioned(definition.binding, version));
    }
  }

  // Аргументы φ в блоках-последователях: с этого ребра приходит текущая версия.
  for (const edge of block.successors) {
    for (const phi of phis.get(edge.to) ?? []) {
      phi.arguments.push({ from: block, version: currentVersion(phi.binding) });
    }
  }

  for (const child of dominatorChildren.get(block)) renameBlock(child);

  for (const binding of pushed.reverse()) stacks.get(binding).pop();
};

// Параметры получают версии до всего остального: они определены на входе.
for (const definition of definitions.filter((item) => item.statement === null)) {
  const version = nextVersion(definition.binding);
  defVersionAt.set(definition.range[0], versioned(definition.binding, version));
}
renameBlock(cfg.entry);

/**
 * Инструкция с подставленными версиями. Замены делаются по позициям, а не по
 * имени: одноимённая переменная из другой области не должна пострадать.
 */
const renderStatement = (statement) => {
  const replacements = [];

  for (const use of usesOf(statement)) {
    if (useVersionAt.has(use.range[0])) {
      replacements.push({ start: use.range[0], end: use.range[1], text: useVersionAt.get(use.range[0]) });
    }
  }

  for (const definition of defsOf(statement)) {
    const [start, end] = definition.range;
    const name = defVersionAt.get(start);
    if (!name) continue;
    const readwrite = replacements.find((replacement) => replacement.start === start);
    // Составное присваивание в SSA распадается на чтение и запись:
    // `points += i` — это `points₃ = points₂ + i₂`.
    if (readwrite) readwrite.text = `${name} = ${readwrite.text}`;
    else replacements.push({ start, end, text: name });
  }

  // Сам оператор тоже надо переписать: `+=` превращается в `+`, `++` — в `+ 1`.
  walk.full(statement.node, (node) => {
    if (node.type === 'AssignmentExpression' && node.operator !== '=' && defVersionAt.has(node.left.start)) {
      replacements.push({ start: node.left.end, end: node.right.start, text: ` ${node.operator.slice(0, -1)} ` });
    }
    if (node.type === 'UpdateExpression' && defVersionAt.has(node.argument.start)) {
      const name = defVersionAt.get(node.argument.start);
      const previous = useVersionAt.get(node.argument.start);
      replacements.push({
        start: node.start,
        end: node.end,
        text: `${name} = ${previous} ${node.operator[0]} 1`,
      });
    }
  });

  // Замена всего узла перекрывает замены внутри него — оставляем внешнюю.
  const outer = replacements
    .filter(
      (replacement) =>
        !replacements.some(
          (other) => other !== replacement && other.start <= replacement.start && other.end >= replacement.end,
        ),
    )
    .sort((left, right) => left.start - right.start);

  let text = '';
  let cursor = statement.start;
  for (const replacement of outer) {
    if (replacement.start < cursor) continue;
    text += source.slice(cursor, replacement.start) + replacement.text;
    cursor = replacement.end;
  }
  text += source.slice(cursor, statement.end);
  return text.split('\n')[0].trim();
};

for (const block of blocks) {
  const from = block.predecessors.filter((edge) => reachable.has(edge.from)).map((edge) => `B${edge.from.id}`);
  raw(`  B${block.id} ${block.label}${from.length > 0 ? `   ← ${from.join(', ')}` : ''}`);

  if (block === cfg.entry) {
    for (const definition of definitions.filter((item) => item.statement === null)) {
      raw(`        ${defVersionAt.get(definition.range[0])} = параметр`);
    }
  }

  for (const phi of phis.get(block)) {
    const args = phi.arguments
      .map((argument) => `${versioned(phi.binding, argument.version)} из B${argument.from.id}`)
      .join(', ');
    raw(`        ${versioned(phi.binding, phi.version)} = φ(${args})`);
  }

  for (const statement of block.statements) raw(`        ${renderStatement(statement)}`);

  const out = block.successors.map((edge) => (edge.label ? `B${edge.to.id} (${edge.label})` : `B${edge.to.id}`));
  if (out.length > 0) raw(`        → ${out.join(', ')}`);
}

note(
  'Тот же код, но у каждой переменной столько имён, сколько было записей. У любого',
  'использования теперь ровно одно определение, и его видно по индексу: в `return`',
  'участвуют `level₅` и `points₂` — то есть значения из φ, а не из какой-то конкретной',
  'ветви. Составное присваивание при этом распалось на чтение и запись:',
  '`points += i` стало `points₃ = points₂ + i₂`, и это не косметика — в SSA не бывает',
  'инструкции, которая читает и пишет одно имя.',
  '',
  'Обратите внимание на голову цикла: `i₂ = φ(i₁ из B4, i₃ из B7)`. Это индуктивная',
  'переменная, записанная явно, — с такой формой компилятор может доказать, что `i`',
  'только растёт и не выходит за границы, и убрать проверки в теле цикла.',
);

section('Проверка инвариантов SSA');

// Где определено каждое версионное имя: определения из кода и φ-функции.
const definitionSites = new Map();
const assignedVersions = new Map();
const record = (name, block) => {
  assignedVersions.set(name, (assignedVersions.get(name) ?? 0) + 1);
  definitionSites.set(name, block);
};

for (const definition of definitions) {
  const name = defVersionAt.get(definition.range[0]);
  if (name) record(name, definition.block);
}
for (const [block, list] of phis) {
  for (const phi of list) record(versioned(phi.binding, phi.version), block);
}

const assignedTwice = [...assignedVersions].filter(([, count]) => count > 1);

// Второй инвариант: определение обязано доминировать над использованием — иначе
// на каком-то пути значение читалось бы до записи.
const dominationErrors = [];
for (const block of blocks) {
  for (const statement of block.statements) {
    for (const use of usesOf(statement)) {
      const name = useVersionAt.get(use.range[0]);
      const site = definitionSites.get(name);
      if (!site) {
        dominationErrors.push([name ?? use.binding.name, `B${block.id}`, 'определение не найдено']);
        continue;
      }
      if (!dominance.get(block)?.has(site)) {
        dominationErrors.push([name, `B${block.id}`, `определено в B${site.id}, которое не доминирует`]);
      }
    }
  }
}

const phiArgumentErrors = [];
for (const block of blocks) {
  const incoming = block.predecessors.filter((edge) => reachable.has(edge.from)).length;
  for (const phi of phis.get(block)) {
    if (phi.arguments.length !== incoming) {
      phiArgumentErrors.push([versioned(phi.binding, phi.version), `B${block.id}`, `${phi.arguments.length} из ${incoming}`]);
    }
  }
}

table(
  ['инвариант', 'нарушений', 'итог'],
  [
    ['каждое имя присваивается один раз', assignedTwice.length, assignedTwice.length === 0 ? 'ок' : '✗'],
    ['определение доминирует над использованием', dominationErrors.length, dominationErrors.length === 0 ? 'ок' : '✗'],
    [
      'у φ по аргументу на каждое входящее ребро',
      phiArgumentErrors.length,
      phiArgumentErrors.length === 0 ? 'ок' : '✗',
    ],
  ],
);

if (dominationErrors.length > 0) table(['имя', 'блок', 'что не так'], dominationErrors);
if (phiArgumentErrors.length > 0) table(['φ', 'блок', 'аргументов'], phiArgumentErrors);

line('всего версий', assignedVersions.size);
line('φ-функций', [...phis.values()].flat().length);

note(
  'Проверять инварианты стоит всегда, когда пишешь построение SSA: ошибка в',
  'размещении φ или в стеке версий не ломает программу сразу, она просто делает',
  'дальнейшие выводы неверными. Второй инвариант — самый полезный: если определение',
  'не доминирует над использованием, значит, есть путь, на котором значение читается',
  'до записи, и такая SSA-форма недействительна.',
);

section('Зачем это всё');

table(
  ['без SSA', 'с SSA'],
  [
    ['«какие записи доходят сюда» — итеративный анализ', 'написано в индексе имени'],
    ['константа теряется на слиянии путей', 'φ показывает, что именно сливается'],
    ['переименование требует проверки областей видимости', 'имена уже уникальны'],
    ['цепочки use-def нужно строить отдельно', 'они есть по построению'],
  ],
);

note(
  'SSA — стандартная промежуточная форма всех серьёзных компиляторов, и TurboFan',
  'в V8 не исключение: его «море узлов» (sea of nodes) — это SSA, у которого ещё и',
  'порядок инструкций не фиксирован, пока это не потребуется. Maglev, средний уровень',
  'JIT, тоже работает на SSA-графе. Разбор — в разделах 08 и 11.',
  '',
  'Из этой формы напрямую растут оптимизации, которые видит любой JS-разработчик:',
  'подстановка констант, вынос инвариантов из цикла, устранение проверок границ,',
  'скаляризация объектов, которые никуда не убегают. Что происходит, когда такие',
  'предположения оказываются неверными, — раздел 11 про деоптимизацию.',
);

console.log();
