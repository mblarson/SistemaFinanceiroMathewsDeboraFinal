
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
  CalendarClock,
  Plus
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
  const [triggerAdd, setTriggerAdd] = useState(0);

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

  const onAddClick = () => {
    setTriggerAdd(prev => prev + 1);
  };

  if (loading || !currentMonth) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-green-700 border-t-transparent"></div>
          <p className="font-medium text-gray-600 animate-pulse text-sm">Sincronizando M&D...</p>
        </div>
      </div>
    );
  }

  const showAddAction = ['expenses', 'revenue', 'installments', 'banks'].includes(view);

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden text-gray-900">
      {/* Menu Mobile Button */}
      {!isSidebarOpen && (
        <button 
          className="fixed bottom-6 left-6 z-50 p-4 bg-green-800 text-white rounded-full shadow-2xl lg:hidden active:scale-90 transition-transform"
          onClick={() => setIsSidebarOpen(true)}
        >
          <Menu size={24} />
        </button>
      )}

      {/* Sidebar Backdrop */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-gray-100 transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full p-5">
          <div className="flex items-center gap-2.5 mb-8 text-green-800 px-2">
            <div className="bg-green-100 p-2 rounded-xl"><Wallet size={20} /></div>
            <span className="text-lg font-black tracking-tight">M&D Finanças</span>
          </div>

          <nav className="flex-1 space-y-0.5">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-3 px-2">Menu</p>
            <NavItem icon={<LayoutDashboard size={18} />} label="Dashboard" active={view === 'overview'} onClick={() => handleNavigate('overview')} />
            <NavItem icon={<Receipt size={18} />} label="Despesas" active={view === 'expenses'} onClick={() => handleNavigate('expenses')} />
            <NavItem icon={<TrendingUp size={18} />} label="Receitas" active={view === 'revenue'} onClick={() => handleNavigate('revenue')} />
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mt-6 mb-3 px-2">Gestão</p>
            <NavItem icon={<Banknote size={18} />} label="Cartões" active={view === 'banks'} onClick={() => handleNavigate('banks')} />
            <NavItem icon={<CalendarClock size={18} />} label="Parcelas" active={view === 'installments'} onClick={() => handleNavigate('installments')} />
            <NavItem icon={<LockKeyhole size={18} />} label="Histórico" active={view === 'closing'} onClick={() => handleNavigate('closing')} />
          </nav>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative p-4 lg:p-8">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div className="min-w-0">
            <h1 className="text-xl lg:text-2xl font-black text-gray-900 uppercase tracking-tight">
              {view === 'overview' && 'Visão Geral'}
              {view === 'expenses' && 'Despesas'}
              {view === 'revenue' && 'Receitas'}
              {view === 'banks' && 'Cartões'}
              {view === 'installments' && 'Parcelas'}
              {view === 'closing' && 'Histórico'}
            </h1>
            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">{currentMonth.nome} {currentMonth.ano}</p>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {showAddAction && currentMonth.status === 'ativo' && (
              <button 
                onClick={onAddClick}
                className="bg-green-700 text-white p-2.5 rounded-full shadow-lg hover:bg-green-800 transition active:scale-95"
                title="Adicionar Novo"
              >
                <Plus size={20} />
              </button>
            )}

            <button 
              onClick={handleGlobalRefresh}
              className="p-2.5 bg-white border border-gray-200 rounded-full text-gray-400 hover:text-green-700 transition"
              title="Sincronizar"
            >
              <RefreshCw size={18} />
            </button>

            <div className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${
              currentMonth.status === 'ativo' ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-red-100 text-red-700 border border-red-200'
            }`}>
              {currentMonth.status}
            </div>
          </div>
        </header>

        <div className="max-w-6xl mx-auto" onClick={() => isSidebarOpen && setIsSidebarOpen(false)}>
          {view === 'overview' && <Overview key={`ov-${refreshKey}`} currentMonth={currentMonth} refresh={handleGlobalRefresh} />}
          {view === 'expenses' && <Expenses key={`ex-${refreshKey}`} currentMonth={currentMonth} triggerAdd={triggerAdd} />}
          {view === 'revenue' && <Revenue key={`rv-${refreshKey}`} currentMonth={currentMonth} triggerAdd={triggerAdd} />}
          {view === 'banks' && <Banks key={`bk-${refreshKey}`} currentMonth={currentMonth} triggerAdd={triggerAdd} />}
          {view === 'installments' && <Installments key={`in-${refreshKey}`} currentMonth={currentMonth} triggerAdd={triggerAdd} />}
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
    className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 font-bold text-sm ${
      active 
        ? 'bg-green-700 text-white shadow-md' 
        : 'text-gray-500 hover:bg-gray-50'
    }`}
  >
    {icon}
    <span>{label}</span>
  </button>
);

export default App;
