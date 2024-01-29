// See https://stackoverflow.com/a/69058437

export type Nullish<T> = T extends null
  ? undefined
  : T extends Date
  ? T
  : {
      [K in keyof T]: T[K] extends (infer U)[]
        ? Nullish<U>[]
        : Nullish<T[K]>;
    };

export function nullsToUndefined<T>(obj: T): Nullish<T> {
  if (obj === null || obj === undefined) {
    return undefined as any;
  }

  // object check based on: https://stackoverflow.com/a/51458052/6489012
  if (obj.constructor.name === "Object") {
    for (let key in obj) {
      obj[key] = nullsToUndefined(obj[key]) as any;
    }
  }
  return obj as any;
}