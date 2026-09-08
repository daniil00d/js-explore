// Общий журнал для примеров про порядок выполнения модулей.

export const trace = [];

export function record(message) {
  trace.push(message);
}

export function drain() {
  const entries = trace.slice();
  trace.length = 0;
  return entries;
}
