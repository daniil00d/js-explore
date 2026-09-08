# d8: отладочная оболочка V8

`d8` — это V8 без Node вокруг. Голый движок с минимальной обвязкой, собранный командой V8 и
обновляющийся вместе с ней. Для изучения внутренностей он удобнее Node по трём причинам:
версия свежее (Node отстаёт на месяцы), в нём включены уровни компиляции, которые Node может
не собирать, и в выводе нет посторонних сотен функций самого Node.

## Установка через jsvu

Самый быстрый путь — [jsvu](https://github.com/GoogleChromeLabs/jsvu): он скачивает готовые
сборки, ничего не компилируя.

```bash
npm install -g jsvu
jsvu --engines=v8
export PATH="$HOME/.jsvu/bin:$PATH"     # добавь в ~/.bashrc или ~/.zshrc
```

Если глобальная установка упирается в права:

```bash
npm install -g --prefix "$HOME/.local" jsvu
export PATH="$HOME/.local/bin:$HOME/.jsvu/bin:$PATH"
jsvu --os=linux64 --engines=v8
```

Первая ловушка: исполняемый файл называется **`v8`**, а не `d8`. jsvu кладёт в
`~/.jsvu/bin/v8` скрипт-обёртку, которая запускает настоящий `d8` с нужным
`--snapshot_blob`. Все команды из статей про `d8 --флаг` работают как `v8 --флаг`.

```bash
v8 --version        # V8 version 15.5.18
```

Тем же способом ставятся другие движки: `jsvu --engines=javascriptcore,spidermonkey`.
Полезно, когда хочется сравнить поведение (раздел 08).

## Сборка из исходников

Нужна, если хочешь debug-сборку (в ней работают `--print-ast`, `--print-scopes`, проверки
кучи) или собственные патчи. Это долгий путь: `depot_tools`, `fetch v8`, несколько гигабайт
исходников и полчаса компиляции.

```bash
git clone https://chromium.googlesource.com/chromium/tools/depot_tools.git
export PATH="$PWD/depot_tools:$PATH"
fetch v8 && cd v8
tools/dev/gm.py x64.release      # или x64.debug для отладочной сборки
out/x64.release/d8 script.js
```

Подробности и требования к системе — в [V8: Building V8 from source](https://v8.dev/docs/build).

## Чем d8 отличается от Node

В d8 нет ни `require`, ни `process`, ни модулей Node. Вместо них — несколько встроенных
функций оболочки:

| Функция | Что делает |
| --- | --- |
| `print(...)` | вывод в stdout (аналог `console.log`, `console` тоже есть) |
| `read(path)` | прочитать файл в строку |
| `readline()` | прочитать строку со stdin |
| `load(path)` | выполнить файл в текущем контексте |
| `quit(code)` | завершить процесс |

ES-модули запускаются отдельным флагом:

```bash
v8 --module script.mjs
```

Интерактивная оболочка — `v8 --shell`. Служебные `%`-функции требуют
`--allow-natives-syntax` точно так же, как в Node.

Чтобы один и тот же файл работал и там, и там, удобно начинать с такой строчки:

```js
const log = globalThis.print ?? console.log;
```

## Зачем это нужно на практике: пример с Maglev

Node 22 собран без Maglev (`process.config.variables.v8_enable_maglev === 0`), поэтому
средний уровень JIT в нём просто отсутствует. Один и тот же горячий цикл:

```js
function hot(a, b) { return a * b + 1; }
let s = 0;
for (let i = 0; i < 300000; i++) s += hot(i, 3);
```

```bash
$ v8 --trace-opt tier.js   | grep -oE 'to (MAGLEV|TURBOFAN)' | sort | uniq -c
      2 to MAGLEV
      1 to TURBOFAN

$ node --trace-opt tier.js | grep -oE 'to (MAGLEV|TURBOFAN)' | sort | uniq -c
      3 to TURBOFAN
```

В d8 видно оба перехода: функция сначала поднимается в Maglev и только потом в TurboFan.
В Node промежуточной ступени нет вовсе. Это ровно тот случай, когда эксперимент в d8
показывает устройство движка, а эксперимент в Node — устройство конкретной сборки.

## Что не работает даже в d8

Флаги `--print-ast` и `--print-scopes` есть в списке, но в release-сборке за ними нет кода.
Node на них просто молчит, а d8 честно падает:

```
Flag processing error: Contradictory value for readonly flag --print-ast.
```

Нужна debug-сборка. Туда же относятся `--verify-heap` и прочие проверки инвариантов.

Отдельная категория — флаги, которые переименовали. `--trace-ic` из старых статей больше не
существует:

```
Warning: unknown flag --trace-ic.
```

Сейчас это `--log-ic`, и пишет он не в консоль, а в `isolate-*.log`. Общее правило: если
флаг из статьи не работает, ищи похожее имя в `v8 --help` или `node --v8-options`, а не
более старую версию движка.
