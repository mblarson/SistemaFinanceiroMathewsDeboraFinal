
import React, { useState, useEffect } from 'react';
import { CalendarClock, Trash2, X as LucideX, Info, Wallet, Pencil, RefreshCw } from 'lucide-react';
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
  const [projecting, setProjecting] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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
      
      const sorted = (data || []).slice().sort((a, b) => {
        const restA = (a.total_parcelas ?? 1) - (a.parcela_atual ?? 1);
        const restB = (b.total_parcelas ?? 1) - (b.parcela_atual ?? 1);
        
        if (restA !== restB) {
          return restA - restB;
        }
        
        const totalA = a.total_parcelas ?? 1;
        const totalB = b.total_parcelas ?? 1;
        if (totalA !== totalB) {
          return totalA - totalB;
        }
        
        const descA = a.descricao || '';
        const descB = b.descricao || '';
        const descComp = descA.localeCompare(descB);
        if (descComp !== 0) {
          return descComp;
        }

        return (a.id ?? 0) - (b.id ?? 0);
      });

      setInstallments(sorted);
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
    if (submitting) return;
    const val = parseCurrency(formData.val);
    
    setSubmitting(true);
    try {
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
    } catch (err: any) {
      alert("Erro ao salvar parcelamento: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    await supabaseClient.from('parcelamentos').delete().eq('id', id);
    setConfirmDeleteId(null);
    fetchData();
  };

  const canEdit = currentMonth.status !== 'fechado';

  const projectFutureInstallments = async () => {
    if (installments.length === 0) return;
    if (!confirm("Deseja projetar estes parcelamentos para os próximos 2 meses? Isso criará os registros em Maio e Junho (ou equivalentes) caso ainda não existam.")) return;

    setProjecting(true);
    try {
      const meses_nomes = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];
      let idx = meses_nomes.indexOf(currentMonth.nome.trim().toUpperCase());
      
      // M+1
      let nextIdx1 = (idx + 1) % 12;
      let nextYear1 = idx === 11 ? currentMonth.ano + 1 : currentMonth.ano;
      const nextMonthName1 = meses_nomes[nextIdx1];

      // M+2
      let nextIdx2 = (idx + 2) % 12;
      let nextYear2 = currentMonth.ano + Math.floor((idx + 2) / 12);
      const nextMonthName2 = meses_nomes[nextIdx2];

      const getOrCreateMonth = async (nome: string, ano: number) => {
        const { data: existing } = await supabaseClient
          .from('meses')
          .select('*')
          .ilike('nome', nome)
          .eq('ano', ano)
          .maybeSingle();

        if (existing) return existing;

        try {
          const { data: created, error } = await supabaseClient
            .from('meses')
            .insert([{ nome, ano, status: 'provisionamento' }])
            .select()
            .single();
          
          if (!error) return created;

          const { data: createdAtivo } = await supabaseClient
            .from('meses')
            .insert([{ nome, ano, status: 'ativo' }])
            .select()
            .single();
          
          return createdAtivo;
        } catch (e) {
          return null;
        }
      };

      const nextMonth1 = await getOrCreateMonth(nextMonthName1, nextYear1);
      const nextMonth2 = await getOrCreateMonth(nextMonthName2, nextYear2);

      if (!nextMonth1) {
        alert(`Erro: Não foi possível localizar ou criar o mês de destino (${nextMonthName1}/${nextYear1}).`);
        return;
      }

      const projectForMonth = async (targetMonthId: number, increment: number) => {
        const { data: existingInTarget } = await supabaseClient
          .from('parcelamentos')
          .select('descricao')
          .eq('mes_id', targetMonthId);
        
        const existingDescs = new Set(existingInTarget?.map(i => i.descricao) || []);

        const toInsert = installments
          .filter(i => (i.parcela_atual + increment) <= i.total_parcelas)
          .filter(i => !existingDescs.has(i.descricao))
          .map(i => ({
            mes_id: targetMonthId,
            descricao: i.descricao,
            valor_parcela: i.valor_parcela,
            parcela_atual: (i.parcela_atual || 0) + increment,
            total_parcelas: i.total_parcelas
          }));

        if (toInsert.length > 0) {
          await supabaseClient.from('parcelamentos').insert(toInsert);
        }
      };

      await projectForMonth(nextMonth1.id, 1);
      if (nextMonth2) {
        await projectForMonth(nextMonth2.id, 2);
      }

      alert("Projeção concluída com sucesso para os próximos meses!");
    } catch (err) {
      console.error("Erro na projeção manual:", err);
      alert("Ocorreu um erro ao projetar as parcelas.");
    } finally {
      setProjecting(false);
    }
  };

  const totalParcelasMes = installments.reduce((acc, item) => acc + (item.valor_parcela ?? 0), 0);
  const totalUltimaParcelaMes = installments
    .filter(item => (item.parcela_atual ?? 1) === (item.total_parcelas ?? 1))
    .reduce((acc, item) => acc + (item.valor_parcela ?? 0), 0);

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {loading ? (
        <div className="py-20 flex flex-col items-center gap-3 text-gray-400">
          <div className="w-8 h-8 border-3 border-green-700 border-t-transparent rounded-full animate-spin"></div>
          <p className="font-bold uppercase tracking-widest text-[9px]">Sincronizando...</p>
        </div>
      ) : (
        <>
          {installments.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {/* Total Geral de Parcelas */}
              <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="bg-emerald-50 p-3 rounded-2xl text-emerald-600 shrink-0">
                    <CalendarClock size={24} />
                  </div>
                  <div>
                    <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5 leading-none">Total Geral de Parcelas</h5>
                    <p className="text-xl font-black text-emerald-800 tracking-tight leading-none mt-1.5">{formatCurrency(totalParcelasMes)}</p>
                  </div>
                </div>
              </div>

              {/* Parcelas acabando esse mês */}
              <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="bg-blue-50 p-3 rounded-2xl text-blue-600 shrink-0">
                    <CalendarClock size={24} />
                  </div>
                  <div>
                    <h5 className="text-[10px] font-black text-gray-450 uppercase tracking-widest mb-0.5 leading-none">Parcelas acabando esse mês</h5>
                    <p className="text-xl font-black text-blue-800 tracking-tight leading-none mt-1.5">{formatCurrency(totalUltimaParcelaMes)}</p>
                  </div>
                </div>
              </div>

              {/* Botão de Projetar */}
              {canEdit ? (
                <div className="bg-white p-3 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-center">
                  <button 
                    onClick={projectFutureInstallments}
                    disabled={projecting}
                    className="w-full h-full min-h-[48px] flex items-center justify-center gap-2 bg-gray-900 text-white px-5 py-3.5 rounded-2xl text-[9px] font-black uppercase tracking-widest hover:bg-gray-800 active:scale-95 transition-all disabled:opacity-50 shadow-md cursor-pointer shrink-0"
                  >
                    <RefreshCw size={14} className={projecting ? 'animate-spin' : ''} />
                    {projecting ? 'Projetando...' : 'Projetar para Meses Futuros'}
                  </button>
                </div>
              ) : (
                <div className="bg-gray-50/50 p-5 rounded-3xl border border-dashed border-gray-200 flex items-center justify-center">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Mês Fechado para Edição</p>
                </div>
              )}
            </div>
          )}
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

              const isLast = pAtual === pTotal;

              return (
                <div 
                  key={item.id} 
                  className={`bg-white rounded-3xl p-5 border flex flex-col transition-all relative ${
                    isLast 
                      ? 'border-blue-500 animate-border-glow shadow-[0_0_15px_rgba(59,130,246,0.1)]' 
                      : 'border-gray-100 shadow-sm'
                  }`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`p-2 rounded-xl shrink-0 ${isLast ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-600'}`}>
                        <CalendarClock size={18} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <h4 className="font-black text-gray-800 text-sm truncate max-w-[120px]" title={item.descricao}>{item.descricao}</h4>
                          {isLast && (
                            <span className="bg-blue-600 text-white text-[8px] font-bold uppercase px-2 py-0.5 rounded-full tracking-wider border border-blue-400 shadow-sm animate-pulse-subtle">
                              ÚLTIMA
                            </span>
                          )}
                        </div>
                        <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">Pagas: {pagas}/{pTotal}</p>
                      </div>
                    </div>
                    {canEdit && (
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEditModal(item)} className="text-gray-400 hover:text-blue-600 p-2 bg-gray-50 rounded-lg transition-colors"><Pencil size={18} /></button>
                        {confirmDeleteId === item.id ? (
                          <button onClick={() => handleDelete(item.id)} className="bg-red-600 text-white font-black text-[9px] uppercase px-3 py-2 rounded-lg ml-2 shadow-sm">Confirmar</button>
                        ) : (
                          <button onClick={() => setConfirmDeleteId(item.id)} className="text-gray-400 hover:text-red-500 p-2 bg-gray-50 rounded-lg transition-colors"><Trash2 size={18} /></button>
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
      </>
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
                <button type="submit" disabled={submitting} className="flex-1 bg-green-800 text-white font-bold py-3.5 rounded-xl shadow-md uppercase text-[10px] tracking-widest disabled:opacity-50">
                  {submitting ? 'Salvando...' : 'Salvar'}
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
