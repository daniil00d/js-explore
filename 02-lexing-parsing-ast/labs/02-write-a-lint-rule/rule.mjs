// Заготовка для лабы «Напиши правило линтера».
//
// Нужно реализовать analyze(source): разобрать код и вернуть список замечаний
// вида { line, column, message } — по одному на каждый await, который стоит
// внутри цикла.
//
//   node 02-lexing-parsing-ast/labs/02-write-a-lint-rule/check.mjs
//
// Правило целиком описано в README, но коротко: помечаем await, если, поднимаясь
// от него наверх по дереву, мы встретим цикл раньше, чем границу функции.
// Исключение — инициализация обычного for: она выполняется один раз.

import { parse } from 'acorn';
import * as walk from 'acorn-walk';

const LOOPS = new Set([
  'ForStatement',
  'ForInStatement',
  'ForOfStatement',
  'WhileStatement',
  'DoWhileStatement',
]);

const FUNCTIONS = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);

/**
 * @param {string} source исходный код модуля
 * @returns {Array<{ line: number, column: number, message: string }>}
 */
export function analyze(source) {
  // locations: true нужен, чтобы у узлов было node.loc с номерами строк.
  const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module', locations: true });
  const reports = [];

  walk.ancestor(ast, {
    AwaitExpression(node, _state, ancestors) {
      // ancestors — цепочка от корня к узлу, последний элемент это сам node.
      //
      // TODO: пройти по цепочке снизу вверх и решить, докладывать ли о находке.
      //   - встретили функцию раньше цикла → это чужой await, выходим;
      //   - встретили цикл → замечание, кроме случая, когда await сидит
      //     в инициализации ForStatement (parent.init);
      //   - дошли до корня, цикла не было → замечания нет.
      //
      // Позиция замечания — node.loc.start: строка и колонка самого await.
    },
  });

  return reports;
}
