import { describe, test, expect, mock } from 'bun:test';
import { createArrayHelpers } from '../../src/arrayHelpersFactory';
import type {
  NativeFieldProps,
  NativeSelectProps,
  NativeSliderProps,
  NativeCheckboxProps,
  NativeSwitchProps,
  NativeFileFieldProps,
  NativeRadioGroupOptionProps,
} from '../../src/types';

// Helper type for test items
type TestItem = { id: number; name?: string };

// Helper to create mock field prop functions
const createMockFieldProps = () => ({
  getFieldProps: mock(
    (_field: string): NativeFieldProps => ({
      id: 'test',
      name: 'test',
      value: '',
      onChange: () => {},
      onBlur: () => {},
    })
  ),
  getSelectFieldProps: mock(
    (_field: string): NativeSelectProps => ({
      id: 'test',
      name: 'test',
      value: '',
      onChange: () => {},
      onBlur: () => {},
    })
  ),
  getSliderProps: mock(
    (_field: string): NativeSliderProps => ({
      id: 'test',
      name: 'test',
      type: 'range',
      value: 0,
      onChange: () => {},
      onBlur: () => {},
    })
  ),
  getCheckboxProps: mock(
    (_field: string): NativeCheckboxProps => ({
      id: 'test',
      name: 'test',
      checked: false,
      onChange: () => {},
      onBlur: () => {},
    })
  ),
  getSwitchProps: mock(
    (_field: string): NativeSwitchProps => ({
      id: 'test',
      name: 'test',
      checked: false,
      onChange: () => {},
      onBlur: () => {},
    })
  ),
  getFileFieldProps: mock(
    (_field: string): NativeFileFieldProps => ({
      id: 'test',
      name: 'test',
      onChange: () => {},
      onBlur: () => {},
    })
  ),
  getRadioGroupOptionProps: mock(
    (
      _field: string,
      _optionValue: string | number
    ): NativeRadioGroupOptionProps => ({
      id: 'test',
      name: 'test',
      value: 'test',
      checked: false,
      onChange: () => {},
      onBlur: () => {},
    })
  ),
});

