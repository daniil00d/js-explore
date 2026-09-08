// Разбор лабы «Выброси мёртвый код».
//
// Три шага, и второй из них — весь смысл раздела: вопрос «дойдёт ли управление
// до этой строки» не задаётся дереву. Дереву можно задать вопрос про форму —
// «стоит ли эта инструкция после return внутри того же блока», — и на простых
// случаях этого даже хватит. Но `while (true)` без выхода, провал между case и
// `continue` в середине тела форму не меняют. Меняют они граф, поэтому считать
// приходится на графе: есть ли путь от входа до блока.

import { parse } from 'acorn';
import * as walk from 'acorn-walk';
import { buildCfg, reachableBlocks } from '../../examples/cfg.mjs';

const DECLARATIONS = new Set(['FunctionDeclaration', 'ClassDeclaration', 'VariableDeclaration']);

/**
 * @param {string} source текст модуля
 * @returns {{ code: string, removed: number[] }}
 */
export function eliminate(source) {
  const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module', locations: true });

  // Каждая функция — свой граф. Для внешней функции вложенная это одна
  // инструкция, её внутренний поток управления снаружи не виден: ровно та же
  // причина, по которой граф вызовов в JS неполон (см. call-graph.mjs).
  const functions = [];
  const collect = (node) => functions.push(node);
  walk.simple(ast, {
    FunctionDeclaration: collect,
    FunctionExpression: collect,
    ArrowFunctionExpression: collect,
  });

  const doomed = new Set();

  for (const node of functions) {
    const cfg = buildCfg(node, source);
    const reachable = reachableBlocks(cfg);

    for (const block of cfg.blocks) {
      if (reachable.has(block)) continue;
      for (const statement of block.statements) {
        // Объявление недостижимо как инструкция, но привязку создаёт всё равно.
        if (DECLARATIONS.has(statement.node.type)) continue;
        const { start, end } = statement.node.loc;
        for (let line = start.line; line <= end.line; line += 1) doomed.add(line);
      }
    }
  }

  const removed = [...doomed].sort((left, right) => left - right);
  const code = source
    .split('\n')
    .filter((_, index) => !doomed.has(index + 1))
    .join('\n');

  return { code, removed };
}
