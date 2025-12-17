
import React, { useState, useEffect } from 'react';
import { LockKeyhole, Unlock, Calendar, TrendingUp } from 'lucide-react';
import { supabaseClient } from '../services/supabase';
import { Month } from '../types';

interface ClosingProps {
  currentMonth: Month;
  onSelectMonth: (month: Month) => void;
  onRefresh: () => void;
}

const Closing: React.FC<ClosingProps> = ({ currentMonth, onSelectMonth, onRefresh }) => {
  const [months, setMonths] = useState<Month[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMonths();
  }, []);

  const fetchMonths = async () => {
    const { data } = await supabaseClient
      .from('meses')
      .select('*')
      .order('criado_em', { ascending: false });
    setMonths(data || []);
    setLoading(false);
  };

  const closeMonthRoutine = async () => {
    if (!confirm("Isso fechará o mês atual e criará o próximo. Deseja continuar?")) return;
    
    // 1. Calcular Saldo Final
    const [r, d, p, b] = await Promise.all([
      supabaseClient.from('receitas').select('valor').eq('mes_id', currentMonth.id),
      supabaseClient.from('despesas_contas').select('valor').eq('mes_id', currentMonth.id),
      supabaseClient.from('despesas_pix_credito').select('valor_final').eq('mes_id', currentMonth.id),
      supabaseClient.from('banco_despesas').select('valor').eq('mes_id', currentMonth.id)
    ]);
    
    const rev = r.data?.reduce((a,c) => a + c.valor, 0) || 0;
    const exp = (d.data?.reduce((a,c) => a + c.valor, 0) || 0) + 
                (p.data?.reduce((a,c) => a + c.valor_final, 0) || 0) + 
                (b.data?.reduce((a,c) => a + c.valor, 0) || 0);
    const total = rev - exp;

    // 2. Atualizar mês atual como fechado
    await supabaseClient.from('meses').update({ status: 'fechado', saldo_final: total }).eq('id', currentMonth.id);

    // 3. Criar próximo mês
    const meses_nomes = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];
    let idx = meses_nomes.indexOf(currentMonth.nome);
    let nextIdx = idx + 1;
    let nextYear = currentMonth.ano;
    if (nextIdx > 11) { nextIdx = 0; nextYear++; }

    await supabaseClient.from('meses').insert([{ nome: meses_nomes[nextIdx], ano: nextYear, status: 'ativo' }]);
    
    alert("Mês fechado com sucesso!");
    onRefresh();
    fetchMonths();
  };

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="space-y-8">
      {currentMonth.status === 'ativo' && (
        <div className="bg-red-50 border border-red-100 p-8 rounded-[2rem] flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="bg-red-100 p-4 rounded-full text-red-700">
              <LockKeyhole size={32} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-red-900">Encerrar Ciclo Mensal</h3>
              <p className="text-red-700/60 max-w-sm">Ao fechar o mês, você bloqueia novas edições e inicia o planejamento do próximo período.</p>
            </div>
          </div>
          <button 
            onClick={closeMonthRoutine}
            className="bg-red-600 text-white px-8 py-3 rounded-full font-bold hover:bg-red-700 transition shadow-lg shadow-red-600/20"
          >
            Fechar Mês de {currentMonth.nome}
          </button>
        </div>
      )}

      <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 p-8">
        <h3 className="text-xl font-bold mb-8 flex items-center gap-2">
          <Calendar className="text-gray-400" />
          Histórico de Meses
        </h3>

        {loading ? <p className="text-center py-10">Carregando histórico...</p> : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {months.map(m => (
              <div key={m.id} className="p-6 rounded-2xl border border-gray-100 bg-gray-50/30 flex items-center justify-between group hover:border-green-200 transition">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl ${m.status === 'ativo' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {m.status === 'ativo' ? <Unlock size={20} /> : <LockKeyhole size={20} />}
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-800 uppercase tracking-tight">{m.nome} / {m.ano}</h4>
                    <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md ${m.status === 'ativo' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
                      {m.status}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  {m.status === 'fechado' ? (
                    <p className="text-lg font-bold text-gray-900">{formatCurrency(m.saldo_final)}</p>
                  ) : (
                    <p className="text-xs text-gray-400 font-medium">Em andamento</p>
                  )}
                  <button 
                    onClick={() => onSelectMonth(m)}
                    className="mt-1 text-xs font-bold text-green-700 hover:underline flex items-center gap-1 ml-auto"
                  >
                    Visualizar <TrendingUp size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Closing;
