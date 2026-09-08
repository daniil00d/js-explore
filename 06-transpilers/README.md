# 06. Транспиляторы

> Компиляция из JS в JS: то же дерево на входе и выходе, интересное — посередине.

## Зачем это нужно

Транспилятор — самый доступный компилятор для изучения: у него нет ни регистров, ни
машинного кода, зато есть весь остальной конвейер — парсинг, обход, трансформация,
генерация кода и source maps. Плюс это место, где становится видно цену абстракций: во что
на самом деле разворачиваются `async/await`, классы и деструктуризация, если целевая среда
их не поддерживает.

## Что изучаем

- [ ] Конвейер: parse → transform (visitors) → generate
- [ ] Плагины Babel: посещение узлов, пути, замена и удаление, работа со scope
- [ ] Гигиена идентификаторов: генерация уникальных имён при вставке кода
- [ ] Downleveling: во что превращаются `async/await` (state machine), генераторы, классы, `...spread`
- [ ] Полифилы против синтаксических трансформаций; `core-js`, `@babel/preset-env`, browserslist
- [ ] Хелперы: инлайн против `@babel/runtime`, влияние на размер бандла
- [ ] Source maps: формат, VLQ-кодирование, цепочки маппингов через несколько инструментов
- [ ] Быстрые транспиляторы: esbuild (Go), SWC (Rust), oxc (Rust) — за счёт чего они быстрее
- [ ] Почему быстрые транспиляторы работают пофайлово и не могут проверять типы
- [ ] `tsc` как транспилятор: `target`, `module`, `importHelpers`, `isolatedModules`
- [ ] Трансформации, меняющие семантику: `loose` режимы, `assumptions` в Babel
- [ ] Макросы и compile-time вычисления в JS-экосистеме

## Ключевые вопросы для самопроверки

1. Почему при обходе AST нужно быть осторожным с заменой узла, по которому идёшь?
2. Что именно теряется, если транспилятор видит только один файл за раз?
3. Как выглядит `async` функция после downleveling до ES5 и почему она медленнее нативной?
4. Почему source map после трёх инструментов подряд может врать, и что такое цепочка карт?
5. За счёт чего esbuild быстрее Babel — только ли из-за Go?

## Ссылки

### Официальные доки

- [Babel: Plugin Handbook](https://github.com/jamiebuilds/babel-handbook/blob/master/translations/en/plugin-handbook.md) — лучший текст про visitors
- [Babel: @babel/preset-env](https://babeljs.io/docs/babel-preset-env)
- [Babel: Assumptions](https://babeljs.io/docs/assumptions) — чем платим за скорость
- [SWC docs](https://swc.rs/docs/getting-started) и [написание плагинов](https://swc.rs/docs/plugin/ecmascript/getting-started)
- [esbuild: API](https://esbuild.github.io/api/) и [Content Types](https://esbuild.github.io/content-types/)
- [oxc: Transformer](https://oxc.rs/docs/guide/usage/transformer.html)

### Source maps

- [Source Map spec (TC39 предложение)](https://tc39.es/source-map/)
- [Chrome DevTools: source maps](https://developer.chrome.com/docs/devtools/javascript/source-maps)
- [source-map библиотека](https://github.com/mozilla/source-map)

### Статьи

- [esbuild: Why is esbuild fast?](https://esbuild.github.io/faq/#why-is-esbuild-fast)
- [Babel: A Guide to the Babel AST](https://github.com/babel/babel/blob/main/packages/babel-parser/ast/spec.md)

## Что положим в `examples/`

| Файл | Что показывает |
| --- | --- |
| `babel-plugin-logger/` | Свой плагин Babel: вставка логирования в функции |
| `downlevel/async-to-es5.md` | `async/await` до и после трансформации |
| `downlevel/class-to-es5.md` | Класс → функция-конструктор, что добавляется |
| `sourcemaps/chain.mjs` | Цепочка из двух инструментов и проверка корректности карты |
| `speed/compare.mjs` | Babel против SWC против esbuild на одном входе |
