import './styles.css';
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import UserForm from './UserForm';
import AsyncUserForm from './AsyncUserForm';
import StandardSchemaForm from './StandardSchemaForm';

type Tab = 'sync' | 'async' | 'standard-schema';

function App() {
  const [tab, setTab] = useState<Tab>('sync');

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
        <button
          className={tab === 'standard-schema' ? 'active' : ''}
          onClick={() => setTab('standard-schema')}
        >
          Standard Schema
        </button>
      </div>
      {tab === 'sync' && <UserForm />}
      {tab === 'async' && <AsyncUserForm />}
      {tab === 'standard-schema' && <StandardSchemaForm />}
    </>
  );
}

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found');
}

const root = createRoot(rootElement);

root.render(<App />);
