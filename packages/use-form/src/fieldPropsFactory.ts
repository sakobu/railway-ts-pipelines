import type { ChangeEvent } from 'react';
import type {
  FieldPath,
  NativeFieldProps,
  NativeSelectProps,
  NativeCheckboxProps,
  NativeSwitchProps,
  NativeSliderProps,
  NativeCheckboxGroupOptionProps,
  NativeFileFieldProps,
  NativeRadioGroupOptionProps,
} from './types';
import { getValueByPath } from './utils';

// =============================================================================
// Native HTML Field Props Factories
// =============================================================================

/**
 * Creates props for a native text input element bound to a form field.
 * Automatically handles value normalization, change events, and blur tracking.
 * Works with: <input type="text">, <input type="email">, <input type="date">, <textarea>, etc.
 *
 * The returned props include id, name, value, onChange, and onBlur handlers that
 * are pre-configured to work with the form state management system.
 *
 * @param field - The path to the field in form values (supports dot notation and bracket notation)
 * @param formValues - Current form values object
 * @param handleChange - Function to update the field value in form state
 * @param handleBlur - Function to mark the field as touched in form state
 * @returns Props object to spread onto native text input elements
 *
 * @example
 * // Native text input with placeholder
 * <input type="text" {...form.getFieldProps("username")} placeholder="Username" />
 *
 * @example
 * // Native email input
 * <input type="email" {...form.getFieldProps("email")} />
 *
 * @example
 * // Native textarea
 * <textarea {...form.getFieldProps("bio")} rows={4} />
 *
 * @example
 * // Nested field path
 * <input type="text" {...form.getFieldProps("address.city")} />
 *
 * @example
 * // Date input (values are auto-converted to/from ISO format)
 * <input type="date" {...form.getFieldProps("birthDate")} />
 */
export const createNativeFieldProps = (
  field: FieldPath,
  formValues: Record<string, unknown>,
  handleChange: (field: FieldPath, value: unknown) => void,
  handleBlur: (field: FieldPath, isTouched: boolean) => void
): NativeFieldProps => {
  const raw = getValueByPath(formValues, field);

  // Normalize to string or number for native inputs
  const value = (
    raw == null
      ? ''
      : typeof raw === 'string' || typeof raw === 'number'
        ? raw
        : raw instanceof Date
          ? isNaN(raw.getTime())
            ? ''
            : raw.toISOString().split('T')[0]
          : JSON.stringify(raw)
  ) as string | number;

  return {
    id: `field-${field.replace(/[[\].]/g, '-')}`,
    name: field,
    value,
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      // For date inputs, clearing sets value to '' until a valid date is chosen
      // We forward the raw string and let validation handle emptiness/format.
      handleChange(field, e.target.value);
    },
    onBlur: () => handleBlur(field, true),
  };
};

/**
 * Creates props for a native select element bound to a form field.
 * Automatically handles value normalization, change events, and blur tracking.
 * Works with: <select> (single selection only, not multiple)
 *
 * The returned props include id, name, value, onChange, and onBlur handlers that
 * are pre-configured to work with the form state management system.
 *
 * @param field - The path to the field in form values (supports dot notation and bracket notation)
 * @param formValues - Current form values object
 * @param handleChange - Function to update the field value in form state
 * @param handleBlur - Function to mark the field as touched in form state
 * @returns Props object to spread onto native select elements
 *
 * @example
 * // Native select with default option
 * <select {...form.getSelectFieldProps("role")}>
 *   <option value="">Select a role…</option>
 *   <option value="user">User</option>
 *   <option value="admin">Admin</option>
 * </select>
 *
 * @example
 * // Select with nested field path
 * <select {...form.getSelectFieldProps("address.country")}>
 *   <option value="US">United States</option>
 *   <option value="CA">Canada</option>
 *   <option value="UK">United Kingdom</option>
 * </select>
 *
 * @example
 * // Select with dynamic options
 * <select {...form.getSelectFieldProps("category")}>
 *   {categories.map(cat => (
 *     <option key={cat.id} value={cat.id}>{cat.name}</option>
 *   ))}
 * </select>
 */
