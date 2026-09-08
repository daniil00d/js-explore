const a = require('./cycle-a.cjs');
const { record } = require('./log.cjs');

record('b:start');
record(`b видит helperA: ${typeof a.helperA}`);
record(`b видит labelA: ${a.labelA}`);

exports.helperB = function helperB() {
  return 'b';
};

record('b:end');
