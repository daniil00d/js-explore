// Разбор лабы «Распространение констант».
//
// Это абстрактная интерпретация в самом простом виде: программа выполняется
// один раз, но не на значениях, а на их описаниях. Описаний три вида — «ещё
// ничего не знаем», конкретная константа и ⊤ «может быть что угодно». Правило,
// из которого всё следует: ⊤ — всегда допустимый ответ, а вот назвать
// константой то, что ей не является, нельзя ни при каких обстоятельствах.
//
// Отсюда и весь остальной код: каждый раз, когда информации не хватает, мы
// отдаём ⊤ и идём дальше. Три места, где это происходит, и есть содержание
// лабы: слияние путей, циклы и замыкания.

import { parse } from 'acorn';
import * as walk from 'acorn-walk';

export const TOP = Symbol('⊤');

const constant = (value) => ({ value });
const isConstant = (item) => item !== undefined && item !== TOP;

export function describe(item) {
  if (!isConstant(item)) return '⊤';
  if (typeof item.value === 'string') return JSON.stringify(item.value);
  return String(item.value);
}

const BINARY = {
  '+': (a, b) => a + b,
  '-': (a, b) => a - b,
  '*': (a, b) => a * b,
  '/': (a, b) => a / b,
  '%': (a, b) => a % b,
  '**': (a, b) => a ** b,
  '==': (a, b) => a == b, // eslint-disable-line eqeqeq
  '===': (a, b) => a === b,
  '!=': (a, b) => a != b, // eslint-disable-line eqeqeq
  '!==': (a, b) => a !== b,
  '<': (a, b) => a < b,
  '>': (a, b) => a > b,
  '<=': (a, b) => a <= b,
  '>=': (a, b) => a >= b,
};

const UNARY = {
  '-': (a) => -a,
  '+': (a) => +a,
  '!': (a) => !a,
  typeof: (a) => typeof a,
};

/** Слияние путей: одно описание на переменную, а путей два. */
function merge(left, right) {
  if (left === undefined) return right;
  if (right === undefined) return left;
  if (left === TOP || right === TOP) return TOP;
  // Object.is, а не ===, чтобы не склеить 0 и -0 и не потерять NaN.
  return Object.is(left.value, right.value) ? left : TOP;
}

/** Абстрактное вычисление выражения: описание значения, а не значение. */
function evaluate(node, env, context) {
  switch (node.type) {
    case 'Literal':
      return constant(node.value);

    case 'Identifier':
      // Незнакомое имя — параметр, глобальный объект, переменная из модуля.
      // Про такие мы честно ничего не знаем.
      return env.get(node.name) ?? TOP;

    case 'BinaryExpression': {
      const left = evaluate(node.left, env, context);
      const right = evaluate(node.right, env, context);
      const apply = BINARY[node.operator];
      if (!apply || !isConstant(left) || !isConstant(right)) return TOP;
      return constant(apply(left.value, right.value));
    }

    case 'UnaryExpression': {
      const argument = evaluate(node.argument, env, context);
      const apply = UNARY[node.operator];
      if (!apply || !isConstant(argument)) return TOP;
      return constant(apply(argument.value));
    }

    case 'LogicalExpression': {
      const left = evaluate(node.left, env, context);
      if (!isConstant(left)) return TOP;
      if (node.operator === '&&') return left.value ? evaluate(node.right, env, context) : left;
      if (node.operator === '||') return left.value ? left : evaluate(node.right, env, context);
      return left.value === null || left.value === undefined ? evaluate(node.right, env, context) : left;
    }

    default:
      // Вызовы, обращения к полям, литералы объектов и массивов. Это не лень:
      // `obj.field` может быть геттером, вызов — вернуть что угодно, а объект
      // литералом не запишешь. См. analysis-killers.mjs.
      return TOP;
  }
}

/** Запись в переменную. Волатильные имена остаются ⊤ навсегда. */
function assign(name, item, env, context) {
  env.set(name, context.volatile.has(name) ? TOP : item);
}

/** Имена, которым присваивает что-нибудь внутри узла. */
function assignedNames(node) {
  const names = new Set();
  walk.simple(node, {
    AssignmentExpression(assignment) {
      if (assignment.left.type === 'Identifier') names.add(assignment.left.name);
    },
    UpdateExpression(update) {
      if (update.argument.type === 'Identifier') names.add(update.argument.name);
    },
  });
  return names;
}

/**
 * Имена, которые меняет вложенная функция. Когда это случится — при вызове, в
 * колбэке, через год из таймера — статически неизвестно, поэтому ⊤ с самого
 * начала. Ровно об этот случай спотыкается интуиция «const же, значит, константа».
 */
function volatileNames(functionNode) {
  const nested = [];
  const collect = (node) => nested.push(node);
  walk.simple(functionNode.body, {
    FunctionDeclaration: collect,
    FunctionExpression: collect,
    ArrowFunctionExpression: collect,
  });
  const names = new Set();
  for (const inner of nested) {
    for (const name of assignedNames(inner)) names.add(name);
  }
  return names;
}

function runStatements(statements, env, context) {
  for (const statement of statements) runStatement(statement, env, context);
}

