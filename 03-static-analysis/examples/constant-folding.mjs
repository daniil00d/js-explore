// Абстрактная интерпретация: считаем программу не на значениях, а на их описаниях.
//
// Решётка здесь минимальная из полезных — три уровня: ⊥ «сюда не доходили»,
// конкретная константа и ⊤ «может быть что угодно». Этого хватает, чтобы
// свернуть выражения, подставить константы и выбросить ветку, которая никогда
// не выполнится. Всё это делают минификаторы, `tsc` и сам V8.
//
// Запуск: node 03-static-analysis/examples/constant-folding.mjs

import * as acorn from 'acorn';
import * as walk from 'acorn-walk';
import { line, note, raw, section, table } from '../../tools/format.mjs';
import { buildCfg, reachableBlocks } from './cfg.mjs';
import { collectVariables } from './variables.mjs';

/** «Сюда управление не доходило»: ниже любой константы. */
const BOTTOM = Symbol('⊥');
/** «Может быть что угодно»: выше любой константы. */
const TOP = Symbol('⊤');

const constant = (value) => ({ value });
const isConstant = (item) => item !== BOTTOM && item !== TOP;

/** Объединение двух описаний. Разные константы дают ⊤ — это и есть потеря точности. */
function meet(left, right) {
  if (left === BOTTOM) return right;
  if (right === BOTTOM) return left;
  if (left === TOP || right === TOP) return TOP;
  return Object.is(left.value, right.value) ? left : TOP;
}

const show = (item) => {
  if (item === BOTTOM) return '⊥';
  if (item === TOP) return '⊤';
  if (typeof item.value === 'string') return JSON.stringify(item.value);
  if (Object.is(item.value, -0)) return '-0';
  return String(item.value);
};

/**
 * Текст литерала для значения — или null, если литералом это не записывается.
 * Здесь живут все ловушки свёртки: `NaN` и `Infinity` не литералы, `-0`
 * печатается как `0` и перестаёт быть минус нулём, `undefined` — вообще имя.
 */
function literalText(value) {
  switch (typeof value) {
    case 'string':
      return JSON.stringify(value);
    case 'boolean':
      return String(value);
    case 'bigint':
      return `${value}n`;
    case 'undefined':
      // Минификаторы пишут `void 0` не из любви к экзотике: `undefined` — это
      // имя, которое в теории можно затенить локальной переменной.
      return 'void 0';
    case 'number':
      if (Number.isNaN(value)) return null;
      if (!Number.isFinite(value)) return null;
      if (Object.is(value, -0)) return null;
      return String(value);
    case 'object':
      return value === null ? 'null' : null;
    default:
      return null;
  }
}

const BINARY = {
  '+': (a, b) => a + b,
  '-': (a, b) => a - b,
  '*': (a, b) => a * b,
  '/': (a, b) => a / b,
  '%': (a, b) => a % b,
  '**': (a, b) => a ** b,
  '==': (a, b) => a == b, // eslint-disable-line eqeqeq
  '===': (a, b) => a === b,
  '!=': (a, b) => a != b, // eslint-disable-line eqeqeq
  '!==': (a, b) => a !== b,
  '<': (a, b) => a < b,
  '>': (a, b) => a > b,
  '<=': (a, b) => a <= b,
  '>=': (a, b) => a >= b,
  '&': (a, b) => a & b,
  '|': (a, b) => a | b,
  '^': (a, b) => a ^ b,
  '<<': (a, b) => a << b,
  '>>': (a, b) => a >> b,
  '>>>': (a, b) => a >>> b,
};

const UNARY = {
  '-': (a) => -a,
  '+': (a) => +a,
  '!': (a) => !a,
  '~': (a) => ~a,
  typeof: (a) => typeof a,
  void: () => undefined,
};

/**
 * Абстрактное вычисление выражения. Возвращает описание значения, а не значение:
 * ⊤ означает «не знаю», и это всегда допустимый ответ. Неправильный ответ —
 * назвать константой то, что ей не является.
 *
 * @param {object} node узел выражения
 * @param {Map} env текущие описания переменных
 * @param {(node: object, value: object) => void} [record] куда сложить значение каждого узла
 */
