import { record } from './trace.mjs';
import { fromB, valueFromB } from './cycle-b.mjs';

record('a.mjs: тело начало работу');
record(`a.mjs: fromB() -> ${fromB()}`);
try {
  record(`a.mjs: valueFromB -> ${valueFromB}`);
} catch (error) {
  record(`a.mjs: valueFromB -> ${error.constructor.name}: ${error.message}`);
}

export function fromA() {
  return 'функция из a';
}

export const valueFromA = 'значение из a';

record('a.mjs: тело закончило работу');
