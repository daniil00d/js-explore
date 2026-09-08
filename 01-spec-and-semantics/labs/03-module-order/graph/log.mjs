// Общий журнал для ESM-графов лабы.

export const steps = [];

export function record(step) {
  steps.push(step);
}

export function drain() {
  return steps.splice(0, steps.length);
}
