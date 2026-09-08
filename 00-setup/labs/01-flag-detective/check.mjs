// Проверка лабы: правда берётся не из константы, а из логов самого V8.
//
//   node 00-setup/labs/01-flag-detective/check.mjs
//   node 00-setup/labs/01-flag-detective/check.mjs --solution

import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { equals, labTarget, report } from '../../../tools/lab.mjs';
import { note } from '../../../tools/format.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const subject = join(here, 'subject.mjs');

const FUNCTIONS = ['sumStable', 'sumMixed', 'readPoint', 'neverHot'];

const runWithFlags = (flags) =>
  execFileSync(process.execPath, [...flags, subject], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

// [marking 0x… <JSFunction sumStable (sfi = …)> for optimization to TURBOFAN, …]
const optimizationLog = runWithFlags(['--trace-opt']);
const optimized = new Set(
  [...optimizationLog.matchAll(/<JSFunction (\w+) \(sfi = [^)]+\)> for optimization to TURBOFAN/g)]
    .map((match) => match[1])
    .filter((name) => FUNCTIONS.includes(name)),
);

// [bailout (kind: deopt-eager, reason: wrong map): begin. deoptimizing 0x… <JSFunction readPoint …>
const deoptimizationLog = runWithFlags(['--trace-deopt']);
const deoptimizations = [...deoptimizationLog.matchAll(/reason: ([^)]+)\): begin\. deoptimizing 0x[0-9a-f]+ <JSFunction (\w+) /g)]
  .map((match) => ({ reason: match[1], name: match[2] }))
  .filter((entry) => FUNCTIONS.includes(entry.name));

// Если логи пусты, дело не в ответах читателя, а в сборке движка.
if (optimized.size === 0 || deoptimizations.length === 0) {
  note(
    'Логи V8 оказались пустыми, проверить ответы не получится.',
    '',
    'Такое бывает на сборках без оптимизирующего компилятора или при запуске под',
    'отладчиком. Проверь окружение: node 00-setup/examples/check-env.mjs',
  );
  process.exit(1);
}

const reasonFor = (name) => deoptimizations.find((entry) => entry.name === name)?.reason ?? '(деоптимизации не было)';
const sorted = (list) => [...new Set(list)].sort();

const { answers } = await import(labTarget(import.meta.url, 'answers.mjs'));

report(
  'Лаба 00-1: детектив по флагам',
  [
    equals(
      'скомпилированы TurboFan',
      sorted([...optimized]),
      sorted(answers.optimizedByTurbofan ?? []),
      'Флаг --trace-opt, строки со словом marking: там видно, какие функции ушли в TurboFan.',
    ),
    equals(
      'остались без оптимизации',
      sorted(FUNCTIONS.filter((name) => !optimized.has(name))),
      sorted(answers.neverOptimized ?? []),
      'Функцию, которой нет ни в одном логе, оптимизировать было незачем — её вызвали слишком мало раз.',
    ),
    equals(
      'деоптимизировались',
      sorted(deoptimizations.map((entry) => entry.name)),
      sorted(answers.deoptimized ?? []),
      'Флаг --trace-deopt, строки со словом bailout.',
    ),
    equals(
      'причина деопта readPoint',
      reasonFor('readPoint'),
      answers.readPointReason ?? '',
      'Причина в логе стоит сразу после «reason: », списывать её нужно дословно.',
    ),
    equals(
      'причина деопта sumMixed',
      reasonFor('sumMixed'),
      answers.sumMixedReason ?? '',
      'Обрати внимание, чем sumMixed отличается от sumStable по входным данным.',
    ),
  ],
  { hideExpected: true },
);
