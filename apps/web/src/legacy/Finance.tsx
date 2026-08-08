import React, { useState, useEffect } from "react";
import { generateUUID } from "../lib/uuid";
import { Settings, Brain, ChevronRight, X, AlertTriangle, ShieldAlert } from "lucide-react";
import { getPatients, getAdministrativePatients, getSessions, getFinancials, addFinancial, updateFinancial, FinancialRecord, Patient, Session } from "../lib/workspace";
import { getPatientPackages, savePatientPackages, PatientPackage, setInMemoryPackages, planoToPackage, packageToPlano } from "../lib/packages";
import { Cobranca, Despesa, Plano, Pagamento } from "./finance/FinanceTypes";
import { getFinancialDataApi, saveCobrancaApi, savePagamentoApi, savePlanoApi, saveDespesaApi, saveFechamentoApi } from "../lib/financeApi";
import FinanceHoje from "./finance/FinanceHoje";
import FinanceRecebimentos from "./finance/FinanceRecebimentos";
import FinanceDespesas from "./finance/FinanceDespesas";
import FinanceRelatorios from "./finance/FinanceRelatorios";
import FechamentoWizard from "./finance/FechamentoWizard";
import FinanceReceipt from "./finance/FinanceReceipt";

interface FinanceProps {
  token: string | null;
  spreadsheetId?: string;
  profileName: string;
  profileSubtitle: string;
  profileCrp: string;
  profileCpf: string;
  profilePix: string;
  monthlyGoal: number;
  onFinanceSettingsUpdate: (goal: number, name: string, subtitle: string, crp: string, cpf: string, pix: string) => void;
  role?: string;
}

