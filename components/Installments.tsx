
import React, { useState, useEffect } from 'react';
import { CalendarClock, Plus, Trash2, X as LucideX, Info, Wallet, Pencil } from 'lucide-react';
import { supabaseClient } from '../services/supabase';
import { Month, Installment } from '../types';

interface InstallmentsProps {
  currentMonth: Month;
}

const Installments: React.FC<InstallmentsProps> = ({ currentMonth }) => {
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    desc: '',
    val: 'R$ 0,00',
    atual: '1',
    total: '1'
  });

  useEffect(() => {
    fetchData();
  }, [currentMonth]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabaseClient
        .from('parcelamentos')
        .select('*')
        .eq('mes_id', currentMonth.id)
        .order('criado_em', { ascending: false });
      
      if (error) throw error;
      
      // LOG DE DIAGNÓSTICO: Verifique no console se as propriedades total_parcelas existem aqui
      console.log("Dados recebidos do banco:", data);
      
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
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(amount);
  };

  const parseCurrency = (value: string) => {
    return parseFloat(value.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
  };

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

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
    const atual = parseInt(formData.atual, 10);
    const total = parseInt(formData.total, 10);

    if (!formData.desc || val <= 0 || isNaN(atual) || isNaN(total)) {
      alert("Por favor, preencha todos os campos corretamente.");
      return;
    }

    const payload = {
      mes_id: currentMonth.id,
      descricao: formData.desc,
      valor_parcela: val,
      parcela_atual: atual,
      total_parcelas: total // Certifique-se que o nome no banco é exatamente este
    };

    try {
      let error;
      if (editingId) {
        const res = await supabaseClient.from('parcelamentos').update(payload).eq('id', editingId);
        error = res.error;
      } else {
        const res = await supabaseClient.from('parcelamentos').insert([payload]);
        error = res.error;
      }
      
      if (error) throw error;
      
      setShowModal(false);
      setEditingId(null);
      setFormData({ desc: '', val: 'R$ 0,00', atual: '1', total: '1' });
      fetchData();
    } catch (error: any) {
      console.error("Erro ao salvar:", error);
      alert(`Erro no banco: ${error.message}. Verifique se a coluna 'total_parcelas' existe na tabela.`);
    }
  };

  const handleDelete = async (id: number) => {
    if (currentMonth.status === 'fechado') return;
    try {
      const { error } = await supabaseClient.from('parcelamentos').delete().eq('id', id);
      if (error) throw error;
      setConfirmDeleteId(null);
      fetchData();
    } catch (error) {
      console.error("Erro ao deletar:", error);
    }
  };

  return (
    <div className="space-y-6 pb-10">
      {currentMonth.status === 'ativo' && (
        <button 
          onClick={() => { setEditingId(null); setFormData({ desc: '', val: 'R$ 0,00', atual: '1', total: '1' }); setShowModal(true); }}
          className="w-full bg-green-700 hover:bg-green-800 text-white font-black py-6 rounded-[2rem] shadow-xl shadow-green-900/20 active:scale-[0.99] transition-all flex items-center justify-center gap-3 uppercase tracking-[0.2em] text-sm"
        >
          <Plus size={24} />
          Adicionar Parcelamento
        </button>
      )}

      {loading ? (
        <div className="py-20 flex flex-col items-center gap-4 text-gray-400">
          <div className="w-10 h-10 border-4 border-green-700 border-t-transparent rounded-full animate-spin"></div>
          <p className="font-bold uppercase tracking-widest text-[10px]">Sincronizando...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {installments.length === 0 ? (
            <div className="col-span-full py-20 bg-white rounded-[2.5rem] border border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400">
              <CalendarClock size={48} className="mb-4 opacity-20" />
              <p className="font-bold uppercase tracking-widest text-xs">Nenhum parcelamento ativo</p>
            </div>
          ) : (
            installments.map(item => {
              const pAtual = item.parcela_atual ?? 1;
              const pTotal = item.total_parcelas ?? 1;
              const pValor = item.valor_parcela ?? 0;
              const parcelasPendentes = Math.max(0, (pTotal - pAtual + 1));
              const totalQuitacao = pValor * parcelasPendentes;

              return (
                <div key={item.id} className="bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-sm hover:shadow-xl transition-all group relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gray-50 -mr-10 -mt-10 rounded-full group-hover:scale-150 transition-transform duration-700"></div>
                  
                  <div className="relative z-10">
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex items-center gap-4">
                        <div className="bg-blue-50 p-4 rounded-2xl text-blue-600">
                          <CalendarClock size={24} />
                        </div>
                        <div>
                          <h4 className="font-black text-gray-900 text-xl">{item.descricao}</h4>
                          <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Contrato de Parcelas</p>
                        </div>
                      </div>
                      
                      {currentMonth.status === 'ativo' && (
                        <div className="flex items-center gap-2">
                          {confirmDeleteId !== item.id && (
                            <button onClick={() => openEditModal(item)} className="text-gray-200 hover:text-blue-600 transition p-2">
                              <Pencil size={20} />
                            </button>
                          )}
                          {confirmDeleteId === item.id ? (
                            <div className="flex items-center gap-2 bg-red-600 text-white p-1 rounded-full shadow-2xl animate-in zoom-in duration-200 border-2 border-white">
                              <button onClick={() => handleDelete(item.id)} className="pl-3 pr-2 py-1 text-[10px] font-black uppercase rounded-l-full">Confirmar</button>
                              <button onClick={() => setConfirmDeleteId(null)} className="bg-white/20 p-2 rounded-full"><LucideX size={14} /></button>
                            </div>
                          ) : (
                            <button onClick={() => setConfirmDeleteId(item.id)} className="text-gray-300 hover:text-red-500 transition p-2">
                              <Trash2 size={20} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-8">
                      <div className="bg-gray-50 p-5 rounded-3xl border border-gray-100">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Valor Parcela</p>
                        <p className="text-xl font-black text-gray-900">{formatCurrency(pValor)}</p>
                      </div>
                      <div className="bg-gray-50 p-5 rounded-3xl border border-gray-100">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Progresso</p>
                        <p className="text-xl font-black text-gray-900">
                          {pAtual.toString().padStart(2, '0')} 
                          <span className="text-gray-300 mx-2">/</span> 
                          {pTotal.toString().padStart(2, '0')}
                        </p>
                      </div>
                    </div>

                    <div className="bg-green-800 p-6 rounded-[2rem] text-white shadow-2xl shadow-green-900/20">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-black text-green-100/50 uppercase tracking-widest mb-1">Valor para Quitação Total</p>
                          <p className="text-3xl font-black">{formatCurrency(totalQuitacao)}</p>
                          <p className="text-[10px] font-bold text-green-100/30 uppercase mt-1">Ref. às {parcelasPendentes} parcelas restantes</p>
                        </div>
                        <div className="bg-white/10 p-4 rounded-2xl">
                          <Wallet size={24} className="text-green-100" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg p-8 rounded-t-[2.5rem] sm:rounded-[3rem] shadow-2xl animate-in slide-in-from-bottom sm:zoom-in duration-300">
            <div className="flex justify-between items-center mb-10">
              <h2 className="text-2xl font-black text-gray-900">{editingId ? 'Editar Parcelamento' : 'Novo Parcelamento'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-900 transition"><LucideX size={24} /></button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 ml-1 tracking-[0.1em]">Descrição</label>
                <input 
                  type="text" 
                  value={formData.desc} 
                  onChange={e => setFormData({...formData, desc: e.target.value})}
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-6 py-5 outline-none focus:border-green-700 font-bold text-lg text-gray-800"
                  placeholder="Ex: Notebook, Carro..."
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-1">
                  <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 ml-1 tracking-[0.1em]">Valor Parcela</label>
                  <input 
                    type="text" 
                    inputMode="numeric"
                    value={formData.val} 
                    onChange={e => setFormData({...formData, val: maskCurrency(e.target.value)})}
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-6 py-5 outline-none focus:border-green-700 font-black text-xl text-gray-800"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 ml-1 tracking-[0.1em]">Parc. Atual</label>
                  <input 
                    type="number" 
                    min="1"
                    value={formData.atual} 
                    onChange={e => setFormData({...formData, atual: e.target.value})}
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-6 py-5 outline-none focus:border-green-700 font-black text-xl text-center text-gray-800"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 ml-1 tracking-[0.1em]">Total de Parc.</label>
                  <input 
                    type="number" 
                    min="1"
                    value={formData.total} 
                    onChange={e => setFormData({...formData, total: e.target.value})}
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-6 py-5 outline-none focus:border-green-700 font-black text-xl text-center text-gray-800"
                    required
                  />
                </div>
              </div>

              <div className="bg-blue-50 p-5 rounded-2xl border border-blue-100 flex items-start gap-3">
                <Info size={20} className="text-blue-600 shrink-0 mt-0.5" />
                <p className="text-[10px] font-bold text-blue-800 leading-normal uppercase">
                  O valor de quitação agora é calculado automaticamente como: <br/>
                  <span className="text-blue-900 font-black">(Total - Atual + 1) × Valor da Parcela</span>
                </p>
              </div>

              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 bg-gray-100 text-gray-500 font-black py-5 rounded-2xl uppercase tracking-widest text-xs">Cancelar</button>
                <button type="submit" className="flex-1 bg-green-700 text-white font-black py-5 rounded-2xl shadow-xl shadow-green-900/20 uppercase tracking-widest text-xs">
                  {editingId ? 'Salvar Alterações' : 'Confirmar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Installments;
