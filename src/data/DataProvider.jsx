import { createContext, useContext } from 'react';
import { firebaseEnabled } from './firebase.js';
import { useLocalBackend } from './localBackend.js';
import { useFirebaseBackend } from './firebaseBackend.js';

export const DataContext = createContext(null);

function LocalProvider({ children }) {
  return <DataContext.Provider value={useLocalBackend()}>{children}</DataContext.Provider>;
}

function FirebaseProvider({ children }) {
  return <DataContext.Provider value={useFirebaseBackend()}>{children}</DataContext.Provider>;
}

export const DataProvider = firebaseEnabled ? FirebaseProvider : LocalProvider;

export const useData = () => useContext(DataContext);
