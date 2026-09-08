// Разбор лабы «Безопасное переименование».
//
// Переименование — самая честная проверка scope-анализа: если анализ ошибся
// хоть в одной ссылке, программа после правки работает иначе. Поэтому здесь два
// разных куска логики, и путать их нельзя:
//
//   1. можно ли вообще переименовать — вопрос к дереву областей видимости;
//   2. что именно переписать в тексте — вопрос к позициям узлов.
//
// Первый решается на графе имён, второй — арифметикой по смещениям. Всё, что
// делают IDE в «Rename Symbol», устроено так же, только проверок больше.

import { parse } from 'acorn';
import * as walk from 'acorn-walk';
import { allBindings, analyzeScopes } from '../../examples/scope.mjs';

const RENAMABLE = new Set(['var', 'let', 'const', 'param', 'catch', 'function', 'class']);

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

const RESERVED = new Set([
  'await', 'break', 'case', 'catch', 'class', 'const', 'continue', 'default', 'delete', 'do',
  'else', 'enum', 'export', 'extends', 'false', 'finally', 'for', 'function', 'if', 'implements',
  'import', 'in', 'instanceof', 'let', 'new', 'null', 'package', 'private', 'protected', 'public',
  'return', 'static', 'super', 'switch', 'this', 'throw', 'true', 'try', 'typeof', 'var', 'void',
  'while', 'with', 'yield',
]);

const refuse = (reason) => ({ ok: false, reason });

/** Лежит ли область внутри поддерева `root` (включая сам `root`). */
const inside = (scope, root) => scope.chain.includes(root);

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
  const { name, line, to } = request;

  if (!IDENTIFIER.test(to) || RESERVED.has(to)) return refuse(`«${to}» не годится как имя переменной`);

  const binding = allBindings(scopes).find(
    (candidate) => candidate.name === name && candidate.node?.loc.start.line === line,
  );

  if (!binding) return refuse(`в строке ${line} нет объявления «${name}»`);
  if (!RENAMABLE.has(binding.kind)) return refuse(`«${name}» — это ${binding.kind}, переименование не локальное`);
  if (to === name) return refuse('старое и новое имя совпадают');

  const scope = binding.scope;

  // (а) Столкновение в той же области. Самый простой случай и единственный,
  // который поймает даже парсер: `let temp` рядом с `const temp` — SyntaxError.
  const collision = scope.bindings.get(to);
  if (collision) {
    return refuse(`«${to}» уже объявлен в этой же области (стр. ${collision.node?.loc.start.line ?? '?'})`);
  }

  // (б) Захват: внутри области кто-то уже пользуется именем `to`, и это имя
  // приходит снаружи. Новое объявление встанет между ссылкой и её объявлением.
  //
  // Ссылки, которые ведут внутрь поддерева, не мешают: там между ними и их
  // объявлением наше уже не влезет.
  for (const entry of references) {
    if (entry.name !== to || !inside(entry.scope, scope)) continue;
    if (entry.resolved && inside(entry.resolved.scope, scope)) continue;
    const where = entry.resolved ? 'снаружи области' : 'вообще не в этом модуле';
    return refuse(`«${to}» уже используется в стр. ${entry.line}, а объявлено ${where}`);
  }

  // (в) Затенение на месте использования: обратный случай. Ссылка на нашу
  // переменную стоит внутри области, где `to` уже объявлен, — значит, после
  // переименования она попадёт в чужое объявление, а не в наше.
  for (const entry of binding.references) {
    for (let current = entry.scope; current && current !== scope; current = current.parent) {
      const shadow = current.bindings.get(to);
      if (shadow) {
        return refuse(`ссылка в стр. ${entry.line} попадёт в «${to}» из ${current.label}`);
      }
    }
  }

  // (г) Прямой eval. Он получает область целиком и может обратиться к любому
  // имени строкой, которой в тексте нет. Единственный корректный ответ —
  // отказаться: см. limits-of-analysis.md в примерах раздела.
  const directEval = references.find(
    (entry) => entry.name === 'eval' && !entry.resolved && inside(entry.scope, scope),
  );
  if (directEval) return refuse(`в стр. ${directEval.line} прямой eval — область видна ему целиком`);

  // Проверки пройдены, дальше правка текста.
  //
  // Сокращённая запись свойства — единственное место, где идентификатор
  // работает сразу и полем объекта, и переменной. Заменять его целиком нельзя:
  // сломается форма объекта, а не только имя переменной. Нужно раскрыть
  // сокращение: `{ count }` → `{ count: hits }`.
  const shorthandStarts = new Set();
  const noteShorthand = (property) => {
    // У сокращённого свойства key и value — разные узлы с одинаковыми
    // позициями, поэтому сравнивать их приходится по start.
    if (property.shorthand) shorthandStarts.add(property.value.start);
  };
  walk.simple(ast, {
    Property: noteShorthand,
    // Внутрь Property шаблонов acorn-walk не заходит: у ObjectPattern он сразу
    // спускается в prop.value. Значит, `const { count } = obj` обработчиком
    // Property не поймать, и свойства шаблона нужно перебрать самому.
    ObjectPattern(node) {
      for (const property of node.properties) if (property.type === 'Property') noteShorthand(property);
    },
  });

  const occurrences = [binding.node, ...binding.references.map((entry) => entry.node)];

  const edits = occurrences.map((node) => ({
    start: node.start,
    end: node.end,
    // Ключ остаётся старым именем: это имя поля, к переменной оно не относится.
    text: shorthandStarts.has(node.start) ? `${name}: ${to}` : to,
  }));

  // С конца к началу: иначе первая замена сдвинет позиции всех следующих.
  edits.sort((left, right) => right.start - left.start);

  let code = source;
  for (const edit of edits) {
    code = code.slice(0, edit.start) + edit.text + code.slice(edit.end);
  }

  return { ok: true, code };
}
