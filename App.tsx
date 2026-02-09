import React, { useState } from 'react';
import { Layout } from './components/ui/Layout';
import { Dashboard } from './pages/Dashboard';
import { Personnel } from './pages/Personnel';
import { RosterManager } from './pages/RosterManager';
import { Settings } from './pages/Settings';
import { db } from './services/store';
import { Lock, ArrowLeft, ShieldCheck, Eye, EyeOff, KeyRound, Mail, Phone, HelpCircle, X } from 'lucide-react';

function App() {
  const [activePage, setActivePage] = useState('dashboard');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  // Login State
  const [isLoginAdmin, setIsLoginAdmin] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  
  // Recovery Modal State
  const [showRecovery, setShowRecovery] = useState(false);

  const handleLogin = (role: 'ADMIN' | 'USER') => {
    if (role === 'ADMIN') {
      const storedPwd = db.getAdminPassword();
      if (password === storedPwd) {
        db.login(role);
        setIsAuthenticated(true);
      } else {
        setError('Senha incorreta. Verifique suas credenciais.');
      }
    } else {
      db.login(role);
      setIsAuthenticated(true);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleLogin('ADMIN');
    }
  };

  // Funções de Recuperação (Simulação Segura Local)
  // Como o app é local, ele lê a senha do banco e a preenche no link de contato.
  const handleRecoverWhatsApp = () => {
    const pwd = db.getAdminPassword();
    const phone = "5585988504361";
    const message = `SOLICITAÇÃO DE RECUPERAÇÃO DE SENHA\n\nOlá, esqueci a senha do sistema Escalas DS.\n\nSISTEMA: A senha recuperada do banco de dados local é: *${pwd}*`;
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const handleRecoverEmail = () => {
    const pwd = db.getAdminPassword();
    const email = "marcos_notigan@hotmail.com";
    const subject = "Recuperação de Senha - Escalas DS";
    const body = `Olá,\n\nEstou solicitando a recuperação da senha administrativa.\n\nA senha atual registrada no sistema é: ${pwd}`;
    const url = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = url;
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-pm-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md text-center transition-all duration-300 relative overflow-hidden">
          
          <div className="mb-6 flex justify-center relative z-10">
             <div className="w-20 h-20 bg-pm-100 rounded-full flex items-center justify-center text-pm-800 shadow-inner">
               {isLoginAdmin ? <Lock size={40} /> : <span className="text-4xl">👮</span>}
             </div>
          </div>
          
          <h1 className="text-2xl font-bold text-pm-900 mb-2 relative z-10">Escalas DS/PMCE</h1>
          <p className="text-gray-500 mb-8 relative z-10">Sistema de Gerenciamento de Escalas</p>
          
          {!isLoginAdmin ? (
            <div className="space-y-4 relative z-10">
              <button 
                onClick={() => setIsLoginAdmin(true)}
                className="w-full bg-pm-700 hover:bg-pm-800 text-white font-bold py-3 px-4 rounded-lg transition transform hover:scale-105 flex items-center justify-center space-x-2 shadow-lg"
              >
                <ShieldCheck size={20} />
                <span>Acesso Administrativo</span>
              </button>
              <button 
                onClick={() => handleLogin('USER')}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold py-3 px-4 rounded-lg transition flex items-center justify-center space-x-2"
              >
                <span>Acesso Visualizador</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4 text-left relative z-10 animate-in fade-in slide-in-from-right-4">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-sm font-medium text-gray-700">Senha do Administrador</label>
                </div>
                <div className="relative">
                  <input 
                    type={showPassword ? "text" : "password"}
                    className={`w-full border rounded-lg p-3 pr-10 outline-none focus:ring-2 focus:ring-pm-500 transition-all ${error ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                    placeholder="Digite a senha..."
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(''); }}
                    onKeyDown={handleKeyDown}
                    autoFocus
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {error && <p className="text-red-500 text-xs mt-1 font-bold">{error}</p>}
                
                <div className="text-right mt-2">
                  <button 
                    onClick={() => setShowRecovery(true)}
                    className="text-xs text-pm-600 font-bold hover:underline hover:text-pm-800 flex items-center justify-end w-full"
                  >
                    <HelpCircle size={12} className="mr-1"/> Esqueci a Senha
                  </button>
                </div>
              </div>

              <button 
                onClick={() => handleLogin('ADMIN')}
                className="w-full bg-pm-700 hover:bg-pm-800 text-white font-bold py-3 px-4 rounded-lg transition shadow-lg flex justify-center"
              >
                Entrar
              </button>
              
              <button 
                onClick={() => { setIsLoginAdmin(false); setPassword(''); setError(''); }}
                className="w-full text-gray-500 hover:text-gray-800 py-2 text-sm flex items-center justify-center space-x-1"
              >
                <ArrowLeft size={16} />
                <span>Voltar</span>
              </button>
            </div>
          )}

          <p className="mt-8 text-xs text-gray-400 border-t pt-4 relative z-10">
            {isLoginAdmin ? 'Acesso restrito a oficiais e sargentantes.' : 'Versão Web 1.2.0'}
          </p>

          {/* Background Decoration */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-gray-100 rounded-bl-full -mr-16 -mt-16 z-0 opacity-50"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-pm-50 rounded-tr-full -ml-12 -mb-12 z-0 opacity-50"></div>
        </div>

        {/* Modal de Recuperação de Senha */}
        {showRecovery && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
             <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm animate-in zoom-in-95">
                <div className="flex justify-between items-center mb-4 border-b pb-2">
                   <h3 className="font-black text-pm-900 uppercase text-lg flex items-center">
                     <KeyRound size={20} className="mr-2 text-gov-yellow"/> Recuperar Senha
                   </h3>
                   <button onClick={() => setShowRecovery(false)} className="text-gray-400 hover:text-red-500"><X size={24}/></button>
                </div>
                
                <p className="text-sm text-gray-600 mb-6 leading-relaxed">
                   Selecione um dos canais abaixo. O sistema irá gerar uma mensagem automática contendo sua senha atual recuperada do banco de dados.
                </p>

                <div className="space-y-3">
                   <button 
                     onClick={handleRecoverWhatsApp}
                     className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white py-3 px-4 rounded-xl font-bold flex items-center justify-center shadow-md transition-all active:scale-95"
                   >
                      <Phone size={20} className="mr-2"/> Enviar para WhatsApp
                   </button>
                   <button 
                     onClick={handleRecoverEmail}
                     className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-xl font-bold flex items-center justify-center shadow-md transition-all active:scale-95"
                   >
                      <Mail size={20} className="mr-2"/> Enviar para E-mail
                   </button>
                </div>

                <div className="mt-4 text-center">
                   <p className="text-[10px] text-gray-400 font-bold uppercase">
                     Contatos cadastrados: <br/>marcos_notigan@hotmail.com <br/> (85) 98850-4361
                   </p>
                </div>
             </div>
          </div>
        )}

      </div>
    );
  }

  return (
    <Layout activePage={activePage} onNavigate={setActivePage}>
      {activePage === 'dashboard' && <Dashboard />}
      {activePage === 'personnel' && <Personnel />}
      {activePage === 'rosters' && <RosterManager />}
      {activePage === 'settings' && <Settings />}
    </Layout>
  );
}

export default App;