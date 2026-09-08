# 01. Спецификация и семантика языка

> Прежде чем анализировать и компилировать, надо понять, что именно язык обещает.

## Зачем это нужно

Любой статический анализатор и любой компилятор — это реализация правил из ECMA-262.
Всё, что кажется «странностями JS» (hoisting, TDZ, `this`, автоматическая вставка точек с
запятой), на уровне спеки — это конкретные алгоритмы. Компилятор не может их «оптимизировать
мимо»: он обязан сохранить наблюдаемое поведение, и именно из-за этого многие «очевидные»
оптимизации запрещены.

## Что изучаем

- [ ] Как читать ECMA-262: грамматика, абстрактные операции, Completion Record
- [ ] Грамматики в спеке: лексическая, синтаксическая, и почему их несколько
- [ ] Early Errors — ошибки, обязательные до выполнения кода (чистый статический анализ в спеке)
- [ ] ASI (автоматическая вставка точек с запятой) как часть парсинга
- [ ] Scope и Environment Record: lexical vs variable environment, TDZ, замыкания
- [ ] `var` / `let` / `const`, hoisting и почему это следствие двух проходов
- [ ] Strict mode и sloppy mode: как режим меняет и парсинг, и оптимизируемость
- [ ] Скрипты против модулей: разные цели грамматики, разный порядок инициализации
- [ ] Что делает оптимизации невозможными: геттеры, прокси, `with`, прямой `eval`, `arguments`
- [ ] Процесс TC39: стадии предложений и почему движки внедряют фичи раньше стандартизации

## Ключевые вопросы для самопроверки

1. Почему `a.b.c` нельзя закешировать даже внутри одного выражения?
2. Что именно делает прямой `eval` со scope-анализом и почему косвенный — нет?
3. Какие ошибки обязаны быть выброшены до первой строки выполнения?
4. Чем отличается порядок инициализации в модуле от порядка в скрипте?
5. Почему `typeof undeclaredVar` не бросает, а `undeclaredLet` в TDZ — бросает?

## Ссылки

### Спецификации

- [ECMA-262 (актуальный черновик)](https://tc39.es/ecma262/) — основной источник
- [ECMA-262: Early Errors](https://tc39.es/ecma262/#sec-error-handling-and-language-extensions)
- [ECMA-262: Automatic Semicolon Insertion](https://tc39.es/ecma262/#sec-automatic-semicolon-insertion)
- [ECMA-262: Executable Code and Execution Contexts](https://tc39.es/ecma262/#sec-executable-code-and-execution-contexts)
- [TC39: The TC39 Process](https://tc39.es/process-document/) и [список предложений](https://github.com/tc39/proposals)

### Статьи и разборы

- [How to Read the ECMAScript Specification](https://timothygu.me/es-howto/)
- [Jason Orendorff: ES6 In Depth](https://hacks.mozilla.org/category/es6-in-depth/) — семантика с точки зрения движка
- [Understanding the ECMAScript spec (серия V8)](https://v8.dev/blog/understanding-ecmascript-part-1)
- [Dr. Axel Rauschmayer: Exploring JS](https://exploringjs.com/) — семантика человеческим языком

### Инструменты

- [engine262](https://engine262.js.org/) — реализация ECMA-262 на JS, читается как спека
- [test262](https://github.com/tc39/test262) — официальный набор тестов соответствия

## Что положим в `examples/`

| Файл | Что показывает |
| --- | --- |
| `tdz-and-hoisting.mjs` | Разница между `var`, `let` и функциями на этапе инициализации scope |
| `asi-traps.js` | Случаи, где ASI меняет смысл программы |
| `optimization-blockers.mjs` | Геттеры, `with`, прямой `eval` — почему анализ сдаётся |
| `spec-walkthrough.md` | Разбор одной абстрактной операции по шагам |
