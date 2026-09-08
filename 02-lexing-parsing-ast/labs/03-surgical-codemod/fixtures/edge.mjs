// Пограничные случаи: вложенность, отсутствие блока, ссылка без вызова.

export function nested(value) {
  console.log(/* комментарий внутри аргументов */ value);
  console.log(console.log(value));

  if (value) console.log('инструкция без блока');

  // Ссылка на метод, а не вызов: правка её не касается.
  const call = console.log;
  call('через ссылку');

  const handlers = {
    log: console.log,
    run: () => console.log('из стрелки'),
  };

  return handlers;
}
