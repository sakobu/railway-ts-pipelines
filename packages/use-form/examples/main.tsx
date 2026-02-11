import './styles.css';
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import UserForm from './UserForm';
import AsyncUserForm from './AsyncUserForm';

function App() {
  const [tab, setTab] = useState<'sync' | 'async'>('sync');

  return (
    <>
      <div className="tabs">
        <button
          className={tab === 'sync' ? 'active' : ''}
          onClick={() => setTab('sync')}
        >
          Sync
        </button>
        <button
          className={tab === 'async' ? 'active' : ''}
          onClick={() => setTab('async')}
        >
          Async
        </button>
      </div>
      {tab === 'sync' ? <UserForm /> : <AsyncUserForm />}
    </>
  );
}

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found');
}

const root = createRoot(rootElement);

root.render(<App />);
