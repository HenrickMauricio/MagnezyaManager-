/**
 * Números de identificação fiscal.
 * Módulo puro (sem dependências), partilhado entre formulários e servidor.
 */

/** Remove espaços, pontos e hífenes; devolve em maiúsculas. */
export function normalizeTaxId(value: string): string {
  return value.replace(/[\s.-]/g, "").toUpperCase();
}

/**
 * Valida um NIF/NIPC português: 9 dígitos, primeiro dígito válido e
 * dígito de controlo (módulo 11, pesos 9 a 2).
 */
export function isValidPortugueseNif(value: string): boolean {
  const nif = normalizeTaxId(value).replace(/^PT/, "");
  if (!/^\d{9}$/.test(nif)) return false;

  // 1–3 pessoas singulares · 45 não residentes · 5 coletivas · 6 administração pública
  // 70–79 heranças/fundos · 8 empresários em nome individual (antigo) · 90–99 entidades diversas
  if (!/^(?:[1235689]|45|7[0-9])/.test(nif)) return false;

  let sum = 0;
  for (let i = 0; i < 8; i++) sum += Number(nif[i]) * (9 - i);
  const remainder = sum % 11;
  const check = remainder < 2 ? 0 : 11 - remainder;
  return check === Number(nif[8]);
}

/** Identificador fiscal estrangeiro: 4 a 20 letras ou dígitos (sem validação de controlo). */
export function isPlausibleForeignTaxId(value: string): boolean {
  return /^[A-Z0-9]{4,20}$/.test(normalizeTaxId(value));
}
