# 03. Статический анализ

> Что можно доказать о программе, ни разу её не запустив, — и где проходит граница.

## Зачем это нужно

Это ядро всего репозитория. Tree shaking, вывод типов, сужение типов, минификация,
inlining в компиляторе, поиск уязвимостей — всё это один и тот же набор приёмов поверх AST:
построить граф, распространить информацию по графу, сделать вывод. Отдельно важна вторая
половина темы: почему точный ответ невозможен и как анализаторы выбирают, в какую сторону
ошибаться.

## Быстрый старт

```bash
npm install                                               # acorn, eslint-scope, Babel
node 03-static-analysis/examples/scope-analysis.mjs       # кто на кого ссылается
node 03-static-analysis/examples/build-cfg.mjs            # граф и недостижимый код
```

Дальше — [`examples/README.md`](./examples/README.md) с порядком чтения,
[`examples/dataflow-primer.md`](./examples/dataflow-primer.md) как справочник по анализу
потока данных и [`examples/limits-of-analysis.md`](./examples/limits-of-analysis.md) про
то, где у всего этого граница.

## Что изучаем

- [ ] Scope и binding: таблица символов, разрешение имён, свободные и связанные переменные
- [ ] Граф потока управления (CFG): базовые блоки, рёбра, недостижимый код
- [ ] Анализ потока данных: reaching definitions, liveness, available expressions
- [ ] SSA-форма и φ-функции: зачем компиляторы переписывают код в SSA
- [ ] Граф вызовов и его неполнота в JS (функции — значения, динамический доступ)
- [ ] Escape-анализ: где живёт объект и можно ли его не аллоцировать
- [ ] Анализ псевдонимов (alias/points-to): указывают ли две переменные на один объект
- [ ] Абстрактная интерпретация и решётки значений; constant folding и propagation
- [ ] Чувствительность анализа: flow-/path-/context-sensitive и цена каждой
- [ ] Консервативность: sound против complete, ложные срабатывания против пропусков
- [ ] Проблема остановки и теорема Райса — формальная причина, почему точный анализ невозможен
- [ ] Что убивает анализ именно в JS: `eval`, `with`, Proxy, геттеры, динамические ключи,
      монки-патчинг прототипов, `import()` с переменной

## Ключевые вопросы для самопроверки

1. Почему `obj[key]` обрушивает точность анализа сильнее, чем `obj.key`?
2. Что должен предположить анализатор, встретив прямой `eval`, чтобы остаться корректным?
3. Зачем нужна SSA, если у нас уже есть CFG и dataflow?
4. Как escape-анализ связан с тем, попадёт ли объект в кучу?
5. Чем «sound» анализ отличается от «полезного» и почему промышленные линтеры выбирают второе?

## Ссылки

### Учебные материалы

- [Static Program Analysis (Møller, Schwartzbach) — бесплатная книга PDF](https://cs.au.dk/~amoeller/spa/)
- [Nielson, Nielson, Hankin: Principles of Program Analysis](https://link.springer.com/book/10.1007/978-3-662-03811-6) — классика
- [Bob Nystrom: Crafting Interpreters](https://craftinginterpreters.com/) — резолвер и семантика на практике
- [Wikipedia: Data-flow analysis](https://en.wikipedia.org/wiki/Data-flow_analysis) и [Static single-assignment form](https://en.wikipedia.org/wiki/Static_single-assignment_form)
- [Wikipedia: Abstract interpretation](https://en.wikipedia.org/wiki/Abstract_interpretation)

### Про JS конкретно

- [TAJS — Type Analyzer for JavaScript](https://github.com/cs-au-dk/TAJS) — академический анализатор JS
- [Closure Compiler](https://github.com/google/closure-compiler) — самый агрессивный статанализ в экосистеме JS
- [eslint-scope](https://github.com/eslint/js/tree/main/packages/eslint-scope) — как выглядит scope-анализ в реальном инструменте
- [Terser](https://github.com/terser/terser) — dead code elimination и inline на практике

### Инструменты

- [CodeQL](https://codeql.github.com/docs/) — анализ кода как запросов к базе
- [Semgrep](https://semgrep.dev/docs/) — поиск по семантическим паттернам

## Что лежит в `examples/`

| Файл | Что показывает |
| --- | --- |
| [`scope-analysis.mjs`](./examples/scope-analysis.mjs) | Дерево областей видимости, замыкания, затенение; сверка с `eslint-scope` |
| [`scope.mjs`](./examples/scope.mjs) | Сам анализ областей видимости, отдельным модулем |
| [`build-cfg.mjs`](./examples/build-cfg.mjs) | CFG функции, недостижимый код и сверка с покрытием V8 |
| [`cfg.mjs`](./examples/cfg.mjs) | Построение графа, достижимость, доминаторы, фронты доминирования |
| [`dataflow.mjs`](./examples/dataflow.mjs) | Достигающие определения и живость: итеративный алгоритм |
| [`variables.mjs`](./examples/variables.mjs) | Какие переменные читает и пишет каждая инструкция графа |
| [`ssa.mjs`](./examples/ssa.mjs) | SSA-форма: φ-функции, переименование, проверка инвариантов |
| [`constant-folding.mjs`](./examples/constant-folding.mjs) | Решётка значений, свёртка, распространение констант, отсечение ветвей |
| [`call-graph.mjs`](./examples/call-graph.mjs) | Статический граф вызовов против настоящего, снятого с выполнения |
| [`analysis-killers.mjs`](./examples/analysis-killers.mjs) | Код, на котором любой анализатор обязан сдаться |
| [`dataflow-primer.md`](./examples/dataflow-primer.md) | Схема любого анализа потока данных и словарь терминов |
| [`limits-of-analysis.md`](./examples/limits-of-analysis.md) | Почему точный ответ невозможен и как инструменты выбирают сторону |

## Лабы

| Лаба | Задача |
| --- | --- |
| [01-safe-rename](./labs/01-safe-rename) | Переименовать переменную — или обоснованно отказаться |
| [02-eliminate-dead-code](./labs/02-eliminate-dead-code) | Найти по графу код, до которого не доходит управление, и убрать его |
| [03-constant-propagation](./labs/03-constant-propagation) | Выполнить функцию на описаниях значений вместо значений |

Задания, проверки и разборы — в [`labs/`](./labs). Обзор всех лаб репозитория:
`node tools/labs.mjs`.
