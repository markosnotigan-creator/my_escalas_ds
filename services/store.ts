
import { Soldier, Roster, AppSettings, User, Rank, Role, Status, RosterCategory, ExtraDutyHistory, Cadre } from '../types';
import { dbFirestore } from './firebase';
import { collection, doc, setDoc, deleteDoc, onSnapshot, query } from 'firebase/firestore';

const INITIAL_CATEGORIES: RosterCategory[] = [
  { id: 'cat_amb', name: 'Ambulância', icon: 'Truck' },
  { id: 'cat_psi', name: 'Psicologia', icon: 'Brain' },
  { id: 'cat_ast', name: 'Assistencial', icon: 'HeartPulse' },
  { id: 'cat_adm', name: 'Administrativo', icon: 'Briefcase' },
  { id: 'cat_extra', name: 'Escala Extra / Voluntária', icon: 'Star' }
];

const INITIAL_SETTINGS: AppSettings = {
  orgName: 'DIRETORIA DE SAÚDE – PMCE',
  directorName: 'FRANCISCO ÉLITON ARAÚJO',
  directorRank: 'Cel PM',
  directorRole: 'Diretor de Saúde - DS/PMCE',
  directorMatricula: 'M.F 108.819-1-9',
  shiftCycleRefDate: '2024-01-01',
  logoLeft: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/Bras%C3%A3o_da_Pol%C3%ADcia_Militar_do_Cear%C3%A1.png/240px-Bras%C3%A3o_da_Pol%C3%ADcia_Militar_do_Cear%C3%A1.png', 
  logoRight: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1c/Bras%C3%A3o_do_Cear%C3%A1.svg/200px-Bras%C3%A3o_do_Cear%C3%A1.svg.png', 
  showLogoLeft: true,
  showLogoRight: true,
  city: 'Fortaleza-CE',
  showPhoneInPrint: true,
  rosterCategories: INITIAL_CATEGORIES
};

const INITIAL_SOLDIERS: Soldier[] = [
  { id: '1', name: 'Cruz', rank: Rank.SUBTEN, cadre: Cadre.QOPPM, role: Role.FISCAL_MOTORISTA, roleShort: '(F.M)', sector: 'Ambulância', team: 'ALFA', status: Status.ATIVO, phone: '98651.4680', availableForExtra: true, orderExtra: 1 },
  { id: '2', name: 'Virginia', rank: Rank.TEN_1, cadre: Cadre.QOAPM, role: Role.FISCAL, roleShort: '(F)', sector: 'Ambulância', team: 'BRAVO', status: Status.ATIVO, phone: '88 99335.6947', availableForExtra: true, orderExtra: 2 },
  { id: '3', name: 'Ricardo', rank: Rank.SGT_1, cadre: Cadre.QOPPM, role: Role.FISCAL, roleShort: '(F)', sector: 'Ambulância', team: 'CHARLIE', status: Status.ATIVO, matricula: '20126', phone: '98838-4022', availableForExtra: true, orderExtra: 3 },
  { id: '20', name: 'Maria', rank: Rank.SD, cadre: Cadre.QOPPM, role: Role.ENFERMEIRO, roleShort: '(1)', sector: 'Ambulância', team: 'TURMA 01', status: Status.ATIVO, matricula: '36.113', phone: '98180-1288', availableForExtra: true, orderExtra: 4 }
];

class StoreService {
  private listeners: (() => void)[] = [];
  private isSyncing = false; // Flag para evitar loop infinito de atualizações

  constructor() {
    this.initFirebaseListeners();
  }

  // --- FIREBASE SYNC LOGIC ---
  private initFirebaseListeners() {
    if (typeof window === 'undefined') return;

    // 1. Listen to Soldiers
    const soldiersQuery = query(collection(dbFirestore, 'soldiers'));
    onSnapshot(soldiersQuery, (snapshot) => {
      const soldiers: Soldier[] = [];
      snapshot.forEach((doc) => {
        soldiers.push(doc.data() as Soldier);
      });
      // Se vier vazio do firebase, não sobrescrevemos o local se tivermos dados iniciais "mockados"
      // Apenas atualizamos se tiver dados reais.
      if (soldiers.length > 0) {
        this.setLocal('soldiers', soldiers);
      }
    });

    // 2. Listen to Rosters
    const rostersQuery = query(collection(dbFirestore, 'rosters'));
    onSnapshot(rostersQuery, (snapshot) => {
      const rosters: Roster[] = [];
      snapshot.forEach((doc) => {
        rosters.push(doc.data() as Roster);
      });
      if (rosters.length > 0) {
        this.setLocal('rosters', rosters);
      }
    });

    // 3. Listen to App Settings (Single Document)
    const settingsDoc = doc(dbFirestore, 'config', 'app_settings');
    onSnapshot(settingsDoc, (docSnap) => {
      if (docSnap.exists()) {
        this.setLocal('app_settings', docSnap.data());
      }
    });

    // 4. Listen to Extra Duty History
    const historyQuery = query(collection(dbFirestore, 'extra_duty_history'));
    onSnapshot(historyQuery, (snapshot) => {
      const history: ExtraDutyHistory[] = [];
      snapshot.forEach((doc) => {
        history.push(doc.data() as ExtraDutyHistory);
      });
      if (history.length > 0) {
        this.setLocal('extra_duty_history', history);
      }
    });
  }

