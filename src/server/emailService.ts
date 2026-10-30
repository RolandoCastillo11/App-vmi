import nodemailer, { type Transporter } from 'nodemailer';

interface WelcomeEmailParams {
  toEmail: string;
  ownerName: string;
  shopName: string;
  tempPassword: string;
  phone?: string;
}

let cachedTransporter: Transporter | null = null;

async function getTransporter(): Promise<Transporter> {
  if (cachedTransporter) return cachedTransporter;

  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const port = Number(process.env.SMTP_PORT) || 587;

  if (host && user && pass) {
    cachedTransporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass }
    });
    console.log(`[Email Service] Configurado SMTP en ${host}:${port} para usuario ${user}`);
    return cachedTransporter;
  }

  // Si no hay SMTP configurado, intentamos Ethereal con timeout de 3s o usamos stream simulado inmediato
  try {
    const testAccountPromise = nodemailer.createTestAccount();
    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error("Ethereal timeout")), 3000)
    );
    const testAccount = await Promise.race([testAccountPromise, timeoutPromise]);
    cachedTransporter = nodemailer.createTransport({
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    console.log(`[Email Service] Servidor de correo de prueba Ethereal activado: ${testAccount.user}`);
    return cachedTransporter;
  } catch (err) {
    console.log("[Email Service] Modo simulado activo (sin credenciales SMTP externas). Los correos se registran en consola.");
    cachedTransporter = nodemailer.createTransport({
      jsonTransport: true
    });
    return cachedTransporter;
  }
}

export async function sendWelcomeEmailWithTempPassword(params: WelcomeEmailParams): Promise<{
  success: boolean;
  previewUrl?: string | false;
  messageId?: string;
}> {
  const { toEmail, ownerName, shopName, tempPassword, phone } = params;

  try {
    const transporter = await getTransporter();

    const appUrl = process.env.APP_URL || "http://localhost:3000";

    const mailOptions = {
      from: `"Almacenes Ibarra - CEDIS Altamira" <${process.env.SMTP_FROM || 'notificaciones@almacenesibarra.com.mx'}>`,
      to: toEmail,
      subject: `🔐 Clave Temporal de Acceso - Almacenes Ibarra VMI (${shopName})`,
      text: `Hola ${ownerName},\n\n¡Bienvenido a la red de reabastecimiento continuo VMI de Almacenes Ibarra (CEDIS Altamira)!\n\nTu tienda "${shopName}" ha sido dada de alta exitosamente.\n\nTus credenciales provisionales para ingresar a la plataforma web (${appUrl}) son:\nUsuario / Correo: ${toEmail}\nContraseña Temporal: ${tempPassword}\n\nPor seguridad de tu negocio, al ingresar por primera vez se te solicitará obligatoriamente cambiar esta clave por tu contraseña definitiva.\n\nAtentamente,\nEquipo de Logística y Abastecimiento VMI\nAlmacenes Ibarra - CEDIS Altamira`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #1e293b; }
            .container { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; }
            .header { background: linear-gradient(135deg, #ea580c 0%, #f59e0b 100%); padding: 32px 24px; text-align: center; color: #ffffff; }
            .header h1 { margin: 0 0 6px 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px; }
            .header p { margin: 0; font-size: 13px; opacity: 0.92; font-weight: 500; }
            .content { padding: 32px 28px; }
            .welcome-tag { display: inline-block; background: #fff7ed; color: #ea580c; border: 1px solid #ffedd5; font-size: 11px; font-weight: 700; padding: 4px 12px; border-radius: 999px; text-transform: uppercase; margin-bottom: 16px; }
            .password-card { background: #fffbeb; border: 2px dashed #f59e0b; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0; }
            .password-label { font-size: 12px; color: #b45309; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; margin-bottom: 8px; }
            .password-value { font-family: 'Courier New', Courier, monospace; font-size: 26px; font-weight: 800; color: #ea580c; letter-spacing: 3px; }
            .warning-box { background: #fef2f2; border-left: 4px solid #ef4444; padding: 14px 16px; border-radius: 8px; margin: 20px 0; font-size: 12px; color: #991b1b; line-height: 1.5; }
            .details-list { background: #f8fafc; border-radius: 10px; padding: 16px 20px; margin: 20px 0; border: 1px solid #e2e8f0; font-size: 13px; }
            .details-list div { padding: 4px 0; display: flex; justify-content: space-between; }
            .btn { display: block; width: fit-content; margin: 26px auto 0 auto; background: #ea580c; color: #ffffff !important; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 700; font-size: 14px; text-align: center; box-shadow: 0 4px 12px rgba(234, 88, 12, 0.3); }
            .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px; text-align: center; font-size: 11px; color: #64748b; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Almacenes Ibarra • VMI</h1>
              <p>Centro de Distribución (CEDIS) Altamira - Operaciones Logísticas</p>
            </div>
            <div class="content">
              <span class="welcome-tag">Alta de Tienda Minorista</span>
              <h2 style="margin: 0 0 12px 0; font-size: 18px; color: #0f172a;">¡Bienvenido al sistema VMI, ${ownerName}!</h2>
              <p style="font-size: 13px; line-height: 1.6; color: #475569; margin: 0 0 16px 0;">
                Tu negocio <strong>"${shopName}"</strong> ha sido incorporado a la ruta inteligente de abastecimiento de Almacenes Ibarra. Se ha generado tu acceso digital para monitorear pedidos, inventario sugerido y tiempos de entrega en tiempo real.
              </p>

              <div class="password-card">
                <div class="password-label">Tu Contraseña Temporal de Acceso</div>
                <div class="password-value">${tempPassword}</div>
              </div>

              <div class="warning-box">
                <strong>🔒 Medida de Seguridad Obligatoria:</strong><br>
                Esta es una contraseña provisional. Al iniciar sesión en la plataforma por primera vez, el sistema te solicitará inmediatamente establecer tu <strong>contraseña definitiva personal</strong>.
              </div>

              <div class="details-list">
                <div><span style="color: #64748b;">Negocio:</span> <strong>${shopName}</strong></div>
                <div><span style="color: #64748b;">Encargado:</span> <strong>${ownerName}</strong></div>
                <div><span style="color: #64748b;">Usuario / Correo:</span> <strong>${toEmail}</strong></div>
                ${phone ? `<div><span style="color: #64748b;">WhatsApp Vinculado:</span> <strong>${phone}</strong></div>` : ''}
                <div><span style="color: #64748b;">CEDIS de Despacho:</span> <strong>Altamira (Ruta Tampico-Madero)</strong></div>
              </div>

              <a href="${appUrl}" class="btn" target="_blank">Entrar al Portal Web VMI</a>
            </div>
            <div class="footer">
              <p style="margin: 0 0 4px 0;">Almacenes Ibarra S.A. de C.V. • División Logística y Cadena de Suministro</p>
              <p style="margin: 0;">Carretera Tampico - Mante Km 14.5, Altamira, Tamaulipas, México</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    const previewUrl = nodemailer.getTestMessageUrl(info);

    console.log(`[Email Service] ✅ Correo de bienvenida enviado a ${toEmail}. MessageId: ${info.messageId}`);
    if (previewUrl) {
      console.log(`[Email Service] 🔗 Vista previa del correo (Ethereal): ${previewUrl}`);
    }

    return {
      success: true,
      previewUrl: previewUrl || undefined,
      messageId: info.messageId
    };
  } catch (error: any) {
    console.error(`[Email Service] ❌ Error enviando correo a ${toEmail}:`, error);
    return {
      success: false
    };
  }
}
