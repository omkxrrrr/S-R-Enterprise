// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCWjIpsf5UXocwsrhtp6KIr2oEtx1aVRQU",
  authDomain: "fir-r-enterprise-9ed2c.firebaseapp.com",
  databaseURL: "https://fir-r-enterprise-9ed2c-default-rtdb.firebaseio.com",
  projectId: "fir-r-enterprise-9ed2c",
  storageBucket: "fir-r-enterprise-9ed2c.firebasestorage.app",
  messagingSenderId: "991647484832",
  appId: "1:991647484832:web:c547af9e8430da3ff732c5",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const db = getDatabase(app);