  // Helper to sync specific data to Firestore
  private async syncToCloud(collectionName: string, id: string, data: any) {
    try {
      await setDoc(doc(dbFirestore, collectionName, id), data);
    } catch (e) {
      console.error(`Erro ao sincronizar ${collectionName}:`, e);
    }
  }

  private async deleteFromCloud(collectionName: string, id: string) {
    try {
      await deleteDoc(doc(dbFirestore, collectionName, id));
    } catch (e) {
      console.error(`Erro ao deletar de ${collectionName}:`, e);
    }
  }

  // --- PUBLIC SYNC METHOD (Manual Trigger) ---
  // Útil para enviar dados locais iniciais para a nuvem
  async syncAllToCloud(): Promise<void> {
     // Settings
     const settings = this.getSettings();
     await this.syncToCloud('config', 'app_settings', settings);

     // Soldiers
     const soldiers = this.getSoldiers();
     for (const s of soldiers) {
       await this.syncToCloud('soldiers', s.id, s);
     }

     // Rosters
     const rosters = this.getRosters();
     for (const r of rosters) {
       await this.syncToCloud('rosters', r.id, r);
     }

     // History
     const history = this.getExtraDutyHistory();
     for (const h of history) {
       await this.syncToCloud('extra_duty_history', h.id, h);
     }
  }

  // --- LOCAL STORE LOGIC ---

  subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach(l => l());
  }

  private getLocal<T>(key: string): T | null {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  }

  private setLocal(key: string, value: any): void {
    localStorage.setItem(key, JSON.stringify(value));
    this.notify();
  }

  // --- PUBLIC API ---

  getSettings(): AppSettings {
    const stored = this.getLocal<AppSettings>('app_settings');
    if (!stored) {
        this.setLocal('app_settings', INITIAL_SETTINGS);
        return INITIAL_SETTINGS;
    }
    // Garantias de compatibilidade
    if (!stored.rosterCategories) stored.rosterCategories = INITIAL_CATEGORIES;
    if (!stored.logoLeft) stored.logoLeft = INITIAL_SETTINGS.logoLeft;
    if (!stored.logoRight) stored.logoRight = INITIAL_SETTINGS.logoRight;
    if (stored.showLogoLeft === undefined) stored.showLogoLeft = true;
    if (stored.showLogoRight === undefined) stored.showLogoRight = true;
    return stored;
  }

  saveSettings(settings: AppSettings): void {
    this.setLocal('app_settings', settings);
    this.syncToCloud('config', 'app_settings', settings);
  }

  getSoldiers(): Soldier[] {
    const stored = this.getLocal<Soldier[]>('soldiers');
    if (!stored || stored.length === 0) {
        this.setLocal('soldiers', INITIAL_SOLDIERS);
        return INITIAL_SOLDIERS;
    }
    return stored;
  }

  saveSoldier(soldier: Soldier): void {
    const soldiers = this.getSoldiers();
    const index = soldiers.findIndex(s => s.id === soldier.id);
    if (index >= 0) soldiers[index] = soldier; else soldiers.push(soldier);
    
    this.setLocal('soldiers', soldiers);
    this.syncToCloud('soldiers', soldier.id, soldier);
  }

  deleteSoldier(id: string): void {
    this.setLocal('soldiers', this.getSoldiers().filter(s => s.id !== id));
    this.deleteFromCloud('soldiers', id);
  }

  getRosters(): Roster[] {
    return this.getLocal<Roster[]>('rosters') || [];
  }

  saveRoster(roster: Roster): void {
    const rosters = this.getRosters();
    const index = rosters.findIndex(r => r.id === roster.id);
    if (index >= 0) rosters[index] = roster; else rosters.push(roster);
    
    this.setLocal('rosters', rosters);
    this.syncToCloud('rosters', roster.id, roster);
  }

  deleteRoster(id: string): void {
    this.setLocal('rosters', this.getRosters().filter(r => r.id !== id));
    this.deleteFromCloud('rosters', id);
  }
  
  // --- EXTRA DUTY HISTORY ---
  getExtraDutyHistory(): ExtraDutyHistory[] {
    return this.getLocal<ExtraDutyHistory[]>('extra_duty_history') || [];
  }

  saveExtraDutyHistory(record: ExtraDutyHistory): void {
    const history = this.getExtraDutyHistory();
    history.push(record);
    
    this.setLocal('extra_duty_history', history);
    this.syncToCloud('extra_duty_history', record.id, record);
  }

  getCurrentUser(): User {
    return this.getLocal<User>('current_user') || { username: 'admin', role: 'ADMIN' };
  }

  login(role: 'ADMIN' | 'USER'): void {
    this.setLocal('current_user', { username: role === 'ADMIN' ? 'Administrador' : 'Visualizador', role });
  }
  
  // --- GERENCIAMENTO DE SENHA (LOCAL ONLY FOR SECURITY IN THIS DEMO) ---
  // Nota: Idealmente a senha estaria no Auth do Firebase, mas mantivemos local
  // ou num doc 'config/secure' com regras de segurança rígidas.
  getAdminPassword(): string {
    const pwd = localStorage.getItem('admin_password');
    return pwd || '123456';
  }

  setAdminPassword(newPassword: string): void {
    localStorage.setItem('admin_password', newPassword);
    // Opcional: Sincronizar senha se desejar que ela valha para todos os PCs
    // this.syncToCloud('config', 'admin_security', { password: newPassword });
  }
}

export const db = new StoreService();
