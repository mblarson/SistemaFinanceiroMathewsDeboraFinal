import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://bnhxmjcgyqwjombhrdks.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJuaHhtamNneXF3am9tYmhyZGtzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4NDk3MDksImV4cCI6MjA4MDQyNTcwOX0.wg7k8DJhE29d24BzGwp5ltUx_x_4iXjQFOC55x3t4B8';

export const supabaseServerClient = createClient(SUPABASE_URL, SUPABASE_KEY);

export const VALID_CATEGORIES = ['Restaurante', 'Lazer', 'Conveniência'] as const;
export type ValidCategory = (typeof VALID_CATEGORIES)[number];

// Normaliza a categoria de forma case-insensitive e tolerante a acentos
export function normalizeCategory(cat: unknown): ValidCategory | null {
  if (!cat || typeof cat !== 'string') return null;
  const clean = cat.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (clean === 'restaurante') return 'Restaurante';
  if (clean === 'lazer') return 'Lazer';
  if (clean === 'conveniencia') return 'Conveniência';
  return null;
}

// Sanitização monetária estrita para exatamente 2 casas decimais
export function sanitizeMoney(val: unknown): number {
  let num: number;
  if (typeof val === 'number') {
    num = val;
  } else if (typeof val === 'string') {
    const cleanStr = val.trim().replace(/[^\d.,]/g, '').replace(',', '.');
    num = parseFloat(cleanStr);
  } else {
    num = 0;
  }
  if (isNaN(num) || !isFinite(num) || num <= 0) {
    return 0;
  }
  return Math.round(num * 100) / 100;
}

// Formatação BRL padrão
export function formatCurrencyBRL(val: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(val);
}

// Validação de autenticação via header x-api-key, apikey ou Authorization Bearer
export function validateAuth(req: any): boolean {
  const configuredSecret = (process.env.GASTOS_API_KEY || process.env.API_SECRET_KEY || 'gastos_secret_token_2026').trim();
  const supabaseAnon = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJuaHhtamNneXF3am9tYmhyZGtzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4NDk3MDksImV4cCI6MjA4MDQyNTcwOX0.wg7k8DJhE29d24BzGwp5ltUx_x_4iXjQFOC55x3t4B8';

  // 1. Header x-api-key, x-api-token ou apikey
  const xApiKey = req.headers['x-api-key'] || req.headers['x-api-token'] || req.headers['apikey'];
  if (xApiKey) {
    const val = String(xApiKey).trim();
    if (val === configuredSecret || val === supabaseAnon) {
      return true;
    }
  }

  // 2. Header Authorization (Bearer Token)
  const authHeader = req.headers['authorization'];
  if (authHeader) {
    const parts = String(authHeader).trim().split(' ');
    const token = parts.length === 2 && parts[0].toLowerCase() === 'bearer' ? parts[1] : parts[0];
    if (token === configuredSecret || token === supabaseAnon) {
      return true;
    }
  }

  return false;
}

const MESES_NOMES = [
  "JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", 
  "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"
];

function getMonthSortValue(m: any): number {
  const ano = typeof m.ano === 'number' ? m.ano : 2026;
  const idx = MESES_NOMES.indexOf(String(m.nome || '').trim().toUpperCase());
  return ano * 100 + (idx >= 0 ? idx : 0);
}

// Busca o mês de referência ativo atual no Supabase
export async function getActiveMonth() {
  const { data: meses, error } = await supabaseServerClient
    .from('meses')
    .select('*')
    .order('ano', { ascending: false });

  if (error || !meses || meses.length === 0) {
    throw new Error(error?.message || 'Nenhum mês cadastrado no banco.');
  }

  // Regra idêntica à do App.tsx: Meses com status 'ativo' ordenados cronologicamente ASC (o primeiro é o ativo corrente)
  const activeMonths = meses.filter((m: any) => m.status === 'ativo');
  activeMonths.sort((a: any, b: any) => getMonthSortValue(a) - getMonthSortValue(b));

  if (activeMonths.length > 0) {
    return activeMonths[0];
  }

  return meses[0];
}

