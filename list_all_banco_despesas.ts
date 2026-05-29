import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://bnhxmjcgyqwjombhrdks.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJuaHhtamNneXF3am9tYmhyZGtzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4NDk3MDksImV4cCI6MjA4MDQyNTcwOX0.wg7k8DJhE29d24BzGwp5ltUx_x_4iXjQFOC55x3t4B8';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function listAll() {
  console.log("== BUSCANDO TODOS OS LANÇAMENTOS DE CARTÕES ==");
  const { data: bds, error: bdsErr } = await supabase.from('banco_despesas').select('*');
  const { data: bancos, error: bErr } = await supabase.from('bancos').select('*');

  if (bdsErr || bErr) {
    console.error("Erro:", bdsErr || bErr);
    return;
  }

  const bankMap: { [key: number]: string } = {};
  bancos.forEach(b => {
    bankMap[b.id] = b.nome;
  });

  bds.forEach(bd => {
    console.log(`ID: ${bd.id} | Mês ID: ${bd.mes_id} | Banco: ${bankMap[bd.banco_id] || bd.banco_id} | Desc: "${bd.descricao}" | Valor: ${bd.valor} | Data: ${bd.data}`);
  });
}

listAll();
