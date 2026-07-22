import React, { useState, useRef, useEffect } from 'react';
import {
  Calculator as CalcIcon,
  TrendingDown,
  TrendingUp,
  Receipt,
  Percent,
  ArrowRight,
  Info,
  HelpCircle,
  Users,
  HeartHandshake,
  DollarSign,
  ChevronDown,
  ChevronUp,
  FileText,
  PieChart as PieIcon,
  CheckCircle2,
} from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import {
  CLTInput2026,
  CLTResult2026,
  calcularCLT2026,
} from '../utils/cltCalculator2026';

const CLTCalculator2026: React.FC = () => {
  // Input States
  const [salarioBrutoStr, setSalarioBrutoStr] = useState<string>('');
  const [produtividadeStr, setProdutividadeStr] = useState<string>('');
  const [vrVaDesconto, setVrVaDesconto] = useState<boolean>(false);
  const [dependentesCount, setDependentesCount] = useState<number>(0);
  const [pensaoStr, setPensaoStr] = useState<string>('');
  
  // UI State
  const [showTooltipVRVA, setShowTooltipVRVA] = useState<boolean>(false);
  const [showMemoria, setShowMemoria] = useState<boolean>(true);
  const [results, setResults] = useState<CLTResult2026 | null>(null);

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

  const parseCurrencyInput = (formatted: string): number => {
    const digits = formatted.replace(/\D/g, '');
    if (!digits) return 0;
    return Number(digits) / 100;
  };

  // Pre-load default mandatory test case example on initial load or calculate handler
  useEffect(() => {
    // Initial auto-calculation with default state if desired, or wait for user input
    setSalarioBrutoStr('R$ 5.129,00');
    setProdutividadeStr('R$ 464,00');
    setVrVaDesconto(true);
    setDependentesCount(0);
    setPensaoStr('R$ 0,00');

    // Run initial calculation for R$ 5.129,00 + R$ 464,00
    const initialRes = calcularCLT2026({
      salarioBruto: 5129.00,
      produtividade: 464.00,
      vrVaDesconto: true,
      dependentesCount: 0,
      pensaoAlimenticia: 0,
    });
    setResults(initialRes);
  }, []);

  const handleCalculate = (e: React.FormEvent) => {
    e.preventDefault();
    const salarioBruto = parseCurrencyInput(salarioBrutoStr);
    const produtividade = parseCurrencyInput(produtividadeStr);
    const pensao = parseCurrencyInput(pensaoStr);

    if (salarioBruto <= 0 && produtividade <= 0) return;

    const res = calcularCLT2026({
      salarioBruto,
      produtividade,
      vrVaDesconto,
      dependentesCount,
      pensaoAlimenticia: pensao,
    });

    setResults(res);

    setTimeout(() => {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const salarioBrutoVal = parseCurrencyInput(salarioBrutoStr);

  // Chart Data preparation
  const getChartData = () => {
    if (!results) return [];
    const data = [
      { name: 'Salário Líquido', value: results.salarioLiquido, color: '#16a34a' },
      { name: 'INSS', value: results.inss, color: '#2563eb' },
      { name: 'IRRF', value: results.irrfFinal, color: '#dc2626' },
      { name: 'VR / VA', value: results.vrVa, color: '#d97706' },
    ];
    // Filter out zero slices
    return data.filter((item) => item.value > 0);
  };

  const CustomChartTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div className="bg-gray-900 text-white p-3 rounded-xl shadow-xl text-xs space-y-1 border border-gray-800">
          <p className="font-bold uppercase tracking-wider text-[10px] text-gray-400">{item.name}</p>
          <p className="font-black text-sm text-white">{formatCurrency(item.value)}</p>
          {results && results.proventosTotais > 0 && (
            <p className="text-[10px] font-medium text-gray-300">
              {((item.value / results.proventosTotais) * 100).toFixed(2)}% do Total
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
        {/* ENTRADA DE DADOS (Form) */}
        <div className="flex-1">
          <div className="bg-white rounded-[2rem] lg:rounded-[2.5rem] p-6 lg:p-10 border border-gray-100 shadow-xl shadow-gray-200/50">
            <div className="flex items-center gap-3 lg:gap-4 mb-6 lg:mb-8">
              <div className="bg-emerald-600 text-white p-3 lg:p-4 rounded-xl lg:rounded-2xl shadow-lg shadow-emerald-600/30">
                <CalcIcon size={20} className="lg:w-6 lg:h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl lg:text-2xl font-black tracking-tight uppercase leading-none text-gray-900">
                    Calculadora CLT
                  </h2>
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                    2026
                  </span>
                </div>
                <p className="text-[9px] lg:text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">
                  Simulação de Salário Líquido & Impostos
                </p>
              </div>
            </div>

            <form onSubmit={handleCalculate} className="space-y-5 lg:space-y-6">
              {/* 1. Salário Bruto */}
              <div>
                <label className="block text-[10px] lg:text-[11px] font-black text-gray-500 uppercase tracking-widest mb-1.5 ml-1">
                  1. Salário Bruto (R$) *
                </label>
                <div className="relative group">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={salarioBrutoStr}
                    onChange={(e) => setSalarioBrutoStr(maskCurrency(e.target.value))}
                    placeholder="R$ 0,00"
                    required
                    className="w-full bg-gray-50 border-2 border-transparent group-focus-within:border-emerald-600 group-focus-within:bg-white rounded-2xl lg:rounded-[1.2rem] px-5 lg:px-6 py-3.5 lg:py-4 text-lg lg:text-xl font-black text-gray-900 outline-none transition-all placeholder:text-gray-300"
                  />
                  <div className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-emerald-600 transition-colors">
                    <Receipt size={20} />
                  </div>
                </div>
              </div>

              {/* 2. Produtividade / Bônus */}
              <div>
                <label className="block text-[10px] lg:text-[11px] font-black text-gray-500 uppercase tracking-widest mb-1.5 ml-1">
                  2. Produtividade / Bônus (R$)
                </label>
                <div className="relative group">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={produtividadeStr}
                    onChange={(e) => setProdutividadeStr(maskCurrency(e.target.value))}
                    placeholder="R$ 0,00"
                    className="w-full bg-gray-50 border-2 border-transparent group-focus-within:border-emerald-600 group-focus-within:bg-white rounded-2xl lg:rounded-[1.2rem] px-5 lg:px-6 py-3.5 lg:py-4 text-lg lg:text-xl font-black text-gray-900 outline-none transition-all placeholder:text-gray-300"
                  />
                  <div className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-emerald-600 transition-colors">
                    <TrendingUp size={20} />
                  </div>
                </div>
              </div>

              {/* 3. Toggle VR / VA (1%) */}
              <div className="bg-emerald-50/50 rounded-2xl p-4 border border-emerald-100/80 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-gray-800 uppercase tracking-wide">
                      Descontar 1% de VR/VA?
                    </span>
                    <div className="relative inline-block">
                      <button
                        type="button"
                        onClick={() => setShowTooltipVRVA(!showTooltipVRVA)}
                        onMouseEnter={() => setShowTooltipVRVA(true)}
                        onMouseLeave={() => setShowTooltipVRVA(false)}
                        className="text-emerald-600 hover:text-emerald-800 transition-colors cursor-pointer p-0.5"
                        title="Ver informação do desconto de VR/VA"
                      >
                        <HelpCircle size={16} />
                      </button>

                      {/* Tooltip Obrigatório */}
                      {showTooltipVRVA && (
                        <div className="absolute z-20 bottom-full left-0 mb-2 w-72 p-3 bg-gray-900 text-white text-[11px] font-medium rounded-xl shadow-2xl space-y-1.5 leading-relaxed">
                          <p className="font-bold text-emerald-400">Desconto do VR/VA:</p>
                          <p>
                            Este desconto corresponde a 1% e incide exclusivamente sobre o Salário Bruto, sem considerar a Produtividade/Bônus.
                          </p>
                          <div className="pt-1 border-t border-gray-800 text-[10px] text-gray-300 font-mono">
                            Desconto de 1% calculado exclusivamente sobre o Salário Bruto de {formatCurrency(salarioBrutoVal)}.
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Toggle Switch */}
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={vrVaDesconto}
                      onChange={(e) => setVrVaDesconto(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>
                <p className="text-[10px] text-gray-500 font-medium leading-tight">
                  Incide exclusivamente sobre o Salário Bruto de {formatCurrency(salarioBrutoVal)}.
                </p>
              </div>

              {/* 4. Número de Dependentes & 5. Pensão Alimentícia */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] lg:text-[11px] font-black text-gray-500 uppercase tracking-widest mb-1.5 ml-1">
                    4. Dependentes
                  </label>
                  <div className="relative group">
                    <input
                      type="number"
                      min={0}
                      value={dependentesCount}
                      onChange={(e) => setDependentesCount(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full bg-gray-50 border-2 border-transparent group-focus-within:border-emerald-600 group-focus-within:bg-white rounded-2xl lg:rounded-[1.2rem] px-5 py-3.5 text-base font-black text-gray-900 outline-none transition-all"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-emerald-600">
                      <Users size={18} />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] lg:text-[11px] font-black text-gray-500 uppercase tracking-widest mb-1.5 ml-1">
                    5. Pensão Alimentícia
                  </label>
                  <div className="relative group">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={pensaoStr}
                      onChange={(e) => setPensaoStr(maskCurrency(e.target.value))}
                      placeholder="R$ 0,00"
                      className="w-full bg-gray-50 border-2 border-transparent group-focus-within:border-emerald-600 group-focus-within:bg-white rounded-2xl lg:rounded-[1.2rem] px-5 py-3.5 text-base font-black text-gray-900 outline-none transition-all placeholder:text-gray-300"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-emerald-600">
                      <HeartHandshake size={18} />
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-black py-4 rounded-2xl text-xs lg:text-sm uppercase tracking-[0.2em] shadow-xl shadow-emerald-700/20 hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center gap-3 cursor-pointer mt-2"
              >
                Calcular Salário Líquido
                <ArrowRight size={18} />
              </button>
            </form>
          </div>
        </div>

        {/* DEMONSTRATIVO & RESULTADOS */}
        <div className="flex-1 space-y-6">
          {results && (
            <div ref={resultsRef} className="space-y-6 animate-in fade-in zoom-in duration-500">
              {/* 13 — CARD PRINCIPAL DE RESULTADO */}
              <div className="bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-950 rounded-[2rem] lg:rounded-[2.5rem] p-6 lg:p-8 text-white shadow-2xl shadow-emerald-950/20 relative overflow-hidden">
                <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

                <div className="flex justify-between items-start mb-6">
                  <div>
                    <span className="bg-emerald-700/60 text-emerald-200 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest border border-emerald-600/30">
                      Resultado Final CLT 2026
                    </span>
                    <p className="text-[10px] lg:text-[11px] font-black text-emerald-200 uppercase tracking-[0.2em] mt-3">
                      Salário Líquido Final
                    </p>
                    <h3 className="text-4xl lg:text-5xl font-black tracking-tighter text-white mt-1">
                      {formatCurrency(results.salarioLiquido)}
                    </h3>
                  </div>
                  <div className="bg-emerald-500/20 p-3.5 rounded-2xl text-emerald-300 border border-emerald-400/20 backdrop-blur-sm">
                    <TrendingUp size={28} />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 pt-4 border-t border-emerald-700/50">
                  <div className="bg-emerald-950/40 p-3 rounded-xl border border-emerald-800/40">
                    <p className="text-[9px] font-black text-emerald-300/80 uppercase tracking-wider">Proventos Totais</p>
                    <p className="text-sm lg:text-base font-black text-white mt-0.5">{formatCurrency(results.proventosTotais)}</p>
                  </div>
                  <div className="bg-emerald-950/40 p-3 rounded-xl border border-emerald-800/40">
                    <p className="text-[9px] font-black text-emerald-300/80 uppercase tracking-wider">Total Descontos</p>
                    <p className="text-sm lg:text-base font-black text-rose-300 mt-0.5">{formatCurrency(results.totalDescontos)}</p>
                  </div>
                  <div className="bg-emerald-950/40 p-3 rounded-xl border border-emerald-800/40">
                    <p className="text-[9px] font-black text-emerald-300/80 uppercase tracking-wider">Retido (%)</p>
                    <p className="text-sm lg:text-base font-black text-amber-300 mt-0.5">{results.percentualRetido.toFixed(2)}%</p>
                  </div>
                </div>
              </div>

              {/* 14 — GRÁFICO DE COMPOSIÇÃO (Donut Chart) */}
              <div className="bg-white rounded-[2rem] p-6 border border-gray-100 shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="bg-emerald-100 p-2 rounded-xl text-emerald-700">
                      <PieIcon size={18} />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-gray-900 uppercase tracking-tight">Composição do Salário</h4>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Distribuição visual dos Proventos</p>
                    </div>
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
          )}
        </div>
      </div>

      {/* 15 — MEMÓRIA DE CÁLCULO (Estilo Holerite) */}
      {results && (
        <div className="bg-white rounded-[2rem] border border-gray-100 shadow-xl overflow-hidden mt-8">
          <button
            type="button"
            onClick={() => setShowMemoria(!showMemoria)}
            className="w-full bg-gray-900 text-white p-5 flex items-center justify-between hover:bg-gray-800 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <FileText size={20} className="text-emerald-400" />
              <div className="text-left">
                <h3 className="text-sm lg:text-base font-black uppercase tracking-wider">Ver Memória de Cálculo</h3>
                <p className="text-[10px] text-gray-400 uppercase tracking-widest">Detalhamento Oficial em Estilo Holerite</p>
              </div>
            </div>
            {showMemoria ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>

          {showMemoria && (
            <div className="p-6 lg:p-8 space-y-6">
              {/* Tabela de Holerite */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-gray-200 text-gray-400 font-black uppercase tracking-wider text-[10px]">
                      <th className="pb-3">Eventos</th>
                      <th className="pb-3 text-center">Alíquota Nom.</th>
                      <th className="pb-3 text-center">Alíquota Real</th>
                      <th className="pb-3 text-right">Proventos (R$)</th>
                      <th className="pb-3 text-right">Descontos (R$)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-medium">
                    {/* Proventos */}
                    <tr className="hover:bg-gray-50/60">
                      <td className="py-3 font-bold text-gray-900">Salário Bruto</td>
                      <td className="py-3 text-center text-gray-400">-</td>
                      <td className="py-3 text-center text-gray-400">-</td>
                      <td className="py-3 text-right font-bold text-gray-900">{formatCurrency(results.salarioBruto)}</td>
                      <td className="py-3 text-right text-gray-400">-</td>
                    </tr>
                    {results.produtividade > 0 && (
                      <tr className="hover:bg-gray-50/60">
                        <td className="py-3 font-bold text-gray-900">Produtividade / Bônus</td>
                        <td className="py-3 text-center text-gray-400">-</td>
                        <td className="py-3 text-center text-gray-400">-</td>
                        <td className="py-3 text-right font-bold text-gray-900">{formatCurrency(results.produtividade)}</td>
                        <td className="py-3 text-right text-gray-400">-</td>
                      </tr>
                    )}

                    {/* Descontos */}
                    <tr className="hover:bg-gray-50/60">
                      <td className="py-3 font-bold text-rose-700">INSS</td>
                      <td className="py-3 text-center font-bold text-gray-700">{results.inssAliquotaNominal}</td>
                      <td className="py-3 text-center font-bold text-gray-700">{results.inssAliquotaReal.toFixed(2)}%</td>
                      <td className="py-3 text-right text-gray-400">-</td>
                      <td className="py-3 text-right font-bold text-rose-700">{formatCurrency(results.inss)}</td>
                    </tr>

                    <tr className="hover:bg-gray-50/60">
                      <td className="py-3 font-bold text-rose-700">IRRF ({results.irrfBaseEscolhida.toUpperCase()})</td>
                      <td className="py-3 text-center font-bold text-gray-700">{results.irrfAliquotaNominal}</td>
                      <td className="py-3 text-center font-bold text-gray-700">{results.irrfAliquotaReal.toFixed(2)}%</td>
                      <td className="py-3 text-right text-gray-400">-</td>
                      <td className="py-3 text-right font-bold text-rose-700">{formatCurrency(results.irrfFinal)}</td>
                    </tr>

                    {results.vrVa > 0 && (
                      <tr className="hover:bg-gray-50/60">
                        <td className="py-3 font-bold text-amber-700">VR / VA (1% s/ Bruto)</td>
                        <td className="py-3 text-center font-bold text-gray-700">1,00%</td>
                        <td className="py-3 text-center font-bold text-gray-700">
                          {((results.vrVa / results.proventosTotais) * 100).toFixed(2)}%
                        </td>
                        <td className="py-3 text-right text-gray-400">-</td>
                        <td className="py-3 text-right font-bold text-amber-700">{formatCurrency(results.vrVa)}</td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-900 font-black text-sm">
                      <td colSpan={3} className="pt-4 text-gray-900 uppercase tracking-wider">
                        Totais
                      </td>
                      <td className="pt-4 text-right text-emerald-700">{formatCurrency(results.proventosTotais)}</td>
                      <td className="pt-4 text-right text-rose-700">{formatCurrency(results.totalDescontos)}</td>
                    </tr>
                    <tr className="bg-emerald-50/80 font-black text-base border-t border-emerald-200">
                      <td colSpan={3} className="py-3 px-2 text-emerald-950 uppercase tracking-widest">
                        Salário Líquido a Receber
                      </td>
                      <td colSpan={2} className="py-3 text-right text-emerald-800 text-lg">
                        {formatCurrency(results.salarioLiquido)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Informações Explicativas da Memória de Cálculo */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-gray-100 text-[11px] font-medium text-gray-600">
                <div className="bg-blue-50/60 p-4 rounded-2xl border border-blue-100 space-y-1">
                  <p className="font-black text-blue-900 uppercase tracking-wider text-[10px]">Detalhamento INSS</p>
                  <p>Base Utilizada: <span className="font-bold">{formatCurrency(results.inssBase)}</span></p>
                  <p>Alíquota de Tabela: <span className="font-bold">{results.inssAliquotaNominal}</span></p>
                  <p>Dedução da Faixa: <span className="font-bold">{formatCurrency(results.inssDeducaoFaixa)}</span></p>
                  {results.inssTetoAtingido && (
                    <span className="inline-block mt-1 bg-blue-200 text-blue-900 text-[9px] font-black px-2 py-0.5 rounded uppercase">
                      Teto Máximo Atingido (R$ 988,09)
                    </span>
                  )}
                </div>

                <div className="bg-purple-50/60 p-4 rounded-2xl border border-purple-100 space-y-1">
                  <p className="font-black text-purple-900 uppercase tracking-wider text-[10px]">Detalhamento IRRF</p>
                  <p>Opção Escolhida: <span className="font-bold uppercase text-purple-800">{results.irrfBaseEscolhida}</span></p>
                  <p>Base Utilizada: <span className="font-bold">{formatCurrency(results.irrfBaseValor)}</span></p>
                  <p>IRRF Bruto: <span className="font-bold">{formatCurrency(results.irrfBruto)}</span></p>
                  <p>Redutor Adicional 2026: <span className="font-bold text-emerald-700">-{formatCurrency(results.irrfRedutorAplicado)}</span></p>
                </div>

                <div className="bg-amber-50/60 p-4 rounded-2xl border border-amber-100 space-y-1">
                  <p className="font-black text-amber-900 uppercase tracking-wider text-[10px]">Detalhamento VR / VA</p>
                  <p>Base Exclusiva: <span className="font-bold">{formatCurrency(results.vrVaBase)}</span> (Salário Bruto)</p>
                  <p>Alíquota: <span className="font-bold">1,00%</span></p>
                  <p className="text-[10px] text-amber-800/80 italic mt-1">
                    Isento sobre a Produtividade / Bônus.
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

export default CLTCalculator2026;
