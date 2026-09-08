const { record } = require('./trace.cjs');

record('b.cjs: тело начало работу');
const a = require('./cycle-a.cjs');
record(`b.cjs: получил из a ключи [${Object.keys(a).join(', ')}]`);
record(`b.cjs: a.valueFromA -> ${a.valueFromA}`);

module.exports.fromB = () => 'функция из b';
module.exports.valueFromB = 'значение из b';

record('b.cjs: тело закончило работу');
