import './styles.css';
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import UserForm from './sync/UserForm';
import AsyncUserForm from './async/AsyncUserForm';
import ZodForm from './standard-schema/ZodForm';
import ValibotForm from './standard-schema/ValibotForm';
import FieldValidatorForm from './field-validators/FieldValidatorForm';

type Tab = 'sync' | 'async' | 'zod' | 'valibot' | 'field-validators';

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
          Async (Cross-field)
        </button>
        <button
          className={tab === 'zod' ? 'active' : ''}
          onClick={() => setTab('zod')}
        >
          Zod
        </button>
        <button
          className={tab === 'valibot' ? 'active' : ''}
          onClick={() => setTab('valibot')}
        >
          Valibot
        </button>
        <button
          className={tab === 'field-validators' ? 'active' : ''}
          onClick={() => setTab('field-validators')}
        >
          Field Validators
        </button>
      </div>
      {tab === 'sync' && <UserForm />}
      {tab === 'async' && <AsyncUserForm />}
      {tab === 'zod' && <ZodForm />}
      {tab === 'valibot' && <ValibotForm />}
      {tab === 'field-validators' && <FieldValidatorForm />}
    </>
  );
}

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found');
}

const root = createRoot(rootElement);

root.render(<App />);
