// With exactOptionalPropertyTypes on, an option whose absence means "use the default" must accept an explicit
// undefined, so a conditional option like `validationMode: mode` compiles.
import * as S from '@railway-ts/pipelines/schema';

import { useForm, useFormAutoSubmission, type FormMessages } from '../../src';

import type { FormOptions } from '../../src/types';

/** The optional keys of T that reject an explicit undefined. Needs exactOptionalPropertyTypes: without it, every optional key is listed. */
type KeysRejectingUndefined<T> = {
  [K in keyof T]-?: Partial<Pick<T, K>> extends Pick<T, K> ? (undefined extends Required<T>[K] ? never : K) : never;
}[keyof T];

/** `{}` fits only when every optional key of T accepts undefined; otherwise the error names the keys that don't. */
type AcceptsUndefined<T> = Record<KeysRejectingUndefined<T>, never>;

const schema = S.object({
  name: S.required(S.string()),
  address: S.object({ city: S.required(S.string()) }),
});
type Values = S.InferSchemaType<typeof schema>;

export const formOptions: AcceptsUndefined<FormOptions<Values>> = {};
export const fieldValidatorEntries: AcceptsUndefined<NonNullable<FormOptions<Values>['fieldValidators']>> = {};
export const formMessages: AcceptsUndefined<FormMessages> = {};
export const autoSubmitForm: AcceptsUndefined<Parameters<typeof useFormAutoSubmission<Values>>[0]> = {};

declare const maybeMode: 'live' | 'blur' | undefined;
declare const maybeText: string | undefined;
declare const maybeStale: boolean | undefined;
declare const checkCity: boolean;
declare const isKnownCity: (city: string) => string | undefined;

export function useMaybeOptions() {
  const form = useForm(schema, {
    initialValues: { name: '', address: { city: '' } },
    validationMode: maybeMode,
    fieldValidators: { 'address.city': checkCity ? isKnownCity : undefined },
    messages: { submitFailed: maybeText },
  });
  useFormAutoSubmission({ ...form, isStale: maybeStale });

  // A value type, not an option: setValues stores what it's given, so undefined stays an error for a string field
  // @ts-expect-error -- name is a string
  form.setValues({ name: undefined });
}
