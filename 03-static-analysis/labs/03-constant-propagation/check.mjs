// Проверка лабы: ожидаемые значения помечены в самих фикстурах комментарием
// «→», а каждая названная константа проверяется запуском — фикстура вызывает
// свою функцию на нескольких наборах данных и возвращает то, что получилось.
//
//   node 03-static-analysis/labs/03-constant-propagation/check.mjs
//   node 03-static-analysis/labs/03-constant-propagation/check.mjs --solution
//
// Запуск, как и покрытие в предыдущей лабе, работает в одну сторону: если
// анализ назвал значение константой, а в каком-то запуске оно другое — это
// ошибка анализа. Обратное неверно: ⊤ на месте фактической константы —
// потеря точности, а не ошибка.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { equals, holds, labTarget, report } from '../../../tools/lab.mjs';
import { truncate } from '../../../tools/format.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const { analyze } = await import(labTarget(import.meta.url, 'propagate.mjs'));

const FIXTURES = ['straight.mjs', 'branches.mjs', 'loop.mjs', 'closure.mjs'];

/** Ожидания из фикстуры: строка, имя переменной и её значение на выходе. */
function expectationsOf(source) {
  const expectations = [];
  source.split('\n').forEach((text, index) => {
    const marker = text.match(/\/\/ → (.+)$/);
    if (!marker) return;
    const declaration = text.match(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)/);
    if (!declaration) return;
    expectations.push({ line: index + 1, name: declaration[1], value: marker[1].trim() });
  });
  return expectations;
}

/** Тот же формат печати, что в заготовке: строки в кавычках, ⊤ значком. */
function describe(value) {
  if (typeof value === 'string') return JSON.stringify(value);
  return String(value);
}

const results = [];

for (const fixture of FIXTURES) {
  const path = join(here, 'fixtures', fixture);
  const source = readFileSync(path, 'utf8');
  const label = fixture.replace(/\.mjs$/, '');
  const expected = expectationsOf(source);

  let found;
  try {
    found = analyze(source);
  } catch (error) {
    results.push(holds(`${label}: объявления`, false, `${error.constructor.name}: ${truncate(error.message, 22)}`));
    results.push(holds(`${label}: значения`, false, 'нечего сверять'));
    results.push(holds(`${label}: запуск подтверждает`, false, 'нечего сверять'));
    continue;
  }

  const actual = Array.isArray(found) ? found : [];

  // Сначала — про что вообще отчитались: те же строки и те же имена.
  results.push(
    equals(
      `${label}: объявления`,
      expected.map((entry) => `${entry.line} ${entry.name}`),
      actual.map((entry) => `${entry?.line} ${entry?.name}`),
      'Одна запись на объявление верхнего уровня тела функции, по возрастанию строки: объявления внутри блоков, циклов и вложенных функций сюда не входят.',
    ),
  );

  // Потом — сами значения, с указанием первого расхождения.
  const mismatch = expected
    .map((entry) => ({ entry, got: actual.find((item) => item?.line === entry.line)?.value }))
    .find(({ entry, got }) => got !== entry.value);

  results.push(
    holds(
      `${label}: значения`,
      mismatch === undefined,
      mismatch === undefined
        ? `констант ${expected.filter((entry) => entry.value !== '⊤').length} из ${expected.length}`
        : `стр. ${mismatch.entry.line}: ${mismatch.got ?? 'нет ответа'} вместо ${mismatch.entry.value}`,
      'Значение считается на выходе из функции, а не в точке объявления: важно последнее присваивание, которое до выхода дожило.',
    ),
  );

  // И проверка на честность: то, что названо константой, должно совпасть с
  // настоящим значением в каждом запуске.
  const runs = (await import(pathToFileURL(path).href)).main();
  const claimed = actual.filter((entry) => entry && entry.value !== '⊤');
  const wrong = [];
  let verified = 0;

  for (const entry of claimed) {
    for (const run of runs) {
      if (!(entry.name in run)) continue;
      const real = describe(run[entry.name]);
      if (real === entry.value) verified += 1;
      else wrong.push(`${entry.name}: в запуске ${real}, а не ${entry.value}`);
    }
  }

  results.push(
    holds(
      `${label}: запуск подтверждает`,
      wrong.length === 0 && verified > 0,
      wrong.length > 0 ? wrong[0] : verified > 0 ? `сверено значений: ${verified}` : 'констант не найдено',
      'Назвать значение константой — сильное утверждение: оно должно держаться при любых входных данных, а не только при удобных.',
    ),
  );
}

report('Лаба 03-3: распространение констант', results);
