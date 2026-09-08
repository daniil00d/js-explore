const { record } = require('./log.cjs');

record('a:start');
const b = require('./cycle-b.cjs');
record(`a видит helperB: ${typeof b.helperB}`);

exports.helperA = function helperA() {
  return 'a';
};

exports.labelA = 'A';

record('a:end');
