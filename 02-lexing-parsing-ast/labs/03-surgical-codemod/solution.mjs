// Эталонное решение лабы «Аккуратный кодмод».

import { parse } from 'acorn';
import * as walk from 'acorn-walk';

/** Это именно `console.log(...)`, а не что-то похожее? */
function isConsoleLogCallee(callee) {
  return (
    callee.type === 'MemberExpression' &&
    // console['log'] — обращение по вычисляемому ключу, не наша цель
    !callee.computed &&
    // globalThis.console.log — здесь object это MemberExpression, а не Identifier
    callee.object.type === 'Identifier' &&
    callee.object.name === 'console' &&
    callee.property.type === 'Identifier' &&
    callee.property.name === 'log'
  );
}

export function rewrite(source) {
  const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });

  const edits = [];
  walk.simple(ast, {
    CallExpression(node) {
      if (isConsoleLogCallee(node.callee)) {
        // Заменяем только диапазон вызываемого выражения. Аргументы, комментарии
        // внутри них и висячие запятые остаются ровно теми символами, что были.
        edits.push({ start: node.callee.start, end: node.callee.end, text: 'logger.debug' });
      }
    },
  });

  // Правки применяются справа налево: иначе первая же замена сдвинет все
  // последующие позиции, потому что 'logger.debug' и 'console.log' разной длины.
  edits.sort((left, right) => right.start - left.start);

  let result = source;
  for (const edit of edits) {
    result = result.slice(0, edit.start) + edit.text + result.slice(edit.end);
  }

  return result;
}
