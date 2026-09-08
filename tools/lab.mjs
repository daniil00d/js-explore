// Помощник для лабораторных: сравнение ответов и печать отчёта.
//
// Каждая лаба состоит из заготовки, которую дописывает читатель, эталонного
// решения и файла check.mjs. Проверка запускается двумя способами:
//
//   node <лаба>/check.mjs              — проверить свою заготовку
//   node <лаба>/check.mjs --solution   — посмотреть, как выглядит зачёт
//
// Второй режим нужен не только для подглядывания: им проверяется сама проверка.

import { deepStrictEqual } from 'node:assert/strict';
import { inspect } from 'node:util';
import { line, note, section, table, truncate } from './format.mjs';

/** Метка «ответ не заполнен»: без неё нельзя отличить незаполненное поле от ответа undefined. */
export const TODO = Symbol('ответ не заполнен');

const brief = (value, limit = 30) => {
  if (value === TODO) return 'не заполнено';
  return truncate(typeof value === 'string' ? value : inspect(value, { depth: 3, breakLength: Infinity }), limit);
};

export function usingSolution() {
  return process.argv.includes('--solution');
}

/** Модуль, который проверяем: заготовка читателя или эталон при --solution. */
export function labTarget(checkerUrl, starter, solution = 'solution.mjs') {
  return new URL(usingSolution() ? solution : starter, checkerUrl).href;
}

/** Проверка на равенство значений (строгое, с учётом типов). */
export function equals(name, expected, actual, hint) {
  try {
    deepStrictEqual(actual, expected);
    return { name, ok: true, expected, actual, hint };
  } catch {
    return { name, ok: false, expected, actual, hint };
  }
}

/** Проверка условия, когда сравнивать нечего — важен сам факт. */
export function holds(name, ok, detail = '', hint) {
  return { name, ok, expected: 'да', actual: ok ? 'да' : detail || 'нет', hint };
}

/** Форма ответа вместо самого ответа: подсказать структуру, не выдав значение. */
function shapeOf(value) {
  if (Array.isArray(value)) return `список из ${value.length}`;
  if (typeof value === 'string') return 'строка';
  if (typeof value === 'number') return 'число';
  if (typeof value === 'boolean') return 'да или нет';
  if (value && typeof value === 'object') return `объект, полей ${Object.keys(value).length}`;
  return 'значение';
}

/**
 * Печатает отчёт и выставляет код возврата.
 * hideExpected прячет правильные ответы в лабах, где угадать их и есть задание;
 * в лабах «реализуй функцию» ожидаемое значение — это тест, его прятать незачем.
 */
export function report(title, results, { hideExpected = false } = {}) {
  section(title);

  table(
    ['проверка', 'ожидалось', 'получилось', 'итог'],
    results.map((result) => [
      result.name,
      result.ok || !hideExpected ? brief(result.expected) : shapeOf(result.expected),
      brief(result.actual),
      result.ok ? 'ок' : '✗',
    ]),
  );

  const passed = results.filter((result) => result.ok).length;
  line('пройдено', `${passed} из ${results.length}`);

  const failed = results.filter((result) => !result.ok);
  if (failed.length > 0) {
    const hints = [...new Set(failed.map((result) => result.hint).filter(Boolean))];
    if (hints.length > 0) note('Подсказки:', '', ...hints.map((hint) => `- ${hint}`));
    note(
      usingSolution()
        ? 'Эталон не проходит проверку — значит, сломана сама лаба. Стоит открыть issue.'
        : 'Не сходится. Смотри README лабы: там есть разбор по шагам и спойлер в конце.',
    );
    process.exitCode = 1;
  } else {
    note(
      usingSolution()
        ? 'Эталон проходит проверку целиком — лаба рабочая.'
        : 'Все проверки пройдены. Можно сверить свой вариант с solution.mjs: там разбор в комментариях.',
    );
  }

  console.log();
}
