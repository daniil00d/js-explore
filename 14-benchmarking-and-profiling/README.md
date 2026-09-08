# 14. Бенчмарки и профилирование

> Раздел, без которого все предыдущие превращаются в набор поверий.

## Зачем это нужно

Почти любое утверждение о производительности JS проверяемо, и почти любой быстро написанный
микробенчмарк врёт. Причины ровно те, что изучались выше: компилятор выкинет код, результат
которого не используется, прогретая функция ведёт себя иначе, чем холодная, а первый запуск
меряет компиляцию, а не работу. Этот раздел — про дисциплину измерений и про то, как
отличить настоящий эффект от артефакта.

## Что изучаем

- [ ] Почему микробенчмарк выкидывается компилятором: DCE, constant folding, LICM
- [ ] Прогрев: сколько итераций нужно, чтобы функция дошла до TurboFan
- [ ] Мономорфизм в бенчмарке против полиморфизма в реальном коде
- [ ] Точность таймеров: `performance.now()`, `process.hrtime.bigint()`, ограничения разрешения
- [ ] Статистика: медиана против среднего, разброс, число прогонов, доверительные интервалы
- [ ] Изоляция запусков: отдельный процесс на вариант, порядок вариантов, шум машины
- [ ] Sampling profiler против инструментирования: что каждый искажает
- [ ] `--cpu-prof`, `--heap-prof`, `--prof` + `--prof-process` в Node
- [ ] Chrome DevTools Performance: флеймграф, self time против total time
- [ ] Linux perf и `--perf-basic-prof` для JIT-фреймов
- [ ] Метрики, которые важнее пиковой скорости: время до интерактивности, паузы, память
- [ ] Как оформлять результат: версия движка, железо, команда воспроизведения

## Ключевые вопросы для самопроверки

1. Почему пустой цикл на миллион итераций может выполниться за нулевое время?
2. Как заставить движок не выкинуть результат вычисления, не исказив замер?
3. Почему второй вариант в бенчмарке часто «выигрывает» просто из-за порядка запуска?
4. Что показывает sampling profiler в инлайненной функции?
5. Почему выигрыш в микробенчмарке в 5 раз может дать 0% в приложении?

## Ссылки

### Методология

- [Vyacheslav Egorov: Benchmarking is hard (доклады)](https://mrale.ph/talks/)
- [V8: How V8 measures real-world performance](https://v8.dev/blog/real-world-performance) — почему движок ушёл от синтетических бенчмарков
- [Aleksey Shipilëv: Nanotrusting the Nanotime](https://shipilev.net/blog/2014/nanotrusting-nanotime/) — не про JS, но обязательное чтение про методику
- [Addy Osmani: The cost of JavaScript in 2019](https://v8.dev/blog/cost-of-javascript-2019)

### Инструменты

- [Node.js: `--cpu-prof` и `--heap-prof`](https://nodejs.org/api/cli.html#--cpu-prof)
- [Node.js: Diagnostics — profiling](https://nodejs.org/en/learn/getting-started/profiling)
- [Chrome DevTools: Analyze runtime performance](https://developer.chrome.com/docs/devtools/performance)
- [tinybench](https://github.com/tinylibs/tinybench) — лёгкий современный раннер
- [mitata](https://github.com/evanwashere/mitata) — точные микробенчмарки
- [0x](https://github.com/davidmarkclements/0x) — флеймграфы для Node
- [Speedometer](https://browserbench.org/Speedometer3.0/) — пример «реалистичного» бенчмарка

## Что положим в `examples/`

| Файл | Что показывает |
| --- | --- |
| `naive-benchmark.mjs` | Бенчмарк, который врёт, и объяснение почему |
| `fixed-benchmark.mjs` | Тот же замер, сделанный корректно |
| `warmup.mjs` | Как меняется время по мере повышения уровня компиляции |
| `profile-walkthrough.md` | Разбор одного `--cpu-prof` профиля от начала до конца |
| `checklist.md` | Чеклист перед тем, как поверить своему бенчмарку |
