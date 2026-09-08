// Обёртки над «natives syntax» V8 — служебными функциями вида `%GetOptimizationStatus`.
//
// Эти функции не часть JavaScript: они доступны только при запуске с
// `--allow-natives-syntax`, а без флага файл с ними не проходит даже разбор — падает
// до первой строки кода. Поэтому вызовы собраны через `new Function`: тело остаётся
// строкой, ошибка возникает при создании обёртки, и её можно поймать и объяснить
// человеку вместо голого SyntaxError.
//
// Полный список функций — в исходниках V8: src/runtime/runtime.h. Он меняется от
// версии к версии, так что `probeNative` полезнее, чем вера в чужой список.

import { basename } from 'node:path';

function makeNative(name, params, returns = true) {
  const body = `${returns ? 'return ' : ''}%${name}(${params.join(', ')})`;
  return new Function(...params, body);
}

/** Проверяет, существует ли %-функция с таким именем в текущей сборке V8. */
export function probeNative(name, arity = 1) {
  const params = ['a', 'b', 'c'].slice(0, arity);
  try {
    makeNative(name, params);
    return true;
  } catch {
    return false;
  }
}

export const nativesAvailable = (() => {
  try {
    makeNative('GetOptimizationStatus', ['fn']);
    return true;
  } catch {
    return false;
  }
})();

/**
 * Печатает подсказку и завершает процесс, если скрипт запущен без флага.
 * Вызывать первым делом в примерах, которым %-функции обязательны.
 */
export function requireNatives(scriptPath = process.argv[1]) {
  if (nativesAvailable) return;
  const file = scriptPath ? basename(scriptPath) : 'script.mjs';
  console.error('Этому примеру нужны служебные функции V8.');
  console.error(`Запусти так: node --allow-natives-syntax ${file}`);
  process.exit(1);
}

export const natives = nativesAvailable
  ? {
      // Компиляция и уровни оптимизации
      getOptimizationStatus: makeNative('GetOptimizationStatus', ['fn']),
      prepareForOptimization: makeNative('PrepareFunctionForOptimization', ['fn'], false),
      optimizeOnNextCall: makeNative('OptimizeFunctionOnNextCall', ['fn'], false),
      optimizeMaglevOnNextCall: makeNative('OptimizeMaglevOnNextCall', ['fn'], false),
      compileBaseline: makeNative('CompileBaseline', ['fn'], false),
      neverOptimize: makeNative('NeverOptimizeFunction', ['fn'], false),
      deoptimize: makeNative('DeoptimizeFunction', ['fn'], false),
      isBeingInterpreted: makeNative('IsBeingInterpreted', []),

      // Форма объектов и представление значений
      haveSameMap: makeNative('HaveSameMap', ['a', 'b']),
      hasFastProperties: makeNative('HasFastProperties', ['obj']),
      hasDictionaryElements: makeNative('HasDictionaryElements', ['obj']),
      hasSmiElements: makeNative('HasSmiElements', ['obj']),
      hasDoubleElements: makeNative('HasDoubleElements', ['obj']),
      hasObjectElements: makeNative('HasObjectElements', ['obj']),
      hasHoleyElements: makeNative('HasHoleyElements', ['obj']),
      isSmi: makeNative('IsSmi', ['value']),

      // Строки
      constructConsString: makeNative('ConstructConsString', ['a', 'b']),
      flattenString: makeNative('FlattenString', ['str']),

      // Куча
      debugPrint: makeNative('DebugPrint', ['value'], false),
      collectGarbage: makeNative('CollectGarbage', ['arg'], false),
    }
  : null;
