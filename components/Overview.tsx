
import React, { useState, useEffect } from 'react';
import { TrendingDown, TrendingUp, Wallet, ArrowRight, History, CalendarDays } from 'lucide-react';
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
      // Recuperar Totais
      const [receitasRes, despesasRes, pixRes, bancosRes] = await Promise.all([
        supabaseClient.from('receitas').select('valor, descricao, data, criado_em').eq('mes_id', currentMonth.id),
        supabaseClient.from('despesas_contas').select('valor, descricao, data, criado_em').eq('mes_id', currentMonth.id),
        supabaseClient.from('despesas_pix_credito').select('valor_final, descricao, data, criado_em').eq('mes_id', currentMonth.id),
        supabaseClient.from('banco_despesas').select('valor, descricao, data, criado_em').eq('mes_id', currentMonth.id)
      ]);

      const rev = receitasRes.data?.reduce((acc, curr) => acc + curr.valor, 0) || 0;
      const exp = (despesasRes.data?.reduce((acc, curr) => acc + curr.valor, 0) || 0) +
                  (pixRes.data?.reduce((acc, curr) => acc + curr.valor_final, 0) || 0) +
                  (bancosRes.data?.reduce((acc, curr) => acc + curr.valor, 0) || 0);

      setTotals({
        revenue: rev,
        expenses: exp,
        balance: rev - exp
      });

      // Recuperar Lançamentos Recentes (Unificando as tabelas para histórico)
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
    <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-4">
      <div className="h-10 w-10 border-4 border-green-700 border-t-transparent rounded-full animate-spin"></div>
      <p className="font-medium">Recuperando saldos do banco...</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-green-900 text-white p-8 rounded-[2rem] shadow-xl relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 bg-white/10 p-12 rounded-full transition-transform group-hover:scale-110"></div>
          <p className="text-green-100/70 font-medium mb-1 flex items-center gap-2">
            <Wallet size={16} /> Saldo Líquido
          </p>
          <h2 className="text-4xl font-bold tracking-tight">{formatCurrency(totals.balance)}</h2>
          <p className="mt-4 text-sm text-green-100/50">Disponível no período de {currentMonth.nome}</p>
        </div>

        <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-gray-100 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className="bg-green-100 p-3 rounded-2xl text-green-700">
              <TrendingUp size={24} />
            </div>
            <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-md">Entradas</span>
          </div>
          <div className="mt-4">
            <p className="text-gray-400 text-sm font-medium">Total Receitas</p>
            <h2 className="text-2xl font-bold">{formatCurrency(totals.revenue)}</h2>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-gray-100 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className="bg-red-100 p-3 rounded-2xl text-red-600">
              <TrendingDown size={24} />
            </div>
            <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-md">Saídas</span>
          </div>
          <div className="mt-4">
            <p className="text-gray-400 text-sm font-medium">Total Despesas</p>
            <h2 className="text-2xl font-bold">{formatCurrency(totals.expenses)}</h2>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lançamentos Recentes */}
        <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <History className="text-gray-400" size={20} />
              Recuperados Recentemente
            </h3>
            <span className="text-xs font-bold text-gray-400 uppercase">Últimos 5</span>
          </div>
          <div className="space-y-3">
            {recentTransactions.length === 0 ? (
              <p className="text-center py-10 text-gray-400">Nenhum lançamento encontrado.</p>
            ) : (
              recentTransactions.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-gray-50/50 border border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${item.type === 'revenue' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {item.type === 'revenue' ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-800">{item.descricao}</p>
                      <p className="text-[10px] text-gray-400 uppercase font-bold">{new Date(item.data).toLocaleDateString('pt-BR')}</p>
                    </div>
                  </div>
                  <span className={`text-sm font-bold ${item.type === 'revenue' ? 'text-green-700' : 'text-red-700'}`}>
                    {item.type === 'revenue' ? '+' : '-'} {formatCurrency(item.valor)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Info Extra */}
        <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-gray-100 flex flex-col">
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
            <CalendarDays size={20} className="text-gray-400" />
            Informações do Período
          </h3>
          <div className="flex-1 flex flex-col justify-center space-y-4">
            <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl">
              <p className="text-xs font-bold text-blue-800 uppercase mb-1">Status da Base</p>
              <p className="text-sm text-blue-900/70">O sistema está conectado ao banco de dados em tempo real. Todas as alterações são salvas automaticamente.</p>
            </div>
            <button 
              onClick={refresh}
              className="w-full flex items-center justify-center gap-2 bg-gray-900 text-white font-bold py-4 rounded-2xl hover:bg-black transition shadow-lg shadow-gray-900/20"
            >
              Forçar Recarregamento Total
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Overview;