function runStatement(node, env, context) {
  switch (node.type) {
    case 'VariableDeclaration':
      for (const declarator of node.declarations) {
        if (declarator.id.type !== 'Identifier') {
          // Деструктуризация: имена есть, значения мы не считаем.
          for (const name of declaredPatternNames(declarator.id)) assign(name, TOP, env, context);
          continue;
        }
        // `let x;` — это тоже константа, просто undefined.
        const value = declarator.init ? evaluate(declarator.init, env, context) : constant(undefined);
        assign(declarator.id.name, value, env, context);
      }
      return;

    case 'ExpressionStatement':
      runExpression(node.expression, env, context);
      return;

    case 'BlockStatement':
      runStatements(node.body, env, context);
      return;

    case 'IfStatement': {
      const test = evaluate(node.test, env, context);

      // Условие известно — вторая ветка в программе не участвует. Это то же
      // самое, что делает минификатор с `if (DEBUG)`, и то же, что SCCP делает
      // на графе: невыполнимое ребро просто не рассматривается.
      if (isConstant(test)) {
        const taken = test.value ? node.consequent : node.alternate;
        if (taken) runStatement(taken, env, context);
        return;
      }

      const thenEnv = new Map(env);
      runStatement(node.consequent, thenEnv, context);
      const elseEnv = new Map(env);
      if (node.alternate) runStatement(node.alternate, elseEnv, context);

      for (const name of new Set([...thenEnv.keys(), ...elseEnv.keys()])) {
        env.set(name, merge(thenEnv.get(name), elseEnv.get(name)));
      }
      return;
    }

    case 'WhileStatement':
    case 'DoWhileStatement':
    case 'ForStatement':
    case 'ForInStatement':
    case 'ForOfStatement':
      // Приближение: тело может выполниться ноль раз, один или миллион, и на
      // каждом витке значения свои. Всё, чему цикл присваивает, становится ⊤.
      // Точнее — итерацией до неподвижной точки, см. dataflow-primer.md.
      for (const name of assignedNames(node)) assign(name, TOP, env, context);
      return;

    case 'SwitchStatement':
      // Тот же приём, что с циклом, только причина другая: путей столько,
      // сколько case, плюс провалы между ними.
      for (const name of assignedNames(node)) assign(name, TOP, env, context);
      return;

    case 'TryStatement':
      for (const name of assignedNames(node)) assign(name, TOP, env, context);
      return;

    default:
      // return, throw, объявления функций и классов: на описания переменных
      // они не влияют.
      return;
  }
}

function runExpression(node, env, context) {
  if (node.type === 'AssignmentExpression' && node.left.type === 'Identifier') {
    const name = node.left.name;
    if (node.operator === '=') {
      assign(name, evaluate(node.right, env, context), env, context);
      return;
    }
    const apply = BINARY[node.operator.slice(0, -1)];
    const current = env.get(name);
    const right = evaluate(node.right, env, context);
    const value = apply && isConstant(current) && isConstant(right) ? constant(apply(current.value, right.value)) : TOP;
    assign(name, value, env, context);
    return;
  }

  if (node.type === 'UpdateExpression' && node.argument.type === 'Identifier') {
    const name = node.argument.name;
    const current = env.get(name);
    const value = isConstant(current)
      ? constant(node.operator === '++' ? current.value + 1 : current.value - 1)
      : TOP;
    assign(name, value, env, context);
    return;
  }

  if (node.type === 'SequenceExpression') {
    for (const expression of node.expressions) runExpression(expression, env, context);
    return;
  }

  // Вызов может изменить что угодно снаружи — но только через замыкание, а
  // такие имена уже помечены волатильными. Локальные переменные функции вызов
  // изменить не может, и это единственное, на чём здесь всё держится.
}

/** Имена из шаблона деструктуризации — без значений. */
function declaredPatternNames(pattern) {
  const names = new Set();
  const visit = (node) => {
    if (!node) return;
    if (node.type === 'Identifier') names.add(node.name);
    else if (node.type === 'ObjectPattern') for (const property of node.properties) visit(property.value ?? property.argument);
    else if (node.type === 'ArrayPattern') for (const element of node.elements) visit(element);
    else if (node.type === 'AssignmentPattern') visit(node.left);
    else if (node.type === 'RestElement') visit(node.argument);
  };
  visit(pattern);
  return names;
}

/**
 * @param {string} source текст модуля
 * @returns {Array<{ line: number, name: string, value: string }>}
 */
export function analyze(source) {
  const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module', locations: true });

  const functions = [];
  const collect = (node) => functions.push(node);
  walk.simple(ast, {
    FunctionDeclaration: collect,
    FunctionExpression: collect,
    ArrowFunctionExpression: collect,
  });

  const found = [];

  for (const node of functions) {
    if (node.body.type !== 'BlockStatement') continue;

    const context = { volatile: volatileNames(node) };
    const env = new Map();

    runStatements(node.body.body, env, context);

    // Отчитываемся только про объявления верхнего уровня тела функции: то, что
    // объявлено внутри блока или цикла, живёт своей жизнью и до выхода из
    // функции не доживает.
    for (const statement of node.body.body) {
      if (statement.type !== 'VariableDeclaration') continue;
      for (const declarator of statement.declarations) {
        if (declarator.id.type !== 'Identifier') continue;
        found.push({
          line: declarator.id.loc.start.line,
          name: declarator.id.name,
          value: describe(env.get(declarator.id.name)),
        });
      }
    }
  }

  return found.sort((left, right) => left.line - right.line);
}
