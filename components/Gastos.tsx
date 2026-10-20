import React, { useState, useEffect, useMemo } from 'react';
import { 
  UtensilsCrossed, 
  Sparkles, 
  ShoppingBag, 
  Plus, 
  X as LucideX, 
  Trash2, 
  Clock, 
  Calendar, 
  CheckCircle2, 
  AlertCircle,
  AlertTriangle,
  ArrowUpRight
} from 'lucide-react';
import { supabaseClient } from '../services/supabase';
import { Month, GastoCategoria, GastoItem } from '../types';

interface GastosProps {
  currentMonth: Month;
}

interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

const CATEGORIAS_CONFIG: Record<GastoCategoria, {
  label: string;
  descricao: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  accentColor: string;
  bgLight: string;
  borderColor: string;
  textColor: string;
}> = {
  Restaurante: {
    label: 'Restaurante',
    descricao: 'Alimentação fora, jantares e lanches',
    icon: UtensilsCrossed,
    accentColor: 'from-orange-500 to-amber-600',
    bgLight: 'bg-orange-50',
    borderColor: 'border-orange-100 hover:border-orange-200',
    textColor: 'text-orange-700'
  },
  Lazer: {
    label: 'Lazer',
    descricao: 'Passeios, entretenimento e hobbies',
    icon: Sparkles,
    accentColor: 'from-purple-500 to-indigo-600',
    bgLight: 'bg-purple-50',
    borderColor: 'border-purple-100 hover:border-purple-200',
    textColor: 'text-purple-700'
  },
  'Conveniência': {
    label: 'Conveniência',
    descricao: 'Compras rápidas, farmácia e utilidades',
    icon: ShoppingBag,
    accentColor: 'from-emerald-500 to-teal-600',
    bgLight: 'bg-emerald-50',
    borderColor: 'border-emerald-100 hover:border-emerald-200',
    textColor: 'text-emerald-700'
  }
};

const maskCurrency = (value: string): string => {
  const digits = value.replace(/\D/g, "");
  const amount = Number(digits) / 100;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(amount);
};

const parseCurrency = (value: string): number => {
  return parseFloat(value.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
};

const formatCurrency = (val: number): string => {
  return new Intl.NumberFormat('pt-BR', { 
    style: 'currency', 
    currency: 'BRL' 
  }).format(val);
};

const formatDateTime = (isoStr: string | undefined) => {
  if (!isoStr) return { data: 'S/D', hora: '--:--' };
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return { data: 'S/D', hora: '--:--' };
    const data = d.toLocaleDateString('pt-BR');
    const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return { data, hora };
  } catch {
    return { data: 'S/D', hora: '--:--' };
  }
};

