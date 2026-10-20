import React, { useState, useEffect, useMemo } from 'react';
import { 
  UtensilsCrossed, 
  Sparkles, 
  Store, 
  Plus, 
  Trash2, 
  Pencil,
  X as LucideX, 
  Calendar, 
  Clock, 
  Receipt, 
  AlertCircle, 
  CheckCircle2, 
  Copy, 
  Check, 
  LockKeyhole,
  AlertTriangle,
  ArrowRight
} from 'lucide-react';
import { supabaseClient } from '../services/supabase';
import { Month, GastoItem, GastoCategoria } from '../types';

interface SpendingProps {
  currentMonth: Month;
}

interface CategoryConfig {
  key: GastoCategoria;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  accentColor: string;
  bgLight: string;
  borderLight: string;
  textColor: string;
  badgeBg: string;
  buttonBg: string;
  buttonHover: string;
  gradient: string;
}

const CATEGORIES: CategoryConfig[] = [
  {
    key: 'Restaurante',
    title: 'Restaurante',
    subtitle: 'Refeições fora, bares, cafeterias e delivery',
    icon: UtensilsCrossed,
    accentColor: '#f97316',
    bgLight: 'bg-orange-50/80',
    borderLight: 'border-orange-100',
    textColor: 'text-orange-950',
    badgeBg: 'bg-orange-100 text-orange-800',
    buttonBg: 'bg-orange-500',
    buttonHover: 'hover:bg-orange-600',
    gradient: 'from-orange-500/10 via-amber-500/5 to-transparent'
  },
  {
    key: 'Lazer',
    title: 'Lazer',
    subtitle: 'Cinema, passeios, viagens, shows e entretenimento',
    icon: Sparkles,
    accentColor: '#8b5cf6',
    bgLight: 'bg-purple-50/80',
    borderLight: 'border-purple-100',
    textColor: 'text-purple-950',
    badgeBg: 'bg-purple-100 text-purple-800',
    buttonBg: 'bg-purple-600',
    buttonHover: 'hover:bg-purple-700',
    gradient: 'from-purple-500/10 via-indigo-500/5 to-transparent'
  },
  {
    key: 'Conveniência',
    title: 'Conveniência',
    subtitle: 'Farmácia rápida, padarias, mercadinhos e compras de conveniência',
    icon: Store,
    accentColor: '#059669',
    bgLight: 'bg-emerald-50/80',
    borderLight: 'border-emerald-100',
    textColor: 'text-emerald-950',
    badgeBg: 'bg-emerald-100 text-emerald-800',
    buttonBg: 'bg-emerald-600',
    buttonHover: 'hover:bg-emerald-700',
    gradient: 'from-emerald-500/10 via-teal-500/5 to-transparent'
  }
];

// Helper para sanitizar ponto flutuante em exatamente 2 casas decimais
const sanitizeMoney = (val: number | null | undefined): number => {
  if (val == null || isNaN(val) || !isFinite(val)) return 0;
  return Math.round(Number(val) * 100) / 100;
};

