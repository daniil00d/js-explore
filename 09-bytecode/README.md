# 09. Байткод Ignition

> Первое представление, в котором код действительно исполняется.

## Зачем это нужно

Байткод — это то, чем JS-функция является большую часть времени: подавляющее большинство
функций никогда не доживают до оптимизирующего компилятора. Чтение байткода даёт прямой
ответ на вопросы «сколько работы стоит эта строка» и «почему две одинаковые на вид записи
компилируются по-разному». Заодно здесь впервые виден feedback vector — механизм, на котором
держатся все дальнейшие оптимизации.

## Что изучаем

- [ ] Регистровая машина против стековой; аккумулятор как неявный регистр
- [ ] Формат инструкций: `Ldar`, `Star`, `Add`, `CallProperty`, `GetNamedProperty`, `Jump*`
- [ ] Кадр интерпретатора: регистры, параметры, контекст, `this`
- [ ] Как читать `node --print-bytecode --print-bytecode-filter=fnName`
- [ ] Bytecode handlers: почему они пишутся на CodeStubAssembler / Torque
- [ ] Feedback vector и слоты: где хранится статистика типов и как она привязана к байткоду
- [ ] Оптимизации на уровне генератора байткода: peephole, register allocation, dead store
- [ ] Размер байткода как метрика: почему компактность важна для памяти
- [ ] Генераторы и `async`: во что превращается приостановка исполнения
- [ ] Сравнение: во что превращаются `for`, `for...of`, `forEach` и spread
- [ ] Builtins: что реализовано в самом движке, а что компилируется из JS

## Ключевые вопросы для самопроверки

1. Зачем V8 нужен аккумулятор вместо честного стека операндов?
2. Что означает пустой слот в feedback vector и когда он заполняется?
3. Почему `for...of` порождает заметно больше байткода, чем индексный `for`?
4. Как в байткоде выглядит приостановка генератора?
5. Почему размер байткода важнее для мобильных устройств, чем скорость его исполнения?

## Ссылки

### Официальное

- [V8: Ignition interpreter design doc](https://docs.google.com/document/d/11T2CRex9hXxoJwbYqVQ32yIPMh0uouUZLdyrtmMoL44/edit) — оригинальный документ
- [V8: Firing up the Ignition interpreter](https://v8.dev/blog/ignition-interpreter)
- [Franziska Hinkelmann: Understanding V8's Bytecode](https://www.fhinkel.rocks/posts/Understanding-V8-s-Bytecode)
  ([та же статья на Medium](https://medium.com/dailyjs/understanding-v8s-bytecode-317d46c94775))
- [V8 internals: Ignition (docs в репозитории)](https://github.com/v8/v8/tree/main/docs)
- [bytecodes.h — список всех инструкций](https://github.com/v8/v8/blob/main/src/interpreter/bytecodes.h)
- [V8: CodeStubAssembler builtins](https://v8.dev/docs/csa-builtins) и [Torque](https://v8.dev/docs/torque)

### Инструменты

- [V8 bytecode в браузере (v8.dev tools)](https://v8.dev/tools) — набор онлайн-инструментов
- `node --print-bytecode --print-bytecode-filter=foo file.mjs`
- `d8 --print-bytecode file.js`

## Что положим в `examples/`

| Файл | Что показывает |
| --- | --- |
| `hello-bytecode.mjs` | Минимальная функция и разбор её байткода построчно |
| `loops-compare.mjs` | `for` / `for...of` / `forEach` — сравнение по инструкциям |
| `feedback-slots.mjs` | Где в байткоде появляются слоты обратной связи |
| `generator.mjs` | Приостановка и возобновление генератора в байткоде |
| `bytecode-notes.md` | Шпаргалка по часто встречающимся инструкциям |
