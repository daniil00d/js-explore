// Ленивый разбор в V8: что движок разбирает сразу, что откладывает и сколько это стоит.
//
// Запуск: node 02-lexing-parsing-ast/examples/lazy-parsing.mjs
//
// Пример запускает дочерние процессы Node с флагами V8 и разбирает его же лог,
// поэтому дополнительных флагов самому файлу не нужно.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { line, note, section, table } from '../../tools/format.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const workDir = mkdtempSync(join(tmpdir(), 'js-explore-lazy-'));

const EVENT_LABELS = {
  'preparse-no-resolution': 'предразбор',
  'preparse-resolution': 'предразбор',
  'full-parse': 'полный разбор',
  parse: 'разбор',
  'parse-function': 'разбор при вызове',
  'parse-script': 'разбор скрипта',
  'parse-eval': 'разбор eval',
  interpreter: 'байткод',
  'interpreter-eval': 'байткод',
  baseline: 'baseline-компиляция',
  'first-execution': 'первый вызов',
};

/** Номер строки по смещению в файле — чтобы отличать одноимённые функции. */
function lineNumberAt(source, offset) {
  return source.slice(0, offset).split('\n').length;
}

/** Запускает файл с логированием событий парсера и возвращает события нужного скрипта. */
function functionEvents(scriptPath, extraFlags = []) {
  const logPath = join(workDir, `events-${Math.random().toString(36).slice(2)}.log`);
  execFileSync(
    process.execPath,
    ['--log', '--no-logfile-per-isolate', '--log-function-events', `--logfile=${logPath}`, ...extraFlags, scriptPath],
    { stdio: 'ignore' },
  );

  const log = readFileSync(logPath, 'utf8');
  const scriptLine = log
    .split('\n')
    .find((entry) => entry.startsWith('script-details,') && entry.includes(scriptPath));
  const scriptId = scriptLine?.split(',')[1];

  return log
    .split('\n')
    .filter((entry) => entry.startsWith('function,'))
    .map((entry) => entry.split(','))
    .filter((fields) => fields[2] === scriptId)
    .map((fields) => ({
      event: fields[1],
      label: EVENT_LABELS[fields[1]] ?? fields[1],
      name: fields[7]?.trim() || '(тело скрипта)',
      start: Number(fields[3]),
      ms: Number(fields[5]),
    }));
}

const subject = join(here, 'fixtures', 'lazy-subject.js');
const subjectSource = readFileSync(subject, 'utf8');
const events = functionEvents(subject);

section('Что V8 сделал с каждой функцией');

// Ключ по смещению, а не по имени: methodNeverCalled в примере два разных.
const byFunction = new Map();
for (const entry of events) {
  if (entry.name === '(тело скрипта)') continue;
  const key = entry.start;
  if (!byFunction.has(key)) {
    byFunction.set(key, { name: entry.name, line: lineNumberAt(subjectSource, entry.start), labels: [] });
  }
  byFunction.get(key).labels.push(entry.label);
}

table(
  ['стр.', 'функция в исходнике', 'события V8 по порядку'],
  [...byFunction.values()]
    .sort((a, b) => a.line - b.line)
    .map(({ name, line: at, labels }) => [at, name, labels.join(' → ')]),
);

note(
  'Ничего не вызывали — а большинство функций всё равно получили «предразбор»',
  '(в логе это `preparse-resolution`). Это работа preparser: он проходит по телу',
  'функции, проверяет синтаксис и запоминает, какие переменные она захватывает,',
  'но не строит дерево и не готовит байткод.',
  '',
  'У вызванной `declCalled` цепочка длиннее: предразбор при компиляции скрипта, затем',
  'полный разбор и байткод в момент первого вызова. Тело функции читается дважды —',
  'и V8 считает, что это всё равно выгоднее, чем разбирать целиком то, что может',
  'никогда не понадобиться.',
);

section('Трюк со скобками: какие обёртки включают немедленный разбор');

const wrappers = [
  ['inParens', '(function ...)(1)'],
  ['afterBang', '!function ...(1)'],
  ['afterVoid', 'void function ...(1)'],
  ['declCalled', 'обычное объявление, вызвана'],
  ['declNeverCalled', 'обычное объявление, не вызвана'],
];

