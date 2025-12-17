
import React, { useState, useEffect } from 'react';
// FIX: Alias 'X' as 'LucideX' to resolve the 'Cannot find name LucideX' error.
import { Receipt, Zap, Plus, Trash2, CheckCircle2, Circle, Pencil, X as LucideX } from 'lucide-react';
import { supabaseClient } from '../services/supabase';
import { Month, Expense, PixExpense } from '../types';

interface ExpensesProps {
  currentMonth: Month;
}

const Expenses: React.FC<ExpensesProps> = ({ currentMonth }) => {
  const [activeTab, setActiveTab] = useState<'contas' | 'pix'>('contas');
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [pixExpenses, setPixExpenses] = useState<PixExpense[]>([]);
  const [pixTax, setPixTax] = useState(5.0);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ desc: '', val: 'R$ 0,00', date: new Date().toISOString().split('T')[0] });

  useEffect(() => {
    fetchPixConfig();
    fetchData();
  }, [currentMonth, activeTab]);

  const fetchPixConfig = async () => {
    const { data } = await supabaseClient.from('configuracoes').select('*').eq('chave', 'taxa_pix').single();
    if (data) setPixTax(parseFloat(data.valor));
  };

  const fetchData = async () => {
    setLoading(true);
    if (activeTab === 'contas') {
      const { data } = await supabaseClient
        .from('despesas_contas')
        .select('*')
        .eq('mes_id', currentMonth.id)
        .order('data', { ascending: true });
      setExpenses(data || []);
    } else {
      const { data } = await supabaseClient
        .from('despesas_pix_credito')
        .select('*')
        .eq('mes_id', currentMonth.id)
        .order('data', { ascending: true });
      setPixExpenses(data || []);
    }
    setLoading(false);
  };

  const maskCurrency = (value: string) => {
    const digits = value.replace(/\D/g, "");
    const amount = Number(digits) / 100;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(amount);
  };

  const parseCurrency = (value: string) => {
    return parseFloat(value.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
  };

  const handleTogglePaid = async (table: string, id: number, currentStatus: boolean) => {
    if (currentMonth.status === 'fechado') return;
    await supabaseClient.from(table).update({ pago: !currentStatus }).eq('id', id);
    fetchData();
  };

  const handleDelete = async (table: string, id: number) => {
    if (currentMonth.status === 'fechado' || !confirm("Deseja realmente excluir?")) return;
    await supabaseClient.from(table).delete().eq('id', id);
    fetchData();
  };

  const openEditModal = (item: any) => {
    setEditingId(item.id);
    const numericVal = item.valor || item.valor_original || 0;
    setFormData({
      desc: item.descricao,
      val: maskCurrency((numericVal * 100).toString()),
      date: item.data
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseCurrency(formData.val);
    if (!formData.desc || val <= 0) return;

    const payload: any = {
      mes_id: currentMonth.id,
      descricao: formData.desc,
      data: formData.date
    };

    if (activeTab === 'contas') {
      payload.valor = val;
      if (editingId) {
        await supabaseClient.from('despesas_contas').update(payload).eq('id', editingId);
      } else {
        await supabaseClient.from('despesas_contas').insert([payload]);
      }
    } else {
      const finalVal = val + (val * (pixTax / 100));
      payload.valor_original = val;
      payload.taxa_percentual = pixTax;
      payload.valor_final = finalVal;
      if (editingId) {
        await supabaseClient.from('despesas_pix_credito').update(payload).eq('id', editingId);
      } else {
        await supabaseClient.from('despesas_pix_credito').insert([payload]);
      }
    }

    setShowModal(false);
    setEditingId(null);
    setFormData({ desc: '', val: 'R$ 0,00', date: new Date().toISOString().split('T')[0] });
    fetchData();
  };

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="space-y-6">
      {/* Abas com largura total e flexível */}
      <div className="flex w-full bg-gray-200/50 p-1 rounded-2xl gap-1">
        <button 
          onClick={() => setActiveTab('contas')} 
          className={`flex-1 py-4 px-2 rounded-xl text-sm font-black transition-all uppercase tracking-widest ${activeTab === 'contas' ? 'bg-white shadow-md text-gray-900' : 'text-gray-500 hover:text-gray-700 hover:bg-white/30'}`}
        >
          Contas Fixas
        </button>
        <button 
          onClick={() => setActiveTab('pix')} 
          className={`flex-1 py-4 px-2 rounded-xl text-sm font-black transition-all uppercase tracking-widest ${activeTab === 'pix' ? 'bg-white shadow-md text-gray-900' : 'text-gray-500 hover:text-gray-700 hover:bg-white/30'}`}
        >
          Pix Crédito
        </button>
      </div>

      <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 p-6 lg:p-10">
        <div className="flex justify-between items-center mb-10">
          <h3 className="text-2xl font-black flex items-center gap-3 text-gray-900">
            {activeTab === 'contas' ? <Receipt size={28} className="text-gray-400" /> : <Zap size={28} className="text-yellow-500" />}
            DESPESAS
          </h3>
          {currentMonth.status === 'ativo' && (
            <button 
              onClick={() => { setEditingId(null); setFormData({ desc: '', val: 'R$ 0,00', date: new Date().toISOString().split('T')[0] }); setShowModal(true); }}
              className="bg-green-800 text-white px-8 py-3 rounded-full font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-xl shadow-green-900/20 active:scale-95 transition"
            >
              <Plus size={18} /> Novo
            </button>
          )}
        </div>

        {loading ? (
          <div className="py-20 flex flex-col items-center gap-4 text-gray-400">
            <div className="w-10 h-10 border-4 border-green-700 border-t-transparent rounded-full animate-spin"></div>
            <p className="font-bold uppercase tracking-widest text-[10px]">Sincronizando...</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeTab === 'contas' ? (
              expenses.length === 0 ? <p className="text-center py-20 text-gray-400 font-bold uppercase tracking-widest text-xs">Vazio por aqui.</p> :
              expenses.map(exp => (
                <div key={exp.id} className={`flex items-center justify-between p-5 rounded-2xl border transition-all ${exp.pago ? 'bg-gray-50 border-transparent opacity-50 scale-[0.98]' : 'bg-white border-gray-100 hover:border-green-200'}`}>
                  <div className="flex items-center gap-4">
                    <button onClick={() => handleTogglePaid('despesas_contas', exp.id, exp.pago)} className={`transition ${exp.pago ? 'text-green-600' : 'text-gray-200 hover:text-green-400'}`}>
                      {exp.pago ? <CheckCircle2 size={26} /> : <Circle size={26} />}
                    </button>
                    <div>
                      <h4 className={`font-black text-gray-800 ${exp.pago ? 'line-through' : ''}`}>{exp.descricao}</h4>
                      <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">{new Date(exp.data).toLocaleDateString('pt-BR')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <span className="font-black text-lg text-gray-900">{formatCurrency(exp.valor)}</span>
                    <div className="flex items-center gap-1">
                      {currentMonth.status === 'ativo' && (
                        <>
                          <button onClick={() => openEditModal(exp)} className="text-gray-300 hover:text-blue-600 transition p-2"><Pencil size={18} /></button>
                          <button onClick={() => handleDelete('despesas_contas', exp.id)} className="text-gray-300 hover:text-red-500 transition p-2"><Trash2 size={18} /></button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              pixExpenses.length === 0 ? <p className="text-center py-20 text-gray-400 font-bold uppercase tracking-widest text-xs">Sem Pix registrados.</p> :
              pixExpenses.map(exp => (
                <div key={exp.id} className={`flex items-center justify-between p-5 rounded-2xl border transition-all ${exp.pago ? 'bg-gray-50 border-transparent opacity-50 scale-[0.98]' : 'bg-white border-gray-100 hover:border-green-200'}`}>
                   <div className="flex items-center gap-4">
                    <button onClick={() => handleTogglePaid('despesas_pix_credito', exp.id, exp.pago)} className={`transition ${exp.pago ? 'text-green-600' : 'text-gray-200 hover:text-green-400'}`}>
                      {exp.pago ? <CheckCircle2 size={26} /> : <Circle size={26} />}
                    </button>
                    <div>
                      <h4 className={`font-black text-gray-800 ${exp.pago ? 'line-through' : ''}`}>{exp.descricao}</h4>
                      <p className="text-[10px] text-gray-400 font-black uppercase">Taxa: {exp.taxa_percentual}% | {formatCurrency(exp.valor_original)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <span className="font-black text-lg text-gray-900">{formatCurrency(exp.valor_final)}</span>
                    <div className="flex items-center gap-1">
                      {currentMonth.status === 'ativo' && (
                        <>
                          <button onClick={() => openEditModal(exp)} className="text-gray-300 hover:text-blue-600 transition p-2"><Pencil size={18} /></button>
                          <button onClick={() => handleDelete('despesas_pix_credito', exp.id)} className="text-gray-300 hover:text-red-500 transition p-2"><Trash2 size={18} /></button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md p-8 rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl animate-in slide-in-from-bottom sm:zoom-in duration-300">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-black text-gray-900">{editingId ? 'Editar' : 'Novo Gasto'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400"><LucideX /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 ml-1 tracking-widest">O que foi comprado?</label>
                <input type="text" value={formData.desc} onChange={e => setFormData({...formData, desc: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-5 outline-none focus:border-green-700 font-bold text-lg" placeholder="Ex: Mercado..." required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 ml-1 tracking-widest">Quanto custou?</label>
                  <input type="text" inputMode="numeric" value={formData.val} onChange={e => setFormData({...formData, val: maskCurrency(e.target.value)})} className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-5 outline-none focus:border-green-700 font-black text-xl" required />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 ml-1 tracking-widest">Quando?</label>
                  <input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-5 outline-none focus:border-green-700 font-bold" required />
                </div>
              </div>
              <div className="flex gap-4 pt-6">
                <button type="button" onClick={() => { setShowModal(false); setEditingId(null); }} className="flex-1 bg-gray-100 text-gray-500 font-black py-5 rounded-2xl uppercase tracking-widest text-xs">Cancelar</button>
                <button type="submit" className="flex-1 bg-green-800 text-white font-black py-5 rounded-2xl shadow-xl shadow-green-900/20 uppercase tracking-widest text-xs">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Expenses;
