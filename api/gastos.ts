// ==============================================================================
// ROTA: /api/gastos (Vercel Serverless Function - Padrão Vite/Node)
// ==============================================================================
// REGRA: TOP-LEVEL ZERO. Nenhuma inicialização ou leitura de banco ocorre fora do handler.

const MESES_NOMES = [
  "JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", 
  "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"
];

// Helper agnóstico para envio de respostas JSON com CORS forçado
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
  } catch (e) {
    console.error("Falha ao escrever resposta:", e);
  }
}

// Leitor seguro do body
async function parseRequestBody(req: any): Promise<any> {
  if (!req) return null;
  if (req.body) {
    if (typeof req.body === 'object') return req.body;
    if (typeof req.body === 'string') {
      try { return JSON.parse(req.body); } catch { return null; }
    }
  }
  if (typeof req.on === 'function') {
    return new Promise((resolve) => {
      let data = '';
      req.on('data', (chunk: any) => { data += chunk; });
      req.on('end', () => {
        try { resolve(JSON.parse(data)); } catch { resolve(null); }
      });
      req.on('error', () => resolve(null));
    });
  }
  return null;
}

function normalizeCategoria(cat: any): 'Restaurante' | 'Lazer' | 'Conveniência' | null {
  if (!cat || typeof cat !== 'string') return null;
  const clean = cat.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (clean === 'restaurante') return 'Restaurante';
  if (clean === 'lazer') return 'Lazer';
  if (clean === 'conveniencia') return 'Conveniência';
  return null;
}

// Handler padrão único para Vercel Serverless Function
export default async function handler(req: any, res: any) {
  try {
    const method = String(req.method || 'GET').toUpperCase();

    // 1. OPTIONS: CORS pre-flight instantâneo
    if (method === 'OPTIONS') {
      return sendJson(res, 200, { status: "ok" });
    }

    // 2. GET: Teste de vida puro e estático (Zero dependência de banco de dados ou variáveis)
    if (method === 'GET') {
      return sendJson(res, 200, {
        status: "online",
        servico: "API Gastos",
        timestamp: new Date().toISOString()
      });
    }

    // 3. Bloqueio de métodos não permitidos
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

    // 5. Parse seguro do corpo da requisição
    const body = await parseRequestBody(req);
    if (!body || typeof body !== 'object' || Object.keys(body).length === 0) {
      return sendJson(res, 400, {
        sucesso: false,
        erro: "Corpo da requisição inválido ou vazio."
      });
    }

    const { valor, categoria, mes_referencia: customMes } = body;

    // Validação de categoria
    const canonicalCategoria = normalizeCategoria(categoria);
    if (!canonicalCategoria) {
      return sendJson(res, 400, {
        sucesso: false,
        erro: "Dados inválidos: Categoria permitida apenas 'Restaurante', 'Lazer' ou 'Conveniência'."
      });
    }

    // Validação de valor numérico maior que zero
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

    // 6. Inicialização Preguiçosa (Lazy Initialization) das credenciais do Supabase
    const supabaseUrl = 
      process.env.SUPABASE_URL || 
      process.env.NEXT_PUBLIC_SUPABASE_URL || 
      'https://bnhxmjcgyqwjombhrdks.supabase.co';

    const supabaseKey = 
      process.env.SUPABASE_SERVICE_ROLE_KEY || 
      process.env.SUPABASE_KEY || 
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
      process.env.SUPABASE_ANON_KEY || 
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJuaHhtamNneXF3am9tYmhyZGtzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4NDk3MDksImV4cCI6MjA4MDQyNTcwOX0.wg7k8DJhE29d24BzGwp5ltUx_x_4iXjQFOC55x3t4B8';

    if (!supabaseUrl || !supabaseKey) {
      return sendJson(res, 500, {
        sucesso: false,
        erro: "Variáveis do Supabase não configuradas na Vercel."
      });
    }

    // 7. Resolução do mês de referência (com fallback síncrono blindado)
    const now = new Date();
    let mesReferencia = customMes && typeof customMes === 'string' && customMes.trim()
      ? customMes.trim().toUpperCase()
      : `${MESES_NOMES[now.getMonth()]}/${now.getFullYear()}`;

    // Tenta obter o mês ativo dinamicamente via PostgREST nativo
    try {
      const mesRes = await fetch(`${supabaseUrl}/rest/v1/meses?status=eq.ativo&select=*`, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        }
      });
      if (mesRes.ok) {
        const meses = await mesRes.json();
        if (Array.isArray(meses) && meses.length > 0) {
          const getMonthValue = (m: any) => {
            const idx = MESES_NOMES.indexOf(String(m.nome || '').trim().toUpperCase());
            return Number(m.ano) * 100 + (idx !== -1 ? idx : 0);
          };
          meses.sort((a: any, b: any) => getMonthValue(a) - getMonthValue(b));
          const active = meses[0];
          if (active && active.nome && active.ano) {
            mesReferencia = `${String(active.nome).trim().toUpperCase()}/${active.ano}`;
          }
        }
      }
    } catch (e) {
      console.warn("Aviso na resolução do mês (utilizando fallback):", e);
    }

    const payload = {
      categoria: canonicalCategoria,
      valor: valorFinal,
      mes_referencia: mesReferencia,
      created_at: new Date().toISOString()
    };

    // 8. Gravação real no Supabase via API REST nativa (Zero overhead de pacotes)
    const insertRes = await fetch(`${supabaseUrl}/rest/v1/gastos_itens`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(payload)
    });

    if (!insertRes.ok) {
      const errData = await insertRes.json().catch(() => ({ message: insertRes.statusText }));
      console.error("Erro retornado pelo Supabase PostgREST:", errData);
      return sendJson(res, 500, {
        sucesso: false,
        erro: errData.message || errData.details || "Erro ao gravar registro no banco de dados Supabase."
      });
    }

    const insertedRows = await insertRes.json();
    const registro = Array.isArray(insertedRows) ? insertedRows[0] : insertedRows;

    // 9. Resposta de sucesso confirmada
    return sendJson(res, 201, {
      sucesso: true,
      mensagem: "Gasto registrado com sucesso",
      registro
    });
  } catch (err: any) {
    console.error("Exceção geral capturada na API de gastos:", err);
    return sendJson(res, 500, {
      sucesso: false,
      erro: err.message || "Erro interno do servidor ao processar requisição."
    });
  }
}