const firstEventOf = (name) =>
  [...byFunction.values()].find((entry) => entry.name === name)?.labels[0] ?? '—';

table(
  ['функция', 'обёртка в исходнике', 'первое событие'],
  wrappers.map(([name, wrapper]) => [name, wrapper, firstEventOf(name)]),
);

note(
  'Скобка и восклицательный знак перед `function` переводят функцию в разряд «скорее',
  'всего вызовут прямо сейчас», и V8 разбирает её сразу, без предразбора. А `void`',
  'такого эффекта не даёт, хотя вызов там тоже немедленный: эвристика смотрит на',
  'символ перед словом `function`, а не на смысл выражения.',
  '',
  'Цена ошибки видна в предыдущей таблице: у `afterVoid` цепочка начинается с',
  'предразбора, а через мгновение тело читается заново полностью. Двойная работа',
  'ровно там, где её можно было избежать одной парой скобок.',
  '',
  'Отсюда старая оптимизация сборок: инструмент `optimize-js` расставлял скобки вокруг',
  'функций, которые точно вызываются на старте. Сегодня это почти не нужно — код',
  'обычно приходит с кешем компиляции, — но знать про эвристику стоит: она объясняет,',
  'почему одинаковый по смыслу код может по-разному стартовать.',
);

section('Сколько стоит разбор');

const costOf = (flags) => {
  const output = execFileSync(process.execPath, [...flags, join(here, 'fixtures', 'parse-cost.mjs')], {
    encoding: 'utf8',
    env: { ...process.env, FUNCTION_COUNT: '3000', ATTEMPTS: '3' },
  });
  return JSON.parse(output.trim().split('\n').at(-1));
};

const lazy = costOf(['--no-compilation-cache']);
const eager = costOf(['--no-compilation-cache', '--no-lazy']);
const cached = costOf([]);

const ratio = eager.timings.at(-1) / lazy.timings.at(-1);
line('размер сгенерированного файла', `${lazy.sourceKiB} КиБ, ${lazy.functionCount} функций`);
line('полный разбор дороже ленивого в', `${ratio.toFixed(1)} раза`);
note();

table(
  ['режим', 'первая компиляция', 'вторая', 'третья'],
  [
    ['по умолчанию (ленивый разбор)', ...lazy.timings.map((ms) => `${ms.toFixed(1)} мс`)],
    ['--no-lazy (полный разбор всего)', ...eager.timings.map((ms) => `${ms.toFixed(1)} мс`)],
    ['ленивый + кеш компиляции', ...cached.timings.map((ms) => `${ms.toFixed(1)} мс`)],
  ],
);

note(
  'Разница в разы, и это на файле, который никто не выполняет: замеряется только',
  '`new vm.Script(source)`. Ленивый разбор экономит именно то время, за которое',
  'страница успевает или не успевает стать интерактивной.',
  '',
  'Третья строка — про другое: одинаковый исходник в пределах процесса компилируется',
  'повторно почти бесплатно, потому что V8 держит кеш компиляции. При замерах это',
  'первая ловушка: без `--no-compilation-cache` вторая и третья попытки покажут нули,',
  'и легко решить, что разбор ничего не стоит.',
);

section('Что из этого следует');

note(
  'Стоимость кода на старте определяется не только тем, что выполняется. Каждый',
  'килобайт JavaScript надо как минимум просканировать, а функции, которые вызываются',
  'сразу, — разобрать полностью и превратить в байткод.',
  '',
  'Дальше это выходит на уровень сборки. Дробить бандл имеет смысл не только ради',
  'сети: код, который не попал в стартовый чанк, не будет ни просканирован, ни',
  'разобран. Именно это связывает раздел 07 про сборщики с разделом 09 про байткод.',
  '',
  'Отдельно стоит запомнить, что кешей у движка несколько: кеш компиляции внутри',
  'процесса (виден в замере выше), code cache между запусками страницы и снимки',
  '(snapshots) для встроенного кода. Разбор их всех — тема раздела 08.',
);

rmSync(workDir, { recursive: true, force: true });
console.log();
