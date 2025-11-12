import { describe, test, expect, mock } from 'bun:test';
import {
  createNativeFieldProps,
  createNativeSelectFieldProps,
  createNativeCheckboxProps,
  createNativeSwitchProps,
  createNativeSliderProps,
  createCheckboxGroupOptionProps,
  createNativeFileFieldProps,
  createRadioGroupOptionProps,
} from '../../src/fieldPropsFactory';
import type { ChangeEvent } from 'react';

// Helper to create a mock change event
const createMockChangeEvent = <T extends HTMLElement>(
  value: string | boolean | FileList | null,
  checked?: boolean,
  files?: FileList | null,
  multiple?: boolean
): ChangeEvent<T> => {
  return {
    target: {
      value: typeof value === 'string' ? value : '',
      checked: typeof checked === 'boolean' ? checked : false,
      files: files || null,
      multiple: multiple || false,
    },
  } as unknown as ChangeEvent<T>;
};

describe('fieldPropsFactory', () => {
  describe('createNativeFieldProps', () => {
    test('converts null to empty string', () => {
      const handleChange = mock(() => {});
      const handleBlur = mock(() => {});
      const formValues = { name: null };

      const props = createNativeFieldProps(
        'name',
        formValues,
        handleChange,
        handleBlur
      );

      expect(props.value).toBe('');
    });

    test('converts undefined to empty string', () => {
      const handleChange = mock(() => {});
      const handleBlur = mock(() => {});
      const formValues = {};

      const props = createNativeFieldProps(
        'name',
        formValues,
        handleChange,
        handleBlur
      );

      expect(props.value).toBe('');
    });

    test('passes through string values', () => {
      const handleChange = mock(() => {});
      const handleBlur = mock(() => {});
      const formValues = { name: 'John Doe' };

      const props = createNativeFieldProps(
        'name',
        formValues,
        handleChange,
        handleBlur
      );

      expect(props.value).toBe('John Doe');
    });

    test('passes through number values', () => {
      const handleChange = mock(() => {});
      const handleBlur = mock(() => {});
      const formValues = { age: 25 };

      const props = createNativeFieldProps(
        'age',
        formValues,
        handleChange,
        handleBlur
      );

      expect(props.value).toBe(25);
    });

    test('converts Date to ISO date string format', () => {
      const handleChange = mock(() => {});
      const handleBlur = mock(() => {});
      const date = new Date('2024-03-15T10:30:00.000Z');
      const formValues = { birthDate: date };

      const props = createNativeFieldProps(
        'birthDate',
        formValues,
        handleChange,
        handleBlur
      );

      expect(props.value).toBe('2024-03-15');
    });

    test('converts complex objects to JSON string', () => {
      const handleChange = mock(() => {});
      const handleBlur = mock(() => {});
      const formValues = { metadata: { foo: 'bar', count: 42 } };

      const props = createNativeFieldProps(
        'metadata',
        formValues,
        handleChange,
        handleBlur
      );

      expect(props.value).toBe('{"foo":"bar","count":42}');
    });

    test('converts arrays to JSON string', () => {
      const handleChange = mock(() => {});
      const handleBlur = mock(() => {});
      const formValues = { tags: ['react', 'typescript'] };

      const props = createNativeFieldProps(
        'tags',
        formValues,
        handleChange,
        handleBlur
      );

      expect(props.value).toBe('["react","typescript"]');
    });

    test('generates correct ID from field path', () => {
      const handleChange = mock(() => {});
      const handleBlur = mock(() => {});
      const formValues = {};

      const props = createNativeFieldProps(
        'user.name',
        formValues,
        handleChange,
        handleBlur
      );

      expect(props.id).toBe('field-user-name');
    });

    test('sanitizes bracket notation in field ID', () => {
      const handleChange = mock(() => {});
      const handleBlur = mock(() => {});
      const formValues = {};

      const props = createNativeFieldProps(
        'contacts[0].email',
        formValues,
        handleChange,
        handleBlur
      );

      expect(props.id).toBe('field-contacts-0--email');
    });

    test('sets name prop to field path', () => {
      const handleChange = mock(() => {});
      const handleBlur = mock(() => {});
      const formValues = {};

      const props = createNativeFieldProps(
        'user.email',
        formValues,
        handleChange,
        handleBlur
      );

      expect(props.name).toBe('user.email');
    });

    test('onChange calls handleChange with field and new value', () => {
      const handleChange = mock(() => {});
      const handleBlur = mock(() => {});
      const formValues = { name: 'John' };

      const props = createNativeFieldProps(
        'name',
        formValues,
        handleChange,
        handleBlur
      );

      const event = createMockChangeEvent<HTMLInputElement>('Jane');
      props.onChange(event);

      expect(handleChange).toHaveBeenCalledWith('name', 'Jane');
    });

    test('onBlur calls handleBlur with field and true', () => {
      const handleChange = mock(() => {});
      const handleBlur = mock(() => {});
      const formValues = { name: 'John' };

      const props = createNativeFieldProps(
        'name',
        formValues,
        handleChange,
        handleBlur
      );

      props.onBlur();

      expect(handleBlur).toHaveBeenCalledWith('name', true);
    });
  });

  describe('createNativeSelectFieldProps', () => {
    test('converts null to empty string', () => {
      const handleChange = mock(() => {});
      const handleBlur = mock(() => {});
      const formValues = { role: null };

      const props = createNativeSelectFieldProps(
        'role',
        formValues,
        handleChange,
        handleBlur
      );

      expect(props.value).toBe('');
    });

    test('converts undefined to empty string', () => {
      const handleChange = mock(() => {});
      const handleBlur = mock(() => {});
      const formValues = {};

      const props = createNativeSelectFieldProps(
        'role',
        formValues,
        handleChange,
        handleBlur
      );

      expect(props.value).toBe('');
    });

    test('passes through string values', () => {
      const handleChange = mock(() => {});
      const handleBlur = mock(() => {});
      const formValues = { role: 'admin' };

      const props = createNativeSelectFieldProps(
        'role',
        formValues,
        handleChange,
        handleBlur
      );

      expect(props.value).toBe('admin');
    });

    test('passes through number values', () => {
      const handleChange = mock(() => {});
      const handleBlur = mock(() => {});
      const formValues = { priority: 1 };

      const props = createNativeSelectFieldProps(
        'priority',
        formValues,
        handleChange,
        handleBlur
      );

      expect(props.value).toBe(1);
    });

    test('converts complex objects to JSON string', () => {
      const handleChange = mock(() => {});
      const handleBlur = mock(() => {});
      const formValues = { data: { type: 'complex' } };

      const props = createNativeSelectFieldProps(
        'data',
        formValues,
        handleChange,
        handleBlur
      );

      expect(props.value).toBe('{"type":"complex"}');
    });

    test('generates correct ID from field path', () => {
      const handleChange = mock(() => {});
      const handleBlur = mock(() => {});
      const formValues = {};

      const props = createNativeSelectFieldProps(
        'user.role',
        formValues,
        handleChange,
        handleBlur
      );

      expect(props.id).toBe('field-user-role');
    });

    test('onChange calls handleChange with field and new value', () => {
      const handleChange = mock(() => {});
      const handleBlur = mock(() => {});
      const formValues = { role: 'user' };

      const props = createNativeSelectFieldProps(
        'role',
        formValues,
        handleChange,
        handleBlur
      );

      const event = createMockChangeEvent<HTMLSelectElement>('admin');
      props.onChange(event);

      expect(handleChange).toHaveBeenCalledWith('role', 'admin');
    });

    test('onBlur calls handleBlur with field and true', () => {
      const handleChange = mock(() => {});
      const handleBlur = mock(() => {});
      const formValues = { role: 'user' };

      const props = createNativeSelectFieldProps(
        'role',
        formValues,
        handleChange,
        handleBlur
      );

      props.onBlur();

      expect(handleBlur).toHaveBeenCalledWith('role', true);
    });
  });

  describe('createNativeCheckboxProps', () => {
    test('converts truthy values to checked=true', () => {
      const handleChange = mock(() => {});
      const handleBlur = mock(() => {});
      const formValues = { newsletter: true };

      const props = createNativeCheckboxProps(
        'newsletter',
        formValues,
        handleChange,
        handleBlur
      );

      expect(props.checked).toBe(true);
    });

    test('converts falsy values to checked=false', () => {
      const handleChange = mock(() => {});
      const handleBlur = mock(() => {});
      const formValues = { newsletter: false };

      const props = createNativeCheckboxProps(
        'newsletter',
        formValues,
        handleChange,
        handleBlur
      );

      expect(props.checked).toBe(false);
    });

    test('converts null to checked=false', () => {
      const handleChange = mock(() => {});
      const handleBlur = mock(() => {});
      const formValues = { newsletter: null };

      const props = createNativeCheckboxProps(
        'newsletter',
        formValues,
        handleChange,
        handleBlur
      );

      expect(props.checked).toBe(false);
    });

    test('converts undefined to checked=false', () => {
      const handleChange = mock(() => {});
      const handleBlur = mock(() => {});
      const formValues = {};

      const props = createNativeCheckboxProps(
        'newsletter',
        formValues,
        handleChange,
        handleBlur
      );

      expect(props.checked).toBe(false);
    });

    test('converts non-empty string to checked=true', () => {
      const handleChange = mock(() => {});
      const handleBlur = mock(() => {});
      const formValues = { newsletter: 'yes' };

      const props = createNativeCheckboxProps(
        'newsletter',
        formValues,
        handleChange,
        handleBlur
      );

      expect(props.checked).toBe(true);
    });

    test('converts empty string to checked=false', () => {
      const handleChange = mock(() => {});
      const handleBlur = mock(() => {});
      const formValues = { newsletter: '' };

      const props = createNativeCheckboxProps(
        'newsletter',
        formValues,
        handleChange,
        handleBlur
      );

      expect(props.checked).toBe(false);
    });

    test('generates correct ID from field path', () => {
      const handleChange = mock(() => {});
      const handleBlur = mock(() => {});
      const formValues = {};

      const props = createNativeCheckboxProps(
        'settings.darkMode',
        formValues,
        handleChange,
        handleBlur
      );

      expect(props.id).toBe('field-settings-darkMode');
    });

    test('onChange calls handleChange with field and checked boolean', () => {
      const handleChange = mock(() => {});
      const handleBlur = mock(() => {});
      const formValues = { newsletter: false };

      const props = createNativeCheckboxProps(
        'newsletter',
        formValues,
        handleChange,
        handleBlur
      );

      const event = createMockChangeEvent<HTMLInputElement>('', true);
      props.onChange(event);

      expect(handleChange).toHaveBeenCalledWith('newsletter', true);
    });

    test('onBlur calls handleBlur with field and true', () => {
      const handleChange = mock(() => {});
      const handleBlur = mock(() => {});
      const formValues = { newsletter: false };

      const props = createNativeCheckboxProps(
        'newsletter',
        formValues,
        handleChange,
        handleBlur
      );

      props.onBlur();

      expect(handleBlur).toHaveBeenCalledWith('newsletter', true);
    });
  });

  describe('createNativeSwitchProps', () => {
    test('converts truthy values to checked=true', () => {
      const handleChange = mock(() => {});
      const handleBlur = mock(() => {});
      const formValues = { darkMode: true };

      const props = createNativeSwitchProps(
        'darkMode',
        formValues,
        handleChange,
        handleBlur
      );

      expect(props.checked).toBe(true);
    });

    test('converts falsy values to checked=false', () => {
      const handleChange = mock(() => {});
      const handleBlur = mock(() => {});
      const formValues = { darkMode: false };

      const props = createNativeSwitchProps(
        'darkMode',
        formValues,
        handleChange,
        handleBlur
      );

      expect(props.checked).toBe(false);
    });

    test('generates correct ID from field path', () => {
      const handleChange = mock(() => {});
      const handleBlur = mock(() => {});
      const formValues = {};

      const props = createNativeSwitchProps(
        'settings.darkMode',
        formValues,
        handleChange,
        handleBlur
      );

      expect(props.id).toBe('field-settings-darkMode');
    });

    test('onChange calls handleChange with field and checked boolean', () => {
      const handleChange = mock(() => {});
      const handleBlur = mock(() => {});
      const formValues = { darkMode: false };

      const props = createNativeSwitchProps(
        'darkMode',
        formValues,
        handleChange,
        handleBlur
      );

      const event = createMockChangeEvent<HTMLInputElement>('', true);
      props.onChange(event);

      expect(handleChange).toHaveBeenCalledWith('darkMode', true);
    });

    test('onBlur calls handleBlur with field and true', () => {
      const handleChange = mock(() => {});
      const handleBlur = mock(() => {});
      const formValues = { darkMode: false };

      const props = createNativeSwitchProps(
        'darkMode',
        formValues,
        handleChange,
        handleBlur
      );

      props.onBlur();

      expect(handleBlur).toHaveBeenCalledWith('darkMode', true);
    });
  });

  describe('createNativeSliderProps', () => {
    test('converts null to 0', () => {
      const handleChange = mock(() => {});
      const handleBlur = mock(() => {});
      const formValues = { volume: null };

      const props = createNativeSliderProps(
        'volume',
        formValues,
        handleChange,
        handleBlur
      );

      expect(props.value).toBe(0);
    });

    test('converts undefined to 0', () => {
      const handleChange = mock(() => {});
      const handleBlur = mock(() => {});
      const formValues = {};

      const props = createNativeSliderProps(
        'volume',
        formValues,
        handleChange,
        handleBlur
      );

      expect(props.value).toBe(0);
    });

    test('passes through number values', () => {
      const handleChange = mock(() => {});
      const handleBlur = mock(() => {});
      const formValues = { volume: 75 };

      const props = createNativeSliderProps(
        'volume',
        formValues,
        handleChange,
        handleBlur
      );

      expect(props.value).toBe(75);
    });

    test('converts numeric string to number', () => {
      const handleChange = mock(() => {});
      const handleBlur = mock(() => {});
      const formValues = { volume: '50' };

      const props = createNativeSliderProps(
        'volume',
        formValues,
        handleChange,
        handleBlur
      );

      expect(props.value).toBe(50);
    });

    test('converts empty string to 0', () => {
      const handleChange = mock(() => {});
      const handleBlur = mock(() => {});
      const formValues = { volume: '' };

      const props = createNativeSliderProps(
        'volume',
        formValues,
        handleChange,
        handleBlur
      );

      expect(props.value).toBe(0);
    });

    test('converts non-numeric string to NaN', () => {
      const handleChange = mock(() => {});
      const handleBlur = mock(() => {});
      const formValues = { volume: 'abc' };

      const props = createNativeSliderProps(
        'volume',
        formValues,
        handleChange,
        handleBlur
      );

      expect(props.value).toBeNaN();
    });

    test('extracts first element from numeric array', () => {
      const handleChange = mock(() => {});
      const handleBlur = mock(() => {});
      const formValues = { volume: [25, 75] };

      const props = createNativeSliderProps(
        'volume',
        formValues,
        handleChange,
        handleBlur
      );

      expect(props.value).toBe(25);
    });

    test('extracts first element from string array and converts to number', () => {
      const handleChange = mock(() => {});
      const handleBlur = mock(() => {});
      const formValues = { volume: ['60', '80'] };

      const props = createNativeSliderProps(
        'volume',
        formValues,
        handleChange,
        handleBlur
      );

      expect(props.value).toBe(60);
    });

    test('converts empty array to 0', () => {
      const handleChange = mock(() => {});
      const handleBlur = mock(() => {});
      const formValues = { volume: [] };

      const props = createNativeSliderProps(
        'volume',
        formValues,
        handleChange,
        handleBlur
      );

      expect(props.value).toBe(0);
    });

    test('generates correct ID from field path', () => {
      const handleChange = mock(() => {});
      const handleBlur = mock(() => {});
      const formValues = {};

      const props = createNativeSliderProps(
        'settings.volume',
        formValues,
        handleChange,
        handleBlur
      );

      expect(props.id).toBe('field-settings-volume');
    });

    test('sets type to range', () => {
      const handleChange = mock(() => {});
      const handleBlur = mock(() => {});
      const formValues = { volume: 50 };

      const props = createNativeSliderProps(
        'volume',
        formValues,
        handleChange,
        handleBlur
      );

      expect(props.type).toBe('range');
    });

    test('onChange calls handleChange with field and number value', () => {
      const handleChange = mock(() => {});
      const handleBlur = mock(() => {});
      const formValues = { volume: 50 };

      const props = createNativeSliderProps(
        'volume',
        formValues,
        handleChange,
        handleBlur
      );

      const event = createMockChangeEvent<HTMLInputElement>('75');
      props.onChange(event);

      expect(handleChange).toHaveBeenCalledWith('volume', 75);
    });

    test('onBlur calls handleBlur with field and true', () => {
      const handleChange = mock(() => {});
      const handleBlur = mock(() => {});
      const formValues = { volume: 50 };

      const props = createNativeSliderProps(
        'volume',
        formValues,
        handleChange,
        handleBlur
      );

      props.onBlur();

      expect(handleBlur).toHaveBeenCalledWith('volume', true);
    });
  });

  describe('createCheckboxGroupOptionProps', () => {
    test('checks option when value is in array', () => {
      const handleChange = mock(() => {});
      const handleBlur = mock(() => {});
      const formValues = { interests: ['sports', 'music'] };

      const props = createCheckboxGroupOptionProps(
        'interests',
        'music',
        formValues,
        handleChange,
        handleBlur
      );

      expect(props.checked).toBe(true);
    });

    test('unchecks option when value is not in array', () => {
      const handleChange = mock(() => {});
      const handleBlur = mock(() => {});
      const formValues = { interests: ['sports'] };

      const props = createCheckboxGroupOptionProps(
        'interests',
        'music',
        formValues,
        handleChange,
        handleBlur
      );

      expect(props.checked).toBe(false);
    });

    test('handles empty array as unchecked', () => {
      const handleChange = mock(() => {});
      const handleBlur = mock(() => {});
      const formValues = { interests: [] };

      const props = createCheckboxGroupOptionProps(
        'interests',
        'music',
        formValues,
        handleChange,
        handleBlur
      );

      expect(props.checked).toBe(false);
    });

    test('handles null as empty array (unchecked)', () => {
      const handleChange = mock(() => {});
      const handleBlur = mock(() => {});
      const formValues = { interests: null };

      const props = createCheckboxGroupOptionProps(
        'interests',
        'music',
        formValues,
        handleChange,
        handleBlur
      );

      expect(props.checked).toBe(false);
    });

    test('handles undefined as empty array (unchecked)', () => {
      const handleChange = mock(() => {});
      const handleBlur = mock(() => {});
      const formValues = {};

      const props = createCheckboxGroupOptionProps(
        'interests',
        'music',
        formValues,
        handleChange,
        handleBlur
      );

      expect(props.checked).toBe(false);
    });

    test('uses string coercion for value comparison (number vs string)', () => {
      const handleChange = mock(() => {});
      const handleBlur = mock(() => {});
      const formValues = { ids: [1, 2, 3] };

      const props = createCheckboxGroupOptionProps(
        'ids',
        '2',
        formValues,
        handleChange,
        handleBlur
      );

      expect(props.checked).toBe(true);
    });

    test('uses string coercion for value comparison (string vs number)', () => {
      const handleChange = mock(() => {});
      const handleBlur = mock(() => {});
      const formValues = { ids: ['1', '2', '3'] };

      const props = createCheckboxGroupOptionProps(
        'ids',
        2,
        formValues,
        handleChange,
        handleBlur
      );

      expect(props.checked).toBe(true);
    });

    test('adds value to array when checking', () => {
      const handleChange = mock(() => {});
      const handleBlur = mock(() => {});
      const formValues = { interests: ['sports'] };

      const props = createCheckboxGroupOptionProps(
        'interests',
        'music',
        formValues,
        handleChange,
        handleBlur
      );

      const event = createMockChangeEvent<HTMLInputElement>('', true);
      props.onChange(event);

      expect(handleChange).toHaveBeenCalledWith('interests', [
        'sports',
        'music',
      ]);
    });

    test('does not add duplicate when checking already present value', () => {
      const handleChange = mock(() => {});
      const handleBlur = mock(() => {});
      const formValues = { interests: ['sports', 'music'] };

      const props = createCheckboxGroupOptionProps(
        'interests',
        'music',
        formValues,
        handleChange,
        handleBlur
      );

      const event = createMockChangeEvent<HTMLInputElement>('', true);
      props.onChange(event);

      // Should not call handleChange since value already exists
      expect(handleChange).not.toHaveBeenCalled();
    });

    test('removes value from array when unchecking', () => {
      const handleChange = mock(() => {});
      const handleBlur = mock(() => {});
      const formValues = { interests: ['sports', 'music', 'reading'] };

      const props = createCheckboxGroupOptionProps(
        'interests',
        'music',
        formValues,
        handleChange,
        handleBlur
      );

      const event = createMockChangeEvent<HTMLInputElement>('', false);
      props.onChange(event);

      expect(handleChange).toHaveBeenCalledWith('interests', [
        'sports',
        'reading',
      ]);
    });

    test('maintains immutability when adding value', () => {
      const handleChange = mock(() => {});
      const handleBlur = mock(() => {});
      const originalArray = ['sports'];
      const formValues = { interests: originalArray };

      const props = createCheckboxGroupOptionProps(
        'interests',
        'music',
        formValues,
        handleChange,
        handleBlur
      );

      const event = createMockChangeEvent<HTMLInputElement>('', true);
      props.onChange(event);

      // Original array should not be mutated
      expect(originalArray).toEqual(['sports']);
      expect(originalArray.length).toBe(1);
    });

    test('maintains immutability when removing value', () => {
      const handleChange = mock(() => {});
      const handleBlur = mock(() => {});
      const originalArray = ['sports', 'music'];
      const formValues = { interests: originalArray };

      const props = createCheckboxGroupOptionProps(
        'interests',
        'music',
        formValues,
        handleChange,
        handleBlur
      );

      const event = createMockChangeEvent<HTMLInputElement>('', false);
      props.onChange(event);

      // Original array should not be mutated
      expect(originalArray).toEqual(['sports', 'music']);
      expect(originalArray.length).toBe(2);
    });

    test('generates correct ID from field path and option value', () => {
      const handleChange = mock(() => {});
      const handleBlur = mock(() => {});
      const formValues = { interests: [] };

      const props = createCheckboxGroupOptionProps(
        'user.interests',
        'music',
        formValues,
        handleChange,
        handleBlur
      );

      expect(props.id).toBe('field-user-interests-music');
    });

    test('sets value prop to option value', () => {
      const handleChange = mock(() => {});
      const handleBlur = mock(() => {});
      const formValues = { interests: [] };

      const props = createCheckboxGroupOptionProps(
        'interests',
        'music',
        formValues,
        handleChange,
        handleBlur
      );

      expect(props.value).toBe('music');
    });

    test('onBlur calls handleBlur with field and true', () => {
      const handleChange = mock(() => {});
      const handleBlur = mock(() => {});
      const formValues = { interests: [] };

      const props = createCheckboxGroupOptionProps(
        'interests',
        'music',
        formValues,
        handleChange,
        handleBlur
      );

      props.onBlur();

      expect(handleBlur).toHaveBeenCalledWith('interests', true);
    });
  });

  describe('createRadioGroupOptionProps', () => {
    test('checks option when value matches', () => {
      const handleChange = mock(() => {});
      const handleBlur = mock(() => {});
      const formValues = { size: 'medium' };

      const props = createRadioGroupOptionProps(
        'size',
        'medium',
        formValues,
        handleChange,
        handleBlur
      );

      expect(props.checked).toBe(true);
    });

    test('unchecks option when value does not match', () => {
      const handleChange = mock(() => {});
      const handleBlur = mock(() => {});
      const formValues = { size: 'small' };

      const props = createRadioGroupOptionProps(
        'size',
        'medium',
        formValues,
        handleChange,
        handleBlur
      );

      expect(props.checked).toBe(false);
    });

    test('handles null as no match (unchecked)', () => {
      const handleChange = mock(() => {});
      const handleBlur = mock(() => {});
      const formValues = { size: null };

      const props = createRadioGroupOptionProps(
        'size',
        'medium',
        formValues,
        handleChange,
        handleBlur
      );

      expect(props.checked).toBe(false);
    });

    test('handles undefined as no match (unchecked)', () => {
      const handleChange = mock(() => {});
      const handleBlur = mock(() => {});
      const formValues = {};

      const props = createRadioGroupOptionProps(
        'size',
        'medium',
        formValues,
        handleChange,
        handleBlur
      );

      expect(props.checked).toBe(false);
    });

    test('uses string coercion for value comparison (number vs string)', () => {
      const handleChange = mock(() => {});
      const handleBlur = mock(() => {});
      const formValues = { priority: 1 };

      const props = createRadioGroupOptionProps(
        'priority',
        '1',
        formValues,
        handleChange,
        handleBlur
      );

      expect(props.checked).toBe(true);
    });

    test('uses string coercion for value comparison (string vs number)', () => {
      const handleChange = mock(() => {});
      const handleBlur = mock(() => {});
      const formValues = { priority: '2' };

      const props = createRadioGroupOptionProps(
        'priority',
        2,
        formValues,
        handleChange,
        handleBlur
      );

      expect(props.checked).toBe(true);
    });

    test('onChange calls handleChange with field and option value when checked', () => {
      const handleChange = mock(() => {});
      const handleBlur = mock(() => {});
      const formValues = { size: 'small' };

      const props = createRadioGroupOptionProps(
        'size',
        'medium',
        formValues,
        handleChange,
        handleBlur
      );

      const event = createMockChangeEvent<HTMLInputElement>('', true);
      props.onChange(event);

      expect(handleChange).toHaveBeenCalledWith('size', 'medium');
    });

    test('onChange does not call handleChange when unchecked', () => {
      const handleChange = mock(() => {});
      const handleBlur = mock(() => {});
      const formValues = { size: 'medium' };

      const props = createRadioGroupOptionProps(
        'size',
        'medium',
        formValues,
        handleChange,
        handleBlur
      );

      const event = createMockChangeEvent<HTMLInputElement>('', false);
      props.onChange(event);

      expect(handleChange).not.toHaveBeenCalled();
    });

    test('generates correct ID from field path and option value', () => {
      const handleChange = mock(() => {});
      const handleBlur = mock(() => {});
      const formValues = { size: 'small' };

      const props = createRadioGroupOptionProps(
        'product.size',
        'medium',
        formValues,
        handleChange,
        handleBlur
      );

      expect(props.id).toBe('field-product-size-medium');
    });

    test('sets value prop to option value', () => {
      const handleChange = mock(() => {});
      const handleBlur = mock(() => {});
      const formValues = { size: 'small' };

      const props = createRadioGroupOptionProps(
        'size',
        'medium',
        formValues,
        handleChange,
        handleBlur
      );

      expect(props.value).toBe('medium');
    });

    test('onBlur calls handleBlur with field and true', () => {
      const handleChange = mock(() => {});
      const handleBlur = mock(() => {});
      const formValues = { size: 'small' };

      const props = createRadioGroupOptionProps(
        'size',
        'medium',
        formValues,
        handleChange,
        handleBlur
      );

      props.onBlur();

      expect(handleBlur).toHaveBeenCalledWith('size', true);
    });
  });

  describe('createNativeFileFieldProps', () => {
    test('generates correct ID from field path', () => {
      const handleChange = mock(() => {});
      const handleBlur = mock(() => {});
      const formValues = {};

      const props = createNativeFileFieldProps(
        'avatar',
        formValues,
        handleChange,
        handleBlur
      );

      expect(props.id).toBe('field-avatar');
    });

    test('sets name prop to field path', () => {
      const handleChange = mock(() => {});
      const handleBlur = mock(() => {});
      const formValues = {};

      const props = createNativeFileFieldProps(
        'document',
        formValues,
        handleChange,
        handleBlur
      );

      expect(props.name).toBe('document');
    });

    test('onChange with single file calls handleChange with first file', () => {
      const handleChange = mock(() => {});
      const handleBlur = mock(() => {});
      const formValues = {};

      const props = createNativeFileFieldProps(
        'avatar',
        formValues,
        handleChange,
        handleBlur
      );

      const mockFile = new File(['content'], 'test.jpg', {
        type: 'image/jpeg',
      });
      const mockFiles = {
        0: mockFile,
        length: 1,
        item: () => mockFile,
      } as FileList;
      const event = createMockChangeEvent<HTMLInputElement>(
        '',
        false,
        mockFiles,
        false
      );

      props.onChange(event);

      expect(handleChange).toHaveBeenCalledWith('avatar', mockFile);
    });

    test('onChange with multiple files calls handleChange with array of files', () => {
      const handleChange = mock(() => {});
      const handleBlur = mock(() => {});
      const formValues = {};

      const props = createNativeFileFieldProps(
        'documents',
        formValues,
        handleChange,
        handleBlur
      );

      const mockFile1 = new File(['content1'], 'test1.pdf', {
        type: 'application/pdf',
      });
      const mockFile2 = new File(['content2'], 'test2.pdf', {
        type: 'application/pdf',
      });
      const mockFiles = {
        0: mockFile1,
        1: mockFile2,
        length: 2,
        item: (i: number) => [mockFile1, mockFile2][i],
      } as FileList;
      const event = createMockChangeEvent<HTMLInputElement>(
        '',
        false,
        mockFiles,
        true
      );

      props.onChange(event);

      expect(handleChange).toHaveBeenCalledWith('documents', [
        mockFile1,
        mockFile2,
      ]);
    });

    test('onChange with no files and single mode calls handleChange with null', () => {
      const handleChange = mock(() => {});
      const handleBlur = mock(() => {});
      const formValues = {};

      const props = createNativeFileFieldProps(
        'avatar',
        formValues,
        handleChange,
        handleBlur
      );

      const event = createMockChangeEvent<HTMLInputElement>(
        '',
        false,
        null,
        false
      );

      props.onChange(event);

      expect(handleChange).toHaveBeenCalledWith('avatar', null);
    });

    test('onChange with no files and multiple mode calls handleChange with empty array', () => {
      const handleChange = mock(() => {});
      const handleBlur = mock(() => {});
      const formValues = {};

      const props = createNativeFileFieldProps(
        'documents',
        formValues,
        handleChange,
        handleBlur
      );

      const event = createMockChangeEvent<HTMLInputElement>(
        '',
        false,
        null,
        true
      );

      props.onChange(event);

      expect(handleChange).toHaveBeenCalledWith('documents', []);
    });

    test('onBlur calls handleBlur with field and true', () => {
      const handleChange = mock(() => {});
      const handleBlur = mock(() => {});
      const formValues = {};

      const props = createNativeFileFieldProps(
        'avatar',
        formValues,
        handleChange,
        handleBlur
      );

      props.onBlur();

      expect(handleBlur).toHaveBeenCalledWith('avatar', true);
    });
  });
});
