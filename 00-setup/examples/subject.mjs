// Подопытная программа для flag-tour.mjs. Сама по себе печатает одну строку —
// всё интересное про неё рассказывают флаги V8, под которыми её запускают.
//
// Внутри намеренно собраны три сюжета: горячая арифметическая функция, доступ к
// полю у объектов двух разных форм и поток короткоживущих объектов.

function add(a, b) {
  return a + b;
}

function readX(point) {
  return point.x;
}

let sum = 0;
for (let i = 0; i < 2_000_000; i++) {
  sum += add(i, 1);
}

for (let i = 0; i < 200_000; i++) {
  sum += readX({ x: i });
}

// Тот же доступ к .x, но у объектов другой скрытый класс: поле x теперь второе.
for (let i = 0; i < 200_000; i++) {
  sum += readX({ y: 0, x: i });
}

let garbage = [];
for (let i = 0; i < 300_000; i++) {
  garbage.push({ index: i, payload: `item-${i}` });
  if (garbage.length > 1000) garbage = [];
}

console.log(`sum=${sum} tail=${garbage.length}`);
