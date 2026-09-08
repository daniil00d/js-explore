let counter = 0;

module.exports.counter = counter;
module.exports.bump = () => {
  counter += 1;
  module.exports.counter = counter;
};
