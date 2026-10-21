
import React, { useState, useEffect, useMemo } from 'react';
import { CalendarClock, Trash2, X as LucideX, Info, Wallet, Pencil, RefreshCw, CreditCard, Building2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { supabaseClient, DEFAULT_BANCOS } from '../services/supabase';
import { Month, Installment, Bank } from '../types';

interface InstallmentsProps {
  currentMonth: Month;
  triggerAdd: number;
}

// Configuração visual explícita para evitar problemas de purge do Tailwind CSS
// e garantir contraste e fidelidade de cor para todos os bancos cadastrados
export const getBankVisualConfig = (bank: Bank | null | undefined) => {
  if (!bank) {
    return {
      borderColor: '#e5e7eb',
      borderClass: 'border-gray-200',
      badgeBg: '#f3f4f6',
      badgeText: '#4b5563',
      badgeBorder: '#d1d5db',
      dotColor: '#9ca3af'
    };
  }

  const nome = (bank.nome || '').trim().toLowerCase();
  const rawColor = (bank.cor || '').trim().toLowerCase();

  // C6 Bank: Borda preta absoluta com alto impacto visual
  if (nome.includes('c6') || rawColor === '#000000' || rawColor === '#000') {
    return {
      borderColor: '#000000',
      borderClass: 'border-black',
      badgeBg: '#000000',
      badgeText: '#ffffff',
      badgeBorder: '#000000',
      dotColor: '#ffffff'
    };
  }

  // Banco do Brasil (BB): Amarelo ouro calibrado para contraste em fundo branco
  if (nome.includes('bb') || nome.includes('brasil') || rawColor === '#ffff00' || rawColor === '#fcfd04') {
    return {
      borderColor: '#EAB308',
      borderClass: 'border-yellow-500',
      badgeBg: '#FEF08A',
      badgeText: '#713F12',
      badgeBorder: '#FACC15',
      dotColor: '#854D0E'
    };
  }

  // Nubank: Roxo icônico da marca
  if (nome.includes('nu') || rawColor === '#820ad1') {
    return {
      borderColor: '#820AD1',
      borderClass: 'border-purple-600',
      badgeBg: '#F3E8FF',
      badgeText: '#581C87',
      badgeBorder: '#C084FC',
      dotColor: '#820AD1'
    };
  }

  // Itaú: Laranja vibrante característico
  if (nome.includes('ita') || rawColor === '#ec7000') {
    return {
      borderColor: '#EC7000',
      borderClass: 'border-orange-500',
      badgeBg: '#FFEDD5',
      badgeText: '#7C2D12',
      badgeBorder: '#FB923C',
      dotColor: '#EC7000'
    };
  }

  // American Express (Amex): Azul nobre marinho
  if (nome.includes('express') || nome.includes('amex') || rawColor === '#001e62' || rawColor === '#0070cd') {
    return {
      borderColor: '#001E62',
      borderClass: 'border-blue-900',
      badgeBg: '#EFF6FF',
      badgeText: '#1E3A8A',
      badgeBorder: '#60A5FA',
      dotColor: '#001E62'
    };
  }

  // Bradesco
  if (nome.includes('bradesco') || rawColor === '#cc092f') {
    return {
      borderColor: '#CC092F',
      borderClass: 'border-red-600',
      badgeBg: '#FEE2E2',
      badgeText: '#7F1D1D',
      badgeBorder: '#F87171',
      dotColor: '#CC092F'
    };
  }

  // Santander
  if (nome.includes('santander') || rawColor === '#ec0000') {
    return {
      borderColor: '#EC0000',
      borderClass: 'border-red-600',
      badgeBg: '#FEE2E2',
      badgeText: '#7F1D1D',
      badgeBorder: '#F87171',
      dotColor: '#EC0000'
    };
  }

  // Inter
  if (nome.includes('inter') || rawColor === '#ff7a00') {
    return {
      borderColor: '#FF7A00',
      borderClass: 'border-orange-500',
      badgeBg: '#FFEDD5',
      badgeText: '#7C2D12',
      badgeBorder: '#FB923C',
      dotColor: '#FF7A00'
    };
  }

  // Fallback para qualquer outro banco cadastrado
  const customColor = bank.cor || '#4b5563';
  return {
    borderColor: customColor,
    borderClass: '',
    badgeBg: '#f3f4f6',
    badgeText: '#1f2937',
    badgeBorder: customColor,
    dotColor: customColor
  };
};

const Installments: React.FC<InstallmentsProps> = ({ currentMonth, triggerAdd }) => {
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [banks, setBanks] = useState<Bank[]>(DEFAULT_BANCOS);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showBankSummaryModal, setShowBankSummaryModal] = useState(false);
  const [showProjectConfirmModal, setShowProjectConfirmModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ desc: '', val: 'R$ 0,00', atual: '1', total: '1', banco_id: '' });
  const [projecting, setProjecting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(prev => (prev?.message === message ? null : prev));
    }, 4000);
  };

  useEffect(() => {
    fetchData();
  }, [currentMonth]);

  useEffect(() => {
    if (triggerAdd > 0) {
      setEditingId(null);
      setFormData({ desc: '', val: 'R$ 0,00', atual: '1', total: '1', banco_id: '' });
      setShowModal(true);
    }
  }, [triggerAdd]);

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
      total: (item.total_parcelas ?? 1).toString(),
      banco_id: item.banco_id != null ? String(item.banco_id) : ''
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    const val = parseCurrency(formData.val);
    
    setSubmitting(true);
    try {
      const parsedBancoId = formData.banco_id && formData.banco_id.trim() !== ''
        ? parseInt(formData.banco_id, 10)
        : null;

      const payload: any = {
        mes_id: currentMonth.id,
        descricao: formData.desc.trim(),
        valor_parcela: val,
        parcela_atual: parseInt(formData.atual, 10),
        total_parcelas: parseInt(formData.total, 10),
        banco_id: parsedBancoId
      };

      if (editingId) {
        // Atualização otimista imediata mantendo a exata mesma posição e ordenação visual
        setInstallments(prev => prev.map(item => item.id === editingId ? { ...item, ...payload } : item));

        // Persistência segura no Supabase
        const { error } = await supabaseClient
          .from('parcelamentos')
          .update(payload)
          .eq('id', editingId)
          .select();

        if (error) {
          throw error;
        }

        // Propaga o banco_id para outras parcelas da mesma série de compra
        // para garantir consistência ao alternar meses
        if (payload.descricao && payload.total_parcelas) {
          try {
            await supabaseClient
              .from('parcelamentos')
              .update({ banco_id: parsedBancoId })
              .eq('descricao', payload.descricao)
              .eq('total_parcelas', payload.total_parcelas)
              .neq('id', editingId);
          } catch (propErr) {
            console.warn("Aviso ao propagar banco para parcelas da mesma série:", propErr);
          }
        }

        setShowModal(false);
        setEditingId(null);
        showToast("Parcelamento atualizado com sucesso!", "success");
      } else {
        const { data: created, error } = await supabaseClient
          .from('parcelamentos')
          .insert([payload])
          .select();

        if (error) {
          throw error;
        }

        setShowModal(false);
        setEditingId(null);
        showToast("Parcelamento criado com sucesso!", "success");
        await fetchData();
      }
    } catch (err: any) {
      console.error("Erro ao salvar parcelamento:", err);
      showToast("Erro ao salvar parcelamento: " + (err.message || "Tente novamente"), "error");
      await fetchData();
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

  const meses_nomes = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];

  const getMonthIndex = (nome: string) => meses_nomes.indexOf((nome || '').trim().toUpperCase());

  // Helper para buscar ou criar mês com status 'ativo' (evita erro de check constraint 'meses_status_check')
  const getOrCreateMonth = async (nome: string, ano: number): Promise<Month | null> => {
    const nomeUpper = nome.toUpperCase();
    const { data: existing } = await supabaseClient
      .from('meses')
      .select('*')
      .ilike('nome', nomeUpper)
      .eq('ano', ano)
      .maybeSingle();

    if (existing) return existing;

    // Tenta criar como 'ativo' (compatível com a constraint do Postgres)
    const { data: createdAtivo, error: errAtivo } = await supabaseClient
      .from('meses')
      .insert([{ nome: nomeUpper, ano, status: 'ativo' }])
      .select()
      .single();

    if (!errAtivo && createdAtivo) return createdAtivo;

    // Fallback tenta 'provisionamento'
    const { data: createdProv, error: errProv } = await supabaseClient
      .from('meses')
      .insert([{ nome: nomeUpper, ano, status: 'provisionamento' }])
      .select()
      .single();

    if (!errProv && createdProv) return createdProv;

    console.error("Erro ao criar mês de destino:", errAtivo || errProv);
    return null;
  };

  // Helper para buscar parcelas ativas do mês anterior mais próximo que possua dados
  const fetchPrecedingMonthInstallments = async (targetMonth: Month) => {
    try {
      const { data: allMonths } = await supabaseClient
        .from('meses')
        .select('*')
        .order('ano', { ascending: true });

      if (!allMonths) return null;

      const targetIdx = getMonthIndex(targetMonth.nome);
      if (targetIdx === -1) return null;
      const targetVal = targetMonth.ano * 12 + targetIdx;

      const precMonths = allMonths
        .filter(m => (m.ano * 12 + getMonthIndex(m.nome)) < targetVal)
        .sort((a, b) => (b.ano * 12 + getMonthIndex(b.nome)) - (a.ano * 12 + getMonthIndex(a.nome)));

      for (const pm of precMonths) {
        const { data: pData } = await supabaseClient
          .from('parcelamentos')
          .select('*')
          .eq('mes_id', pm.id);

        if (pData && pData.length > 0) {
          const pmIdx = getMonthIndex(pm.nome);
          const pmVal = pm.ano * 12 + pmIdx;
          const diffMonths = targetVal - pmVal;

          return {
            sourceMonth: pm,
            diffMonths,
            installments: pData
          };
        }
      }
    } catch (e) {
      console.error("Erro ao buscar parcelas do mês anterior:", e);
    }
    return null;
  };

  // Auto-sincroniza parcelas para um mês que não tem registros ainda
  const autoSyncFromPrecedingMonth = async (targetMonth: Month): Promise<Installment[]> => {
    const precInfo = await fetchPrecedingMonthInstallments(targetMonth);
    if (!precInfo) return [];

    const { diffMonths, installments: precInstallments } = precInfo;

    const toInsert = precInstallments
      .filter(p => ((p.parcela_atual ?? 1) + diffMonths) <= (p.total_parcelas ?? 1))
      .map(p => ({
        mes_id: targetMonth.id,
        descricao: p.descricao,
        valor_parcela: p.valor_parcela,
        parcela_atual: (p.parcela_atual ?? 1) + diffMonths,
        total_parcelas: p.total_parcelas,
        banco_id: p.banco_id ?? null
      }));

    if (toInsert.length > 0) {
      const { data: inserted, error } = await supabaseClient
        .from('parcelamentos')
        .insert(toInsert)
        .select();

      if (!error && inserted) {
        return inserted;
      }
    }
    return [];
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      // Carrega bancos cadastrados para associação visual
      const { data: bData } = await supabaseClient
        .from('bancos')
        .select('*')
        .order('nome');
      if (bData) {
        setBanks(bData);
      }

      const { data } = await supabaseClient
        .from('parcelamentos')
        .select('*')
        .eq('mes_id', currentMonth.id)
        .order('criado_em', { ascending: false });
      
      let currentInstallments = data || [];

      // Se o mês atual não tem parcelas, tenta auto-sincronizar do mês anterior ativo
      if (currentInstallments.length === 0 && currentMonth.id !== -1) {
        const synced = await autoSyncFromPrecedingMonth(currentMonth);
        if (synced && synced.length > 0) {
          currentInstallments = synced;
        }
      }

      const sorted = currentInstallments.slice().sort((a, b) => {
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

  const projectForMonth = async (targetMonthId: number, sourceInstallments: Installment[], increment: number) => {
    // Busca registros existentes no mês de destino para evitar duplicidades
    const { data: existingInTarget } = await supabaseClient
      .from('parcelamentos')
      .select('id, descricao, valor_parcela, total_parcelas, banco_id')
      .eq('mes_id', targetMonthId);
    
    const existingMap = new Map(
      (existingInTarget || []).map(i => [
        `${(i.descricao || '').trim().toLowerCase()}_${i.valor_parcela}_${i.total_parcelas}`,
        i
      ])
    );

    // Se o registro já existia no destino mas estava sem banco_id, sincroniza com o banco da origem
    for (const source of sourceInstallments) {
      if (source.banco_id != null) {
        const key = `${(source.descricao || '').trim().toLowerCase()}_${source.valor_parcela}_${source.total_parcelas}`;
        const existing = existingMap.get(key);
        if (existing && existing.banco_id == null) {
          try {
            await supabaseClient
              .from('parcelamentos')
              .update({ banco_id: source.banco_id })
              .eq('id', existing.id);
          } catch (e) {
            console.warn("Aviso ao sincronizar banco com registro existente:", e);
          }
        }
      }
    }

    const toInsert = sourceInstallments
      .filter(i => ((i.parcela_atual ?? 1) + increment) <= (i.total_parcelas ?? 1))
      .filter(i => {
        const key = `${(i.descricao || '').trim().toLowerCase()}_${i.valor_parcela}_${i.total_parcelas}`;
        return !existingMap.has(key);
      })
      .map(i => ({
        mes_id: targetMonthId,
        descricao: i.descricao,
        valor_parcela: i.valor_parcela,
        parcela_atual: (i.parcela_atual ?? 1) + increment,
        total_parcelas: i.total_parcelas,
        banco_id: i.banco_id ?? null
      }));

    if (toInsert.length > 0) {
      const { error } = await supabaseClient.from('parcelamentos').insert(toInsert);
      if (error) {
        console.error("Erro ao inserir parcelas projetadas:", error.message);
        throw error;
      }
    }
  };

  const handleStartProjection = async () => {
    let baseInstallments = installments;

    // Se o mês atual não tiver parcelas carregadas, busca a base do mês anterior ativo
    if (baseInstallments.length === 0) {
      const precInfo = await fetchPrecedingMonthInstallments(currentMonth);
      if (precInfo && precInfo.installments.length > 0) {
        // Ajusta as parcelas da base adicionando a diferença de meses até o mês atual
        baseInstallments = precInfo.installments
          .filter(p => ((p.parcela_atual ?? 1) + precInfo.diffMonths) <= (p.total_parcelas ?? 1))
          .map(p => ({
            ...p,
            parcela_atual: (p.parcela_atual ?? 1) + precInfo.diffMonths
          }));
      }
    }

    if (baseInstallments.length === 0) {
      showToast("Não há parcelamentos ativos no sistema para projetar.", "info");
      return;
    }

    setShowProjectConfirmModal(true);
  };

  const executeProjection = async () => {
    setShowProjectConfirmModal(false);
    let baseInstallments = installments;

    if (baseInstallments.length === 0) {
      const precInfo = await fetchPrecedingMonthInstallments(currentMonth);
      if (precInfo && precInfo.installments.length > 0) {
        baseInstallments = precInfo.installments
          .filter(p => ((p.parcela_atual ?? 1) + precInfo.diffMonths) <= (p.total_parcelas ?? 1))
          .map(p => ({
            ...p,
            parcela_atual: (p.parcela_atual ?? 1) + precInfo.diffMonths
          }));
      }
    }

    if (baseInstallments.length === 0) {
      showToast("Não há parcelamentos ativos no sistema para projetar.", "info");
      return;
    }

    setProjecting(true);
    try {
      let idx = getMonthIndex(currentMonth.nome);
      if (idx === -1) idx = 7; // Fallback Agosto
      
      // M+1
      let nextIdx1 = (idx + 1) % 12;
      let nextYear1 = idx === 11 ? currentMonth.ano + 1 : currentMonth.ano;
      const nextMonthName1 = meses_nomes[nextIdx1];

      // M+2
      let nextIdx2 = (idx + 2) % 12;
      let nextYear2 = currentMonth.ano + Math.floor((idx + 2) / 12);
      const nextMonthName2 = meses_nomes[nextIdx2];

      const nextMonth1 = await getOrCreateMonth(nextMonthName1, nextYear1);
      const nextMonth2 = await getOrCreateMonth(nextMonthName2, nextYear2);

      if (!nextMonth1) {
        showToast(`Erro: Não foi possível localizar ou criar o mês de destino (${nextMonthName1}/${nextYear1}).`, "error");
        return;
      }

      await projectForMonth(nextMonth1.id, baseInstallments, 1);
      if (nextMonth2) {
        await projectForMonth(nextMonth2.id, baseInstallments, 2);
      }

      showToast(`Projeção concluída para os meses futuros (${nextMonthName1}/${nextYear1}` + (nextMonth2 ? ` e ${nextMonthName2}/${nextYear2}` : '') + `)!`, "success");
      await fetchData();
    } catch (err: any) {
      console.error("Erro na projeção manual:", err);
      showToast("Ocorreu um erro ao projetar as parcelas: " + (err.message || err), "error");
    } finally {
      setProjecting(false);
    }
  };

  const totalParcelasMes = installments.reduce((acc, item) => acc + (item.valor_parcela ?? 0), 0);
  const totalUltimaParcelaMes = installments
    .filter(item => (item.parcela_atual ?? 1) === (item.total_parcelas ?? 1))
    .reduce((acc, item) => acc + (item.valor_parcela ?? 0), 0);

  // Agrupamento exclusivo de parcelas por banco (Isolamento contábil total)
  // Filtro estrito: lista APENAS bancos que possuem pelo menos uma parcela ativa no mês
  const bankSummary = useMemo(() => {
    const summaryMap: { [key: string]: { bank: Bank; count: number; total: number; items: Installment[] } } = {};

    installments.forEach(item => {
      // Ignora parcelamentos sem banco vinculado
      if (!item.banco_id) return;

      const bank = banks.find(b => Number(b.id) === Number(item.banco_id));
      if (!bank) return;

      const key = String(bank.id);
      if (!summaryMap[key]) {
        summaryMap[key] = { bank, count: 0, total: 0, items: [] };
      }
      summaryMap[key].count += 1;
      summaryMap[key].total += item.valor_parcela ?? 0;
      summaryMap[key].items.push(item);
    });

    const list = Object.values(summaryMap).filter(g => g.count > 0 && g.total > 0);
    list.sort((a, b) => b.total - a.total);
    return list;
  }, [banks, installments]);

  const totalParcelasBancos = useMemo(() => {
    return bankSummary.reduce((acc, g) => acc + g.total, 0);
  }, [bankSummary]);

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {loading ? (
        <div className="py-20 flex flex-col items-center gap-3 text-gray-400">
          <div className="w-8 h-8 border-3 border-green-700 border-t-transparent rounded-full animate-spin"></div>
          <p className="font-bold uppercase tracking-widest text-[9px]">Sincronizando...</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {/* Total Geral de Parcelas */}
            <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between gap-4 lg:rounded-3xl lg:shadow-md lg:shadow-gray-200/50 lg:border-gray-150/70 lg:hover:shadow-lg lg:transition-all">
              <div className="flex items-center gap-3.5">
                <div className="bg-emerald-50 p-3 rounded-2xl text-emerald-600 shrink-0 lg:rounded-2xl lg:shadow-xs">
                  <CalendarClock size={24} />
                </div>
                <div>
                  <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5 leading-none">Total Geral de Parcelas</h5>
                  <p className="text-xl font-black text-emerald-800 tracking-tight leading-none mt-1.5">{formatCurrency(totalParcelasMes)}</p>
                </div>
              </div>
            </div>

            {/* Parcelas acabando esse mês */}
            <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between gap-4 lg:rounded-3xl lg:shadow-md lg:shadow-gray-200/50 lg:border-gray-150/70 lg:hover:shadow-lg lg:transition-all">
              <div className="flex items-center gap-3.5">
                <div className="bg-blue-50 p-3 rounded-2xl text-blue-600 shrink-0 lg:rounded-2xl lg:shadow-xs">
                  <CalendarClock size={24} />
                </div>
                <div>
                  <h5 className="text-[10px] font-black text-gray-450 uppercase tracking-widest mb-0.5 leading-none">Parcelas acabando esse mês</h5>
                  <p className="text-xl font-black text-blue-800 tracking-tight leading-none mt-1.5">{formatCurrency(totalUltimaParcelaMes)}</p>
                </div>
              </div>
            </div>

            {/* Ações: Projetar e Parcelas por Banco */}
            <div className="bg-white p-3.5 rounded-3xl border border-gray-100 shadow-sm flex flex-col justify-center gap-2 lg:rounded-3xl lg:shadow-md lg:shadow-gray-200/50 lg:border-gray-150/70">
              {canEdit ? (
                <button 
                  onClick={handleStartProjection}
                  disabled={projecting}
                  className="w-full flex-1 min-h-[44px] flex items-center justify-center gap-2 bg-gray-900 text-white px-5 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest hover:bg-gray-800 active:scale-95 transition-all disabled:opacity-50 shadow-md cursor-pointer shrink-0 lg:rounded-2xl lg:shadow-md lg:hover:shadow-lg lg:hover:-translate-y-0.5"
                >
                  <RefreshCw size={14} className={projecting ? 'animate-spin' : ''} />
                  {projecting ? 'Projetando...' : 'Projetar para Meses Futuros'}
                </button>
              ) : (
                <div className="w-full py-2 flex items-center justify-center">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Mês Fechado para Edição</p>
                </div>
              )}

              <button 
                onClick={() => setShowBankSummaryModal(true)}
                className="w-full flex-1 min-h-[44px] flex items-center justify-center gap-2 bg-emerald-700 text-white px-5 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest hover:bg-emerald-800 active:scale-95 transition-all shadow-md cursor-pointer shrink-0 lg:rounded-2xl lg:shadow-md lg:hover:shadow-lg lg:hover:-translate-y-0.5"
              >
                <CreditCard size={14} />
                Parcelas por Banco
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {installments.length === 0 ? (
            <div className="col-span-full py-20 bg-white rounded-3xl border border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 lg:rounded-3xl lg:shadow-sm">
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
              const bank = item.banco_id != null ? banks.find(b => Number(b.id) === Number(item.banco_id)) : null;
              const bankVisual = getBankVisualConfig(bank);

              return (
                <div 
                  key={item.id} 
                  className={`bg-white rounded-3xl p-5 flex flex-col transition-all relative lg:rounded-3xl lg:shadow-md lg:shadow-gray-200/50 lg:hover:shadow-xl lg:hover:-translate-y-0.5 ${
                    isLast 
                      ? 'ring-2 ring-blue-500 ring-offset-2 animate-border-glow shadow-[0_0_15px_rgba(59,130,246,0.22)]' 
                      : 'shadow-sm'
                  }`}
                  style={{ 
                    borderWidth: '2.5px', 
                    borderStyle: 'solid', 
                    borderColor: bank ? bankVisual.borderColor : (isLast ? '#3b82f6' : '#e5e7eb') 
                  }}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`p-2 rounded-xl shrink-0 ${isLast ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-600'}`}>
                        <CalendarClock size={18} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 mb-1">
                          <h4 className="font-black text-gray-800 text-sm truncate max-w-[120px]" title={item.descricao}>{item.descricao}</h4>
                          {isLast && (
                            <span className="bg-blue-600 text-white text-[8px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider border border-blue-400 shadow-sm animate-pulse-subtle shrink-0">
                              ÚLTIMA
                            </span>
                          )}
                          {bank && (
                            <span 
                              className="text-[8px] font-black uppercase px-2.5 py-0.5 rounded-full tracking-wider border shadow-xs flex items-center gap-1.5 shrink-0"
                              style={{ 
                                backgroundColor: bankVisual.badgeBg, 
                                borderColor: bankVisual.badgeBorder,
                                color: bankVisual.badgeText
                              }}
                            >
                              <span 
                                className="w-1.5 h-1.5 rounded-full shrink-0 border border-black/10" 
                                style={{ backgroundColor: bankVisual.dotColor }}
                              />
                              {bank.nome}
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

      {/* Modal de Cadastro / Edição com Seleção de Banco */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm p-6 rounded-3xl shadow-2xl animate-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-black text-gray-900 uppercase tracking-tight">{editingId ? 'Editar' : 'Novo'} Parcelamento</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><LucideX size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1.5 tracking-widest">Descrição</label>
                <input type="text" value={formData.desc} onChange={e => setFormData({...formData, desc: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-green-700 font-bold text-sm" placeholder="Notebook..." required />
              </div>

              <div>
                <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1.5 tracking-widest">Banco (Cartão de Origem)</label>
                <select 
                  value={formData.banco_id} 
                  onChange={e => setFormData({ ...formData, banco_id: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-green-700 font-bold text-sm text-gray-800 cursor-pointer"
                >
                  <option value="">Sem Banco Vinculado</option>
                  {banks.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.nome}
                    </option>
                  ))}
                </select>
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

      {/* Modal PARCELAS POR BANCO (Exclusivo do Módulo de Parcelas) */}
      {showBankSummaryModal && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg p-6 sm:p-8 rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl animate-in fade-in slide-in-from-bottom sm:zoom-in duration-300 max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center pb-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <CreditCard size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-gray-900 uppercase tracking-tight">Parcelas por Banco</h2>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{currentMonth.nome} / {currentMonth.ano}</p>
                </div>
              </div>
              <button 
                onClick={() => setShowBankSummaryModal(false)} 
                className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-colors"
              >
                <LucideX size={18} />
              </button>
            </div>

            {/* Totalizador Geral Vinculado aos Bancos */}
            <div className="my-4 p-4 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Total das Parcelas por Banco</p>
                <p className="text-xl font-black text-gray-900 tracking-tight">{formatCurrency(totalParcelasBancos)}</p>
              </div>
              <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full uppercase tracking-wider">
                {bankSummary.length} {bankSummary.length === 1 ? 'banco ativo' : 'bancos ativos'}
              </span>
            </div>

            {/* Lista Simplificada dos Bancos e Totais Consolidados */}
            <div className="space-y-2.5 overflow-y-auto pr-1 flex-1 py-1">
              {bankSummary.length === 0 ? (
                <div className="py-12 text-center text-gray-400">
                  <CreditCard size={36} className="mx-auto mb-2 opacity-30" />
                  <p className="text-xs font-bold uppercase tracking-widest">Nenhum parcelamento vinculado a bancos neste mês</p>
                </div>
              ) : (
                bankSummary.map((group) => {
                  const bVisual = getBankVisualConfig(group.bank);
                  const bName = group.bank.nome;

                  return (
                    <div 
                      key={group.bank.id}
                      className="p-3.5 rounded-2xl border border-gray-100 bg-white shadow-xs transition-all hover:border-gray-300 flex items-center justify-between"
                      style={{ borderLeftWidth: '6px', borderLeftColor: bVisual.borderColor }}
                    >
                      <div className="flex items-center gap-3">
                        <span 
                          className="w-3.5 h-3.5 rounded-full shrink-0 border border-black/10 shadow-xs" 
                          style={{ backgroundColor: bVisual.borderColor }}
                        />
                        <h4 className="font-black text-sm text-gray-900 tracking-tight">{bName}</h4>
                      </div>
                      <div className="text-right">
                        <p className="text-base font-black text-gray-900 tracking-tight">{formatCurrency(group.total)}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Rodapé com isolamento e botão de fechar */}
            <div className="pt-4 border-t border-gray-100 mt-2 space-y-3">
              <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider text-center">
                Totalizador exclusivo do módulo de parcelas. Não afeta o saldo contábil ou outras telas.
              </p>
              <button 
                type="button" 
                onClick={() => setShowBankSummaryModal(false)} 
                className="w-full bg-gray-900 hover:bg-gray-800 text-white font-black py-3.5 rounded-2xl uppercase text-[10px] tracking-widest shadow-md transition-all active:scale-95 cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Projeção (Sem alert/confirm nativo) */}
      {showProjectConfirmModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md p-6 rounded-3xl shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
              <RefreshCw size={24} />
            </div>
            <h3 className="text-base font-black text-gray-900 tracking-tight mb-2 uppercase">Projetar Meses Futuros</h3>
            <p className="text-xs text-gray-600 leading-relaxed mb-6">
              Deseja projetar os parcelamentos ativos para os próximos 2 meses a partir de <strong>{currentMonth.nome}/{currentMonth.ano}</strong>?
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowProjectConfirmModal(false)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 rounded-xl uppercase text-[10px] tracking-widest transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={executeProjection}
                disabled={projecting}
                className="flex-1 bg-gray-900 hover:bg-gray-800 text-white font-black py-3 rounded-xl uppercase text-[10px] tracking-widest transition-colors shadow-md disabled:opacity-50 cursor-pointer"
              >
                {projecting ? 'Projetando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notificações do Sistema (Sem alert nativo) */}
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
            <Info size={18} className="text-blue-400 shrink-0" />
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

export default Installments;
