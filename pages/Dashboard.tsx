
import React, { useState, useMemo, useEffect } from 'react';
import { db } from '../services/store';
import { Users, Calendar, AlertTriangle, Search, Clock, UserMinus, ShieldCheck, BookOpen, PlusCircle, MinusCircle, History, X, Save, Trash2, ChevronRight, ArrowLeft, TrendingUp, TrendingDown, Wallet, ArrowRight, Activity, FileText, Layers, FileSpreadsheet, Eye, Printer, Info, Wand2, Filter, BarChart3, Medal, ListOrdered, CheckCircle2, RotateCw } from 'lucide-react';
import { Rank, Status, Role, Soldier, BankTransaction, Roster, Cadre, ExtraDutyHistory } from '../types';
import * as Icons from 'lucide-react';
import { PrintPreview } from '../components/pdf/PrintPreview';

// Helper para ordenação de patentes (mesmo do RosterManager para consistência)
const getRankWeight = (rank: string) => {
  const map: Record<string, number> = {
    [Rank.CEL]: 1, 
    [Rank.TEN_CEL]: 2, 
    [Rank.MAJ]: 3, 
    [Rank.CAP]: 4, 
    [Rank.TEN_1]: 5, 
    [Rank.TEN_2]: 6,
    [Rank.ASP]: 7, 
    [Rank.SUBTEN]: 8, 
    [Rank.SGT_1]: 9, 
    [Rank.SGT_2]: 10, 
    [Rank.SGT_3]: 11,
    [Rank.CB]: 12, 
    [Rank.SD]: 13, 
    [Rank.CIVIL]: 14
  };
  return map[rank] || 99;
};

