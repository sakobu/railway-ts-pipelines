import type { ChangeEvent } from 'react';

// =============================================================================
// Form Types
// =============================================================================

/**
 * Represents a path to a field in a nested object structure.
 * Supports both dot notation for object properties and bracket notation for arrays.
 *
 * Field paths are used throughout the form API to identify and access nested values,
 * set validation errors, track touched state, and bind form fields to HTML elements.
 * Internally, bracket notation is normalized to dot notation (e.g., "arr[0]" → "arr.0").
 *
 * @example
 * // Dot notation for nested properties
 * "user.address.city"
 *
 * @example
 * // Bracket notation for array elements
 * "contacts[0]"
 *
 * @example
 * // Combined notation for deeply nested structures
 * "users[0].address.city"
 *
 * @example
 * // Array element with nested property
 * "team.members[2].email"
 */
export type FieldPath = string;

/**
 * Internal state maintained by the form hook.
 *
 * This represents the complete state of a form at any given time, including field values,
 * user interaction tracking, validation errors from both client and server, submission state,
 * and dirty state. The state is managed via a reducer and updated immutably.
 *
 * @template TValues - The type of form values being managed
 *
 * @example
 * // Example state for a user registration form
 * const state: FormState<UserFormValues> = {
 *   values: { email: "user@example.com", password: "***", agreeToTerms: true },
 *   touched: { "email": true, "password": true },
 *   clientErrors: { "password": "Must be at least 8 characters" },
 *   serverErrors: {},
 *   isSubmitting: false,
 *   isDirty: true
 * };
 */
export interface FormState<TValues extends Record<string, unknown>> {
  /**
   * Current values of all form fields.
   * Values are partial to allow for progressive form filling.
   */
  values: Partial<TValues>;

  /**
   * Record of which fields have been interacted with by the user.
   * A field is marked as touched when it loses focus (onBlur) or when the user
   * changes its value, depending on the validation mode.
   */
  touched: Record<FieldPath, boolean>;

  /**
   * Validation errors from client-side validation.
   * These are populated by the validator function and cleared when the field is re-validated.
   * Key is the field path, value is the error message.
   */
  clientErrors: Record<FieldPath, string>;

  /**
   * Validation errors from server-side validation.
   * These are set manually via setServerErrors() and are automatically cleared when
   * the related field value changes. Server errors take precedence over client errors.
   */
  serverErrors: Record<FieldPath, string>;

  /**
   * Whether the form is currently being submitted.
   * Set to true when handleSubmit is called, and false when submission completes or fails.
   * Useful for showing loading states on submit buttons.
   */
  isSubmitting: boolean;

  /** Whether async validation is currently in progress. */
  isValidating: boolean;

  /**
   * Whether any form values have changed since initialization or last reset.
   * Set to true when any field value changes from its initial value.
   * Useful for prompting users about unsaved changes.
   */
  isDirty: boolean;
}

/**
 * Configuration options for the useForm hook.
 *
 * These options control the form's initial state, submission behavior, and validation timing.
 * All options are optional - the form will work with minimal configuration.
 *
 * @template TValues - The type of form values being managed
 *
 * @example
 * // Minimal configuration
 * const form = useForm(userValidator);
 *
 * @example
 * // With initial values and submit handler
 * const form = useForm(userValidator, {
 *   initialValues: { email: "", password: "" },
 *   onSubmit: async (values) => {
 *     await api.register(values);
 *   }
 * });
 *
 * @example
 * // With custom validation mode
 * const form = useForm(settingsValidator, {
 *   initialValues: savedSettings,
 *   validationMode: "blur",
 *   onSubmit: saveSettings
 * });
 */
export interface FormOptions<TValues extends Record<string, unknown>> {
  /**
   * Initial values for the form fields.
   * If not provided, all fields start as undefined.
   * These values are used when the form is reset.
   */
  initialValues?: TValues;