const Gastos: React.FC<GastosProps> = ({ currentMonth }) => {
  const [itens, setItens] = useState<GastoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<GastoCategoria | null>(null);
  
  // Form state
  const [valorInput, setValorInput] = useState<string>('R$ 0,00');
  const [dataInput, setDataInput] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [submitting, setSubmitting] = useState(false);
  
  // Custom delete confirmation modal state
  const [itemToDelete, setItemToDelete] = useState<GastoItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // In-app Toast notifications (no window.alert / confirm)
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Date.now().toString() + Math.random().toString();
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3500);
  };

  const MESES_NOMES = [
    "JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", 
    "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"
  ];

  const mesReferencia = useMemo(() => {
    return `${currentMonth.nome.trim().toUpperCase()}/${currentMonth.ano}`;
  }, [currentMonth.nome, currentMonth.ano]);

  const monthIdx = useMemo(() => {
    const idx = MESES_NOMES.indexOf(currentMonth.nome.trim().toUpperCase()) + 1;
    return idx > 0 ? idx : 0;
  }, [currentMonth.nome]);

  const mmStr = useMemo(() => {
    return monthIdx > 0 ? String(monthIdx).padStart(2, '0') : '';
  }, [monthIdx]);

  const fetchGastos = async () => {
    setLoading(true);
    try {
      const orConditions = [`mes_referencia.eq.${mesReferencia}`];
      if (mmStr) {
        orConditions.push(`mes_referencia.eq.${mmStr}/${currentMonth.ano}`);
        orConditions.push(`mes_referencia.eq.${currentMonth.ano}-${mmStr}`);
      }

      const { data, error } = await supabaseClient
        .from('gastos_itens')
        .select('*')
        .or(orConditions.join(','))
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Erro ao carregar gastos do Supabase:', error.message);
      }
      setItens((data as GastoItem[]) || []);
    } catch (err: any) {
      console.warn('Falha na consulta de gastos:', err);
      setItens([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGastos();
  }, [mesReferencia]);

  // Totais por categoria
  const totais = useMemo(() => {
    const acumulado: Record<GastoCategoria, number> = {
      Restaurante: 0,
      Lazer: 0,
      'Conveniência': 0
    };

    itens.forEach(item => {
      if (item.categoria && acumulado[item.categoria] !== undefined) {
        acumulado[item.categoria] += Number(item.valor) || 0;
      }
    });

    return acumulado;
  }, [itens]);

  const totalGeral = useMemo(() => {
    return totais.Restaurante + totais.Lazer + totais['Conveniência'];
  }, [totais]);

  const openCategoryModal = (cat: GastoCategoria) => {
    setActiveCategory(cat);
    setValorInput('R$ 0,00');
    setDataInput(new Date().toISOString().split('T')[0]);
  };

  const closeCategoryModal = () => {
    if (submitting) return;
    setActiveCategory(null);
    setValorInput('R$ 0,00');
  };

  const handleAddGasto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCategory || submitting) return;

    const valorNumerico = parseCurrency(valorInput);
    if (valorNumerico <= 0) {
      showToast('Por favor, informe um valor maior que zero.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      // Criação com data/hora escolhida ou atual
      const selectedDate = new Date();
      if (dataInput) {
        const parts = dataInput.split('-');
        if (parts.length === 3) {
          selectedDate.setFullYear(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        }
      }

      const payload = {
        categoria: activeCategory,
        valor: Number(valorNumerico.toFixed(2)),
        mes_referencia: mesReferencia,
        created_at: selectedDate.toISOString()
      };

      const { data, error } = await supabaseClient
        .from('gastos_itens')
        .insert([payload])
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

      // Adiciona na lista local para resposta instantânea
      const newItem: GastoItem = (data as GastoItem) || {
        id: Date.now(),
        ...payload
      };

      setItens(prev => [newItem, ...prev]);
      setValorInput('R$ 0,00');
      showToast(`${formatCurrency(valorNumerico)} adicionado a ${activeCategory}!`, 'success');
    } catch (err: any) {
      showToast(`Erro ao registrar gasto: ${err.message || 'Falha na conexão'}`, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDeleteGasto = async () => {
    if (!itemToDelete || deleting) return;
    setDeleting(true);
    try {
      const { error } = await supabaseClient
        .from('gastos_itens')
        .delete()
        .eq('id', itemToDelete.id);

      if (error) throw new Error(error.message);

      setItens(prev => prev.filter(i => String(i.id) !== String(itemToDelete.id)));
      showToast('Lançamento excluído com sucesso.', 'info');
      setItemToDelete(null);
    } catch (err: any) {
      showToast(`Erro ao excluir: ${err.message || 'Erro inesperado'}`, 'error');
    } finally {
      setDeleting(false);
    }
  };

  const itensDaCategoriaAtiva = useMemo(() => {
    if (!activeCategory) return [];
    return itens.filter(i => i.categoria === activeCategory);
  }, [itens, activeCategory]);

  const canEdit = currentMonth.status !== 'fechado';

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Toast Notification Container */}
      <div className="fixed top-5 right-5 z-[150] space-y-2 pointer-events-none max-w-sm w-full px-4">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`pointer-events-auto p-4 rounded-2xl shadow-xl border flex items-center gap-3 transition-all animate-in slide-in-from-top-3 ${
              toast.type === 'success' 
                ? 'bg-gray-900 text-white border-gray-800' 
                : toast.type === 'error'
                  ? 'bg-rose-900 text-white border-rose-800'
                  : 'bg-white text-gray-900 border-gray-200'
            }`}
          >
            {toast.type === 'success' && <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />}
            {toast.type === 'error' && <AlertCircle size={18} className="text-rose-400 shrink-0" />}
            {toast.type === 'info' && <AlertTriangle size={18} className="text-amber-500 shrink-0" />}
            <p className="text-xs font-bold leading-snug">{toast.message}</p>
          </div>
        ))}
      </div>

      {/* Cabeçalho Limpo e Direto */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-gray-900 uppercase tracking-tight">Gastos</h1>
        {!loading && (
          <div className="text-right">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Total Acumulado</span>
            <span className="text-xl font-black text-gray-900 tracking-tight leading-none">
              {formatCurrency(totalGeral)}
            </span>
          </div>
        )}
      </div>

      {/* Cards das 3 Categorias */}
      {loading ? (
        <div className="py-20 flex flex-col items-center gap-3 text-gray-400">
          <div className="w-8 h-8 border-3 border-gray-900 border-t-transparent rounded-full animate-spin"></div>
          <p className="font-bold uppercase tracking-widest text-[9px]">Carregando Gastos...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {(Object.keys(CATEGORIAS_CONFIG) as GastoCategoria[]).map((catKey) => {
            const config = CATEGORIAS_CONFIG[catKey];
            const Icon = config.icon;
            const valorTotal = totais[catKey] || 0;
            const count = itens.filter(i => i.categoria === catKey).length;

            return (
              <div
                key={catKey}
                onClick={() => openCategoryModal(catKey)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openCategoryModal(catKey);
                  }
                }}
                className={`group relative bg-white p-7 rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col justify-between overflow-hidden text-left`}
              >
                {/* Linha de topo com ícone e badge de contagem */}
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div className={`p-4 rounded-2xl ${config.bgLight} ${config.textColor} transition-transform duration-300 group-hover:scale-110 shadow-sm`}>
                      <Icon size={24} />
                    </div>
                    <div className="flex items-center gap-1.5 text-gray-400 group-hover:text-gray-900 transition-colors">
                      <span className="text-[10px] font-black uppercase tracking-wider">
                        {count} {count === 1 ? 'registro' : 'registros'}
                      </span>
                      <ArrowUpRight size={16} />
                    </div>
                  </div>

                  <h3 className="text-base font-black text-gray-900 uppercase tracking-tight mb-1">
                    {config.label}
                  </h3>
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-6">
                    {config.descricao}
                  </p>
                </div>

                {/* Valor Acumulado */}
                <div className="pt-4 border-t border-gray-50 flex items-end justify-between">
                  <div>
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1">
                      Mês de Referência
                    </span>
                    <span className="text-2xl font-black text-gray-900 tracking-tight block">
                      {formatCurrency(valorTotal)}
                    </span>
                  </div>
                  <span className="text-[10px] font-black text-gray-900 bg-gray-100 px-3 py-1.5 rounded-xl uppercase tracking-wider group-hover:bg-gray-900 group-hover:text-white transition-colors">
                    Adicionar
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL DE HISTÓRICO & ADICIONAR GASTO */}
      {activeCategory && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-[2rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-gray-100 animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-2xl ${CATEGORIAS_CONFIG[activeCategory].bgLight} ${CATEGORIAS_CONFIG[activeCategory].textColor}`}>
                  {React.createElement(CATEGORIAS_CONFIG[activeCategory].icon, { size: 22 })}
                </div>
                <div>
                  <h2 className="text-lg font-black text-gray-900 uppercase tracking-tight">
                    {CATEGORIAS_CONFIG[activeCategory].label}
                  </h2>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-0.5">
                    {mesReferencia}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeCategoryModal}
                disabled={submitting}
                className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
                title="Fechar"
              >
                <LucideX size={20} />
              </button>
            </div>

            {/* Modal Body com Scroll Interno para Mobile */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 no-scrollbar">
              {/* Card de Resumo do Acumulado no Mês */}
              <div className="bg-gray-50 border border-gray-100 p-5 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block">
                    Acumulado no Mês
                  </span>
                  <span className="text-2xl font-black text-gray-900 tracking-tight block mt-0.5">
                    {formatCurrency(totais[activeCategory] || 0)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-black text-gray-500 uppercase tracking-wider block">
                    {itensDaCategoriaAtiva.length} {itensDaCategoriaAtiva.length === 1 ? 'Lançamento' : 'Lançamentos'}
                  </span>
                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                    {currentMonth.nome} {currentMonth.ano}
                  </span>
                </div>
              </div>

              {/* Formulário de Adicionar Gasto */}
              {canEdit ? (
                <form onSubmit={handleAddGasto} className="bg-gray-50/70 p-5 rounded-2xl border border-gray-100 space-y-4">
                  <span className="text-[10px] font-black text-gray-700 uppercase tracking-widest block">
                    Novo Lançamento
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">
                        Valor (R$) *
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={valorInput}
                        onChange={(e) => setValorInput(maskCurrency(e.target.value))}
                        placeholder="R$ 0,00"
                        required
                        className="w-full bg-white border border-gray-200 focus:border-gray-900 rounded-xl px-4 py-3 text-base font-black text-gray-900 outline-none transition-all shadow-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">
                        Data *
                      </label>
                      <input
                        type="date"
                        value={dataInput}
                        onChange={(e) => setDataInput(e.target.value)}
                        required
                        className="w-full bg-white border border-gray-200 focus:border-gray-900 rounded-xl px-4 py-3 text-xs font-bold text-gray-900 outline-none transition-all shadow-xs"
                      />
                    </div>
                  </div>

                  {/* Botão de confirmação 100% visível */}
                  <button
                    type="submit"
                    disabled={submitting || parseCurrency(valorInput) <= 0}
                    className="w-full bg-gray-900 hover:bg-black text-white font-black py-3.5 rounded-xl uppercase tracking-wider text-xs shadow-lg shadow-gray-900/10 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus size={16} />
                    {submitting ? 'Adicionando...' : 'Adicionar Gasto'}
                  </button>
                </form>
              ) : (
                <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl text-[11px] font-bold text-amber-800 uppercase tracking-wider text-center">
                  Mês arquivado. Não é possível adicionar novos gastos.
                </div>
              )}

              {/* Lista do Histórico de Lançamentos */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-gray-800">
                    Histórico ({itensDaCategoriaAtiva.length})
                  </h4>
                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                    Ordem cronológica
                  </span>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {itensDaCategoriaAtiva.length === 0 ? (
                    <div className="bg-gray-50 border border-gray-100 rounded-2xl p-8 text-center">
                      <p className="text-[11px] text-gray-400 font-bold uppercase tracking-wider">
                        Nenhum gasto registrado nesta categoria para este mês.
                      </p>
                    </div>
                  ) : (
                    itensDaCategoriaAtiva.map((item) => {
                      const dt = formatDateTime(item.created_at);
                      return (
                        <div
                          key={item.id}
                          className="flex items-center justify-between bg-gray-50 hover:bg-gray-100/70 p-3.5 rounded-2xl border border-gray-100 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-white text-gray-500 shadow-xs">
                              <Clock size={15} />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-black text-gray-900">
                                  {dt.data}
                                </span>
                                <span className="text-[10px] font-bold text-gray-400">
                                  às {dt.hora}
                                </span>
                              </div>
                              <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider">
                                {item.categoria}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="text-sm font-black text-gray-900">
                              {formatCurrency(Number(item.valor))}
                            </span>
                            {canEdit && (
                              <button
                                type="button"
                                onClick={() => setItemToDelete(item)}
                                title="Excluir Gasto"
                                className="p-2 text-gray-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-end shrink-0">
              <button
                type="button"
                onClick={closeCategoryModal}
                disabled={submitting}
                className="px-5 py-2.5 bg-white border border-gray-200 text-gray-700 hover:bg-gray-100 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PRÓPRIO DE CONFIRMAÇÃO DE EXCLUSÃO (SEM ALERT/CONFIRM) */}
      {itemToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-[120] animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-5 text-center border border-gray-100 animate-in zoom-in-95 duration-150">
            <div className="bg-rose-100 text-rose-600 p-3.5 rounded-2xl w-12 h-12 flex items-center justify-center mx-auto">
              <AlertTriangle size={24} />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base font-black text-gray-900 uppercase tracking-tight">
                Excluir Lançamento?
              </h3>
              <p className="text-xs font-semibold text-gray-500 leading-relaxed">
                Deseja realmente remover o gasto de{' '}
                <strong className="text-gray-900 font-black">
                  {formatCurrency(Number(itemToDelete.valor))}
                </strong>{' '}
                em <strong className="text-gray-900 font-black">{itemToDelete.categoria}</strong>?
              </p>
              <div className="bg-amber-50 border border-amber-200/60 p-2.5 rounded-xl text-[11px] font-bold text-amber-800 mt-2">
                O valor será subtraído do total acumulado da categoria.
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                disabled={deleting}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-extrabold py-3 rounded-xl text-xs uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDeleteGasto}
                disabled={deleting}
                className="bg-rose-600 hover:bg-rose-700 text-white font-black py-3 rounded-xl text-xs uppercase tracking-wider shadow-lg shadow-rose-600/20 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Trash2 size={15} />
                {deleting ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Gastos;
