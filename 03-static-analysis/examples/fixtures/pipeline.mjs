// Подопытный модуль для call-graph.mjs: обработка заявок через набор шагов.
//
// Код нарочно написан в стиле, который встречается в любом реальном проекте:
// часть вызовов прямые, часть — через переданные функции, часть — через таблицу
// обработчиков по строковому ключу. Статически видны только первые.

const handlers = {
  create: applyCreate,
  update: applyUpdate,
  remove: applyRemove,
};

export function process(request, middleware) {
  const normalized = normalize(request);
  const checked = middleware(normalized);
  const handler = handlers[checked.kind];
  if (!handler) return reject(checked);
  return handler(checked);
}

function normalize(request) {
  return { kind: String(request.kind).toLowerCase(), payload: request.payload ?? null };
}

function applyCreate(request) {
  return audit('create', store(request.payload));
}

function applyUpdate(request) {
  return audit('update', store(request.payload));
}

function applyRemove(request) {
  return audit('remove', drop(request.payload));
}

function store(payload) {
  return { ok: true, payload };
}

function drop() {
  return { ok: true, payload: null };
}

function audit(action, result) {
  return { action, ...result };
}

function reject(request) {
  return { ok: false, action: 'reject', kind: request.kind };
}

export function runAll(requests, middleware) {
  return requests.map((request) => process(request, middleware));
}

// Никем не вызывается ни статически, ни на этом драйвере, но экспортирована,
// поэтому выбросить её может только анализ всего графа модулей.
export function describe() {
  return Object.keys(handlers);
}
