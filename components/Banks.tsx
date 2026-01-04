import React, { useState, useEffect } from 'react';
import { Banknote, Plus, ChevronRight, ArrowLeft, Trash2, CheckCircle2, Circle, Save, Info, X as LucideX } from 'lucide-react';
import { supabaseClient } from '../services/supabase';
import { Month, Bank, BankExpense } from '../types';

interface BanksProps {
  currentMonth: Month;
  triggerAdd: number;
}

const Banks: React.FC<BanksProps> = ({ currentMonth, triggerAdd }) => {
  const [banks, setBanks] = useState<Bank[]>([]);
  const [selectedBank, setSelectedBank] = useState<Bank | null>(null);
  const [bankExpenses, setBankExpenses] = useState<BankExpense[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [specialFields, setSpecialFields] = useState<{ [key: string]: string }>({});
  const [saving, setSaving] = useState(false);

  const [showBankModal, setShowBankModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [bankForm, setBankForm] = useState({ nome: '', cor: '#15803d' });
  const [expForm, setExpForm] = useState({ desc: '', val: 'R$ 0,00', date: new Date().toISOString().split('T')[0] });

  useEffect(() => {
    fetchBanks();
  }, []);

  useEffect(() => {
    if (triggerAdd > 0 && !selectedBank) {
      setBankForm({ nome: '', cor: '#15803d' });
      setShowBankModal(true);
    }
  }, [triggerAdd]);

  useEffect(() => {
    if (selectedBank) {
      fetchBankExpenses();
    }
  }, [selectedBank, currentMonth]);

  const fetchBanks = async () => {
    try {
      const { data, error } = await supabaseClient.from('bancos').select('*').order('nome');
      if (error) throw error;
      setBanks(data || []);
    } catch (err) {
      console.error("Erro ao buscar bancos:", err);
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

  const fetchBankExpenses = async () => {
    if (!selectedBank) return;
    const { data } = await supabaseClient
      .from('banco_despesas')
      .select('*')
      .eq('banco_id', selectedBank.id)
      .eq('mes_id', currentMonth.id)
      .order('data', { ascending: true });
    
    setBankExpenses(data || []);

    const isSpecial = selectedBank.nome === 'American Express' || selectedBank.nome === 'BB';
    if (isSpecial) {
      const initialFields: { [key: string]: string } = {};
      const fields = selectedBank.nome === 'American Express' 
        ? ['Compras à Vista', 'Em Processamento'] 
        : ['Compras à Vista', 'Em Processamento', 'Parceladas'];

      fields.forEach(f => {
        const found = data?.find(d => d.descricao === f);
        initialFields[f] = maskCurrency(found ? (found.valor * 100).toString() : '0');
      });
      setSpecialFields(initialFields);
    }
  };

  const handleCreateBank = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabaseClient.from('bancos').insert([bankForm]);
    if (error) {
      alert("Erro ao criar: " + error.message);
    } else {
      setShowBankModal(false);
      setBankForm({ nome: '', cor: '#15803d' });
      fetchBanks();
    }
  };

  const handleDeleteBank = async (id: number, name: string) => {
    if (currentMonth.status === 'fechado') return;
    try {
      const { error } = await supabaseClient.from('bancos').delete().eq('id', id);
      if (error) {
        if (error.code === '23503') {
          alert(`Não foi possível excluir o banco "${name}". Remova os gastos primeiro.`);
        } else {
          alert("Erro: " + error.message);
        }
      } else {
        setBanks(prev => prev.filter(b => b.id !== id));
        setConfirmDeleteId(null);
      }
    } catch (err: any) {
      alert("Erro fatal: " + err.message);
    }
  };

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBank) return;
    const val = parseCurrency(expForm.val);
    if (val <= 0) return;

    await supabaseClient.from('banco_despesas').insert([{
      mes_id: currentMonth.id,
      banco_id: selectedBank.id,
      descricao: expForm.desc,
      valor: val,
      pago: true,
      data: expForm.date
    }]);

    setShowExpenseModal(false);
    setExpForm({ desc: '', val: 'R$ 0,00', date: new Date().toISOString().split('T')[0] });
    fetchBankExpenses();
  };

  const handleDeleteExpense = async (id: number) => {
    if (currentMonth.status === 'fechado') return;
    await supabaseClient.from('banco_despesas').delete().eq('id', id);
    fetchBankExpenses();
  };

  const handleSaveSpecial = async () => {
    if (!selectedBank) return;
    setSaving(true);
    try {
      const fields = Object.keys(specialFields);
      for (const field of fields) {
        const val = parseCurrency(specialFields[field]);
        const existing = bankExpenses.find(e => e.descricao === field);
        if (existing) {
          await supabaseClient.from('banco_despesas').update({ valor: val }).eq('id', existing.id);
        } else {
          await supabaseClient.from('banco_despesas').insert([{
            mes_id: currentMonth.id,
            banco_id: selectedBank.id,
            descricao: field,
            valor: val,
            pago: true,
            data: new Date().toISOString().split('T')[0]
          }]);
        }
      }
      alert("Dados de " + selectedBank.nome + " salvos!");
      fetchBankExpenses();
    } catch (error) {
      alert("Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const canEdit = currentMonth.status !== 'fechado';

  if (selectedBank) {
    const total = bankExpenses.reduce((acc, curr) => acc + curr.valor, 0);
    const isSpecial = selectedBank.nome === 'American Express' || selectedBank.nome === 'BB';

    return (
      <div className="space-y-6 animate-in slide-in-from-right duration-300">
        <button onClick={() => setSelectedBank(null)} className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition font-bold">
          <ArrowLeft size={18} /> Voltar
        </button>

        <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 p-6 lg:p-10">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-10">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-[1.5rem] flex items-center justify-center shadow-xl shadow-gray-200" style={{ backgroundColor: selectedBank.cor, color: selectedBank.nome === 'BB' ? '#003366' : 'white' }}>
                <Banknote size={32} />
              </div>
              <div>
                <h3 className="text-2xl font-black text-gray-900">{selectedBank.nome}</h3>
                <p className="text-sm text-gray-500 font-bold uppercase tracking-widest">{formatCurrency(total)}</p>
              </div>
            </div>
            {!isSpecial && canEdit && (
              <button onClick={() => setShowExpenseModal(true)} className="w-full sm:w-auto bg-green-800 text-white px-6 py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg">
                <Plus size={20} /> Novo Lançamento
              </button>
            )}
          </div>

          {isSpecial ? (
            <div className="max-w-xl mx-auto space-y-6 bg-gray-50 p-6 lg:p-10 rounded-[2.5rem] border border-gray-100">
              <div className="flex items-center gap-3 text-blue-800 mb-6 bg-blue-50 p-4 rounded-2xl border border-blue-100">
                <Info size={24} className="shrink-0" />
                <span className="text-xs font-bold leading-tight uppercase tracking-wider">Gestão global de saldo para {selectedBank.nome}</span>
              </div>
              
              <div className="space-y-6">
                {Object.keys(specialFields).map(f => (
                  <div key={f}>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">{f}</label>
                    <input 
                      type="text" 
                      inputMode="numeric"
                      value={specialFields[f]} 
                      onChange={e => setSpecialFields({...specialFields, [f]: maskCurrency(e.target.value)})}
                      className="w-full bg-white border border-gray-200 rounded-2xl px-5 py-5 outline-none focus:border-green-700 font-black text-2xl text-gray-800 transition"
                      disabled={!canEdit}
                    />
                  </div>
                ))}
              </div>

              {canEdit && (
                <button onClick={handleSaveSpecial} disabled={saving} className="w-full bg-green-800 text-white font-black py-6 rounded-2xl shadow-2xl hover:bg-green-900 transition flex items-center justify-center gap-3 mt-10">
                  {saving ? <div className="h-6 w-6 animate-spin rounded-full border-3 border-white border-t-transparent" /> : <Save size={24} />}
                  Salvar {selectedBank.nome}
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {bankExpenses.length === 0 ? (
                <div className="py-20 text-center">
                  <div className="bg-gray-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Banknote className="text-gray-200" size={40} />
                  </div>
                  <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">Sem lançamentos</p>
                </div>
              ) : (
                bankExpenses.map(exp => (
                  <div key={exp.id} className="flex items-center justify-between p-5 rounded-2xl border border-gray-100 bg-white hover:border-green-200 transition">
                    <div className="flex items-center gap-4">
                      <div className="bg-green-50 p-3 rounded-xl text-green-700"><CheckCircle2 size={20} /></div>
                      <div>
                        <h4 className="font-black text-gray-800">{exp.descricao}</h4>
                        <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">{new Date(exp.data).toLocaleDateString('pt-BR')}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <span className="font-black text-lg text-gray-900">{formatCurrency(exp.valor)}</span>
                      {canEdit && (
                        <button onClick={() => handleDeleteExpense(exp.id)} className="text-gray-300 hover:text-red-500 transition-colors p-2">
                          <Trash2 size={20} />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {showExpenseModal && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white w-full max-md p-8 rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl animate-in fade-in slide-in-from-bottom sm:zoom-in duration-300">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-black text-gray-900">Novo Gasto</h2>
                <button onClick={() => setShowExpenseModal(false)} className="text-gray-400"><LucideX /></button>
              </div>
              <form onSubmit={handleCreateExpense} className="space-y-5">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase mb-2">Descrição</label>
                  <input type="text" placeholder="Ex: Farmácia..." className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 outline-none focus:border-green-700 font-bold" value={expForm.desc} onChange={e => setExpForm({...expForm, desc: e.target.value})} required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-2">Valor</label>
                    <input type="text" inputMode="numeric" className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 outline-none focus:border-green-700 font-bold" value={expForm.val} onChange={e => setExpForm({...expForm, val: maskCurrency(e.target.value)})} required />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-2">Data</label>
                    <input type="date" className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 outline-none focus:border-green-700 font-bold" value={expForm.date} onChange={e => setExpForm({...expForm, date: e.target.value})} required />
                  </div>
                </div>
                <div className="flex gap-4 pt-6">
                  <button type="button" onClick={() => setShowExpenseModal(false)} className="flex-1 bg-gray-100 py-5 rounded-2xl font-black text-gray-500 uppercase tracking-widest text-xs">Cancelar</button>
                  <button type="submit" className="flex-1 bg-green-800 text-white py-5 rounded-2xl font-black shadow-xl uppercase tracking-widest text-xs">Registrar</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center px-2">
        <h3 className="text-xl font-black text-gray-900">Controle de Cartões</h3>
        {canEdit && (
          <button onClick={() => setShowBankModal(true)} className="bg-green-800 text-white px-5 py-3 rounded-full font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-lg">
            <Plus size={16} /> Adicionar
          </button>
        )}
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center gap-4 text-gray-400">
          <div className="w-10 h-10 border-4 border-green-700 border-t-transparent rounded-full animate-spin"></div>
          <p className="font-bold uppercase tracking-widest text-xs">Sincronizando...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {banks.map(bank => (
            <div key={bank.id} className="relative group">
              <div onClick={() => setSelectedBank(bank)} className="w-full bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 cursor-pointer transition-all hover:shadow-2xl hover:-translate-y-2 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 -mr-10 -mt-10 rounded-full opacity-5" style={{ backgroundColor: bank.cor }}></div>
                <div className="w-16 h-16 rounded-[1.2rem] flex items-center justify-center mb-8 shadow-lg" style={{ backgroundColor: bank.cor, color: bank.nome === 'BB' ? '#003366' : 'white' }}><Banknote size={32} /></div>
                <div className="flex justify-between items-end relative z-10">
                  <div>
                    <h4 className="text-2xl font-black text-gray-900 mb-1">{bank.nome}</h4>
                    <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Gestão de Crédito</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-full group-hover:bg-green-700 group-hover:text-white transition-all"><ChevronRight size={24} /></div>
                </div>
              </div>

              {canEdit && (
                <div className="absolute top-6 right-6 z-30">
                  {confirmDeleteId === bank.id ? (
                    <div className="flex items-center gap-2 bg-red-600 text-white p-1 rounded-full shadow-2xl animate-in zoom-in duration-200 border-2 border-white">
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteBank(bank.id, bank.nome); }} className="pl-3 pr-2 py-1 text-[10px] font-black uppercase rounded-l-full">Confirmar</button>
                      <button onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null); }} className="bg-white/20 p-2 rounded-full"><LucideX size={14} /></button>
                    </div>
                  ) : (
                    <button onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(bank.id); }} className="p-3 bg-white/90 backdrop-blur-sm text-gray-300 hover:text-red-600 rounded-full shadow-md border border-gray-100 transition-all opacity-0 group-hover:opacity-100"><Trash2 size={20} /></button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showBankModal && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md p-8 rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl animate-in slide-in-from-bottom sm:zoom-in duration-300">
            <h2 className="text-2xl font-black text-gray-900 mb-8">Nova Instituição</h2>
            <form onSubmit={handleCreateBank} className="space-y-6">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase mb-2">Nome Comercial</label>
                <input type="text" placeholder="Ex: Nubank, Itaú..." className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-6 py-5 outline-none focus:border-green-700 font-bold" value={bankForm.nome} onChange={e => setBankForm({...bankForm, nome: e.target.value})} required />
              </div>
              <div className="flex items-center justify-between bg-gray-50 p-5 rounded-2xl border border-gray-100">
                <span className="text-sm font-bold text-gray-600">Cor</span>
                <input type="color" className="w-16 h-12 rounded-xl cursor-pointer bg-white p-1 border border-gray-200 shadow-sm" value={bankForm.cor} onChange={e => setBankForm({...bankForm, cor: e.target.value})} />
              </div>
              <div className="flex gap-4 pt-6">
                <button type="button" onClick={() => setShowBankModal(false)} className="flex-1 bg-gray-100 py-5 rounded-2xl font-black text-gray-500 uppercase tracking-widest text-xs">Cancelar</button>
                <button type="submit" className="flex-1 bg-green-800 text-white py-5 rounded-2xl font-black shadow-xl uppercase tracking-widest text-xs">Criar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Banks;