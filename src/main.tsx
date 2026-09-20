import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { Boom } from './components/Boom';
import './styles.css';

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    {/* error waktu render ditangkep di sini — jangan sampai layarnya kosong melompong */}
    <Boom>
      <App />
    </Boom>
  </StrictMode>,
);