export const Dashboard: React.FC = () => {
  const [soldiers, setSoldiers] = useState<Soldier[]>([]);
  const [rosters, setRosters] = useState<Roster[]>([]);
  const settings = db.getSettings();
  const currentUser = db.getCurrentUser();
  const isAdmin = currentUser.role === 'ADMIN';

  // --- SYNC WITH FIREBASE ---
  useEffect(() => {
    const loadData = () => {
      setSoldiers(db.getSoldiers());
      setRosters(db.getRosters());
    };
    loadData(); // Initial load
    return db.subscribe(loadData); // Update on change
  }, []);

  const activeCount = soldiers.filter(s => s.status === 'Ativo').length;
  const awayCount = soldiers.filter(s => s.status !== 'Ativo').length;

  const [simDate, setSimDate] = useState('');
  const [simResult, setSimResult] = useState<any>(null);

  // --- ESTADOS DO MODAL DE ESCALAS GERADAS ---
  const [isRosterListOpen, setIsRosterListOpen] = useState(false);
  const [rosterSearch, setRosterSearch] = useState('');
  const [viewingRoster, setViewingRoster] = useState<Roster | null>(null);

  // --- ESTADOS DO MODAL DE RANK (QUANTITATIVO) ---
  const [isRankModalOpen, setIsRankModalOpen] = useState(false);

  // --- ESTADOS DO BANCO DE FOLGAS ---
  const [isBankModalOpen, setIsBankModalOpen] = useState(false);
  const [selectedSoldierForBank, setSelectedSoldierForBank] = useState<Soldier | null>(null);
  const [bankSearchTerm, setBankSearchTerm] = useState('');
  
  // --- ESTADOS DA FILA EXTRA ---
  const [isExtraDutyModalOpen, setIsExtraDutyModalOpen] = useState(false);
  const [extraDutyCount, setExtraDutyCount] = useState(1);
  const [previewExtraList, setPreviewExtraList] = useState<Soldier[]>([]);
  const [extraDutyDate, setExtraDutyDate] = useState(new Date().toISOString().split('T')[0]);

  // Estado da Busca Interna do Histórico
  const [historySearchTerm, setHistorySearchTerm] = useState('');
  const [isHistorySearchOpen, setIsHistorySearchOpen] = useState(false);

  const [bankForm, setBankForm] = useState({
    type: 'CREDIT' as 'CREDIT' | 'DEBIT',
    date: new Date().toISOString().split('T')[0],
    description: '',
    amount: 1
  });

  // Atualiza simulador automaticamente quando a data muda
  useEffect(() => {
    if (simDate) {
      calculateShift();
    } else {
      setSimResult(null);
    }
  }, [simDate, soldiers, rosters]); // Re-calculate when data changes

  // Função auxiliar para calcular saldo total
  const calculateBalance = (history: BankTransaction[] | undefined) => {
    if (!history) return 0;
    const credits = history.filter(t => t.type === 'CREDIT').reduce((acc, curr) => acc + (curr.amount || 1), 0);
    const debits = history.filter(t => t.type === 'DEBIT').reduce((acc, curr) => acc + (curr.amount || 1), 0);
    return credits - debits;
  };

  const getBankStats = (history: BankTransaction[] | undefined) => {
    if (!history) return { credits: 0, debits: 0 };
    const credits = history.filter(t => t.type === 'CREDIT').reduce((acc, curr) => acc + (curr.amount || 1), 0);
    const debits = history.filter(t => t.type === 'DEBIT').reduce((acc, curr) => acc + (curr.amount || 1), 0);
    return { credits, debits };
  };

  // Definições de Grupos
  const officerRanks = [Rank.CEL, Rank.TEN_CEL, Rank.MAJ, Rank.CAP, Rank.TEN_1, Rank.TEN_2];
  const specialRanks = [Rank.ASP]; 
  const enlistedRanks = [Rank.SUBTEN, Rank.SGT_1, Rank.SGT_2, Rank.SGT_3, Rank.CB, Rank.SD];

  // Filtra lista de soldados por grupos e quadros
  const officerStats = useMemo(() => {
    const filterByCadre = (cadre: string) => 
      soldiers.filter(s => officerRanks.includes(s.rank) && s.cadre === cadre).length;

    // Se o quadro não estiver definido, assumimos 'QOPM' como fallback ou listamos como 'Indefinido' (para dados antigos)
    const qopm = filterByCadre(Cadre.QOPM);
    const qoapm = filterByCadre(Cadre.QOAPM);
    const qocpm = filterByCadre(Cadre.QOCPM);
    const others = soldiers.filter(s => officerRanks.includes(s.rank) && !s.cadre).length; // Legado

    return { qopm, qoapm, qocpm, others };
  }, [soldiers]);

  // Contagem Simples por Patente (para exibição detalhada)
  const rankStats = useMemo(() => {
    const counts: Record<string, number> = {};
    soldiers.forEach(s => {
      counts[s.rank] = (counts[s.rank] || 0) + 1;
    });
    return counts;
  }, [soldiers]);

  const countGroup = (ranks: string[]) => ranks.reduce((acc, r) => acc + (rankStats[r] || 0), 0);

  // Processa o histórico para adicionar saldo corrente linha a linha
  const processedHistory = useMemo(() => {
    if (!selectedSoldierForBank?.bankHistory) return [];
    
    // Ordena por data (Antigo -> Novo) para calcular saldo progressivo
    const sorted = [...selectedSoldierForBank.bankHistory].sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        if (dateA !== dateB) return dateA - dateB;
        return new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime();
    });

    let runningBalance = 0;
    const withBalance = sorted.map(t => {
        const amt = t.amount || 1;
        if (t.type === 'CREDIT') runningBalance += amt;
        else runningBalance -= amt;
        return { ...t, balanceAfter: runningBalance };
    });

    // Inverte para exibir (Novo -> Antigo)
    const reversed = withBalance.reverse();

    // Filtra se houver termo de busca no histórico
    if (historySearchTerm.trim()) {
      const term = historySearchTerm.toLowerCase();
      return reversed.filter(t => 
        t.description.toLowerCase().includes(term) || 
        new Date(t.date).toLocaleDateString().includes(term) ||
        (t.type === 'CREDIT' ? 'aquisição' : 'baixa').includes(term)
      );
    }

    return reversed;
  }, [selectedSoldierForBank, historySearchTerm]);

  // Lista Filtrada de Escalas
  const filteredRosters = useMemo(() => {
    const term = rosterSearch.toLowerCase();
    return rosters.filter(r => 
      r.title.toLowerCase().includes(term) || 
      new Date(r.startDate).toLocaleDateString().includes(term)
    ).sort((a, b) => new Date(b.creationDate || 0).getTime() - new Date(a.creationDate || 0).getTime());
  }, [rosters, rosterSearch]);

  const handleSaveTransaction = () => {
    if (!selectedSoldierForBank) return;
    if (!bankForm.description.trim()) return alert("Informe o motivo/descrição.");

    const newTransaction: BankTransaction = {
      id: Date.now().toString(),
      type: bankForm.type,
      date: bankForm.date,
      description: bankForm.description,
      amount: bankForm.amount,
      recordedAt: new Date().toISOString()
    };

    const updatedHistory = [...(selectedSoldierForBank.bankHistory || []), newTransaction];
    const updatedSoldier = { ...selectedSoldierForBank, bankHistory: updatedHistory };
    
    db.saveSoldier(updatedSoldier);
    
    // Atualiza estados locais
    // NOTE: setSoldiers is now handled by the listener, but for immediate UI feedback we can set it here too
    // However, since db.saveSoldier notifies listeners, it should be automatic.
    // We do need to update selectedSoldierForBank though to show new history immediately
    setSelectedSoldierForBank(updatedSoldier);
    
    // Reset form parcial
    setBankForm(prev => ({ ...prev, description: '' }));
  };

  const handleDeleteTransaction = (tId: string) => {
    if (!selectedSoldierForBank) return;
    if (!confirm("Deseja excluir este registro do histórico?")) return;

    const updatedHistory = (selectedSoldierForBank.bankHistory || []).filter(t => t.id !== tId);
    const updatedSoldier = { ...selectedSoldierForBank, bankHistory: updatedHistory };

    db.saveSoldier(updatedSoldier);
    setSelectedSoldierForBank(updatedSoldier);
  };

  const filteredSoldiersBank = useMemo(() => {
    return soldiers.filter(s => 
      s.name.toLowerCase().includes(bankSearchTerm.toLowerCase()) || 
      s.matricula?.includes(bankSearchTerm)
    ).sort((a,b) => calculateBalance(b.bankHistory) - calculateBalance(a.bankHistory)); // Ordena por quem tem mais folgas
  }, [soldiers, bankSearchTerm]);

  // --- LÓGICA DA FILA EXTRA ---
  const sortedExtraQueue = useMemo(() => {
    // 1. Pega todos, filtra quem não está disponível explicitamente no cadastro (availableForExtra === false)
    // Se undefined, assume true.
    return soldiers
      .filter(s => s.availableForExtra !== false)
      .sort((a, b) => (a.orderExtra || 0) - (b.orderExtra || 0));
  }, [soldiers]);

  const handleGenerateExtraList = () => {
    // 1. Filtrar disponíveis na prática (quem não está de férias/LTS/Afastado e quem tem flag available)
    const candidates = sortedExtraQueue.filter(s => s.status === Status.ATIVO);
    
    // 2. Pegar os top N
    const selected = candidates.slice(0, extraDutyCount);
    
    if (selected.length === 0) {
      alert("Nenhum militar disponível encontrado para a quantidade solicitada.");
      return;
    }
    
    setPreviewExtraList(selected);
  };

  const handleConfirmExtraList = () => {
    if (previewExtraList.length === 0) return;
    
    if (!confirm(`Confirma a escala de ${previewExtraList.length} militares? Eles serão movidos para o final da fila.`)) return;

    // 1. Encontrar o maior orderExtra atual em TODO o banco
    const currentMax = Math.max(...soldiers.map(s => s.orderExtra || 0), 0);
    
    let nextOrder = currentMax + 1;
    const updatedSoldiers = [...soldiers];

    previewExtraList.forEach(escalado => {
       const idx = updatedSoldiers.findIndex(s => s.id === escalado.id);
       if (idx >= 0) {
          updatedSoldiers[idx] = { 
             ...updatedSoldiers[idx], 
             orderExtra: nextOrder 
          };
          nextOrder++;
       }
    });

    // 2. Salvar log de histórico
    const historyEntry: ExtraDutyHistory = {
       id: Date.now().toString(),
       date: new Date().toISOString(),
       rosterDate: extraDutyDate,
       amount: previewExtraList.length,
       soldierNames: previewExtraList.map(s => `${s.rank} ${s.name}`)
    };
    db.saveExtraDutyHistory(historyEntry);

    // 3. Salvar todos os soldados atualizados
    // Idealmente faria um batch update, mas aqui fazemos loop por simplicidade do mock
    updatedSoldiers.forEach(s => db.saveSoldier(s)); // Isso vai disparar o listener e atualizar a UI

    setPreviewExtraList([]);
    alert("Escala confirmada! Fila rotacionada com sucesso.");
  };

  const handleResetExtraQueue = () => {
    if (!isAdmin) return;
    if (!confirm("ATENÇÃO: Isso irá reiniciar a ordem de TODOS os militares baseando-se na antiguidade (Posto/Graduação + Nome). Deseja continuar?")) return;

    const sortedByRank = [...soldiers].sort((a, b) => {
       const wA = getRankWeight(a.rank);
       const wB = getRankWeight(b.rank);
       if (wA !== wB) return wA - wB;
       return a.name.localeCompare(b.name);
    });

    sortedByRank.forEach((s, index) => {
       const updated = { ...s, orderExtra: index + 1 };
       db.saveSoldier(updated);
    });
    
    alert("Fila reiniciada por antiguidade.");
  };

  // --- FIM LÓGICA FILA EXTRA ---

  // Função auxiliar para calcular índice do ciclo
  const getCycleIndex = (targetDateStr: string, refDateStr: string) => {
    const refDate = new Date(refDateStr + 'T12:00:00');
    const targetDate = new Date(targetDateStr + 'T12:00:00');
    const diffTime = targetDate.getTime() - refDate.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    return ((diffDays % 4) + 4) % 4;
  };

  const calculateShift = () => {
    if (!simDate) return;
    
    const targetDate = new Date(simDate + 'T12:00:00');
    const targetDateStr = simDate; 
    const refDateStr = settings.shiftCycleRefDate;

    if (isNaN(targetDate.getTime())) return;

    // CÁLCULO DO ÍNDICE DO CICLO DE 4 DIAS (0, 1, 2, 3) PARA A DATA ALVO
    const cycleIndex = getCycleIndex(targetDateStr, refDateStr);
    
    // --- LÓGICA BLOCO #1: ESCALA 24H x 72H (ALFA, BRAVO, CHARLIE, DELTA) ---
    const teams24Defs = [
      { name: 'ALFA', color: 'bg-blue-100 text-blue-800 border-blue-200' },   
      { name: 'BRAVO', color: 'bg-green-100 text-green-800 border-green-200' }, 
      { name: 'CHARLIE', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' }, 
      { name: 'DELTA', color: 'bg-purple-100 text-purple-800 border-purple-200' }    
    ];

    // --- LÓGICA BLOCO #2: ESCALA 2x2 (TURMA 01, TURMA 02) ---
    const teams2x2Defs = [
      { name: 'TURMA 01', color: 'bg-orange-100 text-orange-800 border-orange-200' },
      { name: 'TURMA 02', color: 'bg-teal-100 text-teal-800 border-teal-200' }
    ];

    // Determina qual Turma está ativa no dia (0 ou 1)
    const team2x2Index = (cycleIndex === 0 || cycleIndex === 1) ? 0 : 1;

    // Equipes Teóricas
    const currentTeam24Info = teams24Defs[cycleIndex];
    const currentTeam2x2Info = teams2x2Defs[team2x2Index];

    // --- 1. TENTATIVA: BUSCAR ESCALA EXATA (REAL) ---
    const activeRoster = rosters
      .sort((a,b) => new Date(b.creationDate || 0).getTime() - new Date(a.creationDate || 0).getTime())
      .find(r => 
         r.type === 'cat_amb' && // Focado em Escala Ambulância (cat_amb)
         targetDateStr >= r.startDate && 
         targetDateStr <= r.endDate
      );

    let members24: Soldier[] = [];
    let members2x2: Soldier[] = [];
    let source = '';
    let sourceColor = '';
    let isTheoretical = false;
    let isProjection = false;

    if (activeRoster) {
        // --- CENÁRIO A: ESCALA EXISTE E ESTÁ PREENCHIDA ---
        source = 'ESCALA GERADA';
        sourceColor = 'bg-green-100 text-green-800 border-green-200';
        
        const shifts = activeRoster.shifts.filter(s => s.date === targetDateStr);
        const section0 = activeRoster.sections?.[0]; // 24H
        const section1 = activeRoster.sections?.[1]; // 2X2
        
        const rowIdsSec0 = section0 ? section0.rows.map(r => r.id) : [];
        const rowIdsSec1 = section1 ? section1.rows.map(r => r.id) : [];

        members24 = shifts
            .filter(s => rowIdsSec0.includes(s.period))
            .map(s => soldiers.find(sold => sold.id === s.soldierId))
            .filter(Boolean) as Soldier[];

        members2x2 = shifts
            .filter(s => rowIdsSec1.includes(s.period))
            .map(s => soldiers.find(sold => sold.id === s.soldierId))
            .filter(Boolean) as Soldier[];

    } else {
        // --- CENÁRIO B: NÃO TEM ESCALA. TENTAR PROJEÇÃO PELA ÚLTIMA ESCALA ---
        
        // Buscar a última escala válida de Ambulância
        const lastRoster = rosters
           .filter(r => r.type === 'cat_amb')
           .sort((a,b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime())[0];

        if (lastRoster) {
           source = 'PROJEÇÃO (BASEADA NA ÚLTIMA ESCALA)';
           sourceColor = 'bg-blue-100 text-blue-800 border-blue-200';
           isProjection = true;
           isTheoretical = true;

           // Mapear quem trabalhou em quais equipes na última escala
           const projected24h: Record<number, Set<string>> = { 0: new Set(), 1: new Set(), 2: new Set(), 3: new Set() }; // Indices 0-3 (Alfa-Delta)
           const projected2x2: Record<number, Set<string>> = { 0: new Set(), 1: new Set() }; // Indices 0-1 (T1-T2)

           const section0 = lastRoster.sections?.[0]; // 24H
           const section1 = lastRoster.sections?.[1]; // 2X2
           const rowIdsSec0 = section0 ? section0.rows.map(r => r.id) : [];
           const rowIdsSec1 = section1 ? section1.rows.map(r => r.id) : [];

           lastRoster.shifts.forEach(shift => {
               if (!shift.soldierId) return;
               
               // Calcular qual era a equipe deste dia específico na escala passada
               const idx = getCycleIndex(shift.date, refDateStr);
               
               // Adicionar aos conjuntos de projeção
               if (rowIdsSec0.includes(shift.period)) {
                   projected24h[idx].add(shift.soldierId);
               }
               
               // Para 2x2: Se idx é 0 ou 1, é Turma 01. Se 2 ou 3, é Turma 02.
               const tIdx = idx < 2 ? 0 : 1;
               if (rowIdsSec1.includes(shift.period)) {
                   projected2x2[tIdx].add(shift.soldierId);
               }
           });

           // Agora, selecionar os membros baseados no ciclo da DATA FUTURA (targetDate)
           // Usando os conjuntos que populamos com dados passados
           const projIds24 = Array.from(projected24h[cycleIndex] || []);
           const projIds2x2 = Array.from(projected2x2[team2x2Index] || []);

           members24 = projIds24.map(id => soldiers.find(s => s.id === id)).filter(Boolean) as Soldier[];
           members2x2 = projIds2x2.map(id => soldiers.find(s => s.id === id)).filter(Boolean) as Soldier[];

           // Se por acaso a projeção vier vazia (ex: ninguém escalado no dia correspondente da última escala), 
           // fazemos fallback para o cadastro fixo apenas para não mostrar vazio
           if (members24.length === 0) {
              members24 = soldiers.filter(s => s.team === currentTeam24Info.name && s.status === 'Ativo');
           }
           if (members2x2.length === 0) {
              members2x2 = soldiers.filter(s => s.team === currentTeam2x2Info.name && s.status === 'Ativo');
           }

        } else {
           // --- CENÁRIO C: NÃO TEM NENHUMA ESCALA NO SISTEMA (CADASTRO FIXO) ---
           source = 'CADASTRO (PREVISÃO FIXA)';
           sourceColor = 'bg-yellow-100 text-yellow-800 border-yellow-200';
           isTheoretical = true;

           members24 = soldiers.filter(s => s.team === currentTeam24Info.name && s.status === 'Ativo');
           members2x2 = soldiers.filter(s => s.team === currentTeam2x2Info.name && s.status === 'Ativo');
        }
    }

    setSimResult({ 
      date: targetDate, 
      team24: currentTeam24Info, 
      members24, 
      team2x2: currentTeam2x2Info, 
      members2x2,
      source,
      sourceColor,
      isTheoretical,
      isProjection
    });
  };

  const DynamicIcon = ({ name, size = 20, className = "" }: { name: string, size?: number, className?: string }) => {
    const IconComponent = (Icons as any)[name] || FileText;
    return <IconComponent size={size} className={className} />;
  };

  return (
    <div className="space-y-8 pb-10">
      {/* Cabeçalho de Boas Vindas */}
      <div className="flex items-center justify-between">
         <div>
            <h2 className="text-2xl font-black text-pm-900 uppercase tracking-tight">Painel de Controle</h2>
            <p className="text-sm text-pm-500 font-medium">Visão geral operacional e administrativa</p>
         </div>
         <div className="hidden md:flex items-center space-x-2 bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-100">
            <ShieldCheck className="text-gov-green" size={20}/>
            <span className="text-xs font-bold text-gray-600 uppercase">Sistema Operacional</span>
         </div>
      </div>

      {/* Grid de Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center space-x-4 hover:shadow-md transition-all group relative overflow-hidden">
          <div className="absolute right-0 top-0 w-24 h-24 bg-blue-50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
          <div className="p-4 rounded-xl bg-blue-500 text-white shadow-blue-200 shadow-lg relative z-10"><Users size={24}/></div>
          <div className="relative z-10">
             <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">Efetivo Total</p>
             <p className="text-3xl font-black text-pm-900">{soldiers.length}</p>
          </div>
        </div>

        {/* Card Interativo: Estatísticas por Patente */}
        <button 
          onClick={() => setIsRankModalOpen(true)}
          className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center space-x-4 hover:shadow-xl hover:border-gov-green transition-all group relative overflow-hidden text-left"
        >
          <div className="absolute right-0 top-0 w-24 h-24 bg-green-50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
          <div className="p-4 rounded-xl bg-gov-green text-white shadow-green-200 shadow-lg relative z-10"><BarChart3 size={24}/></div>
          <div className="relative z-10">
             <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">Quantitativo</p>
             <p className="text-xl font-black text-pm-900 leading-none mt-1">EFETIVO</p>
             <p className="text-[10px] text-green-700 font-bold mt-1 bg-green-50 px-2 py-0.5 rounded-full inline-block group-hover:bg-green-100">VISUALIZAR</p>
          </div>
        </button>
        
        {/* Card Especial: Banco de Folgas */}
        <button 
           onClick={() => { setSelectedSoldierForBank(null); setIsBankModalOpen(true); }}
           className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center space-x-4 hover:shadow-xl hover:border-pm-300 transition-all group relative overflow-hidden text-left"
        >
          <div className="absolute right-0 top-0 w-24 h-24 bg-purple-50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
          <div className="p-4 rounded-xl bg-purple-600 text-white shadow-purple-200 shadow-lg relative z-10"><BookOpen size={24}/></div>
          <div className="relative z-10">
             <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">Gestão Adm.</p>
             <p className="text-xl font-black text-pm-900 leading-none mt-1">B. DE FOLGAS</p>
             <p className="text-[10px] text-purple-700 font-bold mt-1 bg-purple-50 px-2 py-0.5 rounded-full inline-block group-hover:bg-purple-100">ACESSAR</p>
          </div>
        </button>

        {/* Card Especial: Fila Extra */}
        <button 
           onClick={() => setIsExtraDutyModalOpen(true)}
           className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center space-x-4 hover:shadow-xl hover:border-orange-300 transition-all group relative overflow-hidden text-left"
        >
          <div className="absolute right-0 top-0 w-24 h-24 bg-orange-50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
          <div className="p-4 rounded-xl bg-orange-500 text-white shadow-orange-200 shadow-lg relative z-10"><ListOrdered size={24}/></div>
          <div className="relative z-10">
             <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">Fila Rotativa</p>
             <p className="text-xl font-black text-pm-900 leading-none mt-1">SERV. EXTRA</p>
             <p className="text-[10px] text-orange-700 font-bold mt-1 bg-orange-50 px-2 py-0.5 rounded-full inline-block group-hover:bg-orange-100">GERENCIAR</p>
          </div>
        </button>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center space-x-4 hover:shadow-md transition-all group relative overflow-hidden">
          <div className="absolute right-0 top-0 w-24 h-24 bg-red-50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
          <div className="p-4 rounded-xl bg-red-500 text-white shadow-red-200 shadow-lg relative z-10"><UserMinus size={24}/></div>
          <div className="relative z-10">
             <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">Indisponíveis</p>
             <p className="text-3xl font-black text-pm-900">{awayCount}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Previsão de Plantão */}
        <div className="lg:col-span-2 bg-white p-8 rounded-2xl shadow-sm border border-gray-200">
          <h3 className="font-black text-lg text-pm-900 mb-6 flex items-center tracking-tight">
             <Clock size={22} className="text-pm-600 mr-2" /> 
             SIMULADOR DE CICLO DE SERVIÇO
          </h3>
          
          <div className="flex flex-col md:flex-row gap-4 items-end border-b border-gray-100 pb-8 mb-8">
            <div className="w-full">
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1 ml-1">Selecione uma Data Futura (Atualização Automática)</label>
              <input 
                type="date" 
                className="w-full border-2 border-gray-200 bg-gray-50 rounded-xl p-3 font-bold text-pm-800 outline-none focus:border-pm-500 transition-all" 
                value={simDate} 
                onChange={(e) => setSimDate(e.target.value)} 
              />
            </div>
          </div>

          {simResult ? (
            <div className="animate-in fade-in slide-in-from-bottom-2">
               {/* Badge de Fonte de Dados */}
               <div className="flex justify-between items-center mb-4">
                  <span className="text-xs font-bold text-gray-400">RESULTADO DA SIMULAÇÃO:</span>
                  <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full border ${simResult.sourceColor}`}>
                     FONTE: {simResult.source}
                  </span>
               </div>
               
               {simResult.isTheoretical && (
                 <div className={`mb-6 border rounded-lg p-3 flex items-start space-x-3 ${simResult.isProjection ? 'bg-blue-50 border-blue-100' : 'bg-yellow-50 border-yellow-100'}`}>
                    {simResult.isProjection ? <Wand2 className="text-blue-500 flex-shrink-0 mt-0.5" size={16}/> : <Info className="text-yellow-600 flex-shrink-0 mt-0.5" size={16}/>}
                    <div>
                      <p className={`text-xs font-bold leading-tight ${simResult.isProjection ? 'text-blue-800' : 'text-yellow-800'}`}>
                         {simResult.isProjection ? 'Projeção Inteligente Ativa' : 'Atenção: Previsão baseada apenas no Cadastro.'}
                      </p>
                      <p className={`text-[10px] mt-1 ${simResult.isProjection ? 'text-blue-600' : 'text-yellow-700'}`}>
                         {simResult.isProjection 
                           ? "Não há escala criada para esta data. O sistema está projetando as equipes baseando-se em quem trabalhou nos respectivos ciclos na ÚLTIMA ESCALA válida encontrada."
                           : "Não há escala criada e nenhuma escala anterior para basear a projeção. Os nomes abaixo são baseados no campo 'Equipe' do cadastro de cada militar."}
                      </p>
                    </div>
                 </div>
               )}

               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className={`p-6 rounded-2xl border-2 ${simResult.team24.color} relative overflow-hidden flex flex-col`}>
                  <div className="absolute top-0 right-0 bg-white/30 px-3 py-1 rounded-bl-lg text-[10px] font-black uppercase">BLOCO #1 (24h)</div>
                  <div className="font-black text-lg border-b border-black/10 mb-3 pb-2 uppercase tracking-tighter">
                    EQUIPE {simResult.team24.name}
                  </div>
                  <div className="space-y-2 flex-1">
                    {simResult.members24.length > 0 ? simResult.members24.map((s: Soldier, i: number) => (
                      <div key={s.id + i} className="text-sm font-bold flex items-center p-2 rounded-lg bg-white/40">
                        <div className="w-6 text-[10px] opacity-50 mr-2 uppercase tracking-wider">
                          {i + 1}º
                        </div>
                        <div className="flex-1 truncate">
                            {s.rank} {s.matricula ? s.matricula + ' ' : ''}{s.name} <span className="text-[10px] opacity-60">({s.role})</span>
                        </div>
                      </div>
                    )) : (
                      <div className="flex items-center justify-center h-full text-center p-4 opacity-50 font-bold uppercase text-xs border border-dashed border-black/20 rounded-lg">
                          Nenhum militar previsto
                      </div>
                    )}
                  </div>
                </div>

                <div className={`p-6 rounded-2xl border-2 ${simResult.team2x2.color} relative overflow-hidden flex flex-col`}>
                  <div className="absolute top-0 right-0 bg-white/30 px-3 py-1 rounded-bl-lg text-[10px] font-black uppercase">BLOCO #2 (2x2)</div>
                  <div className="font-black text-lg border-b border-black/10 mb-3 pb-2 uppercase tracking-tighter">
                    {simResult.team2x2.name}
                  </div>
                  <div className="space-y-2 flex-1">
                    {simResult.members2x2.length > 0 ? simResult.members2x2.map((s: Soldier, i: number) => (
                      <div key={s.id + i} className="text-sm font-bold flex items-center p-2 rounded-lg bg-white/40">
                        <div className="w-6 text-[10px] opacity-50 mr-2 uppercase tracking-wider">
                          {i + 1}º
                        </div>
                        <div className="flex-1 truncate">
                          {s.rank} {s.matricula ? s.matricula + ' ' : ''}{s.name} <span className="text-[10px] opacity-60">({s.role})</span>
                        </div>
                      </div>
                    )) : (
                      <div className="flex items-center justify-center h-full text-center p-4 opacity-50 font-bold uppercase text-xs border border-dashed border-black/20 rounded-lg">
                          Nenhum militar previsto
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
               <Clock size={48} className="mx-auto text-gray-300 mb-2"/>
               <p className="text-gray-400 font-bold uppercase text-sm">Selecione uma data para visualizar as equipes</p>
            </div>
          )}
        </div>

        {/* Lista de Afastados */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col">
          <h3 className="font-black text-lg text-pm-900 mb-6 flex items-center tracking-tight">
             <AlertTriangle size={22} className="text-amber-500 mr-2" /> 
             INDISPONIBILIDADE
          </h3>
          <div className="flex-1 overflow-auto max-h-[400px]">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left font-bold text-xs text-gray-500 uppercase rounded-tl-lg">Militar</th>
                  <th className="px-4 py-3 text-right font-bold text-xs text-gray-500 uppercase rounded-tr-lg">Motivo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {soldiers.filter(s => s.status !== 'Ativo').length > 0 ? (
                  soldiers.filter(s => s.status !== 'Ativo').map(s => (
                    <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-bold text-pm-900 text-xs uppercase">{s.rank} {s.name}</div>
                        <div className="text-[10px] text-gray-400 font-mono">{s.matricula}</div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-full ${s.status === 'Férias' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                          {s.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={2} className="px-4 py-8 text-center text-gray-400 text-xs uppercase font-bold">
                      Nenhum militar afastado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* --- MODAL: QUANTITATIVO POR POSTO --- */}
      {isRankModalOpen && (
        <div className="fixed inset-0 bg-pm-950/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
           <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-200 animate-in zoom-in-95 duration-200">
              <div className="p-6 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                 <div className="flex items-center space-x-3">
                    <div className="p-2 bg-green-100 rounded-lg text-green-700">
                       <BarChart3 size={24}/>
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-pm-900 uppercase">Estatísticas do Efetivo</h3>
                      <p className="text-xs text-gray-500 font-bold">Distribuição por Quadro e Graduação</p>
                    </div>
                 </div>
                 <button onClick={() => setIsRankModalOpen(false)} className="text-gray-400 hover:text-red-500 p-2 hover:bg-red-50 rounded-full transition-all">
                    <X size={24}/>
                 </button>
              </div>

              <div className="p-6 overflow-y-auto max-h-[70vh] bg-white">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* COLUNA 1: OFICIAIS */}
                    <div className="space-y-4">
                       <h4 className="font-black text-sm text-pm-800 uppercase flex items-center border-b border-gray-200 pb-2">
                          <Medal size={16} className="mr-2 text-gov-yellow"/> Oficiais (QOPM/QOS)
                       </h4>
                       
                       {/* QOPM */}
                       <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                          <div className="flex justify-between items-center mb-2">
                             <span className="text-xs font-black uppercase text-gray-600">QOPM (Combatentes)</span>
                             <span className="font-black text-pm-900 bg-white px-2 py-0.5 rounded border border-gray-200 text-xs">{officerStats.qopm}</span>
                          </div>
                       </div>

                       {/* QOAPM */}
                       <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                          <div className="flex justify-between items-center mb-2">
                             <span className="text-xs font-black uppercase text-gray-600">QOAPM (Administração)</span>
                             <span className="font-black text-pm-900 bg-white px-2 py-0.5 rounded border border-gray-200 text-xs">{officerStats.qoapm}</span>
                          </div>
                       </div>

                       {/* QOCPM */}
                       <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                          <div className="flex justify-between items-center mb-2">
                             <span className="text-xs font-black uppercase text-gray-600">QOCPM (Complementar)</span>
                             <span className="font-black text-pm-900 bg-white px-2 py-0.5 rounded border border-gray-200 text-xs">{officerStats.qocpm}</span>
                          </div>
                       </div>

                       <div className="border-t border-gray-300 mt-2 pt-2 flex justify-between items-center bg-gray-100 p-2 rounded">
                          <span className="font-black text-xs uppercase text-gray-500">Total Oficiais</span>
                          <span className="font-black text-pm-900">{countGroup(officerRanks)}</span>
                       </div>
                    </div>

                    <div className="space-y-6">
                        {/* COLUNA 2: PRAÇAS ESPECIAIS */}
                        <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                          <h4 className="font-black text-sm text-blue-800 uppercase mb-3 flex items-center border-b border-blue-200 pb-2">
                              <ShieldCheck size={16} className="mr-2 text-blue-600"/> Praças Especiais
                          </h4>
                          <div className="space-y-2">
                              {specialRanks.map(rank => (
                                <div key={rank} className="flex justify-between items-center text-sm">
                                    <span className="font-bold text-gray-600 uppercase">{rank}</span>
                                    <span className="font-black text-blue-900 bg-white px-2 py-0.5 rounded border border-blue-100">{rankStats[rank] || 0}</span>
                                </div>
                              ))}
                              <div className="border-t border-blue-200 mt-2 pt-2 flex justify-between items-center bg-blue-100 p-2 rounded">
                                <span className="font-black text-xs uppercase text-blue-600">Total P. Especiais</span>
                                <span className="font-black text-blue-900">{countGroup(specialRanks)}</span>
                              </div>
                          </div>
                        </div>

                        {/* COLUNA 3: PRAÇAS */}
                        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                          <h4 className="font-black text-sm text-pm-800 uppercase mb-3 flex items-center border-b border-gray-200 pb-2">
                              <Users size={16} className="mr-2 text-pm-600"/> Praças
                          </h4>
                          <div className="space-y-2">
                              {enlistedRanks.map(rank => (
                                <div key={rank} className="flex justify-between items-center text-sm">
                                    <span className="font-bold text-gray-600 uppercase">{rank}</span>
                                    <span className="font-black text-pm-900 bg-white px-2 py-0.5 rounded border border-gray-200">{rankStats[rank] || 0}</span>
                                </div>
                              ))}
                              <div className="border-t border-gray-300 mt-2 pt-2 flex justify-between items-center bg-gray-100 p-2 rounded">
                                <span className="font-black text-xs uppercase text-gray-500">Total Praças</span>
                                <span className="font-black text-pm-900">{countGroup(enlistedRanks)}</span>
                              </div>
                          </div>
                        </div>
                    </div>
                 </div>

                 {/* TOTAL GERAL */}
                 <div className="mt-6 bg-pm-900 text-white p-4 rounded-xl flex justify-between items-center shadow-lg">
                    <div>
                       <p className="text-xs font-bold text-pm-300 uppercase tracking-widest">Efetivo Total Cadastrado</p>
                       <p className="text-xs text-pm-400">(Incluindo Civis se houver)</p>
                    </div>
                    <div className="text-3xl font-black">{soldiers.length}</div>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* --- MODAL: FILA DE SERVIÇO EXTRA (NOVO) --- */}
      {isExtraDutyModalOpen && (
        <div className="fixed inset-0 bg-pm-950/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
           <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl h-[85vh] flex overflow-hidden border border-gray-200 animate-in zoom-in-95 duration-200">
              
              {/* Sidebar: Lista da Fila (Esquerda) */}
              <div className="w-full md:w-1/2 bg-gray-50 border-r border-gray-200 flex flex-col">
                 <div className="p-6 bg-white border-b border-gray-100">
                    <div className="flex items-center justify-between mb-2">
                       <h3 className="text-lg font-black text-pm-900 uppercase flex items-center">
                          <ListOrdered className="mr-2 text-orange-500" size={20}/> Fila de Serviço Extra
                       </h3>
                       <button onClick={() => setIsExtraDutyModalOpen(false)} className="md:hidden text-gray-400"><X/></button>
                    </div>
                    <p className="text-xs text-gray-500 font-bold mb-4">
                       Ordem sequencial de convocação. Os militares marcados como indisponíveis serão pulados.
                    </p>
                    {/* Botão de Reset (Admin Only) */}
                    {isAdmin && (
                       <button 
                         onClick={handleResetExtraQueue}
                         className="w-full bg-red-50 text-red-600 hover:bg-red-100 py-2 rounded-lg text-xs font-black uppercase flex items-center justify-center space-x-2 transition-all border border-red-200"
                       >
                          <RotateCw size={14}/> <span>Reiniciar Fila (Antiguidade)</span>
                       </button>
                    )}
                 </div>

                 <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {/* Header da Lista */}
                    <div className="flex text-[10px] font-black text-gray-400 uppercase px-3 mb-1">
                       <span className="w-8 text-center">#</span>
                       <span className="flex-1">Militar</span>
                       <span className="w-20 text-center">Status</span>
                    </div>
                    
                    {sortedExtraQueue.map((s) => {
                       const isAvailable = s.status === Status.ATIVO;
                       return (
                          <div key={s.id} className={`flex items-center p-3 rounded-xl border ${isAvailable ? 'bg-white border-gray-200' : 'bg-gray-100 border-transparent opacity-70'}`}>
                             <div className="w-8 text-center font-black text-gray-400 text-xs">{s.orderExtra}</div>
                             <div className="flex-1">
                                <p className="text-sm font-bold text-pm-900 uppercase leading-none">{s.rank} {s.name}</p>
                                <p className="text-[10px] text-gray-500 font-bold uppercase mt-0.5">{s.matricula || '-'}</p>
                             </div>
                             <div className="w-24 text-right">
                                {isAvailable ? (
                                   <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black bg-green-100 text-green-700 uppercase">
                                      Disponível
                                   </span>
                                ) : (
                                   <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black bg-red-100 text-red-700 uppercase">
                                      {s.status}
                                   </span>
                                )}
                             </div>
                          </div>
                       );
                    })}
                 </div>
              </div>

              {/* Main: Controles e Pré-visualização (Direita) */}
              <div className="flex-1 flex flex-col bg-white">
                 <div className="p-6 border-b border-gray-100 flex justify-between items-start">
                    <div>
                       <h3 className="text-xl font-black text-pm-900 uppercase">Gerar Escala</h3>
                       {isAdmin ? (
                          <p className="text-xs text-gray-500 font-bold mt-1">Selecione a quantidade de militares para escalar.</p>
                       ) : (
                          <p className="text-xs text-gray-500 font-bold mt-1">Acesso restrito. Modo de visualização.</p>
                       )}
                    </div>
                    <button onClick={() => setIsExtraDutyModalOpen(false)} className="hidden md:block text-gray-400 hover:text-red-500"><X size={24}/></button>
                 </div>

                 <div className="p-6 space-y-6 flex-1 overflow-y-auto">
                    {isAdmin ? (
                       <>
                          {/* Controles de Geração */}
                          <div className="bg-orange-50 p-5 rounded-2xl border border-orange-100">
                             <div className="grid grid-cols-2 gap-4 mb-4">
                                <div>
                                   <label className="text-[10px] font-black uppercase text-orange-800 ml-1 mb-1 block">Quantidade de Vagas</label>
                                   <input 
                                     type="number" 
                                     min="1" 
                                     max="50" 
                                     className="w-full p-3 rounded-xl border border-orange-200 font-bold text-center text-lg outline-none focus:ring-2 focus:ring-orange-500"
                                     value={extraDutyCount}
                                     onChange={(e) => setExtraDutyCount(Number(e.target.value))}
                                   />
                                </div>
                                <div>
                                   <label className="text-[10px] font-black uppercase text-orange-800 ml-1 mb-1 block">Data da Escala</label>
                                   <input 
                                     type="date"
                                     className="w-full p-3 rounded-xl border border-orange-200 font-bold text-sm outline-none focus:ring-2 focus:ring-orange-500"
                                     value={extraDutyDate}
                                     onChange={(e) => setExtraDutyDate(e.target.value)}
                                   />
                                </div>
                             </div>
                             <button 
                               onClick={handleGenerateExtraList}
                               className="w-full bg-orange-500 text-white py-3 rounded-xl font-black uppercase hover:bg-orange-600 shadow-lg active:scale-95 transition-all flex items-center justify-center space-x-2"
                             >
                                <Wand2 size={18}/> <span>Gerar Lista Automática</span>
                             </button>
                          </div>

                          {/* Preview da Lista */}
                          {previewExtraList.length > 0 && (
                             <div className="animate-in fade-in slide-in-from-bottom-4">
                                <div className="flex items-center justify-between mb-3">
                                   <h4 className="font-black text-gray-800 uppercase text-sm">Próximos da Fila ({previewExtraList.length})</h4>
                                   <span className="text-[10px] font-bold bg-green-100 text-green-800 px-2 py-1 rounded">Prontos para Escalar</span>
                                </div>
                                
                                <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden mb-6">
                                   {previewExtraList.map((s, i) => (
                                      <div key={s.id} className="p-3 border-b border-gray-100 last:border-0 flex items-center justify-between bg-white">
                                         <div className="flex items-center space-x-3">
                                            <span className="w-6 h-6 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center text-xs font-black">{i + 1}</span>
                                            <span className="text-sm font-bold text-gray-800 uppercase">{s.rank} {s.name}</span>
                                         </div>
                                         <div className="text-xs text-gray-400 font-bold">Atual: #{s.orderExtra}</div>
                                      </div>
                                   ))}
                                </div>

                                <button 
                                  onClick={handleConfirmExtraList}
                                  className="w-full bg-green-600 text-white py-4 rounded-xl font-black uppercase hover:bg-green-700 shadow-xl active:scale-95 transition-all flex items-center justify-center space-x-2"
                                >
                                   <CheckCircle2 size={20}/> <span>Confirmar Escala e Rotacionar Fila</span>
                                </button>
                                <p className="text-center text-[10px] text-gray-400 mt-2 font-medium max-w-xs mx-auto">
                                   Ao confirmar, estes militares serão movidos para o final da fila e o histórico será registrado.
                                </p>
                             </div>
                          )}
                       </>
                    ) : (
                       <div className="flex flex-col items-center justify-center h-full text-gray-400 opacity-50">
                          <ShieldCheck size={64} className="mb-4"/>
                          <p className="font-bold text-center uppercase text-sm">Controles de geração desabilitados para este perfil.</p>
                       </div>
                    )}
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* --- MODAL: HISTÓRICO DE ESCALAS GERADAS --- */}
      {isRosterListOpen && (
        <div className="fixed inset-0 bg-pm-950/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
           <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden border border-gray-200 animate-in zoom-in-95 duration-200">
              <div className="p-6 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                 <div className="flex items-center space-x-3">
                    <div className="p-2 bg-indigo-100 rounded-lg text-indigo-700">
                       <FileText size={24}/>
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-pm-900 uppercase">Escalas Armazenadas</h3>
                      <p className="text-xs text-gray-500 font-bold">Histórico completo de escalas geradas no sistema</p>
                    </div>
                 </div>
                 <button onClick={() => setIsRosterListOpen(false)} className="text-gray-400 hover:text-red-500 p-2 hover:bg-red-50 rounded-full transition-all">
                    <X size={24}/>
                 </button>
              </div>

              <div className="p-4 border-b border-gray-100 bg-white">
                 <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18}/>
                    <input 
                       className="w-full bg-gray-100 rounded-xl py-3 pl-10 pr-4 font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                       placeholder="Filtrar por título da escala ou data..."
                       value={rosterSearch}
                       onChange={e => setRosterSearch(e.target.value)}
                    />
                 </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 bg-gray-50/50">
                 {filteredRosters.length > 0 ? (
                    <div className="space-y-3">
                       {filteredRosters.map(roster => {
                          const category = settings.rosterCategories.find(c => c.id === roster.type);
                          return (
                             <div key={roster.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 hover:shadow-md hover:border-indigo-300 transition-all group flex items-center justify-between">
                                <div className="flex items-center space-x-4">
                                   <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 ${category ? 'bg-white border-indigo-100 text-indigo-600' : 'bg-gray-100 border-gray-200 text-gray-400'}`}>
                                      <DynamicIcon name={category?.icon || 'FileText'} size={20}/>
                                   </div>
                                   <div>
                                      <h4 className="font-black text-pm-900 uppercase text-sm mb-1">{roster.title}</h4>
                                      <div className="flex items-center space-x-3 text-xs text-gray-500 font-medium">
                                         <span className="flex items-center bg-gray-100 px-2 py-0.5 rounded text-gray-600 uppercase text-[10px] font-bold">
                                            {category?.name || 'Geral'}
                                         </span>
                                         <span className="flex items-center">
                                            <Calendar size={12} className="mr-1"/> 
                                            {new Date(roster.startDate).toLocaleDateString()} a {new Date(roster.endDate).toLocaleDateString()}
                                         </span>
                                      </div>
                                   </div>
                                </div>
                                <div className="flex items-center space-x-4">
                                   <div className="text-right hidden sm:block">
                                      <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Criada em</p>
                                      <p className="text-xs font-bold text-pm-700 flex items-center justify-end">
                                         <Clock size={12} className="mr-1 text-gray-400"/>
                                         {roster.creationDate ? new Date(roster.creationDate).toLocaleDateString() : 'N/A'}
                                      </p>
                                   </div>
                                   <button 
                                     onClick={() => setViewingRoster(roster)}
                                     className="bg-indigo-50 text-indigo-600 p-2 rounded-lg hover:bg-indigo-600 hover:text-white transition-colors flex items-center font-bold text-xs uppercase"
                                   >
                                     <Eye size={16} className="mr-1"/> <span className="hidden sm:inline">Visualizar</span>
                                   </button>
                                </div>
                             </div>
                          );
                       })}
                    </div>
                 ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-300">
                       <FileText size={48} className="mb-2 opacity-20"/>
                       <p className="font-bold uppercase text-sm">Nenhuma escala encontrada</p>
                    </div>
                 )}
              </div>
           </div>
        </div>
      )}
      
      {/* Modal de Visualização de Impressão (Acionado pelo Histórico) */}
      {viewingRoster && (
        <PrintPreview roster={viewingRoster} onClose={() => setViewingRoster(null)} />
      )}

      {/* --- MODAL BANCO DE FOLGAS --- */}
      {isBankModalOpen && (
        // ... (Código do modal do banco de folgas mantido inalterado) ...
        <div className="fixed inset-0 bg-pm-950/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl h-[85vh] flex overflow-hidden border border-gray-200 animate-in zoom-in-95 duration-200">
            
            {/* Sidebar: Lista de Militares */}
            <div className={`w-full md:w-80 bg-gray-50 border-r border-gray-200 flex flex-col ${selectedSoldierForBank ? 'hidden md:flex' : 'flex'}`}>
               <div className="p-4 bg-white border-b border-gray-100">
                  <div className="flex items-center justify-between mb-4">
                     <h3 className="font-black text-pm-900 uppercase flex items-center"><BookOpen className="mr-2 text-purple-600" size={20}/> Banco de Folgas</h3>
                     <button onClick={() => setIsBankModalOpen(false)} className="text-gray-400 hover:text-red-500"><X size={24}/></button>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16}/>
                    <input 
                      className="w-full bg-gray-100 border-none rounded-xl py-2.5 pl-10 text-sm font-bold focus:ring-2 focus:ring-purple-500" 
                      placeholder="Buscar militar..."
                      value={bankSearchTerm}
                      onChange={e => setBankSearchTerm(e.target.value)}
                    />
                  </div>
               </div>
               
               <div className="flex-1 overflow-y-auto p-2 space-y-2">
                 {filteredSoldiersBank.map(s => {
                   const bal = calculateBalance(s.bankHistory);
                   return (
                     <button 
                       key={s.id}
                       onClick={() => { setSelectedSoldierForBank(s); setBankForm({...bankForm, description: ''}); setHistorySearchTerm(''); setIsHistorySearchOpen(false); }}
                       className={`w-full text-left p-3 rounded-xl flex items-center justify-between transition-all border ${selectedSoldierForBank?.id === s.id ? 'bg-purple-50 border-purple-200 ring-1 ring-purple-300' : 'bg-white border-transparent hover:bg-gray-100'}`}
                     >
                        <div>
                           <p className="text-xs font-black uppercase text-gray-500">{s.rank}</p>
                           <p className="font-bold text-pm-900 text-sm">{s.name}</p>
                        </div>
                        <div className={`px-3 py-1 rounded-lg font-black text-sm ${bal > 0 ? 'bg-green-100 text-green-700' : bal < 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-400'}`}>
                           {bal > 0 ? `+${bal}` : bal}
                        </div>
                     </button>
                   );
                 })}
               </div>
            </div>

            {/* Main: Detalhes do Militar */}
            <div className={`flex-1 flex flex-col bg-white ${selectedSoldierForBank ? 'flex' : 'hidden md:flex'}`}>
              {selectedSoldierForBank ? (
                <>
                  {/* Header do Militar e Estatísticas Visuais */}
                  <div className="border-b border-gray-100 bg-gray-50/50">
                    <div className="p-6 flex items-center justify-between pb-4">
                       <div className="flex items-center">
                          <button onClick={() => setSelectedSoldierForBank(null)} className="md:hidden mr-3 text-gray-500"><ArrowLeft/></button>
                          <div>
                            <h2 className="text-2xl font-black text-pm-900 uppercase leading-none">{selectedSoldierForBank.rank} {selectedSoldierForBank.name}</h2>
                            <p className="text-sm text-gray-500 font-bold uppercase mt-1">Matrícula: {selectedSoldierForBank.matricula || '--'} • {selectedSoldierForBank.role}</p>
                          </div>
                       </div>
                    </div>

                    {/* Cartões de Resumo Visual */}
                    <div className="px-6 pb-6 grid grid-cols-3 gap-4">
                       <div className="bg-green-50 rounded-xl p-4 border border-green-100 flex items-center space-x-3">
                          <div className="bg-green-100 p-3 rounded-full text-green-600"><TrendingUp size={20}/></div>
                          <div>
                             <p className="text-[10px] font-black text-green-800 uppercase tracking-wider">Total Adquirido</p>
                             <p className="text-2xl font-black text-green-700 leading-none">
                               {getBankStats(selectedSoldierForBank.bankHistory).credits}
                             </p>
                          </div>
                       </div>
                       
                       <div className="bg-red-50 rounded-xl p-4 border border-red-100 flex items-center space-x-3">
                          <div className="bg-red-100 p-3 rounded-full text-red-600"><TrendingDown size={20}/></div>
                          <div>
                             <p className="text-[10px] font-black text-red-800 uppercase tracking-wider">Total Gozado</p>
                             <p className="text-2xl font-black text-red-700 leading-none">
                               {getBankStats(selectedSoldierForBank.bankHistory).debits}
                             </p>
                          </div>
                       </div>

                       <div className="bg-white rounded-xl p-4 border-2 border-pm-100 flex items-center space-x-3 shadow-sm">
                          <div className="bg-pm-100 p-3 rounded-full text-pm-600"><Wallet size={20}/></div>
                          <div>
                             <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Saldo Atual</p>
                             <p className={`text-2xl font-black leading-none ${calculateBalance(selectedSoldierForBank.bankHistory) >= 0 ? 'text-pm-900' : 'text-red-500'}`}>
                               {calculateBalance(selectedSoldierForBank.bankHistory)} <span className="text-xs text-gray-400">DIAS</span>
                             </p>
                          </div>
                       </div>
                    </div>
                  </div>

                  <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
                     {/* Coluna Esquerda: Formulário de Ação (Apenas para Admin) */}
                     {isAdmin && (
                        <div className="w-full lg:w-80 bg-gray-50 border-r border-gray-100 p-6 flex flex-col overflow-y-auto">
                            <h4 className="font-black text-sm uppercase text-gray-500 mb-4 flex items-center">
                            {bankForm.type === 'CREDIT' ? <PlusCircle className="mr-2 text-green-600" size={16}/> : <MinusCircle className="mr-2 text-red-600" size={16}/>}
                            Novo Lançamento
                            </h4>
                            
                            <div className="flex bg-white rounded-lg p-1 mb-4 shadow-sm border border-gray-200">
                            <button 
                                onClick={() => setBankForm({...bankForm, type: 'CREDIT'})}
                                className={`flex-1 py-2 rounded-md text-xs font-black uppercase transition-all ${bankForm.type === 'CREDIT' ? 'bg-green-100 text-green-700' : 'text-gray-400 hover:text-gray-700'}`}
                            >
                                Adquirir
                            </button>
                            <button 
                                onClick={() => setBankForm({...bankForm, type: 'DEBIT'})}
                                className={`flex-1 py-2 rounded-md text-xs font-black uppercase transition-all ${bankForm.type === 'DEBIT' ? 'bg-red-100 text-red-700' : 'text-gray-400 hover:text-gray-700'}`}
                            >
                                Baixar
                            </button>
                            </div>

                            <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Data do Evento</label>
                                <input 
                                    type="date" 
                                    className="w-full p-3 bg-white border border-gray-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-purple-500 shadow-sm"
                                    value={bankForm.date}
                                    onChange={e => setBankForm({...bankForm, date: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">
                                    {bankForm.type === 'CREDIT' ? 'Motivo da Aquisição' : 'Observação da Baixa'}
                                </label>
                                <textarea 
                                    className="w-full p-3 bg-white border border-gray-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-purple-500 h-24 resize-none shadow-sm"
                                    placeholder={bankForm.type === 'CREDIT' ? "Ex: Serviço Extra no Carnaval..." : "Ex: Gozo de Folga autorizado..."}
                                    value={bankForm.description}
                                    onChange={e => setBankForm({...bankForm, description: e.target.value})}
                                />
                            </div>
                            <button 
                                onClick={handleSaveTransaction}
                                className={`w-full py-4 rounded-xl text-white font-black uppercase text-sm shadow-xl hover:shadow-2xl flex items-center justify-center space-x-2 active:scale-95 transition-all ${bankForm.type === 'CREDIT' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
                            >
                                <Save size={16}/> <span>Confirmar Lançamento</span>
                            </button>
                            </div>
                        </div>
                     )}

                     {/* Coluna Direita: Relatório Visual (Timeline) */}
                     <div className="flex-1 bg-white flex flex-col overflow-hidden relative">
                        <div className="p-4 border-b border-gray-100 bg-gray-50/30 flex justify-between items-center sticky top-0 z-10 backdrop-blur-sm">
                           <div className="flex items-center space-x-3 flex-1">
                              <h4 className="font-black text-sm uppercase text-gray-600 flex items-center">
                                 <History className="mr-2" size={16}/> Histórico Detalhado
                              </h4>
                              {/* Botão de Pesquisa Interna */}
                              <div className="relative">
                                {isHistorySearchOpen ? (
                                  <div className="flex items-center bg-gray-100 rounded-full px-3 py-1 border border-gray-200 animate-in slide-in-from-left-2">
                                    <Search size={14} className="text-gray-400 mr-2"/>
                                    <input 
                                      autoFocus
                                      className="bg-transparent border-none outline-none text-xs font-bold text-gray-700 w-32"
                                      placeholder="Filtrar eventos..."
                                      value={historySearchTerm}
                                      onChange={e => setHistorySearchTerm(e.target.value)}
                                    />
                                    <button onClick={() => { setIsHistorySearchOpen(false); setHistorySearchTerm(''); }} className="ml-2 text-gray-400 hover:text-red-500">
                                      <X size={14}/>
                                    </button>
                                  </div>
                                ) : (
                                  <button onClick={() => setIsHistorySearchOpen(true)} className="p-1.5 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-500 transition-all" title="Pesquisar no Histórico">
                                    <Search size={16}/>
                                  </button>
                                )}
                              </div>
                           </div>
                           <span className="text-[10px] font-bold text-gray-400 uppercase">
                             {processedHistory.length} Registros
                           </span>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-6 relative">
                           {/* Linha Vertical Conectora */}
                           {processedHistory.length > 0 && (
                             <div className="absolute left-[39px] top-6 bottom-6 w-0.5 bg-gray-100 z-0"></div>
                           )}

                           <div className="space-y-6 relative z-10">
                              {processedHistory.length > 0 ? (
                                 processedHistory.map((t) => (
                                    <div key={t.id} className="flex gap-4 group">
                                       {/* Ícone do Evento */}
                                       <div className={`w-8 h-8 rounded-full flex items-center justify-center border-4 border-white shadow-sm flex-shrink-0 z-10 ${t.type === 'CREDIT' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                          {t.type === 'CREDIT' ? <PlusCircle size={16}/> : <MinusCircle size={16}/>}
                                       </div>
                                       
                                       {/* Cartão do Evento */}
                                       <div className="flex-1 bg-white border border-gray-100 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow relative">
                                          <div className="flex justify-between items-start mb-2 border-b border-gray-50 pb-2">
                                             <div className="flex flex-col">
                                                <span className={`text-[10px] font-black uppercase tracking-wider mb-1 ${t.type === 'CREDIT' ? 'text-green-600' : 'text-red-600'}`}>
                                                   {t.type === 'CREDIT' ? 'FOLGA ADQUIRIDA EM:' : 'FOLGA GOZADA EM:'}
                                                </span>
                                                <span className="text-sm font-black text-gray-800 flex items-center">
                                                   <Calendar size={14} className="mr-1.5 text-gray-400"/>
                                                   {new Date(t.date + 'T12:00:00').toLocaleDateString('pt-BR')}
                                                </span>
                                             </div>
                                             
                                             <div className="text-right">
                                                 <p className="text-[9px] font-bold text-gray-400 uppercase">Saldo Restante Após Movimentação</p>
                                                 <p className={`text-lg font-black ${t.balanceAfter >= 0 ? 'text-pm-900' : 'text-red-500'}`}>
                                                    {t.balanceAfter} <span className="text-[10px]">DIAS</span>
                                                 </p>
                                             </div>
                                          </div>
                                          
                                          <div className="flex items-end justify-between mt-2">
                                             <div className="flex-1 mr-4">
                                                <p className="text-[10px] font-bold text-gray-400 uppercase mb-0.5">Descrição / Motivo</p>
                                                <p className="text-sm font-medium text-gray-700 leading-tight">{t.description}</p>
                                             </div>
                                             
                                             <div className="flex items-center space-x-3">
                                                <div className={`font-black text-xl ${t.type === 'CREDIT' ? 'text-green-600' : 'text-red-600'}`}>
                                                    {t.type === 'CREDIT' ? '+' : '-'}{t.amount || 1}
                                                </div>
                                                {isAdmin && (
                                                    <button 
                                                    onClick={() => handleDeleteTransaction(t.id)}
                                                    className="text-gray-300 hover:text-red-500 p-1.5 hover:bg-red-50 rounded-lg transition-all"
                                                    title="Excluir Registro"
                                                    >
                                                        <Trash2 size={16}/>
                                                    </button>
                                                )}
                                             </div>
                                          </div>
                                       </div>
                                    </div>
                                 ))
                              ) : (
                                 <div className="flex flex-col items-center justify-center pt-20 text-gray-300">
                                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                                       <History size={32} className="opacity-20"/>
                                    </div>
                                    <p className="font-bold text-sm uppercase">
                                       {historySearchTerm ? 'Nenhum registro encontrado para esta busca.' : 'Sem histórico registrado'}
                                    </p>
                                    <p className="text-xs">
                                        {historySearchTerm ? 'Tente outros termos ou limpe o filtro.' : (isAdmin ? 'Utilize o formulário ao lado para iniciar o banco de folgas deste militar.' : 'Nenhuma informação disponível.')}
                                    </p>
                                 </div>
                              )}
                           </div>
                        </div>
                     </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-gray-300 bg-gray-50/50">
                   <div className="relative mb-6">
                      <div className="absolute inset-0 bg-purple-200 rounded-full blur-xl opacity-20"></div>
                      <BookOpen size={80} className="relative z-10 text-gray-300"/>
                   </div>
                   <h3 className="text-xl font-black text-pm-900 uppercase mb-2">Banco de Folgas</h3>
                   <p className="text-sm text-gray-500 font-medium max-w-xs text-center">
                     Selecione um militar na lista à esquerda para visualizar o histórico completo (Aquisição, Gozo e Saldo).
                   </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
