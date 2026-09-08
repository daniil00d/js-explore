// Тот же журнал, что и в trace.mjs, но для CommonJS: модули двух систем не могут
// делить один экземпляр модуля, поэтому и журнала два.

const trace = [];

module.exports.trace = trace;
module.exports.record = (message) => trace.push(message);
module.exports.drain = () => trace.splice(0, trace.length);
