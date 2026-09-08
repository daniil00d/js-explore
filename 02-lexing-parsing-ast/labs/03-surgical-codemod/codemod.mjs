// Заготовка для лабы «Аккуратный кодмод».
//
// Нужно реализовать rewrite(source): заменить каждый вызов `console.log(...)`
// на `logger.debug(...)` и не тронуть в файле больше ни одного байта.
//
//   node 02-lexing-parsing-ast/labs/03-surgical-codemod/check.mjs
//
// Что считается целью, а что нет — в README. Главное правило: правка делается
// по позициям узлов в исходном тексте, а не перегенерацией файла из дерева.

import { parse } from 'acorn';
import * as walk from 'acorn-walk';

export function rewrite(source) {
  const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });

  // TODO 1. Собрать правки: для каждого вызова console.log запомнить диапазон
  // вызываемого выражения (node.callee.start и node.callee.end) и текст замены.
  // Обходить дерево удобно walk.simple с обработчиком CallExpression.
  const edits = [];

  walk.simple(ast, {
    CallExpression(node) {
      // Проверять нужно именно форму: object это Identifier с именем console,
      // property — Identifier с именем log, и обращение не вычисляемое.
    },
  });

  // TODO 2. Применить правки к исходной строке.
  //
  // Порядок здесь важен: 'logger.debug' и 'console.log' разной длины, поэтому
  // после первой же замены все позиции правее неё перестают совпадать
  // с деревом. Подумай, в какую сторону идти по списку правок.

  return source;
}
