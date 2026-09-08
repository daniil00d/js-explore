// Сломанный код: как парсеры сообщают об ошибке и как из ошибки всё-таки получают дерево.
//
// Запуск: node 02-lexing-parsing-ast/examples/error-recovery.mjs

import * as acorn from 'acorn';
import { parse as babelParse } from '@babel/parser';
import ts from 'typescript';
import { line, note, raw, section, table, truncate } from '../../tools/format.mjs';

const KIND_NAMES = new Map();
for (const [name, value] of Object.entries(ts.SyntaxKind)) {
  if (typeof value !== 'number' || /^(First|Last|Count)/.test(name)) continue;
  if (!KIND_NAMES.has(value)) KIND_NAMES.set(value, name);
}
const kindName = (kind) => KIND_NAMES.get(kind) ?? ts.SyntaxKind[kind];

section('Что именно сообщает парсер');

const broken = `function total(items) {
  return items.reduce((sum, item) => sum + item.price
}`;

broken.split('\n').forEach((text, index) => raw(`  ${String(index + 1).padStart(2)} | ${text}`));
raw('');

try {
  acorn.parse(broken, { ecmaVersion: 'latest', locations: true });
} catch (error) {
  line('сообщение', error.message);
  line('позиция в тексте', error.pos);
  line('строка и столбец', `${error.loc.line}:${error.loc.column}`);
  raw('');
  const lines = broken.split('\n');
  const failing = lines[error.loc.line - 1];
  raw(`  ${String(error.loc.line).padStart(2)} | ${failing}`);
  raw(`  ${' '.repeat(2)} | ${' '.repeat(error.loc.column)}^ здесь`);
}

note(
  'Ошибка парсера — это позиция плюс ожидание. Обратите внимание, где она возникла:',
  'не там, где забыта скобка, а там, где парсер впервые не смог продолжить. Разрыв',
  'между «где сломано» и «где замечено» — причина, по которой сообщения парсеров',
  'иногда указывают на совершенно правильную строку.',
);

section('Первая ошибка — и разбор кончился');

const attempt = (label, fn) => {
  try {
    const result = fn();
    return [label, 'дерево получено', result];
  } catch (error) {
    return [label, 'исключение', truncate(error.message, 46)];
  }
};

table(
  ['парсер', 'итог', 'подробности'],
  [
    attempt('acorn', () => {
      acorn.parse(broken, { ecmaVersion: 'latest' });
      return '—';
    }),
    attempt('@babel/parser', () => {
      babelParse(broken);
      return '—';
    }),
    attempt('@babel/parser с errorRecovery', () => {
      const result = babelParse(broken, { errorRecovery: true });
      return `ошибок: ${result.errors.length}`;
    }),
    attempt('typescript', () => {
      const file = ts.createSourceFile('broken.ts', broken, ts.ScriptTarget.Latest, true);
      return `инструкций: ${file.statements.length}, диагностик: ${file.parseDiagnostics.length}`;
    }),
  ],
);

note(
  'Для компилятора остановиться на первой ошибке — правильное поведение: программы',
  'нет, дальше делать нечего. Для редактора — неприемлемое: пока вы дописываете вызов,',
  'код почти всегда сломан, а подсказки нужны именно сейчас.',
);

section('Что умеет errorRecovery у Babel');

const recoveryCases = [
  'let x; let x;',
  'let let = 2;',
  'class C { constructor() {} constructor() {} }',
  '1 = 2;',
  'const b = ;',
  'const o = { a: 1,, };',
  'if (ready) { run(',
];

table(
  ['фрагмент', 'babel с errorRecovery', 'typescript'],
  recoveryCases.map((code) => {
    let babelVerdict;
    try {
      const result = babelParse(code, { errorRecovery: true });
      babelVerdict = `дерево, ошибок ${result.errors.length}: ${result.errors.map((error) => error.reasonCode).join(', ')}`;
    } catch (error) {
      babelVerdict = `упал: ${truncate(error.message, 26)}`;
    }
    const file = ts.createSourceFile('case.ts', code, ts.ScriptTarget.Latest, true);
    return [code, truncate(babelVerdict, 44), `дерево, диагностик ${file.parseDiagnostics.length}`];
  }),
);

