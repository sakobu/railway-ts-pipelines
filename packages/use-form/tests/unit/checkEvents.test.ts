import { test, expect, mock } from 'bun:test';

import { createCheckEvents, type CheckEvents, type EventRecord, type RequestCheck } from '../../src/checkEvents';

/** A body that asks for the schema check only. */
const asksForCheck = (requestCheck: RequestCheck): void => requestCheck();

/** Starts an event with no caller that asks for a check, whose pass adds the error's message to `order`, and throws. */
const startThrowing = (events: CheckEvents, order: string[], error: Error): void =>
  events.runUncalled(asksForCheck, () => {
    order.push(error.message);
    throw error;
  });

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
  events.run((requestCheck) => {
    requestCheck({ paths: ['a'] });
    events.run((nestedCheck) => nestedCheck({ paths: ['b'] }), inner);
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
    events.run((requestCheck) => {
      requestCheck({ paths: ['a'] });
      throw boom;
    }, pass),
  ).toThrow(boom);
  expect(pass).not.toHaveBeenCalled();

  events.run(() => {}, pass);
  expect(pass).not.toHaveBeenCalled();

  events.run(asksForCheck, pass);
  expect(pass).toHaveBeenCalledTimes(1);
  expect([...pass.mock.calls[0]![0].paths]).toEqual([]);
});

test('a throw from the pass reaches the caller, and the next event still runs its pass', () => {
  const events = createCheckEvents(() => {});
  const boom = new Error('boom');

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
  events.run(asksForCheck, () => events.run(asksForCheck, inner));
  expect(inner).toHaveBeenCalledTimes(1);
});

test('a check records the paths and the named fields it reaches, joined with the other checks', () => {
  const events = createCheckEvents(() => {});
  const pass = mock((_record: EventRecord) => {});

  events.run((requestCheck) => {
    requestCheck({ paths: ['a'], named: ['b'] });
    requestCheck({ paths: ['a', 'c'] });
  }, pass);

  const record = pass.mock.calls[0]![0];
  expect([...record.paths]).toEqual(['a', 'c']);
  expect([...record.named]).toEqual(['b']);
});

test('an event with no caller runs at once when none is running, and reports its throw', () => {
  const report = mock((_error: unknown) => {});
  const events = createCheckEvents(report);
  const boom = new Error('boom');

  events.runUncalled(asksForCheck, () => {
    throw boom;
  });

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
      (requestCheck) => {
        requestCheck({ paths: ['a'] });
        events.runUncalled((uncalledCheck) => {
          order.push('own body');
          uncalledCheck({ paths: ['b'] });
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
    (requestCheck) => {
      requestCheck();
      events.runUncalled(asksForCheck, () => order.push('own pass'));
    },
    () => {
      events.run(asksForCheck, () => order.push('inner pass'));
      order.push('caller pass');
    },
  );

  expect(order).toEqual(['inner pass', 'caller pass', 'own pass']);
});

test('an event with no caller that starts inside a pass, or inside a call made from it, runs once the outer pass has ended, in order, and its throw is reported', () => {
  const report = mock((_error: unknown) => {});
  const events = createCheckEvents(report);
  const order: string[] = [];
  const fromPass = new Error('from the pass');
  const fromCallBody = new Error("from a call's body");
  const fromCallPass = new Error("from a call's pass");

  expect(() =>
    events.run(asksForCheck, () => {
      startThrowing(events, order, fromPass);
      events.run(
        (requestCheck) => {
          requestCheck();
          startThrowing(events, order, fromCallBody);
        },
        () => startThrowing(events, order, fromCallPass),
      );
      order.push('caller pass');
    }),
  ).not.toThrow();

  expect(order).toEqual(['caller pass', 'from the pass', "from a call's body", "from a call's pass"]);
  expect(report.mock.calls).toEqual([[fromPass], [fromCallBody], [fromCallPass]]);
});

test('a report that throws still lets the next event with no caller run', () => {
  const failure = new Error('report failed');
  const events = createCheckEvents(() => {
    throw failure;
  });
  const pass = mock(() => {});

  expect(() =>
    events.run(
      (requestCheck) => {
        requestCheck();
        events.runUncalled(asksForCheck, () => {
          throw new Error('own');
        });
      },
      () => {},
    ),
  ).toThrow(failure);

  events.runUncalled(asksForCheck, pass);
  expect(pass).toHaveBeenCalledTimes(1);
});

test("a report that throws neither stops the events waiting behind it nor hides the caller's throw", () => {
  const failure = new Error('report failed');
  const reported: unknown[] = [];
  const events = createCheckEvents((error) => {
    reported.push(error);
    if (reported.length === 1) throw failure;
  });
  const order: string[] = [];
  const first = new Error('first');
  const callerBoom = new Error('caller');

  expect(() =>
    events.run(
      (requestCheck) => {
        requestCheck();
        events.runUncalled(asksForCheck, () => {
          order.push('first');
          throw first;
        });
        events.runUncalled(asksForCheck, () => order.push('second'));
      },
      () => {
        order.push('caller');
        throw callerBoom;
      },
    ),
  ).toThrow(callerBoom);

  expect(order).toEqual(['caller', 'first', 'second']);
  expect(reported).toEqual([first]);
});

test("with no throw of the caller's own, a report's first throw reaches the caller once every waiting event ran", () => {
  const failures: Error[] = [];
  const events = createCheckEvents(() => {
    const failure = new Error(`report failed ${failures.length + 1}`);
    failures.push(failure);
    throw failure;
  });
  const order: string[] = [];

  expect(() =>
    events.run(
      (requestCheck) => {
        requestCheck();
        startThrowing(events, order, new Error('first'));
        startThrowing(events, order, new Error('second'));
      },
      () => order.push('caller'),
    ),
  ).toThrow('report failed 1');

  expect(order).toEqual(['caller', 'first', 'second']);
  expect(failures).toHaveLength(2);
});

test('an event with no caller reports its own throw before those of the events that started inside it', () => {
  const report = mock((_error: unknown) => {});
  const events = createCheckEvents(report);
  const outer = new Error('outer');
  const inner = new Error('inner');

  events.runUncalled(
    (requestCheck) => {
      requestCheck();
      events.runUncalled(asksForCheck, () => {
        throw inner;
      });
    },
    () => {
      throw outer;
    },
  );

  expect(report.mock.calls).toEqual([[outer], [inner]]);
});

test("an event with no caller still runs when the caller's body throws, and its throw is reported", () => {
  const report = mock((_error: unknown) => {});
  const events = createCheckEvents(report);
  const callerBoom = new Error('caller');
  const ownBoom = new Error('own');

  expect(() =>
    events.run(() => {
      events.runUncalled(asksForCheck, () => {
        throw ownBoom;
      });
      throw callerBoom;
    }, mock()),
  ).toThrow(callerBoom);

  expect(report).toHaveBeenCalledWith(ownBoom);
});
