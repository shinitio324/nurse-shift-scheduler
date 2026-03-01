import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import { initializeDatabase } from './db'

// ★ DB初期化（デフォルトパターン・制約条件を自動セットアップ）
initializeDatabase().then(() => {
  console.log('✅ データベース初期化完了');
}).catch(err => {
  console.error('❌ DB初期化エラー:', err);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
