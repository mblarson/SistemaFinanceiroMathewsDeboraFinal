export interface PJInput2026 {
  faturamento: number;
}

export interface PJResult2026 {
  faturamento: number;
  proLabore: number;
  dasSimples: number;
  darf: number;
  totalImpostos: number;
  faturamentoLiquido: number;
  percentualImpostos: number;
  proLaborePercentual: number;
  lucroIsento: number;
}

// 1. Pró-labore = 28% sobre Faturamento Bruto (Fator R)
export function calcularProLabore(faturamento: number): number {
  if (faturamento <= 0) return 0;
  return Number((Math.round(faturamento * 28) / 100).toFixed(2));
}

// 2. DAS Simples Nacional = 6% sobre Faturamento Bruto (Anexo III)
export function calcularDAS(faturamento: number): number {
  if (faturamento <= 0) return 0;
  return Number((Math.round(faturamento * 6) / 100).toFixed(2));
}

// 3. DARF INSS = 11% sobre o Pró-labore
export function calcularDARF(proLabore: number): number {
  if (proLabore <= 0) return 0;
  return Number((Math.round(proLabore * 11) / 100).toFixed(2));
}

// 4. Função Principal de Cálculo PJ 2026
export function calcularPJ2026(input: PJInput2026): PJResult2026 {
  const f = Math.max(0, input.faturamento);
  const p = calcularProLabore(f);
  const das = calcularDAS(f);
  const darf = calcularDARF(p);

  const totalImpostos = Number((das + darf).toFixed(2));
  const faturamentoLiquido = Number((f - totalImpostos).toFixed(2));
  const percentualImpostos = f > 0 ? Number(((totalImpostos / f) * 100).toFixed(2)) : 0;
  const lucroIsento = Number((faturamentoLiquido - p).toFixed(2));

  return {
    faturamento: f,
    proLabore: p,
    dasSimples: das,
    darf,
    totalImpostos,
    faturamentoLiquido,
    percentualImpostos,
    proLaborePercentual: 28,
    lucroIsento,
  };
}

// 5. Teste Unitário PJ 2026
export function executarTesteUnitarioPJ2026(): boolean {
  const inputTeste: PJInput2026 = { faturamento: 10000.00 };
  const res = calcularPJ2026(inputTeste);

  const tol = 0.01;
  const passPL = Math.abs(res.proLabore - 2800.00) < tol;
  const passDAS = Math.abs(res.dasSimples - 600.00) < tol;
  const passDARF = Math.abs(res.darf - 308.00) < tol;
  const passImpostos = Math.abs(res.totalImpostos - 908.00) < tol;
  const passLiquido = Math.abs(res.faturamentoLiquido - 9092.00) < tol;

  const ok = passPL && passDAS && passDARF && passImpostos && passLiquido;
  if (!ok) {
    console.error('❌ FALHA NO TESTE UNITÁRIO OBRIGATÓRIO PJ 2026:', res);
    throw new Error('Assertion Failed: PJ 2026 unit test mandatory case failed.');
  }
  console.log('✅ TESTE UNITÁRIO OBRIGATÓRIO PJ 2026 PASSOU COM SUCESSO!');
  return true;
}

try {
  executarTesteUnitarioPJ2026();
} catch (err) {
  console.error(err);
}
