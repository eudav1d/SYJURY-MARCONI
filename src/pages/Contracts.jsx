import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Plus, Trash2, Eye, Share2, Search, X, 
  ChevronLeft, ChevronRight, Loader2, ArrowLeft,
  Info, List, Edit2, RotateCcw, ThumbsUp, MessageCircle,
  CheckCircle2, PieChart, TrendingDown, XCircle, ArrowRight
} from 'lucide-react';

function getLocalISODate(dateObj = new Date()) {
  const offset = dateObj.getTimezoneOffset() * 60000;
  return new Date(dateObj.getTime() - offset).toISOString().split('T')[0];
}

export default function Contracts({ 
  isDark = false, 
  isActivated = false, 
  hideValues = false,
  onRequireActivation, 
  preselectedClient, 
  onClearPreselected 
}) {
  const [contracts, setContracts] = useState([]);
  const [clients, setClients] = useState([]);
  const [allInstallments, setAllInstallments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState('form');

  const [clientSearch, setClientSearch] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [selectedClientObj, setSelectedClientObj] = useState(null);

  const [formData, setFormData] = useState({
    client_id: '',
    tipo: 'Fixo mensal',
    cost_value: '',
    taxa_type: 'percent',
    taxa_value: '',
    total_value: '',
    due_date: '',
    payment_min: '',
    has_fine: false,
    fine_value: '',
    observations: '',
    frequency: 'Mensal',
    installments_count: '1',
    billing_form: ''
  });

  const [previewInstallments, setPreviewInstallments] = useState([]);

  const [selectedContract, setSelectedContract] = useState(null);
  const [detailsTab, setDetailsTab] = useState('dados');
  const [installmentFilter, setInstallmentFilter] = useState('all');

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

  useEffect(() => {
    if (preselectedClient) {
      if (!isActivated) {
        if (onClearPreselected) onClearPreselected();
        if (onRequireActivation) onRequireActivation();
        return;
      }
      setSelectedClientObj(preselectedClient);
      setClientSearch(preselectedClient.name);
      setFormData(prev => ({ ...prev, client_id: preselectedClient.id }));
      setStep('form');
      setIsModalOpen(true);
    }
  }, [preselectedClient, isActivated]);

  async function fetchAllData() {
    setLoading(true);
    try {
      const [contractsRes, clientsRes, instRes] = await Promise.all([
        supabase.from('contracts').select('*').order('created_at', { ascending: false }),
        supabase.from('clients').select('id, name, phone').order('name'),
        supabase.from('installments').select('*').order('due_date', { ascending: true })
      ]);

      const clientsList = clientsRes.data || [];
      const instList = instRes.data || [];
      const contractsList = (contractsRes.data || []).map(c => ({
        ...c,
        clients: clientsList.find(cli => cli.id === c.client_id) || null
      }));

      setClients(clientsList);
      setAllInstallments(instList);
      setContracts(contractsList);

      if (selectedContract) {
        const updated = contractsList.find(c => c.id === selectedContract.id);
        if (updated) setSelectedContract(updated);
      }
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
    }
    setLoading(false);
  }

  useEffect(() => {
    const custo = Number(formData.cost_value || 0);
    const taxa = Number(formData.taxa_value || 0);

    if (custo > 0 && taxa > 0 && formData.tipo === 'Fixo mensal') {
      if (formData.taxa_type === 'percent') {
        const total = custo + (custo * (taxa / 100));
        setFormData(prev => ({ ...prev, total_value: total.toFixed(2) }));
      } else {
        const total = custo + taxa;
        setFormData(prev => ({ ...prev, total_value: total.toFixed(2) }));
      }
    }
  }, [formData.cost_value, formData.taxa_value, formData.taxa_type, formData.tipo]);

  // Cálculo inteligente do saldo restante no Pagamento Parcial (com opção de juros sobre o saldo restante)
  function calculateRemainingInstallmentValue(inst, paidVal, applyInterest, contractObj) {
    const baseVal = Number(inst?.installment_value || 0);
    const paidNum = Number(paidVal || 0);
    const remaining = Math.max(0, baseVal - paidNum);
    if (remaining <= 0) return '0.00';

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

  function handleOpenReview(e) {
    e.preventDefault();
    if (!checkActivation()) return;

    if (!formData.client_id) {
      alert('Selecione um cliente!');
      return;
    }
    if (!formData.cost_value || Number(formData.cost_value) <= 0) {
      alert('Informe o custo (capital investido)!');
      return;
    }
    if (!formData.due_date) {
      alert('Selecione a data do primeiro pagamento!');
      return;
    }
    if (formData.has_fine && (!formData.fine_value || Number(formData.fine_value) <= 0)) {
      alert('Informe o valor da multa por atraso ou desative a opção.');
      return;
    }

    const custo = Number(formData.cost_value);
    const totalVal = Number(formData.total_value || formData.cost_value);
    const count = formData.tipo === 'Parcelado' ? (parseInt(formData.installments_count) || 1) : 1;
    
    let installmentValue = totalVal / count;
    if (formData.tipo === 'Fixo mensal') {
      const lucroTaxa = totalVal - custo;
      installmentValue = lucroTaxa > 0 ? lucroTaxa : totalVal;
    }

    const baseDate = new Date(formData.due_date + 'T00:00:00');
    const tempInstallments = [];

    for (let i = 1; i <= count; i++) {
      let dueDateObj = new Date(baseDate);
      if (formData.frequency === 'Semanal') {
        dueDateObj.setDate(baseDate.getDate() + (i - 1) * 7);
      } else if (formData.frequency === 'Quinzenal') {
        dueDateObj.setDate(baseDate.getDate() + (i - 1) * 15);
      } else if (formData.frequency === 'Diário') {
        dueDateObj.setDate(baseDate.getDate() + (i - 1));
      } else {
        dueDateObj.setMonth(baseDate.getMonth() + (i - 1));
      }
      const dueDateStr = getLocalISODate(dueDateObj);

      tempInstallments.push({
        installment_number: `${i}/${count}`,
        due_date: dueDateStr,
        installment_value: installmentValue.toFixed(2)
      });
    }

    setPreviewInstallments(tempInstallments);
    setStep('review');
  }

  async function handleConfirmCreateContract() {
    if (!checkActivation()) return;

    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const totalVal = Number(formData.total_value || formData.cost_value);

    const { data: contractData, error: contractError } = await supabase
      .from('contracts')
      .insert([{
        user_id: user?.id,
        client_id: formData.client_id,
        tipo: formData.tipo,
        cost_value: Number(formData.cost_value),
        total_value: totalVal,
        taxa_type: formData.taxa_type || 'percent',
        taxa_value: Number(formData.taxa_value || 0),
        payment_min: Number(formData.payment_min || 0),
        has_fine: Boolean(formData.has_fine),
        fine_value: Number(formData.fine_value || 0),
        frequency: formData.frequency || 'Mensal',
        billing_form: formData.billing_form || '',
        observations: (formData.observations || '').trim(),
        status: 'Aberto',
        contract_date: todayStr
      }])
      .select()
      .single();

    if (contractError) {
      alert('Erro ao criar contrato: ' + contractError.message);
      setSaving(false);
      return;
    }

    const installmentsToInsert = previewInstallments.map(inst => {
      let status = 'A vencer';
      if (inst.due_date === todayStr) status = 'Hoje';
      else if (inst.due_date < todayStr) status = 'Atrasado';

      return {
        user_id: user?.id,
        contract_id: contractData.id,
        client_id: formData.client_id,
        installment_number: inst.installment_number,
        due_date: inst.due_date,
        installment_value: Number(inst.installment_value),
        minimum_value: Number(formData.payment_min || 0),
        status: status
      };
    });

    const { error: instError } = await supabase.from('installments').insert(installmentsToInsert);

    setSaving(false);
    if (instError) {
      alert('Erro ao salvar parcelas: ' + instError.message);
    } else {
      setIsModalOpen(false);
      setStep('form');
      setSelectedClientObj(null);
      setClientSearch('');
      setFormData({
        client_id: '',
        tipo: 'Fixo mensal',
        cost_value: '',
        taxa_type: 'percent',
        taxa_value: '',
        total_value: '',
        due_date: '',
        payment_min: '',
        has_fine: false,
        fine_value: '',
        observations: '',
        frequency: 'Mensal',
        installments_count: '1',
        billing_form: ''
      });
      if (onClearPreselected) onClearPreselected();
      fetchAllData();
    }
  }

  async function handleDeleteContract(id) {
    if (!checkActivation()) return;
    if (!confirm('Deseja excluir este contrato e todas as suas parcelas?')) return;

    await supabase.from('installments').delete().eq('contract_id', id);
    const { error } = await supabase.from('contracts').delete().eq('id', id);
    if (!error) {
      if (selectedContract?.id === id) setSelectedContract(null);
      fetchAllData();
    } else {
      alert('Erro ao excluir: ' + error.message);
    }
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
    } else {
      alert('Erro ao alterar status: ' + error.message);
    }
  }

  function handleShareContractWhatsApp(contract) {
    if (!checkActivation()) return;
    const clientName = contract.clients?.name || 'Cliente';
    const phone = (contract.clients?.phone || '').replace(/\D/g, '');
    const url = `https://wa.me/55${phone}?text=Olá%20${encodeURIComponent(clientName)},%20passando%20para%20atualizar%20sobre%20o%20contrato%20%23${contract.contract_number || '1'}.`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  function handleShareInstallmentWhatsApp(inst, idxInAll) {
    if (!checkActivation()) return;
    const clientName = selectedContract?.clients?.name || '';
    const phone = (selectedContract?.clients?.phone || '').replace(/\D/g, '');
    const valFormatted = Number(inst.installment_value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const url = `https://wa.me/55${phone}?text=Olá%20${encodeURIComponent(clientName)},%20referente%20à%20Parcela%20%23${idxInAll}%20com%20vencimento%20em%20${formatDateBR(inst.due_date)}%20no%20valor%20de%20${encodeURIComponent(valFormatted)}.`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

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

        const currentInsts = allInstallments.filter(i => i.contract_id === installment.contract_id);
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
        const currentInsts = allInstallments.filter(i => i.contract_id === installment.contract_id);
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

      const currentInsts = allInstallments.filter(i => i.contract_id === installment.contract_id);
      const nextNum = currentInsts.length + 1;
      const targetDate = new_due_date || todayStr;

      await supabase.from('installments').insert([{
        user_id: user?.id,
        contract_id: installment.contract_id,
        client_id: installment.client_id,
        installment_number: `${nextNum}/${nextNum}`,
        due_date: targetDate,
        installment_value: Number(new_installment_value || selectedContract?.total_value || installment.installment_value),
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

    if (!error) {
      fetchAllData();
    } else {
      alert('Erro ao desfazer pagamento: ' + error.message);
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
    } else {
      alert('Erro ao editar parcela: ' + error.message);
    }
  }

  async function handleAddInstallment(e) {
    e.preventDefault();
    if (!checkActivation()) return;
    if (!selectedContract) return;

    const { data: { user } } = await supabase.auth.getUser();
    const currentInsts = allInstallments.filter(i => i.contract_id === selectedContract.id);
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
    } else {
      alert('Erro ao adicionar parcela: ' + error.message);
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

  function formatDateBR(dateStr) {
    if (!dateStr) return '-';
    return dateStr.split('T')[0].split('-').reverse().join('/');
  }

  // Lógica de Mascaramento (••••••) alinhada ao Soft Paywall e privacidade
  function formatCurrency(val) {
    if (isMasked) return '••••••';
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

  const filteredClientsList = clients.filter(c => 
    c.name.toLowerCase().includes(clientSearch.toLowerCase())
  );

  const filteredContracts = contracts.filter(c => 
    c.clients?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(c.contract_number || '').includes(searchTerm)
  );

  const totalPages = Math.max(1, Math.ceil(filteredContracts.length / itemsPerPage));
  const paginatedContracts = filteredContracts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const custoNum = Number(formData.cost_value || 0);
  const totalNum = Number(formData.total_value || 0);
  const lucroNum = totalNum - custoNum;
  const lucroPct = custoNum > 0 ? ((lucroNum / custoNum) * 100).toFixed(1) : '0.0';

  const contractInstallments = selectedContract
    ? allInstallments.filter(i => i.contract_id === selectedContract.id)
    : [];

  const paidInstallments = contractInstallments.filter(i => i.status === 'Pago');
  const unpaidInstallments = contractInstallments.filter(i => i.status !== 'Pago');
  const overdueInstallments = unpaidInstallments.filter(i => i.due_date < todayStr);

  const totalInstCount = contractInstallments.length;
  const paidInstCount = paidInstallments.length;
  const progressPercent = totalInstCount > 0 ? Math.round((paidInstCount / totalInstCount) * 100) : 0;

  const recebidoTotal = paidInstallments.reduce((acc, curr) => acc + Number(curr.paid_value ?? curr.installment_value ?? 0), 0);
  const emAbertoTotal = unpaidInstallments.reduce((acc, curr) => acc + Number(curr.installment_value || 0), 0);
  const emAtrasoTotal = overdueInstallments.reduce((acc, curr) => acc + Number(curr.installment_value || 0), 0);
  
  const selectedCusto = Number(selectedContract?.cost_value || 0);
  const rentabilidadeValor = recebidoTotal - selectedCusto;
  const rentabilidadePct = selectedCusto > 0 ? ((rentabilidadeValor / selectedCusto) * 100).toFixed(1) : '0.0';

  const taxaAplicadaCalc = selectedCusto > 0 
    ? Math.round(((Number(selectedContract?.total_value || 0) - selectedCusto) / selectedCusto) * 100)
    : 0;

  const filteredDrawerInstallments = contractInstallments.filter(i => {
    if (installmentFilter === 'paid') return i.status === 'Pago';
    if (installmentFilter === 'unpaid') return i.status !== 'Pago';
    return true;
  });

  // Paleta de Cores Sincronizada com o Tema Global
  const bgCard = isDark ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-[#f8fafc] border-slate-300/80 text-slate-800 shadow-sm';
  const bgSubtle = isDark ? 'bg-[#121212] border-zinc-800' : 'bg-slate-200/70 border-slate-300';
  const bgBar = isDark ? 'bg-zinc-900/60' : 'bg-slate-200/40';
  const bgDrawer = isDark ? 'bg-[#121212] border-zinc-800 text-white' : 'bg-[#f8fafc] border-slate-300 text-slate-900';
  const bgDrawerHeader = isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-slate-200/70 border-slate-300';
  const textPrimary = isDark ? 'text-white' : 'text-slate-900';
  const textSecondary = isDark ? 'text-gray-400' : 'text-slate-600';
  const borderSubtle = isDark ? 'border-zinc-800' : 'border-slate-300/80';
  const inputStyle = `w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 transition ${
    isDark ? 'bg-[#121212] border-zinc-800 text-white placeholder-gray-600' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
  }`;

  return (
    <div className="space-y-4">
      {/* Tabela Principal */}
      <div className={`border rounded-2xl sm:rounded-3xl overflow-hidden shadow-xl ${bgCard}`}>
        <div className={`p-4 sm:p-6 border-b flex items-center justify-between gap-3 ${borderSubtle}`}>
          <span className={`border px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold ${
            isDark ? 'bg-[#121212] border-zinc-700 text-zinc-200' : 'bg-emerald-100 border-purple-300 text-purple-800'
          }`}>
            {filteredContracts.length} {filteredContracts.length === 1 ? 'contrato' : 'contratos'}
          </span>

          <button 
            onClick={() => {
              if (!checkActivation()) return;
              if (onClearPreselected) onClearPreselected();
              setSelectedClientObj(null);
              setClientSearch('');
              setStep('form');
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white px-4 sm:px-5 py-2.5 rounded-xl font-bold text-sm transition shadow-lg shadow-purple-900/20 active:scale-95"
          >
            <Plus size={18} />
            <span>Contrato</span>
          </button>
        </div>

        <div className={`p-4 sm:px-6 border-b ${borderSubtle} ${bgBar}`}>
          <div className="relative w-full sm:max-w-xs">
            <Search className={`absolute left-3.5 top-1/2 -translate-y-1/2 ${textSecondary}`} size={16} />
            <input 
              type="text" 
              placeholder="Digite o nome do cliente" 
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className={`w-full border rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-emerald-500 transition ${
                isDark ? 'bg-[#121212] border-zinc-800 text-white placeholder-gray-500' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
              }`}
            />
          </div>
        </div>

        <div className={`hidden md:grid grid-cols-9 px-6 py-3 border-b text-[11px] font-bold uppercase tracking-wider ${borderSubtle} ${bgSubtle} ${textSecondary}`}>
          <span>Data</span>
          <span>Status</span>
          <span>Nº</span>
          <span className="col-span-2">Cliente</span>
          <span>Tipo</span>
          <span>Valor</span>
          <span>Pagamento</span>
          <span className="text-right">Ações</span>
        </div>

        <div className={`divide-y ${isDark ? 'divide-zinc-800' : 'divide-slate-200'}`}>
          {loading ? (
            <div className={`py-12 text-center flex items-center justify-center gap-2 text-sm ${textSecondary}`}>
              <Loader2 size={18} className="animate-spin text-emerald-500" /> Carregando contratos...
            </div>
          ) : paginatedContracts.length === 0 ? (
            <div className={`py-12 text-center text-sm px-4 ${textSecondary}`}>
              Nenhum contrato encontrado.
            </div>
          ) : (
            paginatedContracts.map((contract) => {
              const clientName = contract.clients?.name || 'Cliente Removido';
              const formattedDate = formatDateBR(contract.contract_date);
              const formattedValue = formatCurrency(contract.total_value);
              const cInsts = allInstallments.filter(i => i.contract_id === contract.id);
              const hasOverdue = cInsts.some(i => i.status !== 'Pago' && i.due_date < todayStr);

              return (
                <div key={contract.id} className={`p-4 sm:px-6 transition flex flex-col md:grid md:grid-cols-9 items-start md:items-center gap-3 ${
                  isDark ? 'hover:bg-zinc-800/40' : 'hover:bg-slate-200/50'
                }`}>
                  <div className={`text-xs font-medium ${textSecondary}`}>
                    <span className="md:hidden mr-2">Data:</span>
                    {formattedDate}
                  </div>
                  <div>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
                      contract.status === 'Aberto' 
                        ? (isDark ? 'bg-emerald-950/40 text-emerald-400 border-emerald-500/30' : 'bg-emerald-100 text-emerald-800 border-emerald-300')
                        : (isDark ? 'bg-gray-800 text-gray-300 border-gray-700' : 'bg-slate-300 text-slate-700 border-slate-400')
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${contract.status === 'Aberto' ? 'bg-emerald-500' : 'bg-gray-500'}`}></span>
                      {contract.status}
                    </span>
                  </div>
                  <div className={`font-extrabold text-sm ${textPrimary}`}>
                    <span className={`md:hidden font-normal mr-2 ${textSecondary}`}>Nº:</span>
                    #{contract.contract_number || '1'}
                  </div>
                  <div className="col-span-2 flex items-center gap-2.5 min-w-0">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs border shrink-0 ${
                      isDark ? 'bg-emerald-950 text-emerald-400 border-emerald-500/30' : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    }`}>
                      {clientName.charAt(0).toUpperCase()}
                    </div>
                    <span className={`font-bold text-sm truncate ${textPrimary}`}>{clientName}</span>
                  </div>
                  <div>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${bgSubtle} ${textPrimary}`}>
                      {contract.tipo === 'Fixo mensal' ? 'Fixo' : contract.tipo}
                    </span>
                  </div>
                  <div className={`font-extrabold text-sm ${textPrimary}`}>
                    {formattedValue}
                  </div>
                  <div>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                      hasOverdue
                        ? (isDark ? 'bg-red-950/40 text-red-400 border-red-500/30' : 'bg-red-100 text-red-800 border-red-300')
                        : (isDark ? 'bg-indigo-950/40 text-indigo-300 border-indigo-500/30' : 'bg-indigo-100 text-indigo-800 border-indigo-300')
                    }`}>
                      {hasOverdue ? 'Atrasado' : 'Em dia'}
                    </span>
                  </div>
                  <div className={`flex items-center gap-1.5 md:justify-end w-full md:w-auto pt-2 md:pt-0 border-t md:border-t-0 ${borderSubtle}`}>
                    <button 
                      type="button"
                      onClick={() => handleDeleteContract(contract.id)}
                      className={`p-2 rounded-lg transition border ${bgSubtle} ${textSecondary} hover:bg-red-600 hover:text-white`}
                      title="Excluir contrato"
                    >
                      <Trash2 size={15} />
                    </button>
                    <button 
                      type="button"
                      onClick={() => handleShareContractWhatsApp(contract)}
                      className={`p-2 rounded-lg transition border ${bgSubtle} ${textSecondary} hover:bg-emerald-600 hover:text-white`}
                      title="Compartilhar no WhatsApp"
                    >
                      <Share2 size={15} />
                    </button>
                    <button 
                      type="button"
                      onClick={() => {
                        setSelectedContract(contract);
                        setDetailsTab('dados');
                        setInstallmentFilter('all');
                      }}
                      className={`p-2 rounded-lg transition border ${bgSubtle} ${textSecondary} hover:bg-emerald-600 hover:text-white`}
                      title="Ver detalhes do contrato"
                    >
                      <Eye size={15} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className={`p-4 sm:px-6 border-t flex items-center justify-between gap-2 ${borderSubtle} ${bgBar}`}>
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl border text-xs sm:text-sm font-bold disabled:opacity-40 disabled:pointer-events-none transition ${bgSubtle} ${textPrimary}`}
          >
            <ChevronLeft size={16} /> Anterior
          </button>
          <span className={`text-xs sm:text-sm ${textSecondary}`}>
            Página <strong className={textPrimary}>{currentPage}</strong> de <strong className={textPrimary}>{totalPages}</strong>
          </span>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl border text-xs sm:text-sm font-bold disabled:opacity-40 disabled:pointer-events-none transition ${bgSubtle} ${textPrimary}`}
          >
            Próximo <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* =========================================================================
          GAVETA DE DETALHES DO CONTRATO (COM MASCARAMENTO E TRAVAS SOFT PAYWALL)
         ========================================================================= */}
      {selectedContract && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex justify-end z-50">
          <div className={`border-l w-full sm:max-w-xl h-full flex flex-col shadow-2xl ${bgDrawer}`}>
            
            <div className={`px-6 py-4 border-b flex justify-between items-center shrink-0 ${bgDrawerHeader}`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl border flex items-center justify-center font-bold ${
                  isDark ? 'bg-emerald-950/60 border-emerald-500/30 text-emerald-400' : 'bg-emerald-100 border-emerald-300 text-emerald-800'
                }`}>
                  📄
                </div>
                <div>
                  <h3 className={`text-lg font-extrabold ${textPrimary}`}>#{selectedContract.contract_number || '1'}</h3>
                  <p className={`text-xs ${textSecondary}`}>{selectedContract.clients?.name || 'Cliente'}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedContract(null)}
                className={`p-2 rounded-xl border transition ${bgSubtle} ${textSecondary}`}
              >
                <X size={18} />
              </button>
            </div>

            <div className={`px-6 py-3.5 border-b flex items-center justify-between shrink-0 ${borderSubtle}`}>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setDetailsTab('dados')}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold border transition ${
                    detailsTab === 'dados'
                      ? (isDark ? 'bg-[#121212] text-white border-emerald-500/40 shadow' : 'bg-emerald-100 text-purple-800 border-purple-300 shadow-sm')
                      : `border-transparent ${textSecondary}`
                  }`}
                >
                  <Info size={14} /> Dados
                </button>
                <button
                  onClick={() => setDetailsTab('parcelas')}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold border transition ${
                    detailsTab === 'parcelas'
                      ? (isDark ? 'bg-[#121212] text-white border-emerald-500/40 shadow' : 'bg-emerald-100 text-purple-800 border-purple-300 shadow-sm')
                      : `border-transparent ${textSecondary}`
                  }`}
                >
                  <List size={14} /> Parcelas
                </button>
              </div>

              <div className={`flex border rounded-xl p-0.5 text-xs ${bgSubtle}`}>
                <button
                  type="button"
                  onClick={() => handleToggleContractStatus('Fechado')}
                  className={`px-3 py-1 rounded-lg font-bold transition ${
                    selectedContract.status === 'Fechado'
                      ? 'bg-slate-600 text-white'
                      : textSecondary
                  }`}
                >
                  Fechado
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleContractStatus('Aberto')}
                  className={`px-3 py-1 rounded-lg font-bold transition ${
                    selectedContract.status === 'Aberto'
                      ? 'bg-emerald-600 text-white shadow'
                      : textSecondary
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
                        <span className={textSecondary}>{paidInstCount} de {totalInstCount} parcelas pagas</span>
                        <strong className="text-emerald-600 dark:text-emerald-400">
                          {isMasked ? '••••••' : `${progressPercent}%`}
                        </strong>
                      </div>
                      <div className={`w-full h-2 rounded-full overflow-hidden ${isDark ? 'bg-[#121212]' : 'bg-slate-300'}`}>
                        <div 
                          className="h-full bg-emerald-500 transition-all duration-500"
                          style={{ width: `${isMasked ? 0 : progressPercent}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className={`border rounded-2xl p-4 ${bgSubtle}`}>
                      <span className={`text-xs block ${textSecondary}`}>Recebido</span>
                      <strong className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400 block mt-1">
                        {formatCurrency(recebidoTotal)}
                      </strong>
                      <span className={`text-[11px] ${textSecondary}`}>{paidInstCount} parcelas</span>
                    </div>

                    <div className={`border rounded-2xl p-4 ${bgSubtle}`}>
                      <span className={`text-xs block ${textSecondary}`}>Em aberto</span>
                      <strong className="text-lg font-extrabold text-blue-600 dark:text-blue-400 block mt-1">
                        {formatCurrency(emAbertoTotal)}
                      </strong>
                      <span className={`text-[11px] ${textSecondary}`}>{unpaidInstallments.length} parcelas</span>
                    </div>

                    <div className={`border rounded-2xl p-4 ${bgSubtle}`}>
                      <span className={`text-xs block ${textSecondary}`}>Em atraso</span>
                      <strong className={`text-lg font-extrabold block mt-1 ${textPrimary}`}>
                        {formatCurrency(emAtrasoTotal)}
                      </strong>
                      <span className={`text-[11px] ${textSecondary}`}>{overdueInstallments.length} parcelas</span>
                    </div>

                    <div className={`border rounded-2xl p-4 ${bgSubtle}`}>
                      <span className={`text-xs block ${textSecondary}`}>Rentabilidade</span>
                      <strong className={`text-lg font-extrabold block mt-1 ${rentabilidadeValor >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                        {formatCurrency(rentabilidadeValor)}
                      </strong>
                      <span className={`text-[11px] ${textSecondary}`}>
                        {isMasked ? '••••••' : `${rentabilidadeValor >= 0 ? '+' : ''}${rentabilidadePct.replace('.', ',')}% sobre o custo`}
                      </span>
                    </div>
                  </div>

                  <div>
                    <h4 className={`text-xs font-bold uppercase tracking-wider mb-2 ${textPrimary}`}>Cliente</h4>
                    <div className={`divide-y border-t border-b text-sm ${borderSubtle} ${isDark ? 'divide-zinc-800' : 'divide-slate-200'}`}>
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
                    <div className={`divide-y border-t border-b text-sm ${borderSubtle} ${isDark ? 'divide-zinc-800' : 'divide-slate-200'}`}>
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
                      <div className="py-2.5 flex justify-between">
                        <span className={textSecondary}>Cobrança</span>
                        <strong className={textPrimary}>
                          {selectedContract.tipo === 'Fixo mensal' ? 'Contínuo' : (selectedContract.frequency || 'Parcelado')}
                        </strong>
                      </div>
                      <div className="py-2.5 flex justify-between">
                        <span className={textSecondary}>Criado em</span>
                        <strong className={textPrimary}>{formatDateBR(selectedContract.contract_date)}</strong>
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
                        onClick={() => setInstallmentFilter('all')}
                        className={`px-3 py-1 rounded-full text-xs font-bold border transition ${
                          installmentFilter === 'all'
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/40'
                            : `${bgSubtle} ${textSecondary}`
                        }`}
                      >
                        Todas · {totalInstCount}
                      </button>
                      <button
                        onClick={() => setInstallmentFilter('paid')}
                        className={`px-3 py-1 rounded-full text-xs font-bold border transition ${
                          installmentFilter === 'paid'
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/40'
                            : `${bgSubtle} ${textSecondary}`
                        }`}
                      >
                        Pagas · {paidInstCount}
                      </button>
                      <button
                        onClick={() => setInstallmentFilter('unpaid')}
                        className={`px-3 py-1 rounded-full text-xs font-bold border transition ${
                          installmentFilter === 'unpaid'
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/40'
                            : `${bgSubtle} ${textSecondary}`
                        }`}
                      >
                        Não pagas · {unpaidInstallments.length}
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
                    {filteredDrawerInstallments.length === 0 ? (
                      <div className={`text-center py-8 text-xs ${textSecondary}`}>
                        Nenhuma parcela neste filtro.
                      </div>
                    ) : (
                      filteredDrawerInstallments.map((inst) => {
                        const idxInAll = contractInstallments.findIndex(i => i.id === inst.id) + 1;
                        const isPaid = inst.status === 'Pago';
                        const isOverdue = !isPaid && inst.due_date < todayStr;
                        const daysLate = isOverdue ? getDaysLate(inst.due_date) : 0;

                        return (
                          <div key={inst.id} className={`border rounded-2xl p-4 space-y-3 ${bgSubtle}`}>
                            <div className="flex justify-between items-center">
                              <strong className={`text-sm font-bold ${textPrimary}`}>Parcela #{idxInAll}</strong>
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
                                type="button"
                                onClick={() => handleDeleteInstallment(inst.id)}
                                className={`p-2 rounded-xl border text-red-500 hover:bg-red-600 hover:text-white transition ${bgCard}`}
                                title="Excluir parcela"
                              >
                                <Trash2 size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (!checkActivation()) return;
                                  setEditInstModal({
                                    open: true,
                                    installment: inst,
                                    due_date: inst.due_date,
                                    installment_value: inst.installment_value
                                  });
                                }}
                                className={`p-2 rounded-xl border transition ${bgCard} ${textSecondary} hover:text-emerald-600`}
                                title="Editar parcela"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleShareInstallmentWhatsApp(inst, idxInAll)}
                                className={`p-2 rounded-xl border text-emerald-600 dark:text-emerald-400 hover:bg-emerald-600 hover:text-white transition ${bgCard}`}
                                title="Enviar mensagem no WhatsApp"
                              >
                                <MessageCircle size={14} />
                              </button>

                              {isPaid ? (
                                <button
                                  type="button"
                                  onClick={() => handleUndoPayment(inst)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-600 text-red-600 dark:text-red-400 hover:text-white border border-red-500/30 text-xs font-bold transition"
                                >
                                  <RotateCcw size={13} /> Desfazer
                                </button>
                              ) : (
                                <button
                                  type="button"
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
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-600 text-emerald-700 dark:text-emerald-400 hover:text-white border border-emerald-500/40 text-xs font-bold transition"
                                >
                                  <ThumbsUp size={13} /> Registrar
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className={`px-6 py-3.5 border-t flex justify-end shrink-0 ${bgDrawerHeader}`}>
              <button
                type="button"
                onClick={() => {
                  if (!checkActivation()) return;
                  setEditContractModal({
                    open: true,
                    cost_value: selectedContract.cost_value,
                    total_value: selectedContract.total_value,
                    observations: selectedContract.observations || ''
                  });
                }}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border transition ${bgSubtle} ${textPrimary}`}
              >
                <Edit2 size={14} /> Editar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL DE PAGAMENTO COM AS 4 OPÇÕES + JUROS SOBRE SALDO RESTANTE
         ========================================================================= */}
      {isActivated && payModal.installment && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className={`border rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col ${bgDrawer}`}>
            
            <div className={`px-6 py-4 border-b flex justify-between items-center ${bgDrawerHeader}`}>
              <div className="flex items-center gap-2.5">
                <span className="text-emerald-600 dark:text-emerald-400">
                  {payModal.step === 'menu' && <CheckCircle2 size={20} />}
                  {payModal.step === 'total' && <CheckCircle2 size={20} />}
                  {payModal.step === 'partial' && <PieChart size={20} />}
                  {payModal.step === 'minimum' && <TrendingDown size={20} />}
                  {payModal.step === 'reschedule' && <XCircle size={20} />}
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

            <div className="p-6 space-y-5 overflow-y-auto max-h-[80vh]">
              <div className={`border rounded-2xl p-4 space-y-2.5 ${bgSubtle}`}>
                <div className="flex justify-between items-start text-xs">
                  <div>
                    <strong className={`block font-bold text-sm ${textPrimary}`}>{selectedContract?.clients?.name}</strong>
                    <span className={textSecondary}>Contrato #{selectedContract?.contract_number || '1'} · Parcela</span>
                  </div>
                  {payModal.installment.due_date < todayStr && (
                    <span className="bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30 px-2.5 py-0.5 rounded-full font-bold">
                      {getDaysLate(payModal.installment.due_date)} dias
                    </span>
                  )}
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
                    <strong className={textPrimary}>{formatCurrency(payModal.installment.minimum_value || payModal.installment.installment_value)}</strong>
                  </div>
                </div>
              </div>

              {payModal.step === 'menu' && (
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => setPayModal(prev => ({ ...prev, step: 'total', paid_value: prev.installment.installment_value }))}
                    className={`w-full border hover:border-emerald-500 rounded-2xl p-4 flex items-center justify-between transition text-left ${bgCard}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                        <CheckCircle2 size={18} />
                      </div>
                      <div>
                        <strong className={`text-sm block ${textPrimary}`}>Pagamento Total</strong>
                        <span className={`text-xs ${textSecondary}`}>Pagar o valor integral da parcela</span>
                      </div>
                    </div>
                    <ArrowRight size={16} className="text-emerald-500" />
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
                    className={`w-full border hover:border-emerald-500 rounded-2xl p-4 flex items-center justify-between transition text-left ${bgCard}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-500/30">
                        <PieChart size={18} />
                      </div>
                      <div>
                        <strong className={`text-sm block ${textPrimary}`}>Pagamento Parcial</strong>
                        <span className={`text-xs ${textSecondary}`}>Pagar um valor e gerar parcela sobre o saldo restante</span>
                      </div>
                    </div>
                    <ArrowRight size={16} className="text-blue-500" />
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
                        new_installment_value: selectedContract?.total_value || prev.installment.installment_value
                      }));
                    }}
                    className={`w-full border hover:border-amber-500 rounded-2xl p-4 flex items-center justify-between transition text-left ${bgCard}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/30">
                        <TrendingDown size={18} />
                      </div>
                      <div>
                        <strong className={`text-sm block ${textPrimary}`}>Pagamento Mínimo</strong>
                        <span className={`text-xs ${textSecondary}`}>Pagar apenas · {formatCurrency(payModal.installment.minimum_value || payModal.installment.installment_value)}</span>
                      </div>
                    </div>
                    <ArrowRight size={16} className="text-amber-500" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setPayModal(prev => ({ ...prev, step: 'reschedule', new_due_date: prev.installment.due_date, new_installment_value: prev.installment.installment_value }))}
                    className={`w-full border hover:border-red-500 rounded-2xl p-4 flex items-center justify-between transition text-left ${bgCard}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-red-500/15 text-red-600 dark:text-red-400 flex items-center justify-center border border-red-500/30">
                        <XCircle size={18} />
                      </div>
                      <div>
                        <strong className={`text-sm block ${textPrimary}`}>Não Pago</strong>
                        <span className={`text-xs ${textSecondary}`}>Reagendar esta parcela</span>
                      </div>
                    </div>
                    <ArrowRight size={16} className="text-red-500" />
                  </button>
                </div>
              )}

              {payModal.step !== 'menu' && (
                <form onSubmit={handleExecutePayment} className="space-y-4">
                  {payModal.step !== 'reschedule' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={`block text-xs uppercase font-bold mb-1 ${textSecondary}`}>Data de pagamento</label>
                        <input
                          type="date"
                          required
                          value={payModal.payment_date}
                          onClick={(e) => e.target.showPicker && e.target.showPicker()}
                          onChange={(e) => setPayModal(prev => ({ ...prev, payment_date: e.target.value }))}
                          className={`w-full border rounded-xl px-3.5 py-2.5 text-sm cursor-pointer ${bgSubtle} ${textPrimary}`}
                        />
                      </div>
                      <div>
                        <label className={`block text-xs uppercase font-bold mb-1 ${textSecondary}`}>Valor Pago</label>
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
                                ? calculateRemainingInstallmentValue(prev.installment, val, prev.apply_interest_on_remaining, selectedContract)
                                : prev.new_installment_value
                            }));
                          }}
                          className={`w-full border rounded-xl px-3.5 py-2.5 text-sm ${bgSubtle} ${textPrimary}`}
                        />
                      </div>
                    </div>
                  )}

                  {(payModal.step === 'total' || payModal.step === 'partial') && (
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          id="addNewContractInst"
                          checked={payModal.add_new_installment}
                          onChange={(e) => setPayModal(prev => ({ ...prev, add_new_installment: e.target.checked }))}
                          className="w-4 h-4 rounded accent-emerald-500 cursor-pointer"
                        />
                        <label htmlFor="addNewContractInst" className={`text-xs font-bold cursor-pointer ${textPrimary}`}>
                          Adicionar nova parcela ao contrato?
                        </label>
                      </div>

                      {payModal.step === 'partial' && payModal.add_new_installment && (
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            id="applyInterestRemaining"
                            checked={payModal.apply_interest_on_remaining}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setPayModal(prev => ({
                                ...prev,
                                apply_interest_on_remaining: checked,
                                new_installment_value: calculateRemainingInstallmentValue(prev.installment, prev.paid_value, checked, selectedContract)
                              }));
                            }}
                            className="w-4 h-4 rounded accent-purple-600 cursor-pointer"
                          />
                          <label htmlFor="applyInterestRemaining" className={`text-xs font-bold cursor-pointer ${textSecondary}`}>
                            Aplicar taxa mensal do contrato sobre o saldo restante
                          </label>
                        </div>
                      )}
                    </div>
                  )}

                  {((payModal.step === 'partial' && payModal.add_new_installment) || payModal.step === 'minimum' || payModal.step === 'reschedule') && (
                    <div className={`border rounded-2xl p-4 space-y-3 ${bgSubtle}`}>
                      <span className={`text-xs font-bold uppercase tracking-wider block ${textPrimary}`}>
                        {payModal.step === 'reschedule' ? 'Alteração da parcela' : 'Nova parcela sobre saldo restante'}
                      </span>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={`block text-[10px] uppercase font-bold mb-1 ${textSecondary}`}>Data de vencimento</label>
                          <input
                            type="date"
                            required
                            value={payModal.new_due_date}
                            onClick={(e) => e.target.showPicker && e.target.showPicker()}
                            onChange={(e) => setPayModal(prev => ({ ...prev, new_due_date: e.target.value }))}
                            className={`w-full border rounded-xl px-3 py-2 text-xs cursor-pointer ${bgCard} ${textPrimary}`}
                          />
                        </div>
                        <div>
                          <label className={`block text-[10px] uppercase font-bold mb-1 ${textSecondary}`}>Valor (R$)</label>
                          <input
                            type="number"
                            step="0.01"
                            required
                            value={payModal.new_installment_value}
                            onChange={(e) => setPayModal(prev => ({ ...prev, new_installment_value: e.target.value }))}
                            className={`w-full border rounded-xl px-3 py-2 text-xs ${bgCard} ${textPrimary}`}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <div className={`flex justify-end gap-2 pt-3 border-t ${borderSubtle}`}>
                    <button
                      type="button"
                      onClick={() => setPayModal(prev => ({ ...prev, step: 'menu' }))}
                      className={`px-5 py-2.5 rounded-xl text-xs font-bold border ${bgSubtle} ${textSecondary}`}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow"
                    >
                      <CheckCircle2 size={16} /> Confirmar
                    </button>
                  </div>
                </form>
              )}

            </div>
          </div>
        </div>
      )}

      {/* Mini-modais de apoio blindados pelo Soft Paywall */}
      {isActivated && editInstModal.open && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4">
          <form onSubmit={handleSaveEditInstallment} className={`border rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-2xl ${bgCard}`}>
            <h4 className={`text-base font-bold ${textPrimary}`}>Editar parcela</h4>
            <div>
              <label className={`block text-xs uppercase font-bold mb-1 ${textSecondary}`}>Vencimento</label>
              <input
                type="date"
                required
                value={editInstModal.due_date}
                onClick={(e) => e.target.showPicker && e.target.showPicker()}
                onChange={(e) => setEditInstModal(prev => ({ ...prev, due_date: e.target.value }))}
                className={`w-full border rounded-xl px-3.5 py-2.5 text-sm cursor-pointer ${bgSubtle} ${textPrimary}`}
              />
            </div>
            <div>
              <label className={`block text-xs uppercase font-bold mb-1 ${textSecondary}`}>Valor da parcela (R$)</label>
              <input
                type="number"
                step="0.01"
                required
                value={editInstModal.installment_value}
                onChange={(e) => setEditInstModal(prev => ({ ...prev, installment_value: e.target.value }))}
                className={`w-full border rounded-xl px-3.5 py-2.5 text-sm ${bgSubtle} ${textPrimary}`}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditInstModal({ open: false, installment: null, due_date: '', installment_value: '' })}
                className={`px-4 py-2 rounded-xl text-xs font-bold ${bgSubtle} ${textSecondary}`}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
              >
                Salvar
              </button>
            </div>
          </form>
        </div>
      )}

      {isActivated && newInstModal.open && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4">
          <form onSubmit={handleAddInstallment} className={`border rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-2xl ${bgCard}`}>
            <h4 className={`text-base font-bold ${textPrimary}`}>Nova parcela</h4>
            <div>
              <label className={`block text-xs uppercase font-bold mb-1 ${textSecondary}`}>Data de vencimento</label>
              <input
                type="date"
                required
                value={newInstModal.due_date}
                onClick={(e) => e.target.showPicker && e.target.showPicker()}
                onChange={(e) => setNewInstModal(prev => ({ ...prev, due_date: e.target.value }))}
                className={`w-full border rounded-xl px-3.5 py-2.5 text-sm cursor-pointer ${bgSubtle} ${textPrimary}`}
              />
            </div>
            <div>
              <label className={`block text-xs uppercase font-bold mb-1 ${textSecondary}`}>Valor (R$)</label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="0,00"
                value={newInstModal.installment_value}
                onChange={(e) => setNewInstModal(prev => ({ ...prev, installment_value: e.target.value }))}
                className={`w-full border rounded-xl px-3.5 py-2.5 text-sm ${bgSubtle} ${textPrimary}`}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setNewInstModal({ open: false, due_date: '', installment_value: '' })}
                className={`px-4 py-2 rounded-xl text-xs font-bold ${bgSubtle} ${textSecondary}`}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
              >
                Adicionar
              </button>
            </div>
          </form>
        </div>
      )}

      {isActivated && editContractModal.open && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4">
          <form onSubmit={handleSaveContractEdit} className={`border rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-2xl ${bgCard}`}>
            <h4 className={`text-base font-bold ${textPrimary}`}>Editar contrato #{selectedContract?.contract_number}</h4>
            <div>
              <label className={`block text-xs uppercase font-bold mb-1 ${textSecondary}`}>Custo do contrato (R$)</label>
              <input
                type="number"
                step="0.01"
                required
                value={editContractModal.cost_value}
                onChange={(e) => setEditContractModal(prev => ({ ...prev, cost_value: e.target.value }))}
                className={`w-full border rounded-xl px-3.5 py-2.5 text-sm ${bgSubtle} ${textPrimary}`}
              />
            </div>
            <div>
              <label className={`block text-xs uppercase font-bold mb-1 ${textSecondary}`}>Valor do contrato (R$)</label>
              <input
                type="number"
                step="0.01"
                required
                value={editContractModal.total_value}
                onChange={(e) => setEditContractModal(prev => ({ ...prev, total_value: e.target.value }))}
                className={`w-full border rounded-xl px-3.5 py-2.5 text-sm ${bgSubtle} ${textPrimary}`}
              />
            </div>
            <div>
              <label className={`block text-xs uppercase font-bold mb-1 ${textSecondary}`}>Observação</label>
              <textarea
                rows="3"
                value={editContractModal.observations}
                onChange={(e) => setEditContractModal(prev => ({ ...prev, observations: e.target.value }))}
                className={`w-full border rounded-xl p-3 text-sm resize-none ${bgSubtle} ${textPrimary}`}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditContractModal({ open: false, cost_value: '', total_value: '', observations: '' })}
                className={`px-4 py-2 rounded-xl text-xs font-bold ${bgSubtle} ${textSecondary}`}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
              >
                Salvar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal de Novo Contrato blindado pelo Soft Paywall */}
      {isActivated && isModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex justify-end z-50">
          <div className={`border-l w-full sm:max-w-xl h-full flex flex-col shadow-2xl ${bgDrawer}`}>
            
            <div className={`px-6 py-5 border-b flex justify-between items-center shrink-0 ${bgDrawerHeader}`}>
              <div className="flex items-center gap-3">
                {step === 'review' && (
                  <button onClick={() => setStep('form')} className={`${textSecondary} hover:opacity-80 transition`}>
                    <ArrowLeft size={20} />
                  </button>
                )}
                <div>
                  <h3 className={`text-xl font-extrabold ${textPrimary}`}>
                    {step === 'review' ? 'Revisar parcelas' : 'Novo contrato'}
                  </h3>
                  <p className={`text-xs ${textSecondary}`}>
                    {step === 'review' ? 'Confira as parcelas geradas antes de criar.' : 'Defina cliente, valores e a forma de cobrança.'}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className={`p-2 rounded-xl border transition ${bgSubtle} ${textSecondary}`}
              >
                <X size={18} />
              </button>
            </div>

            {step === 'form' && (
              <form id="contract-form" onSubmit={handleOpenReview} className="flex-1 overflow-y-auto p-6 space-y-5">
                
                <div className="relative">
                  <label className={`block text-xs uppercase font-bold mb-1.5 ${textSecondary}`}>Cliente</label>
                  {selectedClientObj ? (
                    <div className={`flex justify-between items-center border rounded-xl px-4 py-3 ${bgSubtle}`}>
                      <span className={`font-bold text-sm ${textPrimary}`}>{selectedClientObj.name}</span>
                      <button 
                        type="button" 
                        onClick={() => { setSelectedClientObj(null); setFormData(prev => ({...prev, client_id: ''})); }}
                        className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-bold"
                      >
                        Trocar
                      </button>
                    </div>
                  ) : (
                    <div>
                      <input
                        type="text"
                        placeholder="Buscar cliente pelo nome"
                        value={clientSearch}
                        onChange={(e) => {
                          setClientSearch(e.target.value);
                          setShowClientDropdown(true);
                        }}
                        onFocus={() => setShowClientDropdown(true)}
                        className={inputStyle}
                      />
                      {showClientDropdown && clientSearch && (
                        <div className={`absolute left-0 right-0 mt-1 border rounded-xl shadow-2xl z-30 max-h-48 overflow-y-auto ${bgCard}`}>
                          {filteredClientsList.length === 0 ? (
                            <div className={`p-3 text-xs text-center ${textSecondary}`}>Nenhum cliente encontrado</div>
                          ) : (
                            filteredClientsList.map(c => (
                              <div
                                key={c.id}
                                onClick={() => {
                                  setSelectedClientObj(c);
                                  setFormData(prev => ({ ...prev, client_id: c.id }));
                                  setClientSearch(c.name);
                                  setShowClientDropdown(false);
                                }}
                                className={`px-4 py-2.5 text-sm font-medium cursor-pointer transition border-b last:border-0 ${borderSubtle} ${textPrimary} hover:bg-emerald-500/10`}
                              >
                                {c.name}
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className={`block text-xs uppercase font-bold mb-1.5 ${textSecondary}`}>Tipo de contrato</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, tipo: 'Fixo mensal' }))}
                      className={`py-2.5 rounded-xl text-sm font-bold border transition ${
                        formData.tipo === 'Fixo mensal'
                          ? (isDark ? 'bg-purple-950/80 text-purple-300 border-emerald-500 shadow' : 'bg-emerald-100 text-purple-800 border-purple-400 shadow-sm')
                          : `${bgSubtle} ${textSecondary}`
                      }`}
                    >
                      📅 Fixo mensal
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, tipo: 'Parcelado' }))}
                      className={`py-2.5 rounded-xl text-sm font-bold border transition ${
                        formData.tipo === 'Parcelado'
                          ? (isDark ? 'bg-purple-950/80 text-purple-300 border-emerald-500 shadow' : 'bg-emerald-100 text-purple-800 border-purple-400 shadow-sm')
                          : `${bgSubtle} ${textSecondary}`
                      }`}
                    >
                      📊 Parcelado
                    </button>
                  </div>
                </div>

                <div>
                  <label className={`block text-xs uppercase font-bold mb-1.5 ${textSecondary}`}>Custo (capital investido)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.cost_value}
                    onChange={(e) => setFormData(prev => ({ ...prev, cost_value: e.target.value }))}
                    placeholder="$ 0,00"
                    required
                    className={inputStyle}
                  />
                </div>

                {formData.tipo === 'Fixo mensal' && (
                  <>
                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <label className={`block text-xs uppercase font-bold ${textSecondary}`}>Taxa</label>
                        <div className={`flex border rounded-lg p-0.5 text-xs ${bgSubtle}`}>
                          <button
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, taxa_type: 'percent' }))}
                            className={`px-2.5 py-1 rounded-md font-bold transition ${formData.taxa_type === 'percent' ? 'bg-emerald-600 text-white' : textSecondary}`}
                          >
                            % Taxa
                          </button>
                          <button
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, taxa_type: 'value' }))}
                            className={`px-2.5 py-1 rounded-md font-bold transition ${formData.taxa_type === 'value' ? 'bg-emerald-600 text-white' : textSecondary}`}
                          >
                            $ Valor
                          </button>
                        </div>
                      </div>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.taxa_value}
                        onChange={(e) => setFormData(prev => ({ ...prev, taxa_value: e.target.value }))}
                        placeholder={formData.taxa_type === 'percent' ? '0' : '0,00'}
                        className={inputStyle}
                      />
                      {formData.total_value && (
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 font-bold">
                          Valor total a receber: {formatCurrency(formData.total_value)}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className={`block text-xs uppercase font-bold mb-1.5 ${textSecondary}`}>Data do 1º pagamento</label>
                      <input
                        type="date"
                        value={formData.due_date}
                        onClick={(e) => e.target.showPicker && e.target.showPicker()}
                        onChange={(e) => setFormData(prev => ({ ...prev, due_date: e.target.value }))}
                        required
                        className={`${inputStyle} cursor-pointer`}
                      />
                    </div>

                    <div>
                      <label className={`block text-xs uppercase font-bold mb-1.5 ${textSecondary}`}>Pagamento mínimo</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.payment_min}
                        onChange={(e) => setFormData(prev => ({ ...prev, payment_min: e.target.value }))}
                        placeholder="0,00"
                        className={inputStyle}
                      />
                    </div>
                  </>
                )}

                {formData.tipo === 'Parcelado' && (
                  <>
                    <div>
                      <label className={`block text-xs uppercase font-bold mb-1.5 ${textSecondary}`}>Valor total a receber</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.total_value}
                        onChange={(e) => setFormData(prev => ({ ...prev, total_value: e.target.value }))}
                        placeholder="$ 0,00"
                        required
                        className={inputStyle}
                      />
                    </div>

                    <div>
                      <label className={`block text-xs uppercase font-bold mb-1.5 ${textSecondary}`}>Frequência dos pagamentos</label>
                      <select
                        value={formData.frequency}
                        onChange={(e) => setFormData(prev => ({ ...prev, frequency: e.target.value }))}
                        className={inputStyle}
                      >
                        <option value="Mensal">Mensal</option>
                        <option value="Semanal">Semanal</option>
                        <option value="Quinzenal">Quinzenal</option>
                        <option value="Diário">Diário</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={`block text-xs uppercase font-bold mb-1.5 ${textSecondary}`}>Data 1ª parcela</label>
                        <input
                          type="date"
                          value={formData.due_date}
                          onClick={(e) => e.target.showPicker && e.target.showPicker()}
                          onChange={(e) => setFormData(prev => ({ ...prev, due_date: e.target.value }))}
                          required
                          className={`${inputStyle} cursor-pointer`}
                        />
                      </div>
                      <div>
                        <label className={`block text-xs uppercase font-bold mb-1.5 ${textSecondary}`}>Qtd. parcelas</label>
                        <input
                          type="number"
                          min="1"
                          max="48"
                          value={formData.installments_count}
                          onChange={(e) => setFormData(prev => ({ ...prev, installments_count: e.target.value }))}
                          placeholder="0"
                          required
                          className={inputStyle}
                        />
                      </div>
                    </div>

                    <div>
                      <label className={`block text-xs uppercase font-bold mb-1.5 ${textSecondary}`}>Forma de cobrança</label>
                      <select
                        value={formData.billing_form}
                        onChange={(e) => setFormData(prev => ({ ...prev, billing_form: e.target.value }))}
                        className={inputStyle}
                      >
                        <option value="">Selecione a forma de cobrança</option>
                        <option value="Dias semana (Seg à Sex)">Dias semana (Seg à Sex)</option>
                        <option value="Dias úteis (Seg à Sáb)">Dias úteis (Seg à Sáb)</option>
                        <option value="Todos os dias (Seg à Dom)">Todos os dias (Seg à Dom)</option>
                      </select>
                    </div>
                  </>
                )}

                <div className={`border rounded-2xl p-4 space-y-3 ${bgSubtle}`}>
                  <div className="flex justify-between items-center">
                    <div>
                      <p className={`text-sm font-bold ${textPrimary}`}>Multa por atraso</p>
                      <p className={`text-xs ${textSecondary}`}>Cobrada a cada dia após o vencimento.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={formData.has_fine}
                        onChange={(e) => setFormData(prev => ({ ...prev, has_fine: e.target.checked }))}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-500 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                    </label>
                  </div>

                  {formData.has_fine && (
                    <div className={`space-y-2 pt-2 border-t ${borderSubtle}`}>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.fine_value}
                        onChange={(e) => setFormData(prev => ({ ...prev, fine_value: e.target.value }))}
                        placeholder="Valor da multa"
                        className={inputStyle}
                      />
                      {!formData.fine_value && (
                        <p className="text-xs text-red-500 font-bold">Informe o valor da multa ou desligue a opção.</p>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className={`block text-xs uppercase font-bold mb-1.5 ${textSecondary}`}>Observações</label>
                  <textarea
                    rows="3"
                    maxLength={400}
                    value={formData.observations}
                    onChange={(e) => setFormData(prev => ({ ...prev, observations: e.target.value }))}
                    placeholder="Opcional"
                    className={`${inputStyle} resize-none`}
                  ></textarea>
                </div>

                {totalNum > 0 && (
                  <div className={`border rounded-2xl p-4 space-y-2 ${bgSubtle}`}>
                    <span className="text-xs uppercase font-extrabold text-emerald-600 dark:text-emerald-400 tracking-wider block">Resumo do contrato</span>
                    <div className="flex justify-between items-baseline">
                      <span className={`text-xs ${textSecondary}`}>Total a receber</span>
                      <strong className={`text-xl font-black ${textPrimary}`}>
                        {formatCurrency(totalNum)}
                      </strong>
                    </div>
                    <div className={`flex justify-between text-xs pt-1 border-t ${borderSubtle}`}>
                      <span className={textSecondary}>Lucro estimado</span>
                      <strong className="text-emerald-600 dark:text-emerald-400 font-bold">
                        {formatCurrency(lucroNum)} ({isMasked ? '••••••' : `${lucroPct.replace('.', ',')}%`})
                      </strong>
                    </div>
                  </div>
                )}
              </form>
            )}

            {step === 'review' && (
              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                <p className={`text-xs p-3 rounded-xl border font-medium ${
                  isDark ? 'text-purple-300 bg-zinc-800/50 border-zinc-700' : 'text-purple-800 bg-emerald-100 border-purple-300'
                }`}>
                  Confira as parcelas geradas. Você pode alterar a data de vencimento e o valor de cada parcela antes de criar o contrato.
                </p>

                <div className="space-y-3">
                  {previewInstallments.map((inst, index) => (
                    <div key={index} className={`border rounded-2xl p-4 flex items-center justify-between gap-3 ${bgSubtle}`}>
                      <span className={`w-6 h-6 rounded-full font-bold text-xs flex items-center justify-center shrink-0 border ${
                        isDark ? 'bg-purple-950 text-purple-300 border-emerald-500/30' : 'bg-emerald-100 text-purple-800 border-purple-300'
                      }`}>
                        {index + 1}
                      </span>
                      
                      <div className="flex-1">
                        <label className={`block text-[10px] uppercase font-bold mb-1 ${textSecondary}`}>Vencimento</label>
                        <input
                          type="date"
                          value={inst.due_date}
                          onClick={(e) => e.target.showPicker && e.target.showPicker()}
                          onChange={(e) => {
                            const val = e.target.value;
                            setPreviewInstallments(prev => prev.map((item, idx) => idx === index ? { ...item, due_date: val } : item));
                          }}
                          className={`w-full border rounded-xl px-3 py-2 text-xs cursor-pointer ${bgCard} ${textPrimary}`}
                        />
                      </div>

                      <div className="flex-1">
                        <label className={`block text-[10px] uppercase font-bold mb-1 ${textSecondary}`}>Valor (R$)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={inst.installment_value}
                          onChange={(e) => {
                            const val = e.target.value;
                            setPreviewInstallments(prev => prev.map((item, idx) => idx === index ? { ...item, installment_value: val } : item));
                          }}
                          className={`w-full border rounded-xl px-3.5 py-2 text-xs ${bgCard} ${textPrimary}`}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className={`flex justify-between items-center text-sm font-bold px-2 ${textPrimary}`}>
                  <span>Soma das parcelas · {previewInstallments.length} parcelas</span>
                  <span className="text-emerald-600 dark:text-purple-300">
                    {formatCurrency(previewInstallments.reduce((acc, curr) => acc + Number(curr.installment_value || 0), 0))}
                  </span>
                </div>
              </div>
            )}

            <div className={`px-6 py-4 border-t flex items-center justify-between shrink-0 ${bgDrawerHeader}`}>
              {step === 'review' ? (
                <>
                  <button 
                    type="button" 
                    onClick={() => setStep('form')}
                    className={`px-6 py-2.5 rounded-xl text-sm font-bold transition border ${bgSubtle} ${textPrimary}`}
                  >
                    Voltar
                  </button>
                  <button 
                    type="button"
                    onClick={handleConfirmCreateContract}
                    disabled={saving}
                    className="flex items-center gap-2 px-7 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white text-sm font-bold transition shadow-lg disabled:opacity-50"
                  >
                    {saving ? <Loader2 size={16} className="animate-spin" /> : null}
                    <span>Criar contrato</span>
                  </button>
                </>
              ) : (
                <>
                  <button 
                    type="button" 
                    onClick={() => setIsModalOpen(false)}
                    className={`px-6 py-2.5 rounded-xl text-sm font-bold transition border ${bgSubtle} ${textPrimary}`}
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    form="contract-form"
                    className="px-7 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white text-sm font-bold transition shadow-lg"
                  >
                    <span>Revisar parcelas</span>
                  </button>
                </>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}