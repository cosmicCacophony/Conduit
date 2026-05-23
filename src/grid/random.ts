export interface Random {
  next(): number
}

export const defaultRandom: Random = {
  next: () => Math.random(),
}
