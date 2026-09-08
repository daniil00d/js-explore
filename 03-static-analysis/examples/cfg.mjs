// Граф потока управления: из вложенного дерева получается плоский граф блоков.
//
// Отдельным модулем, потому что на этом графе стоят три примера раздела:
// build-cfg.mjs (блоки, рёбра, недостижимый код), dataflow.mjs (анализ потока
// данных) и ssa.mjs (доминаторы и φ-функции).
//
// Что здесь важно понять: в дереве управляющие конструкции вложены друг в друга,
// а в графе никакой вложенности нет — есть блоки и рёбра между ними. `while`,
// `for` и `for..of` после построения выглядят одинаково: узел с условием, тело
// и ребро назад. Компилятор дальше работает именно с графом, потому что вопросы
// вида «может ли управление дойти сюда» на дереве не задаются.

/** Инструкции, после которых управление в текущем блоке не продолжается. */
const ABRUPT = new Set(['ReturnStatement', 'ThrowStatement', 'BreakStatement', 'ContinueStatement']);

/** Циклы — у них есть цель для `continue`, в отличие от `switch`. */
const LOOPS = new Set(['ForStatement', 'ForInStatement', 'ForOfStatement', 'WhileStatement', 'DoWhileStatement']);

/**
 * Статически известная истинность условия: `while (true)` и `if (false)` знать
 * полезно, потому что от этого зависит, какие рёбра в графе вообще существуют.
 * Всё сложнее литерала — не наше дело: этим занимается constant-folding.mjs.
 *
 * @returns {boolean|null} null — «неизвестно»
 */
export function staticTruthiness(test) {
  if (!test) return true; // `for (;;)` — условия нет, значит, всегда истинно
  if (test.type === 'Literal') {
    if (test.value === null || test.regex) return Boolean(test.value);
    if (['boolean', 'number', 'string'].includes(typeof test.value)) return Boolean(test.value);
    return null;
  }
  if (test.type === 'UnaryExpression' && test.operator === '!') {
    const inner = staticTruthiness(test.argument);
    return inner === null ? null : !inner;
  }
  return null;
}

/**
 * Строит граф потока управления по телу функции.
 *
 * @param {object} functionNode узел функции ESTree
 * @param {string} source исходный текст — из него берутся подписи инструкций
 * @returns {{ blocks: object[], entry: object, exit: object, name: string }}
 */