export const createNativeSelectFieldProps = (
  field: FieldPath,
  formValues: Record<string, unknown>,
  handleChange: (field: FieldPath, value: unknown) => void,
  handleBlur: (field: FieldPath, isTouched: boolean) => void
): NativeSelectProps => {
  const raw = getValueByPath(formValues, field);

  // Native select expects primitive value
  const value =
    raw == null
      ? ''
      : typeof raw === 'string' || typeof raw === 'number'
        ? raw
        : JSON.stringify(raw);

  return {
    id: `field-${field.replace(/[[\].]/g, '-')}`,
    name: field,
    value,
    onChange: (e: ChangeEvent<HTMLSelectElement>) =>
      handleChange(field, e.target.value),
    onBlur: () => handleBlur(field, true),
  };
};

/**
 * Creates props for a native checkbox input bound to a boolean form field.
 * The checkbox is checked when the field value is truthy, unchecked when falsy.
 * Automatically handles checked state, change events, and blur tracking.
 * Works with: <input type="checkbox">
 *
 * Note: For checkbox groups (multiple checkboxes bound to an array), use
 * getCheckboxGroupOptionProps instead.
 *
 * @param field - The path to the field in form values (supports dot notation and bracket notation)
 * @param formValues - Current form values object
 * @param handleChange - Function to update the field value (receives boolean) in form state
 * @param handleBlur - Function to mark the field as touched in form state
 * @returns Props object to spread onto native checkbox inputs
 *
 * @example
 * // Simple checkbox for boolean field
 * <label>
 *   <input type="checkbox" {...form.getCheckboxProps("acceptTerms")} />
 *   I accept the terms and conditions
 * </label>
 *
 * @example
 * // Nested field path
 * <label>
 *   <input type="checkbox" {...form.getCheckboxProps("preferences.newsletter")} />
 *   Subscribe to newsletter
 * </label>
 *
 * @example
 * // With accessible labeling
 * <div>
 *   <input type="checkbox" {...form.getCheckboxProps("agreeToPolicy")} />
 *   <label htmlFor={form.getCheckboxProps("agreeToPolicy").id}>
 *     I agree to the privacy policy
 *   </label>
 * </div>
 */
export const createNativeCheckboxProps = (
  field: FieldPath,
  formValues: Record<string, unknown>,
  handleChange: (field: FieldPath, value: unknown) => void,
  handleBlur: (field: FieldPath, isTouched: boolean) => void
): NativeCheckboxProps => {
  const value = getValueByPath(formValues, field);

  return {
    id: `field-${field.replace(/[[\].]/g, '-')}`,
    name: field,
    checked: !!value,
    onChange: (e: ChangeEvent<HTMLInputElement>) =>
      handleChange(field, e.target.checked),
    onBlur: () => handleBlur(field, true),
  };
};

/**
 * Creates props for a native switch input bound to a boolean form field.
 * Semantically identical to checkbox, but typically styled as a toggle switch via CSS.
 * The switch is "on" when the field value is truthy, "off" when falsy.
 * Works with: <input type="checkbox"> (styled as switch via CSS)
 *
 * This is functionally the same as createNativeCheckboxProps but exists as a separate
 * method to clarify the semantic intent when building toggle switch UIs.
 *
 * @param field - The path to the field in form values (supports dot notation and bracket notation)
 * @param formValues - Current form values object
 * @param handleChange - Function to update the field value (receives boolean) in form state
 * @param handleBlur - Function to mark the field as touched in form state
 * @returns Props object to spread onto native checkbox inputs styled as switches
 *
 * @example
 * // Native checkbox styled as switch
 * <label className="switch">
 *   <input type="checkbox" {...form.getSwitchProps("settings.darkMode")} />
 *   <span className="slider"></span>
 * </label>
 *
 * @example
 * // Switch with label
 * <div className="setting-row">
 *   <label htmlFor={form.getSwitchProps("notifications.enabled").id}>
 *     Enable Notifications
 *   </label>
 *   <input type="checkbox" {...form.getSwitchProps("notifications.enabled")} className="toggle-switch" />
 * </div>
 *
 * @example
 * // Multiple switches for feature flags
 * <input type="checkbox" {...form.getSwitchProps("features.experimentalUI")} />
 * <input type="checkbox" {...form.getSwitchProps("features.betaFeatures")} />
 */