  /**
   * Callback function that runs when the form is submitted with valid data.
   * Only called if validation passes. Can be sync or async.
   * @param values - The validated form values (guaranteed to be complete and valid)
   *
   * @example
   * onSubmit: async (values) => {
   *   const response = await fetch('/api/users', {
   *     method: 'POST',
   *     body: JSON.stringify(values)
   *   });
   *   if (!response.ok) {
   *     // Handle server errors
   *   }
   * }
   */
  onSubmit?: (values: TValues) => void | Promise<void>;

  /**
   * Validation behavior preset that controls when validation occurs and when fields are marked as touched.
   *
   * - **"live"** (default): Validate on both change and blur events. Mark fields as touched on first change.
   *   Best for immediate feedback during data entry.
   *
   * - **"blur"**: Validate only when a field loses focus. Don't mark touched on change.
   *   Best for reducing visual noise until user finishes with a field.
   *
   * - **"mount"**: Validate once on mount and mark all fields as touched immediately. No validation on change/blur.
   *   Best for displaying an existing record with validation errors visible upfront.
   *
   * - **"submit"**: Validate only when the form is submitted. Mark all fields as touched on submit.
   *   Best for simple forms where you want minimal interruption during data entry.
   *
   * @default "live"
   */
  validationMode?: 'live' | 'blur' | 'mount' | 'submit';
}

// =============================================================================
// Native HTML Props Types
// =============================================================================

/**
 * Props for native HTML text input elements and textareas.
 * These props are returned by getFieldProps() and can be spread directly onto input elements.
 *
 * Works with: <input type="text">, <input type="email">, <input type="password">,
 * <input type="url">, <input type="tel">, <input type="date">, <textarea>, etc.
 *
 * @example
 * // Basic text input
 * <input type="text" {...form.getFieldProps("username")} placeholder="Username" />
 *
 * @example
 * // Email input with additional attributes
 * <input type="email" {...form.getFieldProps("email")} required autoComplete="email" />
 *
 * @example
 * // Textarea
 * <textarea {...form.getFieldProps("bio")} rows={4} placeholder="Tell us about yourself" />
 */
export type NativeFieldProps = {
  id: string;
  name: string;
  value: string | number;
  onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onBlur: () => void;
};

/**
 * Props for native HTML select elements.
 * These props are returned by getSelectFieldProps() and can be spread directly onto select elements.
 *
 * Works with: <select> (single selection only, not multiple)
 *
 * @example
 * // Basic select
 * <select {...form.getSelectFieldProps("country")}>
 *   <option value="">Select a country</option>
 *   <option value="US">United States</option>
 *   <option value="CA">Canada</option>
 * </select>
 *
 * @example
 * // Select with dynamic options
 * <select {...form.getSelectFieldProps("role")}>
 *   {roles.map(role => (
 *     <option key={role.id} value={role.id}>{role.name}</option>
 *   ))}
 * </select>
 */
export type NativeSelectProps = {
  id: string;
  name: string;
  value: string | number;
  onChange: (e: ChangeEvent<HTMLSelectElement>) => void;
  onBlur: () => void;
};

/**
 * Props for native HTML checkbox inputs bound to boolean fields.
 * These props are returned by getCheckboxProps() and can be spread directly onto checkbox inputs.
 *
 * Works with: <input type="checkbox"> for single boolean values
 * Note: For checkbox groups (multiple checkboxes for an array), use NativeCheckboxGroupOptionProps
 *
 * @example
 * // Basic checkbox
 * <label>
 *   <input type="checkbox" {...form.getCheckboxProps("acceptTerms")} />
 *   I accept the terms and conditions
 * </label>
 *
 * @example
 * // Checkbox with separate label
 * <div>
 *   <input type="checkbox" {...form.getCheckboxProps("subscribe")} />
 *   <label htmlFor={form.getCheckboxProps("subscribe").id}>Subscribe to newsletter</label>
 * </div>
 */
