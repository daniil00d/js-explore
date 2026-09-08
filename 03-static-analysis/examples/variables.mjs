// Кто читает и кто пишет: привязка инструкций графа к переменным функции.
//
// Скучная, но обязательная часть любого анализа потока данных. Прежде чем
// распространять что-нибудь по графу, нужно знать про каждую инструкцию, какие
// переменные она читает и какие записывает. Отдельным модулем, потому что этим
// пользуются и dataflow.mjs, и ssa.mjs, и constant-folding.mjs.
//
// Имена берутся не по тексту, а из анализа областей видимости (scope.mjs):
// два разных `item` в двух функциях — две разные переменные, и путать их нельзя.

import * as walk from 'acorn-walk';
import { analyzeScopes } from './scope.mjs';

/**
 * @param {object} ast дерево модуля
 * @param {object} functionNode функция, которую анализируем
 * @param {object} cfg её граф потока управления
 */
export function collectVariables(ast, functionNode, cfg) {
  const { scopes, references } = analyzeScopes(ast);
  const functionScope = scopes.find((scope) => scope.node === functionNode);

  // Локальные переменные функции: всё, что объявлено в ней самой или в её блоках.
  // Захваченные снаружи имена сюда не попадают — про них локальный анализ ничего
  // сказать не может, их могла изменить любая другая функция.
  const locals = new Set();
  for (const scope of scopes) {
    if (!scope.chain.includes(functionScope)) continue;
    if (scope.kind === 'function' && scope !== functionScope) continue; // вложенная функция — не наше дело
    for (const binding of scope.bindings.values()) {
      if (binding.kind !== 'implicit') locals.add(binding);
    }
  }
  const localByDeclaration = new Map([...locals].map((binding) => [binding.declaredAt, binding]));

  /** Объявления в голове `for..of` и `for..in`: определения без инициализатора. */
  const loopHeads = new Set();
  walk.full(ast, (node) => {
    if (node.type === 'ForOfStatement' || node.type === 'ForInStatement') loopHeads.add(node.left);
  });

  const definitions = [];
  const definitionsByBinding = new Map();
  const defsOfStatement = new Map();
  const usesOfStatement = new Map();

  const addDefinition = (binding, { line, label, block, statement, range }) => {
    const definition = { id: `d${definitions.length + 1}`, binding, line, label, block, statement, range };
    definitions.push(definition);
    if (!definitionsByBinding.has(binding)) definitionsByBinding.set(binding, []);
    definitionsByBinding.get(binding).push(definition);
    if (statement) {
      if (!defsOfStatement.has(statement)) defsOfStatement.set(statement, []);
      defsOfStatement.get(statement).push(definition);
    }
    return definition;
  };

  // Параметры — определения на входе: значение приходит от вызывающего, и до
  // первого присваивания в теле функции доходит именно оно.
  for (const param of functionNode.params) {
    const binding = localByDeclaration.get(param.start);
    if (binding) {
      addDefinition(binding, {
        line: functionNode.loc.start.line,
        label: `параметр ${binding.name}`,
        block: cfg.entry,
        statement: null,
        range: [param.start, param.end],
      });
    }
  }

  for (const block of cfg.blocks) {
    for (const statement of block.statements) {
      walk.full(statement.node, (node) => {
        if (node.type !== 'VariableDeclarator') return;
        const binding = localByDeclaration.get(node.id.start);
        if (!binding) return;
        const inLoopHead = [...loopHeads].some((head) => head.declarations?.includes(node));
        addDefinition(binding, {
          line: node.loc.start.line,
          label: inLoopHead
            ? `${binding.name} ← элемент`
            : node.init
              ? `${binding.name} ← значение`
              : `${binding.name} ← undefined`,
          block,
          statement,
          range: [node.id.start, node.id.end],
        });
      });

      for (const reference of references) {
        const inside = reference.node.start >= statement.start && reference.node.end <= statement.end;
        if (!inside || !reference.resolved || !locals.has(reference.resolved)) continue;

        if (reference.kind !== 'read') {
          addDefinition(reference.resolved, {
            line: reference.line,
            label: `${reference.name} ← ${reference.kind === 'readwrite' ? 'изменено' : 'присвоено'}`,
            block,
            statement,
            range: [reference.node.start, reference.node.end],
          });
        }
        if (reference.kind !== 'write') {
          if (!usesOfStatement.has(statement)) usesOfStatement.set(statement, []);
          usesOfStatement.get(statement).push({
            binding: reference.resolved,
            line: reference.line,
            range: [reference.node.start, reference.node.end],
          });
        }
      }
    }
  }

  return {
    locals,
    definitions,
    definitionsByBinding,
    defsOf: (statement) => defsOfStatement.get(statement) ?? [],
    usesOf: (statement) => usesOfStatement.get(statement) ?? [],
  };
}
