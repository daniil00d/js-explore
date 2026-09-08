# 11. Оптимизации и деоптимизация

> Компилятор угадывает — и обязан уметь откатиться, когда не угадал.

## Зачем это нужно

Оптимизирующий компилятор в JS работает на предположениях: «сюда всегда приходят числа»,
«у объекта всегда эта форма», «этот метод не переопределяли». Каждое предположение
превращается в проверку в коде, а если проверка провалилась — исполнение переносится обратно
в интерпретатор, ровно в середину функции. Это и есть деоптимизация. Понимание её механики
объясняет самые непонятные провалы производительности: код внезапно становится медленнее,
хотя ничего не менялось.

## Что изучаем

- [ ] Спекулятивная оптимизация: предположение → guard → быстрый код
- [ ] Откуда берутся предположения: feedback vector, скрытые классы, ICs (разделы 09–10)
- [ ] Основные оптимизации TurboFan: inlining, escape analysis, представление чисел,
      удаление избыточных проверок, LICM, GVN, DCE
- [ ] Sea of Nodes: почему IR TurboFan устроен как граф, а не как список инструкций
- [ ] Turboshaft и переход к более классическому CFG-based IR
- [ ] Деоптимизация: eager и lazy, точки деоптимизации, восстановление кадра интерпретатора
- [ ] Deopt loop: функция оптимизируется и деоптимизируется по кругу
- [ ] Типичные причины деопта: смена скрытого класса, `NaN`/`undefined` вместо числа,
      переполнение Smi, wrong map, insufficient type feedback
- [ ] Что мешает inlining: размер функции, `try/catch` (исторически), полиморфные вызовы
- [ ] Bailout: конструкции, которые целиком запрещают оптимизацию функции
- [ ] Диагностика: `--trace-opt`, `--trace-deopt`, `--trace-turbo`, deoptigate
- [ ] Практическое следствие: почему «монофорфный горячий цикл» — главный совет по перфу

## Ключевые вопросы для самопроверки

1. Чем eager-деоптимизация отличается от lazy и когда возникает каждая?
2. Как движок восстанавливает состояние интерпретатора в середине оптимизированной функции?
3. Почему добавление одного нового поля объекту в горячем цикле роняет производительность?
4. Что такое deopt loop и по какому признаку его видно в логах?
5. Почему инлайнинг — самая важная оптимизация, и что он открывает после себя?

## Ссылки

### Официальное и глубокое

- [Benedikt Meurer: An Introduction to Speculative Optimization in V8](https://benediktmeurer.de/2017/12/13/an-introduction-to-speculative-optimization-in-v8/)
- [V8: TurboFan docs](https://v8.dev/docs/turbofan)
- [V8: Digging into the TurboFan JIT](https://v8.dev/blog/turbofan-jit)
- [V8: Maglev](https://v8.dev/blog/maglev)
- [V8 internals: Deoptimization](https://github.com/v8/v8/blob/main/docs/runtime/deoptimization.md) — документация в самом репозитории
- [V8 internals: Tiering and interrupt budget](https://github.com/v8/v8/blob/main/docs/runtime/tiering.md)
- [TurboFan: V8's Optimizing Compiler (docs в репозитории)](https://chromium.googlesource.com/v8/v8/+/main/docs/compiler/turbofan/compiler-turbofan.md)

### Sea of Nodes

- [Fedor Indutny: Sea of Nodes](https://darksi.de/d.sea-of-nodes/)
- [Cliff Click: A Simple Graph-Based Intermediate Representation](https://www.oracle.com/technetwork/java/javase/tech/c2-ir95-150110.pdf) — первоисточник
- [V8 is Faster and Safer than Ever!](https://v8.dev/blog/holiday-season-2023) — что изменилось с приходом Turboshaft

### Практика

- [deoptigate](https://github.com/thlorenz/deoptigate) — визуализация деоптов и IC по файлам
- [Vyacheslav Egorov: Optimization-killers (историческая справка)](https://github.com/petkaantonov/bluebird/wiki/Optimization-killers) — многое устарело, но полезно как урок
- [Vyacheslav Egorov: Performance and benchmarking](https://mrale.ph/talks/) — доклады

## Что положим в `examples/`

| Файл | Что показывает |
| --- | --- |
| `speculation.mjs` | Функция на числах оптимизируется, строка её деоптимизирует |
| `deopt-loop.mjs` | Воспроизводимый цикл оптимизация/деоптимизация в `--trace-deopt` |
| `inlining.mjs` | Как размер функции влияет на инлайнинг |
| `escape-analysis.mjs` | Объект, который не аллоцируется вовсе |
| `deopt-reasons.md` | Каталог причин деоптимизации с воспроизведением каждой |
