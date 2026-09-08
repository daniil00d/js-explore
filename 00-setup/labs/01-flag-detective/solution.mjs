// Эталонные ответы к лабе «Детектив по флагам».
//
// Как они получены:
//
//   node --trace-opt   00-setup/labs/01-flag-detective/subject.mjs 2>&1 | grep marking
//   node --trace-deopt 00-setup/labs/01-flag-detective/subject.mjs 2>&1 | grep bailout
//
// В логе --trace-opt строки вида
//   [marking 0x… <JSFunction sumStable (sfi = …)> for optimization to TURBOFAN, …]
// показывают, что функция признана горячей и отправлена в оптимизатор. Имя функции
// стоит внутри <JSFunction …>. Функция с пустым именем — это тело самого модуля,
// у него имени нет, и в ответах оно не участвует.
//
// Уровень в конце строки зависит от сборки: если в ней включён Maglev, сначала
// будет MAGLEV, а TURBOFAN позже. Для ответа это не важно — важен сам факт.
//
// В логе --trace-deopt строки вида
//   [bailout (kind: deopt-eager, reason: wrong map): begin. deoptimizing 0x… <JSFunction readPoint …>
// дают и функцию, и причину. Причины здесь ровно две:
//
//   sumMixed  → «not a Smi»: код был оптимизирован под сложение целых чисел,
//               а на вход пришли строки.
//   readPoint → «wrong map»: объекты {x, y} и {x, y, z} имеют разные скрытые
//               классы, и оптимизированный код умел работать только с первым.
//
// neverHot вызвана один раз, до порога горячести ей далеко — поэтому в логах
// её нет вообще. Отсутствие записей и есть ответ на второй вопрос.
//
// Формулировки причин записаны так, как их выдаёт V8 12.4 (node v22.14). Проверка
// сравнивает ответ не с этим файлом, а с логом текущего движка, поэтому на новой
// версии правильным окажется то, что скажет она.
//
// То же самое можно спросить у движка напрямую:
//
//   node --allow-natives-syntax 00-setup/examples/optimization-status.mjs
//
// Почему деоптимизация вообще происходит и что такое скрытый класс — разделы
// 10 и 11. Здесь важно только уметь это увидеть.

export const answers = {
  sentToOptimizer: ['sumStable', 'sumMixed', 'readPoint'],
  neverOptimized: ['neverHot'],
  deoptimized: ['sumMixed', 'readPoint'],
  readPointReason: 'wrong map',
  sumMixedReason: 'not a Smi',
};
