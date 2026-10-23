import React from 'react';
import { Smartphone, Download, X, Info } from 'lucide-react';

interface InstallBannerProps {
  onInstall: () => void;
  onDismiss: () => void;
  showInstructions: boolean;
}

export const InstallBanner: React.FC<InstallBannerProps> = ({ 
  onInstall, 
  onDismiss, 
  showInstructions 
}) => {
  return (
    <div className="mb-8 p-6 bg-gradient-to-r from-gray-900 via-gray-850 to-gray-900 text-white rounded-[2rem] border border-gray-800 shadow-2xl relative overflow-hidden animate-in fade-in slide-in-from-top-4 duration-500">
      {/* Linhas decorativas nítidas sem blur */}
      <div className="absolute right-0 top-0 h-32 w-32 bg-emerald-500/5 rounded-full border border-emerald-500/10 pointer-events-none" />

      <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
        <div className="flex items-start gap-4">
          <div className="bg-gradient-to-br from-emerald-500 to-green-600 p-3.5 rounded-2xl shadow-lg ring-4 ring-emerald-500/20 text-white animate-pulse">
            <Smartphone size={24} />
          </div>
          <div>
            <h4 className="text-sm font-black uppercase tracking-wider text-emerald-400">Aplicativo Disponível</h4>
            <p className="text-xs sm:text-sm font-medium mt-1 text-gray-200 leading-relaxed max-w-xl">
              Para uma melhor experiência, instale este sistema na tela inicial do seu celular.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto mt-2 md:mt-0 justify-end z-10">
          <button
            onClick={onInstall}
            className="flex-1 min-w-[140px] md:flex-none flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 active:scale-95 text-white font-black text-xs uppercase tracking-widest px-6 py-3.5 rounded-2xl transition-all shadow-xl shadow-emerald-950/20 cursor-pointer"
          >
            <Download size={14} />
            Instalar aplicativo
          </button>
          <button
            onClick={onDismiss}
            className="p-3.5 text-gray-400 hover:text-white hover:bg-white/10 active:scale-95 transition-all rounded-2xl border border-gray-800 cursor-pointer"
            title="Ignorar nesta sessão"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {showInstructions && (
        <div className="mt-5 pt-5 border-t border-gray-800/80 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex gap-2.5 items-start text-amber-400 mb-4 bg-amber-500/10 p-4 rounded-xl border border-amber-500/20">
            <Info size={18} className="shrink-0 mt-0.5" />
            <div className="text-xs font-bold leading-relaxed">
              Dica: Se o prompt automático não puder ser aberto diretamente pelo seu navegador, siga os passos manuais abaixo para instalar.
            </div>
          </div>
          <div className="bg-gray-950/60 p-5 rounded-2xl border border-gray-800 space-y-3.5">
            <p className="text-xs font-black uppercase tracking-wider text-emerald-400">Instalação Manual no Android:</p>
            <ol className="text-xs text-gray-300 space-y-2.5 font-bold list-decimal pl-4 leading-relaxed">
              <li>
                No topo direito do navegador, clique no ícone de <span className="text-white font-black">três pontos (Menu)</span>.
              </li>
              <li>
                Procure e selecione a opção <span className="text-white font-black">"Instalar aplicativo"</span> ou <span className="text-white font-black">"Adicionar à tela inicial"</span>.
              </li>
              <li>
                Confirme no diálogo para criar o atalho e usar em tela cheia, como um aplicativo nativo!
              </li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
};
