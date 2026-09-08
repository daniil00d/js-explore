# Лаба 00-1. Детектив по флагам

**Сложность:** для начала. **Что тренируем:** чтение логов V8.

## Задача

В [`subject.mjs`](./subject.mjs) четыре функции. Со стороны они выглядят одинаково
безобидно, но движок обошёлся с ними по-разному: одну оптимизировал и оставил
в покое, две оптимизировал и потом отобрал оптимизацию обратно, а четвёртую даже
не рассматривал.

Выясни, что именно с ними произошло, не меняя `subject.mjs`. Ответы впиши
в [`answers.mjs`](./answers.mjs).

## Как проверить

```bash
node 00-setup/labs/01-flag-detective/check.mjs
```

Проверка не хранит правильных ответов: она сама запускает `subject.mjs` с флагами
и сверяет твои ответы с тем, что сказал движок. Поэтому лаба остаётся честной и на
другой версии V8, где числа и причины могут отличаться.

## С чего начать

Три инструмента из этого раздела, каждого хватает для части ответов:

```bash
node --trace-opt   00-setup/labs/01-flag-detective/subject.mjs
node --trace-deopt 00-setup/labs/01-flag-detective/subject.mjs
node --allow-natives-syntax 00-setup/examples/optimization-status.mjs
```

Вывода будет много, и почти весь он не про наши функции: движок оптимизирует и
собственный код тоже. Полезно сузить:

```bash
node --trace-opt 00-setup/labs/01-flag-detective/subject.mjs 2>&1 | grep sumMixed
```

Ориентиры по формату строк — в [`../../examples/flags-cheatsheet.md`](../../examples/flags-cheatsheet.md).

## Критерий готовности

`5 из 5` в отчёте проверки.

## Если застрял

<details>
<summary>Подсказка 1: где искать имена функций</summary>

В логах имя стоит внутри `<JSFunction имя (sfi = 0x…)>`. Записи с пустым именем
(`<JSFunction (sfi = …)>`) — это тело самого модуля, а не одна из четырёх функций.
</details>

<details>
<summary>Подсказка 2: как выглядит «отправлена в TurboFan»</summary>

Строка со словом `marking`:

```
[marking 0x… <JSFunction sumStable (sfi = …)> for optimization to TURBOFAN, …]
```

Дальше по той же функции будут `compiling method` и `completed optimizing`.
</details>

<details>
<summary>Подсказка 3: как выглядит деоптимизация</summary>

Строка со словом `bailout`, причина стоит после `reason:`:

```
[bailout (kind: deopt-eager, reason: …): begin. deoptimizing 0x… <JSFunction … >, … <Code TURBOFAN>, …]
```
</details>

<details>
<summary>Подсказка 4: почему одна функция не попала ни в один лог</summary>

Оптимизация начинается не сразу: функция должна стать «горячей». Посмотри, сколько
раз вызывается каждая из четырёх.
</details>

## Разбор

Полные ответы с объяснением — в [`solution.mjs`](./solution.mjs). Там же команды,
которыми они получены. Посмотреть, как выглядит зачёт, можно так:

```bash
node 00-setup/labs/01-flag-detective/check.mjs --solution
```

Почему деоптимизация вообще случается, что такое скрытый класс и чем `not a Smi`
отличается от `wrong map` — разделы [10](../../../10-inline-caches-and-shapes)
и [11](../../../11-optimization-and-deopt). В этой лабе достаточно уметь это увидеть.
