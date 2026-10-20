import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://bnhxmjcgyqwjombhrdks.supabase.co';
const SUPABASE_KEY = 
  process.env.SUPABASE_SERVICE_ROLE_KEY || 
  process.env.SUPABASE_KEY || 
  process.env.SUPABASE_ANON_KEY || 
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJuaHhtamNneXF3am9tYmhyZGtzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4NDk3MDksImV4cCI6MjA4MDQyNTcwOX0.wg7k8DJhE29d24BzGwp5ltUx_x_4iXjQFOC55x3t4B8';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const MESES_NOMES = [
  "JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", 
  "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"
];

const getActiveReferenceMonth = async (): Promise<string> => {
  try {
    const { data: meses } = await supabase.from('meses').select('*').eq('status', 'ativo');
    if (meses && meses.length > 0) {
      const getMonthValue = (m: any) => {
        const idx = MESES_NOMES.indexOf(String(m.nome || '').trim().toUpperCase());
        return Number(m.ano) * 100 + (idx !== -1 ? idx : 0);
      };
      const sorted = [...meses].sort((a, b) => getMonthValue(a) - getMonthValue(b));
      const active = sorted[0];
      if (active && active.nome && active.ano) {
        return `${String(active.nome).trim().toUpperCase()}/${active.ano}`;
      }
    }
  } catch (err) {
    console.error("Erro ao resolver mês ativo:", err);
  }
  const now = new Date();
  return `${MESES_NOMES[now.getMonth()]}/${now.getFullYear()}`;
};

const normalizeCategoria = (cat: any): 'Restaurante' | 'Lazer' | 'Conveniência' | null => {
  if (!cat || typeof cat !== 'string') return null;
  const clean = cat.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (clean === 'restaurante') return 'Restaurante';
  if (clean === 'lazer') return 'Lazer';
  if (clean === 'conveniencia') return 'Conveniência';
  return null;
};

const jsonHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-api-key, X-API-KEY, Authorization'
};

export async function OPTIONS() {
  return new Response(JSON.stringify({ sucesso: true, status: 'ok' }), { status: 200, headers: jsonHeaders });
}

export async function GET() {
  try {
    const mesAtivo = await getActiveReferenceMonth();
    return new Response(
      JSON.stringify({
        status: "online",
        servico: "API Gastos - Sistema Mathews e Débora",
        metodos_permitidos: ["POST"],
        mes_referencia_ativo: mesAtivo,
        categorias_permitidas: ["Restaurante", "Lazer", "Conveniência"]
      }),
      { status: 200, headers: jsonHeaders }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ status: "online", servico: "API Gastos - Sistema Mathews e Débora", metodos_permitidos: ["POST"] }),
      { status: 200, headers: jsonHeaders }
    );
  }
}

export async function POST(req: Request) {
  try {
    const apiKey = req.headers.get('x-api-key') || req.headers.get('X-API-KEY') || req.headers.get('x-api-token');
    const configuredKey = process.env.GASTOS_API_KEY || 'md-gastos-secret-key-2026';

    if (!apiKey || apiKey.trim() !== configuredKey.trim()) {
      return new Response(
        JSON.stringify({ sucesso: false, erro: "Chave de API inválida" }),
        { status: 401, headers: jsonHeaders }
      );
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ sucesso: false, erro: "Dados inválidos: corpo da requisição deve ser um JSON válido." }),
        { status: 400, headers: jsonHeaders }
      );
    }

    const { valor, categoria, mes_referencia: customMes } = body || {};

    const canonicalCategoria = normalizeCategoria(categoria);
    if (!canonicalCategoria) {
      return new Response(
        JSON.stringify({ sucesso: false, erro: "Dados inválidos: Categoria permitida apenas 'Restaurante', 'Lazer' ou 'Conveniência'." }),
        { status: 400, headers: jsonHeaders }
      );
    }

    let numVal: number;
    if (typeof valor === 'number') {
      numVal = valor;
    } else if (typeof valor === 'string') {
      const cleaned = valor.replace(/[^\d,.-]/g, '').replace(',', '.');
      numVal = parseFloat(cleaned);
    } else {
      return new Response(
        JSON.stringify({ sucesso: false, erro: "Dados inválidos: Campo 'valor' obrigatório e numérico." }),
        { status: 400, headers: jsonHeaders }
      );
    }

    if (isNaN(numVal) || numVal <= 0) {
      return new Response(
        JSON.stringify({ sucesso: false, erro: "Dados inválidos: O campo 'valor' deve ser maior que zero." }),
        { status: 400, headers: jsonHeaders }
      );
    }

    const valorFinal = Number(numVal.toFixed(2));
    const mesReferencia = customMes && typeof customMes === 'string' && customMes.trim()
      ? customMes.trim().toUpperCase()
      : await getActiveReferenceMonth();

    const payload = {
      categoria: canonicalCategoria,
      valor: valorFinal,
      mes_referencia: mesReferencia,
      created_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('gastos_itens')
      .insert([payload])
      .select()
      .single();

    if (error) {
      return new Response(
        JSON.stringify({ sucesso: false, erro: error.message || "Erro ao gravar registro no banco de dados Supabase." }),
        { status: 500, headers: jsonHeaders }
      );
    }

    return new Response(
      JSON.stringify({
        sucesso: true,
        mensagem: "Gasto registrado com sucesso",
        registro: data
      }),
      { status: 200, headers: jsonHeaders }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ sucesso: false, erro: err.message || "Erro interno do servidor ao processar gasto." }),
      { status: 500, headers: jsonHeaders }
    );
  }
}
