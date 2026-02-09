
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/store';
import { Roster, RosterSection, Soldier, Rank, Status, Shift, BankTransaction } from '../types';
import * as Icons from 'lucide-react';
import { 
  Save, Trash2, Plus, PlusCircle, MinusCircle, FileText, 
  Edit3, Search, X as CloseIcon, User, Scale, 
  MapPin, Check, AlertTriangle, ChevronDown, Calendar, Wand2,
  Columns, LayoutPanelLeft, AlertCircle, Clock, FolderOpen, Zap, Sparkles
} from 'lucide-react';
import { PrintPreview } from '../components/pdf/PrintPreview';

// Helper para ordenação de patentes
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

const getAbbreviatedRank = (rank: string) => {
  const map: Record<string, string> = {
    [Rank.CEL]: 'Cel', 
    [Rank.TEN_CEL]: 'TC', 
    [Rank.MAJ]: 'Maj', 
    [Rank.CAP]: 'Cap', 
    [Rank.TEN_1]: '1ºTen', 
    [Rank.TEN_2]: '2ºTen',
    [Rank.ASP]: 'Asp', 
    [Rank.SUBTEN]: 'ST', 
    [Rank.SGT_1]: '1ºSgt', 
    [Rank.SGT_2]: '2ºSgt', 
    [Rank.SGT_3]: '3ºSgt', 
    [Rank.CB]: 'Cb', 
    [Rank.SD]: 'Sd', 
    [Rank.CIVIL]: 'Civ'
  };
  return map[rank] || rank;
};

