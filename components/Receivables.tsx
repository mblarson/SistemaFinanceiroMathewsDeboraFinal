import React, { useState, useEffect, useMemo } from 'react';
import { 
  HandCoins, 
  Plus, 
  Trash2, 
  Pencil, 
  X as LucideX, 
  Search, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Wallet, 
  Calendar, 
  Check, 
  ArrowRight,
  TrendingUp,
  Receipt,
  FileText
} from 'lucide-react';
import { supabaseClient } from '../services/supabase';
import { Month, ContaReceberVenda, ContaReceberParcela } from '../types';

interface ReceivablesProps {
  currentMonth: Month;
  activeMonth?: Month | null;
  provisionMonth?: Month | null;
  triggerAdd?: number;
}

const MESES_NOMES = [
  "JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", 
  "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"
];

const getMonthIndex = (nome: string) => MESES_NOMES.indexOf((nome || '').trim().toUpperCase());
const getMonthVal = (m: Month) => m.ano * 12 + getMonthIndex(m.nome);

const Receivables: React.FC<ReceivablesProps> = ({ 
  currentMonth, 
  activeMonth, 
  provisionMonth, 
  triggerAdd = 0 
}) => {
  const [parcelas, setParcelas] = useState<ContaReceberParcela[]>([]);
  const [allMonthsList, setAllMonthsList] = useState<Month[]>([]);
  const [activeMonthsList, setActiveMonthsList] = useState<Month[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [termoBusca, setTermoBusca] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Modal Adicionar Venda
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    descricao: '',
    valor_parcela: 'R$ 0,00',
    total_parcelas: '6',
    mes_inicio_id: ''
  });

  // Modal Edição de Parcela
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingParcela, setEditingParcela] = useState<ContaReceberParcela | null>(null);
  const [editForm, setEditForm] = useState({
    descricao: '',
    valor_parcela: 'R$ 0,00',
    status: 'pendente' as 'pendente' | 'recebido'
  });

  // Confirmações em Cascata
  const [showEditCascadeModal, setShowEditCascadeModal] = useState(false);
  const [pendingEditPayload, setPendingEditPayload] = useState<any | null>(null);

  const [showDeleteCascadeModal, setShowDeleteCascadeModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<ContaReceberParcela | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(prev => (prev?.message === message ? null : prev));
    }, 4000);
  };

  const isPrimeiroMes = useMemo(() => {
    if (activeMonth && currentMonth.id === activeMonth.id) return true;
    if (activeMonthsList.length > 0 && currentMonth.id === activeMonthsList[0].id) return true;
    return false;
  }, [activeMonth, currentMonth, activeMonthsList]);

  const isSegundoMes = useMemo(() => {
    if (provisionMonth && currentMonth.id === provisionMonth.id) return true;
    if (activeMonthsList.length > 1 && currentMonth.id === activeMonthsList[1].id) return true;
    return false;
  }, [provisionMonth, currentMonth, activeMonthsList]);

  const canEdit = currentMonth.status !== 'fechado';

  const maskCurrency = (value: string) => {
    const digits = value.replace(/\D/g, "");
    const amount = Number(digits) / 100;
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount);
  };

  const parseCurrency = (value: string) => parseFloat(value.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const normalizarTexto = (texto: string) =>
    (texto || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

  // Helper para buscar ou criar mês no banco
  const getOrCreateMonth = async (nome: string, ano: number): Promise<Month | null> => {
    const nomeUpper = nome.toUpperCase();
    const { data: existing } = await supabaseClient
      .from('meses')
      .select('*')
      .ilike('nome', nomeUpper)
      .eq('ano', ano)
      .maybeSingle();

    if (existing) return existing;

    try {
      const { data: createdAtivo, error: errAtivo } = await supabaseClient
        .from('meses')
        .insert([{ nome: nomeUpper, ano, status: 'ativo' }])
        .select()
        .single();

      if (!errAtivo && createdAtivo) return createdAtivo;
    } catch (e) {
      console.warn("Aviso ao criar mês para projeção de contas a receber:", e);
    }

    return {
      id: Math.floor(Math.random() * 10000) + 100,
      nome: nomeUpper,
      ano,
      status: 'ativo',
      saldo_final: 0
    };
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      // Carrega meses
      const { data: mData } = await supabaseClient
        .from('meses')
        .select('*')
        .order('ano', { ascending: true });

      if (mData) {
        setAllMonthsList(mData);
        const act = mData
          .filter(m => m.status === 'ativo')
          .sort((a, b) => getMonthVal(a) - getMonthVal(b));
        setActiveMonthsList(act);
      }

      // Busca parcelas do mês atual por mes_id ou mes_referencia
      const mesRef = `${currentMonth.nome.trim().toUpperCase()}/${currentMonth.ano}`;
      
      const { data: pData, error: pError } = await supabaseClient
        .from('contas_receber_parcelas')
        .select('*');

      if (pData) {
        // Filtra para o mês atual (por mes_id ou mes_referencia)
        const filtered = pData.filter(p => {
          if (p.mes_id != null && p.mes_id === currentMonth.id) return true;
          const ref = (p.mes_referencia || '').trim().toUpperCase();
          return ref === mesRef || ref === currentMonth.nome.trim().toUpperCase();
        });

        // Ordena: pendentes primeiro, depois por número da parcela
        filtered.sort((a, b) => {
          if (a.status !== b.status) {
            return a.status === 'pendente' ? -1 : 1;
          }
          return (a.numero_parcela || 1) - (b.numero_parcela || 1);
        });

        setParcelas(filtered);
      } else {
        setParcelas([]);
      }
    } catch (err: any) {
      console.error("Erro ao carregar contas a receber:", err);
      showToast("Não foi possível carregar os recebíveis.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentMonth]);

  useEffect(() => {
    if (triggerAdd > 0) {
      if (isSegundoMes) {
        showToast("Modificação não permitida para esse mês", "info");
        return;
      }
      openAddModal();
    }
  }, [triggerAdd, isSegundoMes]);

  const openAddModal = () => {
    if (isSegundoMes) {
      showToast("Modificação não permitida para esse mês", "info");
      return;
    }
    setAddForm({
      descricao: '',
      valor_parcela: 'R$ 0,00',
      total_parcelas: '6',
      mes_inicio_id: String(currentMonth.id)
    });
    setShowAddModal(true);
  };

  const openEditModal = (item: ContaReceberParcela) => {
    if (isSegundoMes) {
      showToast("Modificação não permitida para esse mês", "info");
      return;
    }
    setEditingParcela(item);
    setEditForm({
      descricao: item.descricao || '',
      valor_parcela: maskCurrency(((item.valor_parcela || 0) * 100).toString()),
      status: item.status || 'pendente'
    });
    setShowEditModal(true);
  };

  const openDeleteModal = (item: ContaReceberParcela) => {
    if (isSegundoMes) {
      showToast("Modificação não permitida para esse mês", "info");
      return;
    }
    setItemToDelete(item);
    setShowDeleteCascadeModal(true);
  };

  // Criação da Venda e Projeção Automática de Parcelas
  const handleCreateVenda = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    const desc = addForm.descricao.trim();
    const valParcela = parseCurrency(addForm.valor_parcela);
    const totalParc = parseInt(addForm.total_parcelas, 10);

    if (!desc) {
      showToast("Informe a descrição do produto vendido.", "error");
      return;
    }
    if (valParcela <= 0) {
      showToast("O valor da parcela deve ser maior que zero.", "error");
      return;
    }
    if (isNaN(totalParc) || totalParc <= 0 || totalParc > 72) {
      showToast("A quantidade de parcelas deve ser entre 1 e 72.", "error");
      return;
    }

    setSubmitting(true);
    try {
      const selectedMonthId = parseInt(addForm.mes_inicio_id || String(currentMonth.id), 10);
      const startMonth = allMonthsList.find(m => m.id === selectedMonthId) || currentMonth;
      
      const startMonthIdx = getMonthIndex(startMonth.nome);
      const startYear = startMonth.ano;
      const vendaId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `venda_${Date.now()}`;
      const valorTotal = Number((valParcela * totalParc).toFixed(2));
      const mesInicioStr = `${startMonth.nome.trim().toUpperCase()}/${startYear}`;

      // 1. Cria registro mestre em contas_receber_vendas
      const vendaPayload: ContaReceberVenda = {
        id: vendaId,
        descricao: desc,
        valor_total: valorTotal,
        valor_parcela: valParcela,
        total_parcelas: totalParc,
        mes_inicio: mesInicioStr
      };

      try {
        await supabaseClient.from('contas_receber_vendas').insert([vendaPayload]);
      } catch (errVenda) {
        console.warn("Aviso ao salvar cabeçalho da venda (fallback ativo):", errVenda);
      }

      // 2. Projeta e gera as N parcelas individuais distribuídas mês a mês
      const parcelasToInsert: any[] = [];

      for (let i = 0; i < totalParc; i++) {
        const currentIdx = (startMonthIdx + i) % 12;
        const currentYr = startYear + Math.floor((startMonthIdx + i) / 12);
        const monthName = MESES_NOMES[currentIdx];
        const mesReferencia = `${monthName}/${currentYr}`;

        // Localiza ou garante existência do mês correspondente
        let targetMonth = allMonthsList.find(m => 
          m.ano === currentYr && m.nome.trim().toUpperCase() === monthName
        );

        if (!targetMonth) {
          targetMonth = (await getOrCreateMonth(monthName, currentYr)) || undefined;
        }

        const parcelaItem = {
          id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `parc_${Date.now()}_${i + 1}`,
          venda_id: vendaId,
          descricao: desc,
          numero_parcela: i + 1,
          total_parcelas: totalParc,
          valor_parcela: valParcela,
          mes_referencia: mesReferencia,
          mes_id: targetMonth ? targetMonth.id : null,
          status: 'pendente'
        };

        parcelasToInsert.push(parcelaItem);
      }

      const { error: insertParcError } = await supabaseClient
        .from('contas_receber_parcelas')
        .insert(parcelasToInsert);

      if (insertParcError) {
        console.error("Erro ao inserir parcelas de contas a receber:", insertParcError);
      }

      setShowAddModal(false);
      showToast(`Venda registrada com sucesso! ${totalParc} parcelas projetadas nos meses seguintes.`, "success");
      await fetchData();
    } catch (err: any) {
      console.error("Erro fatal ao criar venda parcelada:", err);
      showToast("Erro ao lançar venda: " + (err.message || "Tente novamente"), "error");
      await fetchData();
    } finally {
      setSubmitting(false);
    }
  };

  // Toggle rápido de status (Pendente / Recebido)
  const handleToggleStatus = async (item: ContaReceberParcela) => {
    if (isSegundoMes || !canEdit) {
      showToast("Modificação não permitida para esse mês", "info");
      return;
    }

    const nextStatus = item.status === 'recebido' ? 'pendente' : 'recebido';
    const dataRecebimento = nextStatus === 'recebido' ? new Date().toISOString().split('T')[0] : null;

    // Atualização otimista
    setParcelas(prev => prev.map(p => p.id === item.id ? { ...p, status: nextStatus, data_recebimento: dataRecebimento } : p));

    try {
      await supabaseClient
        .from('contas_receber_parcelas')
        .update({ status: nextStatus, data_recebimento: dataRecebimento })
        .eq('id', item.id);

      showToast(nextStatus === 'recebido' ? "Parcela marcada como recebida!" : "Parcela marcada como pendente.", "success");
    } catch (err: any) {
      console.error("Erro ao alternar status da parcela:", err);
      showToast("Erro ao atualizar status.", "error");
      await fetchData();
    }
  };

  // Edição de Parcela
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingParcela || submitting) return;

    if (isSegundoMes) {
      showToast("Modificação não permitida para esse mês", "error");
      return;
    }

    const val = parseCurrency(editForm.valor_parcela);
    const desc = editForm.descricao.trim();

    if (!desc) {
      showToast("Informe a descrição.", "error");
      return;
    }
    if (val <= 0) {
      showToast("O valor da parcela deve ser maior que zero.", "error");
      return;
    }

    const payload = {
      descricao: desc,
      valor_parcela: val,
      status: editForm.status,
      data_recebimento: editForm.status === 'recebido' ? (editingParcela.data_recebimento || new Date().toISOString().split('T')[0]) : null
    };

    // Se estiver no 1º mês ativo, abre confirmação de alteração em cascata
    if (isPrimeiroMes) {
      setPendingEditPayload(payload);
      setShowEditCascadeModal(true);
      return;
    }

    await saveEdit(payload, false);
  };

  const saveEdit = async (payload: any, applyCascade: boolean) => {
    if (!editingParcela) return;
    setSubmitting(true);
    try {
      // Atualiza a parcela corrente
      await supabaseClient
        .from('contas_receber_parcelas')
        .update(payload)
        .eq('id', editingParcela.id);

      // Se confirmado em cascata no 1º mês ativo:
      if (applyCascade && isPrimeiroMes) {
        // Atualiza parcelas subsequentes da mesma venda (onde numero_parcela > atual)
        const cascadePayload = {
          descricao: payload.descricao,
          valor_parcela: payload.valor_parcela
        };

        await supabaseClient
          .from('contas_receber_parcelas')
          .update(cascadePayload)
          .eq('venda_id', editingParcela.venda_id)
          .gte('numero_parcela', editingParcela.numero_parcela);
      }

      setShowEditCascadeModal(false);
      setShowEditModal(false);
      setEditingParcela(null);
      setPendingEditPayload(null);
      showToast(
        applyCascade 
          ? "Parcela atualizada e replicada para as parcelas futuras com sucesso!" 
          : "Parcela atualizada com sucesso!", 
        "success"
      );
      await fetchData();
    } catch (err: any) {
      console.error("Erro ao salvar edição:", err);
      showToast("Erro ao salvar alterações.", "error");
      await fetchData();
    } finally {
      setSubmitting(false);
    }
  };

  // Exclusão de Parcela / Venda
  const handleExecuteDelete = async (cascade: boolean) => {
    if (!itemToDelete || submitting) return;
    setSubmitting(true);
    try {
      if (cascade && isPrimeiroMes) {
        // Exclui a parcela atual e todas as parcelas futuras da mesma venda
        await supabaseClient
          .from('contas_receber_parcelas')
          .delete()
          .eq('venda_id', itemToDelete.venda_id)
          .gte('numero_parcela', itemToDelete.numero_parcela);

        // Se a parcela excluída era a 1ª, remove também a venda mestre
        if (itemToDelete.numero_parcela === 1) {
          try {
            await supabaseClient
              .from('contas_receber_vendas')
              .delete()
              .eq('id', itemToDelete.venda_id);
          } catch (e) {
            // Ignora erro de FK ou cascade automático
          }
        }
      } else {
        // Exclui apenas esta parcela deste mês
        await supabaseClient
          .from('contas_receber_parcelas')
          .delete()
          .eq('id', itemToDelete.id);
      }

      setParcelas(prev => prev.filter(p => p.id !== itemToDelete.id));
      setShowDeleteCascadeModal(false);
      setItemToDelete(null);
      showToast(
        cascade 
          ? "Parcela e cobranças futuras excluídas com sucesso!" 
          : "Parcela excluída deste mês!", 
        "success"
      );
      await fetchData();
    } catch (err: any) {
      console.error("Erro ao excluir parcela:", err);
      showToast("Erro ao excluir parcela.", "error");
      await fetchData();
    } finally {
      setSubmitting(false);
    }
  };

  // Totais Contábeis do Mês
  const totalReceberMes = useMemo(() => {
    return parcelas.reduce((acc, p) => acc + (p.valor_parcela || 0), 0);
  }, [parcelas]);

  const totalRecebidoMes = useMemo(() => {
    return parcelas
      .filter(p => p.status === 'recebido')
      .reduce((acc, p) => acc + (p.valor_parcela || 0), 0);
  }, [parcelas]);

  const totalPendenteMes = useMemo(() => {
    return parcelas
      .filter(p => p.status !== 'recebido')
      .reduce((acc, p) => acc + (p.valor_parcela || 0), 0);
  }, [parcelas]);

  const totalUltimaParcelaMes = useMemo(() => {
    return parcelas
      .filter(p => p.numero_parcela === p.total_parcelas)
      .reduce((acc, p) => acc + (p.valor_parcela || 0), 0);
  }, [parcelas]);

  // Filtro de Busca Reativo em Tempo Real
  const parcelasFiltradas = useMemo(() => {
    const busca = normalizarTexto(termoBusca);
    if (!busca) return parcelas;
    return parcelas.filter(p => normalizarTexto(p.descricao || '').includes(busca));
  }, [parcelas, termoBusca]);

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {loading ? (
        <div className="py-20 flex flex-col items-center gap-3 text-gray-400">
          <div className="w-8 h-8 border-3 border-emerald-700 border-t-transparent rounded-full animate-spin"></div>
          <p className="font-bold uppercase tracking-widest text-[9px]">Sincronizando Contas a Receber...</p>
        </div>
      ) : (
        <>
          {/* Top Cards de Totais */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            
            {/* Total a Receber no Mês */}
            <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between gap-4 lg:rounded-3xl lg:shadow-md lg:shadow-gray-200/50 lg:border-gray-150/70 lg:hover:shadow-lg lg:transition-all">
              <div className="flex items-center gap-3.5">
                <div className="bg-emerald-50 p-3 rounded-2xl text-emerald-600 shrink-0 lg:rounded-2xl lg:shadow-xs">
                  <HandCoins size={24} />
                </div>
                <div>
                  <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5 leading-none">Total a Receber no Mês</h5>
                  <p className="text-xl font-black text-emerald-800 tracking-tight leading-none mt-1.5">{formatCurrency(totalReceberMes)}</p>
                  <p className="text-[9px] font-bold text-gray-400 mt-1">
                    Recebido: <span className="text-emerald-700">{formatCurrency(totalRecebidoMes)}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Pendente / Últimas Parcelas */}
            <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between gap-4 lg:rounded-3xl lg:shadow-md lg:shadow-gray-200/50 lg:border-gray-150/70 lg:hover:shadow-lg lg:transition-all">
              <div className="flex items-center gap-3.5">
                <div className="bg-blue-50 p-3 rounded-2xl text-blue-600 shrink-0 lg:rounded-2xl lg:shadow-xs">
                  <Clock size={24} />
                </div>
                <div>
                  <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5 leading-none">Ainda Pendente</h5>
                  <p className="text-xl font-black text-blue-800 tracking-tight leading-none mt-1.5">{formatCurrency(totalPendenteMes)}</p>
                  <p className="text-[9px] font-bold text-gray-400 mt-1">
                    Finalizando este mês: <span className="text-blue-700">{formatCurrency(totalUltimaParcelaMes)}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Ação: Botão Adicionar Venda */}
            <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm flex flex-col justify-center gap-2 lg:rounded-3xl lg:shadow-md lg:shadow-gray-200/50 lg:border-gray-150/70">
              {canEdit ? (
                <button
                  type="button"
                  onClick={openAddModal}
                  disabled={isSegundoMes}
                  title={isSegundoMes ? "Modificação não permitida para esse mês" : "Lançar nova venda parcelada"}
                  className={`w-full flex-1 min-h-[44px] flex items-center justify-center gap-2 bg-gray-900 text-white px-5 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all shadow-md shrink-0 lg:rounded-2xl lg:shadow-md ${
                    isSegundoMes
                      ? 'opacity-40 cursor-not-allowed hover:bg-gray-900 pointer-events-auto'
                      : 'hover:bg-gray-800 active:scale-95 cursor-pointer lg:hover:shadow-lg lg:hover:-translate-y-0.5'
                  }`}
                >
                  <Plus size={16} />
                  Adicionar venda
                </button>
              ) : (
                <div className="w-full py-2 flex items-center justify-center">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Mês Fechado para Edição</p>
                </div>
              )}
            </div>
          </div>

          {/* Barra de Pesquisa em Tempo Real - 100% da largura útil */}
          <div className="w-full mb-6">
            <div className="relative flex items-center w-full">
              <input
                type="text"
                value={termoBusca}
                onChange={(e) => setTermoBusca(e.target.value)}
                placeholder="Buscar venda a receber por descrição..."
                className="w-full h-12 sm:h-14 pl-5 sm:pl-6 pr-24 sm:pr-28 bg-white text-gray-800 placeholder-gray-400 text-sm font-medium rounded-full border border-gray-200 shadow-xs focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 focus:outline-none transition-all"
              />
              
              {/* Botões à direita: Limpar (se houver texto) e Botão circular escuro com Lupa */}
              <div className="absolute right-2 sm:right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                {termoBusca && (
                  <button
                    type="button"
                    onClick={() => setTermoBusca('')}
                    className="p-1.5 text-gray-400 hover:text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-full transition-all cursor-pointer"
                    title="Limpar pesquisa"
                  >
                    <LucideX size={14} />
                  </button>
                )}
                <div 
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gray-900 text-white flex items-center justify-center shadow-sm shrink-0 pointer-events-none"
                >
                  <Search size={16} className="text-white" />
                </div>
              </div>
            </div>
          </div>

          {/* Grid de Cards de Recebíveis */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {parcelas.length === 0 ? (
              <div className="col-span-full py-20 bg-white rounded-3xl border border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 lg:rounded-3xl lg:shadow-sm">
                <HandCoins size={36} className="mb-2 opacity-20" />
                <p className="font-bold uppercase tracking-widest text-[10px]">Sem vendas a receber para {currentMonth.nome}</p>
                {canEdit && !isSegundoMes && (
                  <button
                    onClick={openAddModal}
                    className="mt-4 px-4 py-2 bg-gray-900 text-white rounded-full text-xs font-semibold hover:bg-gray-800 transition active:scale-95 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus size={14} />
                    Adicionar primeira venda
                  </button>
                )}
              </div>
            ) : parcelasFiltradas.length === 0 ? (
              <div className="col-span-full py-16 px-6 bg-white rounded-3xl border border-gray-200 flex flex-col items-center justify-center text-center shadow-xs">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
                  <Search size={22} />
                </div>
                <h3 className="text-gray-800 font-bold text-sm mb-1">Nenhum recebível encontrado</h3>
                <p className="text-gray-500 text-xs mb-4 max-w-xs">
                  Não foram encontrados resultados para &ldquo;<span className="font-semibold text-gray-700">{termoBusca}</span>&rdquo;.
                </p>
                <button
                  onClick={() => setTermoBusca('')}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full text-xs font-semibold transition-all cursor-pointer active:scale-95 flex items-center gap-1.5"
                >
                  <LucideX size={13} />
                  Limpar pesquisa
                </button>
              </div>
            ) : (
              parcelasFiltradas.map(item => {
                const nAtual = item.numero_parcela || 1;
                const nTotal = item.total_parcelas || 1;
                const vParcela = item.valor_parcela || 0;
                const isLast = nAtual === nTotal;
                const isRecebido = item.status === 'recebido';
                const restantes = Math.max(0, nTotal - nAtual + 1);
                const totalQuitacao = vParcela * restantes;

                return (
                  <div
                    key={item.id}
                    className={`bg-white rounded-3xl p-5 flex flex-col transition-all relative lg:rounded-3xl lg:shadow-md lg:shadow-gray-200/50 lg:hover:shadow-xl lg:hover:-translate-y-0.5 ${
                      isRecebido 
                        ? 'border-2 border-emerald-400 bg-emerald-50/20' 
                        : isLast 
                          ? 'border-2 border-blue-400 ring-2 ring-blue-500/20 shadow-sm' 
                          : 'border-2 border-gray-100 shadow-sm'
                    }`}
                  >
                    {/* Linha Superior */}
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`p-2.5 rounded-xl shrink-0 ${isRecebido ? 'bg-emerald-600 text-white' : isLast ? 'bg-blue-600 text-white' : 'bg-emerald-50 text-emerald-700'}`}>
                          <HandCoins size={18} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5 mb-1">
                            <h4 className="font-black text-gray-800 text-sm truncate max-w-[130px]" title={item.descricao}>
                              {item.descricao}
                            </h4>
                            {isLast && (
                              <span className="bg-blue-600 text-white text-[8px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider border border-blue-400 shadow-xs shrink-0">
                                ÚLTIMA
                              </span>
                            )}
                            {/* Toggle de Status */}
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(item)}
                              disabled={isSegundoMes || !canEdit}
                              title={isSegundoMes ? "Modificação não permitida para esse mês" : "Clique para alternar status"}
                              className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider flex items-center gap-1 transition-all active:scale-95 cursor-pointer ${
                                isRecebido
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                  : 'bg-amber-100 text-amber-800 border border-amber-300'
                              } ${isSegundoMes ? 'opacity-70 cursor-not-allowed' : ''}`}
                            >
                              {isRecebido ? <Check size={10} /> : <Clock size={10} />}
                              {isRecebido ? 'RECEBIDO' : 'PENDENTE'}
                            </button>
                          </div>
                          <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">
                            Parcela: {nAtual}/{nTotal}
                          </p>
                        </div>
                      </div>

                      {/* Botões de Ação */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          disabled={isSegundoMes || !canEdit}
                          onClick={isSegundoMes || !canEdit ? undefined : () => openEditModal(item)}
                          title={isSegundoMes ? "Modificação não permitida para esse mês" : (!canEdit ? "Mês fechado para edição" : "Editar parcela")}
                          className={isSegundoMes || !canEdit
                            ? "text-gray-400 opacity-40 cursor-not-allowed hover:bg-transparent pointer-events-auto p-2 bg-gray-50 rounded-lg transition-colors"
                            : "text-gray-400 hover:text-blue-600 p-2 bg-gray-50 rounded-lg transition-colors cursor-pointer"
                          }
                        >
                          <Pencil size={18} />
                        </button>
                        <button
                          type="button"
                          disabled={isSegundoMes || !canEdit}
                          onClick={isSegundoMes || !canEdit ? undefined : () => openDeleteModal(item)}
                          title={isSegundoMes ? "Modificação não permitida para esse mês" : (!canEdit ? "Mês fechado para exclusão" : "Excluir parcela")}
                          className={isSegundoMes || !canEdit
                            ? "text-gray-400 opacity-40 cursor-not-allowed hover:bg-transparent pointer-events-auto p-2 bg-gray-50 rounded-lg transition-colors"
                            : "text-gray-400 hover:text-red-500 p-2 bg-gray-50 rounded-lg transition-colors cursor-pointer"
                          }
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>

                    {/* Dados Centrais */}
                    <div className="grid grid-cols-2 gap-2 mb-4">
                      <div className="bg-gray-50/70 p-3 rounded-2xl border border-gray-100">
                        <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Vl Parcela</p>
                        <p className="text-sm font-black text-gray-800">{formatCurrency(vParcela)}</p>
                      </div>
                      <div className="bg-gray-50/70 p-3 rounded-2xl border border-gray-100">
                        <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Restantes</p>
                        <p className="text-sm font-black text-gray-800">{restantes}x</p>
                      </div>
                    </div>

                    {/* Rodapé do Card */}
                    <div className={`mt-auto p-4 rounded-2xl text-white transition-all ${isRecebido ? 'bg-emerald-900' : 'bg-emerald-800'}`}>
                      <p className="text-[8px] font-bold text-emerald-200 uppercase tracking-widest mb-0.5">Total Restante a Receber</p>
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

      {/* Modal Adicionar Venda Parcelada */}
      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm sm:max-w-md p-6 rounded-3xl shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <HandCoins size={20} />
                </div>
                <div>
                  <h2 className="text-base font-black text-gray-900 uppercase tracking-tight">Adicionar Venda</h2>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Contas a Receber</p>
                </div>
              </div>
              <button 
                onClick={() => setShowAddModal(false)} 
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-full hover:bg-gray-100 transition-colors"
              >
                <LucideX size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateVenda} className="space-y-4">
              <div>
                <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1.5 tracking-widest">
                  Descrição do Produto / Venda
                </label>
                <input
                  type="text"
                  value={addForm.descricao}
                  onChange={e => setAddForm({ ...addForm, descricao: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-emerald-600 font-bold text-sm text-gray-800"
                  placeholder="Ex: iPhone 13 128GB - Venda"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1.5 tracking-widest">
                    Valor da Parcela
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={addForm.valor_parcela}
                    onChange={e => setAddForm({ ...addForm, valor_parcela: maskCurrency(e.target.value) })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-emerald-600 font-black text-sm text-gray-800"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1.5 tracking-widest">
                    Qtde de Parcelas
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="72"
                    value={addForm.total_parcelas}
                    onChange={e => setAddForm({ ...addForm, total_parcelas: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-emerald-600 font-black text-center text-sm text-gray-800"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1.5 tracking-widest">
                  Mês de Início (1ª Parcela)
                </label>
                <select
                  value={addForm.mes_inicio_id}
                  onChange={e => setAddForm({ ...addForm, mes_inicio_id: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-emerald-600 font-bold text-sm text-gray-800 cursor-pointer"
                >
                  {allMonthsList.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.nome} / {m.ano} {m.status === 'ativo' ? '(Ativo)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Prévia do Total da Venda */}
              <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-3.5 flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-bold text-emerald-800 uppercase tracking-widest">Valor Total da Venda</p>
                  <p className="text-base font-black text-emerald-950 mt-0.5">
                    {formatCurrency(parseCurrency(addForm.valor_parcela) * (parseInt(addForm.total_parcelas, 10) || 1))}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold bg-emerald-200/80 text-emerald-900 px-2.5 py-1 rounded-full uppercase tracking-wider">
                    {addForm.total_parcelas || 1} parcelas
                  </span>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-3.5 rounded-xl uppercase text-[10px] tracking-widest transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-gray-900 hover:bg-gray-800 text-white font-bold py-3.5 rounded-xl shadow-md uppercase text-[10px] tracking-widest transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Gerando...' : 'Salvar Venda'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Editar Parcela */}
      {showEditModal && editingParcela && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm p-6 rounded-3xl shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-5">
              <div>
                <h2 className="text-base font-black text-gray-900 uppercase tracking-tight">Editar Parcela</h2>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  Parcela {editingParcela.numero_parcela}/{editingParcela.total_parcelas} ({editingParcela.mes_referencia})
                </p>
              </div>
              <button 
                onClick={() => setShowEditModal(false)} 
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-full hover:bg-gray-100 transition-colors"
              >
                <LucideX size={18} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1.5 tracking-widest">
                  Descrição
                </label>
                <input
                  type="text"
                  value={editForm.descricao}
                  onChange={e => setEditForm({ ...editForm, descricao: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-emerald-600 font-bold text-sm text-gray-800"
                  required
                />
              </div>

              <div>
                <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1.5 tracking-widest">
                  Valor da Parcela
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={editForm.valor_parcela}
                  onChange={e => setEditForm({ ...editForm, valor_parcela: maskCurrency(e.target.value) })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-emerald-600 font-black text-sm text-gray-800"
                  required
                />
              </div>

              <div>
                <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1.5 tracking-widest">
                  Status de Recebimento
                </label>
                <select
                  value={editForm.status}
                  onChange={e => setEditForm({ ...editForm, status: e.target.value as 'pendente' | 'recebido' })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-emerald-600 font-bold text-sm text-gray-800 cursor-pointer"
                >
                  <option value="pendente">Pendente</option>
                  <option value="recebido">Recebido</option>
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-3.5 rounded-xl uppercase text-[10px] tracking-widest transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-gray-900 hover:bg-gray-800 text-white font-bold py-3.5 rounded-xl shadow-md uppercase text-[10px] tracking-widest transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Alteração em Cascata */}
      {showEditCascadeModal && pendingEditPayload && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md p-6 rounded-3xl shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <TrendingUp size={20} />
              </div>
              <div>
                <h2 className="text-base font-black text-gray-900 uppercase tracking-tight">Alteração em Cascata</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Deseja aplicar esta alteração também nas parcelas dos meses seguintes?
                </p>
              </div>
            </div>

            <div className="bg-blue-50/70 border border-blue-100 rounded-2xl p-4 mb-5">
              <p className="text-xs text-blue-900 font-medium leading-relaxed">
                Você está editando a parcela no <strong>1º mês ativo ({currentMonth.nome}/{currentMonth.ano})</strong>.
              </p>
              <p className="text-[11px] text-blue-800 mt-2 leading-relaxed">
                Ao confirmar em cascata, a nova descrição e valor serão replicados para todas as parcelas futuras desta venda, mantendo a contagem sequencial (ex: 2/6, 3/6) de cada mês.
              </p>
              <p className="text-[10px] text-blue-600 font-bold mt-2 uppercase tracking-wide">
                * Meses anteriores já concluídos/fechados permanecem intactos.
              </p>
            </div>

            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                disabled={submitting}
                onClick={() => saveEdit(pendingEditPayload, true)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl shadow-md uppercase text-[10px] tracking-widest transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <CheckCircle2 size={14} />
                {submitting ? 'Salvando...' : 'Sim, aplicar também aos meses seguintes'}
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => saveEdit(pendingEditPayload, false)}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 px-4 rounded-xl uppercase text-[10px] tracking-widest transition-all active:scale-98 cursor-pointer disabled:opacity-50 text-center"
              >
                {submitting ? 'Salvando...' : `Apenas neste mês (${currentMonth.nome})`}
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => setShowEditCascadeModal(false)}
                className="w-full py-2.5 text-gray-400 hover:text-gray-600 font-bold uppercase text-[10px] tracking-widest transition-colors cursor-pointer text-center"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão em Cascata */}
      {showDeleteCascadeModal && itemToDelete && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md p-6 rounded-3xl shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-11 h-11 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <Trash2 size={22} />
              </div>
              <div>
                <h2 className="text-base font-black text-gray-900 uppercase tracking-tight">Excluir Venda / Parcela</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Venda: <span className="font-bold text-gray-800">{itemToDelete.descricao}</span> (Parcela {itemToDelete.numero_parcela}/{itemToDelete.total_parcelas})
                </p>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-4 mb-5">
              <p className="text-xs text-amber-900 font-medium leading-relaxed">
                {isPrimeiroMes ? (
                  <>
                    Você está excluindo a partir do <strong>1º mês ativo ({currentMonth.nome}/{currentMonth.ano})</strong>.
                    Deseja remover apenas a parcela deste mês ou excluir esta e <strong>todas as parcelas futuras vinculadas</strong>?
                  </>
                ) : (
                  <>
                    Tem certeza que deseja excluir esta parcela da competência de <strong>{currentMonth.nome}/{currentMonth.ano}</strong>?
                  </>
                )}
              </p>
              {isPrimeiroMes && (
                <p className="text-[10px] text-amber-700 font-bold mt-2 uppercase tracking-wide">
                  * Parcelas de meses anteriores já concluídos/fechados permanecerão preservadas no histórico.
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2.5">
              {isPrimeiroMes ? (
                <>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => handleExecuteDelete(true)}
                    className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-xl shadow-md uppercase text-[10px] tracking-widest transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Trash2 size={14} />
                    {submitting ? 'Excluindo...' : 'Excluir desta e de todas as parcelas futuras'}
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => handleExecuteDelete(false)}
                    className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 px-4 rounded-xl uppercase text-[10px] tracking-widest transition-all active:scale-98 cursor-pointer disabled:opacity-50 text-center"
                  >
                    {submitting ? 'Excluindo...' : `Excluir apenas deste mês (${currentMonth.nome})`}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleExecuteDelete(false)}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-xl shadow-md uppercase text-[10px] tracking-widest transition-all active:scale-98 cursor-pointer disabled:opacity-50 text-center"
                >
                  {submitting ? 'Excluindo...' : 'Confirmar Exclusão'}
                </button>
              )}
              <button
                type="button"
                disabled={submitting}
                onClick={() => { setShowDeleteCascadeModal(false); setItemToDelete(null); }}
                className="w-full py-2.5 text-gray-400 hover:text-gray-600 font-bold uppercase text-[10px] tracking-widest transition-colors cursor-pointer text-center"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast de Notificação */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[200] max-w-sm px-5 py-3.5 rounded-2xl shadow-2xl border flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-200 ${
          toast.type === 'error' 
            ? 'bg-red-900 text-white border-red-700' 
            : toast.type === 'success'
              ? 'bg-emerald-900 text-white border-emerald-700'
              : 'bg-gray-900 text-white border-gray-700'
        }`}>
          {toast.type === 'error' ? (
            <AlertCircle size={18} className="text-red-400 shrink-0" />
          ) : toast.type === 'success' ? (
            <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
          ) : (
            <Check size={18} className="text-blue-400 shrink-0" />
          )}
          <p className="text-xs font-bold leading-snug">{toast.message}</p>
          <button onClick={() => setToast(null)} className="ml-auto text-white/60 hover:text-white p-1 cursor-pointer">
            <LucideX size={15} />
          </button>
        </div>
      )}
    </div>
  );
};

export default Receivables;
