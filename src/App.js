import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc, addDoc, getDocs, updateDoc, query, where, serverTimestamp, writeBatch } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// As bibliotecas jsPDF e jsPDF-Autotable são carregadas dinamicamente no componente App.

// CONTEXTO DA APLICAÇÃO
const AppContext = createContext();

// CONFIGURAÇÃO FIREBASE DIRETA
const firebaseConfig = {
  apiKey: "AIzaSyBdXt3OVu1oK3qwJXt7v_0xAs1EHzT7mkY",
  authDomain: "twfinal-29b2f.firebaseapp.com",
  projectId: "twfinal-29b2f",
  storageBucket: "twfinal-29b2f.appspot.com",
  messagingSenderId: "728574501039",
  appId: "1:728574501039:web:ee4138c852b9ede0ce745a",
  measurementId: "G-Y8RK2Y7FBX"
};
const appId = 'twfinal-29b2f'; // ou outro valor se precisar
const initialAuthToken = undefined;// FUNÇÃO HELPER PARA INTERAÇÕES
const addInteraction = async (db, appId, userId, path, data) => {
    if (!db || !path) return;
    try {
        const interactionData = { ...data, data: new Date().toISOString() };
        const collRef = collection(db, `artifacts/${appId}/users/${userId}/${path}`);
        await addDoc(collRef, interactionData);
    } catch (e) {
        console.error("Erro ao adicionar interação:", e);
    }
};


// COMPONENTE PRINCIPAL
function App() {
  const [authReady, setAuthReady] = useState(false);
  const [db, setDb] = useState(null);
  const [storage, setStorage] = useState(null);
  const [auth, setAuth] = useState(null);
  const [userId, setUserId] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);

  // Efeito para inicializar o Firebase e carregar scripts externos
  useEffect(() => {
    async function initializeFirebase() {
      try {
        if (Object.keys(firebaseConfig).length === 0) {
            throw new Error("Configuração do Firebase não encontrada.");
        }
        const app = initializeApp(firebaseConfig);
        const firestore = getFirestore(app);
        const authInstance = getAuth(app);
        const storageInstance = getStorage(app);
        setDb(firestore);
        setAuth(authInstance);
        setStorage(storageInstance);

        onAuthStateChanged(authInstance, async (user) => {
          if (user) {
            setUserId(user.uid);
          } else {
            if (initialAuthToken) {
              await signInWithCustomToken(authInstance, initialAuthToken);
            } else {
              await signInAnonymously(authInstance);
            }
          }
          setAuthReady(true);
        });
      } catch (e) {
        console.error("Erro ao inicializar Firebase:", e);
        setAuthReady(true);
      }
    }
    initializeFirebase();
    
    const jspdfScript = document.createElement('script');
    jspdfScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    jspdfScript.async = true;
    document.body.appendChild(jspdfScript);

    jspdfScript.onload = () => {
        const autotableScript = document.createElement('script');
        autotableScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.23/jspdf.plugin.autotable.min.js';
        autotableScript.async = true;
        document.body.appendChild(autotableScript);
    };

    return () => {
        document.querySelectorAll('script[src*="jspdf"]').forEach(s => s.remove());
    }

  }, []);

  useEffect(() => {
    if (authReady) {
       setLoading(false);
    }
  }, [authReady]);

  if (loading) {
    return <LoadingSpinner fullScreen={true} />;
  }
  
  if (!db) {
      return (
          <div className="flex items-center justify-center min-h-screen bg-gray-100">
              <div className="text-center p-8 bg-white rounded-lg shadow-md">
                  <h2 className="text-xl font-bold text-red-600 mb-4">Erro de Configuração</h2>
                  <p className="text-gray-700">A aplicação não pode ser carregada. Verifique as credenciais do Firebase.</p>
              </div>
          </div>
      );
  }

  return (
    <AppContext.Provider value={{ db, storage, auth, userId, appId, setActiveTab }}>
      <div className="flex min-h-screen bg-gray-100 font-sans text-gray-800">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
        <main className="flex-1 p-4 sm:p-8 overflow-y-auto">
          {activeTab === 'dashboard' && <Dashboard />}
          {activeTab === 'clientes' && <Clientes />}
          {activeTab === 'contratos' && <Contratos />}
          {activeTab === 'parceiros' && <Parceiros />}
          {activeTab === 'tarefas' && <Tarefas />}
          {activeTab === 'relatorios' && <Relatorios />}
          {activeTab === 'gestao' && <Gestao />}
          {activeTab === 'configuracoes' && <Configuracoes />}
        </main>
      </div>
    </AppContext.Provider>
  );
}

// COMPONENTES UI GERAIS
const LoadingSpinner = ({ fullScreen = false }) => (
  <div className={`flex items-center justify-center ${fullScreen ? 'min-h-screen' : 'py-12'}`}>
    <div className="text-center">
        <svg className="animate-spin h-8 w-8 text-indigo-500 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span className="mt-3 text-gray-500">{fullScreen ? 'A carregar aplicação...' : 'A carregar dados...'}</span>
    </div>
  </div>
);

const ModalMessage = ({ title, message, onConfirm, onCancel }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-50">
    <div className="bg-white rounded-lg p-6 shadow-xl max-w-sm w-full">
      <h2 className="text-xl font-bold mb-4">{title}</h2>
      <p className="text-gray-700 mb-6">{message}</p>
      <div className="flex justify-end space-x-2">
        {onCancel && <button onClick={onCancel} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Cancelar</button>}
        {onConfirm && <button onClick={onConfirm} className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600">Confirmar</button>}
      </div>
    </div>
  </div>
);

const Snackbar = ({ message, show }) => {
    if (!show) return null;
    return (
        <div className="fixed bottom-4 right-4 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-md animate-fade-in-out">
            {message}
        </div>
    );
};


// SIDEBAR E ÍCONES
const Sidebar = ({ activeTab, setActiveTab }) => {
  const { userId } = useContext(AppContext);
  const tabs = [
    { id: 'dashboard', label: 'Dashboard' }, { id: 'clientes', label: 'Gestão de Clientes' },
    { id: 'contratos', label: 'Gestão de Contratos' }, { id: 'parceiros', label: 'Parceiros' },
    { id: 'tarefas', label: 'Tarefas / Pendentes' }, { id: 'relatorios', label: 'Relatórios' },
    { id: 'gestao', label: 'Gestão Financeira' }, { id: 'configuracoes', label: 'Configurações' },
  ];

  return (
    <aside className="w-64 bg-white shadow-lg p-6 flex flex-col justify-between hidden md:flex">
      <div>
        <div className="text-2xl font-bold mb-10 text-indigo-600">THE WAY</div>
        <nav className="space-y-2">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`w-full text-left px-4 py-2.5 rounded-lg transition-colors duration-200 flex items-center gap-3 text-sm font-medium ${
                activeTab === tab.id ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-600 hover:bg-indigo-50 hover:text-indigo-600'}`}>
              <span className="w-5 h-5">{getIcon(tab.id)}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>
      <div className="mt-8">
        <div className="text-xs text-gray-500 mb-2">ID do Utilizador:</div>
        <p className="font-mono text-xs break-all mt-1">{userId || 'A carregar...'}</p>
      </div>
    </aside>
  );
};

const getIcon = (id) => {
    const icons = {
        dashboard: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M3 6a3 3 0 013-3h2.25a3 3 0 013 3v2.25a3 3 0 01-3 3H6a3 3 0 01-3-3V6zm14.25 0a3 3 0 013-3H21a.75.75 0 01.75.75v4.5a.75.75 0 01-.75.75h-2.25a3 3 0 01-3-3V6zm-7.5 0a3 3 0 013-3h2.25a3 3 0 013 3v2.25a3 3 0 01-3 3h-2.25a3 3 0 01-3-3V6zM3 15.75a3 3 0 013-3h2.25a3 3 0 013 3V18a3 3 0 01-3 3H6a3 3 0 01-3-3v-2.25zm7.5 0a3 3 0 013-3h2.25a3 3 0 013 3V18a3 3 0 01-3 3h-2.25a3 3 0 01-3-3v-2.25zM17.25 12.75a.75.75 0 01.75.75v4.5a.75.75 0 01-.75.75H15a3 3 0 01-3-3v-2.25a3 3 0 013-3h2.25z" clipRule="evenodd" /></svg>,
        clientes: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M4.5 6.375a4.125 4.125 0 118.25 0 4.125 4.125 0 01-8.25 0zM14.25 8.625a3.375 3.375 0 116.75 0 3.375 3.375 0 01-6.75 0zM4.5 16.875a3.375 3.375 0 116.75 0 3.375 3.375 0 01-6.75 0zM13.5 15.75a4.125 4.125 0 118.25 0 4.125 4.125 0 01-8.25 0z" /></svg>,
        contratos: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M5.625 1.5H9a3.75 3.75 0 013.75 3.75v1.875c0 1.036.84 1.875 1.875 1.875H16.5a3.75 3.75 0 013.75 3.75v7.875c0 1.036-.84 1.875-1.875 1.875H5.625a1.875 1.875 0 01-1.875-1.875V3.375c0-1.036.84-1.875 1.875-1.875zm5.625 1.875c.621 0 1.125.504 1.125 1.125v1.875c0 .621-.504 1.125-1.125 1.125H9.375a1.125 1.125 0 01-1.125-1.125V4.5c0-.621.504-1.125 1.125-1.125h2.25z" clipRule="evenodd" /></svg>,
        parceiros: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M8.25 6.75a3.75 3.75 0 117.5 0 3.75 3.75 0 01-7.5 0zM15.75 9.75a3 3 0 116 0 3 3 0 01-6 0zM2.25 9.75a3 3 0 116 0 3 3 0 01-6 0zM6.31 15.117A6.745 6.745 0 0112 12a6.745 6.745 0 015.69 3.117.75.75 0 01-.88.954a4.501 4.501 0 00-9.62 0 .75.75 0 01-.88-.954z" clipRule="evenodd" /></svg>,
        tarefas: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M3.75 12a.75.75 0 01.75-.75h15a.75.75 0 010 1.5h-15a.75.75 0 01-.75-.75zM3 6a.75.75 0 01.75-.75h15a.75.75 0 010 1.5h-15A.75.75 0 013 6zm0 12a.75.75 0 01.75-.75h15a.75.75 0 010 1.5h-15a.75.75 0 01-.75-.75z" clipRule="evenodd" /></svg>,
        relatorios: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M2.25 13.5a8.25 8.25 0 018.25-8.25.75.75 0 01.75.75v6.75H18a.75.75 0 01.75.75 8.25 8.25 0 01-16.5 0z" clipRule="evenodd" /><path fillRule="evenodd" d="M12.75 3a.75.75 0 01.75-.75 8.25 8.25 0 018.25 8.25.75.75 0 01-.75.75h-7.5a.75.75 0 01-.75-.75V3z" clipRule="evenodd" /></svg>,
        gestao: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M12 7.5a2.25 2.25 0 100 4.5 2.25 2.25 0 000-4.5z" /><path fillRule="evenodd" d="M1.5 4.875C1.5 3.839 2.34 3 3.375 3h17.25c1.035 0 1.875.84 1.875 1.875v9.75c0 1.036-.84 1.875-1.875 1.875H3.375A1.875 1.875 0 011.5 14.625v-9.75zM8.25 9a3.75 3.75 0 117.5 0 3.75 3.75 0 01-7.5 0zM18.75 9a1.125 1.125 0 112.25 0 1.125 1.125 0 01-2.25 0z" clipRule="evenodd" /></svg>,
        configuracoes: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M11.078 2.25c-.917 0-1.699.663-1.946 1.55l-.29 1.162a1.875 1.875 0 01-1.406 1.406l-1.162.29a1.946 1.946 0 00-1.55 1.946v2.152a1.946 1.946 0 001.55 1.946l1.162.29a1.875 1.875 0 011.406 1.406l.29 1.162a1.946 1.946 0 001.946 1.55h2.152a1.946 1.946 0 001.946-1.55l.29-1.162a1.875 1.875 0 011.406-1.406l1.162-.29a1.946 1.946 0 001.55-1.946V8.852a1.946 1.946 0 00-1.55-1.946l-1.162-.29a1.875 1.875 0 01-1.406-1.406l-.29-1.162a1.946 1.946 0 00-1.946-1.55h-2.152zM12 15.75a3.75 3.75 0 100-7.5 3.75 3.75 0 000 7.5z" clipRule="evenodd" /></svg>,
    };
    return icons[id];
};

