
import React, { useState, useEffect } from 'react';
import { LockKeyhole, Unlock, Calendar, TrendingUp, CalendarPlus, ChevronRight, RotateCcw } from 'lucide-react';
import { supabaseClient } from '../services/supabase';
import { Month, MonthStatus } from '../types';

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
    setLoading(true);
    try {
      let { data: allMonths, error } = await supabaseClient
        .from('meses')
        .select('*')
        .order('ano', { ascending: false });

      if (error || !allMonths) {
        setMonths([]);
        setLoading(false);
        return;
      }

      const statusOrder: Record<MonthStatus, number> = { 'ativo': 1, 'provisionamento': 2, 'fechado': 3 };
      const meses_nomes = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];
      
      const sortedMonths = [...allMonths].sort((a, b) => {
        const statusA = statusOrder[a.status] || 99;
        const statusB = statusOrder[b.status] || 99;

        if (statusA !== statusB) return statusA - statusB;

        if (a.ano !== b.ano) return b.ano - a.ano;
        return meses_nomes.indexOf(b.nome.toUpperCase()) - meses_nomes.indexOf(a.nome.toUpperCase());
      });

      setMonths(sortedMonths);
    } catch (err) {
      console.error("Erro ao carregar histórico:", err);
    } finally {
      setLoading(false);
    }
  };

  const closeMonthRoutine = async () => {
    if (currentMonth.status !== 'ativo') {
      alert("Apenas o mês ativo pode ser encerrado.");
      return;
    }

    if (!confirm(`Deseja encerrar ${currentMonth.nome}/${currentMonth.ano}? As parcelas pendentes serão migradas para o próximo mês.`)) return;
    
    const [r, d, p, b] = await Promise.all([
      supabaseClient.from('receitas').select('valor').eq('mes_id', currentMonth.id),
      supabaseClient.from('despesas_contas').select('valor').eq('mes_id', currentMonth.id).eq('pago', true),
      supabaseClient.from('despesas_pix_credito').select('valor_final').eq('mes_id', currentMonth.id).eq('pago', true),
      supabaseClient.from('banco_despesas').select('valor').eq('mes_id', currentMonth.id).eq('pago', true)
    ]);
    
    const rev = r.data?.reduce((a,c) => a + c.valor, 0) || 0;
    const exp = (d.data?.reduce((a,c) => a + c.valor, 0) || 0) + 
                (p.data?.reduce((a,c) => a + c.valor_final, 0) || 0) + 
                (b.data?.reduce((a,c) => a + c.valor, 0) || 0);
    const total = rev - exp;

    const meses_nomes = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];
    let idx = meses_nomes.indexOf(currentMonth.nome.trim().toUpperCase());
    let nextIdx = (idx + 1) % 12;
    let nextYear = idx === 11 ? currentMonth.ano + 1 : currentMonth.ano;
    const nextMonthName = meses_nomes[nextIdx];
    
    const { data: nextMonths } = await supabaseClient
      .from('meses')
      .select('*')
      .ilike('nome', nextMonthName)
      .eq('ano', nextYear);

    const nextMonthData = nextMonths?.[0];

    if (!nextMonthData) {
      alert(`Erro: O mês de destino (${nextMonthName}/${nextYear}) não foi encontrado no sistema. O fechamento não pôde ser concluído.`);
      return;
    }

    await supabaseClient.from('meses').update({ status: 'fechado', saldo_final: total }).eq('id', currentMonth.id);
    await supabaseClient.from('meses').update({ status: 'ativo' }).eq('id', nextMonthData.id);

    const { data: installments } = await supabaseClient
      .from('parcelamentos')
      .select('*')
      .eq('mes_id', currentMonth.id);

    if (installments && installments.length > 0) {
      const pending = installments.filter(i => (i.parcela_atual || 0) < (i.total_parcelas || 0));
      
      if (pending.length > 0) {
        const carryOver = pending.map(i => ({
          mes_id: nextMonthData.id,
          descricao: i.descricao,
          valor_parcela: i.valor_parcela,
          parcela_atual: (i.parcela_atual || 0) + 1,
          total_parcelas: i.total_parcelas
        }));
        
        await supabaseClient.from('parcelamentos').insert(carryOver);
      }
    }
    
    alert(`Mês de ${currentMonth.nome} encerrado.`);
    onRefresh();
    fetchMonths();
  };

  const reopenMonth = async (month: Month) => {
    if (!confirm(`Deseja reabrir ${month.nome}/${month.ano}? Isso permitirá editar lançamentos novamente.`)) return;
    
    const { error } = await supabaseClient
      .from('meses')
      .update({ status: 'ativo', saldo_final: null })
      .eq('id', month.id);

    if (error) {
      alert("Erro ao reabrir mês: " + error.message);
    } else {
      alert(`${month.nome}/${month.ano} agora está ATIVO.`);
      onRefresh();
      fetchMonths();
    }
  };

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      {currentMonth.status === 'ativo' && (
        <div className="bg-gray-900 p-8 sm:p-12 rounded-[2.5rem] flex flex-col md:flex-row items-center justify-between gap-8 shadow-2xl">
          <div className="flex items-center gap-6 text-white">
            <div className="bg-white/10 p-5 rounded-3xl backdrop-blur-sm border border-white/5">
              <LockKeyhole size={32} />
            </div>
            <div>
              <h3 className="text-2xl font-black uppercase tracking-tighter leading-none mb-2">Encerrar Ciclo</h3>
              <p className="text-white/40 text-xs font-bold uppercase tracking-widest max-w-xs">Finaliza o mês atual e projeta as parcelas pendentes para o próximo período.</p>
            </div>
          </div>
          <button 
            onClick={closeMonthRoutine}
            className="w-full md:w-auto bg-white text-gray-900 px-10 py-5 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-gray-100 transition shadow-xl active:scale-95"
          >
            Fechar Mês Agora
          </button>
        </div>
      )}

      <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 p-8 lg:p-12">
        <h3 className="text-xl font-black mb-10 flex items-center gap-3 text-gray-800">
          <Calendar className="text-gray-400" size={24} />
          ARQUIVO MENSAL
        </h3>

        {loading ? (
          <div className="py-24 flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-4 border-gray-900 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Varrendo Registros...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {months.map(m => (
              <div 
                key={m.id} 
                className={`p-6 rounded-[1.8rem] border flex items-center justify-between transition-all group ${
                  m.status === 'ativo' ? 'bg-green-50/20 border-green-100' :
                  m.status === 'provisionamento' ? 'bg-blue-50/20 border-blue-100' :
                  'bg-gray-50/30 border-gray-100 hover:border-gray-200'
                }`}
              >
                <div className="flex items-center gap-5">
                  <div className={`p-4 rounded-2xl shadow-sm ${
                      m.status === 'ativo' ? 'bg-green-600 text-white' :
                      m.status === 'provisionamento' ? 'bg-blue-600 text-white' :
                      'bg-white text-gray-300 border border-gray-100'}`
                  }>
                    {m.status === 'ativo' ? <Unlock size={20} /> :
                     m.status === 'provisionamento' ? <CalendarPlus size={20} /> :
                     <LockKeyhole size={20} />}
                  </div>
                  <div>
                    <h4 className="font-black text-gray-900 text-base uppercase tracking-tight">{m.nome} {m.ano}</h4>
                    <span className={`text-[9px] font-black uppercase tracking-[0.15em] px-2.5 py-1 rounded-lg ${
                        m.status === 'ativo' ? 'bg-green-100 text-green-700' :
                        m.status === 'provisionamento' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-200 text-gray-500'}`
                    }>
                      {m.status === 'provisionamento' ? 'Planejamento' : m.status}
                    </span>
                  </div>
                </div>
                
                <div className="text-right flex flex-col items-end gap-1">
                  {m.status === 'fechado' ? (
                    <p className="text-base font-black text-gray-900 tracking-tighter">{formatCurrency(m.saldo_final)}</p>
                  ) : (
                    <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">
                      {m.status === 'ativo' ? 'Contexto Real' : 'Fluxo Futuro'}
                    </p>
                  )}
                  
                  <div className="flex items-center gap-2 mt-1">
                    {m.status === 'fechado' && (
                      <button 
                        onClick={() => reopenMonth(m)}
                        className="text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-900 hover:text-white transition-all shadow-sm"
                      >
                        <RotateCcw size={12} /> REABRIR
                      </button>
                    )}
                    <button 
                      onClick={() => onSelectMonth(m)}
                      className="text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-900 hover:bg-gray-50 transition-all"
                    >
                      ACESSAR <ChevronRight size={14} />
                    </button>
                  </div>
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
