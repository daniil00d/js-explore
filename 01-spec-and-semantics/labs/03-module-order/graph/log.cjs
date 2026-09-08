// Тот же журнал для CommonJS-графа.

const steps = [];

exports.record = (step) => {
  steps.push(step);
};

exports.drain = () => steps.splice(0, steps.length);