// DASHBOARD
const Dashboard = () => {
    const { db, userId, appId, setActiveTab } = useContext(AppContext);
    const [contratos, setContratos] = useState([]);
    const [tarefas, setTarefas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdate, setLastUpdate] = useState(new Date());

    useEffect(() => {
        if (!db || !userId) return;
        setLoading(true);
        const unsubContratos = onSnapshot(collection(db, `artifacts/${appId}/users/${userId}/contratos`), (snap) => {
            setContratos(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setLastUpdate(new Date());
        }, (error) => console.error("Erro ao carregar contratos:", error));
        
        const unsubTarefas = onSnapshot(collection(db, `artifacts/${appId}/users/${userId}/tarefas`), (snap) => {
            setTarefas(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }, (error) => console.error("Erro ao carregar tarefas:", error));
        
        setLoading(false);
        return () => { unsubContratos(); unsubTarefas(); };
    }, [db, userId, appId]);

    const volumeTotalCredito = contratos.filter(c => c.tipoServico === 'Crédito' && c.valorFinanciado).reduce((s, c) => s + parseFloat(c.valorFinanciado), 0);
    const segurosFechados = contratos.filter(c => c.tipoServico === 'Seguro' && c.estado === 'Concluído').length;
    const volumeSeguros = contratos.filter(c => c.tipoServico === 'Seguro' && c.valor).reduce((s, c) => s + parseFloat(c.valor || 0), 0);
    const pendentesAtivos = tarefas.filter(t => t.estado === 'Pendente').length;
    const taxaResolucao = tarefas.length > 0 ? (tarefas.filter(t => t.estado === 'Concluído').length / tarefas.length) * 100 : 0;

    const chartData = (() => {
        const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
        const data = months.map(m => ({ name: m, credito: 0, seguros: 0 }));
        contratos.forEach(c => {
            if (c.dataContrato) {
                const monthIndex = new Date(c.dataContrato).getMonth();
                if (monthIndex >= 0 && monthIndex < 12) {
                    if (c.tipoServico === 'Crédito' && c.valorFinanciado) data[monthIndex].credito += parseFloat(c.valorFinanciado);
                    if (c.tipoServico === 'Seguro' && c.valor) data[monthIndex].seguros += parseFloat(c.valor);
                }
            }
        });
        return data;
    })();

    const volumePorFinanceira = contratos.reduce((acc, curr) => {
        if(curr.financeira && curr.tipoServico === 'Crédito') {
            acc[curr.financeira] = (acc[curr.financeira] || 0) + parseFloat(curr.valorFinanciado || 0);
        }
        return acc;
    }, {});

    const handleToggleTask = async (task) => {
        const taskRef = doc(db, `artifacts/${appId}/users/${userId}/tarefas`, task.id);
        await updateDoc(taskRef, { estado: task.estado === 'Pendente' ? 'Concluído' : 'Pendente' });
    };

    if (loading) return <LoadingSpinner />;

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Dashboard</h1>
                    <p className="text-sm text-gray-500">Dados do mês corrente - {new Date().toLocaleString('pt-PT', { month: 'long', year: 'numeric' })}</p>
                </div>
                <div className="text-sm text-gray-500">Última atualização: {lastUpdate.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}</div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard icon="€" title="Volume Total Crédito" value={`${(volumeTotalCredito / 1000).toFixed(1)}k €`} subtitle="+12% vs mês anterior" color="text-green-500" />
                <StatCard icon="🛡️" title="Seguros Fechados" value={segurosFechados} subtitle={`Volume: ${volumeSeguros.toLocaleString('pt-PT')} €`} />
                <StatCard icon="🔔" title="Pendentes Ativos" value={pendentesAtivos} subtitle="Requer atenção imediata" color="text-orange-500" />
                <StatCard icon="✅" title="Taxa Resolução" value={`${taxaResolucao.toFixed(0)}%`} subtitle="Documentos resolvidos" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <ChartBox title="Volume de Crédito" className="lg:col-span-1"><ResponsiveContainer width="100%" height={300}><BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 12 }} /><YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${v / 1000}k`} /><Tooltip formatter={(v) => `${v.toLocaleString('pt-PT')} €`} /><Bar dataKey="credito" fill="#8884d8" name="Crédito" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></ChartBox>
                <ChartBox title="Volume de Seguros" className="lg:col-span-1"><ResponsiveContainer width="100%" height={300}><LineChart data={chartData}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 12 }} /><YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${v / 1000}k`} /><Tooltip formatter={(v) => `${v.toLocaleString('pt-PT')} €`} /><Line type="monotone" dataKey="seguros" stroke="#82ca9d" strokeWidth={2} name="Seguros" /></LineChart></ResponsiveContainer></ChartBox>
                <div className="bg-white p-6 rounded-lg shadow-sm"><SummaryTable title="Volume por Financeira" data={volumePorFinanceira} /></div>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2">Gestão de Tarefas</h3>
                    <button onClick={() => setActiveTab('tarefas')} className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors">+ Adicionar Nova Tarefa</button>
                </div>
                <div className="space-y-3">
                    {tarefas.filter(t => t.estado === 'Pendente').slice(0, 3).map(task => (
                        <div key={task.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div><p className="font-medium text-gray-800">{task.titulo}</p><p className="text-xs text-gray-500">Prazo: {task.prazo}</p></div>
                            <button onClick={() => handleToggleTask(task)} className="w-8 h-8 flex items-center justify-center rounded-full border-2 border-gray-300 hover:border-green-500"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-4 h-4 text-gray-400"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg></button>
                        </div>
                    ))}
                    {tarefas.filter(t => t.estado === 'Pendente').length === 0 && <p className="text-center text-sm text-gray-500 py-4">Não há tarefas pendentes.</p>}
                </div>
            </div>
        </div>
    );
};

const StatCard = ({ icon, title, value, subtitle, color = 'text-gray-500' }) => (
    <div className="bg-white p-5 rounded-lg shadow-sm flex items-start gap-4">
        <div className="text-2xl">{icon}</div>
        <div>
            <p className="text-sm text-gray-500 font-medium">{title}</p>
            <p className="text-2xl font-bold text-gray-800">{value}</p>
            <p className={`text-xs ${color}`}>{subtitle}</p>
        </div>
    </div>
);

const ChartBox = ({ title, children, className }) => (
    <div className={`bg-white p-6 rounded-lg shadow-sm ${className}`}>
        <h3 className="text-lg font-semibold text-gray-700 mb-4">{title}</h3>
        {children}
    </div>
);

