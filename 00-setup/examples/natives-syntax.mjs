// Тур по служебным функциям V8, кроме статуса оптимизации: форма объектов, виды
// элементов массива, внутреннее представление строк.
//
// Запуск:          node --allow-natives-syntax 00-setup/examples/natives-syntax.mjs
// С дампами кучи:  node --allow-natives-syntax 00-setup/examples/natives-syntax.mjs --debug-print

import { natives, probeNative, requireNatives } from './natives.mjs';

requireNatives(import.meta.filename);

const {
  haveSameMap,
  hasFastProperties,
  hasSmiElements,
  hasDoubleElements,
  hasObjectElements,
  hasHoleyElements,
  hasDictionaryElements,
  isSmi,
  flattenString,
  debugPrint,
} = natives;

const withDebugPrint = process.argv.includes('--debug-print');

function section(title) {
  console.log(`\n${title}`);
  console.log('='.repeat(title.length));
  console.log();
}

function line(label, value) {
  console.log(`  ${label.padEnd(34)} ${value}`);
}

function elementsKind(array) {
  if (hasDictionaryElements(array)) return 'DICTIONARY';
  const kind =
    (hasSmiElements(array) && 'SMI') ||
    (hasDoubleElements(array) && 'DOUBLE') ||
    (hasObjectElements(array) && 'OBJECT') ||
    '?';
  return `${kind} ${hasHoleyElements(array) ? '(HOLEY)' : '(PACKED)'}`;
}

section('Форма объекта: %HaveSameMap');
const base = { x: 1, y: 2 };
line('{x,y} и {x,y}', haveSameMap(base, { x: 3, y: 4 }));
line('{x,y} и {y,x}', haveSameMap(base, { y: 3, x: 4 }));
line('{x,y} и {x,y,z}', haveSameMap(base, { x: 1, y: 2, z: 3 }));
const grown = { x: 1 };
grown.y = 2;
line('{x,y} и {x} + присвоенный y', haveSameMap(base, grown));
const numeric = { x: 1, y: 2.5 };
line('{x:1,y:2} и {x:1,y:2.5}', haveSameMap(base, numeric));
console.log('\n  Порядок добавления полей — часть формы объекта, а не деталь записи.');
console.log('  Последняя строка показывает больше: в форму входит и представление поля,');
console.log('  поэтому целое и дробное значение в одном и том же поле дают разные формы.');

section('Быстрые свойства против словаря: %HasFastProperties');
const point = { x: 1, y: 2 };
line('свежий объект', hasFastProperties(point));
delete point.x;
line('после delete point.x', hasFastProperties(point));
const many = {};
for (let i = 0; i < 200; i++) many[`k${i}`] = i;
line('объект с 200 полями', hasFastProperties(many));

section('Виды элементов массива');
const array = [1, 2, 3];
line('[1, 2, 3]', elementsKind(array));
array.push(4.5);
line('после push(4.5)', elementsKind(array));
array.push('строка');
line("после push('строка')", elementsKind(array));
array[100] = 1;
line('после array[100] = 1', elementsKind(array));

const holey = [1, 2, 3];
delete holey[1];
line('[1,2,3] после delete holey[1]', elementsKind(holey));

const sparse = [];
for (let i = 0; i < 100; i++) sparse[i * 1000] = i;
line('100 элементов с шагом 1000', elementsKind(sparse));
console.log('\n  Переходы идут только в одну сторону: обратно в SMI массив уже не вернётся.');

section('Числа: Smi против HeapNumber');
line('42', isSmi(42));
line('42.5', isSmi(42.5));
line('2 ** 31 - 1', isSmi(2 ** 31 - 1));
line('2 ** 31', isSmi(2 ** 31));
line('-(2 ** 31)', isSmi(-(2 ** 31)));
line('Number.MAX_SAFE_INTEGER', isSmi(Number.MAX_SAFE_INTEGER));
line('-0', isSmi(-0));
console.log('\n  Что не влезло в Smi, живёт в куче отдельным HeapNumber — включая -0,');
console.log('  который обязан отличаться от 0 по спецификации.');
console.log('  Ширина Smi зависит от сборки: 32 бита здесь, 31 бит при указательном сжатии.');

section('Строки: ConsString и выравнивание');
let text = '';
for (let i = 0; i < 5; i++) text += `chunk${i}`;
console.log(`  Собрано конкатенацией: ${text}`);
console.log('  Внутри это дерево из кусков (CONS_ONE_BYTE_STRING_TYPE), а не плоский буфер.');
console.log('  %FlattenString копирует его в непрерывную строку (SEQ_ONE_BYTE_STRING_TYPE).');
if (withDebugPrint) {
  console.log('\n  --- %DebugPrint до выравнивания ---');
  debugPrint(text);
  console.log('\n  --- %DebugPrint после %FlattenString ---');
  debugPrint(flattenString(text));
} else {
  console.log('\n  Запусти с --debug-print, чтобы увидеть обе структуры целиком.');
}

if (withDebugPrint) {
  section('Полный дамп объекта: %DebugPrint');
  debugPrint({ x: 1, y: 2 });
}

section('Что есть в этой сборке: probeNative');
const interesting = [
  ['GetOptimizationStatus', 1],
  ['OptimizeMaglevOnNextCall', 1],
  ['CompileBaseline', 1],
  ['HaveSameMap', 2],
  ['DebugPrint', 1],
  ['CollectGarbage', 1],
  ['HasFastProperties', 1],
  ['IsBeingInterpreted', 0],
  ['SystemBreak', 0],
  ['HeapObjectVerify', 1],
  ['MapId', 1],
  ['GetHeapUsage', 0],
];
for (const [name, arity] of interesting) {
  line(`%${name}`, probeNative(name, arity) ? 'есть' : 'нет в этой сборке');
}
console.log('\n  Полный список — в src/runtime/runtime.h нужной версии V8.');
console.log(`\n  node ${process.version} / V8 ${process.versions.v8}\n`);
