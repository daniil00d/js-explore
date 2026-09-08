// В этом файле есть и цели правки, и очень похожие на них места.
// Например, упоминание console.log в комментарии трогать нельзя.

export function greet(name) {
  console.log('привет,', name);
  console.error('это не цель: другой метод');
  return name;
}

export function report(items) {
  console.log(
    'элементов:',
    items.length, // висячая запятая и комментарий должны остаться на месте
  );

  const hint = "в документации написано: напиши console.log(x) и посмотри";
  myConsole.log('чужой объект с тем же методом');
  console['log']('обращение через строку — не цель');
  globalThis.console.log('через globalThis — тоже не цель');
  console.log(`${items.length} штук`);

  return hint;
}

export class Reporter {
  print(value) {
    console.log(value);
  }
}
