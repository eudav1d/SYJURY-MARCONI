import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
  Clock, AlertTriangle, Banknote, CheckCircle2, FileText,
  MessageCircle, ThumbsUp, RotateCcw, Filter, FileDown,
  ChevronLeft, ChevronRight, X, Plus, Trash2, Edit2,
  Info, List, PieChart, TrendingDown, XCircle, ArrowRight,
  Calendar, Loader2
} from 'lucide-react';

function getLocalISODate(dateObj = new Date()) {
  const offset = dateObj.getTimezoneOffset() * 60000;
  return new Date(dateObj.getTime() - offset).toISOString().split('T')[0];
}

export default function Vencimentos({ 
  isDark = false, 
  isActivated = false, 
  hideValues = false,
  onRequireActivation 
}) {
  const [installments, setInstallments] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  const [activeCardFilter, setActiveCardFilter] = useState('a_vencer');
  const [statusPill, setStatusPill] = useState('all');
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [customFilters, setCustomFilters] = useState({
    clientName: '',
    startDate: '',
    endDate: ''
  });

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [selectedContract, setSelectedContract] = useState(null);
  const [detailsTab, setDetailsTab] = useState('dados');
  const [drawerInstFilter, setDrawerInstFilter] = useState('all');

  const [editInstModal, setEditInstModal] = useState({ open: false, installment: null, due_date: '', installment_value: '' });
  const [newInstModal, setNewInstModal] = useState({ open: false, due_date: '', installment_value: '' });
  const [editContractModal, setEditContractModal] = useState({ open: false, cost_value: '', total_value: '', observations: '' });

  const todayStr = getLocalISODate();
  const [payModal, setPayModal] = useState({
    step: 'menu',
    installment: null,
    payment_date: todayStr,
    paid_value: '',
    add_new_installment: true,
    apply_interest_on_remaining: true,
    new_due_date: '',
    new_installment_value: ''
  });

  // Controle central de mascaramento (Soft Paywall ou modo privacidade)
  const isMasked = !isActivated || hideValues;

  // Guardião de Segurança do Soft Paywall
  function checkActivation() {
    if (!isActivated) {
      if (onRequireActivation) onRequireActivation();
      return false;
    }
    return true;
  }

  useEffect(() => {
    fetchAllData();
  }, []);

  async function fetchAllData() {
    setLoading(true);
    try {
      const [instRes, contractsRes, clientsRes] = await Promise.all([
        supabase.from('installments').select('*').order('due_date', { ascending: true }),
        supabase.from('contracts').select('*'),
        supabase.from('clients').select('id, name, phone')
      ]);

      const clientsList = clientsRes.data || [];
      const contractsList = (contractsRes.data || []).map(c => ({
        ...c,
        clients: clientsList.find(cli => cli.id === c.client_id) || null
      }));

      const instRaw = instRes.data || [];
      const enrichedInsts = instRaw.map(inst => {
        const contractObj = contractsList.find(c => c.id === inst.contract_id) || null;
        const clientObj = clientsList.find(cli => cli.id === inst.client_id) || contractObj?.clients || null;
        const sameContractInsts = instRaw.filter(i => i.contract_id === inst.contract_id);
        const pos = sameContractInsts.findIndex(i => i.id === inst.id) + 1;
        const total = sameContractInsts.length;

        return {
          ...inst,
          contract: contractObj,
          client: clientObj,
          parcela_label: inst.installment_number && inst.installment_number.includes('/')
            ? inst.installment_number
            : `${pos}/${total}`,
          parcela_index: pos
        };
      });

      setClients(clientsList);
      setContracts(contractsList);
      setInstallments(enrichedInsts);

      if (selectedContract) {
        const updated = contractsList.find(c => c.id === selectedContract.id);
        if (updated) setSelectedContract(updated);
      }
    } catch (err) {
      console.error('Erro ao carregar vencimentos:', err);
    }
    setLoading(false);
  }

  function calculateRemainingInstallmentValue(inst, paidVal, applyInterest) {
    const baseVal = Number(inst?.installment_value || 0);
    const paidNum = Number(paidVal || 0);
    const remaining = Math.max(0, baseVal - paidNum);
    if (remaining <= 0) return '0.00';

    const contractObj = inst?.contract || selectedContract;
    if (applyInterest && contractObj) {
      const custo = Number(contractObj.cost_value || 0);
      const total = Number(contractObj.total_value || 0);
      const ratePct = contractObj.taxa_type === 'percent' && Number(contractObj.taxa_value) > 0
        ? Number(contractObj.taxa_value)
        : (custo > 0 ? Math.max(0, ((total - custo) / custo) * 100) : 0);

      if (ratePct > 0) {
        return (remaining * (1 + ratePct / 100)).toFixed(2);
      }
    }
    return remaining.toFixed(2);
  }

  function formatDateBR(dateStr) {
    if (!dateStr) return '-';
    return dateStr.split('T')[0].split('-').reverse().join('/');
  }

  function formatCurrency(val) {
    if (isMasked) return '••••••';
    return Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function formatRawCurrency(val) {
    return Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function getDaysLate(dueDateStr) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDateStr + 'T00:00:00');
    const diffTime = today - due;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  }

  const countHoje = installments.filter(i => i.status !== 'Pago' && i.due_date === todayStr).length;
  const countAtrasadas = installments.filter(i => i.status !== 'Pago' && i.due_date < todayStr).length;
  const countAVencer = installments.filter(i => i.status !== 'Pago' && i.due_date > todayStr).length;
  const countRecebidas = installments.filter(i => i.status === 'Pago').length;

  function handleSelectCardFilter(type) {
    setActiveCardFilter(type);
    setCurrentPage(1);
    if (type === 'hoje') {
      setStatusPill('unpaid');
      setCustomFilters({ clientName: '', startDate: todayStr, endDate: todayStr });
    } else {
      setStatusPill('all');
      setCustomFilters({ clientName: '', startDate: '', endDate: '' });
    }
  }

  const baseFilteredInstallments = installments.filter(inst => {
    const isPaid = inst.status === 'Pago';
    if (customFilters.startDate && inst.due_date < customFilters.startDate) return false;
    if (customFilters.endDate && inst.due_date > customFilters.endDate) return false;
    if (customFilters.clientName && !inst.client?.name?.toLowerCase().includes(customFilters.clientName.toLowerCase())) {
      return false;
    }

    if (!customFilters.startDate && !customFilters.endDate) {
      if (activeCardFilter === 'hoje' && (isPaid || inst.due_date !== todayStr)) return false;
      if (activeCardFilter === 'atrasadas' && (isPaid || inst.due_date >= todayStr)) return false;
      if (activeCardFilter === 'a_vencer' && (isPaid || inst.due_date <= todayStr)) return false;
      if (activeCardFilter === 'recebidas' && !isPaid) return false;
    }
    return true;
  });

  const pillAllCount = baseFilteredInstallments.length;
  const pillPaidCount = baseFilteredInstallments.filter(i => i.status === 'Pago').length;
  const pillUnpaidCount = baseFilteredInstallments.filter(i => i.status !== 'Pago').length;

  const finalFilteredInstallments = baseFilteredInstallments.filter(inst => {
    if (statusPill === 'paid') return inst.status === 'Pago';
    if (statusPill === 'unpaid') return inst.status !== 'Pago';
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(finalFilteredInstallments.length / itemsPerPage));
  const paginatedInstallments = finalFilteredInstallments.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const unpaidFiltered = finalFilteredInstallments.filter(i => i.status !== 'Pago');

  const totalEmAbertoBottom = unpaidFiltered
    .reduce((acc, curr) => acc + Number(curr.installment_value || 0), 0);

  // Considera apenas o mínimo/parcela do mês do próximo vencimento de cada contrato,
  // evitando somar todas as parcelas futuras de contratos parcelados
  const firstMonthByContract = {};
  const totalMinimoBottom = unpaidFiltered.reduce((acc, curr) => {
    const contractKey = curr.contract_id || curr.id;
    const instMonth = (curr.due_date || '').slice(0, 7); // Ex.: "2026-12"

    if (activeCardFilter === 'a_vencer' && !customFilters.startDate && !customFilters.endDate) {
      if (!firstMonthByContract[contractKey]) {
        firstMonthByContract[contractKey] = instMonth;
      }
      if (instMonth !== firstMonthByContract[contractKey]) {
        return acc;
      }
    }

    const minVal = Number(curr.minimum_value || curr.contract?.payment_min || 0);
    const valorConsiderado = minVal > 0 ? minVal : Number(curr.installment_value || 0);
    return acc + valorConsiderado;
  }, 0);

  const totalPagoBottom = finalFilteredInstallments
    .filter(i => i.status === 'Pago')
    .reduce((acc, curr) => acc + Number(curr.paid_value ?? curr.installment_value ?? 0), 0);

  async function handleExecutePayment(e) {
    e.preventDefault();
    if (!checkActivation()) return;

    const { step: payStep, installment, payment_date, paid_value, add_new_installment, new_due_date, new_installment_value } = payModal;
    if (!installment) return;
    const { data: { user } } = await supabase.auth.getUser();

    if (payStep === 'total') {
      const { error } = await supabase
        .from('installments')
        .update({
          status: 'Pago',
          paid_value: Number(paid_value || installment.installment_value),
          payment_date
        })
        .eq('id', installment.id);

      if (error) {
        alert('Erro ao registrar pagamento: ' + error.message);
        return;
      }

      if (add_new_installment) {
        const nextDateObj = new Date(installment.due_date + 'T00:00:00');
        nextDateObj.setMonth(nextDateObj.getMonth() + 1);
        const nextDateStr = getLocalISODate(nextDateObj);

        const currentInsts = installments.filter(i => i.contract_id === installment.contract_id);
        const nextNum = currentInsts.length + 1;

        await supabase.from('installments').insert([{
          user_id: user?.id,
          contract_id: installment.contract_id,
          client_id: installment.client_id,
          installment_number: `${nextNum}/${nextNum}`,
          due_date: nextDateStr,
          installment_value: Number(installment.installment_value),
          minimum_value: Number(installment.minimum_value || 0),
          status: nextDateStr === todayStr ? 'Hoje' : (nextDateStr < todayStr ? 'Atrasado' : 'A vencer')
        }]);
      }
    } else if (payStep === 'partial') {
      const paidValNum = Number(paid_value || 0);
      const remaining = Math.max(0, Number(installment.installment_value) - paidValNum);

      await supabase
        .from('installments')
        .update({
          status: 'Pago',
          paid_value: paidValNum,
          payment_date
        })
        .eq('id', installment.id);

      if (add_new_installment && (Number(new_installment_value) > 0 || remaining > 0)) {
        const currentInsts = installments.filter(i => i.contract_id === installment.contract_id);
        const nextNum = currentInsts.length + 1;
        const targetDate = new_due_date || installment.due_date;

        await supabase.from('installments').insert([{
          user_id: user?.id,
          contract_id: installment.contract_id,
          client_id: installment.client_id,
          installment_number: `${nextNum}/${nextNum}`,
          due_date: targetDate,
          installment_value: Number(new_installment_value || remaining),
          minimum_value: Number(installment.minimum_value || 0),
          status: targetDate === todayStr ? 'Hoje' : (targetDate < todayStr ? 'Atrasado' : 'A vencer')
        }]);
      }
    } else if (payStep === 'minimum') {
      const paidMinNum = Number(paid_value || installment.minimum_value || installment.installment_value || 0);

      await supabase
        .from('installments')
        .update({
          status: 'Pago',
          paid_value: paidMinNum,
          payment_date
        })
        .eq('id', installment.id);

      const currentInsts = installments.filter(i => i.contract_id === installment.contract_id);
      const nextNum = currentInsts.length + 1;
      const targetDate = new_due_date || todayStr;

      await supabase.from('installments').insert([{
        user_id: user?.id,
        contract_id: installment.contract_id,
        client_id: installment.client_id,
        installment_number: `${nextNum}/${nextNum}`,
        due_date: targetDate,
        installment_value: Number(new_installment_value || installment.contract?.total_value || installment.installment_value),
        minimum_value: Number(installment.minimum_value || 0),
        status: targetDate === todayStr ? 'Hoje' : (targetDate < todayStr ? 'Atrasado' : 'A vencer')
      }]);
    } else if (payStep === 'reschedule') {
      const newDate = new_due_date || installment.due_date;
      let newStatus = 'A vencer';
      if (newDate === todayStr) newStatus = 'Hoje';
      else if (newDate < todayStr) newStatus = 'Atrasado';

      await supabase
        .from('installments')
        .update({
          due_date: newDate,
          installment_value: Number(new_installment_value || installment.installment_value),
          status: newStatus
        })
        .eq('id', installment.id);
    }

    setPayModal({
      step: 'menu',
      installment: null,
      payment_date: todayStr,
      paid_value: '',
      add_new_installment: true,
      apply_interest_on_remaining: true,
      new_due_date: '',
      new_installment_value: ''
    });
    fetchAllData();
  }

  async function handleUndoPayment(inst) {
    if (!checkActivation()) return;
    if (!confirm('Deseja desfazer o pagamento desta parcela?')) return;

    let revertedStatus = 'A vencer';
    if (inst.due_date === todayStr) revertedStatus = 'Hoje';
    else if (inst.due_date < todayStr) revertedStatus = 'Atrasado';

    const { error } = await supabase
      .from('installments')
      .update({
        status: revertedStatus,
        paid_value: null,
        payment_date: null
      })
      .eq('id', inst.id);

    if (!error) fetchAllData();
  }

  async function handleToggleContractStatus(newStatus) {
    if (!checkActivation()) return;
    if (!selectedContract || selectedContract.status === newStatus) return;

    const { error } = await supabase
      .from('contracts')
      .update({ status: newStatus })
      .eq('id', selectedContract.id);

    if (!error) {
      setSelectedContract(prev => ({ ...prev, status: newStatus }));
      fetchAllData();
    }
  }

  async function handleDeleteInstallment(instId) {
    if (!checkActivation()) return;
    if (!confirm('Deseja excluir esta parcela?')) return;

    const { error } = await supabase.from('installments').delete().eq('id', instId);
    if (!error) fetchAllData();
  }

  async function handleSaveEditInstallment(e) {
    e.preventDefault();
    if (!checkActivation()) return;

    const { installment, due_date, installment_value } = editInstModal;
    if (!installment) return;

    let newStatus = installment.status;
    if (newStatus !== 'Pago') {
      if (due_date === todayStr) newStatus = 'Hoje';
      else if (due_date < todayStr) newStatus = 'Atrasado';
      else newStatus = 'A vencer';
    }

    const { error } = await supabase
      .from('installments')
      .update({
        due_date,
        installment_value: Number(installment_value),
        status: newStatus
      })
      .eq('id', installment.id);

    if (!error) {
      setEditInstModal({ open: false, installment: null, due_date: '', installment_value: '' });
      fetchAllData();
    }
  }

  async function handleAddInstallment(e) {
    e.preventDefault();
    if (!checkActivation()) return;
    if (!selectedContract) return;

    const { data: { user } } = await supabase.auth.getUser();
    const currentInsts = installments.filter(i => i.contract_id === selectedContract.id);
    const nextNum = currentInsts.length + 1;
    let status = 'A vencer';
    if (newInstModal.due_date === todayStr) status = 'Hoje';
    else if (newInstModal.due_date < todayStr) status = 'Atrasado';

    const { error } = await supabase.from('installments').insert([{
      user_id: user?.id,
      contract_id: selectedContract.id,
      client_id: selectedContract.client_id,
      installment_number: `${nextNum}/${nextNum}`,
      due_date: newInstModal.due_date,
      installment_value: Number(newInstModal.installment_value),
      minimum_value: Number(selectedContract.payment_min || 0),
      status
    }]);

    if (!error) {
      setNewInstModal({ open: false, due_date: '', installment_value: '' });
      fetchAllData();
    }
  }

  async function handleSaveContractEdit(e) {
    e.preventDefault();
    if (!checkActivation()) return;
    if (!selectedContract) return;

    const { error } = await supabase
      .from('contracts')
      .update({
        cost_value: Number(editContractModal.cost_value),
        total_value: Number(editContractModal.total_value),
        observations: (editContractModal.observations || '').trim()
      })
      .eq('id', selectedContract.id);

    if (!error) {
      setEditContractModal({ open: false, cost_value: '', total_value: '', observations: '' });
      fetchAllData();
    } else {
      alert('Erro ao atualizar contrato: ' + error.message);
    }
  }

  const contractInstallments = selectedContract
    ? installments.filter(i => i.contract_id === selectedContract.id)
    : [];
  const drawerPaidInsts = contractInstallments.filter(i => i.status === 'Pago');
  const drawerUnpaidInsts = contractInstallments.filter(i => i.status !== 'Pago');
  const drawerOverdueInsts = drawerUnpaidInsts.filter(i => i.due_date < todayStr);

  const drawerTotalCount = contractInstallments.length;
  const drawerPaidCount = drawerPaidInsts.length;
  const drawerProgress = drawerTotalCount > 0 ? Math.round((drawerPaidCount / drawerTotalCount) * 100) : 0;

  const drawerRecebido = drawerPaidInsts.reduce((acc, curr) => acc + Number(curr.paid_value ?? curr.installment_value ?? 0), 0);
  const drawerEmAberto = drawerUnpaidInsts.reduce((acc, curr) => acc + Number(curr.installment_value || 0), 0);
  const drawerEmAtraso = drawerOverdueInsts.reduce((acc, curr) => acc + Number(curr.installment_value || 0), 0);

  const selectedCusto = Number(selectedContract?.cost_value || 0);
  const drawerRentabilidade = drawerRecebido - selectedCusto;
  const drawerRentabilidadePct = selectedCusto > 0 ? ((drawerRentabilidade / selectedCusto) * 100).toFixed(1) : '0.0';
  const taxaAplicadaCalc = selectedCusto > 0
    ? Math.round(((Number(selectedContract?.total_value || 0) - selectedCusto) / selectedCusto) * 100)
    : 0;

  const filteredDrawerInstallments = contractInstallments.filter(i => {
    if (drawerInstFilter === 'paid') return i.status === 'Pago';
    if (drawerInstFilter === 'unpaid') return i.status !== 'Pago';
    return true;
  });

  // Classes Dinâmicas Alinhadas ao Tema Global Suave
  const bgCard = isDark ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-[#f8fafc] border-slate-300/80 text-slate-800 shadow-sm';
  const bgSubtle = isDark ? 'bg-[#121212] border-zinc-800' : 'bg-slate-200/70 border-slate-300';
  const textPrimary = isDark ? 'text-white' : 'text-slate-900';
  const textSecondary = isDark ? 'text-gray-400' : 'text-slate-600';
  const borderSubtle = isDark ? 'border-zinc-800' : 'border-slate-300/80';

  return (
    <div className="space-y-6">
      {/* 4 CARDS SUPERIORES DE RESUMO */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          onClick={() => handleSelectCardFilter('hoje')}
          className={`rounded-2xl border p-5 cursor-pointer transition flex flex-col justify-between ${bgCard} ${
            activeCardFilter === 'hoje' ? 'ring-2 ring-amber-500' : 'hover:border-amber-500/50'
          }`}
        >
          <div className="space-y-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
              isDark ? 'bg-amber-950/60 text-amber-400 border-amber-500/30' : 'bg-amber-100 text-amber-700 border-amber-300'
            }`}>
              <Clock size={20} />
            </div>
            <div>
              <p className={`text-xs font-bold ${textSecondary}`}>Vencem hoje</p>
              <h3 className={`text-2xl font-extrabold mt-0.5 ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
                {isMasked ? '••••••' : countHoje}
              </h3>
            </div>
          </div>
          <div className={`pt-3 mt-4 border-t flex justify-end ${borderSubtle}`}>
            <span className={`text-xs font-bold hover:underline flex items-center gap-1 ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>
              Ver hoje <ArrowRight size={13} />
            </span>
          </div>
        </div>

        <div
          onClick={() => handleSelectCardFilter('atrasadas')}
          className={`rounded-2xl border p-5 cursor-pointer transition flex flex-col justify-between ${bgCard} ${
            activeCardFilter === 'atrasadas' ? 'ring-2 ring-red-500' : 'hover:border-red-500/50'
          }`}
        >
          <div className="space-y-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
              isDark ? 'bg-red-950/60 text-red-400 border-red-500/30' : 'bg-red-100 text-red-700 border-red-300'
            }`}>
              <AlertTriangle size={20} />
            </div>
            <div>
              <p className={`text-xs font-bold ${textSecondary}`}>Atrasadas</p>
              <h3 className={`text-2xl font-extrabold mt-0.5 ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                {isMasked ? '••••••' : countAtrasadas}
              </h3>
            </div>
          </div>
          <div className={`pt-3 mt-4 border-t flex justify-end ${borderSubtle}`}>
            <span className={`text-xs font-bold hover:underline flex items-center gap-1 ${isDark ? 'text-red-400' : 'text-red-700'}`}>
              Ver atrasadas <ArrowRight size={13} />
            </span>
          </div>
        </div>

        <div
          onClick={() => handleSelectCardFilter('a_vencer')}
          className={`rounded-2xl border p-5 cursor-pointer transition flex flex-col justify-between ${bgCard} ${
            activeCardFilter === 'a_vencer' ? 'ring-2 ring-blue-500' : 'hover:border-blue-500/50'
          }`}
        >
          <div className="space-y-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
              isDark ? 'bg-blue-950/60 text-blue-400 border-blue-500/30' : 'bg-blue-100 text-blue-700 border-blue-300'
            }`}>
              <Banknote size={20} />
            </div>
            <div>
              <p className={`text-xs font-bold ${textSecondary}`}>A vencer</p>
              <h3 className={`text-2xl font-extrabold mt-0.5 ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                {isMasked ? '••••••' : countAVencer}
              </h3>
            </div>
          </div>
          <div className={`pt-3 mt-4 border-t flex justify-end ${borderSubtle}`}>
            <span className={`text-xs font-bold hover:underline flex items-center gap-1 ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>
              Ver a vencer <ArrowRight size={13} />
            </span>
          </div>
        </div>

        <div
          onClick={() => handleSelectCardFilter('recebidas')}
          className={`rounded-2xl border p-5 cursor-pointer transition flex flex-col justify-between ${bgCard} ${
            activeCardFilter === 'recebidas' ? 'ring-2 ring-emerald-500' : 'hover:border-emerald-500/50'
          }`}
        >
          <div className="space-y-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
              isDark ? 'bg-emerald-950/60 text-emerald-400 border-emerald-500/30' : 'bg-emerald-100 text-emerald-700 border-emerald-300'
            }`}>
              <CheckCircle2 size={20} />
            </div>
            <div>
              <p className={`text-xs font-bold ${textSecondary}`}>Recebidas</p>
              <h3 className={`text-2xl font-extrabold mt-0.5 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                {isMasked ? '••••••' : countRecebidas}
              </h3>
            </div>
          </div>
          <div className={`pt-3 mt-4 border-t flex justify-end ${borderSubtle}`}>
            <span className={`text-xs font-bold hover:underline flex items-center gap-1 ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
              Ver recebidas <ArrowRight size={13} />
            </span>
          </div>
        </div>
      </div>

      {/* CONTAINER PRINCIPAL DA LISTAGEM DE VENCIMENTOS */}
      <div className={`rounded-2xl border overflow-hidden ${bgCard}`}>
        <div className={`p-4 sm:px-6 border-b flex flex-wrap items-center justify-between gap-3 ${borderSubtle}`}>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setStatusPill('all'); setCurrentPage(1); }}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold border transition ${
                statusPill === 'all'
                  ? (isDark ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' : 'bg-emerald-100 text-emerald-800 border-emerald-400')
                  : `${bgSubtle} ${textSecondary}`
              }`}
            >
              Todos · {pillAllCount}
            </button>
            <button
              onClick={() => { setStatusPill('paid'); setCurrentPage(1); }}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold border transition ${
                statusPill === 'paid'
                  ? (isDark ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' : 'bg-emerald-100 text-emerald-800 border-emerald-400')
                  : `${bgSubtle} ${textSecondary}`
              }`}
            >
              Pagos · {pillPaidCount}
            </button>
            <button
              onClick={() => { setStatusPill('unpaid'); setCurrentPage(1); }}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold border transition ${
                statusPill === 'unpaid'
                  ? (isDark ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' : 'bg-emerald-100 text-emerald-800 border-emerald-400')
                  : `${bgSubtle} ${textSecondary}`
              }`}
            >
              Não Pagos · {pillUnpaidCount}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (!checkActivation()) return;
                alert('A geração de PDF estruturado será ativada na próxima etapa!');
              }}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-bold transition ${bgSubtle} ${textPrimary} hover:opacity-80`}
            >
              <FileDown size={15} /> Exportar
            </button>
            <button
              type="button"
              onClick={() => {
                if (!checkActivation()) return;
                setIsFilterModalOpen(true);
              }}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-bold transition ${bgSubtle} ${textPrimary} hover:opacity-80`}
            >
              <Filter size={15} /> Filtrar
            </button>
          </div>
        </div>

        {(customFilters.startDate || customFilters.endDate || customFilters.clientName) && (
          <div className={`px-4 sm:px-6 py-2.5 border-b flex flex-wrap items-center gap-2 ${borderSubtle}`}>
            <span className={`text-xs font-bold ${textSecondary}`}>Filtros:</span>
            {(customFilters.startDate || customFilters.endDate) && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                Vencimento {formatDateBR(customFilters.startDate || todayStr)} - {formatDateBR(customFilters.endDate || todayStr)}
                <button onClick={() => setCustomFilters(prev => ({ ...prev, startDate: '', endDate: '' }))}>
                  <X size={13} />
                </button>
              </span>
            )}
            {customFilters.clientName && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                Cliente: {customFilters.clientName}
                <button onClick={() => setCustomFilters(prev => ({ ...prev, clientName: '' }))}>
                  <X size={13} />
                </button>
              </span>
            )}
          </div>
        )}

        {loading ? (
          <div className={`py-16 text-center flex items-center justify-center gap-2 text-sm ${textSecondary}`}>
            <Loader2 size={18} className="animate-spin text-emerald-500" /> Carregando vencimentos...
          </div>
        ) : paginatedInstallments.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center gap-3 text-center">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${bgSubtle} ${textSecondary}`}>
              <Calendar size={22} />
            </div>
            <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">Nenhum registro encontrado</p>
          </div>
        ) : (
          <>
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className={`border-b text-[11px] font-bold uppercase tracking-wider ${borderSubtle} ${bgSubtle} ${textSecondary}`}>
                    <th className="py-3.5 px-6">Cliente</th>
                    <th className="py-3.5 px-4">Contrato</th>
                    <th className="py-3.5 px-4">Parcela</th>
                    <th className="py-3.5 px-4">Vencimento</th>
                    <th className="py-3.5 px-4">Valor Parcela</th>
                    <th className="py-3.5 px-4">Mínimo</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Pagamento</th>
                    <th className="py-3.5 px-4">Valor Pago</th>
                    <th className="py-3.5 px-6 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className={`divide-y text-sm ${isDark ? 'divide-zinc-800' : 'divide-slate-200'}`}>
                  {paginatedInstallments.map((inst) => {
                    const clientName = inst.client?.name || 'Cliente';
                    const contractNum = inst.contract?.contract_number || '1';
                    const isPaid = inst.status === 'Pago';
                    const isOverdue = !isPaid && inst.due_date < todayStr;
                    const daysLate = isOverdue ? getDaysLate(inst.due_date) : 0;

                    return (
                      <tr key={inst.id} className={`transition ${isDark ? 'hover:bg-zinc-800/40' : 'hover:bg-slate-200/50'}`}>
                        <td className={`py-4 px-6 font-bold truncate max-w-[220px] ${textPrimary}`}>{clientName}</td>
                        <td className={`py-4 px-4 text-xs font-bold ${textSecondary}`}>#{contractNum}</td>
                        <td className={`py-4 px-4 text-xs font-medium ${textSecondary}`}>{inst.parcela_label}</td>
                        <td className={`py-4 px-4 text-xs font-medium ${textSecondary}`}>{formatDateBR(inst.due_date)}</td>
                        <td className={`py-4 px-4 font-extrabold text-xs ${textPrimary}`}>{formatCurrency(inst.installment_value)}</td>
                        <td className={`py-4 px-4 text-xs ${textSecondary}`}>
                          {inst.minimum_value > 0 ? formatCurrency(inst.minimum_value) : '-'}
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-1.5">
                            {isOverdue && daysLate > 0 && (
                              <span className="text-[11px] font-bold text-red-600 dark:text-red-400">{daysLate}d</span>
                            )}
                            <span className={`whitespace-nowrap px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                              isPaid
                                ? (isDark ? 'bg-emerald-950/60 text-emerald-400 border-emerald-500/30' : 'bg-emerald-100 text-emerald-800 border-emerald-300')
                                : isOverdue
                                ? (isDark ? 'bg-red-950/60 text-red-400 border-red-500/30' : 'bg-red-100 text-red-800 border-red-300')
                                : (isDark ? 'bg-blue-950/60 text-blue-400 border-blue-500/30' : 'bg-blue-100 text-blue-800 border-blue-300')
                            }>`}>
                               {isPaid ? 'Pago' : isOverdue ? 'Atrasado' : 'A vencer'}
                            </span>
                          </div>
                        </td>
                        <td className={`py-4 px-4 text-xs ${textSecondary}`}>
                          {isPaid ? formatDateBR(inst.payment_date) : '-'}
                        </td>
                        <td className={`py-4 px-4 text-xs font-extrabold ${isPaid ? (isDark ? 'text-emerald-400' : 'text-emerald-700') : textSecondary}`}>
                          {isPaid ? formatCurrency(inst.paid_value ?? inst.installment_value) : '-'}
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => {
                                if (inst.contract) {
                                  setSelectedContract(inst.contract);
                                  setDetailsTab('dados');
                                  setDrawerInstFilter('all');
                                }
                              }}
                              className={`p-2 rounded-lg border transition ${bgSubtle} ${textSecondary} hover:text-emerald-600`}
                              title="Ver detalhes do contrato"
                            >
                              <FileText size={15} />
                            </button>

                            <a
                              href={
                                isActivated
                                  ? `https://wa.me/55${(inst.client?.phone || '').replace(/\D/g, '')}?text=Olá%20${encodeURIComponent(clientName)},%20referente%20ao%20contrato%20%23${contractNum}%20(Parcela%20${inst.parcela_label})%20com%20vencimento%20em%20${formatDateBR(inst.due_date)}%20no%20valor%20de%20${encodeURIComponent(formatRawCurrency(inst.installment_value))}.`
                                  : '#'
                              }
                              target={isActivated ? '_blank' : undefined}
                              rel="noreferrer"
                              onClick={(e) => {
                                if (!checkActivation()) {
                                  e.preventDefault();
                                }
                              }}
                              className={`p-2 rounded-lg border transition ${bgSubtle} text-emerald-600 dark:text-emerald-400 hover:bg-emerald-600 hover:text-white`}
                              title="Cobrar no WhatsApp"
                            >
                              <MessageCircle size={15} />
                            </a>

                            {isPaid ? (
                              <button
                                onClick={() => handleUndoPayment(inst)}
                                className={`p-2 rounded-lg border transition ${bgSubtle} text-red-600 dark:text-red-400 hover:bg-red-600 hover:text-white`}
                                title="Desfazer pagamento"
                              >
                                <RotateCcw size={15} />
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  if (!checkActivation()) return;
                                  setPayModal({
                                    step: 'menu',
                                    installment: inst,
                                    payment_date: todayStr,
                                    paid_value: inst.installment_value,
                                    add_new_installment: true,
                                    apply_interest_on_remaining: true,
                                    new_due_date: '',
                                    new_installment_value: inst.installment_value
                                  });
                                }}
                                className={`p-2 rounded-lg border transition ${bgSubtle} ${textSecondary} hover:text-emerald-600`}
                                title="Confirmar pagamento"
                              >
                                <ThumbsUp size={15} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* VISÃO MOBILE */}
            <div className={`lg:hidden divide-y ${isDark ? 'divide-zinc-800' : 'divide-slate-200'}`}>
              {paginatedInstallments.map((inst) => {
                const clientName = inst.client?.name || 'Cliente';
                const contractNum = inst.contract?.contract_number || '1';
                const isPaid = inst.status === 'Pago';
                const isOverdue = !isPaid && inst.due_date < todayStr;
                const daysLate = isOverdue ? getDaysLate(inst.due_date) : 0;

                return (
                  <div key={inst.id} className="p-4 sm:px-6 space-y-3">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <strong className={`text-sm font-bold block ${textPrimary}`}>{clientName}</strong>
                        <span className={`text-xs ${textSecondary}`}>
                          Contrato #{contractNum} - Parcela {inst.parcela_index}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {isOverdue && daysLate > 0 && (
                          <span className="text-xs font-bold text-red-600 dark:text-red-400">{daysLate} dias</span>
                        )}
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                          isPaid
                            ? (isDark ? 'bg-emerald-950/60 text-emerald-400 border-emerald-500/30' : 'bg-emerald-100 text-emerald-800 border-emerald-300')
                            : isOverdue
                            ? (isDark ? 'bg-red-950/60 text-red-400 border-red-500/30' : 'bg-red-100 text-red-800 border-red-300')
                            : (isDark ? 'bg-blue-950/60 text-blue-400 border-blue-500/30' : 'bg-blue-100 text-blue-800 border-blue-300')
                        }`}>
                          {isPaid ? 'Pago' : isOverdue ? 'Atrasado' : 'A vencer'}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className={textSecondary}>Vencimento</span>
                        <strong className={textPrimary}>{formatDateBR(inst.due_date)}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className={textSecondary}>Valor</span>
                        <strong className={textPrimary}>{formatCurrency(inst.installment_value)}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className={textSecondary}>Mínimo</span>
                        <span className={textSecondary}>
                          {inst.minimum_value > 0 ? formatCurrency(inst.minimum_value) : formatCurrency(inst.installment_value)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className={textSecondary}>Pagamento</span>
                        <strong className={textPrimary}>{isPaid ? formatDateBR(inst.payment_date) : '-'}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className={textSecondary}>Pago</span>
                        <strong className={isPaid ? 'text-emerald-600 dark:text-emerald-400 font-bold' : textPrimary}>
                          {isPaid ? formatCurrency(inst.paid_value ?? inst.installment_value) : '-'}
                        </strong>
                      </div>
                    </div>

                    <div className="flex justify-end items-center gap-2 pt-2">
                      <button
                        onClick={() => {
                          if (inst.contract) {
                            setSelectedContract(inst.contract);
                            setDetailsTab('dados');
                            setDrawerInstFilter('all');
                          }
                        }}
                        className={`p-2 rounded-lg border transition ${bgSubtle} ${textSecondary}`}
                      >
                        <FileText size={15} />
                      </button>
                      <a
                        href={
                          isActivated
                            ? `https://wa.me/55${(inst.client?.phone || '').replace(/\D/g, '')}?text=Olá%20${encodeURIComponent(clientName)},%20referente%20ao%20contrato%20%23${contractNum}%20(Parcela%20${inst.parcela_index})%20com%20vencimento%20em%20${formatDateBR(inst.due_date)}.`
                            : '#'
                        }
                        target={isActivated ? '_blank' : undefined}
                        rel="noreferrer"
                        onClick={(e) => {
                          if (!checkActivation()) {
                            e.preventDefault();
                          }
                        }}
                        className={`p-2 rounded-lg border transition ${bgSubtle} text-emerald-600 dark:text-emerald-400`}
                      >
                        <MessageCircle size={15} />
                      </a>
                      {isPaid ? (
                        <button
                          onClick={() => handleUndoPayment(inst)}
                          className={`p-2 rounded-lg border transition ${bgSubtle} text-red-600 dark:text-red-400`}
                        >
                          <RotateCcw size={15} />
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            if (!checkActivation()) return;
                            setPayModal({
                              step: 'menu',
                              installment: inst,
                              payment_date: todayStr,
                              paid_value: inst.installment_value,
                              add_new_installment: true,
                              apply_interest_on_remaining: true,
                              new_due_date: '',
                              new_installment_value: inst.installment_value
                            });
                          }}
                          className={`p-2 rounded-lg border transition ${bgSubtle} ${textSecondary}`}
                        >
                          <ThumbsUp size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        <div className={`p-4 sm:px-6 border-t flex items-center justify-between gap-2 ${borderSubtle}`}>
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl border text-xs font-bold transition disabled:opacity-40 disabled:pointer-events-none ${bgSubtle} ${textPrimary}`}
          >
            <ChevronLeft size={15} /> Anterior
          </button>
          <span className={`text-xs ${textSecondary}`}>
            Página <strong className={textPrimary}>{currentPage}</strong> de <strong className={textPrimary}>{totalPages}</strong>
          </span>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl border text-xs font-bold transition disabled:opacity-40 disabled:pointer-events-none ${bgSubtle} ${textPrimary}`}
          >
            Próximo <ChevronRight size={15} />
          </button>
        </div>
      </div>

      {/* 3 CARDS INFERIORES DE TOTALIZADORES */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className={`rounded-2xl border p-5 ${bgCard}`}>
          <span className={`text-xs font-bold block ${textSecondary}`}>Total em Aberto</span>
          <strong className={`text-xl font-extrabold mt-1 block ${isDark ? 'text-red-400' : 'text-red-600'}`}>
            {formatCurrency(totalEmAbertoBottom)}
          </strong>
        </div>
        <div className={`rounded-2xl border p-5 ${bgCard}`}>
          <span className={`text-xs font-bold block ${textSecondary}`}>Total mínimo</span>
          <strong className={`text-xl font-extrabold mt-1 block ${textPrimary}`}>
            {formatCurrency(totalMinimoBottom)}
          </strong>
        </div>
        <div className={`rounded-2xl border p-5 ${bgCard}`}>
          <span className={`text-xs font-bold block ${textSecondary}`}>Total Pago</span>
          <strong className={`text-xl font-extrabold mt-1 block ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
            {formatCurrency(totalPagoBottom)}
          </strong>
        </div>
      </div>

      {/* GAVETA LATERAL DE DETALHES DO CONTRATO (100% NUVEM + MASCARAMENTO) */}
      {selectedContract && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-end z-50">
          <div className={`w-full sm:max-w-xl h-full flex flex-col shadow-2xl border-l ${
            isDark ? 'bg-[#141418] border-zinc-800 text-white' : 'bg-[#f8fafc] border-slate-300 text-slate-900'
          }`}>
            <div className={`px-6 py-4 border-b flex justify-between items-center shrink-0 ${borderSubtle}`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                  <FileText size={18} />
                </div>
                <div>
                  <h3 className={`text-lg font-extrabold ${textPrimary}`}>#{selectedContract.contract_number || '1'}</h3>
                  <p className={`text-xs ${textSecondary}`}>{selectedContract.clients?.name || 'Cliente'}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedContract(null)}
                className={`p-2 rounded-xl border transition ${bgSubtle} ${textSecondary} hover:opacity-80`}
              >
                <X size={18} />
              </button>
            </div>

            <div className={`px-6 py-3.5 border-b flex items-center justify-between shrink-0 ${borderSubtle}`}>
              <div className={`flex items-center gap-1 p-1 rounded-xl border ${bgSubtle}`}>
                <button
                  onClick={() => setDetailsTab('dados')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    detailsTab === 'dados'
                      ? (isDark ? 'bg-zinc-900 text-white shadow' : 'bg-white text-slate-900 shadow-sm')
                      : textSecondary
                  }`}
                >
                  <Info size={14} /> Dados
                </button>
                <button
                  onClick={() => setDetailsTab('parcelas')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    detailsTab === 'parcelas'
                      ? (isDark ? 'bg-zinc-900 text-white shadow' : 'bg-white text-slate-900 shadow-sm')
                      : textSecondary
                  }`}
                >
                  <List size={14} /> Parcelas
                </button>
              </div>

              <div className={`flex rounded-xl p-0.5 text-xs border ${bgSubtle}`}>
                <button
                  type="button"
                  onClick={() => handleToggleContractStatus('Fechado')}
                  className={`px-3 py-1 rounded-lg font-bold transition ${
                    selectedContract.status === 'Fechado' ? 'bg-slate-600 text-white' : textSecondary
                  }`}
                >
                  Fechado
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleContractStatus('Aberto')}
                  className={`px-3 py-1 rounded-lg font-bold transition ${
                    selectedContract.status === 'Aberto' ? 'bg-emerald-600 text-white shadow' : textSecondary
                  }`}
                >
                  Aberto
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {detailsTab === 'dados' && (
                <>
                  <div>
                    <span className={`text-xs block ${textSecondary}`}>Valor do contrato</span>
                    <h2 className={`text-3xl font-black mt-1 ${textPrimary}`}>
                      {formatCurrency(selectedContract.total_value)}
                    </h2>
                    <div className="mt-4">
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className={textSecondary}>{drawerPaidCount} de {drawerTotalCount} parcelas pagas</span>
                        <strong className="text-emerald-600 dark:text-emerald-400">
                          {isMasked ? '••••••' : `${drawerProgress}%`}
                        </strong>
                      </div>
                      <div className={`w-full h-2 rounded-full overflow-hidden ${isDark ? 'bg-gray-800' : 'bg-slate-300'}`}>
                        <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${isMasked ? 0 : drawerProgress}%` }}></div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className={`rounded-2xl p-4 border ${bgSubtle}`}>
                      <span className={`text-xs block ${textSecondary}`}>Recebido</span>
                      <strong className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400 block mt-1">{formatCurrency(drawerRecebido)}</strong>
                      <span className={`text-[11px] ${textSecondary}`}>{drawerPaidCount} parcelas</span>
                    </div>
                    <div className={`rounded-2xl p-4 border ${bgSubtle}`}>
                      <span className={`text-xs block ${textSecondary}`}>Em aberto</span>
                      <strong className="text-lg font-extrabold text-blue-600 dark:text-blue-400 block mt-1">{formatCurrency(drawerEmAberto)}</strong>
                      <span className={`text-[11px] ${textSecondary}`}>{drawerUnpaidInsts.length} parcelas</span>
                    </div>
                    <div className={`rounded-2xl p-4 border ${bgSubtle}`}>
                      <span className={`text-xs block ${textSecondary}`}>Em atraso</span>
                      <strong className={`text-lg font-extrabold block mt-1 ${textPrimary}`}>{formatCurrency(drawerEmAtraso)}</strong>
                      <span className={`text-[11px] ${textSecondary}`}>{drawerOverdueInsts.length} parcelas</span>
                    </div>
                    <div className={`rounded-2xl p-4 border ${bgSubtle}`}>
                      <span className={`text-xs block ${textSecondary}`}>Rentabilidade</span>
                      <strong className={`text-lg font-extrabold block mt-1 ${drawerRentabilidade >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                        {formatCurrency(drawerRentabilidade)}
                      </strong>
                      <span className={`text-[11px] ${textSecondary}`}>
                        {isMasked ? '••••••' : `${drawerRentabilidade >= 0 ? '+' : ''}${drawerRentabilidadePct.replace('.', ',')}% sobre o custo`}
                      </span>
                    </div>
                  </div>

                  <div>
                    <h4 className={`text-xs font-bold uppercase tracking-wider mb-2 ${textPrimary}`}>Cliente</h4>
                    <div className={`divide-y border-t border-b text-sm ${borderSubtle}`}>
                      <div className="py-2.5 flex justify-between">
                        <span className={textSecondary}>Nome</span>
                        <strong className={textPrimary}>{selectedContract.clients?.name || '-'}</strong>
                      </div>
                      <div className="py-2.5 flex justify-between">
                        <span className={textSecondary}>Telefone</span>
                        <strong className={textPrimary}>
                          {isMasked ? '••••••' : (selectedContract.clients?.phone || '-')}
                        </strong>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className={`text-xs font-bold uppercase tracking-wider mb-2 ${textPrimary}`}>Condições</h4>
                    <div className={`divide-y border-t border-b text-sm ${borderSubtle}`}>
                      <div className="py-2.5 flex justify-between">
                        <span className={textSecondary}>Tipo</span>
                        <strong className={textPrimary}>{selectedContract.tipo === 'Fixo mensal' ? 'Fixo' : selectedContract.tipo}</strong>
                      </div>
                      <div className="py-2.5 flex justify-between">
                        <span className={textSecondary}>Custo do contrato</span>
                        <strong className={textPrimary}>{formatCurrency(selectedContract.cost_value)}</strong>
                      </div>
                      <div className="py-2.5 flex justify-between">
                        <span className={textSecondary}>Taxa aplicada</span>
                        <strong className={textPrimary}>
                          {isMasked
                            ? '••••••'
                            : Number(selectedContract.taxa_value) > 0
                              ? (selectedContract.taxa_type === 'percent' ? `${selectedContract.taxa_value}%` : formatCurrency(selectedContract.taxa_value))
                              : `${taxaAplicadaCalc}%`}
                        </strong>
                      </div>
                      <div className="py-2.5 flex justify-between">
                        <span className={textSecondary}>Pagamento mínimo</span>
                        <strong className={textPrimary}>
                          {contractInstallments[0]?.minimum_value > 0
                            ? formatCurrency(contractInstallments[0].minimum_value)
                            : (Number(selectedContract.payment_min) > 0 ? formatCurrency(selectedContract.payment_min) : '—')}
                        </strong>
                      </div>
                      <div className="py-2.5 flex justify-between">
                        <span className={textSecondary}>Multa por atraso</span>
                        <strong className={textPrimary}>
                          {selectedContract.has_fine && Number(selectedContract.fine_value) > 0 ? formatCurrency(selectedContract.fine_value) : '—'}
                        </strong>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className={`text-xs font-bold uppercase tracking-wider mb-2 ${textPrimary}`}>Observação</h4>
                    <p className={`text-xs whitespace-pre-wrap ${textSecondary}`}>
                      {isMasked ? '••••••' : (selectedContract.observations || 'Nenhuma observação registrada nesse contrato.')}
                    </p>
                  </div>
                </>
              )}

              {detailsTab === 'parcelas' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setDrawerInstFilter('all')}
                        className={`px-3 py-1 rounded-full text-xs font-bold border transition ${
                          drawerInstFilter === 'all'
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/40'
                            : `${bgSubtle} ${textSecondary}`
                        }`}
                      >
                        Todas · {drawerTotalCount}
                      </button>
                      <button
                        onClick={() => setDrawerInstFilter('paid')}
                        className={`px-3 py-1 rounded-full text-xs font-bold border transition ${
                          drawerInstFilter === 'paid'
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/40'
                            : `${bgSubtle} ${textSecondary}`
                        }`}
                      >
                        Pagas · {drawerPaidCount}
                      </button>
                      <button
                        onClick={() => setDrawerInstFilter('unpaid')}
                        className={`px-3 py-1 rounded-full text-xs font-bold border transition ${
                          drawerInstFilter === 'unpaid'
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/40'
                            : `${bgSubtle} ${textSecondary}`
                        }`}
                      >
                        Não pagas · {drawerUnpaidInsts.length}
                      </button>
                    </div>

                    <button
                      onClick={() => {
                        if (!checkActivation()) return;
                        setNewInstModal({ open: true, due_date: todayStr, installment_value: '' });
                      }}
                      className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition shadow"
                    >
                      <Plus size={14} /> Parcela
                    </button>
                  </div>

                  <div className="space-y-3">
                    {filteredDrawerInstallments.map((inst) => {
                      const isPaid = inst.status === 'Pago';
                      const isOverdue = !isPaid && inst.due_date < todayStr;
                      const daysLate = isOverdue ? getDaysLate(inst.due_date) : 0;

                      return (
                        <div key={inst.id} className={`rounded-2xl p-4 border space-y-3 ${bgSubtle}`}>
                          <div className="flex justify-between items-center">
                            <strong className={`text-sm font-bold ${textPrimary}`}>Parcela #{inst.parcela_index}</strong>
                            <div className="flex items-center gap-2">
                              {isOverdue && daysLate > 0 && (
                                <span className="text-xs font-bold text-red-600 dark:text-red-400">{daysLate} dias</span>
                              )}
                              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                                isPaid
                                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                                  : isOverdue
                                  ? 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30'
                                  : 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30'
                              }`}>
                                {isPaid ? 'Pago' : isOverdue ? 'Atrasado' : 'A vencer'}
                              </span>
                            </div>
                          </div>

                          <div className="space-y-1.5 text-xs">
                            <div className="flex justify-between">
                              <span className={textSecondary}>Vencimento</span>
                              <strong className={textPrimary}>{formatDateBR(inst.due_date)}</strong>
                            </div>
                            <div className="flex justify-between">
                              <span className={textSecondary}>Valor</span>
                              <strong className={textPrimary}>{formatCurrency(inst.installment_value)}</strong>
                            </div>
                            <div className="flex justify-between">
                              <span className={textSecondary}>Pagamento</span>
                              <strong className={textPrimary}>{isPaid ? formatDateBR(inst.payment_date) : '-'}</strong>
                            </div>
                            <div className="flex justify-between">
                              <span className={textSecondary}>Pago</span>
                              <strong className={isPaid ? 'text-emerald-600 dark:text-emerald-400 font-bold' : textPrimary}>
                                {isPaid ? formatCurrency(inst.paid_value ?? inst.installment_value) : '-'}
                              </strong>
                            </div>
                          </div>

                          <div className={`pt-3 border-t flex items-center justify-end gap-2 ${borderSubtle}`}>
                            <button
                              onClick={() => handleDeleteInstallment(inst.id)}
                              className={`p-2 rounded-xl border text-red-500 hover:bg-red-500 hover:text-white transition ${bgCard}`}
                            >
                              <Trash2 size={14} />
                            </button>
                            <button
                              onClick={() => {
                                if (!checkActivation()) return;
                                setEditInstModal({
                                  open: true,
                                  installment: inst,
                                  due_date: inst.due_date,
                                  installment_value: inst.installment_value
                                });
                              }}
                              className={`p-2 rounded-xl border transition ${bgCard} ${textSecondary}`}
                            >
                              <Edit2 size={14} />
                            </button>
                            <a
                              href={
                                isActivated
                                  ? `https://wa.me/55${(selectedContract.clients?.phone || '').replace(/\D/g, '')}?text=Olá%20${encodeURIComponent(selectedContract.clients?.name || '')},%20referente%20à%20Parcela%20%23${inst.parcela_index}%20com%20vencimento%20em%20${formatDateBR(inst.due_date)}.`
                                  : '#'
                              }
                              target={isActivated ? '_blank' : undefined}
                              rel="noreferrer"
                              onClick={(e) => {
                                if (!checkActivation()) {
                                  e.preventDefault();
                                }
                              }}
                              className={`p-2 rounded-xl border text-emerald-600 dark:text-emerald-400 hover:bg-emerald-600 hover:text-white transition ${bgCard}`}
                            >
                              <MessageCircle size={14} />
                            </a>
                            {isPaid ? (
                              <button
                                onClick={() => handleUndoPayment(inst)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500 text-red-600 dark:text-red-400 hover:text-white border border-red-500/30 text-xs font-bold transition"
                              >
                                <RotateCcw size={13} /> Desfazer
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  if (!checkActivation()) return;
                                  setPayModal({
                                    step: 'menu',
                                    installment: inst,
                                    payment_date: todayStr,
                                    paid_value: inst.installment_value,
                                    add_new_installment: true,
                                    apply_interest_on_remaining: true,
                                    new_due_date: '',
                                    new_installment_value: inst.installment_value
                                  });
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-600 text-emerald-700 dark:text-emerald-400 hover:text-white border border-emerald-500/30 text-xs font-bold transition"
                              >
                                <ThumbsUp size={13} /> Registrar
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className={`px-6 py-3.5 border-t flex justify-end shrink-0 ${borderSubtle}`}>
              <button
                onClick={() => {
                  if (!checkActivation()) return;
                  setEditContractModal({
                    open: true,
                    cost_value: selectedContract.cost_value,
                    total_value: selectedContract.total_value,
                    observations: selectedContract.observations || ''
                  });
                }}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl border text-xs font-bold transition ${bgSubtle} ${textPrimary}`}
              >
                <Edit2 size={14} /> Editar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL "CONFIRMAR PAGAMENTO" (4 OPÇÕES + JUROS SOBRE SALDO RESTANTE) */}
      {isActivated && payModal.installment && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className={`rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border flex flex-col ${
            isDark ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-[#f8fafc] border-slate-300 text-slate-900'
          }`}>
            <div className={`px-6 py-4 border-b flex justify-between items-center ${borderSubtle}`}>
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <Calendar size={18} />
                </span>
                <h3 className={`text-base font-extrabold ${textPrimary}`}>
                  {payModal.step === 'menu' && 'Confirmar pagamento'}
                  {payModal.step === 'total' && 'Pagamento Total'}
                  {payModal.step === 'partial' && 'Pagamento Parcial'}
                  {payModal.step === 'minimum' && 'Pagamento Mínimo'}
                  {payModal.step === 'reschedule' && 'Reagendar Pagamento'}
                </h3>
              </div>
              <button
                onClick={() => setPayModal(prev => ({ ...prev, installment: null, step: 'menu' }))}
                className={`p-1.5 rounded-lg border transition ${bgSubtle} ${textSecondary}`}
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto max-h-[82vh]">
              <div className={`rounded-2xl p-4 border space-y-2.5 ${bgSubtle}`}>
                <div>
                  <strong className={`text-sm font-bold block ${textPrimary}`}>
                    {payModal.installment.client?.name || selectedContract?.clients?.name || 'Cliente'}
                  </strong>
                  <span className={`text-xs ${textSecondary}`}>
                    Contrato #{payModal.installment.contract?.contract_number || selectedContract?.contract_number || '1'} · Parcela {payModal.installment.parcela_index || ''}
                  </span>
                </div>

                <div className={`divide-y pt-2 text-xs ${borderSubtle}`}>
                  <div className="py-1.5 flex justify-between">
                    <span className={textSecondary}>Vencimento</span>
                    <strong className={textPrimary}>{formatDateBR(payModal.installment.due_date)}</strong>
                  </div>
                  <div className="py-1.5 flex justify-between">
                    <span className={textSecondary}>Valor da parcela</span>
                    <strong className={textPrimary}>{formatCurrency(payModal.installment.installment_value)}</strong>
                  </div>
                  <div className="py-1.5 flex justify-between">
                    <span className={textSecondary}>Valor mínimo</span>
                    <strong className={textPrimary}>
                      {formatCurrency(payModal.installment.minimum_value || payModal.installment.installment_value)}
                    </strong>
                  </div>
                  {payModal.installment.due_date < todayStr && (
                    <div className="py-1.5 flex justify-between">
                      <span className={textSecondary}>Dias em atraso</span>
                      <strong className="text-red-600 dark:text-red-400">{getDaysLate(payModal.installment.due_date)} dias</strong>
                    </div>
                  )}
                </div>
              </div>

              {payModal.step === 'menu' && (
                <div className="space-y-2.5">
                  <button
                    type="button"
                    onClick={() => setPayModal(prev => ({ ...prev, step: 'total', paid_value: prev.installment.installment_value }))}
                    className={`w-full rounded-2xl p-3.5 border flex items-center justify-between transition text-left hover:border-emerald-500 ${bgCard}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                        <CheckCircle2 size={18} />
                      </div>
                      <div>
                        <strong className={`text-xs font-bold block ${textPrimary}`}>Pagamento Total</strong>
                        <span className={`text-[11px] ${textSecondary}`}>Pagar o valor integral da parcela</span>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-emerald-500" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const nextMonth = new Date(payModal.installment.due_date + 'T00:00:00');
                      nextMonth.setMonth(nextMonth.getMonth() + 1);
                      setPayModal(prev => ({
                        ...prev,
                        step: 'partial',
                        paid_value: '',
                        apply_interest_on_remaining: true,
                        new_due_date: getLocalISODate(nextMonth),
                        new_installment_value: ''
                      }));
                    }}
                    className={`w-full rounded-2xl p-3.5 border flex items-center justify-between transition text-left hover:border-blue-500 ${bgCard}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                        <PieChart size={18} />
                      </div>
                      <div>
                        <strong className={`text-xs font-bold block ${textPrimary}`}>Pagamento Parcial</strong>
                        <span className={`text-[11px] ${textSecondary}`}>Pagar um valor e gerar parcela sobre o saldo restante</span>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-blue-500" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const nextMonth = new Date(payModal.installment.due_date + 'T00:00:00');
                      nextMonth.setMonth(nextMonth.getMonth() + 1);
                      setPayModal(prev => ({
                        ...prev,
                        step: 'minimum',
                        paid_value: prev.installment.minimum_value || prev.installment.installment_value,
                        new_due_date: getLocalISODate(nextMonth),
                        new_installment_value: prev.installment.contract?.total_value || prev.installment.installment_value
                      }));
                    }}
                    className={`w-full rounded-2xl p-3.5 border flex items-center justify-between transition text-left hover:border-amber-500 ${bgCard}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                        <TrendingDown size={18} />
                      </div>
                      <div>
                        <strong className={`text-xs font-bold block ${textPrimary}`}>Pagamento Mínimo</strong>
                        <span className={`text-[11px] ${textSecondary}`}>
                          Pagar apenas · {formatCurrency(payModal.installment.minimum_value || payModal.installment.installment_value)}
                        </span>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-amber-500" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setPayModal(prev => ({
                      ...prev,
                      step: 'reschedule',
                      new_due_date: prev.installment.due_date,
                      new_installment_value: prev.installment.installment_value
                    }))}
                    className={`w-full rounded-2xl p-3.5 border flex items-center justify-between transition text-left hover:border-red-500 ${bgCard}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-red-500/15 text-red-600 dark:text-red-400 flex items-center justify-center">
                        <XCircle size={18} />
                      </div>
                      <div>
                        <strong className={`text-xs font-bold block ${textPrimary}`}>Não Pago</strong>
                        <span className={`text-[11px] ${textSecondary}`}>Reagendar esta parcela</span>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-red-500" />
                  </button>
                </div>
              )}

              {payModal.step !== 'menu' && (
                <form onSubmit={handleExecutePayment} className="space-y-4">
                  {payModal.step !== 'reschedule' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={`block text-xs font-bold mb-1 ${textSecondary}`}>Data de pagamento</label>
                        <input
                          type="date"
                          required
                          value={payModal.payment_date}
                          onClick={(e) => e.target.showPicker && e.target.showPicker()}
                          onChange={(e) => setPayModal(prev => ({ ...prev, payment_date: e.target.value }))}
                          className={`w-full rounded-xl border px-3 py-2 text-xs cursor-pointer ${bgSubtle} ${textPrimary}`}
                        />
                      </div>
                      <div>
                        <label className={`block text-xs font-bold mb-1 ${textSecondary}`}>Valor Pago</label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={payModal.paid_value}
                          onChange={(e) => {
                            const val = e.target.value;
                            setPayModal(prev => ({
                              ...prev,
                              paid_value: val,
                              new_installment_value: prev.step === 'partial'
                                ? calculateRemainingInstallmentValue(prev.installment, val, prev.apply_interest_on_remaining)
                                : prev.new_installment_value
                            }));
                          }}
                          className={`w-full rounded-xl border px-3 py-2 text-xs ${bgSubtle} ${textPrimary}`}
                        />
                      </div>
                    </div>
                  )}

                  {(payModal.step === 'total' || payModal.step === 'partial') && (
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          id="toggleAddNext"
                          checked={payModal.add_new_installment}
                          onChange={(e) => setPayModal(prev => ({ ...prev, add_new_installment: e.target.checked }))}
                          className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                        />
                        <label htmlFor="toggleAddNext" className={`text-xs font-semibold cursor-pointer ${textPrimary}`}>
                          Adicionar nova parcela ao contrato?
                        </label>
                      </div>

                      {payModal.step === 'partial' && payModal.add_new_installment && (
                        <div className="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            id="toggleInterestRemainingVenc"
                            checked={payModal.apply_interest_on_remaining}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setPayModal(prev => ({
                                ...prev,
                                apply_interest_on_remaining: checked,
                                new_installment_value: calculateRemainingInstallmentValue(prev.installment, prev.paid_value, checked)
                              }));
                            }}
                            className="w-4 h-4 accent-purple-600 rounded cursor-pointer"
                          />
                          <label htmlFor="toggleInterestRemainingVenc" className={`text-xs font-semibold cursor-pointer ${textSecondary}`}>
                            Aplicar taxa mensal do contrato sobre o saldo restante
                          </label>
                        </div>
                      )}
                    </div>
                  )}

                  {((payModal.step === 'partial' && payModal.add_new_installment) || payModal.step === 'minimum' || payModal.step === 'reschedule') && (
                    <div className="space-y-2 pt-2">
                      <span className={`text-xs font-bold block ${textPrimary}`}>
                        {payModal.step === 'reschedule' ? 'Alteração' : 'Nova parcela sobre saldo restante'}
                      </span>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={`block text-[11px] mb-1 ${textSecondary}`}>Data de vencimento</label>
                          <input
                            type="date"
                            required
                            value={payModal.new_due_date}
                            onClick={(e) => e.target.showPicker && e.target.showPicker()}
                            onChange={(e) => setPayModal(prev => ({ ...prev, new_due_date: e.target.value }))}
                            className={`w-full rounded-xl border px-3 py-2 text-xs cursor-pointer ${bgSubtle} ${textPrimary}`}
                          />
                        </div>
                        <div>
                          <label className={`block text-[11px] mb-1 ${textSecondary}`}>Valor (R$)</label>
                          <input
                            type="number"
                            step="0.01"
                            required
                            value={payModal.new_installment_value}
                            onChange={(e) => setPayModal(prev => ({ ...prev, new_installment_value: e.target.value }))}
                            className={`w-full rounded-xl border px-3 py-2 text-xs ${bgSubtle} ${textPrimary}`}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <div className={`flex justify-end gap-2 pt-3 border-t ${borderSubtle}`}>
                    <button
                      type="button"
                      onClick={() => setPayModal(prev => ({ ...prev, step: 'menu' }))}
                      className={`px-4 py-2 rounded-xl border text-xs font-bold ${bgSubtle} ${textSecondary}`}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow"
                    >
                      <CheckCircle2 size={15} /> Confirmar
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE FILTRO POR PERÍODO E CLIENTE */}
      {isActivated && isFilterModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className={`rounded-2xl p-6 w-full max-w-sm border space-y-4 shadow-2xl ${bgCard}`}>
            <div className="flex justify-between items-center">
              <h4 className={`text-base font-bold ${textPrimary}`}>Filtrar vencimentos</h4>
              <button onClick={() => setIsFilterModalOpen(false)} className={textSecondary}>
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className={`block text-xs font-bold mb-1 ${textSecondary}`}>Cliente</label>
                <input
                  type="text"
                  placeholder="Nome do cliente"
                  value={customFilters.clientName}
                  onChange={(e) => setCustomFilters(prev => ({ ...prev, clientName: e.target.value }))}
                  className={`w-full rounded-xl border px-3.5 py-2 text-xs ${bgSubtle} ${textPrimary}`}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={`block text-xs font-bold mb-1 ${textSecondary}`}>Vencimento inicial</label>
                  <input
                    type="date"
                    value={customFilters.startDate}
                    onClick={(e) => e.target.showPicker && e.target.showPicker()}
                    onChange={(e) => setCustomFilters(prev => ({ ...prev, startDate: e.target.value }))}
                    className={`w-full rounded-xl border px-3 py-2 text-xs cursor-pointer ${bgSubtle} ${textPrimary}`}
                  />
                </div>
                <div>
                  <label className={`block text-xs font-bold mb-1 ${textSecondary}`}>Vencimento final</label>
                  <input
                    type="date"
                    value={customFilters.endDate}
                    onClick={(e) => e.target.showPicker && e.target.showPicker()}
                    onChange={(e) => setCustomFilters(prev => ({ ...prev, endDate: e.target.value }))}
                    className={`w-full rounded-xl border px-3 py-2 text-xs cursor-pointer ${bgSubtle} ${textPrimary}`}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <button
                type="button"
                onClick={() => {
                  setCustomFilters({ clientName: '', startDate: '', endDate: '' });
                  setIsFilterModalOpen(false);
                }}
                className="text-xs font-bold text-red-500 hover:underline"
              >
                Limpar filtros
              </button>
              <button
                type="button"
                onClick={() => {
                  setCurrentPage(1);
                  setIsFilterModalOpen(false);
                }}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mini-modais da Gaveta blindados pelo Soft Paywall */}
      {isActivated && editInstModal.open && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-[70] p-4">
          <form onSubmit={handleSaveEditInstallment} className={`rounded-2xl p-6 w-full max-w-sm border space-y-4 shadow-2xl ${bgCard}`}>
            <h4 className={`text-base font-bold ${textPrimary}`}>Editar parcela</h4>
            <div>
              <label className={`block text-xs font-bold mb-1 ${textSecondary}`}>Vencimento</label>
              <input
                type="date"
                required
                value={editInstModal.due_date}
                onClick={(e) => e.target.showPicker && e.target.showPicker()}
                onChange={(e) => setEditInstModal(prev => ({ ...prev, due_date: e.target.value }))}
                className={`w-full rounded-xl border px-3.5 py-2 text-sm cursor-pointer ${bgSubtle} ${textPrimary}`}
              />
            </div>
            <div>
              <label className={`block text-xs font-bold mb-1 ${textSecondary}`}>Valor (R$)</label>
              <input
                type="number"
                step="0.01"
                required
                value={editInstModal.installment_value}
                onChange={(e) => setEditInstModal(prev => ({ ...prev, installment_value: e.target.value }))}
                className={`w-full rounded-xl border px-3.5 py-2 text-sm ${bgSubtle} ${textPrimary}`}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditInstModal({ open: false, installment: null, due_date: '', installment_value: '' })} className={`px-4 py-2 rounded-xl text-xs font-bold ${bgSubtle} ${textSecondary}`}>Cancelar</button>
              <button type="submit" className="px-5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold">Salvar</button>
            </div>
          </form>
        </div>
      )}

      {isActivated && newInstModal.open && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-[70] p-4">
          <form onSubmit={handleAddInstallment} className={`rounded-2xl p-6 w-full max-w-sm border space-y-4 shadow-2xl ${bgCard}`}>
            <h4 className={`text-base font-bold ${textPrimary}`}>Nova parcela</h4>
            <div>
              <label className={`block text-xs font-bold mb-1 ${textSecondary}`}>Vencimento</label>
              <input
                type="date"
                required
                value={newInstModal.due_date}
                onClick={(e) => e.target.showPicker && e.target.showPicker()}
                onChange={(e) => setNewInstModal(prev => ({ ...prev, due_date: e.target.value }))}
                className={`w-full rounded-xl border px-3.5 py-2 text-sm cursor-pointer ${bgSubtle} ${textPrimary}`}
              />
            </div>
            <div>
              <label className={`block text-xs font-bold mb-1 ${textSecondary}`}>Valor (R$)</label>
              <input
                type="number"
                step="0.01"
                required
                value={newInstModal.installment_value}
                onChange={(e) => setNewInstModal(prev => ({ ...prev, installment_value: e.target.value }))}
                className={`w-full rounded-xl border px-3.5 py-2 text-sm ${bgSubtle} ${textPrimary}`}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setNewInstModal({ open: false, due_date: '', installment_value: '' })} className={`px-4 py-2 rounded-xl text-xs font-bold ${bgSubtle} ${textSecondary}`}>Cancelar</button>
              <button type="submit" className="px-5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold">Adicionar</button>
            </div>
          </form>
        </div>
      )}

      {isActivated && editContractModal.open && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-[70] p-4">
          <form onSubmit={handleSaveContractEdit} className={`rounded-2xl p-6 w-full max-w-sm border space-y-4 shadow-2xl ${bgCard}`}>
            <h4 className={`text-base font-bold ${textPrimary}`}>Editar contrato #{selectedContract?.contract_number}</h4>
            <div>
              <label className={`block text-xs font-bold mb-1 ${textSecondary}`}>Custo (R$)</label>
              <input
                type="number"
                step="0.01"
                required
                value={editContractModal.cost_value}
                onChange={(e) => setEditContractModal(prev => ({ ...prev, cost_value: e.target.value }))}
                className={`w-full rounded-xl border px-3.5 py-2 text-sm ${bgSubtle} ${textPrimary}`}
              />
            </div>
            <div>
              <label className={`block text-xs font-bold mb-1 ${textSecondary}`}>Valor Total (R$)</label>
              <input
                type="number"
                step="0.01"
                required
                value={editContractModal.total_value}
                onChange={(e) => setEditContractModal(prev => ({ ...prev, total_value: e.target.value }))}
                className={`w-full rounded-xl border px-3.5 py-2 text-sm ${bgSubtle} ${textPrimary}`}
              />
            </div>
            <div>
              <label className={`block text-xs font-bold mb-1 ${textSecondary}`}>Observações</label>
              <textarea
                rows="3"
                value={editContractModal.observations}
                onChange={(e) => setEditContractModal(prev => ({ ...prev, observations: e.target.value }))}
                className={`w-full rounded-xl border p-3 text-sm resize-none ${bgSubtle} ${textPrimary}`}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditContractModal({ open: false, cost_value: '', total_value: '', observations: '' })} className={`px-4 py-2 rounded-xl text-xs font-bold ${bgSubtle} ${textSecondary}`}>Cancelar</button>
              <button type="submit" className="px-5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold">Salvar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}