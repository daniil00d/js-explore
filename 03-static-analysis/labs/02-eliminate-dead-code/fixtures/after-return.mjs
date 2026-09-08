// Строки, которые обязан убрать оптимизатор, помечены комментарием «мёртвый».

export function classify(value) {
  if (value > 0) {
    return 'плюс';
    console.log('плюс уже вернули'); // мёртвый
  }

  if (value === 0) return 'ноль';

  return 'минус';
}

export function trim(text) {
  return helper(text);

  // Не помечено: объявление функции всплывает. Сама инструкция не выполняется,
  // но привязка helper создаётся при входе в функцию — вызов выше работает.
  function helper(value) {
    return value.trim();
  }
}

export function count(list) {
  return list.length;
  var counted = list.length; // тоже объявление: привязка есть, присваивания нет
}

export function main() {
  return { classify: classify(1), trim: trim('  ок  '), count: count([1, 2]) };
}
