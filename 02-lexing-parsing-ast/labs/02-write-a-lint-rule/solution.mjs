// Эталонное решение лабы «Напиши правило линтера».

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

export function analyze(source) {
  const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module', locations: true });
  const reports = [];

  walk.ancestor(ast, {
    AwaitExpression(node, _state, ancestors) {
      // ancestors идёт от корня к узлу, последний элемент — сам await.
      // Поднимаемся от ближайшего родителя наружу и смотрим, что встретится раньше.
      for (let index = ancestors.length - 2; index >= 0; index -= 1) {
        const parent = ancestors[index];

        // Функция раньше цикла — значит, await принадлежит другому вызову,
        // и на последовательность итераций внешнего цикла он не влияет.
        // Заодно это отсекает `for await`: там await не отдельный узел вовсе,
        // это флаг ForOfStatement.await, и в обход он не попадает.
        if (FUNCTIONS.has(parent.type)) return;

        if (LOOPS.has(parent.type)) {
          // Инициализация обычного for выполняется один раз, до первой итерации.
          const insideInit =
            parent.type === 'ForStatement' &&
            parent.init &&
            node.start >= parent.init.start &&
            node.end <= parent.init.end;
          if (insideInit) return;

          reports.push({
            line: node.loc.start.line,
            column: node.loc.start.column,
            message: 'await внутри цикла: итерации выполняются последовательно',
          });
          return;
        }
      }
    },
  });

  return reports.sort((left, right) => left.line - right.line || left.column - right.column);
}
