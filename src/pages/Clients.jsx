import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { 
  UserPlus, Trash2, Eye, MessageSquare, Search, X, 
  User, CreditCard, Calendar, Mail, MapPin, 
  Home, Hash, Info, Building2, ChevronLeft, ChevronRight, 
  Loader2, Edit3, FileText, Paperclip, Upload, Plus, ExternalLink, Lock
} from 'lucide-react';

const initialFormState = {
  name: '',
  phone: '',
  document: '',
  rg: '',
  birth_date: '',
  email: '',
  cep: '',
  street: '',
  number: '',
  neighborhood: '',
  complement: '',
  city: '',
  state: '',
  observations: ''
};

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

export default function Clients({ 
  isDark = false, 
  isActivated = false, 
  isMasked = false,
  onRequireActivation, 
  onNavigateToContracts 
}) {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Controle do Drawer: null | 'create' | 'view' | 'edit'
  const [drawerMode, setDrawerMode] = useState(null);
  const [selectedClient, setSelectedClient] = useState(null);
  const [activeViewTab, setActiveViewTab] = useState('dados'); // 'dados' | 'contratos' | 'documentos'
  
  // Estados do Formulário
  const [loadingCep, setLoadingCep] = useState(false);
  const [formData, setFormData] = useState(initialFormState);

  // Estados da Aba Contratos do Cliente
  const [clientContracts, setClientContracts] = useState([]);
  const [loadingContracts, setLoadingContracts] = useState(false);
  const [contractFilter, setContractFilter] = useState('todos'); // 'todos' | 'Aberto' | 'Fechado'

  // Estados da Aba Documentos do Cliente
  const [clientDocs, setClientDocs] = useState([]);
  const [uploadingDocs, setUploadingDocs] = useState(false);
  const fileInputRef = useRef(null);

  // Guardião do Soft Paywall para ações de escrita, edição e exclusão
  function checkActivation() {
    if (!isActivated) {
      if (onRequireActivation) onRequireActivation();
      return false;
    }
    return true;
  }

  // Funções utilitárias de Mascaramento (Passo 4 - Tolerância 24h)
  const maskText = (val) => (isMasked ? '••••••' : (val || '-'));
  const maskPhone = (phoneStr) => {
    if (isMasked) return '+55 (••) • ••••-••••';
    if (!phoneStr) return '-';
    return phoneStr.startsWith('+55') ? phoneStr : `+55 ${phoneStr}`;
  };
  const maskCurrency = (val) => {
    if (isMasked) return 'R$ ••••••';
    return Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  useEffect(() => {
    fetchClients();
  }, []);

  async function fetchClients() {
    setLoading(true);
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error) {
      setClients(data || []);
    }
    setLoading(false);
  }

  // Busca desacoplada e segura de Contratos, Parcelas e Documentos do Cliente
  async function fetchClientDetails(clientId) {
    setLoadingContracts(true);
    try {
      const [contractsRes, instRes, docsRes] = await Promise.all([
        supabase.from('contracts').select('*').eq('client_id', clientId).order('created_at', { ascending: false }),
        supabase.from('installments').select('*').eq('client_id', clientId),
        supabase.from('client_documents').select('*').eq('client_id', clientId).order('created_at', { ascending: false })
      ]);

      const instList = instRes.data || [];
      const enrichedContracts = (contractsRes.data || []).map(c => ({
        ...c,
        installments: instList.filter(i => i.contract_id === c.id)
      }));

      setClientContracts(enrichedContracts);
      setClientDocs(docsRes.data || []);
    } catch (err) {
      console.error('Erro ao buscar detalhes do cliente:', err);
    }
    setLoadingContracts(false);
  }

  // Máscaras de formatação de input
  const formatPhone = (v) => {
    v = v.replace(/\D/g, '').slice(0, 11);
    if (v.length > 7) return `(${v.slice(0,2)}) ${v.slice(2,3)} ${v.slice(3,7)}-${v.slice(7)}`;
    if (v.length > 2) return `(${v.slice(0,2)}) ${v.slice(2)}`;
    return v;
  };

  const formatDocument = (v) => {
    v = v.replace(/\D/g, '').slice(0, 14);
    if (v.length <= 11) {
      return v.replace(/(\d{3})(\d)/, '$1.$2')
              .replace(/(\d{3})(\d)/, '$1.$2')
              .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    }
    return v.replace(/^(\d{2})(\d)/, '$1.$2')
            .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
            .replace(/\.(\d{3})(\d)/, '.$1/$2')
            .replace(/(\d{4})(\d)/, '$1-$2');
  };

  const formatDate = (v) => {
    v = v.replace(/\D/g, '').slice(0, 8);
    if (v.length > 4) return `${v.slice(0,2)}/${v.slice(2,4)}/${v.slice(4)}`;
    if (v.length > 2) return `${v.slice(0,2)}/${v.slice(2)}`;
    return v;
  };

  const formatCep = (v) => {
    v = v.replace(/\D/g, '').slice(0, 8);
    if (v.length > 5) return `${v.slice(0,5)}-${v.slice(5)}`;
    return v;
  };

  const formatCreatedAt = (isoString) => {
    if (isMasked) return '••/••/••••';
    if (!isoString) return '-';
    const d = new Date(isoString);
    return d.toLocaleDateString('pt-BR');
  };

  // Busca de CEP via API ViaCEP
  async function handleSearchCep() {
    const cleanCep = formData.cep.replace(/\D/g, '');
    if (cleanCep.length !== 8) {
      alert('Digite um CEP válido com 8 dígitos.');
      return;
    }

    setLoadingCep(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await response.json();

      if (data.erro) {
        alert('CEP não encontrado.');
      } else {
        setFormData(prev => ({
          ...prev,
          street: data.logradouro || '',
          neighborhood: data.bairro || '',
          city: data.localidade || '',
          state: data.uf || ''
        }));
      }
    } catch {
      alert('Não foi possível consultar o CEP.');
    }
    setLoadingCep(false);
  }

  function handleOpenCreate() {
    if (!checkActivation()) return;
    setSelectedClient(null);
    setFormData(initialFormState);
    setDrawerMode('create');
  }

  function handleOpenView(client) {
    setSelectedClient(client);
    setActiveViewTab('dados');
    setContractFilter('todos');
    setDrawerMode('view');
    fetchClientDetails(client.id);
  }

  function handleSwitchToEdit() {
    if (!checkActivation()) return;
    if (!selectedClient) return;
    setFormData({
      name: selectedClient.name || '',
      phone: selectedClient.phone || '',
      document: selectedClient.document || '',
      rg: (selectedClient.rg || '').slice(0, 11),
      birth_date: selectedClient.birth_date || '',
      email: selectedClient.email || '',
      cep: selectedClient.cep || '',
      street: selectedClient.street || '',
      number: selectedClient.number || '',
      neighborhood: selectedClient.neighborhood || '',
      complement: selectedClient.complement || '',
      city: selectedClient.city || '',
      state: selectedClient.state || '',
      observations: (selectedClient.observations || '').slice(0, 400)
    });
    setDrawerMode('edit');
  }

  async function handleSaveClient(e) {
    e.preventDefault();
    if (!checkActivation()) return;

    if (!formData.name.trim() || !formData.phone.trim()) {
      alert('Preencha pelo menos o Nome e o Telefone!');
      return;
    }

    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const payload = { 
      ...formData,
      name: formData.name.trim(),
      rg: formData.rg.slice(0, 11),
      observations: formData.observations.slice(0, 400),
      user_id: user?.id || null 
    };

    if (drawerMode === 'edit' && selectedClient) {
      const { data, error } = await supabase
        .from('clients')
        .update(payload)
        .eq('id', selectedClient.id)
        .select()
        .single();

      setSaving(false);
      if (error) {
        alert('Erro ao atualizar cliente: ' + error.message);
      } else {
        setSelectedClient(data);
        setDrawerMode('view');
        fetchClients();
      }
    } else {
      const { error } = await supabase.from('clients').insert([payload]);
      setSaving(false);
      if (error) {
        alert('Erro ao cadastrar cliente: ' + error.message);
      } else {
        setDrawerMode(null);
        setFormData(initialFormState);
        fetchClients();
      }
    }
  }

  async function handleDeleteClient(id) {
    if (!checkActivation()) return;
    if (!confirm('Deseja realmente excluir este cliente e todo o seu histórico (contratos, parcelas e documentos)?')) return;

    try {
      const [docsRes] = await Promise.all([
        supabase.from('client_documents').select('file_path').eq('client_id', id)
      ]);

      const filePaths = (docsRes.data || []).map(d => d.file_path).filter(Boolean);
      if (filePaths.length > 0) {
        await supabase.storage.from('client-documents').remove(filePaths);
      }

      await supabase.from('installments').delete().eq('client_id', id);
      await supabase.from('contracts').delete().eq('client_id', id);
      await supabase.from('client_documents').delete().eq('client_id', id);
      
      const { error } = await supabase.from('clients').delete().eq('id', id);
      if (!error) {
        if (selectedClient?.id === id) setDrawerMode(null);
        fetchClients();
      } else {
        alert('Erro ao excluir cliente: ' + error.message);
      }
    } catch (err) {
      alert('Erro ao processar exclusão do cliente: ' + err.message);
    }
  }

  // Upload seguro de Documentos
  async function handleFileUpload(e) {
    if (!checkActivation()) {
      e.target.value = '';
      return;
    }

    const files = Array.from(e.target.files || []);
    if (!files.length || !selectedClient) return;

    if (files.length > 5) {
      alert('Você pode enviar no máximo 5 arquivos por vez.');
      e.target.value = '';
      return;
    }

    if (clientDocs.length + files.length > 10) {
      alert(`Limite de 10 documentos por cliente. Você ainda pode enviar ${10 - clientDocs.length}.`);
      e.target.value = '';
      return;
    }

    for (const file of files) {
      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        alert(`Formato não permitido no arquivo "${file.name}". Envie apenas imagens (JPG, PNG, WEBP) ou PDF.`);
        e.target.value = '';
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        alert(`O arquivo "${file.name}" ultrapassa o limite de 5 MB.`);
        e.target.value = '';
        return;
      }
    }

    setUploadingDocs(true);
    const { data: { user } } = await supabase.auth.getUser();

    for (const file of files) {
      const ext = (file.name.split('.').pop() || 'bin').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      const baseFolder = user?.id ? `${user.id}/${selectedClient.id}` : `${selectedClient.id}`;
      const filePath = `${baseFolder}/${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('client-documents')
        .upload(filePath, file);

      if (uploadError) {
        alert(`Erro ao enviar ${file.name}: ${uploadError.message}`);
        continue;
      }

      const { data: publicUrlData } = supabase.storage
        .from('client-documents')
        .getPublicUrl(filePath);

      await supabase.from('client_documents').insert([{
        user_id: user?.id || null,
        client_id: selectedClient.id,
        file_name: file.name,
        file_path: filePath,
        file_url: publicUrlData.publicUrl,
        file_size: file.size,
        file_type: file.type
      }]);
    }

    e.target.value = '';
    setUploadingDocs(false);
    fetchClientDetails(selectedClient.id);
  }

  async function handleDeleteDocument(doc) {
    if (!checkActivation()) return;
    if (!confirm(`Excluir o documento "${doc.file_name}"?`)) return;

    await supabase.storage.from('client-documents').remove([doc.file_path]);
    await supabase.from('client_documents').delete().eq('id', doc.id);
    setClientDocs(prev => prev.filter(d => d.id !== doc.id));
  }

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.phone && c.phone.includes(searchTerm))
  );

  const totalPages = Math.max(1, Math.ceil(filteredClients.length / itemsPerPage));
  const paginatedClients = filteredClients.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const openContractsCount = clientContracts.filter(c => c.status === 'Aberto').length;
  const closedContractsCount = clientContracts.filter(c => c.status === 'Fechado').length;
  const filteredClientContracts = clientContracts.filter(c => 
    contractFilter === 'todos' ? true : c.status === contractFilter
  );

  // Paleta de Cores Sincronizada com o Tema Global
  const bgCard = isDark ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-[#f8fafc] border-slate-300/80 text-slate-800 shadow-sm';
  const bgSubtle = isDark ? 'bg-[#121212] border-zinc-800' : 'bg-slate-200/70 border-slate-300';
  const bgBar = isDark ? 'bg-zinc-900/60' : 'bg-slate-200/40';
  const bgDrawer = isDark ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-[#f8fafc] border-slate-300 text-slate-900';
  const bgDrawerHeader = isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-slate-200/70 border-slate-300';
  const textPrimary = isDark ? 'text-white' : 'text-slate-900';
  const textSecondary = isDark ? 'text-gray-400' : 'text-slate-600';
  const borderSubtle = isDark ? 'border-zinc-800' : 'border-slate-300/80';
  const inputStyle = `w-full border rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500 transition ${
    isDark ? 'bg-[#121212] border-zinc-800 text-white placeholder-gray-600' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
  }`;

  return (
    <div className="space-y-4">
      <div className={`border rounded-2xl sm:rounded-3xl overflow-hidden shadow-xl ${bgCard}`}>
        
        {/* Topo: Contador + Botão +Cliente */}
        <div className={`p-4 sm:p-6 border-b flex items-center justify-between gap-3 ${borderSubtle}`}>
          <span className={`border px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold ${
            isDark ? 'bg-[#121212] border-zinc-700 text-zinc-200' : 'bg-emerald-100 border-purple-300 text-purple-800'
          }`}>
            {isMasked ? '••' : filteredClients.length} {filteredClients.length === 1 ? 'cliente' : 'clientes'}
          </span>

          <button 
            onClick={handleOpenCreate}
            className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white px-4 sm:px-5 py-2.5 rounded-xl font-bold text-sm transition shadow-lg shadow-purple-900/20 active:scale-95"
          >
            <UserPlus size={18} />
            <span>Cliente</span>
          </button>
        </div>

        {/* Pesquisa */}
        <div className={`p-4 sm:px-6 border-b ${borderSubtle} ${bgBar}`}>
          <div className="relative w-full sm:max-w-xs">
            <Search className={`absolute left-3.5 top-1/2 -translate-y-1/2 ${textSecondary}`} size={16} />
            <input 
              type="text" 
              placeholder="Digite o primeiro nome" 
              value={searchTerm}
              disabled={isMasked}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className={`w-full border rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-emerald-500 transition disabled:opacity-50 ${
                isDark ? 'bg-[#121212] border-zinc-800 text-white placeholder-gray-500' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
              }`}
            />
          </div>
        </div>

        {/* Cabeçalho da Lista */}
        <div className={`px-4 sm:px-6 py-3 border-b flex justify-between items-center text-[11px] font-bold uppercase tracking-wider ${borderSubtle} ${bgSubtle} ${textSecondary}`}>
          <span>Nome</span>
          <span>Ações</span>
        </div>

        {/* Linhas de Clientes */}
        <div className={`divide-y ${isDark ? 'divide-zinc-800' : 'divide-slate-200'}`}>
          {loading ? (
            <div className={`py-12 text-center flex items-center justify-center gap-2 text-sm ${textSecondary}`}>
              <Loader2 size={18} className="animate-spin text-emerald-500" /> Carregando clientes...
            </div>
          ) : paginatedClients.length === 0 ? (
            <div className={`py-12 text-center text-sm px-4 ${textSecondary}`}>
              Nenhum cliente encontrado.
            </div>
          ) : (
            paginatedClients.map((client) => (
              <div 
                key={client.id} 
                className={`px-4 sm:px-6 py-3.5 transition flex items-center justify-between gap-3 ${
                  isDark ? 'hover:bg-zinc-800/40' : 'hover:bg-slate-200/50'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-sm border shrink-0 ${
                    isDark ? 'bg-emerald-950 text-emerald-400 border-emerald-500/30' : 'bg-emerald-100 text-purple-800 border-purple-300'
                  }`}>
                    {isMasked ? '•' : client.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className={`font-bold text-sm sm:text-base truncate ${textPrimary}`}>
                      {maskText(client.name)}
                    </p>
                    <p className={`text-xs sm:text-sm truncate mt-0.5 ${textSecondary}`}>
                      {maskPhone(client.phone)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                  <button 
                    onClick={() => handleDeleteClient(client.id)}
                    className={`p-2 rounded-lg transition border ${bgSubtle} ${textSecondary} hover:bg-red-600 hover:text-white`}
                    title="Excluir cliente"
                  >
                    <Trash2 size={16} />
                  </button>
                  <button 
                    onClick={() => handleOpenView(client)}
                    className={`p-2 rounded-lg transition border ${bgSubtle} ${textSecondary} hover:bg-emerald-600 hover:text-white`}
                    title="Visualizar cliente"
                  >
                    <Eye size={16} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Paginação */}
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
          DRAWER MODO VISUALIZAÇÃO (Dados, Contratos, Documentos)
         ========================================================================= */}
      {drawerMode === 'view' && selectedClient && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex justify-end z-50">
          <div className={`border-l w-full sm:max-w-lg md:max-w-xl h-full flex flex-col shadow-2xl ${bgDrawer}`}>
            
            {/* Cabeçalho com Nome do Cliente */}
            <div className={`px-5 py-4 sm:px-6 sm:py-5 border-b flex justify-between items-center shrink-0 ${bgDrawerHeader}`}>
              <div className="flex items-center gap-3 min-w-0">
                <div className={`p-2.5 rounded-xl border shrink-0 ${
                  isDark ? 'bg-emerald-600/20 text-emerald-400 border-emerald-500/30' : 'bg-emerald-100 text-emerald-700 border-purple-300'
                }`}>
                  <User size={20} />
                </div>
                <h3 className={`text-base sm:text-lg font-extrabold truncate ${textPrimary}`}>
                  {maskText(selectedClient.name)}
                </h3>
              </div>
              <button 
                onClick={() => setDrawerMode(null)}
                className={`p-2 rounded-xl border transition shrink-0 ${bgSubtle} ${textSecondary} hover:opacity-80`}
              >
                <X size={18} />
              </button>
            </div>

            {/* Sub-barra de Abas: Dados | Contratos | Documentos */}
            <div className={`px-5 sm:px-6 py-3 border-b flex items-center gap-2 overflow-x-auto shrink-0 ${borderSubtle}`}>
              <button
                onClick={() => setActiveViewTab('dados')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition border ${
                  activeViewTab === 'dados'
                    ? (isDark ? 'bg-[#121212] text-white border-emerald-500/40 shadow' : 'bg-emerald-100 text-purple-800 border-purple-300 shadow-sm')
                    : `border-transparent ${textSecondary}`
                }`}
              >
                <User size={15} /> Dados
              </button>

              <button
                onClick={() => setActiveViewTab('contratos')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition border ${
                  activeViewTab === 'contratos'
                    ? (isDark ? 'bg-[#121212] text-white border-emerald-500/40 shadow' : 'bg-emerald-100 text-purple-800 border-purple-300 shadow-sm')
                    : `border-transparent ${textSecondary}`
                }`}
              >
                <FileText size={15} /> Contratos
              </button>

              <button
                onClick={() => setActiveViewTab('documentos')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition border ${
                  activeViewTab === 'documentos'
                    ? (isDark ? 'bg-[#121212] text-white border-emerald-500/40 shadow' : 'bg-emerald-100 text-purple-800 border-purple-300 shadow-sm')
                    : `border-transparent ${textSecondary}`
                }`}
              >
                <Paperclip size={15} /> Documentos <span className="opacity-75 ml-0.5">{isMasked ? '•' : clientDocs.length}</span>
              </button>
            </div>

            {/* CONTEÚDO DA ABA 1: DADOS */}
            {activeViewTab === 'dados' && (
              <>
                <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
                  <div>
                    <h4 className={`text-sm font-extrabold mb-2 ${textPrimary}`}>Identificação</h4>
                    <div className={`divide-y text-xs sm:text-sm border-t border-b ${borderSubtle} ${isDark ? 'divide-zinc-800' : 'divide-slate-200'}`}>
                      <div className="py-3 flex justify-between items-center gap-4">
                        <span className={textSecondary}>Nome</span>
                        <span className={`font-bold text-right ${textPrimary}`}>{maskText(selectedClient.name)}</span>
                      </div>
                      <div className="py-3 flex justify-between items-center gap-4">
                        <span className={textSecondary}>Telefone</span>
                        {isMasked ? (
                          <button
                            type="button"
                            onClick={() => checkActivation()}
                            className={`font-bold flex items-center gap-1.5 hover:text-emerald-500 transition ${textPrimary}`}
                          >
                            <Lock size={14} className="text-amber-500" />
                            {maskPhone(selectedClient.phone)}
                          </button>
                        ) : (
                          <a 
                            href={`https://wa.me/55${selectedClient.phone.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noreferrer"
                            className={`font-bold flex items-center gap-1.5 hover:text-emerald-500 transition ${textPrimary}`}
                          >
                            <MessageSquare size={14} className="text-emerald-500" />
                            {maskPhone(selectedClient.phone)}
                          </a>
                        )}
                      </div>
                      <div className="py-3 flex justify-between items-center gap-4">
                        <span className={textSecondary}>Email</span>
                        <span className={`font-bold text-right break-all ${textPrimary}`}>{maskText(selectedClient.email)}</span>
                      </div>
                      <div className="py-3 flex justify-between items-center gap-4">
                        <span className={textSecondary}>CPF/CNPJ</span>
                        <span className={`font-bold ${textPrimary}`}>{maskText(selectedClient.document)}</span>
                      </div>
                      <div className="py-3 flex justify-between items-center gap-4">
                        <span className={textSecondary}>RG</span>
                        <span className={`font-bold ${textPrimary}`}>{maskText(selectedClient.rg)}</span>
                      </div>
                      <div className="py-3 flex justify-between items-center gap-4">
                        <span className={textSecondary}>Nascimento</span>
                        <span className={`font-bold ${textPrimary}`}>{maskText(selectedClient.birth_date)}</span>
                      </div>
                      <div className="py-3 flex justify-between items-center gap-4">
                        <span className={textSecondary}>Cliente desde</span>
                        <span className={`font-bold ${textPrimary}`}>{formatCreatedAt(selectedClient.created_at)}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className={`text-sm font-extrabold mb-2 ${textPrimary}`}>Endereço</h4>
                    <div className={`divide-y text-xs sm:text-sm border-t border-b ${borderSubtle} ${isDark ? 'divide-zinc-800' : 'divide-slate-200'}`}>
                      <div className="py-3 flex justify-between items-center gap-4">
                        <span className={textSecondary}>CEP</span>
                        <span className={`font-bold ${textPrimary}`}>{maskText(selectedClient.cep)}</span>
                      </div>
                      <div className="py-3 flex justify-between items-center gap-4">
                        <span className={textSecondary}>Logradouro</span>
                        <span className={`font-bold text-right ${textPrimary}`}>{maskText(selectedClient.street)}</span>
                      </div>
                      <div className="py-3 flex justify-between items-center gap-4">
                        <span className={textSecondary}>Número</span>
                        <span className={`font-bold ${textPrimary}`}>{maskText(selectedClient.number)}</span>
                      </div>
                      <div className="py-3 flex justify-between items-center gap-4">
                        <span className={textSecondary}>Bairro</span>
                        <span className={`font-bold text-right ${textPrimary}`}>{maskText(selectedClient.neighborhood)}</span>
                      </div>
                      <div className="py-3 flex justify-between items-center gap-4">
                        <span className={textSecondary}>Complemento</span>
                        <span className={`font-bold text-right ${textPrimary}`}>{maskText(selectedClient.complement)}</span>
                      </div>
                      <div className="py-3 flex justify-between items-center gap-4">
                        <span className={textSecondary}>Cidade</span>
                        <span className={`font-bold ${textPrimary}`}>{maskText(selectedClient.city)}</span>
                      </div>
                      <div className="py-3 flex justify-between items-center gap-4">
                        <span className={textSecondary}>Estado</span>
                        <span className={`font-bold ${textPrimary}`}>{maskText(selectedClient.state)}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className={`text-sm font-extrabold mb-2 ${textPrimary}`}>Observações</h4>
                    <p className={`text-xs sm:text-sm whitespace-pre-wrap ${textSecondary}`}>
                      {isMasked ? '••••••' : (selectedClient.observations || 'Nenhuma observação registrada para esse cliente.')}
                    </p>
                  </div>
                </div>

                <div className={`p-4 sm:px-6 border-t flex justify-end shrink-0 ${bgDrawerHeader}`}>
                  <button
                    onClick={handleSwitchToEdit}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold border transition ${bgSubtle} ${textPrimary} hover:opacity-80`}
                  >
                    <Edit3 size={15} /> Editar
                  </button>
                </div>
              </>
            )}

            {/* CONTEÚDO DA ABA 2: CONTRATOS */}
            {activeViewTab === 'contratos' && (
              <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setContractFilter('todos')}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold border transition ${
                        contractFilter === 'todos'
                          ? (isDark ? 'bg-purple-950/80 text-purple-300 border-emerald-500' : 'bg-emerald-100 text-purple-800 border-purple-400')
                          : `${bgSubtle} ${textSecondary}`
                      }`}
                    >
                      Todos · {isMasked ? '•' : clientContracts.length}
                    </button>
                    <button
                      onClick={() => setContractFilter('Aberto')}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold border transition ${
                        contractFilter === 'Aberto'
                          ? (isDark ? 'bg-purple-950/80 text-purple-300 border-emerald-500' : 'bg-emerald-100 text-purple-800 border-purple-400')
                          : `${bgSubtle} ${textSecondary}`
                      }`}
                    >
                      Abertos · {isMasked ? '•' : openContractsCount}
                    </button>
                    <button
                      onClick={() => setContractFilter('Fechado')}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold border transition ${
                        contractFilter === 'Fechado'
                          ? (isDark ? 'bg-purple-950/80 text-purple-300 border-emerald-500' : 'bg-emerald-100 text-purple-800 border-purple-400')
                          : `${bgSubtle} ${textSecondary}`
                      }`}
                    >
                      Fechados · {isMasked ? '•' : closedContractsCount}
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      if (!checkActivation()) return;
                      if (onNavigateToContracts) {
                        onNavigateToContracts(selectedClient);
                      }
                    }}
                    className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition shadow-lg"
                  >
                    <Plus size={16} /> Contrato
                  </button>
                </div>

                {loadingContracts ? (
                  <div className={`py-12 text-center flex items-center justify-center gap-2 text-sm ${textSecondary}`}>
                    <Loader2 size={18} className="animate-spin text-emerald-500" /> Carregando contratos...
                  </div>
                ) : filteredClientContracts.length === 0 ? (
                  <div className={`border border-dashed rounded-2xl p-10 text-center text-sm ${borderSubtle} ${textSecondary}`}>
                    Nenhum contrato encontrado para este filtro.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredClientContracts.map((contract) => {
                      const installments = contract.installments || [];
                      const totalInstallments = installments.length || 1;
                      const paidInstallments = installments.filter(i => i.status === 'Pago').length;
                      const recebido = installments
                        .filter(i => i.status === 'Pago')
                        .reduce((acc, curr) => acc + Number(curr.paid_value ?? curr.installment_value ?? 0), 0);
                      const custo = Number(contract.cost_value || 0);
                      const totalContrato = Number(contract.total_value || 0);
                      const rentabilidade = recebido - custo;
                      const rentabilidadePct = custo > 0 ? ((rentabilidade / custo) * 100).toFixed(1) : '0.0';
                      const progressPct = Math.min(100, Math.round((paidInstallments / totalInstallments) * 100));

                      return (
                        <div key={contract.id} className={`border rounded-2xl p-5 space-y-4 shadow-sm ${bgSubtle}`}>
                          <div className="flex justify-between items-start">
                            <div>
                              <span className={`font-extrabold text-base ${textPrimary}`}>#{contract.contract_number || '1'}</span>
                              <p className={`text-xs mt-0.5 ${textSecondary}`}>{contract.tipo || 'Fixo'}</p>
                            </div>
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                              contract.status === 'Aberto'
                                ? (isDark ? 'bg-emerald-950/40 text-emerald-400 border-emerald-500/30' : 'bg-emerald-100 text-emerald-800 border-emerald-300')
                                : (isDark ? 'bg-gray-800 text-gray-300 border-gray-700' : 'bg-slate-300 text-slate-700 border-slate-400')
                            }`}>
                              <span className={`w-2 h-2 rounded-full ${contract.status === 'Aberto' ? 'bg-emerald-500' : 'bg-gray-500'}`}></span>
                              {contract.status}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-4 pt-1">
                            <div>
                              <span className={`text-xs block ${textSecondary}`}>Custo</span>
                              <strong className={`text-sm sm:text-base ${textPrimary}`}>
                                {maskCurrency(custo)}
                              </strong>
                            </div>
                            <div className="text-right">
                              <span className={`text-xs block ${textSecondary}`}>Total do contrato</span>
                              <strong className={`text-sm sm:text-base ${textPrimary}`}>
                                {maskCurrency(totalContrato)}
                              </strong>
                            </div>

                            <div>
                              <span className={`text-xs block ${textSecondary}`}>Recebido</span>
                              <strong className={`text-sm sm:text-base ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
                                {maskCurrency(recebido)}
                              </strong>
                            </div>
                            <div className="text-right">
                              <span className={`text-xs block ${textSecondary}`}>Rentabilidade</span>
                              <div className="inline-flex items-center gap-1.5 justify-end mt-0.5">
                                <strong className={`text-sm sm:text-base ${rentabilidade >= 0 ? (isDark ? 'text-emerald-400' : 'text-emerald-700') : (isDark ? 'text-red-400' : 'text-red-600')}`}>
                                  {maskCurrency(rentabilidade)}
                                </strong>
                                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                                  rentabilidade >= 0 ? (isDark ? 'bg-emerald-950 text-emerald-400' : 'bg-emerald-100 text-emerald-800') : (isDark ? 'bg-red-950/80 text-red-400' : 'bg-red-100 text-red-800')
                                }`}>
                                  {isMasked ? '••%' : `${rentabilidadePct.replace('.', ',')}%`}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-1.5 pt-1">
                            <div className="flex justify-between text-xs">
                              <span className={textSecondary}>Parcelas pagas</span>
                              <strong className={textPrimary}>{isMasked ? '•/•' : `${paidInstallments}/${totalInstallments}`}</strong>
                            </div>
                            <div className={`w-full h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-purple-950' : 'bg-slate-300'}`}>
                              <div className="bg-emerald-600 h-full transition-all" style={{ width: `${isMasked ? 0 : progressPct}%` }}></div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* CONTEÚDO DA ABA 3: DOCUMENTOS */}
            {activeViewTab === 'documentos' && (
              <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className={`text-sm sm:text-base font-extrabold ${textPrimary}`}>Documentos do cliente</h4>
                      <span className={`text-xs font-bold ${textSecondary}`}>{isMasked ? '•/10' : `${clientDocs.length}/10`}</span>
                    </div>
                    <p className={`text-xs mt-0.5 ${textSecondary}`}>Imagens ou PDF de até 5 MB, até 5 por vez.</p>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    onChange={handleFileUpload}
                    className="hidden"
                  />

                  <button
                    type="button"
                    disabled={uploadingDocs || clientDocs.length >= 10}
                    onClick={() => {
                      if (!checkActivation()) return;
                      fileInputRef.current?.click();
                    }}
                    className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition shadow-lg shrink-0"
                  >
                    {uploadingDocs ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                    <span>Enviar</span>
                  </button>
                </div>

                {clientDocs.length === 0 ? (
                  <div 
                    onClick={() => {
                      if (!checkActivation()) return;
                      fileInputRef.current?.click();
                    }}
                    className={`border border-dashed rounded-2xl p-12 flex flex-col items-center justify-center text-center cursor-pointer transition ${borderSubtle} hover:opacity-80`}
                  >
                    <Paperclip size={32} className={`${textSecondary} mb-3`} />
                    <p className={`text-sm font-bold ${textPrimary}`}>Nenhum documento enviado ainda.</p>
                    <p className={`text-xs mt-1 ${textSecondary}`}>Clique em Enviar para anexar RG, CPF ou comprovantes.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {clientDocs.map((doc) => {
                      const isImage = doc.file_type && doc.file_type.startsWith('image/');
                      return (
                        <div key={doc.id} className={`border rounded-2xl overflow-hidden flex flex-col justify-between ${bgSubtle}`}>
                          {isMasked ? (
                            <div 
                              onClick={() => checkActivation()}
                              className="h-36 bg-black/40 flex flex-col items-center justify-center cursor-pointer gap-2 text-amber-400"
                            >
                              <Lock size={28} />
                              <span className="text-xs font-bold">Documento Oculto (••••••)</span>
                            </div>
                          ) : isImage ? (
                            <a href={doc.file_url} target="_blank" rel="noreferrer" className="block h-36 bg-black/20 overflow-hidden">
                              <img src={doc.file_url} alt={doc.file_name} className="w-full h-full object-cover hover:scale-105 transition duration-300" />
                            </a>
                          ) : (
                            <a href={doc.file_url} target="_blank" rel="noreferrer" className={`h-36 flex flex-col items-center justify-center transition ${
                              isDark ? 'bg-zinc-800/40 text-purple-300 hover:text-white' : 'bg-emerald-100/60 text-purple-800 hover:text-purple-950'
                            }`}>
                              <FileText size={36} />
                              <span className="text-xs font-bold mt-2">Abrir PDF / Documento</span>
                            </a>
                          )}
                          <div className={`p-3 flex items-center justify-between gap-2 border-t ${borderSubtle}`}>
                            <div className="min-w-0">
                              <p className={`text-xs font-bold truncate ${textPrimary}`} title={isMasked ? '••••••' : doc.file_name}>
                                {maskText(doc.file_name)}
                              </p>
                              <p className={`text-[10px] ${textSecondary}`}>{isMasked ? '•• KB' : `${(doc.file_size / 1024).toFixed(0)} KB`}</p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {isMasked ? (
                                <button
                                  type="button"
                                  onClick={() => checkActivation()}
                                  className={`p-1.5 rounded-lg border transition ${bgCard} ${textSecondary} hover:text-emerald-600`}
                                  title="Desbloquear documento"
                                >
                                  <Lock size={14} />
                                </button>
                              ) : (
                                <a
                                  href={doc.file_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className={`p-1.5 rounded-lg border transition ${bgCard} ${textSecondary} hover:text-emerald-600`}
                                  title="Abrir em nova guia"
                                >
                                  <ExternalLink size={14} />
                                </a>
                              )}
                              <button
                                onClick={() => handleDeleteDocument(doc)}
                                className={`p-1.5 rounded-lg border text-red-500 hover:bg-red-600 hover:text-white transition ${bgCard}`}
                                title="Excluir documento"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      )}

      {/* =========================================================================
          DRAWER MODO CRIAR / EDITAR CLIENTE
         ========================================================================= */}
      {(drawerMode === 'create' || drawerMode === 'edit') && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex justify-end z-50">
          <div className={`border-l w-full sm:max-w-lg md:max-w-xl h-full flex flex-col shadow-2xl ${bgDrawer}`}>
            
            <div className={`px-5 py-4 sm:px-6 sm:py-5 border-b flex justify-between items-center shrink-0 ${bgDrawerHeader}`}>
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl border ${
                  isDark ? 'bg-emerald-600/20 text-emerald-400 border-emerald-500/30' : 'bg-emerald-100 text-emerald-700 border-purple-300'
                }`}>
                  <User size={20} />
                </div>
                <h3 className={`text-lg sm:text-xl font-extrabold ${textPrimary}`}>
                  {drawerMode === 'edit' ? 'Editar cliente' : 'Novo cliente'}
                </h3>
              </div>
              <button 
                onClick={() => setDrawerMode(drawerMode === 'edit' ? 'view' : null)}
                className={`p-2 rounded-xl border transition ${bgSubtle} ${textSecondary}`}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveClient} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
              <div className="space-y-4">
                <h4 className={`text-sm font-extrabold tracking-wide ${textPrimary}`}>Identificação</h4>

                <div>
                  <label className={`block text-xs font-bold mb-1.5 ${textSecondary}`}>Nome</label>
                  <div className="relative">
                    <User className={`absolute left-3.5 top-1/2 -translate-y-1/2 ${textSecondary}`} size={17} />
                    <input 
                      type="text" 
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      placeholder="Nome completo" 
                      required
                      className={inputStyle}
                    />
                  </div>
                </div>

                <div>
                  <label className={`block text-xs font-bold mb-1.5 ${textSecondary}`}>Telefone</label>
                  <div className={`flex border rounded-xl overflow-hidden focus-within:border-emerald-500 ${
                    isDark ? 'bg-[#121212] border-zinc-800' : 'bg-white border-slate-300'
                  }`}>
                    <div className={`flex items-center gap-1.5 px-3 border-r text-xs shrink-0 ${
                      isDark ? 'bg-zinc-800/70 border-zinc-800 text-gray-300' : 'bg-slate-100 border-slate-300 text-slate-700'
                    }`}>
                      <span>🇧🇷</span>
                      <span className="text-[10px] opacity-70">▼</span>
                    </div>
                    <input 
                      type="tel" 
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: formatPhone(e.target.value)})}
                      placeholder="(00) 0 0000-0000" 
                      required
                      className={`w-full bg-transparent px-3.5 py-2.5 text-sm focus:outline-none ${textPrimary}`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-xs font-bold mb-1.5 ${textSecondary}`}>CPF/CNPJ</label>
                    <div className="relative">
                      <CreditCard className={`absolute left-3.5 top-1/2 -translate-y-1/2 ${textSecondary}`} size={17} />
                      <input 
                        type="text" 
                        value={formData.document}
                        onChange={(e) => setFormData({...formData, document: formatDocument(e.target.value)})}
                        placeholder="000.000.000-00" 
                        className={inputStyle}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className={`block text-xs font-bold ${textSecondary}`}>RG</label>
                      <span className={`text-[11px] ${textSecondary}`}>{formData.rg.length}/11</span>
                    </div>
                    <div className="relative">
                      <CreditCard className={`absolute left-3.5 top-1/2 -translate-y-1/2 ${textSecondary}`} size={17} />
                      <input 
                        type="text" 
                        maxLength={11}
                        value={formData.rg}
                        onChange={(e) => setFormData({...formData, rg: e.target.value.slice(0, 11)})}
                        placeholder="RG" 
                        className={inputStyle}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-xs font-bold mb-1.5 ${textSecondary}`}>Nascimento</label>
                    <div className="relative">
                      <Calendar className={`absolute left-3.5 top-1/2 -translate-y-1/2 ${textSecondary}`} size={17} />
                      <input 
                        type="text" 
                        value={formData.birth_date}
                        onChange={(e) => setFormData({...formData, birth_date: formatDate(e.target.value)})}
                        placeholder="dd/mm/aaaa" 
                        className={inputStyle}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={`block text-xs font-bold mb-1.5 ${textSecondary}`}>Email</label>
                    <div className="relative">
                      <Mail className={`absolute left-3.5 top-1/2 -translate-y-1/2 ${textSecondary}`} size={17} />
                      <input 
                        type="email" 
                        value={formData.email}
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                        placeholder="nome@dominio.com" 
                        className={inputStyle}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className={`space-y-4 pt-4 border-t ${borderSubtle}`}>
                <h4 className={`text-sm font-extrabold tracking-wide ${textPrimary}`}>Endereço</h4>

                <div>
                  <label className={`block text-xs font-bold mb-1.5 ${textSecondary}`}>CEP</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <MapPin className={`absolute left-3.5 top-1/2 -translate-y-1/2 ${textSecondary}`} size={17} />
                      <input 
                        type="text" 
                        value={formData.cep}
                        onChange={(e) => setFormData({...formData, cep: formatCep(e.target.value)})}
                        placeholder="00000-000" 
                        className={inputStyle}
                      />
                    </div>
                    <button 
                      type="button"
                      onClick={handleSearchCep}
                      disabled={loadingCep}
                      className={`border px-4 py-2.5 rounded-xl text-sm font-bold transition flex items-center gap-2 shrink-0 ${bgSubtle} ${textPrimary} hover:opacity-80`}
                    >
                      {loadingCep ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                      <span>Buscar</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <label className={`block text-xs font-bold mb-1.5 ${textSecondary}`}>Logradouro</label>
                    <div className="relative">
                      <Home className={`absolute left-3.5 top-1/2 -translate-y-1/2 ${textSecondary}`} size={17} />
                      <input 
                        type="text" 
                        value={formData.street}
                        onChange={(e) => setFormData({...formData, street: e.target.value})}
                        placeholder="Rua, avenida..." 
                        className={inputStyle}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={`block text-xs font-bold mb-1.5 ${textSecondary}`}>Número</label>
                    <div className="relative">
                      <Hash className={`absolute left-3.5 top-1/2 -translate-y-1/2 ${textSecondary}`} size={17} />
                      <input 
                        type="text" 
                        value={formData.number}
                        onChange={(e) => setFormData({...formData, number: e.target.value})}
                        placeholder="100" 
                        className={inputStyle}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-xs font-bold mb-1.5 ${textSecondary}`}>Bairro</label>
                    <input 
                      type="text" 
                      value={formData.neighborhood}
                      onChange={(e) => setFormData({...formData, neighborhood: e.target.value})}
                      placeholder="Bairro" 
                      className={inputStyle.replace('pl-10 ', 'px-4 ')}
                    />
                  </div>
                  <div>
                    <label className={`block text-xs font-bold mb-1.5 ${textSecondary}`}>Complemento</label>
                    <div className="relative">
                      <Info className={`absolute left-3.5 top-1/2 -translate-y-1/2 ${textSecondary}`} size={17} />
                      <input 
                        type="text" 
                        value={formData.complement}
                        onChange={(e) => setFormData({...formData, complement: e.target.value})}
                        placeholder="Apto, bloco..." 
                        className={inputStyle}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2">
                    <label className={`block text-xs font-bold mb-1.5 ${textSecondary}`}>Cidade</label>
                    <div className="relative">
                      <Building2 className={`absolute left-3.5 top-1/2 -translate-y-1/2 ${textSecondary}`} size={17} />
                      <input 
                        type="text" 
                        value={formData.city}
                        onChange={(e) => setFormData({...formData, city: e.target.value})}
                        placeholder="Cidade" 
                        className={inputStyle}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={`block text-xs font-bold mb-1.5 ${textSecondary}`}>UF</label>
                    <div className="relative">
                      <MapPin className={`absolute left-3.5 top-1/2 -translate-y-1/2 ${textSecondary}`} size={17} />
                      <input 
                        type="text" 
                        maxLength={2}
                        value={formData.state}
                        onChange={(e) => setFormData({...formData, state: e.target.value.toUpperCase()})}
                        placeholder="UF" 
                        className={`${inputStyle} uppercase`}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className={`space-y-2 pt-4 border-t ${borderSubtle}`}>
                <div className="flex justify-between items-center">
                  <label className={`block text-xs font-bold ${textSecondary}`}>Observações</label>
                  <span className={`text-[11px] ${textSecondary}`}>{formData.observations.length}/400</span>
                </div>
                <textarea 
                  rows="3"
                  maxLength={400}
                  value={formData.observations}
                  onChange={(e) => setFormData({...formData, observations: e.target.value.slice(0, 400)})}
                  placeholder="Informações adicionais sobre o cliente (opcional)"
                  className={`w-full border rounded-xl p-3.5 text-sm focus:outline-none focus:border-emerald-500 resize-none ${
                    isDark ? 'bg-[#121212] border-zinc-800 text-white placeholder-gray-600' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
                  }`}
                ></textarea>
              </div>

              <div className={`pt-4 border-t flex items-center justify-end gap-3 sticky bottom-0 pb-1 ${borderSubtle} ${bgDrawer}`}>
                <button 
                  type="button" 
                  onClick={() => setDrawerMode(drawerMode === 'edit' ? 'view' : null)}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition border ${bgSubtle} ${textPrimary}`}
                >
                  <X size={16} /> Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white text-sm font-bold transition shadow-lg disabled:opacity-50"
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : null}
                  <span>{drawerMode === 'edit' ? 'Salvar' : 'Cadastrar'}</span>
                </button>
              </div>
            </form>

          </div>
        </div>
      )}
    </div>
  );
}