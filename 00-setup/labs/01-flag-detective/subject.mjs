// Подопытная программа. Её задача — вести себя по-разному в четырёх функциях.
// Менять файл не нужно: вся лаба про то, чтобы узнать о нём правду снаружи.
//
// Сама по себе программа ничего интересного не печатает. Интересное появляется,
// когда её запускают с флагами V8.

function sumStable(a, b) {
  return a + b;
}

function sumMixed(a, b) {
  return a + b;
}

function readPoint(point) {
  return point.x * point.y;
}

function neverHot(value) {
  return value * 2;
}

let sink = 0;

for (let i = 0; i < 100_000; i += 1) sink += sumStable(i, i + 1);

for (let i = 0; i < 100_000; i += 1) sink += sumMixed(i, i + 1);
sink += sumMixed('строка', 'ещё строка').length;
for (let i = 0; i < 100_000; i += 1) sink += sumMixed(i, i + 1);

for (let i = 0; i < 100_000; i += 1) sink += readPoint({ x: i, y: 2 });
sink += readPoint({ x: 1, y: 2, z: 3 });
for (let i = 0; i < 100_000; i += 1) sink += readPoint({ x: i, y: 2 });

sink += neverHot(21);

console.log('контрольная сумма:', sink);
