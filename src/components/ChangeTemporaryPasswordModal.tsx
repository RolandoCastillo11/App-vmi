import React, { useState } from 'react';
import { Lock, ShieldCheck, KeyRound, AlertCircle, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { updateUserPasswordAndClearFlag } from '../lib/supabaseAuth';

interface ChangeTemporaryPasswordModalProps {
  userId: string;
  userEmail: string;
  shopName?: string;
  onSuccess: () => void;
}

export default function ChangeTemporaryPasswordModal({
  userId,
  userEmail,
  shopName,
  onSuccess,
}: ChangeTemporaryPasswordModalProps) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (newPassword.length < 6) {
      setErrorMessage('La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('Las contraseñas no coinciden. Verifícalas.');
      return;
    }

    setIsSubmitting(true);
    try {
      await updateUserPasswordAndClearFlag(newPassword, userId);
      setSuccess(true);
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error al actualizar la contraseña.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] isolate flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-orange-100 overflow-hidden">
        {/* Header Decorativo */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-orange-500 via-amber-500 to-emerald-500" />
        
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-orange-50 border border-orange-200 flex items-center justify-center text-orange-600 shadow-sm">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold tracking-wider text-orange-600 uppercase block">
              Seguridad VMI • Primer Acceso
            </span>
            <h2 className="text-lg font-bold text-gray-900 leading-tight">
              Actualizar Contraseña Temporal
            </h2>
          </div>
        </div>

        {shopName && (
          <div className="mb-4 p-3 bg-orange-50/60 border border-orange-100 rounded-xl text-xs text-orange-800 flex items-center gap-2">
            <span className="font-semibold">Tienda afiliada:</span> {shopName}
          </div>
        )}

        <p className="text-xs text-gray-600 mb-5 leading-relaxed">
          Has ingresado con la <strong>contraseña provisional</strong> enviada por WhatsApp/correo. Por seguridad de tu negocio y pedidos, debes establecer tu contraseña personal definitiva.
        </p>

        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 flex items-center gap-2 text-xs text-red-700 animate-shake">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {success ? (
          <div className="py-8 text-center animate-fade-in">
            <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3 shadow-inner">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="font-bold text-gray-900 text-base mb-1">¡Contraseña Actualizada!</h3>
            <p className="text-xs text-gray-500">Ingresando a tu panel de control VMI...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Nueva Contraseña Personal
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  required
                  className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Confirmar Nueva Contraseña
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repite tu contraseña"
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold text-sm rounded-xl shadow-lg shadow-orange-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>Guardando contraseña...</>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    Guardar y Entrar a la Plataforma
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