function evaluate(node, env, record = () => {}) {
  const result = compute(node, env, record);
  record(node, result);
  return result;
}

function compute(node, env, record) {
  switch (node.type) {
    case 'Literal':
      // BigInt-литерал у acorn лежит в отдельном поле: value для него — BigInt.
      return constant(node.bigint !== undefined ? BigInt(node.bigint) : node.value);

    case 'Identifier':
      return env.get(node.__binding) ?? TOP;

    case 'UnaryExpression': {
      const argument = evaluate(node.argument, env, record);
      if (!isConstant(argument) || !UNARY[node.operator]) return TOP;
      try {
        return constant(UNARY[node.operator](argument.value));
      } catch {
        return TOP;
      }
    }

    case 'BinaryExpression': {
      const left = evaluate(node.left, env, record);
      const right = evaluate(node.right, env, record);
      if (!isConstant(left) || !isConstant(right) || !BINARY[node.operator]) return TOP;
      try {
        // Смешивание BigInt с числом бросает TypeError — и это не наша забота
        // сообщать об ошибке, наша задача не свернуть выражение неправильно.
        return constant(BINARY[node.operator](left.value, right.value));
      } catch {
        return TOP;
      }
    }

    case 'LogicalExpression': {
      const left = evaluate(node.left, env, record);
      if (!isConstant(left)) {
        // Правую часть всё равно обходим: нам нужны значения её узлов.
        evaluate(node.right, env, record);
        return TOP;
      }
      const shortCircuit =
        (node.operator === '&&' && !left.value) ||
        (node.operator === '||' && Boolean(left.value)) ||
        (node.operator === '??' && left.value !== null && left.value !== undefined);
      if (shortCircuit) return left;
      return evaluate(node.right, env, record);
    }

    case 'ConditionalExpression': {
      const test = evaluate(node.test, env, record);
      const consequent = evaluate(node.consequent, env, record);
      const alternate = evaluate(node.alternate, env, record);
      if (!isConstant(test)) return meet(consequent, alternate);
      return test.value ? consequent : alternate;
    }

    case 'TemplateLiteral': {
      let text = '';
      for (const [index, quasi] of node.quasis.entries()) {
        text += quasi.value.cooked;
        if (index < node.expressions.length) {
          const part = evaluate(node.expressions[index], env, record);
          if (!isConstant(part)) return TOP;
          text += String(part.value);
        }
      }
      return constant(text);
    }

    case 'SequenceExpression': {
      let last = TOP;
      for (const expression of node.expressions) last = evaluate(expression, env, record);
      return last;
    }

    default:
      // Вызовы, обращения к свойствам, `new`, присваивания — всё это может
      // сделать что угодно, поэтому единственный корректный ответ — ⊤.
      // Обойти вложенные выражения всё равно нужно: там могут быть свои константы.
      for (const key of Object.keys(node)) {
        const value = node[key];
        if (Array.isArray(value)) {
          for (const child of value) if (child && typeof child.type === 'string') evaluate(child, env, record);
        } else if (value && typeof value.type === 'string') {
          evaluate(value, env, record);
        }
      }
      return TOP;
  }
}

section('Решётка: три уровня знания о значении');

table(
  ['описание', 'что означает', 'когда появляется'],
  [
    ['⊥', 'управление сюда не доходило', 'ветвь отсечена известным условием'],
    ['42, "текст", true', 'значение известно точно', 'литерал или свёртка известных операндов'],
    ['⊤', 'может быть что угодно', 'параметр, вызов, слияние разных констант'],
  ],
);

note(
  'Порядок здесь важнее самих значений: ⊥ ниже всего, ⊤ выше всего, константы',
  'между ними и друг с другом не сравниваются. Объединение двух разных констант',
  'даёт ⊤ — не потому, что так удобнее, а потому, что другого корректного ответа',
  'нет: на слиянии путей значение действительно может быть любым из двух.',
  '',
  'Именно из этого свойства следует остановка анализа. Значение переменной может',
  'только подниматься по решётке: ⊥ → константа → ⊤. Высота решётки — три, поэтому',
  'сколько бы ни было итераций по циклу, каждая переменная сменит описание не',
  'больше двух раз, и процесс сойдётся.',
);

