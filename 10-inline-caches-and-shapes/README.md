# 10. Hidden classes и inline caches

> Как движок восстанавливает то, чего в языке нет: структуру объектов и типы.

## Зачем это нужно

JS-объект по спецификации — словарь. Если бы движок так его и реализовывал, каждый доступ к
полю стоил бы поиска по хеш-таблице. Вместо этого V8 присваивает объектам скрытые классы
(Maps/Shapes) и кеширует по ним доступ прямо в месте вызова. Это самая практически полезная
тема во всём динамическом треке: почти все советы «как писать быстрый JS» — это следствия
устройства скрытых классов, а не магия.

## Что изучаем

- [ ] Hidden class (в терминах V8 — Map, в общей литературе — Shape): что это и зачем
- [ ] Дерево переходов (transition tree): как добавление поля создаёт новый скрытый класс
- [ ] Порядок инициализации полей и почему он меняет скрытый класс
- [ ] Свойства in-object против out-of-object; backing store и его рост
- [ ] Переход в dictionary mode (медленный режим) и что его вызывает: `delete`, много полей
- [ ] Descriptor array, поля против аксессоров
- [ ] Inline cache: monomorphic → polymorphic → megamorphic, и мегаморфный стаб-кеш
- [ ] Как IC связан с feedback vector из раздела 09
- [ ] Elements kinds для массивов: `PACKED_SMI` → `PACKED_DOUBLE` → `PACKED_ELEMENTS` → `DICTIONARY`
- [ ] Дыры в массивах (holey) и почему обратного перехода почти нет
- [ ] Smi против HeapNumber; боксинг чисел
- [ ] Строки в V8: SeqString, ConsString, SlicedString, интернирование
- [ ] Прототипы и валидность прототипной цепочки; почему мутация прототипа так дорого стоит
- [ ] Инструменты: `%DebugPrint`, `%HaveSameMap`, `--trace-ic`, `--trace-maps`

## Ключевые вопросы для самопроверки

1. Почему `{a: 1, b: 2}` и `{b: 2, a: 1}` — это разные скрытые классы?
2. Что происходит с IC, когда в одну функцию приходят объекты пяти разных форм?
3. Почему `delete obj.x` может замедлить весь дальнейший код с этим объектом?
4. Почему `[1, 2, 3]` быстрее, чем `[1, , 3]`, даже при одинаковых операциях?
5. Как один `arr[100] = 1` на массиве из трёх элементов меняет его представление?
6. Как это связано с TypeScript: помогает ли `interface` движку? (см. раздел 05)

## Ссылки

### Базовое

- [Mathias Bynens: JavaScript engine fundamentals — Shapes and Inline Caches](https://mathiasbynens.be/notes/shapes-ics)
- [Mathias Bynens: JavaScript engine fundamentals — optimizing prototypes](https://mathiasbynens.be/notes/prototypes)
- [V8: Elements kinds in V8](https://v8.dev/blog/elements-kinds)
- [V8: Fast properties in V8](https://v8.dev/blog/fast-properties)
- [V8: Optimizing hash tables — hiding the hash code](https://v8.dev/blog/hash-code)

### Углублённое

- [Vyacheslav Egorov: Explaining JS VMs in JS — Inline Caches](https://mrale.ph/blog/2012/06/03/explaining-js-vms-in-js-inline-caches.html)
- [Vyacheslav Egorov: What's up with monomorphism?](https://mrale.ph/blog/2015/01/11/whats-up-with-monomorphism.html)
- [V8: Improving V8 regular expressions](https://v8.dev/blog/regexp-tier-up) — тот же принцип для регулярок
- [V8: Pointer compression](https://v8.dev/blog/pointer-compression) — как представлены значения в куче

### Строки и числа

- [V8: Adventures in the land of substrings and RegExps](https://mrale.ph/blog/2016/11/23/making-less-dart-faster.html)
- [ECMA-262: Number type](https://tc39.es/ecma262/#sec-ecmascript-language-types-number-type)

## Что положим в `examples/`

| Файл | Что показывает |
| --- | --- |
| `hidden-classes.mjs` | `%HaveSameMap` на объектах с разным порядком полей |
| `ic-states.mjs` | Функция уходит из mono в poly и в mega под `--trace-ic` |
| `elements-kinds.mjs` | Переходы вида элементов массива через `%DebugPrint` |
| `dictionary-mode.mjs` | Что делает `delete` со скрытым классом |
| `strings.mjs` | ConsString и цена конкатенации в цикле |
