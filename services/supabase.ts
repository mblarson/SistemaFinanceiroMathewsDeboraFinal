
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://bnhxmjcgyqwjombhrdks.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJuaHhtamNneXF3am9tYmhyZGtzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4NDk3MDksImV4cCI6MjA4MDQyNTcwOX0.wg7k8DJhE29d24BzGwp5ltUx_x_4iXjQFOC55x3t4B8';

const rawSupabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Default seed/starter data for resilient offline storage
const DEFAULT_BANCOS = [
  { id: 1, nome: "American Express", cor: "#0070CD" },
  { id: 2, nome: "BB", cor: "#FCFD04" },
  { id: 3, nome: "Nubank", cor: "#820AD1" },
  { id: 6, nome: "Itaú", cor: "#EC7000" }
];

const DEFAULT_MESES = [
  { id: 1, nome: "DEZEMBRO", ano: 2025, status: "ativo" },
  { id: 24, nome: "JANEIRO", ano: 2026, status: "ativo" },
  { id: 33, nome: "FEVEREIRO", ano: 2026, status: "ativo" },
  { id: 35, nome: "MARÇO", ano: 2026, status: "ativo" },
  { id: 37, nome: "ABRIL", ano: 2026, status: "ativo" },
  { id: 39, nome: "MAIO", ano: 2026, status: "ativo" }
];

const DEFAULT_RECEITAS = [
  { id: 1, mes_id: 1, descricao: "Mathews", valor: 3900, data: "2025-12-17" },
  { id: 2, mes_id: 1, descricao: "Debora", valor: 5500, data: "2026-01-21" },
  { id: 3, mes_id: 24, descricao: "Debora", valor: 4000, data: "2026-01-27" },
  { id: 4, mes_id: 24, descricao: "Celular", valor: 350, data: "2026-01-27" },
  { id: 5, mes_id: 24, descricao: "Bradesco", valor: 5910.01, data: "2026-01-27" },
  { id: 6, mes_id: 24, descricao: "Mathews", valor: 5709.81, data: "2026-01-27" },
  { id: 7, mes_id: 24, descricao: "Kotas", valor: 125, data: "2026-01-30" },
  { id: 8, mes_id: 24, descricao: "Dinheiro", valor: 150, data: "2026-01-30" },
  { id: 10, mes_id: 33, descricao: "Celular", valor: 350, data: "2026-02-13" },
  { id: 11, mes_id: 33, descricao: "Gabriela", valor: 94, data: "2026-02-13" },
  { id: 13, mes_id: 33, descricao: "Dinheiro (Especie)", valor: 150, data: "2026-02-18" },
  { id: 18, mes_id: 33, descricao: "Gasolina Retiro", valor: 195, data: "2026-02-28" },
  { id: 19, mes_id: 33, descricao: "Kotas", valor: 42.4, data: "2026-02-28" },
  { id: 20, mes_id: 35, descricao: "Celular", valor: 350, data: "2026-02-28" },
  { id: 16, mes_id: 35, descricao: "Debora", valor: 6900, data: "2026-02-28" },
  { id: 9, mes_id: 33, descricao: "Mathews", valor: 4993, data: "2026-02-13" },
  { id: 14, mes_id: 33, descricao: "Mãe", valor: 170, data: "2026-02-28" },
  { id: 12, mes_id: 33, descricao: "Debora", valor: 6727.76, data: "2026-02-13" },
  { id: 15, mes_id: 35, descricao: "Mathews", valor: 4900, data: "2026-02-28" },
  { id: 21, mes_id: 37, descricao: "Celular", valor: 350, data: "2026-03-17" },
  { id: 22, mes_id: 37, descricao: "Mathews", valor: 5000, data: "2026-03-17" },
  { id: 24, mes_id: 37, descricao: "Mathews", valor: 100, data: "2026-04-13" },
  { id: 26, mes_id: 39, descricao: "Debora", valor: 6900, data: "2026-04-13" },
  { id: 27, mes_id: 39, descricao: "Celular", valor: 350, data: "2026-04-13" },
  { id: 23, mes_id: 37, descricao: "Debora", valor: 7132, data: "2026-03-17" },
  { id: 28, mes_id: 37, descricao: "Youtube", valor: 134, data: "2026-04-17" },
  { id: 25, mes_id: 39, descricao: "Mathews", valor: 4900, data: "2026-04-13" },
  { id: 29, mes_id: 39, descricao: "UMADEMATS", "valor": 100, "data": "2026-05-29" },
  { id: 31, mes_id: 39, descricao: "Mariana", "valor": 100, "data": "2026-05-29" }
];

