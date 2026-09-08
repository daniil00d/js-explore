# 00. Инструментарий

> Собираем рабочее место: чем смотреть внутрь движка и чем разбирать код как данные.

## Зачем это нужно

Почти все темы дальше проверяются не рассуждением, а флагом. Байткод, деоптимизации,
состояние inline cache, паузы GC — всё это V8 умеет печатать сам, но по умолчанию молчит.
Этот раздел — про то, как заставить его говорить, и про то, где брать AST и типы для
статического трека.

## Быстрый старт

```bash
node 00-setup/examples/check-env.mjs      # что за окружение и чего в нём не хватает
node 00-setup/examples/flag-tour.mjs      # все основные флаги V8 за один запуск
```

Дальше — [`examples/README.md`](./examples/README.md) с порядком чтения и
[`examples/flags-cheatsheet.md`](./examples/flags-cheatsheet.md) как справочник.

## Что изучаем

- [ ] Node.js и `--allow-natives-syntax`: функции `%GetOptimizationStatus`, `%OptimizeFunctionOnNextCall`,
      `%NeverOptimizeFunction`, `%DebugPrint`, `%HaveSameMap`
- [ ] `d8` — отладочная оболочка V8: чем отличается от Node и почему в ней удобнее эксперименты
- [ ] Как получить `d8`: `jsvu` (готовые сборки) против сборки V8 из исходников через `depot_tools`
- [ ] Флаги диагностики: `--print-bytecode`, `--print-opt-code`, `--trace-opt`, `--trace-deopt`,
      `--log-ic`, `--trace-gc`, `--trace-turbo`
- [ ] Список всех флагов: `node --v8-options`, `d8 --help`
- [ ] Turbolizer и `--trace-turbo`: визуализация фаз оптимизирующего компилятора
- [ ] Chrome DevTools как инструмент анализа: Performance, Memory, Coverage
- [ ] Статический трек: AST Explorer, `@babel/parser`, `typescript` как библиотека, `ts-morph`
- [ ] Флаги сборки (`process.config.variables`): почему в конкретном Node может не быть Maglev
- [ ] Release против debug: почему часть флагов из статей молча ничего не печатает
- [ ] Фиксация окружения: почему версия движка обязана попадать в заметки

## Ключевые вопросы для самопроверки

1. Почему `%OptimizeFunctionOnNextCall` без `%PrepareFunctionForOptimization` не делает
   ничего, причём молча?
2. Чем вывод `--trace-opt` отличается от `--trace-deopt` и какой из них показывает причину?
3. Почему бенчмарк на `d8` и тот же код в Node могут вести себя по-разному?
4. Одна и та же маска 41 означает TurboFan на свежем V8 и Maglev на старом. Как так вышло и
   что из этого следует для любых чужих примеров?
5. Что именно ломается, если запустить пример с `--allow-natives-syntax` в проде?

## Ссылки

### Официальные доки

- [V8: Documentation](https://v8.dev/docs) — точка входа во всё остальное
- [V8: Using d8](https://v8.dev/docs/d8)
- [V8: Building V8 from source](https://v8.dev/docs/build)
- [V8: Profile](https://v8.dev/docs/profile) и [V8: Tracing](https://v8.dev/docs/trace)
- [Node.js CLI options](https://nodejs.org/api/cli.html) — `--v8-options`, `--cpu-prof`, `--heap-prof`

### Инструменты

- [jsvu](https://github.com/GoogleChromeLabs/jsvu) — ставит `d8`, `jsc`, `spidermonkey` без сборки
- [Turbolizer](https://github.com/v8/v8/tree/main/tools/turbolizer) — граф IR из `--trace-turbo`
- [AST Explorer](https://astexplorer.net) — AST для десятка парсеров в браузере
- [ts-morph](https://ts-morph.com) — удобная обёртка над compiler API TypeScript
- [Chrome DevTools: Performance](https://developer.chrome.com/docs/devtools/performance)

### Статьи

- [V8 runtime functions (natives syntax)](https://github.com/v8/v8/blob/main/src/runtime/runtime.h) — список `%`-функций
- [Mathias Bynens: JavaScript engine fundamentals](https://mathiasbynens.be/notes/shapes-ics) — с чего начать чтение

## Что лежит в [`examples/`](./examples)

| Файл | Что показывает |
| --- | --- |
| [`check-env.mjs`](./examples/check-env.mjs) | Версии, флаги сборки V8, доступность `d8` и `%`-функций |
| [`flag-tour.mjs`](./examples/flag-tour.mjs) | Все основные диагностические флаги за один запуск |
| [`subject.mjs`](./examples/subject.mjs) | Подопытная программа для тура по флагам |
| [`optimization-status.mjs`](./examples/optimization-status.mjs) | Уровни компиляции через `%GetOptimizationStatus` |
| [`natives-syntax.mjs`](./examples/natives-syntax.mjs) | Форма объектов, виды элементов, Smi и строки |
| [`natives.mjs`](./examples/natives.mjs) | Обёртки над `%`-функциями с проверкой флага |
| [`flags-cheatsheet.md`](./examples/flags-cheatsheet.md) | Шпаргалка команд под каждый раздел репозитория |
| [`d8-setup.md`](./examples/d8-setup.md) | Установка `d8` и чем он отличается от Node |
| [`static-toolchain.md`](./examples/static-toolchain.md) | Библиотеки для статического трека |

## Лабы

| Лаба | Задача |
| --- | --- |
| [01-flag-detective](./labs/01-flag-detective) | По логам V8 выяснить, что случилось с четырьмя функциями |
| [02-pick-the-flags](./labs/02-pick-the-flags) | Подобрать флаги, которые меняют поведение движка нужным образом |

Задания, проверки и разборы — в [`labs/`](./labs). Обзор всех лаб репозитория:
`node tools/labs.mjs`.

Проверено на `node v22.14.0 / V8 12.4.254.21-node.22` и `d8` (V8 15.5.18), linux-x64.
