import React, { useState, useEffect } from 'react';
import { Receipt, Zap, Trash2, CheckCircle2, Circle, Pencil, X as LucideX, TrendingUp, CalendarClock, Fuel, Plus, AlertTriangle } from 'lucide-react';
import { supabaseClient } from '../services/supabase';
import { Month, Expense, PixExpense, AbastecimentoItem } from '../types';

interface ExpensesProps {
  currentMonth: Month;
  triggerAdd: number;
}

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

const Expenses: React.FC<ExpensesProps> = ({ currentMonth, triggerAdd }) => {
  const [activeTab, setActiveTab] = useState<'contas' | 'pix'>('contas');
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [pixExpenses, setPixExpenses] = useState<PixExpense[]>([]);
  const [replicatedDescriptions, setReplicatedDescriptions] = useState<Set<string>>(new Set());
  const [pixTax, setPixTax] = useState(4.99);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ 
    desc: '', 
    val: 'R$ 0,00', 
    date: new Date().toISOString().split('T')[0],
    tax: 4.99,
    pago: false,
    programarProximo: false
  });
  const [submitting, setSubmitting] = useState(false);

  // States para Modal de Abastecimento (GASOLINA)
  const [selectedGasolineExpense, setSelectedGasolineExpense] = useState<Expense | null>(null);
  const [showAbastecimentoModal, setShowAbastecimentoModal] = useState<boolean>(false);
  const [abastecimentoForm, setAbastecimentoForm] = useState({
    val: 'R$ 0,00',
    date: new Date().toISOString().split('T')[0]
  });
  const [submittingAbastecimento, setSubmittingAbastecimento] = useState<boolean>(false);
  const [itemToDeleteAbastecimento, setItemToDeleteAbastecimento] = useState<AbastecimentoItem | null>(null);

  const isGasolinaExpense = (desc: string) => {
    if (!desc) return false;
    return desc.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes("gasolina");
  };

  const getHistorico = (exp: Expense): AbastecimentoItem[] => {
    if (!exp.historico_abastecimentos) return [];
    if (Array.isArray(exp.historico_abastecimentos)) return exp.historico_abastecimentos;
    try {
      return JSON.parse(exp.historico_abastecimentos as any);
    } catch {
      return [];
    }
  };

  const openAbastecimentoModal = (exp: Expense) => {
    setSelectedGasolineExpense(exp);
    setAbastecimentoForm({
      val: 'R$ 0,00',
      date: new Date().toISOString().split('T')[0]
    });
    setShowAbastecimentoModal(true);
  };

  const handleAddAbastecimento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGasolineExpense || submittingAbastecimento) return;

    const valAbastecimento = parseCurrency(abastecimentoForm.val);
    if (valAbastecimento <= 0) return;

    setSubmittingAbastecimento(true);
    try {
      const currentVal = selectedGasolineExpense.valor;
      const newVal = Math.max(0, Number((currentVal - valAbastecimento).toFixed(2)));
      const existingHist = getHistorico(selectedGasolineExpense);
      const newHistItem: AbastecimentoItem = {
        id: Date.now().toString(),
        data: abastecimentoForm.date,
        valor: valAbastecimento,
        criado_em: new Date().toISOString()
      };
      const updatedHist = [newHistItem, ...existingHist];

      const { error } = await supabaseClient
        .from('despesas_contas')
        .update({
          valor: newVal,
          historico_abastecimentos: updatedHist
        })
        .eq('id', selectedGasolineExpense.id);

      if (error) throw error;

      setSelectedGasolineExpense({
        ...selectedGasolineExpense,
        valor: newVal,
        historico_abastecimentos: updatedHist
      });
      setAbastecimentoForm({
        val: 'R$ 0,00',
        date: new Date().toISOString().split('T')[0]
      });
      fetchData();
    } catch (err: any) {
      alert("Erro ao registrar abastecimento: " + (err.message || err));
    } finally {
      setSubmittingAbastecimento(false);
    }
  };

  const confirmDeleteAbastecimento = async () => {
    if (!selectedGasolineExpense || !itemToDeleteAbastecimento || submittingAbastecimento) return;

    const itemToDelete = itemToDeleteAbastecimento;
    setSubmittingAbastecimento(true);
    try {
      const currentVal = selectedGasolineExpense.valor;
      const newVal = Number((currentVal + itemToDelete.valor).toFixed(2));
      const existingHist = getHistorico(selectedGasolineExpense);
      const updatedHist = existingHist.filter((item) => String(item.id) !== String(itemToDelete.id));

      const { error } = await supabaseClient
        .from('despesas_contas')
        .update({
          valor: newVal,
          historico_abastecimentos: updatedHist
        })
        .eq('id', selectedGasolineExpense.id);

      if (error) throw error;

      setSelectedGasolineExpense({
        ...selectedGasolineExpense,
        valor: newVal,
        historico_abastecimentos: updatedHist
      });
      setItemToDeleteAbastecimento(null);
      fetchData();
    } catch (err: any) {
      alert("Erro ao excluir abastecimento: " + (err.message || err));
    } finally {
      setSubmittingAbastecimento(false);
    }
  };

  useEffect(() => {
    fetchPixConfig();
    fetchData();
  }, [currentMonth, activeTab]);

  useEffect(() => {
    if (triggerAdd > 0) {
      setEditingId(null);
      setFormData({ 
        desc: '', 
        val: 'R$ 0,00', 
        date: new Date().toISOString().split('T')[0],
        tax: 4.99,
        pago: false,
        programarProximo: false
      });
      setShowModal(true);
    }
  }, [triggerAdd]);

  const fetchPixConfig = async () => {
    const { data } = await supabaseClient.from('configuracoes').select('*').eq('chave', 'taxa_pix').single();
    if (data) setPixTax(parseFloat(data.valor));
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'contas') {
        const { data } = await supabaseClient
          .from('despesas_contas')
          .select('*')
          .eq('mes_id', currentMonth.id)
          .order('data', { ascending: true })
          .order('id', { ascending: true });
        setExpenses(data || []);
      } else {
        const { data } = await supabaseClient
          .from('despesas_pix_credito')
          .select('*')
          .eq('mes_id', currentMonth.id)
          .order('data', { ascending: true })
          .order('id', { ascending: true });
        setPixExpenses(data || []);
      }

      // Busca as descrições das despesas do próximo mês para destaque de replicação
      const meses_nomes = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];
      let idx = meses_nomes.indexOf(currentMonth.nome.trim().toUpperCase());
      if (idx !== -1) {
        let nextIdx = (idx + 1) % 12;
        let nextYear = idx === 11 ? currentMonth.ano + 1 : currentMonth.ano;
        const nextMonthName = meses_nomes[nextIdx];

        const { data: nextMonth } = await supabaseClient
          .from('meses')
          .select('*')
          .ilike('nome', nextMonthName)
          .eq('ano', nextYear)
          .maybeSingle();

        if (nextMonth) {
          const table = activeTab === 'contas' ? 'despesas_contas' : 'despesas_pix_credito';
          const { data: nextExpenses } = await supabaseClient
            .from(table)
            .select('descricao')
            .eq('mes_id', nextMonth.id);

          if (nextExpenses) {
            const descs = new Set(nextExpenses.map(item => item.descricao));
            setReplicatedDescriptions(descs);
          } else {
            setReplicatedDescriptions(new Set());
          }
        } else {
          setReplicatedDescriptions(new Set());
        }
      } else {
        setReplicatedDescriptions(new Set());
      }
    } catch (err) {
      console.error("Erro no fetchData:", err);
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

  const handleTogglePaid = async (table: string, id: number, currentStatus: boolean) => {
    if (currentMonth.status === 'fechado') return;
    await supabaseClient.from(table).update({ pago: !currentStatus }).eq('id', id);
    fetchData();
  };

  const handleDelete = async (table: string, id: number) => {
    if (currentMonth.status === 'fechado' || !confirm("Deseja realmente excluir?")) return;
    await supabaseClient.from(table).delete().eq('id', id);
    fetchData();
  };

  // Verifica dinamicamente se a despesa correspondente já foi replicada para o mês seguinte
  const checkReplicacao = async (itemDesc: string) => {
    try {
      const meses_nomes = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];
      let idx = meses_nomes.indexOf(currentMonth.nome.trim().toUpperCase());
      if (idx !== -1) {
        let nextIdx = (idx + 1) % 12;
        let nextYear = idx === 11 ? currentMonth.ano + 1 : currentMonth.ano;
        const nextMonthName = meses_nomes[nextIdx];

        const { data: nextMonth } = await supabaseClient
          .from('meses')
          .select('*')
          .ilike('nome', nextMonthName)
          .eq('ano', nextYear)
          .maybeSingle();

        if (nextMonth) {
          const table = activeTab === 'contas' ? 'despesas_contas' : 'despesas_pix_credito';
          const { data: existing } = await supabaseClient
            .from(table)
            .select('*')
            .eq('mes_id', nextMonth.id)
            .eq('descricao', itemDesc)
            .maybeSingle();

          if (existing) {
            setFormData(prev => ({ ...prev, programarProximo: true }));
            return;
          }
        }
      }
      setFormData(prev => ({ ...prev, programarProximo: false }));
    } catch (err) {
      console.error("Erro ao checar replicação:", err);
    }
  };

  const openEditModal = (item: any) => {
    setEditingId(item.id);
    const numericVal = item.valor || item.valor_original || 0;
    setFormData({
      desc: item.descricao,
      val: maskCurrency((numericVal * 100).toString()),
      date: item.data,
      tax: item.taxa_percentual || pixTax,
      pago: !!item.pago,
      programarProximo: false // Inicializa como falso e busca dinamicamente
    });
    setShowModal(true);
    checkReplicacao(item.descricao);
  };

  const handleToggleReplicar = async () => {
    const newValue = !formData.programarProximo;
    setFormData(prev => ({ ...prev, programarProximo: newValue }));
    
    // Se for uma despesa existente, salvamos e replicamos imediatamente de forma transparente
    if (editingId) {
      const table = activeTab === 'contas' ? 'despesas_contas' : 'despesas_pix_credito';
      try {
        const meses_nomes = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];
        let idx = meses_nomes.indexOf(currentMonth.nome.trim().toUpperCase());
        if (idx !== -1) {
          let nextIdx = (idx + 1) % 12;
          let nextYear = idx === 11 ? currentMonth.ano + 1 : currentMonth.ano;
          const nextMonthName = meses_nomes[nextIdx];

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
              
              if (!error && created) return created;

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

          const nextMonth = await getOrCreateMonth(nextMonthName, nextYear);
          if (nextMonth) {
            // Buscamos a despesa atual correspondente
            const { data: currentExpense } = await supabaseClient
              .from(table)
              .select('*')
              .eq('id', editingId)
              .single();

            if (currentExpense) {
              if (newValue) {
                // Verificar se a réplica já existe no próximo mês com a mesma descrição (impedir duplicações)
                const { data: existingReplica } = await supabaseClient
                  .from(table)
                  .select('*')
                  .eq('mes_id', nextMonth.id)
                  .eq('descricao', currentExpense.descricao)
                  .maybeSingle();

                if (!existingReplica) {
                  const originalDateStr = currentExpense.data || formData.date;
                  let nextMonthDate = originalDateStr;
                  try {
                    const parts = originalDateStr.split('-');
                    if (parts.length === 3) {
                      let dYear = nextYear;
                      let dMonth = String(nextIdx + 1).padStart(2, '0');
                      let dDay = parts[2];
                      const maxDays = new Date(dYear, nextIdx + 1, 0).getDate();
                      if (parseInt(dDay, 10) > maxDays) {
                        dDay = String(maxDays).padStart(2, '0');
                      }
                      nextMonthDate = `${dYear}-${dMonth}-${dDay}`;
                    }
                  } catch (e) {
                    console.error("Error setting next month date:", e);
                  }

                  const val = currentExpense.valor || currentExpense.valor_original || 0;
                  const nextPayload: any = {
                    mes_id: nextMonth.id,
                    descricao: currentExpense.descricao,
                    data: nextMonthDate,
                    pago: false
                  };

                  if (activeTab === 'contas') {
                    nextPayload.valor = val;
                    await supabaseClient.from('despesas_contas').insert([nextPayload]);
                  } else {
                    const selectedTax = currentExpense.taxa_percentual || 4.99;
                    const finalVal = val + (val * (selectedTax / 100));
                    nextPayload.valor_original = val;
                    nextPayload.taxa_percentual = selectedTax;
                    nextPayload.valor_final = finalVal;
                    await supabaseClient.from('despesas_pix_credito').insert([nextPayload]);
                  }
                }
              } else {
                // Se o usuário mudou para NÃO, excluímos a réplica correspondente imediatamente do próximo mês
                await supabaseClient
                  .from(table)
                  .delete()
                  .eq('mes_id', nextMonth.id)
                  .eq('descricao', currentExpense.descricao);
              }
            }
          }
        }
        fetchData();
      } catch (err) {
        console.error("Erro ao alternar replicação imediata:", err);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    const val = parseCurrency(formData.val);
    if (!formData.desc || val <= 0) return;

    setSubmitting(true);
    try {
      const payload: any = {
        mes_id: currentMonth.id,
        descricao: formData.desc,
        data: formData.date,
        pago: formData.pago
      };

      if (activeTab === 'contas') {
        payload.valor = val;
        if (editingId) {
          await supabaseClient.from('despesas_contas').update(payload).eq('id', editingId);
        } else {
          await supabaseClient.from('despesas_contas').insert([payload]);
        }
      } else {
        const selectedTax = formData.tax;
        const finalVal = val + (val * (selectedTax / 100));
        payload.valor_original = val;
        payload.taxa_percentual = selectedTax;
        payload.valor_final = finalVal;
        if (editingId) {
          await supabaseClient.from('despesas_pix_credito').update(payload).eq('id', editingId);
        } else {
          await supabaseClient.from('despesas_pix_credito').insert([payload]);
        }
      }

      // Replicar no mês seguinte se for uma nova despesa preenchida com a opção marcada
      if (!editingId && formData.programarProximo) {
        try {
          const meses_nomes = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];
          let idx = meses_nomes.indexOf(currentMonth.nome.trim().toUpperCase());
          if (idx !== -1) {
            let nextIdx = (idx + 1) % 12;
            let nextYear = idx === 11 ? currentMonth.ano + 1 : currentMonth.ano;
            const nextMonthName = meses_nomes[nextIdx];

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
                
                if (!error && created) return created;

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

            const nextMonth = await getOrCreateMonth(nextMonthName, nextYear);
            if (nextMonth) {
              const table = activeTab === 'contas' ? 'despesas_contas' : 'despesas_pix_credito';
              
              // Evitar duplicações
              const { data: duplicateCheck } = await supabaseClient
                .from(table)
                .select('*')
                .eq('mes_id', nextMonth.id)
                .eq('descricao', formData.desc)
                .maybeSingle();

              if (!duplicateCheck) {
                const originalDateStr = formData.date;
                let nextMonthDate = originalDateStr;
                try {
                  const parts = originalDateStr.split('-');
                  if (parts.length === 3) {
                    let dYear = nextYear;
                    let dMonth = String(nextIdx + 1).padStart(2, '0');
                    let dDay = parts[2];
                    const maxDays = new Date(dYear, nextIdx + 1, 0).getDate();
                    if (parseInt(dDay, 10) > maxDays) {
                      dDay = String(maxDays).padStart(2, '0');
                    }
                    nextMonthDate = `${dYear}-${dMonth}-${dDay}`;
                  }
                } catch (e) {
                  console.error("Error setting next month date:", e);
                }

                const nextPayload: any = {
                  mes_id: nextMonth.id,
                  descricao: formData.desc,
                  data: nextMonthDate,
                  pago: false
                };

                if (activeTab === 'contas') {
                  nextPayload.valor = val;
                  await supabaseClient.from('despesas_contas').insert([nextPayload]);
                } else {
                  const selectedTax = formData.tax;
                  const finalVal = val + (val * (selectedTax / 100));
                  nextPayload.valor_original = val;
                  nextPayload.taxa_percentual = selectedTax;
                  nextPayload.valor_final = finalVal;
                  await supabaseClient.from('despesas_pix_credito').insert([nextPayload]);
                }
              }
            }
          }
        } catch (repErr) {
          console.error("Erro ao replicar despesa para o próximo mês:", repErr);
        }
      }

      setShowModal(false);
      setEditingId(null);
      setFormData({ 
        desc: '', 
        val: 'R$ 0,00', 
        date: new Date().toISOString().split('T')[0],
        tax: 4.99,
        pago: false,
        programarProximo: false
      });
      fetchData();
    } catch (err: any) {
      alert("Erro ao salvar despesa: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const totalExpenses = expenses.reduce((acc, curr) => acc + curr.valor, 0);
  const totalExpensesAberto = expenses.filter(e => !e.pago).reduce((acc, curr) => acc + curr.valor, 0);
  
  const totalPix = pixExpenses.reduce((acc, curr) => acc + curr.valor_final, 0);
  const totalPixAberto = pixExpenses.filter(e => !e.pago).reduce((acc, curr) => acc + curr.valor_final, 0);
  const totalPixFeesPaid = pixExpenses.filter(e => e.pago).reduce((acc, curr) => acc + (curr.valor_final - (curr.valor_original || 0)), 0);

  const currentTotal = activeTab === 'contas' ? totalExpenses : totalPix;
  const currentTotalAberto = activeTab === 'contas' ? totalExpensesAberto : totalPixAberto;

  const canEdit = currentMonth.status !== 'fechado';

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex w-full bg-gray-200/50 p-0.5 rounded-xl gap-0.5 max-w-[200px] border border-gray-200">
          <button 
            onClick={() => setActiveTab('contas')} 
            className={`flex-1 py-1.5 rounded-lg text-[9px] font-bold transition-all uppercase tracking-widest ${activeTab === 'contas' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400'}`}
          >
            Fixas
          </button>
          <button 
            onClick={() => setActiveTab('pix')} 
            className={`flex-1 py-1.5 rounded-lg text-[9px] font-bold transition-all uppercase tracking-widest ${activeTab === 'pix' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400'}`}
          >
            Pix
          </button>
        </div>

        {!loading && (
          <div className={`grid ${activeTab === 'pix' ? 'grid-cols-3' : 'grid-cols-2'} gap-2 w-full sm:w-auto`}>
            {activeTab === 'pix' && (
              <div className="bg-white px-3 py-3 sm:px-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between sm:justify-start gap-2 sm:gap-3">
                <div>
                  <p className="text-[7px] sm:text-[8px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1 text-blue-600">Taxas Pagas</p>
                  <p className="text-sm sm:text-base font-black text-blue-700 leading-none">{formatCurrency(totalPixFeesPaid)}</p>
                </div>
                <div className="hidden sm:flex p-1.5 sm:p-2 rounded-xl bg-blue-50 text-blue-600 shrink-0">
                  <TrendingUp size={14} className="sm:w-4 sm:h-4" />
                </div>
              </div>
            )}
            <div className="bg-white px-3 py-3 sm:px-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between sm:justify-start gap-2 sm:gap-3">
              <div>
                <p className="text-[7px] sm:text-[8px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">Total da Tela</p>
                <p className="text-sm sm:text-base font-black text-gray-900 leading-none">{formatCurrency(currentTotal)}</p>
              </div>
              <div className="hidden sm:flex p-1.5 sm:p-2 rounded-xl bg-gray-50 text-gray-400 shrink-0">
                <Receipt size={14} className="sm:w-4 sm:h-4" />
              </div>
            </div>

            <div className="bg-white px-3 py-3 sm:px-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between sm:justify-start gap-2 sm:gap-3">
              <div>
                <p className="text-[7px] sm:text-[8px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">Total em Aberto</p>
                <p className="text-sm sm:text-base font-black text-red-600 leading-none">{formatCurrency(currentTotalAberto)}</p>
              </div>
              <div className="hidden sm:flex p-1.5 sm:p-2 rounded-xl bg-red-50 text-red-600 shrink-0">
                <Zap size={14} className="sm:w-4 sm:h-4" />
              </div>
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center gap-3 text-gray-400">
          <div className="w-8 h-8 border-3 border-green-700 border-t-transparent rounded-full animate-spin"></div>
          <p className="font-bold uppercase tracking-widest text-[9px]">Sincronizando...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {activeTab === 'contas' ? (
            expenses.length === 0 ? <p className="col-span-full text-center py-20 text-gray-400 font-bold uppercase tracking-widest text-[10px]">Sem despesas fixas.</p> :
            expenses.map(exp => {
              const isReplicated = replicatedDescriptions.has(exp.descricao);
              return (
                <div 
                  key={exp.id} 
                  className={`p-4 rounded-2xl border transition-all shadow-sm relative ${
                    exp.pago ? 'opacity-50 bg-gray-50' : 'bg-white'
                  } ${
                    isReplicated 
                      ? 'border-blue-500 animate-border-glow shadow-[0_0_15px_rgba(59,130,246,0.1)]' 
                      : exp.pago 
                        ? 'border-transparent' 
                        : 'border-gray-100 hover:border-red-100'
                  }`}
                >
                  {isReplicated && (
                    <div className="absolute top-3 right-3 select-none">
                      <span className="bg-blue-600 text-white text-[8px] font-bold uppercase px-2 py-0.5 rounded-full tracking-wider border border-blue-400 shadow-sm">
                        REPLICADA
                      </span>
                    </div>
                  )}
                  <div className="flex items-start gap-2.5 mb-3">
                    <button 
                      onClick={() => handleTogglePaid('despesas_contas', exp.id, exp.pago)} 
                      className={`shrink-0 mt-0.5 ${exp.pago ? 'text-green-600' : 'text-gray-200 hover:text-green-400'}`}
                      disabled={!canEdit}
                    >
                      {exp.pago ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                    </button>
                    <div className="min-w-0">
                      <h4 className={`font-bold text-gray-800 text-sm truncate leading-tight ${exp.pago ? 'line-through' : ''}`}>{exp.descricao}</h4>
                      <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">{formatDateSafe(exp.data)}</p>
                    </div>
                  </div>

                  <div className="h-px bg-gray-50 mb-3" />

                  <div className="flex items-center justify-between">
                    <span className="font-black text-base text-gray-900 tracking-tight">{formatCurrency(exp.valor)}</span>
                    <div className="flex items-center gap-1">
                      {canEdit && (
                        <>
                          <button onClick={() => openEditModal(exp)} className="text-gray-400 hover:text-blue-600 p-2 bg-gray-50 rounded-lg transition-colors"><Pencil size={18} /></button>
                          <button onClick={() => handleDelete('despesas_contas', exp.id)} className="text-gray-400 hover:text-red-500 p-2 bg-gray-50 rounded-lg transition-colors"><Trash2 size={18} /></button>
                        </>
                      )}
                    </div>
                  </div>

                  {isGasolinaExpense(exp.descricao) && (
                    <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between gap-2">
                      <button
                        onClick={() => openAbastecimentoModal(exp)}
                        className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-[10px] uppercase tracking-wider py-1.5 px-3 rounded-xl transition-all flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
                      >
                        <Fuel size={14} />
                        Abastecer
                      </button>
                      {getHistorico(exp).length > 0 && (
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                          {getHistorico(exp).length} {getHistorico(exp).length === 1 ? 'abastecimento' : 'abastecimentos'}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            pixExpenses.length === 0 ? <p className="col-span-full text-center py-20 text-gray-400 font-bold uppercase tracking-widest text-[10px]">Sem despesas via Pix.</p> :
            pixExpenses.map(exp => {
              const isReplicated = replicatedDescriptions.has(exp.descricao);
              return (
                <div 
                  key={exp.id} 
                  className={`p-4 rounded-2xl border transition-all shadow-sm relative ${
                    exp.pago ? 'opacity-50 bg-gray-50' : 'bg-white'
                  } ${
                    isReplicated 
                      ? 'border-blue-500 animate-border-glow shadow-[0_0_15px_rgba(59,130,246,0.1)]' 
                      : exp.pago 
                        ? 'border-transparent' 
                        : 'border-gray-100 hover:border-yellow-100'
                  }`}
                >
                  {isReplicated && (
                    <div className="absolute top-3 right-3 select-none">
                      <span className="bg-blue-600 text-white text-[8px] font-bold uppercase px-2 py-0.5 rounded-full tracking-wider border border-blue-400 shadow-sm">
                        REPLICADA
                      </span>
                    </div>
                  )}
                  <div className="flex items-start gap-2.5 mb-3">
                    <button 
                      onClick={() => handleTogglePaid('despesas_pix_credito', exp.id, exp.pago)} 
                      className={`shrink-0 mt-0.5 ${exp.pago ? 'text-green-600' : 'text-gray-200 hover:text-green-400'}`}
                      disabled={!canEdit}
                    >
                      {exp.pago ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                    </button>
                    <div className="min-w-0">
                      <h4 className={`font-bold text-gray-800 text-sm truncate leading-tight ${exp.pago ? 'line-through' : ''}`}>{exp.descricao}</h4>
                      <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">Taxa: {exp.taxa_percentual}%</p>
                    </div>
                  </div>

                  <div className="h-px bg-gray-50 mb-3" />

                  <div className="flex items-center justify-between">
                    <span className="font-black text-base text-gray-900 tracking-tight">{formatCurrency(exp.valor_final)}</span>
                    <div className="flex items-center gap-1">
                      {canEdit && (
                        <>
                          <button onClick={() => openEditModal(exp)} className="text-gray-400 hover:text-blue-600 p-2 bg-gray-50 rounded-lg transition-colors"><Pencil size={18} /></button>
                          <button onClick={() => handleDelete('despesas_pix_credito', exp.id)} className="text-gray-400 hover:text-red-500 p-2 bg-gray-50 rounded-lg transition-colors"><Trash2 size={18} /></button>
                        </>
                      )}
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
              <h2 className="text-lg font-black text-gray-900 uppercase tracking-tight">{editingId ? 'Editar' : 'Novo Gasto'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400"><LucideX size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1.5 tracking-widest">Descrição</label>
                <input type="text" value={formData.desc} onChange={e => setFormData({...formData, desc: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-green-700 font-bold text-sm" placeholder="Mercado, Net..." required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="min-w-0">
                  <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1.5 tracking-widest">Valor</label>
                  <input type="text" inputMode="numeric" value={formData.val} onChange={e => setFormData({...formData, val: maskCurrency(e.target.value)})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-green-700 font-black text-sm" required />
                </div>
                <div className="min-w-0">
                  <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1.5 tracking-widest">Data</label>
                  <input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-green-700 font-bold text-xs" required />
                </div>
              </div>
              <div className="flex items-center justify-between bg-gray-50 p-4 rounded-xl border border-gray-100">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${formData.pago ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                    {formData.pago ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                  </div>
                  <span className="text-xs font-black text-gray-700 uppercase tracking-widest">Status de Pagamento</span>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, pago: !formData.pago })}
                  className={`px-4 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all ${
                    formData.pago 
                      ? 'bg-green-700 text-white' 
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {formData.pago ? 'Pago' : 'Pendente'}
                </button>
              </div>
              <div className="flex items-center justify-between bg-gray-50 p-4 rounded-xl border border-gray-100">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`p-2 rounded-lg ${formData.programarProximo ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-400'}`}>
                    <CalendarClock size={18} />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-black text-gray-700 uppercase tracking-widest block leading-none">Replicar Próximo Mês</span>
                    <span className="text-[8px] text-gray-400 font-bold uppercase tracking-wide block mt-1 truncate">Programar no mês seguinte</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleToggleReplicar}
                  className={`px-4 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all whitespace-nowrap ${
                    formData.programarProximo 
                      ? 'bg-blue-700 text-white' 
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {formData.programarProximo ? 'Ativado' : 'Não'}
                </button>
              </div>
              {activeTab === 'pix' && (
                <div>
                  <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1.5 tracking-widest">Taxa (%)</label>
                  <div className="flex gap-2">
                    {[3.99, 4.99].map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setFormData({ ...formData, tax: t })}
                        className={`flex-1 py-2 rounded-xl font-black text-xs border transition-all ${
                          formData.tax === t 
                            ? 'bg-green-800 text-white border-green-800' 
                            : 'bg-gray-50 text-gray-400 border-gray-200'
                        }`}
                      >
                        {t}%
                      </button>
                    ))}
                  </div>
                </div>
              )}
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

      {/* MODAL DE ABASTECIMENTO (GASOLINA) */}
      {showAbastecimentoModal && selectedGasolineExpense && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 lg:p-8 max-w-md w-full shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="bg-amber-100 text-amber-700 p-3 rounded-2xl">
                  <Fuel size={22} />
                </div>
                <div>
                  <h3 className="text-base font-black text-gray-900 uppercase tracking-tight">
                    Registrar Abastecimento
                  </h3>
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">
                    {selectedGasolineExpense.descricao}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAbastecimentoModal(false)}
                className="text-gray-400 hover:text-gray-600 p-2 rounded-xl hover:bg-gray-100 transition-colors"
              >
                <LucideX size={20} />
              </button>
            </div>

            {/* Valor Atual da Despesa */}
            <div className="bg-amber-50/70 border border-amber-100 p-4 rounded-2xl flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-amber-800">Saldo Atual da Despesa</p>
                <p className="text-xl font-black text-amber-950 mt-0.5">{formatCurrency(selectedGasolineExpense.valor)}</p>
              </div>
              <p className="text-[10px] font-bold text-amber-700 uppercase max-w-[120px] text-right">
                O valor será subtraído deste saldo
              </p>
            </div>

            <form onSubmit={handleAddAbastecimento} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-wider mb-1">
                  Valor do Abastecimento (R$) *
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={abastecimentoForm.val}
                  onChange={(e) => setAbastecimentoForm({ ...abastecimentoForm, val: maskCurrency(e.target.value) })}
                  placeholder="R$ 0,00"
                  required
                  className="w-full bg-gray-50 border-2 border-transparent focus:border-amber-500 focus:bg-white rounded-xl px-4 py-3 text-lg font-black text-gray-900 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-wider mb-1">
                  Data do Abastecimento *
                </label>
                <input
                  type="date"
                  value={abastecimentoForm.date}
                  onChange={(e) => setAbastecimentoForm({ ...abastecimentoForm, date: e.target.value })}
                  required
                  className="w-full bg-gray-50 border-2 border-transparent focus:border-amber-500 focus:bg-white rounded-xl px-4 py-3 text-sm font-bold text-gray-900 outline-none transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={submittingAbastecimento || parseCurrency(abastecimentoForm.val) <= 0}
                className="w-full bg-amber-500 hover:bg-amber-600 text-white font-black py-3.5 rounded-xl uppercase tracking-wider text-xs shadow-lg shadow-amber-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Plus size={16} />
                {submittingAbastecimento ? 'Salvando...' : 'Confirmar & Abater Saldo'}
              </button>
            </form>

            {/* Histórico de Abastecimentos */}
            <div className="border-t border-gray-100 pt-4 space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-gray-800">
                Histórico de Abastecimentos ({getHistorico(selectedGasolineExpense).length})
              </h4>
              <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
                {getHistorico(selectedGasolineExpense).length === 0 ? (
                  <p className="text-[11px] text-gray-400 font-medium text-center py-3 uppercase tracking-wider">
                    Nenhum abastecimento registrado ainda.
                  </p>
                ) : (
                  getHistorico(selectedGasolineExpense).map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between bg-gray-50 p-3 rounded-xl text-xs font-bold border border-gray-100"
                    >
                      <div className="flex items-center gap-2">
                        <Fuel size={14} className="text-amber-600" />
                        <span className="text-gray-600">{formatDateSafe(item.data)}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-amber-700 font-black">-{formatCurrency(item.valor)}</span>
                        <button
                          type="button"
                          onClick={() => setItemToDeleteAbastecimento(item)}
                          title="Excluir Abastecimento"
                          className="text-gray-400 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO DE ABASTECIMENTO (DO PRÓPRIO SISTEMA) */}
      {itemToDeleteAbastecimento && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-5 text-center border border-gray-100">
            <div className="bg-rose-100 text-rose-600 p-3.5 rounded-2xl w-12 h-12 flex items-center justify-center mx-auto">
              <AlertTriangle size={24} />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base font-black text-gray-900 uppercase tracking-tight">
                Excluir Abastecimento?
              </h3>
              <p className="text-xs font-semibold text-gray-500 leading-relaxed">
                Deseja realmente remover o abastecimento de{' '}
                <strong className="text-gray-900 font-black">{formatCurrency(itemToDeleteAbastecimento.valor)}</strong> registrado no dia{' '}
                <strong className="text-gray-900 font-black">{formatDateSafe(itemToDeleteAbastecimento.data)}</strong>?
              </p>
              <div className="bg-amber-50 border border-amber-200/60 p-2.5 rounded-xl text-[11px] font-bold text-amber-800 mt-2">
                O valor de {formatCurrency(itemToDeleteAbastecimento.valor)} será somado de volta ao saldo da despesa.
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setItemToDeleteAbastecimento(null)}
                disabled={submittingAbastecimento}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-extrabold py-3 rounded-xl text-xs uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDeleteAbastecimento}
                disabled={submittingAbastecimento}
                className="bg-rose-600 hover:bg-rose-700 text-white font-black py-3 rounded-xl text-xs uppercase tracking-wider shadow-lg shadow-rose-600/20 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Trash2 size={15} />
                {submittingAbastecimento ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Expenses;