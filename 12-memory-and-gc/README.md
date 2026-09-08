# 12. Память и сборка мусора

> Компилятор решает, как быстро считать; сборщик мусора решает, где всё это лежит.

## Зачем это нужно

Аллокация в JS выглядит бесплатной, и именно поэтому её цена всплывает в самых неудобных
местах: паузы GC в анимации, рост RSS у долгоживущего сервера, утечки через замыкания.
Тема тесно связана с предыдущими: escape-анализ из раздела 11 избавляет от аллокации вовсе,
а представление объектов из раздела 10 определяет, сколько байт занимает каждый объект.

## Что изучаем

- [ ] Устройство кучи V8: new space (полупространства), old space, large object space, code space
- [ ] Гипотеза поколений: большинство объектов умирает молодыми
- [ ] Minor GC (Scavenger): копирующий сборщик Ченни, промоушен в старое поколение
- [ ] Major GC (Mark-Compact): маркировка, выметание, компактификация
- [ ] Orinoco: конкурентная и инкрементальная маркировка, параллельное выметание
- [ ] Write barriers и почему они нужны инкрементальной маркировке
- [ ] Трёхцветная (tri-colour) абстракция маркировки: белый, серый, чёрный
- [ ] Stop-the-world паузы: откуда берутся и как их измерить
- [ ] Указательное сжатие (pointer compression) и стоимость объекта в байтах
- [ ] Оперативная память под код: байткод, оптимизированный код, сброс байткода (bytecode flushing)
- [ ] Утечки в JS: замыкания, глобальные кеши, слушатели, таймеры, детач DOM-узлов
- [ ] `WeakRef`, `FinalizationRegistry`, `WeakMap` — и почему на них нельзя полагаться
- [ ] Инструменты: `--trace-gc`, `--trace-gc-verbose`, heap snapshot, allocation timeline,
      `process.memoryUsage()`, `v8.getHeapStatistics()`
- [ ] Oilpan: сборщик для C++-объектов и почему он вообще упоминается рядом

## Ключевые вопросы для самопроверки

1. Почему аллокация в new space стоит почти как инкремент указателя?
2. Что именно делает write barrier и почему без него инкрементальная маркировка сломается?
3. Чем «мусор» отличается от «утечки» с точки зрения GC?
4. Почему объект, на который ссылается только замыкание, может пережить весь запрос?
5. Как отличить рост кучи от фрагментации по heap snapshot?
6. Почему `WeakRef` не даёт гарантий и когда его использование — ошибка дизайна?

## Ссылки

### Официальные посты V8

- [Trash talk: the Orinoco garbage collector](https://v8.dev/blog/trash-talk) — лучший вводный текст
- [Concurrent marking in V8](https://v8.dev/blog/concurrent-marking)
- [Getting garbage collection for free](https://v8.dev/blog/free-garbage-collection)
- [Optimizing V8 memory consumption](https://v8.dev/blog/optimizing-v8-memory)
- [Pointer compression in V8](https://v8.dev/blog/pointer-compression)
- [High-performance garbage collection for C++ (Oilpan)](https://v8.dev/blog/high-performance-cpp-gc)

### Практика и диагностика

- [Chrome DevTools: Fix memory problems](https://developer.chrome.com/docs/devtools/memory-problems/)
- [Chrome DevTools: Memory terminology (retained size, dominators)](https://developer.chrome.com/docs/devtools/memory-problems/memory-101)
- [Node.js: Diagnostics — memory](https://nodejs.org/en/learn/diagnostics/memory)
- [Node.js: v8 module](https://nodejs.org/api/v8.html) — heap statistics и снапшоты

### Теория

- [The Garbage Collection Handbook](https://gchandbook.org/) — каноническая книга
- [Wikipedia: Cheney's algorithm](https://en.wikipedia.org/wiki/Cheney%27s_algorithm)
- [Wikipedia: Tracing garbage collection](https://en.wikipedia.org/wiki/Tracing_garbage_collection)

## Что положим в `examples/`

| Файл | Что показывает |
| --- | --- |
| `allocation-rate.mjs` | Аллокации в цикле и частота minor GC под `--trace-gc` |
| `promotion.mjs` | Объекты доживают до old space: видно в логе GC |
| `leak-closure.mjs` | Классическая утечка через замыкание + heap snapshot |
| `weakmap-cache.mjs` | Кеш, который не течёт, против кеша, который течёт |
| `heap-stats.mjs` | `v8.getHeapStatistics()` до и после нагрузки |