section('Свёртка выражений, сверенная с настоящим вычислением');

const cases = [
  '2 * 60 * 60 * 1000',
  '1 + 2 + "3"',
  '0.1 + 0.2',
  '"a" + 1 + 2',
  '1 / 3',
  '0 * -1',
  '1 / 0',
  '0 / 0',
  '2 ** 53 + 1',
  '!0',
  'typeof 1',
  'void 0',
  'null ?? "по умолчанию"',
  '0 || "пусто"',
  '1n + 2n',
  '1 + 2n',
  '5 > 3 ? "да" : "нет"',
  '[1, 2].length',
  'Math.max(1, 2)',
];

const emptyEnv = new Map();
const foldingRows = [];
let agreements = 0;
let disagreements = 0;

for (const text of cases) {
  const expression = acorn.parseExpressionAt(text, 0, { ecmaVersion: 'latest' });
  const folded = evaluate(expression, emptyEnv);

  let real;
  let threw = false;
  try {
    real = new Function(`return (${text});`)();
  } catch {
    threw = true;
  }

  let verdict;
  if (!isConstant(folded)) {
    verdict = 'не сворачиваем';
  } else if (threw) {
    verdict = 'ошибка: мы свернули!';
    disagreements += 1;
  } else if (Object.is(folded.value, real)) {
    verdict = 'совпало';
    agreements += 1;
  } else {
    verdict = 'РАСХОЖДЕНИЕ';
    disagreements += 1;
  }

  foldingRows.push([
    text,
    isConstant(folded) ? show(folded) : '⊤',
    threw ? 'исключение' : show(constant(real)),
    isConstant(folded) ? (literalText(folded.value) ?? 'нельзя') : '—',
    verdict,
  ]);
}

table(['выражение', 'наша свёртка', 'настоящее значение', 'литералом', 'итог'], foldingRows);

line('совпало', agreements);
line('расхождений', disagreements);

note(
  'Проверка здесь не формальность: свёртка — это реализация семантики оператора',
  'заново, а значит, место, где легко разойтись со спецификацией. Поэтому каждое',
  'выражение считается дважды — нашим вычислителем и настоящим движком, и',
  'результаты сравниваются через `Object.is`, а не `===`: иначе `-0` и `NaN`',
  'проскочат незамеченными.',
  '',
  'Колонка «литералом» — отдельная история, из-за которой свёртка не заканчивается',
  'вычислением. `0 * -1` действительно равно минус нулю, но записать его в код',
  'литералом нельзя: `0` — это не то же значение, у него `1 / 0` даёт `Infinity`,',
  'а не `-Infinity`. То же с `NaN` и `Infinity`: это не литералы, а обращения к',
  'глобальным именам, которые в теории можно перекрыть. Поэтому вычислить можно',
  'больше, чем подставить, и минификаторы это различают.',
  '',
  '`1 + 2n` мы не сворачиваем, потому что настоящее вычисление бросает TypeError:',
  'смешивать BigInt с числом нельзя. Правильное поведение анализа здесь — отказаться,',
  'а не «упростить»: ошибка должна остаться в программе там, где была.',
);

section('Распространение констант по функции');

const source = `function backoff(attempt, base) {
  const factor = 2;
  const unit = 1000;
  const debug = false;

  let delay = base * unit;
  let cap = 30 * unit;

  if (debug) {
    delay = 0;
    cap = 0;
  }

  for (let i = 0; i < attempt; i += 1) {
    delay = delay * factor;
    if (delay > cap) {
      delay = cap;
    }
  }

  return { delay, cap, jitter: unit / factor };
}`;

const ast = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'module', locations: true });
const functionNode = ast.body[0];
const cfg = buildCfg(functionNode, source);
const reachable = reachableBlocks(cfg);
const { locals, definitions, defsOf, usesOf } = collectVariables(ast, functionNode, cfg);