export function buildCfg(functionNode, source) {
  const blocks = [];

  const newBlock = (label) => {
    const block = {
      key: blocks.length,
      id: null, // осмысленный номер выдаётся в конце, после обхода
      label,
      statements: [],
      successors: [],
      predecessors: [],
    };
    blocks.push(block);
    return block;
  };

  // Ребро — один объект в двух списках, а не две копии: анализам нужно уметь
  // помечать конкретное ребро (например, «это ребро невыполнимо») и видеть
  // пометку с обеих сторон.
  const connect = (from, to, label = '') => {
    if (!from || !to) return;
    if (from.successors.some((edge) => edge.to === to && edge.label === label)) return;
    const edge = { from, to, label };
    from.successors.push(edge);
    to.predecessors.push(edge);
  };

  const entry = newBlock('вход');
  const exit = newBlock('выход');

  /**
   * Текущий блок. null означает, что управление сюда не доходит: предыдущая
   * инструкция была `return`, `throw`, `break` или `continue`. Блок под
   * недостижимые инструкции создаётся только если такая инструкция реально
   * встретится — иначе граф зарастёт пустыми блоками.
   */
  let current = entry;

  /** Стек циклов и switch: куда прыгают `break` и `continue`. */
  const jumpTargets = [];
  /** Метки, встреченные перед циклом: `outer: for (...)`. */
  let pendingLabels = [];

  const ensureCurrent = () => {
    if (!current) current = newBlock('недостижимое');
    return current;
  };

  const text = (node) => {
    const raw = source.slice(node.start, node.end).split('\n')[0].trim();
    return raw.length > 46 ? `${raw.slice(0, 45)}…` : raw;
  };

  const emit = (node, label = text(node)) => {
    ensureCurrent().statements.push({
      node,
      label,
      line: node.loc?.start.line ?? null,
      start: node.start,
      end: node.end,
    });
  };

  const findJumpTarget = (kind, labelName) => {
    for (let index = jumpTargets.length - 1; index >= 0; index -= 1) {
      const frame = jumpTargets[index];
      if (labelName) {
        if (frame.labels.includes(labelName) && frame[kind]) return frame[kind];
        continue;
      }
      if (frame[kind]) return frame[kind];
    }
    return null;
  };

  const takeLabels = () => {
    const labels = pendingLabels;
    pendingLabels = [];
    return labels;
  };

  function visitBody(node) {
    if (node.type === 'BlockStatement') {
      for (const statement of node.body) visitStatement(statement);
    } else {
      visitStatement(node);
    }
  }

  function visitStatement(node) {
    switch (node.type) {
      case 'BlockStatement':
        // Блок не влияет на поток управления: фигурные скобки — про области
        // видимости, а не про переходы. Поэтому отдельного блока графа нет.
        for (const statement of node.body) visitStatement(statement);
        return;

      case 'EmptyStatement':
        return;

      case 'IfStatement': {
        // В блок попадает только условие: сами ветви станут отдельными блоками.
        // Если записать сюда весь узел `if`, его диапазон накроет обе ветви,
        // и любой анализ по позициям приписал бы их чтения условию.
        emit(node.test, `if (${text(node.test)})`);
        const truth = staticTruthiness(node.test);
        const branch = current;
        const thenBlock = newBlock('then');
        const elseBlock = node.alternate ? newBlock('else') : null;
        const join = newBlock('после if');

        if (truth !== false) connect(branch, thenBlock, 'да');
        if (truth !== true) connect(branch, elseBlock ?? join, 'нет');

        current = thenBlock;
        visitBody(node.consequent);
        connect(current, join, 'далее');

        if (elseBlock) {
          current = elseBlock;
          visitBody(node.alternate);
          connect(current, join, 'далее');
        }

        current = join;
        return;
      }

      case 'WhileStatement': {
        const labels = takeLabels();
        const head = newBlock('условие while');
        connect(current, head);
        current = head;
        emit(node.test, `while (${text(node.test)})`);

        const body = newBlock('тело while');
        const after = newBlock('после while');
        const truth = staticTruthiness(node.test);
        if (truth !== false) connect(head, body, 'да');
        if (truth !== true) connect(head, after, 'нет');

        jumpTargets.push({ labels, break: after, continue: head });
        current = body;
        visitBody(node.body);
        connect(current, head, 'назад');
        jumpTargets.pop();

        current = after;
        return;
      }

      case 'DoWhileStatement': {
        const labels = takeLabels();
        const body = newBlock('тело do');
        const test = newBlock('условие do');
        const after = newBlock('после do');
        connect(current, body);

        jumpTargets.push({ labels, break: after, continue: test });
        current = body;
        visitBody(node.body);
        connect(current, test);
        jumpTargets.pop();

        current = test;
        emit(node.test, `while (${text(node.test)})`);
        const truth = staticTruthiness(node.test);
        if (truth !== false) connect(test, body, 'назад');
        if (truth !== true) connect(test, after, 'нет');

        current = after;
        return;
      }

      case 'ForStatement': {
        const labels = takeLabels();
        if (node.init) emit(node.init);
        const head = newBlock('условие for');
        connect(current, head);
        current = head;
        if (node.test) emit(node.test, `for (…; ${text(node.test)}; …)`);

        const body = newBlock('тело for');
        const step = newBlock('шаг for');
        const after = newBlock('после for');
        const truth = staticTruthiness(node.test);
        if (truth !== false) connect(head, body, 'да');
        if (truth !== true) connect(head, after, 'нет');

        jumpTargets.push({ labels, break: after, continue: step });
        current = body;
        visitBody(node.body);
        connect(current, step, 'далее');
        jumpTargets.pop();

        current = step;
        if (node.update) emit(node.update);
        connect(step, head, 'назад');

        current = after;
        return;
      }

      case 'ForInStatement':
      case 'ForOfStatement': {
        const labels = takeLabels();
        const head = newBlock(node.type === 'ForOfStatement' ? 'следующий элемент' : 'следующий ключ');
        connect(current, head);
        current = head;
        emit(node.right, `перебор ${text(node.right)}`);

        const body = newBlock('тело цикла');
        const after = newBlock('после цикла');
        // Пустая коллекция или непустая — статически неизвестно, поэтому оба ребра есть.
        connect(head, body, 'есть');
        connect(head, after, 'кончились');

        jumpTargets.push({ labels, break: after, continue: head });
        current = body;
        emit(node.left, `элемент → ${text(node.left)}`);
        visitBody(node.body);
        connect(current, head, 'назад');
        jumpTargets.pop();

        current = after;
        return;
      }

      case 'SwitchStatement': {
        const labels = takeLabels();
        emit(node.discriminant, `switch (${text(node.discriminant)})`);
        const dispatch = current;
        const after = newBlock('после switch');
        const caseBlocks = node.cases.map((switchCase) =>
          newBlock(switchCase.test ? `case ${text(switchCase.test)}` : 'default'),
        );

        for (const [index, switchCase] of node.cases.entries()) {
          connect(dispatch, caseBlocks[index], switchCase.test ? 'совпало' : 'default');
        }
        if (!node.cases.some((switchCase) => !switchCase.test)) connect(dispatch, after, 'ничего не совпало');

        // `break` в switch есть, а `continue` нет — он относится к внешнему циклу.
        jumpTargets.push({ labels, break: after, continue: null });
        for (const [index, switchCase] of node.cases.entries()) {
          current = caseBlocks[index];
          for (const statement of switchCase.consequent) visitStatement(statement);
          // Нет break — управление проваливается в следующий case. Это и есть
          // причина, по которой забытый break так легко не заметить.
          connect(current, caseBlocks[index + 1] ?? after, 'проваливается');
        }
        jumpTargets.pop();

        current = after;
        return;
      }

      case 'TryStatement': {
        const tryEntry = newBlock('try');
        connect(current, tryEntry);
        const handler = node.handler ? newBlock('catch') : null;
        const finalizer = node.finalizer ? newBlock('finally') : null;
        const after = newBlock('после try');
        const join = finalizer ?? after;

        // Приближение, и важно понимать, какое именно: исключение может случиться
        // на любой инструкции внутри try, но рисовать ребро из каждой — значит
        // получить граф, в котором почти всё связано со всем. Поэтому ребро одно,
        // из входа в try. Точность теряется, корректность — нет: путь в catch
        // остаётся, а лишних путей не появляется.
        if (handler) connect(tryEntry, handler, 'исключение');

        current = tryEntry;
        visitBody(node.block);
        connect(current, join, 'без исключений');

        if (handler) {
          current = handler;
          visitBody(node.handler.body);
          connect(current, join, 'обработано');
        }

        if (finalizer) {
          current = finalizer;
          visitBody(node.finalizer);
          connect(current, after);
        }

        current = after;
        return;
      }

      case 'LabeledStatement': {
        const name = node.label.name;
        if (LOOPS.has(node.body.type)) {
          pendingLabels.push(name);
          visitStatement(node.body);
          return;
        }
        const after = newBlock(`после ${name}`);
        jumpTargets.push({ labels: [name], break: after, continue: null });
        visitStatement(node.body);
        connect(current, after);
        jumpTargets.pop();
        current = after;
        return;
      }

      case 'BreakStatement':
      case 'ContinueStatement': {
        emit(node);
        const kind = node.type === 'BreakStatement' ? 'break' : 'continue';
        const target = findJumpTarget(kind, node.label?.name);
        connect(current, target, kind);
        current = null;
        return;
      }

      case 'ReturnStatement':
      case 'ThrowStatement': {
        emit(node);
        connect(current, exit, node.type === 'ReturnStatement' ? 'return' : 'throw');
        current = null;
        return;
      }

      default:
        // Всё остальное — простая инструкция: выражение, объявление, debugger.
        // Внутри может быть вложенная функция, но её поток управления — свой,
        // отдельный граф. Это и есть причина неполноты графа вызовов.
        emit(node);
    }
  }

  visitBody(functionNode.body);
  connect(current, exit, 'конец функции');

  // Нумерация блоков в порядке обхода от входа: так граф читается сверху вниз,
  // а недостижимые блоки собираются в конце — там, где их и ожидаешь увидеть.
  const order = [];
  const seen = new Set();
  const walk = (block) => {
    if (seen.has(block) || block === exit) return;
    seen.add(block);
    order.push(block);
    for (const edge of block.successors) walk(edge.to);
  };
  walk(entry);
  for (const block of blocks) if (!seen.has(block) && block !== exit) order.push(block);
  order.push(exit);
  order.forEach((block, index) => {
    block.id = index;
  });

  return { blocks: order, entry, exit, name: functionNode.id?.name ?? 'без имени' };
}

