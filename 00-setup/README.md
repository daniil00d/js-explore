# 00. Инструментарий

> Собираем рабочее место: чем смотреть внутрь движка и чем разбирать код как данные.

## Зачем это нужно

Почти все темы дальше проверяются не рассуждением, а флагом. Байткод, деоптимизации,
состояние inline cache, паузы GC — всё это V8 умеет печатать сам, но по умолчанию молчит.
Этот раздел — про то, как заставить его говорить, и про то, где брать AST и типы для
статического трека.

## Что изучаем

- [ ] Node.js и `--allow-natives-syntax`: функции `%GetOptimizationStatus`, `%OptimizeFunctionOnNextCall`,
      `%NeverOptimizeFunction`, `%DebugPrint`, `%HaveSameMap`
- [ ] `d8` — отладочная оболочка V8: чем отличается от Node и почему в ней удобнее эксперименты
- [ ] Как получить `d8`: `jsvu` (готовые сборки) против сборки V8 из исходников через `depot_tools`
- [ ] Флаги диагностики: `--print-bytecode`, `--print-opt-code`, `--trace-opt`, `--trace-deopt`,
      `--trace-ic`, `--trace-gc`, `--trace-turbo`
- [ ] Список всех флагов: `node --v8-options`, `d8 --help`
- [ ] Turbolizer и `--trace-turbo`: визуализация фаз оптимизирующего компилятора
- [ ] Chrome DevTools как инструмент анализа: Performance, Memory, Coverage
- [ ] Статический трек: AST Explorer, `@babel/parser`, `typescript` как библиотека, `ts-morph`
- [ ] Фиксация окружения: почему версия движка обязана попадать в заметки

## Ключевые вопросы для самопроверки

1. Почему `%OptimizeFunctionOnNextCall` без предварительных вызовов функции работает не так,
   как ожидается?
2. Чем вывод `--trace-opt` отличается от `--trace-deopt` и какой из них показывает причину?
3. Почему бенчмарк на `d8` и тот же код в Node могут вести себя по-разному?
4. Что именно ломается, если запустить пример с `--allow-natives-syntax` в проде?

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

## Что положим в `examples/`

| Файл | Что показывает |
| --- | --- |
| `check-env.mjs` | Печатает версию Node/V8 и доступность natives syntax |
| `optimization-status.mjs` | Читает статус оптимизации функции через `%GetOptimizationStatus` |
| `flags-cheatsheet.md` | Шпаргалка команд под каждый раздел репозитория |
