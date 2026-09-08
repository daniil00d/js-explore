# 07. Сборщики

> Здесь статический анализ впервые работает не с файлом, а со всей программой целиком.

## Зачем это нужно

Сборщик — единственное место в конвейере, где виден весь граф модулей. Именно поэтому
только он может выкинуть неиспользуемый экспорт, склеить модули в одну область видимости и
понять, что можно вычислить заранее. И именно поэтому все его оптимизации ломаются об одни и
те же вещи: побочные эффекты, динамические импорты и CommonJS, чей граф в общем случае
неразрешим статически.

## Что изучаем

- [ ] Граф модулей: разрешение путей, ESM против CommonJS, циклические зависимости
- [ ] Почему ESM анализируется статически, а `require()` — нет
- [ ] Tree shaking: живые экспорты, `sideEffects: false`, `/*#__PURE__*/`
- [ ] Scope hoisting (concatenation): склейка модулей в одну область видимости
- [ ] Code splitting: точки входа, общие чанки, `import()` и границы графа
- [ ] Минификация: сокращение имён, DCE, инлайн, `mangle` и `compress` в Terser
- [ ] Property mangling и почему он почти всегда небезопасен
- [ ] Опасность `__PURE__`-аннотаций: обещание, которое компилятор проверить не может
- [ ] Dev-режим: почему Vite не бандлит в разработке и что такое prebundling
- [ ] Rust/Go-поколение: Rspack, Rolldown, Turbopack, esbuild как бандлер
- [ ] Partial evaluation: идея Prepack и почему она не взлетела
- [ ] Влияние результата сборки на движок: размер, парсинг, мегаморфизм после склейки

## Ключевые вопросы для самопроверки

1. Почему один `import './styles.css'` может отключить tree shaking для всего пакета?
2. Что именно даёт scope hoisting движку, кроме экономии байт?
3. Почему минификатор не может сам понять, что вызов чистый, и требует аннотацию?
4. Как `import()` с вычисляемым путём выглядит с точки зрения графа модулей?
5. Что происходит с hidden classes, когда десяток модулей склеен в один файл?

## Ссылки

### Официальные доки

- [webpack: Tree Shaking](https://webpack.js.org/guides/tree-shaking/)
- [webpack: Module Federation и code splitting](https://webpack.js.org/guides/code-splitting/)
- [Rollup: Tree Shaking / FAQ](https://rollupjs.org/faqs/#what-is-tree-shaking)
- [Vite: Dep Pre-Bundling](https://vite.dev/guide/dep-pre-bundling.html) и [Why Vite](https://vite.dev/guide/why.html)
- [esbuild: Bundling](https://esbuild.github.io/api/#bundle)
- [Rspack](https://rspack.dev/guide/start/introduction) / [Rolldown](https://rolldown.rs/) / [Turbopack](https://turbo.build/pack/docs)
- [Node.js: Modules — ESM](https://nodejs.org/api/esm.html) и [CJS/ESM interop](https://nodejs.org/api/modules.html#modules-commonjs-modules)

### Минификация

- [Terser: Compress options](https://terser.org/docs/options/)
- [Terser: annotations и `__PURE__`](https://terser.org/docs/miscellaneous/#annotations)
- [Closure Compiler: Advanced Compilation](https://developers.google.com/closure/compiler/docs/api-tutorial3)

### Статьи

- [Nolan Lawson: The cost of small modules](https://nolanlawson.com/2016/08/15/the-cost-of-small-modules/)
- [Addy Osmani: The cost of JavaScript in 2019](https://v8.dev/blog/cost-of-javascript-2019) — со стороны движка
- [Prepack](https://prepack.io/) — архивная, но поучительная идея

## Что положим в `examples/`

| Файл | Что показывает |
| --- | --- |
| `tree-shaking/` | Один и тот же код: shakeable и non-shakeable версии, сравнение вывода |
| `side-effects/` | Как `sideEffects` и `__PURE__` меняют результат |
| `scope-hoisting/` | Вывод Rollup с концатенацией и без |
| `cjs-vs-esm/` | Почему граф CJS не разбирается статически |
| `bundle-size-report.md` | Сравнение размеров и времени сборки разных бандлеров |
