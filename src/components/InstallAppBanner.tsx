import React, { useState, useEffect } from 'react';
import { Download, Smartphone, Monitor, CheckCircle2, Share, PlusSquare, X, Sparkles } from 'lucide-react';

declare global {
  interface Window {
    __deferredPwaPrompt?: any;
  }
}

interface InstallAppBannerProps {
  variant?: 'compact' | 'card';
}

export default function InstallAppBanner({ variant = 'compact' }: InstallAppBannerProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(() => window.__deferredPwaPrompt || null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);

  useEffect(() => {
    // Check if running as standalone installed app
    const checkStandalone = () => {
      const standalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true;
      setIsInstalled(standalone);
    };

    checkStandalone();

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      window.__deferredPwaPrompt = e;
      setDeferredPrompt(e);
    };

    const handleCustomReady = () => {
      if (window.__deferredPwaPrompt) {
        setDeferredPrompt(window.__deferredPwaPrompt);
      }
    };

    const handleAppInstalled = () => {
      window.__deferredPwaPrompt = null;
      setDeferredPrompt(null);
      setIsInstalled(true);
      setShowGuideModal(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('pwa-prompt-ready', handleCustomReady);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('pwa-prompt-ready', handleCustomReady);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    const promptEvent = deferredPrompt || window.__deferredPwaPrompt;
    if (promptEvent) {
      try {
        promptEvent.prompt();
        const { outcome } = await promptEvent.userChoice;
        if (outcome === 'accepted') {
          window.__deferredPwaPrompt = null;
          setDeferredPrompt(null);
          setIsInstalled(true);
        }
        return;
      } catch (err) {
        console.warn('Error al invocar prompt de instalación:', err);
      }
    }
    // Si el navegador no disparó el evento automático (ej. iOS Safari o ya instalado), mostrar guía rápida
    setShowGuideModal(true);
  };

  if (isInstalled) {
    if (variant === 'compact') return null;
    return (
      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-3.5 mb-4 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-600 flex items-center justify-center shrink-0">
          <CheckCircle2 size={20} />
        </div>
        <div className="text-left">
          <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
            App VMI Instalada • Modo Nativo Activo
          </p>
          <p className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80">
            Ejecutándose como aplicación independiente en tu dispositivo.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      {variant === 'compact' ? (
        <div className="mt-3 pt-3 border-t border-border-subtle/60 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-left">
            <div className="w-7 h-7 rounded-lg bg-[var(--color-role-primary)]/15 text-[var(--color-role-primary)] flex items-center justify-center shrink-0">
              <Smartphone size={15} />
            </div>
            <div>
              <p className="text-[11px] font-bold text-text-main leading-tight">
                App VMI Retail
              </p>
              <p className="text-[9px] text-text-muted">
                Instálala en tu celular o PC en 1 clic
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleInstallClick}
            className="px-3 py-1.5 rounded-xl bg-[var(--color-role-primary)] hover:brightness-110 active:scale-95 text-[var(--color-text-light)] font-bold text-[10px] uppercase tracking-wider flex items-center gap-1.5 shadow-xs transition-all cursor-pointer shrink-0"
          >
            <Download size={12} />
            <span>Instalar App</span>
          </button>
        </div>
      ) : (
        <div className="bg-surface-card border border-[var(--color-role-primary)]/30 rounded-2xl p-4 mb-4 soft-shadow flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-left">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-role-primary)]/15 text-[var(--color-role-primary)] flex items-center justify-center shrink-0">
              <Smartphone size={20} />
            </div>
            <div>
              <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--color-role-primary)] font-mono block">
                Aplicación Móvil Oficial
              </span>
              <p className="text-xs font-bold text-text-main">
                Instalar VMI Retail en este dispositivo
              </p>
              <p className="text-[10px] text-text-muted">
                Acceso directo en pantalla de inicio y pantalla completa.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleInstallClick}
            className="px-3.5 py-2 rounded-xl bg-[var(--color-role-primary)] hover:brightness-110 active:scale-95 text-[var(--color-text-light)] font-bold text-[10px] uppercase tracking-wider flex items-center gap-1.5 shadow-sm transition-all cursor-pointer shrink-0"
          >
            <Download size={13} />
            <span>Instalar</span>
          </button>
        </div>
      )}

      {/* Modal de Instrucciones Rápidas por Dispositivo */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-surface-card border border-border-subtle rounded-2xl max-w-sm w-full p-5 shadow-2xl text-left relative animate-in fade-in zoom-in-95 duration-200">
            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="absolute top-3.5 right-3.5 w-7 h-7 rounded-full bg-bg-main border border-border-subtle flex items-center justify-center text-text-muted hover:text-text-main cursor-pointer"
            >
              <X size={14} />
            </button>

            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--color-role-primary)] text-[var(--color-text-light)] flex items-center justify-center shadow-sm">
                <Sparkles size={20} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-text-main">
                  Instalar App VMI Retail
                </h3>
                <p className="text-[11px] text-text-muted">
                  Úsala como aplicación sin navegador
                </p>
              </div>
            </div>

            <div className="space-y-2.5 text-xs">
              {/* PC Chrome / Edge */}
              <div className="p-3 rounded-xl bg-bg-main border border-border-subtle space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-text-main">
                  <Monitor size={14} className="text-[var(--color-role-primary)]" />
                  <span>En PC (Chrome o Edge)</span>
                </div>
                <p className="text-[11px] text-text-muted leading-relaxed">
                  Haz clic en el ícono de <strong>Instalar VMI Retail</strong> <span className="inline-block px-1.5 py-0.5 rounded bg-surface-card border border-border-subtle font-mono text-[10px]">⊕ / ⬇</span> que aparece al final de la barra de direcciones arriba a la derecha.
                </p>
              </div>

              {/* Android */}
              <div className="p-3 rounded-xl bg-bg-main border border-border-subtle space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-text-main">
                  <Smartphone size={14} className="text-[var(--color-role-primary)]" />
                  <span>En Android (Chrome)</span>
                </div>
                <p className="text-[11px] text-text-muted leading-relaxed">
                  Toca el menú de tres puntos <strong>(⋮)</strong> arriba a la derecha y selecciona <strong>«Instalar aplicación»</strong> o <strong>«Agregar a la pantalla principal»</strong>.
                </p>
              </div>

              {/* iPhone / iOS */}
              <div className="p-3 rounded-xl bg-bg-main border border-border-subtle space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-text-main">
                  <Share size={14} className="text-[var(--color-role-primary)]" />
                  <span>En iPhone / iPad (Safari)</span>
                </div>
                <p className="text-[11px] text-text-muted leading-relaxed flex flex-wrap items-center gap-1">
                  Toca el botón <strong>Compartir</strong> <Share size={12} className="inline" /> en la barra inferior y elige <strong>«Agregar a inicio»</strong> <PlusSquare size={12} className="inline" />.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="mt-4 w-full py-2.5 rounded-xl bg-[var(--color-role-primary)] text-[var(--color-text-light)] font-bold text-xs uppercase tracking-wider cursor-pointer"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
}

