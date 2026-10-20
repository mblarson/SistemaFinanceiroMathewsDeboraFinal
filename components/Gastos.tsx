import React, { useState, useEffect } from 'react';
import { 
  UtensilsCrossed, 
  Gamepad2, 
  Store, 
  Plus, 
  Trash2, 
  X as LucideX, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  ArrowUpRight,
  Receipt,
  FileText,
  Copy,
  Check,
  ChevronRight
} from 'lucide-react';
import { supabaseClient } from '../services/supabase';
import { Month, GastoItem, GastoCategoria } from '../types';

interface GastosProps {
  currentMonth: Month;
  triggerAdd?: number;
}

interface CategoryMeta {
  key: GastoCategoria;
  name: string;
  icon: React.ReactNode;
  accentBg: string;
  accentText: string;
  borderColor: string;
  lightBg: string;
  description: string;
}

const CATEGORIAS_CONFIG: CategoryMeta[] = [
  {
    key: 'Restaurante',
    name: 'Restaurante',
    icon: <UtensilsCrossed size={24} />,
    accentBg: 'bg-orange-500',
    accentText: 'text-orange-600',
    borderColor: 'border-orange-100 hover:border-orange-300',
    lightBg: 'bg-orange-50',
    description: 'Almoços, jantares, lanches e delivery'
  },
  {
    key: 'Lazer',
    name: 'Lazer',
    icon: <Gamepad2 size={24} />,
    accentBg: 'bg-indigo-500',
    accentText: 'text-indigo-600',
    borderColor: 'border-indigo-100 hover:border-indigo-300',
    lightBg: 'bg-indigo-50',
    description: 'Passeios, entretenimento, viagens e cinema'
  },
  {
    key: 'Conveniência',
    name: 'Conveniência',
    icon: <Store size={24} />,
    accentBg: 'bg-emerald-500',
    accentText: 'text-emerald-600',
    borderColor: 'border-emerald-100 hover:border-emerald-300',
    lightBg: 'bg-emerald-50',
    description: 'Farmácia, padaria, compras rápidas e imprevistos'
  }
];

export const formatBRL = (val: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(val || 0);
};

export const maskCurrencyInput = (value: string): string => {
  const digits = value.replace(/\D/g, '');
  const amount = Number(digits) / 100;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(amount);
};

