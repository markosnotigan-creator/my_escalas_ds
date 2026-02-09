
import React, { useState, useEffect } from 'react';
import { db } from '../services/store';
import { Soldier, Rank, Role, Status, Cadre } from '../types';
import { Plus, Search, Edit2, Trash2, UserX, UserCheck, FileSpreadsheet, Download, CalendarRange, Coffee, Save, X, Shield, AlertTriangle, Users, ListOrdered } from 'lucide-react';

export const Personnel: React.FC = () => {
  const [soldiers, setSoldiers] = useState<Soldier[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Import State
  const [importText, setImportText] = useState('');
  
  // Form State
  const [formData, setFormData] = useState<Partial<Soldier>>({
    name: '', fullName: '', rank: Rank.SD, cadre: Cadre.QOPPM, role: Role.MOTORISTA, roleShort: '(M)', sector: '', team: '', status: Status.ATIVO, phone: '', matricula: '', mf: '',
    absenceStartDate: '', absenceEndDate: '', folgaReason: '', availableForExtra: true, orderExtra: 0
  });

  const currentUser = db.getCurrentUser();
  const isAdmin = currentUser.role === 'ADMIN';

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setSoldiers(db.getSoldiers());
  };

  const getShortRole = (role: Role): string => {
    switch (role) {
      case Role.ENFERMEIRO: return '(1)';
      case Role.TEC_ENF: return '(2)';
      case Role.MEDICO: return '(3)';
      case Role.FISCAL: return '(F)';
      case Role.MOTORISTA: return '(M)';
      case Role.FISCAL_MOTORISTA: return '(F.M)';
      default: return '';
    }
  };

  const handleSave = () => {
    if (!formData.name || !formData.role) return alert("Nome de Guerra e Função são obrigatórios");

    // Garantir que orderExtra seja um número, ou colocar no final da fila se for novo
    let nextOrder = formData.orderExtra;
    if (nextOrder === undefined || nextOrder === null) {
       const maxOrder = Math.max(...soldiers.map(s => s.orderExtra || 0), 0);
       nextOrder = maxOrder + 1;
    }

    const newSoldier: Soldier = {
      id: editingId || Date.now().toString(),
      name: formData.name!,
      fullName: formData.fullName || '',
      rank: formData.rank as Rank,
      cadre: formData.cadre || Cadre.QOPPM, // Default to Praça logic if missing
      role: formData.role as Role,
      roleShort: formData.roleShort || getShortRole(formData.role as Role),
      sector: formData.sector || 'Geral',
      team: formData.team || '',
      status: formData.status as Status,
      matricula: formData.matricula || '',
      mf: formData.mf || '',
      phone: formData.phone || '',
      // Dates logic
      absenceStartDate: formData.status !== Status.ATIVO && formData.status !== Status.FOLGA ? formData.absenceStartDate : undefined,
      absenceEndDate: formData.status !== Status.ATIVO && formData.status !== Status.FOLGA ? formData.absenceEndDate : undefined,
      // Folga Reason logic
      folgaReason: formData.status === Status.FOLGA ? formData.folgaReason : undefined,
      // Extra Duty logic
      availableForExtra: formData.availableForExtra !== undefined ? formData.availableForExtra : true,
      orderExtra: Number(nextOrder)
    };

    db.saveSoldier(newSoldier);
    setIsModalOpen(false);
    setEditingId(null);
    setFormData({});
    loadData();
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este militar e todas as suas informações?')) {
      db.deleteSoldier(id);
      setIsModalOpen(false); // Close modal if deleting from there
      loadData();
    }
  };

  const handleEdit = (soldier: Soldier) => {
    setEditingId(soldier.id);
    setFormData(soldier);
    setIsModalOpen(true);
  };

  const handleCreateNew = () => {
    setEditingId(null);
    // Find max order for new soldier
    const maxOrder = Math.max(...soldiers.map(s => s.orderExtra || 0), 0);
    
    setFormData({
      status: Status.ATIVO, 
      rank: Rank.SD, 
      cadre: Cadre.QOPPM,
      role: Role.MOTORISTA,
      sector: 'Ambulância',
      team: '',
      roleShort: '(M)',
      availableForExtra: true,
      orderExtra: maxOrder + 1
    });
    setIsModalOpen(true);
  };

  const handleImport = () => {
    if (!importText.trim()) return;

    const lines = importText.split('\n');
    let count = 0;
    
    // Helper to fuzzy match enum values
    const findEnum = (enumObj: any, value: string, defaultVal: any) => {
      if (!value) return defaultVal;
      const normalized = value.trim().toLowerCase();
      const entry = Object.entries(enumObj).find(([k, v]) => 
        (v as string).toLowerCase() === normalized || 
        (v as string).toLowerCase().includes(normalized)
      );
      return entry ? entry[1] : defaultVal;
    };

    // Calculate start order
    let currentMaxOrder = Math.max(...soldiers.map(s => s.orderExtra || 0), 0);

    lines.forEach(line => {
      // Split by Tab (Excel) or Semicolon (CSV)
      const parts = line.split(/[\t;]/).map(p => p.trim());
      
      if (parts.length < 2) return;

      const rawRank = parts[0];
      const name = parts[1];
      const rawRole = parts[2];
      const sector = parts[3] || 'Geral';
      const matricula = parts[4] || '';
      const phone = parts[5] || '';

      if (!name) return;

      const rank = findEnum(Rank, rawRank, Rank.SD);
      const role = findEnum(Role, rawRole, Role.ADMINISTRATIVO);
      
      currentMaxOrder++;

      const newSoldier: Soldier = {
        id: Date.now().toString() + Math.random().toString().slice(2, 8),
        name: name,
        fullName: '', // Import doesn't have full name column mapped yet
        mf: '', // Import doesn't have MF mapped yet
        rank: rank as Rank,
        cadre: Cadre.QOPPM, // Default import cadre
        role: role as Role,
        roleShort: getShortRole(role as Role),
        sector: sector,
        team: '',
        status: Status.ATIVO,
        matricula: matricula,
        phone: phone,
        availableForExtra: true,
        orderExtra: currentMaxOrder
      };

      db.saveSoldier(newSoldier);
      count++;
    });

    alert(`${count} militares importados com sucesso!`);
    setIsImportModalOpen(false);
    setImportText('');
    loadData();
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}`;
  };

  const filteredSoldiers = soldiers.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.fullName && s.fullName.toLowerCase().includes(searchTerm.toLowerCase())) ||
    s.matricula?.includes(searchTerm) ||
    s.sector.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input 
            type="text" 
            placeholder="Buscar por nome, matrícula ou setor..." 
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-pm-500 outline-none"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        {isAdmin && (
          <div className="flex space-x-2">
            <button 
              onClick={() => setIsImportModalOpen(true)}
              className="bg-pm-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-pm-700 transition shadow"
            >
              <FileSpreadsheet size={20} />
              <span>Importar (Excel)</span>
            </button>
            <button 
              onClick={handleCreateNew}
              className="bg-gov-green text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-green-700 transition shadow"
            >
              <Plus size={20} />
              <span>Novo Militar</span>
            </button>
          </div>
        )}
      </div>

      {/* Tabela com overflow-x-auto para garantir que a coluna de ações apareça */}
      <div className="bg-white rounded-xl shadow-sm overflow-x-auto border border-gray-200">
        <table className="w-full text-left min-w-[800px]">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Posto/Grad</th>
              <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Quadro</th>
              <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Nome de Guerra</th>
              <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Telefone</th>
              <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Função / Equipe</th>
              <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Setor</th>
              <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Situação</th>
              {isAdmin && <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Ações</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredSoldiers.map(s => (
              <tr key={s.id} className="hover:bg-gray-50 transition">
                <td className="px-6 py-4 text-sm text-gray-600 font-medium">{s.rank}</td>
                <td className="px-6 py-4 text-sm text-gray-500 font-medium text-[10px] uppercase">{s.cadre || '-'}</td>
                <td className="px-6 py-4 text-sm text-gray-900 font-bold">
                  {s.name}
                  {s.matricula && <span className="block text-[10px] text-gray-400 font-normal">Num: {s.matricula}</span>}
                  {s.mf && <span className="block text-[10px] text-gray-400 font-normal">MF: {s.mf}</span>}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600 font-mono text-xs">{s.phone || '-'}</td>
                <td className="px-6 py-4 text-sm">
                  <div className="flex flex-col">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 w-fit mb-1">
                      {s.role} <span className="ml-1 opacity-75">{s.roleShort}</span>
                    </span>
                    {s.team && <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Equipe: {s.team}</span>}
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">{s.sector}</td>
                <td className="px-6 py-4 text-sm">
                  <div className="flex flex-col items-start space-y-1">
                    <span className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium 
                      ${s.status === Status.ATIVO ? 'bg-green-100 text-green-800' : 
                        s.status === Status.FOLGA ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                      {s.status === Status.ATIVO ? <UserCheck size={12}/> : s.status === Status.FOLGA ? <Coffee size={12}/> : <UserX size={12}/>}
                      <span>{s.status}</span>
                    </span>
                    
                    {/* Dates for Leave/Vacation */}
                    {s.status !== Status.ATIVO && s.status !== Status.FOLGA && s.absenceStartDate && s.absenceEndDate && (
                      <span className="text-[10px] text-gray-500 font-mono pl-1">
                        {formatDate(s.absenceStartDate)} a {formatDate(s.absenceEndDate)}
                      </span>
                    )}

                    {/* Reason for FOLGA */}
                    {s.status === Status.FOLGA && s.folgaReason && (
                      <span className="text-[10px] text-yellow-700 bg-yellow-50 px-1 rounded border border-yellow-200">
                        Ref: {s.folgaReason}
                      </span>
                    )}
                  </div>
                </td>
                {isAdmin && (
                  <td className="px-6 py-4 text-sm text-right space-x-2 whitespace-nowrap">
                    <button onClick={() => handleEdit(s)} className="text-indigo-600 hover:text-indigo-900 p-1" title="Editar"><Edit2 size={18} /></button>
                    <button onClick={() => handleDelete(s.id)} className="text-red-600 hover:text-red-900 p-1" title="Excluir"><Trash2 size={18} /></button>
                  </td>
                )}
              </tr>
            ))}
            {filteredSoldiers.length === 0 && (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-gray-500">Nenhum militar encontrado.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Edit/Create Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-2xl overflow-y-auto max-h-[95vh] animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b pb-4 mb-4">
              <h3 className="text-xl font-bold text-gray-800">{editingId ? 'Editar Dados do Militar' : 'Cadastrar Novo Militar'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
            </div>

            <div className="space-y-6">
              {/* GROUP 1: Personal Data */}
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                <h4 className="text-sm font-bold text-gray-600 uppercase tracking-wide mb-3 flex items-center">
                  <UserCheck size={16} className="mr-2" /> Dados Pessoais
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="col-span-2 md:col-span-1">
                    <label className="block text-sm font-medium text-gray-700">Nome de Guerra</label>
                    <input type="text" className="mt-1 block w-full border border-gray-300 rounded-md p-2 focus:ring-pm-500 focus:border-pm-500 font-bold" 
                      placeholder="Ex: SILVA"
                      value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                  </div>
                  <div className="col-span-2 md:col-span-1">
                    <label className="block text-sm font-medium text-gray-700">Telefone / WhatsApp</label>
                    <input type="text" className="mt-1 block w-full border border-gray-300 rounded-md p-2" 
                      placeholder="(85) 90000-0000"
                      value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700">Nome Completo (Completo)</label>
                    <input type="text" className="mt-1 block w-full border border-gray-300 rounded-md p-2" 
                      placeholder="Ex: João da Silva Souza"
                      value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} />
                  </div>
                </div>
              </div>

              {/* GROUP 2: Functional Data */}
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                <h4 className="text-sm font-bold text-blue-800 uppercase tracking-wide mb-3 flex items-center">
                   <Shield size={16} className="mr-2" /> Dados Institucionais
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Posto / Graduação</label>
                    <select className="mt-1 block w-full border border-gray-300 rounded-md p-2"
                      value={formData.rank} onChange={e => setFormData({...formData, rank: e.target.value as Rank})}>
                      {Object.values(Rank).map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Quadro</label>
                    <select className="mt-1 block w-full border border-gray-300 rounded-md p-2"
                      value={formData.cadre || Cadre.QOPPM} onChange={e => setFormData({...formData, cadre: e.target.value as Cadre})}>
                      {Object.values(Cadre).map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Numeral</label>
                    <input type="text" className="mt-1 block w-full border border-gray-300 rounded-md p-2" 
                      placeholder="Somente números"
                      value={formData.matricula} onChange={e => setFormData({...formData, matricula: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Matrícula Funcional (M.F.)</label>
                    <input type="text" className="mt-1 block w-full border border-gray-300 rounded-md p-2" 
                      placeholder="Ex: 123.456-1-X"
                      value={formData.mf} onChange={e => setFormData({...formData, mf: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Função Principal</label>
                    <select className="mt-1 block w-full border border-gray-300 rounded-md p-2"
                      value={formData.role} onChange={e => setFormData({...formData, role: e.target.value as Role})}>
                      {Object.values(Role).map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Setor de Atuação</label>
                    <input type="text" className="mt-1 block w-full border border-gray-300 rounded-md p-2" 
                      placeholder="Ex: Ambulância, Administrativo..."
                      value={formData.sector} onChange={e => setFormData({...formData, sector: e.target.value})} />
                  </div>
                  <div>
                     <label className="block text-sm font-medium text-gray-700">Legenda Curta (Impressão)</label>
                     <input type="text" className="mt-1 block w-full border border-gray-300 rounded-md p-2" placeholder="Ex: (M), (F), (1)"
                      value={formData.roleShort} onChange={e => setFormData({...formData, roleShort: e.target.value})} />
                  </div>
                  <div className="col-span-2">
                     <label className="block text-sm font-black text-blue-900 uppercase">Equipe / Plantão</label>
                     <select className="mt-1 block w-full border-2 border-blue-200 rounded-md p-2 font-bold"
                      value={formData.team || ''} onChange={e => setFormData({...formData, team: e.target.value})}>
                      <option value="">-- Nenhuma / Administrativo --</option>
                      <option value="ALFA">ALFA (24H)</option>
                      <option value="BRAVO">BRAVO (24H)</option>
                      <option value="CHARLIE">CHARLIE (24H)</option>
                      <option value="DELTA">DELTA (24H)</option>
                      <option value="TURMA 01">TURMA 01 (2X2)</option>
                      <option value="TURMA 02">TURMA 02 (2X2)</option>
                    </select>
                    <p className="text-[10px] text-gray-500 mt-1">Vincula o militar ao simulador de escalas.</p>
                  </div>
                </div>
              </div>

              {/* GROUP 3: Status */}
              <div className={`p-4 rounded-lg border ${formData.status === Status.ATIVO ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
                 <h4 className={`text-sm font-bold uppercase tracking-wide mb-3 flex items-center ${formData.status === Status.ATIVO ? 'text-green-800' : 'text-red-800'}`}>
                    <AlertTriangle size={16} className="mr-2" /> Status e Alterações (Férias, Licenças, etc)
                 </h4>
                 
                 <div className="mb-4">
                   <label className="block text-sm font-medium text-gray-700 mb-1">Status Atual</label>
                   <select className="block w-full border border-gray-300 rounded-md p-2 font-bold"
                    value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as Status})}>
                    {Object.values(Status).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                 </div>

                 {/* Conditional Date Fields */}
                 {formData.status !== Status.ATIVO && formData.status !== Status.FOLGA && (
                  <div className="grid grid-cols-2 gap-4 animate-in fade-in">
                    <div>
                       <label className="block text-xs font-bold text-gray-700 uppercase">Início do Afastamento</label>
                       <input type="date" className="mt-1 block w-full border border-gray-300 rounded p-2 bg-white" 
                         value={formData.absenceStartDate || ''} 
                         onChange={e => setFormData({...formData, absenceStartDate: e.target.value})} />
                    </div>
                    <div>
                       <label className="block text-xs font-bold text-gray-700 uppercase">Fim do Afastamento</label>
                       <input type="date" className="mt-1 block w-full border border-gray-300 rounded p-2 bg-white" 
                         value={formData.absenceEndDate || ''} 
                         onChange={e => setFormData({...formData, absenceEndDate: e.target.value})} />
                    </div>
                  </div>
                )}

                {/* Conditional Field for FOLGA Reason */}
                {formData.status === Status.FOLGA && (
                  <div className="animate-in fade-in">
                      <label className="block text-xs font-bold text-yellow-800 uppercase mb-1">Motivo da Folga / Referência</label>
                      <input 
                        type="text" 
                        placeholder="Ex: Serviço Extra, Compensação, Doação de Sangue..."
                        className="w-full border border-yellow-300 rounded p-2 focus:ring-yellow-500 focus:border-yellow-500 bg-white" 
                        value={formData.folgaReason || ''} 
                        onChange={e => setFormData({...formData, folgaReason: e.target.value})} 
                      />
                  </div>
                )}
              </div>

              {/* GROUP 4: Extra Duty (New) */}
              <div className="bg-orange-50 p-4 rounded-lg border border-orange-100">
                 <h4 className="text-sm font-bold text-orange-800 uppercase tracking-wide mb-3 flex items-center">
                    <ListOrdered size={16} className="mr-2" /> Fila de Serviço Extra
                 </h4>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center space-x-2">
                       <input 
                         type="checkbox" 
                         id="availableExtra"
                         className="h-5 w-5 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                         checked={formData.availableForExtra}
                         onChange={e => setFormData({...formData, availableForExtra: e.target.checked})}
                       />
                       <label htmlFor="availableExtra" className="text-sm font-medium text-gray-700">Disponível para Rodízio Extra?</label>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase">Ordem na Fila (Sequência)</label>
                        <input 
                          type="number" 
                          className="mt-1 block w-full border border-gray-300 rounded-md p-2 text-sm" 
                          value={formData.orderExtra !== undefined ? formData.orderExtra : 0}
                          onChange={e => setFormData({...formData, orderExtra: Number(e.target.value)})}
                        />
                        <p className="text-[10px] text-gray-400 mt-1">Número menor = Mais próximo de ser escalado.</p>
                    </div>
                 </div>
              </div>

            </div>

            {/* Footer Actions */}
            <div className="mt-6 pt-4 border-t flex justify-between items-center bg-white sticky bottom-0">
               {editingId ? (
                 <button 
                  onClick={() => editingId && handleDelete(editingId)}
                  className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg flex items-center transition"
                 >
                   <Trash2 size={18} className="mr-2" /> Excluir Militar
                 </button>
               ) : (
                 <div></div> 
               )}

               <div className="flex space-x-3">
                  <button onClick={() => setIsModalOpen(false)} className="px-6 py-2 border rounded-lg hover:bg-gray-50 text-gray-600 font-medium">
                    Cancelar
                  </button>
                  <button onClick={handleSave} className="px-6 py-2 bg-pm-600 text-white rounded-lg hover:bg-pm-700 font-bold flex items-center shadow-lg">
                    <Save size={18} className="mr-2" /> Salvar Alterações
                  </button>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-2xl">
            <h3 className="text-lg font-bold mb-2 flex items-center">
              <FileSpreadsheet className="mr-2 text-green-600" />
              Importar Efetivo (Copiar e Colar)
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Copie os dados do Excel ou CSV e cole abaixo. <br/>
              <strong>Ordem das colunas:</strong> Posto/Grad | Nome | Função | Setor | Matrícula | Telefone
            </p>
            
            <textarea 
              className="w-full h-64 p-4 border rounded-lg font-mono text-sm bg-gray-50 focus:ring-2 focus:ring-pm-500 outline-none"
              placeholder={`Exemplo:
Sd PM	João da Silva	Motorista	Transporte	123456	9999-8888
Sgt PM	Maria Souza	Enfermeiro	Ambulância	987654	8888-7777`}
              value={importText}
              onChange={e => setImportText(e.target.value)}
            />

            <div className="mt-6 flex justify-end space-x-3">
              <button onClick={() => setIsImportModalOpen(false)} className="px-4 py-2 border rounded-md hover:bg-gray-50">Cancelar</button>
              <button onClick={handleImport} className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 font-bold">
                Processar Dados
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
