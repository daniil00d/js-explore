# Примеры: лексер, парсер и AST

Первый раздел с зависимостями. Перед запуском:

```bash
npm install
```

Ставятся `acorn`, `acorn-walk`, `@babel/parser`, `@babel/traverse`,
`@babel/generator` и `typescript@5`. Проверено на `node v22.14.0 / V8 12.4`.

Про `typescript@5` отдельно: `npm install typescript` сейчас ставит седьмую версию,
Go-порт, у которого классический compiler API переехал в `typescript/unstable/*`.
Примеры здесь пользуются обычным API, поэтому версия зафиксирована пятая — подробнее
в [../../00-setup/examples/static-toolchain.md](../../00-setup/examples/static-toolchain.md).

## Быстрый старт

```bash
node 02-lexing-parsing-ast/examples/tokenize.mjs
node 02-lexing-parsing-ast/examples/parse-with-acorn.mjs
node 02-lexing-parsing-ast/examples/compare-asts.mjs
node 02-lexing-parsing-ast/examples/precedence.mjs
node 02-lexing-parsing-ast/examples/walk-and-transform.mjs
node 02-lexing-parsing-ast/examples/error-recovery.mjs
node 02-lexing-parsing-ast/examples/lazy-parsing.mjs
```

## Что где

| Файл | О чём |
| --- | --- |
| [`tokenize.mjs`](./tokenize.mjs) | Токены руками и место, где лексер обязан спросить парсер |
| [`lexer.mjs`](./lexer.mjs) | Сам мини-лексер, отдельным модулем для переиспользования |
| [`parse-with-acorn.mjs`](./parse-with-acorn.mjs) | Дерево, позиции, комментарии и что теряет «абстрактность» |
| [`compare-asts.mjs`](./compare-asts.mjs) | Один код → ESTree, Babel и TypeScript: чем отличаются |
| [`precedence.mjs`](./precedence.mjs) | Разбор выражений методом Пратта, сверенный с acorn |
| [`walk-and-transform.mjs`](./walk-and-transform.mjs) | Обход, области видимости, правка дерева и печать обратно |
| [`error-recovery.mjs`](./error-recovery.mjs) | Дерево из сломанного кода: как это делают редакторы |
| [`lazy-parsing.mjs`](./lazy-parsing.mjs) | Preparser V8 по логам движка и стоимость разбора в миллисекундах |
| [`ast-formats.md`](./ast-formats.md) | Справочник различий между форматами дерева |
| [`parsing-in-v8.md`](./parsing-in-v8.md) | Как разбирает V8: preparser, ленивость, кеши |
| [`fixtures/`](./fixtures) | Подопытные файлы для примера про ленивый разбор |

## В каком порядке читать

1. **`tokenize.mjs`** — из чего вообще состоит вход парсера. Главное здесь не
   таблица токенов, а последний раздел: лексер без парсера не работает.
2. **`parse-with-acorn.mjs`** — дерево и его связь с текстом. Отсюда понятно, что
   именно даёт позиция узла и почему по дереву нельзя восстановить исходник.
3. **`precedence.mjs`** — как из плоского потока токенов получается вложенность.
   Пратт-парсер здесь не иллюстрация, а проверяемая реализация: его дерево
   сравнивается с деревом acorn на каждом выражении.
4. **`compare-asts.mjs`** и [`ast-formats.md`](./ast-formats.md) — три формата
   дерева рядом. Читать перед первым кодмодом, а не после.
5. **`walk-and-transform.mjs`** — обход, области видимости, правка и печать.
   Прямой пролог к разделам 04 и 06.
6. **`error-recovery.mjs`** — почему редактор понимает недописанный код, а линтер
   в CI на нём падает, и почему это правильно для обоих.
7. **`lazy-parsing.mjs`** вместе с [`parsing-in-v8.md`](./parsing-in-v8.md) —
   что со всем этим делает движок и сколько стоит разбор в миллисекундах.

## Как это устроено внутри

Печать вывода вынесена в [`../../tools/format.mjs`](../../tools/format.mjs):
таблицы, заголовки, заметки. Раздел 01 держит свою копию этих помощников, потому
что там они сплетены с запуском фрагментов через `node:vm`.

`lazy-parsing.mjs` устроен как раздел 00: он запускает Node дочерними процессами
с флагами V8, читает лог движка и показывает выжимку. Логи пишутся во временный
каталог и удаляются, в репозиторий ничего не попадает.

## Что стоит попробовать самому

- В `precedence.mjs` поменяйте приоритет одного оператора в `BINARY_PRECEDENCE`
  и посмотрите, на каких выражениях колонка «совпало» станет `нет`. Это лучший
  способ убедиться, что таблица приоритетов — не украшение.
- Добавьте в `lexer.mjs` поддержку `#private` полей или `?.` как отдельного вида
  токена и проверьте на `tokenize.mjs`.
- В `walk-and-transform.mjs` попробуйте переименовать не `send`, а `payload`:
  через `Program`-область ничего не произойдёт, потому что привязка живёт внутри
  функции. Это хорошая иллюстрация к тому, что область видимости — не файл.
- Прогоните `lazy-parsing.mjs` на своём бандле: подставьте путь к файлу вместо
  `fixtures/lazy-subject.js` и посмотрите, сколько функций в нём получает полный
  разбор на старте.
- Сравните `compare-asts.mjs` с [AST Explorer](https://astexplorer.net) — там же
  есть парсеры, которых нет в примере: meriyah, esprima, oxc, swc.
