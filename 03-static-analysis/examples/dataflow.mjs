// Анализ потока данных: достигающие определения и живость переменных.
//
// Это тот самый приём, из которого выросло почти всё остальное: значения
// распространяются по графу до неподвижной точки, и из результата уже
// вычитываются ответы — «может ли здесь оказаться undefined», «нужна ли эта
// запись», «можно ли переиспользовать регистр».
//
// Запуск: node 03-static-analysis/examples/dataflow.mjs

import * as acorn from 'acorn';
import { line, note, raw, section, table } from '../../tools/format.mjs';
import { buildCfg, reachableBlocks, reversePostorder } from './cfg.mjs';
import { collectVariables } from './variables.mjs';

const source = `function summary(order, rate) {
  let total = 0;
  let label = fallbackLabel();
  let skipped;

  for (const item of order.items) {
    if (!item.active) {
      skipped = item.id;
      continue;
    }
    total += item.price;
  }

  if (total > 0) {
    label = 'начислено';
  } else {
    label = 'ничего';
  }

  const tax = total * rate;
  total += tax;

  return { label, total, skipped };
}`;

const ast = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'module', locations: true });
const functionNode = ast.body[0];
const cfg = buildCfg(functionNode, source);
const reachable = reachableBlocks(cfg);

// Чтения и записи считает variables.mjs: он разрешает имена через области
// видимости, поэтому `total` этой функции и `total` из другой не перепутаются.
const { definitions, definitionsByBinding, defsOf, usesOf } = collectVariables(ast, functionNode, cfg);
const statements = cfg.blocks.flatMap((block) => block.statements.map((statement) => ({ block, statement })));

section('Функция, которую разбираем');

source.split('\n').forEach((text, index) => raw(`  ${String(index + 1).padStart(2)} | ${text}`));

section('Определения: каждая запись в переменную получает номер');

table(
  ['№', 'переменная', 'строка', 'что происходит', 'блок'],
  definitions.map((definition) => [
    definition.id,
    definition.binding.name,
    definition.line,
    definition.label,
    `B${definition.block.id}`,
  ]),
);

note(
  'Определение — это не переменная и не объявление, а конкретная точка, где в',
  'переменную что-то записали. Одна переменная даёт столько определений, сколько',
  'в коде записей: у `label` их три, у `total` — тоже три. Параметры добавляют ещё',
  'по одному: значение в них приходит от вызывающего, и это тоже запись.',
  '',
  '`skipped ← undefined` в этом списке — не педантизм. `let skipped;` действительно',
  'записывает в переменную значение, и это единственная причина, по которой ниже',
  'вообще возможен ответ «здесь может быть undefined».',
);

section('Достигающие определения: какие записи доживают до каждого блока');

// Прямой анализ: IN[b] — объединение OUT предшественников, OUT[b] — то, что
// пришло, минус убитое в блоке, плюс сгенерированное в нём.
const gen = new Map();
const kill = new Map();
for (const block of cfg.blocks) {
  const generated = new Set();
  const killed = new Set();
  for (const statement of block.statements) {
    for (const definition of defsOf(statement)) {
      // Запись в переменную убивает все прежние определения этой же переменной.
      for (const other of definitionsByBinding.get(definition.binding)) {
        generated.delete(other);
        killed.add(other);
      }
      killed.delete(definition);
      generated.add(definition);
    }
  }
  gen.set(block, generated);
  kill.set(block, killed);
}
// Определения параметров создаются при входе: они генерируются блоком входа.
for (const definition of definitions.filter((item) => item.statement === null)) {
  gen.get(cfg.entry).add(definition);
}

const reachingIn = new Map();
const reachingOut = new Map();
for (const block of cfg.blocks) {
  reachingIn.set(block, new Set());
  reachingOut.set(block, new Set());
}

const order = reversePostorder(cfg);
let reachingRounds = 0;
let changed = true;
while (changed) {
  changed = false;
  reachingRounds += 1;
  for (const block of order) {
    const incoming = new Set();
    for (const edge of block.predecessors) {
      for (const definition of reachingOut.get(edge.from)) incoming.add(definition);
    }
    const outgoing = new Set([...incoming].filter((definition) => !kill.get(block).has(definition)));
    for (const definition of gen.get(block)) outgoing.add(definition);

    const previous = reachingOut.get(block);
    if (previous.size !== outgoing.size || [...outgoing].some((item) => !previous.has(item))) changed = true;
    reachingIn.set(block, incoming);
    reachingOut.set(block, outgoing);
  }
}

