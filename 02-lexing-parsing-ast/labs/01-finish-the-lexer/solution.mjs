// Эталонное решение лабы «Допиши лексер».
//
// Отличия от заготовки — три места, помеченные там как TODO:
//   1. разбор чисел;
//   2. приватные имена;
//   3. решение «регулярка или деление», включая стек скобок.

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

// После этих ключевых слов идёт значение, а не оператор, поэтому `/` после них —
// это деление, а не начало регулярного выражения.
const VALUE_KEYWORDS = new Set(['this', 'super', 'null', 'true', 'false']);

// Скобка после этих слов открывает голову инструкции: `if (x) /re/.test(s)` —
// законный код, и `/` там начинает регулярку.
const CONTROL_KEYWORDS = new Set(['if', 'while', 'for', 'with']);

/**
 * Решение №3: разрешено ли в этой позиции начало регулярного выражения.
 *
 * Правило простое: регулярка допустима там, где ожидается значение, и не
 * допустима там, где предыдущий токен сам был значением. Тонкость в закрывающей
 * скобке — она бывает и тем, и другим:
 *
 *   const mid = (a + b) / 2;      → деление
 *   if (ready) /^\d+$/.test(s);   → регулярка
 *
 * Различить их можно, только помня, что за скобку закрыли. Для этого лексер
 * ведёт стек: на каждой `(` он запоминает, стояло ли перед ней if/while/for/with.
 */
function regexAllowedAfter(previous) {
  if (!previous) return true;

  switch (previous.type) {
    case 'number':
    case 'string':
    case 'template':
    case 'regexp':
    case 'name':
    case 'private':
      return false;
    case 'keyword':
      return !VALUE_KEYWORDS.has(previous.value);
    default:
      if (previous.value === ')') return previous.afterControlHead === true;
      // Закрывающая фигурная скобка — принципиально неразрешимый случай:
      // после блока регулярка допустима, после объектного литерала нет,
      // а различить их без парсера нельзя. Считаем, что был блок.
      if (previous.value === '}') return true;
      return ![']', '++', '--'].includes(previous.value);
  }
}

export function tokenize(source) {
  const tokens = [];
  const comments = [];
  let index = 0;
  let lineNumber = 1;
  let newlineBefore = false;

  // Стек открытых круглых скобок: для каждой помним, была ли она головой
  // инструкции. Нужен ровно для одного решения — про `/` после `)`.
  const parenStack = [];

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

    // Решение №1: числа.
    //
    // Форм много: 0x1f, 0b1010, 0o17, 1_000, .5, 1e-3, 1.5e+10, 10n. Проще всего
    // разделить их на два случая — с префиксом системы счисления и без него,
    // потому что правила про точку и экспоненту действуют только во втором.
    if (/[0-9]/.test(char) || (char === '.' && /[0-9]/.test(source[index + 1] ?? ''))) {
      const start = index;
      const radixPrefixed = char === '0' && /[xXoObB]/.test(source[index + 1] ?? '');

      if (radixPrefixed) {
        // У 0x1f дробной части быть не может, поэтому точка в 0x1f.toString()
        // числу не принадлежит.
        index += 2;
        while (index < source.length && /[0-9a-fA-F_]/.test(source[index])) index += 1;
      } else {
        let seenDot = false;
        while (index < source.length) {
          const current = source[index];
          if (/[0-9_]/.test(current)) {
            index += 1;
            continue;
          }
          // Точка в числе может быть только одна. Поэтому в 1..toString()
          // первая точка — часть числа, а вторая уже обращение к свойству.
          if (current === '.' && !seenDot) {
            seenDot = true;
            index += 1;
            continue;
          }
          // Знак принадлежит числу только сразу после e/E: в 1e-3 да, в 1-3 нет.
          if (/[eE]/.test(current) && /[0-9+-]/.test(source[index + 1] ?? '')) {
            index += 2;
            continue;
          }
          break;
        }
      }

      if (source[index] === 'n') index += 1; // суффикс BigInt
      push('number', source.slice(start, index), start);
      continue;
    }

    // Решение №2: приватные имена.
    //
    // `#` не самостоятельный оператор: он всегда часть имени поля. Поэтому
    // токен один — '#value', а не '#' плюс 'value'. Так же поступает acorn.
    if (char === '#' && /[\p{ID_Start}$_]/u.test(source[index + 1] ?? '')) {
      const start = index;
      index += 1;
      while (index < source.length && /[\p{ID_Continue}$]/u.test(source[index])) index += 1;
      push('private', source.slice(start, index), start);
      continue;
    }

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
      const previous = tokens.at(-1);
      index += punctuator.length;

      if (punctuator === '(') {
        parenStack.push(previous?.type === 'keyword' && CONTROL_KEYWORDS.has(previous.value));
        push('punctuator', punctuator, start);
      } else if (punctuator === ')') {
        push('punctuator', punctuator, start, { afterControlHead: parenStack.pop() === true });
      } else {
        push('punctuator', punctuator, start);
      }
      continue;
    }

    throw new SyntaxError(`Неожиданный символ ${JSON.stringify(char)} на позиции ${index}`);
  }

  return { tokens, comments };
}
