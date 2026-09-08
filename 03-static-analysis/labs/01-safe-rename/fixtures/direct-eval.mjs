// переименовать: secret (стр. 5) → token
// ожидается: отказ, в причине — «eval»: он видит область целиком, включая это имя

export function main() {
  const secret = 'ключ-42';
  const expression = 'secret';
  return { direct: eval(expression) };
}
