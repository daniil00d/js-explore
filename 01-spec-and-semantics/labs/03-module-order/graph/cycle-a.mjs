import { helperB } from './cycle-b.mjs';
import { record } from './log.mjs';

record('a:start');
record(`a видит helperB: ${typeof helperB}`);

export function helperA() {
  return 'a';
}

export const labelA = 'A';

record('a:end');