// Вычислителю нужно понимать, к какой привязке относится идентификатор: имя `cap`
// в этой функции и `cap` в любой другой — разные переменные. Раскладываем связь
// прямо по узлам, чтобы evaluate() мог смотреть в окружение.
const bindingByPosition = new Map();
for (const definition of definitions) bindingByPosition.set(definition.range[0], definition.binding);
for (const block of cfg.blocks) {
  for (const statement of block.statements) {
    for (const use of usesOf(statement)) bindingByPosition.set(use.range[0], use.binding);
  }
}
walk.full(ast, (node) => {
  if (node.type === 'Identifier' && bindingByPosition.has(node.start)) {
    node.__binding = bindingByPosition.get(node.start);
  }
});

source.split('\n').forEach((text, index) => raw(`  ${String(index + 1).padStart(2)} | ${text}`));

/** Условие блока: последняя инструкция, если из блока есть развилка. */
const conditionOf = (block) => {
  const branches =
    block.successors.some((edge) => edge.label === 'да') && block.successors.some((edge) => edge.label === 'нет');
  return branches ? block.statements.at(-1) : null;
};

/** Один проход по блоку: обновляем описания переменных и, если нужно, пишем в record. */
function runBlock(block, incoming, record = () => {}) {
  const env = new Map(incoming);

  for (const statement of block.statements) {
    const node = statement.node;
    let handled = false;

    if (node.type === 'VariableDeclaration') {
      handled = true;
      for (const declarator of node.declarations) {
        if (declarator.id.type !== 'Identifier') continue; // деструктуризация — не наш случай
        const binding = bindingByPosition.get(declarator.id.start);
        const value = declarator.init ? evaluate(declarator.init, env, record) : constant(undefined);
        if (binding) env.set(binding, value);
      }
    }

    if (node.type === 'ExpressionStatement' && node.expression.type === 'AssignmentExpression') {
      const assignment = node.expression;
      if (assignment.left.type === 'Identifier') {
        handled = true;
        const binding = bindingByPosition.get(assignment.left.start);
        let value;
        if (assignment.operator === '=') {
          value = evaluate(assignment.right, env, record);
        } else {
          // `delay *= 2` — это чтение старого значения и запись нового.
          const previous = env.get(binding) ?? TOP;
          const right = evaluate(assignment.right, env, record);
          const operator = assignment.operator.slice(0, -1);
          value =
            isConstant(previous) && isConstant(right) && BINARY[operator]
              ? constant(BINARY[operator](previous.value, right.value))
              : TOP;
        }
        if (binding) env.set(binding, value);
      }
    }

    if (!handled) {
      // Формы, которые мы не разбираем: читаем выражение ради вложенных констант,
      // а всем записям в этой инструкции честно ставим ⊤.
      evaluate(node.type === 'ExpressionStatement' ? node.expression : node, env, record);
      for (const definition of defsOf(statement)) env.set(definition.binding, TOP);
    }
  }

  return env;
}

// Sparse conditional constant propagation в миниатюре: блок считается только
// если в него есть выполнимое ребро, а ребро выполнимо, только если условие
// не доказано ложным. Из-за этого ветка под `if (debug)` в анализ не попадёт
// вовсе, и её присваивания не испортят описания переменных.
const envIn = new Map();
const envOut = new Map();
const executable = new Set();
for (const block of cfg.blocks) {
  envIn.set(block, new Map());
  envOut.set(block, new Map());
}

const startEnv = new Map();
for (const binding of locals) startEnv.set(binding, BOTTOM);
for (const definition of definitions.filter((item) => item.statement === null)) {
  startEnv.set(definition.binding, TOP); // параметры приходят снаружи
}

let rounds = 0;
let worklist = [cfg.entry];
envIn.set(cfg.entry, startEnv);

