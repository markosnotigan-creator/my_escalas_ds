
import React, { useEffect, useState } from 'react';
import { 
  Users, 
  Settings, 
  LogOut, 
  ShieldAlert,
  Scale,
  LayoutDashboard,
  Download
} from 'lucide-react';
import { db } from '../../services/store';

interface LayoutProps {
  children: React.ReactNode;
  activePage: string;
  onNavigate: (page: string) => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, activePage, onNavigate }) => {
  const user = db.getCurrentUser();
  const isAdmin = user.role === 'ADMIN';
  
  // Estado para o evento de instalação (PWA)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBtn, setShowInstallBtn] = useState(false);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBtn(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowInstallBtn(false);
    }
    setDeferredPrompt(null);
  };

  const NavItem = ({ id, icon: Icon, label }: { id: string, icon: any, label: string }) => (
    <button
      onClick={() => onNavigate(id)}
      className={`w-full flex items-center space-x-3 px-4 py-3 text-sm font-medium transition-all duration-200
        ${activePage === id 
          ? 'bg-pm-700 text-white border-r-4 border-gov-yellow shadow-inner' 
          : 'text-pm-100 hover:bg-pm-800 hover:text-white'}`}
    >
      <Icon size={20} />
      <span>{label}</span>
    </button>
  );

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden no-print">
      {/* Sidebar */}
      <aside className="w-64 bg-pm-900 text-white flex flex-col shadow-2xl z-20">
        <div className="p-6 flex items-center space-x-3 border-b border-pm-700 bg-pm-950/30">
          <div className="bg-gov-yellow p-1.5 rounded-lg">
            <ShieldAlert className="text-pm-900" size={28} />
          </div>
          <div>
            <h1 className="font-black text-lg leading-tight tracking-tighter">Escalas DS</h1>
            <p className="text-[9px] text-pm-300 uppercase font-bold tracking-widest">PMCE - Saúde</p>
          </div>
        </div>

        <nav className="flex-1 py-6 space-y-1">
          <NavItem id="dashboard" icon={LayoutDashboard} label="Painel Principal" />
          <NavItem id="rosters" icon={Scale} label="Gerenciar Escalas" />
          <NavItem id="personnel" icon={Users} label="Efetivo (Militares)" />
          {isAdmin && <NavItem id="settings" icon={Settings} label="Configurações" />}
        </nav>

        <div className="p-4 bg-pm-800/50 mt-auto border-t border-pm-700 space-y-3">
          {/* Botão de Instalação PWA */}
          {showInstallBtn && (
            <button 
              onClick={handleInstallClick}
              className="w-full flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg text-xs uppercase font-black transition-all shadow-lg active:scale-95 animate-pulse"
            >
              <Download size={16} />
              <span>Instalar no PC</span>
            </button>
          )}

          <div className="flex items-center space-x-3 p-2 bg-pm-900/50 rounded-xl">
            <div className="w-10 h-10 rounded-full bg-pm-600 border-2 border-pm-500 flex items-center justify-center font-black text-white shadow-lg">
              {user.username.charAt(0)}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-bold truncate">{user.username}</p>
              <p className="text-[10px] text-pm-400 font-bold uppercase tracking-tighter">{isAdmin ? 'ADMINISTRADOR' : 'VISUALIZADOR'}</p>
            </div>
          </div>
          <button 
            onClick={() => window.location.reload()} 
            className="w-full flex items-center justify-center space-x-2 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-lg text-xs uppercase font-black transition-all shadow-lg active:scale-95"
          >
            <LogOut size={16} />
            <span>Sair do Sistema</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white shadow-sm h-16 flex items-center px-6 justify-between z-10 border-b border-gray-200">
          <h2 className="text-xl font-black text-pm-900 uppercase tracking-tight">
            {activePage === 'dashboard' && 'Visão Geral do Efetivo'}
            {activePage === 'personnel' && 'Cadastro de Militares'}
            {activePage === 'rosters' && 'Gerenciamento de Escalas'}
            {activePage === 'settings' && 'Configurações do Sistema'}
          </h2>
          <div className="text-xs font-bold text-pm-400 uppercase tracking-widest bg-gray-50 px-4 py-2 rounded-full border">
            {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
          </div>
        </header>

        <div className="flex-1 overflow-auto p-4 bg-slate-50/50">
          {children}
        </div>
      </main>
    </div>
  );
};
