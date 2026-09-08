// Заготовка для лабы «Безопасное переименование».
//
// Нужно реализовать rename(source, request): переименовать одну переменную
// или отказаться, если переименование меняет смысл программы.
//
//   node 03-static-analysis/labs/01-safe-rename/check.mjs
//
// Анализ областей видимости писать не надо — берём готовый, тот же, что в
// примерах раздела. Задача именно в том, что делать с его результатом.

import { parse } from 'acorn';
import * as walk from 'acorn-walk';
import { allBindings, analyzeScopes } from '../../examples/scope.mjs';

/** Что можно переименовать: локальные объявления, но не импорты и не `arguments`. */
const RENAMABLE = new Set(['var', 'let', 'const', 'param', 'catch', 'function', 'class']);

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

/** Слова, которые нельзя использовать как имя переменной. Список неполный намеренно. */
const RESERVED = new Set([
  'await', 'break', 'case', 'catch', 'class', 'const', 'continue', 'default', 'delete', 'do',
  'else', 'enum', 'export', 'extends', 'false', 'finally', 'for', 'function', 'if', 'implements',
  'import', 'in', 'instanceof', 'let', 'new', 'null', 'package', 'private', 'protected', 'public',
  'return', 'static', 'super', 'switch', 'this', 'throw', 'true', 'try', 'typeof', 'var', 'void',
  'while', 'with', 'yield',
]);

const refuse = (reason) => ({ ok: false, reason });

/**
 * @param {string} source текст модуля
 * @param {{ name: string, line: number, to: string }} request что и во что переименовать
 * @returns {{ ok: true, code: string } | { ok: false, reason: string }}
 */
export function rename(source, request) {
  const ast = parse(source, {
    ecmaVersion: 'latest',
    sourceType: 'module',
    locations: true,
    ranges: true,
  });

  const { scopes, references } = analyzeScopes(ast);

  if (!IDENTIFIER.test(request.to) || RESERVED.has(request.to)) {
    return refuse(`«${request.to}» не годится как имя переменной`);
  }

  // Привязка ищется по имени и строке объявления: одно имя может быть объявлено
  // в файле много раз, и переименовать нужно ровно одно из этих объявлений.
  const binding = allBindings(scopes).find(
    (candidate) => candidate.name === request.name && candidate.node?.loc.start.line === request.line,
  );

  if (!binding) return refuse(`в строке ${request.line} нет объявления «${request.name}»`);
  if (!RENAMABLE.has(binding.kind)) return refuse(`«${request.name}» — это ${binding.kind}, переименование не локальное`);
  if (request.to === request.name) return refuse('старое и новое имя совпадают');

  // TODO 1. Проверки безопасности. Каждая из них должна вернуть refuse(...):
  //
  //   а) имя `request.to` уже объявлено в области `binding.scope`
  //      → получится два объявления одного имени рядом;
  //   б) внутри поддерева области `binding.scope` есть ссылка на имя
  //      `request.to`, которая ведёт наружу этого поддерева
  //      → после переименования она поймает наше объявление;
  //   в) какая-то ссылка на `binding` лежит внутри области, где `request.to`
  //      уже объявлен
  //      → ссылка попадёт в это внутреннее объявление, а не в наше;
  //   г) внутри поддерева области есть прямой `eval`
  //      → он видит область целиком, и никакие выводы об именах не действуют.
  //
  // Полезное из scope.mjs: у области есть `bindings` (Map имя → привязка),
  // `parent`, `children` и `chain` — цепочка областей до корня. У ссылки есть
  // `name`, `scope`, `resolved` и `line`.

  // TODO 2. Собрать позиции, которые нужно переписать: само объявление
  // (`binding.node`) и все ссылки (`binding.references`, у каждой есть `node`).
  //
  // Осторожно с сокращённой записью свойств: в `{ count }` и в `const { count } = obj`
  // один и тот же кусок текста работает и ключом, и переменной. Если заменить
  // его целиком, поменяется имя поля, а это уже другой объект. Найти такие
  // места можно так:
  //
  //   walk.simple(ast, { Property(node) { if (node.shorthand) /* ... */ } });
  //
  // У сокращённого свойства `key` и `value` — разные узлы с одинаковыми
  // позициями, так что сравнивать их стоит по `start`, а не по ссылке.

  // TODO 3. Применить правки к тексту. Идти нужно с конца файла к началу,
  // иначе первая же замена сдвинет все последующие позиции.

  return refuse('переименование не реализовано');
}
