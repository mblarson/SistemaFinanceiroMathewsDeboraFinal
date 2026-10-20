import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(cors());
app.use(express.json());

// Inicialização do cliente Supabase para o backend
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://bnhxmjcgyqwjombhrdks.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJuaHhtamNneXF3am9tYmhyZGtzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4NDk3MDksImV4cCI6MjA4MDQyNTcwOX0.wg7k8DJhE29d24BzGwp5ltUx_x_4iXjQFOC55x3t4B8';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const MESES_NOMES = [
  "JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", 
  "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"
];

// Helper para obter o mês ativo com exata correspondência visual do sistema
const getActiveReferenceMonth = async (): Promise<string> => {
  try {
    const { data: meses, error } = await supabase
      .from('meses')
      .select('*')
      .eq('status', 'ativo');

    if (!error && meses && meses.length > 0) {
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
    console.error("Erro ao resolver mês ativo no Supabase:", err);
  }

  // Fallback baseado na data do servidor em fuso horário de Brasília
  const now = new Date();
  const mesAtual = MESES_NOMES[now.getMonth()];
  const anoAtual = now.getFullYear();
  return `${mesAtual}/${anoAtual}`;
};

// Validação da categoria
const normalizeCategoria = (cat: any): 'Restaurante' | 'Lazer' | 'Conveniência' | null => {
  if (!cat || typeof cat !== 'string') return null;
  const clean = cat.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (clean === 'restaurante') return 'Restaurante';
  if (clean === 'lazer') return 'Lazer';
  if (clean === 'conveniencia') return 'Conveniência';
  return null;
};

// Handler para registrar gasto via API REST
const handleRegistrarGasto = async (req: express.Request, res: express.Response) => {
  const apiKey = req.headers['x-api-key'] || req.headers['X-API-KEY'] || req.headers['x-api-token'];
  const configuredKey = process.env.GASTOS_API_KEY || 'md-gastos-secret-key-2026';

  if (!apiKey || apiKey !== configuredKey) {
    return res.status(401).json({
      error: "Acesso não autorizado. Header 'x-api-key' inválido ou ausente."
    });
  }

  const { valor, categoria, mes_referencia: customMes } = req.body || {};

  // Validação estrita da categoria
  const canonicalCategoria = normalizeCategoria(categoria);
  if (!canonicalCategoria) {
    return res.status(400).json({
      error: "Categoria inválida. Categorias permitidas: 'Restaurante', 'Lazer' ou 'Conveniência'."
    });
  }

  // Validação estrita do valor
  let numVal: number;
  if (typeof valor === 'number') {
    numVal = valor;
  } else if (typeof valor === 'string') {
    const cleaned = valor.replace(/[^\d,.-]/g, '').replace(',', '.');
    numVal = parseFloat(cleaned);
  } else {
    return res.status(400).json({
      error: "Campo 'valor' obrigatório e deve ser numérico."
    });
  }

  if (isNaN(numVal) || numVal <= 0) {
    return res.status(400).json({
      error: "O campo 'valor' deve ser um número maior que zero."
    });
  }

  // Garantir precisão de 2 casas decimais (NUMERIC 10,2)
  const valorFinal = Number(numVal.toFixed(2));

  try {
    // Resolver o mês de referência correspondente ao mês ativo da interface
    const mesReferencia = customMes && typeof customMes === 'string' && customMes.trim()
      ? customMes.trim().toUpperCase()
      : await getActiveReferenceMonth();

    const payload = {
      categoria: canonicalCategoria,
      valor: valorFinal,
      mes_referencia: mesReferencia,
      created_at: new Date().toISOString()
    };

    // Gravação real no Supabase
    const { data, error } = await supabase
      .from('gastos_itens')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error("Erro Supabase ao salvar gasto:", error);
      return res.status(500).json({
        error: "Falha na persistência no banco de dados.",
        details: error.message
      });
    }

    return res.status(201).json({
      success: true,
      message: `Gasto de R$ ${valorFinal.toFixed(2).replace('.', ',')} em ${canonicalCategoria} registrado com sucesso!`,
      gasto: {
        id: data.id,
        categoria: data.categoria,
        valor: data.valor,
        mes_referencia: data.mes_referencia,
        created_at: data.created_at
      }
    });
  } catch (err: any) {
    console.error("Erro interno no endpoint de gastos:", err);
    return res.status(500).json({
      error: "Erro interno do servidor ao processar gasto.",
      details: err.message || String(err)
    });
  }
};

// Rotas da API REST
app.post('/api/gastos', handleRegistrarGasto);
app.post('/api/gastos/adicionar', handleRegistrarGasto);

// Rota de verificação do status da API
app.get('/api/gastos/status', async (req, res) => {
  const mesAtivo = await getActiveReferenceMonth();
  res.json({
    status: 'online',
    mes_referencia_ativo: mesAtivo,
    categorias_permitidas: ['Restaurante', 'Lazer', 'Conveniência']
  });
});

// Setup Vite Dev Server ou Produção
const startServer = async () => {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor rodando com sucesso na porta ${PORT}`);
  });
};

startServer().catch(err => {
  console.error("Erro ao iniciar servidor:", err);
});
