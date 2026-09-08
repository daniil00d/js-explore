const { record } = require('./trace.cjs');

record('a.cjs: тело начало работу');
const b = require('./cycle-b.cjs');
record(`a.cjs: получил из b ключи [${Object.keys(b).join(', ')}]`);

module.exports.fromA = () => 'функция из a';
module.exports.valueFromA = 'значение из a';

record('a.cjs: тело закончило работу');
