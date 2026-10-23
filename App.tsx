
import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Receipt, 
  TrendingUp, 
  Banknote, 
  LockKeyhole, 
  Menu, 
  Wallet,
  RefreshCw,
  CalendarClock,
  Plus,
  Clock,
  CalendarDays,
  Calculator as CalcIcon,
  ShoppingBag,
  ChevronUp,
  FileText
} from 'lucide-react';
import { supabaseClient } from './services/supabase';
import { Month } from './types';
import Overview from './components/Overview';
import Gastos from './components/Gastos';
import Expenses from './components/Expenses';
import Revenue from './components/Revenue';
import Banks from './components/Banks';
import Closing from './components/Closing';
import Installments from './components/Installments';
import Calculator from './components/Calculator';

const App: React.FC = () => {
  const [view, setView] = useState<string>('overview');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeMonth, setActiveMonth] = useState<Month | null>(null);
  const [provisionMonth, setProvisionMonth] = useState<Month | null>(null);
  const [currentContextMonth, setCurrentContextMonth] = useState<Month | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [triggerAdd, setTriggerAdd] = useState(0);


  const viewNames: Record<string, string> = {
    overview: 'Dashboard',
    gastos: 'Gastos',
    expenses: 'Despesas',
    revenue: 'Receitas',
    banks: 'Cartões',
    installments: 'Parcelas',
    closing: 'Arquivo',
    calculator: 'Calculadora'
  };

  useEffect(() => {
    init();
    if (window.location.pathname === '/calculadora') {
      setView('calculator');
    } else if (window.location.pathname === '/gastos') {
      setView('gastos');
    }
  }, []);

  const getMonthValue = (m: Month) => {
    const months = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];
    return m.ano * 100 + months.indexOf(m.nome.toUpperCase());
  };

  const init = async () => {
    setLoading(true);
    try {
      // Busca todos os meses
      const { data: meses, error } = await supabaseClient
        .from('meses')
        .select('*')
        .order('ano', { ascending: false });

      if (error) {
        console.error("Erro crítico ao buscar meses:", error.message);
        throw error;
      }

      // Lógica aprimorada para identificar o mês ativo real
      // Se houver múltiplos 'ativo', o de menor data é o atual (ex: Dez 2025), e o maior é planejamento (Jan 2026)
      const activeMonths = meses?.filter(m => m.status === 'ativo') || [];
      activeMonths.sort((a, b) => getMonthValue(a) - getMonthValue(b)); // Ordena ASC (mais antigo primeiro)

      let active = activeMonths.length > 0 ? activeMonths[0] : null;
      let planning = activeMonths.length > 1 ? activeMonths[1] : null;

      // Se não houver mês ativo, inicializa com DEZEMBRO/2025 (Fallback)
      if (!meses || meses.length === 0 || !active) {
        console.warn("Nenhum mês ativo encontrado. Tentando criar fallback DEZEMBRO 2025.");
        const { data, error: insertError } = await supabaseClient
          .from('meses')
          .insert([{ nome: 'DEZEMBRO', ano: 2025, status: 'ativo' }])
          .select()
          .single();
        
        if (insertError) console.error("Erro ao criar mês fallback:", insertError.message);
        active = data;
      }

      // Lógica de Provisionamento (Próximo Mês)
      if (active) {
        const meses_nomes = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];
        
        const currentName = active.nome.trim().toUpperCase();
        const idx = meses_nomes.indexOf(currentName);
        
        if (idx !== -1) {
          const nextIdx = (idx + 1) % 12;
          const nextYear = idx === 11 ? active.ano + 1 : active.ano;
          const nextMonthName = meses_nomes[nextIdx];
          
          // Se já identificamos um 'ativo' futuro, ele é o planejamento
          let prov = planning;

          // Se não, procura por 'provisionamento'
          if (!prov) {
             prov = meses?.find(m => m.nome.trim().toUpperCase() === nextMonthName && m.ano === nextYear && m.status === 'provisionamento');
          }

          // Se ainda não achou, verifica no banco ou cria
          if (!prov) {
            const { data: existing, error: searchError } = await supabaseClient
              .from('meses')
              .select('*')
              .eq('nome', nextMonthName)
              .eq('ano', nextYear)
              .maybeSingle(); 

            if (existing) {
              prov = existing;
            } else {
              // Tenta criar como 'provisionamento'
              // Se o banco bloquear (check constraint), tenta como 'ativo'
              try {
                const { data: newProv, error: createError } = await supabaseClient
                  .from('meses')
                  .insert([{ nome: nextMonthName, ano: nextYear, status: 'provisionamento' }])
                  .select()
                  .single();
                
                if (createError) throw createError;
                prov = newProv;
              } catch (err: any) {
                // Check constraint error code: 23514 (Postgres) or specific message
                if (err.message && (err.message.includes('check constraint') || err.message.includes('meses_status_check'))) {
                  console.warn("Banco não aceita 'provisionamento'. Criando como 'ativo' (fallback de compatibilidade).");
                  const { data: newProvAtivo, error: createErrorAtivo } = await supabaseClient
                    .from('meses')
                    .insert([{ nome: nextMonthName, ano: nextYear, status: 'ativo' }])
                    .select()
                    .single();
                  
                  if (createErrorAtivo) {
                     console.error("Falha fatal ao criar mês:", createErrorAtivo.message);
                      // Fallback visual extremo (apenas memória) para não quebrar UI
                      prov = {
                        id: -1,
                        nome: nextMonthName,
                        ano: nextYear,
                        status: 'provisionamento',
                        saldo_final: 0,
                        criado_em: new Date().toISOString()
                      } as Month;
                  } else {
                    prov = newProvAtivo;
                  }
                } else {
                   // Outro erro (RLS real, conexão, etc)
                   console.error("Erro desconhecido ao criar mês:", err.message);
                }
              }
            }
          }
          
          setActiveMonth(active);
          setProvisionMonth(prov || null);
          
          // Gerencia o contexto atual
          if (!currentContextMonth || (currentContextMonth.id !== active.id && currentContextMonth.id !== prov?.id && currentContextMonth.status !== 'fechado')) {
            setCurrentContextMonth(active);
          }
        }
      }
    } catch (error: any) {
      console.error("Erro na inicialização:", error.message || error);
    } finally {
      setLoading(false);
    }
  };

  const handleGlobalRefresh = () => {
    setRefreshKey(prev => prev + 1);
    init();
  };

  const handleNavigate = (newView: string) => {
    setView(newView);
    setTriggerAdd(0); // Reseta gatilhos de adição ao navegar entre menus
    setIsSidebarOpen(false);
    
    // Atualiza a URL para suporte básico a rotas (opcional, mas solicitado pelo usuário)
    const path = newView === 'calculator' ? '/calculadora' : newView === 'gastos' ? '/gastos' : '/';
    window.history.pushState({}, '', path);
  };

  const handleContextChange = (month: Month) => {
    if (month.id === -1) {
      console.warn("Atenção: Este é um mês de visualização (não salvo no banco).");
    }
    // White Label Reset: Força a limpeza de todo o estado mudando a key dos componentes
    setCurrentContextMonth(month);
    setTriggerAdd(0); // Reseta gatilhos de adição ao trocar o contexto mensal
    setRefreshKey(prev => prev + 1);
  };

  const onAddClick = () => {
    if (currentContextMonth?.id === -1) {
      console.warn("Não é possível adicionar registros em um mês de visualização.");
      return;
    }
    setTriggerAdd(prev => prev + 1);
  };

  if (loading || !currentContextMonth) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#F8F9FA]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-14 w-14 animate-spin rounded-full border-[5px] border-gray-900 border-t-transparent"></div>
          <p className="font-black text-gray-400 uppercase tracking-[0.2em] text-[10px]">Carregando Contexto...</p>
        </div>
      </div>
    );
  }

  const showAddAction = ['expenses', 'revenue', 'installments', 'banks', 'gastos'].includes(view);
  const canEdit = currentContextMonth.status !== 'fechado';

  return (
    <div className="flex h-screen bg-[#F8F9FA] overflow-hidden text-gray-900">
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-md z-30 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}
      {/* Navegação Lateral */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-full lg:w-72 bg-gray-900 border-r border-gray-950 lg:border-r-0 lg:shadow-[4px_0_24px_rgba(0,0,0,0.18)] transform transition-transform duration-500 ease-in-out lg:relative lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full p-6 lg:pt-8 lg:pb-8 lg:pl-6 lg:pr-0 overflow-y-auto overflow-x-hidden no-scrollbar">
          <div className="flex items-center justify-between lg:justify-start gap-4 mb-8 lg:mb-12 lg:pr-6">
            <div className="flex items-center gap-4">
              <div className="bg-white text-gray-900 p-3 rounded-[1.2rem] lg:rounded-2xl shadow-xl lg:shadow-lg lg:border lg:border-white/20">
                <Wallet size={24} />
              </div>
              <div>
                <span className="text-2xl font-black tracking-tighter uppercase block leading-none text-white">M&D</span>
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Finanças</span>
              </div>
            </div>
            {/* Botão de fechar no mobile */}
            <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2 text-white hover:text-gray-300">
              <Plus size={28} className="rotate-45" />
            </button>
          </div>

          <nav className="flex-1 space-y-8">
            <div>
              <p className="text-[10px] font-black text-gray-400/60 uppercase tracking-[0.2em] mb-4 ml-3 lg:pr-6">Principal</p>
              <div className="grid grid-cols-2 lg:grid-cols-1 gap-2 lg:gap-3">
                <NavItem icon={<LayoutDashboard size={20} />} label="Dashboard" active={view === 'overview'} onClick={() => handleNavigate('overview')} />
                <NavItem icon={<ShoppingBag size={20} />} label="Gastos" active={view === 'gastos'} onClick={() => handleNavigate('gastos')} />
                <NavItem icon={<Receipt size={20} />} label="Despesas" active={view === 'expenses'} onClick={() => handleNavigate('expenses')} />
                <NavItem icon={<TrendingUp size={20} />} label="Receitas" active={view === 'revenue'} onClick={() => handleNavigate('revenue')} />
              </div>
            </div>
            
            <div>
              <p className="text-[10px] font-black text-gray-400/60 uppercase tracking-[0.2em] mb-4 ml-3 lg:pr-6">Gestão</p>
              <div className="grid grid-cols-2 lg:grid-cols-1 gap-2 lg:gap-3">
                <NavItem icon={<Banknote size={20} />} label="Cartões" active={view === 'banks'} onClick={() => handleNavigate('banks')} />
                <NavItem icon={<CalendarClock size={20} />} label="Parcelas" active={view === 'installments'} onClick={() => handleNavigate('installments')} />
              </div>
            </div>
            
            <div>
              <p className="text-[10px] font-black text-gray-400/60 uppercase tracking-[0.2em] mb-4 ml-3 lg:pr-6">Extras</p>
              <div className="grid grid-cols-2 lg:grid-cols-1 gap-2 lg:gap-3">
                <NavItem icon={<Clock size={20} />} label="Arquivo" active={view === 'closing'} onClick={() => handleNavigate('closing')} />
                <NavItem icon={<CalcIcon size={20} />} label="Calculadora" active={view === 'calculator'} onClick={() => handleNavigate('calculator')} />
              </div>
            </div>
          </nav>
        </div>
      </aside>

      {/* Área Principal */}
      <main className="flex-1 overflow-y-auto relative no-scrollbar">
        {/* HEADER LINHA DO TEMPO (Visível no topo para todas as telas, exceto no Dashboard Mobile que possui header próprio) */}
        <div className={`${view === 'overview' ? 'hidden md:block' : 'block'} sticky top-0 z-20 bg-white/90 backdrop-blur-xl border-b border-gray-100 lg:border-gray-200/70 lg:shadow-sm px-6 py-4 lg:px-12 lg:py-6`}>
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
            
            {/* Context Switcher (Timeline Header) */}
            <div className="w-full sm:flex-1 flex items-center justify-between gap-2 bg-gray-100/50 p-2 rounded-[2rem] lg:rounded-3xl border border-gray-200/50 lg:border-gray-200/80 lg:shadow-inner">
              {activeMonth && (
                <button 
                  onClick={() => handleContextChange(activeMonth)}
                  className={`flex flex-col items-center justify-center min-w-[140px] px-6 py-2.5 rounded-[1.5rem] lg:rounded-2xl transition-all duration-300 ${
                    currentContextMonth.id === activeMonth.id 
                    ? 'bg-white shadow-xl shadow-gray-200 border border-green-100 lg:shadow-md lg:shadow-green-900/5 lg:border-green-200/60' 
                    : 'opacity-40 hover:opacity-100 hover:bg-white/50'
                  }`}
                >
                  <span className={`text-[9px] font-black uppercase tracking-widest ${currentContextMonth.id === activeMonth.id ? 'text-green-600' : 'text-gray-400'}`}>
                    Ativo
                  </span>
                  <span className="text-sm font-black text-gray-800 uppercase leading-none mt-1">
                    {activeMonth.nome} {activeMonth.ano}
                  </span>
                </button>
              )}

              {/* Renderiza o botão de planejamento se o mês existir ou for virtual */}
              {provisionMonth ? (
                <button 
                  onClick={() => handleContextChange(provisionMonth)}
                  className={`flex flex-col items-center justify-center min-w-[140px] px-6 py-2.5 rounded-[1.5rem] lg:rounded-2xl transition-all duration-300 ${
                    currentContextMonth.id === provisionMonth.id 
                    ? 'bg-white shadow-xl shadow-gray-200 border border-blue-100 lg:shadow-md lg:shadow-blue-900/5 lg:border-blue-200/60' 
                    : 'opacity-40 hover:opacity-100 hover:bg-white/50'
                  }`}
                >
                  <span className={`text-[9px] font-black uppercase tracking-widest ${currentContextMonth.id === provisionMonth.id ? 'text-blue-600' : 'text-gray-400'}`}>
                    Planejamento
                  </span>
                  <span className="text-sm font-black text-gray-800 uppercase leading-none mt-1">
                    {provisionMonth.nome} {provisionMonth.ano}
                  </span>
                  {/* Indicador Visual se for mês virtual (erro de persistência) */}
                  {provisionMonth.id === -1 && (
                    <span className="absolute top-1 right-1 h-2 w-2 bg-amber-500 rounded-full animate-pulse" title="Visualização apenas (Erro de Permissão)"></span>
                  )}
                </button>
              ) : (
                <div className="min-w-[140px] flex items-center justify-center">
                  <span className="text-[9px] text-gray-300 font-bold uppercase tracking-widest animate-pulse">
                    Sincronizando...
                  </span>
                </div>
              )}
            </div>

            {/* Ações Globais */}
            <div className="w-full sm:w-auto flex items-center gap-2">
              {/* Menu Selector (Mobile Only) */}
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className="lg:hidden flex-1 flex items-center justify-between bg-gray-900 text-white px-5 py-3.5 rounded-2xl shadow-xl active:scale-95 transition-all"
              >
                <span className="text-[10px] font-black uppercase tracking-[0.2em] truncate mr-2">
                  {viewNames[view] || view}
                </span>
                <Menu size={18} />
              </button>

              {showAddAction && canEdit && (
                <button 
                  onClick={onAddClick}
                  className={`p-3.5 lg:p-4 rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition-all lg:rounded-2xl lg:shadow-md lg:shadow-gray-900/20 lg:hover:shadow-lg lg:hover:-translate-y-0.5 ${
                     currentContextMonth.id === -1 ? 'bg-gray-300 cursor-not-allowed text-gray-500' : 'bg-gray-900 text-white'
                  }`}
                  title={currentContextMonth.id === -1 ? "Indisponível em modo visualização" : "Novo Lançamento"}
                  disabled={currentContextMonth.id === -1}
                >
                  <Plus size={20} className="lg:w-[22px] lg:h-[22px]" />
                </button>
              )}
              <button 
                onClick={handleGlobalRefresh}
                className="p-3.5 lg:p-4 bg-white border border-gray-200 rounded-2xl text-gray-400 hover:text-gray-900 transition-all shadow-sm active:scale-95 lg:rounded-2xl lg:shadow-sm lg:hover:shadow-md lg:hover:-translate-y-0.5"
              >
                <RefreshCw size={18} className="lg:w-[22px] lg:h-[22px]" />
              </button>
            </div>
          </div>
        </div>

        {/* CONTEÚDO DINÂMICO (White Label Isolado por Mês) */}
        <div className={`p-6 lg:p-12 max-w-6xl mx-auto ${view === 'overview' ? 'pb-0 md:pb-12' : 'pb-12'}`}>

          {/* Alerta de Mês Fechado ou Virtual */}
          {currentContextMonth.status === 'fechado' && (
            <div className="mb-10 bg-amber-50 border border-amber-200/50 p-6 rounded-[2rem] lg:rounded-3xl flex items-center gap-4 text-amber-800 shadow-sm animate-in fade-in slide-in-from-top-4">
              <div className="bg-amber-100 p-3 rounded-2xl"><LockKeyhole size={24} /></div>
              <div>
                <p className="text-sm font-black uppercase tracking-tighter">Histórico (Modo Leitura)</p>
                <p className="text-[11px] font-bold opacity-70 uppercase tracking-widest">Este ciclo foi encerrado. Novos dados não podem ser adicionados.</p>
              </div>
            </div>
          )}

          {currentContextMonth.id === -1 && (
             <div className="mb-10 bg-red-50 border border-red-200/50 p-6 rounded-[2rem] lg:rounded-3xl flex items-center gap-4 text-red-800 shadow-sm animate-in fade-in slide-in-from-top-4">
               <div className="bg-red-100 p-3 rounded-2xl"><LockKeyhole size={24} /></div>
               <div>
                 <p className="text-sm font-black uppercase tracking-tighter">Modo de Visualização (Sem Persistência)</p>
                 <p className="text-[11px] font-bold opacity-70 uppercase tracking-widest">Não foi possível criar este mês no banco de dados. Você está vendo uma versão temporária.</p>
               </div>
             </div>
          )}

          {/* Renderização Condicional com Reset de State via Key */}
          {view === 'overview' && (
            <Overview 
              key={`ov-${refreshKey}-${currentContextMonth.id}`} 
              currentMonth={currentContextMonth} 
              activeMonth={activeMonth}
              provisionMonth={provisionMonth}
              onSelectMonth={handleContextChange}
              refresh={handleGlobalRefresh}
              onNavigate={handleNavigate}
              onToggleMenu={() => setIsMobileMenuOpen(prev => !prev)}
            />
          )}
          {view === 'gastos' && <Gastos key={`gst-${refreshKey}-${currentContextMonth.id}`} currentMonth={currentContextMonth} triggerAdd={triggerAdd} />}
          {view === 'expenses' && <Expenses key={`ex-${refreshKey}-${currentContextMonth.id}`} currentMonth={currentContextMonth} triggerAdd={triggerAdd} />}
          {view === 'revenue' && <Revenue key={`rv-${refreshKey}-${currentContextMonth.id}`} currentMonth={currentContextMonth} triggerAdd={triggerAdd} />}
          {view === 'banks' && <Banks key={`bk-${refreshKey}-${currentContextMonth.id}`} currentMonth={currentContextMonth} triggerAdd={triggerAdd} />}
          {view === 'installments' && <Installments key={`in-${refreshKey}-${currentContextMonth.id}`} currentMonth={currentContextMonth} triggerAdd={triggerAdd} />}
          {view === 'closing' && <Closing key={`cl-${refreshKey}`} currentMonth={activeMonth!} onSelectMonth={handleContextChange} onRefresh={init} />}
          {view === 'calculator' && <Calculator key="calculator" />}
        </div>

        {/* ============================================================ */}
        {/* NAVBAR INFERIOR EXCLUSIVA DO DASHBOARD MOBILE                */}
        {/* ============================================================ */}
        {view === 'overview' && (
          <div className="block md:hidden fixed bottom-5 left-4 right-4 z-40 max-w-[412px] mx-auto pointer-events-auto">
          {/* Dropdown retrátil de menus reais */}
          {isMobileMenuOpen && (
            <div className="mb-2 bg-[#121926]/95 backdrop-blur-xl rounded-2xl p-2 shadow-2xl border border-[#334155]/60 flex flex-col space-y-1 text-white animate-in slide-in-from-bottom-3 duration-200">
              <button 
                onClick={() => { handleNavigate('overview'); setIsMobileMenuOpen(false); }} 
                className={`flex items-center space-x-3 px-4 py-2.5 rounded-xl font-medium text-xs transition ${
                  view === 'overview' ? 'bg-[#1e293b] text-[#84cc16]' : 'text-gray-200 hover:bg-[#1e293b]'
                }`}
              >
                <LayoutDashboard size={14} className="w-4 text-center" />
                <span>Dashboard</span>
              </button>
              <button 
                onClick={() => { handleNavigate('gastos'); setIsMobileMenuOpen(false); }} 
                className={`flex items-center space-x-3 px-4 py-2.5 rounded-xl font-medium text-xs transition ${
                  view === 'gastos' ? 'bg-[#1e293b] text-[#84cc16]' : 'text-gray-200 hover:bg-[#1e293b]'
                }`}
              >
                <ShoppingBag size={14} className="w-4 text-center" />
                <span>Gastos</span>
              </button>
              <button 
                onClick={() => { handleNavigate('expenses'); setIsMobileMenuOpen(false); }} 
                className={`flex items-center space-x-3 px-4 py-2.5 rounded-xl font-medium text-xs transition ${
                  view === 'expenses' ? 'bg-[#1e293b] text-[#84cc16]' : 'text-gray-200 hover:bg-[#1e293b]'
                }`}
              >
                <Receipt size={14} className="w-4 text-center" />
                <span>Despesas</span>
              </button>
              <button 
                onClick={() => { handleNavigate('revenue'); setIsMobileMenuOpen(false); }} 
                className={`flex items-center space-x-3 px-4 py-2.5 rounded-xl font-medium text-xs transition ${
                  view === 'revenue' ? 'bg-[#1e293b] text-[#84cc16]' : 'text-gray-200 hover:bg-[#1e293b]'
                }`}
              >
                <TrendingUp size={14} className="w-4 text-center" />
                <span>Receitas</span>
              </button>
              <button 
                onClick={() => { handleNavigate('banks'); setIsMobileMenuOpen(false); }} 
                className={`flex items-center space-x-3 px-4 py-2.5 rounded-xl font-medium text-xs transition ${
                  view === 'banks' ? 'bg-[#1e293b] text-[#84cc16]' : 'text-gray-200 hover:bg-[#1e293b]'
                }`}
              >
                <Banknote size={14} className="w-4 text-center" />
                <span>Cartões</span>
              </button>
              <button 
                onClick={() => { handleNavigate('installments'); setIsMobileMenuOpen(false); }} 
                className={`flex items-center space-x-3 px-4 py-2.5 rounded-xl font-medium text-xs transition ${
                  view === 'installments' ? 'bg-[#1e293b] text-[#84cc16]' : 'text-gray-200 hover:bg-[#1e293b]'
                }`}
              >
                <CalendarClock size={14} className="w-4 text-center" />
                <span>Parcelas</span>
              </button>
              <button 
                onClick={() => { handleNavigate('closing'); setIsMobileMenuOpen(false); }} 
                className={`flex items-center space-x-3 px-4 py-2.5 rounded-xl font-medium text-xs transition ${
                  view === 'closing' ? 'bg-[#1e293b] text-[#84cc16]' : 'text-gray-200 hover:bg-[#1e293b]'
                }`}
              >
                <Clock size={14} className="w-4 text-center" />
                <span>Arquivo</span>
              </button>
              <button 
                onClick={() => { handleNavigate('calculator'); setIsMobileMenuOpen(false); }} 
                className={`flex items-center space-x-3 px-4 py-2.5 rounded-xl font-medium text-xs transition ${
                  view === 'calculator' ? 'bg-[#1e293b] text-[#84cc16]' : 'text-gray-200 hover:bg-[#1e293b]'
                }`}
              >
                <CalcIcon size={14} className="w-4 text-center" />
                <span>Calculadora</span>
              </button>
            </div>
          )}

          {/* Botão Principal Flutuante com Gradiente */}
          <div 
            onClick={() => setIsMobileMenuOpen(prev => !prev)} 
            className="bg-gradient-to-r from-[#121926] via-[#1a2333] to-[#0f172a] py-4 px-6 rounded-full flex justify-between items-center shadow-2xl border border-[#334155]/50 cursor-pointer hover:opacity-95 transition active:scale-98"
          >
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-full bg-[#1e293b] flex items-center justify-center text-[#84cc16] shadow-sm">
                {view === 'overview' && <LayoutDashboard size={14} />}
                {view === 'gastos' && <ShoppingBag size={14} />}
                {view === 'expenses' && <Receipt size={14} />}
                {view === 'revenue' && <TrendingUp size={14} />}
                {view === 'banks' && <Banknote size={14} />}
                {view === 'installments' && <CalendarClock size={14} />}
                {view === 'closing' && <Clock size={14} />}
                {view === 'calculator' && <CalcIcon size={14} />}
              </div>
              <span className="text-white font-bold text-sm tracking-wide">{viewNames[view] || 'Dashboard'}</span>
            </div>
            <div className="text-gray-300 flex items-center space-x-2">
              <span className="text-[11px] bg-[#1e293b] px-2.5 py-1 rounded-full text-gray-200 font-medium">Menu</span>
              <ChevronUp 
                size={14} 
                className={`text-gray-300 transition-transform duration-300 ${isMobileMenuOpen ? 'rotate-180' : ''}`} 
              />
            </div>
          </div>
        </div>
      )}
      </main>
    </div>
  );
};

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}