export const RosterManager: React.FC = () => {
  const settings = db.getSettings();
  const [rosters, setRosters] = useState<Roster[]>([]);
  const [activeTab, setActiveTab] = useState<string>(settings.rosterCategories[0]?.id || '');
  const [selectedRoster, setSelectedRoster] = useState<Roster | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [soldiers, setSoldiers] = useState<Soldier[]>([]);
  const [showPrint, setShowPrint] = useState(false);

  // Estado do Menu Suspenso de Categorias
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false);

  // Form de Criação
  const [newRosterMeta, setNewRosterMeta] = useState({
    title: '',
    startDate: '',
    endDate: '',
    creationDate: new Date().toISOString().split('T')[0]
  });
  // Novo estado para o checkbox de auto-preenchimento na criação
  const [autoFillOnCreate, setAutoFillOnCreate] = useState(false);

  // Estados de Geração Automática (Modal existente)
  const [isAutoModalOpen, setIsAutoModalOpen] = useState(false);
  const [autoDates, setAutoDates] = useState({ start: '', end: '' });

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Estado de busca para grade comum / administrativa
  const [activeSearchCell, setActiveSearchCell] = useState<{date: string, period: string} | null>(null);

  const [editingSectionIdx, setEditingSectionIdx] = useState<number | null>(null);
  const [editingRowPos, setEditingRowPos] = useState<{sIdx: number, rIdx: number} | null>(null);
  const [editingLegendId, setEditingLegendId] = useState<string | null>(null); // Shift ID para edição de legenda

  const isAdmin = db.getCurrentUser().role === 'ADMIN';

  useEffect(() => { loadData(); }, []);
  const loadData = () => {
    const allRosters = db.getRosters();
    // Ordenar por data de criação (mais recente primeiro)
    allRosters.sort((a, b) => new Date(b.creationDate || 0).getTime() - new Date(a.creationDate || 0).getTime());
    setRosters(allRosters);
    setSoldiers(db.getSoldiers());
  };

  // Inicializa datas padrão ao abrir modal de criação (Continuando da última escala)
  useEffect(() => {
    if (isCreating) {
      // 1. Encontrar a última escala desta categoria para dar continuidade
      const lastRoster = rosters
        .filter(r => r.type === activeTab)
        .sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime())[0];

      let startBase: Date;

      if (lastRoster) {
         // Se existe escala anterior, pega o dia seguinte ao fim dela
         const lastEnd = new Date(lastRoster.endDate + 'T12:00:00');
         startBase = new Date(lastEnd);
         startBase.setDate(lastEnd.getDate() + 1); // Dia posterior
      } else {
         // Se não existe, pega hoje
         startBase = new Date();
      }

      // 2. Ajustar para a próxima Segunda-feira (ou a própria, se startBase já for segunda)
      const currentDay = startBase.getDay(); // 0=Dom, 1=Seg, ... 6=Sab
      
      // Calculo para chegar na segunda-feira (1)
      // Se for Seg (1) -> add 0
      // Se for Ter (2) -> add 6
      // Se for Dom (0) -> add 1
      let daysToMonday = (1 + 7 - currentDay) % 7;
      
      // Regra especial: Se NÃO tem escala anterior e hoje já é segunda, sugere a PRÓXIMA segunda por padrão
      if (!lastRoster && daysToMonday === 0) {
          daysToMonday = 7;
      }

      const nextMon = new Date(startBase);
      nextMon.setDate(startBase.getDate() + daysToMonday);
      
      const nextSun = new Date(nextMon);
      nextSun.setDate(nextMon.getDate() + 6); // +6 dias para fechar no Domingo

      setNewRosterMeta({
        title: '',
        startDate: nextMon.toISOString().split('T')[0],
        endDate: nextSun.toISOString().split('T')[0],
        creationDate: new Date().toISOString().split('T')[0]
      });
      // Resetar checkbox ao abrir modal
      setAutoFillOnCreate(false);
    }
  }, [isCreating, activeTab, rosters]);

  // Inicializa datas da geração automática com as datas da escala selecionada
  useEffect(() => {
    if (isAutoModalOpen && selectedRoster) {
        setAutoDates({
            start: selectedRoster.startDate,
            end: selectedRoster.endDate
        });
    }
  }, [isAutoModalOpen, selectedRoster]);

  const activeCategory = useMemo(() => 
    settings.rosterCategories.find(c => c.id === activeTab) || settings.rosterCategories[0],
  [settings.rosterCategories, activeTab]);

  const filteredRostersByTab = useMemo(() => 
    rosters.filter(r => r.type === activeTab), 
  [rosters, activeTab]);

  const filteredSoldiersForSearch = useMemo(() => {
    const active = soldiers.filter(s => s.status === Status.ATIVO);
    if (!searchQuery.trim()) return active;
    const q = searchQuery.toLowerCase();
    return active.filter(s => s.name.toLowerCase().includes(q) || s.matricula?.includes(q));
  }, [soldiers, searchQuery]);

  // Lista Ordenada para Escala Extra
  const extraRosterData = useMemo(() => {
    if (!selectedRoster || selectedRoster.type !== 'cat_extra') return [];
    
    const validShifts = selectedRoster.shifts.filter(s => s.soldierId);
    
    const list = validShifts.map(shift => {
      const soldier = soldiers.find(s => s.id === shift.soldierId);
      return { shift, soldier };
    }).filter(item => item.soldier) as { shift: any, soldier: Soldier }[];

    return list.sort((a, b) => {
      const weightA = getRankWeight(a.soldier.rank);
      const weightB = getRankWeight(b.soldier.rank);
      if (weightA !== weightB) return weightA - weightB;
      return a.soldier.name.localeCompare(b.soldier.name);
    });
  }, [selectedRoster, soldiers]);

  // Função para calcular qual equipe está de serviço no dia (Reutilizada do Dashboard para consistência)
  const getCycleIndexForDate = (dateObj: Date) => {
    if (!settings.shiftCycleRefDate) return 0;
    const refDate = new Date(settings.shiftCycleRefDate + 'T12:00:00');
    const targetDate = new Date(dateObj.toISOString().split('T')[0] + 'T12:00:00');
    const diffDays = Math.floor((targetDate.getTime() - refDate.getTime()) / (1000 * 60 * 60 * 24));
    return ((diffDays % 4) + 4) % 4; // 0, 1, 2, 3
  };

  const getCycleInfo = (dateObj: Date) => {
    const idx = getCycleIndexForDate(dateObj);
    const teams24 = [
      { name: 'ALFA', color: 'bg-blue-600', text: 'ALFA' },
      { name: 'BRAVO', color: 'bg-green-600', text: 'BRAVO' },
      { name: 'CHARLIE', color: 'bg-yellow-500', text: 'CHARLIE' },
      { name: 'DELTA', color: 'bg-purple-600', text: 'DELTA' }
    ];
    const team2x2 = idx < 2 ? 'TURMA 01' : 'TURMA 02'; // T1 (0,1), T2 (2,3)

    return { 
      team24: teams24[idx],
      team2x2
    };
  };

  // --- LÓGICA DE GERAÇÃO DE SHIFTS (REUTILIZÁVEL E CORRIGIDA) ---
  // rosterType: permite filtrar corretamente a última escala
  const generateShiftsLogic = (startStr: string, endStr: string, sections: RosterSection[], rosterType: string): Shift[] => {
    const start = new Date(startStr + 'T12:00:00');
    const end = new Date(endStr + 'T12:00:00');
    const generatedShifts: Shift[] = [];
    
    // 1. Tentar encontrar a ÚLTIMA escala DO MESMO TIPO válida para usar de base
    const lastRoster = rosters
        .filter(r => r.type === rosterType)
        .sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime())[0];

    // Mapa de Projeção: 
    // Para Ambulância: CycleIndex (0-3) -> { PeriodID -> SoldierID[] }
    // Para Psicologia/Adm/Assistencial/Outras: DayOfWeek (0-6) -> { PeriodID -> SoldierID[] }
    const projectionMap: Record<number, Record<string, string[]>> = {};

    if (lastRoster) {
        // Popula o mapa baseado na escala anterior
        lastRoster.shifts.forEach(s => {
            if (!s.soldierId) return;
            const sDate = new Date(s.date + 'T12:00:00');
            
            let keyIndex: number;
            // Apenas Ambulância usa o ciclo de 4 dias. Todas as outras (incluindo as novas personalizadas) usam Dia da Semana.
            if (rosterType === 'cat_amb') {
                keyIndex = getCycleIndexForDate(sDate);
            } else {
                keyIndex = sDate.getDay(); 
            }

            if (!projectionMap[keyIndex]) projectionMap[keyIndex] = {};
            if (!projectionMap[keyIndex][s.period]) projectionMap[keyIndex][s.period] = [];
            
            // Adiciona na lista (suporta múltiplos militares no mesmo período/linha)
            // Evita duplicatas se houver sujeira no banco
            if (!projectionMap[keyIndex][s.period].includes(s.soldierId)) {
                projectionMap[keyIndex][s.period].push(s.soldierId);
            }
        });
    }

    let current = new Date(start);

    while (current <= end) {
        const dateStr = current.toISOString().split('T')[0];
        
        let cycleKey: number;
        if (rosterType === 'cat_amb') {
             cycleKey = getCycleIndexForDate(current);
        } else {
             cycleKey = current.getDay();
        }
        
        const cycle = getCycleInfo(current);
        
        // --- ESTRATÉGIA 1: USAR PROJEÇÃO DA ÚLTIMA ESCALA ---
        const projectedDay = projectionMap[cycleKey];
        let hasProjectedData = false;

        if (projectedDay && Object.keys(projectedDay).length > 0) {
            // Itera sobre TODAS as seções da estrutura atual para tentar preencher
            // Funciona para todas as escalas que tenham mapeamento
            sections.forEach(sec => {
                sec.rows.forEach(row => {
                    const soldierIds = projectedDay[row.id];
                    if (soldierIds && soldierIds.length > 0) {
                        soldierIds.forEach(sId => {
                            // Verifica se o militar ainda está ativo
                            const soldier = soldiers.find(s => s.id === sId);
                            if (soldier && soldier.status === Status.ATIVO) {
                                generatedShifts.push({ date: dateStr, period: row.id, soldierId: soldier.id });
                                hasProjectedData = true;
                            }
                        });
                    }
                });
            });
        }

        // --- ESTRATÉGIA 2: FALLBACK PARA CADASTRO (EXCLUSIVO PARA AMBULÂNCIA) ---
        // A lógica de "Equipes" (Alfa/Bravo) é muito específica da Ambulância. 
        // Para todas as outras (Adm, Ast, Novas), confiamos APENAS na projeção (Estratégia 1).
        if (!hasProjectedData && rosterType === 'cat_amb') {
            // Mapeamento das seções da Ambulância para Fallback
            const sec24 = sections?.[0]; // 24h
            const sec2x2 = sections?.[1]; // 2x2

            if (sec24 && sec2x2) {
                const team24Name = cycle.team24.name; 
                const team2x2Name = cycle.team2x2; 

                // --- PREENCHER 24H ---
                const soldiers24 = soldiers.filter(s => s.team === team24Name && s.status === Status.ATIVO);
                const drivers24 = soldiers24.filter(s => s.role.includes('Motorista') || s.role === 'Fiscal/Motorista');
                const others24 = soldiers24.filter(s => !drivers24.includes(s)).sort((a,b) => getRankWeight(a.rank) - getRankWeight(b.rank));

                const selectedDriver24 = drivers24[0]; 
                let selectedLeader24 = others24[0];
                let remaining24 = others24.slice(1);

                if (sec24.rows[0] && selectedLeader24) generatedShifts.push({ date: dateStr, period: sec24.rows[0].id, soldierId: selectedLeader24.id });
                if (sec24.rows[1] && selectedDriver24) generatedShifts.push({ date: dateStr, period: sec24.rows[1].id, soldierId: selectedDriver24.id });
                if (sec24.rows[2] && remaining24[0]) generatedShifts.push({ date: dateStr, period: sec24.rows[2].id, soldierId: remaining24[0].id });
                if (sec24.rows[3] && remaining24[1]) generatedShifts.push({ date: dateStr, period: sec24.rows[3].id, soldierId: remaining24[1].id });

                // --- PREENCHER 2x2 ---
                const soldiers2x2 = soldiers.filter(s => s.team === team2x2Name && s.status === Status.ATIVO);
                const drivers2x2 = soldiers2x2.filter(s => s.role.includes('Motorista'));
                const others2x2 = soldiers2x2.filter(s => !drivers2x2.includes(s)).sort((a,b) => getRankWeight(a.rank) - getRankWeight(b.rank));

                const selectedDriver2x2 = drivers2x2[0];
                const selectedLeader2x2 = others2x2[0];
                const remaining2x2 = others2x2.slice(1);

                if (sec2x2.rows[0] && selectedLeader2x2) generatedShifts.push({ date: dateStr, period: sec2x2.rows[0].id, soldierId: selectedLeader2x2.id });
                if (sec2x2.rows[1] && selectedDriver2x2) generatedShifts.push({ date: dateStr, period: sec2x2.rows[1].id, soldierId: selectedDriver2x2.id });
                if (sec2x2.rows[2] && remaining2x2[0]) generatedShifts.push({ date: dateStr, period: sec2x2.rows[2].id, soldierId: remaining2x2[0].id });
            }
        }

        current.setDate(current.getDate() + 1);
    }
    return generatedShifts;
  };

  // --- HANDLER DO MODAL DE GERAÇÃO (EM ESCALA JÁ EXISTENTE) ---
  const handleAutoGenerate = () => {
    if (!selectedRoster || !autoDates.start || !autoDates.end || !selectedRoster.sections) return;
    
    // 1. Filtrar shifts existentes para não duplicar (remove os do período selecionado)
    const start = new Date(autoDates.start + 'T12:00:00');
    const end = new Date(autoDates.end + 'T12:00:00');
    
    const existingShifts = selectedRoster.shifts.filter(s => {
        const d = new Date(s.date + 'T12:00:00');
        return d < start || d > end;
    });

    // 2. Gerar novos shifts (Passando o tipo da escala)
    const newShifts = generateShiftsLogic(autoDates.start, autoDates.end, selectedRoster.sections, selectedRoster.type);

    if (newShifts.length === 0) {
        alert("Não foi possível gerar a escala. Se for uma escala nova ou personalizada, é necessário que exista uma escala anterior para copiar a sequência.");
    }

    // 3. Salvar
    const finalShifts = [...existingShifts, ...newShifts];
    updateRoster({ ...selectedRoster, shifts: finalShifts });
    setIsAutoModalOpen(false);
    alert("Escala atualizada com a sequência lógica!");
  };

  const getDefaultStructure = (catId: string): RosterSection[] => {
    if (catId === 'cat_amb') {
      return [
        { title: "(24H X 72H) - TURNO DE 06H ÀS 06H", rows: [{ id: 'A1', label: 'Líder' }, { id: 'A2', label: 'Mot.' }, { id: 'A3', label: 'Aux.' }, { id: 'A4', label: 'Aux.' }] },
        { title: "2 X 2 - TURNO DE 06H ÀS 06H", rows: [{ id: 'B1', label: 'Líder' }, { id: 'B2', label: 'Mot.' }, { id: 'B3', label: 'Aux.' }] },
        { title: "VIATURA EXTRA / APOIO", rows: [{ id: 'EX1', label: 'Líder' }, { id: 'EX2', label: 'Mot.' }, { id: 'EX3', label: 'Aux.' }] },
        { title: "ESCALA DE SOBREAVISO BIOPSICOSSOCIAL 24H", rows: [{ id: 'C1', label: 'Plantão' }] }
      ];
    }
    if (catId === 'cat_adm') {
      return [
        { 
          title: "ADMINISTRATIVO", 
          rows: [
            { id: 'ADM_EXP_1', label: 'EXPEDIENTE\n08H00 ÀS 16H30' },
            { id: 'ADM_CEJUM', label: 'CEJUM\n08h00 às 16h30' },
            { id: 'ADM_BPGEP', label: 'BPGEP\n08h00 às 16h30' },
            { id: 'ADM_P4', label: 'P4\n08h00 às 16h30' },
            { id: 'ADM_MAN', label: 'MANUTENÇÃO\n07h00 às 16h30' },
            { id: 'ADM_PROJ', label: 'PROJETOS\n08h00 às 16h30' },
            { id: 'ADM_RECEP', label: 'RECEPÇÃO - CAB' },
            { id: 'ADM_PSICO', label: 'PSICOSSOCIAL -\nPRESENCIAL ATÉ 16h30/SOBREAVISO' },
            { id: 'ADM_CAP', label: 'CAPELANIA' },
            { id: 'ADM_FOLGA', label: 'FOLGA' }
          ] 
        }
      ];
    }
    // ESTRUTURA PADRÃO PARA PSICOLOGIA
    if (catId === 'cat_psi') {
      return [
        { title: "ATENDIMENTO PSICOLÓGICO", rows: [
          { id: 'PSI_TRI', label: 'TRIAGEM' },
          { id: 'PSI_CLI', label: 'CLÍNICO' },
          { id: 'PSI_SOBRE', label: 'SOBREAVISO' }
        ]}
      ];
    }
    if (catId === 'cat_ast') {
      return [
        { title: "SERVIÇO SOCIAL", rows: [
          { id: 'AST_VIS', label: 'VISITA HOSPITALAR' },
          { id: 'AST_INT', label: 'INTERVENÇÃO SOCIAL' },
          { id: 'AST_SOBRE', label: 'SOBREAVISO 24H' }
        ]}
      ];
    }
    
    // ESTRUTURA GENÉRICA (PARA CATEGORIAS PERSONALIZADAS)
    return [
      { title: "ESCALA DE SERVIÇO", rows: [
        { id: `R_${Date.now()}_1`, label: 'COORDENAÇÃO / CHEFIA' },
        { id: `R_${Date.now()}_2`, label: 'EQUIPE TÉCNICA' },
        { id: `R_${Date.now()}_3`, label: 'SOBREAVISO' }
      ]}
    ];
  };

  const handleCreateRoster = () => {
    if (!newRosterMeta.startDate || !newRosterMeta.endDate) return alert("Selecione o período da escala.");
    
    const isExtra = activeTab === 'cat_extra';
    const isAdm = activeTab === 'cat_adm';
    const isPsi = activeTab === 'cat_psi';
    const isAmb = activeTab === 'cat_amb';
    const isAst = activeTab === 'cat_ast';
    
    const catName = settings.rosterCategories.find(c => c.id === activeTab)?.name.toUpperCase() || 'SERVIÇO';
    
    let defaultTitle = `ESCALA DE SERVIÇO – ${catName}`;
    
    if (isExtra) defaultTitle = 'CAMINHADA COM MARIA 2025';
    if (isAdm) defaultTitle = 'ESCALA DE SERVIÇO ADMINISTRATIVO';
    if (isPsi) defaultTitle = 'ESCALA DE PSICOLOGIA';
    if (isAst) defaultTitle = 'ESCALA DE SERVIÇO SOCIAL';

    const startD = new Date(newRosterMeta.startDate);
    
    // Subtítulo padrão
    let subTitle = '';
    if (isAmb) subTitle = 'AMBULÂNCIAS A SEREM UTILIZADAS...';
    else if (isPsi) subTitle = 'PSICOLOGIA - ESCALA DE SERVIÇO';
    else if (!isAdm && !isExtra) subTitle = `${catName} - ESCALA DE SERVIÇO`;

    // 1. Obter estrutura padrão
    // IMPORTANTE: Para Adm, Ast e Customizadas, se o preenchimento automático estiver ativo, 
    // tentamos copiar a ESTRUTURA (linhas/setores) da última escala para garantir que 
    // personalizações sejam mantidas e os militares sejam mapeados corretamente.
    let sections = isExtra ? [] : getDefaultStructure(activeTab);

    // Buscar a última escala para referência de estrutura
    const lastRoster = rosters
        .filter(r => r.type === activeTab)
        .sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime())[0];

    if (autoFillOnCreate && lastRoster && lastRoster.sections && lastRoster.sections.length > 0) {
        // Deep copy da estrutura anterior para preservar linhas personalizadas
        sections = JSON.parse(JSON.stringify(lastRoster.sections));
    }

    // 2. Gerar Shifts Iniciais (Se Auto-Fill estiver ativado)
    // Habilitado para TODOS os tipos exceto Extra
    let initialShifts: Shift[] = [];
    if (!isExtra && autoFillOnCreate) {
        initialShifts = generateShiftsLogic(newRosterMeta.startDate, newRosterMeta.endDate, sections, activeTab);
    }

    const newRoster: Roster = {
      id: Date.now().toString(),
      type: activeTab,
      title: newRosterMeta.title || defaultTitle,
      headerTitle: settings.orgName, 
      month: startD.getMonth() + 1,
      year: startD.getFullYear(),
      startDate: newRosterMeta.startDate,
      endDate: newRosterMeta.endDate,
      creationDate: newRosterMeta.creationDate || new Date().toISOString().split('T')[0],
      shifts: initialShifts, // Usa os shifts gerados (ou vazio)
      observations: isExtra ? '' : (isAdm ? 'Obs: (M) Motorista, (T) Tarde' : 'Obs.1: ...'),
      observationsTitle: 'Observações Gerais',
      situationText: isExtra ? '' : '',
      subTitle: subTitle,
      isPublished: false,
      sections: sections,
      customHeaders: isExtra ? ['ORDEM', 'POST/GRADUAÇÃO', 'NUMERO', 'NOME COMPLETO', 'MATRICULA', 'CELULAR'] : undefined
    };
    db.saveRoster(newRoster);
    
    setRosters(prev => [newRoster, ...prev]);
    setSelectedRoster(newRoster);
    setIsCreating(false);

    if (!isExtra && autoFillOnCreate) {
        if (initialShifts.length > 0) {
            alert("Nova escala criada e preenchida com a sequência lógica!");
        } else {
            alert("Escala criada, mas não foi possível preencher automaticamente. Verifique se existe uma escala anterior para servir de base.");
        }
    }
  };

  const handleDeleteRoster = (targetId?: string) => {
    const idToDelete = targetId || selectedRoster?.id;
    if (!idToDelete) return;
    
    const rosterToDelete = rosters.find(r => r.id === idToDelete);
    
    if (confirm(`ATENÇÃO: Deseja excluir PERMANENTEMENTE a escala "${rosterToDelete?.title || 'Selecionada'}"?`)) {
      db.deleteRoster(idToDelete);
      
      // Atualiza estado local
      setRosters(prev => prev.filter(r => r.id !== idToDelete));
      
      if (selectedRoster?.id === idToDelete) {
        setSelectedRoster(null);
      }
    }
  };

  const addRow = (sIdx: number) => {
    if (!selectedRoster || !selectedRoster.sections) return;
    const newSections = selectedRoster.sections.map((sec, idx) => 
      idx !== sIdx ? sec : { ...sec, rows: [...sec.rows, { id: `R_${Date.now()}`, label: 'NOVO BLOCO/SETOR' }] }
    );
    updateRoster({ ...selectedRoster, sections: newSections });
  };

  const deleteRow = (sIdx: number, rIdx: number) => {
    if (!selectedRoster || !selectedRoster.sections) return;
    if (!confirm("Excluir este bloco/setor? Todos os agendamentos nele serão perdidos.")) return;
    const newSections = selectedRoster.sections.map((sec, idx) => 
      idx !== sIdx ? sec : { ...sec, rows: sec.rows.filter((_, i) => i !== rIdx) }
    );
    updateRoster({ ...selectedRoster, sections: newSections });
  };

  const addSection = () => {
    if (!selectedRoster) return;
    const newSections = [...(selectedRoster.sections || []), { title: "NOVO BLOCO", rows: [{ id: `R_${Date.now()}`, label: 'FUNÇÃO' }] }];
    updateRoster({ ...selectedRoster, sections: newSections });
  };

  const deleteSection = (sIdx: number) => {
    if (!selectedRoster || !selectedRoster.sections) return;
    if (!confirm("Excluir bloco inteiro?")) return;
    updateRoster({ ...selectedRoster, sections: selectedRoster.sections.filter((_, idx) => idx !== sIdx) });
  };

  const updateSectionTitle = (sIdx: number, title: string) => {
    if (!selectedRoster || !selectedRoster.sections) return;
    const newSections = selectedRoster.sections.map((sec, idx) => idx === sIdx ? { ...sec, title: title.toUpperCase() } : sec);
    updateRoster({ ...selectedRoster, sections: newSections });
    setEditingSectionIdx(null);
  };

  const updateRowLabel = (sIdx: number, rIdx: number, label: string) => {
    if (!selectedRoster || !selectedRoster.sections) return;
    const newSections = selectedRoster.sections.map((sec, idx) => {
      if (idx !== sIdx) return sec;
      const newRows = sec.rows.map((row, i) => i === rIdx ? { ...row, label: label.toUpperCase() } : row);
      return { ...sec, rows: newRows };
    });
    updateRoster({ ...selectedRoster, sections: newSections });
    setEditingRowPos(null);
  };

  // Atualização genérica (substitui)
  const updateShift = (date: string, period: string, soldierId: string) => {
    if (!selectedRoster) return;
    const newShifts = [...selectedRoster.shifts];
    const idx = newShifts.findIndex(s => s.date === date && s.period === period);
    
    if (soldierId === '') { 
      if (idx >= 0) newShifts.splice(idx, 1); 
    } else { 
      if (idx >= 0) newShifts[idx].soldierId = soldierId; 
      else newShifts.push({ date, period, soldierId }); 
    }
    updateRoster({ ...selectedRoster, shifts: newShifts });
    setIsSearchOpen(false);
  };

  // Adiciona militar à célula (suporta múltiplos)
  const addShiftToCell = (date: string, period: string, soldierId: string) => {
    if (!selectedRoster) return;
    // Verifica se já está nesta célula
    if (selectedRoster.shifts.some(s => s.date === date && s.period === period && s.soldierId === soldierId)) {
      alert("Este militar já está escalado nesta função neste dia.");
      return;
    }
    const newShifts = [...selectedRoster.shifts, { date, period, soldierId }];
    updateRoster({ ...selectedRoster, shifts: newShifts });
    setIsSearchOpen(false);
  };

  const removeShiftFromCell = (shift: any) => {
    if (!selectedRoster) return;
    const newShifts = selectedRoster.shifts.filter(s => s !== shift);
    updateRoster({ ...selectedRoster, shifts: newShifts });
  };

  // Atualiza a nota (Legenda Curta personalizada) do plantão
  const updateShiftNote = (shiftToUpdate: Shift, newNote: string) => {
    if (!selectedRoster) return;
    const newShifts = selectedRoster.shifts.map(s => 
      (s.date === shiftToUpdate.date && s.period === shiftToUpdate.period && s.soldierId === shiftToUpdate.soldierId)
      ? { ...s, note: newNote.toUpperCase() }
      : s
    );
    updateRoster({ ...selectedRoster, shifts: newShifts });
    setEditingLegendId(null);
  };

  // --- FUNÇÕES DE EDIÇÃO (ESCALA EXTRA) ---
  const handleAddSoldierToExtra = (soldierId: string) => {
    if (!selectedRoster) return;
    if (selectedRoster.shifts.some(s => s.soldierId === soldierId)) {
      alert("Este militar já está na lista.");
      return;
    }
    const newShifts = [...selectedRoster.shifts, {
      date: selectedRoster.startDate,
      period: `EXTRA_${Date.now()}`, 
      soldierId,
      note: '',
      customData: {} 
    }];
    updateRoster({ ...selectedRoster, shifts: newShifts });

    // --- AUTOMAÇÃO BANCO DE FOLGAS (ADICIONAR) ---
    const soldier = soldiers.find(s => s.id === soldierId);
    if (soldier) {
        const newTx: BankTransaction = {
            id: `AUTO_${Date.now()}`,
            type: 'CREDIT',
            date: selectedRoster.startDate,
            amount: 1,
            description: `ESCALA EXTRA: ${selectedRoster.title}`,
            recordedAt: new Date().toISOString()
        };
        
        const updatedSoldier = { ...soldier, bankHistory: [...(soldier.bankHistory || []), newTx] };
        db.saveSoldier(updatedSoldier);
        
        // Atualiza estado local de soldiers para refletir a mudança
        setSoldiers(prev => prev.map(s => s.id === updatedSoldier.id ? updatedSoldier : s));
        alert(`Militar adicionado à escala!\n+1 Folga creditada automaticamente para ${getAbbreviatedRank(soldier.rank)} ${soldier.name}.`);
    }

    setIsSearchOpen(false);
  };

  const handleRemoveSoldierFromExtra = (soldierId: string) => {
    if (!selectedRoster) return;
    const newShifts = selectedRoster.shifts.filter(s => s.soldierId !== soldierId);
    updateRoster({ ...selectedRoster, shifts: newShifts });

    // --- AUTOMAÇÃO BANCO DE FOLGAS (REMOVER) ---
    // Remove o crédito automático caso o militar seja removido da escala
    const soldier = soldiers.find(s => s.id === soldierId);
    if (soldier && soldier.bankHistory) {
        // Procura a transação automática específica desta escala
        const txIndex = soldier.bankHistory.findIndex(t => 
            t.description === `ESCALA EXTRA: ${selectedRoster.title}` && t.type === 'CREDIT'
        );

        if (txIndex > -1) {
            const newHistory = [...soldier.bankHistory];
            newHistory.splice(txIndex, 1); // Remove a transação
            const updatedSoldier = { ...soldier, bankHistory: newHistory };
            db.saveSoldier(updatedSoldier);
            setSoldiers(prev => prev.map(s => s.id === updatedSoldier.id ? updatedSoldier : s));
            alert(`Militar removido da escala.\nO crédito de folga referente a esta escala foi estornado.`);
        }
    }
  };

  // Funções de Coluna Dinâmica
  const handleAddColumn = () => {
    if (!selectedRoster) return;
    const newHeaders = [...(selectedRoster.customHeaders || ['ORDEM', 'POST/GRADUAÇÃO', 'NUMERO', 'NOME COMPLETO', 'MATRICULA', 'CELULAR'])];
    newHeaders.push('NOVA COLUNA');
    updateRoster({ ...selectedRoster, customHeaders: newHeaders });
  };

  const handleRemoveColumn = (index: number) => {
    if (!selectedRoster || !selectedRoster.customHeaders) return;
    if (selectedRoster.customHeaders.length <= 1) return alert("A tabela deve ter pelo menos uma coluna.");
    if (!confirm("Excluir esta coluna?")) return;
    
    const newHeaders = [...selectedRoster.customHeaders];
    newHeaders.splice(index, 1);
    
    updateRoster({ ...selectedRoster, customHeaders: newHeaders });
  };

  const updateCustomHeader = (index: number, value: string) => {
    if (!selectedRoster) return;
    const newHeaders = [...(selectedRoster.customHeaders || [])];
    newHeaders[index] = value.toUpperCase();
    updateRoster({ ...selectedRoster, customHeaders: newHeaders });
  };

  const updateCustomCell = (soldierId: string, colIndex: number, value: string) => {
    if (!selectedRoster) return;
    const newShifts = selectedRoster.shifts.map(s => {
      if (s.soldierId === soldierId) {
        const newData = { ...(s.customData || {}) };
        newData[colIndex.toString()] = value.toUpperCase();
        return { ...s, customData: newData };
      }
      return s;
    });
    updateRoster({ ...selectedRoster, shifts: newShifts });
  };

  // Helper para renderizar célula dinâmica com DADOS AUTOMÁTICOS
  const renderDynamicCell = (headerName: string, item: { shift: any, soldier: Soldier }, colIndex: number) => {
    const h = headerName.toUpperCase();
    const s = item.soldier;

    if (h.includes('ORD') || h.includes('ITEM')) return <span className="font-bold">#</span>; 
    if (h.includes('GRAD') || h.includes('POSTO')) return <span>{getAbbreviatedRank(s.rank)}</span>;
    if (h.includes('COMPLETO')) return <span className="font-bold text-left block pl-2 text-[9px]">{s.fullName || s.name}</span>;
    if (h.includes('NOME')) return <span className="font-bold text-left block pl-2 truncate">{s.name}</span>;
    if (h === 'NUMERO' || h.includes('NUMERO') || h.includes('NUMERAL')) return <span>{s.matricula || '-'}</span>;
    if (h.includes('MATRICULA') || h.includes('MATRÍCULA') || h === 'MF' || h === 'M.F' || h.includes('FUNCIONAL')) return <span>{s.mf || '-'}</span>;
    if (h === 'MAT' || h === 'MAT.' || h === 'NUM' || h === 'NUM.') return <span>{s.matricula || '-'}</span>;
    if (h.includes('CEL') || h.includes('TEL')) return <span className="text-[10px]">{s.phone || '-'}</span>;
    if (h.includes('FUN') || h.includes('CARGO')) return <span className="text-[10px]">{s.role}</span>;
    if (h.includes('SETOR') || h.includes('UNIDADE') || h.includes('LOTA')) return <span className="text-[10px]">{s.sector}</span>;
    if (h.includes('SIT') || h.includes('STATUS')) return <span className="text-[9px] font-bold">{s.status}</span>;
    if (h === 'NR' || h === 'NR.' || h === 'OBS') {
         const val = item.shift.customData?.[colIndex] !== undefined ? item.shift.customData[colIndex] : (item.shift.note || '');
         return <input readOnly={!isAdmin} className={`w-full h-full text-center outline-none bg-transparent uppercase p-1 ${isAdmin ? '' : 'pointer-events-none'}`} value={val} onChange={e => updateCustomCell(s.id, colIndex, e.target.value)} />;
    }
    return <input readOnly={!isAdmin} className={`w-full h-full text-center outline-none bg-transparent uppercase p-1 focus:bg-yellow-50 ${isAdmin ? '' : 'pointer-events-none'}`} value={item.shift.customData?.[colIndex.toString()] || ''} onChange={e => updateCustomCell(s.id, colIndex, e.target.value)} placeholder={isAdmin ? "..." : ""} />;
  };

  const updateRoster = (updated: Roster) => {
    setSelectedRoster(updated);
    db.saveRoster(updated);
    // Atualiza o estado da lista também para refletir mudanças no título ou datas na grid
    setRosters(prev => prev.map(r => r.id === updated.id ? updated : r));
  };

  const handleAutoSituation = () => {
    if (!selectedRoster) return;
    
    // 1. Filtra qualquer militar que NÃO esteja "ATIVO".
    // Isso garante que Férias, Licenças, Folgas, etc. apareçam.
    const notActiveSoldiers = soldiers.filter(s => s.status !== Status.ATIVO);
    
    if (notActiveSoldiers.length === 0) {
      alert("Nenhum militar com status de afastamento ou alteração (Férias, Licença, Folga, etc) encontrado.");
      return;
    }

    // 2. Ordena por Posto/Graduação e Nome para organização
    notActiveSoldiers.sort((a, b) => {
        const wA = getRankWeight(a.rank);
        const wB = getRankWeight(b.rank);
        if (wA !== wB) return wA - wB;
        return a.name.localeCompare(b.name);
    });

    // 3. Formata Data (DD/MM) manualmente para evitar problemas de timezone
    // new Date('2024-05-10') pode retornar dia 09 dependendo do fuso. .split evita isso.
    const formatDate = (dateStr: string) => {
        if (!dateStr) return '';
        const [year, month, day] = dateStr.split('-');
        return `${day}/${month}`;
    };

    // 4. Gera o Texto
    const textLines = notActiveSoldiers.map(s => {
      let statusText = s.status.toString().toUpperCase();

      // Adiciona período se houver datas
      if (s.absenceStartDate && s.absenceEndDate) {
        const d1 = formatDate(s.absenceStartDate);
        const d2 = formatDate(s.absenceEndDate);
        statusText += ` DE ${d1} A ${d2}`;
      }

      // Adiciona motivo da folga se houver
      if (s.status === Status.FOLGA && s.folgaReason) {
         statusText += ` - ${s.folgaReason.toUpperCase()}`;
      }

      return `${getAbbreviatedRank(s.rank)} ${s.name} (${statusText})`;
    });

    const newText = textLines.join(', ');
    updateRoster({...selectedRoster, situationText: newText});
  };

  const DynamicIcon = ({ name, size = 20, className = "" }: { name: string, size?: number, className?: string }) => {
    const IconComponent = (Icons as any)[name] || Scale;
    return <IconComponent size={size} className={className} />;
  };

  const HEADERS = selectedRoster?.customHeaders || ['ORDEM', 'POST/GRADUAÇÃO', 'NUMERO', 'NOME COMPLETO', 'MATRICULA', 'CELULAR'];

  const getDates = () => {
    if (!selectedRoster) return [];
    const dates = [];
    let curr = new Date(selectedRoster.startDate + 'T12:00:00');
    const end = new Date(selectedRoster.endDate + 'T12:00:00');
    while(curr <= end) { dates.push(new Date(curr)); curr.setDate(curr.getDate() + 1); }
    return dates;
  };

  const dates = getDates();

  return (
    <div className="h-full flex flex-col space-y-4">
      {/* SELEÇÃO DE CATEGORIA */}
      <div className="relative z-30">
        <button 
          onClick={() => setIsCategoryMenuOpen(!isCategoryMenuOpen)}
          className="w-full bg-white rounded-xl shadow-lg border border-gray-200 p-4 flex items-center justify-between hover:bg-gray-50 transition-all group"
        >
          <div className="flex items-center space-x-3">
             <div className="p-2 bg-pm-100 rounded-lg text-pm-800">
               <DynamicIcon name={activeCategory?.icon || 'Scale'} size={24} />
             </div>
             <div className="text-left">
                <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Categoria da Escala Selecionada</p>
                <h2 className="text-xl font-black text-pm-900 uppercase tracking-tight">{activeCategory?.name || 'Selecione...'}</h2>
             </div>
          </div>
          <ChevronDown size={24} className={`text-gray-400 transition-transform duration-300 ${isCategoryMenuOpen ? 'rotate-180' : ''}`} />
        </button>

        {isCategoryMenuOpen && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in slide-in-from-top-2">
             <div className="max-h-[300px] overflow-y-auto divide-y divide-gray-100">
               {settings.rosterCategories.map(cat => (
                 <button
                   key={cat.id}
                   onClick={() => { 
                     setActiveTab(cat.id); 
                     setSelectedRoster(null); 
                     setIsCreating(false); 
                     setIsCategoryMenuOpen(false);
                   }}
                   className={`w-full flex items-center justify-between p-4 hover:bg-pm-50 transition-colors
                     ${activeTab === cat.id ? 'bg-pm-50 border-l-4 border-pm-700' : 'border-l-4 border-transparent'}`}
                 >
                    <div className="flex items-center space-x-3">
                      <DynamicIcon name={cat.icon} className={activeTab === cat.id ? 'text-pm-700' : 'text-gray-400'} size={20} />
                      <span className={`uppercase text-sm font-bold ${activeTab === cat.id ? 'text-pm-900' : 'text-gray-500'}`}>{cat.name}</span>
                    </div>
                    {activeTab === cat.id && <Check size={16} className="text-pm-700" />}
                 </button>
               ))}
             </div>
          </div>
        )}
      </div>

      <div className="flex justify-between items-center bg-white p-3 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center space-x-3">
          <Scale size={18} className="text-pm-900" />
          <select 
            className="border-gray-200 rounded-lg text-xs font-black text-pm-900 focus:ring-pm-500 bg-gray-50 px-3 py-2 min-w-[280px]" 
            value={selectedRoster?.id || ''} 
            onChange={e => setSelectedRoster(rosters.find(r => r.id === e.target.value) || null)}
          >
            <option value="">{selectedRoster ? '(FECHAR ESCALA ATUAL)' : 'SELECIONE UMA ESCALA SALVA...'}</option>
            {filteredRostersByTab.map(r => <option key={r.id} value={r.id}>{r.title} ({new Date(r.startDate).toLocaleDateString()})</option>)}
          </select>
          {isAdmin && (
            <button onClick={() => setIsCreating(true)} className="flex items-center space-x-1.5 bg-pm-700 text-white px-4 py-2 rounded-lg font-black text-[10px] hover:bg-pm-950 transition-all shadow-md">
              <Plus size={14} /> <span>NOVA ESCALA</span>
            </button>
          )}
        </div>
        {selectedRoster && (
          <div className="flex space-x-2">
            {isAdmin && (
              <button onClick={() => handleDeleteRoster()} className="bg-red-50 text-red-600 hover:bg-red-600 hover:text-white px-4 py-2 rounded-lg flex items-center space-x-2 font-black text-[10px] shadow-sm transition-all border border-red-200">
                <Trash2 size={14}/> <span>EXCLUIR</span>
              </button>
            )}
            <button onClick={() => setShowPrint(true)} className="bg-gov-green text-white px-4 py-2 rounded-lg flex items-center space-x-2 font-black text-[10px] shadow-lg hover:bg-green-700">
              <FileText size={14}/> <span>IMPRIMIR</span>
            </button>
          </div>
        )}
      </div>

      {isCreating ? (
        <div className="bg-white p-8 rounded-2xl shadow-2xl max-w-lg mx-auto border border-gray-100 animate-in zoom-in-95">
           <h3 className="text-xl font-black text-pm-900 uppercase mb-6 border-b pb-4">Configurar Nova Escala</h3>
           <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase ml-1 flex items-center"><Calendar size={12} className="mr-1"/> Data de Início</label>
                  <input type="date" className="w-full p-3 border rounded-lg font-bold" value={newRosterMeta.startDate} onChange={e => setNewRosterMeta({...newRosterMeta, startDate: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase ml-1 flex items-center"><Calendar size={12} className="mr-1"/> Data Final</label>
                  <input type="date" className="w-full p-3 border rounded-lg font-bold" value={newRosterMeta.endDate} onChange={e => setNewRosterMeta({...newRosterMeta, endDate: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Data de Criação (Emissão)</label>
                <input type="date" className="w-full p-3 border rounded-lg font-bold" value={newRosterMeta.creationDate} onChange={e => setNewRosterMeta({...newRosterMeta, creationDate: e.target.value})} />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Título da Planilha</label>
                <input type="text" className="w-full p-3 border rounded-lg uppercase font-black" placeholder="EX: CAMINHADA COM MARIA" value={newRosterMeta.title} onChange={e => setNewRosterMeta({...newRosterMeta, title: e.target.value})} />
              </div>
              
              {/* Checkbox de Auto-Preenchimento (HABILITADO PARA TODAS EXCETO EXTRA) */}
              {(activeTab !== 'cat_extra') && (
                <div className="bg-purple-50 p-3 rounded-xl border border-purple-100 flex items-start space-x-3 cursor-pointer hover:bg-purple-100 transition-colors" onClick={() => setAutoFillOnCreate(!autoFillOnCreate)}>
                   <div className={`w-5 h-5 rounded border flex items-center justify-center mt-0.5 ${autoFillOnCreate ? 'bg-purple-600 border-purple-600 text-white' : 'bg-white border-gray-300'}`}>
                      {autoFillOnCreate && <Check size={14} />}
                   </div>
                   <div>
                      <p className="text-xs font-black text-purple-900 uppercase">Preencher Automaticamente</p>
                      <p className="text-[10px] text-purple-700 leading-tight mt-0.5">
                         {activeTab === 'cat_amb' 
                            ? 'O sistema irá distribuir os militares nas equipes (24h/2x2) conforme a última escala ou cadastro.' 
                            : 'O sistema irá copiar a distribuição da última escala realizada (dia da semana), incluindo linhas e setores personalizados.'}
                      </p>
                   </div>
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-4">
                <button onClick={() => setIsCreating(false)} className="px-6 py-2 text-gray-400 font-bold hover:text-gray-600 transition-colors">Cancelar</button>
                <button onClick={handleCreateRoster} className="bg-pm-900 text-white px-8 py-2 rounded-lg font-black shadow-lg hover:bg-pm-950 active:scale-95 transition-all flex items-center gap-2">
                   {autoFillOnCreate ? <Sparkles size={16}/> : null}
                   CRIAR AGORA
                </button>
              </div>
           </div>
        </div>
      ) : selectedRoster ? (
        selectedRoster.type === 'cat_extra' ? (
          <div className="flex-1 overflow-auto bg-gray-200/80 flex justify-center p-8 rounded-lg border-inner shadow-inner">
             {/* ESCALA EXTRA (LISTA) - CÓDIGO INALTERADO */}
             <div className="w-[210mm] min-h-[297mm] bg-white shadow-2xl relative flex flex-col mx-auto" style={{ padding: '20mm', fontFamily: 'Arial, Helvetica, sans-serif' }}>
                 {/* ... (conteúdo da escala extra) ... */}
                 <header className="flex justify-between items-start mb-6 h-24 relative w-full border-b border-transparent hover:border-blue-200 transition-colors group">
                    {settings.showLogoLeft && settings.logoLeft && <img src={settings.logoLeft} className="h-20 w-auto object-contain" alt="PMCE" />}
                    <div className="flex-1 text-center self-center px-4">
                       <span className="text-gray-300 text-[10px] uppercase font-bold opacity-0 group-hover:opacity-100">Logos e Cabeçalho (Automático)</span>
                    </div>
                    {settings.showLogoRight && settings.logoRight && <img src={settings.logoRight} className="h-20 w-auto object-contain" alt="Gov" />}
                 </header>

                 <div className="text-center mb-6 relative group">
                    <input 
                      readOnly={!isAdmin}
                      className={`w-full text-center text-[18pt] font-bold uppercase leading-tight outline-none border-b-2 border-transparent bg-transparent ${isAdmin ? 'hover:border-pm-300 focus:border-pm-500 placeholder-gray-300' : 'pointer-events-none'}`}
                      value={selectedRoster.title}
                      onChange={e => updateRoster({...selectedRoster, title: e.target.value.toUpperCase()})}
                      placeholder={isAdmin ? "CLIQUE PARA EDITAR O TÍTULO" : ""}
                    />
                    <Edit3 size={16} className={`absolute right-0 top-1/2 -translate-y-1/2 text-gray-400 opacity-0 group-hover:opacity-100 ${!isAdmin ? 'hidden' : ''}`}/>
                 </div>

                 <div className="mb-6 text-[12pt] text-left relative group">
                     <span className="font-bold">APRESENTAÇÃO:</span> 
                     <textarea 
                       readOnly={!isAdmin}
                       className={`w-full uppercase outline-none border border-transparent rounded p-1 resize-none overflow-hidden bg-transparent ${isAdmin ? 'hover:border-gray-300 focus:border-pm-500' : ''}`}
                       rows={2}
                       value={selectedRoster.observations || ''}
                       onChange={e => updateRoster({...selectedRoster, observations: e.target.value.toUpperCase()})}
                       placeholder={isAdmin ? "DIGITE AQUI O TEXTO DE APRESENTAÇÃO (EX: SERÁ REALIZADO NO DIA...)" : ""}
                     />
                 </div>

                 {isAdmin && (
                   <div className="flex justify-end space-x-2 mb-2 no-print">
                      <button onClick={handleAddColumn} className="text-[10px] uppercase font-bold bg-blue-50 text-blue-600 px-3 py-1 rounded hover:bg-blue-100 flex items-center">
                        <Columns size={12} className="mr-1"/> Add Coluna
                      </button>
                      <button onClick={() => { setActiveSearchCell(null); setIsSearchOpen(true); }} className="text-[10px] uppercase font-bold bg-green-50 text-green-600 px-3 py-1 rounded hover:bg-green-100 flex items-center">
                        <PlusCircle size={12} className="mr-1"/> Add Linha (Militar)
                      </button>
                   </div>
                 )}

                 <table className="w-full border-collapse border border-black text-[11pt] mb-4 table-auto">
                    <thead>
                      <tr className="bg-[#e6e6e6]">
                        {HEADERS.map((header, idx) => (
                           <th key={idx} className="border border-black p-0 text-center font-bold relative group">
                              <input 
                                readOnly={!isAdmin}
                                value={header} 
                                onChange={e => updateCustomHeader(idx, e.target.value)} 
                                className={`w-full bg-transparent text-center font-bold outline-none uppercase p-1 min-w-[30px] ${isAdmin ? '' : 'pointer-events-none'}`}
                              />
                              {isAdmin && HEADERS.length > 1 && (
                                <button 
                                  onClick={() => handleRemoveColumn(idx)}
                                  className="absolute -top-3 right-0 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity bg-white rounded-full p-0.5 shadow-sm"
                                  title="Remover Coluna"
                                >
                                  <CloseIcon size={12}/>
                                </button>
                              )}
                           </th>
                        ))}
                        {isAdmin && <th className="border border-black w-[30px] bg-white border-t-0 border-r-0 border-b-0"></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {extraRosterData.map((item, index) => (
                        <tr key={item.soldier.id} className="group hover:bg-gray-50">
                          {HEADERS.map((header, colIndex) => (
                             <td key={colIndex} className="border border-black p-0.5 text-center align-middle">
                                {header.includes('ORD') ? (
                                   <span className="font-bold">{(index + 1).toString().padStart(2, '0')}</span>
                                ) : (
                                   renderDynamicCell(header, item, colIndex)
                                )}
                             </td>
                          ))}
                          
                          {isAdmin && (
                            <td className="p-0 border-none align-middle text-center bg-white">
                              <button onClick={() => handleRemoveSoldierFromExtra(item.soldier.id)} className="text-red-300 hover:text-red-600 p-1 opacity-0 group-hover:opacity-100 transition-all">
                                <MinusCircle size={16}/>
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                      {extraRosterData.length === 0 && (<tr><td colSpan={HEADERS.length + 1} className="border border-black p-8 text-center text-gray-300 italic">Nenhum militar adicionado à lista.</td></tr>)}
                    </tbody>
                 </table>

                 <div className="text-right text-[12pt] mb-16 mt-auto relative group">
                    <span className="font-bold">{settings.city},</span> 
                    <input 
                      readOnly={!isAdmin}
                      type="date" 
                      className={`bg-transparent font-bold ml-1 outline-none text-right cursor-pointer ${isAdmin ? '' : 'pointer-events-none'}`}
                      value={selectedRoster.creationDate || new Date().toISOString().split('T')[0]}
                      onChange={e => updateRoster({...selectedRoster, creationDate: e.target.value})}
                    />
                 </div>
                 
                 <div className="text-center mb-4 break-inside-avoid">
                     <div className="w-2/3 mx-auto border-b border-black mb-1"></div>
                     <p className="font-bold uppercase text-[11pt] leading-none">{settings.directorName} – {settings.directorRank}</p>
                     <p className="uppercase text-[10pt] leading-none mt-1">{settings.directorRole}</p>
                     <p className="uppercase text-[10pt] leading-none mt-1">{settings.directorMatricula}</p> 
                </div>
             </div>
          </div>
        ) : (selectedRoster.type !== 'cat_extra' && selectedRoster.type !== 'cat_amb' && selectedRoster.type !== 'cat_psi') ? (
          <div className="flex-1 overflow-auto bg-gray-200/80 flex justify-center p-8 rounded-lg border-inner shadow-inner">
             {/* ESCALA GENÉRICA / ADM / AST / CUSTOM (A4 PAISAGEM GRADE) */}
             <div className="w-[297mm] min-h-[210mm] bg-white shadow-2xl relative flex flex-col mx-auto" style={{ padding: '10mm', fontFamily: 'Arial, Helvetica, sans-serif' }}>
                <header className="text-center mb-2 flex flex-col justify-center border-b border-black/20 pb-1 relative h-12">
                   {settings.showLogoLeft && settings.logoLeft && <img src={settings.logoLeft} className="absolute left-0 top-0 h-12 w-12 object-contain" alt="Logo Esq" />}
                   <div className="mx-16">
                     <input
                       readOnly={!isAdmin}
                       className={`w-full text-center text-[10pt] font-bold uppercase tracking-wide text-gray-800 outline-none bg-transparent ${isAdmin ? 'hover:bg-gray-50 focus:bg-yellow-50 placeholder-gray-400' : 'pointer-events-none'}`}
                       value={selectedRoster.headerTitle !== undefined ? selectedRoster.headerTitle : settings.orgName}
                       onChange={e => updateRoster({...selectedRoster, headerTitle: e.target.value.toUpperCase()})}
                       placeholder={isAdmin ? "CLIQUE PARA EDITAR O TÍTULO DA ORGANIZAÇÃO" : ""}
                     />
                     <input 
                       readOnly={!isAdmin}
                       className={`w-full text-center text-[12pt] font-black uppercase tracking-tight leading-tight outline-none ${isAdmin ? 'hover:bg-gray-50 focus:bg-yellow-50' : 'pointer-events-none'}`}
                       value={selectedRoster.title}
                       onChange={e => updateRoster({...selectedRoster, title: e.target.value.toUpperCase()})}
                     />
                     <div className="text-[9pt] font-bold uppercase">DO DIA {new Date(selectedRoster.startDate + 'T12:00:00').toLocaleDateString('pt-BR')} A {new Date(selectedRoster.endDate + 'T12:00:00').toLocaleDateString('pt-BR')}</div>
                   </div>
                   {settings.showLogoRight && settings.logoRight && <img src={settings.logoRight} className="absolute right-0 top-0 h-12 w-12 object-contain" alt="Logo Dir" />}
                </header>

                <div className="flex-1 border border-black overflow-hidden relative">
                  {/* Toolbar para Adicionar Bloco (Topo) - Visível apenas para Admin */}
                  {isAdmin && (
                    <div className="bg-gray-100 border-b border-black p-1 flex justify-end space-x-2 no-print">
                       {/* BOTÃO MÁGICO DE GERAÇÃO AUTOMÁTICA (TODAS AS CATEGORIAS EXCETO EXTRA) */}
                       {(selectedRoster.type !== 'cat_extra') && (
                           <button 
                             onClick={() => setIsAutoModalOpen(true)}
                             className="flex items-center space-x-1 text-[8pt] font-bold bg-purple-100 text-purple-700 px-2 py-0.5 rounded hover:bg-purple-200 uppercase mr-auto border border-purple-200 shadow-sm"
                           >
                              <Wand2 size={12}/> <span>Gerar Escala Automática</span>
                           </button>
                       )}
                    </div>
                  )}

                  <table className="w-full h-full border-collapse text-[8pt] table-fixed">
                     <thead>
                        <tr className="h-8">
                           <th className="border border-black bg-[#cbd5b0] p-1 w-32"></th>
                           {dates.map(d => (
                              <th key={d.toISOString()} className="border border-black bg-[#e4e9d6] p-1 text-center uppercase">
                                 <div className="font-bold">{['DOMINGO','SEGUNDA','TERÇA','QUARTA','QUINTA','SEXTA','SÁBADO'][d.getDay()]} {d.getDate().toString().padStart(2,'0')}/{String(d.getMonth()+1).padStart(2,'0')}</div>
                              </th>
                           ))}
                        </tr>
                     </thead>
                     <tbody>
                        {(selectedRoster.sections || []).flatMap(sec => sec.rows).map((row, rIdx) => (
                           <tr key={row.id}>
                              <td className={`border border-black bg-[#cbd5b0] p-2 font-bold uppercase text-center align-middle whitespace-pre-wrap leading-tight text-[8pt] relative group ${isAdmin ? 'hover:bg-[#b0bc94] cursor-pointer' : ''}`}>
                                 {isAdmin && editingRowPos?.rIdx === rIdx ? (
                                    <textarea 
                                      autoFocus
                                      className="w-full h-full bg-white text-center outline-none resize-none border border-pm-500 rounded text-black"
                                      defaultValue={row.label}
                                      onBlur={e => updateRowLabel(0, rIdx, e.target.value)} 
                                    />
                                 ) : (
                                    <div className="w-full h-full flex items-center justify-center" onClick={() => isAdmin && setEditingRowPos({sIdx: 0, rIdx})}>
                                      {row.label}
                                    </div>
                                 )}
                                 
                                 {isAdmin && (
                                   <div className="absolute left-0 top-0 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button 
                                        onClick={(e) => { e.stopPropagation(); deleteRow(0, rIdx); }} 
                                        className="bg-red-500 text-white rounded-full p-1 shadow hover:bg-red-600"
                                        title="Excluir este Bloco/Setor"
                                      >
                                        <Trash2 size={10}/>
                                      </button>
                                   </div>
                                 )}
                              </td>
                              
                              {dates.map(d => {
                                 const dStr = d.toISOString().split('T')[0];
                                 const shiftsInCell = selectedRoster.shifts.filter(s => s.date === dStr && s.period === row.id);
                                 
                                 return (
                                    <td key={`${row.id}-${dStr}`} className={`border border-black p-1 align-top text-center relative group ${isAdmin ? 'hover:bg-gray-50' : ''}`}>
                                       <div className="flex flex-col space-y-1 min-h-[30px]">
                                          {shiftsInCell.map((shift, i) => {
                                             const sdr = soldiers.find(s => s.id === shift.soldierId);
                                             const shiftId = `${shift.date}-${shift.period}-${shift.soldierId}`;
                                             const legend = shift.note || "";
                                             
                                             return sdr ? (
                                                <div key={i} className="text-[7pt] font-bold uppercase leading-tight relative group/item">
                                                   {getAbbreviatedRank(sdr.rank)} {sdr.matricula ? sdr.matricula + ' ' : ''}{sdr.name} 
                                                   
                                                   {isAdmin && editingLegendId === shiftId ? (
                                                     <input 
                                                       autoFocus
                                                       className="ml-1 w-12 bg-white border border-blue-500 rounded text-blue-900 px-0.5 outline-none font-black text-center"
                                                       defaultValue={legend}
                                                       onBlur={e => updateShiftNote(shift, e.target.value)}
                                                       onKeyDown={e => e.key === 'Enter' && updateShiftNote(shift, (e.target as HTMLInputElement).value)}
                                                     />
                                                   ) : (
                                                     <span 
                                                       onClick={() => isAdmin && setEditingLegendId(shiftId)}
                                                       className={`ml-1 font-black ${isAdmin ? 'cursor-pointer hover:underline' : ''} ${legend ? 'text-blue-800' : 'text-gray-300'}`}
                                                       title={isAdmin ? "Clique para preencher a lacuna" : ""}
                                                     >
                                                       {legend || (isAdmin ? '(...)' : '')}
                                                     </span>
                                                   )}

                                                   {isAdmin && (
                                                      <button 
                                                        onClick={(e) => { e.stopPropagation(); removeShiftFromCell(shift); }}
                                                        className="absolute -right-1 -top-1 text-red-500 opacity-0 group-hover/item:opacity-100 bg-white rounded-full p-0.5"
                                                      >
                                                         <CloseIcon size={8}/>
                                                      </button>
                                                   )}
                                                </div>
                                             ) : null;
                                          })}
                                          {isAdmin && (
                                             <button 
                                               onClick={() => { setActiveSearchCell({date: dStr, period: row.id}); setIsSearchOpen(true); }}
                                               className="opacity-0 group-hover:opacity-100 self-center text-green-600 bg-green-50 rounded-full p-1 hover:bg-green-100 transition-all mt-1"
                                               title="Adicionar Militar"
                                             >
                                                <Plus size={12}/>
                                             </button>
                                          )}
                                       </div>
                                    </td>
                                 );
                              })}
                           </tr>
                        ))}
                        {isAdmin && (
                           <tr>
                              <td colSpan={dates.length + 1} className="bg-gray-50 border border-black p-2 text-center cursor-pointer hover:bg-green-50 transition-colors" onClick={() => addRow(0)}>
                                 <div className="flex items-center justify-center space-x-2 text-green-700 font-black uppercase text-[10px]">
                                    <PlusCircle size={16} />
                                    <span>Adicionar Novo Bloco/Setor</span>
                                 </div>
                              </td>
                           </tr>
                        )}
                     </tbody>
                  </table>
                </div>

                <div className="mt-2 text-[8pt] relative">
                   <div className="flex w-full mb-2 border border-black/20 p-1 rounded bg-[#fcfcfc]">
                      <div className="w-1/2 pr-2 border-r border-gray-300">
                          <label className="text-[7pt] font-bold text-gray-500 uppercase block">OBSERVAÇÕES:</label>
                          <textarea 
                            readOnly={!isAdmin}
                            className={`w-full bg-transparent resize-none outline-none text-[8pt] h-12 uppercase ${isAdmin ? '' : 'pointer-events-none'}`}
                            value={selectedRoster.observations}
                            onChange={e => updateRoster({...selectedRoster, observations: e.target.value.toUpperCase()})}
                            placeholder={isAdmin ? "Digite as observações..." : ""}
                          />
                      </div>
                      <div className="w-1/2 pl-2 relative">
                           <div className="flex justify-between items-center mb-1">
                              <label className="text-[7pt] font-bold text-gray-500 uppercase">ALTERAÇÕES (FÉRIAS, LTS, ETC):</label>
                              {isAdmin && (
                                  <button 
                                    onClick={handleAutoSituation}
                                    className="text-[9px] bg-blue-50 text-blue-600 hover:bg-blue-100 px-2 py-0.5 rounded flex items-center gap-1 font-bold uppercase"
                                    title="Puxar automaticamente militares de férias/licença"
                                  >
                                     <Wand2 size={10}/> Auto-Preencher
                                  </button>
                              )}
                           </div>
                           <textarea 
                              readOnly={!isAdmin}
                              className={`w-full bg-transparent resize-none outline-none text-[8pt] h-12 uppercase ${isAdmin ? '' : 'pointer-events-none'}`} 
                              value={selectedRoster.situationText || ''}
                              onChange={e => updateRoster({...selectedRoster, situationText: e.target.value.toUpperCase()})}
                              placeholder={isAdmin ? "Ex: Sd Fulano (Férias), Cb Sicrano (LTS)..." : ""}
                          />
                      </div>
                   </div>
                   
                   <div className="text-right font-bold">{settings.city}, {new Date().toLocaleDateString('pt-BR', {day: 'numeric', month: 'long', year: 'numeric'})}</div>
                   <div className="text-center w-1/3 mx-auto mt-4">
                      <div className="w-full border-b border-black mb-0.5"></div>
                      <p className="font-bold uppercase text-[8pt] leading-none">{settings.directorName} – {settings.directorRank}</p>
                      <p className="uppercase text-[7pt] leading-none mt-1">{settings.directorRole}</p>
                      <p className="uppercase text-[7pt] leading-none mt-1">{settings.directorMatricula}</p> 
                   </div>
                </div>
             </div>
          </div>
        ) : (
          <div className="flex-1 overflow-auto bg-gray-200/80 flex justify-center p-8 rounded-lg border-inner shadow-inner">
             {/* LAYOUT OPERACIONAL PADRÃO (AMBULÂNCIA / PSICOLOGIA) */}
             <div className="w-[210mm] min-h-[297mm] bg-white shadow-2xl relative flex flex-col mx-auto" style={{ padding: '8mm', fontFamily: 'Arial, Helvetica, sans-serif' }}>
                <header className="text-center mb-4 relative">
                   {settings.showLogoLeft && settings.logoLeft && <img src={settings.logoLeft} className="absolute left-0 top-0 h-16 w-16 object-contain" alt="Logo Esq" />}
                   <div className="mx-20">
                     {/* TÍTULO EDITÁVEL DA ORGANIZAÇÃO */}
                     <input
                       readOnly={!isAdmin}
                       className={`w-full text-center text-[10pt] font-bold uppercase outline-none bg-transparent ${isAdmin ? 'hover:bg-gray-50 focus:bg-yellow-50 placeholder-gray-400' : 'pointer-events-none'}`}
                       value={selectedRoster.headerTitle !== undefined ? selectedRoster.headerTitle : settings.orgName}
                       onChange={e => updateRoster({...selectedRoster, headerTitle: e.target.value.toUpperCase()})}
                       placeholder={isAdmin ? "CLIQUE PARA EDITAR O TÍTULO DA ORGANIZAÇÃO" : ""}
                     />
                     <input 
                       readOnly={!isAdmin}
                       className={`w-full text-center text-[13pt] font-black uppercase mt-1 outline-none ${isAdmin ? 'hover:bg-gray-50 focus:bg-yellow-50' : 'pointer-events-none'}`}
                       value={selectedRoster.title}
                       onChange={e => updateRoster({...selectedRoster, title: e.target.value.toUpperCase()})}
                     />
                     <div className="text-[9pt] font-bold mt-1 uppercase">
                         DO DIA {new Date(selectedRoster.startDate + 'T12:00:00').toLocaleDateString('pt-BR')} A {new Date(selectedRoster.endDate + 'T12:00:00').toLocaleDateString('pt-BR')}
                      </div>
                   </div>
                   {settings.showLogoRight && settings.logoRight && <img src={settings.logoRight} className="absolute right-0 top-0 h-16 w-16 object-contain" alt="Logo Dir" />}
                </header>

                <div className="bg-[#cbd5b0] border-2 border-black border-b-0 p-1 text-center">
                    <input 
                        readOnly={!isAdmin}
                        className={`w-full bg-transparent text-center font-bold text-[8pt] uppercase outline-none ${isAdmin ? 'placeholder-gray-500' : 'pointer-events-none'}`}
                        value={selectedRoster.subTitle || ''}
                        onChange={e => updateRoster({...selectedRoster, subTitle: e.target.value})}
                        placeholder={isAdmin ? "SUBTÍTULO DA ESCALA (OPCIONAL)" : ""}
                    />
                </div>

                <div className="flex-1 border border-black overflow-hidden relative">
                  {/* Toolbar para Adicionar Bloco (Topo) - Visível apenas para Admin */}
                  {isAdmin && (
                    <div className="bg-gray-100 border-b border-black p-1 flex justify-end space-x-2 no-print">
                       {/* BOTÃO MÁGICO DE GERAÇÃO AUTOMÁTICA */}
                       {(selectedRoster.type === 'cat_amb' || selectedRoster.type === 'cat_psi') && (
                           <button 
                             onClick={() => setIsAutoModalOpen(true)}
                             className="flex items-center space-x-1 text-[8pt] font-bold bg-purple-100 text-purple-700 px-2 py-0.5 rounded hover:bg-purple-200 uppercase mr-auto border border-purple-200 shadow-sm"
                           >
                              <Wand2 size={12}/> <span>Gerar Escala Automática</span>
                           </button>
                       )}

                       <button onClick={addSection} className="flex items-center space-x-1 text-[8pt] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded hover:bg-green-200 uppercase">
                          <PlusCircle size={12}/> <span>Novo Bloco</span>
                       </button>
                    </div>
                  )}

                  <table className="w-full h-full table-fixed border-collapse">
                     <thead>
                        <tr className="h-8">
                          {dates.map((d, i) => {
                             const cycleInfo = getCycleInfo(d);
                             return (
                               <td key={d.toISOString()} className="bg-[#e4e9d6] border border-black p-0.5 text-center w-[14.28%]">
                                  <div className="font-bold text-[8pt] uppercase leading-none">{['DOM','SEG','TER','QUA','QUI','SEX','SAB'][d.getDay()]}</div>
                                  <div className="text-[8pt] leading-none mt-0.5 mb-0.5">{d.getDate().toString().padStart(2,'0')}/{String(d.getMonth()+1).padStart(2,'0')}</div>
                                  
                                  {cycleInfo && (
                                    <div className="flex justify-center space-x-1 mt-0.5">
                                       <span className={`text-[6px] font-bold px-1 rounded text-white ${cycleInfo.team24.color} uppercase`}>
                                          {cycleInfo.team24.text.substring(0,3)}
                                       </span>
                                       <span className="text-[6px] font-bold px-1 rounded bg-gray-600 text-white uppercase">
                                          {cycleInfo.team2x2}
                                       </span>
                                    </div>
                                  )}
                               </td>
                             );
                          })}
                        </tr>
                     </thead>
                     <tbody>
                       {(selectedRoster.sections || []).map((sec, sIdx) => (
                          <React.Fragment key={sIdx}>
                             <tr className="h-4 bg-[#cbd5b0]">
                                <td colSpan={dates.length} className="border border-black p-0 text-center font-bold text-[7pt] uppercase tracking-wide leading-none align-middle group relative">
                                   {/* Numeração Visual do Bloco (Apenas para Admin, Não Imprime) */}
                                   {isAdmin && (
                                      <div className="absolute left-1 top-0 bottom-0 flex items-center no-print">
                                         <span className="text-[7pt] font-black text-gray-500 bg-white/40 px-1.5 rounded border border-gray-400/30">
                                            #{sIdx + 1}
                                         </span>
                                      </div>
                                   )}
                                   <input 
                                      readOnly={!isAdmin}
                                      className={`w-full bg-transparent text-center font-bold text-[9pt] uppercase outline-none ${isAdmin ? '' : 'pointer-events-none'}`}
                                      value={sec.title}
                                      onChange={e => updateSectionTitle(sIdx, e.target.value)}
                                   />
                                   {isAdmin && (
                                     <div className="absolute right-2 top-1/2 -translate-y-1/2 flex space-x-2 opacity-60 hover:opacity-100 transition-opacity z-10">
                                        <button onClick={() => addRow(sIdx)} className="bg-white p-0.5 rounded text-green-600 shadow-sm" title="Adicionar Linha"><PlusCircle size={14}/></button>
                                        <button onClick={() => deleteSection(sIdx)} className="bg-white p-0.5 rounded text-red-600 shadow-sm" title="Excluir Bloco"><Trash2 size={14}/></button>
                                     </div>
                                   )}
                                </td>
                             </tr>

                             {sec.rows.map((row, rIdx) => (
                                <tr key={row.id}>
                                   {dates.map((d, dIdx) => {
                                      const dStr = d.toISOString().split('T')[0];
                                      const shift = selectedRoster.shifts.find(s => s.date === dStr && s.period === row.id);
                                      const sdr = shift ? soldiers.find(s => s.id === shift.soldierId) : null;
                                      const shiftId = shift ? `${shift.date}-${shift.period}-${shift.soldierId}` : '';
                                      const legend = shift?.note || "";

                                      return (
                                        <td 
                                          key={`${row.id}-${dStr}`} 
                                          className={`border border-black relative group p-0.5 ${isAdmin ? 'hover:bg-yellow-50 cursor-pointer' : ''} align-middle h-[45px]`}
                                          onClick={() => { if(isAdmin && !sdr) { setActiveSearchCell({date: dStr, period: row.id}); setIsSearchOpen(true); } }}
                                        >
                                           <div className="flex flex-col items-center justify-center w-full h-full overflow-hidden leading-tight">
                                             {sdr ? (
                                               <div className="w-full relative group/item">
                                                 <div className="text-[9pt] font-bold text-center leading-none uppercase truncate w-full px-0.5">
                                                   {getAbbreviatedRank(sdr.rank)} {sdr.matricula || ''} {sdr.name.split(' ')[0]}
                                                 </div>
                                                 <div className="text-[7pt] text-center mt-0.5 font-bold text-gray-600 leading-none">
                                                    {sdr.phone || '-'}
                                                 </div>
                                                 
                                                 {/* LEGENDA CURTA EDITÁVEL NA AMBULÂNCIA */}
                                                 <div className="text-[7pt] text-center mt-0.5 font-black text-blue-800 leading-none min-h-[8px]">
                                                    {isAdmin && editingLegendId === shiftId ? (
                                                       <input 
                                                         autoFocus
                                                         className="w-12 bg-white border border-blue-500 rounded text-blue-900 px-0.5 outline-none font-black text-center"
                                                         defaultValue={legend}
                                                         onClick={e => e.stopPropagation()}
                                                         onBlur={e => updateShiftNote(shift!, e.target.value)}
                                                         onKeyDown={e => e.key === 'Enter' && updateShiftNote(shift!, (e.target as HTMLInputElement).value)}
                                                       />
                                                    ) : (
                                                       <span 
                                                         onClick={(e) => { e.stopPropagation(); if(isAdmin) setEditingLegendId(shiftId); }}
                                                         className={`${isAdmin ? 'cursor-pointer' : ''} ${legend ? (isAdmin ? 'hover:underline' : '') : (isAdmin ? 'opacity-0 group-hover:opacity-30' : 'hidden')}`}
                                                       >
                                                          {legend || '(+)'}
                                                       </span>
                                                    )}
                                                 </div>

                                                 {isAdmin && (
                                                    <button 
                                                      onClick={(e) => { e.stopPropagation(); removeShiftFromCell(shift); }}
                                                      className="absolute -right-1 -top-1 text-red-500 opacity-0 group-hover/item:opacity-100 bg-white rounded-full p-0.5 shadow-sm"
                                                    >
                                                       <CloseIcon size={8}/>
                                                    </button>
                                                 )}
                                               </div>
                                             ) : (
                                                <span className={`text-gray-200 text-[8pt] ${isAdmin ? 'opacity-0 group-hover:opacity-100' : 'hidden'}`}>+</span>
                                             )}
                                           </div>
                                           
                                           {dIdx === 0 && isAdmin && (
                                              <div 
                                                className="absolute left-0 top-0 z-10 p-1"
                                                onClick={(e) => { 
                                                    e.stopPropagation(); 
                                                    e.preventDefault();
                                                    deleteRow(sIdx, rIdx); 
                                                }} 
                                              >
                                                <div className="bg-red-500 text-white rounded-full p-1 shadow-md hover:scale-110 transition-transform cursor-pointer" title="Excluir Linha">
                                                    <Trash2 size={10}/>
                                                </div>
                                              </div>
                                           )}
                                        </td>
                                      );
                                   })}
                                </tr>
                             ))}

                             {isAdmin && (
                               <tr>
                                  <td colSpan={dates.length} className="bg-gray-50 border border-black p-0.5 text-center cursor-pointer hover:bg-gray-100" onClick={() => addRow(sIdx)}>
                                     <span className="text-[7pt] text-gray-500 font-bold uppercase">+ Adicionar Linha</span>
                                  </td>
                               </tr>
                             )}
                          </React.Fragment>
                       ))}
                     </tbody>
                  </table>
                  
                  {isAdmin && (
                    <div className="p-1 text-center bg-gray-50 cursor-pointer hover:bg-gray-100 text-[8pt] font-bold text-gray-400 uppercase border-t border-black" onClick={addSection}>
                       + Adicionar Novo Bloco
                    </div>
                  )}
                </div>

                <div className="mt-1 flex flex-col justify-end">
                     <div className="flex w-full mb-2">
                        <div className="w-1/2 pr-2">
                            <input 
                              readOnly={!isAdmin}
                              className={`text-[7pt] font-bold text-gray-500 uppercase bg-transparent border-none w-full mb-1 outline-none ${isAdmin ? 'placeholder-gray-400' : 'pointer-events-none'}`}
                              value={selectedRoster.observationsTitle || 'Observações Gerais'}
                              onChange={(e) => updateRoster({...selectedRoster, observationsTitle: e.target.value})}
                              placeholder={isAdmin ? "CLIQUE PARA EDITAR TÍTULO" : ""}
                            />
                            <textarea 
                                readOnly={!isAdmin}
                                className={`w-full bg-transparent resize-none outline-none border border-transparent text-[7pt] h-14 ${isAdmin ? 'hover:border-gray-300' : 'pointer-events-none'}`} 
                                value={selectedRoster.observations}
                                onChange={e => updateRoster({...selectedRoster, observations: e.target.value})}
                                placeholder={isAdmin ? "Digite as observações..." : ""}
                            />
                        </div>
                        <div className="w-1/2 pl-2 border-l border-gray-300 relative">
                             <div className="flex justify-between items-center mb-1">
                                <label className="text-[7pt] font-bold text-gray-500 uppercase">ALTERAÇÕES:</label>
                                {isAdmin && (
                                    <button 
                                      onClick={handleAutoSituation}
                                      className="text-[9px] bg-blue-50 text-blue-600 hover:bg-blue-100 px-2 py-0.5 rounded flex items-center gap-1 font-bold uppercase"
                                      title="Puxar automaticamente militares de férias/licença"
                                    >
                                       <Wand2 size={10}/> Auto-Preencher
                                    </button>
                                )}
                             </div>
                             <textarea 
                                readOnly={!isAdmin}
                                className={`w-full bg-transparent resize-none outline-none border border-transparent text-[7pt] h-14 ${isAdmin ? 'hover:border-gray-300' : 'pointer-events-none'}`} 
                                value={selectedRoster.situationText || ''}
                                onChange={e => updateRoster({...selectedRoster, situationText: e.target.value})}
                                placeholder={isAdmin ? "Ex: Sd Fulano (Férias), Cb Sicrano (LTS)..." : ""}
                            />
                        </div>
                     </div>
                     
                     <div className="flex flex-col items-center justify-center mt-2 relative">
                        <div className="absolute right-0 top-0 text-[8pt] font-bold">
                           {settings.city}, 
                           <input 
                             readOnly={!isAdmin}
                             type="date" 
                             className={`bg-transparent font-bold ml-1 outline-none text-right cursor-pointer w-24 ${isAdmin ? '' : 'pointer-events-none'}`}
                             value={selectedRoster.creationDate || new Date().toISOString().split('T')[0]}
                             onChange={e => updateRoster({...selectedRoster, creationDate: e.target.value})}
                           />
                        </div>

                        <div className="text-center w-1/3 mx-auto mt-4">
                            <div className="w-full border-b border-black mb-0.5"></div>
                            <p className="font-bold uppercase text-[8pt] leading-none">{settings.directorName} – {settings.directorRank}</p>
                            <p className="uppercase text-[7pt] leading-none mt-1">{settings.directorRole}</p>
                            <p className="uppercase text-[7pt] leading-none mt-1">{settings.directorMatricula}</p> 
                        </div>
                     </div>
                </div>

             </div>
          </div>
        )
      ) : (
        <div className="flex-1 overflow-auto bg-gray-50 p-6 rounded-2xl border border-gray-200 shadow-inner">
          {/* ... resto do componente sem alterações ... */}
          <div className="flex items-center justify-center h-full">
             <div className="text-center opacity-50">
               <Scale size={64} className="mx-auto mb-4 text-gray-400"/>
               <p className="font-bold text-gray-500 uppercase">Selecione ou crie uma escala para começar.</p>
             </div>
          </div>
        </div>
      )}

      {/* --- MODAL GERAÇÃO AUTOMÁTICA --- */}
      {isAutoModalOpen && (
        <div className="fixed inset-0 bg-pm-950/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
           <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-in zoom-in-95 border border-purple-200">
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-purple-50 rounded-t-2xl">
                 <h3 className="font-black text-purple-900 uppercase flex items-center text-lg">
                    <Wand2 className="mr-2 text-purple-600" size={24}/> Gerar Escala Automática
                 </h3>
                 <button onClick={() => setIsAutoModalOpen(false)} className="text-gray-400 hover:text-red-500"><CloseIcon size={24}/></button>
              </div>
              <div className="p-6">
                 <p className="text-sm text-gray-600 mb-6 font-medium">
                    O sistema irá preencher automaticamente os dias selecionados baseando-se nas equipes (ALFA, BRAVO...) e patentes dos militares ativos.
                 </p>
                 <div className="space-y-4">
                    <div>
                       <label className="text-xs font-bold text-gray-500 uppercase ml-1">Data Inicial</label>
                       <input 
                         type="date" 
                         className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-800 outline-none focus:ring-2 focus:ring-purple-500"
                         value={autoDates.start}
                         onChange={e => setAutoDates({...autoDates, start: e.target.value})}
                       />
                    </div>
                    <div>
                       <label className="text-xs font-bold text-gray-500 uppercase ml-1">Data Final</label>
                       <input 
                         type="date" 
                         className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-800 outline-none focus:ring-2 focus:ring-purple-500"
                         value={autoDates.end}
                         onChange={e => setAutoDates({...autoDates, end: e.target.value})}
                       />
                    </div>
                    <button 
                      onClick={handleAutoGenerate}
                      className="w-full bg-purple-600 text-white py-4 rounded-xl font-black uppercase hover:bg-purple-700 shadow-xl active:scale-95 transition-all flex items-center justify-center space-x-2 mt-4"
                    >
                       <Zap size={20}/> <span>Processar Escala</span>
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {isSearchOpen && (
        <div className="fixed inset-0 bg-pm-950/80 backdrop-blur-md flex items-center justify-center z-[100] p-4">
           {/* ... modal de busca sem alterações ... */}
           <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-lg overflow-hidden border border-pm-800 animate-in zoom-in-95">
              <div className="bg-pm-900 p-6 text-white flex justify-between items-center">
                <div className="flex items-center space-x-3">
                   <User size={20} className="text-gov-yellow"/>
                   <h3 className="font-black uppercase tracking-tighter text-lg">
                     {selectedRoster?.type === 'cat_extra' ? 'Adicionar Policial na Lista' : 'Escalar Militar no Plantão'}
                   </h3>
                </div>
                <button onClick={() => setIsSearchOpen(false)} className="hover:bg-pm-800 p-2 rounded-full transition-colors"><CloseIcon size={24}/></button>
              </div>
              <div className="p-4 bg-pm-50 border-b">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={18}/>
                  <input autoFocus className="w-full p-4 pl-12 border rounded-xl font-bold shadow-md outline-none focus:ring-2 focus:ring-pm-500" placeholder="PESQUISAR NOME OU MATRÍCULA..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                </div>
              </div>
              <div className="max-h-[50vh] overflow-y-auto divide-y divide-gray-100 bg-white">
                 {selectedRoster?.type !== 'cat_extra' && selectedRoster?.type !== 'cat_adm' && activeSearchCell && (
                   <button onClick={() => updateShift(activeSearchCell.date, activeSearchCell.period, '')} className="w-full p-5 text-red-600 font-black uppercase text-[11px] hover:bg-red-50 flex items-center justify-center space-x-2 transition-colors">
                     <Trash2 size={16}/> <span>Limpar Vaga (Remover Militar)</span>
                   </button>
                 )}
                 
                 {filteredSoldiersForSearch.length > 0 ? filteredSoldiersForSearch.map(s => (
                   <button 
                      key={s.id} 
                      onClick={() => {
                        if (selectedRoster?.type === 'cat_extra') {
                          handleAddSoldierToExtra(s.id);
                        } else if (selectedRoster?.type === 'cat_adm' && activeSearchCell) {
                          addShiftToCell(activeSearchCell.date, activeSearchCell.period, s.id);
                        } else if (activeSearchCell) {
                          updateShift(activeSearchCell.date, activeSearchCell.period, s.id);
                        }
                      }} 
                      className="w-full text-left p-4 hover:bg-pm-50 flex items-center group transition-all"
                    >
                     <div className="w-10 h-10 rounded-lg bg-pm-100 flex items-center justify-center mr-4 font-black text-pm-900 text-lg group-hover:bg-pm-900 group-hover:text-white transition-all">{s.name.charAt(0)}</div>
                     <div className="flex-1">
                        <div className="font-black text-pm-900 leading-none uppercase text-xs">{s.rank} {s.name}</div>
                        <div className="text-[9px] text-pm-400 mt-1 uppercase font-black">{s.sector} - {s.role}</div>
                        {s.matricula && <div className="text-[8px] text-pm-300 font-bold uppercase">{s.matricula}</div>}
                     </div>
                     <div className="opacity-0 group-hover:opacity-100 bg-gov-green text-white p-1.5 rounded-full transition-all scale-75 group-hover:scale-100"><Check size={14}/></div>
                   </button>
                 )) : (
                   <div className="p-10 text-center text-gray-400 italic flex flex-col items-center">
                     <AlertCircle size={32} className="mb-2 opacity-20"/>
                     <p>Nenhum militar ativo encontrado.</p>
                   </div>
                 )}
              </div>
           </div>
        </div>
      )}
      {showPrint && selectedRoster && <PrintPreview roster={selectedRoster} onClose={() => setShowPrint(false)} />}
    </div>
  );
};
