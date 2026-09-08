// Фрагменты для лабы «Предскажи результат». Менять не нужно.
//
// Каждый фрагмент — выражение, которое проверка вычисляет в чистом контексте
// через node:vm. Результатом считается либо значение выражения, либо имя
// конструктора ошибки, если фрагмент упал (в том числе на разборе).

export const cases = [
  {
    id: 'varBeforeDeclaration',
    code: `(function () {
      const snapshot = counter;
      var counter = 1;
      return snapshot;
    })()`,
  },
  {
    id: 'letBeforeDeclaration',
    code: `(function () {
      const snapshot = counter;
      let counter = 1;
      return snapshot;
    })()`,
  },
  {
    id: 'typeofInTdz',
    code: `(function () {
      const kind = typeof counter;
      let counter = 1;
      return kind;
    })()`,
  },
  {
    id: 'typeofUndeclared',
    code: `typeof somethingNobodyDeclared`,
  },
  {
    id: 'functionHoisting',
    code: `(function () {
      return greet();
      function greet() {
        return 'вызвалась';
      }
    })()`,
  },
  {
    id: 'asiAfterReturn',
    code: `(function () {
      return
        42;
    })()`,
  },
  {
    id: 'asiBeforeParenthesis',
    code: `(function () {
      const first = 1;
      const second = 2;
      const list = [10, 20];
      let total = first + second
      (list[0])
      return total;
    })()`,
  },
  {
    id: 'thisInSloppyFunction',
    code: `typeof (function () {
      return this;
    })()`,
  },
  {
    id: 'thisInStrictFunction',
    code: `typeof (function () {
      'use strict';
      return this;
    })()`,
  },
  {
    id: 'duplicateParamsInStrict',
    code: `(function () {
      'use strict';
      function sum(a, a) {
        return a;
      }
      return sum(1, 2);
    })()`,
  },
  {
    id: 'varLoopClosures',
    code: `(function () {
      const callbacks = [];
      for (var i = 0; i < 3; i += 1) callbacks.push(() => i);
      return callbacks.map((callback) => callback());
    })()`,
  },
  {
    id: 'letLoopClosures',
    code: `(function () {
      const callbacks = [];
      for (let i = 0; i < 3; i += 1) callbacks.push(() => i);
      return callbacks.map((callback) => callback());
    })()`,
  },
  {
    id: 'argumentsAliasSloppy',
    code: `(function (value) {
      arguments[0] = 99;
      return value;
    })(1)`,
  },
  {
    id: 'argumentsAliasStrict',
    code: `(function (value) {
      'use strict';
      arguments[0] = 99;
      return value;
    })(1)`,
  },
];
