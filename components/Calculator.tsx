
import React, { useState, useRef } from 'react';
import { Calculator as CalcIcon, TrendingDown, TrendingUp, Receipt, Percent, ArrowRight } from 'lucide-react';

const Calculator: React.FC = () => {
  const [invoiceValue, setInvoiceValue] = useState<string>('');
  const [results, setResults] = useState<{
    faturamento: number;
    proLabore: number;
    dasSimples: number;
    darf: number;
    totalImpostos: number;
    faturamentoLiquido: number;
  } | null>(null);

  const resultsRef = useRef<HTMLDivElement>(null);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const handleCalculate = (e: React.FormEvent) => {
    e.preventDefault();
    const f = parseFloat(invoiceValue.replace(/[^\d]/g, '')) / 100 || 0;
    
    if (f <= 0) return;

    // Arredondamento para 2 casas decimais em cada etapa para garantir que o detalhamento some corretamente
    const p = Math.round(f * 28) / 100; // Pró-labore (28% sobre o valor da nota)
    const das = Math.round(f * 6) / 100; // DAS Simples (6% sobre o valor da nota)
    const darf = Math.round(p * 11) / 100; // DARF (11% sobre o valor do Pró-labore)
    
    // O total de impostos é a soma das partes já arredondadas (para evitar divergência visual)
    const tax = Number((das + darf).toFixed(2));
    const net = Number((f - tax).toFixed(2));

    setResults({
      faturamento: f,
      proLabore: p,
      dasSimples: das,
      darf: darf,
      totalImpostos: tax,
      faturamentoLiquido: net,
    });

    // Auto scroll to results
    setTimeout(() => {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const maskCurrency = (value: string) => {
    const digits = value.replace(/\D/g, "");
    const amount = Number(digits) / 100;
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount);
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col lg:flex-row gap-4 lg:gap-8">
        
        {/* Formulário de Entrada */}
        <div className="flex-1">
          <div className="bg-white rounded-[2rem] lg:rounded-[2.5rem] p-6 lg:p-12 border border-gray-100 shadow-2xl shadow-gray-200/50">
            <div className="flex items-center gap-3 lg:gap-4 mb-6 lg:mb-10">
              <div className="bg-gray-900 text-white p-3 lg:p-4 rounded-xl lg:rounded-2xl shadow-lg">
                <CalcIcon size={20} className="lg:w-6 lg:h-6" />
              </div>
              <div>
                <h2 className="text-xl lg:text-2xl font-black tracking-tight uppercase leading-none">Calculadora</h2>
                <p className="text-[9px] lg:text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Previsão de Impostos</p>
              </div>
            </div>

            <form onSubmit={handleCalculate} className="space-y-6 lg:space-y-8">
              <div>
                <label className="block text-[10px] lg:text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 lg:mb-3 ml-1">
                  Valor da Nota Fiscal
                </label>
                <div className="relative group">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={invoiceValue}
                    onChange={(e) => setInvoiceValue(maskCurrency(e.target.value))}
                    placeholder="R$ 0,00"
                    className="w-full bg-gray-50 border-2 border-transparent group-focus-within:border-gray-900 group-focus-within:bg-white rounded-2xl lg:rounded-[1.5rem] px-6 lg:px-8 py-4 lg:py-6 text-xl lg:text-2xl font-black text-gray-900 outline-none transition-all placeholder:text-gray-200"
                  />
                  <div className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-gray-900 transition-colors">
                    <Receipt size={24} className="lg:w-7 lg:h-7" />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-gray-900 text-white font-black py-4 lg:py-6 rounded-2xl lg:rounded-[1.5rem] text-xs lg:text-sm uppercase tracking-[0.2em] shadow-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!invoiceValue || invoiceValue === 'R$ 0,00'}
              >
                Calcular
                <ArrowRight size={16} className="lg:w-[18px] lg:h-[18px]" />
              </button>
            </form>

            <div className="mt-8 lg:mt-12 p-4 lg:p-6 bg-blue-50/50 rounded-2xl lg:rounded-3xl border border-blue-100 flex items-start gap-3 lg:gap-4">
              <div className="bg-blue-100 p-1.5 lg:p-2 rounded-lg lg:rounded-xl text-blue-600">
                <Percent size={14} className="lg:w-4 lg:h-4" />
              </div>
              <div className="space-y-0.5 lg:space-y-1">
                <p className="text-[10px] lg:text-[11px] font-black text-blue-900 uppercase tracking-tight">Base de Cálculo</p>
                <p className="text-[9px] lg:text-[10px] font-bold text-blue-800/70 leading-relaxed uppercase">
                  Alíquotas: 28% Pró-labore, 6% DAS e 11% DARF s/ Pró-labore.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Demonstrativo de Resultados */}
        <div className="flex-1">
          {results ? (
            <div className="space-y-3 lg:space-y-4 animate-in fade-in zoom-in duration-500">
              
              {/* Prioridade 1: Valor Líquido */}
              <div ref={resultsRef} className="bg-green-900 rounded-[2rem] lg:rounded-[2.5rem] p-6 lg:p-10 text-white shadow-2xl shadow-green-200 scroll-mt-6">
                <div className="flex justify-between items-start mb-4 lg:mb-6">
                  <div className="space-y-0.5 lg:space-y-1">
                    <p className="text-[10px] lg:text-[11px] font-black text-green-300 uppercase tracking-[0.2em]">Faturamento Líquido</p>
                    <h3 className="text-3xl lg:text-4xl font-black tracking-tighter">{formatCurrency(results.faturamentoLiquido)}</h3>
                  </div>
                  <div className="bg-green-800 p-3 lg:p-4 rounded-2xl lg:rounded-3xl text-green-300">
                    <TrendingUp size={24} className="lg:w-8 lg:h-8" />
                  </div>
                </div>
                <div className="h-px bg-green-800/50 w-full mb-4 lg:mb-6" />
                <p className="text-[9px] lg:text-[10px] font-bold text-green-200/50 uppercase tracking-widest leading-relaxed">
                  Estimado após todos os impostos.
                </p>
              </div>

              {/* Detalhamento */}
              <div className="grid grid-cols-2 gap-3 lg:gap-4">
                <div className="col-span-2">
                  <div className="bg-white rounded-2xl lg:rounded-[2rem] p-4 lg:p-6 border border-gray-100 shadow-sm flex justify-between items-center">
                    <div className="space-y-0.5">
                      <p className="text-[9px] lg:text-[10px] font-black text-gray-400 uppercase tracking-widest">Faturamento Bruto</p>
                      <p className="text-xl lg:text-2xl font-black text-gray-900 tracking-tighter">{formatCurrency(results.faturamento)}</p>
                    </div>
                    <div className="bg-gray-50 p-2 lg:p-3 rounded-xl lg:rounded-2xl text-gray-400">
                      <Receipt size={18} className="lg:w-5 lg:h-5" />
                    </div>
                  </div>
                </div>

                <ResultCard
                  label="Pró-labore"
                  value={formatCurrency(results.proLabore)}
                  icon={<TrendingUp size={16} className="lg:w-[18px] lg:h-[18px]" />}
                  color="gray"
                  percentage="28%"
                />
                <ResultCard
                  label="DAS Simples"
                  value={formatCurrency(results.dasSimples)}
                  icon={<Percent size={16} className="lg:w-[18px] lg:h-[18px]" />}
                  color="amber"
                  percentage="6%"
                />
                <ResultCard
                  label="DARF"
                  value={formatCurrency(results.darf)}
                  icon={<Percent size={16} className="lg:w-[18px] lg:h-[18px]" />}
                  color="amber"
                  percentage="11% s/ PL"
                />
                <ResultCard
                  label="Total Impostos"
                  value={formatCurrency(results.totalImpostos)}
                  icon={<TrendingDown size={16} className="lg:w-[18px] lg:h-[18px]" />}
                  color="red"
                />
              </div>
            </div>
          ) : (
            <div className="h-full min-h-[300px] lg:min-h-[400px] bg-gray-100/50 rounded-[2rem] lg:rounded-[2.5rem] border-2 border-dashed border-gray-200 flex flex-col items-center justify-center p-8 lg:p-12 text-center">
              <div className="bg-white p-4 lg:p-6 rounded-2xl lg:rounded-3xl shadow-sm mb-4 lg:mb-6 text-gray-200">
                <CalcIcon size={32} className="lg:w-12 lg:h-12" />
              </div>
              <h3 className="text-lg lg:text-xl font-black text-gray-900 uppercase tracking-tight mb-1 lg:mb-2 text-center">Aguardando Valor</h3>
              <p className="text-[10px] lg:text-xs font-bold text-gray-400 uppercase tracking-widest leading-relaxed max-w-[240px]">
                Insira o valor da nota fiscal para visualizar o demonstrativo.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface ResultCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: 'gray' | 'amber' | 'red' | 'green';
  percentage?: string;
}

const ResultCard: React.FC<ResultCardProps> = ({ label, value, icon, color, percentage }) => {
  const colorClasses = {
    gray: 'bg-gray-50 text-gray-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600',
    green: 'bg-green-50 text-green-600',
  };

  return (
    <div className="bg-white rounded-2xl lg:rounded-[1.8rem] p-3 lg:p-5 border border-gray-100 shadow-sm flex flex-col justify-between">
      <div className="flex justify-between items-start mb-2 lg:mb-4">
        <div className={`p-2 lg:p-3 rounded-lg lg:rounded-xl ${colorClasses[color]}`}>
          {icon}
        </div>
        {percentage && (
          <span className="text-[8px] lg:text-[9px] font-black bg-gray-100 text-gray-500 px-1.5 lg:px-2 py-0.5 lg:py-1 rounded-full uppercase">
            {percentage}
          </span>
        )}
      </div>
      <div>
        <p className="text-[8px] lg:text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5 lg:mb-1">{label}</p>
        <p className="text-sm lg:text-lg font-black text-gray-900 tracking-tight">{value}</p>
      </div>
    </div>
  );
};

export default Calculator;
