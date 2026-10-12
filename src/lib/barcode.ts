/** GTIN check digit (EAN-8, UPC-A, EAN-13, GTIN-14). */
function gtinValid(code: string) {
  const digits = code.split("").map(Number);
  const check = digits.pop()!;
  const sum = digits.reverse().reduce((s, d, i) => s + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

/** Returns an error message, or null when the code is acceptable. */
export function barcodeError(code: string): string | null {
  if (!code) return null;
  if (!/^\d+$/.test(code)) return "O código deve ter apenas números.";
  if (![8, 12, 13, 14].includes(code.length)) return "Use um código EAN-13, EAN-8, UPC-A ou UPC-E (8, 12 ou 13 dígitos).";
  // 8-digit codes may be EAN-8 or UPC-E (different check rules), so accept either.
  if (code.length !== 8 && !gtinValid(code)) return "Código inválido: o dígito verificador não confere.";
  return null;
}
