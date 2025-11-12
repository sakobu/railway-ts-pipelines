import type {
  ArrayHelpers,
  ExtractFieldPaths,
  FieldPath,
  NativeSelectProps,
  NativeSliderProps,
  NativeFieldProps,
  NativeCheckboxProps,
  NativeSwitchProps,
  NativeFileFieldProps,
  NativeRadioGroupOptionProps,
} from './types';

/**
 * Factory function that creates an ArrayHelpers object for managing array fields in forms.
 * Provides type-safe methods to add, remove, update, and reorder array items, as well as
 * bind native HTML elements to fields within array items.
 *
 * This is typically called internally by the useForm hook's arrayHelpers() method
 * and not used directly by consumers.
 *
 * @template TItem - The type of items stored in the array
 * @template TFieldPaths - Union of valid field paths for the item type
 *
 * @param field - The path to the array field in the form
 * @param arrayValue - The current array values
 * @param setFieldValue - Function to update a field value in the form
 * @param getFieldProps - Function to get props for native text inputs
 * @param getSelectFieldProps - Function to get props for native select elements
 * @param getSliderProps - Function to get props for native range inputs
 * @param getCheckboxProps - Function to get props for native checkboxes
 * @param getSwitchProps - Function to get props for native switches
 * @param getFileFieldProps - Function to get props for native file inputs
 * @param getRadioGroupOptionProps - Function to get props for radio group options
 * @returns An ArrayHelpers object with methods for array manipulation and field binding
 *
 * @example
 * // Used internally by useForm
 * const contactsHelpers = form.arrayHelpers("contacts");
 * contactsHelpers.push({ name: "", email: "" });
 * contactsHelpers.remove(0);
 *
 * @example
 * // Accessing nested fields in array items
 * const helpers = form.arrayHelpers("addresses");
 * return helpers.values.map((_, index) => (
 *   <input {...helpers.getFieldProps(index, "street")} />
 * ));
 */
export const createArrayHelpers = <
  TItem = unknown,
  TFieldPaths extends string = ExtractFieldPaths<TItem>,
