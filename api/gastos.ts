import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://bnhxmjcgyqwjombhrdks.supabase.co';
// Prioritiza a SERVICE_ROLE_KEY administrativa para ignorar restrições de RLS no servidor
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

// Helper para obter o mês ativo com exata correspondência visual do front-end
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
  // Configuração global de cabeçalhos CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key, X-API-KEY');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    const mes = await getActiveReferenceMonth();
    return res.status(200).json({ 
      sucesso: true,
      status: 'online', 
      mes_referencia_ativo: mes,
      categorias_permitidas: ['Restaurante', 'Lazer', 'Conveniência']
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ 
      sucesso: false, 
      erro: "Método não permitido. Utilize POST." 
    });
  }

  // 1. Validação de autenticação via x-api-key
  const apiKey = req.headers['x-api-key'] || req.headers['X-API-KEY'] || req.headers['x-api-token'];
  const configuredKey = process.env.GASTOS_API_KEY || 'md-gastos-secret-key-2026';

  if (!apiKey || String(apiKey).trim() !== String(configuredKey).trim()) {
    return res.status(401).json({
      sucesso: false,
      erro: "Chave de API inválida"
    });
  }

  // 2. Validação do corpo da requisição (JSON)
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({
        sucesso: false,
        erro: "Dados inválidos: corpo da requisição deve ser um JSON válido."
      });
    }
  }
  body = body || {};

  const { valor, categoria, mes_referencia: customMes } = body;

  // Validação estrita de categoria
  const canonicalCategoria = normalizeCategoria(categoria);
  if (!canonicalCategoria) {
    return res.status(400).json({
      sucesso: false,
      erro: "Dados inválidos: Categoria permitida apenas 'Restaurante', 'Lazer' ou 'Conveniência'."
    });
  }

  // Validação e conversão estrita do valor com precisão NUMERIC(10,2)
  let numVal: number;
  if (typeof valor === 'number') {
    numVal = valor;
  } else if (typeof valor === 'string') {
    const cleaned = valor.replace(/[^\d,.-]/g, '').replace(',', '.');
    numVal = parseFloat(cleaned);
  } else {
    return res.status(400).json({
      sucesso: false,
      erro: "Dados inválidos: Campo 'valor' obrigatório e numérico."
    });
  }

  if (isNaN(numVal) || numVal <= 0) {
    return res.status(400).json({
      sucesso: false,
      erro: "Dados inválidos: O campo 'valor' deve ser maior que zero."
    });
  }

  const valorFinal = Number(numVal.toFixed(2));

  try {
    // 3. Resolução do mês de referência (formato rigorosamente idêntico ao front-end: NOME/ANO)
    const mesReferencia = customMes && typeof customMes === 'string' && customMes.trim()
      ? customMes.trim().toUpperCase()
      : await getActiveReferenceMonth();

    const payload = {
      categoria: canonicalCategoria,
      valor: valorFinal,
      mes_referencia: mesReferencia,
      created_at: new Date().toISOString()
    };

    // 4. Gravação real no Supabase
    const { data, error } = await supabase
      .from('gastos_itens')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error("Erro retornado pelo Supabase ao inserir gasto:", error);
      return res.status(500).json({
        sucesso: false,
        erro: error.message || "Erro ao gravar registro no banco de dados Supabase."
      });
    }

    // 5. Sucesso confirmado com persistência real
    return res.status(201).json({
      sucesso: true,
      mensagem: "Gasto registrado com sucesso",
      registro: data,
      gasto: data
    });
  } catch (err: any) {
    console.error("Exceção não tratada no backend:", err);
    return res.status(500).json({
      sucesso: false,
      erro: err.message || "Erro interno do servidor ao processar gasto."
    });
  }
}
