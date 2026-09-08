// Общая обвязка для примеров раздела: печать таблиц и запуск фрагментов кода.
//
// Многие правила спецификации проще показать на коде, который не должен запуститься
// или должен упасть. Поэтому фрагменты выполняются через node:vm в отдельном контексте:
// так SyntaxError можно поймать и напечатать, а не уронить весь пример.

import vm from 'node:vm';
import { inspect } from 'node:util';

let atBlankLine = true;

function println(text = '') {
  console.log(text);
  atBlankLine = text.trim().length === 0;
}

function blankLine() {
  if (!atBlankLine) println();
}

export function section(title) {
  blankLine();
  println(title);
  println('='.repeat(title.length));
  println();
}

export function line(label, value, width = 34) {
  println(`  ${String(label).padEnd(width)} ${value}`);
}

export function note(...lines) {
  blankLine();
  for (const text of lines) println(text ? `  ${text}` : '');
}

export function show(value) {
  return inspect(value, { depth: 1, breakLength: 100, compact: true });
}

/** Компилирует фрагмент, ничего не выполняя: так видно ровно ранние ошибки. */
export function compile(code) {
  try {
    new vm.Script(code);
    return { ok: true };
  } catch (error) {
    return { ok: false, error };
  }
}

/** Выполняет фрагмент в свежем контексте и возвращает значение последнего выражения. */
export function run(code) {
  try {
    return { ok: true, value: vm.runInNewContext(code) };
  } catch (error) {
    return { ok: false, error };
  }
}

export function describeError(error, limit = 60) {
  const message = error.message.length > limit ? `${error.message.slice(0, limit - 1)}…` : error.message;
  return `${error.constructor.name}: ${message}`;
}

/** Готовая строка результата: либо значение, либо тип и текст ошибки. */
export function outcome(code) {
  const result = run(code);
  return result.ok ? show(result.value) : describeError(result.error);
}

export function table(header, rows) {
  const all = [header, ...rows];
  const widths = header.map((_, i) => Math.max(...all.map((row) => String(row[i]).length)));
  const format = (row) => '  ' + row.map((cell, i) => String(cell).padEnd(widths[i])).join('  ').trimEnd();
  println(format(header));
  println('  ' + widths.map((width) => '-'.repeat(width)).join('  '));
  for (const row of rows) println(format(row));
}

/** Однострочная запись многострочного фрагмента — чтобы влезал в таблицу. */
export function inline(code) {
  return code.replace(/\s*\n\s*/g, ' ⏎ ').trim();
}
