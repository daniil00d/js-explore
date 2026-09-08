# Инструменты статического трека

Для разделов 02–07 нужен не движок, а библиотеки, которые умеют разбирать код в дерево и
работать с ним как с данными. Здесь — что ставить, чем они отличаются и на какие грабли
наступаешь в первые пять минут.

Всё проверено на `node v22.14.0`.

## Парсеры

```bash
npm install acorn acorn-walk @babel/parser @babel/traverse @babel/generator
```

**acorn** — маленький парсер, выдающий чистый [ESTree](https://github.com/estree/estree).
Хорош, когда нужно понять форму дерева без лишних сущностей.

```js
import * as acorn from 'acorn';
import * as walk from 'acorn-walk';

const ast = acorn.parse('const answer = 42; function add(a, b) { return a + b; }', {
  ecmaVersion: 'latest',
  sourceType: 'module',
});
// VariableDeclaration, FunctionDeclaration
console.log(ast.body.map((node) => node.type).join(', '));

walk.simple(ast, { FunctionDeclaration: (node) => console.log(node.id.name) });
```

**@babel/parser** — то же ESTree, но с расширениями (JSX, TypeScript, экспериментальный
синтаксис) и с полноценным обходом через `@babel/traverse`, который даёт пути (`path`),
scope и умеет менять дерево на месте.

```js
import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';

// В ESM у пакетов Babel настоящая функция лежит в .default — типичная ловушка.
const traverse = _traverse.default ?? _traverse;

const ast = parse('const answer = 42;', { sourceType: 'module' });
traverse(ast, { Identifier: (path) => console.log(path.node.name) });
```

## TypeScript как библиотека

Здесь главная ловушка всего списка. `npm install typescript` сейчас ставит **7.x** —
переписанный на Go компилятор, у которого из главной точки входа экспортируются только
`version` и `versionMajorMinor`:

```js
import ts from 'typescript';
console.log(ts.version);            // 7.0.2
console.log(ts.createSourceFile);   // undefined
```

Классический compiler API в семёрке переехал под отдельные подпути:

```js
import * as ast from 'typescript/unstable/ast';    // SyntaxKind, ScriptTarget, NodeFlags, ...
import * as sync from 'typescript/unstable/sync';  // API, Checker, Emitter, ...
```

Слово `unstable` в пути стоит не для красоты, поэтому для учебных примеров проще
зафиксировать пятую версию:

```bash
npm install typescript@5 ts-morph
```

```js
import ts from 'typescript';

const source = ts.createSourceFile('x.ts', 'const n: number = 1;', ts.ScriptTarget.Latest, true);
console.log(ts.SyntaxKind[source.statements[0].kind]);
```

**ts-morph** — обёртка над тем же API с человеческим интерфейсом: проект, файлы, символы,
переименования. Для кодмодов по TypeScript удобнее, чем голый compiler API.

## Линтеры и кодмоды (раздел 04)

```bash
npm install eslint @typescript-eslint/parser typescript-eslint
npm install jscodeshift recast
```

- `eslint` нужен вместе с `RuleTester` — правила без тестов писать бессмысленно.
- `recast` печатает изменённое дерево, сохраняя исходное форматирование нетронутых мест;
  `@babel/generator` печатает заново по своим правилам. Для кодмода почти всегда нужен
  первый.

## Транспиляторы и сборщики (разделы 06–07)

```bash
npm install esbuild @swc/core rollup terser
```

Эти пакеты тянут бинарники под платформу — они большие и ставятся дольше остальных.
`esbuild` и `swc` полезны не только как инструменты, но и как объект сравнения: одинаковый
вход, разное время и разный результат.

## Без установки

- [AST Explorer](https://astexplorer.net) — сравнить деревья десятка парсеров на одном коде,
  первое, что стоит открыть в разделе 02.
- [TypeScript Playground](https://www.typescriptlang.org/play) — вывод типов и результат
  компиляции рядом.
- [Babel REPL](https://babeljs.io/repl) — во что превращается синтаксис при downleveling.
- [Compiler Explorer](https://godbolt.org/) — умеет и JS-движки, полезен для раздела 11.
