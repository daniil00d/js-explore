// Проверка лабы: поток токенов сверяется с тем, что выдаёт настоящий лексер acorn.
//
//   node 02-lexing-parsing-ast/labs/01-finish-the-lexer/check.mjs
//   node 02-lexing-parsing-ast/labs/01-finish-the-lexer/check.mjs --solution

import * as acorn from 'acorn';
import { equals, labTarget, report } from '../../../tools/lab.mjs';
import { truncate } from '../../../tools/format.mjs';

const { tokenize } = await import(labTarget(import.meta.url, 'tokens.mjs'));

/** Словарь типов acorn переводится в словарь нашего лексера. */
function kindOf(token) {
  if (token.type.keyword) return 'keyword';
  switch (token.type.label) {
    case 'name':
      return 'name';
    case 'num':
      return 'number';
    case 'string':
      return 'string';
    case 'regexp':
      return 'regexp';
    case 'privateId':
      return 'private';
    case 'eof':
      return null;
    default:
      return 'punctuator';
  }
}

/** Эталонный поток: тип плюс исходный текст токена. */
function reference(source) {
  const tokens = [];
  let previousEnd = 0;
  for (const token of acorn.tokenizer(source, { ecmaVersion: 'latest' })) {
    const kind = kindOf(token);
    if (kind === null) break;
    tokens.push({
      type: kind,
      value: source.slice(token.start, token.end),
      newlineBefore: /[\n\r\u2028\u2029]/.test(source.slice(previousEnd, token.start)),
    });
    previousEnd = token.end;
  }
  return tokens;
}

const ours = (source) =>
  tokenize(source).tokens.map(({ type, value, newlineBefore }) => ({ type, value, newlineBefore }));

const SNIPPETS = [
  ['простое выражение', 'const total = 1 + 2;'],
  ['числа во всех формах', 'const nums = [0x1f, 1_000, .5, 1e-3, 10n, 0b1010, 0o17, 1.5e+10];'],
  ['точка после числа', 'const text = 1..toString();'],
  ['приватные поля', 'class Counter { #value = 0; static #count = 0; bump() { return this.#value; } }'],
  ['приватное поле и деление', 'class Box { #size = 4; half() { return this.#size / 2; } }'],
  ['деление и регулярка рядом', 'const half = width / 2; const re = /ab+c/gi; const q = index++ / 2;'],
  ['регулярка после if', 'if (ready) /^\\d+$/.test(input);'],
  ['деление после скобки', 'const mid = (a + b) / 2;'],
  ['регулярка после while', 'while (queue.length) /x/.test(queue.pop());'],
  ['вложенные скобки', 'if (check((a + b) / 2)) /y/.test(z);'],
  ['экранированный слеш в регулярке', 'const division = total/count, regex = /a\\/b/g;'],
  ['класс символов с слешем', 'const re = /[/]/g; const value = count / 2;'],
  ['контекстные слова как имена', 'var let = 1; const of = 2; for (const item of list) log(item);'],
  ['строки с экранированием', "const s = 'a\\'b' + \"c\\\\d\";"],
  ['длинные операторы', 'a ??= b; c ||= d; e **= 2; x >>>= 1; y = f?.g ?? h;'],
  ['комментарии', '// строка\n/* блок */ const a = 1; // хвост'],
  ['переносы строк', 'let x = 1\ny = 2\nz = 3'],
  ['цепочка вызовов через перенос', 'const bytes = data\n  .filter(Boolean)\n  .map((byte) => byte / 255);'],
  ['блочный комментарий с переносом', 'let a = 1 /* тут\nперенос */\nlet b = 2'],
];

const outcome = (source) => {
  try {
    return ours(source);
  } catch (error) {
    return `${error.constructor.name}: ${truncate(error.message, 40)}`;
  }
};

report(
  'Лаба 02-1: допиши лексер',
  SNIPPETS.map(([name, source]) =>
    equals(
      name,
      reference(source),
      outcome(source),
      'Сравни свой поток с acorn построчно: node -e "console.log([...require(\'acorn\').tokenizer(код)])".',
    ),
  ),
);
