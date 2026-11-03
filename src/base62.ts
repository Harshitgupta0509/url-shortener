const ALPHABET =
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function toBase62(value: bigint): string {
  if (value === 0n) return "0";

  let current = value;
  let result = "";

  while (current > 0n) {
    result = ALPHABET[Number(current % 62n)] + result;
    current /= 62n;
  }

  return result;
}