export type NativeCheckboxProps = {
  id: string;
  name: string;
  checked: boolean;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onBlur: () => void;
};

/**
 * Props for native HTML switch inputs (semantically identical to checkbox, styled differently).
 * These props are returned by getSwitchProps() and can be spread directly onto checkbox inputs.
 *
 * Works with: <input type="checkbox"> styled as a toggle switch via CSS
 *
 * @example
 * // Toggle switch
 * <label className="switch">
 *   <input type="checkbox" {...form.getSwitchProps("settings.darkMode")} />
 *   <span className="slider"></span>
 * </label>
 *
 * @example
 * // Feature flag toggle
 * <div className="setting-row">
 *   <span>Enable notifications</span>
 *   <input type="checkbox" {...form.getSwitchProps("notifications.enabled")} className="toggle" />
 * </div>
 */
export type NativeSwitchProps = {
  id: string;
  name: string;
  checked: boolean;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onBlur: () => void;
};

/**
 * Props for native HTML range slider inputs.
 * These props are returned by getSliderProps() and can be spread directly onto range inputs.
 *
 * Works with: <input type="range">
 * Note: Native range inputs only support single numeric values, not arrays.
 * For multi-thumb sliders, use a UI library adapter.
 *
 * @example
 * // Volume slider
 * <div>
 *   <label htmlFor={form.getSliderProps("volume").id}>Volume: {form.values.volume}%</label>
 *   <input type="range" min={0} max={100} {...form.getSliderProps("volume")} />
 * </div>
 *
 * @example
 * // Opacity slider with step
 * <input type="range" min={0} max={1} step={0.1} {...form.getSliderProps("opacity")} />
 */
export type NativeSliderProps = {
  id: string;
  name: string;
  type: 'range';
  value: number;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onBlur: () => void;
};

/**
 * Props for native HTML file input elements.
 * These props are returned by getFileFieldProps() and can be spread directly onto file inputs.
 *
 * Works with: <input type="file"> (single or multiple files)
 *
 * @example
 * // Single file upload
 * <input type="file" accept="image/*" {...form.getFileFieldProps("avatar")} />
 *
 * @example
 * // Multiple file upload
 * <input type="file" multiple accept=".pdf,.doc,.docx" {...form.getFileFieldProps("documents")} />
 *
 * @example
 * // File upload with preview
 * <div>
 *   <input type="file" accept="image/*" {...form.getFileFieldProps("photo")} />
 *   {form.values.photo && <img src={URL.createObjectURL(form.values.photo)} alt="Preview" />}
 * </div>
 */
export type NativeFileFieldProps = {
  id: string;
  name: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onBlur: () => void;
};

/**
 * Props for a single radio button option within a radio group.
 * These props are returned by getRadioGroupOptionProps() and can be spread directly onto radio inputs.
 *
 * Works with: multiple <input type="radio"> elements sharing the same name attribute
 *
 * @example
 * // Radio group for contact method
 * <div>
 *   <label>
 *     <input type="radio" {...form.getRadioGroupOptionProps("contactMethod", "email")} />
 *     Email
 *   </label>
 *   <label>
 *     <input type="radio" {...form.getRadioGroupOptionProps("contactMethod", "phone")} />
 *     Phone
 *   </label>
 * </div>
 *
 * @example
 * // Radio group with descriptions
 * {plans.map(plan => (
 *   <label key={plan.id}>
 *     <input type="radio" {...form.getRadioGroupOptionProps("plan", plan.id)} />
 *     <div>
 *       <strong>{plan.name}</strong>
 *       <p>{plan.description}</p>
 *     </div>
 *   </label>
 * ))}
 */
export type NativeRadioGroupOptionProps = {
  id: string;
  name: string;
  value: string | number;
  checked: boolean;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onBlur: () => void;
};

