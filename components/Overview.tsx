
import React, { useState, useEffect } from 'react';
import { TrendingDown, TrendingUp, Wallet, History, CalendarDays } from 'lucide-react';
import { supabaseClient } from '../services/supabase';
import { Month } from '../types';

interface OverviewProps {
  currentMonth: Month;
  refresh: () => void;
}

const Overview: React.FC<OverviewProps> = ({ currentMonth, refresh }) => {
  const [totals, setTotals] = useState({ revenue: 0, expenses: 0, balance: 0 });
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [currentMonth]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [receitasRes, despesasRes, pixRes, bancosRes] = await Promise.all([
        supabaseClient.from('receitas').select('valor, descricao, data, criado_em').eq('mes_id', currentMonth.id),
        supabaseClient.from('despesas_contas').select('valor, descricao, data, criado_em, pago').eq('mes_id', currentMonth.id),
        supabaseClient.from('despesas_pix_credito').select('valor_final, descricao, data, criado_em, pago').eq('mes_id', currentMonth.id),
        supabaseClient.from('banco_despesas').select('valor, descricao, data, criado_em, pago').eq('mes_id', currentMonth.id)
      ]);

      const rev = receitasRes.data?.reduce((acc, curr) => acc + curr.valor, 0) || 0;
      
      // LOGICA SOLICITADA: Contabilizar apenas despesas PAGAS
      const expContas = despesasRes.data?.filter(i => i.pago).reduce((acc, curr) => acc + curr.valor, 0) || 0;
      const expPix = pixRes.data?.filter(i => i.pago).reduce((acc, curr) => acc + curr.valor_final, 0) || 0;
      const expBancos = bancosRes.data?.filter(i => i.pago).reduce((acc, curr) => acc + curr.valor, 0) || 0;

      const totalExpPagas = expContas + expPix + expBancos;

      setTotals({
        revenue: rev,
        expenses: totalExpPagas,
        balance: rev - totalExpPagas
      });

      const allItems = [
        ...(receitasRes.data || []).map(i => ({ ...i, type: 'revenue' })),
        ...(despesasRes.data || []).map(i => ({ ...i, type: 'expense' })),
        ...(pixRes.data || []).map(i => ({ ...i, type: 'pix', valor: i.valor_final })),
        ...(bancosRes.data || []).map(i => ({ ...i, type: 'bank' }))
      ].sort((a, b) => new Date(b.criado_em || b.data).getTime() - new Date(a.criado_em || a.data).getTime());

      setRecentTransactions(allItems.slice(0, 5));
    } catch (err) {
      console.error("Erro ao recuperar dados:", err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
      <div className="h-8 w-8 border-3 border-green-700 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-xs font-bold uppercase tracking-widest">Sincronizando Saldos...</p>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-green-900 text-white p-6 rounded-3xl shadow-lg relative overflow-hidden">
          <div className="absolute -right-4 -top-4 bg-white/5 p-10 rounded-full"></div>
          <p className="text-green-200/60 text-[10px] font-bold uppercase tracking-widest mb-1 flex items-center gap-1.5">
            <Wallet size={12} /> Saldo Real (Líquido)
          </p>
          <h2 className="text-3xl font-black tracking-tighter">{formatCurrency(totals.balance)}</h2>
          <p className="mt-2 text-[9px] text-green-100/40 uppercase font-bold tracking-wider">Apenas Despesas Pagas</p>
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
            <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-0.5">Saídas Efetivadas</p>
            <h2 className="text-xl font-black text-gray-800">{formatCurrency(totals.expenses)}</h2>
          </div>
        </div>
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
                    <p className="text-[9px] text-gray-400 font-bold uppercase">{new Date(item.data).toLocaleDateString('pt-BR')}</p>
                  </div>
                </div>
                <span className={`text-xs font-black ${item.type === 'revenue' ? 'text-green-700' : 'text-red-700'}`}>
                   {formatCurrency(item.valor)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col">
          <h3 className="text-sm font-bold mb-5 flex items-center gap-2 text-gray-800">
            <CalendarDays size={16} className="text-gray-400" />
            Info de Conexão
          </h3>
          <div className="space-y-3">
            <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl">
              <p className="text-[9px] font-bold text-blue-700 uppercase tracking-widest mb-1">Dica de Gestão</p>
              <p className="text-[11px] text-blue-900/60 leading-relaxed font-medium">As despesas em aberto servem como previsão e não afetam o saldo real até serem liquidadas.</p>
            </div>
            <button 
              onClick={refresh}
              className="w-full bg-gray-900 text-white font-bold py-3.5 rounded-2xl hover:bg-black transition shadow-md text-xs uppercase tracking-widest"
            >
              Sincronizar Banco
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Overview;
