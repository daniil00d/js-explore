// Заготовка для лабы «Порядок инициализации модулей».
//
// В каждое поле — массив строк ровно в том порядке, в котором, по-твоему,
// они попадут в журнал. Строки надо писать дословно так, как они записаны
// в файлах графа (см. graph/).
//
//   node 01-spec-and-semantics/labs/03-module-order/check.mjs

import { TODO } from '../../../tools/lab.mjs';

export const answers = {
  // Граф graph/tla-main.mjs: два импорта, в первом из них верхнеуровневый await.
  // Возможные записи: 'slow:start', 'slow:end', 'fast', 'main'.
  tlaOrder: TODO,

  // Граф graph/cycle-a.mjs: циклическая пара модулей ESM.
  // Записи вида 'a:start', 'a:end', 'b:start', 'b:end',
  // 'a видит helperB: …', 'b видит helperA: …', 'b видит labelA: …',
  // где после двоеточия — либо typeof, либо имя ошибки.
  esmCycleOrder: TODO,

  // Граф graph/cycle-a.cjs: та же пара, но на CommonJS.
  // Записи вида 'a:start', 'a:end', 'b:start', 'b:end',
  // 'a видит helperB: …', 'b видит helperA: …', 'b видит labelA: …'.
  cjsCycleOrder: TODO,

  // Граф graph/dyn-main.mjs: динамический import() посреди модуля.
  // Возможные записи: 'main:start', 'main:end', 'child', 'main:после await'.
  dynamicImportOrder: TODO,
};
