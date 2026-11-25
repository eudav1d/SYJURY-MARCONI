import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
  User, Crown, MessageCircle, Unplug, Mail, Calendar,
  Save, RotateCcw, Eye, Edit3, AlertTriangle, Lock,
  CheckCircle2, KeyRound, ShieldCheck, Loader2, Sparkles,
  BellRing, Check, X, Clock, RefreshCw
} from 'lucide-react';

const ADMIN_EMAIL = 'davidnunes520@gmail.com';

const DEFAULT_TEMPLATES = {
  cobranca: `Olá, *{nome}*!

Sua fatura encontra-se em aberto.

📄 *Contrato:* {contrato}
🗓️ *Vencimento:* {vencimento}

💰 *Valor:* {valor}
📉 *Valor mínimo:* {minimo}

✅ *PIX para pagamento:*
\`000.000.00-00\`

📩 Envie o comprovante após o pagamento para confirmação.

Obrigado!`,

  atraso: `Olá, *{nome}*! 👋

Identificamos que a parcela do contrato *{contrato}* está em aberto há *{diasatraso}* dia(s).

🗓️ *Vencimento:* {vencimento}
💰 *Valor:* {valor}{linhamulta}
💵 *Valor atualizado:* {valoratualizado}
📉 *Valor mínimo:* {minimo}

📩 Se já efetuou o pagamento, por favor desconsidere esta mensagem e nos envie o comprovante.

Obrigado! 🙏`,

  recibo: `Olá, *{nome}*! 👋

Recebemos o pagamento da parcela *{parcela}* do contrato *{contrato}*.

💰 *Valor pago:* {pago}
🗓️ *Data do pagamento:* {datapagamento}

✅ Pagamento confirmado!

Obrigado pela pontualidade! 🙏

🗓️ *Próximo vencimento:* {proximovencimento}`,

  contrato: `Olá, *{primeironome}*! Seja bem-vindo(a). 👋

Seu contrato *{contrato}* foi registrado com sucesso. ✅

📄 *Tipo:* {tipo}

💰 *Valor total:* {totalcontrato}

📊 *Parcelas:* {qtdparcelas}x de {valorparcela}
⚠️ *Multa por atraso:* {multadia}

🗓️ *Proximo vencimento:* {proximovencimento}

🗓️ *Lista de vencimentos*

{listaparcelas}

Qualquer dúvida, estamos à disposição! 😊`
};

const TEMPLATE_VARIABLES = [
  '{nome}', '{primeironome}', '{telefone}', '{documento}', '{endereco}',
  '{cidade}', '{cep}', '{enderecocompleto}', '{contrato}', '{tipo}',
  '{totalcontrato}', '{qtdparcelas}', '{saldo}', '{listaparcelas}',
  '{parcela}', '{vencimento}', '{datapagamento}', '{pago}', '{valor}',
  '{valorparcela}', '{minimo}', '{diasatraso}', '{proximovencimento}',
  '{hoje}', '{multa}', '{multadia}', '{valoratualizado}', '{linhamulta}'
];

const SAMPLE_PREVIEW_DATA = {
  '{nome}': 'João da Silva',
  '{primeironome}': 'João',
  '{telefone}': '(88) 99999-0000',
  '{documento}': '123.456.789-00',
  '{endereco}': 'Rua São Francisco, 120',
  '{cidade}': 'Crato - CE',
  '{cep}': '63100-000',
  '{enderecocompleto}': 'Rua São Francisco, 120, Centro - Crato/CE',
  '{contrato}': '#104',
  '{tipo}': 'Fixo mensal',
  '{totalcontrato}': 'R$ 1.300,00',
  '{qtdparcelas}': '1',
  '{saldo}': 'R$ 1.300,00',
  '{listaparcelas}': '1/1 - 15/12/2026 - R$ 300,00',
  '{parcela}': '1/1',
  '{vencimento}': '15/12/2026',
  '{datapagamento}': '15/11/2026',
  '{pago}': 'R$ 300,00',
  '{valor}': 'R$ 300,00',
  '{valorparcela}': 'R$ 300,00',
  '{minimo}': 'R$ 300,00',
  '{diasatraso}': '5',
  '{proximovencimento}': '15/12/2026',
  '{hoje}': '15/11/2026',
  '{multa}': 'R$ 50,00',
  '{multadia}': 'R$ 10,00/dia',
  '{valoratualizado}': 'R$ 350,00',
  '{linhamulta}': '\n⚠️ *Multa:* R$ 50,00'
};

