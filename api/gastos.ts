import type { IncomingMessage, ServerResponse } from 'http';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://bnhxmjcgyqwjombhrdks.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJuaHhtamNneXF3am9tYmhyZGtzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4NDk3MDksImV4cCI6MjA4MDQyNTcwOX0.wg7k8DJhE29d24BzGwp5ltUx_x_4iXjQFOC55x3t4B8';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const MESES_NOMES = [
  "JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", 
  "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"
];

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
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    const mes = await getActiveReferenceMonth();
    return res.status(200).json({ status: 'online', mes_referencia_ativo: mes });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido. Use POST.' });
  }

  const apiKey = req.headers['x-api-key'] || req.headers['X-API-KEY'];
  const configuredKey = process.env.GASTOS_API_KEY || 'md-gastos-secret-key-2026';

  if (!apiKey || apiKey !== configuredKey) {
    return res.status(401).json({
      error: "Acesso não autorizado. Header 'x-api-key' inválido ou ausente."
    });
  }

  const body = req.body || {};
  const { valor, categoria, mes_referencia: customMes } = body;

  const canonicalCategoria = normalizeCategoria(categoria);
  if (!canonicalCategoria) {
    return res.status(400).json({
      error: "Categoria inválida. Categorias permitidas: 'Restaurante', 'Lazer' ou 'Conveniência'."
    });
  }

  let numVal: number;
  if (typeof valor === 'number') {
    numVal = valor;
  } else if (typeof valor === 'string') {
    const cleaned = valor.replace(/[^\d,.-]/g, '').replace(',', '.');
    numVal = parseFloat(cleaned);
  } else {
    return res.status(400).json({ error: "Campo 'valor' obrigatório e numérico." });
  }

  if (isNaN(numVal) || numVal <= 0) {
    return res.status(400).json({ error: "O campo 'valor' deve ser maior que zero." });
  }

  const valorFinal = Number(numVal.toFixed(2));

  try {
    const mesReferencia = customMes && typeof customMes === 'string' && customMes.trim()
      ? customMes.trim().toUpperCase()
      : await getActiveReferenceMonth();

    const { data, error } = await supabase
      .from('gastos_itens')
      .insert([{
        categoria: canonicalCategoria,
        valor: valorFinal,
        mes_referencia: mesReferencia,
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: 'Erro no Supabase', details: error.message });
    }

    return res.status(201).json({
      success: true,
      message: `Gasto de R$ ${valorFinal.toFixed(2).replace('.', ',')} em ${canonicalCategoria} registrado!`,
      gasto: data
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro interno', details: err.message });
  }
}
