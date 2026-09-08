// Заготовка для лабы «Допиши лексер».
//
// Готово: пробелы, комментарии, строки, шаблоны одним куском, имена и ключевые
// слова, знаки операторов, флаг newlineBefore.
//
// Сделать нужно три вещи, помеченные ниже как TODO:
//   1. числа во всех формах;
//   2. приватные имена (#value одним токеном);
//   3. решение «регулярка или деление».
//
//   node 02-lexing-parsing-ast/labs/01-finish-the-lexer/check.mjs
//
// Токен выглядит так:
//   { type, value, start, end, line, newlineBefore }
// где type — одно из: 'keyword', 'name', 'number', 'string', 'template',
// 'regexp', 'private', 'punctuator'. Поле value — исходный текст токена.

const PUNCTUATORS = [
  '>>>=',
  '...', '===', '!==', '**=', '<<=', '>>=', '>>>', '&&=', '||=', '??=',
  '=>', '==', '!=', '<=', '>=', '&&', '||', '??', '?.', '++', '--',
  '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '**', '<<', '>>',
  '{', '}', '(', ')', '[', ']', ';', ',', '<', '>', '+', '-', '*', '/',
  '%', '&', '|', '^', '!', '~', '?', ':', '=', '.', '#',
].sort((a, b) => b.length - a.length);

const RESERVED = new Set([
  'var', 'const', 'function', 'return', 'if', 'else', 'for', 'while', 'do', 'new',
  'typeof', 'instanceof', 'in', 'delete', 'void', 'class', 'extends', 'this', 'super',
  'try', 'catch', 'finally', 'throw', 'switch', 'case', 'default', 'break', 'continue',
  'null', 'true', 'false',
]);

/**
 * TODO 3. Разрешено ли в этой позиции начало регулярного выражения?
 *
 * Сейчас функция всегда отвечает «да», и лексер видит регулярку в каждом делении.
 *
 * Общее правило: регулярка допустима там, где ожидается значение, и недопустима
 * там, где предыдущий токен сам был значением (число, строка, имя, `]`, `++`).
 * После ключевого слова обычно ожидается значение — но не после this, super,
 * null, true, false.
 *
 * Отдельный случай — закрывающая круглая скобка. Она бывает и тем, и другим:
 *
 *   const mid = (a + b) / 2;      деление
 *   if (ready) /^\d+$/.test(s);   регулярка
 *
 * Различить эти два случая по одному предыдущему токену нельзя: нужно помнить,
 * что за скобку закрыли. Для этого пригодится стек — смотри TODO рядом
 * с разбором знаков в конце файла.
 *
 * @param {object | undefined} previous предыдущий токен, если он есть
 */
function regexAllowedAfter(previous) {
  return true;
}

export function tokenize(source) {
  const tokens = [];
  const comments = [];
  let index = 0;
  let lineNumber = 1;
  let newlineBefore = false;

  const push = (type, value, start, extra = {}) => {
    tokens.push({ type, value, start, end: index, line: lineNumber, newlineBefore, ...extra });
    newlineBefore = false;
  };

  while (index < source.length) {
    const char = source[index];

    if (char === '\n') {
      lineNumber += 1;
      newlineBefore = true;
      index += 1;
      continue;
    }
    if (/\s/.test(char)) {
      index += 1;
      continue;
    }

    if (char === '/' && source[index + 1] === '/') {
      const start = index;
      while (index < source.length && source[index] !== '\n') index += 1;
      comments.push({ type: 'line', value: source.slice(start, index), line: lineNumber });
      continue;
    }
    if (char === '/' && source[index + 1] === '*') {
      const start = index;
      index += 2;
      while (index < source.length && !(source[index] === '*' && source[index + 1] === '/')) {
        if (source[index] === '\n') {
          lineNumber += 1;
          newlineBefore = true;
        }
        index += 1;
      }
      index += 2;
      comments.push({ type: 'block', value: source.slice(start, index), line: lineNumber });
      continue;
    }

    if (char === '"' || char === "'") {
      const start = index;
      index += 1;
      while (index < source.length && source[index] !== char) {
        index += source[index] === '\\' ? 2 : 1;
      }
      index += 1;
      push('string', source.slice(start, index), start);
      continue;
    }

    // Шаблон берётся одним куском: честно разобрать ${...} без парсера нельзя,
    // там лежит произвольное выражение. В этой лабе шаблоны не проверяются.
    if (char === '`') {
      const start = index;
      index += 1;
      while (index < source.length && source[index] !== '`') {
        if (source[index] === '\n') lineNumber += 1;
        index += source[index] === '\\' ? 2 : 1;
      }
      index += 1;
      push('template', source.slice(start, index), start);
      continue;
    }

    // TODO 1. Числа.
    //
    // Нужно узнавать все формы: 0x1f, 0b1010, 0o17, 1_000, .5, 1e-3, 1.5e+10, 10n.
    // Три места, где легко ошибиться, — проверка на них есть в check.mjs:
    //   - знак после экспоненты: в 1e-3 минус часть числа, в 1-3 нет;
    //   - в 1..toString() первая точка принадлежит числу, вторая уже нет;
    //   - в 0x1f.toString() точка числу не принадлежит вообще.
    //
    // if (…) {
    //   push('number', …);
    //   continue;
    // }

    // TODO 2. Приватные имена.
    //
    // `#value` — один токен типа 'private', а не '#' плюс имя. Сейчас `#`
    // разбирается как знак операции в конце функции, и поток расходится с acorn.

    if (/[\p{ID_Start}$_]/u.test(char)) {
      const start = index;
      while (index < source.length && /[\p{ID_Continue}$]/u.test(source[index])) index += 1;
      const value = source.slice(start, index);
      push(RESERVED.has(value) ? 'keyword' : 'name', value, start);
      continue;
    }

    if (char === '/' && regexAllowedAfter(tokens.at(-1))) {
      const start = index;
      index += 1;
      let inClass = false;
      while (index < source.length) {
        const current = source[index];
        if (current === '\\') {
          index += 2;
          continue;
        }
        if (current === '[') inClass = true;
        else if (current === ']') inClass = false;
        else if (current === '/' && !inClass) break;
        else if (current === '\n') break;
        index += 1;
      }
      index += 1;
      while (index < source.length && /[a-z]/.test(source[index])) index += 1;
      push('regexp', source.slice(start, index), start);
      continue;
    }

    const punctuator = PUNCTUATORS.find((candidate) => source.startsWith(candidate, index));
    if (punctuator) {
      const start = index;
      index += punctuator.length;
      // TODO 3 (продолжение). Здесь удобно вести стек круглых скобок: на каждой
      // `(` запоминать, стояло ли перед ней if/while/for/with, а на `)` снимать
      // это со стека и записывать в токен — например, в поле afterControlHead.
      // Тогда regexAllowedAfter сможет отличить голову инструкции от выражения
      // в скобках.
      push('punctuator', punctuator, start);
      continue;
    }

    throw new SyntaxError(`Неожиданный символ ${JSON.stringify(char)} на позиции ${index}`);
  }

  return { tokens, comments };
}
