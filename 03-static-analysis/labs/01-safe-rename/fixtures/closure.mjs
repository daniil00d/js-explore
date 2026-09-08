// переименовать: count (стр. 4) → hits

export function main() {
  let count = 0;
  const bump = () => {
    count += 1;
    return count;
  };

  bump();
  bump();
  return { count, doubled: count * 2 };
}
