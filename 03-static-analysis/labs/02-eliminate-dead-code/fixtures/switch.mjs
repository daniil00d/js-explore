// Строки, которые обязан убрать оптимизатор, помечены комментарием «мёртвый».

export function route(method, path) {
  switch (method) {
    case 'GET':
      return `читаем ${path}`;
      break; // мёртвый
    case 'DELETE':
      if (path === '/') return 'корень удалять нельзя';
    // break забыт, и управление проваливается в default. Это не мёртвый код:
    // ребро «проваливается» в графе есть, просто его не хотели.
    default:
      return `не умеем ${method}`;
  }
  return 'сюда пути нет'; // мёртвый
}

export function main() {
  return {
    get: route('GET', '/items'),
    remove: route('DELETE', '/'),
    other: route('HEAD', '/'),
  };
}
