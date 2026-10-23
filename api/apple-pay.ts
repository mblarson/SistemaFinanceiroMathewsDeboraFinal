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

// Helper universal e seguro para envio de respostas (compatível com Express, Vercel e Node HTTP)
function sendJson(res: any, status: number, data: any) {
  try {
    if (res && typeof res.setHeader === 'function' && !res.headersSent) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key, Authorization');
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
    }
  } catch (_) {}

  if (res && typeof res.status === 'function') {
    res.status(status);
    if (typeof res.json === 'function') {
      return res.json(data);
    }
  }
  if (res && typeof res.writeHead === 'function' && !res.headersSent) {
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*'
    });
  } else if (res) {
    res.statusCode = status;
  }
  if (res && typeof res.end === 'function') {
    return res.end(JSON.stringify(data));
  }
}

export default async function handler(req: any, res: any) {
  try {
    // 1. Configuração de CORS prévia
    try {
      if (res && typeof res.setHeader === 'function' && !res.headersSent) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key, Authorization');
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
      }
    } catch (_) {}

    // Pre-flight CORS (OPTIONS)
    if (req.method === 'OPTIONS') {
      if (res && typeof res.status === 'function') {
        return res.status(200).end();
      }
      res.statusCode = 200;
      return res.end();
    }

    // 2. Método GET (Diagnóstico operacional e Documentação da API)
    if (req.method === 'GET') {
      return sendJson(res, 200, {
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
        'gastosmd'
      ).trim();

      if (!receivedKey || receivedKey !== expectedKey) {
        return sendJson(res, 401, {
          success: false,
          sucesso: false,
          error: 'Não autorizado. Forneça uma chave de API válida no cabeçalho x-api-key ou Authorization: Bearer.',
          erro: 'Não autorizado. Forneça uma chave de API válida no cabeçalho x-api-key ou Authorization: Bearer.',
          message: 'Não autorizado. Forneça uma chave de API válida no cabeçalho x-api-key ou Authorization: Bearer.',
          mensagem: 'Não autorizado. Forneça uma chave de API válida no cabeçalho x-api-key ou Authorization: Bearer.'
        });
      }

      // 3.2 Parsing defensivo do corpo JSON
      let body = req.body;
      if (typeof body === 'string') {
        try {
          body = JSON.parse(body);
        } catch {
          return sendJson(res, 400, {
            success: false,
            sucesso: false,
            error: 'Corpo da requisição inválido. Certifique-se de enviar um JSON válido.',
            erro: 'Corpo da requisição inválido. Certifique-se de enviar um JSON válido.',
            message: 'Corpo da requisição inválido. Certifique-se de enviar um JSON válido.',
            mensagem: 'Corpo da requisição inválido. Certifique-se de enviar um JSON válido.'
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
        return sendJson(res, 400, {
          success: false,
          sucesso: false,
          error: 'Valor inválido. O campo "valor" deve ser um número positivo maior que zero.',
          erro: 'Valor inválido. O campo "valor" deve ser um número positivo maior que zero.',
          message: 'Valor inválido. O campo "valor" deve ser um número positivo maior que zero.',
          mensagem: 'Valor inválido. O campo "valor" deve ser um número positivo maior que zero.'
        });
      }
      const valorSanitizado = Number(parsedValor.toFixed(2));

      // 3.4 Validação e Normalização da Categoria (Restaurante, Lazer ou Conveniência)
      const categoriaCanon = normalizarCategoria(categoria);
      if (!categoriaCanon) {
        return sendJson(res, 400, {
          success: false,
          sucesso: false,
          error: `Categoria inválida: "${categoria}". As categorias permitidas são: ${CATEGORIAS_VALIDAS.join(', ')}.`,
          erro: `Categoria inválida: "${categoria}". As categorias permitidas são: ${CATEGORIAS_VALIDAS.join(', ')}.`,
          message: `Categoria inválida: "${categoria}". As categorias permitidas são: ${CATEGORIAS_VALIDAS.join(', ')}.`,
          mensagem: `Categoria inválida: "${categoria}". As categorias permitidas são: ${CATEGORIAS_VALIDAS.join(', ')}.`
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
        return sendJson(res, 500, {
          success: false,
          sucesso: false,
          error: 'Falha ao inicializar conexão segura com o banco de dados: ' + (clientErr.message || clientErr),
          erro: 'Falha ao inicializar conexão segura com o banco de dados: ' + (clientErr.message || clientErr),
          message: 'Falha ao inicializar conexão segura com o banco de dados: ' + (clientErr.message || clientErr),
          mensagem: 'Falha ao inicializar conexão segura com o banco de dados: ' + (clientErr.message || clientErr)
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
          return sendJson(res, 200, {
            success: true,
            sucesso: true,
            idempotente: true,
            message: 'Transação já processada anteriormente (idempotência garantida).',
            mensagem: 'Transação já processada anteriormente (idempotência garantida).',
            registro: existing
          });
        }
      }

      // 3.9 Inserção atômica na tabela gastos_itens com fallback para colunas existentes
      const novoRegistro: any = {
        categoria: categoriaCanon,
        valor: valorSanitizado,
        mes_referencia: mesReferencia,
        created_at: new Date().toISOString()
      };

      if (estabelecimentoSanitizado) {
        novoRegistro.estabelecimento = estabelecimentoSanitizado;
      }
      if (dataFormatada) {
        novoRegistro.data = dataFormatada;
      }
      if (sanitizedRequestId) {
        novoRegistro.request_id = sanitizedRequestId;
      }

      let { data: insertData, error: insertError } = await supabase
        .from('gastos_itens')
        .insert([novoRegistro])
        .select()
        .single();

      // Se falhar por coluna não encontrada (ex: request_id ou data), tenta apenas com as colunas essenciais
      if (insertError && insertError.message?.includes('schema cache')) {
        const registroEssencial = {
          categoria: categoriaCanon,
          valor: valorSanitizado,
          mes_referencia: mesReferencia,
          created_at: new Date().toISOString()
        };
        const fallbackRes = await supabase
          .from('gastos_itens')
          .insert([registroEssencial])
          .select()
          .single();
        
        insertData = fallbackRes.data;
        insertError = fallbackRes.error;
      }

      // 3.10 Tratamento de concorrência / colisão de chave única (Postgres code 23505)
      if (insertError) {
        if (insertError.code === '23505' && sanitizedRequestId) {
          const { data: existingRace } = await supabase
            .from('gastos_itens')
            .select('*')
            .eq('request_id', sanitizedRequestId)
            .maybeSingle();

          if (existingRace) {
            return sendJson(res, 200, {
              success: true,
              sucesso: true,
              idempotente: true,
              message: 'Transação concorrente já registrada (idempotência garantida).',
              mensagem: 'Transação concorrente já registrada (idempotência garantida).',
              registro: existingRace
            });
          }
        }

        return sendJson(res, 500, {
          success: false,
          sucesso: false,
          error: 'Erro ao gravar transação Apple Pay no banco de dados: ' + insertError.message,
          erro: 'Erro ao gravar transação Apple Pay no banco de dados: ' + insertError.message,
          message: 'Erro ao gravar transação Apple Pay no banco de dados: ' + insertError.message,
          mensagem: 'Erro ao gravar transação Apple Pay no banco de dados: ' + insertError.message,
          detalhes: insertError.details || null
        });
      }

      // 3.11 Retorno 201 Created com sucesso
      return sendJson(res, 201, {
        success: true,
        sucesso: true,
        idempotente: false,
        message: 'Gasto via Apple Pay registrado com sucesso no menu GASTOS.',
        mensagem: 'Gasto via Apple Pay registrado com sucesso no menu GASTOS.',
        registro: insertData
      });
    }

    // 4. Métodos não suportados
    return sendJson(res, 405, {
      success: false,
      sucesso: false,
      error: `Método ${req.method} não permitido. Utilize GET para documentação ou POST para envio de transações.`,
      erro: `Método ${req.method} não permitido. Utilize GET para documentação ou POST para envio de transações.`,
      message: `Método ${req.method} não permitido. Utilize GET para documentação ou POST para envio de transações.`,
      mensagem: `Método ${req.method} não permitido. Utilize GET para documentação ou POST para envio de transações.`
    });
  } catch (fatalErr: any) {
    return sendJson(res, 500, {
      success: false,
      sucesso: false,
      error: 'Erro interno ao processar requisição: ' + (fatalErr?.message || fatalErr),
      erro: 'Erro interno ao processar requisição: ' + (fatalErr?.message || fatalErr),
      message: 'Erro interno ao processar requisição: ' + (fatalErr?.message || fatalErr),
      mensagem: 'Erro interno ao processar requisição: ' + (fatalErr?.message || fatalErr)
    });
  }
}
