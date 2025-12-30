import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  Server, 
  Send, 
  Users, 
  Layers, 
  Database, 
  Activity, 
  Terminal, 
  Info, 
  Play, 
  Square,
  RefreshCw,
  Plus,
  Trash2,
  Cpu
} from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";

// --- Types ---
type Message = {
  id: string;
  topic: string;
  partition: number;
  offset: number;
  key: string;
  payload: any;
  timestamp: number;
};

type Topic = {
  name: string;
  partitions: number;
  replicationFactor: number;
};

type Broker = {
  id: number;
  isAlive: boolean;
};

type ConsumerGroup = {
  id: string;
  members: string[]; // List of consumer IDs
};

// --- Constants ---
const DEFAULT_TOPIC = "orders-stream";
const INITIAL_PARTITIONS = 3;
const MAX_MESSAGES_PER_PARTITION = 10;

// --- App Component ---
const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [brokers] = useState<Broker[]>([
    { id: 1, isAlive: true },
    { id: 2, isAlive: true },
    { id: 3, isAlive: true }
  ]);
  const [topic, setTopic] = useState<Topic>({
    name: DEFAULT_TOPIC,
    partitions: INITIAL_PARTITIONS,
    replicationFactor: 3
  });
  const [consumerGroups, setConsumerGroups] = useState<ConsumerGroup[]>([
    { id: 'analytics-group', members: ['consumer-1', 'consumer-2'] }
  ]);
  const [logs, setLogs] = useState<string[]>(["[System] Kafka Cluster Initialized..."]);
  const [isProducing, setIsProducing] = useState(false);
  const [explaining, setExplaining] = useState<string | null>(null);
  
  const ai = useMemo(() => new GoogleGenAI({ apiKey: process.env.API_KEY || '' }), []);

  // --- Helpers ---
  const addLog = (msg: string) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 50));
  };

  const getPartitionForMsg = (key: string, numPartitions: number) => {
    // Simple hash for simulation
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      hash = (hash << 5) - hash + key.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash) % numPartitions;
  };

  const produceMessage = async (manualKey?: string, manualPayload?: any) => {
    let key = manualKey || `user_${Math.floor(Math.random() * 100)}`;
    let payload = manualPayload;

    if (!payload && isProducing) {
      // Use AI for dynamic data if producing automatically
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: `Generate a single realistic JSON object for a Kafka message in a topic named '${topic.name}'. Keep it short. Key: ${key}`,
          config: { responseMimeType: "application/json" }
        });
        payload = JSON.parse(response.text || '{}');
      } catch (e) {
        payload = { status: "OK", value: Math.random() * 100 };
      }
    } else if (!payload) {
       payload = { event: "purchase", amount: Math.floor(Math.random() * 500) };
    }

    const partition = getPartitionForMsg(key, topic.partitions);
    const partitionMessages = messages.filter(m => m.partition === partition);
    const offset = partitionMessages.length;

    const newMessage: Message = {
      id: Math.random().toString(36).substring(7),
      topic: topic.name,
      partition,
      offset,
      key,
      payload,
      timestamp: Date.now()
    };

    setMessages(prev => {
      const filtered = prev.filter(m => !(m.partition === partition && m.offset <= offset - MAX_MESSAGES_PER_PARTITION));
      return [...filtered, newMessage];
    });

    addLog(`Produced message to partition ${partition} (offset: ${offset}) with key: ${key}`);
  };

  // --- AI Explainer ---
  const explainConcept = async (concept: string) => {
    setExplaining(concept);
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Explain the Kafka concept of "${concept}" to a senior manager. Use a real-world analogy. Keep it under 100 words. Topic: ${topic.name}, Partitions: ${topic.partitions}.`,
      });
      alert(`Kafka Explainer: ${concept}\n\n${response.text}`);
    } catch (e) {
      console.error(e);
    } finally {
      setExplaining(null);
    }
  };

  // --- Effects ---
  useEffect(() => {
    let interval: any;
    if (isProducing) {
      interval = setInterval(() => produceMessage(), 3000);
    }
    return () => clearInterval(interval);
  }, [isProducing, topic.partitions]);

  // --- Render Sections ---
  
  return (
    <div className="min-h-screen p-6 flex flex-col gap-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <header className="flex justify-between items-center border-b border-slate-700 pb-4">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-500 p-2 rounded-lg animate-pulse-light">
            <Activity className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              KafkaPulse Simulation
            </h1>
            <p className="text-slate-400 text-sm">Real-time Distributed Streaming Visualization</p>
          </div>
        </div>
        
        <div className="flex gap-4 items-center">
          <div className="flex bg-slate-800 rounded-lg p-1">
            <button 
              onClick={() => setIsProducing(!isProducing)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all ${isProducing ? 'bg-red-500 text-white' : 'bg-emerald-600 hover:bg-emerald-500'}`}
            >
              {isProducing ? <Square size={18} /> : <Play size={18} />}
              {isProducing ? 'Stop Stream' : 'Auto-Produce'}
            </button>
          </div>
          <button 
            onClick={() => produceMessage()}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-md transition-colors"
          >
            <Send size={18} />
            Produce Single
          </button>
        </div>
      </header>

      <main className="grid grid-cols-12 gap-6 flex-grow">
        
        {/* Producers Panel */}
        <div className="col-span-12 lg:col-span-3 flex flex-col gap-4">
          <section className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 shadow-xl">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
              <Cpu className="w-4 h-4" /> Producers
            </h2>
            <div className="space-y-4">
              <div className="p-3 bg-slate-900 rounded-lg border border-slate-700">
                <div className="text-xs text-slate-500 mb-1">Target Topic</div>
                <div className="font-mono text-emerald-400">{topic.name}</div>
              </div>
              <div className="p-3 bg-slate-900 rounded-lg border border-slate-700">
                <div className="text-xs text-slate-500 mb-1">Partitioning Strategy</div>
                <div className="text-sm">Default (Murmur2 Hash)</div>
              </div>
              <div className="flex flex-col gap-2">
                 <button 
                    disabled={!!explaining}
                    onClick={() => explainConcept("Partitioning")}
                    className="text-xs flex items-center gap-1 text-cyan-400 hover:text-cyan-300 transition-colors"
                 >
                   <Info size={12} /> What is partitioning?
                 </button>
              </div>
            </div>
          </section>

          <section className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 shadow-xl flex-grow overflow-hidden flex flex-col">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
              <Terminal className="w-4 h-4" /> Live Log
            </h2>
            <div className="font-mono text-[11px] overflow-y-auto flex-grow space-y-1 pr-2">
              {logs.map((log, i) => (
                <div key={i} className={log.includes('Produced') ? 'text-emerald-400' : 'text-slate-500'}>
                  {log}
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Cluster / Broker Panel */}
        <div className="col-span-12 lg:col-span-6 flex flex-col gap-6">
          <div className="bg-slate-800/80 border-2 border-slate-700 rounded-2xl p-6 relative overflow-hidden flex-grow">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Server size={120} />
            </div>
            
            <h2 className="text-xl font-bold mb-6 flex items-center gap-3">
              <Database className="text-cyan-400" /> Kafka Cluster
              <span className="text-xs font-normal bg-slate-900 px-2 py-1 rounded text-slate-400 border border-slate-700">
                3 Brokers Active
              </span>
            </h2>

            <div className="grid grid-cols-1 gap-6 h-full content-start">
              <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-emerald-400" /> Topic: <span className="text-emerald-400 font-mono">{topic.name}</span>
                  </h3>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setTopic(t => ({...t, partitions: Math.min(t.partitions + 1, 6)}))}
                      className="p-1 hover:bg-slate-700 rounded text-slate-400"
                    >
                      <Plus size={16} />
                    </button>
                    <button 
                      onClick={() => setTopic(t => ({...t, partitions: Math.max(t.partitions - 1, 1)}))}
                      className="p-1 hover:bg-slate-700 rounded text-slate-400"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  {Array.from({ length: topic.partitions }).map((_, pIdx) => (
                    <div key={pIdx} className="bg-slate-800 border border-slate-600 rounded-lg p-3 min-h-[180px] flex flex-col">
                      <div className="text-[10px] font-bold text-slate-500 uppercase mb-2 flex justify-between">
                        <span>Partition {pIdx}</span>
                        <span className="text-cyan-500">Leader: Broker {(pIdx % 3) + 1}</span>
                      </div>
                      
                      <div className="flex-grow space-y-2 overflow-y-auto max-h-[140px] pr-1">
                        {messages.filter(m => m.partition === pIdx).sort((a,b) => b.offset - a.offset).map((msg) => (
                          <div 
                            key={msg.id} 
                            className="bg-slate-700/50 border-l-2 border-emerald-500 p-2 rounded text-[10px] animate-in slide-in-from-left duration-300"
                          >
                            <div className="flex justify-between text-slate-400 mb-1">
                              <span className="font-mono">Offset: {msg.offset}</span>
                              <span className="truncate max-w-[50px]">{msg.key}</span>
                            </div>
                            <pre className="text-slate-200 truncate">{JSON.stringify(msg.payload)}</pre>
                          </div>
                        ))}
                        {messages.filter(m => m.partition === pIdx).length === 0 && (
                          <div className="h-full flex items-center justify-center border-2 border-dashed border-slate-700 rounded text-slate-600 text-[10px]">
                            Waiting for data...
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 mt-auto pt-8 border-t border-slate-700/50">
                {brokers.map(b => (
                  <div key={b.id} className="flex flex-col items-center gap-2 group">
                    <div className="w-12 h-12 bg-slate-700 rounded-lg flex items-center justify-center border border-slate-600 group-hover:border-cyan-500 transition-colors">
                      <Server size={20} className="text-slate-400 group-hover:text-cyan-400" />
                    </div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase">Broker {b.id}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Consumers Panel */}
        <div className="col-span-12 lg:col-span-3 flex flex-col gap-4">
          <section className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 shadow-xl">
             <div className="flex justify-between items-center mb-4">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <Users className="w-4 h-4" /> Consumer Groups
                </h2>
                <button 
                  onClick={() => setConsumerGroups(prev => [...prev, { id: `group-${prev.length+1}`, members: ['new-consumer'] }])}
                  className="p-1 hover:bg-slate-700 rounded text-slate-400"
                >
                  <Plus size={14} />
                </button>
             </div>

             <div className="space-y-4">
                {consumerGroups.map(group => (
                  <div key={group.id} className="bg-slate-900 rounded-xl border border-slate-700 p-4">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-xs font-mono text-cyan-400">{group.id}</span>
                      <div className="flex gap-1">
                        <button 
                           onClick={() => {
                             const newMembers = [...group.members, `consumer-${group.members.length + 1}`];
                             setConsumerGroups(prev => prev.map(g => g.id === group.id ? { ...g, members: newMembers } : g));
                             addLog(`Rebalancing ${group.id}: New member added.`);
                           }}
                           className="text-[10px] bg-slate-800 px-2 py-1 rounded hover:bg-slate-700"
                        >
                          Scale
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {group.members.map((m, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-slate-800 p-2 rounded text-[10px] border border-slate-700">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500" />
                            <span>{m}</span>
                          </div>
                          <div className="text-slate-500">
                            Reading: {group.members.length === 1 ? 'All' : `P${idx % topic.partitions}`}
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    <button 
                      disabled={!!explaining}
                      onClick={() => explainConcept("Consumer Group Rebalancing")}
                      className="mt-3 text-[10px] flex items-center gap-1 text-slate-500 hover:text-slate-300"
                    >
                      <Info size={10} /> How does rebalancing work?
                    </button>
                  </div>
                ))}
             </div>
          </section>

          <section className="bg-emerald-900/20 border border-emerald-500/30 rounded-xl p-5 shadow-xl">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-emerald-400 mb-2">Cluster Health</h2>
            <div className="flex items-center justify-between mb-4">
               <span className="text-[10px] text-emerald-500/80 font-mono">Sync Status: In-Sync</span>
               <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse delay-75" />
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse delay-150" />
               </div>
            </div>
            <div className="text-[10px] text-slate-400 leading-relaxed">
              Using <strong>KRaft</strong> for metadata management (No Zookeeper dependency).
              Replication Factor: <span className="text-white">3</span>.
            </div>
            <button 
              disabled={!!explaining}
              onClick={() => explainConcept("Log Replication")}
              className="mt-4 w-full py-2 bg-emerald-500/10 border border-emerald-500/50 rounded-lg text-emerald-400 text-xs hover:bg-emerald-500/20 transition-all"
            >
              Simulate Node Failure
            </button>
          </section>
        </div>
      </main>

      {/* Concept Tooltips Footer */}
      <footer className="bg-slate-900 border border-slate-700 rounded-xl p-4 flex items-center gap-6 overflow-x-auto">
        <span className="text-xs font-bold text-slate-500 uppercase whitespace-nowrap">Core Concepts:</span>
        {[
          "Topic", "Partition", "Offset", "Consumer Group", "Broker", "ACKs", "Rebalancing", "Retention"
        ].map(concept => (
          <button
            key={concept}
            onClick={() => explainConcept(concept)}
            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-full text-xs text-slate-300 hover:text-white transition-all whitespace-nowrap"
          >
            {concept}
          </button>
        ))}
      </footer>

      {explaining && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8 max-w-lg w-full text-center space-y-4 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-cyan-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <RefreshCw className="text-cyan-400 animate-spin w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold">Consulting Gemini AI...</h3>
            <p className="text-slate-400 italic">"Asking the oracle to explain {explaining} like I'm five..."</p>
          </div>
        </div>
      )}
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
