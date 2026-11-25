import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Sparkles, X, Loader2, CheckCircle, ShieldAlert, MessageCircle, LogOut, Lock, Clock } from 'lucide-react';

export default function ActivationModal({ 
  isOpen, 
  onClose, 
  onLogout,
  isHardBlocked = false,
  isDark 
}) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  if (!isOpen && !isHardBlocked) return null;

  async function handleApplyCoupon(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) return;

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Sessão expirada. Faça login novamente.');

      // Verifica se já existe uma solicitação pendente para este usuário
      const { data: existingRequest, error: checkError } = await supabase
        .from('coupon_requests')
        .select('id, coupon_code')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .maybeSingle();

      if (checkError) throw checkError;

      if (existingRequest) {
        throw new Error(`Você já possui uma solicitação pendente para o cupom "${existingRequest.coupon_code}". Aguarde a aprovação do administrador.`);
      }

      // Registra a nova solicitação como pendente para aprovação do Admin
      const { error: insertError } = await supabase
        .from('coupon_requests')
        .insert({
          user_id: user.id,
          user_email: user.email,
          coupon_code: cleanCode,
          status: 'pending'
        });

      if (insertError) throw insertError;

      setSuccess('Solicitação enviada com sucesso! Assim que o administrador aprovar seu cupom, seu acesso será liberado.');
      setCode('');
    } catch (err) {
      setError(err.message || 'Não foi possível enviar a solicitação do cupom.');
    } finally {
      setLoading(false);
    }
  }

  const bgModal = isDark 
    ? 'bg-zinc-900 border-zinc-800 text-white' 
    : 'bg-white border-slate-300 text-slate-900 shadow-2xl';
  const inputBg = isDark 
    ? 'bg-[#121212] border-zinc-800 text-white placeholder-gray-500' 
    : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400';
  const cardBorder = isDark ? 'border-zinc-800' : 'border-slate-200';

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-[100] p-3 sm:p-4 overflow-y-auto">
      <div className={`rounded-3xl border w-full max-w-lg max-h-[90dvh] overflow-y-auto shadow-2xl p-5 sm:p-8 space-y-5 sm:space-y-6 relative my-auto ${bgModal}`}>
        
        {/* Só permite fechar no X se NÃO estiver em Hard Paywall */}
        {!isHardBlocked && onClose && (
          <button 
            onClick={onClose}
            className="absolute right-4 top-4 sm:right-5 sm:top-5 p-2 rounded-xl opacity-70 hover:opacity-100 transition z-10"
            title="Fechar"
          >
            <X size={18} />
          </button>
        )}

        {/* Cabeçalho do Modal */}
        <div className="text-center space-y-2 pt-1">
          <div className={`inline-flex p-3 rounded-2xl border mb-1 ${
            isHardBlocked 
              ? 'bg-red-500/20 text-red-400 border-red-500/30' 
              : 'bg-emerald-600/20 text-emerald-400 border-emerald-500/30'
          }`}>
            {isHardBlocked ? <Lock size={24} /> : <Sparkles size={24} />}
          </div>
          <h3 className="text-lg sm:text-2xl font-black tracking-tight px-4">
            {isHardBlocked ? 'Período de acesso encerrado' : 'Ative ou renove sua assinatura'}
          </h3>
          <p className="text-xs sm:text-sm opacity-75 leading-relaxed">
            {isHardBlocked 
              ? 'Seu período gratuito ou de tolerância terminou. Escolha um plano abaixo ou solicite a ativação de um cupom para liberar sua conta.'
              : 'Desbloqueie todas as funções de cadastro, baixas, relatórios e mantenha sua conta ativa sem restrições.'}
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-bold flex items-center justify-center gap-2 text-center">
            <ShieldAlert size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold text-center flex items-center justify-center gap-2">
            <Clock size={16} className="shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* Input para Solicitação de Cupom Responsivo */}
        <form onSubmit={handleApplyCoupon} className="p-4 rounded-2xl bg-zinc-800/40 border border-zinc-700 space-y-3">
          <label className="block text-[11px] sm:text-xs font-extrabold uppercase tracking-wider leading-snug">
            Possui um Código Promocional?
          </label>
          <div className="flex flex-col sm:flex-row gap-2.5">
            <input
              type="text"
              placeholder="DIGITE SEU CÓDIGO AQUI"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className={`w-full sm:flex-1 min-w-0 border rounded-xl px-4 py-2.5 text-xs font-bold uppercase focus:outline-none focus:border-emerald-500 ${inputBg}`}
            />
            <button
              type="submit"
              disabled={loading || !code.trim()}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition shadow flex items-center justify-center gap-1.5 shrink-0"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
              <span>Solicitar Ativação</span>
            </button>
          </div>
        </form>

        {/* Planos de Assinatura com Espaçamento Seguro para as Badges */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 sm:gap-3 pt-2">
          {/* Plano Mensal */}
          <div className={`border ${cardBorder} rounded-2xl p-4 flex flex-col justify-between text-center space-y-3 hover:border-emerald-500 transition`}>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">Mensal</span>
              <div className="text-xl sm:text-lg font-black mt-1">R$ 37</div>
              <span className="text-[10px] opacity-60">por mês</span>
            </div>
            <button 
              type="button" 
              onClick={() => alert('Checkout de pagamento em integração! Solicite seu cupom acima ou chame o suporte abaixo.')} 
              className="w-full py-2.5 sm:py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition"
            >
              Ativar →
            </button>
          </div>

          {/* Plano Semestral */}
          <div className="border rounded-2xl p-4 pt-6 sm:pt-5 flex flex-col justify-between text-center space-y-3 border-emerald-500 bg-emerald-600/5 relative">
            <div className="absolute -top-3 right-4 bg-emerald-600 text-white text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase shadow-md">
              15% OFF
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Semestral</span>
              <div className="text-xl sm:text-lg font-black mt-1">R$ 187</div>
              <span className="text-[10px] opacity-60">por semestre</span>
            </div>
            <button 
              type="button" 
              onClick={() => alert('Checkout de pagamento em integração! Solicite seu cupom acima ou chame o suporte abaixo.')} 
              className="w-full py-2.5 sm:py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition"
            >
              Ativar →
            </button>
          </div>

          {/* Plano Anual */}
          <div className={`border ${cardBorder} rounded-2xl p-4 pt-6 sm:pt-5 flex flex-col justify-between text-center space-y-3 hover:border-emerald-500 transition relative`}>
            <div className="absolute -top-3 right-4 bg-teal-600 text-white text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase shadow-md">
              30% OFF
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">Anual</span>
              <div className="text-xl sm:text-lg font-black mt-1">R$ 307</div>
              <span className="text-[10px] opacity-60">por ano</span>
            </div>
            <button 
              type="button" 
              onClick={() => alert('Checkout de pagamento em integração! Solicite seu cupom acima ou chame o suporte abaixo.')} 
              className="w-full py-2.5 sm:py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition"
            >
              Ativar →
            </button>
          </div>
        </div>

        {/* Rodapé de Exceção Obrigatória: Suporte e Logout sempre clicáveis */}
        <div className={`pt-4 border-t ${cardBorder} flex flex-wrap items-center justify-between gap-3 text-xs font-bold`}>
          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="flex items-center gap-1.5 text-red-400 hover:text-red-300 transition"
            >
              <LogOut size={15} /> Sair da conta
            </button>
          )}
          <a
            href="https://wa.me/5588988868432?text=Ol%C3%A1%2C%20preciso%20de%20ajuda%20para%20ativar%20minha%20assinatura%20no%20SyJury!"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 transition ml-auto"
          >
            <MessageCircle size={15} /> Falar com Suporte
          </a>
        </div>

      </div>
    </div>
  );
}