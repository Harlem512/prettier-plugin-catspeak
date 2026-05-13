/** removes null keys from an object */
export type RNull<T> = { [K in keyof T]: Exclude<T[K], null> }

// Copied prettier types

/**
 * Determines if an object T is an array like string[] (in which case this
 * evaluates to false) or a tuple like [string] (in which case this evaluates to
 * true).
 */
type IsTuple<T> = T extends []
  ? true
  : T extends [infer First, ...infer Remain]
    ? IsTuple<Remain>
    : false

/**
 * A union of the properties of the given array T that can be used to index it.
 * If the array is a tuple, then that's going to be the explicit indices of the
 * array, otherwise it's going to just be number.
 */
type IndexProperties<T extends { length: number }> =
  IsTuple<T> extends true ? Exclude<Partial<T>['length'], T['length']> : number

/** A union of the properties of the given object that are arrays. */
type ArrayProperties<T> = {
  [K in keyof T]: NonNullable<T[K]> extends readonly any[] ? K : never
}[keyof T]

export type IterProperties<T> = T extends any[]
  ? IndexProperties<T>
  : ArrayProperties<T>
