# 08. Конвейер V8

> Общая карта движка: один и тот же код существует одновременно в нескольких формах.

## Зачем это нужно

Ключевая идея V8: не бывает «скомпилированного JS». Функция начинает жизнь как байткод в
интерпретаторе, и только если её вызывают часто, она поднимается по уровням компиляции —
каждый следующий компилирует дольше, но выдаёт более быстрый код. Вся дальнейшая специфика
(байткод, inline caches, деоптимизация) — это детали этой схемы, и без общей картины они
выглядят разрозненно.

## Что изучаем

- [ ] Полная схема: source → parser → AST → Ignition (bytecode) → Sparkplug → Maglev → TurboFan
- [ ] Почему многоуровневая (tiered) компиляция вообще нужна: компромисс «время старта против
      пиковой скорости»
- [ ] Ignition — регистровый интерпретатор байткода
- [ ] Sparkplug — базовый компилятор без IR: быстрая трансляция байткода в машинный код
- [ ] Maglev — средний уровень: оптимизации на основе обратной связи, но быстрая компиляция
- [ ] TurboFan — оптимизирующий компилятор с полноценным IR
- [ ] Turboshaft — новый бэкенд-фреймворк внутри TurboFan
- [ ] Feedback vector: как движок собирает статистику типов во время интерпретации
- [ ] «Горячесть» функции и критерии повышения уровня; On-Stack Replacement для циклов
- [ ] Конкурентная компиляция в фоновых потоках
- [ ] Разница V8 / SpiderMonkey / JavaScriptCore: сколько уровней и какие
- [ ] Где в этой схеме живут скрытые классы и деоптимизация (переход к разделам 10 и 11)

## Ключевые вопросы для самопроверки

1. Почему движок не компилирует всё сразу в самый быстрый код?
2. Что делает Sparkplug, чего не делает Ignition, и почему ему не нужен IR?
3. Зачем нужен промежуточный уровень Maglev, если уже есть TurboFan?
4. Что такое On-Stack Replacement и в какой ситуации без него не обойтись?
5. Откуда TurboFan берёт информацию о типах, если в JS типов нет?

## Ссылки

### Официальные посты V8

- [Firing up the Ignition interpreter](https://v8.dev/blog/ignition-interpreter)
- [Sparkplug — a non-optimizing JavaScript compiler](https://v8.dev/blog/sparkplug)
- [Maglev — V8's Fastest Optimizing JIT](https://v8.dev/blog/maglev)
- [Launching Ignition and TurboFan](https://v8.dev/blog/launching-ignition-and-turbofan)
- [V8: TurboFan docs](https://v8.dev/docs/turbofan)
- [V8 is Faster and Safer than Ever!](https://v8.dev/blog/holiday-season-2023) — обзор Maglev и Turboshaft разом
- [V8 blog (весь архив)](https://v8.dev/blog)

### Обзоры и доклады

- [Mathias Bynens: JavaScript engine fundamentals — Shapes and Inline Caches](https://mathiasbynens.be/notes/shapes-ics)
- [Franziska Hinkelmann: JavaScript engines — how do they even?](https://www.youtube.com/watch?v=p-iiEDtpy6I)
- [Benedikt Meurer: Talks and slides](https://benediktmeurer.de/) — много про TurboFan
- [Jay Conrod: A tour of V8](http://jayconrod.com/posts/51/a-tour-of-v8-full-compiler) — устаревшая архитектура, но полезно для контекста

### Исходники

- [v8/v8 на GitHub](https://github.com/v8/v8)
- [V8 internals docs (в репозитории)](https://github.com/v8/v8/tree/main/docs) — разборы по подсистемам
- [V8 internals: High-level overview](https://github.com/v8/v8/blob/main/docs/overview.md)
- [V8: Documentation for contributors](https://v8.dev/docs)

## Что положим в `examples/`

| Файл | Что показывает |
| --- | --- |
| `tiering.mjs` | Функция проходит уровни; логируем через `--trace-opt` |
| `osr.mjs` | Долгий цикл и On-Stack Replacement |
| `pipeline.md` | Схема конвейера с командами для проверки каждого шага |
| `engines-compare.md` | Тот же код в V8, SpiderMonkey и JSC |
