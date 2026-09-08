import { record } from './trace.mjs';
import { fromA, valueFromA } from './cycle-a.mjs';

record('b.mjs: тело начало работу');
record(`b.mjs: fromA() -> ${fromA()}`);
try {
  record(`b.mjs: valueFromA -> ${valueFromA}`);
} catch (error) {
  record(`b.mjs: valueFromA -> ${error.constructor.name}: ${error.message}`);
}

export function fromB() {
  return 'функция из b';
}

export const valueFromB = 'значение из b';

record('b.mjs: тело закончило работу');
