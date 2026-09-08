import { record } from './log.mjs';

record('slow:start');
// Верхнеуровневый await: выполнение модуля прерывается и продолжится позже.
await null;
record('slow:end');
