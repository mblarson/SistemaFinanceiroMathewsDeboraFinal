
import React, { useState, useEffect } from 'react';
import { TrendingUp, Plus, Trash2, Pencil, X, Calendar } from 'lucide-react';
import { supabaseClient } from '../services/supabase';
import { Month, Revenue as RevenueType } from '../types';

interface RevenueProps {
  currentMonth: Month;
}

const Revenue: React.FC<RevenueProps> = ({ currentMonth }) => {
  const [revenues, setRevenues] = useState<RevenueType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ desc: '', val: 'R$ 0,00', date: new Date().toISOString().split('T')[0] });

  useEffect(() => {
    fetchData();
  }, [currentMonth]);

  const fetchData = async () => {
    setLoading(true);
    const { data } = await supabaseClient
      .from('receitas')
      .select('*')
      .eq('mes_id', currentMonth.id)
      .order('data', { ascending: true });
    setRevenues(data || []);
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

  const handleDelete = async (id: number) => {
    if (currentMonth.status === 'fechado' || !confirm("Deseja excluir esta receita?")) return;
    await supabaseClient.from('receitas').delete().eq('id', id);
    fetchData();
  };

  const openEditModal = (rev: RevenueType) => {
    setEditingId(rev.id);
    setFormData({
      desc: rev.descricao,
      val: maskCurrency((rev.valor * 100).toString()),
      date: rev.data
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseCurrency(formData.val);
    if (!formData.desc || val <= 0) return;

    const payload = {
      mes_id: currentMonth.id,
      descricao: formData.desc,
      valor: val,
      data: formData.date
    };

    if (editingId) {
      await supabaseClient.from('receitas').update(payload).eq('id', editingId);
    } else {
      await supabaseClient.from('receitas').insert([payload]);
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
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 lg:p-7">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold flex items-center gap-2 text-gray-900">
            <TrendingUp size={22} className="text-green-600" />
            Receitas
          </h3>
          {currentMonth.status === 'ativo' && (
            <button 
              onClick={() => { setEditingId(null); setFormData({ desc: '', val: 'R$ 0,00', date: new Date().toISOString().split('T')[0] }); setShowModal(true); }}
              className="bg-green-800 text-white px-5 py-2 rounded-full font-bold text-[10px] uppercase tracking-wider flex items-center gap-1.5 shadow-md active:scale-95 transition"
            >
              <Plus size={14} /> Nova
            </button>
          )}
        </div>

        {loading ? (
          <div className="py-10 flex flex-col items-center gap-3 text-gray-400">
            <div className="w-8 h-8 border-3 border-green-700 border-t-transparent rounded-full animate-spin"></div>
            <p className="font-bold uppercase tracking-widest text-[9px]">Carregando...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {revenues.length === 0 ? (
              <p className="col-span-full text-center py-10 text-gray-400 font-bold uppercase tracking-widest text-[10px]">Vazio.</p>
            ) : (
              revenues.map(rev => (
                <div key={rev.id} className="flex flex-col p-4 rounded-xl bg-green-50/10 border border-green-50/50 hover:border-green-100 transition-all">
                  <div className="flex justify-between items-start mb-3">
                    <div className="min-w-0">
                      <h4 className="font-bold text-gray-800 text-sm truncate leading-tight">{rev.descricao}</h4>
                      <p className="text-[9px] text-gray-400 font-bold uppercase mt-0.5">
                        {new Date(rev.data).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <div className="bg-white p-1.5 rounded-lg text-green-700 shadow-sm border border-green-50 shrink-0">
                      <TrendingUp size={14} />
                    </div>
                  </div>

                  <div className="h-px w-full bg-green-50/50 mb-3"></div>

                  <div className="flex items-center justify-between">
                    <span className="font-bold text-base text-green-700 tracking-tight">
                      {formatCurrency(rev.valor)}
                    </span>
                    
                    <div className="flex items-center gap-0.5">
                      {currentMonth.status === 'ativo' && (
                        <>
                          <button onClick={() => openEditModal(rev)} className="text-gray-300 hover:text-blue-600 transition p-1.5"><Pencil size={16} /></button>
                          <button onClick={() => handleDelete(rev.id)} className="text-gray-300 hover:text-red-500 transition p-1.5"><Trash2 size={16} /></button>
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
              <h2 className="text-lg font-bold text-gray-900">{editingId ? 'Editar' : 'Nova Receita'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1 tracking-widest">Descrição</label>
                <input type="text" value={formData.desc} onChange={e => setFormData({...formData, desc: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-green-700 font-medium text-sm" placeholder="Salário..." required />
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
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 bg-gray-100 text-gray-500 font-bold py-3 rounded-xl uppercase text-[10px] tracking-widest">Cancelar</button>
                <button type="submit" className="flex-1 bg-green-800 text-white font-bold py-3 rounded-xl shadow-md uppercase text-[10px] tracking-widest">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Revenue;