/**
 * Props for a single checkbox option within a checkbox group bound to an array field.
 * These props are returned by getCheckboxGroupOptionProps() and can be spread directly onto checkbox inputs.
 *
 * Works with: multiple <input type="checkbox"> elements sharing the same name, bound to an array field
 * Note: This is different from NativeCheckboxProps, which is for single boolean checkboxes
 *
 * @example
 * // Checkbox group for selecting multiple interests
 * <div>
 *   <label>
 *     <input type="checkbox" {...form.getCheckboxGroupOptionProps("interests", "sports")} />
 *     Sports
 *   </label>
 *   <label>
 *     <input type="checkbox" {...form.getCheckboxGroupOptionProps("interests", "music")} />
 *     Music
 *   </label>
 *   <label>
 *     <input type="checkbox" {...form.getCheckboxGroupOptionProps("interests", "travel")} />
 *     Travel
 *   </label>
 * </div>
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
export type NativeCheckboxGroupOptionProps = {
  id: string;
  name: string;
  value: string | number;
  checked: boolean;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onBlur: () => void;
};

/**
 * Extracts all valid field paths from a type, including nested paths and discriminated unions.
 * This advanced utility type recursively traverses object structures to generate a union of
 * all possible dot-notation paths that can be used to access fields.
 *
 * Special handling for:
 * - Nested objects: Generates paths like "user.address.city"
 * - Arrays: Treated as terminal values (returns just "items", not "items[0]")
 * - Dates: Treated as terminal values
 * - Functions: Treated as terminal values
 * - Discriminated unions: Extracts paths from all union variants
 *
 * @template T - The type to extract field paths from
 *
 * @example
 * // Simple object
 * type User = { name: string; age: number };
 * type Paths = ExtractFieldPaths<User>; // "name" | "age"
 *
 * @example
 * // Nested object
 * type User = { name: string; address: { city: string; zip: string } };
 * type Paths = ExtractFieldPaths<User>; // "name" | "address" | "address.city" | "address.zip"
 *
 * @example
 * // With arrays (arrays are terminal)
 * type User = { name: string; tags: string[] };
 * type Paths = ExtractFieldPaths<User>; // "name" | "tags"
 *
 * @example
 * // Discriminated union
 * type Payment =
 *   | { type: "card"; cardNumber: string }
 *   | { type: "paypal"; email: string };
 * type Form = { payment: Payment };
 * type Paths = ExtractFieldPaths<Form>; // "payment" | "payment.type" | "payment.cardNumber" | "payment.email"
 */
export type ExtractFieldPaths<T> = T extends object
  ? {
      [K in keyof T]-?: K extends string | number
        ? T[K] extends
            | Date
            | readonly unknown[]
            | ((...args: never[]) => unknown)
          ? `${K}`
          : T[K] extends object | undefined
            ? T[K] extends { type: string }
              ? // Discriminated union case - extract from all possible types
                T[K] extends infer U
                ? U extends { type: infer Type }
                  ? Type extends string
                    ? // For discriminated unions, we need to extract paths from all variants
                      K | `${K}.${ExtractFieldPaths<NonNullable<T[K]>>}`
                    : never
                  : never
                : never
              : `${K}` | `${K}.${ExtractFieldPaths<NonNullable<T[K]>>}`
            : `${K}`
        : never;
    }[keyof T]
  : never;

/**
 * Constrains a field path to only valid paths for a given form type.
 * This utility type provides compile-time type safety by ensuring that only valid
 * field paths (as extracted by ExtractFieldPaths) are accepted.
 *
 * Returns the field path if valid, or never if invalid.
 * Useful for creating type-safe helper functions that work with form fields.
 *
 * @template TForm - The form values type
 * @template TField - The field path to constrain
 *
 * @example
 * // Valid path passes through
 * type User = { name: string; address: { city: string } };
 * type Valid = ValidFieldPath<User, "address.city">; // "address.city"
 *
 * @example
 * // Invalid path becomes never
 * type Invalid = ValidFieldPath<User, "address.country">; // never
 *
 * @example
 * // Use in a type-safe helper function
 * function getFieldError<TForm>(
 *   errors: Record<string, string>,
 *   field: ValidFieldPath<TForm, string>
 * ) {
 *   return errors[field];
 * }
 */
