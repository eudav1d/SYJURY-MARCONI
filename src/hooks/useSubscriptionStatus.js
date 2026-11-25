import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

// Chaves mestras de administração/ativação rápida
const VALID_ACTIVATION_KEYS = [
  'SYJURY-PRO-2026',
  'SYJURY-VIP-30D',
  'ADMIN-DAVID-2026'
];

const TRIAL_DURATION_DAYS = 3;
const TOLERANCE_HOURS = 24;

function formatRemainingTime(ms) {
  if (ms <= 0) return '0h';
  const totalHours = Math.ceil(ms / (1000 * 60 * 60));
  if (totalHours < 24) {
    return `${Math.max(1, totalHours)}h`;
  }
  const days = Math.ceil(ms / (1000 * 60 * 60 * 24));
  return `${days} ${days === 1 ? 'dia' : 'dias'}`;
}

export function useSubscriptionStatus(sessionInput = null) {
  const [accessState, setAccessState] = useState('loading'); // loading | trial | active | warning_3d | warning_24h | tolerance_24h | blocked
  const [canWrite, setCanWrite] = useState(false);
  const [isMasked, setIsMasked] = useState(true);
  const [isHardBlocked, setIsHardBlocked] = useState(false);
  const [timeLeftText, setTimeLeftText] = useState('');
  const [toleranceLeftText, setToleranceLeftText] = useState('');
  const [loading, setLoading] = useState(true);

  const [subscriptionInfo, setSubscriptionInfo] = useState({
    status: 'inactive',
    validUntil: null,
    daysRemaining: 0,
    planName: 'Plano Pro'
  });

  const userId = sessionInput?.user?.id || sessionInput?.id || null;

  const checkSubscription = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Valida sempre direto no servidor do Supabase Auth (Anti-Bypass de LocalStorage)
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        setAccessState('blocked');
        setCanWrite(false);
        setIsMasked(true);
        setIsHardBlocked(false);
        setTimeLeftText('');
        setToleranceLeftText('');
        setSubscriptionInfo({
          status: 'inactive',
          validUntil: null,
          daysRemaining: 0,
          planName: 'Demonstração'
        });
        setLoading(false);
        return;
      }

      // 2. Busca na tabela profiles (Fonte da verdade principal)
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('is_activated, subscription_status, subscription_ends_at, activated_coupon, trial_ends_at')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError) {
        console.warn('Aviso ao consultar profile:', profileError.message);
      }

      const meta = user.user_metadata || {};
      const hasProfile = profile !== null && profile !== undefined;

      // Prioriza a tabela profiles para impedir bypass via user_metadata
      const isExplicitlyActivated = hasProfile
        ? Boolean(profile.is_activated)
        : Boolean(meta.is_activated);

      const rawEndsAt = hasProfile
        ? (profile.subscription_ends_at ||
            (profile.is_activated ? (meta.subscription_ends_at || meta.subscription_valid_until) : null))
        : (meta.subscription_ends_at || meta.subscription_valid_until || null);

      const now = Date.now();
      const toleranceWindowMs = TOLERANCE_HOURS * 60 * 60 * 1000;

      // Caso 1: Usuário possui data de expiração de assinatura (ou teste de tolerância)
      if (rawEndsAt) {
        const expTime = new Date(rawEndsAt).getTime();
        const diffMs = expTime - now;
        const diffHours = diffMs / (1000 * 60 * 60);
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        if (diffMs > 0 && isExplicitlyActivated) {
          // Assinatura vigente
          let currentAccessState = 'active';
          if (diffHours <= 24) {
            currentAccessState = 'warning_24h';
          } else if (diffDays <= 3) {
            currentAccessState = 'warning_3d';
          }

          setAccessState(currentAccessState);
          setCanWrite(true);
          setIsMasked(false);
          setIsHardBlocked(false);
          setTimeLeftText(formatRemainingTime(diffMs));
          setToleranceLeftText('');
          setSubscriptionInfo({
            status: 'active',
            validUntil: rawEndsAt,
            daysRemaining: Math.max(1, diffDays),
            planName: meta.plan_name || 'Plano Pro'
          });
        } else {
          // Assinatura vencida ou desativada: 24h de tolerância (Soft Paywall) e depois Hard Paywall
          const isExpiredByDate = diffMs <= 0;
          const timeSinceExpiredMs = isExpiredByDate ? Math.abs(diffMs) : toleranceWindowMs + 1;

          if (timeSinceExpiredMs <= toleranceWindowMs) {
            const tolRemainingMs = toleranceWindowMs - timeSinceExpiredMs;
            setAccessState('tolerance_24h');
            setCanWrite(false);
            setIsMasked(true);
            setIsHardBlocked(false);
            setTimeLeftText('Expirado');
            setToleranceLeftText(formatRemainingTime(tolRemainingMs));
            setSubscriptionInfo({
              status: 'tolerance',
              validUntil: rawEndsAt,
              daysRemaining: 0,
              planName: meta.plan_name || 'Plano Pro'
            });
          } else {
            setAccessState('blocked');
            setCanWrite(false);
            setIsMasked(true);
            setIsHardBlocked(true);
            setTimeLeftText('Expirado');
            setToleranceLeftText('0h');
            setSubscriptionInfo({
              status: 'expired',
              validUntil: rawEndsAt,
              daysRemaining: 0,
              planName: meta.plan_name || 'Plano Pro'
            });
          }
        }
        setLoading(false);
        return;
      }

      // Caso 2: Conta nova sem assinatura prévia -> Janela de 3 dias de Teste Grátis (Trial)
      const trialEndRaw =
        profile?.trial_ends_at ||
        meta.trial_ends_at ||
        (user.created_at
          ? new Date(new Date(user.created_at).getTime() + TRIAL_DURATION_DAYS * 86400000).toISOString()
          : null);

      if (trialEndRaw) {
        const trialExpTime = new Date(trialEndRaw).getTime();
        const trialDiffMs = trialExpTime - now;
        const trialDays = Math.ceil(trialDiffMs / (1000 * 60 * 60 * 24));

        if (trialDiffMs > 0) {
          setAccessState('trial');
          setCanWrite(true);
          setIsMasked(false);
          setIsHardBlocked(false);
          setTimeLeftText(formatRemainingTime(trialDiffMs));
          setToleranceLeftText('');
          setSubscriptionInfo({
            status: 'trial',
            validUntil: trialEndRaw,
            daysRemaining: Math.max(1, trialDays),
            planName: 'Teste Grátis'
          });
          setLoading(false);
          return;
        }

        // Trial encerrado: 24h de tolerância (Soft Paywall) e depois bloqueio total (ActivationModal com cupom)
        const timeSinceTrialExpiredMs = Math.abs(trialDiffMs);

        if (timeSinceTrialExpiredMs <= toleranceWindowMs) {
          const tolRemainingMs = toleranceWindowMs - timeSinceTrialExpiredMs;
          setAccessState('tolerance_24h');
          setCanWrite(false);
          setIsMasked(true);
          setIsHardBlocked(false);
          setTimeLeftText('Trial expirado');
          setToleranceLeftText(formatRemainingTime(tolRemainingMs));
          setSubscriptionInfo({
            status: 'tolerance',
            validUntil: trialEndRaw,
            daysRemaining: 0,
            planName: 'Teste Grátis'
          });
        } else {
          setAccessState('blocked');
          setCanWrite(false);
          setIsMasked(true);
          setIsHardBlocked(true);
          setTimeLeftText('Expirado');
          setToleranceLeftText('0h');
          setSubscriptionInfo({
            status: 'expired',
            validUntil: trialEndRaw,
            daysRemaining: 0,
            planName: 'Teste Grátis'
          });
        }
        setLoading(false);
        return;
      }

      // Caso 3: Fallback sem Trial e sem assinatura -> Bloqueio solicitando ativação
      setAccessState('blocked');
      setCanWrite(false);
      setIsMasked(true);
      setIsHardBlocked(true);
      setTimeLeftText('Inativo');
      setToleranceLeftText('0h');
      setSubscriptionInfo({
        status: 'inactive',
        validUntil: null,
        daysRemaining: 0,
        planName: 'Demonstração'
      });
    } catch (err) {
      console.error('Erro ao verificar status da assinatura:', err);
      setAccessState('tolerance_24h');
      setCanWrite(false);
      setIsMasked(true);
      setIsHardBlocked(false);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    checkSubscription();
  }, [checkSubscription, userId]);

  // Ativa a assinatura via Chave Mestra ou Cupom da tabela promotional_codes
  async function activateSubscription(activationKey, defaultDurationDays = 30) {
    const cleanKey = String(activationKey || '').trim().toUpperCase();
    if (!cleanKey) {
      return { success: false, message: 'Digite uma chave ou código promocional.' };
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, message: 'Sessão expirada. Faça login novamente.' };
      }

      let durationDays = defaultDurationDays;

      // Se não for uma chave mestra, consulta a tabela promotional_codes no Supabase
      if (!VALID_ACTIVATION_KEYS.includes(cleanKey)) {
        const { data: coupon, error: couponError } = await supabase
          .from('promotional_codes')
          .select('*')
          .eq('code', cleanKey)
          .eq('is_active', true)
          .maybeSingle();

        if (couponError || !coupon) {
          return {
            success: false,
            message: 'Chave ou código promocional inválido.'
          };
        }

        if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
          return {
            success: false,
            message: 'Este código promocional já expirou.'
          };
        }

        const currentUses = Number(coupon.times_used || 0);
        if (
          coupon.max_uses !== null &&
          coupon.max_uses !== undefined &&
          currentUses >= Number(coupon.max_uses)
        ) {
          return {
            success: false,
            message: 'Este código atingiu o limite máximo de ativações.'
          };
        }

        await supabase
          .from('promotional_codes')
          .update({ times_used: currentUses + 1 })
          .eq('id', coupon.id);

        durationDays = Number(coupon.duration_days || 30);
      }

      const validUntil = new Date(Date.now() + durationDays * 86400000);
      const validUntilISO = validUntil.toISOString();

      // 1. Atualiza na tabela profiles
      await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          is_activated: true,
          subscription_status: 'active',
          subscription_ends_at: validUntilISO,
          activated_coupon: cleanKey,
          updated_at: new Date().toISOString()
        });

      // 2. Atualiza nos metadados do Supabase Auth
      const { error: authError } = await supabase.auth.updateUser({
        data: {
          is_activated: true,
          subscription_ends_at: validUntilISO,
          subscription_valid_until: validUntilISO,
          activated_coupon: cleanKey,
          activation_key_used: cleanKey,
          plan_name: 'Plano Pro',
          activated_at: new Date().toISOString()
        }
      });

      if (authError) {
        return { success: false, message: 'Erro ao validar no servidor: ' + authError.message };
      }

      await checkSubscription();
      return { success: true, message: `Assinatura ativada por ${durationDays} dias com sucesso!` };
    } catch (err) {
      return { success: false, message: err.message || 'Falha inesperada ao ativar assinatura.' };
    }
  }

  // Coloca a conta em Modo de Tolerância (Soft Paywall) para testar o mascaramento (••••••) e travas
  async function deactivateSubscription() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const expiredOneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

      if (user) {
        await supabase
          .from('profiles')
          .upsert({
            id: user.id,
            is_activated: false,
            subscription_status: 'expired',
            subscription_ends_at: expiredOneHourAgo,
            updated_at: new Date().toISOString()
          });
      }

      const { error } = await supabase.auth.updateUser({
        data: {
          is_activated: false,
          subscription_ends_at: expiredOneHourAgo,
          subscription_valid_until: expiredOneHourAgo
        }
      });

      if (!error) {
        await checkSubscription();
      }
      return { success: !error };
    } catch (err) {
      return { success: false };
    }
  }

  return {
    // Propriedades consumidas pelo App.jsx
    accessState,
    canWrite,
    isMasked,
    isHardBlocked,
    timeLeftText,
    toleranceLeftText,
    refreshSubscription: checkSubscription,

    // Propriedades consumidas pelo Settings.jsx e componentes filhos
    isActivated: canWrite,
    loading,
    subscriptionInfo,
    checkSubscription,
    refreshStatus: checkSubscription,
    activateSubscription,
    deactivateSubscription
  };
}

export default useSubscriptionStatus;