export const createNativeSwitchProps = (
  field: FieldPath,
  formValues: Record<string, unknown>,
  handleChange: (field: FieldPath, value: unknown) => void,
  handleBlur: (field: FieldPath, isTouched: boolean) => void
): NativeSwitchProps => {
  const value = getValueByPath(formValues, field);

  return {
    id: `field-${field.replace(/[[\].]/g, '-')}`,
    name: field,
    checked: !!value,
    onChange: (e: ChangeEvent<HTMLInputElement>) =>
      handleChange(field, e.target.checked),
    onBlur: () => handleBlur(field, true),
  };
};

/**
 * Creates props for a native range input bound to a numeric form field.
 * Automatically handles value normalization, change events, and blur tracking.
 * Works with: <input type="range">
 *
 * Note: Native range inputs only support single numeric values, not arrays.
 * For multi-thumb sliders or more complex range inputs, use a UI library adapter.
 * If the field value is an array, only the first element is used.
 *
 * @param field - The path to the field in form values (supports dot notation and bracket notation)
 * @param formValues - Current form values object
 * @param handleChange - Function to update the field value (receives number) in form state
 * @param handleBlur - Function to mark the field as touched in form state
 * @returns Props object to spread onto native range input elements
 *
 * @example
 * // Basic range input with value display
 * <div>
 *   <input
 *     type="range"
 *     min={0}
 *     max={100}
 *     {...form.getSliderProps("settings.volume")}
 *   />
 *   <span>{form.values.settings?.volume}%</span>
 * </div>
 *
 * @example
 * // Range with step for decimal values
 * <input
 *   type="range"
 *   min={0}
 *   max={1}
 *   step={0.1}
 *   {...form.getSliderProps("opacity")}
 * />
 *
 * @example
 * // Age slider with min/max and labels
 * <label htmlFor={form.getSliderProps("age").id}>Age: {form.values.age}</label>
 * <input type="range" min={18} max={100} {...form.getSliderProps("age")} />
 */
export const createNativeSliderProps = (
  field: FieldPath,
  formValues: Record<string, unknown>,
  handleChange: (field: FieldPath, value: unknown) => void,
  handleBlur: (field: FieldPath, isTouched: boolean) => void
): NativeSliderProps => {
  const raw = getValueByPath(formValues, field);

  const toNumber = (v: unknown): number =>
    typeof v === 'string' ? Number(v || 0) : typeof v === 'number' ? v : 0;

  // Native range only supports single values, not arrays
  const value = Array.isArray(raw) ? toNumber(raw[0]) : toNumber(raw);

  return {
    id: `field-${field.replace(/[[\].]/g, '-')}`,
    name: field,
    type: 'range',
    value,
    onChange: (e: ChangeEvent<HTMLInputElement>) =>
      handleChange(field, Number(e.target.value)),
    onBlur: () => handleBlur(field, true),
  };
};

