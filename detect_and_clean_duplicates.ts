import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://bnhxmjcgyqwjombhrdks.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJuaHhtamNneXF3am9tYmhyZGtzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4NDk3MDksImV4cCI6MjA4MDQyNTcwOX0.wg7k8DJhE29d24BzGwp5ltUx_x_4iXjQFOC55x3t4B8';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function cleanDuplicates() {
  console.log("== INICIANDO AJUSTE E DETECÇÃO DE DUPLICIDADES NO BANCO ==\n");

  // 1. Banco_despesas (Cartões)
  console.log("Analisando tabela 'banco_despesas' (Cartões)...");
  const bdRes = await supabase.from('banco_despesas').select('*');
  if (bdRes.data) {
    const grouped: { [key: string]: any[] } = {};
    bdRes.data.forEach(row => {
      // Chave base de unicidade
      const key = `${row.mes_id}_${row.banco_id}_${row.descricao}_${row.valor}_${row.data}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(row);
    });

    for (const key of Object.keys(grouped)) {
      const rows = grouped[key];
      if (rows.length > 1) {
        console.log(`Detectada duplicidade em Cartões: "${rows[0].descricao}" (${rows.length} instâncias). Mantendo uma.`);
        // Manter o primeiro, deletar os outros pelo ID
        for (let i = 1; i < rows.length; i++) {
          const res = await supabase.from('banco_despesas').delete().eq('id', rows[i].id);
          console.log(` - ID ${rows[i].id} deletado.`);
        }
      }
    }
  }

  // 2. Receitas
  console.log("\nAnalisando tabela 'receitas'... ");
  const recRes = await supabase.from('receitas').select('*');
  if (recRes.data) {
    const grouped: { [key: string]: any[] } = {};
    recRes.data.forEach(row => {
      const key = `${row.mes_id}_${row.descricao}_${row.valor}_${row.data}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(row);
    });

    for (const key of Object.keys(grouped)) {
      const rows = grouped[key];
      if (rows.length > 1) {
        console.log(`Detectada duplicidade em Receitas: "${rows[0].descricao}" (${rows.length} instâncias). Mantendo uma.`);
        for (let i = 1; i < rows.length; i++) {
          const res = await supabase.from('receitas').delete().eq('id', rows[i].id);
          console.log(` - ID ${rows[i].id} deletado.`);
        }
      }
    }
  }

  // 3. Despesas Contas (Fixas)
  console.log("\nAnalisando tabela 'despesas_contas'... ");
  const dcRes = await supabase.from('despesas_contas').select('*');
  if (dcRes.data) {
    const grouped: { [key: string]: any[] } = {};
    dcRes.data.forEach(row => {
      const key = `${row.mes_id}_${row.descricao}_${row.valor}_${row.data}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(row);
    });

    for (const key of Object.keys(grouped)) {
      const rows = grouped[key];
      if (rows.length > 1) {
        console.log(`Detectada duplicidade em Despesas Fixas: "${rows[0].descricao}" (${rows.length} instâncias). Mantendo uma.`);
        for (let i = 1; i < rows.length; i++) {
          const res = await supabase.from('despesas_contas').delete().eq('id', rows[i].id);
          console.log(` - ID ${rows[i].id} deletado.`);
        }
      }
    }
  }

  // 4. Despesas Pix Credito
  console.log("\nAnalisando tabela 'despesas_pix_credito'... ");
  const dpxRes = await supabase.from('despesas_pix_credito').select('*');
  if (dpxRes.data) {
    const grouped: { [key: string]: any[] } = {};
    dpxRes.data.forEach(row => {
      const key = `${row.mes_id}_${row.descricao}_${row.valor_original}_${row.data}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(row);
    });

    for (const key of Object.keys(grouped)) {
      const rows = grouped[key];
      if (rows.length > 1) {
        console.log(`Detectada duplicidade em Despesas Pix: "${rows[0].descricao}" (${rows.length} instâncias). Mantendo uma.`);
        for (let i = 1; i < rows.length; i++) {
          const res = await supabase.from('despesas_pix_credito').delete().eq('id', rows[i].id);
          console.log(` - ID ${rows[i].id} deletado.`);
        }
      }
    }
  }

  console.log("\n== PROCESSO DE DETECÇÃO E AJUSTE CONCLUÍDO COM SUCESSO ==");
}

cleanDuplicates();