const ids = (set) =>
  [...set]
    .sort((left, right) => Number(left.id.slice(1)) - Number(right.id.slice(1)))
    .map((definition) => definition.id)
    .join(' ') || '—';

table(
  ['блок', 'что это', 'приходит (IN)', 'уходит (OUT)'],
  cfg.blocks
    .filter((block) => reachable.has(block))
    .map((block) => [`B${block.id}`, block.label, ids(reachingIn.get(block)), ids(reachingOut.get(block))]),
);

line('раундов до неподвижной точки', reachingRounds);

note(
  'Алгоритм здесь предельно простой: пройти по блокам, пересчитать множества,',
  'повторить, пока хоть что-то меняется. Останавливается он не потому, что мы так',
  'решили: множества только растут, а определений конечное число, поэтому рано или',
  `поздно ничего не меняется. Здесь на это ушло ${reachingRounds} раунда.`,
  '',
  'Больше одного раунда нужно из-за ребра назад. На первом проходе блок с условием',
  'цикла ещё не знает про записи, которые случатся в теле, — про них он узнаёт только',
  'после того, как тело посчитано. Ровно поэтому анализ на графе с циклами —',
  'итеративный, а не однопроходный.',
);

section('Что из этого следует: чтение до присваивания');

const returnStatement = statements.find(({ statement }) => statement.node.type === 'ReturnStatement');

// Множества IN и OUT посчитаны для блока целиком, а вопрос задан про точку внутри
// блока. Поэтому доходим до нужной инструкции руками, применяя записи по порядку:
// иначе к `return` «дошли» бы и те записи в total, которые убила строка 21.
const atReturn = new Set(reachingIn.get(returnStatement.block));
for (const statement of returnStatement.block.statements) {
  if (statement === returnStatement.statement) break;
  for (const definition of defsOf(statement)) {
    for (const other of definitionsByBinding.get(definition.binding)) atReturn.delete(other);
    atReturn.add(definition);
  }
}

const definitionsAtReturn = new Map();
for (const definition of atReturn) {
  if (!definitionsAtReturn.has(definition.binding)) definitionsAtReturn.set(definition.binding, []);
  definitionsAtReturn.get(definition.binding).push(definition);
}

table(
  ['переменная', 'какие записи сюда доходят', 'может быть undefined'],
  [...definitionsAtReturn]
    .filter(([binding]) => usesOf(returnStatement.statement).some((use) => use.binding === binding))
    .map(([binding, list]) => [
      binding.name,
      list.map((definition) => `${definition.id} (стр. ${definition.line})`).join(', '),
      list.some((definition) => definition.label.endsWith('undefined')) ? 'да' : 'нет',
    ]),
);

note(
  'До `return` доходят две записи в `skipped`: настоящая из тела цикла и та самая',
  '«← undefined» из объявления. Значит, на каком-то пути значение так и осталось',
  'неприсвоенным — и анализ это доказал, ничего не запуская.',
  '',
  'Из того же результата видно, что `label` к моменту `return` присвоен на всех путях:',
  'записи из объявления среди доходящих нет, её убили обе ветви `if`. Это и есть',
  'definite assignment — то, на чём стоят проверки TypeScript про «переменная',
  'используется до присваивания».',
);

section('Живость: какие переменные ещё понадобятся');

// Обратный анализ: OUT[b] — объединение IN последователей, IN[b] — то, что
// читается в блоке, плюс то, что нужно после, минус то, что блок перезаписывает.
const liveIn = new Map();
const liveOut = new Map();
for (const block of cfg.blocks) {
  liveIn.set(block, new Set());
  liveOut.set(block, new Set());
}

let livenessRounds = 0;
changed = true;
while (changed) {
  changed = false;
  livenessRounds += 1;
  for (const block of [...order].reverse()) {
    const after = new Set();
    for (const edge of block.successors) {
      for (const binding of liveIn.get(edge.to)) after.add(binding);
    }
    const live = new Set(after);
    for (const statement of [...block.statements].reverse()) {
      for (const definition of defsOf(statement)) live.delete(definition.binding);
      for (const use of usesOf(statement)) live.add(use.binding);
    }

    const previous = liveIn.get(block);
    if (previous.size !== live.size || [...live].some((item) => !previous.has(item))) changed = true;
    liveOut.set(block, after);
    liveIn.set(block, live);
  }
}

const names = (set) =>
  [...set]
    .map((binding) => binding.name)
    .sort()
    .join(', ') || '—';

table(
  ['блок', 'что это', 'живо на входе', 'живо на выходе'],
  cfg.blocks
    .filter((block) => reachable.has(block))
    .map((block) => [`B${block.id}`, block.label, names(liveIn.get(block)), names(liveOut.get(block))]),
);

