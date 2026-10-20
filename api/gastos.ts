import { createClient } from '@supabase/supabase-js';

const MESES_NOMES = [
  "JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", 
  "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"
];

// Helper defensivo para inicialização do Supabase sem crash global
function getSupabaseClient() {
  const url = process.env.SUPABASE_URL || 'https://bnhxmjcgyqwjombhrdks.supabase.co';
  const key = 
    process.env.SUPABASE_SERVICE_ROLE_KEY || 
    process.env.SUPABASE_KEY || 
    process.env.SUPABASE_ANON_KEY || 
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJuaHhtamNneXF3am9tYmhyZGtzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4NDk3MDksImV4cCI6MjA4MDQyNTcwOX0.wg7k8DJhE29d24BzGwp5ltUx_x_4iXjQFOC55x3t4B8';

  if (!url || !key) {
    return { client: null, erro: "Variáveis de ambiente do Supabase não configuradas no servidor." };
  }

  try {
    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    return { client, erro: null };
  } catch (err: any) {
    return { client: null, erro: `Falha ao inicializar Supabase: ${err.message || String(err)}` };
  }
}

// Resposta JSON universal à prova de falhas para o formato Node/Vercel (req, res)
function sendJson(res: any, status: number, data: any) {
  const jsonStr = JSON.stringify(data);
  try {
    if (res && typeof res.setHeader === 'function') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key, X-API-KEY, Authorization');
    }
  } catch {}

  try {
    if (res && typeof res.status === 'function' && typeof res.json === 'function') {
      return res.status(status).json(data);
    }
  } catch {}

  try {
    if (res && typeof res.writeHead === 'function') {
      res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, x-api-key, X-API-KEY, Authorization'
      });
      return res.end(jsonStr);
    }
  } catch {}

  try {
    if (res) {
      res.statusCode = status;
      return res.end(jsonStr);
    }
  } catch (err) {
    console.error("Erro crítico ao escrever resposta:", err);
  }
}

// Leitor resiliente do corpo da requisição (buffer, stream ou objeto pré-parseado)
async function getRequestBody(req: any): Promise<any> {
  if (!req) return {};
  if (req.body) {
    if (typeof req.body === 'object') return req.body;
    if (typeof req.body === 'string') {
      try { return JSON.parse(req.body); } catch { return {}; }
    }
  }
  if (typeof req.on === 'function') {
    return new Promise((resolve) => {
      let data = '';
      req.on('data', (chunk: any) => { data += chunk; });
      req.on('end', () => {
        try { resolve(JSON.parse(data)); } catch { resolve({}); }
      });
      req.on('error', () => resolve({}));
    });
  }
  return {};
}

const normalizeCategoria = (cat: any): 'Restaurante' | 'Lazer' | 'Conveniência' | null => {
  if (!cat || typeof cat !== 'string') return null;
  const clean = cat.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (clean === 'restaurante') return 'Restaurante';
  if (clean === 'lazer') return 'Lazer';
  if (clean === 'conveniencia') return 'Conveniência';
  return null;
};

// Resolução segura do mês de referência com fallback síncrono garantido
async function resolveMesReferencia(supabase: any, customMes?: string): Promise<string> {
  const now = new Date();
  const fallbackMes = `${MESES_NOMES[now.getMonth()]}/${now.getFullYear()}`;

  if (customMes && typeof customMes === 'string' && customMes.trim()) {
    return customMes.trim().toUpperCase();
  }

  if (!supabase) return fallbackMes;

  try {
    const { data: meses } = await supabase
      .from('meses')
      .select('*')
      .eq('status', 'ativo');

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
    console.warn("Aviso ao buscar mês ativo no Supabase (usando fallback):", err);
  }

  return fallbackMes;
}

