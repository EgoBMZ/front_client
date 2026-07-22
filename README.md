# AuraRead ✨

AuraRead es tu biblioteca digital personal. Sube tus libros en PDF y conviértelos al instante en un formato de lectura interactivo, con narrador de voz inteligente y sincronización en la nube para que nunca pierdas la página donde te quedaste.

## Características Principales 🚀

- **Sube tu PDF:** Arrastra tu libro en PDF y nuestra IA lo estructura automáticamente para una lectura óptima.
- **Biblioteca Compartida:** Descubre nuevas lecturas gracias a los libros procesados por la comunidad.
- **Reanuda Donde Quedaste:** Tu progreso se sincroniza en la nube. Continúa desde cualquier dispositivo sin perder tu lugar.
- **Lectura Cómoda y Accesible:** Tipografía cuidadosamente elegida, diseño limpio y soporte de narración inteligente por voz.

## Stack Tecnológico 🛠️

- **Framework:** [Next.js](https://nextjs.org/) (App Router)
- **Lenguaje:** JavaScript
- **Estilos:** CSS Modules / Vanilla CSS
- **Backend / Autenticación:** Firebase
- **Despliegue:** Vercel

## Despliegue en Vercel 🌐

Este proyecto está optimizado y configurado para ser desplegado en Vercel sin configuraciones adicionales complejas.

### Pasos para desplegar:

1. Haz un fork o sube este repositorio a tu cuenta de GitHub/GitLab/Bitbucket.
2. Crea una cuenta en [Vercel](https://vercel.com/) (si aún no tienes una).
3. Selecciona **"Add New Project"** en Vercel y enlaza el repositorio.
4. Asegúrate de configurar las **Variables de Entorno** (`.env.local`) necesarias para Firebase en la configuración del proyecto en Vercel:
   - `NEXT_PUBLIC_FIREBASE_API_KEY`
   - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
   - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
   - `NEXT_PUBLIC_FIREBASE_APP_ID`
5. Haz clic en **Deploy**. Vercel detectará automáticamente que es un proyecto Next.js y configurará los comandos de build por defecto.

## Desarrollo Local 💻

Primero, instala las dependencias:

```bash
npm install
```

Luego, ejecuta el servidor de desarrollo:

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador para ver el resultado.

---
Hecho con 💜 por el equipo de AuraRead.
