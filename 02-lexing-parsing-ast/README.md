# 02. Лексер, парсер и AST

> Первая настоящая трансформация: из плоского текста получается дерево.

## Зачем это нужно

AST — общий язык всей экосистемы. Линтер, бандлер, минификатор, `tsc`, Babel и сам V8
начинают с одного и того же: превращают строку в дерево. Дальше все различия — в том, что
именно с этим деревом делают. Понимание формы дерева даёт возможность писать собственные
правила и трансформации, а понимание стоимости парсинга объясняет, почему размер бандла
влияет на время старта даже при неисполняемом коде.

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
- [ ] Error recovery: как парсеры IDE строят дерево из сломанного кода

## Ключевые вопросы для самопроверки

1. Почему одна и та же последовательность символов может быть разными токенами в зависимости
   от предыдущего токена?
2. Что дешевле для старта страницы: один большой файл или много мелких — и при чём тут preparser?
3. Чем `Program` в ESTree отличается от `SourceFile` в TypeScript?
4. Почему для codemod важно сохранять позиции и комментарии, а для компилятора — нет?

## Ссылки

### Спецификации и доки

- [ESTree spec](https://github.com/estree/estree) — форма узлов AST
- [ECMA-262: ECMAScript Language Grammar](https://tc39.es/ecma262/#sec-grammar-summary)
- [Babel parser docs](https://babeljs.io/docs/babel-parser)
- [TypeScript: Using the Compiler API](https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API) — обход `SourceFile`

### Статьи

- [V8: Blazingly fast parsing, part 1 — optimizing the scanner](https://v8.dev/blog/scanner)
- [V8: Blazingly fast parsing, part 2 — lazy parsing](https://v8.dev/blog/preparser)
- [V8: Code caching for JavaScript developers](https://v8.dev/blog/code-caching-for-devs)
- [Douglas Crockford: Top Down Operator Precedence](https://crockford.com/javascript/tdop/tdop.html)
- [Bob Nystrom: Crafting Interpreters — Parsing Expressions](https://craftinginterpreters.com/parsing-expressions.html)

### Инструменты и исходники

- [AST Explorer](https://astexplorer.net) — сравнить AST разных парсеров на одном коде
- [Acorn](https://github.com/acornjs/acorn) — маленький читаемый ESTree-парсер
- [Esprima](https://esprima.org/) — классика, хорошая документация формата
- [oxc parser](https://oxc.rs/docs/guide/usage/parser.html) — современный парсер на Rust
- [V8 parser sources](https://github.com/v8/v8/tree/main/src/parsing)

## Что положим в `examples/`

| Файл | Что показывает |
| --- | --- |
| `tokenize.mjs` | Простейший лексер на несколько токенов вручную |
| `parse-with-acorn.mjs` | Печать AST и обход дерева |
| `compare-asts.mjs` | Один код → AST Acorn / Babel / TypeScript, в чём разница |
| `lazy-parsing.md` | Замер влияния ленивого парсинга на время старта |
