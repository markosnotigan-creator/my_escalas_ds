
import React, { useState, useRef } from 'react';
import { db } from '../services/store';
import { AppSettings, RosterCategory, Soldier, Rank, Role, Status } from '../types';
import { Save, Upload, Calendar, MapPin, Layers, Plus, Trash2, Edit2, ShieldAlert, Check, X, Image as ImageIcon, Eye, EyeOff, FileSpreadsheet, Download, Lock, Key, Database, RefreshCw, AlertTriangle, CloudUpload, Loader2 } from 'lucide-react';

export const Settings: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>(db.getSettings());
  const [newCatName, setNewCatName] = useState('');
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [tempCatName, setTempCatName] = useState('');
  
  // Estado para Importação de Planilha
  const [importText, setImportText] = useState('');
  const [importStatus, setImportStatus] = useState('');

  // Estado para Backup do Sistema
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);

  // Estado para Alteração de Senha
  const [pwdData, setPwdData] = useState({ current: '', new: '', confirm: '' });
  const [pwdStatus, setPwdStatus] = useState({ msg: '', type: '' }); // type: 'success' | 'error'

  const handleSave = () => {
    db.saveSettings(settings);
    alert('Configurações do sistema gravadas com sucesso!');
  };

  const addCategory = () => {
    if (!newCatName.trim()) return;
    const newCat: RosterCategory = {
      id: `cat_${Date.now()}`,
      name: newCatName.trim(),
      icon: 'Scale'
    };
    const up = { ...settings, rosterCategories: [...settings.rosterCategories, newCat] };
    setSettings(up);
    setNewCatName('');
  };

  const removeCategory = (id: string) => {
    if (settings.rosterCategories.length <= 1) return alert("O sistema precisa de pelo menos uma categoria de escala ativa.");
    if (!confirm("Atenção: Remover esta aba ocultará as escalas associadas a ela. Deseja continuar?")) return;
    const up = { ...settings, rosterCategories: settings.rosterCategories.filter(c => c.id !== id) };
    setSettings(up);
  };

  const startEditingCat = (cat: RosterCategory) => {
    setEditingCatId(cat.id);
    setTempCatName(cat.name);
  };

  const saveCatName = (id: string) => {
    if (!tempCatName.trim()) return setEditingCatId(null);
    const updatedCats = settings.rosterCategories.map(c => 
      c.id === id ? { ...c, name: tempCatName.trim() } : c
    );
    setSettings({ ...settings, rosterCategories: updatedCats });
    setEditingCatId(null);
  };

  const handleChangePassword = () => {
    setPwdStatus({ msg: '', type: '' });
    
    // Validações
    if (!pwdData.current || !pwdData.new || !pwdData.confirm) {
      setPwdStatus({ msg: 'Preencha todos os campos.', type: 'error' });
      return;
    }
    
    const storedPwd = db.getAdminPassword();
    if (pwdData.current !== storedPwd) {
      setPwdStatus({ msg: 'A senha atual está incorreta.', type: 'error' });
      return;
    }

    if (pwdData.new !== pwdData.confirm) {
      setPwdStatus({ msg: 'As novas senhas não coincidem.', type: 'error' });
      return;
    }

    if (pwdData.new.length < 4) {
      setPwdStatus({ msg: 'A nova senha deve ter pelo menos 4 caracteres.', type: 'error' });
      return;
    }

    // Salvar
    db.setAdminPassword(pwdData.new);
    setPwdStatus({ msg: 'Senha administrativa alterada com sucesso!', type: 'success' });
    setPwdData({ current: '', new: '', confirm: '' });
  };

  // --- LÓGICA DE BACKUP / RESTORE ---
  const handleExportBackup = () => {
    const data = {
      soldiers: localStorage.getItem('soldiers'),
      rosters: localStorage.getItem('rosters'),
      app_settings: localStorage.getItem('app_settings'),
      admin_password: localStorage.getItem('admin_password'),
      extra_duty_history: localStorage.getItem('extra_duty_history'),
      backup_date: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const dateStr = new Date().toISOString().split('T')[0];
    link.download = `Backup_EscalasDS_${dateStr}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportBackupTrigger = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm("ATENÇÃO CRÍTICA:\n\nAo restaurar este backup, TODOS os dados atuais (militares, escalas e configurações) serão SUBSTITUÍDOS pelos dados do arquivo.\n\nDeseja realmente continuar?")) {
      e.target.value = ''; // Reset input
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const data = JSON.parse(content);

        if (data.soldiers) localStorage.setItem('soldiers', data.soldiers);
        if (data.rosters) localStorage.setItem('rosters', data.rosters);
        if (data.app_settings) localStorage.setItem('app_settings', data.app_settings);
        if (data.admin_password) localStorage.setItem('admin_password', data.admin_password);
        if (data.extra_duty_history) localStorage.setItem('extra_duty_history', data.extra_duty_history);

        alert("Backup restaurado com sucesso! O sistema será recarregado.");
        window.location.reload();
      } catch (err) {
        alert("Erro ao ler arquivo de backup. Certifique-se que é um arquivo .json válido gerado por este sistema.");
        console.error(err);
      }
    };
    reader.readAsText(file);
  };

  const handleSyncToCloud = async () => {
    if (!confirm("Isso enviará TODOS os dados locais atuais (Militares, Escalas, Configs) para o banco de dados online (Firebase), SOBRESCREVENDO o que estiver lá se houver conflito de IDs.\n\nUse isso se for a primeira vez configurando ou se este PC for o 'Mestre'. Deseja continuar?")) return;
    
    setIsSyncingCloud(true);
    try {
      await db.syncAllToCloud();
      alert("Sincronização concluída! Seus dados locais agora estão na nuvem.");
    } catch (e) {
      alert("Erro ao sincronizar. Verifique sua conexão ou configuração.");
      console.error(e);
    } finally {
      setIsSyncingCloud(false);
    }
  };

  // --- LÓGICA DE IMPORTAÇÃO (Excel/Texto) ---
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

    lines.forEach(line => {
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
      
      const newSoldier: Soldier = {
        id: Date.now().toString() + Math.random().toString().slice(2, 8),
        name: name,
        rank: rank as Rank,
        role: role as Role,
        roleShort: getShortRole(role as Role),
        sector: sector,
        status: Status.ATIVO,
        matricula: matricula,
        phone: phone
      };

      db.saveSoldier(newSoldier);
      count++;
    });

    setImportStatus(`${count} militares importados com sucesso! Verifique na aba Efetivo.`);
    setImportText('');
    setTimeout(() => setImportStatus(''), 5000);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-24 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* SEÇÃO: BACKUP E DADOS (NOVO) */}
      <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-200">
        <h3 className="text-lg font-black text-pm-900 mb-6 border-b pb-4 flex items-center uppercase tracking-tighter">
          <Database size={22} className="mr-2 text-pm-700"/> Backup e Sincronização
        </h3>
        
        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mb-6">
           <div className="flex items-start space-x-3">
              <AlertTriangle className="text-blue-600 flex-shrink-0" size={24} />
              <div>
                 <h4 className="font-bold text-blue-900 text-sm uppercase mb-1">Status da Sincronização</h4>
                 <p className="text-xs text-blue-800 leading-relaxed">
                    O sistema opera em modo Híbrido. Os dados são salvos no seu PC e, se houver internet, sincronizados automaticamente com o Firebase.
                    Use o botão abaixo caso esteja configurando um novo PC ou queira forçar o envio dos dados locais para a nuvem.
                 </p>
              </div>
           </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           <button 
             onClick={handleSyncToCloud}
             disabled={isSyncingCloud}
             className="flex flex-col items-center justify-center p-6 border-2 border-indigo-200 border-dashed rounded-2xl hover:bg-indigo-50 hover:border-indigo-500 transition-all group disabled:opacity-50"
           >
              <div className="bg-indigo-100 p-4 rounded-full mb-3 group-hover:bg-indigo-600 group-hover:text-white transition-colors text-indigo-700">
                 {isSyncingCloud ? <Loader2 size={32} className="animate-spin"/> : <CloudUpload size={32} />}
              </div>
              <h4 className="font-black text-pm-900 uppercase">Enviar Dados Locais para Nuvem</h4>
              <p className="text-xs text-center text-gray-500 mt-1 px-4">
                 Força o upload de todos os dados deste computador para o banco online. Útil para inicializar o banco.
              </p>
           </button>

           <button 
             onClick={handleExportBackup}
             className="flex flex-col items-center justify-center p-6 border-2 border-pm-200 border-dashed rounded-2xl hover:bg-pm-50 hover:border-pm-500 transition-all group"
           >
              <div className="bg-pm-100 p-4 rounded-full mb-3 group-hover:bg-pm-600 group-hover:text-white transition-colors text-pm-700">
                 <Download size={32} />
              </div>
              <h4 className="font-black text-pm-900 uppercase">Baixar Backup Local</h4>
              <p className="text-xs text-center text-gray-500 mt-1 px-4">
                 Gera um arquivo (.json) com os dados atuais. Guarde este arquivo como segurança offline.
              </p>
           </button>

           <button 
             onClick={handleImportBackupTrigger}
             className="flex flex-col items-center justify-center p-6 border-2 border-orange-200 border-dashed rounded-2xl hover:bg-orange-50 hover:border-orange-500 transition-all group"
           >
              <div className="bg-orange-100 p-4 rounded-full mb-3 group-hover:bg-orange-600 group-hover:text-white transition-colors text-orange-700">
                 <RefreshCw size={32} />
              </div>
              <h4 className="font-black text-pm-900 uppercase">Restaurar Backup Local</h4>
              <p className="text-xs text-center text-gray-500 mt-1 px-4">
                 Carrega um arquivo .json localmente. <span className="font-bold text-red-500">ATENÇÃO: Substitui dados atuais.</span>
              </p>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept=".json" 
                onChange={handleFileChange}
              />
           </button>
        </div>
      </div>

      {/* SEÇÃO: SEGURANÇA (SENHA) */}
      <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-200">
        <h3 className="text-lg font-black text-pm-900 mb-6 border-b pb-4 flex items-center uppercase tracking-tighter">
          <Lock size={22} className="mr-2 text-pm-700"/> Segurança do Sistema
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
           <div className="md:col-span-1 space-y-4">
              <p className="text-sm text-gray-600">
                 Altere a senha de acesso administrativo para garantir a segurança das informações.
              </p>
              <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-200 text-xs text-yellow-800 font-bold">
                 Mantenha sua senha segura. Caso esqueça, utilize a opção de recuperação na tela de login.
              </div>
           </div>

           <div className="md:col-span-2 space-y-4 max-w-md">
              <div>
                <label className="text-[10px] font-black uppercase text-pm-500 ml-1 mb-1 block">Senha Atual</label>
                <input 
                  type="password" 
                  className="w-full p-3 border-2 border-gray-100 rounded-xl font-bold focus:border-pm-700 outline-none" 
                  value={pwdData.current}
                  onChange={e => setPwdData({...pwdData, current: e.target.value})}
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-pm-500 ml-1 mb-1 block">Nova Senha</label>
                <input 
                  type="password" 
                  className="w-full p-3 border-2 border-gray-100 rounded-xl font-bold focus:border-pm-700 outline-none" 
                  value={pwdData.new}
                  onChange={e => setPwdData({...pwdData, new: e.target.value})}
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-pm-500 ml-1 mb-1 block">Confirmar Nova Senha</label>
                <input 
                  type="password" 
                  className="w-full p-3 border-2 border-gray-100 rounded-xl font-bold focus:border-pm-700 outline-none" 
                  value={pwdData.confirm}
                  onChange={e => setPwdData({...pwdData, confirm: e.target.value})}
                />
              </div>

              {pwdStatus.msg && (
                <div className={`p-3 rounded-lg font-bold text-sm border ${pwdStatus.type === 'success' ? 'bg-green-100 text-green-800 border-green-200' : 'bg-red-100 text-red-800 border-red-200'}`}>
                   {pwdStatus.msg}
                </div>
              )}

              <button 
                onClick={handleChangePassword}
                className="bg-pm-900 text-white py-3 px-6 rounded-xl font-black uppercase hover:bg-pm-950 shadow-lg flex items-center justify-center space-x-2 active:scale-95 transition-all w-full md:w-auto"
              >
                <Key size={18}/> <span>Atualizar Senha</span>
              </button>
           </div>
        </div>
      </div>

      {/* SEÇÃO: IMPORTAÇÃO DE DADOS (PLANILHA) */}
      <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-200">
        <h3 className="text-lg font-black text-pm-900 mb-6 border-b pb-4 flex items-center uppercase tracking-tighter">
          <FileSpreadsheet size={22} className="mr-2 text-green-600"/> Importação de Efetivo (Copiar e Colar)
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
           <div className="space-y-4">
              <p className="text-sm text-gray-600">
                 Utilize esta área para importar militares em massa de uma planilha Excel.
              </p>
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-xs text-gray-500 font-mono">
                 <strong className="text-pm-700 block mb-2">ORDEM DAS COLUNAS (EXCEL):</strong>
                 1. Posto/Graduação (Ex: Sd PM)<br/>
                 2. Nome de Guerra (Ex: Silva)<br/>
                 3. Função (Ex: Motorista)<br/>
                 4. Setor (Ex: Ambulância)<br/>
                 5. Matrícula (Ex: 123456)<br/>
                 6. Telefone (Ex: 9999-8888)
              </div>
              {importStatus && (
                <div className="bg-green-100 text-green-800 p-3 rounded-lg font-bold text-sm border border-green-200 animate-in fade-in">
                   {importStatus}
                </div>
              )}
           </div>

           <div className="flex flex-col space-y-4">
              <textarea 
                className="flex-1 w-full p-4 border-2 border-gray-200 rounded-xl font-mono text-xs focus:border-pm-700 outline-none min-h-[150px]"
                placeholder={`Cole aqui os dados...\nEx:\nSd PM\tJoão da Silva\tMotorista\tAmbulância\t123456\t9999-8888`}
                value={importText}
                onChange={e => setImportText(e.target.value)}
              />
              <button 
                onClick={handleImport}
                className="bg-green-600 text-white py-3 rounded-xl font-black uppercase hover:bg-green-700 shadow-lg flex items-center justify-center space-x-2 active:scale-95 transition-all"
                disabled={!importText.trim()}
              >
                <Upload size={18}/> <span>Processar Dados da Planilha</span>
              </button>
           </div>
        </div>
      </div>

      {/* SEÇÃO: CATEGORIAS DE ESCALAS */}
      <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-200">
        <h3 className="text-lg font-black text-pm-900 mb-6 border-b pb-4 flex items-center uppercase tracking-tighter">
          <Layers size={22} className="mr-2 text-pm-700"/> Gerenciar Nomes e Abas das Escalas
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
           <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase text-pm-500 ml-1 mb-1 block">Acrescentar Nova Escala (Nova Aba)</label>
                <div className="flex space-x-2">
                   <input 
                    type="text" 
                    className="flex-1 p-3 border-2 border-pm-100 rounded-xl outline-none font-bold uppercase text-sm focus:border-pm-700 transition-all shadow-sm" 
                    placeholder="EX: VETERINÁRIA, PROERD, GUARDA..."
                    value={newCatName}
                    onChange={e => setNewCatName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addCategory()}
                  />
                  <button 
                    onClick={addCategory} 
                    className="bg-pm-900 text-white p-3 rounded-xl hover:bg-pm-950 shadow-lg transition-all active:scale-95 flex items-center justify-center"
                    title="Adicionar Categoria"
                  >
                    <Plus size={24}/>
                  </button>
                </div>
              </div>
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                <p className="text-[10px] text-blue-700 font-bold uppercase leading-tight">
                  Dica: Os nomes definidos aqui aparecerão como abas no topo da tela "Gerenciar Escalas". Você pode renomear as existentes clicando no ícone de edição.
                </p>
              </div>
           </div>

           <div className="bg-slate-50 p-4 rounded-2xl border border-gray-100 max-h-[400px] overflow-y-auto space-y-2 shadow-inner">
              <label className="text-[9px] font-black uppercase text-pm-400 block mb-2 px-1">Escalas Ativas (Editáveis)</label>
              {settings.rosterCategories.map(cat => (
                <div key={cat.id} className="bg-white p-3 rounded-xl flex items-center justify-between shadow-sm border border-gray-200 group hover:border-pm-300 transition-all">
                   <div className="flex items-center space-x-3 flex-1">
                      <div className="p-2 bg-pm-50 rounded-lg text-pm-700 group-hover:bg-pm-900 group-hover:text-white transition-all">
                        <Layers size={16}/>
                      </div>
                      
                      {editingCatId === cat.id ? (
                        <div className="flex items-center space-x-1 flex-1">
                          <input 
                            autoFocus
                            className="flex-1 bg-white border-2 border-pm-500 rounded px-2 py-1 text-xs font-black uppercase outline-none"
                            value={tempCatName}
                            onChange={e => setTempCatName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && saveCatName(cat.id)}
                            onBlur={() => saveCatName(cat.id)}
                          />
                          <button onClick={() => saveCatName(cat.id)} className="text-green-600 p-1 hover:bg-green-50 rounded"><Check size={14}/></button>
                        </div>
                      ) : (
                        <span className="font-black uppercase text-xs text-pm-900 flex-1">{cat.name}</span>
                      )}
                   </div>
                   
                   <div className="flex items-center space-x-1 ml-2">
                      {editingCatId !== cat.id && (
                        <button 
                          onClick={() => startEditingCat(cat)} 
                          className="text-pm-400 hover:text-pm-900 p-1.5 hover:bg-pm-50 rounded-lg transition-all"
                          title="Renomear Escala"
                        >
                          <Edit2 size={14}/>
                        </button>
                      )}
                      <button 
                        onClick={() => removeCategory(cat.id)} 
                        className="text-red-200 hover:text-red-600 p-1.5 hover:bg-red-50 rounded-lg transition-all"
                        title="Remover Escala"
                      >
                        <Trash2 size={14}/>
                      </button>
                   </div>
                </div>
              ))}
           </div>
        </div>
      </div>

      {/* DADOS DO DIRETOR E LOGOS */}
      <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-200">
        <h3 className="text-lg font-black text-pm-900 mb-6 border-b pb-4 flex items-center uppercase tracking-tighter">
          <ShieldAlert size={22} className="mr-2 text-pm-700"/> Dados Oficiais para Assinatura e Cabeçalho
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
           <div className="col-span-2">
             <label className="text-[10px] font-black uppercase text-pm-500 ml-1 mb-1 block">Nome da Organização (Cabeçalho)</label>
             <input type="text" className="w-full p-3 border-2 border-gray-100 rounded-xl font-bold uppercase focus:border-pm-700 outline-none" value={settings.orgName} onChange={e => setSettings({...settings, orgName: e.target.value.toUpperCase()})} />
           </div>

           <div>
             <div className="flex justify-between items-center mb-1 ml-1">
                <label className="text-[10px] font-black uppercase text-pm-500">Logo Esquerda (PMCE)</label>
                <button 
                  onClick={() => setSettings({...settings, showLogoLeft: !settings.showLogoLeft})}
                  className={`text-[10px] font-bold uppercase flex items-center space-x-1 px-2 py-0.5 rounded-full transition-colors ${settings.showLogoLeft ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
                  title={settings.showLogoLeft ? "Ocultar Logo na Impressão" : "Exibir Logo na Impressão"}
                >
                   {settings.showLogoLeft ? <Eye size={12}/> : <EyeOff size={12}/>}
                   <span>{settings.showLogoLeft ? 'Visível' : 'Oculto'}</span>
                </button>
             </div>
             <div className="relative">
               <input type="text" className={`w-full p-3 pl-9 border-2 rounded-xl font-bold text-xs focus:border-pm-700 outline-none truncate ${settings.showLogoLeft ? 'border-gray-100' : 'border-gray-100 bg-gray-100 text-gray-400'}`} placeholder="http://..." value={settings.logoLeft} onChange={e => setSettings({...settings, logoLeft: e.target.value})} />
               <ImageIcon size={14} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"/>
             </div>
           </div>

           <div>
             <div className="flex justify-between items-center mb-1 ml-1">
                <label className="text-[10px] font-black uppercase text-pm-500">Logo Direita (Governo)</label>
                <button 
                  onClick={() => setSettings({...settings, showLogoRight: !settings.showLogoRight})}
                  className={`text-[10px] font-bold uppercase flex items-center space-x-1 px-2 py-0.5 rounded-full transition-colors ${settings.showLogoRight ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
                  title={settings.showLogoRight ? "Ocultar Logo na Impressão" : "Exibir Logo na Impressão"}
                >
                   {settings.showLogoRight ? <Eye size={12}/> : <EyeOff size={12}/>}
                   <span>{settings.showLogoRight ? 'Visível' : 'Oculto'}</span>
                </button>
             </div>
             <div className="relative">
                <input type="text" className={`w-full p-3 pl-9 border-2 rounded-xl font-bold text-xs focus:border-pm-700 outline-none truncate ${settings.showLogoRight ? 'border-gray-100' : 'border-gray-100 bg-gray-100 text-gray-400'}`} placeholder="http://..." value={settings.logoRight} onChange={e => setSettings({...settings, logoRight: e.target.value})} />
                <ImageIcon size={14} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"/>
             </div>
           </div>

           <div>
             <label className="text-[10px] font-black uppercase text-pm-500 ml-1 mb-1 block">Nome do Diretor / Autoridade</label>
             <input type="text" className="w-full p-3 border-2 border-gray-100 rounded-xl font-bold focus:border-pm-700 outline-none" value={settings.directorName} onChange={e => setSettings({...settings, directorName: e.target.value})} />
           </div>
           <div>
             <label className="text-[10px] font-black uppercase text-pm-500 ml-1 mb-1 block">Posto / Graduação</label>
             <input type="text" className="w-full p-3 border-2 border-gray-100 rounded-xl font-bold focus:border-pm-700 outline-none" value={settings.directorRank} onChange={e => setSettings({...settings, directorRank: e.target.value})} />
           </div>
           <div className="col-span-2">
             <label className="text-[10px] font-black uppercase text-pm-500 ml-1 mb-1 block">Matrícula Funcional</label>
             <input type="text" className="w-full p-3 border-2 border-gray-100 rounded-xl font-bold focus:border-pm-700 outline-none" value={settings.directorMatricula} onChange={e => setSettings({...settings, directorMatricula: e.target.value})} />
           </div>
           <div>
             <label className="text-[10px] font-black uppercase text-pm-500 ml-1 mb-1 block">Cargo / Função</label>
             <input type="text" className="w-full p-3 border-2 border-gray-100 rounded-xl font-bold focus:border-pm-700 outline-none" value={settings.directorRole} onChange={e => setSettings({...settings, directorRole: e.target.value})} />
           </div>
           <div>
             <label className="text-[10px] font-black uppercase text-pm-500 ml-1 mb-1 block">Cidade (Para Datação)</label>
             <input type="text" className="w-full p-3 border-2 border-gray-100 rounded-xl font-bold focus:border-pm-700 outline-none" value={settings.city} onChange={e => setSettings({...settings, city: e.target.value})} />
           </div>
        </div>
      </div>

      {/* BOTÃO SALVAR FLUTUANTE */}
      <div className="fixed bottom-6 right-6 z-40">
        <button 
          onClick={handleSave}
          className="bg-pm-900 text-white px-10 py-4 rounded-full flex items-center space-x-3 hover:bg-pm-950 transition-all font-black shadow-2xl active:scale-95 border-4 border-white group"
        >
          <div className="bg-gov-yellow text-pm-900 p-1 rounded group-hover:rotate-12 transition-transform">
            <Save size={20} />
          </div>
          <span className="tracking-tight uppercase">Gravar Todas as Configurações</span>
        </button>
      </div>
    </div>
  );
};
