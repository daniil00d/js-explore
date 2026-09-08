# 02. Лексер, парсер и AST

> Первая настоящая трансформация: из плоского текста получается дерево.

## Зачем это нужно

AST — общий язык всей экосистемы. Линтер, бандлер, минификатор, `tsc`, Babel и сам V8
начинают с одного и того же: превращают строку в дерево. Дальше все различия — в том, что
именно с этим деревом делают. Понимание формы дерева даёт возможность писать собственные
правила и трансформации, а понимание стоимости парсинга объясняет, почему размер бандла
влияет на время старта даже при неисполняемом коде.

## Быстрый старт

```bash
npm install                                              # первый раздел с зависимостями
node 02-lexing-parsing-ast/examples/tokenize.mjs         # из текста получаются токены
node 02-lexing-parsing-ast/examples/lazy-parsing.mjs     # что из этого разбирает V8 и за сколько
```

Дальше — [`examples/README.md`](./examples/README.md) с порядком чтения,
[`examples/ast-formats.md`](./examples/ast-formats.md) как справочник по различиям
деревьев и [`examples/parsing-in-v8.md`](./examples/parsing-in-v8.md) про разбор
внутри движка.

## Что изучаем

- [ ] Лексический анализ: токены, значимые пробелы, комментарии, шаблонные строки
- [ ] Контекстно-зависимая лексика JS: `/` — деление или начало регулярки? `<` в JSX/TS?
- [ ] Рекурсивный спуск и приоритеты операторов (Pratt parsing)
- [ ] Cover grammar: как парсер разбирает `(a, b)` до того, как узнает про `=>`
- [ ] ESTree как де-факто стандарт формы AST; чем от него отличаются AST Babel, SWC, TypeScript
- [ ] Конкретное синтаксическое дерево против абстрактного; сохранение комментариев и позиций
- [ ] Ленивый парсинг и preparser в V8: полный разбор функции откладывается до первого вызова
- [ ] Eager-парсинг и трюк со скобками вокруг функции (`(function(){})`)
- [ ] Кеши компиляции: code cache, снимки, что переиспользуется между запусками
- [ ] Обход дерева: visitor, пути (paths), scope-информация поверх AST
- [ ] Печать кода из дерева: почему это не обратная операция к разбору
- [ ] Error recovery: как парсеры IDE строят дерево из сломанного кода

## Ключевые вопросы для самопроверки

1. Почему одна и та же последовательность символов может быть разными токенами в зависимости
   от предыдущего токена?
2. Что дешевле для старта страницы: один большой файл или много мелких — и при чём тут preparser?
3. Чем `Program` в ESTree отличается от `SourceFile` в TypeScript?
4. Почему для codemod важно сохранять позиции и комментарии, а для компилятора — нет?
5. Как из одной таблицы приоритетов получается правильная вложенность и ассоциативность —
   и почему `-2 ** 2` при этом запрещено?
6. Почему `(function f(){})()` и `void function f(){}()` компилируются по-разному, хотя обе
   вызываются немедленно?
7. Что должен вернуть парсер на недописанном коде, если он работает в редакторе, — и что,
   если он работает в CI?

## Ссылки

### Спецификации и доки

- [ESTree spec](https://github.com/estree/estree) — форма узлов AST
- [ECMA-262: ECMAScript Language Grammar](https://tc39.es/ecma262/#sec-grammar-summary)
- [ECMA-262: Automatic Semicolon Insertion](https://tc39.es/ecma262/#sec-automatic-semicolon-insertion) — правила, которые лексер обязан поддержать
- [Babel parser docs](https://babeljs.io/docs/babel-parser)
- [Babel AST spec](https://github.com/babel/babel/blob/main/packages/babel-parser/ast/spec.md) — расхождения с ESTree, отмеченные явно
- [TypeScript: Using the Compiler API](https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API) — обход `SourceFile`

### Статьи

- [V8: Blazingly fast parsing, part 1 — optimizing the scanner](https://v8.dev/blog/scanner)
- [V8: Blazingly fast parsing, part 2 — lazy parsing](https://v8.dev/blog/preparser)
- [V8: Code caching for JavaScript developers](https://v8.dev/blog/code-caching-for-devs)
- [Douglas Crockford: Top Down Operator Precedence](https://crockford.com/javascript/tdop/tdop.html)
- [Bob Nystrom: Crafting Interpreters — Parsing Expressions](https://craftinginterpreters.com/parsing-expressions.html)

### Инструменты и исходники

- [AST Explorer](https://astexplorer.net) — сравнить AST разных парсеров на одном коде
- [TypeScript AST Viewer](https://ts-ast-viewer.com) — то же для дерева TypeScript
- [Acorn](https://github.com/acornjs/acorn) — маленький читаемый ESTree-парсер
- [Esprima](https://esprima.org/) — классика, хорошая документация формата
- [oxc parser](https://oxc.rs/docs/guide/usage/parser.html) — современный парсер на Rust
- [optimize-js](https://github.com/nolanlawson/optimize-js) — история про трюк со скобками
- [V8 parser sources](https://github.com/v8/v8/tree/main/src/parsing)

## Что лежит в `examples/`

| Файл | Что показывает |
| --- | --- |
| [`tokenize.mjs`](./examples/tokenize.mjs) | Лексер руками; где он обязан спросить парсер про `/` и про `let` |
| [`lexer.mjs`](./examples/lexer.mjs) | Сам мини-лексер отдельным модулем |
| [`parse-with-acorn.mjs`](./examples/parse-with-acorn.mjs) | Дерево, позиции, комментарии, опции разбора |
| [`compare-asts.mjs`](./examples/compare-asts.mjs) | Один код → ESTree, Babel, TypeScript: имена узлов и поля |
| [`precedence.mjs`](./examples/precedence.mjs) | Пратт-парсер, сверенный с acorn; cover grammar |
| [`walk-and-transform.mjs`](./examples/walk-and-transform.mjs) | Обход, области видимости, правка дерева и печать обратно |
| [`error-recovery.mjs`](./examples/error-recovery.mjs) | Что отдают парсеры на сломанном коде |
| [`lazy-parsing.mjs`](./examples/lazy-parsing.mjs) | Preparser V8 по логам движка и стоимость разбора в мс |
| [`ast-formats.md`](./examples/ast-formats.md) | Справочник различий форматов дерева |
| [`parsing-in-v8.md`](./examples/parsing-in-v8.md) | Preparser, ленивость, кеши компиляции |
