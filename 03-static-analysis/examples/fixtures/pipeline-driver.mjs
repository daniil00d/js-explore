// Драйвер для call-graph.mjs: гоняет pipeline.mjs так, как его гоняли бы в бою.
//
// Экспортирует функцию, а не выполняется сам, потому что тот же сценарий нужно
// прогнать дважды: на исходном модуле и на его инструментированной копии.

export function run(pipeline) {
  const middleware = (request) => ({ ...request, checked: true });

  return [
    pipeline.process({ kind: 'create', payload: { id: 1 } }, middleware),
    pipeline.process({ kind: 'UPDATE', payload: { id: 2 } }, middleware),
    pipeline.process({ kind: 'remove', payload: { id: 3 } }, middleware),
    pipeline.process({ kind: 'archive', payload: { id: 4 } }, middleware),
    ...pipeline.runAll([{ kind: 'create', payload: { id: 5 } }], middleware),
  ];
}
