// Подопытная программа для lazy-parsing.mjs: набор функций в разных обёртках.
// Запускается как обычный скрипт, чтобы в логе V8 у неё был свой script id.

function declNeverCalled(a) {
  return a + 1;
}

function declCalled(a) {
  return a + 2;
}

const exprNeverCalled = function named(a) {
  return a + 3;
};

const arrowNeverCalled = (a) => a + 4;

// Классический трюк: функция в скобках разбирается сразу, а не лениво.
const iifeInParens = (function inParens(a) {
  return a + 5;
})(1);

// А эта обёртка на решение V8 не влияет, хотя вызывается тоже немедленно.
const iifeAfterVoid = void function afterVoid(a) {
  return a + 6;
}(1);

const iifeAfterBang = !function afterBang(a) {
  return a + 7;
}(1);

function outerNeverCalled() {
  function innerNested(a) {
    return a + 8;
  }
  return innerNested;
}

const holder = {
  methodNeverCalled(a) {
    return a + 9;
  },
};

class Klass {
  methodNeverCalled(a) {
    return a + 10;
  }
}

declCalled(1);

// Чтобы значения не выглядели неиспользованными для читателя.
globalThis.__lazySubjectResult = [exprNeverCalled, arrowNeverCalled, iifeInParens, iifeAfterVoid, iifeAfterBang, outerNeverCalled, holder, Klass].length;
