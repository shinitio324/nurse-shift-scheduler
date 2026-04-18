import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { initializeDatabase } from './db';

let hasBootstrappedDatabase = false;

function bootstrapDatabase() {
  if (hasBootstrappedDatabase) return;
  hasBootstrappedDatabase = true;

  initializeDatabase()
    .then(() => {
      console.log('✅ データベース初期化完了');
    })
    .catch((err) => {
      console.error('❌ DB初期化エラー:', err);
    });
}

// ★ 初期化はアプリ起動時に一度だけ
bootstrapDatabase();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
