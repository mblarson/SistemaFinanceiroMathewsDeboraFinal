import { createClient } from '@supabase/supabase-js';

const MESES_NOMES = [
  "JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", 
  "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"
];

// 1. Inicialização defensiva do cliente Supabase (Zero Crash)
function getSupabaseClient() {
  const url = 
    process.env.SUPABASE_URL || 
    process.env.NEXT_PUBLIC_SUPABASE_URL || 
    'https://bnhxmjcgyqwjombhrdks.supabase.co';

  const key = 
    process.env.SUPABASE_SERVICE_ROLE_KEY || 
    process.env.SUPABASE_KEY || 
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
    process.env.SUPABASE_ANON_KEY || 
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJuaHhtamNneXF3am9tYmhyZGtzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4NDk3MDksImV4cCI6MjA4MDQyNTcwOX0.wg7k8DJhE29d24BzGwp5ltUx_x_4iXjQFOC55x3t4B8';

  if (!url || !key) {
    throw new Error("Variáveis de ambiente do Supabase não configuradas na Vercel.");
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

// 2. Helper de resposta JSON universal (Express, Vercel Serverless ou Node puro)
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
    console.error("Falha ao enviar resposta HTTP:", err);
  }
}

// 3. Leitor seguro e resiliente do corpo da requisição (Buffer, Stream ou Objeto)
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

// 4. Resolução segura do mês de referência (com fallback síncrono que nunca quebra)
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
    console.warn("Aviso ao buscar mês ativo:", err);
  }

  return fallbackMes;
}

// 5. Handler padrão exportado para o Vercel Serverless Function (@vercel/node)
export default async function handler(req: any, res: any) {
  try {
    const method = String(req.method || 'GET').toUpperCase();

    // A. Tratamento de OPTIONS (Pre-flight do iOS Shortcuts)
    if (method === 'OPTIONS') {
      return sendJson(res, 200, { status: "ok" });
    }

    // B. Tratamento de GET: Resposta estática imediata para teste visual no navegador
    if (method === 'GET') {
      return sendJson(res, 200, {
        status: "online",
        servico: "API Gastos",
        timestamp: new Date().toISOString()
      });
    }

    // C. Bloqueio de outros métodos
    if (method !== 'POST') {
      return sendJson(res, 405, {
        sucesso: false,
        erro: "Método não permitido. Utilize POST para registrar gastos."
      });
    }

    // D. Validação de autenticação via header x-api-key
    const headers = req.headers || {};
    const apiKey = headers['x-api-key'] || headers['X-API-KEY'] || headers['x-api-token'];
    const configuredKey = process.env.GASTOS_API_KEY || 'md-gastos-secret-key-2026';

    if (!apiKey || String(apiKey).trim() !== String(configuredKey).trim()) {
      return sendJson(res, 401, {
        sucesso: false,
        erro: "Chave de API inválida"
      });
    }

    // E. Leitura e validação dos dados com parse seguro
    const body = await getRequestBody(req);
    if (!body || Object.keys(body).length === 0) {
      return sendJson(res, 400, {
        sucesso: false,
        erro: "Corpo da requisição inválido ou vazio."
      });
    }

    const { valor, categoria, mes_referencia: customMes } = body;

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

    // F. Inicialização defensiva do cliente Supabase
    let supabase: any;
    try {
      supabase = getSupabaseClient();
    } catch (supErr: any) {
      return sendJson(res, 500, {
        sucesso: false,
        erro: supErr.message || "Variáveis de ambiente do Supabase não configuradas na Vercel."
      });
    }

    // G. Resolução do mês de referência
    const mesReferencia = await resolveMesReferencia(supabase, customMes);

    const payload = {
      categoria: canonicalCategoria,
      valor: valorFinal,
      mes_referencia: mesReferencia,
      created_at: new Date().toISOString()
    };

    // H. Gravação real no Supabase
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

    // I. Sucesso confirmado
    return sendJson(res, 200, {
      sucesso: true,
      mensagem: "Gasto registrado com sucesso",
      registro: data
    });
  } catch (err: any) {
    console.error("Exceção geral capturada na API de gastos:", err);
    return sendJson(res, 500, {
      sucesso: false,
      erro: err.message || "Erro interno do servidor ao processar requisição."
    });
  }
}
