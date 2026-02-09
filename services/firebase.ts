
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyC3_RPYM-Y4m29rSQca2VavAxCLrErX0Ug",
  authDomain: "folgaspoliciais.firebaseapp.com",
  projectId: "folgaspoliciais",
  storageBucket: "folgaspoliciais.firebasestorage.app",
  messagingSenderId: "694401028027",
  appId: "1:694401028027:web:242500313a5be13f123e9e"
};

const app = initializeApp(firebaseConfig);
export const dbFirestore = getFirestore(app);