export type ValidFieldPath<TForm, TField extends string> =
  TField extends ExtractFieldPaths<TForm> ? TField : never;

/**
 * Extracts the array item type from an array field.
 * This utility type inspects a field in the form values type and returns the type
 * of items stored in the array, or never if the field is not an array.
 *
 * Works with both mutable arrays and readonly arrays.
 *
 * @template TValues - The form values type
 * @template TField - The field path (must be an array field)
 *
 * @example
 * // Extract item type from string array
 * type User = { tags: string[] };
 * type TagItem = GetArrayItemType<User, "tags">; // string
 *
 * @example
 * // Extract item type from union array
 * type User = { contacts: ("email" | "phone")[] };
 * type ContactItem = GetArrayItemType<User, "contacts">; // "email" | "phone"
 *
 * @example
 * // Extract item type from object array
 * type User = { addresses: { city: string; zip: string }[] };
 * type AddressItem = GetArrayItemType<User, "addresses">; // { city: string; zip: string }
 *
 * @example
 * // Used with arrayHelpers for type-safe array operations
 * const contactsHelpers = form.arrayHelpers<GetArrayItemType<UserForm, "contacts">>("contacts");
 */
export type GetArrayItemType<
  TValues extends Record<string, unknown>,
  TField extends keyof TValues,
> = TValues[TField] extends readonly (infer TItem)[]
  ? TItem
  : TValues[TField] extends (infer TItem)[]
    ? TItem
    : never;

/**
 * Helper functions for working with array fields in forms.
 * Provides type-safe methods to add, remove, update, and reorder array items,
 * as well as bind native HTML elements to fields within array items.
 *
 * This interface is returned by form.arrayHelpers() and provides a complete
 * toolkit for managing dynamic lists in forms (e.g., contacts, addresses, todo items).
 *
 * All mutations are performed immutably and trigger form state updates.
 *
 * @template TItem - The type of items stored in the array
 * @template TFieldPaths - Union of valid field paths for the item type (auto-extracted)
 *
 * @example
 * // Get helpers for a contacts array
 * type Contact = { name: string; email: string };
 * const contacts = form.arrayHelpers<Contact>("contacts");
 *
 * @example
 * // Render a dynamic list with add/remove
 * const helpers = form.arrayHelpers("addresses");
 * return (
 *   <div>
 *     {helpers.values.map((_, index) => (
 *       <div key={index}>
 *         <input {...helpers.getFieldProps(index, "street")} />
 *         <input {...helpers.getFieldProps(index, "city")} />
 *         <button onClick={() => helpers.remove(index)}>Remove</button>
 *       </div>
 *     ))}
 *     <button onClick={() => helpers.push({ street: "", city: "" })}>Add Address</button>
 *   </div>
 * );
 */
export interface ArrayHelpers<
  TItem,
  TFieldPaths extends string = ExtractFieldPaths<TItem>,
