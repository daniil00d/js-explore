// Замер стоимости разбора: генерируем большой файл и компилируем его через node:vm.
// Запускается дочерним процессом из lazy-parsing.mjs с разными флагами V8.
// Результат печатается одной строкой JSON.

import vm from 'node:vm';

const functionCount = Number(process.env.FUNCTION_COUNT ?? 3000);
const attempts = Number(process.env.ATTEMPTS ?? 3);

const parts = [];
for (let index = 0; index < functionCount; index += 1) {
  parts.push(
    `function generated${index}(a, b) {\n` +
      '  let acc = 0;\n' +
      '  for (let j = 0; j < 8; j++) { acc += (a * j + b) % 7; }\n' +
      `  const payload = { a, b, acc, tag: "generated${index}" };\n` +
      '  return acc + payload.acc - Object.keys(payload).length;\n' +
      '}\n',
  );
}
const source = parts.join('\n');

const timings = [];
for (let attempt = 0; attempt < attempts; attempt += 1) {
  const started = process.hrtime.bigint();
  // Имя файла одно и то же во всех попытках: кеш компиляции V8 учитывает и его.
  new vm.Script(source, { filename: 'generated.js' });
  timings.push(Number(process.hrtime.bigint() - started) / 1e6);
}

console.log(
  JSON.stringify({
    functionCount,
    sourceKiB: Math.round(source.length / 1024),
    timings,
  }),
);
