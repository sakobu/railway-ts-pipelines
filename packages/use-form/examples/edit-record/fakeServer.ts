import { err, ok, type Result } from '@railway-ts/pipelines/result';

import type { ContactForm } from './contactSchema';
import type { ValidationError } from '@railway-ts/pipelines/schema';

export type Contact = ContactForm & { id: string; version: number };

const contacts = new Map<string, Contact>([
  ['ada', { id: 'ada', name: 'Ada Lovelace', email: 'ada@example.com', role: 'admin', version: 1 }],
  ['grace', { id: 'grace', name: 'Grace Hopper', email: 'grace@example.com', role: 'editor', version: 1 }],
  ['alan', { id: 'alan', name: 'Alan Turing', email: 'alan@example.com', role: 'viewer', version: 1 }],
]);

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const getContact = (id: string): Contact => {
  const contact = contacts.get(id);
  if (!contact) throw new Error(`Unknown contact: ${id}`);
  return contact;
};

export const listContacts = (): Contact[] => [...contacts.values()];

export const fetchContact = async (id: string): Promise<Contact> => {
  await delay(300);
  return { ...getContact(id) };
};

export const saveContact = async (
  id: string,
  values: ContactForm,
  version: number,
): Promise<Result<Contact, ValidationError[]>> => {
  await delay(600);
  const current = getContact(id);

  if (current.version !== version) {
    return err([{ path: [], message: 'Someone else saved this contact. Reload to see their changes.' }]);
  }

  const saved: Contact = { ...current, ...values, name: values.name.trim(), version: version + 1 };
  contacts.set(id, saved);
  return ok({ ...saved });
};

// Another user changes the stored email. The app only sees it after a refetch.
export const simulateOtherUserEdit = (id: string): void => {
  const current = getContact(id);
  contacts.set(id, {
    ...current,
    email: `${current.name.split(' ')[0]?.toLowerCase() ?? 'user'}+${current.version + 1}@elsewhere.example`,
    version: current.version + 1,
  });
};
