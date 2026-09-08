// Проверка лабы: графы из graph/ выполняются по-настоящему, порядок берётся
// из журнала, а не из заранее записанного списка.
//
//   node 01-spec-and-semantics/labs/03-module-order/check.mjs
//   node 01-spec-and-semantics/labs/03-module-order/check.mjs --solution

import { createRequire } from 'node:module';
import { equals, labTarget, report } from '../../../tools/lab.mjs';
import { drain } from './graph/log.mjs';

// Циклический require в CommonJS вызывает предупреждение Node про обращение
// к ещё не заполненному exports. Оно здесь ожидаемо и только мешает читать вывод.
process.removeAllListeners('warning');
process.on('warning', () => {});

const { answers } = await import(labTarget(import.meta.url, 'answers.mjs'));

await import('./graph/tla-main.mjs');
const tlaOrder = drain();

await import('./graph/cycle-a.mjs');
const esmCycleOrder = drain();

await import('./graph/dyn-main.mjs');
const dynamicImportOrder = drain();

const require = createRequire(import.meta.url);
require('./graph/cycle-a.cjs');
const cjsCycleOrder = require('./graph/log.cjs').drain();

report(
  'Лаба 01-3: порядок инициализации модулей',
  [
    equals(
      'граф с верхнеуровневым await',
      tlaOrder,
      answers?.tlaOrder,
      'await посреди модуля прерывает его выполнение, но не останавливает остальной граф.',
    ),
    equals(
      'цикл в ESM',
      esmCycleOrder,
      answers?.esmCycleOrder,
      'Кто выполняется раньше: тот, кого импортируют, или тот, кто импортирует? И чем объявление функции отличается от const?',
    ),
    equals(
      'цикл в CommonJS',
      cjsCycleOrder,
      answers?.cjsCycleOrder,
      'require отдаёт объект exports в его текущем состоянии — а на что он похож в середине выполнения модуля?',
    ),
    equals(
      'динамический import()',
      dynamicImportOrder,
      answers?.dynamicImportOrder,
      'import() возвращает промис, даже если модуль уже лежит рядом и разобран.',
    ),
  ],
  { hideExpected: true },
);
