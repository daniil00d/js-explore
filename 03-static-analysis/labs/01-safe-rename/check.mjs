// Проверка лабы: списка правильных ответов нет. Есть три свойства, которым
// обязано удовлетворять честное переименование, и все три проверяются на месте.
//
//   node 03-static-analysis/labs/01-safe-rename/check.mjs
//   node 03-static-analysis/labs/01-safe-rename/check.mjs --solution
//
// Что откуда берётся:
//   - запрос на переименование — из шапки самой фикстуры;
//   - «поведение не изменилось» — из выполнения модуля до и после правки;
//   - «имена разрешаются так же» — из повторного scope-анализа результата.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'acorn';
import { allBindings, analyzeScopes } from '../../examples/scope.mjs';
import { holds, labTarget, report } from '../../../tools/lab.mjs';
import { truncate } from '../../../tools/format.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const { rename } = await import(labTarget(import.meta.url, 'rename.mjs'));

const FIXTURES = [
  'simple.mjs',
  'shadowing.mjs',
  'closure.mjs',
  'destructuring.mjs',
  'same-scope.mjs',
  'capture.mjs',
  'inner-shadow.mjs',
  'direct-eval.mjs',
];

/** Запрос на переименование записан в первой строке фикстуры. */
function requestOf(source) {
  const match = source.match(/^\/\/ переименовать: (\S+) \(стр\. (\d+)\) → (\S+)$/m);
  if (!match) throw new Error('в фикстуре нет шапки с запросом на переименование');
  // У фикстур с отказом в шапке указано слово, из-за которого отказ: обычно это
  // конфликтующее имя. Отказ «потому что» без него — не ответ.
  const refusal = source.match(/^\/\/ ожидается: отказ, в причине — «([^»]+)»/m);
  return {
    name: match[1],
    line: Number(match[2]),
    to: match[3],
    mustMention: refusal?.[1] ?? null,
  };
}

/**
 * Отпечаток разрешения имён: список привязок и то, в какую из них ведёт каждая
 * ссылка. Переименование обязано сохранить его целиком, поменяв ровно одно имя.
 * Это и есть определение корректного переименования, только записанное данными.
 */
function resolutionOf(source) {
  const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module', locations: true, ranges: true });
  const { scopes, references } = analyzeScopes(ast);
  const bindings = allBindings(scopes);
  const index = new Map(bindings.map((binding, position) => [binding, position]));
  return {
    names: bindings.map((binding) => binding.name),
    declaredAt: bindings.map((binding) => binding.node?.loc.start.line ?? null),
    // -1 — ссылка ни во что не разрешилась: имя приходит из глобального объекта
    // или его вообще нет. Такие тоже должны совпасть: если после правки ссылка
    // «повисла», значит, одно из вхождений забыли.
    targets: references.map((entry) => (entry.resolved ? index.get(entry.resolved) : -1)),
    lines: references.map((entry) => entry.line),
  };
}

/** Первое расхождение двух отпечатков — человеческим языком. */
function difference(expected, actual) {
  if (expected.names.length !== actual.names.length) {
    return `объявлений стало ${actual.names.length} вместо ${expected.names.length}`;
  }
  for (let position = 0; position < expected.names.length; position += 1) {
    if (expected.names[position] !== actual.names[position]) {
      return `объявление «${expected.names[position]}» стало «${actual.names[position]}»`;
    }
  }
  if (expected.targets.length !== actual.targets.length) {
    return `ссылок стало ${actual.targets.length} вместо ${expected.targets.length}`;
  }
  for (let position = 0; position < expected.targets.length; position += 1) {
    if (expected.targets[position] === actual.targets[position]) continue;
    const line = actual.lines[position] ?? expected.lines[position];
    return actual.targets[position] === -1
      ? `ссылка в стр. ${line} перестала разрешаться`
      : `ссылка в стр. ${line} ведёт в другое объявление`;
  }
  return null;
}

/** Выполняет модуль из памяти и возвращает результат main() как строку. */
async function behaviourOf(code) {
  const url = `data:text/javascript;charset=utf-8,${encodeURIComponent(code)}`;
  const module = await import(url);
  return JSON.stringify(module.main());
}

const results = [];

