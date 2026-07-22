import React, { useState, useRef } from 'react';
import {
  Calculator as CalcIcon,
  TrendingDown,
  TrendingUp,
  Receipt,
  Percent,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  FileText,
  PieChart as PieIcon,
  Building2,
  CheckCircle2,
  Info,
  RefreshCw,
} from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { calcularPJ2026, PJResult2026 } from '../utils/pjCalculator2026';
import { updateSalaryRevenue } from '../utils/salaryUpdater';

export type PJResult = PJResult2026;

const PJCalculator: React.FC = () => {
  const [invoiceValue, setInvoiceValue] = useState<string>('');
  const [results, setResults] = useState<PJResult | null>(null);
  const [showMemoria, setShowMemoria] = useState<boolean>(true);
  const [updatingSalary, setUpdatingSalary] = useState<boolean>(false);
  const [updateMessage, setUpdateMessage] = useState<string | null>(null);

  const resultsRef = useRef<HTMLDivElement>(null);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const maskCurrency = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (!digits) return '';
    const amount = Number(digits) / 100;
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount);
  };

  const handleCalculate = (e: React.FormEvent) => {
    e.preventDefault();
    const f = parseFloat(invoiceValue.replace(/[^\d]/g, '')) / 100 || 0;
    if (f <= 0) return;

    const res = calcularPJ2026({ faturamento: f });
    setResults(res);

    setTimeout(() => {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const handleUpdateSalary = async () => {
    if (!results) return;
    setUpdatingSalary(true);
    setUpdateMessage(null);
    const res = await updateSalaryRevenue('debora', results.faturamentoLiquido);
    setUpdateMessage(res.message);
    setUpdatingSalary(false);
  };

  // Preparação de dados para o Gráfico de Rosca (Donut Chart)
  const getChartData = () => {
    if (!results) return [];
    return [
      { name: 'Faturamento Líquido', value: results.faturamentoLiquido, color: '#16a34a' },
      { name: 'DAS Simples (6%)', value: results.dasSimples, color: '#d97706' },
      { name: 'DARF (11% s/ PL)', value: results.darf, color: '#dc2626' },
    ].filter((item) => item.value > 0);
  };

  const CustomChartTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div className="bg-gray-900 text-white p-3 rounded-xl shadow-xl text-xs space-y-1 border border-gray-800">
          <p className="font-bold uppercase tracking-wider text-[10px] text-gray-400">{item.name}</p>
          <p className="font-black text-sm text-white">{formatCurrency(item.value)}</p>
          {results && results.faturamento > 0 && (
            <p className="text-[10px] font-medium text-gray-300">
              {((item.value / results.faturamento) * 100).toFixed(2)}% do Faturamento
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6 lg:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
        {/* ENTRADA DE DADOS (Formulário PJ) */}
        <div className="flex-1">
          <div className="bg-white rounded-[2rem] lg:rounded-[2.5rem] p-6 lg:p-10 border border-gray-100 shadow-xl shadow-gray-200/50">
            <div className="flex items-center gap-3 lg:gap-4 mb-6 lg:mb-8">
              <div className="bg-gray-900 text-white p-3 lg:p-4 rounded-xl lg:rounded-2xl shadow-lg shadow-gray-900/30">
                <CalcIcon size={20} className="lg:w-6 lg:h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl lg:text-2xl font-black tracking-tight uppercase leading-none text-gray-900">
                    Calculadora PJ
                  </h2>
                  <span className="bg-blue-100 text-blue-800 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                    Fator R
                  </span>
                </div>
                <p className="text-[9px] lg:text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">
                  Previsão & Retenção de Impostos
                </p>
              </div>
            </div>

            <form onSubmit={handleCalculate} className="space-y-6">
              <div>
                <label className="block text-[10px] lg:text-[11px] font-black text-gray-500 uppercase tracking-widest mb-2 ml-1">
                  Valor da Nota Fiscal (Faturamento Bruto) *
                </label>
                <div className="relative group">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={invoiceValue}
                    onChange={(e) => setInvoiceValue(maskCurrency(e.target.value))}
                    placeholder="R$ 0,00"
                    required
                    className="w-full bg-gray-50 border-2 border-transparent group-focus-within:border-gray-900 group-focus-within:bg-white rounded-2xl lg:rounded-[1.2rem] px-5 lg:px-6 py-4 lg:py-5 text-xl lg:text-2xl font-black text-gray-900 outline-none transition-all placeholder:text-gray-300"
                  />
                  <div className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-gray-900 transition-colors">
                    <Receipt size={24} />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={!invoiceValue || invoiceValue === 'R$ 0,00'}
                className="w-full bg-gray-900 hover:bg-black text-white font-black py-4 lg:py-5 rounded-2xl text-xs lg:text-sm uppercase tracking-[0.2em] shadow-xl shadow-gray-900/20 hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                Calcular Impostos
                <ArrowRight size={18} />
              </button>
            </form>

            <div className="mt-8 p-4 bg-blue-50/60 rounded-2xl border border-blue-100 flex items-start gap-3">
              <div className="bg-blue-100 p-2 rounded-xl text-blue-700">
                <Percent size={16} />
              </div>
              <div className="space-y-0.5">
                <p className="text-[11px] font-black text-blue-900 uppercase tracking-tight">Regra das Alíquotas PJ</p>
                <p className="text-[10px] font-medium text-blue-800/80 leading-relaxed uppercase">
                  Pró-labore: 28% do Valor da Nota • DAS Simples: 6% • DARF INSS: 11% sobre o Pró-labore.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* DEMONSTRATIVO & RESULTADOS */}
        <div className="flex-1 space-y-6">
          {results ? (
            <div ref={resultsRef} className="space-y-6 animate-in fade-in zoom-in duration-500">
              {/* CARD PRINCIPAL DE RESULTADO */}
              <div className="bg-gradient-to-br from-gray-900 via-slate-800 to-gray-950 rounded-[2rem] lg:rounded-[2.5rem] p-6 lg:p-8 text-white shadow-2xl shadow-gray-950/20 relative overflow-hidden">
                <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

                <div className="flex justify-between items-start mb-6">
                  <div>
                    <span className="bg-blue-900/60 text-blue-200 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest border border-blue-700/30">
                      Resultado Final PJ
                    </span>
                    <p className="text-[10px] lg:text-[11px] font-black text-gray-300 uppercase tracking-[0.2em] mt-3">
                      Faturamento Líquido
                    </p>
                    <h3 className="text-4xl lg:text-5xl font-black tracking-tighter text-white mt-1">
                      {formatCurrency(results.faturamentoLiquido)}
                    </h3>
                  </div>
                  <div className="bg-white/10 p-3.5 rounded-2xl text-emerald-400 border border-white/10 backdrop-blur-sm">
                    <TrendingUp size={28} />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 pt-4 border-t border-gray-700/60">
                  <div className="bg-black/30 p-3 rounded-xl border border-gray-700/40">
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-wider">Faturamento Bruto</p>
                    <p className="text-sm lg:text-base font-black text-white mt-0.5">{formatCurrency(results.faturamento)}</p>
                  </div>
                  <div className="bg-black/30 p-3 rounded-xl border border-gray-700/40">
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-wider">Total Impostos</p>
                    <p className="text-sm lg:text-base font-black text-rose-400 mt-0.5">{formatCurrency(results.totalImpostos)}</p>
                  </div>
                  <div className="bg-black/30 p-3 rounded-xl border border-gray-700/40">
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-wider">Impostos (%)</p>
                    <p className="text-sm lg:text-base font-black text-amber-400 mt-0.5">{results.percentualImpostos.toFixed(2)}%</p>
                  </div>
                </div>

                {/* BOTÃO ATUALIZAR SALÁRIO */}
                <div className="mt-4 pt-4 border-t border-gray-700/60 flex flex-col items-center gap-2">
                  <button
                    type="button"
                    onClick={handleUpdateSalary}
                    disabled={updatingSalary}
                    className="w-full bg-white hover:bg-gray-100 text-gray-900 font-black py-3 px-5 rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2.5 uppercase tracking-wider text-xs active:scale-95 disabled:opacity-50 cursor-pointer"
                  >
                    <RefreshCw size={16} className={updatingSalary ? 'animate-spin' : ''} />
                    {updatingSalary ? 'Sincronizando Banco...' : 'Atualizar Salário'}
                  </button>
                  {updateMessage && (
                    <div className={`w-full p-3 rounded-xl text-[11px] font-bold text-center leading-tight animate-in fade-in ${
                      updateMessage.includes('Erro') 
                        ? 'bg-rose-500/20 text-rose-200 border border-rose-500/30' 
                        : 'bg-emerald-500/30 text-emerald-100 border border-emerald-400/30'
                    }`}>
                      {updateMessage}
                    </div>
                  )}
                </div>
              </div>

              {/* GRÁFICO DE COMPOSIÇÃO (Donut Chart) */}
              <div className="bg-white rounded-[2rem] p-6 border border-gray-100 shadow-xl">
                <div className="flex items-center gap-2 mb-4">
                  <div className="bg-blue-100 p-2 rounded-xl text-blue-700">
                    <PieIcon size={18} />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-gray-900 uppercase tracking-tight">Composição da Nota Fiscal</h4>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Distribuição visual do faturamento</p>
                  </div>
                </div>

                <div className="h-64 w-full flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={getChartData()}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {getChartData().map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomChartTooltip />} />
                      <Legend
                        formatter={(value) => <span className="text-[11px] font-bold text-gray-700 uppercase">{value}</span>}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full min-h-[300px] lg:min-h-[400px] bg-gray-100/50 rounded-[2rem] lg:rounded-[2.5rem] border-2 border-dashed border-gray-200 flex flex-col items-center justify-center p-8 lg:p-12 text-center">
              <div className="bg-white p-4 lg:p-6 rounded-2xl lg:rounded-3xl shadow-sm mb-4 lg:mb-6 text-gray-300">
                <CalcIcon size={32} className="lg:w-12 lg:h-12" />
              </div>
              <h3 className="text-lg lg:text-xl font-black text-gray-900 uppercase tracking-tight mb-1 lg:mb-2 text-center">Aguardando Valor</h3>
              <p className="text-[10px] lg:text-xs font-bold text-gray-400 uppercase tracking-widest leading-relaxed max-w-[240px]">
                Insira o valor da nota fiscal para visualizar o demonstrativo completo.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* MEMÓRIA DE CÁLCULO (Estilo Holerite / Tabela) */}
      {results && (
        <div className="bg-white rounded-[2rem] border border-gray-100 shadow-xl overflow-hidden mt-8">
          <button
            type="button"
            onClick={() => setShowMemoria(!showMemoria)}
            className="w-full bg-gray-900 text-white p-5 flex items-center justify-between hover:bg-gray-800 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <FileText size={20} className="text-blue-400" />
              <div className="text-left">
                <h3 className="text-sm lg:text-base font-black uppercase tracking-wider">Ver Memória de CÁLCULO PJ</h3>
                <p className="text-[10px] text-gray-400 uppercase tracking-widest">Detalhamento de Faturamento, Pró-labore e Impostos</p>
              </div>
            </div>
            {showMemoria ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>

          {showMemoria && (
            <div className="p-6 lg:p-8 space-y-6">
              {/* Tabela de Holerite PJ Adaptativa */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-gray-200 text-gray-400 font-black uppercase tracking-wider text-[10px]">
                      <th className="pb-3 text-left pr-2">Item / Imposto</th>
                      <th className="pb-3 text-center hidden md:table-cell">Alíquota Base</th>
                      <th className="pb-3 text-center hidden md:table-cell">Base de CÁLCULO</th>
                      <th className="pb-3 text-right hidden md:table-cell">Proventos (R$)</th>
                      <th className="pb-3 text-right pl-2">
                        <span className="hidden md:inline">Descontos / Impostos (R$)</span>
                        <span className="md:hidden">Valores (R$)</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-medium">
                    <tr className="hover:bg-gray-50/60">
                      <td className="py-3 font-bold text-gray-900 pr-2">Valor Bruto da Nota Fiscal</td>
                      <td className="py-3 text-center text-gray-400 hidden md:table-cell">-</td>
                      <td className="py-3 text-center text-gray-400 hidden md:table-cell">-</td>
                      <td className="py-3 text-right font-bold text-gray-900 hidden md:table-cell">{formatCurrency(results.faturamento)}</td>
                      <td className="py-3 text-right font-bold text-emerald-700 md:text-gray-400 pl-2 whitespace-nowrap">
                        <span className="md:hidden text-emerald-700">+</span> {formatCurrency(results.faturamento)}
                      </td>
                    </tr>

                    <tr className="hover:bg-gray-50/60">
                      <td className="py-3 font-bold text-blue-700 pr-2">Pró-labore (Retirada Obrigatória)</td>
                      <td className="py-3 text-center font-bold text-gray-700 hidden md:table-cell">28,00%</td>
                      <td className="py-3 text-center text-gray-600 hidden md:table-cell">{formatCurrency(results.faturamento)}</td>
                      <td className="py-3 text-right font-bold text-blue-700 hidden md:table-cell">{formatCurrency(results.proLabore)}</td>
                      <td className="py-3 text-right font-bold text-blue-700 md:text-gray-400 pl-2 whitespace-nowrap">
                        <span className="md:hidden text-blue-700">+</span> {formatCurrency(results.proLabore)}
                      </td>
                    </tr>

                    <tr className="hover:bg-gray-50/60">
                      <td className="py-3 font-bold text-amber-700 pr-2">DAS Simples Nacional</td>
                      <td className="py-3 text-center font-bold text-gray-700 hidden md:table-cell">6,00%</td>
                      <td className="py-3 text-center text-gray-600 hidden md:table-cell">{formatCurrency(results.faturamento)}</td>
                      <td className="py-3 text-right text-gray-400 hidden md:table-cell">-</td>
                      <td className="py-3 text-right font-bold text-amber-700 pl-2 whitespace-nowrap">-{formatCurrency(results.dasSimples)}</td>
                    </tr>

                    <tr className="hover:bg-gray-50/60">
                      <td className="py-3 font-bold text-rose-700 pr-2">DARF INSS (s/ Pró-labore)</td>
                      <td className="py-3 text-center font-bold text-gray-700 hidden md:table-cell">11,00%</td>
                      <td className="py-3 text-center text-gray-600 hidden md:table-cell">{formatCurrency(results.proLabore)}</td>
                      <td className="py-3 text-right text-gray-400 hidden md:table-cell">-</td>
                      <td className="py-3 text-right font-bold text-rose-700 pl-2 whitespace-nowrap">-{formatCurrency(results.darf)}</td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-900 font-black text-sm hidden md:table-row">
                      <td colSpan={3} className="pt-4 text-gray-900 uppercase tracking-wider">
                        Totais
                      </td>
                      <td className="pt-4 text-right text-emerald-700">{formatCurrency(results.faturamento)}</td>
                      <td className="pt-4 text-right text-rose-700">{formatCurrency(results.totalImpostos)}</td>
                    </tr>
                    {/* Mobile: Card empilhado em duas linhas */}
                    <tr className="bg-emerald-50/80 font-black border-t-2 border-emerald-300 md:hidden">
                      <td colSpan={2} className="py-4 px-3 text-center">
                        <div className="text-2xl font-black text-emerald-950 tracking-tight">
                          {formatCurrency(results.faturamentoLiquido)}
                        </div>
                        <div className="text-[10px] font-extrabold text-emerald-700 uppercase tracking-widest mt-1">
                          Valor Líquido Atualizado
                        </div>
                      </td>
                    </tr>
                    {/* Desktop: Linha única original */}
                    <tr className="bg-emerald-50/80 font-black text-base border-t border-emerald-200 hidden md:table-row">
                      <td colSpan={3} className="py-3 px-2 text-emerald-950 uppercase tracking-widest">
                        Faturamento Líquido Final
                      </td>
                      <td colSpan={2} className="py-3 text-right text-emerald-800 text-lg">
                        {formatCurrency(results.faturamentoLiquido)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Informações Explicativas da Memória de Cálculo PJ */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-gray-100 text-[11px] font-medium text-gray-600">
                <div className="bg-blue-50/60 p-4 rounded-2xl border border-blue-100 space-y-1">
                  <p className="font-black text-blue-900 uppercase tracking-wider text-[10px]">Pró-labore (28%)</p>
                  <p>Valor Definido: <span className="font-bold">{formatCurrency(results.proLabore)}</span></p>
                  <p className="text-[10px] text-blue-800/80 leading-relaxed mt-1">
                    Garante o enquadramento no Anexo III do Simples Nacional (Fator R ≥ 28%).
                  </p>
                </div>

                <div className="bg-amber-50/60 p-4 rounded-2xl border border-amber-100 space-y-1">
                  <p className="font-black text-amber-900 uppercase tracking-wider text-[10px]">DAS Simples (6%)</p>
                  <p>Imposto Único: <span className="font-bold">{formatCurrency(results.dasSimples)}</span></p>
                  <p className="text-[10px] text-amber-800/80 leading-relaxed mt-1">
                    Incide diretamente sobre o valor bruto faturado na nota fiscal.
                  </p>
                </div>

                <div className="bg-emerald-50/60 p-4 rounded-2xl border border-emerald-100 space-y-1">
                  <p className="font-black text-emerald-900 uppercase tracking-wider text-[10px]">Distribuição de Lucros</p>
                  <p>Lucro Isento: <span className="font-bold text-emerald-700">{formatCurrency(results.lucroIsento)}</span></p>
                  <p className="text-[10px] text-emerald-800/80 leading-relaxed mt-1">
                    Isento de Imposto de Renda Pessoa Física (IRPF) para transferência da empresa para sua conta física.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PJCalculator;