// GESTÃO DE CLIENTES
const Clientes = () => {
  const { db, appId, userId } = useContext(AppContext);
  const [clientes, setClientes] = useState([]);
  const [comerciais, setComerciais] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('Todos');
  const [showModal, setShowModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [currentClient, setCurrentClient] = useState(null);
  const [clientToDelete, setClientToDelete] = useState(null);
  const [message, setMessage] = useState('');
  const [showSnackbar, setShowSnackbar] = useState(false);

  useEffect(() => {
    if (!db || !appId || !userId) return;
    setLoading(true);
    const unsubClientes = onSnapshot(collection(db, `artifacts/${appId}/users/${userId}/clientes`), (snap) => {
        setClientes(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setLoading(false);
    }, (error) => { console.error("Erro ao carregar clientes:", error); setLoading(false); });
    
    const q = query(collection(db, `artifacts/${appId}/public/data/utilizadores`), where("estado", "==", "Ativo"));
    const unsubComerciais = onSnapshot(q, (snap) => {
        setComerciais(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => console.error("Erro ao carregar comerciais:", error));

    return () => { unsubClientes(); unsubComerciais(); };
  }, [db, appId, userId]);
  
  const displaySnackbar = (msg) => {
        setMessage(msg);
        setShowSnackbar(true);
        setTimeout(() => setShowSnackbar(false), 3000);
  };

  const handleSave = async (data) => {
    const collRef = collection(db, `artifacts/${appId}/users/${userId}/clientes`);
    
    // Validação do NIF
    if (data.nif) {
        const q = query(collRef, where("nif", "==", data.nif));
        const querySnapshot = await getDocs(q);
        const nifExists = !querySnapshot.empty;
        
        // Se o NIF existe e estamos a criar um novo cliente, ou a editar um cliente diferente do que já tem esse NIF
        if (nifExists && (!data.id || querySnapshot.docs[0].id !== data.id)) {
            displaySnackbar('Erro: O NIF introduzido já existe.');
            return;
        }
    }

    try {
        const { id, ...clientData } = data;
        if (id) {
            await setDoc(doc(collRef, id), clientData, { merge: true });
            displaySnackbar('Cliente atualizado com sucesso!');
        } else {
            await addDoc(collRef, clientData);
            displaySnackbar('Cliente adicionado com sucesso!');
        }
        setShowModal(false);
        setCurrentClient(null);
    } catch (e) {
        console.error("Erro ao guardar cliente:", e);
        displaySnackbar('Erro ao guardar o cliente.');
    }
  };

  const handleDelete = async () => {
    if (!clientToDelete) return;
    try {
        await deleteDoc(doc(db, `artifacts/${appId}/users/${userId}/clientes`, clientToDelete.id));
        displaySnackbar('Cliente eliminado com sucesso!');
        setShowDeleteModal(false);
        setClientToDelete(null);
    } catch (e) {
        console.error("Erro ao eliminar cliente:", e);
        displaySnackbar('Erro ao eliminar o cliente.');
    }
  };
  
  const filteredClients = clientes.filter(c => 
    (c.nome?.toLowerCase().includes(searchTerm.toLowerCase()) || c.nif?.includes(searchTerm)) &&
    (filterType === 'Todos' || c.tipoCliente === filterType)
  );

  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <h1 className="text-3xl font-bold text-gray-700 mb-6">Gestão de Clientes</h1>
      <div className="flex justify-between items-center mb-6">
        <div className="flex gap-4">
            <input type="text" placeholder="Pesquisar por nome ou NIF..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="p-2 border rounded-lg w-64" />
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="p-2 border rounded-lg">
                <option value="Todos">Todos os Tipos</option>
                <option value="Empresa">Empresa</option>
                <option value="Particular">Particular</option>
            </select>
        </div>
        <button onClick={() => { setCurrentClient(null); setShowModal(true); }} className="px-6 py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700">Adicionar Novo</button>
      </div>
      {loading ? <LoadingSpinner /> : (
        <div className="overflow-x-auto rounded-lg shadow-sm"><table className="min-w-full bg-white"><thead className="bg-gray-50 border-b"><tr><th className="py-3 px-6 text-left text-xs font-medium text-gray-500 uppercase">Nome</th><th className="py-3 px-6 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th><th className="py-3 px-6 text-left text-xs font-medium text-gray-500 uppercase">NIF</th><th className="py-3 px-6 text-left text-xs font-medium text-gray-500 uppercase">Comercial</th><th className="py-3 px-6 text-center text-xs font-medium text-gray-500 uppercase">Ações</th></tr></thead>
        <tbody className="divide-y">{filteredClients.map((client) => (<tr key={client.id}><td className="py-4 px-6 text-sm font-medium">{client.nome}</td><td className="py-4 px-6 text-sm">{client.tipoCliente}</td><td className="py-4 px-6 text-sm">{client.nif}</td><td className="py-4 px-6 text-sm">{client.comercialResponsavel}</td><td className="py-4 px-6 text-center"><button onClick={() => { setCurrentClient(client); setShowDetailsModal(true); }} className="text-indigo-600 font-semibold text-xs mr-3">Ver Detalhes</button><button onClick={() => { setCurrentClient(client); setShowModal(true); }} className="text-blue-600 font-semibold text-xs mr-3">Editar</button><button onClick={() => { setClientToDelete(client); setShowDeleteModal(true); }} className="text-red-600 font-semibold text-xs">Eliminar</button></td></tr>))}</tbody>
        </table></div>)}
      {showModal && <ClientFormModal client={currentClient} comerciais={comerciais} onSave={handleSave} onClose={() => setShowModal(false)} />}
      {showDetailsModal && <ClientDetailsModal client={currentClient} onClose={() => setShowDetailsModal(false)} />}
      {showDeleteModal && <ModalMessage title="Confirmar Eliminação" message={`Tem a certeza que quer eliminar o cliente "${clientToDelete?.nome}"?`} onConfirm={handleDelete} onCancel={() => setShowDeleteModal(false)} />}
      <Snackbar message={message} show={showSnackbar} />
    </div>
  );
};

const ClientFormModal = ({ client, comerciais, onSave, onClose }) => {
  const [form, setForm] = useState({
    nome: client?.nome || '', dataNascimento: client?.dataNascimento || '', telefone: client?.telefone || '', morada: client?.morada || '',
    codigoPostal: client?.codigoPostal || '', localidade: client?.localidade || '', tipoCliente: client?.tipoCliente || 'Particular',
    dataCriacao: client?.dataCriacao || new Date().toISOString().split('T')[0], observacoes: client?.observacoes || '', nif: client?.nif || '',
    email: client?.email || '', comercialResponsavel: client?.comercialResponsavel || '', rgpdAssinado: client?.rgpdAssinado || 'Não', id: client?.id || null,
  });

  const handleChange = (e) => {
      const { name, value } = e.target;
      if (name === 'nif') {
          // Permite apenas números e limita a 9 caracteres
          const numericValue = value.replace(/[^0-9]/g, '');
          setForm({ ...form, [name]: numericValue.slice(0, 9) });
      } else {
          setForm({ ...form, [name]: value });
      }
  };
  const handleSubmit = (e) => { e.preventDefault(); onSave(form); };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-50 overflow-y-auto p-4"><div className="bg-white rounded-lg p-8 shadow-xl max-w-3xl w-full my-8">
      <div className="flex justify-between items-center mb-6 border-b pb-4"><h2 className="text-2xl font-bold">{client ? 'Editar Cliente' : 'Adicionar Cliente'}</h2><button onClick={onClose} className="text-gray-500 text-2xl font-bold">&times;</button></div>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="md:col-span-2"><label className="block text-sm font-medium">Nome</label><input type="text" name="nome" value={form.nome} onChange={handleChange} required className="mt-1 w-full border rounded-md p-2" /></div>
        <div><label className="block text-sm font-medium">E-mail</label><input type="email" name="email" value={form.email} onChange={handleChange} className="mt-1 w-full border rounded-md p-2" /></div>
        <div><label className="block text-sm font-medium">Telefone</label><input type="tel" name="telefone" value={form.telefone} onChange={handleChange} className="mt-1 w-full border rounded-md p-2" /></div>
        <div>
            <label className="block text-sm font-medium">NIF</label>
            <input type="text" name="nif" value={form.nif} onChange={handleChange} className="mt-1 w-full border rounded-md p-2" placeholder="9 dígitos" />
        </div>
        <div><label className="block text-sm font-medium">Data de Nascimento</label><input type="date" name="dataNascimento" value={form.dataNascimento} onChange={handleChange} className="mt-1 w-full border rounded-md p-2" /></div>
        <div className="md:col-span-2"><label className="block text-sm font-medium">Morada</label><input type="text" name="morada" value={form.morada} onChange={handleChange} className="mt-1 w-full border rounded-md p-2" /></div>
        <div><label className="block text-sm font-medium">Código Postal</label><input type="text" name="codigoPostal" value={form.codigoPostal} onChange={handleChange} className="mt-1 w-full border rounded-md p-2" /></div>
        <div><label className="block text-sm font-medium">Localidade</label><input type="text" name="localidade" value={form.localidade} onChange={handleChange} className="mt-1 w-full border rounded-md p-2" /></div>
        <div><label className="block text-sm font-medium">Tipo</label><select name="tipoCliente" value={form.tipoCliente} onChange={handleChange} className="mt-1 w-full border rounded-md p-2"><option>Particular</option><option>Empresa</option></select></div>
        <div><label className="block text-sm font-medium">Comercial</label><select name="comercialResponsavel" value={form.comercialResponsavel} onChange={handleChange} required className="mt-1 w-full border rounded-md p-2"><option value="">Selecione...</option>{comerciais.map(c=><option key={c.id} value={c.nome}>{c.nome}</option>)}</select></div>
        <div><label className="block text-sm font-medium">Data Criação</label><input type="date" name="dataCriacao" value={form.dataCriacao} onChange={handleChange} className="mt-1 w-full border rounded-md p-2" /></div>
        <div><label className="block text-sm font-medium">RGPD Assinado</label><select name="rgpdAssinado" value={form.rgpdAssinado} onChange={handleChange} className="mt-1 w-full border rounded-md p-2"><option>Sim</option><option>Não</option></select></div>
        <div className="md:col-span-2"><label className="block text-sm font-medium">Observações</label><textarea name="observacoes" value={form.observacoes} onChange={handleChange} rows="3" className="mt-1 w-full border rounded-md p-2"></textarea></div>
        <div className="md:col-span-2 flex justify-end gap-2 mt-4"><button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg">Cancelar</button><button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg">Guardar</button></div>
      </form>
    </div></div>
  );
};

const ClientDetailsModal = ({ client, onClose }) => {
  const { db, storage, appId, userId } = useContext(AppContext);
  const [contratos, setContratos] = useState([]);
  const [interacoes, setInteracoes] = useState([]);
  const [documentos, setDocumentos] = useState([]);
  const [newInteraction, setNewInteraction] = useState('');
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState(null);

  useEffect(() => {
    if (!db || !client) return;
    const qContratos = query(collection(db, `artifacts/${appId}/users/${userId}/contratos`), where("clienteId", "==", client.id));
    const unsubContratos = onSnapshot(qContratos, snap => setContratos(snap.docs.map(d => ({id: d.id, ...d.data()}))));
    
    const qInteracoes = query(collection(db, `artifacts/${appId}/users/${userId}/clientes/${client.id}/interacoes`));
    const unsubInteracoes = onSnapshot(qInteracoes, snap => setInteracoes(snap.docs.map(d => ({id: d.id, ...d.data()}))));
    
    const qDocs = query(collection(db, `artifacts/${appId}/users/${userId}/clientes/${client.id}/documentos`));
    const unsubDocs = onSnapshot(qDocs, snap => setDocumentos(snap.docs.map(d => ({id: d.id, ...d.data()}))));

    return () => { unsubContratos(); unsubInteracoes(); unsubDocs(); };
  }, [db, client, appId, userId]);

  const handleAddInteraction = async () => {
    if (newInteraction.trim() === '') return;
    await addInteraction(db, appId, userId, `clientes/${client.id}/interacoes`, { tipo: 'Nota Manual', descricao: newInteraction });
    setNewInteraction('');
  };
  
  const handleFileUpload = async () => {
      if (!file) return;
      setUploading(true);
      const storageRef = ref(storage, `documentos_clientes/${client.id}/${file.name}`);
      try {
          await uploadBytes(storageRef, file);
          const url = await getDownloadURL(storageRef);
          const docsCollRef = collection(db, `artifacts/${appId}/users/${userId}/clientes/${client.id}/documentos`);
          await addDoc(docsCollRef, {
              nome: file.name,
              url: url,
              dataUpload: serverTimestamp()
          });
          setFile(null);
      } catch (e) {
          console.error("Erro no upload do ficheiro:", e);
      } finally {
          setUploading(false);
      }
  };

  if (!client) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-50 overflow-y-auto p-4"><div className="bg-white rounded-lg p-8 shadow-xl max-w-4xl w-full my-8">
      <div className="flex justify-between items-center mb-6 border-b pb-4"><h2 className="text-2xl font-bold">Detalhes do Cliente: {client.nome}</h2><button onClick={onClose} className="text-gray-500 text-2xl font-bold">&times;</button></div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div><h3 className="font-semibold text-lg mb-2">Dados Pessoais e Comerciais</h3><div className="space-y-1 text-sm"><p><strong>Email:</strong> {client.email || 'N/A'}</p><p><strong>Telefone:</strong> {client.telefone || 'N/A'}</p><p><strong>NIF:</strong> {client.nif || 'N/A'}</p><p><strong>Morada:</strong> {`${client.morada || ''}, ${client.codigoPostal || ''} ${client.localidade || ''}`}</p><p><strong>Comercial:</strong> {client.comercialResponsavel || 'N/A'}</p></div></div>
        <div>
            <h3 className="font-semibold text-lg mb-2">Documentos Associados</h3>
            <ul className="space-y-1 text-sm list-disc pl-5">
                {documentos.map(doc => <li key={doc.id}><a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">{doc.nome}</a></li>)}
                {documentos.length === 0 && <p className="text-gray-500">Nenhum documento carregado.</p>}
            </ul>
            <div className="mt-4 flex gap-2 items-center">
                <input type="file" onChange={(e) => setFile(e.target.files[0])} className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"/>
                <button onClick={handleFileUpload} disabled={!file || uploading} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm disabled:bg-gray-400">{uploading ? 'A carregar...' : 'Upload'}</button>
            </div>
        </div>
      </div>
      <div className="mt-8"><h3 className="font-semibold text-lg mb-2">Contratos Associados</h3><div className="overflow-x-auto rounded-lg border max-h-40"><table className="min-w-full text-sm"><thead className="bg-gray-50"><tr><th className="py-2 px-4 text-left">Tipo</th><th className="py-2 px-4 text-left">Estado</th><th className="py-2 px-4 text-left">Data</th></tr></thead><tbody className="divide-y">{contratos.map(c=><tr key={c.id}><td className="py-2 px-4">{c.tipoServico}</td><td className="py-2 px-4">{c.estado}</td><td className="py-2 px-4">{c.dataContrato}</td></tr>)}</tbody></table></div></div>
      <div className="mt-8"><h3 className="font-semibold text-lg mb-2">Histórico de Interações</h3><div className="bg-gray-50 p-4 rounded-lg space-y-4 max-h-48 overflow-y-auto">{interacoes.map(i=><div key={i.id} className="border-l-2 border-indigo-500 pl-3"><p className="text-xs text-gray-500">{new Date(i.data).toLocaleString('pt-PT')}</p><p className="font-medium text-sm">{i.tipo}</p><p className="text-sm">{i.descricao}</p></div>)}</div></div>
      <div className="mt-6"><h3 className="font-semibold text-lg mb-2">Adicionar Nova Interação</h3><div className="flex gap-2"><textarea value={newInteraction} onChange={e => setNewInteraction(e.target.value)} placeholder="Escreva a sua nota..." className="flex-1 p-2 border rounded-lg text-sm"></textarea><button onClick={handleAddInteraction} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 self-start">Adicionar</button></div></div>
    </div></div>
  );
};

// GESTÃO DE CONTRATOS
const Contratos = () => {
    const { db, appId, userId } = useContext(AppContext);
    const [contratos, setContratos] = useState([]);
    const [clientes, setClientes] = useState([]);
    const [comerciais, setComerciais] = useState([]);
    const [parceiros, setParceiros] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showFormModal, setShowFormModal] = useState(false);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [currentContrato, setCurrentContrato] = useState(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [contratoToDelete, setContratoToDelete] = useState(null);
    const [message, setMessage] = useState('');
    const [showSnackbar, setShowSnackbar] = useState(false);

    useEffect(() => {
        if (!db || !appId || !userId) return;
        setLoading(true);
        const unsub = (ref, setter, name) => onSnapshot(ref, snap => setter(snap.docs.map(d => ({ id: d.id, ...d.data() }))), e => console.error(`Erro ao carregar ${name}:`, e));
        
        const unsubCtt = unsub(collection(db, `artifacts/${appId}/users/${userId}/contratos`), setContratos, 'contratos');
        const unsubCli = unsub(collection(db, `artifacts/${appId}/users/${userId}/clientes`), setClientes, 'clientes');
        const qComerciais = query(collection(db, `artifacts/${appId}/public/data/utilizadores`), where("estado", "==", "Ativo"));
        const unsubCom = onSnapshot(qComerciais, snap => setComerciais(snap.docs.map(d => ({ id: d.id, ...d.data() }))), e => console.error('Erro ao carregar comerciais:', e));
        const unsubPar = onSnapshot(collection(db, `artifacts/${appId}/public/data/parceiros`), snap => {
            setParceiros(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            setLoading(false);
        }, e => { console.error('Erro ao carregar parceiros:', e); setLoading(false); });

        return () => { unsubCtt(); unsubCli(); unsubCom(); unsubPar(); };
    }, [db, appId, userId]);

    const displaySnackbar = (msg) => {
        setMessage(msg);
        setShowSnackbar(true);
        setTimeout(() => setShowSnackbar(false), 3000);
    };

    const handleSave = async (data) => {
        const collRef = collection(db, `artifacts/${appId}/users/${userId}/contratos`);
        let contractId = data.id;
        try {
            const { id, ...contractData } = data;
            if (id) {
                await setDoc(doc(collRef, id), contractData, { merge: true });
                displaySnackbar('Contrato atualizado!');
            } else {
                const newDocRef = await addDoc(collRef, contractData);
                contractId = newDocRef.id;
                displaySnackbar('Contrato adicionado!');
            }

            if (contractData.documentosEmFalta) {
                const tarefasRef = collection(db, `artifacts/${appId}/users/${userId}/tarefas`);
                await addDoc(tarefasRef, {
                    titulo: `Documentação pendente para o contrato de ${contractData.clienteNome}`,
                    descricao: contractData.documentosEmFaltaDesc || 'Verificar documentos em falta no contrato.',
                    prazo: new Date(new Date().setDate(new Date().getDate() + 7)).toISOString().split('T')[0],
                    estado: 'Pendente',
                    contratoId: contractId,
                    clienteId: contractData.clienteId,
                    responsavel: contractData.comercial,
                    prioridade: 'Alta',
                });
                displaySnackbar('Tarefa de documentação pendente criada.');
            }
        } catch (e) { console.error(e); displaySnackbar('Erro ao guardar.'); }
        setShowFormModal(false);
        setCurrentContrato(null);
    };

    const handleDelete = async () => {
        if (!contratoToDelete) return;
        try {
            await deleteDoc(doc(db, `artifacts/${appId}/users/${userId}/contratos`, contratoToDelete.id));
            displaySnackbar('Contrato eliminado!');
        } catch (e) { console.error(e); displaySnackbar('Erro ao eliminar.'); }
        setShowDeleteModal(false);
        setContratoToDelete(null);
    };

    return (
        <div className="p-6 bg-white rounded-lg shadow-md">
            <h1 className="text-3xl font-bold text-gray-700 mb-6">Gestão de Contratos</h1>
            <div className="flex justify-between items-center mb-6">
                <div>{/* Filtros aqui */}</div>
                <button onClick={() => { setCurrentContrato(null); setShowFormModal(true); }} className="px-6 py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700">Adicionar Novo Contrato</button>
            </div>
            {loading ? <LoadingSpinner /> : (
                <div className="overflow-x-auto rounded-lg shadow-sm"><table className="min-w-full bg-white"><thead className="bg-gray-50 border-b"><tr><th className="py-3 px-6 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th><th className="py-3 px-6 text-left text-xs font-medium text-gray-500 uppercase">Tipo Serviço</th><th className="py-3 px-6 text-left text-xs font-medium text-gray-500 uppercase">Estado</th><th className="py-3 px-6 text-center text-xs font-medium text-gray-500 uppercase">Ações</th></tr></thead>
                <tbody className="divide-y">{contratos.map(c => (<tr key={c.id}><td className="py-4 px-6 text-sm font-medium">{c.clienteNome}</td><td className="py-4 px-6 text-sm">{c.tipoServico}</td><td className="py-4 px-6 text-sm">{c.estado}</td><td className="py-4 px-6 text-center"><button onClick={() => { setCurrentContrato(c); setShowDetailsModal(true); }} className="text-indigo-600 font-semibold text-xs mr-3">Ver Detalhes</button><button onClick={() => { setCurrentContrato(c); setShowFormModal(true); }} className="text-blue-600 font-semibold text-xs mr-3">Editar</button><button onClick={() => { setContratoToDelete(c); setShowDeleteModal(true); }} className="text-red-600 font-semibold text-xs">Eliminar</button></td></tr>))}</tbody>
                </table></div>)}
            {showFormModal && <ContratoFormModal contrato={currentContrato} clientes={clientes} comerciais={comerciais} parceiros={parceiros} onSave={handleSave} onClose={() => setShowFormModal(false)} />}
            {showDetailsModal && <ContratoDetailsModal contrato={currentContrato} onClose={() => setShowDetailsModal(false)} />}
            {showDeleteModal && <ModalMessage title="Confirmar Eliminação" message={`Tem a certeza que quer eliminar este contrato?`} onConfirm={handleDelete} onCancel={() => setShowDeleteModal(false)} />}
            <Snackbar message={message} show={showSnackbar} />
        </div>
    );
};

const ContratoFormModal = ({ contrato, clientes, comerciais, parceiros, onSave, onClose }) => {
    const initialFormState = {
        // Campos Comuns
        clienteId: contrato?.clienteId || '', clienteNome: contrato?.clienteNome || '', dataContrato: contrato?.dataContrato || new Date().toISOString().split('T')[0],
        comercial: contrato?.comercial || '', tipoServico: contrato?.tipoServico || '', estado: contrato?.estado || 'Pendente',
        id: contrato?.id || null,
        
        // Campos de Crédito
        fornecedor: contrato?.fornecedor || '', financeira: contrato?.financeira || '', valorFinanciado: contrato?.valorFinanciado || 0,
        comissaoPercentagem: contrato?.comissaoPercentagem || 0, comissaoRecebida: contrato?.comissaoRecebida || 0,
        matricula: contrato?.matricula || '', tipoCredito: contrato?.tipoCredito || '',
        dataEntregaFornecedor: contrato?.dataEntregaFornecedor || '', dataEntregaFinanceira: contrato?.dataEntregaFinanceira || '',
        documentosEmFalta: contrato?.documentosEmFalta || false, documentosEmFaltaDesc: contrato?.documentosEmFaltaDesc || '',
        checklist: contrato?.checklist || { 'Livrança': false, 'Contrato': false, 'DUA': false, 'DAV': false, 'MUA de compra': false, 'MUA de venda': false, 'Extinção de reserva': false },
        creditoRealizado: contrato?.creditoRealizado || false,
        
        // Campos de Seguro
        tipoSeguro: contrato?.tipoSeguro || '', seguradora: contrato?.seguradora || '',
        numeroApolice: contrato?.numeroApolice || '', dataSubscricao: contrato?.dataSubscricao || '',
        renovacaoAutomatica: contrato?.renovacaoAutomatica || false,

        // Campos de Legalização Automóvel
        chassis: contrato?.chassis || '', matriculaEstrangeira: contrato?.matriculaEstrangeira || '', paisImportacao: contrato?.paisImportacao || '',
        dataEstimadaConclusao: contrato?.dataEstimadaConclusao || '',

        // Campos de Consultoria Financeira
        diagnosticoFeito: contrato?.diagnosticoFeito || 'Não', situacaoAtual: contrato?.situacaoAtual || '',
        dataSessao: contrato?.dataSessao || '', acoesImplementar: contrato?.acoesImplementar || '',
    };
    const [form, setForm] = useState(initialFormState);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        if (name === 'clienteId') {
            const selectedClient = clientes.find(c => c.id === value);
            setForm(prev => ({ ...prev, clienteId: value, clienteNome: selectedClient?.nome || '' }));
        } else {
            setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
        }
    };
    const handleChecklistChange = (e) => setForm(prev => ({ ...prev, checklist: { ...prev.checklist, [e.target.name]: e.target.checked } }));
    const handleSubmit = (e) => { e.preventDefault(); onSave(form); };
    
    const comissaoPaga = (parseFloat(form.valorFinanciado) || 0) * (parseFloat(form.comissaoPercentagem) || 0) / 100;
    const financeiras = parceiros.filter(p => p.tipo === 'Financeira');
    const fornecedores = parceiros.filter(p => p.tipo === 'Fornecedor');
    const seguradoras = parceiros.filter(p => p.tipo === 'Seguradora');

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-50 overflow-y-auto p-4"><div className="bg-white rounded-lg p-8 shadow-xl max-w-4xl w-full my-8">
            <div className="flex justify-between items-center mb-6 border-b pb-4"><h2 className="text-2xl font-bold">{contrato ? 'Editar Contrato' : 'Novo Contrato'}</h2><button onClick={onClose} className="text-gray-500 text-2xl font-bold">&times;</button></div>
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div><label className="text-sm font-medium">Cliente*</label><select name="clienteId" value={form.clienteId} onChange={handleChange} required className="w-full p-2 border rounded-md"><option value="">Selecione Cliente</option>{clientes.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}</select></div>
                    <div><label className="text-sm font-medium">Data do Contrato</label><input type="date" name="dataContrato" value={form.dataContrato} onChange={handleChange} className="w-full p-2 border rounded-md" /></div>
                    <div><label className="text-sm font-medium">Comercial*</label><select name="comercial" value={form.comercial} onChange={handleChange} required className="w-full p-2 border rounded-md"><option value="">Selecione Comercial</option>{comerciais.map(c=><option key={c.id} value={c.nome}>{c.nome}</option>)}</select></div>
                </div>
                <div><label className="text-sm font-medium">Tipo de Serviço*</label><select name="tipoServico" value={form.tipoServico} onChange={handleChange} required className="w-full p-2 border rounded-md"><option value="">Selecione Tipo de Serviço</option><option>Crédito</option><option>Seguro</option><option>Legalização Automóvel</option><option>Consultoria Financeira</option></select></div>
                
                {form.tipoServico === 'Crédito' && <div className="p-4 border rounded-md space-y-4 bg-gray-50">
                    <h3 className="font-semibold">Detalhes do Crédito</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label className="text-sm">Fornecedor</label><select name="fornecedor" value={form.fornecedor} onChange={handleChange} className="w-full p-2 border rounded-md"><option value="">Selecione</option>{fornecedores.map(p=><option key={p.id} value={p.nome}>{p.nome}</option>)}</select></div>
                        <div><label className="text-sm">Financeira</label><select name="financeira" value={form.financeira} onChange={handleChange} className="w-full p-2 border rounded-md"><option value="">Selecione</option>{financeiras.map(p=><option key={p.id} value={p.nome}>{p.nome}</option>)}</select></div>
                        <div><label className="text-sm">Tipo de Crédito</label><input type="text" name="tipoCredito" value={form.tipoCredito} onChange={handleChange} placeholder="Ex: Pessoal, Automóvel" className="w-full p-2 border rounded-md" /></div>
                        <div><label className="text-sm">Matrícula</label><input type="text" name="matricula" value={form.matricula} onChange={handleChange} placeholder="00-AA-00" className="w-full p-2 border rounded-md" /></div>
                        <div><label className="text-sm">Valor Financiado (€)</label><input type="number" step="0.01" name="valorFinanciado" value={form.valorFinanciado} onChange={handleChange} className="w-full p-2 border rounded-md" /></div>
                        <div><label className="text-sm">Comissão (%)</label><input type="number" step="0.01" name="comissaoPercentagem" value={form.comissaoPercentagem} onChange={handleChange} className="w-full p-2 border rounded-md" /></div>
                        <div><label className="text-sm">Comissão a Pagar</label><input type="text" value={`${comissaoPaga.toFixed(2)} €`} readOnly className="w-full p-2 bg-gray-200 border rounded-md" /></div>
                        <div><label className="text-sm">Comissão Recebida (€)</label><input type="number" step="0.01" name="comissaoRecebida" value={form.comissaoRecebida} onChange={handleChange} className="w-full p-2 border rounded-md" /></div>
                        <div><label className="text-sm">Data entrega fornecedor</label><input type="date" name="dataEntregaFornecedor" value={form.dataEntregaFornecedor} onChange={handleChange} className="w-full p-2 border rounded-md" /></div>
                        <div><label className="text-sm">Data entrega financeira</label><input type="date" name="dataEntregaFinanceira" value={form.dataEntregaFinanceira} onChange={handleChange} className="w-full p-2 border rounded-md" /></div>
                    </div>
                    <div className="flex items-center gap-2"><input type="checkbox" name="documentosEmFalta" checked={form.documentosEmFalta} onChange={handleChange} id="docFalta" /><label htmlFor="docFalta">Documentos em falta?</label></div>
                    {form.documentosEmFalta && <textarea name="documentosEmFaltaDesc" value={form.documentosEmFaltaDesc} onChange={handleChange} placeholder="Especificar documentos" className="w-full p-2 border rounded-md" rows="2"></textarea>}
                    <div><label className="text-sm font-semibold">Checklist Documentos</label><div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2 text-sm">{Object.keys(form.checklist).map(item => <div key={item}><input type="checkbox" name={item} checked={form.checklist[item]} onChange={handleChecklistChange} id={item} className="mr-2" /><label htmlFor={item}>{item}</label></div>)}</div></div>
                    <div className="flex items-center gap-2"><input type="checkbox" name="creditoRealizado" checked={form.creditoRealizado} onChange={handleChange} id="credRealizado" /><label htmlFor="credRealizado">Crédito realizado?</label></div>
                </div>}

                {form.tipoServico === 'Seguro' && <div className="p-4 border rounded-md space-y-4 bg-gray-50">
                    <h3 className="font-semibold">Detalhes do Seguro</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label className="text-sm">Tipo de Seguro</label><input type="text" name="tipoSeguro" value={form.tipoSeguro} onChange={handleChange} className="w-full p-2 border rounded-md" /></div>
                        <div><label className="text-sm">Seguradora</label><select name="seguradora" value={form.seguradora} onChange={handleChange} className="w-full p-2 border rounded-md"><option value="">Selecione</option>{seguradoras.map(p=><option key={p.id} value={p.nome}>{p.nome}</option>)}</select></div>
                        <div><label className="text-sm">Nº Apólice</label><input type="text" name="numeroApolice" value={form.numeroApolice} onChange={handleChange} className="w-full p-2 border rounded-md" /></div>
                        <div><label className="text-sm">Matrícula</label><input type="text" name="matricula" value={form.matricula} onChange={handleChange} placeholder="00-AA-00" className="w-full p-2 border rounded-md" /></div>
                        <div><label className="text-sm">Data Subscrição</label><input type="date" name="dataSubscricao" value={form.dataSubscricao} onChange={handleChange} className="w-full p-2 border rounded-md" /></div>
                        <div><label className="text-sm">Comissão Recebida (€)</label><input type="number" step="0.01" name="comissaoRecebida" value={form.comissaoRecebida} onChange={handleChange} className="w-full p-2 border rounded-md" /></div>
                    </div>
                    <div className="flex items-center gap-2"><input type="checkbox" name="renovacaoAutomatica" checked={form.renovacaoAutomatica} onChange={handleChange} id="renovAuto" /><label htmlFor="renovAuto">Renovação automática?</label></div>
                </div>}

                {form.tipoServico === 'Legalização Automóvel' && <div className="p-4 border rounded-md space-y-4 bg-gray-50">
                    <h3 className="font-semibold">Detalhes da Legalização</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label className="text-sm">Nº Chassis</label><input type="text" name="chassis" value={form.chassis} onChange={handleChange} className="w-full p-2 border rounded-md" /></div>
                        <div><label className="text-sm">Matrícula Estrangeira</label><input type="text" name="matriculaEstrangeira" value={form.matriculaEstrangeira} onChange={handleChange} className="w-full p-2 border rounded-md" /></div>
                        <div><label className="text-sm">País de Importação</label><input type="text" name="paisImportacao" value={form.paisImportacao} onChange={handleChange} className="w-full p-2 border rounded-md" /></div>
                        <div><label className="text-sm">Data Estimada de Conclusão</label><input type="date" name="dataEstimadaConclusao" value={form.dataEstimadaConclusao} onChange={handleChange} className="w-full p-2 border rounded-md" /></div>
                    </div>
                    <div><label className="text-sm">Upload de Documentos</label><input type="file" multiple className="w-full text-sm" /></div>
                </div>}

                {form.tipoServico === 'Consultoria Financeira' && <div className="p-4 border rounded-md space-y-4 bg-gray-50">
                    <h3 className="font-semibold">Detalhes da Consultoria</h3>
                    <div><label className="text-sm">Diagnóstico Financeiro Feito?</label><select name="diagnosticoFeito" value={form.diagnosticoFeito} onChange={handleChange} className="w-full p-2 border rounded-md"><option>Não</option><option>Sim</option></select></div>
                    <div><label className="text-sm">Situação Atual (Rendimentos, despesas, dívidas)</label><textarea name="situacaoAtual" value={form.situacaoAtual} onChange={handleChange} rows="3" className="w-full p-2 border rounded-md"></textarea></div>
                    <div><label className="text-sm">Data da Sessão</label><input type="date" name="dataSessao" value={form.dataSessao} onChange={handleChange} className="w-full p-2 border rounded-md" /></div>
                    <div><label className="text-sm">Ações a Implementar</label><textarea name="acoesImplementar" value={form.acoesImplementar} onChange={handleChange} rows="3" className="w-full p-2 border rounded-md"></textarea></div>
                    <div><label className="text-sm">Uploads (IRS, recibos, extratos)</label><input type="file" multiple className="w-full text-sm" /></div>
                </div>}

                <div className="flex justify-end gap-2 mt-4"><button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg">Cancelar</button><button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg">Guardar Contrato</button></div>
            </form>
        </div></div>
    );
};

const ContratoDetailsModal = ({ contrato, onClose }) => {
    const { db, storage, appId, userId } = useContext(AppContext);
    const [interacoes, setInteracoes] = useState([]);
    const [documentos, setDocumentos] = useState([]);
    const [newInteraction, setNewInteraction] = useState('');
    const [uploading, setUploading] = useState(false);
    const [file, setFile] = useState(null);

    useEffect(() => {
        if (!db || !contrato) return;
        const qInteracoes = query(collection(db, `artifacts/${appId}/users/${userId}/contratos/${contrato.id}/interacoes`));
        const unsubInteracoes = onSnapshot(qInteracoes, snap => setInteracoes(snap.docs.map(d => ({id: d.id, ...d.data()}))));
        
        const qDocs = query(collection(db, `artifacts/${appId}/users/${userId}/contratos/${contrato.id}/documentos`));
        const unsubDocs = onSnapshot(qDocs, snap => setDocumentos(snap.docs.map(d => ({id: d.id, ...d.data()}))));

        return () => { unsubInteracoes(); unsubDocs(); };
    }, [db, contrato, appId, userId]);

    const handleAddInteraction = async () => {
        if (newInteraction.trim() === '') return;
        await addInteraction(db, appId, userId, `contratos/${contrato.id}/interacoes`, { tipo: 'Nota Manual', descricao: newInteraction });
        setNewInteraction('');
    };
    
    const handleFileUpload = async () => {
        if (!file) return;
        setUploading(true);
        const storageRef = ref(storage, `documentos_contratos/${contrato.id}/${file.name}`);
        try {
            await uploadBytes(storageRef, file);
            const url = await getDownloadURL(storageRef);
            const docsCollRef = collection(db, `artifacts/${appId}/users/${userId}/contratos/${contrato.id}/documentos`);
            await addDoc(docsCollRef, { nome: file.name, url: url, dataUpload: serverTimestamp() });
            setFile(null);
        } catch (e) { console.error("Erro no upload do ficheiro:", e); } 
        finally { setUploading(false); }
    };

    if (!contrato) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-50 overflow-y-auto p-4">
            <div className="bg-white rounded-lg p-8 shadow-xl max-w-4xl w-full my-8">
                <div className="flex justify-between items-center mb-6 border-b pb-4">
                    <h2 className="text-2xl font-bold">Detalhes do Contrato: {contrato.tipoServico} - {contrato.clienteNome}</h2>
                    <button onClick={onClose} className="text-gray-500 text-2xl font-bold">&times;</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div><h3 className="font-semibold text-lg mb-2">Informação do Contrato</h3><div className="space-y-1 text-sm"><p><strong>Tipo de Serviço:</strong> {contrato.tipoServico}</p><p><strong>Cliente:</strong> {contrato.clienteNome}</p><p><strong>Comercial:</strong> {contrato.comercial}</p><p><strong>Estado:</strong> {contrato.estado}</p>{contrato.matricula && <p><strong>Matrícula:</strong> {contrato.matricula}</p>}{contrato.valorFinanciado && <p><strong>Valor Financiado:</strong> {parseFloat(contrato.valorFinanciado).toLocaleString('pt-PT', {style: 'currency', currency: 'EUR'})}</p>}{contrato.comissaoRecebida && <p><strong>Comissão Recebida:</strong> {parseFloat(contrato.comissaoRecebida).toLocaleString('pt-PT', {style: 'currency', currency: 'EUR'})}</p>}</div></div>
                    <div>
                        <h3 className="font-semibold text-lg mb-2">Documentos do Contrato</h3>
                        <ul className="space-y-1 text-sm list-disc pl-5">{documentos.map(doc => <li key={doc.id}><a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">{doc.nome}</a></li>)}{documentos.length === 0 && <p className="text-gray-500">Nenhum documento carregado.</p>}</ul>
                        <div className="mt-4 flex gap-2 items-center">
                            <input type="file" onChange={(e) => setFile(e.target.files[0])} className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"/>
                            <button onClick={handleFileUpload} disabled={!file || uploading} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm disabled:bg-gray-400">{uploading ? 'A carregar...' : 'Upload'}</button>
                        </div>
                    </div>
                </div>
                <div className="mt-8"><h3 className="font-semibold text-lg mb-2">Histórico de Interações do Contrato</h3><div className="bg-gray-50 p-4 rounded-lg space-y-4 max-h-48 overflow-y-auto">{interacoes.map(i=><div key={i.id} className="border-l-2 border-indigo-500 pl-3"><p className="text-xs text-gray-500">{new Date(i.data).toLocaleString('pt-PT')}</p><p className="font-medium text-sm">{i.tipo}</p><p className="text-sm">{i.descricao}</p></div>)}</div></div>
                <div className="mt-6"><h3 className="font-semibold text-lg mb-2">Adicionar Nova Interação</h3><div className="flex gap-2"><textarea value={newInteraction} onChange={e => setNewInteraction(e.target.value)} placeholder="Escreva a sua nota..." className="flex-1 p-2 border rounded-lg text-sm"></textarea><button onClick={handleAddInteraction} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 self-start">Adicionar</button></div></div>
            </div>
        </div>
    );
};

// MÓDULO DE PARCEIROS
const Parceiros = () => {
    const [activeTab, setActiveTab] = useState('Fornecedores');

    return (
        <div className="p-6 bg-white rounded-lg shadow-md">
            <h1 className="text-3xl font-bold text-gray-700 mb-6">Gestão de Parceiros</h1>
            <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                    <button onClick={() => setActiveTab('Fornecedores')} className={`${activeTab === 'Fornecedores' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}>Fornecedores</button>
                    <button onClick={() => setActiveTab('Financeiras')} className={`${activeTab === 'Financeiras' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}>Financeiras</button>
                    <button onClick={() => setActiveTab('Seguradoras')} className={`${activeTab === 'Seguradoras' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}>Seguradoras</button>
                </nav>
            </div>
            <div className="pt-6">
                {activeTab === 'Fornecedores' && <PartnerSection type="Fornecedor" />}
                {activeTab === 'Financeiras' && <PartnerSection type="Financeira" />}
                {activeTab === 'Seguradoras' && <PartnerSection type="Seguradora" />}
            </div>
        </div>
    );
};

const PartnerSection = ({ type }) => {
    const { db, appId } = useContext(AppContext);
    const [partners, setPartners] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!db || !appId) return;
        setLoading(true);
        const q = query(collection(db, `artifacts/${appId}/public/data/parceiros`), where("tipo", "==", type));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setPartners(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setLoading(false);
        }, (error) => {
            console.error(`Erro ao carregar parceiros do tipo ${type}:`, error);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [db, appId, type]);

    const handleSave = async (data) => {
        const collRef = collection(db, `artifacts/${appId}/public/data/parceiros`);
        const { id, ...partnerData } = data;
        try {
            if (id) {
                await setDoc(doc(collRef, id), partnerData, { merge: true });
            } else {
                await addDoc(collRef, { ...partnerData, tipo: type });
            }
        } catch(e) {
            console.error("Erro ao guardar parceiro:", e);
        }
    };

    return (
        <div>
            <PartnerForm type={type} onSave={handleSave} />
            {loading ? <LoadingSpinner /> : <PartnerList partners={partners} type={type} />}
        </div>
    );
};

const PartnerForm = ({ type, onSave }) => {
    const emptyForm = { nome: '', nif: '', iban: '', morada: '', codigoPostal: '', localidade: '', telefone: '', email: '', cae: '', capitalSocial: '', pessoaContacto: '', equipamento: '', nomeComercial: '', dataNascimentoComercial: '', contactoComercial: '', emailComercial: '', emailComissoes: '' };
    const [form, setForm] = useState(emptyForm);

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(form);
        setForm(emptyForm);
    };
    
    const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

    const renderFormFields = () => {
        switch (type) {
            case 'Fornecedor':
                return (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <input name="nome" value={form.nome} onChange={handleChange} placeholder="Nome" className="p-2 border rounded" />
                        <input name="nif" value={form.nif} onChange={handleChange} placeholder="NIF" className="p-2 border rounded" />
                        <input name="iban" value={form.iban} onChange={handleChange} placeholder="IBAN" className="p-2 border rounded" />
                        <input name="morada" value={form.morada} onChange={handleChange} placeholder="Morada" className="p-2 border rounded" />
                        <input name="codigoPostal" value={form.codigoPostal} onChange={handleChange} placeholder="Código Postal" className="p-2 border rounded" />
                        <input name="localidade" value={form.localidade} onChange={handleChange} placeholder="Localidade" className="p-2 border rounded" />
                        <input name="telefone" value={form.telefone} onChange={handleChange} placeholder="Telefone" className="p-2 border rounded" />
                        <input name="email" value={form.email} onChange={handleChange} placeholder="Email" className="p-2 border rounded" />
                        <input name="cae" value={form.cae} onChange={handleChange} placeholder="CAE" className="p-2 border rounded" />
                        <input name="capitalSocial" value={form.capitalSocial} onChange={handleChange} placeholder="Capital Social" className="p-2 border rounded" />
                        <input name="pessoaContacto" value={form.pessoaContacto} onChange={handleChange} placeholder="Pessoa a Contactar" className="p-2 border rounded" />
                        <select name="equipamento" value={form.equipamento} onChange={handleChange} className="p-2 border rounded"><option>AUTO</option><option>Não AUTO</option></select>
                        <div className="md:col-span-4"><input type="file" className="text-sm" /></div>
                    </div>
                );
            case 'Financeira':
                return (
                     <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <input name="nome" value={form.nome} onChange={handleChange} placeholder="Nome da Financeira" className="p-2 border rounded" />
                        <input name="morada" value={form.morada} onChange={handleChange} placeholder="Morada" className="p-2 border rounded" />
                        <input name="nif" value={form.nif} onChange={handleChange} placeholder="NIF" className="p-2 border rounded" />
                        <input name="nomeComercial" value={form.nomeComercial} onChange={handleChange} placeholder="Nome do Comercial" className="p-2 border rounded" />
                        <input type="date" name="dataNascimentoComercial" value={form.dataNascimentoComercial} onChange={handleChange} className="p-2 border rounded" />
                        <input name="contactoComercial" value={form.contactoComercial} onChange={handleChange} placeholder="Contacto Comercial" className="p-2 border rounded" />
                        <input name="emailComercial" value={form.emailComercial} onChange={handleChange} placeholder="Email Comercial" className="p-2 border rounded" />
                        <input name="emailComissoes" value={form.emailComissoes} onChange={handleChange} placeholder="Email Comissões" className="p-2 border rounded" />
                    </div>
                );
            case 'Seguradora':
                 return (
                     <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <input name="nome" value={form.nome} onChange={handleChange} placeholder="Nome da Seguradora" className="p-2 border rounded" />
                        <input name="morada" value={form.morada} onChange={handleChange} placeholder="Morada" className="p-2 border rounded" />
                        <input name="nif" value={form.nif} onChange={handleChange} placeholder="NIF" className="p-2 border rounded" />
                        <input name="nomeComercial" value={form.nomeComercial} onChange={handleChange} placeholder="Nome do Comercial" className="p-2 border rounded" />
                        <input type="date" name="dataNascimentoComercial" value={form.dataNascimentoComercial} onChange={handleChange} className="p-2 border rounded" />
                        <input name="contactoComercial" value={form.contactoComercial} onChange={handleChange} placeholder="Contacto Comercial" className="p-2 border rounded" />
                        <input name="emailComercial" value={form.emailComercial} onChange={handleChange} placeholder="Email Comercial" className="p-2 border rounded" />
                    </div>
                );
            default: return null;
        }
    };
    
    return (
        <div className="mb-8 p-4 border rounded-lg bg-gray-50">
            <h3 className="font-semibold mb-4">Adicionar {type}</h3>
            <form onSubmit={handleSubmit}>
                {renderFormFields()}
                <div className="text-right mt-4">
                    <button type="submit" className="px-6 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600">Guardar</button>
                </div>
            </form>
        </div>
    );
};

const PartnerList = ({ partners, type }) => {
    const renderHeaders = () => {
         switch (type) {
            case 'Fornecedor': return <tr><th className="p-2 text-left">Nome</th><th className="p-2 text-left">Equipamento</th><th className="p-2 text-left">Contacto</th><th className="p-2 text-left">Email</th></tr>;
            case 'Financeira': return <tr><th className="p-2 text-left">Nome</th><th className="p-2 text-left">Nome Comercial</th><th className="p-2 text-left">Contacto</th><th className="p-2 text-left">Email Comercial</th><th className="p-2 text-left">Email Comissões</th></tr>;
            case 'Seguradora': return <tr><th className="p-2 text-left">Nome</th><th className="p-2 text-left">Nome Comercial</th><th className="p-2 text-left">Contacto</th><th className="p-2 text-left">Email Comercial</th></tr>;
            default: return null;
         }
    };
    const renderRow = (p) => {
        switch (type) {
            case 'Fornecedor': return <tr key={p.id}><td className="p-2">{p.nome}</td><td className="p-2">{p.equipamento}</td><td className="p-2">{p.pessoaContacto}</td><td className="p-2">{p.email}</td></tr>;
            case 'Financeira': return <tr key={p.id}><td className="p-2">{p.nome}</td><td className="p-2">{p.nomeComercial}</td><td className="p-2">{p.contactoComercial}</td><td className="p-2">{p.emailComercial}</td><td className="p-2">{p.emailComissoes}</td></tr>;
            case 'Seguradora': return <tr key={p.id}><td className="p-2">{p.nome}</td><td className="p-2">{p.nomeComercial}</td><td className="p-2">{p.contactoComercial}</td><td className="p-2">{p.emailComercial}</td></tr>;
            default: return null;
        }
    };
    return (
        <div>
            <h3 className="font-semibold mb-4">Lista de {type}s</h3>
            <div className="overflow-x-auto rounded-lg shadow-sm border">
                <table className="min-w-full bg-white text-sm">
                    <thead className="bg-gray-100">{renderHeaders()}</thead>
                    <tbody className="divide-y">{partners.map(p => renderRow(p))}</tbody>
                </table>
            </div>
        </div>
    );
};


// MÓDULO DE TAREFAS
const Tarefas = () => {
    const { db, appId, userId } = useContext(AppContext);
    const [tarefas, setTarefas] = useState([]);
    const [clientes, setClientes] = useState([]);
    const [contratos, setContratos] = useState([]);
    const [comerciais, setComerciais] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [currentTask, setCurrentTask] = useState(null);

    useEffect(() => {
        if (!db || !userId) return;
        setLoading(true);
        const unsub = (ref, setter, name) => onSnapshot(ref, snap => setter(snap.docs.map(d => ({ id: d.id, ...d.data() }))), e => console.error(`Erro ao carregar ${name}:`, e));
        
        const unsubTarefas = unsub(collection(db, `artifacts/${appId}/users/${userId}/tarefas`), setTarefas, 'tarefas');
        const unsubClientes = unsub(collection(db, `artifacts/${appId}/users/${userId}/clientes`), setClientes, 'clientes');
        const unsubContratos = unsub(collection(db, `artifacts/${appId}/users/${userId}/contratos`), setContratos, 'contratos');
        const unsubComerciais = onSnapshot(collection(db, `artifacts/${appId}/public/data/utilizadores`), snap => {
            setComerciais(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            setLoading(false);
        }, e => { console.error('Erro ao carregar comerciais:', e); setLoading(false); });

        return () => { unsubTarefas(); unsubClientes(); unsubContratos(); unsubComerciais(); };
    }, [db, userId, appId]);

    const handleSaveTask = async (taskData) => {
        const collRef = collection(db, `artifacts/${appId}/users/${userId}/tarefas`);
        const { id, ...data } = taskData;
        try {
            if (id) {
                await setDoc(doc(collRef, id), data, { merge: true });
            } else {
                await addDoc(collRef, data);
                if (data.clienteId) {
                    await addInteraction(db, appId, userId, `clientes/${data.clienteId}/interacoes`, {
                        tipo: 'Tarefa Criada',
                        descricao: `Nova tarefa: "${data.titulo}" atribuída a ${data.responsavel}.`,
                    });
                }
            }
        } catch(e) { console.error("Erro ao guardar tarefa:", e); }
        setShowModal(false);
        setCurrentTask(null);
    };

    const handleCompleteTask = async (task) => {
        const taskRef = doc(db, `artifacts/${appId}/users/${userId}/tarefas`, task.id);
        try {
            await updateDoc(taskRef, { estado: 'Concluído' });
            if (task.clienteId) {
                await addInteraction(db, appId, userId, `clientes/${task.clienteId}/interacoes`, {
                    tipo: 'Tarefa Concluída',
                    descricao: `A tarefa "${task.titulo}" foi concluída.`,
                });
            }
        } catch (e) {
            console.error("Erro ao concluir tarefa:", e);
        }
    };

    const handleDeleteTask = async (taskId) => {
        try {
            await deleteDoc(doc(db, `artifacts/${appId}/users/${userId}/tarefas`, taskId));
        } catch(e) { console.error("Erro ao eliminar tarefa:", e); }
    };

    const tasksByStatus = {
        Pendente: tarefas.filter(t => t.estado === 'Pendente'),
        'Em Andamento': tarefas.filter(t => t.estado === 'Em Andamento'),
        Concluído: tarefas.filter(t => t.estado === 'Concluído'),
    };

    return (
        <div className="p-6 bg-white rounded-lg shadow-md">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-700">Tarefas / Pendentes</h1>
                <button onClick={() => { setCurrentTask(null); setShowModal(true); }} className="px-6 py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700">Adicionar Nova Tarefa</button>
            </div>
            {loading ? <LoadingSpinner /> : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {Object.entries(tasksByStatus).map(([status, tasks]) => (
                        <div key={status} className="bg-gray-50 rounded-lg p-4">
                            <h3 className="font-bold text-lg mb-4">{status} ({tasks.length})</h3>
                            <div className="space-y-4">
                                {tasks.map(task => (
                                    <div key={task.id} className="bg-white p-4 rounded-md shadow-sm border">
                                        <p className="font-semibold">{task.titulo}</p>
                                        <p className="text-sm text-gray-600">{task.descricao}</p>
                                        <div className="text-xs text-gray-500 mt-2">
                                            <p>Prazo: {task.prazo}</p>
                                            <p>Prioridade: {task.prioridade}</p>
                                            <p>Responsável: {task.responsavel}</p>
                                        </div>
                                        <div className="flex justify-end gap-2 mt-2">
                                            {task.estado !== 'Concluído' && <button onClick={() => handleCompleteTask(task)} className="text-xs font-semibold text-green-600">CONCLUIR</button>}
                                            <button onClick={() => {setCurrentTask(task); setShowModal(true)}} className="text-xs font-semibold text-blue-600">EDITAR</button>
                                            <button onClick={() => handleDeleteTask(task.id)} className="text-xs font-semibold text-red-600">ELIMINAR</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
            {showModal && <TarefaFormModal task={currentTask} onSave={handleSaveTask} onClose={() => setShowModal(false)} clientes={clientes} contratos={contratos} comerciais={comerciais} />}
        </div>
    );
};

const TarefaFormModal = ({ task, onSave, onClose, clientes, contratos, comerciais }) => {
    const [form, setForm] = useState({
        titulo: task?.titulo || '',
        descricao: task?.descricao || '',
        prazo: task?.prazo || new Date().toISOString().split('T')[0],
        prioridade: task?.prioridade || 'Média',
        estado: task?.estado || 'Pendente',
        responsavel: task?.responsavel || '',
        clienteId: task?.clienteId || '',
        contratoId: task?.contratoId || '',
        id: task?.id || null
    });

    const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });
    const handleSubmit = (e) => { e.preventDefault(); onSave(form); };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-50 p-4">
            <div className="bg-white rounded-lg p-8 shadow-xl max-w-2xl w-full">
                <h2 className="text-2xl font-bold mb-6">{task ? 'Editar Tarefa' : 'Nova Tarefa'}</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <input type="text" name="titulo" placeholder="Título da tarefa" value={form.titulo} onChange={handleChange} required className="w-full p-2 border rounded-lg" />
                    <textarea name="descricao" placeholder="Descrição" value={form.descricao} onChange={handleChange} className="w-full p-2 border rounded-lg" rows="3"></textarea>
                    <div className="grid grid-cols-2 gap-4">
                        <select name="responsavel" value={form.responsavel} onChange={handleChange} className="w-full p-2 border rounded-lg"><option value="">Responsável</option>{comerciais.map(c=><option key={c.id} value={c.nome}>{c.nome}</option>)}</select>
                        <input type="date" name="prazo" value={form.prazo} onChange={handleChange} required className="w-full p-2 border rounded-lg" />
                        <select name="prioridade" value={form.prioridade} onChange={handleChange} className="w-full p-2 border rounded-lg"><option>Baixa</option><option>Média</option><option>Alta</option></select>
                        <select name="estado" value={form.estado} onChange={handleChange} className="w-full p-2 border rounded-lg"><option>Pendente</option><option>Em Andamento</option><option>Concluído</option></select>
                    </div>
                     <div className="grid grid-cols-2 gap-4">
                        <select name="clienteId" value={form.clienteId} onChange={handleChange} className="w-full p-2 border rounded-lg"><option value="">Associar a Cliente (Opcional)</option>{clientes.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}</select>
                        <select name="contratoId" value={form.contratoId} onChange={handleChange} className="w-full p-2 border rounded-lg"><option value="">Associar a Contrato (Opcional)</option>{contratos.map(c=><option key={c.id} value={c.id}>{c.clienteNome} - {c.tipoServico}</option>)}</select>
                    </div>
                    <div className="flex justify-end gap-2 pt-4">
                        <button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg">Cancelar</button>
                        <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg">Guardar</button>
                    </div>
                </form>
            </div>
        </div>
    );
};


// MÓDULO DE RELATÓRIOS
const Relatorios = () => {
    const { db, appId, userId } = useContext(AppContext);
    const [contratos, setContratos] = useState([]);
    const [comerciais, setComerciais] = useState([]);
    const [parceiros, setParceiros] = useState([]);
    const [filteredResults, setFilteredResults] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
        startDate: '',
        endDate: '',
        comercial: 'Todos',
        tipoServico: 'Todos',
        estado: 'Todos',
        fornecedor: 'Todos',
        financeira: 'Todos',
    });

    useEffect(() => {
        if (!db || !userId) return;
        setLoading(true);
        const unsubContratos = onSnapshot(collection(db, `artifacts/${appId}/users/${userId}/contratos`), 
            snap => setContratos(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
        
        const unsubComerciais = onSnapshot(collection(db, `artifacts/${appId}/public/data/utilizadores`), 
            snap => setComerciais(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

        const unsubParceiros = onSnapshot(collection(db, `artifacts/${appId}/public/data/parceiros`), 
            snap => {
                setParceiros(snap.docs.map(d => ({ id: d.id, ...d.data() })));
                setLoading(false);
            });

        return () => { unsubContratos(); unsubComerciais(); unsubParceiros(); };
    }, [db, userId, appId]);

    useEffect(() => {
        let results = [...contratos];
        if (filters.startDate) results = results.filter(c => c.dataContrato && new Date(c.dataContrato) >= new Date(filters.startDate));
        if (filters.endDate) results = results.filter(c => c.dataContrato && new Date(c.dataContrato) <= new Date(filters.endDate));
        if (filters.comercial !== 'Todos') results = results.filter(c => c.comercial === filters.comercial);
        if (filters.tipoServico !== 'Todos') results = results.filter(c => c.tipoServico === filters.tipoServico);
        if (filters.estado !== 'Todos') results = results.filter(c => c.estado === filters.estado);
        if (filters.fornecedor !== 'Todos') results = results.filter(c => c.fornecedor === filters.fornecedor);
        if (filters.financeira !== 'Todos') results = results.filter(c => c.financeira === filters.financeira);
        setFilteredResults(results);
    }, [filters, contratos]);

    const handleFilterChange = (e) => {
        setFilters({ ...filters, [e.target.name]: e.target.value });
    };

    const generatePdf = () => {
        if (!window.jspdf || !window.jspdf.jsPDF || !window.jspdf.jsPDF.autoTable) {
            console.error("A biblioteca jsPDF ou jsPDF-Autotable não está carregada.");
            alert("Erro ao gerar PDF. A biblioteca não foi carregada corretamente.");
            return;
        }
        
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const selectedFornecedor = parceiros.find(p => p.nome === filters.fornecedor);

        doc.setFontSize(10);
        doc.setFontSize(16);
        doc.text("Relatório de Prestação de Serviços", doc.internal.pageSize.getWidth() / 2, 35, { align: 'center' });
        doc.setFontSize(10);

        if(selectedFornecedor) {
            doc.text(`ENDEREÇADO A:`, 14, 50);
            doc.text(selectedFornecedor.nome.toUpperCase(), 14, 55);
            doc.text(selectedFornecedor.morada || '', 14, 60);
            doc.text(`${selectedFornecedor.codigoPostal || ''} ${selectedFornecedor.localidade || ''}`, 14, 65);
            doc.text(`NIF: ${selectedFornecedor.nif || ''}`, 14, 70);
        }
        doc.text(`DATA: ${new Date().toLocaleDateString('pt-PT')}`, 195, 55, { align: 'right' });

        const subtotal = filteredResults.reduce((sum, c) => sum + ((parseFloat(c.valorFinanciado) || 0) * (parseFloat(c.comissaoPercentagem) || 0) / 100), 0);
        const iva = subtotal * 0.23;
        const total = subtotal + iva;

        doc.autoTable({
            head: [['DESCRIÇÃO', 'TOTAL']],
            body: [['Prestação de serviços', subtotal.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })]],
            startY: 80,
            theme: 'striped',
            headStyles: { fillColor: [220, 220, 220], textColor: [0, 0, 0] },
        });

        let finalY = doc.lastAutoTable.finalY + 10;
        doc.setFontSize(10);
        doc.text('SUBTOTAL', 14, finalY);
        doc.text(subtotal.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' }), 195, finalY, { align: 'right' });
        
        finalY += 7;
        doc.text('Taxa 23%', 14, finalY);
        doc.text(iva.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' }), 195, finalY, { align: 'right' });

        finalY += 7;
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text('TOTAL', 14, finalY);
        doc.text(total.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' }), 195, finalY, { align: 'right' });
        doc.setFont(undefined, 'normal');

        finalY += 15;
        doc.setFontSize(10);
        doc.text('Caro parceiro,', 14, finalY);
        doc.text('Estamos ao dispor para qualquer esclarecimento necessário.', 14, finalY + 5);
        
        const pageHeight = doc.internal.pageSize.getHeight();
        doc.text('OBRIGADA', 195, pageHeight - 40, { align: 'right' });
        doc.text('CEO | THE WAY', 195, pageHeight - 30, { align: 'right' });
        doc.line(14, pageHeight - 20, 196, pageHeight - 20);
        doc.setFontSize(8);
        doc.text('ANDREIA PATRICIA DA SILVA COSTA | NIF 243562912 | THE WAY | AV. ZEFERINO DE OLIVEIRA Nº 493 1 FRT SALA 2 , 4560-061 CROCA', doc.internal.pageSize.getWidth() / 2, pageHeight - 15, { align: 'center' });


        doc.save(`relatorio_${filters.fornecedor || 'geral'}.pdf`);
    };

    const fornecedores = parceiros.filter(p => p.tipo === 'Fornecedor');
    const financeiras = parceiros.filter(p => p.tipo === 'Financeira');

    return (
        <div className="p-6 bg-white rounded-lg shadow-md space-y-6">
            <h1 className="text-3xl font-bold text-gray-700">Relatórios</h1>
            <div className="p-4 border rounded-lg bg-gray-50 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div><label className="text-sm font-medium">Data de Início</label><input type="date" name="startDate" value={filters.startDate} onChange={handleFilterChange} className="w-full p-2 border rounded-lg" /></div>
                <div><label className="text-sm font-medium">Data de Fim</label><input type="date" name="endDate" value={filters.endDate} onChange={handleFilterChange} className="w-full p-2 border rounded-lg" /></div>
                <div><label className="text-sm font-medium">Comercial</label><select name="comercial" value={filters.comercial} onChange={handleFilterChange} className="w-full p-2 border rounded-lg"><option>Todos</option>{comerciais.map(c=><option key={c.id}>{c.nome}</option>)}</select></div>
                <div><label className="text-sm font-medium">Tipo de Serviço</label><select name="tipoServico" value={filters.tipoServico} onChange={handleFilterChange} className="w-full p-2 border rounded-lg"><option>Todos</option><option>Crédito</option><option>Seguro</option></select></div>
                <div><label className="text-sm font-medium">Estado</label><select name="estado" value={filters.estado} onChange={handleFilterChange} className="w-full p-2 border rounded-lg"><option>Todos</option><option>Pendente</option><option>Ativo</option><option>Concluído</option></select></div>
                <div><label className="text-sm font-medium">Fornecedor</label><select name="fornecedor" value={filters.fornecedor} onChange={handleFilterChange} className="w-full p-2 border rounded-lg"><option>Todos</option>{fornecedores.map(f=><option key={f.id} value={f.nome}>{f.nome}</option>)}</select></div>
                <div><label className="text-sm font-medium">Financeira</label><select name="financeira" value={filters.financeira} onChange={handleFilterChange} className="w-full p-2 border rounded-lg"><option>Todos</option>{financeiras.map(f=><option key={f.id} value={f.nome}>{f.nome}</option>)}</select></div>
            </div>

            <div className="flex gap-4">
                <button onClick={generatePdf} className="px-6 py-2 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700">Gerar PDF</button>
            </div>
            {loading ? <LoadingSpinner /> : (
                <div className="overflow-x-auto rounded-lg shadow-sm border">
                    <table className="min-w-full bg-white text-sm"><thead className="bg-gray-100"><tr><th className="p-3 text-left">Cliente</th><th className="p-3 text-left">Tipo Serviço</th><th className="p-3 text-left">Comercial</th><th className="p-3 text-left">Data</th><th className="p-3 text-left">Estado</th><th className="p-3 text-right">Valor (€)</th></tr></thead>
                    <tbody className="divide-y">{filteredResults.map(c => (<tr key={c.id}><td className="p-3">{c.clienteNome}</td><td className="p-3">{c.tipoServico}</td><td className="p-3">{c.comercial}</td><td className="p-3">{c.dataContrato}</td><td className="p-3">{c.estado}</td><td className="p-3 text-right">{(parseFloat(c.valorFinanciado) || parseFloat(c.valor) || 0).toLocaleString('pt-PT')}</td></tr>))}</tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

const SummaryTable = ({ title, data }) => (
    <div className="border p-4 rounded-lg bg-white shadow-sm">
        <h3 className="font-bold mb-2 text-gray-700">{title}</h3>
        <div className="max-h-48 overflow-y-auto">
            <table className="w-full text-sm">
                <tbody>
                    {Object.entries(data).map(([key, value]) => (
                        <tr key={key} className="border-b"><td className="py-1">{key}</td><td className="py-1 text-right font-semibold">{value.toLocaleString('pt-PT', {style: 'currency', currency: 'EUR'})}</td></tr>
                    ))}
                </tbody>
            </table>
        </div>
    </div>
);

// MÓDULO DE GESTÃO FINANCEIRA (NOVO)
const Gestao = () => {
    const [activeTab, setActiveTab] = useState('Resumo');
    
    const renderContent = () => {
        switch (activeTab) {
            case 'Resumo':
                return <ResumoFinanceiroTab />;
            case 'Despesas':
                return <DespesasTab />;
            case 'Comissões':
                return <ComissoesTab />;
            case 'Contas Bancárias':
                 return <ContasBancariasTab />;
            default:
                return null;
        }
    };

    return (
        <div className="p-6 bg-white rounded-lg shadow-md">
            <h1 className="text-3xl font-bold text-gray-700 mb-6">Gestão Financeira</h1>
            <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                    <button onClick={() => setActiveTab('Resumo')} className={`${activeTab === 'Resumo' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}>Resumo</button>
                    <button onClick={() => setActiveTab('Despesas')} className={`${activeTab === 'Despesas' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}>Despesas</button>
                    <button onClick={() => setActiveTab('Comissões')} className={`${activeTab === 'Comissões' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}>Comissões</button>
                    <button onClick={() => setActiveTab('Contas Bancárias')} className={`${activeTab === 'Contas Bancárias' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}>Bancos</button>
                </nav>
            </div>
            <div className="pt-6">
                {renderContent()}
            </div>
        </div>
    );
};

const ResumoFinanceiroTab = () => {
    const { db, appId, userId } = useContext(AppContext);
    const [contratos, setContratos] = useState([]);
    const [despesas, setDespesas] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!db || !userId) return;
        const unsubCtt = onSnapshot(collection(db, `artifacts/${appId}/users/${userId}/contratos`), snap => setContratos(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
        const unsubDesp = onSnapshot(collection(db, `artifacts/${appId}/users/${userId}/despesas`), snap => {
            setDespesas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            setLoading(false);
        });
        return () => { unsubCtt(); unsubDesp(); };
    }, [db, userId, appId]);

    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    const comissoesReceberMes = contratos.filter(c => c.dataContrato && new Date(c.dataContrato).getMonth() === currentMonth && new Date(c.dataContrato).getFullYear() === currentYear).reduce((sum, c) => sum + parseFloat(c.comissaoRecebida || 0), 0);
    const comissoesPagarMes = contratos.filter(c => c.dataContrato && new Date(c.dataContrato).getMonth() === currentMonth && new Date(c.dataContrato).getFullYear() === currentYear).reduce((sum, c) => sum + (parseFloat(c.valorFinanciado || 0) * parseFloat(c.comissaoPercentagem || 0) / 100), 0);
    const despesasMes = despesas.filter(d => d.data && new Date(d.data).getMonth() === currentMonth && new Date(d.data).getFullYear() === currentYear).reduce((sum, d) => sum + parseFloat(d.valor || 0), 0);

    const comissoesReceberIVA = comissoesReceberMes * 1.23;
    const comissoesPagarIVA = comissoesPagarMes * 1.23;

    const gerarRelatorioComissoes = () => {
        // Lógica para gerar PDF
        alert("Gerar relatório de comissões por financeira (em desenvolvimento).");
    };

    if (loading) return <LoadingSpinner />;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-700">Resumo Mensal ({new Date().toLocaleString('pt-PT', { month: 'long' })})</h2>
                <button onClick={gerarRelatorioComissoes} className="px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700">Gerar Relatório de Comissões</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard icon="📥" title="Comissões a Receber (c/ IVA)" value={comissoesReceberIVA.toLocaleString('pt-PT', {style: 'currency', currency: 'EUR'})} subtitle="Total do mês" color="text-green-600" />
                <StatCard icon="📤" title="Comissões a Pagar (c/ IVA)" value={comissoesPagarIVA.toLocaleString('pt-PT', {style: 'currency', currency: 'EUR'})} subtitle="Total do mês" color="text-red-600" />
                <StatCard icon="💸" title="Despesas" value={despesasMes.toLocaleString('pt-PT', {style: 'currency', currency: 'EUR'})} subtitle="Total do mês" color="text-orange-600" />
            </div>
        </div>
    );
};

const DespesasTab = () => {
    const { db, appId, userId } = useContext(AppContext);
    const [despesas, setDespesas] = useState([]);
    const [contas, setContas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState({ descricao: '', categoria: '', valor: '', data: new Date().toISOString().split('T')[0], contaId: '' });

    useEffect(() => {
        if (!db || !userId) return;
        const unsubDesp = onSnapshot(collection(db, `artifacts/${appId}/users/${userId}/despesas`), snap => {
            setDespesas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            setLoading(false);
        });
        const unsubContas = onSnapshot(collection(db, `artifacts/${appId}/users/${userId}/contasBancarias`), snap => setContas(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
        return () => { unsubDesp(); unsubContas(); };
    }, [db, userId, appId]);

    const handleSave = async (e) => {
        e.preventDefault();
        if (!form.descricao || !form.valor || !form.contaId) {
            alert("Por favor, preencha todos os campos, incluindo a conta bancária.");
            return;
        }
        
        const batch = writeBatch(db);
        const despesaRef = doc(collection(db, `artifacts/${appId}/users/${userId}/despesas`));
        batch.set(despesaRef, { ...form, valor: parseFloat(form.valor) });

        const contaRef = doc(db, `artifacts/${appId}/users/${userId}/contasBancarias`, form.contaId);
        const contaSelecionada = contas.find(c => c.id === form.contaId);
        const novoSaldo = parseFloat(contaSelecionada.saldo) - parseFloat(form.valor);
        batch.update(contaRef, { saldo: novoSaldo });

        await batch.commit();
        setForm({ descricao: '', categoria: '', valor: '', data: new Date().toISOString().split('T')[0], contaId: '' });
    };

    return (
        <div className="space-y-6">
            <form onSubmit={handleSave} className="p-4 border rounded-lg bg-gray-50 grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                <div className="md:col-span-2"><label className="text-sm">Descrição</label><input type="text" value={form.descricao} onChange={e => setForm({...form, descricao: e.target.value})} className="w-full p-2 border rounded-md" required /></div>
                <div><label className="text-sm">Categoria</label><input type="text" value={form.categoria} onChange={e => setForm({...form, categoria: e.target.value})} className="w-full p-2 border rounded-md" /></div>
                <div><label className="text-sm">Valor (€)</label><input type="number" step="0.01" value={form.valor} onChange={e => setForm({...form, valor: e.target.value})} className="w-full p-2 border rounded-md" required /></div>
                <div><label className="text-sm">Conta</label><select value={form.contaId} onChange={e => setForm({...form, contaId: e.target.value})} className="w-full p-2 border rounded-md" required><option value="">Selecione...</option>{contas.map(c => <option key={c.id} value={c.id}>{c.nomeBanco}</option>)}</select></div>
                <button type="submit" className="px-6 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 h-10">Adicionar Despesa</button>
            </form>
            {loading ? <LoadingSpinner/> : <div className="overflow-x-auto rounded-lg shadow-sm border"><table className="min-w-full bg-white text-sm"><thead className="bg-gray-100"><tr><th className="p-3 text-left">Data</th><th className="p-3 text-left">Descrição</th><th className="p-3 text-left">Categoria</th><th className="p-3 text-right">Valor</th></tr></thead><tbody className="divide-y">{despesas.map(d => <tr key={d.id}><td className="p-3">{d.data}</td><td className="p-3">{d.descricao}</td><td className="p-3">{d.categoria}</td><td className="p-3 text-right">{d.valor.toLocaleString('pt-PT', {style: 'currency', currency: 'EUR'})}</td></tr>)}</tbody></table></div>}
        </div>
    );
};

const ComissoesTab = () => {
    // Este componente pode ser um dashboard para comissões, ou pode ser removido se o resumo for suficiente.
    return <div className="text-center py-10"><h2 className="text-xl text-gray-600">Gestão de Comissões</h2><p className="text-gray-500 mt-2">Aqui poderá ver um resumo detalhado das comissões a pagar e a receber.</p></div>;
};

const ContasBancariasTab = () => {
    const { db, appId, userId } = useContext(AppContext);
    const [contas, setContas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState({ nomeBanco: '', iban: '', saldo: '' });

    useEffect(() => {
        if (!db || !userId) return;
        const unsub = onSnapshot(collection(db, `artifacts/${appId}/users/${userId}/contasBancarias`), snap => {
            setContas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            setLoading(false);
        });
        return () => unsub();
    }, [db, userId, appId]);

    const handleSave = async (e) => {
        e.preventDefault();
        if (!form.nomeBanco || !form.saldo) return;
        const collRef = collection(db, `artifacts/${appId}/users/${userId}/contasBancarias`);
        await addDoc(collRef, { ...form, saldo: parseFloat(form.saldo) });
        setForm({ nomeBanco: '', iban: '', saldo: '' });
    };

    const saldoTotal = contas.reduce((sum, c) => sum + parseFloat(c.saldo), 0);

    return (
        <div className="space-y-6">
            <div className="p-4 bg-indigo-100 text-indigo-800 rounded-lg"><div className="font-bold text-lg">Saldo Total Consolidado</div><div className="text-2xl">{saldoTotal.toLocaleString('pt-PT', {style: 'currency', currency: 'EUR'})}</div></div>
            <form onSubmit={handleSave} className="p-4 border rounded-lg bg-gray-50 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div><label className="text-sm">Nome do Banco</label><input type="text" value={form.nomeBanco} onChange={e => setForm({...form, nomeBanco: e.target.value})} className="w-full p-2 border rounded-md" required /></div>
                <div className="md:col-span-2"><label className="text-sm">IBAN</label><input type="text" value={form.iban} onChange={e => setForm({...form, iban: e.target.value})} className="w-full p-2 border rounded-md" /></div>
                <div><label className="text-sm">Saldo (€)</label><input type="number" step="0.01" value={form.saldo} onChange={e => setForm({...form, saldo: e.target.value})} className="w-full p-2 border rounded-md" required /></div>
                <button type="submit" className="px-6 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 h-10 md:col-start-4">Adicionar Conta</button>
            </form>
            {loading ? <LoadingSpinner/> : <div className="overflow-x-auto rounded-lg shadow-sm border"><table className="min-w-full bg-white text-sm"><thead className="bg-gray-100"><tr><th className="p-3 text-left">Banco</th><th className="p-3 text-left">IBAN</th><th className="p-3 text-right">Saldo</th></tr></thead><tbody className="divide-y">{contas.map(c => <tr key={c.id}><td className="p-3">{c.nomeBanco}</td><td className="p-3">{c.iban}</td><td className="p-3 text-right">{c.saldo.toLocaleString('pt-PT', {style: 'currency', currency: 'EUR'})}</td></tr>)}</tbody></table></div>}
        </div>
    );
};


// MÓDULO DE CONFIGURAÇÕES
const Configuracoes = () => {
    const { db, appId } = useContext(AppContext);
    const [comerciais, setComerciais] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [currentComercial, setCurrentComercial] = useState(null);

    useEffect(() => {
        if (!db || !appId) return;
        setLoading(true);
        const unsub = onSnapshot(collection(db, `artifacts/${appId}/public/data/utilizadores`), (snap) => {
            setComerciais(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            setLoading(false);
        }, e => { console.error("Erro ao carregar comerciais:", e); setLoading(false); });
        return () => unsub();
    }, [db, appId]);

    const handleSave = async (data) => {
        const collRef = collection(db, `artifacts/${appId}/public/data/utilizadores`);
        const { id, ...comercialData } = data;
        const nomeCompleto = `${comercialData.primeiroNome} ${comercialData.ultimoNome}`;
        const dataToSave = { ...comercialData, nome: nomeCompleto };

        try {
            if (id) {
                await setDoc(doc(collRef, id), dataToSave, { merge: true });
            } else {
                await addDoc(collRef, { ...dataToSave, estado: 'Ativo' });
            }
        } catch(e) { console.error("Erro ao guardar comercial:", e); }
        setShowModal(false);
        setCurrentComercial(null);
    };

    const toggleStatus = async (comercial) => {
        const docRef = doc(db, `artifacts/${appId}/public/data/utilizadores`, comercial.id);
        try {
            await updateDoc(docRef, {
                estado: comercial.estado === 'Ativo' ? 'Inativo' : 'Ativo'
            });
        } catch(e) { console.error("Erro ao alterar estado do comercial:", e); }
    };

    return (
        <div className="p-6 bg-white rounded-lg shadow-md">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-700">Gestão de Equipa</h1>
                <button onClick={() => { setCurrentComercial(null); setShowModal(true); }} className="px-6 py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700">Adicionar Comercial</button>
            </div>
            {loading ? <LoadingSpinner /> : (
                <div className="overflow-x-auto rounded-lg shadow-sm border">
                    <table className="min-w-full bg-white text-sm">
                        <thead className="bg-gray-100">
                            <tr>
                                <th className="p-3 text-left">Nome</th>
                                <th className="p-3 text-left">Email</th>
                                <th className="p-3 text-left">Telefone</th>
                                <th className="p-3 text-left">IBAN</th>
                                <th className="p-3 text-center">Estado</th>
                                <th className="p-3 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {comerciais.map(c => (
                                <tr key={c.id}>
                                    <td className="p-3">{c.nome}</td>
                                    <td className="p-3">{c.email}</td>
                                    <td className="p-3">{c.telefone}</td>
                                    <td className="p-3 font-mono">{c.iban}</td>
                                    <td className="p-3 text-center">
                                        <span className={`px-2 py-1 text-xs rounded-full ${c.estado === 'Ativo' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                            {c.estado}
                                        </span>
                                    </td>
                                    <td className="p-3 text-right">
                                        <button onClick={() => toggleStatus(c)} className="text-xs font-semibold text-gray-600 mr-3">{c.estado === 'Ativo' ? 'Desativar' : 'Ativar'}</button>
                                        <button onClick={() => { setCurrentComercial(c); setShowModal(true); }} className="text-xs font-semibold text-blue-600">EDITAR</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            {showModal && <ComercialFormModal comercial={currentComercial} onSave={handleSave} onClose={() => setShowModal(false)} />}
        </div>
    );
};

const ComercialFormModal = ({ comercial, onSave, onClose }) => {
    const [form, setForm] = useState({
        primeiroNome: comercial?.primeiroNome || '',
        ultimoNome: comercial?.ultimoNome || '',
        email: comercial?.email || '',
        telefone: comercial?.telefone || '',
        nif: comercial?.nif || '',
        iban: comercial?.iban || '',
        dataInicio: comercial?.dataInicio || '',
        estado: comercial?.estado || 'Ativo',
        id: comercial?.id || null,
    });

    const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });
    const handleSubmit = (e) => { e.preventDefault(); onSave(form); };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-50 p-4">
            <div className="bg-white rounded-lg p-8 shadow-xl max-w-2xl w-full">
                <h2 className="text-2xl font-bold mb-6">{comercial ? 'Editar Comercial' : 'Novo Comercial'}</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <input type="text" name="primeiroNome" placeholder="Primeiro Nome" value={form.primeiroNome} onChange={handleChange} required className="w-full p-2 border rounded-lg" />
                        <input type="text" name="ultimoNome" placeholder="Último Nome" value={form.ultimoNome} onChange={handleChange} required className="w-full p-2 border rounded-lg" />
                    </div>
                    <input type="email" name="email" placeholder="Email" value={form.email} onChange={handleChange} required className="w-full p-2 border rounded-lg" />
                    <div className="grid grid-cols-2 gap-4">
                         <input type="tel" name="telefone" placeholder="Telefone" value={form.telefone} onChange={handleChange} className="w-full p-2 border rounded-lg" />
                         <input type="text" name="nif" placeholder="NIF" value={form.nif} onChange={handleChange} className="w-full p-2 border rounded-lg" />
                    </div>
                    <input type="text" name="iban" placeholder="IBAN" value={form.iban} onChange={handleChange} className="w-full p-2 border rounded-lg" />
                     <div className="grid grid-cols-2 gap-4">
                        <div><label className="text-sm">Data de Início</label><input type="date" name="dataInicio" value={form.dataInicio} onChange={handleChange} className="w-full p-2 border rounded-lg" /></div>
                        <div><label className="text-sm">Estado</label><select name="estado" value={form.estado} onChange={handleChange} className="w-full p-2 border rounded-lg"><option>Ativo</option><option>Inativo</option></select></div>
                    </div>
                    <div className="flex justify-end gap-2 pt-4">
                        <button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg">Cancelar</button>
                        <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg">Guardar</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default App;