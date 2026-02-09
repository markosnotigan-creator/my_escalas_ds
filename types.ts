
export enum Rank {
  CEL = 'Cel PM',
  TEN_CEL = 'Ten Cel PM',
  MAJ = 'Maj PM',
  CAP = 'Cap PM',
  TEN_1 = '1º Ten PM',
  TEN_2 = '2º Ten PM',
  ASP = 'Asp Of PM',
  SUBTEN = 'ST PM',
  SGT_1 = '1º Sgt PM',
  SGT_2 = '2º Sgt PM',
  SGT_3 = '3º Sgt PM',
  CB = 'Cb PM',
  SD = 'Sd PM',
  CIVIL = 'Servidor Civil'
}

export enum Cadre {
  QOPM = 'QOPM',
  QOAPM = 'QOAPM',
  QOCPM = 'QOCPM',
  QOPPM = 'QOPPM', // Praças
  CIVIL = 'Civil'
}

export enum Role {
  ENFERMEIRO = 'Enfermeiro',
  TEC_ENF = 'Téc. Enfermagem',
  MEDICO = 'Médico',
  FISCAL = 'Fiscal',
  MOTORISTA = 'Motorista',
  FISCAL_MOTORISTA = 'Fiscal/Motorista',
  PSICOLOGO = 'Psicólogo',
  ASSISTENTE_SOCIAL = 'Assistente Social',
  DENTISTA = 'Dentista',
  ADMINISTRATIVO = 'Administrativo'
}

export enum Status {
  ATIVO = 'Ativo',
  FERIAS = 'Férias',
  LTS = 'LTS', // Licença Tratamento Saúde
  LICENCA = 'Licença', // Licenças Diversas / Especial
  LUTO = 'Luto',
  NOJO = 'Nojo',
  DISPENSA = 'Dispensa',
  FOLGA = 'Folga',
  CURSO = 'Curso',
  AFASTADO = 'Afastado' // Genérico
}

export interface BankTransaction {
  id: string;
  type: 'CREDIT' | 'DEBIT'; // CREDIT = Adquirida, DEBIT = Gozada
  date: string; // Data do evento (aquisição ou gozo)
  description: string; // Motivo (ex: Serviço Extra, Doação Sangue, Gozo de Folga)
  amount: number; // Quantidade de dias (geralmente 1)
  recordedAt: string; // Data do registro no sistema
}

export interface Soldier {
  id: string;
  name: string; // Nome de Guerra
  fullName?: string; // Nome Completo
  rank: Rank;
  cadre?: string; // Quadro (QOPM, QOAPM, etc)
  matricula?: string; // Numeral
  mf?: string; // Matrícula Funcional
  phone?: string;
  sector: string;
  team?: string; // Equipe de Plantão (ALFA, BRAVO, TURMA 01...)
  role: Role;
  roleShort: string;
  status: Status;
  absenceStartDate?: string;
  absenceEndDate?: string;
  folgaReason?: string;
  bankHistory?: BankTransaction[]; // Histórico do Banco de Folgas
  
  // Extra Duty Fields
  orderExtra?: number; // Sequência na fila (menor número = topo da fila)
  availableForExtra?: boolean; // Se participa da escala extra
}

export interface ExtraDutyHistory {
  id: string;
  date: string; // Data da geração
  rosterDate: string; // Data da escala
  soldierNames: string[]; // Nomes dos escalados
  amount: number; // Quantos foram escalados
}

export enum RosterType {
  AMBULANCIA = 'Ambulância',
  PSICOLOGIA = 'Psicologia',
  ASSISTENCIAL = 'Assistencial',
  ADMINISTRATIVO = 'Administrativo'
}

export interface RosterCategory {
  id: string;
  name: string;
  icon: string; // nome do icone lucide
}

export interface Shift {
  date: string;
  period: string;
  soldierId: string;
  note?: string; 
  customData?: Record<string, string>; // Dados para colunas dinâmicas (chave = indice da coluna)
}

export interface RosterRow {
  id: string;
  label: string;
}

export interface RosterSection {
  title: string;
  rows: RosterRow[]; 
}

export interface Roster {
  id: string;
  type: string; // Agora dinâmico (id da categoria)
  title: string;
  headerTitle?: string; // Novo campo para o título da organização específico desta escala
  subTitle?: string; // Para "AMBULANCIAS A SEREM UTILIZADAS..." 
  month: number;
  year: number;
  startDate: string;
  endDate: string;
  creationDate?: string; // Data de emissão/criação da escala
  shifts: Shift[];
  observations: string;
  observationsTitle?: string; // Título personalizável das observações
  situationText?: string; // Novo campo para Férias, LTS, etc.
  isPublished: boolean;
  sections?: RosterSection[];
  customHeaders?: string[]; // Para renomear colunas na escala extra
}

export interface AppSettings {
  orgName: string;
  directorName: string;
  directorRank: string;
  directorRole: string;
  directorMatricula: string;
  city: string;
  showPhoneInPrint: boolean;
  shiftCycleRefDate: string;
  logoLeft: string; 
  logoRight: string;
  showLogoLeft: boolean;
  showLogoRight: boolean;
  rosterCategories: RosterCategory[];
}

export type UserRole = 'ADMIN' | 'USER';

export interface User {
  username: string;
  role: UserRole;
}
