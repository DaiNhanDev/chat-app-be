const reservedKeys = new Set(['__proto__', 'constructor', 'prototype']);

export const isFirebaseKey = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.length > 0 &&
  Buffer.byteLength(value, 'utf8') <= 768 &&
  !/[.#$[\]/]/.test(value) &&
  ![...value].some(
    (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
  ) &&
  !reservedKeys.has(value);
