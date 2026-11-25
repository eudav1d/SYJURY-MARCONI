import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, Users, FileText, Calendar, DollarSign, 
  Settings as SettingsIcon, LogOut, ShieldCheck, TrendingUp, Clock, 
  CheckCircle, Menu, X, Sun, Moon, Loader2, Sparkles, Lock,
  KeyRound, ShieldAlert, Eye, EyeOff
} from 'lucide-react';
import Clients from './pages/Clients';
import Contracts from './pages/Contracts';
import Vencimentos from './pages/Vencimentos';
import Reports from './pages/Reports';
import Auth from './pages/Auth';
import ActivationModal from './components/ActivationModal';
import Settings from './pages/Settings';
import { useSubscriptionStatus } from './hooks/useSubscriptionStatus';
import { supabase } from './lib/supabase';

function getLocalISODate(dateObj = new Date()) {
  const offset = dateObj.getTimezoneOffset() * 60000;
  return new Date(dateObj.getTime() - offset).toISOString().split('T')[0];
}

export default function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Deteta imediatamente na abertura da página se a URL veio de um link de recuperação de senha
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(() => {
    const hash = window.location.hash || '';
    const search = window.location.search || '';
    return hash.includes('type=recovery') || search.includes('type=recovery');
  });

  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoveryError, setRecoveryError] = useState('');
  const [recoverySuccess, setRecoverySuccess] = useState('');

  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [preselectedClient, setPreselectedClient] = useState(null);
  const [isActivationModalOpen, setIsActivationModalOpen] = useState(false);

  // Compatível tanto com o retorno completo de estados (trial/tolerance/hardBlock) quanto simplificado
  const subStatus = useSubscriptionStatus(session) || {};
  const canWrite = subStatus.canWrite ?? subStatus.isActivated ?? false;
  const isMasked = subStatus.isMasked ?? !canWrite;
  const isHardBlocked = subStatus.isHardBlocked ?? false;
  const accessState = subStatus.accessState ?? (canWrite ? 'active' : 'blocked');
  const timeLeftText = subStatus.timeLeftText ?? (subStatus.subscriptionInfo?.daysRemaining ? `${subStatus.subscriptionInfo.daysRemaining} dias` : '');
  const toleranceLeftText = subStatus.toleranceLeftText ?? '';
  const refreshSubscription = subStatus.refreshSubscription || subStatus.refreshStatus || subStatus.checkSubscription || (() => {});

  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('syjury_theme');
    if (saved) return saved;
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  });

  const isDark = theme === 'dark';

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem('syjury_theme', theme);
  }, [isDark, theme]);

  function toggleTheme() {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  }

  const [totalEmAbertoGeral, setTotalEmAbertoGeral] = useState(0);
  const [recebidoHoje, setRecebidoHoje] = useState(0);
  const [recebidoOntem, setRecebidoOntem] = useState(0);

  const [custosMes, setCustosMes] = useState(0);
  const [recebidoMes, setRecebidoMes] = useState(0);
  const [aReceberMes, setAReceberMes] = useState(0);
  const [novosContratosMes, setNovosContratosMes] = useState(0);
  const [novosClientesMes, setNovosClientesMes] = useState(0);

  const [totalContratos, setTotalContratos] = useState(0);
  const [contratosAbertos, setContratosAbertos] = useState(0);
  const [contratosFechados, setContratosFechados] = useState(0);

  const menuItems = [
    { id: 'dashboard', label: 'Início', icon: <LayoutDashboard size={20} /> },
    { id: 'clients', label: 'Clientes', icon: <Users size={20} /> },
    { id: 'contracts', label: 'Contratos', icon: <FileText size={20} /> },
    { id: 'installments', label: 'Vencimentos', icon: <Calendar size={20} /> },
    { id: 'reports', label: 'Relatórios', icon: <DollarSign size={20} /> },
    { id: 'settings', label: 'Configurações', icon: <SettingsIcon size={20} /> },
  ];

  useEffect(() => {
    const hash = window.location.hash || '';
    const search = window.location.search || '';
    if (hash.includes('type=recovery') || search.includes('type=recovery')) {
      setIsPasswordRecovery(true);
    }

    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true);
      }
      setSession(newSession);
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session && activeTab === 'dashboard' && !isPasswordRecovery) {
      fetchDashboardData();
    }
  }, [session, activeTab, isPasswordRecovery]);

  async function fetchDashboardData() {
    try {
      const hoje = getLocalISODate();
      const ontemDate = new Date();
      ontemDate.setDate(ontemDate.getDate() - 1);
      const ontem = getLocalISODate(ontemDate);
      const anoMesAtual = hoje.slice(0, 7);

      const [instRes, contratosRes, clientesRes] = await Promise.all([
        supabase.from('installments').select('installment_value, paid_value, status, due_date, payment_date'),
        supabase.from('contracts').select('cost_value, status, created_at, contract_date'),
        supabase.from('clients').select('created_at')
      ]);

      const installments = instRes.data || [];
      const contratos = contratosRes.data || [];
      const clientes = clientesRes.data || [];

      const abertas = installments.filter(i => i.status !== 'Pago');
      const pagas = installments.filter(i => i.status === 'Pago');

      setTotalEmAbertoGeral(
        abertas.reduce((acc, curr) => acc + Number(curr.installment_value || 0), 0)
      );

      setRecebidoHoje(
        pagas
          .filter(p => p.payment_date === hoje)
          .reduce((acc, curr) => acc + Number((curr.paid_value ?? curr.installment_value) || 0), 0)
      );

      setRecebidoOntem(
        pagas
          .filter(p => p.payment_date === ontem)
          .reduce((acc, curr) => acc + Number((curr.paid_value ?? curr.installment_value) || 0), 0)
      );

      setRecebidoMes(
        pagas
          .filter(p => p.payment_date && p.payment_date.startsWith(anoMesAtual))
          .reduce((acc, curr) => acc + Number((curr.paid_value ?? curr.installment_value) || 0), 0)
      );

      setAReceberMes(
        abertas
          .filter(v => v.due_date && v.due_date.startsWith(anoMesAtual))
          .reduce((acc, curr) => acc + Number(curr.installment_value || 0), 0)
      );

      const contratosDoMes = contratos.filter(c => {
        const refDate = c.created_at || c.contract_date || '';
        return refDate.startsWith(anoMesAtual);
      });
      setCustosMes(contratosDoMes.reduce((acc, curr) => acc + Number(curr.cost_value || 0), 0));
      setNovosContratosMes(contratosDoMes.length);

      setContratosAbertos(contratos.filter(c => c.status === 'Aberto').length);
      setContratosFechados(contratos.filter(c => c.status === 'Fechado').length);
      setTotalContratos(contratos.length);

      setNovosClientesMes(
        clientes.filter(c => c.created_at && c.created_at.startsWith(anoMesAtual)).length
      );
    } catch (error) {
      console.error('Erro ao carregar dados do dashboard:', error);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setSession(null);
    setIsPasswordRecovery(false);
  }

  async function handlePasswordRecoverySubmit(e) {
    e.preventDefault();
    setRecoveryError('');
    setRecoverySuccess('');

    if (newPassword.length < 8) {
      setRecoveryError('A nova senha deve ter pelo menos 8 caracteres.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setRecoveryError('As senhas digitadas não coincidem.');
      return;
    }

    setRecoveryLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      setRecoverySuccess('Senha redefinida com sucesso! Redirecionando para o painel...');
      setNewPassword('');
      setConfirmNewPassword('');

      // Limpa o hash da URL para não reativar a tela de recuperação ao atualizar a página
      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, '', window.location.pathname);
      }

      setTimeout(() => {
        setIsPasswordRecovery(false);
      }, 1500);
    } catch (err) {
      setRecoveryError(err.message || 'Não foi possível atualizar a senha. Solicite um novo link.');
    } finally {
      setRecoveryLoading(false);
    }
  }

  function handleMenuClick(tabId) {
    setActiveTab(tabId);
  }

  function displayCurrency(val) {
    if (isMasked) return 'R$ ••••••';
    return Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  if (authLoading) {
    return (
      <div className={`flex h-screen items-center justify-center ${isDark ? 'bg-[#121212] text-zinc-100' : 'bg-[#e2e8f0] text-slate-800'}`}>
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={32} className="animate-spin text-emerald-500" />
          <span className="text-xs font-bold tracking-wider uppercase opacity-75">Carregando SyJury...</span>
        </div>
      </div>
    );
  }

  // BLOQUEIO CRÍTICO: Se o utilizador clicou no link de recuperação de senha do e-mail,
  // impede a entrada direta no Dashboard e exige a definição da nova senha primeiro.
  if (isPasswordRecovery) {
    const bgRecoveryCard = isDark
      ? 'bg-zinc-900 border-zinc-800 text-zinc-100 shadow-2xl'
      : 'bg-white border-slate-300 text-slate-900 shadow-2xl';
    const inputRecoveryStyle = `w-full border rounded-xl pl-10 pr-10 py-2.5 text-sm focus:outline-none focus:border-emerald-500 transition ${
      isDark
        ? 'bg-[#121212] border-zinc-800 text-zinc-100 placeholder-zinc-500'
        : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
    }`;
    const mutedColor = isDark ? 'text-zinc-400' : 'text-slate-600';

    return (
      <div className={`flex min-h-screen items-center justify-center p-4 font-sans ${isDark ? 'bg-[#121212] text-zinc-100' : 'bg-[#e2e8f0] text-slate-900'}`}>
        <div className={`w-full max-w-md rounded-3xl border p-6 sm:p-8 space-y-6 ${bgRecoveryCard}`}>
          <div className="text-center space-y-2">
            <div className="inline-flex p-3 rounded-2xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 mb-1">
              <KeyRound size={24} />
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight">Redefinir Senha</h2>
            <p className={`text-xs leading-relaxed ${mutedColor}`}>
              Digite e confirme sua nova senha abaixo para concluir a recuperação da sua conta.
            </p>
          </div>

          {recoveryError && (
            <div className="p-3.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-bold flex items-start gap-2.5">
              <ShieldAlert size={16} className="shrink-0 mt-0.5" />
              <span>{recoveryError}</span>
            </div>
          )}

          {recoverySuccess && (
            <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-2.5">
              <CheckCircle size={16} className="shrink-0" />
              <span>{recoverySuccess}</span>
            </div>
          )}

          <form onSubmit={handlePasswordRecoverySubmit} className="space-y-4">
            <div>
              <label className={`block text-xs font-bold mb-1.5 ${mutedColor}`}>Nova senha</label>
              <div className="relative">
                <KeyRound size={16} className={`absolute left-3.5 top-1/2 -translate-y-1/2 ${mutedColor}`} />
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  placeholder="Mínimo de 8 caracteres"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={inputRecoveryStyle}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 ${mutedColor} hover:opacity-80`}
                >
                  {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label className={`block text-xs font-bold mb-1.5 ${mutedColor}`}>Confirmar nova senha</label>
              <div className="relative">
                <KeyRound size={16} className={`absolute left-3.5 top-1/2 -translate-y-1/2 ${mutedColor}`} />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  placeholder="Repita a nova senha"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  className={inputRecoveryStyle}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 ${mutedColor} hover:opacity-80`}
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={recoveryLoading}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold transition shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {recoveryLoading && <Loader2 size={16} className="animate-spin" />}
              <span>Salvar Nova Senha e Entrar</span>
            </button>
          </form>

          <div className="pt-2 border-t border-zinc-800 flex justify-center">
            <button
              type="button"
              onClick={handleLogout}
              className="text-xs font-bold text-red-400 hover:text-red-300 transition flex items-center gap-1.5"
            >
              <LogOut size={14} /> Cancelar e voltar ao login
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <Auth 
        isDark={isDark} 
        onToggleTheme={toggleTheme}
        onLoginSuccess={(user) => setSession({ user })} 
      />
    );
  }

  const userName = session?.user?.user_metadata?.full_name || 'David Feitosa';
  const userInitials = userName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(n => n[0].toUpperCase())
    .join('') || 'DF';

  const rentabilidadeMes = recebidoMes - custosMes;
  const pctAbertos = totalContratos > 0 ? Math.round((contratosAbertos / totalContratos) * 100) : 0;
  const pctFechados = totalContratos > 0 ? Math.round((contratosFechados / totalContratos) * 100) : 0;

  const nomeMesAtual = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const mesFormatado = nomeMesAtual.charAt(0).toUpperCase() + nomeMesAtual.slice(1);

  const bgApp = isDark ? 'bg-[#121212] text-zinc-100' : 'bg-[#e2e8f0] text-slate-800';
  const bgSidebar = isDark ? 'bg-[#065f46] border-emerald-950/60 text-white' : 'bg-[#f8fafc] border-slate-300/80 text-slate-800 shadow-sm';
  const bgCard = isDark ? 'bg-zinc-900 border-zinc-800 text-zinc-100' : 'bg-[#f8fafc] border-slate-300/80 text-slate-800 shadow-sm';
  const textMuted = isDark ? 'text-zinc-400' : 'text-slate-600';
  const borderStyle = isDark ? 'border-zinc-800' : 'border-slate-300/80';
  const sidebarBorderStyle = isDark ? 'border-white/10' : 'border-slate-300/80';

  const parsedDaysLeft = parseInt(String(timeLeftText || '').replace(/\D/g, ''), 10);
  const derivedSubscriptionInfo = subStatus.subscriptionInfo || {
    status: canWrite ? 'active' : 'inactive',
    validUntil: session?.user?.user_metadata?.subscription_ends_at || session?.user?.user_metadata?.subscription_valid_until || null,
    daysRemaining: !isNaN(parsedDaysLeft) && parsedDaysLeft > 0 ? parsedDaysLeft : (canWrite ? 30 : 0),
    planName: accessState === 'trial' ? 'Período de Teste' : 'Plano Pro'
  };

  return (
    <div className={`flex h-screen font-sans overflow-hidden transition-colors duration-200 ${bgApp}`}>
      
      {/* Sidebar Desktop */}
      <aside className={`hidden md:flex ${isSidebarOpen ? 'w-64' : 'w-20'} ${bgSidebar} flex-col justify-between border-r transition-all duration-300 overflow-hidden z-20 shrink-0`}>
        <div>
          <div className={`flex items-center gap-3 px-6 py-6 border-b ${sidebarBorderStyle} whitespace-nowrap`}>
            <div className={`${isDark ? 'bg-white/15 border border-white/15 text-white' : 'bg-emerald-600 text-white shadow-emerald-600/20'} p-2 rounded-xl font-bold shadow-lg shrink-0`}>
              <DollarSign size={22} />
            </div>
            {isSidebarOpen && (
              <span className={`text-xl font-extrabold tracking-wide ${isDark ? 'text-white' : 'text-emerald-700'}`}>
                SyJury
              </span>
            )}
          </div>

          <nav className="p-4 space-y-1.5">
            {menuItems.map((item) => (
              <button 
                key={item.id}
                onClick={() => handleMenuClick(item.id)}
                title={!isSidebarOpen ? item.label : ''}
                className={`flex items-center justify-between w-full px-4 py-3 rounded-xl font-medium transition ${
                  activeTab === item.id 
                    ? (isDark ? 'bg-black/25 text-white shadow-sm border border-white/10 font-bold' : 'bg-emerald-100 text-emerald-800 font-bold border border-emerald-300/60 shadow-sm') 
                    : (isDark ? 'hover:bg-black/15 text-emerald-100/85 hover:text-white' : 'hover:bg-slate-200/70 text-slate-700')
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="shrink-0">{item.icon}</span>
                  {isSidebarOpen && <span>{item.label}</span>}
                </div>
              </button>
            ))}
          </nav>
        </div>

        <div className={`p-4 border-t ${sidebarBorderStyle} flex items-center justify-between ${isDark ? 'bg-black/15' : 'bg-slate-200/50'} whitespace-nowrap`}>
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-10 h-10 rounded-full ${isDark ? 'bg-white/20 text-white border border-white/15' : 'bg-emerald-600 text-white'} flex items-center font-bold justify-center shadow shrink-0`}>
              {userInitials}
            </div>
            {isSidebarOpen && (
              <div className="min-w-0">
                <p className="text-sm font-bold truncate">{userName}</p>
                <p className={`text-xs ${isDark ? 'text-emerald-200/80' : 'text-slate-600'}`}>
                  {accessState === 'trial' && `Teste Grátis (${timeLeftText})`}
                  {accessState === 'active' && 'Assinatura Ativa'}
                  {accessState === 'warning_3d' && `Vence em ${timeLeftText}`}
                  {accessState === 'warning_24h' && `Vence em ${timeLeftText}`}
                  {accessState === 'tolerance_24h' && 'Em Tolerância'}
                  {accessState === 'blocked' && 'Conta Bloqueada'}
                </p>
              </div>
            )}
          </div>
          {isSidebarOpen && (
            <button 
              onClick={handleLogout}
              title="Sair do sistema"
              className={`p-2 rounded-lg ${isDark ? 'text-emerald-100/80 hover:text-white hover:bg-black/20' : 'text-slate-600 hover:text-red-600 hover:bg-red-100'} transition shrink-0`}
            >
              <LogOut size={18} />
            </button>
          )}
        </div>
      </aside>

      {/* Menu Gaveta Mobile */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 md:hidden flex">
          <aside className={`w-64 ${bgSidebar} h-full flex flex-col justify-between border-r p-4`}>
            <div>
              <div className={`flex items-center justify-between pb-5 mb-4 border-b ${sidebarBorderStyle}`}>
                <div className="flex items-center gap-3">
                  <div className={`${isDark ? 'bg-white/15 text-white' : 'bg-emerald-600 text-white'} p-2 rounded-xl font-bold`}>
                    <DollarSign size={20} />
                  </div>
                  <span className="text-lg font-extrabold">SyJury</span>
                </div>
                <button onClick={() => setIsMobileMenuOpen(false)} className={`p-2 ${isDark ? 'text-emerald-100 hover:text-white' : 'text-slate-500 hover:text-slate-800'}`}>
                  <X size={20} />
                </button>
              </div>
              <nav className="space-y-1.5">
                {menuItems.map((item) => (
                  <button 
                    key={item.id}
                    onClick={() => {
                      handleMenuClick(item.id);
                      setIsMobileMenuOpen(false);
                    }}
                    className={`flex items-center justify-between w-full px-4 py-3 rounded-xl font-medium transition ${
                      activeTab === item.id
                        ? (isDark ? 'bg-black/25 text-white font-bold' : 'bg-emerald-600 text-white font-bold')
                        : (isDark ? 'text-emerald-100/80 hover:bg-black/15' : textMuted)
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {item.icon}
                      <span>{item.label}</span>
                    </div>
                  </button>
                ))}
              </nav>
            </div>

            <div className={`pt-4 border-t ${sidebarBorderStyle} flex items-center justify-between`}>
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`w-9 h-9 rounded-full ${isDark ? 'bg-white/20 text-white' : 'bg-emerald-600 text-white'} flex items-center justify-center font-bold text-xs shrink-0`}>
                  {userInitials}
                </div>
                <span className="text-xs font-bold truncate">{userName}</span>
              </div>
              <button
                onClick={handleLogout}
                className={`p-2 rounded-lg transition ${isDark ? 'text-emerald-100 hover:bg-black/20' : 'text-red-500 hover:bg-red-500/10'}`}
                title="Sair"
              >
                <LogOut size={18} />
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Conteúdo Principal */}
      <main className={`flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 pb-28 md:pb-8 ${bgApp}`}>
        
        {/* BANNER FIXO APENAS NA TOLERÂNCIA 24H (Pós-vencimento) */}
        {accessState === 'tolerance_24h' && (
          <div className="mb-6 rounded-2xl bg-gradient-to-r from-red-700 via-red-600 to-rose-700 p-4 text-white shadow-xl border border-red-400/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-black/25 shrink-0">
                <Lock size={20} />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-sm sm:text-base font-black">
                    Sua assinatura expirou. Você está em período de tolerância.
                  </h4>
                  <span className="px-2.5 py-0.5 rounded-full bg-black/30 text-[11px] font-black uppercase tracking-wider border border-white/20">
                    ⏳ Acesso restrito em {toleranceLeftText}
                  </span>
                </div>
                <p className="text-xs text-white/90 mt-0.5">
                  Renove para desbloquear seus dados (••••••) e liberar novos cadastros.
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsActivationModalOpen(true)}
              className="px-5 py-2.5 rounded-xl bg-white text-red-700 font-black text-xs hover:bg-red-50 transition shrink-0 shadow-lg"
            >
              Renovar Assinatura →
            </button>
          </div>
        )}

        {/* Header Superior */}
        <header className="flex justify-between items-center mb-6 sm:mb-8 gap-2">
          <div className="flex items-center gap-3 sm:gap-4">
            <button 
              onClick={() => {
                if (window.innerWidth < 768) {
                  setIsMobileMenuOpen(true);
                } else {
                  setIsSidebarOpen(!isSidebarOpen);
                }
              }}
              className={`p-2.5 rounded-xl border transition shadow-sm ${bgCard} hover:opacity-80`}
              title="Menu"
            >
              <Menu size={20} />
            </button>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
              {activeTab === 'dashboard' && 'Início'}
              {activeTab === 'clients' && 'Clientes'}
              {activeTab === 'contracts' && 'Contratos'}
              {activeTab === 'installments' && 'Vencimentos'}
              {activeTab === 'reports' && 'Relatórios'}
              {activeTab === 'settings' && 'Configurações'}
            </h1>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {accessState === 'trial' && (
              <button
                onClick={() => setIsActivationModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-extrabold hover:bg-emerald-600 hover:text-white transition"
              >
                <Sparkles size={14} />
                <span>Trial: {timeLeftText}</span>
              </button>
            )}

            {accessState === 'warning_3d' && (
              <button
                onClick={() => setIsActivationModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-500 text-xs font-extrabold hover:bg-amber-500 hover:text-white transition"
              >
                <Clock size={14} />
                <span>Vence em {timeLeftText}</span>
              </button>
            )}

            {accessState === 'warning_24h' && (
              <button
                onClick={() => setIsActivationModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-500/15 border border-red-500/40 text-red-500 text-xs font-extrabold hover:bg-red-600 hover:text-white transition"
              >
                <Clock size={14} />
                <span>Vence em {timeLeftText}</span>
              </button>
            )}

            {accessState === 'tolerance_24h' && (
              <button
                onClick={() => setIsActivationModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-600 text-white text-xs font-extrabold shadow"
              >
                <Lock size={14} />
                <span>Tolerância: {toleranceLeftText}</span>
              </button>
            )}

            <button
              onClick={toggleTheme}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-bold transition shadow-sm ${bgCard} hover:opacity-80`}
              title={isDark ? 'Mudar para Tema Claro' : 'Mudar para Tema Escuro'}
            >
              {isDark ? (
                <>
                  <Sun size={16} className="text-amber-400" />
                  <span className="hidden sm:inline text-zinc-200">Modo Claro</span>
                </>
              ) : (
                <>
                  <Moon size={16} className="text-emerald-700" />
                  <span className="hidden sm:inline text-slate-800">Modo Escuro</span>
                </>
              )}
            </button>

            <div className={`hidden sm:flex border px-4 py-2 rounded-xl text-xs sm:text-sm items-center gap-2 shadow-sm font-semibold ${bgCard}`}>
              <ShieldCheck size={16} className="text-emerald-500" /> 
              <span>{accessState === 'active' ? 'SyJury Pro' : 'Sistema SyJury'}</span>
            </div>
          </div>
        </header>

        {/* Dashboard */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
              <div className="lg:col-span-2 bg-gradient-to-br from-[#065f46] via-emerald-950 to-zinc-900 border border-emerald-500/25 p-6 sm:p-8 rounded-3xl shadow-xl relative overflow-hidden flex flex-col justify-between text-white">
                <div className="absolute right-4 top-4 text-emerald-300/10">
                  <DollarSign size={120} />
                </div>
                <div>
                  <span className="text-xs font-bold text-emerald-200 tracking-wider uppercase flex items-center gap-1.5">
                    <DollarSign size={15} /> Total em aberto
                  </span>
                  <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black mt-3 text-white tracking-tight">
                    {displayCurrency(totalEmAbertoGeral)}
                  </h2>
                </div>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-1 gap-4">
                <div className={`${bgCard} p-4 sm:p-5 rounded-2xl flex justify-between items-center border`}>
                  <div>
                    <span className={`text-[11px] sm:text-xs font-bold ${textMuted} uppercase tracking-wider block`}>Recebido hoje</span>
                    <h3 className={`text-lg sm:text-2xl font-extrabold mt-1 ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
                      {displayCurrency(recebidoHoje)}
                    </h3>
                  </div>
                  <div className={`hidden sm:flex p-3 rounded-xl border ${isDark ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-emerald-100 text-emerald-700 border-emerald-300'}`}>
                    <TrendingUp size={22} />
                  </div>
                </div>

                <div className={`${bgCard} p-4 sm:p-5 rounded-2xl flex justify-between items-center border`}>
                  <div>
                    <span className={`text-[11px] sm:text-xs font-bold ${textMuted} uppercase tracking-wider block`}>Ontem</span>
                    <h3 className={`text-lg sm:text-2xl font-extrabold mt-1 ${isDark ? 'text-zinc-200' : 'text-slate-800'}`}>
                      {displayCurrency(recebidoOntem)}
                    </h3>
                  </div>
                  <div className={`hidden sm:flex p-3 rounded-xl border ${isDark ? 'bg-zinc-800 text-zinc-400 border-zinc-700' : 'bg-slate-200 text-slate-700 border-slate-300'}`}>
                    <Clock size={22} />
                  </div>
                </div>
              </div>
            </div>

            <div className={`${bgCard} rounded-3xl p-5 sm:p-6 border`}>
              <div className={`flex justify-between items-center mb-4 sm:mb-6 border-b pb-4 ${borderStyle}`}>
                <h3 className={`text-base sm:text-lg font-extrabold ${isDark ? 'text-zinc-100' : 'text-slate-800'}`}>Resumo do mês</h3>
                <span className={`text-xs sm:text-sm font-bold px-3 py-1 rounded-lg border ${
                  isDark ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25' : 'text-emerald-800 bg-emerald-100 border-emerald-300'
                }`}>{mesFormatado}</span>
              </div>

              <div className={`divide-y ${isDark ? 'divide-zinc-800' : 'divide-slate-200'}`}>
                <div className="py-3.5 sm:py-4 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 ${
                      isDark ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-red-100 text-red-700 border-red-300'
                    }`}>
                      <FileText size={18} />
                    </div>
                    <div>
                      <p className="font-bold text-sm">Custos</p>
                      <p className={`text-xs ${textMuted}`}>Custos do contrato</p>
                    </div>
                  </div>
                  <span className={`font-extrabold text-sm sm:text-lg ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                    {displayCurrency(custosMes)}
                  </span>
                </div>

                <div className="py-3.5 sm:py-4 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 ${
                      isDark ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-emerald-100 text-emerald-700 border-emerald-300'
                    }`}>
                      <CheckCircle size={18} />
                    </div>
                    <div>
                      <p className="font-bold text-sm">Recebido</p>
                      <p className={`text-xs ${textMuted}`}>Entradas</p>
                    </div>
                  </div>
                  <span className={`font-extrabold text-sm sm:text-lg ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
                    {displayCurrency(recebidoMes)}
                  </span>
                </div>

                <div className="py-3.5 sm:py-4 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 ${
                      isDark ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-blue-100 text-blue-700 border-blue-300'
                    }`}>
                      <Clock size={18} />
                    </div>
                    <div>
                      <p className="font-bold text-sm">A receber</p>
                      <p className={`text-xs ${textMuted}`}>Em aberto</p>
                    </div>
                  </div>
                  <span className={`font-extrabold text-sm sm:text-lg ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>
                    {displayCurrency(aReceberMes)}
                  </span>
                </div>

                <div className="py-3.5 sm:py-4 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 ${
                      isDark ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-amber-100 text-amber-700 border-amber-300'
                    }`}>
                      <TrendingUp size={18} />
                    </div>
                    <div>
                      <p className="font-bold text-sm">Rentabilidade</p>
                      <p className={`text-xs ${textMuted}`}>Recebido - Custo</p>
                    </div>
                  </div>
                  <span className={`font-extrabold text-sm sm:text-lg ${rentabilidadeMes >= 0 ? (isDark ? 'text-emerald-400' : 'text-emerald-700') : (isDark ? 'text-red-400' : 'text-red-600')}`}>
                    {displayCurrency(rentabilidadeMes)}
                  </span>
                </div>

                <div className="py-3.5 sm:py-4 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 ${
                      isDark ? 'bg-zinc-800 text-zinc-300 border-zinc-700' : 'bg-blue-100 text-blue-700 border-blue-300'
                    }`}>
                      <FileText size={18} />
                    </div>
                    <div>
                      <p className="font-bold text-sm">Novos contratos</p>
                      <p className={`text-xs ${textMuted}`}>Abertos no mês</p>
                    </div>
                  </div>
                  <span className="font-extrabold text-sm sm:text-lg">{isMasked ? '••' : novosContratosMes}</span>
                </div>

                <div className="py-3.5 sm:py-4 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 ${
                      isDark ? 'bg-zinc-800 text-zinc-300 border-zinc-700' : 'bg-slate-200 text-slate-700 border-slate-300'
                    }`}>
                      <Users size={18} />
                    </div>
                    <div>
                      <p className="font-bold text-sm">Novos clientes</p>
                      <p className={`text-xs ${textMuted}`}>Cadastrados no mês</p>
                    </div>
                  </div>
                  <span className="font-extrabold text-sm sm:text-lg">{isMasked ? '••' : novosClientesMes}</span>
                </div>
              </div>
            </div>

            <div className={`${bgCard} rounded-3xl p-5 sm:p-6 border`}>
              <div className="flex justify-between items-center mb-4">
                <span className={`font-bold text-sm ${textMuted}`}>Contratos por status</span>
                <span className={`text-sm font-extrabold ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
                  {isMasked ? '••' : totalContratos} <span className={`text-xs ${textMuted} font-normal`}>no total</span>
                </span>
              </div>
              <div className={`w-full ${isDark ? 'bg-zinc-800 border-zinc-700/50' : 'bg-slate-200 border-slate-300'} h-3 rounded-full overflow-hidden flex mb-3 border`}>
                <div className="bg-blue-500 transition-all duration-500" style={{ width: `${pctAbertos}%` }}></div>
                <div className="bg-emerald-500 transition-all duration-500" style={{ width: `${pctFechados}%` }}></div>
              </div>
              <div className={`flex justify-between text-xs ${textMuted} font-medium`}>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block"></span> Abertos: <strong className="font-bold">{isMasked ? '••' : `${contratosAbertos} (${pctAbertos}%)`}</strong>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span> Fechados: <strong className="font-bold">{isMasked ? '••' : `${contratosFechados} (${pctFechados}%)`}</strong>
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Clientes */}
        {activeTab === 'clients' && (
          <Clients 
            isDark={isDark}
            isActivated={canWrite}
            isMasked={isMasked}
            hideValues={isMasked}
            onRequireActivation={() => setIsActivationModalOpen(true)}
            onNavigateToContracts={(client) => {
              if (!canWrite) {
                setIsActivationModalOpen(true);
                return;
              }
              setPreselectedClient(client);
              setActiveTab('contracts');
            }} 
          />
        )}

        {/* Contratos */}
        {activeTab === 'contracts' && (
          <Contracts 
            isDark={isDark}
            isActivated={canWrite}
            isMasked={isMasked}
            hideValues={isMasked}
            onRequireActivation={() => setIsActivationModalOpen(true)}
            preselectedClient={preselectedClient} 
            onClearPreselected={() => setPreselectedClient(null)} 
          />
        )}

        {/* Vencimentos */}
        {activeTab === 'installments' && (
          <Vencimentos 
            isDark={isDark} 
            isActivated={canWrite}
            isMasked={isMasked}
            hideValues={isMasked}
            onRequireActivation={() => setIsActivationModalOpen(true)}
          />
        )}

        {/* Relatórios */}
        {activeTab === 'reports' && (
          <Reports 
            isDark={isDark}
            isActivated={canWrite} 
            isMasked={isMasked}
            onRequireActivation={() => setIsActivationModalOpen(true)}
          />
        )}

        {/* Configurações */}
        {activeTab === 'settings' && (
          <Settings
            isDark={isDark}
            isActivated={canWrite}
            hideValues={isMasked}
            onRequireActivation={() => setIsActivationModalOpen(true)}
            subscriptionInfo={derivedSubscriptionInfo}
            onRefreshSubscription={refreshSubscription}
          />
        )}
      </main>

      {/* Modal de Ativação / Hard Paywall */}
      <ActivationModal
        isOpen={isActivationModalOpen || isHardBlocked}
        isHardBlocked={isHardBlocked}
        onClose={() => setIsActivationModalOpen(false)}
        onLogout={handleLogout}
        isDark={isDark}
        onActivated={() => {
          refreshSubscription();
          setIsActivationModalOpen(false);
        }}
      />

      {/* Navbar Mobile Inferior 100% Responsiva */}
      <nav className={`md:hidden fixed bottom-0 left-0 right-0 ${isDark ? 'bg-zinc-900/95' : 'bg-[#f8fafc]/95'} backdrop-blur-md border-t ${borderStyle} grid grid-cols-6 gap-0.5 px-1.5 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] z-40`}>
        {menuItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleMenuClick(item.id)}
              className={`flex flex-col items-center justify-center gap-1 min-w-0 w-full py-1.5 px-0.5 rounded-xl text-[9.5px] sm:text-[10px] leading-tight tracking-tight transition ${
                isActive
                  ? (isDark ? 'text-emerald-400 font-extrabold bg-emerald-500/10' : 'text-emerald-700 font-extrabold bg-emerald-100/80')
                  : `${textMuted} font-semibold hover:opacity-80`
              }`}
            >
              <span className="shrink-0">{item.icon}</span>
              <span className="truncate max-w-full">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}