> {
  /**
   * Current array values. Use this to iterate over items when rendering.
   *
   * @example
   * helpers.values.map((item, index) => (
   *   <div key={index}>...</div>
   * ))
   */
  values: TItem[];

  /**
   * Adds a new item to the end of the array.
   *
   * @param value - The item to add
   *
   * @example
   * helpers.push({ name: "", email: "" });
   */
  push: (value: TItem) => void;

  /**
   * Removes an item at the specified index.
   *
   * @param index - The zero-based index of the item to remove
   *
   * @example
   * <button onClick={() => helpers.remove(index)}>Delete</button>
   */
  remove: (index: number) => void;

  /**
   * Inserts an item at the specified index. Items at and after the index shift to the right.
   *
   * @param index - The zero-based insertion position
   * @param value - The item to insert
   *
   * @example
   * helpers.insert(0, { name: "First", email: "first@example.com" });
   */
  insert: (index: number, value: TItem) => void;

  /**
   * Swaps the positions of two items. Useful for drag-and-drop reordering.
   *
   * @param indexA - The index of the first item
   * @param indexB - The index of the second item
   *
   * @example
   * <button onClick={() => helpers.swap(index, index - 1)}>Move Up</button>
   */
  swap: (indexA: number, indexB: number) => void;

  /**
   * Replaces an entire item at the specified index with a new value.
   *
   * @param index - The zero-based index of the item to replace
   * @param value - The new item value
   *
   * @example
   * helpers.replace(0, updatedContact);
   */
  replace: (index: number, value: TItem) => void;

  /**
   * Gets props for a native text input bound to a field within an array item.
   * Provides type-safe autocomplete for subField parameter.
   *
   * @param index - The zero-based index of the array item
   * @param subField - Field path within the array item (type-safe)
   * @returns Props to spread onto a native input element
   *
   * @example
   * <input type="text" {...helpers.getFieldProps(index, "name")} />
   */
  getFieldProps: (index: number, subField: TFieldPaths) => NativeFieldProps;

  /**
   * Gets props for a native select bound to a field within an array item.
   * Provides type-safe autocomplete for subField parameter.
   *
   * @param index - The zero-based index of the array item
   * @param subField - Field path within the array item (type-safe)
   * @returns Props to spread onto a native select element
   *
   * @example
   * <select {...helpers.getSelectFieldProps(index, "type")}>
   *   <option value="work">Work</option>
   *   <option value="personal">Personal</option>
   * </select>
   */
  getSelectFieldProps: (
    index: number,
    subField: TFieldPaths
  ) => NativeSelectProps;

  /**
   * Gets props for a native range input bound to a field within an array item.
   * Provides type-safe autocomplete for subField parameter.
   *
   * @param index - The zero-based index of the array item
   * @param subField - Field path within the array item (type-safe)
   * @returns Props to spread onto a native range input element
   *
   * @example
   * <input type="range" min={0} max={10} {...helpers.getSliderProps(index, "priority")} />
   */
  getSliderProps: (index: number, subField: TFieldPaths) => NativeSliderProps;

  /**
   * Gets props for a native checkbox bound to a field within an array item.
   * Provides type-safe autocomplete for subField parameter.
   *
   * @param index - The zero-based index of the array item
   * @param subField - Field path within the array item (type-safe)
   * @returns Props to spread onto a native checkbox input
   *
   * @example
   * <input type="checkbox" {...helpers.getCheckboxProps(index, "isActive")} />
   */
  getCheckboxProps: (
    index: number,
    subField: TFieldPaths
  ) => NativeCheckboxProps;

  /**
   * Gets props for a native switch (checkbox styled as switch) bound to a field within an array item.
   * Provides type-safe autocomplete for subField parameter.
   *
   * @param index - The zero-based index of the array item
   * @param subField - Field path within the array item (type-safe)
   * @returns Props to spread onto a native checkbox input (styled as switch)
   *
   * @example
   * <input type="checkbox" {...helpers.getSwitchProps(index, "enabled")} />
   */
  getSwitchProps: (index: number, subField: TFieldPaths) => NativeSwitchProps;

  /**
   * Gets props for a native file input bound to a field within an array item.
   * Provides type-safe autocomplete for subField parameter.
   *
   * @param index - The zero-based index of the array item
   * @param subField - Field path within the array item (type-safe)
   * @returns Props to spread onto a native file input
   *
   * @example
   * <input type="file" accept="image/*" {...helpers.getFileFieldProps(index, "avatar")} />
   */
  getFileFieldProps: (
    index: number,
    subField: TFieldPaths
  ) => NativeFileFieldProps;

  /**
   * Gets props for a radio group option bound to a field within an array item.
   * Provides type-safe autocomplete for subField parameter.
   *
   * @param index - The zero-based index of the array item
   * @param subField - Field path within the array item (type-safe)
   * @param optionValue - The value this radio option represents
   * @returns Props to spread onto a native radio input
   *
   * @example
   * <input type="radio" {...helpers.getRadioGroupOptionProps(index, "status", "active")} />
   */
  getRadioGroupOptionProps: (
    index: number,
    subField: TFieldPaths,
    optionValue: string | number
  ) => NativeRadioGroupOptionProps;
}

