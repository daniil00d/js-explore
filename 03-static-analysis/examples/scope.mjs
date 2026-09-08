// Анализ областей видимости: дерево областей, привязки, разрешение ссылок.
//
// Отдельным модулем, потому что областями видимости пользуются и другие примеры
// раздела: граф вызовов резолвит по ним имена функций, распространение констант —
// имена переменных. Правила ровно те, что разбирались в разделе 01: `var` уходит
// в ближайшую функциональную область, `let`, `const` и классы — в лексическую.
//
// Дерево на входе — ESTree (acorn). Модульный код, а не скрипт: в модуле всегда
// строгий режим, поэтому нет `with`, а объявления функций внутри блока
// блочные. Для скриптов правила грязнее — см. limits-of-analysis.md.

/** Области, в которые попадает `var`: только функции и верхний уровень модуля. */
const VAR_SCOPES = new Set(['module', 'function']);

/** Виды объявлений, которые живут в лексической области, а не в функциональной. */
const LEXICAL_KINDS = new Set(['let', 'const']);

let nextScopeId = 0;

class Scope {
  constructor(kind, node, parent) {
    this.id = nextScopeId++;
    this.kind = kind;
    this.node = node;
    this.parent = parent;
    this.children = [];
    /** @type {Map<string, Binding>} */
    this.bindings = new Map();
    /** @type {Reference[]} */
    this.references = [];
    if (parent) parent.children.push(this);
  }

  /** Ближайшая область, куда попадает `var`. */
  get varScope() {
    let scope = this;
    while (!VAR_SCOPES.has(scope.kind)) scope = scope.parent;
    return scope;
  }

  /** Цепочка от текущей области к корню — то, по чему идёт разрешение имён. */
  get chain() {
    const chain = [];
    for (let scope = this; scope; scope = scope.parent) chain.push(scope);
    return chain;
  }

  get depth() {
    return this.chain.length - 1;
  }

  /** Человекочитаемое имя области — для таблиц и деревьев. */
  get label() {
    const named = this.node?.id?.name;
    if (this.kind === 'module') return 'модуль';
    if (this.kind === 'function') return named ? `функция ${named}` : 'функция без имени';
    if (this.kind === 'class') return named ? `класс ${named}` : 'класс';
    if (this.kind === 'block') return 'блок';
    if (this.kind === 'for') return 'голова for';
    if (this.kind === 'catch') return 'catch';
    if (this.kind === 'switch') return 'switch';
    if (this.kind === 'function-name') return `имя ${named}`;
    return this.kind;
  }
}

class Binding {
  constructor(name, kind, node, scope) {
    this.name = name;
    this.kind = kind;
    this.node = node;
    this.scope = scope;
    /** Позиция объявляющего идентификатора; у неявных привязок её нет. */
    this.declaredAt = node?.start ?? null;
    /** @type {Reference[]} */
    this.references = [];
    /** Повторные объявления того же имени в той же области. */
    this.redeclarations = 0;
  }

  get reads() {
    return this.references.filter((reference) => reference.kind !== 'write').length;
  }

  get writes() {
    return this.references.filter((reference) => reference.kind !== 'read').length;
  }

  /** Ссылки не из той области, где объявлено имя, — это и есть захват замыканием. */
  get captured() {
    return this.references.some((reference) => reference.functionScope !== functionScopeOf(this.scope));
  }
}

/** Ближайшая функциональная область: границей замыкания служит именно она, а не блок. */
function functionScopeOf(scope) {
  let current = scope;
  while (current && !VAR_SCOPES.has(current.kind)) current = current.parent;
  return current;
}

/**
 * Строит дерево областей видимости и разрешает в нём все ссылки на имена.
 *
 * @param {object} ast дерево ESTree (acorn с `sourceType: 'module'`)
 * @returns {{ root: Scope, scopes: Scope[], references: Reference[], unresolved: Reference[] }}
 */
