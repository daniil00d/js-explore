// Чтение статуса оптимизации функции: что именно возвращает %GetOptimizationStatus
// и как по нему понять, на каком уровне сейчас живёт функция.
//
// Запуск: node --allow-natives-syntax 00-setup/examples/optimization-status.mjs

import { natives, requireNatives } from './natives.mjs';

requireNatives(import.meta.filename);

const {
  getOptimizationStatus,
  prepareForOptimization,
  optimizeOnNextCall,
  compileBaseline,
  neverOptimize,
} = natives;

// Порядок битов — это enum OptimizationStatus из src/runtime/runtime.h, и он не
// стабилен: в V8 14.0 исчез kAlwaysOptimize, после чего все следующие биты сдвинулись
// на единицу. Один и тот же код на Node 22 и на свежем d8 без этой поправки читается
// по-разному: 41 означает «TurboFan» в новых версиях и «Maglev» в старых.
const BIT_NAMES_LEGACY = [
  'kIsFunction',
  'kNeverOptimize',
  'kAlwaysOptimize',
  'kMaybeDeopted',
  'kOptimized',
  'kMaglevved',
  'kTurboFanned',
  'kInterpreted',
  'kMarkedForOptimization',
  'kMarkedForConcurrentOptimization',
  'kOptimizingConcurrently',
  'kIsExecuting',
  'kTopmostFrameIsTurboFanned',
  'kLiteMode',
  'kMarkedForDeoptimization',
  'kBaseline',
  'kTopmostFrameIsInterpreted',
  'kTopmostFrameIsBaseline',
  'kIsLazy',
  'kTopmostFrameIsMaglev',
  'kOptimizeOnNextCallOptimizesToMaglev',
  'kOptimizeMaglevOptimizesToTurbofan',
];

const BIT_NAMES_MODERN = [
  'kIsFunction',
  'kNeverOptimize',
  'kMaybeDeopted',
  'kOptimized',
  'kMaglevved',
  'kTurboFanned',
  'kInterpreted',
  'kMarkedForOptimization',
  'kMarkedForConcurrentOptimization',
  'kOptimizingConcurrently',
  'kIsExecuting',
  'kTopmostFrameIsTurboFanned',
  'kLiteMode',
  'kMarkedForDeoptimization',
  'kBaseline',
  'kTopmostFrameIsInterpreted',
  'kTopmostFrameIsBaseline',
  'kIsLazy',
  'kTopmostFrameIsMaglev',
  'kOptimizeOnNextCallOptimizesToMaglev',
  'kOptimizeMaglevOptimizesToTurbofan',
  'kMarkedForMaglevOptimization',
  'kMarkedForConcurrentMaglevOptimization',
];

const v8Major = Number.parseInt(process.versions.v8, 10);
export const statusBitNames = v8Major >= 14 ? BIT_NAMES_MODERN : BIT_NAMES_LEGACY;

const bit = (name) => {
  const index = statusBitNames.indexOf(name);
  return index === -1 ? 0 : 1 << index;
};

/** Разбирает битовую маску в список установленных флагов. */
export function describeOptimizationStatus(status) {
  return statusBitNames.filter((_, index) => (status & (1 << index)) !== 0);
}

/** Короткое имя уровня, на котором сейчас исполняется функция. */
export function tierOf(status) {
  if (status & bit('kIsLazy')) return 'не компилировалась';
  if (status & bit('kTurboFanned')) return 'turbofan';
  if (status & bit('kMaglevved')) return 'maglev';
  if (status & bit('kBaseline')) return 'sparkplug';
  if (status & bit('kInterpreted')) return 'ignition';
  return '—';
}

function statusRow(label, fn) {
  const status = getOptimizationStatus(fn);
  return [label, String(status), tierOf(status), describeOptimizationStatus(status).join(', ')];
}

function printTable(header, data) {
  const all = [header, ...data];
  const widths = header.map((_, i) => Math.max(...all.map((row) => row[i].length)));
  const line = (row) => '  ' + row.map((cell, i) => cell.padEnd(widths[i])).join('  ').trimEnd();
  console.log(line(header));
  console.log('  ' + widths.map((w) => '-'.repeat(w)).join('  '));
  for (const row of data) console.log(line(row));
}

const rows = [];
const record = (stage, fn) => rows.push(statusRow(stage, fn));

function add(a, b) {
  return a + b;
}

record('объявлена, не вызвана', add);

add(1, 2);
record('после первого вызова', add);

compileBaseline(add);
add(1, 2);
record('после %CompileBaseline', add);

prepareForOptimization(add);
for (let i = 0; i < 100; i++) add(i, i);
optimizeOnNextCall(add);
add(1, 2);
record('после %OptimizeFunctionOnNextCall', add);

console.log('\nЖизненный цикл одной функции');
console.log('============================\n');
printTable(['стадия', 'маска', 'уровень', 'биты'], rows);

// Запрос оптимизации без %PrepareFunctionForOptimization молча игнорируется:
// у функции ещё нет feedback vector, спекулировать компилятору не на чем.
function withoutPrepare(x) {
  return x + 1;
}
withoutPrepare(1);
withoutPrepare(2);
optimizeOnNextCall(withoutPrepare);
withoutPrepare(3);

function withPrepare(x) {
  return x + 1;
}
prepareForOptimization(withPrepare);
withPrepare(1);
withPrepare(2);
optimizeOnNextCall(withPrepare);
withPrepare(3);

console.log('\nЛовушка: запрос оптимизации без подготовки');
console.log('==========================================\n');
printTable(
  ['вариант', 'маска', 'уровень', 'биты'],
  [
    statusRow('без %PrepareFunctionForOptimization', withoutPrepare),
    statusRow('с %PrepareFunctionForOptimization', withPrepare),
  ],
);

// Естественный путь наверх: никто ничего не просит, функция просто становится горячей.
function hot(a, b) {
  return a * b + 1;
}
let iterations = 0;
let sink = 0;
while (iterations < 2_000_000 && !(getOptimizationStatus(hot) & bit('kOptimized'))) {
  sink += hot(iterations, 3);
  iterations += 1;
}

function forbidden(a, b) {
  return a * b + 1;
}
neverOptimize(forbidden);
for (let i = 0; i < iterations * 10; i++) sink += forbidden(i, 3);

console.log('\nБез ручного вмешательства');
console.log('=========================\n');
printTable(
  ['функция', 'маска', 'уровень', 'биты'],
  [
    statusRow(`hot, ${iterations.toLocaleString('ru-RU')} вызовов`, hot),
    statusRow(`forbidden, ${(iterations * 10).toLocaleString('ru-RU')} вызовов (%NeverOptimizeFunction)`, forbidden),
  ],
);

console.log(`\n  (контрольная сумма ${sink}, чтобы вызовы не выкинули как мёртвый код)`);
console.log(`  node ${process.version} / V8 ${process.versions.v8}`);
console.log(`  раскладка битов: ${statusBitNames === BIT_NAMES_MODERN ? 'V8 >= 14' : 'V8 < 14'}\n`);