export const parseCurrencyInput = (value: string): number => {
  return parseFloat(value.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
};

const Gastos: React.FC<GastosProps> = ({ currentMonth, triggerAdd }) => {
  const [items, setItems] = useState<GastoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<GastoCategoria | null>(null);

  // Formulário de Adicionar Gasto
  const [isAdding, setIsAdding] = useState(false);
  const [formValor, setFormValor] = useState('R$ 0,00');
  const [formDataStr, setFormDataStr] = useState(new Date().toISOString().split('T')[0]);
  const [formHora, setFormHora] = useState(
    new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  );
  const [formObs, setFormObs] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Confirmação customizada de exclusão (sem window.confirm)
  const [itemToDelete, setItemToDelete] = useState<GastoItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Sistema de Notificação Toast interno (sem window.alert)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Referência do mês ativo em formato de texto uniforme
  const mesReferencia = `${currentMonth.nome.trim().toUpperCase()}/${currentMonth.ano}`;

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3500);
  };

  // Carrega lançamentos do Supabase para o mês de referência selecionado
  const fetchGastos = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabaseClient
        .from('gastos_itens')
        .select('*')
        .eq('mes_referencia', mesReferencia)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Aviso ao carregar gastos do Supabase, buscando fallback local:', error.message);
        const rawLocal = localStorage.getItem('supabase_fallback_db');
        if (rawLocal) {
          try {
            const db = JSON.parse(rawLocal);
            const localGastos = (db.gastos_itens || []).filter(
              (item: any) => item.mes_referencia === mesReferencia
            );
            setItems(localGastos);
          } catch {
            setItems([]);
          }
        } else {
          setItems([]);
        }
      } else {
        setItems(data || []);
      }
    } catch (err: any) {
      console.error('Erro ao buscar gastos:', err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGastos();
  }, [currentMonth.id, currentMonth.nome, currentMonth.ano]);

  // Se o botão "+" global do sistema for clicado na tela de Gastos
  useEffect(() => {
    if (triggerAdd && triggerAdd > 0) {
      setSelectedCategory('Restaurante');
      setIsAdding(true);
      setFormValor('R$ 0,00');
      setFormDataStr(new Date().toISOString().split('T')[0]);
      setFormHora(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
      setFormObs('');
    }
  }, [triggerAdd]);

  // Itens filtrados pela categoria selecionada
  const categoryItems = selectedCategory
    ? items.filter((item) => {
        const itemCat = (item.categoria || '')
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase();
        const selCat = selectedCategory
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase();
        return itemCat === selCat;
      })
    : [];

  // Cálculo dos totais acumulados por categoria (iniciam rigorosamente em R$ 0,00)
  const getCategoryTotal = (cat: GastoCategoria): number => {
    const catClean = cat.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    return items
      .filter((i) => (i.categoria || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() === catClean)
      .reduce((acc, curr) => acc + (Number(curr.valor) || 0), 0);
  };

  const getCategoryCount = (cat: GastoCategoria): number => {
    const catClean = cat.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    return items.filter((i) => (i.categoria || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() === catClean).length;
  };

  // Total acumulado geral do módulo Gastos no mês atual
  const totalGeral = items.reduce((acc, curr) => acc + (Number(curr.valor) || 0), 0);

  // Abertura do modal de histórico da categoria
  const handleOpenCategory = (cat: GastoCategoria) => {
    setSelectedCategory(cat);
    setIsAdding(false);
    setFormValor('R$ 0,00');
    setFormDataStr(new Date().toISOString().split('T')[0]);
    setFormHora(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    setFormObs('');
  };

  const handleCloseModal = () => {
    setSelectedCategory(null);
    setIsAdding(false);
    setItemToDelete(null);
  };

  // Submissão de novo gasto no fluxo
  const handleSaveGasto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCategory || submitting) return;

    const valorNumerico = parseCurrencyInput(formValor);
    if (valorNumerico <= 0) {
      showToast('Informe um valor maior que zero.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      // Monta data e hora
      let createdIso = new Date().toISOString();
      if (formDataStr) {
        const timePart = formHora ? `${formHora}:00` : '12:00:00';
        try {
          const combined = new Date(`${formDataStr}T${timePart}`);
          if (!isNaN(combined.getTime())) {
            createdIso = combined.toISOString();
          }
        } catch {
          // mantém default ISO
        }
      }

      const novoGastoPayload = {
        categoria: selectedCategory,
        valor: Number(valorNumerico.toFixed(2)),
        mes_referencia: mesReferencia,
        created_at: createdIso,
        observacao: formObs.trim() || undefined
      };

      let itemSalvo: GastoItem;

      try {
        const { data, error } = await supabaseClient
          .from('gastos_itens')
          .insert([novoGastoPayload])
          .select()
          .single();

        if (error) throw error;
        itemSalvo = data;
      } catch (sbError: any) {
        console.warn('Persistindo localmente devido ao status do banco:', sbError.message);
        itemSalvo = {
          id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `local-${Date.now()}`,
          ...novoGastoPayload
        };
        // Salva no banco de fallback local
        const rawLocal = localStorage.getItem('supabase_fallback_db');
        const db = rawLocal ? JSON.parse(rawLocal) : {};
        if (!Array.isArray(db.gastos_itens)) db.gastos_itens = [];
        db.gastos_itens.unshift(itemSalvo);
        localStorage.setItem('supabase_fallback_db', JSON.stringify(db));
      }

      // Atualiza o estado local somando o valor acumulado ao card
      setItems((prev) => [itemSalvo, ...prev]);
      setIsAdding(false);
      setFormValor('R$ 0,00');
      setFormObs('');

      showToast(`Gasto de ${formatBRL(valorNumerico)} adicionado em ${selectedCategory}!`, 'success');
    } catch (err: any) {
      console.error('Erro ao salvar gasto:', err);
      showToast('Falha ao registrar gasto: ' + (err.message || 'Erro inesperado'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Exclusão de lançamento
  const handleDeleteItem = async () => {
    if (!itemToDelete || deleting) return;

    setDeleting(true);
    try {
      try {
        const { error } = await supabaseClient
          .from('gastos_itens')
          .delete()
          .eq('id', itemToDelete.id);

        if (error) throw error;
      } catch (sbErr) {
        // Fallback local
        const rawLocal = localStorage.getItem('supabase_fallback_db');
        if (rawLocal) {
          const db = JSON.parse(rawLocal);
          if (Array.isArray(db.gastos_itens)) {
            db.gastos_itens = db.gastos_itens.filter((i: any) => i.id !== itemToDelete.id);
            localStorage.setItem('supabase_fallback_db', JSON.stringify(db));
          }
        }
      }

      setItems((prev) => prev.filter((i) => i.id !== itemToDelete.id));
      showToast('Lançamento excluído com sucesso.', 'success');
      setItemToDelete(null);
    } catch (err: any) {
      console.error('Erro ao excluir item:', err);
      showToast('Erro ao excluir: ' + (err.message || 'Erro desconhecido'), 'error');
    } finally {
      setDeleting(false);
    }
  };

  const selectedMeta = CATEGORIAS_CONFIG.find((c) => c.key === selectedCategory);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Toast Notifier */}
      {toast && (
        <div 
          className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl border text-sm font-black tracking-wide transition-all duration-300 animate-in slide-in-from-top-3 ${
            toast.type === 'success' 
              ? 'bg-gray-900 text-white border-emerald-500/50 shadow-emerald-950/20' 
              : 'bg-red-950 text-white border-red-500/50 shadow-red-950/20'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 size={20} className="text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle size={20} className="text-red-400 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* CABEÇALHO LIMPO E PROFISSIONAL */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-gray-100">
        <div>
          <h1 className="text-2xl lg:text-3xl font-black text-gray-900 tracking-tight uppercase">
            Gastos
          </h1>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">
            Acompanhamento Pessoal &bull; {currentMonth.nome} {currentMonth.ano}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-4 py-2 bg-white rounded-2xl border border-gray-200/80 shadow-sm flex items-center gap-2.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">Total Acumulado:</span>
            <span className="text-base font-black text-gray-900">{formatBRL(totalGeral)}</span>
          </div>
        </div>
      </div>

      {/* GRID DOS 3 CARDS DE CATEGORIAS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {CATEGORIAS_CONFIG.map((cat) => {
          const totalCat = getCategoryTotal(cat.key);
          const countCat = getCategoryCount(cat.key);

          return (
            <div
              key={cat.key}
              onClick={() => handleOpenCategory(cat.key)}
              className={`group relative bg-white rounded-[2rem] p-6 lg:p-8 border ${cat.borderColor} shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col justify-between overflow-hidden`}
            >
              {/* Topo do Card */}
              <div className="flex items-start justify-between mb-6">
                <div className={`p-3.5 rounded-2xl ${cat.lightBg} ${cat.accentText} group-hover:scale-110 transition-transform duration-300`}>
                  {cat.icon}
                </div>
                <div className="flex items-center gap-1.5 text-gray-400 group-hover:text-gray-900 transition-colors">
                  <span className="text-[10px] font-black uppercase tracking-widest">Ver &bull; Lançar</span>
                  <ArrowUpRight size={16} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </div>
              </div>

              {/* Corpo com Categoria e Valor Acumulado */}
              <div className="space-y-2">
                <h2 className="text-lg font-black text-gray-900 tracking-tight uppercase">
                  {cat.name}
                </h2>
                <div className="text-3xl lg:text-4xl font-black text-gray-900 tracking-tight">
                  {formatBRL(totalCat)}
                </div>
              </div>

              {/* Rodapé com contagem de lançamentos */}
              <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between text-xs font-bold text-gray-400">
                <span>{countCat} {countCat === 1 ? 'lançamento' : 'lançamentos'}</span>
                <span className="text-[10px] uppercase tracking-wider text-gray-500 font-black">
                  {totalCat > 0 ? 'Ativo no mês' : 'Zerado (R$ 0,00)'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL / PAINEL DE HISTÓRICO DA CATEGORIA (SEM ALERT/CONFIRM, MOBILE-SAFE COM SCROLL INTERNO) */}
      {selectedCategory && selectedMeta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div 
            className="bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl border border-gray-200 flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabeçalho do Modal */}
            <div className="p-6 lg:p-8 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 shrink-0">
              <div className="flex items-center gap-3.5">
                <div className={`p-3 rounded-2xl ${selectedMeta.lightBg} ${selectedMeta.accentText}`}>
                  {selectedMeta.icon}
                </div>
                <div>
                  <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight">
                    {selectedMeta.name}
                  </h3>
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                    {currentMonth.nome} {currentMonth.ano} &bull; Total: {formatBRL(getCategoryTotal(selectedCategory))}
                  </p>
                </div>
              </div>

              <button
                onClick={handleCloseModal}
                className="p-2.5 rounded-2xl text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-all"
                aria-label="Fechar"
              >
                <LucideX size={20} />
              </button>
            </div>

            {/* Conteúdo com scroll interno seguro no mobile */}
            <div className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-6">
              {/* Botão de alternar formulário "Adicionar Gasto" */}
              {!isAdding ? (
                <button
                  type="button"
                  onClick={() => setIsAdding(true)}
                  className="w-full py-4 px-6 bg-gray-900 hover:bg-black text-white font-black text-xs uppercase tracking-[0.2em] rounded-2xl shadow-xl flex items-center justify-center gap-3 transition-all active:scale-[0.98]"
                >
                  <Plus size={18} />
                  <span>Adicionar Gasto</span>
                </button>
              ) : (
                /* Formulário de Adicionar Gasto */
                <form onSubmit={handleSaveGasto} className="bg-gray-50 border border-gray-200/80 p-5 rounded-3xl space-y-4 animate-in fade-in">
                  <div className="flex items-center justify-between pb-2 border-b border-gray-200/60">
                    <span className="text-xs font-black uppercase tracking-wider text-gray-800">
                      Novo Lançamento em {selectedMeta.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsAdding(false)}
                      className="text-gray-400 hover:text-gray-600 text-xs font-bold"
                    >
                      Cancelar
                    </button>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
                      Valor do Gasto *
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      required
                      value={formValor}
                      onChange={(e) => setFormValor(maskCurrencyInput(e.target.value))}
                      placeholder="R$ 0,00"
                      className="w-full text-2xl font-black px-4 py-3 bg-white border border-gray-200 rounded-2xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 transition-all"
                      autoFocus
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
                        Data
                      </label>
                      <input
                        type="date"
                        value={formDataStr}
                        onChange={(e) => setFormDataStr(e.target.value)}
                        className="w-full text-xs font-bold px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
                        Hora
                      </label>
                      <input
                        type="time"
                        value={formHora}
                        onChange={(e) => setFormHora(e.target.value)}
                        className="w-full text-xs font-bold px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
                      Observação (Opcional)
                    </label>
                    <input
                      type="text"
                      value={formObs}
                      onChange={(e) => setFormObs(e.target.value)}
                      placeholder="Ex: Almoço de negócios, lanche..."
                      className="w-full text-xs font-medium px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                  >
                    {submitting ? 'Salvando...' : 'Confirmar e Somar ao Card'}
                  </button>
                </form>
              )}

              {/* Lista de Histórico Interno da Categoria */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-gray-500">
                    Histórico de Lançamentos ({categoryItems.length})
                  </h4>
                  <span className="text-[10px] font-bold text-gray-400">
                    {mesReferencia}
                  </span>
                </div>

                {categoryItems.length === 0 ? (
                  <div className="py-10 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                      Nenhum gasto nesta categoria em {currentMonth.nome}.
                    </p>
                    <p className="text-[11px] text-gray-400 mt-1">
                      Clique em "Adicionar Gasto" acima para registrar o primeiro valor.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {categoryItems.map((item) => {
                      const itemDate = item.created_at ? new Date(item.created_at) : new Date();
                      const dateStr = !isNaN(itemDate.getTime())
                        ? itemDate.toLocaleDateString('pt-BR')
                        : 'Hoje';
                      const timeStr = !isNaN(itemDate.getTime())
                        ? itemDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                        : '--:--';

                      return (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-3.5 bg-white rounded-2xl border border-gray-100 hover:border-gray-200 shadow-sm transition-all"
                        >
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-gray-100 rounded-xl text-gray-600">
                              <Receipt size={16} />
                            </div>
                            <div>
                              <div className="text-sm font-black text-gray-900">
                                {formatBRL(item.valor)}
                              </div>
                              <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                                <span>{dateStr}</span>
                                <span>&bull;</span>
                                <span>{timeStr}</span>
                                {item.observacao && (
                                  <>
                                    <span>&bull;</span>
                                    <span className="text-gray-600 truncate max-w-[120px]">
                                      {item.observacao}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => setItemToDelete(item)}
                            className="p-2 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                            title="Excluir lançamento"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Rodapé fixo do Modal */}
            <div className="p-4 lg:p-6 border-t border-gray-100 bg-gray-50 flex items-center justify-between shrink-0">
              <span className="text-xs font-bold text-gray-500">
                Total Acumulado: <strong className="text-gray-900 font-black">{formatBRL(getCategoryTotal(selectedCategory))}</strong>
              </span>
              <button
                type="button"
                onClick={handleCloseModal}
                className="px-5 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-800 font-black text-xs uppercase tracking-wider rounded-xl transition-all"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO (100% IN-APP, SEM CONFIRM DO NAVEGADOR) */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-gray-200 text-center space-y-4 animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <Trash2 size={24} />
            </div>
            <div>
              <h4 className="text-base font-black text-gray-900 uppercase">
                Excluir Lançamento?
              </h4>
              <p className="text-xs text-gray-500 mt-1">
                Deseja remover o lançamento de <strong>{formatBRL(itemToDelete.valor)}</strong> da categoria {itemToDelete.categoria}?
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                className="py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-black text-xs uppercase rounded-xl transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDeleteItem}
                className="py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white font-black text-xs uppercase rounded-xl shadow transition-all"
              >
                {deleting ? 'Excluindo...' : 'Sim, Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Gastos;