/** Блоки, до которых есть путь от входа. Всё остальное — недостижимый код. */
export function reachableBlocks(cfg) {
  const reachable = new Set();
  const stack = [cfg.entry];
  while (stack.length > 0) {
    const block = stack.pop();
    if (reachable.has(block)) continue;
    reachable.add(block);
    for (const edge of block.successors) stack.push(edge.to);
  }
  return reachable;
}

/** Порядок «сначала предшественники» — в нём прямые анализы сходятся быстрее всего. */
export function reversePostorder(cfg) {
  const visited = new Set();
  const postorder = [];
  const walk = (block) => {
    if (visited.has(block)) return;
    visited.add(block);
    for (const edge of block.successors) walk(edge.to);
    postorder.push(block);
  };
  walk(cfg.entry);
  return postorder.reverse();
}

/**
 * Доминаторы: блок A доминирует над B, если любой путь от входа к B проходит
 * через A. Итеративный алгоритм по определению — медленный, зато очевидный.
 */
export function dominators(cfg) {
  const reachable = reachableBlocks(cfg);
  const order = reversePostorder(cfg);
  const dominance = new Map();
  for (const block of reachable) {
    dominance.set(block, block === cfg.entry ? new Set([cfg.entry]) : new Set(reachable));
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const block of order) {
      if (block === cfg.entry) continue;
      const incoming = block.predecessors.filter((edge) => reachable.has(edge.from));
      if (incoming.length === 0) continue;
      // Доминаторы блока = он сам плюс пересечение доминаторов предшественников.
      let next = null;
      for (const edge of incoming) {
        const set = dominance.get(edge.from);
        next = next === null ? new Set(set) : new Set([...next].filter((item) => set.has(item)));
      }
      next.add(block);
      const previous = dominance.get(block);
      if (previous.size !== next.size || [...next].some((item) => !previous.has(item))) {
        dominance.set(block, next);
        changed = true;
      }
    }
  }

  // Непосредственный доминатор — ближайший из доминаторов, кроме самого блока.
  const idom = new Map();
  for (const block of reachable) {
    if (block === cfg.entry) continue;
    const candidates = [...dominance.get(block)].filter((item) => item !== block);
    const immediate = candidates.find((candidate) =>
      candidates.every((other) => other === candidate || dominance.get(candidate).has(other)),
    );
    idom.set(block, immediate ?? cfg.entry);
  }

  return { dominance, idom, reachable };
}

