import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  KeyRound, Mail, User, ArrowRight, DollarSign, 
  Loader2, Sparkles, CheckCircle, Eye, EyeOff, Sun, Moon, ShieldAlert
} from 'lucide-react';

export default function Auth({ isDark = true, onToggleTheme, onLoginSuccess }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    password: '',
    confirmPassword: '',
    promoCode: ''
  });

  // Escuta se o utilizador veio de um link de recuperação de senha do e-mail
  useEffect(() => {
    const hash = window.location.hash || '';
    if (hash.includes('type=recovery')) {
      setIsResettingPassword(true);
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsResettingPassword(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const formatPhone = (v) => {
    v = v.replace(/\D/g, '').slice(0, 11);
    if (v.length > 7) return `(${v.slice(0,2)}) ${v.slice(2,3)} ${v.slice(3,7)}-${v.slice(7)}`;
    if (v.length > 2) return `(${v.slice(0,2)}) ${v.slice(2)}`;
    return v;
  };

  function translateAuthError(msg = '') {
    const lower = msg.toLowerCase();
    if (lower.includes('email not confirmed')) {
      return 'Seu e-mail ainda não foi confirmado! Verifique sua caixa de entrada (e a pasta de spam) e clique no link de confirmação.';
    }
    if (lower.includes('invalid login credentials')) {
      return 'E-mail ou senha incorretos. Verifique seus dados e tente novamente.';
    }
    if (lower.includes('user already registered')) {
      return 'Este e-mail já está cadastrado. Tente fazer login ou recuperar sua senha.';
    }
    if (lower.includes('rate limit') || lower.includes('too many requests')) {
      return 'Muitas tentativas em sequência. Aguarde alguns minutos antes de tentar novamente.';
    }
    return msg || 'Ocorreu um erro na autenticação. Tente novamente.';
  }

  async function handleResetPassword() {
    if (!formData.email.trim()) {
      setErrorMessage('Digite seu e-mail no campo acima para enviarmos o link de recuperação.');
      return;
    }
    setLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    const { error } = await supabase.auth.resetPasswordForEmail(formData.email.trim(), {
      redirectTo: window.location.origin
    });

    setLoading(false);
    if (error) {
      setErrorMessage(translateAuthError(error.message));
    } else {
      setSuccessMessage('Link de recuperação enviado! Verifique sua caixa de entrada e clique no link para criar uma nova senha.');
    }
  }

  async function handleUpdateNewPassword(e) {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (formData.password.length < 8) {
      setErrorMessage('A nova senha deve ter pelo menos 8 caracteres.');
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setErrorMessage('As senhas digitadas não coincidem.');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.updateUser({
        password: formData.password
      });

      if (error) throw error;

      setSuccessMessage('Senha atualizada com sucesso! Acessando sua conta...');
      setTimeout(() => {
        setIsResettingPassword(false);
        if (onLoginSuccess && data?.user) onLoginSuccess(data.user);
      }, 1200);
    } catch (err) {
      setErrorMessage(translateAuthError(err.message));
    } finally {
      setLoading(false);
    }
  }

  // Se o utilizador informou um cupom no cadastro, cria a solicitação pendente no 1º login
  async function ensurePendingCouponRequest(user) {
    if (!user) return;
    const pendingCoupon = user.user_metadata?.pending_coupon;
    if (!pendingCoupon) return;

    try {
      const { data: existing } = await supabase
        .from('coupon_requests')
        .select('id')
        .eq('user_id', user.id)
        .eq('coupon_code', pendingCoupon)
        .maybeSingle();

      if (!existing) {
        await supabase.from('coupon_requests').insert({
          user_id: user.id,
          user_email: user.email,
          coupon_code: pendingCoupon,
          status: 'pending'
        });
      }

      // Limpa a flag temporária dos metadados para não repetir
      await supabase.auth.updateUser({
        data: { pending_coupon: null }
      });
    } catch (err) {
      console.error('Erro ao registrar solicitação de cupom inicial:', err);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (isSignUp) {
      if (formData.password.length < 8) {
        setErrorMessage('A senha deve ter pelo menos 8 caracteres.');
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        setErrorMessage('As senhas digitadas não coincidem.');
        return;
      }
    }

    setLoading(true);

    try {
      if (isSignUp) {
        const cleanPromo = formData.promoCode.trim().toUpperCase();
        const { data: emailExists, error: emailCheckError } = await supabase.rpc('check_email_exists', {
          email_input: formData.email.trim()
        });
        if (emailCheckError) throw emailCheckError;
        if (emailExists) {
          throw new Error('User already registered');
        }

        // Cria o utilizador no Supabase Auth exigindo confirmação por e-mail (Double Opt-In)
        const { data, error } = await supabase.auth.signUp({
          email: formData.email.trim(),
          password: formData.password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              full_name: formData.name.trim(),
              phone: formData.phone,
              is_activated: false,
              pending_coupon: cleanPromo || null
            }
          }
        });

        if (error) throw error;

        // No Supabase, quando um e-mail já existe e Confirm Email está ativo, identities pode vir vazio
        if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
          throw new Error('User already registered');
        }

        // Garante que nunca entre direto sem e-mail confirmado
        if (!data?.session || !data?.user?.email_confirmed_at) {
          if (data?.session) {
            await supabase.auth.signOut();
          }
          setSuccessMessage(
            cleanPromo
              ? `Cadastro realizado! Enviamos um link de confirmação para ${formData.email.trim()}. Confirme seu e-mail para ativar a conta e enviar seu cupom "${cleanPromo}" para aprovação.`
              : `Cadastro realizado com sucesso! Enviamos um link de confirmação para ${formData.email.trim()}. Verifique sua caixa de entrada (e spam) para liberar seu acesso.`
          );
          setIsSignUp(false);
          setFormData(prev => ({ ...prev, password: '', confirmPassword: '' }));
        } else {
          await ensurePendingCouponRequest(data.user);
          if (onLoginSuccess) onLoginSuccess(data.user);
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: formData.email.trim(),
          password: formData.password
        });

        if (error) throw error;

        if (!data?.user?.email_confirmed_at) {
          await supabase.auth.signOut();
          throw new Error('Email not confirmed');
        }

        await ensurePendingCouponRequest(data.user);
        if (onLoginSuccess) onLoginSuccess(data.user);
      }
    } catch (err) {
      setErrorMessage(translateAuthError(err.message));
    } finally {
      setLoading(false);
    }
  }

  const bgPage = isDark ? 'bg-[#121212] text-white' : 'bg-[#e2e8f0] text-slate-900';
  const inputBg = isDark 
    ? 'bg-zinc-900 border-zinc-800 text-white placeholder-gray-500 focus:border-emerald-500' 
    : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-emerald-600';
  const textMuted = isDark ? 'text-gray-400' : 'text-slate-600';

  return (
    <div className={`min-h-screen grid grid-cols-1 lg:grid-cols-2 font-sans transition-colors duration-200 ${bgPage}`}>
      
      {/* COLUNA ESQUERDA: FORMULÁRIO DE LOGIN / CADASTRO / NOVA SENHA */}
      <div className="flex flex-col justify-between p-6 sm:p-10 lg:p-14">
        
        {/* Topo: Logo + Alternador de Tema */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="bg-gradient-to-tr from-emerald-600 to-emerald-500 p-2 rounded-xl text-white font-bold shadow-lg shadow-emerald-500/20">
              <DollarSign size={20} />
            </div>
            <span className="text-lg font-extrabold tracking-wide bg-gradient-to-r from-emerald-400 to-emerald-300 bg-clip-text text-transparent">
              SyJury
            </span>
          </div>

          {onToggleTheme && (
            <button
              type="button"
              onClick={onToggleTheme}
              className={`p-2 rounded-xl border text-xs font-bold transition ${
                isDark ? 'bg-zinc-900 border-zinc-800 text-amber-400' : 'bg-white border-slate-300 text-emerald-700 shadow-sm'
              }`}
              title="Alternar tema"
            >
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          )}
        </div>

        {/* Centro: Formulário */}
        <div className="w-full max-w-sm mx-auto my-8 space-y-6">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            {isResettingPassword ? 'Nova Senha' : (isSignUp ? 'Criar Conta' : 'Entrar')}
          </h1>

          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-bold flex items-start gap-2.5 leading-relaxed">
              <ShieldAlert size={16} className="shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-start gap-2.5 leading-relaxed">
              <CheckCircle size={16} className="shrink-0 mt-0.5" /> 
              <span>{successMessage}</span>
            </div>
          )}

          {isResettingPassword ? (
            /* FORMULÁRIO DE REDEFINIÇÃO DE SENHA */
            <form onSubmit={handleUpdateNewPassword} className="space-y-4">
              <p className={`text-xs ${textMuted}`}>
                Digite e confirme a sua nova senha de acesso abaixo:
              </p>

              <div>
                <label className={`block text-xs font-bold mb-1.5 ${textMuted}`}>Nova senha</label>
                <div className="relative">
                  <KeyRound className={`absolute left-3.5 top-1/2 -translate-y-1/2 ${textMuted}`} size={16} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Mínimo de 8 caracteres"
                    value={formData.password}
                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    className={`w-full border rounded-xl pl-10 pr-10 py-2.5 text-sm focus:outline-none transition ${inputBg}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className={`absolute right-3 top-1/2 -translate-y-1/2 ${textMuted} hover:opacity-80`}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label className={`block text-xs font-bold mb-1.5 ${textMuted}`}>Confirmar nova senha</label>
                <div className="relative">
                  <KeyRound className={`absolute left-3.5 top-1/2 -translate-y-1/2 ${textMuted}`} size={16} />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    placeholder="Repita a nova senha"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    className={`w-full border rounded-xl pl-10 pr-10 py-2.5 text-sm focus:outline-none transition ${inputBg}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className={`absolute right-3 top-1/2 -translate-y-1/2 ${textMuted} hover:opacity-80`}
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-xs sm:text-sm transition bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg disabled:opacity-50"
              >
                {loading && <Loader2 size={16} className="animate-spin" />}
                <span>Salvar nova senha</span>
              </button>
            </form>
          ) : (
            /* FORMULÁRIO PADRÃO DE LOGIN E CADASTRO */
            <>
              <form onSubmit={handleSubmit} className="space-y-4">
                {isSignUp && (
                  <>
                    <div>
                      <label className={`block text-xs font-bold mb-1.5 ${textMuted}`}>Nome completo</label>
                      <div className="relative">
                        <User className={`absolute left-3.5 top-1/2 -translate-y-1/2 ${textMuted}`} size={16} />
                        <input
                          type="text"
                          required
                          placeholder="Seu nome"
                          value={formData.name}
                          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                          className={`w-full border rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none transition ${inputBg}`}
                        />
                      </div>
                    </div>

                    <div>
                      <label className={`block text-xs font-bold mb-1.5 ${textMuted}`}>WhatsApp</label>
                      <div className={`flex border rounded-xl overflow-hidden focus-within:border-emerald-500 transition ${inputBg}`}>
                        <div className={`flex items-center gap-1.5 px-3 border-r text-xs shrink-0 ${
                          isDark ? 'bg-zinc-800/70 border-zinc-800 text-gray-300' : 'bg-slate-100 border-slate-300 text-slate-700'
                        }`}>
                          <span>🇧🇷</span>
                          <span className="text-[10px] opacity-70">+55</span>
                        </div>
                        <input
                          type="tel"
                          required
                          placeholder="(88) 9 9999-9999"
                          value={formData.phone}
                          onChange={(e) => setFormData(prev => ({ ...prev, phone: formatPhone(e.target.value) }))}
                          className="w-full bg-transparent px-3.5 py-2.5 text-sm focus:outline-none"
                        />
                      </div>
                    </div>
                  </>
                )}

                <div>
                  <label className={`block text-xs font-bold mb-1.5 ${textMuted}`}>E-mail</label>
                  <div className="relative">
                    <Mail className={`absolute left-3.5 top-1/2 -translate-y-1/2 ${textMuted}`} size={16} />
                    <input
                      type="email"
                      required
                      placeholder="seu@email.com"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      className={`w-full border rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none transition ${inputBg}`}
                    />
                  </div>
                  {isSignUp && (
                    <span className={`text-[11px] mt-1 block ${textMuted}`}>
                      Enviaremos um link de confirmação para este e-mail.
                    </span>
                  )}
                </div>

                <div>
                  <label className={`block text-xs font-bold mb-1.5 ${textMuted}`}>Senha</label>
                  <div className="relative">
                    <KeyRound className={`absolute left-3.5 top-1/2 -translate-y-1/2 ${textMuted}`} size={16} />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                      className={`w-full border rounded-xl pl-10 pr-10 py-2.5 text-sm focus:outline-none transition ${inputBg}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className={`absolute right-3 top-1/2 -translate-y-1/2 ${textMuted} hover:opacity-80`}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {isSignUp && (
                    <span className={`text-[11px] mt-1 block ${textMuted}`}>A senha deve ter pelo menos 8 caracteres.</span>
                  )}
                </div>

                {!isSignUp && (
                  <div className="text-center pt-1">
                    <button
                      type="button"
                      onClick={handleResetPassword}
                      className="text-xs font-bold text-emerald-500 hover:text-emerald-400 hover:underline"
                    >
                      Esqueceu sua senha?
                    </button>
                  </div>
                )}

                {isSignUp && (
                  <>
                    <div>
                      <label className={`block text-xs font-bold mb-1.5 ${textMuted}`}>Repetir senha</label>
                      <div className="relative">
                        <KeyRound className={`absolute left-3.5 top-1/2 -translate-y-1/2 ${textMuted}`} size={16} />
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          required
                          placeholder="••••••••"
                          value={formData.confirmPassword}
                          onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                          className={`w-full border rounded-xl pl-10 pr-10 py-2.5 text-sm focus:outline-none transition ${inputBg}`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className={`absolute right-3 top-1/2 -translate-y-1/2 ${textMuted} hover:opacity-80`}
                        >
                          {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className={`block text-xs font-bold mb-1.5 ${textMuted} flex items-center gap-1`}>
                        <Sparkles size={13} className="text-emerald-500" /> Possui um Cupom Promocional? (Opcional)
                      </label>
                      <input
                        type="text"
                        placeholder="DIGITE SEU CÓDIGO AQUI"
                        value={formData.promoCode}
                        onChange={(e) => setFormData(prev => ({ ...prev, promoCode: e.target.value.toUpperCase() }))}
                        className={`w-full border rounded-xl px-4 py-2.5 text-xs font-bold uppercase focus:outline-none transition ${inputBg}`}
                      />
                    </div>

                    <p className={`text-[11px] ${textMuted}`}>
                      Ao se cadastrar, você receberá um e-mail de confirmação obrigatória para ativar sua conta.
                    </p>
                  </>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-xs sm:text-sm transition border shadow-lg ${
                    isDark 
                      ? 'bg-zinc-900 hover:bg-zinc-800 text-white border-emerald-500/30' 
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-600'
                  } disabled:opacity-50`}
                >
                  {loading && <Loader2 size={16} className="animate-spin" />}
                  <span>{isSignUp ? 'Criar minha conta' : 'Entrar'}</span>
                  {!loading && <ArrowRight size={15} />}
                </button>
              </form>

              <div className="text-center pt-2">
                <span className={`text-xs ${textMuted}`}>
                  {isSignUp ? 'Já tem uma conta? ' : 'Não tem uma conta? '}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(!isSignUp);
                    setErrorMessage('');
                    setSuccessMessage('');
                  }}
                  className="text-xs font-bold text-emerald-500 hover:text-emerald-400 hover:underline"
                >
                  {isSignUp ? 'Entrar' : 'Cadastre-se'}
                </button>
              </div>
            </>
          )}
        </div>

        <div className="text-center lg:text-left">
          <span className={`text-[11px] ${textMuted}`}>© 2026 SyJury · Gestão Inteligente</span>
        </div>
      </div>

      {/* COLUNA DIREITA: CARD COM MOCKUP DO SISTEMA (NOTEBOOK + CELULAR) */}
      <div className="hidden lg:flex p-6 items-center justify-center">
        <div className="w-full h-full rounded-3xl bg-gradient-to-br from-[#065f46] via-emerald-900 to-zinc-950 flex items-center justify-center p-12 relative overflow-hidden shadow-2xl border border-zinc-700">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(16,185,129,0.28),transparent_60%)]"></div>

          {/* Ilustração Mockup Notebook + Smartphone */}
          <div className="relative z-10 flex items-end justify-center w-full max-w-lg">
            
            {/* Tela do Notebook */}
            <div className="w-full bg-[#121212] rounded-t-2xl border-4 border-slate-800 shadow-2xl overflow-hidden">
              <div className="flex h-64">
                {/* Mini Sidebar */}
                <div className="w-28 bg-zinc-900 p-3 space-y-2 border-r border-zinc-800">
                  <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-[10px] mb-4">
                    <div className="w-4 h-4 rounded bg-emerald-600 flex items-center justify-center text-white text-[8px]">$</div>
                    SyJury
                  </div>
                  <div className="h-2 w-16 bg-emerald-500/40 rounded"></div>
                  <div className="h-2 w-14 bg-white/10 rounded"></div>
                  <div className="h-2 w-16 bg-white/10 rounded"></div>
                  <div className="h-2 w-12 bg-white/10 rounded"></div>
                </div>
                {/* Mini Dashboard */}
                <div className="flex-1 bg-[#f8fafc] p-4 space-y-3">
                  <div className="grid grid-cols-4 gap-2">
                    <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
                      <div className="w-3 h-3 rounded bg-amber-100 mb-1"></div>
                      <div className="h-1.5 w-8 bg-slate-300 rounded"></div>
                      <div className="text-[10px] font-bold text-slate-800 mt-1">0</div>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
                      <div className="w-3 h-3 rounded bg-emerald-100 mb-1"></div>
                      <div className="h-1.5 w-8 bg-slate-300 rounded"></div>
                      <div className="text-[10px] font-bold text-emerald-600 mt-1">390</div>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
                      <div className="w-3 h-3 rounded bg-red-100 mb-1"></div>
                      <div className="h-1.5 w-8 bg-slate-300 rounded"></div>
                      <div className="text-[10px] font-bold text-red-600 mt-1">8</div>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
                      <div className="w-3 h-3 rounded bg-emerald-100 mb-1"></div>
                      <div className="h-1.5 w-8 bg-slate-300 rounded"></div>
                      <div className="text-[10px] font-bold text-emerald-600 mt-1">9</div>
                    </div>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-200 h-32 flex items-end gap-1.5 pt-6">
                    {[35, 60, 45, 80, 55, 90, 70, 95, 65, 85, 75, 100].map((h, i) => (
                      <div key={i} className="flex-1 bg-emerald-500/80 rounded-t" style={{ height: `${h}%` }}></div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="h-3 bg-slate-900"></div>
            </div>

            {/* Mockup Smartphone Sobreposto */}
            <div className="w-36 bg-white rounded-3xl border-4 border-slate-900 shadow-2xl p-3 -ml-16 -mb-4 relative z-20 space-y-2.5 text-slate-800">
              <div className="w-10 h-1 bg-slate-300 rounded-full mx-auto"></div>
              <div className="text-[9px] font-extrabold text-emerald-700">Vencimentos</div>
              <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                <div className="h-1.5 w-12 bg-slate-300 rounded"></div>
                <div className="text-[10px] font-black text-slate-900">R$ 245.582,88</div>
              </div>
              <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                <div className="h-1.5 w-10 bg-slate-300 rounded"></div>
                <div className="text-[10px] font-black text-emerald-600">R$ 68.140,00</div>
              </div>
              <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 space-y-1">
                <div className="h-1.5 w-14 bg-emerald-300 rounded"></div>
                <div className="text-[10px] font-black text-emerald-700">+38,5%</div>
              </div>
            </div>

          </div>
        </div>
      </div>

    </div>
  );
}