export default function Settings({
  isDark = false,
  isActivated = false,
  hideValues = false,
  onRequireActivation,
  subscriptionInfo = null,
  onRefreshSubscription = null
}) {
  const [activeTab, setActiveTab] = useState('perfil'); // perfil | plano | whatsapp | integracoes | admin
  const [loadingUser, setLoadingUser] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingTemplates, setSavingTemplates] = useState(false);

  // Estado da aba Perfil
  const [profile, setProfile] = useState({
    fullName: '',
    email: '',
    phone: '',
    birthDate: ''
  });

  // Estado da aba Plano
  const [licenseKeyInput, setLicenseKeyInput] = useState('');
  const [activatingKey, setActivatingKey] = useState(false);
  const [keyFeedback, setKeyFeedback] = useState({ type: '', text: '' });
  const [storageUsedMB, setStorageUsedMB] = useState(0.2);

  // Estado da aba Admin (Solicitações de Cupões)
  const [couponRequests, setCouponRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [processingId, setProcessingId] = useState(null);

  // Estado da aba WhatsApp
  const [whatsappSubTab, setWhatsappSubTab] = useState('modelos'); // modelos | regua
  const [selectedTemplateType, setSelectedTemplateType] = useState('cobranca'); // cobranca | atraso | recibo | contrato
  const [editorMode, setEditorMode] = useState('edit'); // edit | preview
  const [templates, setTemplates] = useState(DEFAULT_TEMPLATES);
  const [billingRules, setBillingRules] = useState({
    remindBeforeDays: 2,
    enableBeforeReminder: true,
    enableDueDateReminder: true,
    enableOverdueReminder: true
  });

  const isMasked = !isActivated || hideValues;
  const isAdmin = profile.email?.toLowerCase() === ADMIN_EMAIL;

  // Guardião de Segurança do Soft Paywall
  function checkActivation() {
    if (!isActivated) {
      if (onRequireActivation) onRequireActivation();
      return false;
    }
    return true;
  }

  useEffect(() => {
    loadSettingsFromCloud();
  }, []);

  useEffect(() => {
    if (isAdmin && activeTab === 'admin') {
      loadCouponRequests();
    }
  }, [isAdmin, activeTab]);

  async function loadSettingsFromCloud() {
    setLoadingUser(true);
    try {
      const [{ data: { user } }, contractsCountRes, clientsCountRes] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from('contracts').select('id', { count: 'exact', head: true }),
        supabase.from('clients').select('id', { count: 'exact', head: true })
      ]);

      if (user) {
        const meta = user.user_metadata || {};
        const userEmail = user.email || '';
        setProfile({
          fullName: meta.full_name || meta.name || userEmail.split('@')[0] || '',
          email: userEmail,
          phone: meta.phone || '',
          birthDate: meta.birth_date || ''
        });

        if (meta.whatsapp_templates) {
          setTemplates({
            ...DEFAULT_TEMPLATES,
            ...meta.whatsapp_templates
          });
        }

        if (meta.billing_rules) {
          setBillingRules(prev => ({
            ...prev,
            ...meta.billing_rules
          }));
        }

        if (userEmail.toLowerCase() === ADMIN_EMAIL) {
          loadCouponRequests();
        }
      }

      const totalRecords = (contractsCountRes.count || 0) + (clientsCountRes.count || 0);
      const calculatedMB = Math.min(300, Number((totalRecords * 0.05).toFixed(1)));
      setStorageUsedMB(calculatedMB);
    } catch (err) {
      console.error('Erro ao carregar configurações:', err);
    }
    setLoadingUser(false);
  }

  async function loadCouponRequests() {
    setLoadingRequests(true);
    try {
      const { data, error } = await supabase
        .from('coupon_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        setCouponRequests(data);
      }
    } catch (err) {
      console.error('Erro ao buscar solicitações:', err);
    }
    setLoadingRequests(false);
  }

  async function handleApproveRequest(req) {
    setProcessingId(req.id);
    try {
      const newExpiration = new Date(Date.now() + 30 * 86400000).toISOString();

      // 1. Ativa a assinatura na tabela profiles do utilizador solicitante
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: req.user_id,
          is_activated: true,
          subscription_status: 'active',
          subscription_ends_at: newExpiration,
          activated_coupon: req.coupon_code,
          updated_at: new Date().toISOString()
        });

      if (profileError) throw profileError;

      // 2. Marca a solicitação como aprovada
      const { error: reqError } = await supabase
        .from('coupon_requests')
        .update({ status: 'approved' })
        .eq('id', req.id);

      if (reqError) throw reqError;

      await loadCouponRequests();
      if (onRefreshSubscription) onRefreshSubscription();
    } catch (err) {
      alert('Erro ao aprovar solicitação: ' + (err.message || 'Verifique as permissões RLS.'));
    }
    setProcessingId(null);
  }

  async function handleRejectRequest(req) {
    setProcessingId(req.id);
    try {
      const { error } = await supabase
        .from('coupon_requests')
        .update({ status: 'rejected' })
        .eq('id', req.id);

      if (error) throw error;
      await loadCouponRequests();
    } catch (err) {
      alert('Erro ao recusar solicitação: ' + err.message);
    }
    setProcessingId(null);
  }

  async function handleSaveProfile(e) {
    e.preventDefault();
    if (!checkActivation()) return;

    setSavingProfile(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          full_name: profile.fullName.trim(),
          phone: profile.phone.trim(),
          birth_date: profile.birthDate
        }
      });

      if (error) {
        alert('Erro ao salvar perfil: ' + error.message);
      } else {
        alert('Dados pessoais atualizados com sucesso!');
      }
    } catch (err) {
      alert('Erro ao atualizar perfil.');
    }
    setSavingProfile(false);
  }

  async function handleActivateKeySubmit(e) {
    e.preventDefault();
    setKeyFeedback({ type: '', text: '' });

    const cleanKey = licenseKeyInput.trim().toUpperCase();
    if (!cleanKey) {
      setKeyFeedback({ type: 'error', text: 'Digite um código válido para solicitar a ativação.' });
      return;
    }

    setActivatingKey(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Sessão expirada. Faça login novamente.');

      const { data: existingRequest, error: checkError } = await supabase
        .from('coupon_requests')
        .select('id, coupon_code')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .maybeSingle();

      if (checkError) throw checkError;

      if (existingRequest) {
        setKeyFeedback({
          type: 'error',
          text: `Você já possui uma solicitação em análise para o cupom "${existingRequest.coupon_code}".`
        });
        setActivatingKey(false);
        return;
      }

      const { error: insertError } = await supabase
        .from('coupon_requests')
        .insert({
          user_id: user.id,
          user_email: user.email,
          coupon_code: cleanKey,
          status: 'pending'
        });

      if (insertError) throw insertError;

      setKeyFeedback({
        type: 'success',
        text: 'Solicitação enviada com sucesso! Aguarde a aprovação do administrador para liberação.'
      });
      setLicenseKeyInput('');
      if (isAdmin) loadCouponRequests();
    } catch (err) {
      setKeyFeedback({
        type: 'error',
        text: err.message || 'Erro ao enviar solicitação de código.'
      });
    }
    setActivatingKey(false);
  }

  function handleInsertVariable(variable) {
    if (!checkActivation()) return;
    setTemplates(prev => {
      const currentText = prev[selectedTemplateType] || '';
      if (currentText.length + variable.length > 1000) return prev;
      return {
        ...prev,
        [selectedTemplateType]: `${currentText}${currentText.endsWith(' ') || currentText.length === 0 ? '' : ' '}${variable}`
      };
    });
  }

  function handleRestoreDefaultTemplate() {
    if (!checkActivation()) return;
    if (!confirm('Deseja restaurar o texto padrão para este modelo de mensagem?')) return;
    setTemplates(prev => ({
      ...prev,
      [selectedTemplateType]: DEFAULT_TEMPLATES[selectedTemplateType]
    }));
  }

  async function handleSaveTemplates() {
    if (!checkActivation()) return;
    setSavingTemplates(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          whatsapp_templates: templates,
          billing_rules: billingRules
        }
      });

      if (error) {
        alert('Erro ao salvar modelos: ' + error.message);
      } else {
        alert('Modelos de mensagem salvos na nuvem com sucesso!');
      }
    } catch (err) {
      alert('Erro ao salvar configurações de WhatsApp.');
    }
    setSavingTemplates(false);
  }

  function renderPreviewText(rawText) {
    let output = rawText || '';
    Object.entries(SAMPLE_PREVIEW_DATA).forEach(([key, val]) => {
      output = output.split(key).join(isMasked ? '••••••' : val);
    });
    return output;
  }

  function formatDateBR(isoStr) {
    if (!isoStr) return '08/12/2026';
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return '08/12/2026';
    return d.toLocaleDateString('pt-BR');
  }

  const currentTemplateText = templates[selectedTemplateType] || '';
  const daysRemaining = subscriptionInfo?.daysRemaining ?? (isActivated ? 22 : 0);
  const validUntilFormatted = subscriptionInfo?.validUntil
    ? formatDateBR(subscriptionInfo.validUntil)
    : '08/12/2026';
  const progressDaysPct = isActivated ? Math.min(100, Math.max(8, Math.round((daysRemaining / 30) * 100))) : 0;

  const pendingRequestsCount = couponRequests.filter(r => r.status === 'pending').length;

  // Paleta de Cores Sincronizada com o Tema Global do SyJury
  const bgCard = isDark ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-[#f8fafc] border-slate-300/80 text-slate-800 shadow-sm';
  const bgSubtle = isDark ? 'bg-[#121212] border-zinc-800' : 'bg-slate-200/70 border-slate-300';
  const textPrimary = isDark ? 'text-white' : 'text-slate-900';
  const textSecondary = isDark ? 'text-gray-400' : 'text-slate-600';
  const borderSubtle = isDark ? 'border-zinc-800' : 'border-slate-300/80';
  const inputStyle = `w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500 transition ${
    isDark ? 'bg-[#121212] border-zinc-800 text-white placeholder-gray-500' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
  }`;

  const tabsList = [
    { id: 'perfil', label: 'Perfil', icon: User },
    { id: 'plano', label: 'Plano', icon: Crown },
    { id: 'whatsapp', label: 'Whatsapp', icon: MessageCircle },
    { id: 'integracoes', label: 'Integrações', icon: Unplug },
    ...(isAdmin ? [{ id: 'admin', label: 'Admin', icon: ShieldCheck, badge: pendingRequestsCount }] : [])
  ];

  return (
    <div className="space-y-6 max-w-5xl pb-6">
      {/* Navegação Superior em Contentor Unificado com Borda */}
      <div className={`p-1.5 rounded-2xl border grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-1.5 ${bgCard}`}>
        {tabsList.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center justify-center sm:justify-start gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border transition ${
                isActive
                  ? (isDark
                      ? 'bg-emerald-600/25 text-white border-emerald-500/60 shadow-sm'
                      : 'bg-emerald-600 text-white border-emerald-600 shadow-sm')
                  : `border-transparent ${textSecondary} hover:opacity-80`
              }`}
            >
              <Icon size={14} className="shrink-0" />
              <span className="truncate">{tab.label}</span>
              {tab.badge > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-[10px] font-extrabold rounded-full bg-amber-500 text-black leading-none">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {loadingUser ? (
        <div className={`border rounded-2xl p-12 flex items-center justify-center gap-2 text-sm ${bgCard} ${textSecondary}`}>
          <Loader2 size={18} className="animate-spin text-emerald-500" /> Carregando configurações...
        </div>
      ) : (
        <>
          {/* =========================================================================
              ABA 1: PERFIL
             ========================================================================= */}
          {activeTab === 'perfil' && (
            <div className="space-y-5">
              <div>
                <h3 className={`text-base font-extrabold ${textPrimary}`}>Perfil</h3>
                <p className={`text-xs ${textSecondary}`}>Seus dados de acesso e identificação no sistema.</p>
              </div>

              {/* Card de Identificação com Avatar */}
              <div className={`border rounded-2xl p-5 flex items-center gap-4 ${bgCard}`}>
                <div className={`w-14 h-14 rounded-full flex items-center justify-center border shrink-0 ${
                  isDark ? 'bg-zinc-800 border-emerald-500/30 text-purple-300' : 'bg-slate-300 border-slate-400 text-slate-700'
                }`}>
                  <User size={28} />
                </div>
                <div className="min-w-0">
                  <h4 className={`text-base font-extrabold truncate ${textPrimary}`}>
                    {profile.fullName || 'Usuário SyJury'}
                  </h4>
                  <p className={`text-xs truncate ${textSecondary}`}>
                    {isMasked ? '••••••@gmail.com' : profile.email}
                  </p>
                </div>
              </div>

              {/* Formulário de Dados Pessoais */}
              <form onSubmit={handleSaveProfile} className={`border rounded-2xl p-5 sm:p-6 space-y-5 ${bgCard}`}>
                <h4 className={`text-sm font-bold ${textPrimary}`}>Dados pessoais</h4>

                <div>
                  <label className={`block text-xs font-bold mb-1.5 ${textSecondary}`}>Nome completo</label>
                  <div className="relative">
                    <User size={15} className={`absolute left-3.5 top-1/2 -translate-y-1/2 ${textSecondary}`} />
                    <input
                      type="text"
                      value={profile.fullName}
                      onChange={(e) => setProfile(prev => ({ ...prev, fullName: e.target.value }))}
                      placeholder="Seu nome completo"
                      className={`${inputStyle} pl-10`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-xs font-bold mb-1.5 ${textSecondary}`}>E-mail</label>
                    <div className="relative">
                      <Mail size={15} className={`absolute left-3.5 top-1/2 -translate-y-1/2 ${textSecondary}`} />
                      <input
                        type="email"
                        disabled
                        value={isMasked ? '••••••@gmail.com' : profile.email}
                        className={`${inputStyle} pl-10 opacity-70 cursor-not-allowed`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className={`block text-xs font-bold mb-1.5 ${textSecondary}`}>Telefone</label>
                    <div className="flex items-center gap-2">
                      <div className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-xs font-bold shrink-0 ${bgSubtle} ${textPrimary}`}>
                        <span>🇧🇷</span>
                        <span>+55</span>
                      </div>
                      <input
                        type="text"
                        value={isMasked ? '••••••' : profile.phone}
                        onChange={(e) => {
                          if (isMasked) return;
                          setProfile(prev => ({ ...prev, phone: e.target.value }));
                        }}
                        placeholder="88 98888-8888"
                        className={inputStyle}
                      />
                    </div>
                  </div>
                </div>

                <div className="max-w-md">
                  <label className={`block text-xs font-bold mb-1.5 ${textSecondary}`}>Nascimento</label>
                  <div className="relative">
                    <Calendar size={15} className={`absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none ${textSecondary}`} />
                    <input
                      type="date"
                      value={profile.birthDate}
                      onClick={(e) => e.target.showPicker && e.target.showPicker()}
                      onChange={(e) => setProfile(prev => ({ ...prev, birthDate: e.target.value }))}
                      className={`${inputStyle} pl-10 cursor-pointer`}
                    />
                  </div>
                </div>

                <div className={`pt-4 border-t flex justify-end ${borderSubtle}`}>
                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-lg shadow-emerald-950/20 disabled:opacity-50"
                  >
                    {savingProfile ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                    <span>Salvar alterações</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* =========================================================================
              ABA 2: PLANO E ASSINATURA
             ========================================================================= */}
          {activeTab === 'plano' && (
            <div className="space-y-5">
              <div>
                <h3 className={`text-base font-extrabold ${textPrimary}`}>Plano e assinatura</h3>
                <p className={`text-xs ${textSecondary}`}>Seu plano atual e cobrança.</p>
              </div>

              {/* Card Principal do Status do Plano */}
              <div className={`border rounded-2xl p-5 sm:p-6 space-y-4 transition ${
                isActivated
                  ? (isDark
                      ? 'bg-gradient-to-br from-emerald-950/60 via-[#0f291e] to-[#120f1d] border-emerald-500/30 text-white'
                      : 'bg-emerald-50 border-emerald-300 text-emerald-950')
                  : (isDark
                      ? 'bg-gradient-to-br from-amber-950/40 via-[#18132d] to-[#120f1d] border-amber-500/30 text-white'
                      : 'bg-amber-50 border-amber-300 text-slate-900')
              }`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h4 className="text-xl font-black">Plano</h4>
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold border ${
                        isActivated
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                          : 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                      }`}>
                        {isActivated ? 'Ativo' : 'Inativo · Modo Leitura'}
                      </span>
                    </div>
                    <p className={`text-xs mt-1 ${isActivated ? 'text-emerald-200/80' : textSecondary}`}>
                      {isActivated
                        ? 'Aguarde para renovação'
                        : 'Ative sua licença para desbloquear os valores (••••••) e liberar cadastros e edições.'}
                    </p>
                  </div>

                  {!isActivated && onRequireActivation && (
                    <button
                      type="button"
                      onClick={onRequireActivation}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg transition"
                    >
                      <Sparkles size={15} /> Ver Planos
                    </button>
                  )}
                </div>

                <div className={`pt-4 border-t space-y-2 ${isActivated ? 'border-emerald-500/20' : borderSubtle}`}>
                  <div className="flex justify-between items-center text-xs">
                    <span>
                      Válido até <strong>{isActivated ? validUntilFormatted : '—'}</strong>
                    </span>
                    <strong className={isActivated ? 'text-emerald-400' : 'text-amber-500'}>
                      {isActivated ? `faltam ${daysRemaining} dias` : 'Licença pendente'}
                    </strong>
                  </div>

                  <div className={`w-full h-2 rounded-full overflow-hidden ${isDark ? 'bg-black/40' : 'bg-slate-300'}`}>
                    <div
                      className={`h-full transition-all duration-500 ${isActivated ? 'bg-emerald-500' : 'bg-amber-500'}`}
                      style={{ width: `${progressDaysPct}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              {/* Card de Solicitação de Cupom / Chave de Licença */}
              <div className={`border rounded-2xl p-5 sm:p-6 space-y-4 ${bgCard}`}>
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
                    <KeyRound size={18} />
                  </div>
                  <div>
                    <h4 className={`text-sm font-bold ${textPrimary}`}>Chave de Licença / Cupom</h4>
                    <p className={`text-xs ${textSecondary}`}>
                      Insira seu código promocional para solicitar a liberação ou renovação de 30 dias de acesso completo.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleActivateKeySubmit} className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    value={licenseKeyInput}
                    onChange={(e) => setLicenseKeyInput(e.target.value.toUpperCase())}
                    placeholder="DIGITE SEU CÓDIGO AQUI"
                    className={`${inputStyle} flex-1 font-mono uppercase`}
                  />
                  <button
                    type="submit"
                    disabled={activatingKey || !licenseKeyInput.trim()}
                    className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white text-xs font-bold transition shadow-lg shrink-0 disabled:opacity-50"
                  >
                    {activatingKey ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                    <span>Solicitar Ativação</span>
                  </button>
                </form>

                {keyFeedback.text && (
                  <p className={`text-xs font-bold ${
                    keyFeedback.type === 'success' ? 'text-emerald-500' : 'text-red-500'
                  }`}>
                    {keyFeedback.text}
                  </p>
                )}
              </div>

              {/* Card Uso do Plano */}
              <div className={`border rounded-2xl p-5 sm:p-6 space-y-4 ${bgCard}`}>
                <div>
                  <h4 className={`text-sm font-bold ${textPrimary}`}>Uso do plano</h4>
                  <p className={`text-xs ${textSecondary}`}>Limites da sua conta.</p>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <strong className={textPrimary}>Armazenamento de documentos</strong>
                    <span className={textSecondary}>
                      {isMasked ? '••••••' : `${storageUsedMB.toFixed(1).replace('.', ',')} MB de 300 MB`}
                    </span>
                  </div>
                  <div className={`w-full h-2 rounded-full overflow-hidden ${bgSubtle}`}>
                    <div
                      className="h-full bg-emerald-500 transition-all duration-500"
                      style={{ width: `${isMasked ? 0 : Math.min(100, (storageUsedMB / 300) * 100)}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =========================================================================
              ABA 3: MENSAGENS DE WHATSAPP
             ========================================================================= */}
          {activeTab === 'whatsapp' && (
            <div className="space-y-5">
              <div>
                <h3 className={`text-base font-extrabold ${textPrimary}`}>Mensagens de WhatsApp</h3>
                <p className={`text-xs ${textSecondary}`}>
                  Personalize os textos e configure os envios automáticos de cobrança pelo WhatsApp.
                </p>
              </div>

              {/* Sub-abas: Modelos de mensagem | Régua de cobrança */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setWhatsappSubTab('modelos')}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition ${
                    whatsappSubTab === 'modelos'
                      ? (isDark ? 'bg-zinc-900 text-white border-emerald-500/40 shadow' : 'bg-white text-slate-900 border-slate-300 shadow-sm')
                      : `border-transparent ${textSecondary}`
                  }`}
                >
                  <MessageCircle size={14} /> Modelos de mensagem
                </button>
                <button
                  type="button"
                  onClick={() => setWhatsappSubTab('regua')}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition ${
                    whatsappSubTab === 'regua'
                      ? (isDark ? 'bg-zinc-900 text-white border-emerald-500/40 shadow' : 'bg-white text-slate-900 border-slate-300 shadow-sm')
                      : `border-transparent ${textSecondary}`
                  }`}
                >
                  <BellRing size={14} /> Régua de cobrança
                </button>
              </div>

              {whatsappSubTab === 'modelos' ? (
                <>
                  {/* Seletor de Qual Mensagem Editar */}
                  <div className={`border rounded-2xl p-5 space-y-3 ${bgCard}`}>
                    <span className={`text-xs font-bold block ${textPrimary}`}>Qual mensagem editar</span>
                    <div className="flex flex-wrap items-center gap-2">
                      {[
                        { id: 'cobranca', label: 'Cobrança' },
                        { id: 'atraso', label: 'Atraso' },
                        { id: 'recibo', label: 'Recibo' },
                        { id: 'contrato', label: 'Contrato' }
                      ].map(item => {
                        const active = selectedTemplateType === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setSelectedTemplateType(item.id)}
                            className={`px-4 py-1.5 rounded-full text-xs font-bold border transition ${
                              active
                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50 shadow'
                                : `${bgSubtle} ${textSecondary} hover:opacity-80`
                            }`}
                          >
                            {item.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Card do Editor de Texto + Variáveis */}
                  <div className={`border rounded-2xl p-5 sm:p-6 space-y-4 ${bgCard}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setEditorMode('edit')}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
                            editorMode === 'edit'
                              ? `${bgSubtle} ${textPrimary}`
                              : `border-transparent ${textSecondary}`
                          }`}
                        >
                          <Edit3 size={13} /> Editar texto
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditorMode('preview')}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
                            editorMode === 'preview'
                              ? `${bgSubtle} ${textPrimary}`
                              : `border-transparent ${textSecondary}`
                          }`}
                        >
                          <Eye size={13} /> Pré-visualizar
                        </button>
                      </div>

                      <span className={`text-xs font-medium ${textSecondary}`}>
                        {currentTemplateText.length} / 1000 caracteres
                      </span>
                    </div>

                    <p className={`text-xs ${textSecondary}`}>
                      Toque em uma variável para inseri-la no fim do texto. Use *asteriscos* para negrito.
                    </p>

                    {/* 28 Pílulas de Variáveis Dinâmicas */}
                    <div className="flex flex-wrap gap-1.5">
                      {TEMPLATE_VARIABLES.map(variable => (
                        <button
                          key={variable}
                          type="button"
                          onClick={() => handleInsertVariable(variable)}
                          className="px-2.5 py-1 rounded-full text-[11px] font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 transition"
                        >
                          {variable}
                        </button>
                      ))}
                    </div>

                    {/* Área de Texto ou Pré-visualização */}
                    {editorMode === 'edit' ? (
                      <textarea
                        rows={12}
                        maxLength={1000}
                        value={currentTemplateText}
                        onChange={(e) => {
                          if (!checkActivation()) return;
                          const val = e.target.value;
                          setTemplates(prev => ({
                            ...prev,
                            [selectedTemplateType]: val
                          }));
                        }}
                        className={`${inputStyle} font-sans leading-relaxed resize-y`}
                      />
                    ) : (
                      <div className={`border rounded-xl p-4 text-sm whitespace-pre-wrap leading-relaxed ${bgSubtle} ${textPrimary}`}>
                        {renderPreviewText(currentTemplateText)}
                      </div>
                    )}

                    <div className={`pt-4 border-t flex flex-wrap items-center justify-end gap-2.5 ${borderSubtle}`}>
                      <button
                        type="button"
                        onClick={handleRestoreDefaultTemplate}
                        className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl border text-xs font-bold transition ${bgSubtle} ${textSecondary} hover:opacity-80`}
                      >
                        <RotateCcw size={14} /> Restaurar padrão
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveTemplates}
                        disabled={savingTemplates}
                        className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-lg disabled:opacity-50"
                      >
                        {savingTemplates ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        <span>Salvar</span>
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                /* Sub-aba Régua de Cobrança */
                <div className={`border rounded-2xl p-5 sm:p-6 space-y-5 ${bgCard}`}>
                  <div>
                    <h4 className={`text-sm font-bold ${textPrimary}`}>Automação da Régua de Cobrança</h4>
                    <p className={`text-xs ${textSecondary}`}>
                      Defina quando os lembretes devem ser sinalizados para envio.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <label className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer ${bgSubtle}`}>
                      <div>
                        <strong className={`text-xs font-bold block ${textPrimary}`}>Lembrete antes do vencimento</strong>
                        <span className={`text-[11px] ${textSecondary}`}>Enviar aviso preventivo {billingRules.remindBeforeDays} dias antes</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={billingRules.enableBeforeReminder}
                        onChange={(e) => {
                          if (!checkActivation()) return;
                          setBillingRules(prev => ({ ...prev, enableBeforeReminder: e.target.checked }));
                        }}
                        className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                      />
                    </label>

                    <label className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer ${bgSubtle}`}>
                      <div>
                        <strong className={`text-xs font-bold block ${textPrimary}`}>Aviso no dia do vencimento</strong>
                        <span className={`text-[11px] ${textSecondary}`}>Destacar cobrança das parcelas que vencem hoje</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={billingRules.enableDueDateReminder}
                        onChange={(e) => {
                          if (!checkActivation()) return;
                          setBillingRules(prev => ({ ...prev, enableDueDateReminder: e.target.checked }));
                        }}
                        className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                      />
                    </label>

                    <label className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer ${bgSubtle}`}>
                      <div>
                        <strong className={`text-xs font-bold block ${textPrimary}`}>Cobrança de parcelas em atraso</strong>
                        <span className={`text-[11px] ${textSecondary}`}>Incluir cálculo automático de dias em atraso e multa</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={billingRules.enableOverdueReminder}
                        onChange={(e) => {
                          if (!checkActivation()) return;
                          setBillingRules(prev => ({ ...prev, enableOverdueReminder: e.target.checked }));
                        }}
                        className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                      />
                    </label>
                  </div>

                  <div className={`pt-4 border-t flex justify-end ${borderSubtle}`}>
                    <button
                      type="button"
                      onClick={handleSaveTemplates}
                      disabled={savingTemplates}
                      className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-lg"
                    >
                      <Save size={14} /> Salvar Régua
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* =========================================================================
              ABA 4: INTEGRAÇÕES
             ========================================================================= */}
          {activeTab === 'integracoes' && (
            <div className="space-y-5">
              <div>
                <h3 className={`text-base font-extrabold ${textPrimary}`}>Integrações</h3>
                <p className={`text-xs ${textSecondary}`}>Conecte o sistema a outros serviços que você já usa.</p>
                <span className={`text-xs block mt-3 ${textSecondary}`}>0 de 1 integração conectada</span>
              </div>

              <div className={`border rounded-2xl p-5 sm:p-6 max-w-md space-y-5 ${bgCard}`}>
                <div className="flex items-start gap-3.5">
                  <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
                    <MessageCircle size={22} />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className={`text-base font-extrabold ${textPrimary}`}>WhatsApp</h4>
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${bgSubtle} ${textSecondary}`}>
                        Não conectado
                      </span>
                    </div>
                    <p className={`text-xs leading-relaxed ${textSecondary}`}>
                      Envie cobranças, lembretes de vencimento e recibos direto para o WhatsApp do cliente.
                    </p>
                  </div>
                </div>

                {/* Alerta de Risco de Bloqueio */}
                <div className="rounded-xl p-4 border bg-amber-950/30 border-amber-500/30 text-amber-300 space-y-1">
                  <div className="flex items-center gap-2 text-xs font-extrabold text-amber-400">
                    <AlertTriangle size={15} />
                    <span>Atenção ao risco de bloqueio</span>
                  </div>
                  <p className="text-xs text-amber-200/80 leading-relaxed pl-6">
                    Envios automáticos ou em grande volume podem fazer o WhatsApp restringir ou bloquear o seu número.
                  </p>
                </div>

                <div>
                  <button
                    type="button"
                    onClick={() => {
                      if (!checkActivation()) return;
                      window.open('https://wa.me/5588988868432?text=Olá!%20Gostaria%20de%20solicitar%20a%20integração%20automática%20do%20WhatsApp%20no%20SyJury.', '_blank', 'noopener,noreferrer');
                    }}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-bold transition ${bgSubtle} ${textSecondary} hover:text-white hover:border-emerald-500/50`}
                  >
                    <Lock size={14} />
                    <span>Solicite ao suporte</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* =========================================================================
              ABA 5: PAINEL ADMIN RESTRITO (SOMENTE davidnunes520@gmail.com)
             ========================================================================= */}
          {isAdmin && activeTab === 'admin' && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className={`text-base font-extrabold flex items-center gap-2 ${textPrimary}`}>
                    <ShieldCheck size={18} className="text-emerald-400" />
                    <span>Aprovação de Cupões (Admin)</span>
                  </h3>
                  <p className={`text-xs ${textSecondary}`}>
                    Aprove ou recuse solicitações de ativação enviadas pelos utilizadores.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={loadCouponRequests}
                  disabled={loadingRequests}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-bold transition ${bgSubtle} ${textPrimary} hover:opacity-80`}
                >
                  <RefreshCw size={14} className={loadingRequests ? 'animate-spin' : ''} />
                  <span>Atualizar lista</span>
                </button>
              </div>

              <div className={`border rounded-2xl p-5 sm:p-6 space-y-4 ${bgCard}`}>
                {loadingRequests ? (
                  <div className={`py-8 flex items-center justify-center gap-2 text-xs ${textSecondary}`}>
                    <Loader2 size={16} className="animate-spin text-emerald-500" /> Carregando solicitações...
                  </div>
                ) : couponRequests.length === 0 ? (
                  <div className={`py-8 text-center text-xs ${textSecondary}`}>
                    Nenhuma solicitação de cupom encontrada no momento.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {couponRequests.map(req => {
                      const isPending = req.status === 'pending';
                      const isApproved = req.status === 'approved';
                      const isProcessing = processingId === req.id;

                      return (
                        <div
                          key={req.id}
                          className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${bgSubtle}`}
                        >
                          <div className="space-y-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-xs font-black px-2.5 py-0.5 rounded-lg bg-emerald-500/20 text-purple-300 border border-emerald-500/30">
                                {req.coupon_code}
                              </span>
                              <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                                isPending
                                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                                  : isApproved
                                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                  : 'bg-red-500/20 text-red-400 border-red-500/30'
                              }`}>
                                {isPending ? 'Pendente' : isApproved ? 'Aprovado' : 'Recusado'}
                              </span>
                            </div>
                            <p className={`text-xs font-bold truncate ${textPrimary}`}>
                              {req.user_email}
                            </p>
                            <p className={`text-[11px] flex items-center gap-1 ${textSecondary}`}>
                              <Clock size={12} />
                              <span>Solicitado em {formatDateBR(req.created_at)}</span>
                            </p>
                          </div>

                          {isPending && (
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                disabled={isProcessing}
                                onClick={() => handleApproveRequest(req)}
                                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow disabled:opacity-50"
                              >
                                {isProcessing ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                                <span>Aprovar (+30d)</span>
                              </button>
                              <button
                                type="button"
                                disabled={isProcessing}
                                onClick={() => handleRejectRequest(req)}
                                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 text-xs font-bold transition disabled:opacity-50"
                              >
                                <X size={14} />
                                <span>Recusar</span>
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}