const DEFAULT_DESPESAS_CONTAS = [
  { id: 17, mes_id: 35, descricao: "Cabelo", valor: 300, pago: false, data: "2026-02-28" },
  { id: 8, mes_id: 35, descricao: "Gasolina", valor: 440, pago: false, data: "2026-03-28" },
  { id: 31, mes_id: 39, descricao: "Agua", valor: 92, pago: true, data: "2026-04-13" },
  { id: 33, mes_id: 39, descricao: "Seguro Carro", valor: 234, pago: true, data: "2026-04-13" },
  { id: 35, mes_id: 39, descricao: "Celular Mathews", valor: 40, pago: true, data: "2026-04-13" },
  { id: 36, mes_id: 39, descricao: "Celular Debora", valor: 30, pago: true, data: "2026-04-13" },
  { id: 34, mes_id: 39, descricao: "Contabilidade", valor: 221, pago: true, data: "2026-04-13" },
  { id: 32, mes_id: 39, descricao: "Internet", valor: 129, pago: true, data: "2026-04-13" },
  { id: 37, mes_id: 39, descricao: "Gasolina", valor: 516.63, pago: true, data: "2026-04-13" },
  { id: 30, mes_id: 39, descricao: "Dízimo", valor: 1000, pago: true, data: "2026-04-13" }
];

const DEFAULT_DESPESAS_PIX = [
  { id: 1, mes_id: 24, descricao: "Mariaana (foz)", valor_original: 689, valor_final: 723.45, pago: false, data: "2026-01-27" },
  { id: 14, mes_id: 39, descricao: "Carro", valor_original: 1954, valor_final: 2051.7, pago: true, data: "2026-04-13" },
  { id: 15, mes_id: 39, descricao: "Luz", valor_original: 335.21, valor_final: 348.618, pago: true, data: "2026-04-13" },
  { id: 17, mes_id: 39, descricao: "C6 Bank Negociação", valor_original: 52, valor_final: 54.08, pago: true, data: "2026-04-13" },
  { id: 19, mes_id: 39, descricao: "IPTU", valor_original: 80, valor_final: 83.192, pago: true, data: "2026-04-13" },
  { id: 18, mes_id: 39, descricao: "Multa ISS", valor_original: 121, valor_final: 125.827, pago: true, data: "2026-04-13" },
  { id: 16, mes_id: 39, descricao: "Emprestimo", valor_original: 334, valor_final: 347.326, pago: true, data: "2026-04-13" }
];

const DEFAULT_PARCELAMENTOS = [
  { id: 30, mes_id: 39, descricao: "Celular BB", valor_parcela: 140.02, parcela_atual: 7, total_parcelas: 12 },
  { id: 31, mes_id: 39, descricao: "Celular Itaú", valor_parcela: 583.37, parcela_atual: 7, total_parcelas: 12 },
  { id: 33, mes_id: 39, descricao: "Revisão Carro Itaú", valor_parcela: 375, parcela_atual: 2, total_parcelas: 4 }
];

const DEFAULT_BANCO_DESPESAS = [
  { id: 79, mes_id: 39, banco_id: 6, descricao: "3996", valor: 2130.48, data: "2026-05-13" }
];