/**
 * Creates props for a single checkbox option within a checkbox group bound to an array field.
 * Each checkbox toggles the presence of its value in the array field.
 * Checking adds the value to the array; unchecking removes it.
 * Works with: multiple <input type="checkbox"> elements bound to the same array field
 *
 * This is different from createNativeCheckboxProps, which is for single boolean checkboxes.
 *
 * @param field - The path to the array field in form values
 * @param optionValue - The value this checkbox represents (added/removed from array)
 * @param formValues - Current form values object
 * @param handleChange - Function to update the array field value in form state
 * @param handleBlur - Function to mark the field as touched in form state
 * @returns Props object to spread onto a checkbox input in a group
 *
 * @example
 * // Multiple checkboxes for selecting interests (array field)
 * <label>
 *   <input type="checkbox" {...form.getCheckboxGroupOptionProps("interests", "sports")} />
 *   Sports
 * </label>
 * <label>
 *   <input type="checkbox" {...form.getCheckboxGroupOptionProps("interests", "music")} />
 *   Music
 * </label>
 * <label>
 *   <input type="checkbox" {...form.getCheckboxGroupOptionProps("interests", "travel")} />
 *   Travel
 * </label>
 * // form.values.interests = ["sports", "music"] when both are checked
 *
 * @example
 * // Dynamic checkbox group from data
 * {permissions.map(permission => (
 *   <label key={permission.id}>
 *     <input type="checkbox" {...form.getCheckboxGroupOptionProps("userPermissions", permission.id)} />
 *     {permission.name}
 *   </label>
 * ))}
 */
export const createCheckboxGroupOptionProps = (
  field: FieldPath,
  optionValue: string | number,
  formValues: Record<string, unknown>,
  handleChange: (field: FieldPath, value: unknown) => void,
  handleBlur: (field: FieldPath, isTouched: boolean) => void
): NativeCheckboxGroupOptionProps => {
  const raw = getValueByPath(formValues, field);
  const current = Array.isArray(raw)
    ? (raw as (string | number)[])
    : ([] as (string | number)[]);
  const isChecked = current.some((v) => String(v) === String(optionValue));

  return {
    id: `field-${field.replace(/[[\].]/g, '-')}-${String(optionValue)}`,
    name: field,
    value: optionValue,
    checked: isChecked,
    onChange: (e: ChangeEvent<HTMLInputElement>) => {
      if (e.target.checked) {
        if (!current.some((v) => String(v) === String(optionValue))) {
          handleChange(field, [...current, optionValue]);
        }
      } else {
        const next = current.filter((v) => String(v) !== String(optionValue));
        handleChange(field, next);
      }
    },
    onBlur: () => handleBlur(field, true),
  };
};

/**
 * Creates props for a native file input bound to a form field.
 * Automatically handles single or multiple file selection based on the input's `multiple` attribute.
 * Works with: <input type="file">
 *
 * When a file is selected:
 * - For single file inputs: field value is set to the File object or null if cleared
 * - For multiple file inputs: field value is set to an array of File objects or empty array if cleared
 *
 * Note: File values are not displayed in the returned props (file inputs are controlled differently).
 * Access the current file(s) via form.values[field].
 *
 * @param field - The path to the field in form values (supports dot notation and bracket notation)
 * @param _formValues - Current form values object (not used for file inputs)
 * @param handleChange - Function to update the field value (receives File, File[], or null) in form state
 * @param handleBlur - Function to mark the field as touched in form state
 * @returns Props object to spread onto native file input elements
 *
 * @example
 * // Single file upload
 * <input type="file" accept="image/*" {...form.getFileFieldProps("avatar")} />
 * {form.values.avatar && <p>Selected: {form.values.avatar.name}</p>}
 *
 * @example
 * // Multiple file upload
 * <input type="file" multiple accept=".pdf,.doc,.docx" {...form.getFileFieldProps("documents")} />
 * {form.values.documents?.length > 0 && (
 *   <ul>
 *     {form.values.documents.map((file, i) => (
 *       <li key={i}>{file.name} ({file.size} bytes)</li>
 *     ))}
 *   </ul>
 * )}
 *
 * @example
 * // File input with preview
 * <div>
 *   <input type="file" accept="image/*" {...form.getFileFieldProps("profilePic")} />
 *   {form.values.profilePic && (
 *     <img src={URL.createObjectURL(form.values.profilePic)} alt="Preview" />
 *   )}
 * </div>
 */