// --------------------------------------------------------------------------
// HANDLER PADRÃO VERCEL SERVERLESS / PAGES ROUTER / EXPRESS
// --------------------------------------------------------------------------
export default async function handler(req: any, res: any) {
  try {
    const method = String(req.method || 'GET').toUpperCase();

    // 1. Método OPTIONS: Resposta instantânea para CORS pre-flight
    if (method === 'OPTIONS') {
      return sendJson(res, 200, { status: "ok" });
    }

    // 2. Método GET: Resposta estática pura sem consultas externas para teste no navegador
    if (method === 'GET') {
      return sendJson(res, 200, {
        status: "online",
        servico: "API Gastos",
        timestamp: new Date().toISOString()
      });
    }

    // 3. Bloqueio de outros métodos
    if (method !== 'POST') {
      return sendJson(res, 405, {
        sucesso: false,
        erro: "Método não permitido. Utilize POST para registrar gastos."
      });
    }

    // 4. Validação de autenticação via header x-api-key
    const headers = req.headers || {};
    const apiKey = headers['x-api-key'] || headers['X-API-KEY'] || headers['x-api-token'];
    const configuredKey = process.env.GASTOS_API_KEY || 'md-gastos-secret-key-2026';

    if (!apiKey || String(apiKey).trim() !== String(configuredKey).trim()) {
      return sendJson(res, 401, {
        sucesso: false,
        erro: "Chave de API inválida"
      });
    }

    // 5. Validação dos dados enviados
    const body = await getRequestBody(req);
    const { valor, categoria, mes_referencia: customMes } = body || {};

    const canonicalCategoria = normalizeCategoria(categoria);
    if (!canonicalCategoria) {
      return sendJson(res, 400, {
        sucesso: false,
        erro: "Dados inválidos: Categoria permitida apenas 'Restaurante', 'Lazer' ou 'Conveniência'."
      });
    }

    let numVal: number;
    if (typeof valor === 'number') {
      numVal = valor;
    } else if (typeof valor === 'string') {
      const cleaned = valor.replace(/[^\d,.-]/g, '').replace(',', '.');
      numVal = parseFloat(cleaned);
    } else {
      return sendJson(res, 400, {
        sucesso: false,
        erro: "Dados inválidos: Campo 'valor' obrigatório e numérico."
      });
    }

    if (isNaN(numVal) || numVal <= 0) {
      return sendJson(res, 400, {
        sucesso: false,
        erro: "Dados inválidos: O campo 'valor' deve ser maior que zero."
      });
    }

    const valorFinal = Number(numVal.toFixed(2));

    // 6. Inicialização defensiva do cliente Supabase
    const { client: supabase, erro: supabaseInitErro } = getSupabaseClient();
    if (!supabase) {
      return sendJson(res, 500, {
        sucesso: false,
        erro: supabaseInitErro || "Variáveis de ambiente do Supabase não configuradas no servidor."
      });
    }

    // 7. Resolução do mês de referência
    const mesReferencia = await resolveMesReferencia(supabase, customMes);

    const payload = {
      categoria: canonicalCategoria,
      valor: valorFinal,
      mes_referencia: mesReferencia,
      created_at: new Date().toISOString()
    };

    // 8. Gravação real no Supabase
    const { data, error } = await supabase
      .from('gastos_itens')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error("Erro do Supabase ao inserir gasto:", error);
      return sendJson(res, 500, {
        sucesso: false,
        erro: error.message || "Erro ao gravar registro no banco de dados Supabase."
      });
    }

    return sendJson(res, 200, {
      sucesso: true,
      mensagem: "Gasto registrado com sucesso",
      registro: data
    });
  } catch (err: any) {
    console.error("Exceção não tratada capturada pelo handler da API de gastos:", err);
    return sendJson(res, 500, {
      sucesso: false,
      erro: err.message || "Erro interno do servidor ao processar requisição."
    });
  }
}

// --------------------------------------------------------------------------
// EXPORTAÇÕES ADICIONAIS PARA SUPORTE NATIVO AO NEXT.JS APP ROUTER (WEB API)
// --------------------------------------------------------------------------
const webHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-api-key, X-API-KEY, Authorization'
};

export async function OPTIONS() {
  return new Response(JSON.stringify({ status: "ok" }), { status: 200, headers: webHeaders });
}

export async function GET() {
  return new Response(
    JSON.stringify({
      status: "online",
      servico: "API Gastos",
      timestamp: new Date().toISOString()
    }),
    { status: 200, headers: webHeaders }
  );
}

export async function POST(request: Request) {
  try {
    const apiKey = request.headers.get('x-api-key') || request.headers.get('X-API-KEY') || request.headers.get('x-api-token');
    const configuredKey = process.env.GASTOS_API_KEY || 'md-gastos-secret-key-2026';

    if (!apiKey || apiKey.trim() !== configuredKey.trim()) {
      return new Response(
        JSON.stringify({ sucesso: false, erro: "Chave de API inválida" }),
        { status: 401, headers: webHeaders }
      );
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ sucesso: false, erro: "Dados inválidos: corpo da requisição deve ser um JSON válido." }),
        { status: 400, headers: webHeaders }
      );
    }

    const { valor, categoria, mes_referencia: customMes } = body || {};

    const canonicalCategoria = normalizeCategoria(categoria);
    if (!canonicalCategoria) {
      return new Response(
        JSON.stringify({ sucesso: false, erro: "Dados inválidos: Categoria permitida apenas 'Restaurante', 'Lazer' ou 'Conveniência'." }),
        { status: 400, headers: webHeaders }
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
        { status: 400, headers: webHeaders }
      );
    }

    if (isNaN(numVal) || numVal <= 0) {
      return new Response(
        JSON.stringify({ sucesso: false, erro: "Dados inválidos: O campo 'valor' deve ser maior que zero." }),
        { status: 400, headers: webHeaders }
      );
    }

    const valorFinal = Number(numVal.toFixed(2));

    const { client: supabase, erro: supabaseInitErro } = getSupabaseClient();
    if (!supabase) {
      return new Response(
        JSON.stringify({ sucesso: false, erro: supabaseInitErro || "Variáveis de ambiente do Supabase não configuradas no servidor." }),
        { status: 500, headers: webHeaders }
      );
    }

    const mesReferencia = await resolveMesReferencia(supabase, customMes);

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
        { status: 500, headers: webHeaders }
      );
    }

    return new Response(
      JSON.stringify({
        sucesso: true,
        mensagem: "Gasto registrado com sucesso",
        registro: data
      }),
      { status: 200, headers: webHeaders }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ sucesso: false, erro: err.message || "Erro interno do servidor ao processar requisição." }),
      { status: 500, headers: webHeaders }
    );
  }
}
