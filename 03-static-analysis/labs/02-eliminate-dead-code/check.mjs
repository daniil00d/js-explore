// Проверка лабы: ожидаемые строки помечены в самих фикстурах комментарием
// «мёртвый», а сверх этого каждая удалённая строка проверяется движком —
// покрытие снимается через NODE_V8_COVERAGE на реальном запуске фикстуры.
//
//   node 03-static-analysis/labs/02-eliminate-dead-code/check.mjs
//   node 03-static-analysis/labs/02-eliminate-dead-code/check.mjs --solution
//
// Покрытие — не эталон, а страховка в одну сторону: недостижимый код не может
// выполниться, поэтому «удалили строку, которая выполнялась» — точно ошибка.
// Обратное неверно: не выполнялось много живого кода.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse } from 'acorn';
import { equals, holds, labTarget, report } from '../../../tools/lab.mjs';
import { truncate } from '../../../tools/format.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const { eliminate } = await import(labTarget(import.meta.url, 'eliminate.mjs'));

const FIXTURES = ['after-return.mjs', 'loops.mjs', 'switch.mjs', 'nested.mjs'];

/** Строки, помеченные в фикстуре комментарием «мёртвый». */
function expectedLines(source) {
  return source
    .split('\n')
    .map((text, index) => (/\/\/ мёртвый$/.test(text) ? index + 1 : null))
    .filter((line) => line !== null);
}

/** Смещение первого непробельного символа каждой строки. */
function lineStarts(source) {
  const offsets = [];
  let offset = 0;
  for (const text of source.split('\n')) {
    const indent = text.length - text.trimStart().length;
    offsets.push(offset + indent);
    offset += text.length + 1;
  }
  return offsets;
}

/** Покрытие файла, снятое движком на его же main(). */
function coverageOf(path) {
  const directory = mkdtempSync(join(tmpdir(), 'js-explore-dead-'));
  const url = pathToFileURL(path).href;
  try {
    execFileSync(
      process.execPath,
      ['--input-type=module', '-e', `const module = await import(${JSON.stringify(url)}); module.main();`],
      { env: { ...process.env, NODE_V8_COVERAGE: directory }, stdio: 'ignore' },
    );
    for (const file of readdirSync(directory).filter((name) => name.startsWith('coverage-'))) {
      const data = JSON.parse(readFileSync(join(directory, file), 'utf8'));
      const script = data.result.find((entry) => entry.url === url);
      if (script) return script;
    }
    return null;
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

/**
 * Строки, которые движок ни разу не выполнил. Диапазоны покрытия вложены друг
 * в друга, поэтому для точки берётся самый узкий из накрывающих её: он и
 * описывает конкретный блок, а не всю функцию.
 */
function neverExecuted(script, source) {
  const ranges = script.functions.flatMap((entry) => entry.ranges);
  const countAt = (offset) => {
    const containing = ranges
      .filter((range) => range.startOffset <= offset && offset < range.endOffset)
      .sort((left, right) => left.endOffset - left.startOffset - (right.endOffset - right.startOffset));
    return containing.length > 0 ? containing[0].count : null;
  };

  const cold = new Set();
  lineStarts(source).forEach((offset, index) => {
    if (countAt(offset) === 0) cold.add(index + 1);
  });
  return cold;
}

/** Выполняет модуль из памяти и возвращает результат main() как строку. */
async function behaviourOf(code) {
  const url = `data:text/javascript;charset=utf-8,${encodeURIComponent(code)}`;
  const module = await import(url);
  return JSON.stringify(module.main());
}

const results = [];

for (const fixture of FIXTURES) {
  const path = join(here, 'fixtures', fixture);
  const source = readFileSync(path, 'utf8');
  const label = fixture.replace(/\.mjs$/, '');
  const expected = expectedLines(source);

  let outcome;
  try {
    outcome = eliminate(source);
  } catch (error) {
    results.push(holds(`${label}: строки`, false, `${error.constructor.name}: ${truncate(error.message, 22)}`));
    results.push(holds(`${label}: поведение сохранилось`, false, 'нечего запускать'));
    results.push(holds(`${label}: остальное цело`, false, 'нечего сравнивать'));
    results.push(holds(`${label}: движок подтверждает`, false, 'нечего сверять'));
    continue;
  }

  const removed = Array.isArray(outcome?.removed) ? outcome.removed : outcome?.removed;

  results.push(
    equals(
      `${label}: строки`,
      expected,
      removed,
      'Сравни свой список с комментариями «мёртвый» в фикстуре: лишняя строка так же плоха, как пропущенная.',
    ),
  );

  if (!Array.isArray(removed) || removed.length === 0) {
    // Остальные три свойства на неизменённом файле выполняются сами собой,
    // поэтому проверять их бессмысленно: сначала нужно что-то удалить.
    results.push(holds(`${label}: поведение сохранилось`, false, 'ничего не удалено'));
    results.push(holds(`${label}: остальное цело`, false, 'ничего не удалено'));
    results.push(holds(`${label}: движок подтверждает`, false, 'ничего не удалено'));
    continue;
  }

  const code = typeof outcome?.code === 'string' ? outcome.code : null;
  let parsed = code !== null;
  if (parsed) {
    try {
      parse(code, { ecmaVersion: 'latest', sourceType: 'module' });
    } catch {
      parsed = false;
    }
  }

  if (!parsed) {
    results.push(holds(`${label}: поведение сохранилось`, false, code === null ? 'нет кода' : 'результат не разбирается'));
    results.push(holds(`${label}: остальное цело`, false, 'нечего сравнивать'));
  } else {
    let before;
    let after;
    let failure = null;
    try {
      before = await behaviourOf(source);
      after = await behaviourOf(code);
    } catch (error) {
      failure = `${error.constructor.name}: ${truncate(error.message, 20)}`;
    }

    results.push(
      holds(
        `${label}: поведение сохранилось`,
        failure === null && before === after,
        failure ?? (before === after ? truncate(before, 26) : `${truncate(after, 22)} вместо ${truncate(before, 22)}`),
        'Объявления всплывают: удалив `function helper()` после return, вы уберёте и привязку, которой пользуется живой код.',
      ),
    );

    // Удаление — не переформатирование: строки из removed исчезают целиком,
    // все остальные остаются в том же порядке и байт в байт.
    const kept = source
      .split('\n')
      .filter((_, index) => !removed.includes(index + 1))
      .join('\n');

    results.push(
      holds(
        `${label}: остальное цело`,
        kept === code,
        kept === code ? 'да' : 'текст не совпал с «файл минус удалённые строки»',
        'Правку делают по позициям, а не перегенерацией из AST: иначе поменяется весь файл, а не мёртвые строки.',
      ),
    );
  }

  // Сверка с движком. Здесь важен не сам факт совпадения, а направление:
  // проверяется, что мы не удалили ничего, что реально выполнялось.
  const script = coverageOf(path);
  const cold = script ? neverExecuted(script, source) : null;
  const warm = cold ? removed.filter((line) => !cold.has(line)) : [];

  results.push(
    holds(
      `${label}: движок подтверждает`,
      Boolean(cold) && warm.length === 0,
      !cold
        ? 'покрытие не собралось'
        : warm.length === 0
          ? `удалено ${removed.length}, ни одна не выполнялась`
          : `стр. ${warm[0]} при запуске выполнялась`,
      'Если движок выполнил удалённую строку, ошибка не в покрытии: значит, путь до неё в графе есть, а мы его не увидели.',
    ),
  );
}

report('Лаба 03-2: выброси мёртвый код', results);