// Handler para o endpoint POST /api/gastos
export async function handleGastosPost(req: any, res: any) {
  // 1. Verificação de Autenticação
  if (!validateAuth(req)) {
    return res.status(401).json({
      error: 'Não autorizado',
      message: 'Token de autenticação inválido ou ausente. Forneça o header x-api-key ou Authorization: Bearer <token>.'
    });
  }

  // 2. Validação de Payload
  const body = req.body || {};
  if (!body || typeof body !== 'object') {
    return res.status(400).json({
      error: 'Corpo da requisição inválido',
      message: 'O payload enviado deve ser um JSON válido contendo os campos "valor" e "categoria".'
    });
  }

  const { valor, categoria, descricao } = body;

  if (valor === undefined || valor === null || valor === '') {
    return res.status(400).json({
      error: 'Campo obrigatório ausente',
      message: 'O campo "valor" é obrigatório.'
    });
  }

  if (!categoria) {
    return res.status(400).json({
      error: 'Campo obrigatório ausente',
      message: 'O campo "categoria" é obrigatório. Categorias permitidas: "Restaurante", "Lazer" ou "Conveniência".'
    });
  }

  // Sanitização estrita do valor
  const sanitizedValor = sanitizeMoney(valor);
  if (sanitizedValor <= 0) {
    return res.status(400).json({
      error: 'Valor inválido',
      message: 'O campo "valor" deve ser um número positivo maior que zero (ex: 50.00).'
    });
  }

  // Validação da categoria
  const normalizedCategory = normalizeCategory(categoria);
  if (!normalizedCategory) {
    return res.status(400).json({
      error: 'Categoria inválida',
      message: `A categoria "${categoria}" não é permitida. As categorias válidas são exclusivamente: "Restaurante", "Lazer" ou "Conveniência".`
    });
  }

  try {
    // 3. Obter Mês de Referência Ativo
    const activeMonth = await getActiveMonth();

    const now = new Date();
    // Data no formato YYYY-MM-DD
    const dateStr = now.toISOString().split('T')[0];
    // Hora no formato HH:mm:ss
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const timeStr = `${hours}:${minutes}:${seconds}`;

    const descStr = descricao && typeof descricao === 'string' && descricao.trim().length > 0 
      ? descricao.trim() 
      : normalizedCategory;

    // 4. Inserção isolada no banco de dados
    const insertPayload = {
      mes_id: activeMonth.id,
      categoria: normalizedCategory,
      valor: sanitizedValor,
      descricao: descStr,
      data: dateStr,
      hora: timeStr,
      criado_em: now.toISOString()
    };

    const { data: inserted, error: insertError } = await supabaseServerClient
      .from('gastos_itens')
      .insert([insertPayload])
      .select()
      .single();

    if (insertError) {
      console.error('Erro ao inserir gasto no Supabase:', insertError);
      return res.status(500).json({
        error: 'Erro no banco de dados',
        message: `Não foi possível salvar o gasto: ${insertError.message}`
      });
    }

    // 5. Cálculo do novo acumulador somado daquele card no mês de referência
    const { data: catItems, error: sumError } = await supabaseServerClient
      .from('gastos_itens')
      .select('valor')
      .eq('mes_id', activeMonth.id)
      .eq('categoria', normalizedCategory);

    let novoTotalAcumulado = sanitizedValor;
    if (!sumError && catItems) {
      const soma = catItems.reduce((acc: number, curr: any) => acc + (Number(curr.valor) || 0), 0);
      novoTotalAcumulado = Math.round(soma * 100) / 100;
    }

    // 6. Retorno de Sucesso (201 Created)
    return res.status(201).json({
      success: true,
      message: `Gasto de ${formatCurrencyBRL(sanitizedValor)} adicionado à categoria ${normalizedCategory} com sucesso!`,
      data: {
        id: inserted?.id,
        categoria: normalizedCategory,
        valor: sanitizedValor,
        valor_formatado: formatCurrencyBRL(sanitizedValor),
        novo_acumulador_card: novoTotalAcumulado,
        novo_acumulador_formatado: formatCurrencyBRL(novoTotalAcumulado),
        mes_referencia: {
          id: activeMonth.id,
          nome: activeMonth.nome,
          ano: activeMonth.ano,
          rotulo: `${activeMonth.nome} ${activeMonth.ano}`
        },
        data: dateStr,
        hora: timeStr
      }
    });
  } catch (err: any) {
    console.error('Falha interna ao processar gasto:', err);
    return res.status(500).json({
      error: 'Erro interno do servidor',
      message: err?.message || 'Falha inesperada ao processar o gasto.'
    });
  }
}

// Handler para consulta opcional GET /api/gastos
export async function handleGastosGet(req: any, res: any) {
  if (!validateAuth(req)) {
    return res.status(401).json({
      error: 'Não autorizado',
      message: 'Token de autenticação inválido ou ausente.'
    });
  }

  try {
    const activeMonth = await getActiveMonth();
    const { data: items } = await supabaseServerClient
      .from('gastos_itens')
      .select('*')
      .eq('mes_id', activeMonth.id);

    const acumulados: Record<string, { total: number; total_formatado: string; count: number }> = {
      Restaurante: { total: 0, total_formatado: 'R$ 0,00', count: 0 },
      Lazer: { total: 0, total_formatado: 'R$ 0,00', count: 0 },
      Conveniência: { total: 0, total_formatado: 'R$ 0,00', count: 0 }
    };

    (items || []).forEach((item: any) => {
      const cat = item.categoria;
      if (acumulados[cat]) {
        acumulados[cat].total = Math.round((acumulados[cat].total + (Number(item.valor) || 0)) * 100) / 100;
        acumulados[cat].count += 1;
      }
    });

    Object.keys(acumulados).forEach(k => {
      acumulados[k].total_formatado = formatCurrencyBRL(acumulados[k].total);
    });

    return res.json({
      mes_referencia: `${activeMonth.nome} ${activeMonth.ano}`,
      cards: acumulados
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
