# Шпаргалка по флагам V8

Все команды проверены на `node v22.14.0 / V8 12.4.254.21-node.22, linux-x64`. Набор флагов
меняется от версии к версии: если что-то не работает, первым делом ищи флаг в
`node --v8-options`, а не в интернете.

## Как передавать флаги

```bash
node --trace-opt script.mjs                  # напрямую в Node
d8 --trace-opt script.js                     # в отладочной оболочке V8
chrome --js-flags="--trace-opt"              # в браузере
NODE_OPTIONS="--max-old-space-size=64" npm test      # через окружение
```

`NODE_OPTIONS` пропускает только белый список. Диагностические флаги в него почти не входят:

```bash
NODE_OPTIONS="--trace-gc" node -e 1
# node: --trace-gc is not allowed in NODE_OPTIONS
```

Разрешены, например, `--max-old-space-size`, `--max-semi-space-size`, `--expose-gc`,
`--heap-prof`, `--perf-basic-prof`, `--stack-trace-limit`. Запрещены `--allow-natives-syntax`,
`--trace-gc`, `--trace-deopt`, `--cpu-prof` и почти всё остальное из этой шпаргалки — их
приходится писать прямо в командной строке. Когда нужно пробросить флаги в чужой запуск
(например, в тесты), помогает обёртка вида `node --trace-gc ./node_modules/.bin/jest`.

## Разведка

```bash
node --v8-options                            # все флаги этой сборки с описаниями
node --v8-options | grep -i maglev           # найти флаг по теме
node --print-flag-values | grep gc           # какие значения действуют сейчас
node -p "process.config.variables"           # что включено на этапе сборки V8
```

Отрицание любого булева флага — префикс `no`: `--no-opt`, `--no-lazy`, `--no-turbofan`,
`--no-concurrent-recompilation`. В `--v8-options` перечислены только положительные имена.

## 02. Парсинг и AST

```bash
node --no-lazy script.js                     # выключить ленивый парсинг целиком
node --log-function-events script.js         # когда какая функция разобрана и скомпилирована
awk -F, '/^function,/{print $2}' isolate-*.log | sort | uniq -c | sort -rn
```

`--log-function-events` пишет в `isolate-*.log` записи `preparse-resolution`, `full-parse`,
`first-execution` — это и есть ленивый парсинг в наблюдаемом виде: функция сначала бегло
просматривается, а полностью разбирается только перед первым вызовом.

`--print-ast` и `--print-scopes` в шпаргалках встречаются часто, но в release-сборке (а Node
собран именно так) они молчат: код за ними компилируется только в debug-сборке V8.

## 09. Байткод

```bash
node --print-bytecode --print-bytecode-filter=имяФункции script.mjs
node --print-bytecode-filter='*' script.mjs  # весь байткод, включая внутренности Node
```

Фильтр обязателен: без него на экран выпадет несколько тысяч функций самого Node.
`--print-bytecode-filter` понимает `*` как «всё».

## 08. Уровни компиляции

```bash
node --trace-opt script.mjs                  # что и когда ушло в оптимизирующий компилятор
node --trace-opt-verbose script.mjs          # плюс причины отказа от оптимизации
node --trace-baseline script.mjs             # работа Sparkplug (пакетная компиляция)
node --trace-osr script.mjs                  # замена кода на лету внутри долгого цикла
node --invocation-count-for-turbofan=10 --trace-opt script.mjs   # оптимизировать почти сразу
node --maglev --trace-opt script.mjs         # если сборка собрана с Maglev
```

Проверить, что уровни вообще доступны:

```bash
node -p "process.config.variables.v8_enable_maglev"   # 0 — Maglev выключен на этапе сборки
```

Отключить уровни, чтобы увидеть разницу:

```bash
node --no-opt script.mjs                     # без оптимизирующих компиляторов
node --no-sparkplug script.mjs               # без базового компилятора
node --jitless script.mjs                    # только интерпретатор, без генерации машинного кода
node --always-turbofan script.mjs            # оптимизировать всё и сразу (медленно, но наглядно)
```

## 10. Скрытые классы и inline caches

```bash
node --log-ic script.mjs                     # состояния IC → в isolate-*.log
node --log-maps --log-maps-details script.mjs        # создание скрытых классов и переходы
node --log-feedback-vector script.mjs        # содержимое векторов обратной связи
```