export const createNativeFileFieldProps = (
  field: FieldPath,
  _formValues: Record<string, unknown>,
  handleChange: (field: FieldPath, value: unknown) => void,
  handleBlur: (field: FieldPath, isTouched: boolean) => void
): NativeFileFieldProps => {
  return {
    id: `field-${field.replace(/[[\].]/g, '-')}`,
    name: field,
    onChange: (e: ChangeEvent<HTMLInputElement>) => {
      const input = e.target;
      const files = input.files;
      if (!files || files.length === 0) {
        handleChange(field, input.multiple ? [] : null);
        return;
      }
      handleChange(field, input.multiple ? Array.from(files) : files[0]!);
    },
    onBlur: () => handleBlur(field, true),
  };
};

/**
 * Creates props for a single radio button option within a radio group bound to a scalar form field.
 * Multiple radio buttons with the same field name form a group where only one can be selected.
 * Selecting a radio button sets the field value to that option's value.
 * Works with: multiple <input type="radio"> elements sharing the same name attribute
 *
 * This is used for mutually exclusive choices, unlike checkbox groups where multiple can be selected.
 *
 * @param field - The path to the field in form values (supports dot notation and bracket notation)
 * @param optionValue - The value this radio button represents
 * @param formValues - Current form values object
 * @param handleChange - Function to update the field value in form state
 * @param handleBlur - Function to mark the field as touched in form state
 * @returns Props object to spread onto a radio input in a group
 *
 * @example
 * // Radio group for selecting a contact method
 * <div>
 *   <label>
 *     <input type="radio" {...form.getRadioGroupOptionProps("contactMethod", "email")} />
 *     Email
 *   </label>
 *   <label>
 *     <input type="radio" {...form.getRadioGroupOptionProps("contactMethod", "phone")} />
 *     Phone
 *   </label>
 *   <label>
 *     <input type="radio" {...form.getRadioGroupOptionProps("contactMethod", "mail")} />
 *     Mail
 *   </label>
 * </div>
 * // form.values.contactMethod = "email" when email is selected
 *
 * @example
 * // Dynamic radio group from data
 * {sizes.map(size => (
 *   <label key={size.value}>
 *     <input type="radio" {...form.getRadioGroupOptionProps("size", size.value)} />
 *     {size.label}
 *   </label>
 * ))}
 *
 * @example
 * // Radio group with descriptions
 * <div className="radio-group">
 *   <label>
 *     <input type="radio" {...form.getRadioGroupOptionProps("plan", "free")} />
 *     <span>Free Plan</span>
 *     <small>Basic features for personal use</small>
 *   </label>
 *   <label>
 *     <input type="radio" {...form.getRadioGroupOptionProps("plan", "pro")} />
 *     <span>Pro Plan</span>
 *     <small>Advanced features for professionals</small>
 *   </label>
 * </div>
 */
export const createRadioGroupOptionProps = (
  field: FieldPath,
  optionValue: string | number,
  formValues: Record<string, unknown>,
  handleChange: (field: FieldPath, value: unknown) => void,
  handleBlur: (field: FieldPath, isTouched: boolean) => void
): NativeRadioGroupOptionProps => {
  const current = getValueByPath(formValues, field);
  const checked = String(current) === String(optionValue);

  return {
    id: `field-${field.replace(/[[\].]/g, '-')}-${String(optionValue)}`,
    name: field,
    value: optionValue,
    checked,
    onChange: (e: ChangeEvent<HTMLInputElement>) => {
      if (e.target.checked) handleChange(field, optionValue);
    },
    onBlur: () => handleBlur(field, true),
  };
};
