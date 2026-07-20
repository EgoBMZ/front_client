import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from "firebase/auth";
import { auth } from "./firebase";

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

/**
 * Abre el popup de Google OAuth y retorna el usuario autenticado.
 */
export async function signInWithGoogle() {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

/**
 * Cierra la sesión del usuario actual.
 */
export async function signOut() {
  await firebaseSignOut(auth);
}

/**
 * Suscribe un callback a los cambios de estado de autenticación.
 * Retorna la función de cancelación de suscripción.
 */
export function subscribeToAuthChanges(callback) {
  return onAuthStateChanged(auth, callback);
}

export { auth };
