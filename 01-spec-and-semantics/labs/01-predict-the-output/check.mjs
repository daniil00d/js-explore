// Проверка лабы: каждый фрагмент действительно выполняется в чистом контексте,
// и ответ сверяется с тем, что получилось.
//
//   node 01-spec-and-semantics/labs/01-predict-the-output/check.mjs
//   node 01-spec-and-semantics/labs/01-predict-the-output/check.mjs --solution

import vm from 'node:vm';
import { equals, labTarget, report } from '../../../tools/lab.mjs';
import { cases } from './cases.mjs';

/**
 * Значения из vm-контекста живут в другом realm: массив оттуда — не тот же самый
 * Array, что здесь, и строгое сравнение на нём споткнётся. Поэтому переносим.
 */
function intoHostRealm(value) {
  // Array.from, а не value.map: map вернул бы массив того же чужого realm.
  if (Array.isArray(value)) return Array.from(value, intoHostRealm);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, intoHostRealm(nested)]));
  }
  return value;
}

/** Результат фрагмента: значение либо имя конструктора ошибки. */
function outcome(code) {
  try {
    return intoHostRealm(vm.runInNewContext(code));
  } catch (error) {
    return error.constructor.name;
  }
}

const { answers } = await import(labTarget(import.meta.url, 'answers.mjs'));

const hints = {
  varBeforeDeclaration: 'Объявление и присваивание — разные шаги. Что из них поднимается наверх?',
  letBeforeDeclaration: 'Переменная объявлена, но ещё не инициализирована. Как это называется в спеке?',
  typeofInTdz: 'typeof спасает от необъявленных имён. А здесь имя объявлено.',
  typeofUndeclared: 'Здесь имени нет вообще. typeof в этом случае не бросает — что он вернёт?',
  functionHoisting: 'Объявление функции поднимается целиком, вместе с телом.',
  asiAfterReturn: 'return — одна из ограниченных продукций: перенос строки после него значит конец инструкции.',
  asiBeforeParenthesis: 'Перед открывающей скобкой точка с запятой не вставляется. Что тогда получится из двух строк?',
  thisInSloppyFunction: 'Функция вызвана без получателя. В нестрогом режиме this не остаётся пустым.',
  thisInStrictFunction: 'В строгом режиме подмены this не происходит.',
  duplicateParamsInStrict: 'Это ранняя ошибка. Успеет ли выполниться хоть одна строка фрагмента?',
  varLoopClosures: 'Сколько всего привязок i создаёт цикл с var?',
  letLoopClosures: 'А сколько привязок создаёт цикл с let?',
  argumentsAliasSloppy: 'В нестрогой функции arguments и параметры связаны.',
  argumentsAliasStrict: 'В строгом режиме эта связь разорвана.',
};

report(
  'Лаба 01-1: предскажи результат',
  cases.map(({ id, code }) => equals(id, outcome(code), answers?.[id], hints[id])),
  { hideExpected: true },
);
