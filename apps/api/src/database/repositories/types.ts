export type PartialExcept<T, K extends keyof T> = Pick<T, K> & Partial<T>;
