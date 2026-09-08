# 01. Спецификация и семантика языка

> Прежде чем анализировать и компилировать, надо понять, что именно язык обещает.

## Зачем это нужно

Любой статический анализатор и любой компилятор — это реализация правил из ECMA-262.
Всё, что кажется «странностями JS» (hoisting, TDZ, `this`, автоматическая вставка точек с
запятой), на уровне спеки — это конкретные алгоритмы. Компилятор не может их «оптимизировать
мимо»: он обязан сохранить наблюдаемое поведение, и именно из-за этого многие «очевидные»
оптимизации запрещены.

## Быстрый старт

```bash
node 01-spec-and-semantics/examples/hoisting-and-tdz.mjs   # среда создаётся до выполнения кода
node 01-spec-and-semantics/examples/early-errors.mjs       # что отвергается до первой строки
```

Дальше — [`examples/README.md`](./examples/README.md) с порядком чтения и
[`examples/spec-walkthrough.md`](./examples/spec-walkthrough.md) как введение в чтение
самой спецификации.

## Что изучаем

- [ ] Как читать ECMA-262: грамматика, абстрактные операции, Completion Record
- [ ] Обозначения `?` и `!`, Reference Record против значения, значение завершения инструкции
- [ ] Грамматики в спеке: лексическая, синтаксическая, и почему их несколько
- [ ] Cover grammar: конструкции, которые нельзя разобрать без перечитывания
- [ ] Early Errors — ошибки, обязательные до выполнения кода (чистый статический анализ в спеке)
- [ ] ASI (автоматическая вставка точек с запятой) как часть парсинга
- [ ] Scope и Environment Record: lexical vs variable environment, TDZ, замыкания
- [ ] `var` / `let` / `const`, hoisting и почему это следствие двух проходов
- [ ] Strict mode и sloppy mode: как режим меняет и парсинг, и оптимизируемость
- [ ] Скрипты против модулей: разные цели грамматики, разный порядок инициализации
- [ ] Живые привязки ESM против копий в `module.exports` и что это даёт сборщику
- [ ] Что делает оптимизации невозможными: геттеры, прокси, `with`, прямой `eval`, `arguments`
- [ ] Процесс TC39: стадии предложений и почему движки внедряют фичи раньше стандартизации

## Ключевые вопросы для самопроверки

1. Почему `a.b.c` нельзя закешировать даже внутри одного выражения?
2. Что именно делает прямой `eval` со scope-анализом и почему косвенный — нет?
3. Какие ошибки обязаны быть выброшены до первой строки выполнения?
4. Чем отличается порядок инициализации в модуле от порядка в скрипте?
5. Почему `typeof undeclaredVar` не бросает, а `undeclaredLet` в TDZ — бросает?
6. В цикле зависимостей ESM бросает `ReferenceError`, а CommonJS отдаёт `undefined`.
   Почему разница именно такая и что из этого следует для отладки?
7. В каком порядке случаются побочные эффекты в `a() + b()`, если оба возвращают объекты
   с `valueOf`?

## Ссылки

### Спецификации

- [ECMA-262 (актуальный черновик)](https://tc39.es/ecma262/) — основной источник
- [ECMA-262: Algorithm Conventions](https://tc39.es/ecma262/#sec-algorithm-conventions) — как вообще читать шаги
- [ECMA-262: Shorthands for Unwrapping Completion Records](https://tc39.es/ecma262/#sec-returnifabrupt-shorthands) — что значат `?` и `!`
- [ECMA-262: Early Errors](https://tc39.es/ecma262/#sec-error-handling-and-language-extensions)
- [ECMA-262: Automatic Semicolon Insertion](https://tc39.es/ecma262/#sec-automatic-semicolon-insertion)
- [ECMA-262: Executable Code and Execution Contexts](https://tc39.es/ecma262/#sec-executable-code-and-execution-contexts)
- [ECMA-262: Source Text Module Records](https://tc39.es/ecma262/#sec-source-text-module-records) — порядок инициализации модулей
- [TC39: The TC39 Process](https://tc39.es/process-document/) и [список предложений](https://github.com/tc39/proposals)

### Статьи и разборы

- [How to Read the ECMAScript Specification](https://timothygu.me/es-howto/)
- [Jason Orendorff: ES6 In Depth](https://hacks.mozilla.org/category/es6-in-depth/) — семантика с точки зрения движка
- [Understanding the ECMAScript spec (серия V8)](https://v8.dev/blog/understanding-ecmascript-part-1)
- [Dr. Axel Rauschmayer: Exploring JS](https://exploringjs.com/) — семантика человеческим языком

### Инструменты

- [engine262](https://engine262.js.org/) — реализация ECMA-262 на JS, читается как спека
- [test262](https://github.com/tc39/test262) — официальный набор тестов соответствия
- [V8: JavaScript modules](https://v8.dev/features/modules) — семантика ESM с картинками
- [Node.js: Modules ECMAScript modules](https://nodejs.org/api/esm.html) — где Node расходится с браузером

## Что лежит в [`examples/`](./examples)

| Файл | Что показывает |
| --- | --- |
| [`hoisting-and-tdz.mjs`](./examples/hoisting-and-tdz.mjs) | Подъём объявлений, TDZ, привязка на итерацию цикла |
| [`early-errors.mjs`](./examples/early-errors.mjs) | Что отвергается до выполнения, а что падает уже в рантайме |
| [`asi-traps.mjs`](./examples/asi-traps.mjs) | Случаи, где перенос строки меняет смысл программы |
| [`strict-vs-sloppy.mjs`](./examples/strict-vs-sloppy.mjs) | Чем строгий режим отличается от нестрогого |
| [`modules-vs-scripts.mjs`](./examples/modules-vs-scripts.mjs) | Порядок инициализации, циклы, живые привязки, ESM против CJS |
| [`optimization-blockers.mjs`](./examples/optimization-blockers.mjs) | Геттеры, прокси, `with`, прямой `eval` — почему анализ сдаётся |
| [`plus-operator.mjs`](./examples/plus-operator.mjs) | Оператор `+` по шагам алгоритма из спецификации |
| [`spec-walkthrough.md`](./examples/spec-walkthrough.md) | Разбор абстрактных операций по шагам и как читать ECMA-262 |
| [`harness.mjs`](./examples/harness.mjs) | Обвязка примеров: таблицы и запуск фрагментов через `node:vm` |

## Лабы

| Лаба | Задача |
| --- | --- |
| [01-predict-the-output](./labs/01-predict-the-output) | Предсказать результат четырнадцати фрагментов, не запуская их |
| [02-implement-addition](./labs/02-implement-addition) | Реализовать оператор `+` по абстрактным операциям ECMA-262 |
| [03-module-order](./labs/03-module-order) | Предсказать порядок инициализации в четырёх графах модулей |

Задания, проверки и разборы — в [`labs/`](./labs). Обзор всех лаб репозитория:
`node tools/labs.mjs`.

Проверено на `node v22.14.0 / V8 12.4.254.21-node.22`, linux-x64. Флаги V8 здесь не нужны:
раздел про правила языка, а не про внутренности движка.
