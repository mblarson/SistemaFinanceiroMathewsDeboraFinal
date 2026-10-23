import React, { useState, useEffect } from 'react';
import { 
  TrendingDown, 
  TrendingUp, 
  Wallet, 
  History, 
  Banknote, 
  X as LucideX, 
  ChevronRight,
  CreditCard,
  FileText,
  Calculator as CalcIcon,
  ShoppingBag,
  Receipt,
  Clock,
  LayoutDashboard,
  MoreVertical,
  Moon,
  Bell,
  ChevronUp,
  Box,
  ArrowDownRight,
  ArrowUpRight,
  Eye,
  EyeOff
} from 'lucide-react';
import { supabaseClient } from '../services/supabase';
import { Month } from '../types';

interface OverviewProps {
  currentMonth: Month;
  activeMonth?: Month | null;
  provisionMonth?: Month | null;
  onSelectMonth?: (m: Month) => void;
  refresh: () => void;
  onNavigate?: (view: string) => void;
  onToggleMenu?: () => void;
}

interface BankDetail {
  nome: string;
  valor: number;
}

interface CardItem {
  id: number | string;
  nome: string;
  cor: string;
  fatura: number;
  vencimento: string;
  limiteTotal: number;
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

const getGreeting = () => {
  const hours = new Date().getHours();
  if (hours >= 5 && hours < 12) return 'Bom dia!';
  if (hours >= 12 && hours < 18) return 'Boa tarde!';
  return 'Boa noite!';
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
  mostrarValores?: boolean;
}> = ({ title, data, dataKey, colorTheme, formatCurrency, mostrarValores = true }) => {
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
    <div className="bg-white p-5 sm:p-8 rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-between lg:rounded-3xl lg:shadow-md lg:shadow-gray-200/50 lg:border-gray-150/70 lg:hover:shadow-lg lg:transition-all lg:duration-300 overflow-x-hidden">
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
                    {mostrarValores ? formatYAxisValue(tick) : 'R$ •••'}
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
                              className={`text-[10px] sm:text-[12px] font-black tracking-tight text-white select-none pb-1 transition-all ${
                                mostrarValores ? '' : 'blur-[3px] select-none opacity-40'
                              }`} 
                              style={{ writingMode: 'vertical-lr', transform: 'rotate(180deg)' }}
                            >
                              {mostrarValores ? formatCurrency(val) : '••••••••'}
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

const Overview: React.FC<OverviewProps> = ({ 
  currentMonth, 
  activeMonth, 
  provisionMonth, 
  onSelectMonth, 
  refresh, 
  onNavigate,
  onToggleMenu 
}) => {
  const [totals, setTotals] = useState({ revenue: 0, expenses: 0, balance: 0, cards: 0 });
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [bankDetails, setBankDetails] = useState<BankDetail[]>([]);
  const [cardsList, setCardsList] = useState<CardItem[]>([]);
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [evolutionData, setEvolutionData] = useState<EvolutionMonth[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCardsModal, setShowCardsModal] = useState(false);
  const [greeting, setGreeting] = useState('Bom dia!');
  const [mostrarValores, setMostrarValores] = useState(false);

  useEffect(() => {
    setGreeting(getGreeting());
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
        supabaseClient.from('banco_despesas').select('valor, banco_id, data').eq('mes_id', currentMonth.id),
        supabaseClient.from('bancos').select('id, nome, cor'),
        supabaseClient.from('meses').select('*')
      ]);

      const rev = receitasRes.data?.reduce((acc, curr) => acc + curr.valor, 0) || 0;
      const expContas = despesasRes.data?.filter(e => !e.pago).reduce((acc, curr) => acc + curr.valor, 0) || 0;
      const expPix = pixRes.data?.filter(e => !e.pago).reduce((acc, curr) => acc + curr.valor_final, 0) || 0;
      const expBancos = bancosRes.data?.filter(e => !e.pago).reduce((acc, curr) => acc + curr.valor, 0) || 0;

      const totalExp = expContas + expPix + expBancos;

      // Agrupar gastos por banco para o modal e carrossel
      const details: BankDetail[] = [];
      const cards: CardItem[] = [];

      if (bancosListaRes.data && bancosRes.data) {
        bancosListaRes.data.forEach(banco => {
          const soma = bancosRes.data
            .filter(d => d.banco_id === banco.id)
            .reduce((acc, curr) => acc + curr.valor, 0);

          if (soma > 0) {
            details.push({ nome: banco.nome, valor: soma });
          }

          // Monta dados reais de cada cartão para o carrossel mobile
          const vencimentosPadrao: Record<string, string> = {
            'Nubank': 'Dia 10',
            'Itaú': 'Dia 15',
            'American Express': 'Dia 20',
            'BB': 'Dia 05',
            'C6 Bank': 'Dia 12'
          };

          const limitesPadrao: Record<string, number> = {
            'Nubank': 8500,
            'Itaú': 12000,
            'American Express': 15000,
            'BB': 6000,
            'C6 Bank': 5000
          };

          cards.push({
            id: banco.id,
            nome: banco.nome,
            cor: banco.cor || '#121926',
            fatura: soma,
            vencimento: vencimentosPadrao[banco.nome] || 'Dia 10',
            limiteTotal: limitesPadrao[banco.nome] || Math.max(7000, soma * 1.5)
          });
        });
      }

      // Adiciona o consolidado como primeiro cartão do carrossel
      const totalCardsItem: CardItem = {
        id: 'total',
        nome: 'Todos os Cartões',
        cor: '#121926',
        fatura: expBancos,
        vencimento: 'No Mês',
        limiteTotal: cards.reduce((acc, c) => acc + c.limiteTotal, 0) || 35000
      };

      setBankDetails(details);
      setCardsList([totalCardsItem, ...cards]);

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
        last4 = sortedMeses.slice(Math.max(0, currentIndex - 4), currentIndex);
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
            .filter(e => e.mes_id === m.id)
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

  const currentCard = cardsList[activeCardIndex] || cardsList[0] || {
    id: 'total',
    nome: 'Todos os Cartões',
    cor: '#121926',
    fatura: totals.cards,
    vencimento: 'No Mês',
    limiteTotal: 35000
  };

  const meses_nomes = [
    "JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", 
    "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"
  ];

  const effectiveActiveMonth = activeMonth || currentMonth;
  const activeMonthIdx = meses_nomes.findIndex(m => m === effectiveActiveMonth.nome.trim().toUpperCase());
  const nextIdx = activeMonthIdx >= 0 ? (activeMonthIdx + 1) % 12 : 0;
  const nextYear = activeMonthIdx === 11 ? effectiveActiveMonth.ano + 1 : effectiveActiveMonth.ano;
  
  const effectiveNextMonth: Month = provisionMonth || {
    id: -1,
    nome: meses_nomes[nextIdx],
    ano: nextYear,
    status: 'provisionamento',
    saldo_final: 0,
    criado_em: new Date().toISOString()
  };

  const isCurrentActive = currentMonth.id === effectiveActiveMonth.id;
  const isCurrentNext = currentMonth.id === effectiveNextMonth.id || (!isCurrentActive && currentMonth.nome.trim().toUpperCase() === effectiveNextMonth.nome.trim().toUpperCase());

  return (
    <>
      {/* ============================================================ */}
      {/* 1. VISUALIZAÇÃO DESKTOP (HIDDEN NO MOBILE, 100% INTACTO)      */}
      {/* ============================================================ */}
      <div className="hidden md:block space-y-6 animate-in fade-in duration-500">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-900 text-white p-6 rounded-3xl shadow-lg relative overflow-hidden lg:rounded-3xl lg:bg-gradient-to-br lg:from-gray-900 lg:via-gray-850 lg:to-gray-950 lg:shadow-xl lg:shadow-gray-900/20 lg:border lg:border-white/10 lg:hover:shadow-2xl lg:hover:-translate-y-0.5 lg:transition-all lg:duration-300">
            <div className="absolute -right-4 -top-4 bg-white/5 p-10 rounded-full"></div>
            <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-1 flex items-center gap-1.5">
              <Wallet size={12} className="text-green-500" /> Saldo Real (Líquido)
            </p>
            <h2 className="text-3xl font-black tracking-tighter">{formatCurrency(totals.balance)}</h2>
            <p className="mt-2 text-[9px] text-white/30 uppercase font-bold tracking-wider">Cálculo Contábil (Indep. de Parcelas)</p>
          </div>

          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-between lg:rounded-3xl lg:bg-gradient-to-br lg:from-white lg:via-white lg:to-emerald-50/20 lg:shadow-md lg:shadow-gray-200/50 lg:border-gray-150/70 lg:hover:shadow-lg lg:hover:-translate-y-0.5 lg:transition-all lg:duration-300">
            <div className="flex justify-between items-start">
              <div className="bg-green-50 p-2 rounded-xl text-green-600 border border-green-100 lg:rounded-2xl lg:shadow-xs">
                <TrendingUp size={18} />
              </div>
            </div>
            <div className="mt-4">
              <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-0.5">Entradas Totais</p>
              <h2 className="text-xl font-black text-gray-800">{formatCurrency(totals.revenue)}</h2>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-between lg:rounded-3xl lg:bg-gradient-to-br lg:from-white lg:via-white lg:to-rose-50/20 lg:shadow-md lg:shadow-gray-200/50 lg:border-gray-150/70 lg:hover:shadow-lg lg:hover:-translate-y-0.5 lg:transition-all lg:duration-300">
            <div className="flex justify-between items-start">
              <div className="bg-red-50 p-2 rounded-xl text-red-600 border border-red-100 lg:rounded-2xl lg:shadow-xs">
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
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 lg:rounded-3xl lg:shadow-md lg:shadow-gray-200/50 lg:border-gray-150/70 lg:hover:shadow-lg lg:transition-all lg:duration-300">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-bold flex items-center gap-2 text-gray-800">
                <History className="text-gray-400" size={16} />
                Lançamentos Recentes
              </h3>
            </div>
            <div className="space-y-2">
              {recentTransactions.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-2xl bg-gray-50/50 border border-gray-50 lg:rounded-2xl lg:hover:bg-gray-50 lg:transition-all">
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
            className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col cursor-pointer hover:border-blue-200 transition-all group lg:rounded-3xl lg:shadow-md lg:shadow-gray-200/50 lg:border-gray-150/70 lg:hover:shadow-xl lg:hover:-translate-y-0.5 lg:transition-all lg:duration-300"
          >
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-sm font-bold flex items-center gap-2 text-gray-800">
                <Banknote size={16} className="text-gray-400" />
                Total Cartões de Crédito
              </h3>
              <ChevronRight size={16} className="text-gray-300 group-hover:text-blue-500 transition-colors" />
            </div>
            <div className="space-y-4">
              <div className="p-5 bg-gray-50 border border-gray-100 rounded-2xl flex flex-col justify-center lg:rounded-2xl lg:bg-gradient-to-br lg:from-gray-50 lg:to-gray-100/60 lg:border-gray-200/50 lg:shadow-inner">
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
                className="w-full bg-gray-900 text-white font-bold py-3.5 rounded-2xl hover:bg-black transition shadow-md text-xs uppercase tracking-widest lg:rounded-2xl lg:shadow-md lg:shadow-gray-900/20 lg:hover:shadow-lg lg:hover:-translate-y-0.5"
              >
                Sincronizar Banco
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 2. VISUALIZAÇÃO MOBILE (block md:hidden - REDESIGN FIEL)     */}
      {/* ============================================================ */}
      <div className="block md:hidden -mx-6 -mt-6 -mb-6 sm:mx-auto">
        {/* Mobile Frame Container */}
        <div className="w-full max-w-[412px] mx-auto bg-[#f8fafc] rounded-none sm:rounded-[40px] shadow-2xl overflow-hidden relative flex flex-col">
          
          {/* Scrollable Content Area */}
          <div className="flex-1 pb-24 no-scrollbar">
            
            {/* Top Elegant Header Section (Cor Azul do Sistema) */}
            <div className="bg-gradient-to-br from-[#121926] via-[#1a2333] to-[#0f172a] text-white pt-[calc(env(safe-area-inset-top,0px)+3rem)] pb-16 px-6 rounded-b-[36px] relative shadow-lg">
              
              {/* User Profile & Top Action Icons */}
              <div className="flex justify-between items-center mb-6 relative z-10">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-[#1e293b]/80 backdrop-blur-md flex items-center justify-center border border-[#334155]/60 shadow-inner flex-shrink-0">
                    <Box size={16} className="text-[#84cc16]" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-300 font-medium">{greeting}</p>
                    <h2 className="text-sm font-bold text-white tracking-wide truncate max-w-[180px]">Mathews e Débora</h2>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button 
                    onClick={() => refresh()}
                    title="Atualizar"
                    className="w-9 h-9 rounded-full bg-[#1e293b]/80 backdrop-blur-md flex items-center justify-center text-gray-200 hover:bg-[#334155] transition shadow-sm border border-[#334155]/40"
                  >
                    <Moon size={14} />
                  </button>
                  <button 
                    onClick={() => setShowCardsModal(true)}
                    title="Notificações / Detalhes"
                    className="w-9 h-9 rounded-full bg-[#1e293b]/80 backdrop-blur-md flex items-center justify-center text-gray-200 hover:bg-[#334155] transition shadow-sm relative border border-[#334155]/40"
                  >
                    <Bell size={14} />
                    <span className="absolute top-2 right-2 w-2 h-2 bg-[#84cc16] rounded-full animate-pulse"></span>
                  </button>
                </div>
              </div>

              {/* Total Balance Section with Toggle Eye (Universal Hide, Hidden by Default, Zero Cache) */}
              <div className="mb-6 relative z-10">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-xs text-gray-300 font-medium tracking-wide">Saldo do Mês</p>
                    <button
                      type="button"
                      onClick={() => setMostrarValores(prev => !prev)}
                      className="text-gray-400 hover:text-white transition p-1 rounded-lg hover:bg-white/10 active:scale-95 focus:outline-none flex items-center justify-center cursor-pointer"
                      title={mostrarValores ? "Ocultar todos os valores do Dashboard" : "Exibir todos os valores do Dashboard"}
                      aria-label={mostrarValores ? "Ocultar todos os valores do Dashboard" : "Exibir todos os valores do Dashboard"}
                    >
                      {mostrarValores ? (
                        <Eye size={15} className="text-blue-200" />
                      ) : (
                        <EyeOff size={15} className="text-gray-400" />
                      )}
                    </button>
                  </div>
                  <h1 className="text-3xl font-extrabold tracking-tight select-none">
                    {mostrarValores ? formatCurrency(totals.balance) : 'R$ ••••••••'}
                  </h1>
                </div>
              </div>

              {/* Action Buttons (Despesas, Receitas, More) with Tactile & Neon Gloss Effects */}
              <div className="grid grid-cols-12 gap-3 relative z-10">
                {/* Despesas Button */}
                <button 
                  type="button" 
                  onClick={() => onNavigate?.('expenses')}
                  className="col-span-5 btn-expense py-3 px-2 rounded-2xl flex items-center justify-center space-x-1.5 text-white font-bold text-xs transition active:scale-95 cursor-pointer select-none"
                >
                  <ArrowDownRight size={14} className="text-red-100 flex-shrink-0" />
                  <span className="truncate">Despesas</span>
                </button>

                {/* Receitas Button with Vibrant Neon Glow & Gloss */}
                <button 
                  type="button" 
                  onClick={() => onNavigate?.('revenue')}
                  className="col-span-5 btn-revenue py-3 px-2 rounded-2xl flex items-center justify-center space-x-1.5 text-slate-950 font-extrabold text-xs transition active:scale-95 cursor-pointer select-none"
                >
                  <ArrowUpRight size={14} className="text-slate-950 flex-shrink-0" />
                  <span className="truncate">Receitas</span>
                </button>

                {/* More Options Button (Glass) */}
                <button 
                  type="button" 
                  onClick={() => onToggleMenu ? onToggleMenu() : onNavigate?.('gastos')}
                  className="col-span-2 glass-btn py-3 rounded-2xl flex items-center justify-center text-blue-200 hover:text-white transition active:scale-95 cursor-pointer select-none"
                  title="Mais Opções"
                >
                  <MoreVertical size={16} />
                </button>
              </div>
            </div>

            {/* Main White Card Container (Overlap) */}
            <div className="px-6 -mt-8 relative z-10">
              <div className="bg-white rounded-[32px] p-6 shadow-xl border border-gray-100/80">
                <h3 className="text-sm font-bold text-gray-900 mb-5">Categorias</h3>
                
                {/* Categories Grid (Cartões, Parcelas, Calculadora) */}
                <div className="grid grid-cols-3 gap-y-6 gap-x-2 text-center justify-center">
                  
                  {/* Item 1: Cartões */}
                  <div 
                    onClick={() => onNavigate?.('banks')}
                    className="flex flex-col items-center group cursor-pointer active:scale-95 transition"
                  >
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 text-[#121926] flex items-center justify-center mb-1.5 shadow-sm group-hover:bg-slate-200 border border-slate-200/60 transition transform group-hover:scale-105">
                      <CreditCard size={20} className="text-slate-800" />
                    </div>
                    <span className="text-xs font-semibold text-gray-700">Cartões</span>
                  </div>

                  {/* Item 2: Parcelas */}
                  <div 
                    onClick={() => onNavigate?.('installments')}
                    className="flex flex-col items-center group cursor-pointer active:scale-95 transition"
                  >
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 text-[#121926] flex items-center justify-center mb-1.5 shadow-sm group-hover:bg-slate-200 border border-slate-200/60 transition transform group-hover:scale-105">
                      <FileText size={20} className="text-slate-800" />
                    </div>
                    <span className="text-xs font-semibold text-gray-700">Parcelas</span>
                  </div>

                  {/* Item 3: Calculadora */}
                  <div 
                    onClick={() => onNavigate?.('calculator')}
                    className="flex flex-col items-center group cursor-pointer active:scale-95 transition"
                  >
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 text-[#121926] flex items-center justify-center mb-1.5 shadow-sm group-hover:bg-slate-200 border border-slate-200/60 transition transform group-hover:scale-105">
                      <CalcIcon size={20} className="text-slate-800" />
                    </div>
                    <span className="text-xs font-semibold text-gray-700">Calculadora</span>
                  </div>

                </div>
              </div>
            </div>

            {/* Container Principal Responsivo */}
            <div className="px-4 my-3 w-full">
              <div className="bg-slate-200/60 p-1.5 rounded-xl shadow-lg flex items-center gap-1.5 w-full max-w-[340px] relative mx-auto my-3">
                {/* Botão: Mês Ativo Corrente (Dinâmico) */}
                <button 
                  type="button" 
                  onClick={() => onSelectMonth?.(effectiveActiveMonth)}
                  className={`flex-1 py-2.5 px-4 rounded-lg flex flex-col items-center justify-center transition-all duration-300 focus:outline-none cursor-pointer ${
                    isCurrentActive
                      ? 'bg-white border border-emerald-400 shadow-sm'
                      : 'bg-transparent border border-transparent hover:bg-slate-300/40'
                  }`}
                >
                  <span className={`text-xs uppercase leading-tight tracking-tight ${
                    isCurrentActive ? 'font-extrabold text-slate-800' : 'font-bold text-slate-400'
                  }`}>
                    {effectiveActiveMonth.nome}
                  </span>
                  <span className={`text-[11px] leading-tight ${
                    isCurrentActive ? 'font-bold text-slate-600' : 'font-semibold text-slate-400'
                  }`}>
                    {effectiveActiveMonth.ano}
                  </span>
                </button>

                {/* Botão: Mês Seguinte / Planejamento (Dinâmico) */}
                <button 
                  type="button" 
                  onClick={() => onSelectMonth?.(effectiveNextMonth)}
                  className={`flex-1 py-2.5 px-4 rounded-lg flex flex-col items-center justify-center transition-all duration-300 focus:outline-none cursor-pointer ${
                    isCurrentNext
                      ? 'bg-white border border-emerald-400 shadow-sm'
                      : 'bg-transparent border border-transparent hover:bg-slate-300/40'
                  }`}
                >
                  <span className={`text-xs uppercase leading-tight tracking-tight ${
                    isCurrentNext ? 'font-extrabold text-slate-800' : 'font-bold text-slate-400'
                  }`}>
                    {effectiveNextMonth.nome}
                  </span>
                  <span className={`text-[11px] leading-tight ${
                    isCurrentNext ? 'font-bold text-slate-600' : 'font-semibold text-slate-400'
                  }`}>
                    {effectiveNextMonth.ano}
                  </span>
                </button>
              </div>
            </div>

            {/* Totais Cartões de Crédito Section (DADOS REAIS COM CARROSSEL) */}
            <div className="px-6 mb-4">
              <div className="bg-gradient-to-br from-white to-slate-50 rounded-[28px] p-6 shadow-sm border border-gray-100 text-center relative">
                
                {/* Cabeçalho do Cartão Selecionado */}
                <div className="flex items-center justify-between mb-2">
                  <span 
                    className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full text-white shadow-xs" 
                    style={{ backgroundColor: currentCard.cor }}
                  >
                    {currentCard.nome}
                  </span>
                  <button 
                    onClick={() => setShowCardsModal(true)}
                    className="text-[10px] text-gray-400 font-bold uppercase tracking-widest hover:text-gray-700"
                  >
                    {activeCardIndex + 1} de {cardsList.length} · Ver todos
                  </button>
                </div>

                <h3 className="text-xl font-black text-gray-900 mb-1 leading-tight">
                  Totais Cartões de Crédito
                </h3>
                <p className="text-xs text-gray-400 font-medium tracking-tight mb-4">
                  Fatura Atual · Vencimento · Limite
                </p>

                {/* Grid com Dados Reais da Fatura, Vencimento e Limite */}
                <div className="grid grid-cols-3 gap-2 py-3 px-2 bg-slate-100/70 rounded-2xl mb-4 text-center border border-slate-200/40">
                  <div>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Fatura Atual</p>
                    <p className="text-xs font-black text-gray-900 truncate">
                      {mostrarValores ? formatCurrency(currentCard.fatura) : 'R$ ••••••••'}
                    </p>
                  </div>
                  <div className="border-x border-slate-200/80 px-1">
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Vencimento</p>
                    <p className="text-xs font-black text-gray-800 truncate">{currentCard.vencimento}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Limite Disp.</p>
                    <p className="text-xs font-black text-emerald-600 truncate">
                      {mostrarValores ? formatCurrency(Math.max(0, currentCard.limiteTotal - currentCard.fatura)) : 'R$ ••••••••'}
                    </p>
                  </div>
                </div>

                {/* Barra Visual de Consumo do Limite */}
                <div className="w-full bg-gray-200/70 h-1.5 rounded-full overflow-hidden mb-5">
                  <div 
                    className="h-full bg-gray-900 rounded-full transition-all duration-500" 
                    style={{ 
                      width: mostrarValores ? `${Math.min(100, currentCard.limiteTotal > 0 ? (currentCard.fatura / currentCard.limiteTotal) * 100 : 0)}%` : '0%' 
                    }} 
                  />
                </div>
                
                {/* Carousel Pagination Dots */}
                <div className="flex justify-center items-center space-x-1.5">
                  {cardsList.map((_, dotIdx) => (
                    <button
                      key={dotIdx}
                      onClick={() => setActiveCardIndex(dotIdx)}
                      className={`transition-all duration-300 ${
                        dotIdx === activeCardIndex 
                          ? 'w-6 h-1.5 bg-[#121926] rounded-full' 
                          : 'w-1.5 h-1.5 bg-gray-300 rounded-full hover:bg-gray-400'
                      }`}
                      title={`Cartão ${dotIdx + 1}`}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* 1 & 2. Cards de Totais: Receitas Totais e Despesas Totais */}
            <div className="px-6 mb-4">
              <div className="grid grid-cols-2 gap-3">
                {/* Receitas Totais */}
                <div 
                  onClick={() => onNavigate?.('revenue')}
                  className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-between active:scale-95 transition cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-8 h-8 rounded-xl bg-green-50 text-green-600 flex items-center justify-center border border-green-100/60">
                      <TrendingUp size={16} />
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-wider text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                      Entradas
                    </span>
                  </div>
                  <div className="mt-3">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Receitas Totais</p>
                    <h3 className="text-base font-black text-gray-900 truncate">
                      {mostrarValores ? formatCurrency(totals.revenue) : 'R$ ••••••••'}
                    </h3>
                  </div>
                </div>

                {/* Despesas Totais */}
                <div 
                  onClick={() => onNavigate?.('expenses')}
                  className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-between active:scale-95 transition cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-8 h-8 rounded-xl bg-red-50 text-red-600 flex items-center justify-center border border-red-100/60">
                      <TrendingDown size={16} />
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-wider text-red-700 bg-red-50 px-2 py-0.5 rounded-full">
                      Saídas
                    </span>
                  </div>
                  <div className="mt-3">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Despesas Totais</p>
                    <h3 className="text-base font-black text-gray-900 truncate">
                      {mostrarValores ? formatCurrency(totals.expenses) : 'R$ ••••••••'}
                    </h3>
                  </div>
                </div>
              </div>
            </div>

            {/* 3 & 4. Cards de Evolução Financeira com Gráficos */}
            <div className="px-6 space-y-4 mb-0 overflow-x-hidden">
              <CompactChart 
                title="Evolução das Receitas (Últimos 4 meses)"
                data={evolutionData}
                dataKey="receitas"
                colorTheme="green"
                formatCurrency={formatCurrency}
                mostrarValores={mostrarValores}
              />
              <CompactChart 
                title="Evolução das Despesas (Últimos 4 meses)"
                data={evolutionData}
                dataKey="despesas"
                colorTheme="red"
                formatCurrency={formatCurrency}
                mostrarValores={mostrarValores}
              />
            </div>

          </div>

        </div>
      </div>

      {/* ============================================================ */}
      {/* 3. MODAL DE DETALHAMENTO DE CARTÕES (COMPARTILHADO)          */}
      {/* ============================================================ */}
      {showCardsModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
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
                    <span className="text-xs font-black text-gray-900">
                      {mostrarValores ? formatCurrency(bank.valor) : 'R$ ••••••••'}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="pt-4 border-t border-gray-100">
              <div className="flex justify-between items-center p-4 bg-gray-900 rounded-2xl text-white">
                <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">Total Faturas</span>
                <span className="text-base font-black tracking-tight">
                  {mostrarValores ? formatCurrency(totals.cards) : 'R$ ••••••••'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Overview;
