
import React, { useState, useEffect } from 'react';
import { TrendingDown, TrendingUp, Wallet, History, Banknote, X as LucideX, ChevronRight } from 'lucide-react';
import { supabaseClient } from '../services/supabase';
import { Month } from '../types';

interface OverviewProps {
  currentMonth: Month;
  refresh: () => void;
}

interface BankDetail {
  nome: string;
  valor: number;
}

const formatDateSafe = (dateStr: string | null | undefined) => {
  if (!dateStr) return 'S/D';
  try {
    const parts = dateStr.split('T')[0].split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? 'S/D' : d.toLocaleDateString('pt-BR');
  } catch (e) {
    return 'S/D';
  }
};

interface EvolutionMonth {
  nome: string;
  ano: number;
  receitas: number;
  despesas: number;
}

const CompactChart: React.FC<{
  title: string;
  data: EvolutionMonth[];
  dataKey: 'receitas' | 'despesas';
  colorTheme: 'green' | 'red';
  formatCurrency: (val: number) => string;
}> = ({ title, data, dataKey, colorTheme, formatCurrency }) => {
  const maxVal = Math.max(...data.map(d => d[dataKey]), 1);
  const ticks = [maxVal, maxVal * 0.75, maxVal * 0.5, maxVal * 0.25, 0];

  const formatYAxisValue = (val: number) => {
    if (val <= 0) return 'R$ 0';
    if (val >= 1_000_000) {
      return `R$ ${(val / 1_000_000).toFixed(1).replace('.', ',')}M`;
    }
    if (val >= 1_000) {
      return `R$ ${(val / 1_000).toFixed(1).replace('.', ',')}k`;
    }
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(val);
  };

  const isGreen = colorTheme === 'green';

  return (
    <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-sm font-bold flex items-center gap-2 text-gray-800">
            {isGreen ? (
              <TrendingUp className="text-green-600" size={16} />
            ) : (
              <TrendingDown className="text-red-500" size={16} />
            )}
            {title}
          </h3>
        </div>

        {data.length === 0 ? (
          <div className="py-20 text-center text-gray-400">
            <p className="text-[10px] font-black uppercase tracking-widest">Sem dados disponíveis</p>
          </div>
        ) : (
          <div className="flex flex-col h-64 sm:h-72 mt-4">
            {/* Área do Gráfico */}
            <div className="flex flex-1 relative min-h-0">
              {/* Eixo Y */}
              <div className="flex flex-col justify-between text-right pr-3 text-[9px] font-black text-gray-400 select-none w-14 sm:w-16 py-1 h-full border-r border-gray-150">
                {ticks.map((tick, i) => (
                  <span key={i} className="truncate">
                    {formatYAxisValue(tick)}
                  </span>
                ))}
              </div>

              {/* Linhas de Grade e Barras */}
              <div className="flex-1 relative h-full">
                {/* Linhas de Grade Horizontais */}
                <div className="absolute inset-y-0 left-0 right-0 flex flex-col justify-between pointer-events-none py-1">
                  {ticks.map((_, i) => (
                    <div 
                      key={i} 
                      className="w-full border-b border-dashed border-gray-100 last:border-b-0" 
                      style={{ height: '0px' }} 
                    />
                  ))}
                </div>

                {/* Barras */}
                <div className="absolute inset-x-0 bottom-0 top-1 flex justify-around items-end px-2 sm:px-6">
                  {data.map((item, idx) => {
                    const val = item[dataKey];
                    const pct = maxVal > 0 ? (val / maxVal) * 100 : 0;

                    return (
                      <div key={idx} className="flex-1 flex flex-col justify-end items-center h-full group max-w-[40.5px] sm:max-w-[56px] relative px-0.5">
                        {val > 0 && (
                          <div 
                            className={`w-full bg-gradient-to-t rounded-t-xl flex flex-col items-center justify-end py-3 transition-all duration-300 shadow-sm relative cursor-pointer ${
                              isGreen 
                                ? 'from-green-600 to-emerald-500 hover:from-green-700 hover:to-emerald-650' 
                                : 'from-red-600 to-rose-500 hover:from-red-700 hover:to-rose-650'
                            }`}
                            style={{ height: `${Math.max(22, pct)}%` }}
                          >
                            <span 
                              className="text-[10px] sm:text-[12px] font-black tracking-tight text-white select-none pb-1" 
                              style={{ writingMode: 'vertical-lr', transform: 'rotate(180deg)' }}
                            >
                              {formatCurrency(val)}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Eixo X com Meses */}
            <div className="flex mt-3">
              {/* Espaçador idêntico ao do Eixo Y */}
              <div className="w-14 sm:w-16 pr-3 border-r border-transparent" />
              <div className="flex-1 flex justify-around px-2 sm:px-6 border-t border-gray-200 pt-2">
                {data.map((item, idx) => (
                  <span key={idx} className="text-[8px] sm:text-[10px] font-black text-gray-400 uppercase tracking-wider text-center max-w-[40.5px] sm:max-w-[56px] truncate">
                    {item.nome.slice(0, 3)}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const Overview: React.FC<OverviewProps> = ({ currentMonth, refresh }) => {
  const [totals, setTotals] = useState({ revenue: 0, expenses: 0, balance: 0, cards: 0 });
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [bankDetails, setBankDetails] = useState<BankDetail[]>([]);
  const [evolutionData, setEvolutionData] = useState<EvolutionMonth[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCardsModal, setShowCardsModal] = useState(false);

  useEffect(() => {
    fetchData();
  }, [currentMonth]);

  const getMonthVal = (nome: string, ano: number) => {
    const months = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];
    return ano * 100 + months.indexOf(nome.trim().toUpperCase());
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [receitasRes, despesasRes, pixRes, bancosRes, bancosListaRes, mesesRes] = await Promise.all([
        supabaseClient.from('receitas').select('valor, descricao, data, criado_em').eq('mes_id', currentMonth.id),
        supabaseClient.from('despesas_contas').select('valor, descricao, data, criado_em, pago').eq('mes_id', currentMonth.id),
        supabaseClient.from('despesas_pix_credito').select('valor_final, descricao, data, criado_em, pago').eq('mes_id', currentMonth.id),
        supabaseClient.from('banco_despesas').select('valor, banco_id').eq('mes_id', currentMonth.id),
        supabaseClient.from('bancos').select('id, nome'),
        supabaseClient.from('meses').select('*')
      ]);

      const rev = receitasRes.data?.reduce((acc, curr) => acc + curr.valor, 0) || 0;
      const expContas = despesasRes.data?.filter(e => !e.pago).reduce((acc, curr) => acc + curr.valor, 0) || 0;
      const expPix = pixRes.data?.filter(e => !e.pago).reduce((acc, curr) => acc + curr.valor_final, 0) || 0;
      const expBancos = bancosRes.data?.filter(e => !e.pago).reduce((acc, curr) => acc + curr.valor, 0) || 0;

      const totalExp = expContas + expPix + expBancos;

      // Agrupar gastos por banco para o modal
      const details: BankDetail[] = [];
      if (bancosListaRes.data && bancosRes.data) {
        bancosListaRes.data.forEach(banco => {
          const soma = bancosRes.data
            .filter(d => d.banco_id === banco.id)
            .reduce((acc, curr) => acc + curr.valor, 0);
          if (soma > 0) {
            details.push({ nome: banco.nome, valor: soma });
          }
        });
      }
      setBankDetails(details);

      setTotals({
        revenue: rev,
        expenses: totalExp,
        balance: rev - totalExp,
        cards: expBancos
      });

      const allItems = [
        ...(receitasRes.data || []).map(i => ({ ...i, type: 'revenue' })),
        ...(despesasRes.data || []).map(i => ({ ...i, type: 'expense' })),
        ...(pixRes.data || []).map(i => ({ ...i, type: 'pix', valor: i.valor_final })),
        ...(bancosRes.data || []).map(i => ({ ...i, type: 'bank' }))
      ].sort((a, b) => new Date(b.criado_em || b.data).getTime() - new Date(a.criado_em || a.data).getTime());

      setRecentTransactions(allItems.slice(0, 5));

      // Calcular a evolução dos últimos 4 meses
      const sortedMeses = (mesesRes.data || []).slice().sort((a, b) => getMonthVal(a.nome, a.ano) - getMonthVal(b.nome, b.ano));
      const currentIndex = sortedMeses.findIndex(m => m.id === currentMonth.id);
      let last4: any[] = [];
      if (currentIndex !== -1) {
        // Encontrar os 4 meses anteriores ao selecionado (excluindo o atual)
        last4 = sortedMeses.slice(Math.max(0, currentIndex - 4), currentIndex);
        // Se estivermos no primeiro mês cadastrado e não houver meses anteriores,
        // aplicamos fallback para pegar os próximos 4 meses (excluindo o atual) para desenhar o gráfico
        if (last4.length === 0) {
          last4 = sortedMeses.filter(m => m.id !== currentMonth.id).slice(0, 4);
        }
      } else {
        last4 = sortedMeses.slice(-4);
      }
      const last4Ids = last4.map(m => m.id);

      if (last4Ids.length > 0) {
        const [recAll, despAll, pixAll, bankAll] = await Promise.all([
          supabaseClient.from('receitas').select('mes_id, valor').in('mes_id', last4Ids),
          supabaseClient.from('despesas_contas').select('mes_id, valor, pago').in('mes_id', last4Ids),
          supabaseClient.from('despesas_pix_credito').select('mes_id, valor_final, pago').in('mes_id', last4Ids),
          supabaseClient.from('banco_despesas').select('mes_id, valor, pago').in('mes_id', last4Ids),
        ]);

        const evoList = last4.map(m => {
          const rSum = (recAll.data || [])
            .filter(r => r.mes_id === m.id)
            .reduce((acc, curr) => acc + curr.valor, 0);

          const dcSum = (despAll.data || [])
            .filter(e => e.mes_id === m.id && !e.pago)
            .reduce((acc, curr) => acc + curr.valor, 0);

          const dpSum = (pixAll.data || [])
            .filter(e => e.mes_id === m.id && !e.pago)
            .reduce((acc, curr) => acc + curr.valor_final, 0);

          const dbSum = (bankAll.data || [])
            .filter(e => e.mes_id === m.id) // Mantém consistência com SAÍDAS TOTAIS que não filtra por pago para despesas de bancos/cartão
            .reduce((acc, curr) => acc + curr.valor, 0);

          return {
            nome: m.nome,
            ano: m.ano,
            receitas: rSum,
            despesas: dcSum + dpSum + dbSum
          };
        });

        setEvolutionData(evoList);
      } else {
        setEvolutionData([]);
      }
    } catch (err) {
      console.error("Erro ao recuperar dados financeiros:", err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
      <div className="h-8 w-8 border-3 border-green-700 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-xs font-bold uppercase tracking-widest">Calculando Balanço...</p>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-900 text-white p-6 rounded-3xl shadow-lg relative overflow-hidden">
          <div className="absolute -right-4 -top-4 bg-white/5 p-10 rounded-full"></div>
          <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-1 flex items-center gap-1.5">
            <Wallet size={12} className="text-green-500" /> Saldo Real (Líquido)
          </p>
          <h2 className="text-3xl font-black tracking-tighter">{formatCurrency(totals.balance)}</h2>
          <p className="mt-2 text-[9px] text-white/30 uppercase font-bold tracking-wider">Cálculo Contábil (Indep. de Parcelas)</p>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className="bg-green-50 p-2 rounded-xl text-green-600 border border-green-100">
              <TrendingUp size={18} />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-0.5">Entradas Totais</p>
            <h2 className="text-xl font-black text-gray-800">{formatCurrency(totals.revenue)}</h2>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className="bg-red-50 p-2 rounded-xl text-red-600 border border-red-100">
              <TrendingDown size={18} />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-0.5">Saídas Totais</p>
            <h2 className="text-xl font-black text-gray-800">{formatCurrency(totals.expenses)}</h2>
          </div>
        </div>
      </div>

      {/* SEÇÃO DE EVOLUÇÃO FINANCEIRA */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CompactChart 
          title="Evolução das Receitas (Últimos 4 meses)"
          data={evolutionData}
          dataKey="receitas"
          colorTheme="green"
          formatCurrency={formatCurrency}
        />
        <CompactChart 
          title="Evolução das Despesas (Últimos 4 meses)"
          data={evolutionData}
          dataKey="despesas"
          colorTheme="red"
          formatCurrency={formatCurrency}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-bold flex items-center gap-2 text-gray-800">
              <History className="text-gray-400" size={16} />
              Lançamentos Recentes
            </h3>
          </div>
          <div className="space-y-2">
            {recentTransactions.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 rounded-2xl bg-gray-50/50 border border-gray-50">
                <div className="flex items-center gap-3">
                  <div className={`p-1.5 rounded-lg ${item.type === 'revenue' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {item.type === 'revenue' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-700">{item.descricao}</p>
                    <p className="text-[9px] text-gray-400 font-bold uppercase">{formatDateSafe(item.data)}</p>
                  </div>
                </div>
                <span className={`text-xs font-black ${item.type === 'revenue' ? 'text-green-700' : 'text-red-700'}`}>
                   {item.type === 'revenue' ? '+' : '-'}{formatCurrency(item.valor)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div 
          onClick={() => setShowCardsModal(true)}
          className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col cursor-pointer hover:border-blue-200 transition-all group"
        >
          <div className="flex justify-between items-center mb-5">
            <h3 className="text-sm font-bold flex items-center gap-2 text-gray-800">
              <Banknote size={16} className="text-gray-400" />
              Total Cartões de Crédito
            </h3>
            <ChevronRight size={16} className="text-gray-300 group-hover:text-blue-500 transition-colors" />
          </div>
          <div className="space-y-4">
            <div className="p-5 bg-gray-50 border border-gray-100 rounded-2xl flex flex-col justify-center">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Gasto em Faturas</p>
              <h2 className="text-2xl font-black text-gray-900">{formatCurrency(totals.cards)}</h2>
              
              {bankDetails.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200 space-y-1.5">
                  {bankDetails.map((bank, idx) => (
                    <div key={idx} className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest text-gray-400">
                      <span>{bank.nome}</span>
                      <span className="text-gray-700">{formatCurrency(bank.valor)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button 
              onClick={(e) => { e.stopPropagation(); refresh(); }}
              className="w-full bg-gray-900 text-white font-bold py-3.5 rounded-2xl hover:bg-black transition shadow-md text-xs uppercase tracking-widest"
            >
              Sincronizar Banco
            </button>
          </div>
        </div>
      </div>

      {/* MODAL DE DETALHAMENTO DE CARTÕES */}
      {showCardsModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm p-6 rounded-3xl shadow-2xl animate-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-lg font-black text-gray-900 uppercase tracking-tight">Detalhamento Cartões</h2>
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{currentMonth.nome} {currentMonth.ano}</p>
              </div>
              <button onClick={() => setShowCardsModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <LucideX size={20} />
              </button>
            </div>

            <div className="space-y-2 max-h-[40vh] overflow-y-auto no-scrollbar mb-6">
              {bankDetails.length === 0 ? (
                <div className="py-10 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Nenhum gasto registrado</p>
                </div>
              ) : (
                bankDetails.map((bank, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 rounded-2xl bg-gray-50 border border-gray-100">
                    <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">{bank.nome}</span>
                    <span className="text-xs font-black text-gray-900">{formatCurrency(bank.valor)}</span>
                  </div>
                ))
              )}
            </div>

            <div className="pt-4 border-t border-gray-100">
              <div className="flex justify-between items-center p-4 bg-gray-900 rounded-2xl text-white">
                <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">Total Faturas</span>
                <span className="text-base font-black tracking-tight">{formatCurrency(totals.cards)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Overview;
