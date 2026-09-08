# 13. WebAssembly

> Второй вход в тот же движок — уже скомпилированный и статически типизированный.

## Зачем это нужно

WebAssembly полезен здесь как контраст. Это ровно то, чем JS не является: статические типы,
известная заранее структура, линейная память без GC-объектов, компиляция AOT. Сравнивая два
входа в один и тот же V8, легко увидеть, какая именно часть работы движка вызвана
динамичностью JS — и почему одни задачи ускоряются переносом в Wasm в разы, а другие не
ускоряются вовсе из-за стоимости границы.

## Что изучаем

- [ ] Формат модуля: секции, типы, таблицы, линейная память, импорты и экспорты
- [ ] Текстовый формат WAT и его соответствие бинарному
- [ ] Валидация модуля — статическая проверка типов до исполнения
- [ ] Компиляция в V8: Liftoff (быстрый базовый) и TurboFan (оптимизирующий) — снова tiering
- [ ] Стриминговая компиляция и кеширование скомпилированных модулей
- [ ] Граница JS↔Wasm: стоимость вызова, преобразование значений, где она съедает выигрыш
- [ ] Работа с памятью: `ArrayBuffer`, ручное управление, отсутствие GC в MVP
- [ ] WasmGC: управляемые объекты и что это меняет для языков со сборщиком мусора
- [ ] Что компилируется в Wasm: Rust, C/C++ (Emscripten), AssemblyScript, Go
- [ ] SIMD, threads, exception handling — расширения и их поддержка
- [ ] Когда Wasm не нужен: типичные ошибки в оценке выигрыша

## Ключевые вопросы для самопроверки

1. Почему Wasm-модуль не нуждается в feedback vector и inline caches?
2. Что делает Liftoff и почему он существует, если есть TurboFan?
3. Из чего складывается стоимость одного вызова из JS в Wasm?
4. Почему передача строки в Wasm — нетривиальная операция?
5. Какие задачи почти не выигрывают от переноса в Wasm и почему?

## Ссылки

### Спецификация и доки

- [WebAssembly Specification](https://webassembly.github.io/spec/core/)
- [webassembly.org](https://webassembly.org/)
- [MDN: WebAssembly](https://developer.mozilla.org/en-US/docs/WebAssembly)
- [WebAssembly proposals](https://github.com/WebAssembly/proposals)

### V8 и компиляция

- [V8: Liftoff — a new baseline compiler for WebAssembly](https://v8.dev/blog/liftoff)
- [V8: Up to 20× faster Wasm startup with dynamic tiering](https://v8.dev/blog/wasm-dynamic-tiering)
- [V8: A new way to bring garbage collected programming languages to the browser (WasmGC)](https://v8.dev/blog/wasm-gc-porting)
- [V8: WebAssembly compilation pipeline](https://v8.dev/docs/wasm-compilation-pipeline)

### Инструменты и языки

- [WABT — WebAssembly Binary Toolkit](https://github.com/WebAssembly/wabt) (`wat2wasm`, `wasm2wat`)
- [AssemblyScript](https://www.assemblyscript.org/)
- [Emscripten](https://emscripten.org/)
- [Rust and WebAssembly book](https://rustwasm.github.io/docs/book/)

## Что положим в `examples/`

| Файл | Что показывает |
| --- | --- |
| `hello.wat` | Минимальный модуль в текстовом формате и его загрузка из Node |
| `boundary-cost.mjs` | Замер стоимости вызова через границу JS↔Wasm |
| `js-vs-wasm.mjs` | Одна и та же численная задача в JS и в Wasm |
| `memory.mjs` | Работа с линейной памятью из JS |
