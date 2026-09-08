// Отчёт об окружении: версии, флаги сборки V8, доступность диагностики.
//
// Запуск:      node 00-setup/examples/check-env.mjs
// Полный:      node --allow-natives-syntax 00-setup/examples/check-env.mjs

import { spawnSync } from 'node:child_process';
import os from 'node:os';
import v8 from 'node:v8';

const yesNo = (value) => (value ? 'да' : 'нет');
const mb = (bytes) => `${Math.round(bytes / 1024 / 1024)} MB`;

function section(title) {
  console.log(`\n${title}`);
  console.log('-'.repeat(title.length));
}

function row(label, value, note) {
  const line = `  ${label.padEnd(26)} ${value}`;
  console.log(note ? `${line.padEnd(48)} ${note}` : line);
}

function nativesSyntaxEnabled() {
  try {
    new Function('return %GetOptimizationStatus(function(){})')();
    return true;
  } catch {
    return false;
  }
}

function binaryVersion(name) {
  const result = spawnSync(name, ['--version'], { encoding: 'utf8' });
  if (result.error || result.status !== 0) return null;
  return (result.stdout || result.stderr).trim().split('\n')[0];
}

// Флаг существует в сборке, только если V8 собран с v8_enable_maglev.
// Node включает Maglev не во всех релизах, и без него часть примеров работать не будет.
function buildVariable(name) {
  const value = process.config.variables[name];
  return value === undefined ? null : Boolean(value);
}

section('Рантайм');
row('node', process.version);
row('v8', process.versions.v8);
row('платформа', `${process.platform} ${process.arch}`);
row('ядер', String(os.cpus().length));
row('память машины', mb(os.totalmem()));

section('Сборка V8');
const buildFlags = [
  ['maglev', 'v8_enable_maglev'],
  ['pointer compression', 'v8_enable_pointer_compression'],
  ['sandbox', 'v8_enable_sandbox'],
  ['webassembly', 'v8_enable_webassembly'],
  ['lite mode', 'v8_enable_lite_mode'],
  ['object print', 'v8_enable_object_print'],
  ['31-bit Smi', 'v8_enable_31bit_smis_on_64bit_arch'],
];
for (const [label, variable] of buildFlags) {
  const value = buildVariable(variable);
  row(label, value === null ? 'неизвестно' : yesNo(value), variable);
}

section('Возможности диагностики');
const natives = nativesSyntaxEnabled();
row('natives syntax (%-функции)', yesNo(natives), natives ? '' : 'нужен --allow-natives-syntax');
row('лимит кучи', mb(v8.getHeapStatistics().heap_size_limit));
row('флагов V8 доступно', 'см. node --v8-options');

section('Внешние инструменты');
for (const binary of ['d8', 'jsvu', 'npm']) {
  const version = binaryVersion(binary);
  row(binary, version ?? 'не найден в PATH');
}

section('Что делать дальше');
const hints = [];
if (!natives) {
  hints.push('Перезапусти с --allow-natives-syntax, иначе %-функции недоступны.');
}
if (buildVariable('v8_enable_maglev') === false) {
  hints.push('Maglev выключен на этапе сборки: примеры про средний уровень JIT');
  hints.push('нужно смотреть в d8 или в более свежем Node (см. d8-setup.md).');
}
if (!binaryVersion('d8')) {
  hints.push('d8 не установлен: npm i -g jsvu && jsvu --engines=v8 (см. d8-setup.md).');
}
hints.push('Дальше: node --allow-natives-syntax 00-setup/examples/optimization-status.mjs');
for (const hint of hints) console.log(`  ${hint}`);

section('Строка для заметок');
console.log(`  node ${process.version} / V8 ${process.versions.v8} / ${process.platform}-${process.arch}`);
console.log();
