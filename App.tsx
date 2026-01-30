
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
  CalendarDays
} from 'lucide-react';
import { supabaseClient } from './services/supabase';
import { Month } from './types';
import Overview from './components/Overview';
import Expenses from './components/Expenses';
import Revenue from './components/Revenue';
import Banks from './components/Banks';
import Closing from './components/Closing';
import Installments from './components/Installments';

const App: React.FC = () => {
  const [view, setView] = useState<string>('overview');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeMonth, setActiveMonth] = useState<Month | null>(null);
  const [provisionMonth, setProvisionMonth] = useState<Month | null>(null);
  const [currentContextMonth, setCurrentContextMonth] = useState<Month | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [triggerAdd, setTriggerAdd] = useState(0);

  useEffect(() => {
    init();
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
  };

  const handleContextChange = (month: Month) => {
    if (month.id === -1) {
      alert("Atenção: Este é um mês de visualização (não salvo no banco). Verifique as permissões do sistema.");
    }
    // White Label Reset: Força a limpeza de todo o estado mudando a key dos componentes
    setCurrentContextMonth(month);
    setTriggerAdd(0); // Reseta gatilhos de adição ao trocar o contexto mensal
    setRefreshKey(prev => prev + 1);
  };

  const onAddClick = () => {
    if (currentContextMonth?.id === -1) {
      alert("Não é possível adicionar registros em um mês de visualização (erro de permissão na criação).");
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

  const showAddAction = ['expenses', 'revenue', 'installments', 'banks'].includes(view);
  const canEdit = currentContextMonth.status !== 'fechado';

  return (
    <div className="flex h-screen bg-[#F8F9FA] overflow-hidden text-gray-900">
      {/* Sidebar Mobile Toggle */}
      {!isSidebarOpen && (
        <button 
          className="fixed bottom-8 left-8 z-50 p-5 bg-gray-900 text-white rounded-[2rem] shadow-2xl lg:hidden active:scale-90 transition-transform"
          onClick={() => setIsSidebarOpen(true)}
        >
          <Menu size={24} />
        </button>
      )}

      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-md z-30 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* Navegação Lateral */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-72 bg-white border-r border-gray-100 transform transition-transform duration-500 ease-in-out lg:relative lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full p-8">
          <div className="flex items-center gap-4 mb-12">
            <div className="bg-gray-900 text-white p-3 rounded-[1.2rem] shadow-xl shadow-gray-200">
              <Wallet size={24} />
            </div>
            <div>
              <span className="text-2xl font-black tracking-tighter uppercase block leading-none">M&D</span>
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Finanças</span>
            </div>
          </div>

          <nav className="flex-1 space-y-3">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4 ml-3">Principal</p>
            <NavItem icon={<LayoutDashboard size={22} />} label="Dashboard" active={view === 'overview'} onClick={() => handleNavigate('overview')} />
            <NavItem icon={<Receipt size={22} />} label="Despesas" active={view === 'expenses'} onClick={() => handleNavigate('expenses')} />
            <NavItem icon={<TrendingUp size={22} />} label="Receitas" active={view === 'revenue'} onClick={() => handleNavigate('revenue')} />
            
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mt-10 mb-4 ml-3">Gestão</p>
            <NavItem icon={<Banknote size={22} />} label="Cartões" active={view === 'banks'} onClick={() => handleNavigate('banks')} />
            <NavItem icon={<CalendarClock size={22} />} label="Parcelas" active={view === 'installments'} onClick={() => handleNavigate('installments')} />
            
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mt-10 mb-4 ml-3">Histórico</p>
            <NavItem icon={<Clock size={22} />} label="Arquivo" active={view === 'closing'} onClick={() => handleNavigate('closing')} />
          </nav>
        </div>
      </aside>

      {/* Área Principal */}
      <main className="flex-1 overflow-y-auto relative no-scrollbar">
        {/* HEADER LINHA DO TEMPO */}
        <div className="sticky top-0 z-20 bg-white/90 backdrop-blur-xl border-b border-gray-100 px-6 py-4 lg:px-12 lg:py-6">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
            
            {/* Context Switcher (Timeline Header) */}
            <div className="w-full sm:flex-1 flex items-center justify-between gap-2 bg-gray-100/50 p-2 rounded-[2rem] border border-gray-200/50">
              {activeMonth && (
                <button 
                  onClick={() => handleContextChange(activeMonth)}
                  className={`flex flex-col items-center justify-center min-w-[140px] px-6 py-2.5 rounded-[1.5rem] transition-all duration-300 ${
                    currentContextMonth.id === activeMonth.id 
                    ? 'bg-white shadow-xl shadow-gray-200 border border-green-100' 
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
                  className={`flex flex-col items-center justify-center min-w-[140px] px-6 py-2.5 rounded-[1.5rem] transition-all duration-300 ${
                    currentContextMonth.id === provisionMonth.id 
                    ? 'bg-white shadow-xl shadow-gray-200 border border-blue-100' 
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
            <div className="flex items-center gap-3">
              {showAddAction && canEdit && (
                <button 
                  onClick={onAddClick}
                  className={`p-4 rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition-all ${
                     currentContextMonth.id === -1 ? 'bg-gray-300 cursor-not-allowed text-gray-500' : 'bg-gray-900 text-white'
                  }`}
                  title={currentContextMonth.id === -1 ? "Indisponível em modo visualização" : "Novo Lançamento"}
                  disabled={currentContextMonth.id === -1}
                >
                  <Plus size={22} />
                </button>
              )}
              <button 
                onClick={handleGlobalRefresh}
                className="p-4 bg-white border border-gray-200 rounded-2xl text-gray-400 hover:text-gray-900 transition-all shadow-sm"
              >
                <RefreshCw size={22} />
              </button>
            </div>
          </div>
        </div>

        {/* CONTEÚDO DINÂMICO (White Label Isolado por Mês) */}
        <div className="p-6 lg:p-12 max-w-6xl mx-auto">
          {/* Alerta de Mês Fechado ou Virtual */}
          {currentContextMonth.status === 'fechado' && (
            <div className="mb-10 bg-amber-50 border border-amber-200/50 p-6 rounded-[2rem] flex items-center gap-4 text-amber-800 shadow-sm animate-in fade-in slide-in-from-top-4">
              <div className="bg-amber-100 p-3 rounded-2xl"><LockKeyhole size={24} /></div>
              <div>
                <p className="text-sm font-black uppercase tracking-tighter">Histórico (Modo Leitura)</p>
                <p className="text-[11px] font-bold opacity-70 uppercase tracking-widest">Este ciclo foi encerrado. Novos dados não podem ser adicionados.</p>
              </div>
            </div>
          )}

          {currentContextMonth.id === -1 && (
             <div className="mb-10 bg-red-50 border border-red-200/50 p-6 rounded-[2rem] flex items-center gap-4 text-red-800 shadow-sm animate-in fade-in slide-in-from-top-4">
               <div className="bg-red-100 p-3 rounded-2xl"><LockKeyhole size={24} /></div>
               <div>
                 <p className="text-sm font-black uppercase tracking-tighter">Modo de Visualização (Sem Persistência)</p>
                 <p className="text-[11px] font-bold opacity-70 uppercase tracking-widest">Não foi possível criar este mês no banco de dados. Você está vendo uma versão temporária.</p>
               </div>
             </div>
          )}

          {/* Renderização Condicional com Reset de State via Key */}
          {view === 'overview' && <Overview key={`ov-${refreshKey}-${currentContextMonth.id}`} currentMonth={currentContextMonth} refresh={handleGlobalRefresh} />}
          {view === 'expenses' && <Expenses key={`ex-${refreshKey}-${currentContextMonth.id}`} currentMonth={currentContextMonth} triggerAdd={triggerAdd} />}
          {view === 'revenue' && <Revenue key={`rv-${refreshKey}-${currentContextMonth.id}`} currentMonth={currentContextMonth} triggerAdd={triggerAdd} />}
          {view === 'banks' && <Banks key={`bk-${refreshKey}-${currentContextMonth.id}`} currentMonth={currentContextMonth} triggerAdd={triggerAdd} />}
          {view === 'installments' && <Installments key={`in-${refreshKey}-${currentContextMonth.id}`} currentMonth={currentContextMonth} triggerAdd={triggerAdd} />}
          {view === 'closing' && <Closing key={`cl-${refreshKey}`} currentMonth={activeMonth!} onSelectMonth={handleContextChange} onRefresh={init} />}
        </div>
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
  <button 
    onClick={onClick}
    className={`w-full flex items-center gap-4 px-6 py-5 rounded-2xl transition-all duration-500 font-bold text-base ${
      active 
        ? 'bg-gray-900 text-white shadow-2xl shadow-gray-400' 
        : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'
    }`}
  >
    <span className={active ? 'text-white' : 'text-gray-400'}>{icon}</span>
    <span className="uppercase tracking-widest text-xs font-black">{label}</span>
  </button>
);

export default App;