while (worklist.length > 0) {
  rounds += 1;
  const block = worklist.shift();

  const incoming =
    block === cfg.entry
      ? startEnv
      : (() => {
          const merged = new Map();
          for (const binding of locals) merged.set(binding, BOTTOM);
          for (const edge of block.predecessors) {
            if (!executable.has(edge)) continue;
            for (const [binding, value] of envOut.get(edge.from)) {
              merged.set(binding, meet(merged.get(binding) ?? BOTTOM, value));
            }
          }
          return merged;
        })();

  envIn.set(block, incoming);
  const outgoing = runBlock(block, incoming);
  const previous = envOut.get(block);
  const changed =
    previous.size !== outgoing.size ||
    [...outgoing].some(([binding, value]) => show(previous.get(binding) ?? BOTTOM) !== show(value));
  envOut.set(block, outgoing);

  const condition = conditionOf(block);
  const test = condition ? evaluate(condition.node, outgoing) : TOP;
  for (const edge of block.successors) {
    // Ребро невыполнимо, если условие доказано и ведёт в другую сторону.
    if (isConstant(test)) {
      if (edge.label === 'да' && !test.value) continue;
      if (edge.label === 'нет' && test.value) continue;
    }
    const seen = executable.has(edge);
    executable.add(edge);
    if (!seen || changed) worklist.push(edge.to);
  }
}

const interesting = [...locals].filter((binding) => binding.kind !== 'param');

table(
  ['блок', 'что это', ...interesting.map((binding) => binding.name)],
  cfg.blocks
    .filter((block) => reachable.has(block))
    .map((block) => [
      `B${block.id}`,
      block.label,
      ...interesting.map((binding) => show(envOut.get(block).get(binding) ?? BOTTOM)),
    ]),
);

line('обработок блоков', rounds);

const unreachableByCondition = cfg.blocks.filter(
  (block) =>
    reachable.has(block) &&
    block !== cfg.entry &&
    block.predecessors.length > 0 &&
    block.predecessors.every((edge) => !executable.has(edge)),
);

const returnBlock = cfg.blocks.find((block) =>
  block.statements.some((statement) => statement.node.type === 'ReturnStatement'),
);
const valueOf = (name) => {
  const binding = [...locals].find((item) => item.name === name);
  return show(envIn.get(returnBlock).get(binding) ?? BOTTOM);
};

table(
  ['вывод к моменту return', 'значение'],
  [
    ['cap', valueOf('cap')],
    ['delay', valueOf('delay')],
    ['i', valueOf('i')],
    ['блоков, отсечённых известным условием', String(unreachableByCondition.length)],
  ],
);

note(
  '`unit`, `factor` и `debug` остаются константами: их никто не перезаписывает.',
  '`cap` — тоже константа, хотя присваивание `cap = 0` в коде есть: оно лежит под',
  '`if (debug)`, а `debug` доказано ложно, поэтому в анализ эта ветвь не попадает',
  'вообще. Это и есть смысл «conditional» в названии SCCP: отсечение невыполнимых',
  'рёбер делает анализ точнее, а не только быстрее.',
  '',
  '`delay` становится ⊤ сразу же, в строке `let delay = base * unit`: `base` —',
  'параметр, про него ничего не известно, а произведение с неизвестным неизвестно.',
  'Дальше это ⊤ расходится по всему, что от `delay` зависит, и никакая итерация его',
  'не улучшит. Так работает вся абстрактная интерпретация: неизвестность заразна,',
  'и точность теряется только в одну сторону.',
);

section('Что из этого следует для кода');

// Подстановка по позициям: заменяем только те вхождения, значение которых
// доказано константой, и только те выражения, которые целиком сворачиваются.
const valueAtNode = new Map();
for (const block of cfg.blocks) {
  if (!reachable.has(block)) continue;
  runBlock(block, envIn.get(block), (node, value) => valueAtNode.set(node.start, { node, value }));
}

const definitionPositions = new Set(definitions.map((definition) => definition.range[0]));
const shorthandPositions = new Set();
walk.full(ast, (node) => {
  if (node.type === 'Property' && node.shorthand) shorthandPositions.add(node.value.start);
});

const replacements = [];
const addReplacement = (start, end, text) => replacements.push({ start, end, text });

