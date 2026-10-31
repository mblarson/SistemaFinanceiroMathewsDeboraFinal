import React, { useState, useEffect, useMemo } from 'react';
import { 
  UtensilsCrossed, 
  Sparkles, 
  Store, 
  Plus, 
  Trash2, 
  X, 
  Calendar, 
  Building2, 
  Info, 
  ChevronRight, 
  CheckCircle2, 
  AlertTriangle,
  Receipt,
  TrendingDown
} from 'lucide-react';
import { supabaseClient } from '../services/supabase';
import { Month, GastoItem, GastoCategoria } from '../types';

interface GastosProps {
  currentMonth: Month;
  activeMonth?: Month | null;
  triggerAdd?: number;
}

interface CategoriaConfig {
  id: GastoCategoria;
  titulo: string;
  subtitulo: string;
  corGradiente: string;
  corIconeBg: string;
  corIconeText: string;
  corBordaHover: string;
  corValor: string;
  icone: React.ReactNode;
}

const CATEGORIAS_CONFIG: CategoriaConfig[] = [
  {
    id: 'Restaurante',
    titulo: 'Restaurante',
    subtitulo: 'Alimentação fora de casa, bares e delivery',
    corGradiente: 'from-amber-500/10 via-orange-500/5 to-transparent',
    corIconeBg: 'bg-amber-100',
    corIconeText: 'text-amber-700',
    corBordaHover: 'hover:border-amber-300',
    corValor: 'text-amber-700',
    icone: <UtensilsCrossed size={28} />
  },
  {
    id: 'Lazer',
    titulo: 'Lazer',
    subtitulo: 'Passeios, entretenimento, eventos e hobbies',
    corGradiente: 'from-violet-500/10 via-purple-500/5 to-transparent',
    corIconeBg: 'bg-purple-100',
    corIconeText: 'text-purple-700',
    corBordaHover: 'hover:border-purple-300',
    corValor: 'text-purple-700',
    icone: <Sparkles size={28} />
  },
  {
    id: 'Conveniência',
    titulo: 'Conveniência',
    subtitulo: 'Lojas de conveniência, farmácias rápidas e compras pontuais',
    corGradiente: 'from-emerald-500/10 via-teal-500/5 to-transparent',
    corIconeBg: 'bg-emerald-100',
    corIconeText: 'text-emerald-700',
    corBordaHover: 'hover:border-emerald-300',
    corValor: 'text-emerald-700',
    icone: <Store size={28} />
  }
];

const maskCurrency = (value: string) => {
  const digits = value.replace(/\D/g, '');
  const amount = Number(digits) / 100;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(amount);
};

const parseCurrency = (value: string) => {
  return parseFloat(value.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
};

const formatDateSafe = (dateStr: string | null | undefined) => {
  if (!dateStr) return 'S/D';
  try {
    const parts = dateStr.split('T')[0].split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? 'S/D' : d.toLocaleDateString('pt-BR');
  } catch (e) {
    return 'S/D';
  }
};

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
};