export default function Finance({
  token: propToken,
  spreadsheetId: propSpreadsheetId,
  profileName: propProfileName,
  profileSubtitle: propProfileSubtitle,
  profileCrp: propProfileCrp,
  profileCpf: propProfileCpf,
  profilePix: propProfilePix,
  monthlyGoal: propMonthlyGoal,
  onFinanceSettingsUpdate,
  role
}: FinanceProps) {
  const [activeTab, setActiveTab] = useState<"hoje" | "recebimentos" | "despesas" | "relatorios">("hoje");
  const [loading, setLoading] = useState(true);
  const [showAssistant, setShowAssistant] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showFechamento, setShowFechamento] = useState(false);
  const [activeReceipt, setActiveReceipt] = useState<{ cobranca: Cobranca; patientName: string } | null>(null);

  // Database States
  const [patients, setPatients] = useState<Patient[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [cobrancas, setCobrancas] = useState<Cobranca[]>([]);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [planos, setPlanos] = useState<Plano[]>([]);

  // Configuration / Goals State
  const [monthlyGoal, setMonthlyGoal] = useState<number>(propMonthlyGoal);
  const [profileName, setProfileName] = useState(propProfileName);
  const [profileSubtitle, setProfileSubtitle] = useState(propProfileSubtitle);
  const [profileCRP, setProfileCRP] = useState(propProfileCrp);
  const [profileCPF, setProfileCPF] = useState(propProfileCpf);
  const [profilePix, setProfilePix] = useState(propProfilePix);

  useEffect(() => {
    setMonthlyGoal(propMonthlyGoal);
    setProfileName(propProfileName);
    setProfileSubtitle(propProfileSubtitle);
    setProfileCRP(propProfileCrp);
    setProfileCPF(propProfileCpf);
    setProfilePix(propProfilePix);
  }, [propMonthlyGoal, propProfileName, propProfileSubtitle, propProfileCrp, propProfileCpf, propProfilePix]);

  const spreadsheetId = propSpreadsheetId || localStorage.getItem("serenapsi_spreadsheet_id") || "";
  const oauthToken = propToken || "";

  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    loadAllData();
  }, [spreadsheetId, oauthToken]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      // 1. Fetch patients & sessions
      let fetchedPatients: Patient[] = [];
      let fetchedSessions: Session[] = [];
      
      if (role === "secretary") {
        try {
          fetchedPatients = (await getAdministrativePatients()) as any[];
        } catch (err) {
          console.error("Error fetching administrative patients for secretary in Finance", err);
        }
      } else if (spreadsheetId && oauthToken) {
        try {
          fetchedPatients = await getPatients(spreadsheetId, oauthToken);
          fetchedSessions = await getSessions(spreadsheetId, oauthToken);
        } catch (err) {
          console.error("Error fetching patients/sessions from Sheets", err);
        }
      }
      setPatients(fetchedPatients);
      setSessions(fetchedSessions);

      // 2. Fetch official persistent data from Firestore API
      const apiData = await getFinancialDataApi();

      let currentCobrancas: Cobranca[] = apiData?.cobrancas || [];
      let currentPagamentos: Pagamento[] = apiData?.pagamentos || [];
      let currentDespesas: Despesa[] = apiData?.despesas || [];
      let currentPlanos: Plano[] = apiData?.planos || [];

      // 3. Sync & Merge with Google Sheets if configured
      let rawFinancials: FinancialRecord[] = [];
      if (spreadsheetId && oauthToken) {
        try {
          rawFinancials = await getFinancials(spreadsheetId, oauthToken);
        } catch (err) {
          console.error("Error fetching financials from sheets", err);
        }
      }

      // Map raw sheets entries if not present in Firestore
      rawFinancials.forEach(record => {
        if (record.tipo === "Receita") {
          const exists = currentCobrancas.some(c => c.id === record.id);
          if (!exists) {
            const mappedStatus = record.status === "Pago" ? "Paga" : record.status === "Parcial" ? "Parcialmente paga" : "Pendente";
            let mappedForma: Cobranca["forma_pagamento"] = "Pix";
            if (record.forma_pagamento === "Cartão") mappedForma = "Cartão de crédito";
            else if (record.forma_pagamento === "Dinheiro") mappedForma = "Dinheiro";
            else if (record.forma_pagamento === "Transferência") mappedForma = "Transferência";

            const valOrig = record.valor || 0;
            const desc = record.desconto || 0;
            const netVal = Math.max(0, valOrig - desc);

            currentCobrancas.push({
              id: record.id,
              paciente_id: record.paciente_id,
              responsavel_financeiro: "",
              origem: record.observacoes.includes("Plano") || record.observacoes.includes("Pacote") ? "Pacote" : "Sessão Avulsa",
              periodo_sessao_id: record.sessao_id || "",
              valor_original: valOrig,
              desconto: desc,
              acrescimo: 0,
              valor_pago: 0,
              saldo_restante: netVal,
              data_vencimento: record.data_vencimento,
              situacao: mappedStatus,
              forma_pagamento: mappedForma,
              situacao_recibo: record.recibo_url ? "Gerado" : "Não solicitado",
              situacao_nfse: "Não solicitada",
              observacoes: record.observacoes,
              legacyPartialAmountUnknown: record.status === "Parcial"
            });

            // If old record indicates FULL payment without payments record, create a migrated payment record
            if (record.status === "Pago") {
              currentPagamentos.push({
                id: generateUUID(),
                cobranca_id: record.id,
                paciente_id: record.paciente_id,
                valor_pago: netVal,
                data_pagamento: record.data_pagamento || record.data_vencimento || new Date().toISOString().split("T")[0],
                forma_pagamento: mappedForma,
                observacoes: "Pagamento migrado do histórico de planilhas",
                createdAt: new Date().toISOString()
              });
            }
          }
        } else if (record.tipo === "Despesa") {
          const exists = currentDespesas.some(d => d.id === record.id);
          if (!exists) {
            const mappedStatus = record.status === "Pago" ? "Paga" : "Pendente";
            currentDespesas.push({
              id: record.id,
              descricao: record.observacoes || "Despesa Clínica",
              valor: record.valor,
              data_vencimento: record.data_vencimento,
              categoria: record.sessao_id || "Outros Custos Clínicos",
              situacao: mappedStatus,
              recorrente: "Não",
              conta_pagamento: "Principal",
              competencia: record.data_vencimento ? record.data_vencimento.substring(5, 7) + "/" + record.data_vencimento.substring(0, 4) : "",
              centro_custo: "Clínica Geral",
              fornecedor: "Diverso",
              comprovante_url: record.recibo_url || "",
              observacoes: record.observacoes,
              parcelamento: "1/1"
            });
          }
        }
      });

      // 4. Calculate exact sums of payments for each cobranca
      const finalCobrancas = currentCobrancas.map(cob => {
        const relatedPays = currentPagamentos.filter(p => p.cobranca_id === cob.id);
        const paidSum = relatedPays.reduce((acc, p) => acc + (Number(p.valor_pago) || 0), 0);
        const netAmount = (Number(cob.valor_original) || 0) - (Number(cob.desconto) || 0) + (Number(cob.acrescimo) || 0);
        const balance = Math.max(0, netAmount - paidSum);

        let sit = cob.situacao;
        if (sit !== "Cancelada" && sit !== "Isenta ou Cortesia" && sit !== "Estornada") {
          if (paidSum <= 0) {
            sit = cob.legacyPartialAmountUnknown ? "Parcialmente paga" : "Pendente";
          } else if (paidSum < netAmount) {
            sit = "Parcialmente paga";
          } else {
            sit = "Paga";
          }
        }

        return {
          ...cob,
          valor_pago: paidSum,
          saldo_restante: balance,
          situacao: sit
        };
      });

      setCobrancas(finalCobrancas);
      setPagamentos(currentPagamentos);
      setDespesas(currentDespesas);

      // 5. Load packages/plans
      if (currentPlanos.length > 0) {
        setPlanos(currentPlanos);
        const pkgs: PatientPackage[] = currentPlanos.map(pl => {
          const pat = fetchedPatients.find(p => p.id === pl.paciente_id);
          return planoToPackage(pl, pat ? pat.nome_preferencial : "Paciente");
        });
        setInMemoryPackages(pkgs);
      } else {
        const activePackages = getPatientPackages();
        const mappedPlanos: Plano[] = activePackages.map(pkg => packageToPlano(pkg));
        setPlanos(mappedPlanos);
      }

    } catch (e) {
      console.error("Error loading data in Finance orchestrator", e);
    } finally {
      setLoading(false);
    }
  };

  // Actions
  const handleAddCobranca = async (cob: Cobranca) => {
    const success = await saveCobrancaApi(cob);
    if (!success) {
      alert("Erro ao salvar cobrança no servidor.");
      return;
    }
    const updated = [cob, ...cobrancas];
    setCobrancas(updated);

    if (spreadsheetId && oauthToken) {
      const sheetStatus = cob.situacao === "Paga" || cob.situacao === "Isenta ou Cortesia" ? "Pago" : cob.situacao === "Parcialmente paga" ? "Parcial" : "Pendente";
      const sheetForma = cob.forma_pagamento === "Cartão de crédito" || cob.forma_pagamento === "Cartão de débito" ? "Cartão" :
                         cob.forma_pagamento === "Dinheiro" ? "Dinheiro" :
                         cob.forma_pagamento === "Transferência" ? "Transferência" : "Pix";

      const record: FinancialRecord = {
        id: cob.id,
        paciente_id: cob.paciente_id,
        sessao_id: cob.periodo_sessao_id,
        tipo: "Receita",
        valor: cob.valor_original,
        status: sheetStatus,
        forma_pagamento: sheetForma,
        data_vencimento: cob.data_vencimento,
        data_pagamento: cob.situacao === "Paga" ? cob.data_vencimento : "",
        desconto: cob.desconto,
        observacoes: cob.observacoes,
        recibo_url: ""
      };
      addFinancial(spreadsheetId, record, oauthToken).catch(err => {
        console.warn("[Mirror Sync] Falha ao espelhar cobrança no Google Sheets:", err);
      });
    }
  };

  const handleUpdateCobranca = async (cob: Cobranca) => {
    const success = await saveCobrancaApi(cob);
    if (!success) {
      alert("Erro ao atualizar cobrança no servidor.");
      return;
    }
    const updated = cobrancas.map(c => c.id === cob.id ? cob : c);
    setCobrancas(updated);

    if (spreadsheetId && oauthToken) {
      const sheetStatus = cob.situacao === "Paga" || cob.situacao === "Isenta ou Cortesia" ? "Pago" : cob.situacao === "Parcialmente paga" ? "Parcial" : "Pendente";
      const sheetForma = cob.forma_pagamento === "Cartão de crédito" || cob.forma_pagamento === "Cartão de débito" ? "Cartão" :
                         cob.forma_pagamento === "Dinheiro" ? "Dinheiro" :
                         cob.forma_pagamento === "Transferência" ? "Transferência" : "Pix";

      const record: FinancialRecord = {
        id: cob.id,
        paciente_id: cob.paciente_id,
        sessao_id: cob.periodo_sessao_id,
        tipo: "Receita",
        valor: cob.valor_original,
        status: sheetStatus,
        forma_pagamento: sheetForma,
        data_vencimento: cob.data_vencimento,
        data_pagamento: cob.situacao === "Paga" ? new Date().toISOString().split("T")[0] : "",
        desconto: cob.desconto,
        observacoes: cob.observacoes,
        recibo_url: cob.situacao_recibo === "Gerado" ? "recibo_gerado" : ""
      };
      updateFinancial(spreadsheetId, record, oauthToken).catch(err => {
        console.warn("[Mirror Sync] Falha ao atualizar cobrança no Google Sheets:", err);
      });
    }
  };

  const handleAddPagamento = async (pay: Pagamento) => {
    const res = await savePagamentoApi(pay);
    if (!res.success) {
      alert(res.error || "Erro ao registrar pagamento no servidor.");
      return;
    }

    // Recalcular localmente de forma sincronizada
    const newPagamentos = [pay, ...pagamentos];
    setPagamentos(newPagamentos);

    const relatedCob = cobrancas.find(c => c.id === pay.cobranca_id);
    if (relatedCob) {
      const relatedPays = newPagamentos.filter(p => p.cobranca_id === pay.cobranca_id);
      const paidSum = relatedPays.reduce((acc, p) => acc + (Number(p.valor_pago) || 0), 0);
      const netAmount = (Number(relatedCob.valor_original) || 0) - (Number(relatedCob.desconto) || 0) + (Number(relatedCob.acrescimo) || 0);
      const balance = Math.max(0, netAmount - paidSum);

      let sit = relatedCob.situacao;
      if (sit !== "Cancelada" && sit !== "Isenta ou Cortesia" && sit !== "Estornada") {
        if (paidSum >= netAmount) {
          sit = "Paga";
        } else if (paidSum > 0) {
          sit = "Parcialmente paga";
        } else {
          sit = "Pendente";
        }
      }

      const updatedCob: Cobranca = {
        ...relatedCob,
        valor_pago: paidSum,
        saldo_restante: balance,
        situacao: sit
      };

      const updatedCobrancas = cobrancas.map(c => c.id === pay.cobranca_id ? updatedCob : c);
      setCobrancas(updatedCobrancas);

      if (spreadsheetId && oauthToken) {
        const sheetStatus = sit === "Paga" ? "Pago" : sit === "Parcialmente paga" ? "Parcial" : "Pendente";
        const record: FinancialRecord = {
          id: updatedCob.id,
          paciente_id: updatedCob.paciente_id,
          sessao_id: updatedCob.periodo_sessao_id,
          tipo: "Receita",
          valor: updatedCob.valor_original,
          status: sheetStatus,
          forma_pagamento: pay.forma_pagamento === "Cartão" ? "Cartão" : pay.forma_pagamento === "Dinheiro" ? "Dinheiro" : "Pix",
          data_vencimento: updatedCob.data_vencimento,
          data_pagamento: pay.data_pagamento,
          desconto: updatedCob.desconto,
          observacoes: updatedCob.observacoes,
          recibo_url: ""
        };
        updateFinancial(spreadsheetId, record, oauthToken).catch(err => {
          console.warn("[Mirror Sync] Falha ao atualizar no Google Sheets:", err);
        });
      }
    }
  };

  const handleAddDespesa = async (desp: Despesa) => {
    const success = await saveDespesaApi(desp);
    if (!success) {
      alert("Erro ao salvar despesa no servidor.");
      return;
    }
    const updated = [desp, ...despesas];
    setDespesas(updated);

    if (spreadsheetId && oauthToken) {
      const sheetStatus = desp.situacao === "Paga" ? "Pago" : "Pendente";
      const record: FinancialRecord = {
        id: desp.id,
        paciente_id: "DESPESA_CLINICA",
        sessao_id: desp.categoria,
        tipo: "Despesa",
        valor: desp.valor,
        status: sheetStatus,
        forma_pagamento: "Pix",
        data_vencimento: desp.data_vencimento,
        data_pagamento: desp.situacao === "Paga" ? desp.data_vencimento : "",
        desconto: 0,
        observacoes: desp.descricao,
        recibo_url: ""
      };
      addFinancial(spreadsheetId, record, oauthToken).catch(err => {
        console.warn("[Mirror Sync] Falha ao salvar despesa no Google Sheets:", err);
      });
    }
  };

  const handleUpdateDespesa = async (desp: Despesa) => {
    const success = await saveDespesaApi(desp);
    if (!success) {
      alert("Erro ao atualizar despesa no servidor.");
      return;
    }
    const updated = despesas.map(d => d.id === desp.id ? desp : d);
    setDespesas(updated);

    if (spreadsheetId && oauthToken) {
      const sheetStatus = desp.situacao === "Paga" ? "Pago" : "Pendente";
      const record: FinancialRecord = {
        id: desp.id,
        paciente_id: "DESPESA_CLINICA",
        sessao_id: desp.categoria,
        tipo: "Despesa",
        valor: desp.valor,
        status: sheetStatus,
        forma_pagamento: "Pix",
        data_vencimento: desp.data_vencimento,
        data_pagamento: desp.situacao === "Paga" ? new Date().toISOString().split("T")[0] : "",
        desconto: 0,
        observacoes: desp.descricao,
        recibo_url: ""
      };
      updateFinancial(spreadsheetId, record, oauthToken).catch(err => {
        console.warn("[Mirror Sync] Falha ao atualizar despesa no Google Sheets:", err);
      });
    }
  };

  const handleAddPlano = async (p: Plano) => {
    const success = await savePlanoApi(p);
    if (!success) {
      alert("Erro ao salvar plano no servidor.");
      return;
    }
    const updated = [p, ...planos];
    setPlanos(updated);

    const pat = patients.find(pat => pat.id === p.paciente_id);
    const pkg = planoToPackage(p, pat ? pat.nome_preferencial : "Paciente");
    const packages = getPatientPackages();
    const idx = packages.findIndex(pk => pk.patientId === p.paciente_id);
    if (idx === -1) {
      packages.push(pkg);
    } else {
      packages[idx] = pkg;
    }
    savePatientPackages(packages);
  };

  const handleUpdatePlano = async (p: Plano) => {
    const success = await savePlanoApi(p);
    if (!success) {
      alert("Erro ao atualizar plano no servidor.");
      return;
    }
    const updated = planos.map(pl => pl.id === p.id ? p : pl);
    setPlanos(updated);

    const pat = patients.find(pat => pat.id === p.paciente_id);
    const pkg = planoToPackage(p, pat ? pat.nome_preferencial : "Paciente");
    const packages = getPatientPackages();
    const idx = packages.findIndex(pk => pk.patientId === p.paciente_id);
    if (idx !== -1) {
      packages[idx] = pkg;
      savePatientPackages(packages);
    }
  };

  // WhatsApp Billing reminders generator
  const handleOpenCobrar = (cob: Cobranca) => {
    const pat = patients.find(p => p.id === cob.paciente_id);
    const pName = pat ? pat.nome_preferencial : "Paciente";
    const pPhone = pat ? pat.contato_telefone : "";

    const messageText = `Olá, ${pName}! Tudo bem com você? Passando com carinho para lembrar do acerto referente à nossa sessão. O valor de R$ ${cob.valor_original.toFixed(2)} está agendado para o dia ${new Date(cob.data_vencimento).toLocaleDateString("pt-BR")}. Se for melhor para você, pode efetuar o pagamento via Pix. Minha chave Pix é: ${profilePix}. Fico à disposição se precisar de algo!`;

    const encodedMessage = encodeURIComponent(messageText);
    const cleanPhone = pPhone.replace(/\D/g, "");
    const waUrl = cleanPhone ? `https://wa.me/55${cleanPhone}?text=${encodedMessage}` : `https://wa.me/?text=${encodedMessage}`;

    const updated: Cobranca = { ...cob, situacao_recibo: "Enviado" };
    handleUpdateCobranca(updated);

    window.open(waUrl, "_blank");
  };

  // Close clinical month confirmation
  const handleConfirmFechamento = async (resumoJson: string) => {
    const fechamentoPayload = {
      id: generateUUID(),
      competencia: `${String(currentMonth).padStart(2, "0")}/${currentYear}`,
      data_fechamento: new Date().toISOString(),
      resumo_json: resumoJson,
      usuario: profileName,
      situacao: "Fechado" as const
    };

    await saveFechamentoApi(fechamentoPayload);
    setShowFechamento(false);
    alert("Competência encerrada e dados consolidados com sucesso!");
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    onFinanceSettingsUpdate(
      Number(monthlyGoal),
      profileName,
      profileSubtitle,
      profileCRP,
      profileCPF,
      profilePix
    );
    setShowSettings(false);
  };

  // Summarize metrics for Gemini API
  const getFinancialSummaryText = () => {
    const totalReceived = cobrancas.filter(c => c.situacao === "Paga").reduce((sum, curr) => sum + curr.valor_pago, 0);
    const totalDespesas = despesas.filter(d => d.situacao === "Paga").reduce((sum, curr) => sum + curr.valor, 0);
    return `Mês analisado: ${currentMonth}/${currentYear}. Total recebido de faturamento clínico: R$ ${totalReceived.toFixed(2)}. Total despesas pagas: R$ ${totalDespesas.toFixed(2)}. Saldo de caixa líquido: R$ ${(totalReceived - totalDespesas).toFixed(2)}. Metas mensais configuradas: R$ ${monthlyGoal}. Total de cobranças em atraso atualmente: ${cobrancas.filter(c => c.situacao === "Atrasada").length} faturas.`;
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden text-slate-950 font-sans">
      
      {/* Primary Area Container */}
      <div className="flex-1 flex flex-col overflow-y-auto">
        
        {/* Module Header */}
        <div className="bg-white border-b border-slate-150 px-6 py-5 flex justify-between items-center shrink-0">
          <div>
            <h1 className="font-serif font-bold text-2xl tracking-tight text-slate-900">Financeiro</h1>
            <p className="text-xs text-slate-400 font-sans">Gestão simplificada e faturamento clínico sem complexidade</p>
          </div>

          <div className="flex items-center space-x-2">
            {/* Quick Settings Icon */}
            <button
              onClick={() => setShowSettings(true)}
              className="p-2.5 bg-slate-50 border border-slate-200 text-slate-600 rounded-2xl hover:bg-slate-100 transition shadow-sm cursor-pointer"
              title="Configurações Financeiras"
            >
              <Settings size={16} />
            </button>
          </div>
        </div>

        {/* Navigation Tabs bar */}
        <div className="bg-white px-6 py-2 border-b border-slate-100 flex gap-4 shrink-0 overflow-x-auto">
          {[
            { id: "hoje", label: "Hoje" },
            { id: "recebimentos", label: "Recebimentos" },
            { id: "despesas", label: "Despesas" },
            { id: "relatorios", label: "Relatórios" }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`pb-2.5 pt-1 border-b-2 text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                activeTab === tab.id ? "border-emerald-800 text-emerald-800 font-bold" : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Dynamic Inner Panel Body */}
        <div className="p-6 flex-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 space-y-3">
              <div className="w-10 h-10 border-4 border-emerald-800 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-semibold text-slate-500">Conectando ao Google Sheets...</p>
            </div>
          ) : (
            <>
              {activeTab === "hoje" && (
                <FinanceHoje
                  cobrancas={cobrancas}
                  despesas={despesas}
                  sessions={sessions}
                  patients={patients}
                  onOpenReceivePayment={() => setActiveTab("recebimentos")}
                  onOpenAddExpense={() => setActiveTab("despesas")}
                  onOpenFechamento={() => setShowFechamento(true)}
                  onOpenCobrar={handleOpenCobrar}
                  monthlyGoal={monthlyGoal}
                  currentMonth={currentMonth}
                  currentYear={currentYear}
                />
              )}

              {activeTab === "recebimentos" && (
                <FinanceRecebimentos
                  cobrancas={cobrancas}
                  pagamentos={pagamentos}
                  planos={planos}
                  patients={patients}
                  onAddCobranca={handleAddCobranca}
                  onUpdateCobranca={handleUpdateCobranca}
                  onAddPlano={handleAddPlano}
                  onUpdatePlano={handleUpdatePlano}
                  onAddPagamento={handleAddPagamento}
                  onOpenReceipt={(cob, pName) => setActiveReceipt({ cobranca: cob, patientName: pName })}
                  onOpenCobrar={handleOpenCobrar}
                />
              )}

              {activeTab === "despesas" && (
                <FinanceDespesas
                  despesas={despesas}
                  onAddDespesa={handleAddDespesa}
                  onUpdateDespesa={handleUpdateDespesa}
                />
              )}

              {activeTab === "relatorios" && (
                <FinanceRelatorios
                  cobrancas={cobrancas}
                  despesas={despesas}
                  currentMonth={currentMonth}
                  currentYear={currentYear}
                />
              )}
            </>
          )}
        </div>

      </div>

      {/* RENDER DYNAMIC SIDEBARS & OVERLAYS */}

      {/* Guided Month Closure Wizard Modal */}
      {showFechamento && (
        <FechamentoWizard
          onClose={() => setShowFechamento(false)}
          onConfirm={handleConfirmFechamento}
          cobrancas={cobrancas}
          despesas={despesas}
          sessions={sessions}
          patients={patients}
          currentMonth={currentMonth}
          currentYear={currentYear}
        />
      )}

      {/* Printable Receipt Overlay */}
      {activeReceipt && (
        <FinanceReceipt
          onClose={() => setActiveReceipt(null)}
          cobranca={activeReceipt.cobranca}
          patientName={activeReceipt.patientName}
        />
      )}

      {/* Module Configuration Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <form onSubmit={handleSaveSettings} className="bg-white rounded-3xl w-full max-w-md shadow-xl overflow-hidden font-sans text-xs flex flex-col">
            <div className="bg-emerald-950 text-white px-5 py-4 flex justify-between items-center">
              <h4 className="font-serif font-bold text-sm">Configurações de Faturamento</h4>
              <button type="button" onClick={() => setShowSettings(false)} className="text-emerald-200 hover:text-white transition cursor-pointer">
                <X size={16} />
              </button>
            </div>
            
            <div className="p-5 space-y-4">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Meta Financeira Mensal (R$)</label>
                <input
                  type="number"
                  value={monthlyGoal}
                  onChange={e => setMonthlyGoal(Number(e.target.value))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2"
                  required
                />
              </div>

              <div className="border-t border-slate-100 pt-3 space-y-3">
                <p className="font-bold text-slate-800 text-[10px] uppercase tracking-wider">Dados Clínicos para Emissão de Recibo</p>
                
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">Nome do Profissional</label>
                  <input
                    type="text"
                    value={profileName}
                    onChange={e => setProfileName(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">Subtítulo do Cabeçalho</label>
                  <input
                    type="text"
                    value={profileSubtitle}
                    onChange={e => setProfileSubtitle(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block">Registro CRP</label>
                    <input
                      type="text"
                      value={profileCRP}
                      onChange={e => setProfileCRP(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block">CPF do Profissional</label>
                    <input
                      type="text"
                      value={profileCPF}
                      onChange={e => setProfileCPF(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-1 mt-2">
                  <label className="font-bold text-slate-700 block">Chave PIX</label>
                  <input
                    type="text"
                    value={profilePix}
                    onChange={e => setProfilePix(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2"
                    placeholder="Celular, CPF, E-mail ou Aleatória"
                  />
                </div>
              </div>
            </div>

            <div className="bg-slate-50 px-5 py-3 flex justify-end gap-2 border-t border-slate-100">
              <button type="button" onClick={() => setShowSettings(false)} className="px-4 py-2 border border-slate-250 text-slate-600 rounded-xl font-bold cursor-pointer">
                Cancelar
              </button>
              <button type="submit" className="px-5 py-2 bg-emerald-800 text-white hover:bg-emerald-900 rounded-xl font-bold shadow transition cursor-pointer">
                Salvar Configurações
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
