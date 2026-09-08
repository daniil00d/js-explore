// Печать вывода примеров: заголовки, таблицы, заметки.
//
// Начиная с раздела 02 примеров стало много, и одинаковый код форматирования
// расползался по файлам. Раздел 01 свою копию оставил у себя: там она сплетена
// с запуском фрагментов через node:vm и без неё примеры не читаются.

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

export function subsection(title) {
  blankLine();
  println(`${title}`);
  println('-'.repeat(title.length));
  println();
}

export function line(label, value, width = 34) {
  println(`  ${String(label).padEnd(width)} ${value}`);
}

export function note(...lines) {
  blankLine();
  for (const text of lines) println(text ? `  ${text}` : '');
}

export function raw(...lines) {
  for (const text of lines) println(text);
}

export function show(value, depth = 1) {
  return inspect(value, { depth, breakLength: 100, compact: true });
}

export function table(header, rows) {
  const all = [header, ...rows];
  const widths = header.map((_, i) => Math.max(...all.map((row) => String(row[i] ?? '').length)));
  const format = (row) => '  ' + row.map((cell, i) => String(cell ?? '').padEnd(widths[i])).join('  ').trimEnd();
  println(format(header));
  println('  ' + widths.map((width) => '-'.repeat(width)).join('  '));
  for (const row of rows) println(format(row));
}

export function truncate(text, limit) {
  const flat = String(text).replace(/\s+/g, ' ').trim();
  return flat.length > limit ? `${flat.slice(0, limit - 1)}…` : flat;
}

/** Проверка, что зависимости раздела установлены: без неё пример падает стеком. */
export async function requirePackages(...names) {
  const missing = [];
  for (const name of names) {
    try {
      await import(name);
    } catch {
      missing.push(name);
    }
  }
  if (missing.length > 0) {
    console.error(`Не найдены пакеты: ${missing.join(', ')}`);
    console.error('Установите зависимости репозитория: npm install');
    process.exit(1);
  }
}
