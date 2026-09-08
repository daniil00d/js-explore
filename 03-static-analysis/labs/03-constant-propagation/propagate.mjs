// Заготовка для лабы «Распространение констант».
//
// Нужно реализовать analyze(source): пройти по функции, считая не значения, а
// их описания, и сказать про каждую переменную верхнего уровня тела функции,
// известно ли её значение на выходе.
//
//   node 03-static-analysis/labs/03-constant-propagation/check.mjs
//
// Ответ — список по одной записи на объявление, отсортированный по строке:
//
//   [{ line: 4, name: 'base', value: '10' }, { line: 7, name: 'scaled', value: '⊤' }]
//
// Форматированием заниматься не надо: значение печатает готовая describe().

import { parse } from 'acorn';
import * as walk from 'acorn-walk';

/** «Может быть что угодно». Всегда допустимый ответ — в отличие от неверной константы. */
export const TOP = Symbol('⊤');

const constant = (value) => ({ value });
const isConstant = (item) => item !== undefined && item !== TOP;

/** Печать описания: строки в кавычках, ⊤ значком. Это же формат в фикстурах. */
export function describe(item) {
  if (!isConstant(item)) return '⊤';
  if (typeof item.value === 'string') return JSON.stringify(item.value);
  return String(item.value);
}

/** Операторы — механическая часть, она уже готова. */
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

/**
 * Объединение двух описаний в точке слияния путей.
 *
 * TODO 1. Правила такие:
 *   - если одна сторона ещё ничего не знает (undefined) — берём другую;
 *   - если хоть одна ⊤ — результат ⊤;
 *   - одинаковые константы дают ту же константу, разные — ⊤.
 *
 * Именно здесь анализ теряет точность, и по-другому нельзя: одно описание на
 * переменную, а путей два.
 */
function merge(left, right) {
  return TOP;
}

/**
 * Абстрактное вычисление выражения: возвращает описание, а не значение.
 *
 * TODO 2. Разобрать хотя бы это:
 *   - Literal — константа (`node.value`);
 *   - Identifier — то, что лежит в env; ничего не лежит → ⊤;
 *   - BinaryExpression и UnaryExpression — считаем, только если известны все
 *     операнды, иначе ⊤ (таблицы BINARY и UNARY выше);
 *   - всё остальное (вызовы, обращения к полям, литералы объектов) → ⊤.
 *
 * Последнее правило — не лень, а корректность: `obj.field` может оказаться
 * геттером, а вызов — вернуть что угодно. Подробности в analysis-killers.mjs.
 */
function evaluate(node, env) {
  return TOP;
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

    /** @type {Map<string, object|symbol>} описания переменных в текущей точке */
    const env = new Map();

    // TODO 3. Имена, которые меняет вложенная функция. Такое присваивание может
    // случиться в любой момент — при вызове, в колбэке, когда-нибудь потом, —
    // поэтому единственный корректный ответ про них ⊤ с самого начала.
    //
    // Найти их можно обходом тела: внутри вложенных функций собрать цели
    // AssignmentExpression и UpdateExpression.
    const volatile = new Set();

    // TODO 4. Пройти по инструкциям тела, обновляя env:
    //
    //   - VariableDeclaration: env.set(имя, evaluate(init, env));
    //     без init значение undefined — это тоже константа;
    //   - присваивание `x = ...`: env.set(имя, evaluate(right, env));
    //     составное `x += ...` считается через BINARY от текущего описания;
    //   - IfStatement: если условие известно, разбираем только нужную ветку;
    //     если нет — обе, каждую на своей копии env, и потом merge;
    //   - цикл: тело может выполниться сколько угодно раз, поэтому всё, чему
    //     цикл присваивает, становится ⊤. Точнее считать можно, но это уже
    //     итерация до неподвижной точки — см. dataflow-primer.md;
    //   - остальное на env не влияет.

    // TODO 5. Собрать ответ: по одной записи на объявление верхнего уровня тела
    // функции (объявления внутри блоков, циклов и вложенных функций не наши),
    // значение — describe(env.get(имя)).
  }

  return found.sort((left, right) => left.line - right.line);
}