line('раундов до неподвижной точки', livenessRounds);

note(
  'Живость считается в обратную сторону: переменная жива в точке, если на каком-то',
  'пути дальше её ещё прочитают. Направление — единственное, чем этот анализ',
  'отличается от предыдущего; уравнения те же, объединение то же, остановка по той',
  'же причине.',
  '',
  'Это самый практичный из всех анализов потока данных, и не в линтерах, а в',
  'компиляторах: распределение регистров — это раскраска графа конфликтов, а граф',
  'конфликтов строится ровно по живости. Две переменные могут делить один регистр,',
  'если нигде не живы одновременно. У V8 то же самое происходит с регистрами',
  'байткода из раздела 09 и с кадрами деоптимизации из раздела 11: чтобы вернуться',
  'в интерпретатор, нужно знать, какие значения ещё живы.',
);

section('Мёртвые записи');

const deadStores = [];
for (const block of cfg.blocks) {
  if (!reachable.has(block)) continue;
  const live = new Set(liveOut.get(block));
  for (const statement of [...block.statements].reverse()) {
    const liveAfter = new Set(live);
    for (const definition of defsOf(statement)) {
      if (!liveAfter.has(definition.binding)) deadStores.push({ definition, statement });
    }
    for (const definition of defsOf(statement)) live.delete(definition.binding);
    for (const use of usesOf(statement)) live.add(use.binding);
  }
}

table(
  ['запись', 'переменная', 'строка', 'инструкция', 'можно ли удалить инструкцию'],
  deadStores.map(({ definition, statement }) => [
    definition.id,
    definition.binding.name,
    definition.line,
    statement.label,
    statement.node.type === 'VariableDeclaration'
      ? 'нет: останутся `let label;` и вызов'
      : 'только если правая часть чистая',
  ]),
);

note(
  'Мёртвая запись — та, чьё значение никто не прочитает. `label = fallbackLabel()`',
  'в третьей строке функции именно такая: обе ветви `if` ниже перезаписывают `label`',
  'на всех путях, поэтому результат вызова не нужен никому.',
  '',
  'И вот тут анализ заканчивается, а инженерное решение начинается. Выбросить',
  'инструкцию нельзя: `fallbackLabel()` — вызов, а про чужой вызов мы не знаем',
  'ничего. Он может писать в лог, менять глобальное состояние или бросать',
  'исключение. Убрать можно только присваивание, оставив вызов, — и настоящие',
  'минификаторы поступают именно так, если не доказали, что функция чистая.',
);

section('Проверка выводов запуском');

// Ровно тот текст, который разбирали выше, но теперь выполненный. Свободное имя
// fallbackLabel приходит параметром обёртки, поэтому подменить его легко.
const fallbackCalls = [];
const summary = new Function(
  'fallbackLabel',
  `${source}
return summary;`,
)(() => {
  fallbackCalls.push(1);
  return 'из fallbackLabel';
});

const allActive = summary({ items: [{ active: true, price: 100, id: 1 }] }, 0.2);
const withSkipped = summary({ items: [{ active: false, id: 7 }] }, 0.2);

table(
  ['вывод анализа', 'что показал запуск', 'сходится'],
  [
    [
      'skipped может быть undefined',
      `на списке без пропусков skipped = ${String(allActive.skipped)}`,
      allActive.skipped === undefined ? 'да' : 'нет',
    ],
    [
      'та же переменная получает значение на другом пути',
      `на списке с пропуском skipped = ${String(withSkipped.skipped)}`,
      withSkipped.skipped === 7 ? 'да' : 'нет',
    ],
    [
      'запись label = fallbackLabel() мёртвая',
      `label в результате: ${allActive.label}`,
      allActive.label !== 'из fallbackLabel' ? 'да' : 'нет',
    ],
    [
      'но вызов удалять нельзя',
      `fallbackLabel вызван раз: ${fallbackCalls.length}`,
      fallbackCalls.length > 0 ? 'да' : 'нет',
    ],
  ],
);

note(
  'Запуск не доказывает выводов анализа — он их иллюстрирует, и разница здесь',
  'принципиальная. `skipped = undefined` на одном наборе данных ничего не говорит про',
  'остальные; утверждение «может быть undefined» получено из графа и верно для всех',
  'входов. А вот опровергнуть вывод запуск может: если бы `label` в результате',
  'оказался значением из `fallbackLabel`, анализ был бы просто неверен.',
  '',
  'Такая асимметрия — общее свойство статического анализа. Именно из неё берутся',
  'слова «sound» и «complete», и об этом — dataflow-primer.md.',
);

console.log();
