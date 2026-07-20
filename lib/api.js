import { auth } from "./firebase";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

/**
 * Obtiene el Firebase ID Token del usuario actual.
 * El token expira cada hora y Firebase lo renueva automáticamente.
 * @returns {Promise<string>} ID Token JWT
 * @throws {Error} Si el usuario no está autenticado
 */
async function getIdToken() {
  const user = auth.currentUser;
  if (!user) throw new Error("Usuario no autenticado.");
  return user.getIdToken(); // refresca el token si está próximo a vencer
}

/**
 * Envía un PDF al backend para su procesamiento.
 * Incluye el Firebase ID Token en el header Authorization.
 *
 * @param {File} file - Archivo PDF a procesar
 * @returns {Promise<object>} JSON estructurado retornado por el backend
 * @throws {Error} Con mensaje descriptivo si algo falla
 */
export async function extractPdf(file) {
  const token = await getIdToken();

  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${BACKEND_URL}/api/extract`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!res.ok) {
    let detail = `Error del servidor (${res.status})`;
    try {
      const json = await res.json();
      detail = json?.detail || detail;
    } catch (_) {}
    throw new Error(detail);
  }

  return res.json();
}
