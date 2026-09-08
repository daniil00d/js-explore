// Проверка лабы: ожидаемые места разметки берутся из самих фикстур — строки,
// помеченные комментарием «линтер». Так тест не расходится с примерами.
//
//   node 02-lexing-parsing-ast/labs/02-write-a-lint-rule/check.mjs
//   node 02-lexing-parsing-ast/labs/02-write-a-lint-rule/check.mjs --solution

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { equals, holds, labTarget, report } from '../../../tools/lab.mjs';
import { truncate } from '../../../tools/format.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const { analyze } = await import(labTarget(import.meta.url, 'rule.mjs'));

const FIXTURES = ['basic-loops.mjs', 'allowed.mjs', 'nested.mjs'];

/** Строки, помеченные в фикстуре комментарием «линтер». */
function expectedLines(source) {
  return source
    .split('\n')
    .map((line, index) => (/\/\/ линтер$/.test(line) ? index + 1 : null))
    .filter((line) => line !== null);
}

const results = [];

for (const name of FIXTURES) {
  const source = readFileSync(join(here, 'fixtures', name), 'utf8');
  const expected = expectedLines(source);

  let reports;
  try {
    reports = analyze(source);
  } catch (error) {
    results.push(
      holds(
        name,
        false,
        `${error.constructor.name}: ${truncate(error.message, 30)}`,
        'Разбирать фикстуры нужно как модули: sourceType: "module" и locations: true.',
      ),
    );
    continue;
  }

  const lines = Array.isArray(reports)
    ? [...reports].map((entry) => entry?.line).sort((left, right) => left - right)
    : reports;

  results.push(
    equals(
      name,
      expected,
      lines,
      'Сравни свой список строк с комментариями «линтер» в фикстуре: лишние замечания так же плохи, как пропущенные.',
    ),
  );
}

// Замечание должно указывать не только строку: колонка и текст тоже нужны,
// иначе правилом невозможно пользоваться.
{
  const source = readFileSync(join(here, 'fixtures', 'basic-loops.mjs'), 'utf8');
  let first;
  try {
    first = analyze(source)[0];
  } catch {
    first = undefined;
  }

  const sourceLines = source.split('\n');
  const columnLooksRight =
    first && typeof first.column === 'number' && sourceLines[first.line - 1]?.slice(first.column).startsWith('await');

  results.push(
    holds(
      'колонка указывает на await',
      Boolean(columnLooksRight),
      first ? `строка ${first.line}, колонка ${first.column}` : 'замечаний нет',
      'Колонку удобно брать из node.loc.start.column — это позиция самого await, а не строки или цикла.',
    ),
  );

  results.push(
    holds(
      'у замечания есть текст',
      Boolean(first && typeof first.message === 'string' && first.message.length > 10),
      first?.message ? truncate(first.message, 28) : 'нет',
      'Сообщение должно объяснять проблему человеку, который видит только вывод линтера.',
    ),
  );
}

report('Лаба 02-2: напиши правило линтера', results);
