import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'react-hot-toast';
import './index.css';
import App from './App.tsx';
import { LanguageProvider } from './context/LanguageContext';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      <AuthProvider>
        <CartProvider>
          <App />
          <Toaster position="top-center" toastOptions={{ duration: 3000 }} />
        </CartProvider>
      </AuthProvider>
    </LanguageProvider>
  </StrictMode>,
);