export function analyzeScopes(ast) {
  /** @type {Scope[]} */
  const scopes = [];
  /** @type {Reference[]} */
  const references = [];
  let current = null;

  const enter = (kind, node) => {
    current = new Scope(kind, node, current);
    scopes.push(current);
    return current;
  };

  const exit = () => {
    current = current.parent;
  };

  const declare = (name, kind, node, scope = current) => {
    const existing = scope.bindings.get(name);
    if (existing) {
      // Повторное `var x` или `function f` — это одна привязка, а не две.
      // Настоящий SyntaxError на `let x` дважды — забота парсера, не наша.
      existing.redeclarations += 1;
      return existing;
    }
    const binding = new Binding(name, kind, node, scope);
    scope.bindings.set(name, binding);
    return binding;
  };

  const reference = (node, kind = 'read') => {
    const entry = {
      name: node.name,
      node,
      start: node.start,
      line: node.loc?.start.line ?? null,
      scope: current,
      functionScope: functionScopeOf(current),
      kind,
      resolved: null,
    };
    references.push(entry);
    current.references.push(entry);
    return entry;
  };

  /** Объявление: имена из шаблона слева уходят в область, ссылки справа — в текущую. */
  function declarePattern(pattern, kind) {
    switch (pattern.type) {
      case 'Identifier':
        declare(pattern.name, kind, pattern, kind === 'var' ? current.varScope : current);
        break;
      case 'ObjectPattern':
        for (const property of pattern.properties) {
          if (property.type === 'RestElement') {
            declarePattern(property.argument, kind);
            continue;
          }
          // Вычисляемый ключ — это выражение, и в нём могут быть ссылки: `{ [key]: value }`.
          if (property.computed) visit(property.key);
          declarePattern(property.value, kind);
        }
        break;
      case 'ArrayPattern':
        for (const element of pattern.elements) if (element) declarePattern(element, kind);
        break;
      case 'AssignmentPattern':
        declarePattern(pattern.left, kind);
        visit(pattern.right);
        break;
      case 'RestElement':
        declarePattern(pattern.argument, kind);
        break;
      default:
        // `for (obj.field of list)` — слева не объявление, а обычная ссылка.
        visit(pattern);
    }
  }

  /** Цель присваивания: те же шаблоны, но имена — ссылки на запись, а не объявления. */
  function visitTarget(target) {
    switch (target.type) {
      case 'Identifier':
        reference(target, 'write');
        break;
      case 'ObjectPattern':
        for (const property of target.properties) {
          if (property.type === 'RestElement') {
            visitTarget(property.argument);
            continue;
          }
          if (property.computed) visit(property.key);
          visitTarget(property.value);
        }
        break;
      case 'ArrayPattern':
        for (const element of target.elements) if (element) visitTarget(element);
        break;
      case 'AssignmentPattern':
        visitTarget(target.left);
        visit(target.right);
        break;
      case 'RestElement':
        visitTarget(target.argument);
        break;
      default:
        visit(target);
    }
  }

  function visitFunction(node, { arrow = false } = {}) {
    enter('function', node);
    // `arguments` есть в любой обычной функции, даже если в коде его нет:
    // именно поэтому ссылка на `arguments` внутри функции никуда не «протекает».
    if (!arrow) declare('arguments', 'implicit', null);
    for (const param of node.params) declarePattern(param, 'param');
    if (node.body.type === 'BlockStatement') {
      // Тело функции не создаёт отдельной блочной области: параметры и `let`
      // из тела живут вместе. Поэтому обходим содержимое, а не сам BlockStatement.
      for (const statement of node.body.body) visit(statement);
    } else {
      visit(node.body);
    }
    exit();
  }

  function visitChildren(node) {
    for (const key of Object.keys(node)) {
      if (key === 'type' || key === 'start' || key === 'end' || key === 'loc' || key === 'range') continue;
      const value = node[key];
      if (Array.isArray(value)) {
        for (const child of value) if (child && typeof child.type === 'string') visit(child);
      } else if (value && typeof value.type === 'string') {
        visit(value);
      }
    }
  }

  function visit(node) {
    if (!node || typeof node.type !== 'string') return;

    switch (node.type) {
      case 'Program':
        enter('module', node);
        for (const statement of node.body) visit(statement);
        exit();
        return;

      case 'BlockStatement':
      case 'StaticBlock':
        enter('block', node);
        for (const statement of node.body) visit(statement);
        exit();
        return;

      case 'FunctionDeclaration':
        // В модуле объявление функции блочное: `function f` внутри `{}` наружу не видно.
        if (node.id) declare(node.id.name, 'function', node.id);
        visitFunction(node);
        return;

      case 'FunctionExpression':
        // Именованное функциональное выражение видит своё имя, но только внутри себя.
        if (node.id) {
          enter('function-name', node);
          declare(node.id.name, 'function', node.id);
          visitFunction(node);
          exit();
        } else {
          visitFunction(node);
        }
        return;

      case 'ArrowFunctionExpression':
        visitFunction(node, { arrow: true });
        return;

      case 'ClassDeclaration':
        if (node.id) declare(node.id.name, 'class', node.id);
        enter('class', node);
        if (node.id) declare(node.id.name, 'class', node.id);
        visit(node.superClass);
        visit(node.body);
        exit();
        return;

      case 'ClassExpression':
        enter('class', node);
        if (node.id) declare(node.id.name, 'class', node.id);
        visit(node.superClass);
        visit(node.body);
        exit();
        return;

      case 'MethodDefinition':
      case 'PropertyDefinition':
        if (node.computed) visit(node.key);
        visit(node.value);
        return;

      case 'Property':
        // Ключ — не ссылка: `{ user: 1 }` не читает переменную `user`.
        // А вот сокращённая запись `{ user }` — читает, и там key и value один узел.
        if (node.computed) visit(node.key);
        visit(node.value);
        return;

      case 'MemberExpression':
        visit(node.object);
        // `obj.field` — имя поля не переменная; `obj[field]` — переменная.
        if (node.computed) visit(node.property);
        return;

      case 'VariableDeclaration':
        for (const declarator of node.declarations) {
          declarePattern(declarator.id, node.kind);
          visit(declarator.init);
        }
        return;

      case 'AssignmentExpression':
        // `x = 1` — только запись, `x += 1` — и чтение, и запись.
        if (node.operator === '=') visitTarget(node.left);
        else if (node.left.type === 'Identifier') reference(node.left, 'readwrite');
        else visit(node.left);
        visit(node.right);
        return;

      case 'UpdateExpression':
        if (node.argument.type === 'Identifier') reference(node.argument, 'readwrite');
        else visit(node.argument);
        return;

      case 'ForStatement': {
        const lexical = node.init?.type === 'VariableDeclaration' && LEXICAL_KINDS.has(node.init.kind);
        if (lexical) enter('for', node);
        visit(node.init);
        visit(node.test);
        visit(node.update);
        visit(node.body);
        if (lexical) exit();
        return;
      }

      case 'ForInStatement':
      case 'ForOfStatement': {
        const lexical = node.left.type === 'VariableDeclaration' && LEXICAL_KINDS.has(node.left.kind);
        if (lexical) enter('for', node);
        if (node.left.type === 'VariableDeclaration') visit(node.left);
        else visitTarget(node.left);
        visit(node.right);
        visit(node.body);
        if (lexical) exit();
        return;
      }

      case 'CatchClause':
        // Область для `catch (error)` появляется только если параметр есть:
        // `catch {}` без параметра ничего не объявляет.
        if (node.param) {
          enter('catch', node);
          declarePattern(node.param, 'catch');
          visit(node.body);
          exit();
        } else {
          visit(node.body);
        }
        return;

      case 'SwitchStatement':
        visit(node.discriminant);
        // Все case делят одну лексическую область: `let` в одном case виден в другом.
        enter('switch', node);
        for (const switchCase of node.cases) {
          visit(switchCase.test);
          for (const statement of switchCase.consequent) visit(statement);
        }
        exit();
        return;

      case 'ImportDeclaration':
        for (const specifier of node.specifiers) declare(specifier.local.name, 'import', specifier.local);
        return;

      case 'ExportNamedDeclaration':
        if (node.declaration) visit(node.declaration);
        // `export { send }` — это ссылка на локальное имя, а `as deliver` — нет.
        else if (!node.source) {
          for (const specifier of node.specifiers) {
            if (specifier.local.type === 'Identifier') reference(specifier.local, 'read');
          }
        }
        return;

      case 'ExportDefaultDeclaration':
        visit(node.declaration);
        return;

      case 'ExportAllDeclaration':
        return;

      case 'LabeledStatement':
        // Метка — не переменная: `outer:` и `break outer` живут в своём пространстве имён.
        visit(node.body);
        return;

      case 'BreakStatement':
      case 'ContinueStatement':
      case 'PrivateIdentifier':
      case 'Literal':
      case 'ThisExpression':
      case 'Super':
      case 'MetaProperty':
        return;

      case 'Identifier':
        reference(node, 'read');
        return;

      default:
        visitChildren(node);
    }
  }

  visit(ast);

  // Разрешение — отдельным проходом после обхода, и это не оптимизация, а
  // необходимость: имя может использоваться выше своего объявления (hoisting),
  // поэтому на момент встречи ссылки таблица области ещё не собрана целиком.
  const unresolved = [];
  for (const entry of references) {
    for (let scope = entry.scope; scope; scope = scope.parent) {
      const binding = scope.bindings.get(entry.name);
      if (binding) {
        entry.resolved = binding;
        binding.references.push(entry);
        break;
      }
    }
    if (!entry.resolved) unresolved.push(entry);
  }

  return { root: scopes[0], scopes, references, unresolved };
}

/** Все привязки дерева областей — плоским списком, в порядке появления областей. */
export function allBindings(scopes) {
  return scopes.flatMap((scope) => [...scope.bindings.values()]);
}

/**
 * Имена, которые область берёт снаружи. Для функции это ровно список того,
 * что придётся положить в замыкание (в терминах V8 — в Context).
 */
export function freeNames(scope) {
  const inside = new Set();
  const collect = (current) => {
    for (const name of current.bindings.keys()) inside.add(name);
    for (const child of current.children) collect(child);
  };
  collect(scope);

  const free = new Map();
  const walk = (current) => {
    for (const entry of current.references) {
      if (!entry.resolved) continue;
      // Привязка объявлена вне поддерева области — значит, имя приходит извне.
      const declaredInside = entry.resolved.scope.chain.includes(scope);
      if (!declaredInside) free.set(entry.name, entry.resolved);
    }
    for (const child of current.children) walk(child);
  };
  walk(scope);

  return free;
}