Все три пишут не в консоль, а в `isolate-<pid>-v8.log` рядом с процессом. Лог обрабатывают
`tools/ic-processor` и `tools/map-processor` из репозитория V8 либо
[deoptigate](https://github.com/thlorenz/deoptigate), который показывает то же самое поверх
исходников.

Быстрая альтернатива без логов — служебные функции: `%HaveSameMap`, `%HasFastProperties`,
`%DebugPrint` (см. `natives-syntax.mjs`).

## 11. Оптимизации и деоптимизация

```bash
node --trace-deopt script.mjs                # каждая деоптимизация с причиной
node --print-opt-code --print-opt-code-filter=имяФункции script.mjs   # машинный код после TurboFan
node --trace-turbo --trace-turbo-filter=имяФункции script.mjs         # граф IR по фазам
node --deopt-every-n-times=100 script.mjs    # искусственно ронять оптимизацию (стресс-тест)
```

`--trace-turbo` кладёт рядом `turbo-<функция>-0.json` — этот файл открывается в
[Turbolizer](https://github.com/v8/v8/tree/main/tools/turbolizer).

Типичные причины в выводе `--trace-deopt`, которые стоит узнавать в лицо:

| Причина | Что произошло |
| --- | --- |
| `wrong map` | у объекта оказалась другая форма, чем предполагал компилятор |
| `not a Smi` | ожидалось малое целое, пришло дробное или объект |
| `Insufficient type feedback for ...` | код оптимизировали раньше, чем собралась статистика |
| `deopt-eager` | проверка провалилась прямо сейчас, на входе в операцию |
| `deopt-lazy` | код признан невалидным задним числом (например, изменили прототип) |

## 12. Память и сборка мусора

```bash
node --trace-gc script.mjs                   # одна строка на каждую паузу
node --trace-gc-verbose script.mjs           # плюс состояние пространств кучи
node --trace-gc-nvp script.mjs               # машиночитаемый формат «ключ=значение»
node --expose-gc script.mjs                  # появляется global.gc() для ручного запуска
node --max-old-space-size=64 script.mjs      # ограничить старое поколение, чтобы ускорить утечку
node --max-semi-space-size=1 script.mjs      # уменьшить молодое поколение
node --heap-prof script.mjs                  # профиль аллокаций в формате DevTools
```

Снимок кучи из кода: `require('v8').writeHeapSnapshot()`, открывается в DevTools → Memory.

## 13. WebAssembly

```bash
node --print-wasm-code module.mjs            # машинный код модуля
node --trace-wasm-compiler module.mjs        # работа компиляторов Wasm
node --no-liftoff module.mjs                 # сразу TurboFan, без быстрого базового уровня
node --wasm-tier-up module.mjs               # поведение многоуровневой компиляции
```

## 14. Профилирование

```bash
node --cpu-prof --cpu-prof-dir=./prof script.mjs     # *.cpuprofile → DevTools → Performance
node --prof script.mjs && node --prof-process isolate-*.log | head -40   # текстовый профиль
node --perf-basic-prof script.mjs            # чтобы linux perf видел JIT-кадры
node --single-threaded --predictable script.mjs      # убрать шум фоновых потоков
```

`--predictable` делает запуск детерминированным (одно- поточная компиляция, фиксированный
планировщик) — полезно для сравнения логов между прогонами, но не для замеров скорости.

## Служебные функции (natives syntax)

```bash
node --allow-natives-syntax script.mjs
```

Открывает `%`-функции: `%GetOptimizationStatus`, `%PrepareFunctionForOptimization`,
`%OptimizeFunctionOnNextCall`, `%NeverOptimizeFunction`, `%DebugPrint`, `%HaveSameMap`,
`%HasFastProperties`, `%CollectGarbage`. Полный список — `src/runtime/runtime.h` нужной
версии V8. Обёртки и проверка доступности — в `natives.mjs`.

## Ловушки

- Флаги, меняющие политику компиляции (`--always-turbofan`, `--no-opt`, `--jitless`,
  `--deopt-every-n-times`), делают замеры скорости бессмысленными. Они для наблюдения, а не
  для бенчмарков.
- `--print-bytecode` и `--print-opt-code` без фильтра выдают десятки тысяч строк: сначала
  фильтр, потом запуск.
- Логи `isolate-*.log` пишутся в текущий каталог и быстро растут до сотен мегабайт.
  Запускай такие эксперименты в отдельной папке.
- Адреса в выводе (`0x2c48d83c9c89`) меняются от запуска к запуску — сравнивать по ним
  ничего нельзя.
- Вывод любого из этих флагов — не стабильный интерфейс. Между версиями V8 меняются и
  формулировки причин деоптимизации, и формат строк.