const getLocalDB = (): Record<string, any[]> => {
  const dbStr = localStorage.getItem('supabase_fallback_db');
  if (dbStr) {
    try {
      return JSON.parse(dbStr);
    } catch (e) {
      console.error("Erro parsing fallback Local Storage DB:", e);
    }
  }

  // Se não existir, inicializa com todos os valores default
  const newDB: Record<string, any[]> = {
    bancos: DEFAULT_BANCOS,
    meses: DEFAULT_MESES,
    receitas: DEFAULT_RECEITAS,
    despesas_contas: DEFAULT_DESPESAS_CONTAS,
    despesas_pix_credito: DEFAULT_DESPESAS_PIX,
    parcelamentos: DEFAULT_PARCELAMENTOS,
    banco_despesas: DEFAULT_BANCO_DESPESAS,
    configuracoes: [{ id: 1, chave: "taxa_pix", valor: "4.99" }]
  };
  saveLocalDB(newDB);
  return newDB;
};

const saveLocalDB = (db: Record<string, any[]>) => {
  localStorage.setItem('supabase_fallback_db', JSON.stringify(db));
};

const isNetworkError = (err: any): boolean => {
  if (!err) return false;
  const msg = String(err.message || err.details || err || '').toLowerCase();
  return (
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('load failed') ||
    msg.includes('fetch failed') ||
    msg.includes('network') ||
    msg.includes('cors') ||
    msg.includes('unreachable') ||
    msg.includes('is not a valid') ||
    msg.includes('failed')
  );
};

// Interface das etapas chamadas no construtor de consultas
interface ChainStep {
  method: string;
  args: any[];
}

// Salva dados obtidos com sucesso do servidor para manter dados sempre atualizados
const updateOfflineCache = (tableName: string, steps: ChainStep[], data: any) => {
  const hasFilters = steps.some(s => s.method === 'eq' || s.method === 'in');
  if (!hasFilters && Array.isArray(data)) {
    const db = getLocalDB();
    db[tableName] = data;
    saveLocalDB(db);
  }
};

// Executa localmente as consultas registradas no proxy
const executeOfflineQuery = async (steps: ChainStep[], tableName: string): Promise<any> => {
  const db = getLocalDB();
  let data = db[tableName] || [];

  let filters: Array<{ col: string; val: any }> = [];
  let inFilters: Array<{ col: string; vals: any[] }> = [];
  let orderCol: string | null = null;
  let orderAsc = true;
  let isSingle = false;
  let isMaybeSingle = false;
  let updatePayload: any = null;
  let insertPayloads: any[] = [];
  let isDelete = false;

  for (const step of steps) {
    if (step.method === 'eq') {
      filters.push({ col: step.args[0], val: step.args[1] });
    } else if (step.method === 'in') {
      inFilters.push({ col: step.args[0], vals: step.args[1] });
    } else if (step.method === 'order') {
      orderCol = step.args[0];
      const opts = step.args[1];
      orderAsc = opts?.ascending !== false;
    } else if (step.method === 'single') {
      isSingle = true;
    } else if (step.method === 'maybeSingle') {
      isMaybeSingle = true;
    } else if (step.method === 'insert') {
      const payload = step.args[0];
      insertPayloads = Array.isArray(payload) ? payload : [payload];
    } else if (step.method === 'update') {
      updatePayload = step.args[0];
    } else if (step.method === 'delete') {
      isDelete = true;
    }
  }

  // Inserções
  if (insertPayloads.length > 0) {
    let nextId = Math.max(...data.map((r: any) => typeof r.id === 'number' ? r.id : 0), 0) + 1;
    const insertedRows: any[] = [];
    for (const p of insertPayloads) {
      const newRow = {
        id: nextId++,
        criado_em: new Date().toISOString(),
        ...p
      };
      data.push(newRow);
      insertedRows.push(newRow);
    }
    db[tableName] = data;
    saveLocalDB(db);

    const isArrayInput = Array.isArray(insertPayloads);
    let returnedData: any = isArrayInput ? insertedRows : insertedRows[0];
    
    if (isSingle || isMaybeSingle) {
      returnedData = Array.isArray(returnedData) ? returnedData[0] : returnedData;
    }
    
    // Retorna mock-chain se precisar de seleções subsequentes
    return { 
      data: returnedData, 
      error: null,
      select: () => ({
        single: () => ({ data: Array.isArray(returnedData) ? returnedData[0] : returnedData, error: null }),
        maybeSingle: () => ({ data: Array.isArray(returnedData) ? returnedData[0] : returnedData, error: null }),
        then: (resolve: any) => resolve({ data: Array.isArray(returnedData) ? returnedData[0] : returnedData, error: null })
      })
    };
  }

  // Filtragem
  let targetIndexes: number[] = [];
  data.forEach((row: any, idx: number) => {
    let match = true;
    for (const f of filters) {
      if (row[f.col] != f.val) match = false;
    }
    for (const f of inFilters) {
      const set = new Set(f.vals.map(String));
      if (!set.has(String(row[f.col]))) match = false;
    }
    if (match) {
      targetIndexes.push(idx);
    }
  });

  if (isDelete) {
    const newData = data.filter((_: any, idx: number) => !targetIndexes.includes(idx));
    db[tableName] = newData;
    saveLocalDB(db);
    return { data: null, error: null };
  }

  if (updatePayload) {
    data = data.map((row: any, idx: number) => {
      if (targetIndexes.includes(idx)) {
        return { ...row, ...updatePayload };
      }
      return row;
    });
    db[tableName] = data;
    saveLocalDB(db);
    return { data: updatePayload, error: null };
  }

  // Leitura padrão
  let filteredData = data.filter((_: any, idx: number) => targetIndexes.includes(idx));

  if (orderCol) {
    filteredData.sort((a: any, b: any) => {
      const valA = a[orderCol!];
      const valB = b[orderCol!];
      if (typeof valA === 'number' && typeof valB === 'number') {
        return orderAsc ? valA - valB : valB - valA;
      }
      return orderAsc ? String(valA || '').localeCompare(String(valB || '')) : String(valB || '').localeCompare(String(valA || ''));
    });
  }

  if (isSingle) {
    return { data: filteredData[0] || null, error: filteredData[0] ? null : { message: "Not found" } };
  }
  if (isMaybeSingle) {
    return { data: filteredData[0] || null, error: null };
  }

  return { data: filteredData, error: null };
};

