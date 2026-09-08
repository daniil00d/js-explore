// переименовать: count (стр. 6) → hits

const source = { count: 2, label: 'ответ' };

export function main() {
  const { count, label } = source;
  const repeat = (times) => label.repeat(times);
  return { count, text: repeat(count) };
}
