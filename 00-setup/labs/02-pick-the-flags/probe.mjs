// Программа-мишень для лабы «Подбери флаги». Менять не нужно.
//
// Три функции с разной судьбой и цикл, который мусорит памятью:
//   hotLoop    вызывается три раза — движку она не интересна;
//   spin       вызывается двести тысяч раз — станет горячей;
//   coldHelper вызывается один раз — нужна как контрольная.

function hotLoop(n) {
  let sum = 0;
  for (let i = 0; i < n; i += 1) sum += i % 7;
  return sum;
}

function spin(a, b) {
  return (a * b + a) % 1000;
}

function coldHelper(x) {
  return x * 3;
}

let acc = 0;
for (let i = 0; i < 3; i += 1) acc += hotLoop(50);
for (let i = 0; i < 200_000; i += 1) acc += spin(i, i + 1);
acc += coldHelper(2);

const junk = [];
for (let i = 0; i < 300_000; i += 1) junk.push({ index: i, tag: `x${i % 100}` });

console.log('готово:', acc, junk.length);