// Proxy recursivo para interceptar chamadas e tratar erros de conexão
const createResilientChain = (realChain: any, tableName: string, steps: ChainStep[] = []): any => {
  return new Proxy(realChain, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);

      if (prop === 'then') {
        return function(onfulfilled: any, onrejected: any) {
          return target.then(
            (res: any) => {
              if (res && res.error) {
                console.warn(`Supabase query returned error for ${tableName}, falling back to offline:`, res.error);
                return executeOfflineQuery(steps, tableName).then(onfulfilled, onrejected);
              }
              if (res && !res.error && res.data) {
                try {
                  updateOfflineCache(tableName, steps, res.data);
                } catch (e) {
                  console.error("Cache update error:", e);
                }
              }
              return onfulfilled ? onfulfilled(res) : res;
            },
            (err: any) => {
              console.warn(`Supabase promise rejected for ${tableName}, falling back to offline:`, err);
              return executeOfflineQuery(steps, tableName).then(onfulfilled, onrejected);
            }
          );
        };
      }

      if (typeof value === 'function') {
        return function(...args: any[]) {
          const newSteps = [...steps, { method: String(prop), args }];
          try {
            const nextChain = value.apply(target, args);
            return createResilientChain(nextChain, tableName, newSteps);
          } catch (err) {
            if (isNetworkError(err)) {
              // Retorna uma Promise resiliente mockada
              const mockPromise = Promise.resolve();
              return createResilientChain(mockPromise, tableName, newSteps);
            }
            throw err;
          }
        };
      }

      return value;
    }
  });
};

// Cliente Supabase resiliente exportado globalmente
export const supabaseClient = new Proxy(rawSupabase, {
  get(target, prop, receiver) {
    const value = Reflect.get(target, prop, receiver);
    if (prop === 'from' && typeof value === 'function') {
      return function(tableName: string) {
        try {
          const realChain = value.call(target, tableName);
          return createResilientChain(realChain, tableName);
        } catch (err) {
          if (isNetworkError(err)) {
            // Retorna um objeto fake para simular a chain
            const mockPromise = Promise.resolve();
            return createResilientChain(mockPromise, tableName);
          }
          throw err;
        }
      };
    }
    return value;
  }
});

