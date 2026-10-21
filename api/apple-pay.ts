import { createClient } from '@supabase/supabase-js';

// Categorias canônicas do sistema GASTOS
const CATEGORIAS_VALIDAS = ['Restaurante', 'Lazer', 'Conveniência'] as const;

// Normalização de categoria para comparação case-insensitive e tolerante a acentos
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

// Extrai a data ISO (YYYY-MM-DD) e o mês de referência (ex: OUTUBRO/2026) a partir da data de compra
function parseDateAndMonth(dataCompraStr?: string): { data: string; mesReferencia: string } {
  const mesesNomes = [
    'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO',
    'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'
  ];

  if (dataCompraStr && typeof dataCompraStr === 'string') {
    // Tenta capturar YYYY-MM-DD no início da string
    const match = dataCompraStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const year = parseInt(match[1], 10);
      const monthIdx = parseInt(match[2], 10) - 1;
      const day = match[3];
      if (monthIdx >= 0 && monthIdx < 12) {
        return {
          data: `${year}-${String(monthIdx + 1).padStart(2, '0')}-${day}`,
          mesReferencia: `${mesesNomes[monthIdx]}/${year}`
        };
      }
    }
  }

  // Fallback para a data/mês corrente
  const agora = new Date();
  const year = agora.getFullYear();
  const monthIdx = agora.getMonth();
  const day = String(agora.getDate()).padStart(2, '0');
  const month = String(monthIdx + 1).padStart(2, '0');

  return {
    data: `${year}-${month}-${day}`,
    mesReferencia: `${mesesNomes[monthIdx]}/${year}`
  };
}