export const Gastos: React.FC<GastosProps> = ({ currentMonth, activeMonth, triggerAdd = 0 }) => {
  const [gastos, setGastos] = useState<GastoItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedCategoria, setSelectedCategoria] = useState<GastoCategoria | null>(null);
  const [isAdding, setIsAdding] = useState<boolean>(false);
  
  // Formulário de Adicionar Gasto
  const [formData, setFormData] = useState({
    data: new Date().toISOString().split('T')[0],
    valor: 'R$ 0,00',
    estabelecimento: ''
  });
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Modal próprio de confirmação de exclusão (sem alert/confirm)
  const [itemToDelete, setItemToDelete] = useState<GastoItem | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);

  // Toast feedback próprio do sistema
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Competência exibida na tela (para visualização dos dados do ciclo selecionado)
  const mesReferencia = useMemo(() => {
    return `${currentMonth.nome.trim().toUpperCase()}/${currentMonth.ano}`;
  }, [currentMonth]);

  // Competência do primeiro mês ativo para novos lançamentos (regra obrigatória de negócio)
  const mesAtivoDestino = useMemo(() => {
    if (activeMonth && activeMonth.status === 'ativo') {
      return `${activeMonth.nome.trim().toUpperCase()}/${activeMonth.ano}`;
    }
    if (currentMonth.status === 'ativo') {
      return `${currentMonth.nome.trim().toUpperCase()}/${currentMonth.ano}`;
    }
    return `${currentMonth.nome.trim().toUpperCase()}/${currentMonth.ano}`;
  }, [activeMonth, currentMonth]);

  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const getLocalStorageKey = (mesRef: string) => `gastos_itens_${mesRef}`;

  // Busca dados de gastos do mês ativo
  const fetchGastos = async () => {
    setLoading(true);
    try {
      // 1. Tenta buscar do Supabase
      const { data, error } = await supabaseClient
        .from('gastos_itens')
        .select('*')
        .eq('mes_referencia', mesReferencia)
        .order('data', { ascending: false })
        .order('id', { ascending: false });

      if (error) {
        console.warn('Aviso ao consultar gastos_itens no Supabase (utilizando fallback local):', error.message);
        // Fallback para cache local (localStorage)
        const localData = localStorage.getItem(getLocalStorageKey(mesReferencia));
        if (localData) {
          try {
            setGastos(JSON.parse(localData));
          } catch {
            setGastos([]);
          }
        } else {
          setGastos([]);
        }
      } else {
        const fetched = data || [];
        setGastos(fetched);
        // Atualiza espelho local
        localStorage.setItem(getLocalStorageKey(mesReferencia), JSON.stringify(fetched));
      }
    } catch (err: any) {
      console.error('Erro ao recuperar gastos:', err);
      const localData = localStorage.getItem(getLocalStorageKey(mesReferencia));
      setGastos(localData ? JSON.parse(localData) : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGastos();
    // Ao alternar mês, fechar modais abertos
    setSelectedCategoria(null);
    setIsAdding(false);
  }, [mesReferencia]);

  // Responde ao trigger global de adição (+) caso acionado
  useEffect(() => {
    if (triggerAdd > 0) {
      setSelectedCategoria('Restaurante');
      setIsAdding(true);
      setFormData({
        data: new Date().toISOString().split('T')[0],
        valor: 'R$ 0,00',
        estabelecimento: ''
      });
    }
  }, [triggerAdd]);

  // Totais por categoria (Inicia rigorosamente em R$ 0,00 se sem lançamentos)
  const totaisPorCategoria = useMemo(() => {
    const mapa: Record<GastoCategoria, { total: number; count: number }> = {
      Restaurante: { total: 0, count: 0 },
      Lazer: { total: 0, count: 0 },
      Conveniência: { total: 0, count: 0 }
    };

    gastos.forEach((item) => {
      const cat = item.categoria as GastoCategoria;
      if (mapa[cat]) {
        mapa[cat].total += Number(item.valor) || 0;
        mapa[cat].count += 1;
      }
    });

    return mapa;
  }, [gastos]);

  // Total Geral de Consumo (Informativo, 100% isolado de contabilidade)
  const totalGeralConsumo = useMemo(() => {
    return Object.values(totaisPorCategoria).reduce((acc, curr) => acc + curr.total, 0);
  }, [totaisPorCategoria]);

  // Abrir modal de categoria
  const handleOpenCategoriaModal = (cat: GastoCategoria) => {
    setSelectedCategoria(cat);
    setIsAdding(false);
    setFormData({
      data: new Date().toISOString().split('T')[0],
      valor: 'R$ 0,00',
      estabelecimento: ''
    });
  };

  // Submeter formulário de gasto
  const handleAddGasto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCategoria || submitting) return;

    const valorNumerico = parseCurrency(formData.valor);
    if (valorNumerico <= 0) {
      showToast('Informe um valor maior que R$ 0,00.', 'error');
      return;
    }

    if (!formData.data) {
      showToast('Informe uma data válida.', 'error');
      return;
    }

    setSubmitting(true);
    const payload = {
      categoria: selectedCategoria,
      valor: valorNumerico,
      data: formData.data,
      estabelecimento: formData.estabelecimento.trim() ? formData.estabelecimento.trim() : null,
      mes_referencia: mesAtivoDestino
    };

    try {
      // 1. Tenta salvar no Supabase
      const { data, error } = await supabaseClient
        .from('gastos_itens')
        .insert([payload])
        .select()
        .single();

      if (error) {
        console.warn('Erro ao inserir no Supabase (salvando localmente):', error.message);
        // Fallback local se a tabela ainda não estiver criada no Supabase
        const newItem: GastoItem = {
          id: Date.now().toString(),
          categoria: payload.categoria,
          valor: payload.valor,
          data: payload.data,
          estabelecimento: payload.estabelecimento,
          mes_referencia: payload.mes_referencia,
          created_at: new Date().toISOString()
        };

        if (mesAtivoDestino === mesReferencia) {
          const updated = [newItem, ...gastos];
          setGastos(updated);
          localStorage.setItem(getLocalStorageKey(mesReferencia), JSON.stringify(updated));
        }
        showToast(`Gasto salvo com sucesso! (Competência: ${mesAtivoDestino})`);
      } else {
        if (mesAtivoDestino === mesReferencia) {
          const updated = [data, ...gastos];
          setGastos(updated);
          localStorage.setItem(getLocalStorageKey(mesReferencia), JSON.stringify(updated));
          showToast('Gasto registrado com sucesso no mês ativo!', 'success');
        } else {
          showToast(`Gasto alocado com sucesso no primeiro mês ativo (${mesAtivoDestino})!`, 'success');
        }
      }

      // Limpa formulário e retorna à listagem da categoria
      setFormData({
        data: new Date().toISOString().split('T')[0],
        valor: 'R$ 0,00',
        estabelecimento: ''
      });
      setIsAdding(false);
    } catch (err: any) {
      console.error('Falha ao adicionar gasto:', err);
      showToast('Erro ao registrar gasto. Tente novamente.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Confirmar exclusão do gasto
  const handleConfirmDelete = async () => {
    if (!itemToDelete || deleting) return;
    setDeleting(true);

    try {
      // Tenta remover do Supabase
      if (typeof itemToDelete.id === 'number' || (typeof itemToDelete.id === 'string' && !itemToDelete.id.startsWith('local_'))) {
        const { error } = await supabaseClient
          .from('gastos_itens')
          .delete()
          .eq('id', itemToDelete.id);

        if (error) {
          console.warn('Erro ao deletar no Supabase:', error.message);
        }
      }

      // Remove do estado e do cache local
      const filtered = gastos.filter((g) => g.id !== itemToDelete.id);
      setGastos(filtered);
      localStorage.setItem(getLocalStorageKey(mesReferencia), JSON.stringify(filtered));

      showToast('Gasto removido com sucesso.', 'info');
      setItemToDelete(null);
    } catch (err) {
      console.error('Erro ao excluir item:', err);
      showToast('Erro ao excluir gasto.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  // Itens da categoria selecionada
  const itensDaCategoria = useMemo(() => {
    if (!selectedCategoria) return [];
    return gastos.filter((g) => g.categoria === selectedCategoria);
  }, [gastos, selectedCategoria]);

  const configCategoriaSelecionada = useMemo(() => {
    return CATEGORIAS_CONFIG.find((c) => c.id === selectedCategoria);
  }, [selectedCategoria]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* BANNER INFORMATIVO DE ISOLAMENTO CONTÁBIL */}
      <div className="bg-gradient-to-r from-blue-50 via-indigo-50/50 to-blue-50 border border-blue-200/60 p-4 lg:p-5 rounded-2xl lg:rounded-3xl flex items-start sm:items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="bg-blue-600 text-white p-2.5 rounded-xl lg:rounded-2xl shrink-0 shadow-sm">
            <Info size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xs lg:text-sm font-black text-blue-950 uppercase tracking-tight">
                Controle de Hábitos de Consumo
              </h2>
              <span className="bg-blue-200/70 text-blue-900 text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full">
                Uso Pessoal
              </span>
            </div>
            <p className="text-[10px] lg:text-xs text-blue-800/80 font-semibold mt-0.5">
              Este menu é 100% isolado. Os registros abaixo não afetam o Saldo Líquido, Saídas Totais, Receitas ou Faturas.
            </p>
          </div>
        </div>

        {/* Totalizador Acumulado do Mês */}
        <div className="hidden md:flex flex-col items-end shrink-0 pl-4 border-l border-blue-200/60">
          <span className="text-[9px] font-black uppercase tracking-widest text-blue-600/90">
            Total Consumo ({currentMonth.nome})
          </span>
          <span className="text-lg font-black text-blue-950 tracking-tight">
            {formatCurrency(totalGeralConsumo)}
          </span>
        </div>
      </div>

      {/* GRID COM OS 3 CARDS DE CATEGORIAS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
        {CATEGORIAS_CONFIG.map((cat) => {
          const dados = totaisPorCategoria[cat.id] || { total: 0, count: 0 };
          return (
            <div
              key={cat.id}
              onClick={() => handleOpenCategoriaModal(cat.id)}
              className={`bg-white rounded-3xl p-6 lg:p-8 border border-gray-150/70 shadow-md shadow-gray-200/40 cursor-pointer transition-all duration-300 hover:shadow-xl hover:-translate-y-1 group relative overflow-hidden flex flex-col justify-between ${cat.corBordaHover}`}
            >
              {/* Brilho decorativo no canto */}
              <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl ${cat.corGradiente} rounded-bl-full pointer-events-none opacity-80`} />

              <div>
                {/* Cabeçalho do Card */}
                <div className="flex items-center justify-between mb-6 relative z-10">
                  <div className={`p-3.5 rounded-2xl ${cat.corIconeBg} ${cat.corIconeText} shadow-xs transition-transform duration-300 group-hover:scale-105`}>
                    {cat.icone}
                  </div>
                  <span className="text-[10px] font-bold text-gray-400 bg-gray-50 border border-gray-100 px-2.5 py-1 rounded-full uppercase tracking-wider">
                    {dados.count} {dados.count === 1 ? 'lançamento' : 'lançamentos'}
                  </span>
                </div>

                {/* Título e Descrição */}
                <h3 className="text-xl font-black text-gray-900 tracking-tight mb-1 group-hover:text-gray-950 transition-colors">
                  {cat.titulo}
                </h3>
                <p className="text-[11px] text-gray-500 font-medium line-clamp-2 leading-relaxed">
                  {cat.subtitulo}
                </p>
              </div>

              {/* Valor Acumulado no Mês (Inicia rigorosamente em R$ 0,00) */}
              <div className="mt-8 pt-5 border-t border-gray-100 flex items-end justify-between relative z-10">
                <div>
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">
                    Gasto em {currentMonth.nome}
                  </p>
                  <p className={`text-2xl lg:text-3xl font-black tracking-tight leading-none ${cat.corValor}`}>
                    {formatCurrency(dados.total)}
                  </p>
                </div>
                <div className="bg-gray-50 p-2.5 rounded-full text-gray-400 group-hover:bg-gray-900 group-hover:text-white transition-all shadow-xs">
                  <ChevronRight size={18} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL DETALHAMENTO / HISTÓRICO DA CATEGORIA SELECIONADA */}
      {selectedCategoria && configCategoriaSelecionada && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-xl rounded-3xl lg:rounded-[2rem] shadow-2xl border border-gray-100 max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Cabeçalho do Modal */}
            <div className="p-6 border-b border-gray-100 flex items-center justify-between shrink-0 bg-white sticky top-0 z-10">
              <div className="flex items-center gap-3.5">
                <div className={`p-3 rounded-2xl ${configCategoriaSelecionada.corIconeBg} ${configCategoriaSelecionada.corIconeText} shadow-xs`}>
                  {configCategoriaSelecionada.icone}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight">
                      {configCategoriaSelecionada.titulo}
                    </h3>
                    <span className="text-[9px] font-black uppercase tracking-wider text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
                      {currentMonth.nome} {currentMonth.ano}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 font-semibold mt-0.5">
                    Acumulado: <strong className={`font-black ${configCategoriaSelecionada.corValor}`}>{formatCurrency(totaisPorCategoria[selectedCategoria]?.total || 0)}</strong>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSelectedCategoria(null);
                  setIsAdding(false);
                }}
                className="text-gray-400 hover:text-gray-700 p-2 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Corpo do Modal com Scroll Interno (Mobile e Desktop) */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 no-scrollbar">
              {/* Botão de alternar "Adicionar Gasto" */}
              {!isAdding ? (
                <button
                  type="button"
                  onClick={() => setIsAdding(true)}
                  className="w-full bg-gray-900 hover:bg-black text-white font-black py-4 px-6 rounded-2xl text-xs uppercase tracking-widest shadow-lg shadow-gray-900/15 flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.98] transition-all cursor-pointer"
                >
                  <Plus size={18} />
                  Adicionar Gasto em {configCategoriaSelecionada.titulo}
                </button>
              ) : (
                /* FORMULÁRIO DE ADIÇÃO DE GASTO */
                <form onSubmit={handleAddGasto} className="bg-gray-50/90 border border-gray-200/70 p-5 rounded-2xl space-y-4 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between pb-2 border-b border-gray-200/50">
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-700 flex items-center gap-1.5">
                      <Plus size={14} className="text-gray-900" />
                      Novo Lançamento
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-black text-emerald-800 bg-emerald-100/90 border border-emerald-300/60 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                        Competência: {mesAtivoDestino}
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsAdding(false)}
                        className="text-xs text-gray-400 hover:text-gray-600 font-bold cursor-pointer"
                      >
                        Fechar
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {/* Campo Data (Padrão: Hoje, permitindo alteração) */}
                    <div>
                      <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">
                        Data *
                      </label>
                      <div className="relative">
                        <input
                          type="date"
                          value={formData.data}
                          onChange={(e) => setFormData({ ...formData, data: e.target.value })}
                          className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-gray-900 font-bold text-xs text-gray-800 transition"
                          required
                        />
                      </div>
                    </div>

                    {/* Campo Valor (Máscara de Moeda Automática) */}
                    <div>
                      <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">
                        Valor *
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={formData.valor}
                        onChange={(e) => setFormData({ ...formData, valor: maskCurrency(e.target.value) })}
                        placeholder="R$ 0,00"
                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-gray-900 font-black text-sm text-gray-900 transition"
                        required
                      />
                    </div>
                  </div>

                  {/* Campo Estabelecimento (Livre e NÃO OBRIGATÓRIO) */}
                  <div>
                    <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">
                      Estabelecimento <span className="text-gray-400 font-semibold lowercase tracking-normal">(opcional)</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={formData.estabelecimento}
                        onChange={(e) => setFormData({ ...formData, estabelecimento: e.target.value })}
                        placeholder="Ex: Padaria Bela Vista, Outback, Posto Ipiranga..."
                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-gray-900 font-bold text-xs text-gray-800 transition"
                      />
                    </div>
                  </div>

                  {/* Ações do Formulário */}
                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsAdding(false)}
                      disabled={submitting}
                      className="flex-1 bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 font-bold py-3 rounded-xl text-xs uppercase tracking-wider transition-colors cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex-1 bg-gray-900 hover:bg-black text-white font-black py-3 rounded-xl text-xs uppercase tracking-widest shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {submitting ? 'Salvando...' : 'Confirmar Gasto'}
                    </button>
                  </div>
                </form>
              )}

              {/* LISTA DE HISTÓRICO DO MÊS */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    Histórico de Lançamentos ({itensDaCategoria.length})
                  </h4>
                  <span className="text-[9px] font-bold text-gray-400">
                    {currentMonth.nome} / {currentMonth.ano}
                  </span>
                </div>

                {loading ? (
                  <div className="py-12 flex flex-col items-center justify-center gap-3 text-gray-400">
                    <div className="w-8 h-8 border-3 border-gray-900 border-t-transparent rounded-full animate-spin" />
                    <p className="text-[10px] font-bold uppercase tracking-widest">Carregando histórico...</p>
                  </div>
                ) : itensDaCategoria.length === 0 ? (
                  <div className="py-12 bg-gray-50/80 rounded-2xl border border-dashed border-gray-200 flex flex-col items-center justify-center text-center p-6">
                    <Receipt size={32} className="text-gray-300 mb-2" />
                    <p className="text-xs font-bold text-gray-600">Nenhum gasto registrado neste mês</p>
                    <p className="text-[10px] text-gray-400 font-medium mt-0.5">
                      Clique em &quot;Adicionar Gasto&quot; para registrar o primeiro consumo nesta categoria.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {itensDaCategoria.map((item) => (
                      <div
                        key={item.id}
                        className="bg-white border border-gray-150 p-4 rounded-2xl flex items-center justify-between hover:border-gray-300 transition-all shadow-xs"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`p-2 rounded-xl ${configCategoriaSelecionada.corIconeBg} ${configCategoriaSelecionada.corIconeText} shrink-0`}>
                            <Calendar size={16} />
                          </div>
                          <div className="min-w-0">
                            {item.estabelecimento ? (
                              <>
                                <p className="text-xs font-bold text-gray-900 truncate" title={item.estabelecimento}>
                                  {item.estabelecimento}
                                </p>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                                    {formatDateSafe(item.data)}
                                  </p>
                                  {item.origem === 'apple_pay' && (
                                    <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 text-gray-600 bg-gray-100 rounded border border-gray-200/80">
                                      Apple Pay
                                    </span>
                                  )}
                                </div>
                              </>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <p className="text-xs font-bold text-gray-800">
                                  {formatDateSafe(item.data)}
                                </p>
                                {item.origem === 'apple_pay' && (
                                  <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 text-gray-600 bg-gray-100 rounded border border-gray-200/80">
                                    Apple Pay
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <span className={`text-sm font-black tracking-tight ${configCategoriaSelecionada.corValor}`}>
                            {formatCurrency(item.valor)}
                          </span>
                          <button
                            type="button"
                            onClick={() => setItemToDelete(item)}
                            title="Remover Gasto"
                            className="text-gray-300 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Rodapé do Modal */}
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between shrink-0">
              <span className="text-[10px] font-black uppercase tracking-wider text-gray-500">
                Soma da Categoria:
              </span>
              <span className={`text-base font-black ${configCategoriaSelecionada.corValor}`}>
                {formatCurrency(totaisPorCategoria[selectedCategoria]?.total || 0)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PRÓPRIO DE CONFIRMAÇÃO DE EXCLUSÃO (ZERO ALERT/CONFIRM NATIVO) */}
      {itemToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-gray-100 text-center space-y-4 animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
              <AlertTriangle size={24} />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-black text-gray-900 uppercase tracking-tight">
                Excluir Lançamento?
              </h3>
              <p className="text-xs text-gray-500 leading-relaxed">
                Deseja remover o gasto de{' '}
                <strong className="text-gray-900 font-black">{formatCurrency(itemToDelete.valor)}</strong>
                {itemToDelete.estabelecimento ? ` em "${itemToDelete.estabelecimento}"` : ''} registrado em {formatDateSafe(itemToDelete.data)}?
              </p>
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
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="bg-rose-600 hover:bg-rose-700 text-white font-black py-3 rounded-xl text-xs uppercase tracking-widest shadow-md active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Trash2 size={15} />
                {deleting ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST FEEDBACK FLUTUANTE PRÓPRIO */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-[70] animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div className={`px-5 py-3.5 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-black uppercase tracking-wider border ${
            toastMessage.type === 'error'
              ? 'bg-rose-600 text-white border-rose-700'
              : toastMessage.type === 'info'
              ? 'bg-blue-600 text-white border-blue-700'
              : 'bg-gray-900 text-white border-gray-800'
          }`}>
            <CheckCircle2 size={16} />
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default Gastos;
