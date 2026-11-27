import { test, expect, mock } from 'bun:test';

import { createCheckEvents, type EventRecord, type EventRequests } from '../../src/checkEvents';

test('a body that asks for no check runs no pass', () => {
  const events = createCheckEvents(() => {});
  const pass = mock(() => {});
  events.run(() => {}, pass);
  expect(pass).not.toHaveBeenCalled();
});

test('the outermost pass runs once, after the body, with what every nested body recorded', () => {
  const events = createCheckEvents(() => {});
  const order: string[] = [];
  const inner = mock(() => {});
  const pass = mock((record: EventRecord) => {
    order.push('pass');
    expect([...record.paths]).toEqual(['a', 'b']);
  });
  events.run((requests) => {
    requests.check({ paths: ['a'] });
    events.run((nested) => nested.check({ paths: ['b'] }), inner);
    order.push('body');
  }, pass);
  expect(order).toEqual(['body', 'pass']);
  expect(pass).toHaveBeenCalledTimes(1);
  expect(inner).not.toHaveBeenCalled();
});

test('a body that throws runs no pass, and the next event starts fresh', () => {
  const events = createCheckEvents(() => {});
  const boom = new Error('boom');
  const pass = mock((_record: EventRecord) => {});

  expect(() =>
    events.run((requests) => {
      requests.check({ paths: ['a'] });
      throw boom;
    }, pass),
  ).toThrow(boom);
  expect(pass).not.toHaveBeenCalled();

  events.run(() => {}, pass);
  expect(pass).not.toHaveBeenCalled();

  events.run((requests) => requests.check(), pass);
  expect(pass).toHaveBeenCalledTimes(1);
  expect([...pass.mock.calls[0]![0].paths]).toEqual([]);
});

test('a throw from the pass reaches the caller, and the next event still runs its pass', () => {
  const events = createCheckEvents(() => {});
  const boom = new Error('boom');
  const asksForCheck = (requests: EventRequests) => requests.check();

  expect(() =>
    events.run(asksForCheck, () => {
      throw boom;
    }),
  ).toThrow(boom);

  const pass = mock(() => {});
  events.run(asksForCheck, pass);
  expect(pass).toHaveBeenCalledTimes(1);
});

test('a call made from inside the pass is an event of its own', () => {
  const events = createCheckEvents(() => {});
  const inner = mock(() => {});
  events.run(
    (requests) => requests.check(),
    () => events.run((requests) => requests.check(), inner),
  );
  expect(inner).toHaveBeenCalledTimes(1);
});

test('a check records the paths, the named fields and the validator keys it reaches', () => {
  const events = createCheckEvents(() => {});
  const pass = mock((_record: EventRecord) => {});

  events.run((requests) => {
    requests.check({ paths: ['a'], named: ['b'] });
    requests.check({ validators: ['x', 'y'] });
  }, pass);

  const record = pass.mock.calls[0]![0];
  expect([...record.paths]).toEqual(['a']);
  expect([...record.named]).toEqual(['b']);
  expect([...record.validators]).toEqual(['x', 'y']);
});

test('an event with no caller runs at once when none is running, and reports its throw', () => {
  const report = mock((_error: unknown) => {});
  const events = createCheckEvents(report);
  const boom = new Error('boom');

  events.runUncalled(
    (requests) => requests.check(),
    () => {
      throw boom;
    },
  );

  expect(report).toHaveBeenCalledWith(boom);
});

test('an event with no caller that starts inside a running one runs as its own once that one has ended', () => {
  const report = mock((_error: unknown) => {});
  const events = createCheckEvents(report);
  const order: string[] = [];
  const own = mock((record: EventRecord) => {
    order.push('own pass');
    expect([...record.paths]).toEqual(['b']);
  });
  const boom = new Error('boom');

  expect(() =>
    events.run(
      (requests) => {
        requests.check({ paths: ['a'] });
        events.runUncalled((uncalled) => {
          order.push('own body');
          uncalled.check({ paths: ['b'] });
        }, own);
        order.push('caller body');
      },
      (record) => {
        order.push('caller pass');
        expect([...record.paths]).toEqual(['a']);
        throw boom;
      },
    ),
  ).toThrow(boom);

  expect(order).toEqual(['caller body', 'caller pass', 'own body', 'own pass']);
  expect(report).not.toHaveBeenCalled();
});

test('an event with no caller waits through a call made from inside the pass of the event it started in', () => {
  const events = createCheckEvents(() => {});
  const order: string[] = [];

  events.run(
    (requests) => {
      requests.check();
      events.runUncalled(
        (uncalled) => uncalled.check(),
        () => order.push('own pass'),
      );
    },
    () => {
      events.run(
        (requests) => requests.check(),
        () => order.push('inner pass'),
      );
      order.push('caller pass');
    },
  );

  expect(order).toEqual(['inner pass', 'caller pass', 'own pass']);
});

test("an event with no caller still runs when the caller's body throws, and its throw is reported", () => {
  const report = mock((_error: unknown) => {});
  const events = createCheckEvents(report);
  const callerBoom = new Error('caller');
  const ownBoom = new Error('own');

  expect(() =>
    events.run(() => {
      events.runUncalled(
        (requests) => requests.check(),
        () => {
          throw ownBoom;
        },
      );
      throw callerBoom;
    }, mock()),
  ).toThrow(callerBoom);

  expect(report).toHaveBeenCalledWith(ownBoom);
});