export default async function handler(req: any, res: any) {
  // 1. Configuração completa de CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key, Authorization');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  // Pre-flight CORS (OPTIONS)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 2. Método GET (Diagnóstico operacional e Documentação da API)
  if (req.method === 'GET') {
    return res.status(200).json({
      status: 'online',
      servico: 'Integração Apple Pay (iOS Atalhos) -> Menu GASTOS',
      versao: '1.0.0',
      descricao: 'Endpoint idempotente e seguro para registro de compras presenciais ou online via Apple Pay diretamente na tabela de gastos do sistema.',
      autenticacao: {
        tipo: 'Header',
        opcoes: ['x-api-key: [SUA_CHAVE]', 'Authorization: Bearer [SUA_CHAVE]']
      },
      categorias_permitidas: CATEGORIAS_VALIDAS,
      payload_exemplo: {
        requestId: '550e8400-e29b-41d4-a716-446655440000',
        origem: 'apple_pay',
        estabelecimento: 'Outback Steakhouse',
        valor: 89.90,
        dataCompra: '2026-10-21T14:10:00-04:00',
        categoria: 'restaurante'
      },
      idempotencia: 'Atômica garantida via coluna request_id única no banco de dados.'
    });
  }

  // 3. Método POST (Registro Seguro com Idempotência Atômica)
  if (req.method === 'POST') {
    try {
      // 3.1 Autenticação via cabeçalho HTTP
      const rawHeaders = req.headers || {};
      const authHeader = (rawHeaders['authorization'] || rawHeaders['Authorization'] || '').trim();
      const bearerToken = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : '';

      const receivedKey = (
        rawHeaders['x-api-key'] ||
        rawHeaders['X-Api-Key'] ||
        rawHeaders['x-api-token'] ||
        bearerToken ||
        ''
      ).trim();

      const expectedKey = (
        process.env.APPLE_PAY_API_KEY ||
        process.env.GASTOS_API_KEY ||
        process.env.API_SECRET_KEY ||
        'md-gastos-secret-key'
      ).trim();

      if (!receivedKey || receivedKey !== expectedKey) {
        return res.status(401).json({
          sucesso: false,
          erro: 'Não autorizado. Forneça uma chave de API válida no cabeçalho x-api-key ou Authorization: Bearer.'
        });
      }

      // 3.2 Parsing defensivo do corpo JSON
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

      const {
        requestId,
        origem,
        estabelecimento,
        valor,
        dataCompra,
        categoria
      } = body || {};

      // 3.3 Validação do Valor
      const parsedValor = typeof valor === 'string'
        ? parseFloat(valor.replace(/[^\d.,]/g, '').replace(',', '.'))
        : Number(valor);

      if (isNaN(parsedValor) || parsedValor <= 0) {
        return res.status(400).json({
          sucesso: false,
          erro: 'Valor inválido. O campo "valor" deve ser um número positivo maior que zero.'
        });
      }
      const valorSanitizado = Number(parsedValor.toFixed(2));

      // 3.4 Validação e Normalização da Categoria (Restaurante, Lazer ou Conveniência)
      const categoriaCanon = normalizarCategoria(categoria);
      if (!categoriaCanon) {
        return res.status(400).json({
          sucesso: false,
          erro: `Categoria inválida: "${categoria}". As categorias permitidas são: ${CATEGORIAS_VALIDAS.join(', ')}.`
        });
      }

      // 3.5 Tratamento de Data e Mês de Referência
      const { data: dataFormatada, mesReferencia } = parseDateAndMonth(dataCompra);

      // 3.6 Estabelecimento sanitizado (opcional)
      const estabelecimentoSanitizado = (typeof estabelecimento === 'string' && estabelecimento.trim())
        ? estabelecimento.trim()
        : null;

      // 3.7 Conexão com Supabase no Runtime Seguro do Backend
      const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://bnhxmjcgyqwjombhrdks.supabase.co';
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJuaHhtamNneXF3am9tYmhyZGtzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4NDk3MDksImV4cCI6MjA4MDQyNTcwOX0.wg7k8DJhE29d24BzGwp5ltUx_x_4iXjQFOC55x3t4B8';

      let supabase;
      try {
        supabase = createClient(supabaseUrl, supabaseKey);
      } catch (clientErr: any) {
        return res.status(500).json({
          sucesso: false,
          erro: 'Falha ao inicializar conexão segura com o banco de dados: ' + (clientErr.message || clientErr)
        });
      }

      const sanitizedRequestId = (typeof requestId === 'string' && requestId.trim())
        ? requestId.trim()
        : null;

      // 3.8 Idempotência Atômica: Se requestId foi enviado, verifica se já existe
      if (sanitizedRequestId) {
        const { data: existing, error: searchError } = await supabase
          .from('gastos_itens')
          .select('*')
          .eq('request_id', sanitizedRequestId)
          .maybeSingle();

        if (searchError) {
          console.warn('Aviso ao consultar request_id para idempotência:', searchError.message);
        } else if (existing) {
          // Retorna registro previamente cadastrado sem duplicar
          return res.status(200).json({
            sucesso: true,
            idempotente: true,
            mensagem: 'Transação já processada anteriormente (idempotência garantida).',
            registro: existing
          });
        }
      }

      // 3.9 Inserção atômica na tabela gastos_itens
      const novoRegistro: any = {
        categoria: categoriaCanon,
        valor: valorSanitizado,
        data: dataFormatada,
        estabelecimento: estabelecimentoSanitizado,
        mes_referencia: mesReferencia,
        origem: (typeof origem === 'string' && origem.trim()) ? origem.trim() : 'apple_pay',
        created_at: new Date().toISOString()
      };

      if (sanitizedRequestId) {
        novoRegistro.request_id = sanitizedRequestId;
      }

      const { data: insertData, error: insertError } = await supabase
        .from('gastos_itens')
        .insert([novoRegistro])
        .select()
        .single();

      // 3.10 Tratamento de concorrência / colisão de chave única (Postgres code 23505)
      if (insertError) {
        if (insertError.code === '23505' && sanitizedRequestId) {
          const { data: existingRace } = await supabase
            .from('gastos_itens')
            .select('*')
            .eq('request_id', sanitizedRequestId)
            .maybeSingle();

          if (existingRace) {
            return res.status(200).json({
              sucesso: true,
              idempotente: true,
              mensagem: 'Transação concorrente já registrada (idempotência garantida).',
              registro: existingRace
            });
          }
        }

        return res.status(500).json({
          sucesso: false,
          erro: 'Erro ao gravar transação Apple Pay no banco de dados: ' + insertError.message,
          detalhes: insertError.details || null
        });
      }

      // 3.11 Retorno 201 Created com sucesso
      return res.status(201).json({
        sucesso: true,
        idempotente: false,
        mensagem: 'Gasto via Apple Pay registrado com sucesso no menu GASTOS.',
        registro: insertData
      });
    } catch (globalErr: any) {
      return res.status(500).json({
        sucesso: false,
        erro: 'Erro interno ao processar requisição Apple Pay: ' + (globalErr.message || globalErr)
      });
    }
  }

  // 4. Métodos não suportados
  return res.status(405).json({
    sucesso: false,
    erro: `Método ${req.method} não permitido. Utilize GET para documentação ou POST para envio de transações.`
  });
}
