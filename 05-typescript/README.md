# 05. TypeScript

> Самый мощный статический анализатор в экосистеме JS — и при этом он не влияет на рантайм.

## Зачем это нужно

TypeScript — это два разных инструмента в одном: проверяющий типы анализатор и транспилятор,
который типы просто стирает. Разделение важно принципиально: `tsc` может доказать, что
`x: number`, но V8 об этом ничего не узнает и всё равно построит inline cache по факту.
Понимание этой границы объясняет, почему типизация не ускоряет код сама по себе — и что на
самом деле нужно движку (стабильная форма объектов, а не аннотации).

## Что изучаем

- [ ] Структурная типизация против номинальной; branded types как обходной путь
- [ ] Устройство `tsc`: scanner → parser → binder → checker → transformer → emitter
- [ ] Binder и символы: как имена связываются до проверки типов
- [ ] Вывод типов: снизу вверх, контекстная типизация, обобщённые вызовы
- [ ] Сужение (narrowing) и control flow analysis — прямой аналог dataflow из раздела 03
- [ ] Type guards, discriminated unions, `never` как признак недостижимости
- [ ] Дисперсия (variance) и почему массивы в TS небезопасны by design
- [ ] Осознанные дыры в системе типов: `any`, `as`, bivariance методов, индексный доступ
- [ ] Типы как язык программирования: conditional, mapped, template literal types, рекурсия
- [ ] Стирание типов при компиляции; исключения — enum, декораторы, параметры-свойства
- [ ] `isolatedModules`, `verbatimModuleSyntax` и почему транспиляторы не видят весь проект
- [ ] Инкрементальная сборка, project references, `tsc --noEmit` в CI
- [ ] Производительность проверки типов: где взрывается сложность
- [ ] Порт `tsc` на Go (TypeScript 7) и что это меняет для инструментов

## Ключевые вопросы для самопроверки

1. Почему `tsc` может проверять весь проект, а Babel/SWC умеют только удалять типы?
2. Как narrowing в TS соотносится с анализом потока данных из раздела 03?
3. Даёт ли `x: number` право V8 не проверять тип в рантайме? Почему нет?
4. Почему `Array<Dog>` можно передать в `Array<Animal>`, хотя это небезопасно?
5. Где именно в конвейере `tsc` пропадают типы и что остаётся в выводе?

## Ссылки

### Официальные доки

- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [TypeScript: Type Compatibility](https://www.typescriptlang.org/docs/handbook/type-compatibility.html)
- [TypeScript: Narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html)
- [TSConfig Reference](https://www.typescriptlang.org/tsconfig)
- [Performance wiki](https://github.com/microsoft/TypeScript/wiki/Performance) — что тормозит проверку

### Внутреннее устройство

- [TypeScript: Architectural Overview](https://github.com/microsoft/TypeScript/wiki/Architectural-Overview)
- [Using the Compiler API](https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API)
- [checker.ts (ветка release-5.9)](https://github.com/microsoft/TypeScript/blob/release-5.9/src/compiler/checker.ts) — тот самый файл
- [checker.go (порт на Go, ветка main)](https://github.com/microsoft/TypeScript/blob/main/tsc/internal/checker/checker.go) — он же после переписывания
- [A 10x Faster TypeScript (анонс порта на Go)](https://devblogs.microsoft.com/typescript/typescript-native-port/)

### Разборы и практика

- [Type Challenges](https://github.com/type-challenges/type-challenges) — типы как язык
- [Effective TypeScript (блог автора)](https://effectivetypescript.com/)
- [Marius Schulz: TypeScript Evolution](https://mariusschulz.com/blog/series/typescript-evolution)
- [TypeScript: Do's and Don'ts](https://www.typescriptlang.org/docs/handbook/declaration-files/do-s-and-don-ts.html)

## Что положим в `examples/`

| Файл | Что показывает |
| --- | --- |
| `narrowing-playground.ts` | Сужение типов и его пределы |
| `unsoundness.ts` | Коллекция мест, где система типов сознательно врёт |
| `compiler-api/inspect-types.ts` | Достаём выведенные типы через compiler API |
| `erasure/` | Один файл `.ts` → вывод `tsc`, Babel и SWC; что осталось от типов |
| `types-vs-v8.md` | Проверка: меняет ли типизация hidden class и скорость |
