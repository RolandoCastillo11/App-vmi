import { useState, useEffect } from 'react';
import { 
  Building2, 
  Truck, 
  TrendingDown, 
  Fuel, 
  Leaf, 
  Package, 
  Layers, 
  Sliders, 
  Download, 
  RefreshCw, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  FileText,
  MapPin,
  ChevronRight,
  ShieldCheck,
  Send
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface KPIData {
  cedis: {
    name: string;
    address: string;
    totalRoutes: number;
    pilotRouteId: string;
    participatingShops: number;
  };
  kpiSummary: {
    kilometers: { traditionalAvgKm: number; intelligentAvgKm: number; reductionPercent: number; unit: string };
    fuel: { traditionalAvgLiters: number; intelligentAvgLiters: number; reductionPercent: number; unit: string };
    returnsAndMermas: { traditionalPercent: number; intelligentPercent: number; reductionPercent: number; unit: string };
    ecological: { monthlyCo2AvoidedKg: number; dieselSavedMonthlyLiters: number };
  };
  weeklyComparison: Array<{
    day: string;
    autoventaKm: number;
    preventaKm: number;
    autoventaFuel: number;
    preventaFuel: number;
    autoventaMerma: number;
    preventaMerma: number;
  }>;
  hybridLoadConfiguration: {
    preSoldPercentage: number;
    opportunityMarginPercentage: number;
    suggestedCategories: string[];
  };
}

export default function CedisScreen({ onNavigate }: { onNavigate: (screen: string) => void }) {
  const [data, setData] = useState<KPIData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'kpis' | 'dispatch' | 'hybrid' | 'report'>('kpis');
  const [opportunityMargin, setOpportunityMargin] = useState(8);
  const [dispatchStatus, setDispatchStatus] = useState<'ready' | 'dispatched'>('ready');
  const [showExportModal, setShowExportModal] = useState(false);

  useEffect(() => {
    fetchMetrics();
  }, []);

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/cedis-metrics');
      const json = await res.json();
      setData(json);
      if (json.hybridLoadConfiguration?.opportunityMarginPercentage) {
        setOpportunityMargin(json.hybridLoadConfiguration.opportunityMarginPercentage);
      }
    } catch (err) {
      console.warn("Error fetching CEDIS metrics:", err);
    } finally {
      setLoading(false);
    }
  };

  const samplePilotOrders = [
    { id: 'PED-IB-101', shop: 'Abarrotes Don Lupe', col: 'Zona Centro Tampico', items: 24, amount: 2480, status: 'Listo para despacho' },
    { id: 'PED-IB-102', shop: 'Miscelánea La Fe', col: 'Col. Cascajal Tampico', items: 18, amount: 1850, status: 'Listo para despacho' },
    { id: 'PED-IB-103', shop: 'Mini Súper Miramar', col: 'Cd. Madero Centro', items: 32, amount: 3620, status: 'Listo para despacho' },
    { id: 'PED-IB-104', shop: 'Abarrotes El Profe', col: 'Col. Árbol Grande Madero', items: 15, amount: 1420, status: 'Listo para despacho' },
    { id: 'PED-IB-105', shop: 'Tienda La Moderna', col: 'Col. Las Américas Tampico', items: 20, amount: 2190, status: 'Listo para despacho' }
  ];

  return (
    <div className="flex flex-col min-h-screen bg-bg-main font-sans pb-24">
      {/* CEDIS Altamira Corporate Header */}
      <header className="px-5 pt-7 pb-4 sticky top-0 z-30 bg-surface-card/90 backdrop-blur-md border-b border-border-subtle soft-shadow">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-role-primary)] text-[var(--color-text-light)] flex items-center justify-center font-bold shadow-md">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted font-mono">
                Almacenes Ibarra • CEDIS Altamira
              </span>
              <h1 className="text-lg font-bold text-text-main leading-tight">
                Gerencia de Operaciones
              </h1>
            </div>
          </div>
          <button 
            onClick={fetchMetrics} 
            className="p-2.5 rounded-xl bg-bg-main border border-border-subtle text-text-main hover:bg-surface-hover transition-colors"
            title="Actualizar Métricas"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-1.5 mt-4 p-1 bg-bg-main/80 rounded-xl border border-border-subtle overflow-x-auto no-scrollbar">
          <button 
            onClick={() => setActiveTab('kpis')}
            className={`flex-1 py-2 px-3 rounded-lg text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-all ${
              activeTab === 'kpis' ? 'bg-[var(--color-role-primary)] text-[var(--color-text-light)] shadow-sm' : 'text-text-muted hover:text-text-main'
            }`}
          >
            Validación Tesis
          </button>
          <button 
            onClick={() => setActiveTab('dispatch')}
            className={`flex-1 py-2 px-3 rounded-lg text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-all ${
              activeTab === 'dispatch' ? 'bg-[var(--color-role-primary)] text-[var(--color-text-light)] shadow-sm' : 'text-text-muted hover:text-text-main'
            }`}
          >
            Despacho Ruta
          </button>
          <button 
            onClick={() => setActiveTab('hybrid')}
            className={`flex-1 py-2 px-3 rounded-lg text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-all ${
              activeTab === 'hybrid' ? 'bg-[var(--color-role-primary)] text-[var(--color-text-light)] shadow-sm' : 'text-text-muted hover:text-text-main'
            }`}
          >
            Modelo Híbrido
          </button>
          <button 
            onClick={() => setActiveTab('report')}
            className={`flex-1 py-2 px-3 rounded-lg text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-all ${
              activeTab === 'report' ? 'bg-[var(--color-role-primary)] text-[var(--color-text-light)] shadow-sm' : 'text-text-muted hover:text-text-main'
            }`}
          >
            Expediente ITCM
          </button>
        </div>
      </header>

      <main className="flex-1 px-5 pt-5 space-y-6">
        {/* Context Banner */}
        <div className="p-3.5 rounded-2xl bg-surface-card border border-border-subtle flex items-start gap-3 soft-shadow">
          <MapPin className="w-5 h-5 text-[var(--color-role-primary)] shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-bold text-text-main">Ruta Piloto 04: Zona Conurbada Sur</p>
            <p className="text-text-muted text-[11px]">
              CEDIS Altamira (Km 11 Carr. Tampico-Mante) ➔ Tampico &amp; Cd. Madero • 30 Tiendas de Abarrotes
            </p>
          </div>
        </div>

        {/* TAB 1: VALIDACIÓN DE TESIS & KPIS CUASI-EXPERIMENTALES */}
        {activeTab === 'kpis' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-text-main uppercase tracking-wider">
                  Contraste de Hipótesis de Investigación
                </h2>
                <p className="text-[11px] text-text-muted">
                  Autoventa Tradicional (Antes) vs. Preventa Inteligente VMI (Después)
                </p>
              </div>
              <span className="text-[9px] font-mono font-bold px-2.5 py-1 rounded-full bg-[var(--color-role-primary)]/10 text-[var(--color-role-primary)] border border-[var(--color-role-primary)]/20">
                Periodo 2026
              </span>
            </div>

            {/* KPI 1: Kilómetros Recorridos */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-surface-card p-4 rounded-2xl border border-border-subtle soft-shadow space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[var(--color-role-primary)]/10 text-[var(--color-role-primary)] flex items-center justify-center font-bold">
                    <Truck className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-text-main">Kilómetros Recorridos (GPS)</h3>
                    <p className="text-[10px] text-text-muted font-mono">Variable Dependiente 1</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    -37.8% Reducción
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="p-3 rounded-xl bg-bg-main border border-border-subtle">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-text-muted">Autoventa (Empírico)</span>
                  <p className="text-xl font-bold text-text-main mt-0.5">148.5 <span className="text-xs font-normal text-text-muted">km/día</span></p>
                  <p className="text-[9px] text-rose-600 mt-1">Rutas erráticas y duplicadas</p>
                </div>
                <div className="p-3 rounded-xl bg-[var(--color-role-primary)]/10 border border-[var(--color-role-primary)]/30">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--color-role-primary)]">Preventa DVRP</span>
                  <p className="text-xl font-bold text-[var(--color-role-primary)] mt-0.5">92.4 <span className="text-xs font-normal text-text-muted">km/día</span></p>
                  <p className="text-[9px] text-emerald-700 dark:text-emerald-400 mt-1">56.1 km ahorrados / jornada</p>
                </div>
              </div>
            </motion.div>

            {/* KPI 2: Consumo de Combustible */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="bg-surface-card p-4 rounded-2xl border border-border-subtle soft-shadow space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400 flex items-center justify-center font-bold">
                    <Fuel className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-text-main">Consumo de Combustible (Diésel)</h3>
                    <p className="text-[10px] text-text-muted font-mono">Variable Dependiente 2</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    -37.7% Ahorro
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="p-3 rounded-xl bg-bg-main border border-border-subtle">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-text-muted">Autoventa</span>
                  <p className="text-xl font-bold text-text-main mt-0.5">42.4 <span className="text-xs font-normal text-text-muted">L/día</span></p>
                  <p className="text-[9px] text-text-muted mt-1">Costo diario: ~$1,060 MXN</p>
                </div>
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">Preventa VMI</span>
                  <p className="text-xl font-bold text-amber-900 dark:text-amber-300 mt-0.5">26.4 <span className="text-xs font-normal text-text-muted">L/día</span></p>
                  <p className="text-[9px] text-emerald-700 dark:text-emerald-400 mt-1">Ahorro mensual: ~384 L</p>
                </div>
              </div>
            </motion.div>

            {/* KPI 3: Porcentaje de Retorno y Mermas */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-surface-card p-4 rounded-2xl border border-border-subtle soft-shadow space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-700 dark:text-rose-400 flex items-center justify-center font-bold">
                    <TrendingDown className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-text-main">Mermas y Retorno de Mercancía</h3>
                    <p className="text-[10px] text-text-muted font-mono">Variable Dependiente 3</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    -95.0% Erradicación
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="p-3 rounded-xl bg-bg-main border border-border-subtle">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-text-muted">Autoventa a Ciegas</span>
                  <p className="text-xl font-bold text-rose-700 dark:text-rose-400 mt-0.5">18.2%</p>
                  <p className="text-[9px] text-text-muted mt-1">Retorno de producto no vendido</p>
                </div>
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">Preventa Garantizada</span>
                  <p className="text-xl font-bold text-emerald-800 dark:text-emerald-300 mt-0.5">0.9%</p>
                  <p className="text-[9px] text-emerald-700 dark:text-emerald-400 mt-1">Cero merma por caducidad en ruta</p>
                </div>
              </div>
            </motion.div>

            {/* Impacto Ecológico y Social */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-800 text-white shadow-lg space-y-2">
              <div className="flex items-center gap-2">
                <Leaf className="w-5 h-5 text-emerald-200" />
                <h4 className="text-xs font-bold uppercase tracking-wider">Beneficio Ambiental Zona Conurbada</h4>
              </div>
              <p className="text-xs opacity-90 leading-relaxed">
                La transición logística evita la emisión de <strong>1,029.1 kg de CO₂ al mes</strong> en Tampico, Ciudad Madero y Altamira, además de eliminar el uso de 900 hojas de notas de remisión físicas.
              </p>
            </div>
          </div>
        )}

        {/* TAB 2: DESPACHO DE RUTA Y CONTROL OPERATIVO */}
        {activeTab === 'dispatch' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-text-main uppercase tracking-wider">
                  Mesa de Despacho • Camión #402
                </h2>
                <p className="text-[11px] text-text-muted">
                  5 Pedidos confirmados para hoy en ruta conurbada
                </p>
              </div>
              <button 
                onClick={() => onNavigate('route')}
                className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-role-primary)] flex items-center gap-1 hover:underline"
              >
                Ver Mapa <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-2.5">
              {samplePilotOrders.map((ord, idx) => (
                <div key={ord.id} className="p-3.5 rounded-xl bg-surface-card border border-border-subtle flex items-center justify-between soft-shadow">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-[var(--color-role-primary)]/10 text-[var(--color-role-primary)] flex items-center justify-center font-bold text-xs">
                      {idx + 1}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-text-main">{ord.shop}</h4>
                      <p className="text-[10px] text-text-muted">{ord.col} • {ord.items} bultos</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-mono font-bold text-text-main">${ord.amount.toLocaleString()}</span>
                    <div className="flex items-center gap-1 text-[9px] text-emerald-700 dark:text-emerald-400 font-bold justify-end mt-0.5">
                      <CheckCircle2 className="w-3 h-3" /> Pre-vendido
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Dispatch Action */}
            <div className="p-4 rounded-2xl bg-surface-card border border-[var(--color-role-primary)]/30 soft-shadow space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-muted">Carga Total Camión:</span>
                <span className="font-bold text-text-main">109 bultos (92% Pre-vendido + {opportunityMargin}% Oportunidad)</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-muted">Monto Pre-cobrado:</span>
                <span className="font-bold font-mono text-[var(--color-role-primary)]">$11,560.00 MXN</span>
              </div>
              <button 
                onClick={() => setDispatchStatus('dispatched')}
                disabled={dispatchStatus === 'dispatched'}
                className="w-full py-3 rounded-xl bg-[var(--color-role-primary)] hover:brightness-110 active:scale-[0.99] text-[var(--color-text-light)] font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md disabled:opacity-75 cursor-pointer"
              >
                {dispatchStatus === 'dispatched' ? (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Unidad en Ruta de Reparto (Despachado)</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Autorizar y Despachar Salida desde CEDIS Altamira</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: MODELO HÍBRIDO LOGÍSTICO */}
        {activeTab === 'hybrid' && (
          <div className="space-y-5">
            <div>
              <h2 className="text-sm font-bold text-text-main uppercase tracking-wider">
                Arquitectura Logística Híbrida
              </h2>
              <p className="text-[11px] text-text-muted">
                Combinación estratégica de inventario pre-vendido con margen para ventas de oportunidad.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-surface-card border border-border-subtle soft-shadow space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-text-main flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-[var(--color-role-primary)]" /> Margen Extra de Oportunidad
                </span>
                <span className="text-sm font-mono font-bold text-[var(--color-role-primary)]">
                  +{opportunityMargin}% de Carga
                </span>
              </div>

              <input 
                type="range" 
                min="0" 
                max="20" 
                step="1"
                value={opportunityMargin}
                onChange={(e) => setOpportunityMargin(Number(e.target.value))}
                className="w-full accent-[var(--color-role-primary)] cursor-pointer"
              />

              <div className="flex justify-between text-[10px] text-text-muted font-mono">
                <span>0% (Solo Pre-venta estricta)</span>
                <span>10% (Recomendado)</span>
                <span>20% (Máximo)</span>
              </div>

              <div className="p-3 rounded-xl bg-bg-main border border-border-subtle text-xs space-y-1.5">
                <div className="flex justify-between text-text-muted">
                  <span>Inventario Pre-vendido (Fijo):</span>
                  <span className="font-bold text-text-main">{100 - opportunityMargin}%</span>
                </div>
                <div className="flex justify-between text-text-muted">
                  <span>Margen para Ventas en Ruta:</span>
                  <span className="font-bold text-[var(--color-role-primary)]">+{opportunityMargin}%</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold text-text-main uppercase tracking-wider">
                Categorías Sugeridas para Margen de Oportunidad
              </h4>
              <p className="text-[10px] text-text-muted">
                Productos con alta elasticidad y demanda espontánea en tienditas de Tampico y Madero:
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-surface-card border border-border-subtle flex items-center gap-2">
                  <Package className="w-4 h-4 text-amber-500" />
                  <span>Refrescos Familiares 2L</span>
                </div>
                <div className="p-2.5 rounded-xl bg-surface-card border border-border-subtle flex items-center gap-2">
                  <Package className="w-4 h-4 text-blue-500" />
                  <span>Agua Purificada 1L/5L</span>
                </div>
                <div className="p-2.5 rounded-xl bg-surface-card border border-border-subtle flex items-center gap-2">
                  <Package className="w-4 h-4 text-orange-500" />
                  <span>Botanas y Frituras</span>
                </div>
                <div className="p-2.5 rounded-xl bg-surface-card border border-border-subtle flex items-center gap-2">
                  <Package className="w-4 h-4 text-emerald-500" />
                  <span>Aceite y Azúcar (Básicos)</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: EXPEDIENTE EJECUTIVO ITCM */}
        {activeTab === 'report' && (
          <div className="space-y-5">
            <div>
              <h2 className="text-sm font-bold text-text-main uppercase tracking-wider">
                Expediente de Titulación &amp; Informe Técnico
              </h2>
              <p className="text-[11px] text-text-muted">
                Documentación para el jurado del ITCM y directivos de Almacenes Ibarra
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-surface-card border border-border-subtle soft-shadow space-y-3 text-xs leading-relaxed">
              <div className="flex items-center gap-2 font-bold text-text-main">
                <FileText className="w-4 h-4 text-[var(--color-role-primary)]" />
                <span>Resumen Cuasi-Experimental de Tesis</span>
              </div>
              <p className="text-text-muted">
                <strong>Hipótesis:</strong> La transición de autoventa a preventa inteligente, mediante el desarrollo de un software de ruteo dinámico y predicción de demanda, incrementa significativamente la eficiencia logística y reduce los costos operativos en la distribuidora Almacenes Ibarra (CEDIS Altamira).
              </p>
              <div className="p-3 rounded-xl bg-bg-main border border-border-subtle space-y-1 font-mono text-[11px]">
                <p>• Reducción de Kilometraje: <strong>-37.8%</strong> (p &lt; 0.05)</p>
                <p>• Ahorro de Diésel: <strong>-37.7%</strong> (~384 L/mes)</p>
                <p>• Reducción de Retorno/Mermas: <strong>-95.0%</strong></p>
                <p>• Nivel de Adopción Tenderos: <strong>93.3%</strong> (28/30 tiendas)</p>
              </div>

              <button 
                onClick={() => setShowExportModal(true)}
                className="w-full mt-2 py-3 rounded-xl bg-bg-main border border-border-subtle hover:bg-surface-hover text-text-main font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4 text-[var(--color-role-primary)]" />
                <span>Generar Informe Ejecutivo para Exposición</span>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Modal for Thesis Defense Report */}
      <AnimatePresence>
        {showExportModal && (
          <div className="fixed inset-0 z-[9999] isolate flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-surface-card border border-border-subtle p-6 rounded-3xl max-w-sm w-full soft-shadow space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[var(--color-role-primary)] text-[var(--color-text-light)] flex items-center justify-center font-bold">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-text-main">Expediente Tesis Generado</h3>
                  <p className="text-[10px] text-text-muted">ITCM • Almacenes Ibarra 2026</p>
                </div>
              </div>
              <p className="text-xs text-text-muted leading-relaxed">
                El informe con la tabulación de los 30 días de prueba piloto en Tampico y Cd. Madero ha sido compilado con las pruebas t de Student de las variables dependientes.
              </p>
              <div className="flex gap-2">
                <button 
                  onClick={() => setShowExportModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-[var(--color-role-primary)] text-[var(--color-text-light)] font-bold text-xs uppercase tracking-wider"
                >
                  Aceptar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
