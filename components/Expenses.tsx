
import React, { useState, useEffect } from 'react';
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
    <div className="space-y-4">
      <div className="flex w-full bg-gray-200/50 p-1 rounded-xl gap-1 max-w-xs mx-auto">
        <button 
          onClick={() => setActiveTab('contas')} 
          className={`flex-1 py-2 rounded-lg text-[10px] font-bold transition-all uppercase tracking-widest ${activeTab === 'contas' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
        >
          Fixas
        </button>
        <button 
          onClick={() => setActiveTab('pix')} 
          className={`flex-1 py-2 rounded-lg text-[10px] font-bold transition-all uppercase tracking-widest ${activeTab === 'pix' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
        >
          Pix
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 lg:p-7">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold flex items-center gap-2 text-gray-900">
            {activeTab === 'contas' ? <Receipt size={22} className="text-gray-400" /> : <Zap size={22} className="text-yellow-500" />}
            Despesas
          </h3>
          {currentMonth.status === 'ativo' && (
            <button 
              onClick={() => { setEditingId(null); setFormData({ desc: '', val: 'R$ 0,00', date: new Date().toISOString().split('T')[0] }); setShowModal(true); }}
              className="bg-green-800 text-white px-5 py-2 rounded-full font-bold text-[10px] uppercase tracking-wider flex items-center gap-1.5 shadow-md active:scale-95 transition"
            >
              <Plus size={14} /> Novo
            </button>
          )}
        </div>

        {loading ? (
          <div className="py-10 flex flex-col items-center gap-3 text-gray-400">
            <div className="w-8 h-8 border-3 border-green-700 border-t-transparent rounded-full animate-spin"></div>
            <p className="font-bold uppercase tracking-widest text-[9px]">Sincronizando...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {activeTab === 'contas' ? (
              expenses.length === 0 ? <p className="col-span-full text-center py-10 text-gray-400 font-bold uppercase tracking-widest text-[10px]">Vazio.</p> :
              expenses.map(exp => (
                <div key={exp.id} className={`flex flex-col p-4 rounded-xl border transition-all ${exp.pago ? 'bg-gray-50 border-transparent opacity-60 scale-[0.98]' : 'bg-white border-gray-100 hover:border-green-100 shadow-sm'}`}>
                  <div className="flex items-start gap-2 mb-3">
                    <button 
                      onClick={() => handleTogglePaid('despesas_contas', exp.id, exp.pago)} 
                      className={`transition shrink-0 mt-0.5 ${exp.pago ? 'text-green-600' : 'text-gray-200 hover:text-green-400'}`}
                    >
                      {exp.pago ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                    </button>
                    <div className="min-w-0">
                      <h4 className={`font-bold text-gray-800 text-sm truncate leading-tight ${exp.pago ? 'line-through' : ''}`}>
                        {exp.descricao}
                      </h4>
                      <p className="text-[9px] text-gray-400 font-bold uppercase mt-0.5">
                        {new Date(exp.data).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>

                  <div className="h-px w-full bg-gray-50 mb-3"></div>

                  <div className="flex items-center justify-between">
                    <span className="font-bold text-base text-gray-900 tracking-tight">
                      {formatCurrency(exp.valor)}
                    </span>
                    <div className="flex items-center gap-0.5">
                      {currentMonth.status === 'ativo' && (
                        <>
                          <button onClick={() => openEditModal(exp)} className="text-gray-300 hover:text-blue-600 transition p-1.5"><Pencil size={16} /></button>
                          <button onClick={() => handleDelete('despesas_contas', exp.id)} className="text-gray-300 hover:text-red-500 transition p-1.5"><Trash2 size={16} /></button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              pixExpenses.length === 0 ? <p className="col-span-full text-center py-10 text-gray-400 font-bold uppercase tracking-widest text-[10px]">Vazio.</p> :
              pixExpenses.map(exp => (
                <div key={exp.id} className={`flex flex-col p-4 rounded-xl border transition-all ${exp.pago ? 'bg-gray-50 border-transparent opacity-60 scale-[0.98]' : 'bg-white border-gray-100 hover:border-green-100 shadow-sm'}`}>
                  <div className="flex items-start gap-2 mb-3">
                    <button 
                      onClick={() => handleTogglePaid('despesas_pix_credito', exp.id, exp.pago)} 
                      className={`transition shrink-0 mt-0.5 ${exp.pago ? 'text-green-600' : 'text-gray-200 hover:text-green-400'}`}
                    >
                      {exp.pago ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                    </button>
                    <div className="min-w-0">
                      <h4 className={`font-bold text-gray-800 text-sm truncate leading-tight ${exp.pago ? 'line-through' : ''}`}>
                        {exp.descricao}
                      </h4>
                      <p className="text-[9px] text-gray-400 font-bold uppercase mt-0.5">
                        Taxa: {exp.taxa_percentual}%
                      </p>
                    </div>
                  </div>

                  <div className="h-px w-full bg-gray-100 mb-3"></div>

                  <div className="flex items-center justify-between">
                    <span className="font-bold text-base text-gray-900 tracking-tight">
                      {formatCurrency(exp.valor_final)}
                    </span>
                    <div className="flex items-center gap-0.5">
                      {currentMonth.status === 'ativo' && (
                        <>
                          <button onClick={() => openEditModal(exp)} className="text-gray-300 hover:text-blue-600 transition p-1.5"><Pencil size={16} /></button>
                          <button onClick={() => handleDelete('despesas_pix_credito', exp.id)} className="text-gray-300 hover:text-red-500 transition p-1.5"><Trash2 size={16} /></button>
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm p-6 rounded-2xl shadow-2xl animate-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-lg font-bold text-gray-900">{editingId ? 'Editar' : 'Novo Gasto'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400"><LucideX size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1 tracking-widest">Descrição</label>
                <input type="text" value={formData.desc} onChange={e => setFormData({...formData, desc: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-green-700 font-medium text-sm" placeholder="Mercado..." required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="min-w-0">
                  <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1 tracking-widest">Valor</label>
                  <input type="text" inputMode="numeric" value={formData.val} onChange={e => setFormData({...formData, val: maskCurrency(e.target.value)})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-green-700 font-bold text-sm" required />
                </div>
                <div className="min-w-0">
                  <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1 tracking-widest">Data</label>
                  <input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-green-700 font-medium text-xs" required />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => { setShowModal(false); setEditingId(null); }} className="flex-1 bg-gray-100 text-gray-500 font-bold py-3 rounded-xl uppercase text-[10px] tracking-widest">Cancelar</button>
                <button type="submit" className="flex-1 bg-green-800 text-white font-bold py-3 rounded-xl shadow-md uppercase text-[10px] tracking-widest">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Expenses;
