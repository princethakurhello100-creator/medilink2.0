import React from "react";
import { AuthProvider } from "./src/context/AuthContext";
import AppNavigator from "./src/navigation/AppNavigator";
import { LanguageProvider } from './src/context/LanguageContext';

export default function App() {
  return (
<LanguageProvider>
  <AuthProvider>
    <AppNavigator />
  </AuthProvider>
</LanguageProvider>
  );
}