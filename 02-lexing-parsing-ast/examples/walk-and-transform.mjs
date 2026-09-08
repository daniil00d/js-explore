// Обход дерева и обратная дорога: из AST снова в текст.
//
// Запуск: node 02-lexing-parsing-ast/examples/walk-and-transform.mjs

import * as acorn from 'acorn';
import * as walk from 'acorn-walk';
import { parse as babelParse } from '@babel/parser';
import _traverse from '@babel/traverse';
import _generate from '@babel/generator';
import { line, note, raw, section, table } from '../../tools/format.mjs';

// Пакеты Babel собраны как CommonJS, поэтому в ESM их экспорт приезжает
// завёрнутым в объект модуля. Отсюда этот `.default ?? ...` — типовая ловушка.
const traverse = _traverse.default ?? _traverse;
const generate = _generate.default ?? _generate;

const source = `// счётчик посещений
export function track(user, event) {
  const payload = { user: user.id, event, at: Date.now() };
  console.log("отправляем", payload);
  if (!user.id) {
    console.warn("нет идентификатора");
    return null;
  }
  return send(payload);
}

const send = (payload) => fetch("/api", { method: "POST", body: JSON.stringify(payload) });`;

section('Исходник, с которым работаем');

source.split('\n').forEach((text, index) => raw(`  ${String(index + 1).padStart(2)} | ${text}`));

section('Обход через acorn-walk: собираем статистику');

const ast = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'module', locations: true });

const histogram = new Map();
walk.full(ast, (node) => histogram.set(node.type, (histogram.get(node.type) ?? 0) + 1));

const top = [...histogram].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 8);
table(
  ['тип узла', 'сколько'],
  top.map(([type, count]) => [type, count]),
);
line('всего узлов', [...histogram.values()].reduce((sum, count) => sum + count, 0));
line('разных типов', histogram.size);

section('Обход с родителями: ищем вызовы console');

const consoleCalls = [];
walk.ancestor(ast, {
  CallExpression(node, _state, ancestors) {
    const callee = node.callee;
    if (callee.type !== 'MemberExpression') return;
    if (callee.object.type !== 'Identifier' || callee.object.name !== 'console') return;
    const enclosing = ancestors
      .filter((ancestor) => ancestor.type === 'FunctionDeclaration' || ancestor.type === 'ArrowFunctionExpression')
      .at(-1);
    consoleCalls.push({
      method: callee.property.name,
      line: node.loc.start.line,
      inside: enclosing?.id?.name ?? (enclosing ? 'стрелочная функция' : 'верхний уровень'),
    });
  },
});

table(
  ['метод', 'строка', 'внутри'],
  consoleCalls.map((call) => [`console.${call.method}`, call.line, call.inside]),
);

note(
  'В `acorn-walk` три режима обхода, и разница между ними — ровно то, чего не хватает',
  'в самописном рекурсивном спуске. `simple` вызывает обработчик на узлах нужного типа,',
  '`ancestor` даёт вместе с узлом всю цепочку родителей, `full` заходит в каждый узел.',
  '',
  'Родители нужны почти всегда: сам по себе `CallExpression` не отвечает на вопрос',
  '«внутри какой функции он находится» и «не удалён ли уже его блок». ESTree ссылок',
  'на родителя не хранит, поэтому их либо передают при обходе, либо расставляют заранее.',
);

section('Babel: обход с путями и областями видимости');

const babelAst = babelParse(source, { sourceType: 'module' });

const bindings = [];
traverse(babelAst, {
  FunctionDeclaration(path) {
    const scopeBindings = Object.keys(path.scope.bindings);
    bindings.push([`функция ${path.node.id.name}`, scopeBindings.join(', ') || '—']);
  },
  Program(path) {
    bindings.push(['модуль', Object.keys(path.scope.bindings).join(', ')]);
  },
});

table(['область видимости', 'свои привязки'], bindings);

const referenceInfo = [];
traverse(babelAst, {
  Program(path) {
    for (const [name, binding] of Object.entries(path.scope.bindings)) {
      referenceInfo.push([name, binding.kind, binding.references, binding.constant ? 'да' : 'нет']);
    }
  },
});

table(['имя', 'вид объявления', 'обращений', 'не переприсваивается'], referenceInfo);