// =============================================================================
// Action Types
// =============================================================================

/**
 * Union type of all possible form actions that can be dispatched to the form reducer.
 * These actions represent state transitions in the form lifecycle.
 *
 * The reducer processes these actions to update form state immutably. Actions are
 * typically dispatched internally by form methods like setFieldValue, handleSubmit,
 * setServerErrors, etc.
 *
 * @template TValues - Type of form values being managed
 *
 * @example
 * // Dispatching a field value change
 * dispatch({
 *   type: "SET_FIELD_VALUE",
 *   field: "email",
 *   value: "user@example.com"
 * });
 *
 * @example
 * // Setting multiple validation errors
 * dispatch({
 *   type: "SET_CLIENT_ERRORS",
 *   errors: {
 *     "email": "Invalid email format",
 *     "password": "Must be at least 8 characters"
 *   }
 * });
 *
 * @example
 * // Marking all fields as touched on submit
 * dispatch({
 *   type: "MARK_ALL_TOUCHED",
 *   fields: ["name", "email", "password"]
 * });
 */
export type FormAction<TValues extends Record<string, unknown>> =
  | {
      /** Updates a single field value and optionally triggers validation */
      type: 'SET_FIELD_VALUE';
      /** The field path to update (e.g., "email" or "user.address.city") */
      field: FieldPath;
      /** The new value for the field */
      value: unknown;
      /** Whether to trigger validation after setting the value */
      shouldValidate?: boolean;
    }
  | {
      /** Updates multiple field values at once and optionally triggers validation */
      type: 'SET_VALUES';
      /** Partial object of field values to update */
      values: Partial<TValues>;
      /** Whether to trigger validation after setting values */
      shouldValidate?: boolean;
    }
  | {
      /** Marks a field as touched or untouched (user has interacted with it) */
      type: 'SET_FIELD_TOUCHED';
      /** The field path to mark */
      field: FieldPath;
      /** Whether the field is touched (true) or untouched (false) */
      isTouched: boolean;
    }
  | {
      /** Sets client-side validation errors from the validator function */
      type: 'SET_CLIENT_ERRORS';
      /** Map of field paths to error messages */
      errors: Record<FieldPath, string>;
    }
  | {
      /** Sets server-side validation errors (manually set via setServerErrors) */
      type: 'SET_SERVER_ERRORS';
      /** Map of field paths to error messages */
      errors: Record<FieldPath, string>;
    }
  | {
      /** Clears all server-side validation errors */
      type: 'CLEAR_SERVER_ERRORS';
    }
  | {
      /** Sets the form submission state (loading indicator) */
      type: 'SET_SUBMITTING';
      /** Whether the form is currently submitting */
      isSubmitting: boolean;
    }
  | {
      /** Sets the async validation state (loading indicator) */
      type: 'SET_VALIDATING';
      /** Whether async validation is currently in progress */
      isValidating: boolean;
    }
  | {
      /** Resets the form to initial values and clears all errors and touched state */
      type: 'RESET_FORM';
    }
  | {
      /** Marks all specified fields as touched (typically on submit) */
      type: 'MARK_ALL_TOUCHED';
      /** Array of field paths to mark as touched */
      fields: FieldPath[];
    };