for (const { node, value } of valueAtNode.values()) {
  if (!isConstant(value)) continue;
  if (node.type === 'Literal') continue; // литерал и так литерал
  if (definitionPositions.has(node.start)) continue; // левая часть присваивания — не значение
  const text = literalText(value.value);
  if (text === null) continue;
  if (node.start < functionNode.start || node.end > functionNode.end) continue;
  // `{ cap }` — сокращённая запись свойства: подставить туда литерал нельзя,
  // получится `{ 30000 }`. Приходится разворачивать в `cap: 30000`.
  if (shorthandPositions.has(node.start) && node.type === 'Identifier') {
    addReplacement(node.start, node.end, `${node.name}: ${text}`);
  } else {
    addReplacement(node.start, node.end, text);
  }
}

// Ветви с доказанным условием: убираем целиком.
walk.full(functionNode, (node) => {
  if (node.type !== 'IfStatement') return;
  const record = valueAtNode.get(node.test.start);
  if (!record || !isConstant(record.value)) return;
  const taken = record.value.value ? node.consequent : node.alternate;
  addReplacement(node.start, node.end, taken ? source.slice(taken.start, taken.end) : '');
});

const outer = replacements
  .filter(
    (replacement) =>
      !replacements.some(
        (other) => other !== replacement && other.start <= replacement.start && other.end >= replacement.end,
      ),
  )
  .sort((left, right) => left.start - right.start);

let transformed = '';
let cursor = functionNode.start;
for (const replacement of outer) {
  if (replacement.start < cursor) continue;
  transformed += source.slice(cursor, replacement.start) + replacement.text;
  cursor = replacement.end;
}
transformed += source.slice(cursor, functionNode.end);

transformed.split('\n').forEach((text, index) => raw(`  ${String(index + 1).padStart(2)} | ${text}`));

note(
  'Ни одного вычисления в рантайме здесь не убавилось само собой — всё, что видно,',
  'посчитано анализом: `30 * unit` стало `30000`, `unit / factor` — `500`,',
  '`delay > cap` — `delay > 30000`, а ветка `if (debug)` исчезла вместе с',
  'присваиваниями внутри.',
  '',
  'Одна подстановка сделана иначе, и это тот случай, который ломает наивные',
  'кодмоды: `cap` в `return { delay, cap, ... }` — сокращённая запись свойства,',
  'то есть один узел на ключ и значение. Замена его на литерал дала бы `{ 30000 }`,',
  'что не парсится. Приходится разворачивать в `cap: 30000` — ровно та же история,',
  'что с позициями узлов в разделе 02.',
  '',
  'Объявления `const factor`, `const unit` и `const debug` после подстановки никто',
  'не читает, но исчезли они не сами: чтобы их убрать, нужен ещё один проход —',
  'тот самый анализ неиспользуемых привязок из scope-analysis.mjs. Оптимизации',
  'ходят парами и запускаются по кругу, пока код продолжает упрощаться.',
);

section('Проверка: поведение не изменилось');

const original = new Function(`${source}
return backoff;`)();
const optimized = new Function(`${transformed}
return backoff;`)();

const inputs = [
  [0, 1],
  [1, 2],
  [3, 5],
  [10, 1],
  [2, 0.5],
];

const comparison = inputs.map(([attempt, base]) => {
  const before = JSON.stringify(original(attempt, base));
  const after = JSON.stringify(optimized(attempt, base));
  return [`backoff(${attempt}, ${base})`, before, before === after ? 'совпало' : `разошлось: ${after}`];
});

table(['вызов', 'результат до свёртки', 'после свёртки'], comparison);

const allEqual = comparison.every((row) => row[2] === 'совпало');
line('поведение сохранено', allEqual ? 'да' : 'НЕТ');

note(
  'Свёртка констант — оптимизация, а не изменение программы, поэтому единственный',
  'осмысленный критерий здесь один: результат должен совпадать. Проверка запуском',
  'этого не доказывает (входов бесконечно много), но ловит грубые ошибки — а их в',
  'таких преобразованиях делается на удивление много: потерянный `-0`, свёрнутый',
  'вызов с побочным эффектом, подстановка в сокращённое свойство.',
  '',
  'Что здесь принципиально нельзя сделать точнее — в limits-of-analysis.md и',
  'analysis-killers.mjs: `obj[key]`, геттеры и `eval` обрушивают этот анализ',
  'первыми, потому что он держится на предположении, что чтение переменной — это',
  'просто чтение.',
);

console.log();
