// Проверка лабы: файла с ожидаемым результатом нет. Вместо него — свойства,
// которым должна удовлетворять правка любого аккуратного кодмода.
//
//   node 02-lexing-parsing-ast/labs/03-surgical-codemod/check.mjs
//   node 02-lexing-parsing-ast/labs/03-surgical-codemod/check.mjs --solution

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'acorn';
import * as walk from 'acorn-walk';
import { equals, holds, labTarget, report } from '../../../tools/lab.mjs';
import { truncate } from '../../../tools/format.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const { rewrite } = await import(labTarget(import.meta.url, 'codemod.mjs'));

/** Сколько в коде вызовов вида object.method(...). */
function countCalls(source, objectName, methodName) {
  const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
  let count = 0;
  walk.simple(ast, {
    CallExpression(node) {
      const callee = node.callee;
      if (
        callee.type === 'MemberExpression' &&
        !callee.computed &&
        callee.object.type === 'Identifier' &&
        callee.object.name === objectName &&
        callee.property.type === 'Identifier' &&
        callee.property.name === methodName
      ) {
        count += 1;
      }
    },
  });
  return count;
}

const countText = (source, needle) => source.split(needle).length - 1;

const results = [];

for (const name of ['app.mjs', 'edge.mjs']) {
  const source = readFileSync(join(here, 'fixtures', name), 'utf8');
  const targets = countCalls(source, 'console', 'log');
  const textOccurrences = countText(source, 'console.log');

  let output;
  try {
    output = rewrite(source);
  } catch (error) {
    results.push(holds(`${name}: правка выполняется`, false, `${error.constructor.name}: ${truncate(error.message, 24)}`));
    continue;
  }

  if (typeof output !== 'string') {
    results.push(holds(`${name}: правка выполняется`, false, `вернулось ${typeof output}`, 'rewrite должна возвращать строку с новым текстом файла.'));
    continue;
  }

  let parsed = true;
  try {
    parse(output, { ecmaVersion: 'latest', sourceType: 'module' });
  } catch (error) {
    parsed = false;
    results.push(holds(`${name}: результат разбирается`, false, truncate(error.message, 28), 'После правки файл должен остаться корректным JavaScript.'));
  }

  if (parsed) {
    results.push(
      equals(
        `${name}: вызовы заменены`,
        targets,
        countCalls(output, 'logger', 'debug'),
        'Заменять нужно каждый вызов console.log — и вложенные тоже.',
      ),
    );
    results.push(
      equals(
        `${name}: целей не осталось`,
        0,
        countCalls(output, 'console', 'log'),
        'После правки в файле не должно остаться ни одного вызова console.log.',
      ),
    );
  }

  results.push(
    equals(
      `${name}: текст вне вызовов цел`,
      textOccurrences - targets,
      countText(output, 'console.log'),
      'Упоминания console.log в комментариях, строках и не-целях (console["log"], globalThis.console.log, ссылка без вызова) должны остаться как есть.',
    ),
  );

  // Главное свойство: если вернуть замену обратно, должен получиться байт в байт
  // исходный файл. Так проверяется, что кодмод не переформатировал ничего лишнего.
  const restored = output.replaceAll('logger.debug', 'console.log');
  const firstDifference = (() => {
    if (restored === source) return -1;
    const limit = Math.min(restored.length, source.length);
    for (let index = 0; index < limit; index += 1) {
      if (restored[index] !== source[index]) return index;
    }
    return limit;
  })();

  results.push(
    holds(
      `${name}: остальное байт в байт`,
      restored === source,
      firstDifference === -1
        ? 'да'
        : `расхождение на позиции ${firstDifference}: ${JSON.stringify(truncate(restored.slice(firstDifference), 16))}`,
      'Правку нужно делать по позициям узлов, а не перегенерацией файла: генератор кода нормализует кавычки, отступы и висячие запятые.',
    ),
  );
}

report('Лаба 02-3: аккуратный кодмод', results);