/**
 * Фронт доминирования блока: блоки, где его влияние заканчивается. Именно там
 * и нужны φ-функции — см. ssa.mjs.
 */
export function dominanceFrontiers(cfg, { idom, reachable }) {
  const frontiers = new Map();
  for (const block of reachable) frontiers.set(block, new Set());

  for (const block of reachable) {
    const incoming = block.predecessors.filter((edge) => reachable.has(edge.from));
    if (incoming.length < 2) continue;
    // Точка слияния: поднимаемся от каждого предшественника к непосредственному
    // доминатору блока, добавляя блок во фронты всех, кого встретим по пути.
    for (const edge of incoming) {
      let runner = edge.from;
      while (runner && runner !== idom.get(block)) {
        frontiers.get(runner).add(block);
        runner = idom.get(runner);
      }
    }
  }

  return frontiers;
}

/** Текстовое представление графа — блоки, их инструкции и рёбра. */
export function renderCfg(cfg, { reachable = reachableBlocks(cfg) } = {}) {
  const lines = [];
  for (const block of cfg.blocks) {
    const mark = reachable.has(block) ? ' ' : '!';
    const from = block.predecessors.map((edge) => `B${edge.from.id}`).join(', ') || '—';
    lines.push(`${mark} B${block.id} ${block.label}   ← ${from}`);
    for (const statement of block.statements) {
      lines.push(`      ${String(statement.line).padStart(3)} | ${statement.label}`);
    }
    const out = block.successors.map((edge) => (edge.label ? `B${edge.to.id} (${edge.label})` : `B${edge.to.id}`));
    if (out.length > 0) lines.push(`      → ${out.join(', ')}`);
  }
  return lines;
}
