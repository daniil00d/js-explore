import { record } from './log.mjs';

record('main:start');
const loading = import('./dyn-child.mjs');
record('main:end');
await loading;
record('main:после await');