note(
  'Babel даёт не узлы, а пути (`path`): у пути есть родитель, область видимости, методы',
  'замены и удаления. Информация об областях видимости считается заранее и хранится',
  'рядом с деревом — отсюда `path.scope.bindings` с числом обращений к каждому имени.',
  '',
  'Это уже не разбор, а анализ: подсчёт обращений — основа и для минификатора (имя без',
  'обращений можно выбросить), и для линтера (`no-unused-vars`), и для сборщика',
  '(tree shaking). Как это устроено внутри — раздел 03.',
);

section('Трансформация: убираем логирование и переименовываем');

const transformed = babelParse(source, { sourceType: 'module' });

let removed = 0;
traverse(transformed, {
  CallExpression(path) {
    const callee = path.node.callee;
    const isConsole =
      callee.type === 'MemberExpression' &&
      callee.object.type === 'Identifier' &&
      callee.object.name === 'console';
    if (!isConsole) return;
    // Удаляем не вызов, а инструкцию целиком: иначе останется пустое выражение.
    path.getStatementParent().remove();
    removed += 1;
  },
  Program(path) {
    // Переименование по привязке, а не по тексту: меняются и объявление, и все
    // обращения к нему — включая вызов внутри track.
    path.scope.rename('send', 'deliver');
  },
});

const { code } = generate(transformed, { comments: true });
line('удалено вызовов', removed);
raw('');
code.split('\n').forEach((text, index) => raw(`  ${String(index + 1).padStart(2)} | ${text}`));

note(
  'Обе правки сделаны через путь, а не через текст. Вызовы удалялись вместе с',
  'инструкцией: `path.getStatementParent().remove()` — иначе на месте `console.log(...)`',
  'осталось бы висящее выражение.',
  '',
  '`send` переименован одной строкой `path.scope.rename`, и это не поиск с заменой:',
  'переименованы объявление и обращение внутри `track`, потому что они указывают',
  'на одну привязку. Одноимённая переменная из другой области видимости осталась бы',
  'нетронутой — именно поэтому минификаторы работают с деревом, а не с текстом.',
  '',
  'Комментарий в первой строке уцелел: Babel хранит комментарии рядом с узлами и',
  'печатает их обратно. А вот всё остальное оформление — нет, и это видно ниже.',
);

section('Печать из дерева — не восстановление исходника');

const identity = generate(babelParse(source, { sourceType: 'module' }), { comments: true }).code;
const differences = [];
const originalLines = source.split('\n');
const printedLines = identity.split('\n');
for (let index = 0; index < Math.max(originalLines.length, printedLines.length); index += 1) {
  if (originalLines[index] !== printedLines[index]) {
    differences.push([index + 1, originalLines[index] ?? '(нет строки)', printedLines[index] ?? '(нет строки)']);
  }
}

line('исходник совпал с напечатанным', identity === source ? 'да' : 'нет');
line('строк было / стало', `${originalLines.length} / ${printedLines.length}`);
line('строк, где текст разошёлся', differences.length);
raw('');

table(
  ['стр.', 'было', 'стало'],
  differences.slice(0, 4).map(([index, before, after]) => [
    index,
    before.trim().slice(0, 42),
    after.trim().slice(0, 42),
  ]),
);

note(
  'Ничего не меняли — а текст всё равно другой. Литералы объектов развернулись на',
  'несколько строк, пустая строка между функциями исчезла, а у стрелки с единственным',
  'параметром пропали скобки: `(payload) =>` стало `payload =>`. Дерево не хранит',
  'оформление, и генератор печатает его по своим правилам.',
  '',
  'Для компилятора это не проблема: ему нужен смысл, а не буквы. Для кодмода — проблема',
  'ровно в этом: изменив одну строку, получишь дифф на весь файл. Поэтому инструменты,',
  'которым важен исходный вид, идут другими путями: `magic-string` правит текст по',
  'позициям из дерева, `recast` печатает заново только изменённые узлы, а Prettier',
  'наоборот — переписывает файл целиком осознанно.',
  '',
  'Разбор этих подходов — в разделе 04, а source maps, которые связывают напечатанный',
  'код с исходным, — в разделе 06.',
);

console.log();
