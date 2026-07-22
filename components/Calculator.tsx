import React, { useState } from 'react';
import { Building2, UserCheck } from 'lucide-react';
import CLTCalculator2026 from './CLTCalculator2026';
import PJCalculator from './PJCalculator';

const Calculator: React.FC = () => {
  const [calcType, setCalcType] = useState<'pj' | 'clt'>('clt');

  return (
    <div className="space-y-6">
      {/* Seletor de Tipo de Calculadora (PJ vs CLT) */}
      <div className="bg-white p-2 rounded-2xl lg:rounded-3xl border border-gray-100 shadow-sm flex items-center gap-2 max-w-md mx-auto">
        <button
          type="button"
          onClick={() => setCalcType('clt')}
          className={`flex-1 py-3 px-4 rounded-xl lg:rounded-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
            calcType === 'clt'
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
              : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
          }`}
        >
          <UserCheck size={16} />
          Calculadora CLT
        </button>

        <button
          type="button"
          onClick={() => setCalcType('pj')}
          className={`flex-1 py-3 px-4 rounded-xl lg:rounded-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
            calcType === 'pj'
              ? 'bg-gray-900 text-white shadow-lg'
              : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
          }`}
        >
          <Building2 size={16} />
          Calculadora PJ
        </button>
      </div>

      {/* RENDER CALCULADORA CLT 2026 */}
      {calcType === 'clt' && <CLTCalculator2026 />}

      {/* RENDER CALCULADORA PJ (Novo padrão visual, sem alterar nenhuma função ou regra) */}
      {calcType === 'pj' && <PJCalculator />}
    </div>
  );
};

export default Calculator;
