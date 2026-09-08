// Мини-лексер для примеров раздела: превращает текст в поток токенов.
//
// Умышленно неполон — где именно, разобрано в tokenize.mjs. Отдельным модулем он
// нужен, чтобы им мог пользоваться и разбор выражений в precedence.mjs.

const PUNCTUATORS = [
  '>>>=',
  '...', '===', '!==', '**=', '<<=', '>>=', '>>>', '&&=', '||=', '??=',
  '=>', '==', '!=', '<=', '>=', '&&', '||', '??', '?.', '++', '--',
  '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '**', '<<', '>>',
  '{', '}', '(', ')', '[', ']', ';', ',', '<', '>', '+', '-', '*', '/',
  '%', '&', '|', '^', '!', '~', '?', ':', '=', '.', '#',
].sort((a, b) => b.length - a.length);

// Зарезервированные слова: их нельзя использовать как имя ни при каких условиях.
const RESERVED = new Set([
  'var', 'const', 'function', 'return', 'if', 'else', 'for', 'while', 'do', 'new',
  'typeof', 'instanceof', 'in', 'delete', 'void', 'class', 'extends', 'this', 'super',
  'try', 'catch', 'finally', 'throw', 'switch', 'case', 'default', 'break', 'continue',
  'null', 'true', 'false',
]);

/**
 * Разрешено ли в этой позиции начало регулярного выражения.
 * Классическая эвристика: после значения — деление, после оператора — регулярка.
 */
function regexAllowedAfter(previous) {
  if (!previous) return true;
  if (previous.type === 'number' || previous.type === 'string' || previous.type === 'template') return false;
  if (previous.type === 'regexp') return false;
  if (previous.type === 'name') return false;
  if (previous.type === 'keyword') return !['this', 'super', 'null', 'true', 'false'].includes(previous.value);
  return ![')', ']', '}', '++', '--'].includes(previous.value);
}

export function tokenize(source, { allowRegex = true } = {}) {
  const tokens = [];
  const comments = [];
  let index = 0;
  let lineNumber = 1;
  let newlineBefore = false;

  const push = (type, value, start) => {
    tokens.push({ type, value, start, end: index, line: lineNumber, newlineBefore });
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
        if (source[index] === '\n') lineNumber += 1;
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

    // Шаблонная строка берётся одним куском: разобрать ${...} внутри честно
    // нельзя без парсера — там лежит произвольное выражение, вплоть до нового шаблона.
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

    if (/[0-9]/.test(char) || (char === '.' && /[0-9]/.test(source[index + 1] ?? ''))) {
      const start = index;
      while (index < source.length && /[0-9a-fA-FxXoObBnN._eE+-]/.test(source[index])) {
        const isSign = source[index] === '+' || source[index] === '-';
        if (isSign && !/[eE]/.test(source[index - 1])) break;
        if (source[index] === '.' && source[index + 1] === '.') break;
        index += 1;
      }
      push('number', source.slice(start, index), start);
      continue;
    }

    if (/[\p{ID_Start}$_]/u.test(char)) {
      const start = index;
      while (index < source.length && /[\p{ID_Continue}$]/u.test(source[index])) index += 1;
      const value = source.slice(start, index);
      const type = RESERVED.has(value) ? 'keyword' : 'name';
      push(type, value, start);
      continue;
    }

    if (char === '/' && allowRegex && regexAllowedAfter(tokens.at(-1))) {
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
      push('punctuator', punctuator, start);
      continue;
    }

    throw new SyntaxError(`Неожиданный символ ${JSON.stringify(char)} на позиции ${index}`);
  }

  return { tokens, comments };
}