note(
  'Опция `errorRecovery` спасает не от всего. Она умеет продолжать разбор там, где текст',
  'разобрался, но нарушено правило: повторное объявление, `let` как имя, два конструктора,',
  'присваивание в литерал. Это те самые Early Errors из раздела 01 — Babel собирает их',
  'в массив `errors` и отдаёт дерево.',
  '',
  'А вот на настоящей поломке синтаксиса (`const b = ;`, лишняя запятая, недописанный',
  'вызов) продолжать некуда: следующий токен не подходит ни под какое правило, и Babel',
  'бросает исключение. TypeScript в тех же случаях дерево всё равно возвращает.',
  '',
  'Обратите внимание на первые четыре строки: у TypeScript там ноль диагностик.',
  'Повторное объявление и присваивание в литерал — не ошибки разбора; их находит',
  'проверяющий, а не парсер, и в этом примере он не запускался. Разделение на',
  'синтаксические и семантические диагностики — тема раздела 05.',
);

section('Как выглядит восстановленное дерево');

const halfWritten = `function total(items {
  return items +
}`;

halfWritten.split('\n').forEach((text, index) => raw(`  ${String(index + 1).padStart(2)} | ${text}`));
raw('');

const file = ts.createSourceFile('half.ts', halfWritten, ts.ScriptTarget.Latest, true);
const printRecovered = (node, depth = 0) => {
  const hasError = (node.flags & ts.NodeFlags.ThisNodeHasError) !== 0;
  raw(`  ${'  '.repeat(depth)}${kindName(node.kind)}${hasError ? '  ← достроено парсером' : ''}`);
  ts.forEachChild(node, (child) => printRecovered(child, depth + 1));
};
printRecovered(file);

raw('');
table(
  ['позиция', 'диагностика'],
  file.parseDiagnostics.map((diagnostic) => [
    diagnostic.start,
    ts.flattenDiagnosticMessageText(diagnostic.messageText, ' '),
  ]),
);

note(
  'Дерево есть, и оно осмысленное: функция с именем `total`, параметр `items`, блок',
  'с инструкцией. Часть узлов помечена флагом ошибки — парсер поставил их сам, чтобы',
  'дерево осталось связным. Ради этого он готов даже перечитать участок иначе:',
  'открывающая фигурная скобка без закрывающей круглой разобралась как деструктуризация',
  'второго параметра.',
  '',
  'Именно на таком дереве держится работа редактора: автодополнение после точки,',
  'переход к определению и подсветка типов в файле, который в этот момент не',
  'компилируется. Диагностики при этом никуда не деваются — они лежат рядом',
  'с деревом, а не вместо него.',
);

section('Кто и как себя ведёт');

table(
  ['инструмент', 'на сломанном коде'],
  [
    ['V8, любой движок', 'SyntaxError, программа не запускается'],
    ['ESLint', 'одна ошибка разбора, правила не выполняются'],
    ['Prettier', 'отказывается форматировать файл'],
    ['tsserver, языковой сервер IDE', 'дерево с достроенными узлами и список диагностик'],
    ['Babel', 'исключение, если не включён errorRecovery'],
  ],
);

note(
  'Разница не в качестве парсеров, а в задаче. Компилятору нужен ответ «программа',
  'корректна», и первая ошибка его уже даёт. Редактору нужен ответ «что здесь',
  'написано», и он обязан отвечать на любом тексте.',
  '',
  'Отсюда практический вывод, который пригодится в разделах 04 и 05: если инструмент',
  'должен работать по ходу набора кода, парсер надо брать с восстановлением. Если',
  'инструмент работает по готовому файлу в CI, восстановление только мешает —',
  'падение с точной позицией полезнее молчаливого дерева с дырами.',
);

console.log();