const NavItem: React.FC<NavItemProps> = ({ icon, label, active, onClick }) => (
  <div className="relative">
    <button 
      onClick={onClick}
      className={`w-full flex flex-col lg:flex-row items-center lg:items-center lg:gap-4 px-4 py-4 lg:px-6 lg:py-4 rounded-2xl transition-all duration-300 font-bold ${
        active 
          ? 'bg-white text-gray-900 shadow-xl shadow-gray-950/40 lg:bg-[#F8F9FA] lg:text-gray-900 lg:shadow-none lg:rounded-l-2xl lg:rounded-r-none lg:mr-0' 
          : 'text-white hover:bg-white/10 hover:text-white lg:text-gray-400 lg:hover:text-white lg:hover:bg-white/5 lg:mr-6 lg:rounded-2xl'
      }`}
    >
      <span className={`${active ? 'text-gray-900' : 'text-white lg:text-gray-400 lg:group-hover:text-white'} mb-2 lg:mb-0 transition-colors`}>{icon}</span>
      <span className="uppercase tracking-widest text-[8px] lg:text-xs font-black text-center lg:text-left">{label}</span>
    </button>
    {/* Efeito de fusão visual com a tela de conteúdo (curvas côncavas) - Exclusivo Desktop */}
    {active && (
      <>
        {/* Curva côncava superior */}
        <svg className="hidden lg:block absolute -top-4 right-0 w-4 h-4 text-[#F8F9FA] pointer-events-none z-10" viewBox="0 0 16 16" fill="currentColor">
          <path d="M16 0 A 16 16 0 0 0 0 16 L 16 16 Z" />
        </svg>
        {/* Curva côncava inferior */}
        <svg className="hidden lg:block absolute -bottom-4 right-0 w-4 h-4 text-[#F8F9FA] pointer-events-none z-10" viewBox="0 0 16 16" fill="currentColor">
          <path d="M16 16 A 16 16 0 0 0 0 0 L 16 0 Z" />
        </svg>
      </>
    )}
  </div>
);

export default App;