describe('arrayHelpersFactory', () => {
  describe('push', () => {
    test('adds item to end of non-empty array', () => {
      const initial: TestItem[] = [{ id: 1 }, { id: 2 }];
      const setFieldValue = mock(() => {});
      const mocks = createMockFieldProps();

      const helpers = createArrayHelpers(
        'items',
        initial,
        setFieldValue,
        mocks.getFieldProps,
        mocks.getSelectFieldProps,
        mocks.getSliderProps,
        mocks.getCheckboxProps,
        mocks.getSwitchProps,
        mocks.getFileFieldProps,
        mocks.getRadioGroupOptionProps
      );

      helpers.push({ id: 3 });

      expect(setFieldValue).toHaveBeenCalledTimes(1);
      expect(setFieldValue).toHaveBeenCalledWith('items', [
        { id: 1 },
        { id: 2 },
        { id: 3 },
      ]);
    });

    test('adds item to empty array', () => {
      const initial: TestItem[] = [];
      const setFieldValue = mock(() => {});
      const mocks = createMockFieldProps();

      const helpers = createArrayHelpers(
        'items',
        initial,
        setFieldValue,
        mocks.getFieldProps,
        mocks.getSelectFieldProps,
        mocks.getSliderProps,
        mocks.getCheckboxProps,
        mocks.getSwitchProps,
        mocks.getFileFieldProps,
        mocks.getRadioGroupOptionProps
      );

      helpers.push({ id: 1 });

      expect(setFieldValue).toHaveBeenCalledWith('items', [{ id: 1 }]);
    });

    test('maintains immutability - does not mutate original array', () => {
      const initial: TestItem[] = [{ id: 1 }];
      const setFieldValue = mock(() => {});
      const mocks = createMockFieldProps();

      const helpers = createArrayHelpers(
        'items',
        initial,
        setFieldValue,
        mocks.getFieldProps,
        mocks.getSelectFieldProps,
        mocks.getSliderProps,
        mocks.getCheckboxProps,
        mocks.getSwitchProps,
        mocks.getFileFieldProps,
        mocks.getRadioGroupOptionProps
      );

      helpers.push({ id: 2 });

      // Original array should be unchanged
      expect(initial).toEqual([{ id: 1 }]);
      expect(initial.length).toBe(1);
    });
  });

  describe('remove', () => {
    test('removes item at valid index', () => {
      const initial: TestItem[] = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const setFieldValue = mock(() => {});
      const mocks = createMockFieldProps();

      const helpers = createArrayHelpers(
        'items',
        initial,
        setFieldValue,
        mocks.getFieldProps,
        mocks.getSelectFieldProps,
        mocks.getSliderProps,
        mocks.getCheckboxProps,
        mocks.getSwitchProps,
        mocks.getFileFieldProps,
        mocks.getRadioGroupOptionProps
      );

      helpers.remove(1);

      expect(setFieldValue).toHaveBeenCalledWith('items', [
        { id: 1 },
        { id: 3 },
      ]);
    });

    test('removes first item (index 0)', () => {
      const initial: TestItem[] = [{ id: 1 }, { id: 2 }];
      const setFieldValue = mock(() => {});
      const mocks = createMockFieldProps();

      const helpers = createArrayHelpers(
        'items',
        initial,
        setFieldValue,
        mocks.getFieldProps,
        mocks.getSelectFieldProps,
        mocks.getSliderProps,
        mocks.getCheckboxProps,
        mocks.getSwitchProps,
        mocks.getFileFieldProps,
        mocks.getRadioGroupOptionProps
      );

      helpers.remove(0);

      expect(setFieldValue).toHaveBeenCalledWith('items', [{ id: 2 }]);
    });

    test('removes last item', () => {
      const initial: TestItem[] = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const setFieldValue = mock(() => {});
      const mocks = createMockFieldProps();

      const helpers = createArrayHelpers(
        'items',
        initial,
        setFieldValue,
        mocks.getFieldProps,
        mocks.getSelectFieldProps,
        mocks.getSliderProps,
        mocks.getCheckboxProps,
        mocks.getSwitchProps,
        mocks.getFileFieldProps,
        mocks.getRadioGroupOptionProps
      );

      helpers.remove(2);

      expect(setFieldValue).toHaveBeenCalledWith('items', [
        { id: 1 },
        { id: 2 },
      ]);
    });

    test('no-op with negative index', () => {
      const initial: TestItem[] = [{ id: 1 }];
      const setFieldValue = mock(() => {});
      const mocks = createMockFieldProps();

      const helpers = createArrayHelpers(
        'items',
        initial,
        setFieldValue,
        mocks.getFieldProps,
        mocks.getSelectFieldProps,
        mocks.getSliderProps,
        mocks.getCheckboxProps,
        mocks.getSwitchProps,
        mocks.getFileFieldProps,
        mocks.getRadioGroupOptionProps
      );

      helpers.remove(-1);

      expect(setFieldValue).not.toHaveBeenCalled();
    });

    test('no-op with index >= length', () => {
      const initial: TestItem[] = [{ id: 1 }];
      const setFieldValue = mock(() => {});
      const mocks = createMockFieldProps();

      const helpers = createArrayHelpers(
        'items',
        initial,
        setFieldValue,
        mocks.getFieldProps,
        mocks.getSelectFieldProps,
        mocks.getSliderProps,
        mocks.getCheckboxProps,
        mocks.getSwitchProps,
        mocks.getFileFieldProps,
        mocks.getRadioGroupOptionProps
      );

      helpers.remove(5);

      expect(setFieldValue).not.toHaveBeenCalled();
    });

    test('no-op with empty array', () => {
      const initial: TestItem[] = [];
      const setFieldValue = mock(() => {});
      const mocks = createMockFieldProps();

      const helpers = createArrayHelpers(
        'items',
        initial,
        setFieldValue,
        mocks.getFieldProps,
        mocks.getSelectFieldProps,
        mocks.getSliderProps,
        mocks.getCheckboxProps,
        mocks.getSwitchProps,
        mocks.getFileFieldProps,
        mocks.getRadioGroupOptionProps
      );

      helpers.remove(0);

      expect(setFieldValue).not.toHaveBeenCalled();
    });

    test('maintains immutability', () => {
      const initial: TestItem[] = [{ id: 1 }, { id: 2 }];
      const setFieldValue = mock(() => {});
      const mocks = createMockFieldProps();

      const helpers = createArrayHelpers(
        'items',
        initial,
        setFieldValue,
        mocks.getFieldProps,
        mocks.getSelectFieldProps,
        mocks.getSliderProps,
        mocks.getCheckboxProps,
        mocks.getSwitchProps,
        mocks.getFileFieldProps,
        mocks.getRadioGroupOptionProps
      );

      helpers.remove(0);

      expect(initial).toEqual([{ id: 1 }, { id: 2 }]);
      expect(initial.length).toBe(2);
    });
  });

  describe('insert', () => {
    test('inserts at beginning (index 0)', () => {
      const initial: TestItem[] = [{ id: 2 }, { id: 3 }];
      const setFieldValue = mock(() => {});
      const mocks = createMockFieldProps();

      const helpers = createArrayHelpers(
        'items',
        initial,
        setFieldValue,
        mocks.getFieldProps,
        mocks.getSelectFieldProps,
        mocks.getSliderProps,
        mocks.getCheckboxProps,
        mocks.getSwitchProps,
        mocks.getFileFieldProps,
        mocks.getRadioGroupOptionProps
      );

      helpers.insert(0, { id: 1 });

      expect(setFieldValue).toHaveBeenCalledWith('items', [
        { id: 1 },
        { id: 2 },
        { id: 3 },
      ]);
    });

    test('inserts in middle', () => {
      const initial: TestItem[] = [{ id: 1 }, { id: 3 }];
      const setFieldValue = mock(() => {});
      const mocks = createMockFieldProps();

      const helpers = createArrayHelpers(
        'items',
        initial,
        setFieldValue,
        mocks.getFieldProps,
        mocks.getSelectFieldProps,
        mocks.getSliderProps,
        mocks.getCheckboxProps,
        mocks.getSwitchProps,
        mocks.getFileFieldProps,
        mocks.getRadioGroupOptionProps
      );

      helpers.insert(1, { id: 2 });

      expect(setFieldValue).toHaveBeenCalledWith('items', [
        { id: 1 },
        { id: 2 },
        { id: 3 },
      ]);
    });

    test('inserts at end (index === length)', () => {
      const initial: TestItem[] = [{ id: 1 }];
      const setFieldValue = mock(() => {});
      const mocks = createMockFieldProps();

      const helpers = createArrayHelpers(
        'items',
        initial,
        setFieldValue,
        mocks.getFieldProps,
        mocks.getSelectFieldProps,
        mocks.getSliderProps,
        mocks.getCheckboxProps,
        mocks.getSwitchProps,
        mocks.getFileFieldProps,
        mocks.getRadioGroupOptionProps
      );

      helpers.insert(1, { id: 2 });

      expect(setFieldValue).toHaveBeenCalledWith('items', [
        { id: 1 },
        { id: 2 },
      ]);
    });

    test('clamps negative index to 0', () => {
      const initial: TestItem[] = [{ id: 2 }];
      const setFieldValue = mock(() => {});
      const mocks = createMockFieldProps();

      const helpers = createArrayHelpers(
        'items',
        initial,
        setFieldValue,
        mocks.getFieldProps,
        mocks.getSelectFieldProps,
        mocks.getSliderProps,
        mocks.getCheckboxProps,
        mocks.getSwitchProps,
        mocks.getFileFieldProps,
        mocks.getRadioGroupOptionProps
      );

      helpers.insert(-5, { id: 1 });

      expect(setFieldValue).toHaveBeenCalledWith('items', [
        { id: 1 },
        { id: 2 },
      ]);
    });

    test('clamps index > length to length', () => {
      const initial: TestItem[] = [{ id: 1 }];
      const setFieldValue = mock(() => {});
      const mocks = createMockFieldProps();

      const helpers = createArrayHelpers(
        'items',
        initial,
        setFieldValue,
        mocks.getFieldProps,
        mocks.getSelectFieldProps,
        mocks.getSliderProps,
        mocks.getCheckboxProps,
        mocks.getSwitchProps,
        mocks.getFileFieldProps,
        mocks.getRadioGroupOptionProps
      );

      helpers.insert(100, { id: 2 });

      expect(setFieldValue).toHaveBeenCalledWith('items', [
        { id: 1 },
        { id: 2 },
      ]);
    });

    test('works with empty array', () => {
      const initial: TestItem[] = [];
      const setFieldValue = mock(() => {});
      const mocks = createMockFieldProps();

      const helpers = createArrayHelpers(
        'items',
        initial,
        setFieldValue,
        mocks.getFieldProps,
        mocks.getSelectFieldProps,
        mocks.getSliderProps,
        mocks.getCheckboxProps,
        mocks.getSwitchProps,
        mocks.getFileFieldProps,
        mocks.getRadioGroupOptionProps
      );

      helpers.insert(0, { id: 1 });

      expect(setFieldValue).toHaveBeenCalledWith('items', [{ id: 1 }]);
    });

    test('maintains immutability', () => {
      const initial: TestItem[] = [{ id: 1 }];
      const setFieldValue = mock(() => {});
      const mocks = createMockFieldProps();

      const helpers = createArrayHelpers(
        'items',
        initial,
        setFieldValue,
        mocks.getFieldProps,
        mocks.getSelectFieldProps,
        mocks.getSliderProps,
        mocks.getCheckboxProps,
        mocks.getSwitchProps,
        mocks.getFileFieldProps,
        mocks.getRadioGroupOptionProps
      );

      helpers.insert(0, { id: 0 });

      expect(initial).toEqual([{ id: 1 }]);
      expect(initial.length).toBe(1);
    });
  });

  describe('swap', () => {
    test('swaps items at valid indices', () => {
      const initial: TestItem[] = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const setFieldValue = mock(() => {});
      const mocks = createMockFieldProps();

      const helpers = createArrayHelpers(
        'items',
        initial,
        setFieldValue,
        mocks.getFieldProps,
        mocks.getSelectFieldProps,
        mocks.getSliderProps,
        mocks.getCheckboxProps,
        mocks.getSwitchProps,
        mocks.getFileFieldProps,
        mocks.getRadioGroupOptionProps
      );

      helpers.swap(0, 2);

      expect(setFieldValue).toHaveBeenCalledWith('items', [
        { id: 3 },
        { id: 2 },
        { id: 1 },
      ]);
    });

    test('swaps first and last items', () => {
      const initial: TestItem[] = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const setFieldValue = mock(() => {});
      const mocks = createMockFieldProps();

      const helpers = createArrayHelpers(
        'items',
        initial,
        setFieldValue,
        mocks.getFieldProps,
        mocks.getSelectFieldProps,
        mocks.getSliderProps,
        mocks.getCheckboxProps,
        mocks.getSwitchProps,
        mocks.getFileFieldProps,
        mocks.getRadioGroupOptionProps
      );

      helpers.swap(0, 2);

      expect(setFieldValue).toHaveBeenCalledWith('items', [
        { id: 3 },
        { id: 2 },
        { id: 1 },
      ]);
    });

    test('swaps adjacent items', () => {
      const initial: TestItem[] = [{ id: 1 }, { id: 2 }];
      const setFieldValue = mock(() => {});
      const mocks = createMockFieldProps();

      const helpers = createArrayHelpers(
        'items',
        initial,
        setFieldValue,
        mocks.getFieldProps,
        mocks.getSelectFieldProps,
        mocks.getSliderProps,
        mocks.getCheckboxProps,
        mocks.getSwitchProps,
        mocks.getFileFieldProps,
        mocks.getRadioGroupOptionProps
      );

      helpers.swap(0, 1);

      expect(setFieldValue).toHaveBeenCalledWith('items', [
        { id: 2 },
        { id: 1 },
      ]);
    });

    test('no-op when indices are equal', () => {
      const initial: TestItem[] = [{ id: 1 }, { id: 2 }];
      const setFieldValue = mock(() => {});
      const mocks = createMockFieldProps();

      const helpers = createArrayHelpers(
        'items',
        initial,
        setFieldValue,
        mocks.getFieldProps,
        mocks.getSelectFieldProps,
        mocks.getSliderProps,
        mocks.getCheckboxProps,
        mocks.getSwitchProps,
        mocks.getFileFieldProps,
        mocks.getRadioGroupOptionProps
      );

      helpers.swap(0, 0);

      expect(setFieldValue).not.toHaveBeenCalled();
    });

    test('no-op with negative indices', () => {
      const initial: TestItem[] = [{ id: 1 }, { id: 2 }];
      const setFieldValue = mock(() => {});
      const mocks = createMockFieldProps();

      const helpers = createArrayHelpers(
        'items',
        initial,
        setFieldValue,
        mocks.getFieldProps,
        mocks.getSelectFieldProps,
        mocks.getSliderProps,
        mocks.getCheckboxProps,
        mocks.getSwitchProps,
        mocks.getFileFieldProps,
        mocks.getRadioGroupOptionProps
      );

      helpers.swap(-1, 1);

      expect(setFieldValue).not.toHaveBeenCalled();
    });

    test('no-op with out-of-bounds indices', () => {
      const initial: TestItem[] = [{ id: 1 }];
      const setFieldValue = mock(() => {});
      const mocks = createMockFieldProps();

      const helpers = createArrayHelpers(
        'items',
        initial,
        setFieldValue,
        mocks.getFieldProps,
        mocks.getSelectFieldProps,
        mocks.getSliderProps,
        mocks.getCheckboxProps,
        mocks.getSwitchProps,
        mocks.getFileFieldProps,
        mocks.getRadioGroupOptionProps
      );

      helpers.swap(0, 5);

      expect(setFieldValue).not.toHaveBeenCalled();
    });

    test('no-op with single-item array', () => {
      const initial: TestItem[] = [{ id: 1 }];
      const setFieldValue = mock(() => {});
      const mocks = createMockFieldProps();

      const helpers = createArrayHelpers(
        'items',
        initial,
        setFieldValue,
        mocks.getFieldProps,
        mocks.getSelectFieldProps,
        mocks.getSliderProps,
        mocks.getCheckboxProps,
        mocks.getSwitchProps,
        mocks.getFileFieldProps,
        mocks.getRadioGroupOptionProps
      );

      helpers.swap(0, 1);

      expect(setFieldValue).not.toHaveBeenCalled();
    });

    test('maintains immutability', () => {
      const initial: TestItem[] = [{ id: 1 }, { id: 2 }];
      const setFieldValue = mock(() => {});
      const mocks = createMockFieldProps();

      const helpers = createArrayHelpers(
        'items',
        initial,
        setFieldValue,
        mocks.getFieldProps,
        mocks.getSelectFieldProps,
        mocks.getSliderProps,
        mocks.getCheckboxProps,
        mocks.getSwitchProps,
        mocks.getFileFieldProps,
        mocks.getRadioGroupOptionProps
      );

      helpers.swap(0, 1);

      expect(initial).toEqual([{ id: 1 }, { id: 2 }]);
    });
  });

  describe('replace', () => {
    test('replaces item at valid index', () => {
      const initial: TestItem[] = [{ id: 1 }, { id: 2 }];
      const setFieldValue = mock(() => {});
      const mocks = createMockFieldProps();

      const helpers = createArrayHelpers(
        'items',
        initial,
        setFieldValue,
        mocks.getFieldProps,
        mocks.getSelectFieldProps,
        mocks.getSliderProps,
        mocks.getCheckboxProps,
        mocks.getSwitchProps,
        mocks.getFileFieldProps,
        mocks.getRadioGroupOptionProps
      );

      helpers.replace(1, { id: 3 });

      expect(setFieldValue).toHaveBeenCalledWith('items', [
        { id: 1 },
        { id: 3 },
      ]);
    });

    test('replaces first item', () => {
      const initial: TestItem[] = [{ id: 1 }, { id: 2 }];
      const setFieldValue = mock(() => {});
      const mocks = createMockFieldProps();

      const helpers = createArrayHelpers(
        'items',
        initial,
        setFieldValue,
        mocks.getFieldProps,
        mocks.getSelectFieldProps,
        mocks.getSliderProps,
        mocks.getCheckboxProps,
        mocks.getSwitchProps,
        mocks.getFileFieldProps,
        mocks.getRadioGroupOptionProps
      );

      helpers.replace(0, { id: 0 });

      expect(setFieldValue).toHaveBeenCalledWith('items', [
        { id: 0 },
        { id: 2 },
      ]);
    });

    test('replaces last item', () => {
      const initial: TestItem[] = [{ id: 1 }, { id: 2 }];
      const setFieldValue = mock(() => {});
      const mocks = createMockFieldProps();

      const helpers = createArrayHelpers(
        'items',
        initial,
        setFieldValue,
        mocks.getFieldProps,
        mocks.getSelectFieldProps,
        mocks.getSliderProps,
        mocks.getCheckboxProps,
        mocks.getSwitchProps,
        mocks.getFileFieldProps,
        mocks.getRadioGroupOptionProps
      );

      helpers.replace(1, { id: 3 });

      expect(setFieldValue).toHaveBeenCalledWith('items', [
        { id: 1 },
        { id: 3 },
      ]);
    });

    test('no-op with negative index', () => {
      const initial: TestItem[] = [{ id: 1 }];
      const setFieldValue = mock(() => {});
      const mocks = createMockFieldProps();

      const helpers = createArrayHelpers(
        'items',
        initial,
        setFieldValue,
        mocks.getFieldProps,
        mocks.getSelectFieldProps,
        mocks.getSliderProps,
        mocks.getCheckboxProps,
        mocks.getSwitchProps,
        mocks.getFileFieldProps,
        mocks.getRadioGroupOptionProps
      );

      helpers.replace(-1, { id: 0 });

      expect(setFieldValue).not.toHaveBeenCalled();
    });

    test('no-op with index >= length', () => {
      const initial: TestItem[] = [{ id: 1 }];
      const setFieldValue = mock(() => {});
      const mocks = createMockFieldProps();

      const helpers = createArrayHelpers(
        'items',
        initial,
        setFieldValue,
        mocks.getFieldProps,
        mocks.getSelectFieldProps,
        mocks.getSliderProps,
        mocks.getCheckboxProps,
        mocks.getSwitchProps,
        mocks.getFileFieldProps,
        mocks.getRadioGroupOptionProps
      );

      helpers.replace(5, { id: 2 });

      expect(setFieldValue).not.toHaveBeenCalled();
    });

    test('maintains immutability', () => {
      const initial: TestItem[] = [{ id: 1 }];
      const setFieldValue = mock(() => {});
      const mocks = createMockFieldProps();

      const helpers = createArrayHelpers(
        'items',
        initial,
        setFieldValue,
        mocks.getFieldProps,
        mocks.getSelectFieldProps,
        mocks.getSliderProps,
        mocks.getCheckboxProps,
        mocks.getSwitchProps,
        mocks.getFileFieldProps,
        mocks.getRadioGroupOptionProps
      );

      helpers.replace(0, { id: 2 });

      expect(initial).toEqual([{ id: 1 }]);
    });
  });

  describe('field props methods', () => {
    test('getFieldProps constructs correct path and delegates', () => {
      type Contact = { email: string };
      const mockGetFieldProps = mock(
        (_field: string): NativeFieldProps => ({
          id: 'test',
          name: 'test',
          value: '',
          onChange: () => {},
          onBlur: () => {},
        })
      );
      const mocks = createMockFieldProps();

      const helpers = createArrayHelpers<Contact, 'email'>(
        'contacts',
        [{ email: 'test@example.com' }],
        () => {},
        mockGetFieldProps,
        mocks.getSelectFieldProps,
        mocks.getSliderProps,
        mocks.getCheckboxProps,
        mocks.getSwitchProps,
        mocks.getFileFieldProps,
        mocks.getRadioGroupOptionProps
      );

      helpers.getFieldProps(0, 'email');

      expect(mockGetFieldProps).toHaveBeenCalledWith('contacts[0].email');
    });

    test('getSelectFieldProps constructs correct path and delegates', () => {
      type Item = { category: string };
      const mockGetSelectFieldProps = mock(
        (_field: string): NativeSelectProps => ({
          id: 'test',
          name: 'test',
          value: '',
          onChange: () => {},
          onBlur: () => {},
        })
      );
      const mocks = createMockFieldProps();

      const helpers = createArrayHelpers<Item, 'category'>(
        'items',
        [{ category: 'A' }],
        () => {},
        mocks.getFieldProps,
        mockGetSelectFieldProps,
        mocks.getSliderProps,
        mocks.getCheckboxProps,
        mocks.getSwitchProps,
        mocks.getFileFieldProps,
        mocks.getRadioGroupOptionProps
      );

      helpers.getSelectFieldProps(2, 'category');

      expect(mockGetSelectFieldProps).toHaveBeenCalledWith('items[2].category');
    });

    test('getSliderProps constructs correct path and delegates', () => {
      type Item = { volume: number };
      const mockGetSliderProps = mock(
        (_field: string): NativeSliderProps => ({
          id: 'test',
          name: 'test',
          type: 'range',
          value: 0,
          onChange: () => {},
          onBlur: () => {},
        })
      );
      const mocks = createMockFieldProps();

      const helpers = createArrayHelpers<Item, 'volume'>(
        'items',
        [{ volume: 50 }],
        () => {},
        mocks.getFieldProps,
        mocks.getSelectFieldProps,
        mockGetSliderProps,
        mocks.getCheckboxProps,
        mocks.getSwitchProps,
        mocks.getFileFieldProps,
        mocks.getRadioGroupOptionProps
      );

      helpers.getSliderProps(1, 'volume');

      expect(mockGetSliderProps).toHaveBeenCalledWith('items[1].volume');
    });

    test('getCheckboxProps constructs correct path and delegates', () => {
      type Item = { active: boolean };
      const mockGetCheckboxProps = mock(
        (_field: string): NativeCheckboxProps => ({
          id: 'test',
          name: 'test',
          checked: false,
          onChange: () => {},
          onBlur: () => {},
        })
      );
      const mocks = createMockFieldProps();

      const helpers = createArrayHelpers<Item, 'active'>(
        'items',
        [{ active: true }],
        () => {},
        mocks.getFieldProps,
        mocks.getSelectFieldProps,
        mocks.getSliderProps,
        mockGetCheckboxProps,
        mocks.getSwitchProps,
        mocks.getFileFieldProps,
        mocks.getRadioGroupOptionProps
      );

      helpers.getCheckboxProps(0, 'active');

      expect(mockGetCheckboxProps).toHaveBeenCalledWith('items[0].active');
    });

    test('getSwitchProps constructs correct path and delegates', () => {
      type Item = { enabled: boolean };
      const mockGetSwitchProps = mock(
        (_field: string): NativeSwitchProps => ({
          id: 'test',
          name: 'test',
          checked: false,
          onChange: () => {},
          onBlur: () => {},
        })
      );
      const mocks = createMockFieldProps();

      const helpers = createArrayHelpers<Item, 'enabled'>(
        'items',
        [{ enabled: false }],
        () => {},
        mocks.getFieldProps,
        mocks.getSelectFieldProps,
        mocks.getSliderProps,
        mocks.getCheckboxProps,
        mockGetSwitchProps,
        mocks.getFileFieldProps,
        mocks.getRadioGroupOptionProps
      );

      helpers.getSwitchProps(3, 'enabled');

      expect(mockGetSwitchProps).toHaveBeenCalledWith('items[3].enabled');
    });

    test('getFileFieldProps constructs correct path and delegates', () => {
      type Item = { avatar: File | null };
      const mockGetFileFieldProps = mock(
        (_field: string): NativeFileFieldProps => ({
          id: 'test',
          name: 'test',
          onChange: () => {},
          onBlur: () => {},
        })
      );
      const mocks = createMockFieldProps();

      const helpers = createArrayHelpers<Item, 'avatar'>(
        'items',
        [{ avatar: null }],
        () => {},
        mocks.getFieldProps,
        mocks.getSelectFieldProps,
        mocks.getSliderProps,
        mocks.getCheckboxProps,
        mocks.getSwitchProps,
        mockGetFileFieldProps,
        mocks.getRadioGroupOptionProps
      );

      helpers.getFileFieldProps(0, 'avatar');

      expect(mockGetFileFieldProps).toHaveBeenCalledWith('items[0].avatar');
    });

    test('getRadioGroupOptionProps constructs correct path and delegates with optionValue', () => {
      type Item = { size: string };
      const mockGetRadioGroupOptionProps = mock(
        (
          _field: string,
          _optionValue: string | number
        ): NativeRadioGroupOptionProps => ({
          id: 'test',
          name: 'test',
          value: 'test',
          checked: false,
          onChange: () => {},
          onBlur: () => {},
        })
      );
      const mocks = createMockFieldProps();

      const helpers = createArrayHelpers<Item, 'size'>(
        'items',
        [{ size: 'M' }],
        () => {},
        mocks.getFieldProps,
        mocks.getSelectFieldProps,
        mocks.getSliderProps,
        mocks.getCheckboxProps,
        mocks.getSwitchProps,
        mocks.getFileFieldProps,
        mockGetRadioGroupOptionProps
      );

      helpers.getRadioGroupOptionProps(0, 'size', 'L');

      expect(mockGetRadioGroupOptionProps).toHaveBeenCalledWith(
        'items[0].size',
        'L'
      );
    });

    test('field props methods work with different indices', () => {
      type Item = { name: string };
      const mockGetFieldProps = mock(
        (_field: string): NativeFieldProps => ({
          id: 'test',
          name: 'test',
          value: '',
          onChange: () => {},
          onBlur: () => {},
        })
      );
      const mocks = createMockFieldProps();

      const helpers = createArrayHelpers<Item, 'name'>(
        'items',
        [{ name: 'A' }, { name: 'B' }, { name: 'C' }],
        () => {},
        mockGetFieldProps,
        mocks.getSelectFieldProps,
        mocks.getSliderProps,
        mocks.getCheckboxProps,
        mocks.getSwitchProps,
        mocks.getFileFieldProps,
        mocks.getRadioGroupOptionProps
      );

      helpers.getFieldProps(0, 'name');
      helpers.getFieldProps(1, 'name');
      helpers.getFieldProps(2, 'name');

      expect(mockGetFieldProps).toHaveBeenNthCalledWith(1, 'items[0].name');
      expect(mockGetFieldProps).toHaveBeenNthCalledWith(2, 'items[1].name');
      expect(mockGetFieldProps).toHaveBeenNthCalledWith(3, 'items[2].name');
    });
  });

  describe('values property', () => {
    test('exposes array values', () => {
      const initial: TestItem[] = [{ id: 1 }, { id: 2 }];
      const setFieldValue = mock(() => {});
      const mocks = createMockFieldProps();

      const helpers = createArrayHelpers(
        'items',
        initial,
        setFieldValue,
        mocks.getFieldProps,
        mocks.getSelectFieldProps,
        mocks.getSliderProps,
        mocks.getCheckboxProps,
        mocks.getSwitchProps,
        mocks.getFileFieldProps,
        mocks.getRadioGroupOptionProps
      );

      expect(helpers.values).toEqual([{ id: 1 }, { id: 2 }]);
    });

    test('values reference initial array', () => {
      const initial: TestItem[] = [{ id: 1 }];
      const setFieldValue = mock(() => {});
      const mocks = createMockFieldProps();

      const helpers = createArrayHelpers(
        'items',
        initial,
        setFieldValue,
        mocks.getFieldProps,
        mocks.getSelectFieldProps,
        mocks.getSliderProps,
        mocks.getCheckboxProps,
        mocks.getSwitchProps,
        mocks.getFileFieldProps,
        mocks.getRadioGroupOptionProps
      );

      expect(helpers.values).toBe(initial);
    });
  });
});
