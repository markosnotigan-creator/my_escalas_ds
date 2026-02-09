
import { initializeApp } from 'firebase/app';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyC3_RPYM-Y4m29rSQca2VavAxCLrErX0Ug",
  authDomain: "folgaspoliciais.firebaseapp.com",
  projectId: "folgaspoliciais",
  storageBucket: "folgaspoliciais.firebasestorage.app",
  messagingSenderId: "694401028027",
  appId: "1:694401028027:web:242500313a5be13f123e9e"
};

const app = initializeApp(firebaseConfig);

// Inicializa o Firestore com configurações explícitas de cache offline
// Isso corrige o erro de timeout ao tentar conectar com o backend
export const dbFirestore = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});
