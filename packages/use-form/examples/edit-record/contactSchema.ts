import * as S from '@railway-ts/pipelines/schema';

export const contactSchema = S.object({
  name: S.required(S.chain(S.string(), S.nonEmpty('Name is required'))),
  email: S.required(S.chain(S.string(), S.nonEmpty('Email is required'), S.email())),
  role: S.required(S.stringEnum(['admin', 'editor', 'viewer'])),
});

export type ContactForm = S.InferSchemaType<typeof contactSchema>;
