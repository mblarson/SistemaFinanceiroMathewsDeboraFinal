
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
    <div className="space-y-6">
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 p-6 lg:p-10">
        <div className="flex justify-between items-center mb-10">
          <h3 className="text-2xl font-black flex items-center gap-3 text-gray-900">
            <TrendingUp size={28} className="text-green-600" />
            Receitas
          </h3>
          {currentMonth.status === 'ativo' && (
            <button 
              onClick={() => { setEditingId(null); setFormData({ desc: '', val: 'R$ 0,00', date: new Date().toISOString().split('T')[0] }); setShowModal(true); }}
              className="bg-green-800 text-white px-8 py-3 rounded-full font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-xl shadow-green-900/20 active:scale-95 transition"
            >
              <Plus size={18} /> Nova
            </button>
          )}
        </div>

        {loading ? (
          <div className="py-20 flex flex-col items-center gap-4 text-gray-400">
            <div className="w-10 h-10 border-4 border-green-700 border-t-transparent rounded-full animate-spin"></div>
            <p className="font-bold uppercase tracking-widest text-[10px]">Buscando entradas...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {revenues.length === 0 ? (
              <p className="col-span-full text-center py-20 text-gray-400 font-bold uppercase tracking-widest text-xs">Nenhuma receita lançada.</p>
            ) : (
              revenues.map(rev => (
                <div key={rev.id} className="flex flex-col p-6 rounded-[2rem] bg-green-50/10 border border-green-50/50 hover:border-green-200 transition-all hover:shadow-md group">
                  {/* Linha 1: Descrição */}
                  <div className="flex justify-between items-start mb-4">
                    <div className="min-w-0">
                      <h4 className="font-bold text-gray-800 text-lg truncate leading-tight">{rev.descricao}</h4>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Calendar size={10} className="text-gray-400" />
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                          {new Date(rev.data).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl text-green-700 shadow-sm shrink-0 border border-green-50">
                      <TrendingUp size={18} />
                    </div>
                  </div>

                  {/* Divisor Sutil */}
                  <div className="h-px w-full bg-green-50/50 mb-4"></div>

                  {/* Linha 2: Valor e Ações */}
                  <div className="flex items-center justify-between">
                    <span className="font-black text-xl text-green-700 tracking-tight">
                      {formatCurrency(rev.valor)}
                    </span>
                    
                    <div className="flex items-center gap-1">
                      {currentMonth.status === 'ativo' && (
                        <>
                          <button 
                            onClick={() => openEditModal(rev)} 
                            className="text-gray-300 hover:text-blue-600 hover:bg-blue-50 transition-all p-2 rounded-lg"
                          >
                            <Pencil size={18} />
                          </button>
                          <button 
                            onClick={() => handleDelete(rev.id)} 
                            className="text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all p-2 rounded-lg"
                          >
                            <Trash2 size={18} />
                          </button>
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
              <h2 className="text-2xl font-black text-gray-900">{editingId ? 'Editar' : 'Nova'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400"><X /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 ml-1 tracking-widest">Fonte da Receita</label>
                <input type="text" value={formData.desc} onChange={e => setFormData({...formData, desc: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-5 outline-none focus:border-green-700 font-bold text-lg" placeholder="Ex: Salário..." required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 ml-1 tracking-widest">Valor Recebido</label>
                  <input type="text" inputMode="numeric" value={formData.val} onChange={e => setFormData({...formData, val: maskCurrency(e.target.value)})} className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-5 outline-none focus:border-green-700 font-black text-xl" required />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 ml-1 tracking-widest">Data</label>
                  <input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-5 outline-none focus:border-green-700 font-bold" required />
                </div>
              </div>
              <div className="flex gap-4 pt-6">
                <button type="button" onClick={() => { setShowModal(false); setEditingId(null); }} className="flex-1 bg-gray-100 text-gray-500 font-black py-5 rounded-2xl uppercase tracking-widest text-xs">Cancelar</button>
                <button type="submit" className="flex-1 bg-green-800 text-white font-black py-5 rounded-2xl shadow-xl uppercase tracking-widest text-xs">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Revenue;