for (const fixture of FIXTURES) {
  const source = readFileSync(join(here, 'fixtures', fixture), 'utf8');
  const request = requestOf(source);
  const label = fixture.replace(/\.mjs$/, '');

  let outcome;
  try {
    outcome = rename(source, { name: request.name, line: request.line, to: request.to });
  } catch (error) {
    results.push(
      holds(
        `${label}: правка применилась`,
        false,
        `${error.constructor.name}: ${truncate(error.message, 24)}`,
        'rename должна возвращать { ok: false, reason } вместо исключения — отказ это тоже ответ.',
      ),
    );
    continue;
  }

  if (request.mustMention) {
    const reason = outcome?.ok === false ? outcome.reason : null;
    const refused = typeof reason === 'string' && reason.includes(request.mustMention);
    results.push(
      holds(
        `${label}: отказ про «${request.mustMention}»`,
        refused,
        outcome?.ok ? 'переименовано' : truncate(reason ?? 'нет причины', 30),
        'Причина отказа — часть ответа, и она должна называть то, что мешает: конфликтующее имя или eval.',
      ),
    );
    continue;
  }

  const applied = outcome?.ok === true && typeof outcome.code === 'string';
  let parsed = applied;
  if (applied) {
    try {
      parse(outcome.code, { ecmaVersion: 'latest', sourceType: 'module' });
    } catch {
      parsed = false;
    }
  }

  results.push(
    holds(
      `${label}: правка применилась`,
      parsed,
      outcome?.ok === false ? `отказ: ${truncate(outcome.reason, 22)}` : applied ? 'результат не разбирается' : 'нет кода',
      'Здесь переименование безопасно, значит, нужно вернуть { ok: true, code } с корректным JavaScript.',
    ),
  );

  if (!parsed) {
    results.push(holds(`${label}: поведение сохранилось`, false, 'нечего запускать'));
    results.push(holds(`${label}: разрешение имён совпадает`, false, 'нечего сверять'));
    results.push(holds(`${label}: правка минимальна`, false, 'нечего сравнивать'));
    continue;
  }

  // 1. Поведение. Модуль запускается дважды — до и после правки — прямо из
  // памяти, через data:-URL. Здесь ловится главная ловушка лабы: сокращённая
  // запись свойства. `{ total }` → `{ sum }` разбирается и даже выглядит
  // правильно, но объект получается с другим полем.
  let before;
  let after;
  let failure = null;
  try {
    before = await behaviourOf(source);
    after = await behaviourOf(outcome.code);
  } catch (error) {
    failure = `${error.constructor.name}: ${truncate(error.message, 20)}`;
  }

  results.push(
    holds(
      `${label}: поведение сохранилось`,
      failure === null && before === after,
      failure ?? (before === after ? before : `${truncate(after, 24)} вместо ${truncate(before, 24)}`),
      'Проверь сокращённые свойства: в { count } и в const { count } = obj один и тот же текст служит и полем, и переменной.',
    ),
  );

  // 2. Разрешение имён. Свойство сильнее поведения: оно не зависит от того,
  // что именно возвращает main, и ловит вхождения, которые в этом запуске
  // просто не выполнились.
  const expected = resolutionOf(source);
  const targetIndex = expected.names.findIndex(
    (candidate, position) => candidate === request.name && expected.declaredAt[position] === request.line,
  );
  const wanted = {
    ...expected,
    names: expected.names.map((name, position) => (position === targetIndex ? request.to : name)),
  };
  const mismatch = difference(wanted, resolutionOf(outcome.code));

  results.push(
    holds(
      `${label}: разрешение имён совпадает`,
      mismatch === null,
      mismatch ?? 'дерево имён то же',
      'Переименование должно поменять ровно одну привязку и не сдвинуть ни одной ссылки: остальные имена в файле остаются как были.',
    ),
  );

  // 3. Минимальность. Переименование — не переформатирование: строк должно
  // остаться столько же, и меняться могут только строки с новым именем.
  const beforeLines = source.split('\n');
  const afterLines = outcome.code.split('\n');
  const stray = afterLines
    .map((text, position) => ({ number: position + 1, text, was: beforeLines[position] }))
    .filter((entry) => entry.text !== entry.was && !entry.text.includes(request.to));

  results.push(
    holds(
      `${label}: правка минимальна`,
      beforeLines.length === afterLines.length && stray.length === 0,
      beforeLines.length !== afterLines.length
        ? `строк стало ${afterLines.length} вместо ${beforeLines.length}`
        : stray.length === 0
          ? 'лишнего не тронуто'
          : `стр. ${stray[0].number} изменилась без «${request.to}»`,
      'Правку делают по позициям узлов, а не перегенерацией файла: генератор кода нормализует кавычки и отступы во всём файле.',
    ),
  );
}

report('Лаба 03-1: безопасное переименование', results);
