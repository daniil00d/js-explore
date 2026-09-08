// Строки, которые обязан убрать оптимизатор, помечены комментарием «мёртвый».

export function build(config) {
  const format = (value) => {
    if (value === null) {
      return '—';
      console.log('null уже обработали'); // мёртвый
    }
    return String(value);
  };

  const rows = Object.entries(config).map(([key, value]) => {
    return `${key}=${format(value)}`;
    console.log('после return в колбэке'); // мёртвый
  });

  // Условие — литерал, поэтому в графе нет ребра в тело. Сама строка с `if`
  // достижима: до проверки условия управление доходит.
  if (false) {
    rows.push('отладочная строка'); // мёртвый
  }

  return rows;
}

export function main() {
  return { rows: build({ a: 1, b: null }) };
}
