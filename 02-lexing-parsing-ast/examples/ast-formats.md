# Форматы AST: справочник по различиям

«AST JavaScript» — не один формат, а несколько несовместимых. Разница почти всегда
в именах узлов и мелких деталях полей, из-за чего код переносится между парсерами
не копированием, а переписыванием. Ниже — то, что нужно знать до начала работы.
Живую проверку любого утверждения даёт [`compare-asts.mjs`](./compare-asts.mjs).

## Кто есть кто

| Формат | Кто использует | Особенности |
| --- | --- | --- |
| [ESTree](https://github.com/estree/estree) | acorn, espree (ESLint), Rollup, meriyah | Де-факто стандарт, описан отдельной спекой |
| Babel AST | @babel/parser, jscodeshift, Babel-плагины | ESTree с расхождениями, богаче на поля |
| TypeScript AST | tsc, tsserver, ts-morph, typescript-eslint | Своя система понятий, числовые `kind` |
| SWC AST | SWC, Next.js, Rollup 4 (внутри) | Своё дерево на Rust, наружу — ESTree |
| oxc AST | oxlint, Rolldown | Своё дерево на Rust, близко к ESTree |
| Внутреннее дерево V8 | только сам V8 | Наружу не отдаётся, живёт до байткода |

Смысл ESTree именно в том, что он не привязан к реализации: правило линтера,
написанное под ESTree, работает с любым ESTree-совместимым парсером. Поэтому
`typescript-eslint` конвертирует дерево TypeScript в ESTree — иначе правила ESLint
пришлось бы писать заново.

## Таблица имён узлов

| Конструкция | ESTree | Babel | TypeScript |
| --- | --- | --- | --- |
| строка `"текст"` | `Literal` | `StringLiteral` | `StringLiteral` |
| число `42` | `Literal` | `NumericLiteral` | `NumericLiteral` |
| `null`, `true` | `Literal` | `NullLiteral`, `BooleanLiteral` | `NullKeyword`, `TrueKeyword` |
| регулярка `/ab/g` | `Literal` с полем `regex` | `RegExpLiteral` | `RegularExpressionLiteral` |
| свойство объекта | `Property` | `ObjectProperty` | `PropertyAssignment` |
| метод объекта | `Property` с `method: true` | `ObjectMethod` | `MethodDeclaration` |
| метод класса | `MethodDefinition` | `ClassMethod` | `MethodDeclaration` |
| поле класса | `PropertyDefinition` | `ClassProperty` | `PropertyDeclaration` |
| присваивание | `AssignmentExpression` | `AssignmentExpression` | `BinaryExpression` с `=` |
| `a?.b` | `ChainExpression` → `MemberExpression` | `OptionalMemberExpression` | `PropertyAccessExpression` + `questionDotToken` |
| шаблонная строка | `TemplateLiteral` | `TemplateLiteral` | `TemplateExpression` |
| `-1` | `UnaryExpression` | `UnaryExpression` | `PrefixUnaryExpression` |
| корень файла | `Program` | `File` → `Program` | `SourceFile` |
| объявление `const` | `VariableDeclaration` | `VariableDeclaration` | `VariableStatement` → `VariableDeclarationList` |

## Ловушки, на которые уходит время

**Литералы.** В ESTree и число, и строка, и регулярка — один `Literal`, тип
определяется по `typeof node.value`. Код вида `node.type === 'StringLiteral'`,
привычный по Babel, на ESTree молча не сработает: условие просто никогда не станет
истинным, ошибки не будет.

**Позиции.** У acorn это `start`/`end`, у Babel — `start`/`end` плюс `loc`
(и `range` по опции `ranges`), у TypeScript — `pos`/`end`, причём `pos` включает
идущие перед узлом пробелы и комментарии. Для текста узла в TypeScript нужен
`node.getStart()`, иначе срез захватит лишнее.

**Имя идентификатора.** `node.name` в ESTree и Babel, `node.escapedText`
в TypeScript. «Escaped» здесь про внутреннее экранирование служебных имён, а не
про юникод-escape в исходнике.

**Тип узла.** Строка `node.type` против числа `node.kind`. Обратное отображение
`ts.SyntaxKind[kind]` возвращает не имя узла, а последний псевдоним с тем же
значением: у `NumericLiteral` это `FirstLiteralToken`, у `VariableStatement` —
`FirstStatement`, у `EqualsToken` — `FirstAssignment`. Чтобы получить осмысленное
имя, псевдонимы приходится отфильтровывать — так сделано в примерах раздела.

**Директивы.** Строка в начале программы или функции — не выражение, а директива:
в Babel это `Directive` с `DirectiveLiteral`. Правило, которое ищет строковые
литералы, о `"use strict"` таким образом не узнает.

**Ссылки на родителя.** В ESTree их нет вовсе. Babel даёт пути (`path.parent`),
TypeScript — `node.parent`, но только если дерево построено с `setParentNodes`:
это четвёртый аргумент `createSourceFile`, и без него `node.parent` будет
`undefined`.

## Как выбирать парсер

- **Правило линтера, анализ по проекту** — espree или тот парсер, который уже
  настроен в ESLint. Форма дерева должна совпадать с той, что ждут остальные правила.
- **Кодмод** — @babel/parser с jscodeshift или ts-morph, если код на TypeScript.
  Оба дают области видимости и удобные замены.
- **Быстрый разбор большого количества файлов** — oxc или SWC: они на порядок
  быстрее, но дерево придётся изучать заново.
- **Учебная задача, где важна читаемость** — acorn. Это единственный из
  перечисленных, исходники которого реально читаются целиком за вечер.
- **Что-то, зависящее от типов** — только TypeScript: ни один другой парсер типы
  не выводит, а без вывода `as const` или generic ничего не скажут.

## Инструменты

- [AST Explorer](https://astexplorer.net) — дерево для десятка парсеров в браузере,
  с переключателем. Первое, что стоит открыть при работе с незнакомым форматом.
- [ESTree spec](https://github.com/estree/estree) — определения узлов по версиям
  стандарта, разбито по годам (es5.md, es2015.md и далее).
- [Babel AST spec](https://github.com/babel/babel/blob/main/packages/babel-parser/ast/spec.md) —
  то же для Babel, с явно отмеченными расхождениями с ESTree.
- [TypeScript AST Viewer](https://ts-ast-viewer.com) — дерево TypeScript с типами
  и флагами узлов.
- [ts-morph](https://ts-morph.com) — обёртка над compiler API, если писать на нём
  напрямую неудобно.
