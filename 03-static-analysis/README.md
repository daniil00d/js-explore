# 03. Статический анализ

> Что можно доказать о программе, ни разу её не запустив, — и где проходит граница.

## Зачем это нужно

Это ядро всего репозитория. Tree shaking, вывод типов, сужение типов, минификация,
inlining в компиляторе, поиск уязвимостей — всё это один и тот же набор приёмов поверх AST:
построить граф, распространить информацию по графу, сделать вывод. Отдельно важна вторая
половина темы: почему точный ответ невозможен и как анализаторы выбирают, в какую сторону
ошибаться.

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

## Что положим в `examples/`

| Файл | Что показывает |
| --- | --- |
| `scope-analysis.mjs` | Построение таблицы областей видимости по AST |
| `build-cfg.mjs` | CFG для функции и поиск недостижимого кода |
| `constant-folding.mjs` | Простейшая абстрактная интерпретация констант |
| `analysis-killers.mjs` | Код, на котором любой анализатор обязан сдаться |
