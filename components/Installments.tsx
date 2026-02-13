
import React, { useState, useEffect } from 'react';
import { CalendarClock, Trash2, X as LucideX, Info, Wallet, Pencil } from 'lucide-react';
import { supabaseClient } from '../services/supabase';
import { Month, Installment } from '../types';

interface InstallmentsProps {
  currentMonth: Month;
  triggerAdd: number;
}

const Installments: React.FC<InstallmentsProps> = ({ currentMonth, triggerAdd }) => {
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ desc: '', val: 'R$ 0,00', atual: '1', total: '1' });

  useEffect(() => {
    fetchData();
  }, [currentMonth]);

  useEffect(() => {
    if (triggerAdd > 0) {
      setEditingId(null);
      setFormData({ desc: '', val: 'R$ 0,00', atual: '1', total: '1' });
      setShowModal(true);
    }
  }, [triggerAdd]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data } = await supabaseClient
        .from('parcelamentos')
        .select('*')
        .eq('mes_id', currentMonth.id)
        .order('criado_em', { ascending: false });
      setInstallments(data || []);
    } catch (error) {
      console.error("Erro ao buscar parcelamentos:", error);
    } finally {
      setLoading(false);
    }
  };

  const maskCurrency = (value: string) => {
    const digits = value.replace(/\D/g, "");
    const amount = Number(digits) / 100;
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount);
  };

  const parseCurrency = (value: string) => parseFloat(value.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const openEditModal = (item: Installment) => {
    setEditingId(item.id);
    setFormData({
      desc: item.descricao || '',
      val: maskCurrency(((item.valor_parcela || 0) * 100).toString()),
      atual: (item.parcela_atual ?? 1).toString(),
      total: (item.total_parcelas ?? 1).toString()
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseCurrency(formData.val);
    const payload = {
      mes_id: currentMonth.id,
      descricao: formData.desc,
      valor_parcela: val,
      parcela_atual: parseInt(formData.atual, 10),
      total_parcelas: parseInt(formData.total, 10)
    };

    if (editingId) {
      await supabaseClient.from('parcelamentos').update(payload).eq('id', editingId);
    } else {
      await supabaseClient.from('parcelamentos').insert([payload]);
    }
    
    setShowModal(false);
    setEditingId(null);
    fetchData();
  };

  const handleDelete = async (id: number) => {
    await supabaseClient.from('parcelamentos').delete().eq('id', id);
    setConfirmDeleteId(null);
    fetchData();
  };

  const canEdit = currentMonth.status !== 'fechado';

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {loading ? (
        <div className="py-20 flex flex-col items-center gap-3 text-gray-400">
          <div className="w-8 h-8 border-3 border-green-700 border-t-transparent rounded-full animate-spin"></div>
          <p className="font-bold uppercase tracking-widest text-[9px]">Sincronizando...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {installments.length === 0 ? (
            <div className="col-span-full py-20 bg-white rounded-3xl border border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400">
              <CalendarClock size={32} className="mb-2 opacity-20" />
              <p className="font-bold uppercase tracking-widest text-[10px]">Sem parcelamentos para {currentMonth.nome}</p>
            </div>
          ) : (
            installments.map(item => {
              const pAtual = item.parcela_atual ?? 1;
              const pTotal = item.total_parcelas ?? 1;
              const pValor = item.valor_parcela ?? 0;
              
              // Regra Correta: Pagas = Parcela Atual - 1
              const pagas = Math.max(0, pAtual - 1);
              // Regra Ajustada: Restantes = Total - Pagas
              const restantes = Math.max(0, pTotal - pagas);
              // Total para quitação: considera o que falta pagar (restantes)
              const totalQuitacao = pValor * restantes;

              return (
                <div key={item.id} className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm flex flex-col">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="bg-blue-50 p-2 rounded-xl text-blue-600 shrink-0"><CalendarClock size={18} /></div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-gray-800 text-sm truncate">{item.descricao}</h4>
                        <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">Pagas: {pagas}/{pTotal}</p>
                      </div>
                    </div>
                    {canEdit && (
                      <div className="flex items-center">
                        <button onClick={() => openEditModal(item)} className="text-gray-300 hover:text-blue-600 p-1.5 transition-colors"><Pencil size={16} /></button>
                        {confirmDeleteId === item.id ? (
                          <button onClick={() => handleDelete(item.id)} className="text-red-600 font-black text-[9px] uppercase px-2">Sim</button>
                        ) : (
                          <button onClick={() => setConfirmDeleteId(item.id)} className="text-gray-300 hover:text-red-500 p-1.5 transition-colors"><Trash2 size={16} /></button>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <div className="bg-gray-50/50 p-3 rounded-2xl border border-gray-50">
                      <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Vl Parcela</p>
                      <p className="text-sm font-black text-gray-800">{formatCurrency(pValor)}</p>
                    </div>
                    <div className="bg-gray-50/50 p-3 rounded-2xl border border-gray-50">
                      <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Restantes</p>
                      <p className="text-sm font-black text-gray-800">{restantes}x</p>
                    </div>
                  </div>

                  <div className="mt-auto bg-green-800 p-4 rounded-2xl text-white">
                    <p className="text-[8px] font-bold text-green-200 uppercase tracking-widest mb-0.5">Total para Quitação</p>
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-black tracking-tight">{formatCurrency(totalQuitacao)}</span>
                      <Wallet size={16} className="opacity-30" />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm p-6 rounded-3xl shadow-2xl animate-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-black text-gray-900 uppercase tracking-tight">{editingId ? 'Editar' : 'Novo'} Parcelamento</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400"><LucideX size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1.5 tracking-widest">Descrição</label>
                <input type="text" value={formData.desc} onChange={e => setFormData({...formData, desc: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-green-700 font-bold text-sm" placeholder="Notebook..." required />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-1">
                  <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1.5 tracking-widest">Valor</label>
                  <input type="text" inputMode="numeric" value={formData.val} onChange={e => setFormData({...formData, val: maskCurrency(e.target.value)})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-green-700 font-black text-sm" required />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1.5 tracking-widest">Atual</label>
                  <input type="number" min="1" value={formData.atual} onChange={e => setFormData({...formData, atual: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-green-700 font-black text-center text-sm" required />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1.5 tracking-widest">Total</label>
                  <input type="number" min="1" value={formData.total} onChange={e => setFormData({...formData, total: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-green-700 font-black text-center text-sm" required />
                </div>
              </div>
              <div className="bg-blue-50 p-3 rounded-xl border border-blue-100 flex items-start gap-2">
                <Info size={14} className="text-blue-600 shrink-0" />
                <p className="text-[9px] font-bold text-blue-800 leading-tight uppercase">O sistema atualiza a progressão das parcelas automaticamente ao encerrar o mês.</p>
              </div>
              <div className="flex gap-3 pt-3">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 bg-gray-100 text-gray-500 font-bold py-3.5 rounded-xl uppercase text-[10px] tracking-widest">Sair</button>
                <button type="submit" className="flex-1 bg-green-800 text-white font-bold py-3.5 rounded-xl shadow-md uppercase text-[10px] tracking-widest">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Installments;
