import './styles.css';
import { createRoot } from 'react-dom/client';
import UserForm from './UserForm';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found');
}

const root = createRoot(rootElement);

root.render(<UserForm />);
