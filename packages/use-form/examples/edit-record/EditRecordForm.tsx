import { err } from '@railway-ts/pipelines/result';
import { ROOT_ERROR_KEY } from '@railway-ts/pipelines/schema';
import { useCallback, useEffect, useState } from 'react';

import { useForm } from '../../src/';

import { contactSchema, type ContactForm } from './contactSchema';
import { fetchContact, listContacts, saveContact, simulateOtherUserEdit, type Contact } from './fakeServer';

// Built once, so the empty defaults are the same on every render
const EMPTY_CONTACT: ContactForm = { name: '', email: '', role: 'viewer' };

// Map only the fields the form shows. `version` changes on every save, so
// including it would make each save look like a new version of the form.
const toFormValues = (record?: Contact): ContactForm =>
  record ? { name: record.name, email: record.email, role: record.role } : EMPTY_CONTACT;

export default function EditRecordForm() {
  const [selectedId, setSelectedId] = useState(() => listContacts()[0]?.id ?? '');
  // Keeps the last loaded contact while the next one loads, so the form stays mounted
  const [data, setData] = useState<Contact | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    void fetchContact(selectedId).then((contact) => {
      if (!cancelled) setData(contact);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  // Refetch the loaded contact. Ignored if the user has moved on to another one.
  const refetch = useCallback(async (id: string) => {
    const fresh = await fetchContact(id);
    setData((current) => (current?.id === id ? fresh : current));
  }, []);

  const form = useForm(contactSchema, {
    initialValues: toFormValues(data),
    resetKey: data?.id,
    onSubmit: async (values) => {
      // Save is disabled until the contact loads, but the type needs the guard.
      // Return a Result on every path: a bare `return` can't mix with them.
      if (!data) return err([{ path: [], message: 'The contact has not loaded yet.' }]);

      const result = await saveContact(data.id, values, data.version);

      if (result.ok) {
        setData(result.value);
      } else {
        // Fetch what the other user saved. isStale turns true when it arrives.
        void refetch(data.id);
      }
      return result;
    },
  });

  const simulateOtherUser = (andRefetch: boolean) => {
    // Both buttons are disabled until the contact loads, but the type needs the guard
    if (!data) return;
    simulateOtherUserEdit(data.id);
    if (andRefetch) void refetch(data.id);
  };

  // While the next contact loads, the form still shows the last one. The form starts over when the next one
  // arrives, so typing meanwhile would be lost, and so would the outcome of a save of the last one: the fields
  // and Save are disabled until then.
  const loading = data?.id !== selectedId;

  const touchedCount = Object.values(form.touched).filter(Boolean).length;

  return (
    <form onSubmit={(e) => void form.handleSubmit(e)}>
      <h2>Edit Contact</h2>

      <div className="record-list">
        {listContacts().map((contact) => (
          <button
            key={contact.id}
            type="button"
            className={contact.id === selectedId ? 'active' : ''}
            onClick={() => setSelectedId(contact.id)}
            disabled={form.isSubmitting}
          >
            {contact.id}
          </button>
        ))}
      </div>

      <div className="button-row">
        <button type="button" onClick={() => simulateOtherUser(true)} disabled={!data}>
          Another user saves
        </button>
        <button type="button" onClick={() => simulateOtherUser(false)} disabled={!data}>
          Another user saves (not fetched yet)
        </button>
      </div>

      {form.isStale && (
        <div className="stale-banner" role="alert">
          <span>This contact changed on the server</span>
          <button type="button" onClick={() => form.resetForm()}>
            Reload
          </button>
        </div>
      )}

      <div className="field">
        <label htmlFor={form.getFieldId('name')}>Name *</label>
        <input type="text" {...form.getFieldProps('name')} disabled={loading} />
        {form.getFieldError('name') && <span className="error">{form.getFieldError('name')}</span>}
      </div>

      <div className="field">
        <label htmlFor={form.getFieldId('email')}>Email *</label>
        <input type="email" {...form.getFieldProps('email')} disabled={loading} />
        {form.getFieldError('email') && <span className="error">{form.getFieldError('email')}</span>}
      </div>

      <div className="field">
        <label htmlFor={form.getFieldId('role')}>Role *</label>
        <select {...form.getSelectFieldProps('role')} disabled={loading}>
          <option value="admin">Admin</option>
          <option value="editor">Editor</option>
          <option value="viewer">Viewer</option>
        </select>
        {form.getFieldError('role') && <span className="error">{form.getFieldError('role')}</span>}
      </div>

      <div className="actions">
        <button type="submit" disabled={!data || loading || form.isSubmitting || form.isStale}>
          {form.isSubmitting ? 'Saving...' : 'Save'}
        </button>
        <button type="button" onClick={() => form.resetForm()} disabled={form.isSubmitting}>
          Reset
        </button>
      </div>

      {form.errors[ROOT_ERROR_KEY] && <span className="error">{form.errors[ROOT_ERROR_KEY]}</span>}

      <div className="badges">
        <span className={`badge ${form.isDirty ? 'on' : ''}`}>isDirty: {String(form.isDirty)}</span>
        <span className={`badge ${form.isStale ? 'on' : ''}`}>isStale: {String(form.isStale)}</span>
        <span className="badge">touched: {touchedCount}</span>
        <span className="badge">submitCount: {form.submitCount}</span>
        <span className={`badge ${form.isSubmitting ? 'on' : ''}`}>isSubmitting: {String(form.isSubmitting)}</span>
      </div>
    </form>
  );
}
