import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://bnhxmjcgyqwjombhrdks.supabase.co';
const SUPABASE_KEY = 
  process.env.SUPABASE_SERVICE_ROLE_KEY || 
  process.env.SUPABASE_KEY || 
  process.env.SUPABASE_ANON_KEY || 
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJuaHhtamNneXF3am9tYmhyZGtzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4NDk3MDksImV4cCI6MjA4MDQyNTcwOX0.wg7k8DJhE29d24BzGwp5ltUx_x_4iXjQFOC55x3t4B8';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

const MESES_NOMES = [
  "JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", 
  "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"
];

// Helper seguro para envio de JSON independente da plataforma (Vercel, Express ou Node puro)
function sendJson(res: any, status: number, data: any) {
  const jsonStr = JSON.stringify(data);
  try {
    if (typeof res.setHeader === 'function') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key, X-API-KEY, Authorization');
    }
    if (typeof res.status === 'function' && typeof res.json === 'function') {
      return res.status(status).json(data);
    }
    if (typeof res.writeHead === 'function') {
      res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, x-api-key, X-API-KEY, Authorization'
      });
      return res.end(jsonStr);
    }
    res.statusCode = status;
    return res.end(jsonStr);
  } catch (err) {
    console.error("Falha fatal ao enviar resposta JSON:", err);
    try {
      res.statusCode = status;
      res.end(jsonStr);
    } catch {}
  }
}

// Leitor resiliente do body da requisição
async function getRequestBody(req: any): Promise<any> {
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

// Helper para obter o mês de referência ativo
const getActiveReferenceMonth = async (): Promise<string> => {
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

export default async function handler(req: any, res: any) {
  try {
    const method = String(req.method || 'GET').toUpperCase();

    // 1. Tratamento preliminar do método OPTIONS (pre-flight CORS)
    if (method === 'OPTIONS') {
      return sendJson(res, 200, { sucesso: true, status: 'ok' });
    }

    // 2. Método GET: Diagnóstico legível no navegador
    if (method === 'GET') {
      const mesAtivo = await getActiveReferenceMonth();
      return sendJson(res, 200, {
        status: "online",
        servico: "API Gastos - Sistema Mathews e Débora",
        metodos_permitidos: ["POST"],
        mes_referencia_ativo: mesAtivo,
        categorias_permitidas: ["Restaurante", "Lazer", "Conveniência"]
      });
    }

    // 3. Validação do método POST
    if (method !== 'POST') {
      return sendJson(res, 405, {
        sucesso: false,
        erro: "Método não permitido. Utilize POST para registrar gastos."
      });
    }

    // 4. Validação de autenticação via x-api-key
    const headers = req.headers || {};
    const apiKey = headers['x-api-key'] || headers['X-API-KEY'] || headers['x-api-token'];
    const configuredKey = process.env.GASTOS_API_KEY || 'md-gastos-secret-key-2026';

    if (!apiKey || String(apiKey).trim() !== String(configuredKey).trim()) {
      return sendJson(res, 401, {
        sucesso: false,
        erro: "Chave de API inválida"
      });
    }

    // 5. Leitura e validação dos dados
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

    // 6. Resolução do mês de referência
    const mesReferencia = customMes && typeof customMes === 'string' && customMes.trim()
      ? customMes.trim().toUpperCase()
      : await getActiveReferenceMonth();

    const payload = {
      categoria: canonicalCategoria,
      valor: valorFinal,
      mes_referencia: mesReferencia,
      created_at: new Date().toISOString()
    };

    // 7. Persistência real no Supabase
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

    // 8. Resposta de sucesso confirmada
    return sendJson(res, 200, {
      sucesso: true,
      mensagem: "Gasto registrado com sucesso",
      registro: data
    });
  } catch (err: any) {
    console.error("Exceção geral capturada na API de gastos:", err);
    return sendJson(res, 500, {
      sucesso: false,
      erro: err.message || "Erro interno do servidor ao processar gasto."
    });
  }
}
