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

// Obter nome do mês de referência padrão em português (ex: OUTUBRO/2026)
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

// Obter data atual no formato YYYY-MM-DD
function getDataAtualFormatada(): string {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  const dia = String(agora.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
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
        servico: 'API de Integração - Módulo GASTOS',
        versao: '1.0',
        descricao: 'Endpoint para registro de gastos rápidos via atalhos e automações externas (ex: iOS Shortcuts).',
        autenticacao: {
          tipo: 'Header',
          cabecalhos_aceitos: ['x-api-key', 'Authorization: Bearer']
        },
        metodos_disponiveis: {
          POST: {
            url: 'https://mathewsdebora.vercel.app/api/gastos',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': 'gastosmd'
            },
            body_exemplo: {
              valor: 35.50,
              categoria: 'Restaurante'
            },
            categorias_aceitas: CATEGORIAS_VALIDAS
          }
        }
      });
    }

    // 3. Método POST (Registro de Lançamento de Gasto Rápido)
    if (req.method === 'POST') {
      // 3.1 Autenticação via cabeçalho x-api-key ou Authorization
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
        process.env.GASTOS_API_KEY || 
        process.env.APPLE_PAY_API_KEY ||
        process.env.API_SECRET_KEY || 
        'gastosmd'
      ).trim();

      if (!receivedKey || receivedKey !== expectedKey) {
        return sendJson(res, 401, {
          sucesso: false,
          success: false,
          erro: 'Chave de API inválida ou ausente. Forneça o cabeçalho x-api-key com valor válido.',
          error: 'Chave de API inválida ou ausente. Forneça o cabeçalho x-api-key com valor válido.',
          mensagem: 'Não autorizado.'
        });
      }

      // 3.2 Parsing defensivo do corpo JSON
      let body = req.body;
      if (typeof body === 'string') {
        try {
          body = JSON.parse(body);
        } catch {
          return sendJson(res, 400, {
            sucesso: false,
            success: false,
            erro: 'Corpo da requisição inválido. Certifique-se de enviar um JSON válido.',
            error: 'Corpo da requisição inválido. Certifique-se de enviar um JSON válido.'
          });
        }
      }

      const { valor, categoria, mes_referencia, estabelecimento, data: dataParam } = body || {};

      // 3.3 Validação de Valor
      const parsedValor = typeof valor === 'string'
        ? parseFloat(valor.replace(/[^\d.,]/g, '').replace(',', '.'))
        : Number(valor);

      if (isNaN(parsedValor) || parsedValor <= 0) {
        return sendJson(res, 400, {
          sucesso: false,
          success: false,
          erro: 'Valor inválido. Deve ser um número positivo maior que zero.',
          error: 'Valor inválido. Deve ser um número positivo maior que zero.'
        });
      }
      const valorSanitizado = Number(parsedValor.toFixed(2));

      // 3.4 Validação de Categoria (Restaurante, Lazer ou Conveniência)
      const categoriaCanon = normalizarCategoria(categoria);
      if (!categoriaCanon) {
        return sendJson(res, 400, {
          sucesso: false,
          success: false,
          erro: `Categoria inválida: "${categoria}". Categorias aceitas: ${CATEGORIAS_VALIDAS.join(', ')}.`,
          error: `Categoria inválida: "${categoria}". Categorias aceitas: ${CATEGORIAS_VALIDAS.join(', ')}.`
        });
      }

      // 3.5 Mês de Referência e Data
      const mesRef = (typeof mes_referencia === 'string' && mes_referencia.trim()) 
        ? mes_referencia.trim().toUpperCase() 
        : getMesReferenciaAtual();

      const dataGravacao = (typeof dataParam === 'string' && dataParam.trim())
        ? dataParam.trim()
        : getDataAtualFormatada();

      // 3.6 Inicialização Segura do Supabase
      const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://bnhxmjcgyqwjombhrdks.supabase.co';
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJuaHhtamNneXF3am9tYmhyZGtzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4NDk3MDksImV4cCI6MjA4MDQyNTcwOX0.wg7k8DJhE29d24BzGwp5ltUx_x_4iXjQFOC55x3t4B8';

      let supabase;
      try {
        supabase = createClient(supabaseUrl, supabaseKey);
      } catch (clientErr: any) {
        return sendJson(res, 500, {
          sucesso: false,
          success: false,
          erro: 'Falha ao conectar com o banco de dados: ' + (clientErr.message || clientErr),
          error: 'Falha ao conectar com o banco de dados: ' + (clientErr.message || clientErr)
        });
      }

      // 3.7 Gravação na tabela gastos_itens com fallback para colunas do schema
      const registroBase: any = {
        categoria: categoriaCanon,
        valor: valorSanitizado,
        mes_referencia: mesRef,
        created_at: new Date().toISOString()
      };

      // Tenta inserir primeiro apenas com colunas essenciais ou com as colunas completas caso existam
      let insertResult = await supabase
        .from('gastos_itens')
        .insert([registroBase])
        .select()
        .single();

      // Se falhar, tenta sem select() ou loga o erro específico
      if (insertResult.error) {
        // Tenta sem select()
        const retryResult = await supabase
          .from('gastos_itens')
          .insert([registroBase]);

        if (retryResult.error) {
          return sendJson(res, 500, {
            sucesso: false,
            success: false,
            erro: 'Erro ao gravar gasto no banco de dados: ' + retryResult.error.message,
            error: 'Erro ao gravar gasto no banco de dados: ' + retryResult.error.message,
            detalhes: retryResult.error.details || null
          });
        }
        insertResult = { data: registroBase, error: null } as any;
      }
      const data = insertResult.data;

      // 3.8 Retorno 201 com sucesso
      return sendJson(res, 201, {
        sucesso: true,
        success: true,
        mensagem: 'Gasto registrado com sucesso!',
        message: 'Gasto registrado com sucesso!',
        registro: data
      });
    }

    // 4. Métodos não permitidos
    return sendJson(res, 405, {
      sucesso: false,
      success: false,
      erro: `Método ${req.method} não permitido. Utilize GET para documentação ou POST para registros.`,
      error: `Método ${req.method} não permitido. Utilize GET para documentação ou POST para registros.`
    });
  } catch (globalErr: any) {
    return sendJson(res, 500, {
      sucesso: false,
      success: false,
      erro: 'Erro interno no servidor ao processar o lançamento: ' + (globalErr?.message || globalErr),
      error: 'Erro interno no servidor ao processar o lançamento: ' + (globalErr?.message || globalErr)
    });
  }
}
