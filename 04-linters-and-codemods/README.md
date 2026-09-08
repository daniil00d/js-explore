# 04. Линтеры и кодмоды

> Прикладной статический анализ: правила, которые ловят баги, и трансформации, которые
> переписывают код за нас.

## Зачем это нужно

Здесь теория из раздела 03 превращается в инструмент, которым пользуются каждый день.
Написать своё правило ESLint — самый быстрый способ прочувствовать, что такое AST, scope и
консервативность анализа: правило либо шумит ложными срабатываниями, либо пропускает баги, и
компромисс приходится выбирать руками.

## Что изучаем

- [ ] Архитектура ESLint: парсер → AST → обход → правила → сообщения → фиксы
- [ ] Селекторы узлов и `SourceCode` API; `context.report` и `fix`
- [ ] Scope analysis в правилах: `eslint-scope`, переменные и ссылки
- [ ] Правила с типами: `typescript-eslint` и почему type-aware правила настолько медленнее
- [ ] Автофиксы против suggestions; когда фикс небезопасен
- [ ] Тестирование правил через `RuleTester`
- [ ] Форматтеры против линтеров: Prettier печатает AST заново, а не правит текст
- [ ] Кодмоды: `jscodeshift`, `ts-morph`, `@babel/traverse` — массовые миграции
- [ ] Сохранение форматирования и комментариев при перезаписи (recast)
- [ ] Семантический поиск: Semgrep, CodeQL, `ast-grep`
- [ ] Где линтер принципиально бессилен и нужен рантайм-тест

## Ключевые вопросы для самопроверки

1. Почему правило `no-unused-vars` не может быть одновременно точным и без ложных срабатываний?
2. Что именно делает правило «type-aware» и откуда берётся его стоимость?
3. Почему Prettier не сохраняет большую часть исходного форматирования — и это by design?
4. Чем кодмод отличается от regex-замены на масштабе тысячи файлов?

## Ссылки

### Официальные доки

- [ESLint: Custom Rules](https://eslint.org/docs/latest/extend/custom-rules)
- [ESLint: Custom Rule Tutorial](https://eslint.org/docs/latest/extend/custom-rule-tutorial)
- [ESLint: объект `context` в правиле](https://eslint.org/docs/latest/extend/custom-rules#the-context-object)
- [typescript-eslint: Custom Rules](https://typescript-eslint.io/developers/custom-rules/)
- [typescript-eslint: Typed Linting](https://typescript-eslint.io/getting-started/typed-linting/)
- [Prettier: Rationale](https://prettier.io/docs/rationale)

### Кодмоды

- [jscodeshift](https://github.com/facebook/jscodeshift)
- [ts-morph](https://ts-morph.com/)
- [recast](https://github.com/benjamn/recast) — печать AST с сохранением исходного стиля
- [@babel/traverse](https://babeljs.io/docs/babel-traverse)
- [codemod.com registry](https://github.com/codemod-com/codemod) — примеры реальных миграций

### Семантический поиск

- [ast-grep](https://ast-grep.github.io/)
- [Semgrep rule syntax](https://semgrep.dev/docs/writing-rules/rule-syntax)
- [CodeQL for JavaScript](https://codeql.github.com/docs/codeql-language-guides/codeql-for-javascript/)

## Что положим в `examples/`

| Файл | Что показывает |
| --- | --- |
| `custom-rule/no-array-index-key.js` | Своё правило ESLint с тестами через `RuleTester` |
| `custom-rule/with-scope.js` | Правило, которому нужен scope-анализ, а не только форма узла |
| `codemod-rename-api.mjs` | Кодмод: переименование API по всему проекту с сохранением стиля |
| `type-aware-rule.md` | Замер: сколько стоит type-aware линтинг на реальном проекте |
