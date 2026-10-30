import { Bell, TrendingUp, PiggyBank, AlertTriangle, ArrowRight, Package, CheckCircle2, Truck, Clock, Sparkles, User } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useState, useEffect } from 'react';
import { getOrders } from '../lib/services';

export default function DashboardScreen({ 
  onNavigate, 
  shopName = 'Abarrotes Don Lupe' 
}: { 
  onNavigate: (screen: string) => void; 
  shopName?: string;
}) {
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);

  useEffect(() => {
    async function fetchAISuggestion() {
      setLoadingAI(true);
      try {
        const orders = await getOrders();
        const response = await fetch('/api/ai-insight', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orders, shopName })
        });
        const data = await response.json();
        if (data.suggestion) {
          setAiSuggestion(data.suggestion);
        }
      } catch (error) {
        console.error("Error fetching AI suggestion:", error);
      } finally {
        setLoadingAI(false);
      }
    }

    fetchAISuggestion();
  }, [shopName]);

  return (
    <div className="flex flex-col min-h-screen bg-bg-main font-sans">
      <header className="flex items-center justify-between px-5 pt-8 pb-4 sticky top-0 z-20 bg-bg-main/90 backdrop-blur-md border-b border-border-subtle">
        <div className="flex flex-col">
          <span className="text-[10px] font-bold text-[var(--color-role-primary)] font-mono tracking-wider uppercase">
            Almacenes Ibarra • CEDIS Altamira
          </span>
          <h1 className="text-xl font-bold leading-tight text-text-main mt-0.5">{shopName} 👋</h1>
        </div>
        <div className="flex items-center gap-1">
          <button 
            onClick={() => onNavigate('profile')} 
            title="Mi Perfil y Cerrar Sesión"
            className="p-2 rounded-full hover:bg-surface-hover text-text-main transition-colors cursor-pointer"
          >
            <User className="w-5 h-5" />
          </button>
          <button className="relative p-2 rounded-full hover:bg-surface-hover transition-colors">
            <Bell className="text-text-main w-5 h-5" />
            <span className="absolute top-2 right-2 h-2 w-2 rounded-full role-primary-bg border-2 border-surface-card"></span>
          </button>
        </div>
      </header>

      <main className="flex-1 px-5 pb-8 space-y-8">
        {/* AI Insight Alert */}
        <AnimatePresence>
          {aiSuggestion && (
            <motion.section
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
            >
              <div className="bg-gradient-to-br from-[var(--color-role-primary)] to-[var(--color-role-primary-dark)] p-4 rounded-2xl shadow-lg border border-[var(--color-role-primary-dark)]/20 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 blur-2xl rounded-full translate-x-12 -translate-y-12"></div>
                <div className="flex gap-4 items-start relative z-10">
                  <div className="bg-white/20 p-2.5 rounded-xl backdrop-blur-sm shrink-0">
                    <Sparkles className="text-white w-6 h-6 animate-pulse" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-[var(--color-text-light)] text-[10px] font-bold uppercase tracking-widest opacity-80 mb-1">Sugerencia de Reabastecimiento</h4>
                    <p className="text-white font-medium text-sm leading-snug">
                      {aiSuggestion}
                    </p>
                    <div className="flex gap-3 mt-4">
                      <button 
                        onClick={() => onNavigate('catalog')}
                        className="bg-white text-[var(--color-role-primary)] px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider hover:bg-opacity-90 transition-all active:scale-95"
                      >
                        Ir al Catálogo
                      </button>
                      <button 
                        onClick={() => setAiSuggestion(null)}
                        className="bg-white/10 text-white/80 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider hover:bg-white/20 transition-all"
                      >
                        Descartar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* Quick Stats */}
        <section className="grid grid-cols-2 gap-4">
          <motion.div 
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="bg-surface-card p-4 rounded-2xl soft-shadow border border-border-subtle flex flex-col gap-2"
          >
            <div className="flex items-center gap-2 text-[var(--color-role-primary)]">
              <TrendingUp className="w-5 h-5" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Ventas Hoy</span>
            </div>
            <p className="text-2xl font-bold text-text-main tracking-tight">$4,250</p>
            <p className="text-[10px] text-text-muted">+12% vs ayer</p>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="bg-surface-card p-4 rounded-2xl soft-shadow border border-border-subtle flex flex-col gap-2"
          >
            <div className="flex items-center gap-2 text-[var(--color-role-primary)]">
              <PiggyBank className="w-5 h-5" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Ahorro VMI</span>
            </div>
            <p className="text-2xl font-bold text-text-main tracking-tight">$840</p>
            <p className="text-[10px] text-text-muted">Esta semana</p>
          </motion.div>
        </section>

        {/* Alerts */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold flex items-center gap-2 text-text-main">
              <AlertTriangle className="text-danger w-5 h-5" />
              ¡Stock Crítico!
            </h2>
            <button className="text-[var(--color-role-primary)] text-[10px] font-bold uppercase tracking-wider hover:underline p-1">Ver todo</button>
          </div>
          
          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2 -mx-5 px-5 snap-x">
            {/* Card 1 */}
            <div className="snap-start min-w-[280px] bg-surface-card rounded-2xl p-4 border border-border-subtle relative overflow-hidden group soft-shadow">
              <div className="absolute top-0 right-0 bg-red-50 text-danger text-[10px] font-bold px-3 py-1 rounded-bl-xl uppercase tracking-wider border-b border-l border-red-100">
                Pocas unidades
              </div>
              <div className="flex gap-4">
                <div 
                  className="w-16 h-16 rounded-xl bg-bg-main bg-cover bg-center shrink-0 border border-border-subtle"
                  style={{ backgroundImage: "url('https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&q=80&w=200')" }}
                ></div>
                <div className="flex flex-col justify-between flex-1">
                  <div>
                    <h3 className="font-bold text-sm text-text-main">Coca-Cola 600ml</h3>
                    <p className="text-[10px] text-text-muted mt-0.5">Quedan 4 unidades</p>
                  </div>
                  <div className="flex items-center gap-1 text-danger text-[10px] font-bold mt-1">
                    <Clock className="w-3 h-3" /> Reponer urgente
                  </div>
                </div>
              </div>
              <button 
                onClick={() => onNavigate('inventory')}
                className="mt-4 w-full bg-bg-main hover:bg-surface-hover text-text-main py-2.5 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2"
              >
                <Package className="w-4 h-4" /> Gestionar Inventario
              </button>
            </div>
          </div>
        </section>

        {/* Suggested Order */}
        <section>
          <div className="bg-[var(--color-role-primary)] rounded-[2.5rem] p-1 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--color-text-light)]/10 blur-3xl rounded-full pointer-events-none"></div>
            <div className="bg-surface-card p-6 rounded-[2.2rem]">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="bg-[var(--color-role-primary)]/10 text-[var(--color-role-primary)] text-[8px] font-bold px-2 py-0.5 rounded border border-[var(--color-role-primary)]/20 uppercase tracking-widest">
                      VMI OPTIMIZADO
                    </span>
                    <span className="text-[10px] text-text-muted font-mono">Pedido Programado</span>
                  </div>
                  <h2 className="text-xl font-bold text-text-main">Pedido Sugerido</h2>
                </div>
                <div className="bg-bg-main p-3 rounded-2xl border border-border-subtle">
                  <Package className="text-[var(--color-role-primary)] w-6 h-6" />
                </div>
              </div>
              
              <div className="space-y-3 mb-6">
                <div className="flex justify-between items-center text-xs border-b border-border-subtle pb-2">
                  <span className="text-text-muted">Total productos</span>
                  <span className="font-bold text-text-main">15 items</span>
                </div>
                <div className="flex justify-between items-center text-xs border-b border-border-subtle pb-2">
                  <span className="text-text-muted">Proveedores</span>
                  <span className="font-bold text-text-main">Multi-proveedor</span>
                </div>
                <div className="flex justify-between items-center pt-2">
                  <span className="text-text-muted font-medium text-sm">Total estimado</span>
                  <span className="font-bold text-[var(--color-role-primary)] text-2xl tracking-tight">$2,450.00</span>
                </div>
              </div>
              
              <button 
                onClick={() => onNavigate('catalog')}
                className="w-full role-primary-bg hover:brightness-110 text-[var(--color-text-light)] font-bold py-4 rounded-2xl flex items-center justify-center gap-2 soft-shadow transition-all active:scale-[0.98]"
              >
                <span>Confirmar en Catálogo</span>
                <CheckCircle2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        </section>

        {/* Smart Supply */}
        <section>
          <h2 className="text-base font-bold mb-3 flex items-center gap-2 text-text-main">
            <Truck className="text-[var(--color-role-primary)] w-5 h-5" />
            Entregas Programadas
          </h2>
          <div className="bg-surface-card rounded-2xl border border-border-subtle divide-y divide-border-subtle soft-shadow overflow-hidden">
            <div className="p-4 space-y-3">
              <div className="flex gap-4 items-center">
                <div className="relative">
                  <div className="w-12 h-12 rounded-xl bg-bg-main border border-border-subtle flex items-center justify-center text-[var(--color-role-primary)]">
                    <span className="font-bold text-[10px] tracking-widest">CEDIS</span>
                  </div>
                  <div className="absolute -bottom-1 -right-1 role-primary-bg border-2 border-surface-card w-4 h-4 rounded-full shadow-sm"></div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-0.5">
                    <h4 className="font-bold text-sm text-text-main truncate pr-2">Almacenes Ibarra (CEDIS)</h4>
                    <span className="text-[10px] font-bold text-[var(--color-role-primary)] bg-bg-main px-1.5 py-0.5 rounded border border-border-subtle whitespace-nowrap">En ruta</span>
                  </div>
                  <p className="text-[10px] text-text-muted font-mono">Camión #402 • Reparto Altamira-Tampico</p>
                  <div className="flex items-center gap-1 mt-1 text-[10px] text-text-muted">
                    <Clock className="w-3 h-3 text-[var(--color-role-primary)]" /> Entrega hoy: 14:30 hrs
                  </div>
                </div>
              </div>

              <button 
                onClick={() => onNavigate('route')}
                className="w-full py-2.5 px-3 rounded-xl bg-[var(--color-role-primary)]/10 hover:bg-[var(--color-role-primary)]/20 text-[var(--color-role-primary)] text-xs font-bold transition-all border border-[var(--color-role-primary)]/20 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
              >
                <Truck className="w-4 h-4" />
                <span>Ver Mapa y Ruta Logística en Vivo</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
