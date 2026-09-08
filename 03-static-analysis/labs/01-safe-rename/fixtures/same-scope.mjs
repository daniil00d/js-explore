// переименовать: temp (стр. 5) → result
// ожидается: отказ, в причине — «result»: имя уже объявлено в той же области

export function main() {
  let temp = 1;
  const result = 2;
  temp += result;
  return { temp, result };
}
