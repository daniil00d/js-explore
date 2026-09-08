// Обзор всех лаб: что уже сделано, а что ещё нет.
//
//   node tools/labs.mjs              — прогнать проверки своих решений
//   node tools/labs.mjs --solution   — прогнать проверки на эталонах
//
// Второй режим полезен как самопроверка репозитория: если какая-то лаба
// перестала работать на новой версии Node или V8, это видно сразу.

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { line, note, section, table } from './format.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const useSolution = process.argv.includes('--solution');

/** Все лабы репозитория: каталоги вида NN-раздел/labs/NN-лаба/check.mjs. */
function findLabs() {
  const labs = [];
  for (const sectionDirectory of readdirSync(root).filter((name) => /^\d\d-/.test(name)).sort()) {
    const labsDirectory = join(root, sectionDirectory, 'labs');
    if (!existsSync(labsDirectory)) continue;
    for (const labDirectory of readdirSync(labsDirectory).sort()) {
      const checker = join(labsDirectory, labDirectory, 'check.mjs');
      if (existsSync(checker)) {
        labs.push({
          name: `${sectionDirectory}/${labDirectory}`,
          directory: join(sectionDirectory, 'labs', labDirectory),
          checker,
        });
      }
    }
  }
  return labs;
}

const labs = findLabs();

section(useSolution ? 'Лабы: проверка эталонных решений' : 'Лабы: состояние решений');

const outcomes = labs.map(({ name, directory, checker }) => {
  const args = useSolution ? [checker, '--solution'] : [checker];
  let output = '';
  let passed = true;

  try {
    output = execFileSync(process.execPath, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (error) {
    output = `${error.stdout ?? ''}${error.stderr ?? ''}`;
    passed = false;
  }

  const score = output.match(/пройдено\s+(\d+) из (\d+)/);
  const status = passed ? 'готово' : score ? 'не сделана' : 'ошибка запуска';

  return { name, directory, score: score ? `${score[1]} из ${score[2]}` : '—', status };
});

table(
  ['лаба', 'проверок', 'статус'],
  outcomes.map(({ name, score, status }) => [name, score, status]),
);

const done = outcomes.filter(({ status }) => status === 'готово').length;
line('сделано лаб', `${done} из ${outcomes.length}`);

if (!useSolution && done < outcomes.length) {
  const next = outcomes.find(({ status }) => status !== 'готово');
  note(
    `Ближайшая незакрытая: ${next.name}`,
    `Задание: ${next.directory}/README.md`,
    `Проверка: node ${next.directory}/check.mjs`,
  );
}

if (useSolution && done < outcomes.length) {
  note('Не все эталоны проходят проверку — что-то в репозитории сломалось.');
  process.exitCode = 1;
}

console.log();
