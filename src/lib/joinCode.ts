// Join code generation and normalization utilities

const CHARSET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L

export function generateJoinCode(): string {
  let code = "";
  const array = new Uint8Array(6);
  crypto.getRandomValues(array);
  for (let i = 0; i < 6; i++) {
    code += CHARSET[array[i] % CHARSET.length];
  }
  return code;
}

export function normalizeCode(input: string): string {
  return input.toUpperCase().replace(/[\s\-]/g, "");
}

export function formatCodeForDisplay(code: string): string {
  const clean = normalizeCode(code);
  if (clean.length <= 3) return clean;
  return clean.slice(0, 3) + "-" + clean.slice(3);
}
