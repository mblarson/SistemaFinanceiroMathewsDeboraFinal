
import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Receipt, 
  TrendingUp, 
  Banknote, 
  LockKeyhole, 
  Menu, 
  Wallet,
  User,
  RefreshCw,
  CalendarClock
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
  const [currentMonth, setCurrentMonth] = useState<Month | null>(null);
  const [activeMonth, setActiveMonth] = useState<Month | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    setLoading(true);
    try {
      const { data: meses } = await supabaseClient
        .from('meses')
        .select('*')
        .order('criado_em', { ascending: false });

      if (!meses || meses.length === 0) {
        const { data } = await supabaseClient
          .from('meses')
          .insert([{ nome: 'MARÇO', ano: 2025, status: 'ativo' }])
          .select()
          .single();
        setCurrentMonth(data);
        setActiveMonth(data);
      } else {
        const active = meses.find((m: any) => m.status === 'ativo') || meses[0];
        setActiveMonth(active);
        setCurrentMonth(active);
      }
    } catch (error) {
      console.error("Initialization error:", error);
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
    setIsSidebarOpen(false);
  };

  const handleMonthChange = (month: Month) => {
    setCurrentMonth(month);
    setIsSidebarOpen(false);
  };

  if (loading || !currentMonth) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-green-700 border-t-transparent"></div>
          <p className="font-medium text-gray-600 animate-pulse">Recuperando dados do sistema...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden text-gray-900">
      {/* Botão Menu Mobile - Canto Inferior Esquerdo */}
      {!isSidebarOpen && (
        <button 
          className="fixed bottom-6 left-6 z-50 p-4 bg-green-800 text-white rounded-full shadow-2xl lg:hidden active:scale-90 transition-transform"
          onClick={() => setIsSidebarOpen(true)}
        >
          <Menu size={24} />
        </button>
      )}

      {/* Backdrop - Fecha o menu ao tocar em qualquer lugar da tela escurecida */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30 lg:hidden animate-in fade-in duration-300"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-72 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex flex-col h-full p-6">
          <div className="flex items-center gap-3 mb-10 text-green-800">
            <div className="bg-green-100 p-2 rounded-full">
              <Wallet size={24} />
            </div>
            <span className="text-xl font-bold">M&D Finanças</span>
          </div>

          <nav className="flex-1 space-y-1">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4 px-2">Menu Principal</p>
            <NavItem icon={<LayoutDashboard size={20} />} label="Visão Geral" active={view === 'overview'} onClick={() => handleNavigate('overview')} />
            <NavItem icon={<Receipt size={20} />} label="Despesas" active={view === 'expenses'} onClick={() => handleNavigate('expenses')} />
            <NavItem icon={<TrendingUp size={20} />} label="Receitas" active={view === 'revenue'} onClick={() => handleNavigate('revenue')} />
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-8 mb-4 px-2">Gestão</p>
            <NavItem icon={<Banknote size={20} />} label="Bancos" active={view === 'banks'} onClick={() => handleNavigate('banks')} />
            <NavItem icon={<CalendarClock size={20} />} label="Parcelamentos" active={view === 'installments'} onClick={() => handleNavigate('installments')} />
            <NavItem icon={<LockKeyhole size={20} />} label="Histórico / Fechamento" active={view === 'closing'} onClick={() => handleNavigate('closing')} />
          </nav>

          <div className="mt-auto pt-6 border-t border-gray-100">
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
              <div className="bg-white p-2 rounded-full border border-gray-200">
                <User size={18} className="text-gray-600" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold">M&D Admin</span>
                <span className="text-xs text-gray-500">Logado via Supabase</span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 lg:p-10 relative">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 uppercase">
              {view === 'overview' && 'Visão Geral'}
              {view === 'expenses' && 'DESPESAS'}
              {view === 'revenue' && 'Receitas'}
              {view === 'banks' && 'Bancos'}
              {view === 'installments' && 'Parcelamentos'}
              {view === 'closing' && 'Histórico'}
            </h1>
            <p className="text-gray-500 font-medium">Ref: {currentMonth.nome} {currentMonth.ano}</p>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-auto">
            <button 
              onClick={handleGlobalRefresh}
              className="p-2.5 bg-white border border-gray-200 rounded-full text-gray-500 hover:text-green-700 hover:border-green-200 transition-all shadow-sm group"
              title="Sincronizar dados do banco"
            >
              <RefreshCw size={20} className="group-active:rotate-180 transition-transform duration-500" />
            </button>

            {currentMonth.status === 'fechado' && activeMonth && currentMonth.id !== activeMonth.id && (
              <button 
                onClick={() => setCurrentMonth(activeMonth)}
                className="px-4 py-2 text-sm font-medium bg-white border border-gray-300 rounded-full hover:bg-gray-50 transition shadow-sm"
              >
                Mês Atual
              </button>
            )}
            <div className={`px-4 py-2 rounded-full text-sm font-semibold shadow-sm ${
              currentMonth.status === 'ativo' ? 'bg-green-600 text-white' : 'bg-red-500 text-white'
            }`}>
              {currentMonth.status === 'ativo' ? 'Ativo' : 'Fechado'}
            </div>
          </div>
        </header>

        {/* Clicar no conteúdo principal também fecha o menu lateral se estiver aberto */}
        <div className="max-w-7xl mx-auto" onClick={() => isSidebarOpen && setIsSidebarOpen(false)}>
          {view === 'overview' && <Overview key={`ov-${refreshKey}`} currentMonth={currentMonth} refresh={handleGlobalRefresh} />}
          {view === 'expenses' && <Expenses key={`ex-${refreshKey}`} currentMonth={currentMonth} />}
          {view === 'revenue' && <Revenue key={`rv-${refreshKey}`} currentMonth={currentMonth} />}
          {view === 'banks' && <Banks key={`bk-${refreshKey}`} currentMonth={currentMonth} />}
          {view === 'installments' && <Installments key={`in-${refreshKey}`} currentMonth={currentMonth} />}
          {view === 'closing' && <Closing key={`cl-${refreshKey}`} currentMonth={currentMonth} onSelectMonth={handleMonthChange} onRefresh={init} />}
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
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium ${
      active 
        ? 'bg-green-700 text-white shadow-lg shadow-green-900/20' 
        : 'text-gray-500 hover:bg-gray-50 hover:text-green-700'
    }`}
  >
    {icon}
    <span>{label}</span>
  </button>
);

export default App;
