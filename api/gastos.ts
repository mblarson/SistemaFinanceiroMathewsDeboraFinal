import { createClient } from '@supabase/supabase-js';

// Lista de categorias válidas e canônicas
const CATEGORIAS_VALIDAS = ['Restaurante', 'Lazer', 'Conveniência'] as const;

// Normalização para comparação case-insensitive e tolerante a acentos
function normalizarCategoria(cat: string): 'Restaurante' | 'Lazer' | 'Conveniência' | null {
  if (!cat || typeof cat !== 'string') return null;
  const limpo = cat
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  if (limpo === 'restaurante') return 'Restaurante';
  if (limpo === 'lazer') return 'Lazer';
  if (limpo === 'conveniencia') return 'Conveniência';
  return null;
}

// Obter nome do mês de referência padrão em português
function getMesReferenciaAtual(): string {
  const mesesNomes = [
    'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO',
    'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'
  ];
  const agora = new Date();
  const mesNome = mesesNomes[agora.getMonth()];
  const ano = agora.getFullYear();
  return `${mesNome}/${ano}`;
}

export default async function handler(req: any, res: any) {
  // Configuração global de cabeçalhos CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  // 1. Tratamento do método OPTIONS (Pre-flight CORS)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 2. Tratamento do método GET (Documentação Viva e Verificação de Status)
  if (req.method === 'GET') {
    return res.status(200).json({
      status: 'online',
      servico: 'API de Integração - Módulo GASTOS',
      versao: '1.0',
      descricao: 'Endpoint para registro de gastos rápidos via automações externas (ex: iOS Shortcuts).',
      autenticacao: {
        tipo: 'Header',
        cabecalho: 'x-api-key'
      },
      metodos_disponiveis: {
        POST: {
          url: 'https://mathewsdebora.vercel.app/api/gastos',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': '[SUA_CHAVE_DE_ACESSO]'
          },
          body_exemplo: {
            valor: 35.50,
            categoria: 'Restaurante'
          },
          categorias_aceitas: ['Restaurante', 'Lazer', 'Conveniência']
        }
      }
    });
  }

  // 3. Tratamento do método POST (Registro de Lançamento de Gasto)
  if (req.method === 'POST') {
    try {
      // 3.1 Autenticação via cabeçalho x-api-key
      const rawHeaders = req.headers || {};
      const receivedKey = (
        rawHeaders['x-api-key'] || 
        rawHeaders['X-Api-Key'] || 
        rawHeaders['x-api-token'] || 
        ''
      ).trim();

      const expectedKey = (
        process.env.GASTOS_API_KEY || 
        process.env.API_SECRET_KEY || 
        'md-gastos-secret-key'
      ).trim();

      if (!receivedKey || receivedKey !== expectedKey) {
        return res.status(401).json({
          sucesso: false,
          erro: 'Chave de API inválida ou ausente. Forneça o cabeçalho x-api-key.'
        });
      }

      // 3.2 Parsing defensivo do corpo da requisição (JSON)
      let body = req.body;
      if (typeof body === 'string') {
        try {
          body = JSON.parse(body);
        } catch {
          return res.status(400).json({
            sucesso: false,
            erro: 'Corpo da requisição inválido. Certifique-se de enviar um JSON válido.'
          });
        }
      }

      const { valor, categoria, mes_referencia, observacao } = body || {};

      // 3.3 Validação de Valor (Numérico, positivo e sanitizado com 2 casas decimais)
      const parsedValor = typeof valor === 'string'
        ? parseFloat(valor.replace(/[^\d.,]/g, '').replace(',', '.'))
        : Number(valor);

      if (isNaN(parsedValor) || parsedValor <= 0) {
        return res.status(400).json({
          sucesso: false,
          erro: 'Valor inválido. Deve ser um número positivo maior que zero.'
        });
      }
      const valorSanitizado = Number(parsedValor.toFixed(2));

      // 3.4 Validação de Categoria (Estritamente Restaurante, Lazer ou Conveniência)
      const categoriaCanon = normalizarCategoria(categoria);
      if (!categoriaCanon) {
        return res.status(400).json({
          sucesso: false,
          erro: `Categoria inválida. Categorias aceitas: ${CATEGORIAS_VALIDAS.join(', ')}.`
        });
      }

      // 3.5 Mês de Referência (Default: mês atual formatado)
      const mesRef = (typeof mes_referencia === 'string' && mes_referencia.trim()) 
        ? mes_referencia.trim().toUpperCase() 
        : getMesReferenciaAtual();

      // 3.6 Inicialização Defensiva (Lazy) do Supabase
      const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://bnhxmjcgyqwjombhrdks.supabase.co';
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJuaHhtamNneXF3am9tYmhyZGtzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4NDk3MDksImV4cCI6MjA4MDQyNTcwOX0.wg7k8DJhE29d24BzGwp5ltUx_x_4iXjQFOC55x3t4B8';

      if (!supabaseUrl || !supabaseKey) {
        return res.status(500).json({
          sucesso: false,
          erro: 'Credenciais do Supabase não configuradas no ambiente do servidor.'
        });
      }

      let supabase;
      try {
        supabase = createClient(supabaseUrl, supabaseKey);
      } catch (clientErr: any) {
        return res.status(500).json({
          sucesso: false,
          erro: 'Falha ao instanciar o cliente do banco de dados: ' + (clientErr.message || clientErr)
        });
      }

      // 3.7 Gravação na tabela gastos_itens
      const novoRegistro = {
        categoria: categoriaCanon,
        valor: valorSanitizado,
        mes_referencia: mesRef,
        created_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('gastos_itens')
        .insert([novoRegistro])
        .select()
        .single();

      if (error) {
        return res.status(500).json({
          sucesso: false,
          erro: 'Erro ao gravar gasto no banco de dados: ' + error.message,
          detalhes: error.details || null
        });
      }

      // 3.8 Retorno 201 com sucesso
      return res.status(201).json({
        sucesso: true,
        mensagem: 'Gasto registrado com sucesso',
        registro: data
      });
    } catch (globalErr: any) {
      // Captura global de erro sem deixar a função da Vercel explodir
      return res.status(500).json({
        sucesso: false,
        erro: 'Erro interno no servidor ao processar o lançamento: ' + (globalErr.message || globalErr)
      });
    }
  }

  // 4. Métodos não permitidos
  return res.status(405).json({
    sucesso: false,
    erro: `Método ${req.method} não permitido. Utilize GET para documentação ou POST para registros.`
  });
}