// Formatação visual BRL padrão
const formatCurrency = (val: number | null | undefined): string => {
  const safeVal = sanitizeMoney(val);
  return new Intl.NumberFormat('pt-BR', { 
    style: 'currency', 
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(safeVal);
};

// Máscara monetária em tempo real ao digitar
const maskCurrency = (value: string): string => {
  const digits = value.replace(/\D/g, "");
  const amount = Number(digits) / 100;
  return new Intl.NumberFormat('pt-BR', { 
    style: 'currency', 
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

// Conversão segura de texto monetário para float com 2 casas
const parseCurrency = (value: string): number => {
  const clean = value.replace(/[^\d,]/g, '').replace(',', '.');
  const num = parseFloat(clean) || 0;
  return sanitizeMoney(num);
};

// Formatação segura de datas DD/MM/AAAA
const formatDateSafe = (dateStr: string | null | undefined): string => {
  if (!dateStr) return 'S/D';
  try {
    const parts = dateStr.split('T')[0].split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? 'S/D' : d.toLocaleDateString('pt-BR');
  } catch {
    return 'S/D';
  }
};

// Formatação de hora HH:mm
const formatTimeSafe = (timeStr: string | null | undefined, criadoEm?: string): string => {
  if (timeStr && timeStr.trim().length >= 4) {
    const parts = timeStr.split(':');
    if (parts.length >= 2) {
      return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
    }
  }
  if (criadoEm) {
    try {
      const d = new Date(criadoEm);
      if (!isNaN(d.getTime())) {
        return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      }
    } catch {
      // Ignora erro
    }
  }
  return '--:--';
};

const Spending: React.FC<SpendingProps> = ({ currentMonth }) => {
  const [items, setItems] = useState<GastoItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [tableMissing, setTableMissing] = useState<boolean>(false);
  const [copiedSql, setCopiedSql] = useState<boolean>(false);

  // Modal de Detalhes / Adição / Edição
  const [selectedCategory, setSelectedCategory] = useState<CategoryConfig | null>(null);
  const [editingItem, setEditingItem] = useState<GastoItem | null>(null);
  const [formVal, setFormVal] = useState<string>('R$ 0,00');
  const [formDate, setFormDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [formTime, setFormTime] = useState<string>(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  });
  const [formDesc, setFormDesc] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Modal de Exclusão de Gasto
  const [itemToDelete, setItemToDelete] = useState<GastoItem | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);

  // Toast temporário de feedback
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(prev => (prev?.message === message ? null : prev));
    }, 3500);
  };

  const isClosed = currentMonth.status === 'fechado';

  // Carrega os gastos associados estritamente ao mês corrente
  const fetchSpending = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabaseClient
        .from('gastos_itens')
        .select('*')
        .eq('mes_id', currentMonth.id)
        .order('data', { ascending: false })
        .order('criado_em', { ascending: false });

      if (error) {
        // Se a tabela ainda não foi criada no banco (código 42P01)
        if (error.code === '42P01' || error.message.includes('relation "gastos_itens" does not exist') || error.message.includes('not found')) {
          setTableMissing(true);
          setItems([]);
        } else {
          console.error("Erro ao carregar gastos:", error.message);
          showToast(`Erro ao carregar dados: ${error.message}`, 'error');
        }
      } else {
        setTableMissing(false);
        setItems(data || []);
      }
    } catch (err: any) {
      console.error("Falha de conexão com gastos:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSpending();
    const handleFocus = () => {
      fetchSpending();
    };
    window.addEventListener('focus', handleFocus);

    // Assinatura Realtime do Supabase para atualizar a lista ao vivo
    const channel = supabaseClient
      .channel(`gastos_realtime_${currentMonth.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'gastos_itens', filter: `mes_id=eq.${currentMonth.id}` },
        () => {
          fetchSpending();
        }
      )
      .subscribe();

    return () => {
      window.removeEventListener('focus', handleFocus);
      supabaseClient.removeChannel(channel);
    };
  }, [currentMonth.id]);

  // Cálculos de totais por categoria - Valor inicial sempre rigorosamente R$ 0,00 se vazio
  const categoryTotals = useMemo(() => {
    const totals: Record<string, { total: number; count: number }> = {
      'Restaurante': { total: 0, count: 0 },
      'Lazer': { total: 0, count: 0 },
      'Conveniência': { total: 0, count: 0 }
    };

    items.forEach(item => {
      const cat = item.categoria as GastoCategoria;
      if (totals[cat]) {
        totals[cat].total = sanitizeMoney(totals[cat].total + (item.valor || 0));
        totals[cat].count += 1;
      }
    });

    return totals;
  }, [items]);

  // Itens da categoria selecionada no modal
  const activeCategoryItems = useMemo(() => {
    if (!selectedCategory) return [];
    return items.filter(item => item.categoria === selectedCategory.key);
  }, [items, selectedCategory]);

  const currentCategoryTotal = useMemo(() => {
    if (!selectedCategory) return 0;
    return categoryTotals[selectedCategory.key]?.total || 0;
  }, [categoryTotals, selectedCategory]);

  // Abertura do modal de categoria
  const openCategoryModal = (cat: CategoryConfig) => {
    setSelectedCategory(cat);
    setEditingItem(null);
    setFormVal('R$ 0,00');
    setFormDate(new Date().toISOString().split('T')[0]);
    const d = new Date();
    setFormTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
    setFormDesc('');
  };

  const closeCategoryModal = () => {
    setSelectedCategory(null);
    setEditingItem(null);
    setFormVal('R$ 0,00');
    setFormDesc('');
  };

  // Iniciar edição de item existente
  const handleStartEdit = (item: GastoItem) => {
    setEditingItem(item);
    const cents = Math.round((item.valor || 0) * 100);
    setFormVal(maskCurrency(cents.toString()));
    setFormDate(item.data || new Date().toISOString().split('T')[0]);
    setFormTime(item.hora ? item.hora.substring(0, 5) : '12:00');
    setFormDesc(item.descricao || '');
  };

  // Cancelar edição
  const handleCancelEdit = () => {
    setEditingItem(null);
    setFormVal('R$ 0,00');
    setFormDesc('');
    setFormDate(new Date().toISOString().split('T')[0]);
    const d = new Date();
    setFormTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
  };

  // Salvar gasto (Adição ou Edição)
  const handleSaveSpending = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCategory || submitting || isClosed) return;

    const valorNumerico = parseCurrency(formVal);
    if (valorNumerico <= 0) {
      showToast('Por favor, informe um valor maior que R$ 0,00', 'error');
      return;
    }

    setSubmitting(true);
    const nowIso = new Date().toISOString();
    const horaFinal = formTime || `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`;

    try {
      if (editingItem) {
        // Atualização de registro existente
        const updatePayload = {
          valor: valorNumerico,
          descricao: formDesc.trim(),
          data: formDate || nowIso.split('T')[0],
          hora: horaFinal
        };

        if (tableMissing) {
          setItems(prev => prev.map(it => it.id === editingItem.id ? { ...it, ...updatePayload } : it));
        } else {
          const { error } = await supabaseClient
            .from('gastos_itens')
            .update(updatePayload)
            .eq('id', editingItem.id);

          if (error) throw error;

          setItems(prev => prev.map(it => it.id === editingItem.id ? { ...it, ...updatePayload } : it));
        }

        showToast('Lançamento atualizado com sucesso!', 'success');
        handleCancelEdit();
      } else {
        // Inserção de novo registro
        const newRecordPayload = {
          mes_id: currentMonth.id,
          categoria: selectedCategory.key,
          valor: valorNumerico,
          descricao: formDesc.trim(),
          data: formDate || nowIso.split('T')[0],
          hora: horaFinal,
          criado_em: nowIso
        };

        if (tableMissing) {
          const mockRecord: GastoItem = {
            id: Date.now(),
            ...newRecordPayload
          };
          setItems(prev => [mockRecord, ...prev]);
        } else {
          const { data, error } = await supabaseClient
            .from('gastos_itens')
            .insert([newRecordPayload])
            .select()
            .single();

          if (error) throw error;
          if (data) {
            setItems(prev => [data, ...prev]);
          }
        }

        showToast(`${formatCurrency(valorNumerico)} somado ao card ${selectedCategory.title}!`, 'success');
        setFormVal('R$ 0,00');
        setFormDesc('');
      }
    } catch (err: any) {
      console.error("Erro ao salvar gasto:", err);
      showToast(`Erro ao salvar: ${err.message || 'Falha de comunicação'}`, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Confirmação de exclusão pelo modal do próprio sistema
  const confirmDeleteSpending = async () => {
    if (!itemToDelete || deleting) return;

    setDeleting(true);
    try {
      if (!tableMissing) {
        const { error } = await supabaseClient
          .from('gastos_itens')
          .delete()
          .eq('id', itemToDelete.id);

        if (error) throw error;
      }

      setItems(prev => prev.filter(it => it.id !== itemToDelete.id));
      showToast(`Lançamento de ${formatCurrency(itemToDelete.valor)} removido com sucesso.`, 'success');
      setItemToDelete(null);
    } catch (err: any) {
      console.error("Erro ao excluir gasto:", err);
      showToast(`Erro ao excluir: ${err.message || 'Falha de comunicação'}`, 'error');
    } finally {
      setDeleting(false);
    }
  };

  // Código SQL completo e atualizado para a estrutura no Supabase
  const sqlScript = `-- ==============================================================================
-- SCRIPT SQL ATUALIZADO E CONSOLIDADO: MÓDULO GASTOS (SUPABASE)
-- Finalidade: Criação e padronização da tabela 'gastos_itens'
-- Execução: Supabase Dashboard > SQL Editor > New query > Run
-- ==============================================================================

-- 1. Criação da tabela principal 'gastos_itens' (caso não exista)
CREATE TABLE IF NOT EXISTS public.gastos_itens (
    id BIGSERIAL PRIMARY KEY,
    mes_id BIGINT NOT NULL REFERENCES public.meses(id) ON DELETE CASCADE,
    categoria TEXT NOT NULL,
    valor NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    descricao TEXT DEFAULT '',
    data DATE NOT NULL DEFAULT CURRENT_DATE,
    hora TIME NOT NULL DEFAULT CURRENT_TIME,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Garantia de tipo de dados NUMERIC(10, 2) (caso já exista com outro tipo)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'gastos_itens' 
          AND column_name = 'valor'
    ) THEN
        ALTER TABLE public.gastos_itens ALTER COLUMN valor TYPE NUMERIC(10, 2);
    END IF;
END $$;

-- 3. Índices de performance para busca por mês, categoria e ordenação cronológica
CREATE INDEX IF NOT EXISTS idx_gastos_itens_mes_categoria 
ON public.gastos_itens(mes_id, categoria);

CREATE INDEX IF NOT EXISTS idx_gastos_itens_data 
ON public.gastos_itens(data DESC, criado_em DESC);

-- 4. Habilitação de Row Level Security (RLS)
ALTER TABLE public.gastos_itens ENABLE ROW LEVEL SECURITY;

-- 5. Criação de política pública de acesso permissiva (alinhada às outras tabelas do sistema)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public'
          AND tablename = 'gastos_itens' 
          AND policyname = 'Acesso total publico gastos_itens'
    ) THEN
        CREATE POLICY "Acesso total publico gastos_itens" 
        ON public.gastos_itens 
        FOR ALL 
        TO public 
        USING (true) 
        WITH CHECK (true);
    END IF;
END $$;

-- 6. Função RPC para Atalho iOS (opcional: permite gravação direta no Supabase sem depender do servidor web)
CREATE OR REPLACE FUNCTION public.adicionar_gasto(p_valor NUMERIC, p_categoria TEXT)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_mes_id BIGINT;
  v_mes_nome TEXT;
  v_mes_ano INT;
  v_cat TEXT;
  v_novo_id BIGINT;
  v_novo_total NUMERIC;
BEGIN
  IF LOWER(TRIM(p_categoria)) IN ('restaurante', 'refeição', 'comida') THEN
    v_cat := 'Restaurante';
  ELSIF LOWER(TRIM(p_categoria)) IN ('lazer', 'diversão') THEN
    v_cat := 'Lazer';
  ELSIF LOWER(TRIM(p_categoria)) IN ('conveniencia', 'conveniência', 'mercado', 'farmacia') THEN
    v_cat := 'Conveniência';
  ELSE
    RAISE EXCEPTION 'Categoria inválida. Categorias aceitas: Restaurante, Lazer ou Conveniência.';
  END IF;

  SELECT id, nome, ano INTO v_mes_id, v_mes_nome, v_mes_ano
  FROM public.meses
  WHERE status = 'ativo'
  ORDER BY ano ASC, id ASC
  LIMIT 1;

  IF v_mes_id IS NULL THEN
    SELECT id, nome, ano INTO v_mes_id, v_mes_nome, v_mes_ano
    FROM public.meses
    ORDER BY id DESC
    LIMIT 1;
  END IF;

  INSERT INTO public.gastos_itens (mes_id, categoria, valor, descricao, data, hora, criado_em)
  VALUES (v_mes_id, v_cat, ROUND(p_valor, 2), v_cat, CURRENT_DATE, TO_CHAR(CURRENT_TIME, 'HH24:MI:SS'), NOW())
  RETURNING id INTO v_novo_id;

  SELECT COALESCE(SUM(valor), 0) INTO v_novo_total
  FROM public.gastos_itens
  WHERE mes_id = v_mes_id AND categoria = v_cat;

  RETURN json_build_object(
    'success', true,
    'id', v_novo_id,
    'categoria', v_cat,
    'valor', ROUND(p_valor, 2),
    'novo_acumulador_card', v_novo_total,
    'mes_referencia', v_mes_nome || ' ' || v_mes_ano
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.adicionar_gasto(NUMERIC, TEXT) TO anon, authenticated, service_role;`;

  const copySqlToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(sqlScript);
      setCopiedSql(true);
      showToast('Script SQL copiado com sucesso!', 'success');
      setTimeout(() => setCopiedSql(false), 3000);
    } catch {
      showToast('Falha ao copiar automaticamente. Selecione e copie o texto.', 'error');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-10">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl text-xs font-black uppercase tracking-wider animate-in slide-in-from-top-4 ${
          toast.type === 'success' 
            ? 'bg-emerald-950 text-emerald-100 border border-emerald-800' 
            : toast.type === 'error'
            ? 'bg-rose-950 text-rose-100 border border-rose-800'
            : 'bg-gray-900 text-white border border-gray-800'
        }`}>
          {toast.type === 'success' && <CheckCircle2 size={18} className="text-emerald-400" />}
          {toast.type === 'error' && <AlertCircle size={18} className="text-rose-400" />}
          {toast.type === 'info' && <Receipt size={18} className="text-blue-400" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Banner de Aviso de Tabela Não Criada no Supabase (se aplicável) */}
      {tableMissing && (
        <div className="bg-amber-50 border-2 border-amber-200 rounded-3xl p-6 lg:p-8 space-y-4 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="bg-amber-500 text-white p-3 rounded-2xl shrink-0">
              <AlertTriangle size={24} />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-black text-amber-950 uppercase tracking-tight">
                Tabela Supabase Pendente de Criação
              </h3>
              <p className="text-xs font-semibold text-amber-800 leading-relaxed">
                Para salvar os lançamentos no banco de dados com segurança e persistência, execute o script SQL abaixo no 
                <strong className="font-black text-amber-950"> Supabase &gt; SQL Editor</strong>.
              </p>
            </div>
          </div>

          <div className="relative bg-gray-900 text-gray-100 p-4 rounded-2xl font-mono text-[11px] overflow-x-auto max-h-48 border border-gray-800">
            <pre>{sqlScript}</pre>
            <button
              onClick={copySqlToClipboard}
              className="absolute top-3 right-3 flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
            >
              {copiedSql ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              {copiedSql ? 'Copiado' : 'Copiar SQL'}
            </button>
          </div>

          <p className="text-[11px] text-amber-700 font-bold uppercase tracking-wider">
            Após executar no Supabase, atualize a página. Seus lançamentos passarão a ser gravados permanentemente.
          </p>
        </div>
      )}

      {/* Grid com os 3 Cards Principais */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const stats = categoryTotals[cat.key] || { total: 0, count: 0 };
          const formattedVal = formatCurrency(stats.total);

          return (
            <div
              key={cat.key}
              onClick={() => openCategoryModal(cat)}
              className="group relative overflow-hidden bg-white border border-gray-200/80 rounded-3xl p-6 lg:p-7 shadow-sm hover:shadow-xl hover:border-gray-300 transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[200px]"
            >
              {/* Efeito de Gradiente Sutil */}
              <div className={`absolute -right-12 -top-12 w-40 h-40 rounded-full bg-gradient-to-br ${cat.gradient} pointer-events-none group-hover:scale-125 transition-transform duration-500`} />

              <div>
                <div className="flex items-center justify-between mb-5">
                  <div 
                    className="p-3.5 rounded-2xl shadow-xs transition-transform group-hover:scale-110 duration-300"
                    style={{ backgroundColor: `${cat.accentColor}18`, color: cat.accentColor }}
                  >
                    <Icon size={24} />
                  </div>
                  <span className={`text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-xl ${cat.badgeBg}`}>
                    {stats.count === 0 ? 'Sem registros' : `${stats.count} ${stats.count === 1 ? 'registro' : 'registros'}`}
                  </span>
                </div>

                <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight group-hover:text-gray-950 transition-colors">
                  {cat.title}
                </h3>
                <p className="text-[11px] text-gray-400 font-medium leading-relaxed mt-1 line-clamp-2">
                  {cat.subtitle}
                </p>
              </div>

              <div className="pt-6 border-t border-gray-100 flex items-end justify-between">
                <div>
                  <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block leading-none">
                    Total Acumulado
                  </span>
                  <span className={`text-2xl lg:text-3xl font-black mt-1.5 block tracking-tight ${cat.textColor}`}>
                    {formattedVal}
                  </span>
                </div>

                <div 
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-md ${cat.buttonBg} group-hover:scale-110 active:scale-95 transition-all`}
                  title="Abrir Histórico e Adicionar Gasto"
                >
                  <ArrowRight size={18} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL DE HISTÓRICO & ADIÇÃO/EDIÇÃO DE GASTO (OTIMIZADO PARA MOBILE) */}
      {selectedCategory && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl flex flex-col max-h-[90dvh] sm:max-h-[88vh] border border-gray-100 overflow-hidden my-auto">
            
            {/* Topo do Modal (Fixo) */}
            <div className="flex items-center justify-between border-b border-gray-100 px-5 sm:px-7 py-4 shrink-0 bg-white">
              <div className="flex items-center gap-3">
                <div 
                  className="p-3 rounded-2xl"
                  style={{ backgroundColor: `${selectedCategory.accentColor}18`, color: selectedCategory.accentColor }}
                >
                  <selectedCategory.icon size={22} />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-gray-950 uppercase tracking-tight">
                    {selectedCategory.title}
                  </h3>
                  <p className="text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                    {currentMonth.nome} {currentMonth.ano}
                  </p>
                </div>
              </div>
              <button
                onClick={closeCategoryModal}
                className="text-gray-400 hover:text-gray-700 p-2 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
                aria-label="Fechar modal"
              >
                <LucideX size={20} />
              </button>
            </div>

            {/* Corpo com Rolagem Interna no Mobile e Desktop */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 no-scrollbar">
              
              {/* Total Acumulado */}
              <div 
                className={`p-4 sm:p-5 rounded-2xl border flex items-center justify-between ${selectedCategory.bgLight} ${selectedCategory.borderLight}`}
              >
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-gray-500">
                    Total Acumulado
                  </p>
                  <p className={`text-2xl sm:text-3xl font-black mt-0.5 tracking-tight ${selectedCategory.textColor}`}>
                    {formatCurrency(currentCategoryTotal)}
                  </p>
                </div>
                <div className="text-right">
                  <span className={`text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-xl ${selectedCategory.badgeBg}`}>
                    {activeCategoryItems.length} {activeCategoryItems.length === 1 ? 'registro' : 'registros'}
                  </span>
                </div>
              </div>

              {/* Formulário de Adição/Edição de Gasto */}
              {!isClosed ? (
                <form onSubmit={handleSaveSpending} className="space-y-3.5 bg-gray-50/80 p-4 sm:p-5 rounded-2xl border border-gray-200/60">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black uppercase tracking-wider text-gray-900 flex items-center gap-1.5">
                      {editingItem ? <Pencil size={14} style={{ color: selectedCategory.accentColor }} /> : <Plus size={14} style={{ color: selectedCategory.accentColor }} />}
                      {editingItem ? 'Editar Lançamento' : 'Novo Lançamento'}
                    </h4>
                    {editingItem && (
                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        className="text-[10px] font-bold text-gray-500 hover:text-gray-800 underline uppercase cursor-pointer"
                      >
                        Cancelar edição
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {/* Valor */}
                    <div>
                      <label className="block text-[10px] font-black text-gray-500 uppercase tracking-wider mb-1">
                        Valor (R$) *
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={formVal}
                        onChange={(e) => setFormVal(maskCurrency(e.target.value))}
                        placeholder="R$ 0,00"
                        required
                        className="w-full bg-white border border-gray-200 focus:border-gray-900 rounded-xl px-3.5 py-2.5 text-base font-black text-gray-900 outline-none transition-all shadow-2xs"
                      />
                    </div>

                    {/* Data */}
                    <div>
                      <label className="block text-[10px] font-black text-gray-500 uppercase tracking-wider mb-1">
                        Data *
                      </label>
                      <input
                        type="date"
                        value={formDate}
                        onChange={(e) => setFormDate(e.target.value)}
                        required
                        className="w-full bg-white border border-gray-200 focus:border-gray-900 rounded-xl px-3 py-2.5 text-xs font-bold text-gray-900 outline-none transition-all shadow-2xs"
                      />
                    </div>

                    {/* Hora */}
                    <div>
                      <label className="block text-[10px] font-black text-gray-500 uppercase tracking-wider mb-1">
                        Hora
                      </label>
                      <input
                        type="time"
                        value={formTime}
                        onChange={(e) => setFormTime(e.target.value)}
                        className="w-full bg-white border border-gray-200 focus:border-gray-900 rounded-xl px-3 py-2.5 text-xs font-bold text-gray-900 outline-none transition-all shadow-2xs"
                      />
                    </div>
                  </div>

                  {/* Descrição Opcional */}
                  <div>
                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-wider mb-1">
                      Descrição / Local (Opcional)
                    </label>
                    <input
                      type="text"
                      value={formDesc}
                      onChange={(e) => setFormDesc(e.target.value)}
                      placeholder="Ex: Jantar em família, Cinema, Padaria..."
                      maxLength={100}
                      className="w-full bg-white border border-gray-200 focus:border-gray-900 rounded-xl px-3.5 py-2.5 text-xs font-bold text-gray-900 outline-none transition-all shadow-2xs"
                    />
                  </div>

                  {/* BOTÃO SALVAR - 100% visível e perfeitamente responsivo */}
                  <button
                    type="submit"
                    disabled={submitting || parseCurrency(formVal) <= 0}
                    className={`w-full text-white font-black py-3 sm:py-3.5 rounded-xl uppercase tracking-wider text-xs shadow-md active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 ${selectedCategory.buttonBg} ${selectedCategory.buttonHover}`}
                  >
                    <Check size={16} />
                    {submitting ? 'Salvando...' : 'SALVAR'}
                  </button>
                </form>
              ) : (
                <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-center gap-3 text-amber-900">
                  <LockKeyhole size={20} className="text-amber-700 shrink-0" />
                  <p className="text-xs font-bold leading-tight">
                    Este mês está fechado. O histórico de gastos está em modo somente leitura.
                  </p>
                </div>
              )}

              {/* Lista com Histórico de Lançamentos */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                  <h4 className="text-xs font-black uppercase tracking-wider text-gray-800">
                    Histórico de Registros ({activeCategoryItems.length})
                  </h4>
                  <span className="text-[10px] font-bold text-gray-400 uppercase">
                    Recentes primeiro
                  </span>
                </div>

                {activeCategoryItems.length === 0 ? (
                  <div className="text-center py-6 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
                    <Receipt size={26} className="mx-auto text-gray-300 mb-1.5" />
                    <p className="text-xs font-black uppercase tracking-wider text-gray-400">
                      Nenhum gasto registrado neste mês
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {activeCategoryItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between bg-gray-50/90 hover:bg-gray-100/80 p-3.5 rounded-2xl text-xs border border-gray-100 transition-colors"
                      >
                        <div className="space-y-0.5 max-w-[65%]">
                          <p className="font-black text-gray-900 truncate">
                            {item.descricao || selectedCategory.title}
                          </p>
                          <div className="flex items-center gap-3 text-[10px] font-bold text-gray-400">
                            <span className="flex items-center gap-1">
                              <Calendar size={12} />
                              {formatDateSafe(item.data)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock size={12} />
                              {formatTimeSafe(item.hora, item.criado_em)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-black ${selectedCategory.textColor}`}>
                            +{formatCurrency(item.valor)}
                          </span>
                          {!isClosed && (
                            <div className="flex items-center gap-0.5">
                              <button
                                type="button"
                                onClick={() => handleStartEdit(item)}
                                title="Editar"
                                className="text-gray-400 hover:text-blue-600 p-1.5 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer"
                              >
                                <Pencil size={15} />
                              </button>
                              <button
                                type="button"
                                onClick={() => setItemToDelete(item)}
                                title="Remover Gasto"
                                className="text-gray-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Rodapé Fixo do Modal */}
            <div className="px-5 sm:px-7 py-3 border-t border-gray-100 bg-gray-50/60 flex items-center justify-end shrink-0">
              <button
                type="button"
                onClick={closeCategoryModal}
                className="bg-white hover:bg-gray-100 text-gray-700 font-extrabold px-5 py-2.5 rounded-xl border border-gray-200 uppercase text-xs tracking-wider transition-colors cursor-pointer shadow-2xs"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO (DO PRÓPRIO SISTEMA) */}
      {itemToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-60 animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-5 text-center border border-gray-100">
            <div className="bg-rose-100 text-rose-600 p-3.5 rounded-2xl w-12 h-12 flex items-center justify-center mx-auto">
              <AlertTriangle size={24} />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base font-black text-gray-900 uppercase tracking-tight">
                Remover Lançamento?
              </h3>
              <p className="text-xs font-semibold text-gray-500 leading-relaxed">
                Deseja remover o registro de{' '}
                <strong className="text-gray-900 font-black">{formatCurrency(itemToDelete.valor)}</strong>{' '}
                em <strong className="text-gray-900 font-black">{itemToDelete.categoria}</strong>?
              </p>
              <div className="bg-amber-50 border border-amber-200/60 p-2.5 rounded-xl text-[11px] font-bold text-amber-800 mt-2">
                O valor será subtraído do total acumulado do card.
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
                onClick={confirmDeleteSpending}
                disabled={deleting}
                className="bg-rose-600 hover:bg-rose-700 text-white font-black py-3 rounded-xl text-xs uppercase tracking-wider shadow-lg shadow-rose-600/20 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Trash2 size={15} />
                {deleting ? 'Removendo...' : 'Remover'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Spending;