>(
  field: FieldPath,
  arrayValue: TItem[],
  setFieldValue: (field: FieldPath, value: unknown) => void,
  getFieldProps: (field: string) => NativeFieldProps,
  getSelectFieldProps: (field: string) => NativeSelectProps,
  getSliderProps: (field: string) => NativeSliderProps,
  getCheckboxProps: (field: string) => NativeCheckboxProps,
  getSwitchProps: (field: string) => NativeSwitchProps,
  getFileFieldProps: (field: string) => NativeFileFieldProps,
  getRadioGroupOptionProps: (
    field: string,
    optionValue: string | number
  ) => NativeRadioGroupOptionProps
): ArrayHelpers<TItem, TFieldPaths> => {
  return {
    /**
     * The current array of values for this field.
     * Use this to iterate over items when rendering the form.
     *
     * @example
     * // Render array items
     * helpers.values.map((contact, index) => (
     *   <div key={index}>
     *     <input {...helpers.getFieldProps(index, "name")} />
     *   </div>
     * ))
     */
    values: arrayValue,

    /**
     * Adds a new item to the end of the array.
     * The form state is updated immutably and all subscribed components re-render.
     *
     * @param value - The item to add to the array
     *
     * @example
     * // Add a new contact
     * const helpers = form.arrayHelpers("contacts");
     * helpers.push({ name: "", email: "", phone: "" });
     */
    push: (value: TItem) => {
      const newArray = [...arrayValue, value];
      setFieldValue(field, newArray);
    },

    /**
     * Removes an item at the specified index from the array.
     * If the index is out of bounds, no action is taken.
     * The form state is updated immutably.
     *
     * @param index - The zero-based index of the item to remove
     *
     * @example
     * // Remove the second contact
     * const helpers = form.arrayHelpers("contacts");
     * helpers.remove(1);
     */
    remove: (index: number) => {
      if (index < 0 || index >= arrayValue.length) return;
      const newArray = [...arrayValue];
      newArray.splice(index, 1);
      setFieldValue(field, newArray);
    },

    /**
     * Inserts an item at the specified index in the array.
     * Items at and after the index are shifted to the right.
     * If the index is out of bounds, it's clamped to valid range [0, length].
     *
     * @param index - The zero-based insertion position
     * @param value - The item to insert
     *
     * @example
     * // Insert a contact at the beginning
     * const helpers = form.arrayHelpers("contacts");
     * helpers.insert(0, { name: "New Contact", email: "", phone: "" });
     */
    insert: (index: number, value: TItem) => {
      const clamped = Math.max(0, Math.min(index, arrayValue.length));
      const newArray = [...arrayValue];
      newArray.splice(clamped, 0, value);
      setFieldValue(field, newArray);
    },

    /**
     * Swaps the positions of two items in the array.
     * If either index is out of bounds or they are equal, no action is taken.
     * Useful for drag-and-drop reordering interfaces.
     *
     * @param indexA - The zero-based index of the first item
     * @param indexB - The zero-based index of the second item
     *
     * @example
     * // Swap first and second contacts
     * const helpers = form.arrayHelpers("contacts");
     * helpers.swap(0, 1);
     *
     * @example
     * // Move item up in list
     * const moveUp = (index: number) => {
     *   if (index > 0) helpers.swap(index, index - 1);
     * };
     */
    swap: (indexA: number, indexB: number) => {
      if (
        indexA === indexB ||
        indexA < 0 ||
        indexB < 0 ||
        indexA >= arrayValue.length ||
        indexB >= arrayValue.length
      ) {
        return;
      }
      const newArray = [...arrayValue];

      const a = newArray[indexA];
      const b = newArray[indexB];
      if (a === undefined || b === undefined) {
        return;
      }

      newArray[indexA] = b;
      newArray[indexB] = a;
      setFieldValue(field, newArray);
    },

    /**
     * Replaces an entire item at the specified index with a new value.
     * If the index is out of bounds, no action is taken.
     *
     * @param index - The zero-based index of the item to replace
     * @param value - The new item value
     *
     * @example
     * // Replace a contact entirely
     * const helpers = form.arrayHelpers("contacts");
     * helpers.replace(0, { name: "John Doe", email: "john@example.com", phone: "555-0100" });
     */
    replace: (index: number, value: TItem) => {
      if (index < 0 || index >= arrayValue.length) return;
      const newArray = [...arrayValue];
      newArray[index] = value;
      setFieldValue(field, newArray);
    },

    /**
     * Gets props for a native text input bound to a field within an array item.
     * Provides type-safe field path autocomplete for nested fields.
     * Works with: <input type="text">, <input type="email">, <textarea>, etc.
     *
     * @param index - The zero-based index of the array item
     * @param subField - The field path within the array item (type-safe and autocompleted)
     * @returns Props object to spread onto a native input element
     *
     * @example
     * // Text input for contact name
     * helpers.values.map((_, index) => (
     *   <input type="text" {...helpers.getFieldProps(index, "name")} />
     * ))
     */
    getFieldProps: (index: number, subField: TFieldPaths) => {
      const path = `${field}[${index}].${subField}`;
      return getFieldProps(path);
    },

    /**
     * Gets props for a native select element bound to a field within an array item.
     * Provides type-safe field path autocomplete for nested fields.
     * Works with: <select>
     *
     * @param index - The zero-based index of the array item
     * @param subField - The field path within the array item (type-safe and autocompleted)
     * @returns Props object to spread onto a native select element
     *
     * @example
     * // Select for contact type
     * <select {...helpers.getSelectFieldProps(index, "type")}>
     *   <option value="work">Work</option>
     *   <option value="personal">Personal</option>
     * </select>
     */
    getSelectFieldProps: (index: number, subField: TFieldPaths) => {
      const path = `${field}[${index}].${subField}`;
      return getSelectFieldProps(path);
    },

    /**
     * Gets props for a native range input bound to a field within an array item.
     * Provides type-safe field path autocomplete for nested fields.
     * Works with: <input type="range">
     *
     * @param index - The zero-based index of the array item
     * @param subField - The field path within the array item (type-safe and autocompleted)
     * @returns Props object to spread onto a native range input element
     *
     * @example
     * // Range slider for priority
     * <input type="range" min={0} max={10} {...helpers.getSliderProps(index, "priority")} />
     */
    getSliderProps: (index: number, subField: TFieldPaths) => {
      const path = `${field}[${index}].${subField}`;
      return getSliderProps(path);
    },

    /**
     * Gets props for a native checkbox bound to a field within an array item.
     * Provides type-safe field path autocomplete for nested fields.
     * Works with: <input type="checkbox">
     *
     * @param index - The zero-based index of the array item
     * @param subField - The field path within the array item (type-safe and autocompleted)
     * @returns Props object to spread onto a native checkbox input
     *
     * @example
     * // Checkbox for marking contact as favorite
     * <input type="checkbox" {...helpers.getCheckboxProps(index, "isFavorite")} />
     */
    getCheckboxProps: (index: number, subField: TFieldPaths) => {
      const path = `${field}[${index}].${subField}`;
      return getCheckboxProps(path);
    },

    /**
     * Gets props for a native switch (checkbox styled as switch) bound to a field within an array item.
     * Provides type-safe field path autocomplete for nested fields.
     * Works with: <input type="checkbox"> (styled as switch via CSS)
     *
     * @param index - The zero-based index of the array item
     * @param subField - The field path within the array item (type-safe and autocompleted)
     * @returns Props object to spread onto a native checkbox input
     *
     * @example
     * // Switch for enabling/disabling a feature
     * <label className="switch">
     *   <input type="checkbox" {...helpers.getSwitchProps(index, "enabled")} />
     *   <span className="slider"></span>
     * </label>
     */
    getSwitchProps: (index: number, subField: TFieldPaths) => {
      const path = `${field}[${index}].${subField}`;
      return getSwitchProps(path);
    },

    /**
     * Gets props for a native file input bound to a field within an array item.
     * Provides type-safe field path autocomplete for nested fields.
     * Works with: <input type="file">
     *
     * @param index - The zero-based index of the array item
     * @param subField - The field path within the array item (type-safe and autocompleted)
     * @returns Props object to spread onto a native file input
     *
     * @example
     * // File input for contact avatar
     * <input type="file" accept="image/*" {...helpers.getFileFieldProps(index, "avatar")} />
     */
    getFileFieldProps: (index: number, subField: TFieldPaths) => {
      const path = `${field}[${index}].${subField}`;
      return getFileFieldProps(path);
    },

    /**
     * Gets props for a radio group option bound to a field within an array item.
     * Provides type-safe field path autocomplete for nested fields.
     * Works with: multiple <input type="radio"> elements sharing the same name
     *
     * @param index - The zero-based index of the array item
     * @param subField - The field path within the array item (type-safe and autocompleted)
     * @param optionValue - The value this radio option represents
     * @returns Props object to spread onto a native radio input
     *
     * @example
     * // Radio group for contact method preference
     * <label>
     *   <input type="radio" {...helpers.getRadioGroupOptionProps(index, "preferredMethod", "email")} />
     *   Email
     * </label>
     * <label>
     *   <input type="radio" {...helpers.getRadioGroupOptionProps(index, "preferredMethod", "phone")} />
     *   Phone
     * </label>
     */
    getRadioGroupOptionProps: (
      index: number,
      subField: TFieldPaths,
      optionValue: string | number
    ) => {
      const path = `${field}[${index}].${subField}`;
      return getRadioGroupOptionProps(path, optionValue);
    },
  };
};
