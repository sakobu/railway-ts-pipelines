import { flowAsync } from '@/composition';
import {
  err,
  filterWith,
  flatMapWith,
  mapErrWith,
  mapWith,
  match,
  ok,
  orElseWith,
  tapErrWith,
  tapWith,
} from '@/result';
import {
  chain,
  email,
  formatErrors,
  max,
  min,
  nonEmpty,
  object,
  parseNumber,
  required,
  string,
  validate,
  type InferSchemaType,
  type ValidationError,
} from '@/schema';

// Schema
const orderSchema = object({
  customerEmail: required(chain(string(), nonEmpty(), email())),
  item: required(chain(string(), nonEmpty())),
  quantity: required(chain(parseNumber(), min(1), max(100))),
  unitPrice: required(chain(parseNumber(), min(0.01))),
});

// Types
type Order = InferSchemaType<typeof orderSchema>;

type OrderSummary = Order & { total: number; totalWithTax: number };

// Domain helpers
const TAX_RATE = 0.08;
const MINIMUM_ORDER_TOTAL = 10;

const formatValidationErrors = (errors: ValidationError[]) => {
  return Object.entries(formatErrors(errors))
    .map(([field, msg]) => `${field}: ${msg}`)
    .join('; ');
};

const checkInventory = (order: Order) => {
  return Promise.resolve(order.item === 'out-of-stock-widget' ? err('Item is out of stock') : ok(order));
};

// Pipeline
const processOrder = flowAsync(
  (input: unknown) => validate(input, orderSchema),
  mapErrWith(formatValidationErrors),
  tapWith((order: Order) =>
    console.log(`[tap] Validated: ${order.quantity}x ${order.item} for ${order.customerEmail}`),
  ),
  filterWith(
    (order: Order) => order.quantity * order.unitPrice >= MINIMUM_ORDER_TOTAL,
    `Order total must be at least $${MINIMUM_ORDER_TOTAL}`,
  ),
  flatMapWith((order: Order) => checkInventory(order)),
  mapWith((order: Order): OrderSummary => {
    const total = order.quantity * order.unitPrice;
    return { ...order, total, totalWithTax: +(total * (1 + TAX_RATE)).toFixed(2) };
  }),
  tapErrWith((error: string) => console.log('[tapErr]', error)),
  orElseWith((error: string) => {
    if (error === 'Item is out of stock') {
      console.log('[orElseWith] Recovering: placing back-order');
      return ok({ backordered: true, message: 'Item on back-order. You will be notified.' });
    }
    return err(error);
  }),
  (result) =>
    match(result, {
      ok: (data) => ({ success: true as const, data }),
      err: (error) => ({ success: false as const, error }),
    }),
);

// === 1. Valid order ===
console.log('=== 1. Valid order ===');
console.log(
  await processOrder({
    customerEmail: 'alice@example.com',
    item: 'widget',
    quantity: '3',
    unitPrice: '12.50',
  }),
);

// === 2. Validation errors (bad email, negative quantity) ===
console.log('\n=== 2. Validation errors (bad email, negative quantity) ===');
console.log(
  await processOrder({
    customerEmail: 'not-an-email',
    item: '',
    quantity: '-5',
    unitPrice: '10',
  }),
);

// === 3. Order total too low (filterWith rejects) ===
console.log('\n=== 3. Order total too low (filterWith rejects) ===');
console.log(
  await processOrder({
    customerEmail: 'bob@example.com',
    item: 'tiny-part',
    quantity: '1',
    unitPrice: '2.00',
  }),
);

// === 4. Out-of-stock item (flatMapWith + orElseWith recovery) ===
console.log('\n=== 4. Out-of-stock item (flatMapWith + orElseWith recovery) ===');
console.log(
  await processOrder({
    customerEmail: 'carol@example.com',
    item: 'out-of-stock-widget',
    quantity: '5',
    unitPrice: '20',
  }),
);
