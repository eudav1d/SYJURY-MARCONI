import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  BarChart3, DollarSign, ArrowUpRight, FileDown, 
  TrendingUp, Target, Users, ArrowLeft, Loader2, Eye, X, Info, List,
  Printer, FileSpreadsheet
} from 'lucide-react';

function getLocalISODate(dateObj = new Date()) {
  const offset = dateObj.getTimezoneOffset() * 60000;
  return new Date(dateObj.getTime() - offset).toISOString().split('T')[0];
}

// Extrai a chave YYYY-MM de qualquer formato de data (ISO ou DD/MM/YYYY)
function extractYearMonthKey(dateInput) {
  if (!dateInput) return null;
  const str = String(dateInput).trim();
  if (/^\d{4}-\d{2}/.test(str)) {
    return str.slice(0, 7);
  }
  if (/^\d{2}\/\d{2}\/\d{4}/.test(str)) {
    const [, mm, yyyy] = str.split('/');
    return `${yyyy}-${mm}`;
  }
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`;
  }
  return null;
}

// Gera sempre a estrutura base dos últimos 12 meses (nunca fica em branco)
function buildEmptyLast12Months() {
  const monthsNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const list = [];
  const today = new Date();

  for (let i = 11; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = `${monthsNames[d.getMonth()]}/${String(d.getFullYear()).slice(-2)}`;
    list.push({
      key,
      label,
      qtdClientes: 0,
      qtdContratos: 0,
      contratosVal: 0,
      recebidosVal: 0,
      custoVal: 0,
      emAbertoVal: 0,
      projetadoVal: 0
    });
  }
  return list;
}

// Componente de Gráfico de Barras no padrão visual do SysJuros
function SysBarChart({ title, data, dataKey, barColor, isCurrency, isDark, isMasked, formatCurrency }) {
  const [hoveredIndex, setHoveredIndex] = useState(null);

  const values = data.map(d => (isMasked ? 0 : Number(d[dataKey] || 0)));
  const rawMax = Math.max(...values, 0);

  // Calcula teto agradável para o Eixo Y
  let yMax = 5;
  if (isCurrency) {
    if (rawMax <= 0) yMax = 5000;
    else {
      const magnitude = Math.pow(10, Math.floor(Math.log10(rawMax)));
      yMax = Math.ceil(rawMax / magnitude) * magnitude;
      if (yMax < rawMax) yMax = rawMax * 1.1;
    }
  } else {
    if (rawMax <= 5) yMax = 6;
    else yMax = Math.ceil(rawMax / 5) * 5;
  }

  const ticksCount = 5;
  const yTicks = [];
  for (let i = ticksCount; i >= 0; i--) {
    const val = (yMax / ticksCount) * i;
    yTicks.push(isCurrency ? Math.round(val) : Math.round(val));
  }

  const chartAreaHeight = 210; // Altura fixa em pixels para nunca colapsar
  const bgCard = isDark ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-[#f8fafc] border-slate-300/80 text-slate-800 shadow-sm';
  const textPrimary = isDark ? 'text-white' : 'text-slate-900';
  const textSecondary = isDark ? 'text-gray-400' : 'text-slate-500';
  const axisLineColor = isDark ? 'border-white/10' : 'border-slate-300';
  const gridLineColor = isDark ? 'border-white/5' : 'border-slate-200/80';

  return (
    <div className={`rounded-3xl border p-5 sm:p-6 space-y-5 ${bgCard}`}>
      <div className="flex justify-between items-center">
        <h3 className={`text-sm sm:text-base font-extrabold ${textPrimary}`}>{title}</h3>
        <span className={`text-xs ${textSecondary}`}>Últimos 12 meses</span>
      </div>

      <div className="flex items-stretch gap-3 pt-4 select-none">
        {/* Eixo Y (Escala Vertical) */}
        <div
          className={`flex flex-col justify-between text-right pr-2 text-[11px] font-medium shrink-0 ${textSecondary}`}
          style={{ height: `${chartAreaHeight}px`, minWidth: isCurrency ? '52px' : '28px' }}
        >
          {yTicks.map((tick, idx) => (
            <span key={idx} className="leading-none">
              {isMasked ? '••' : tick}
            </span>
          ))}
        </div>

        {/* Área de Plotagem das Barras */}
        <div className="flex-1 flex flex-col">
          <div
            className={`relative flex items-end justify-between gap-1.5 sm:gap-3 border-l border-b px-2 sm:px-3 ${axisLineColor}`}
            style={{ height: `${chartAreaHeight}px` }}
          >
            {/* Linhas de grade horizontais de fundo */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
              {yTicks.map((_, idx) => (
                <div
                  key={idx}
                  className={`w-full border-t ${idx === yTicks.length - 1 ? 'border-transparent' : gridLineColor}`}
                />
              ))}
            </div>

            {/* Barras dos 12 Meses */}
            {data.map((item, idx) => {
              const rawVal = Number(item[dataKey] || 0);
              const val = isMasked ? 0 : rawVal;
              const ratio = yMax > 0 ? Math.min(1, val / yMax) : 0;
              // Mesmo quando for 0, exibe uma linha base de 3px como no SysJuros
              const barHeightPx = val > 0 ? Math.max(10, Math.round(ratio * (chartAreaHeight - 14))) : 3;
              const isHovered = hoveredIndex === idx;

              const formattedTooltipVal = isMasked
                ? '••••••'
                : isCurrency
                ? formatCurrency(rawVal)
                : rawVal;

              return (
                <div
                  key={item.key || idx}
                  onMouseEnter={() => setHoveredIndex(idx)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  className="relative flex-1 h-full flex flex-col items-center justify-end z-10 group cursor-pointer"
                >
                  {/* Tooltip Estilo SysJuros */}
                  {isHovered && (
                    <div
                      className="absolute z-30 px-2.5 py-1.5 rounded-lg bg-[#09090b] text-white text-[11px] font-extrabold whitespace-nowrap shadow-xl border border-white/15 pointer-events-none transition-all"
                      style={{ bottom: `${barHeightPx + 10}px` }}
                    >
                      {item.label}: {formattedTooltipVal}
                      <div className="w-2 h-2 bg-[#09090b] border-r border-b border-white/15 rotate-45 absolute left-1/2 -translate-x-1/2 -bottom-1"></div>
                    </div>
                  )}

                  {/* Barra Vertical */}
                  <div
                    className="w-full max-w-[54px] rounded-t-sm transition-all duration-300"
                    style={{
                      height: `${barHeightPx}px`,
                      backgroundColor: barColor,
                      opacity: val > 0 ? (isHovered ? 1 : 0.9) : 0.35,
                      filter: isHovered ? 'brightness(1.15)' : 'none'
                    }}
                  />
                </div>
              );
            })}
          </div>

          {/* Eixo X (Rótulos dos Meses) */}
          <div className="flex justify-between gap-1.5 sm:gap-3 px-2 sm:px-3 pt-2.5">
            {data.map((item, idx) => (
              <div key={item.key || idx} className="flex-1 text-center overflow-hidden">
                <span className={`text-[10px] sm:text-[11px] font-medium block truncate ${textSecondary}`}>
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Reports({
  isDark = false,
  isActivated = true,
  isMasked = false,
  hideValues = false,
  onRequireActivation
}) {
  // 'hub' | 'graficos' | 'lucratividade' | 'custo_recebido' | 'projetado_realizado' | 'saldo_cliente'
  const [activeReportView, setActiveReportView] = useState('hub');
  const [loading, setLoading] = useState(false);

  const [monthlyData, setMonthlyData] = useState(() => buildEmptyLast12Months());
  const [contractsProfit, setContractsProfit] = useState([]);
  const [clientsBalance, setClientsBalance] = useState([]);
  const [allInstallments, setAllInstallments] = useState([]);

  // Estados da Gaveta do Contrato
  const [selectedContract, setSelectedContract] = useState(null);
  const [detailsTab, setDetailsTab] = useState('dados');
  const [installmentFilter, setInstallmentFilter] = useState('all');

  const todayStr = getLocalISODate();
  const masked = Boolean(isMasked || hideValues || !isActivated);

  function checkActivation() {
    if (masked) {
      if (onRequireActivation) onRequireActivation();
      else alert('Ative sua assinatura para liberar a exportação de relatórios.');
      return false;
    }
    return true;
  }

  useEffect(() => {
    fetchReportData();
  }, []);

  async function fetchReportData() {
    setLoading(true);
    try {
      const [contractsRes, installmentsRes, clientsRes] = await Promise.all([
        supabase.from('contracts').select('*').order('created_at', { ascending: false }),
        supabase.from('installments').select('*').order('due_date', { ascending: true }),
        supabase.from('clients').select('*')
      ]);

      const clientsList = clientsRes.data || [];
      const contracts = (contractsRes.data || []).map(c => ({
        ...c,
        clients: clientsList.find(cli => cli.id === c.client_id) || null
      }));
      const installments = installmentsRes.data || [];

      setAllInstallments(installments);

      // 1. Processar Lucratividade e Desempenho Financeiro por Contrato
      const profitList = contracts.map(c => {
        const insts = installments.filter(i => i.contract_id === c.id);
        const totalInst = insts.length;
        const paidInst = insts.filter(i => i.status === 'Pago').length;
        const recebido = insts
          .filter(i => i.status === 'Pago')
          .reduce((acc, curr) => acc + Number(curr.paid_value ?? curr.installment_value ?? 0), 0);

        const emAberto = insts
          .filter(i => i.status !== 'Pago')
          .reduce((acc, curr) => acc + Number(curr.installment_value || 0), 0);

        const custo = Number(c.cost_value || 0);
        const total = Number(c.total_value || c.cost_value || 0);
        const capitalExposto = Math.max(0, custo - recebido);
        const rentabilidade = recebido - custo;
        const percentual = custo > 0 ? ((rentabilidade / custo) * 100).toFixed(1) : '0.0';

        return {
          ...c,
          insts,
          totalInst,
          paidInst,
          recebido,
          emAberto,
          capitalExposto,
          custo,
          total,
          rentabilidade,
          percentual
        };
      });
      setContractsProfit(profitList);

      // 2. Mapeamento dos últimos 12 meses para os 4 Gráficos e Relatórios Mensais
      const baseMonths = buildEmptyLast12Months();
      const monthsMap = {};
      baseMonths.forEach(m => {
        monthsMap[m.key] = { ...m };
      });

      clientsList.forEach(cli => {
        const k = extractYearMonthKey(cli.created_at);
        if (k && monthsMap[k]) {
          monthsMap[k].qtdClientes += 1;
        }
      });

      contracts.forEach(c => {
        const k = extractYearMonthKey(c.contract_date || c.created_at);
        const valTotal = Number(c.total_value || c.cost_value || 0);
        const valCusto = Number(c.cost_value || 0);
        if (k && monthsMap[k]) {
          monthsMap[k].qtdContratos += 1;
          monthsMap[k].contratosVal += valTotal;
          monthsMap[k].custoVal += valCusto;
        }
      });

      installments.forEach(ins => {
        const dueKey = extractYearMonthKey(ins.due_date);
        const valParcela = Number(ins.installment_value || 0);

        if (dueKey && monthsMap[dueKey]) {
          monthsMap[dueKey].projetadoVal += valParcela;
          if (ins.status !== 'Pago') {
            monthsMap[dueKey].emAbertoVal += valParcela;
          }
        }

        if (ins.status === 'Pago') {
          const payKey = extractYearMonthKey(ins.payment_date || ins.due_date || ins.created_at);
          const valPago = Number(ins.paid_value ?? ins.installment_value ?? 0);
          if (payKey && monthsMap[payKey]) {
            monthsMap[payKey].recebidosVal += valPago;
          }
        }
      });

      setMonthlyData(Object.values(monthsMap));

      // 3. Processar Saldo por Cliente
      const balanceByClient = clientsList.map(cli => {
        const cliInsts = installments.filter(i => i.client_id === cli.id && i.status !== 'Pago');
        const overdueInsts = cliInsts.filter(i => i.due_date < todayStr);
        const totalDevedor = cliInsts.reduce((acc, curr) => acc + Number(curr.installment_value || 0), 0);
        const totalVencido = overdueInsts.reduce((acc, curr) => acc + Number(curr.installment_value || 0), 0);

        let maxDaysLate = 0;
        overdueInsts.forEach(i => {
          const diff = Math.floor((new Date() - new Date(i.due_date + 'T00:00:00')) / 86400000);
          if (diff > maxDaysLate) maxDaysLate = diff;
        });

        return {
          id: cli.id,
          name: cli.name,
          phone: cli.phone || '-',
          totalDevedor,
          totalVencido,
          qtdAtrasadas: overdueInsts.length,
          maxDaysLate
        };
      }).filter(item => item.totalDevedor > 0);

      setClientsBalance(balanceByClient);

      if (selectedContract) {
        const updated = profitList.find(c => c.id === selectedContract.id);
        if (updated) setSelectedContract(updated);
      }
    } catch (err) {
      console.error('Erro ao buscar relatórios:', err);
    }
    setLoading(false);
  }

  function formatCurrency(val) {
    if (masked) return '••••••';
    return Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function formatRawCurrency(val) {
    return Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function formatDateBR(dateStr) {
    if (!dateStr) return '-';
    return dateStr.split('T')[0].split('-').reverse().join('/');
  }

  // =========================================================================
  // FUNÇÕES DE EXPORTAÇÃO (CSV EXCEL + PDF ESTRUTURADO PARA IMPRESSÃO)
  // =========================================================================
  function downloadCSV(filename, headers, rows) {
    if (!checkActivation()) return;
    const csvContent =
      '\uFEFF' +
      [headers.join(';'), ...rows.map(r => r.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function openPrintablePDF(title, subtitle, summaryCards, headers, rows) {
    if (!checkActivation()) return;
    const printWin = window.open('', '_blank', 'width=980,height=720');
    if (!printWin) {
      alert('Permita pop-ups no navegador para gerar o PDF.');
      return;
    }

    const html = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8" />
        <title>${title} - SyJury</title>
        <style>
          body { font-family: 'Segoe UI', Roboto, Arial, sans-serif; color: #0f172a; margin: 32px; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #6d28d9; padding-bottom: 14px; margin-bottom: 20px; }
          .brand { font-size: 22px; font-weight: 900; color: #6d28d9; }
          .title { font-size: 18px; font-weight: 800; margin: 0; }
          .subtitle { font-size: 12px; color: #64748b; margin-top: 4px; }
          .cards { display: grid; grid-template-columns: repeat(${summaryCards.length}, 1fr); gap: 12px; margin-bottom: 22px; }
          .card { border: 1px solid #cbd5e1; border-radius: 10px; padding: 12px; background: #f8fafc; }
          .card-label { font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 700; }
          .card-val { font-size: 16px; font-weight: 800; margin-top: 4px; color: #0f172a; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th { background: #f1f5f9; color: #334155; text-align: left; padding: 10px; border-bottom: 2px solid #cbd5e1; text-transform: uppercase; font-size: 10px; }
          td { padding: 9px 10px; border-bottom: 1px solid #e2e8f0; }
          tr:nth-child(even) { background: #f8fafc; }
          @media print {
            body { margin: 12px; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="brand">SyJury</div>
            <h1 class="title">${title}</h1>
            <div class="subtitle">${subtitle} · Gerado em ${formatDateBR(todayStr)}</div>
          </div>
          <button class="no-print" onclick="window.print()" style="background:#6d28d9;color:#fff;border:0;padding:10px 18px;border-radius:8px;font-weight:700;cursor:pointer;">
            Salvar PDF / Imprimir
          </button>
        </div>
        <div class="cards">
          ${summaryCards.map(c => `<div class="card"><div class="card-label">${c.label}</div><div class="card-val">${c.value}</div></div>`).join('')}
        </div>
        <table>
          <thead>
            <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
          </thead>
          <tbody>
            ${rows.map(r => `<tr>${r.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}
          </tbody>
        </table>
        <script>
          window.onload = function() { setTimeout(function() { window.print(); }, 350); };
        </script>
      </body>
      </html>
    `;

    printWin.document.open();
    printWin.document.write(html);
    printWin.document.close();
  }

  // Exportar Desempenho Financeiro (PDF + opção CSV)
  function handleExportDesempenho(format = 'pdf') {
    if (!checkActivation()) return;

    const totalCusto = contractsProfit.reduce((a, b) => a + b.custo, 0);
    const totalRecebido = contractsProfit.reduce((a, b) => a + b.recebido, 0);
    const totalAberto = contractsProfit.reduce((a, b) => a + b.emAberto, 0);
    const totalExposto = contractsProfit.reduce((a, b) => a + b.capitalExposto, 0);

    const headers = ['Contrato', 'Cliente', 'Status', 'Custo', 'Recebido', 'Em Aberto', 'Capital Exposto', 'Lucro Líquido', 'Margem %'];
    const rows = contractsProfit.map(c => [
      `#${c.contract_number || '1'}`,
      c.clients?.name || 'Cliente',
      c.status,
      formatRawCurrency(c.custo),
      formatRawCurrency(c.recebido),
      formatRawCurrency(c.emAberto),
      formatRawCurrency(c.capitalExposto),
      formatRawCurrency(c.rentabilidade),
      `${c.percentual.replace('.', ',')}%`
    ]);

    if (format === 'csv') {
      downloadCSV(`desempenho_financeiro_${todayStr}.csv`, headers, rows);
    } else {
      openPrintablePDF(
        'Relatório de Desempenho Financeiro',
        'Custo, valor recebido, saldo em aberto e capital exposto por contrato',
        [
          { label: 'Capital Investido (Custo)', value: formatRawCurrency(totalCusto) },
          { label: 'Total Recebido', value: formatRawCurrency(totalRecebido) },
          { label: 'Saldo em Aberto', value: formatRawCurrency(totalAberto) },
          { label: 'Capital Exposto', value: formatRawCurrency(totalExposto) }
        ],
        headers,
        rows
      );
    }
  }

  // Exportar Custo x Recebido dos últimos 12 meses (PDF ou CSV)
  function handleExportCustoRecebido(format = 'pdf') {
    if (!checkActivation()) return;

    const totalCusto12m = monthlyData.reduce((a, b) => a + b.custoVal, 0);
    const totalRec12m = monthlyData.reduce((a, b) => a + b.recebidosVal, 0);
    const totalAberto12m = monthlyData.reduce((a, b) => a + b.emAbertoVal, 0);
    const resultado12m = totalRec12m - totalCusto12m;

    const headers = ['Mês/Ano', 'Contratos', 'Custo (Investido)', 'Recebido', 'Em Aberto', 'Resultado (Recebido - Custo)'];
    const rows = monthlyData.map(m => {
      const resultado = m.recebidosVal - m.custoVal;
      return [
        m.label,
        m.qtdContratos,
        formatRawCurrency(m.custoVal),
        formatRawCurrency(m.recebidosVal),
        formatRawCurrency(m.emAbertoVal),
        formatRawCurrency(resultado)
      ];
    });

    if (format === 'csv') {
      downloadCSV(`custo_x_recebido_12m_${todayStr}.csv`, headers, rows);
    } else {
      openPrintablePDF(
        'Relatório Custo x Recebido (Últimos 12 Meses)',
        'Comparativo mensal de capital investido, recebimentos, saldo em aberto e resultado',
        [
          { label: 'Custo Total (12m)', value: formatRawCurrency(totalCusto12m) },
          { label: 'Recebido Total (12m)', value: formatRawCurrency(totalRec12m) },
          { label: 'Em Aberto (12m)', value: formatRawCurrency(totalAberto12m) },
          { label: 'Resultado Acumulado', value: formatRawCurrency(resultado12m) }
        ],
        headers,
        rows
      );
    }
  }

  // Dados calculados para a gaveta do contrato selecionado
  const contractInstallments = selectedContract
    ? allInstallments.filter(i => i.contract_id === selectedContract.id)
    : [];
  const drawerPaidInsts = contractInstallments.filter(i => i.status === 'Pago');
  const drawerUnpaidInsts = contractInstallments.filter(i => i.status !== 'Pago');
  const drawerOverdueInsts = drawerUnpaidInsts.filter(i => i.due_date < todayStr);

  const drawerTotalCount = contractInstallments.length;
  const drawerPaidCount = drawerPaidInsts.length;
  const drawerProgress = drawerTotalCount > 0 ? Math.round((drawerPaidCount / drawerTotalCount) * 100) : 0;
  const drawerRecebido = drawerPaidInsts.reduce((acc, curr) => acc + Number(curr.paid_value ?? curr.installment_value ?? 0), 0);
  const selectedCusto = Number(selectedContract?.cost_value || 0);
  const drawerRentabilidade = drawerRecebido - selectedCusto;
  const drawerRentabilidadePct = selectedCusto > 0 ? ((drawerRentabilidade / selectedCusto) * 100).toFixed(1) : '0.0';
  const taxaAplicadaCalc = selectedCusto > 0 
    ? Math.round(((Number(selectedContract?.total_value || 0) - selectedCusto) / selectedCusto) * 100)
    : 0;

  const filteredDrawerInstallments = contractInstallments.filter(i => {
    if (installmentFilter === 'paid') return i.status === 'Pago';
    if (installmentFilter === 'unpaid') return i.status !== 'Pago';
    return true;
  });

  const bgCard = isDark ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-[#f8fafc] border-slate-300/80 text-slate-800 shadow-sm';
  const bgSubtle = isDark ? 'bg-[#121212] border-zinc-800' : 'bg-slate-200/70 border-slate-300';
  const textPrimary = isDark ? 'text-white' : 'text-slate-900';
  const textSecondary = isDark ? 'text-gray-400' : 'text-slate-600';
  const borderSubtle = isDark ? 'border-zinc-800' : 'border-slate-300/80';
  const bgDrawer = isDark ? 'bg-[#121212] border-zinc-800 text-white' : 'bg-[#f8fafc] border-slate-300 text-slate-900';
  const bgDrawerHeader = isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-slate-200/70 border-slate-300';

  return (
    <div className="space-y-6">
      
      {activeReportView !== 'hub' && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveReportView('hub')}
              className={`p-2 rounded-xl border transition ${bgSubtle} ${textPrimary} hover:opacity-80`}
              title="Voltar para Relatórios"
            >
              <ArrowLeft size={18} />
            </button>
            <h2 className={`text-xl font-extrabold ${textPrimary}`}>
              {activeReportView === 'graficos' && 'Evolução Gráficos · Últimos 12 Meses'}
              {activeReportView === 'lucratividade' && 'Rentabilidade e Desempenho por Contrato'}
              {activeReportView === 'custo_recebido' && 'Custo x Recebido · Últimos 12 Meses'}
              {activeReportView === 'projetado_realizado' && 'Projetado x Realizado · Últimos 12 Meses'}
              {activeReportView === 'saldo_cliente' && 'Saldo Devedor por Cliente'}
            </h2>
          </div>

          {activeReportView === 'lucratividade' && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleExportDesempenho('csv')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-bold transition ${bgSubtle} ${textPrimary} hover:opacity-80`}
              >
                <FileSpreadsheet size={15} className="text-emerald-500" /> Exportar CSV
              </button>
              <button
                onClick={() => handleExportDesempenho('pdf')}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow"
              >
                <Printer size={15} /> Gerar PDF
              </button>
            </div>
          )}

          {activeReportView === 'custo_recebido' && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleExportCustoRecebido('csv')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-bold transition ${bgSubtle} ${textPrimary} hover:opacity-80`}
              >
                <FileSpreadsheet size={15} className="text-emerald-500" /> Exportar CSV
              </button>
              <button
                onClick={() => handleExportCustoRecebido('pdf')}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow"
              >
                <Printer size={15} /> Gerar PDF
              </button>
            </div>
          )}
        </div>
      )}

      {/* HUB PRINCIPAL */}
      {activeReportView === 'hub' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Card 1: Evolução gráficos */}
          <div className={`rounded-3xl border p-6 flex flex-col justify-between transition ${bgCard} hover:border-emerald-500/50`}>
            <div className="space-y-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                isDark ? 'bg-zinc-800 text-emerald-400 border-emerald-500/30' : 'bg-emerald-100 text-emerald-700 border-purple-300'
              }`}>
                <BarChart3 size={20} />
              </div>
              <div>
                <h3 className={`text-base font-extrabold ${textPrimary}`}>Evolução gráficos</h3>
                <p className={`text-xs mt-1 ${textSecondary}`}>
                  Clientes, contratos, valor contratado e recebimentos dos últimos 12 meses em gráficos.
                </p>
              </div>
            </div>
            <div className={`pt-4 mt-6 border-t flex justify-end ${borderSubtle}`}>
              <button
                onClick={() => setActiveReportView('graficos')}
                className={`text-xs font-bold hover:underline flex items-center gap-1 ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}
              >
                Ver relatório <ArrowUpRight size={14} />
              </button>
            </div>
          </div>

          {/* Card 2: Lucratividade por contrato */}
          <div className={`rounded-3xl border p-6 flex flex-col justify-between transition ${bgCard} hover:border-amber-500/50`}>
            <div className="space-y-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                isDark ? 'bg-amber-950/60 text-amber-400 border-amber-500/30' : 'bg-amber-100 text-amber-700 border-amber-300'
              }`}>
                <DollarSign size={20} />
              </div>
              <div>
                <h3 className={`text-base font-extrabold ${textPrimary}`}>Lucratividade por contrato</h3>
                <p className={`text-xs mt-1 ${textSecondary}`}>
                  Custo, valor recebido, saldo em aberto e margem de lucro de cada contrato do sistema.
                </p>
              </div>
            </div>
            <div className={`pt-4 mt-6 border-t flex justify-end ${borderSubtle}`}>
              <button
                onClick={() => setActiveReportView('lucratividade')}
                className={`text-xs font-bold hover:underline flex items-center gap-1 ${isDark ? 'text-amber-400' : 'text-amber-700'}`}
              >
                Ver relatório <ArrowUpRight size={14} />
              </button>
            </div>
          </div>

          {/* Card 3: Desempenho financeiro */}
          <div className={`rounded-3xl border p-6 flex flex-col justify-between transition ${bgCard} hover:border-blue-500/50`}>
            <div className="space-y-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                isDark ? 'bg-blue-950/60 text-blue-400 border-blue-500/30' : 'bg-blue-100 text-blue-700 border-blue-300'
              }`}>
                <TrendingUp size={20} />
              </div>
              <div>
                <h3 className={`text-base font-extrabold ${textPrimary}`}>Desempenho financeiro</h3>
                <p className={`text-xs mt-1 ${textSecondary}`}>
                  Custo, valor recebido, saldo em aberto e capital exposto com margem de lucro por contrato.
                </p>
              </div>
            </div>
            <div className={`pt-4 mt-6 border-t flex items-center justify-between ${borderSubtle}`}>
              <button
                onClick={() => handleExportDesempenho('csv')}
                className={`text-xs font-bold hover:underline flex items-center gap-1 ${textSecondary}`}
              >
                CSV <FileSpreadsheet size={13} />
              </button>
              <button
                onClick={() => handleExportDesempenho('pdf')}
                className={`text-xs font-bold hover:underline flex items-center gap-1 ${isDark ? 'text-blue-400' : 'text-blue-700'}`}
              >
                Exportar <FileDown size={14} />
              </button>
            </div>
          </div>

          {/* Card 4: Custo x Recebido */}
          <div className={`rounded-3xl border p-6 flex flex-col justify-between transition ${bgCard} hover:border-emerald-500/50`}>
            <div className="space-y-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                isDark ? 'bg-emerald-950/60 text-emerald-400 border-emerald-500/30' : 'bg-emerald-100 text-emerald-700 border-emerald-300'
              }`}>
                <FileDown size={20} />
              </div>
              <div>
                <h3 className={`text-base font-extrabold ${textPrimary}`}>Custo x Recebido</h3>
                <p className={`text-xs mt-1 ${textSecondary}`}>
                  Custo, recebido, resultado e valores em aberto de cada mês dos últimos 12 meses, em PDF.
                </p>
              </div>
            </div>
            <div className={`pt-4 mt-6 border-t flex items-center justify-between ${borderSubtle}`}>
              <button
                onClick={() => setActiveReportView('custo_recebido')}
                className={`text-xs font-bold hover:underline flex items-center gap-1 ${textSecondary}`}
              >
                Ver tabela <ArrowUpRight size={13} />
              </button>
              <button
                onClick={() => handleExportCustoRecebido('pdf')}
                className={`text-xs font-bold hover:underline flex items-center gap-1 ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}
              >
                Exportar <FileDown size={14} />
              </button>
            </div>
          </div>

          {/* Card 5: Projetado x Realizado */}
          <div className={`rounded-3xl border p-6 flex flex-col justify-between transition ${bgCard} hover:border-emerald-500/50`}>
            <div className="space-y-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${bgSubtle} ${textSecondary}`}>
                <Target size={20} />
              </div>
              <div>
                <h3 className={`text-base font-extrabold ${textPrimary}`}>Projetado x Realizado</h3>
                <p className={`text-xs mt-1 ${textSecondary}`}>
                  Parcelas que venceram em cada mês comparadas ao que foi efetivamente recebido.
                </p>
              </div>
            </div>
            <div className={`pt-4 mt-6 border-t flex justify-end items-center ${borderSubtle}`}>
              <button
                onClick={() => setActiveReportView('projetado_realizado')}
                className={`text-xs font-bold hover:underline flex items-center gap-1 ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}
              >
                Ver relatório <ArrowUpRight size={14} />
              </button>
            </div>
          </div>

          {/* Card 6: Saldo por cliente */}
          <div className={`rounded-3xl border p-6 flex flex-col justify-between transition ${bgCard} hover:border-emerald-500/50`}>
            <div className="space-y-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${bgSubtle} ${textSecondary}`}>
                <Users size={20} />
              </div>
              <div>
                <h3 className={`text-base font-extrabold ${textPrimary}`}>Saldo por cliente</h3>
                <p className={`text-xs mt-1 ${textSecondary}`}>
                  Quanto cada cliente ainda deve, quanto já está vencido, parcelas em atraso e há quantos dias.
                </p>
              </div>
            </div>
            <div className={`pt-4 mt-6 border-t flex justify-end items-center ${borderSubtle}`}>
              <button
                onClick={() => setActiveReportView('saldo_cliente')}
                className={`text-xs font-bold hover:underline flex items-center gap-1 ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}
              >
                Ver relatório <ArrowUpRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW 1: EVOLUÇÃO GRÁFICOS (OS 4 GRÁFICOS OFICIAIS DO SYSJUROS)
         ========================================================================= */}
      {activeReportView === 'graficos' && (
        <div className="space-y-6">
          {loading ? (
            <div className={`py-20 text-center flex items-center justify-center gap-2 text-sm ${textSecondary}`}>
              <Loader2 size={20} className="animate-spin text-emerald-500" /> Carregando dados dos gráficos...
            </div>
          ) : (
            <>
              {/* Gráfico 1: Clientes (Azul Royal igual ao SysJuros) */}
              <SysBarChart
                title="Clientes"
                data={monthlyData}
                dataKey="qtdClientes"
                barColor="#1d6ce0"
                isCurrency={false}
                isDark={isDark}
                isMasked={masked}
                formatCurrency={formatCurrency}
              />

              {/* Gráfico 2: Número de contratos (Laranja/Âmbar igual ao SysJuros) */}
              <SysBarChart
                title="Número de contratos"
                data={monthlyData}
                dataKey="qtdContratos"
                barColor="#d97706"
                isCurrency={false}
                isDark={isDark}
                isMasked={masked}
                formatCurrency={formatCurrency}
              />

              {/* Gráfico 3: Valor dos contratos (Roxo/Violeta igual ao SysJuros) */}
              <SysBarChart
                title="Valor dos contratos"
                data={monthlyData}
                dataKey="contratosVal"
                barColor="#7c4dff"
                isCurrency={true}
                isDark={isDark}
                isMasked={masked}
                formatCurrency={formatCurrency}
              />

              {/* Gráfico 4: Valor dos recebimentos (Verde Esmeralda igual ao SysJuros) */}
              <SysBarChart
                title="Valor dos recebimentos"
                data={monthlyData}
                dataKey="recebidosVal"
                barColor="#10b981"
                isCurrency={true}
                isDark={isDark}
                isMasked={masked}
                formatCurrency={formatCurrency}
              />
            </>
          )}
        </div>
      )}

      {/* =========================================================================
          VIEW 2: LUCRATIVIDADE / DESEMPENHO POR CONTRATO
         ========================================================================= */}
      {activeReportView === 'lucratividade' && (
        <div className={`rounded-3xl border overflow-hidden ${bgCard}`}>
          <div className={`p-4 sm:px-6 border-b flex justify-between items-center ${borderSubtle}`}>
            <span className={`text-xs font-bold ${textSecondary}`}>Rentabilidade por Contrato</span>
            <span className={`text-xs font-bold px-3 py-1 rounded-lg border ${bgSubtle} ${textPrimary}`}>
              {contractsProfit.length} contratos
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className={`border-b text-[11px] font-bold uppercase tracking-wider ${borderSubtle} ${bgSubtle} ${textSecondary}`}>
                  <th className="py-3.5 px-5">Contrato</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Cliente</th>
                  <th className="py-3.5 px-4">Custo</th>
                  <th className="py-3.5 px-4">Valor Total</th>
                  <th className="py-3.5 px-4">Parcelas</th>
                  <th className="py-3.5 px-4">Recebido</th>
                  <th className="py-3.5 px-4">Rentabilidade</th>
                  <th className="py-3.5 px-4">%</th>
                  <th className="py-3.5 px-5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className={`divide-y text-sm ${isDark ? 'divide-zinc-800' : 'divide-slate-200'}`}>
                {contractsProfit.length === 0 ? (
                  <tr>
                    <td colSpan="10" className={`py-12 text-center text-xs ${textSecondary}`}>
                      Nenhum contrato cadastrado no sistema.
                    </td>
                  </tr>
                ) : (
                  contractsProfit.map((c) => (
                    <tr key={c.id} className={`transition ${isDark ? 'hover:bg-zinc-800/40' : 'hover:bg-slate-200/50'}`}>
                      <td className={`py-4 px-5 font-bold ${textPrimary}`}>
                        #{c.contract_number || '1'}
                      </td>
                      <td className="py-4 px-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                          c.status === 'Aberto'
                            ? (isDark ? 'bg-emerald-950/60 text-emerald-400 border-emerald-500/30' : 'bg-emerald-100 text-emerald-800 border-emerald-300')
                            : (isDark ? 'bg-gray-800 text-gray-300 border-gray-700' : 'bg-slate-300 text-slate-700 border-slate-400')
                        }`}>
                          ● {c.status}
                        </span>
                      </td>
                      <td className={`py-4 px-4 font-semibold truncate max-w-[160px] ${textPrimary}`}>
                        {c.clients?.name || 'Cliente'}
                      </td>
                      <td className={`py-4 px-4 text-xs font-semibold ${textSecondary}`}>
                        {formatCurrency(c.custo)}
                      </td>
                      <td className={`py-4 px-4 text-xs font-bold ${textPrimary}`}>
                        {formatCurrency(c.total)}
                      </td>
                      <td className={`py-4 px-4 text-xs ${textSecondary}`}>
                        {c.paidInst}/{c.totalInst}
                      </td>
                      <td className="py-4 px-4 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(c.recebido)}
                      </td>
                      <td className={`py-4 px-4 text-xs font-extrabold ${c.rentabilidade >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                        {masked ? '••••••' : (c.rentabilidade < 0 ? `- ${formatCurrency(Math.abs(c.rentabilidade))}` : formatCurrency(c.rentabilidade))}
                      </td>
                      <td className={`py-4 px-4 text-xs font-bold ${c.rentabilidade >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                        {masked ? '••••••' : `${c.percentual.replace('.', ',')}%`}
                      </td>
                      <td className="py-4 px-5 text-right">
                        <button
                          onClick={() => setSelectedContract(c)}
                          className={`p-2 rounded-lg border transition ${bgSubtle} ${textSecondary} hover:text-emerald-600`}
                          title="Ver detalhes do contrato"
                        >
                          <Eye size={15} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW 3: CUSTO X RECEBIDO (ÚLTIMOS 12 MESES)
         ========================================================================= */}
      {activeReportView === 'custo_recebido' && (
        <div className={`rounded-3xl border overflow-hidden ${bgCard}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className={`border-b text-[11px] font-bold uppercase tracking-wider ${borderSubtle} ${bgSubtle} ${textSecondary}`}>
                  <th className="py-3.5 px-6">Mês / Ano</th>
                  <th className="py-3.5 px-4">Novos Contratos</th>
                  <th className="py-3.5 px-4">Custo (Investido)</th>
                  <th className="py-3.5 px-4">Recebido no Mês</th>
                  <th className="py-3.5 px-4">Em Aberto no Mês</th>
                  <th className="py-3.5 px-6 text-right">Resultado Líquido</th>
                </tr>
              </thead>
              <tbody className={`divide-y text-sm ${isDark ? 'divide-zinc-800' : 'divide-slate-200'}`}>
                {monthlyData.map((m) => {
                  const resultado = m.recebidosVal - m.custoVal;
                  return (
                    <tr key={m.key} className={`transition ${isDark ? 'hover:bg-zinc-800/40' : 'hover:bg-slate-200/50'}`}>
                      <td className={`py-3.5 px-6 font-bold ${textPrimary}`}>{m.label}</td>
                      <td className={`py-3.5 px-4 text-xs font-bold ${textSecondary}`}>{masked ? '••' : m.qtdContratos}</td>
                      <td className={`py-3.5 px-4 text-xs font-semibold ${textSecondary}`}>{formatCurrency(m.custoVal)}</td>
                      <td className="py-3.5 px-4 text-xs font-bold text-emerald-500">{formatCurrency(m.recebidosVal)}</td>
                      <td className="py-3.5 px-4 text-xs font-bold text-blue-400">{formatCurrency(m.emAbertoVal)}</td>
                      <td className={`py-3.5 px-6 text-xs font-extrabold text-right ${resultado >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                        {formatCurrency(resultado)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW 4: PROJETADO X REALIZADO
         ========================================================================= */}
      {activeReportView === 'projetado_realizado' && (
        <div className={`rounded-3xl border overflow-hidden ${bgCard}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className={`border-b text-[11px] font-bold uppercase tracking-wider ${borderSubtle} ${bgSubtle} ${textSecondary}`}>
                  <th className="py-3.5 px-6">Mês / Ano</th>
                  <th className="py-3.5 px-4">Projetado (Vencimentos)</th>
                  <th className="py-3.5 px-4">Realizado (Recebido)</th>
                  <th className="py-3.5 px-6 text-right">Pendente no Mês</th>
                </tr>
              </thead>
              <tbody className={`divide-y text-sm ${isDark ? 'divide-zinc-800' : 'divide-slate-200'}`}>
                {monthlyData.map((m) => (
                  <tr key={m.key} className={`transition ${isDark ? 'hover:bg-zinc-800/40' : 'hover:bg-slate-200/50'}`}>
                    <td className={`py-3.5 px-6 font-bold ${textPrimary}`}>{m.label}</td>
                    <td className={`py-3.5 px-4 text-xs font-bold ${textPrimary}`}>{formatCurrency(m.projetadoVal)}</td>
                    <td className="py-3.5 px-4 text-xs font-bold text-emerald-500">{formatCurrency(m.recebidosVal)}</td>
                    <td className="py-3.5 px-6 text-xs font-bold text-amber-500 text-right">{formatCurrency(m.emAbertoVal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW 5: SALDO POR CLIENTE
         ========================================================================= */}
      {activeReportView === 'saldo_cliente' && (
        <div className={`rounded-3xl border overflow-hidden ${bgCard}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className={`border-b text-[11px] font-bold uppercase tracking-wider ${borderSubtle} ${bgSubtle} ${textSecondary}`}>
                  <th className="py-3.5 px-6">Cliente</th>
                  <th className="py-3.5 px-4">Telefone</th>
                  <th className="py-3.5 px-4">Saldo Devedor Total</th>
                  <th className="py-3.5 px-4">Valor Vencido</th>
                  <th className="py-3.5 px-4">Parcelas em Atraso</th>
                  <th className="py-3.5 px-6 text-right">Maior Atraso</th>
                </tr>
              </thead>
              <tbody className={`divide-y text-sm ${isDark ? 'divide-zinc-800' : 'divide-slate-200'}`}>
                {clientsBalance.length === 0 ? (
                  <tr>
                    <td colSpan="6" className={`py-12 text-center text-xs ${textSecondary}`}>
                      Nenhum cliente com saldo em aberto no momento.
                    </td>
                  </tr>
                ) : (
                  clientsBalance.map(cli => (
                    <tr key={cli.id} className={`transition ${isDark ? 'hover:bg-zinc-800/40' : 'hover:bg-slate-200/50'}`}>
                      <td className={`py-3.5 px-6 font-bold ${textPrimary}`}>{cli.name}</td>
                      <td className={`py-3.5 px-4 text-xs ${textSecondary}`}>{masked ? '••••••' : cli.phone}</td>
                      <td className={`py-3.5 px-4 text-xs font-extrabold ${textPrimary}`}>{formatCurrency(cli.totalDevedor)}</td>
                      <td className="py-3.5 px-4 text-xs font-bold text-red-500">{formatCurrency(cli.totalVencido)}</td>
                      <td className={`py-3.5 px-4 text-xs font-bold ${textSecondary}`}>{masked ? '••' : cli.qtdAtrasadas}</td>
                      <td className="py-3.5 px-6 text-xs font-bold text-right text-amber-500">
                        {cli.maxDaysLate > 0 ? `${cli.maxDaysLate} dias` : 'Em dia'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          GAVETA LATERAL DE DETALHES DO CONTRATO ("PAPELZINHO")
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

              <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                selectedContract.status === 'Aberto'
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                  : 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30'
              }`}>
                {selectedContract.status}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {detailsTab === 'dados' && (
                <>
                  <div>
                    <span className={`text-xs block ${textSecondary}`}>Valor do contrato</span>
                    <h2 className={`text-3xl font-black mt-1 ${textPrimary}`}>
                      {formatCurrency(selectedContract.total)}
                    </h2>

                    <div className="mt-4">
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className={textSecondary}>{selectedContract.paidInst} de {selectedContract.totalInst} parcelas pagas</span>
                        <strong className="text-emerald-600 dark:text-emerald-400">{masked ? '••••••' : `${drawerProgress}%`}</strong>
                      </div>
                      <div className={`w-full h-2 rounded-full overflow-hidden ${isDark ? 'bg-[#121212]' : 'bg-slate-300'}`}>
                        <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${masked ? 0 : drawerProgress}%` }}></div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className={`border rounded-2xl p-4 ${bgSubtle}`}>
                      <span className={`text-xs block ${textSecondary}`}>Recebido</span>
                      <strong className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400 block mt-1">
                        {formatCurrency(drawerRecebido)}
                      </strong>
                      <span className={`text-[11px] ${textSecondary}`}>{selectedContract.paidInst} parcelas</span>
                    </div>

                    <div className={`border rounded-2xl p-4 ${bgSubtle}`}>
                      <span className={`text-xs block ${textSecondary}`}>Em aberto</span>
                      <strong className="text-lg font-extrabold text-blue-600 dark:text-blue-400 block mt-1">
                        {formatCurrency(selectedContract.total - drawerRecebido)}
                      </strong>
                      <span className={`text-[11px] ${textSecondary}`}>{drawerUnpaidInsts.length} parcelas</span>
                    </div>

                    <div className={`border rounded-2xl p-4 ${bgSubtle}`}>
                      <span className={`text-xs block ${textSecondary}`}>Em atraso</span>
                      <strong className={`text-lg font-extrabold block mt-1 ${textPrimary}`}>
                        {formatCurrency(drawerOverdueInsts.reduce((acc, curr) => acc + Number(curr.installment_value || 0), 0))}
                      </strong>
                      <span className={`text-[11px] ${textSecondary}`}>{drawerOverdueInsts.length} parcelas</span>
                    </div>

                    <div className={`border rounded-2xl p-4 ${bgSubtle}`}>
                      <span className={`text-xs block ${textSecondary}`}>Rentabilidade</span>
                      <strong className={`text-lg font-extrabold block mt-1 ${drawerRentabilidade >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                        {formatCurrency(drawerRentabilidade)}
                      </strong>
                      <span className={`text-[11px] ${textSecondary}`}>
                        {masked ? '••••••' : `${drawerRentabilidade >= 0 ? '+' : ''}${drawerRentabilidadePct.replace('.', ',')}% sobre o custo`}
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
                        <strong className={textPrimary}>{masked ? '••••••' : (selectedContract.clients?.phone || '-')}</strong>
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
                        <strong className={textPrimary}>{formatCurrency(selectedContract.custo)}</strong>
                      </div>
                      <div className="py-2.5 flex justify-between">
                        <span className={textSecondary}>Taxa aplicada</span>
                        <strong className={textPrimary}>{masked ? '••••••' : `${taxaAplicadaCalc}%`}</strong>
                      </div>
                      <div className="py-2.5 flex justify-between">
                        <span className={textSecondary}>Pagamento mínimo</span>
                        <strong className={textPrimary}>
                          {contractInstallments[0]?.minimum_value > 0 ? formatCurrency(contractInstallments[0].minimum_value) : '—'}
                        </strong>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {detailsTab === 'parcelas' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setInstallmentFilter('all')}
                      className={`px-3 py-1 rounded-full text-xs font-bold border transition ${
                        installmentFilter === 'all'
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/40'
                          : `${bgSubtle} ${textSecondary}`
                      }`}
                    >
                      Todas · {drawerTotalCount}
                    </button>
                    <button
                      onClick={() => setInstallmentFilter('paid')}
                      className={`px-3 py-1 rounded-full text-xs font-bold border transition ${
                        installmentFilter === 'paid'
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/40'
                          : `${bgSubtle} ${textSecondary}`
                      }`}
                    >
                      Pagas · {drawerPaidCount}
                    </button>
                    <button
                      onClick={() => setInstallmentFilter('unpaid')}
                      className={`px-3 py-1 rounded-full text-xs font-bold border transition ${
                        installmentFilter === 'unpaid'
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/40'
                          : `${bgSubtle} ${textSecondary}`
                      }`}
                    >
                      Não pagas · {drawerUnpaidInsts.length}
                    </button>
                  </div>

                  <div className="space-y-3">
                    {filteredDrawerInstallments.map((inst, idx) => {
                      const isPaid = inst.status === 'Pago';
                      const isOverdue = !isPaid && inst.due_date < todayStr;
                      return (
                        <div key={inst.id} className={`border rounded-2xl p-4 space-y-3 ${bgSubtle}`}>
                          <div className="flex justify-between items-center">
                            <strong className={`text-sm font-bold ${textPrimary}`}>Parcela #{idx + 1}</strong>
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

                          <div className="space-y-1 text-xs">
                            <div className="flex justify-between">
                              <span className={textSecondary}>Vencimento</span>
                              <strong className={textPrimary}>{formatDateBR(inst.due_date)}</strong>
                            </div>
                            <div className="flex justify-between">
                              <span className={textSecondary}>Valor</span>
                              <strong className={textPrimary}>{formatCurrency(inst.installment_value)}</strong>
                            </div>
                            <div className="flex justify-between">
                              <span className={textSecondary}>Pago</span>
                              <strong className={isPaid ? 'text-emerald-600 dark:text-emerald-400 font-bold' : textPrimary}>
                                {isPaid ? formatCurrency(inst.paid_value ?? inst.installment_value) : '-'}
                              </strong>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}