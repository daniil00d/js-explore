import { helperA, labelA } from './cycle-a.mjs';
import { record } from './log.mjs';

record('b:start');
record(`b видит helperA: ${typeof helperA}`);
try {
  record(`b видит labelA: ${labelA}`);
} catch (error) {
  record(`b видит labelA: ${error.constructor.name}`);
}

export function helperB() {
  return 'b';
}

record('b:end');
