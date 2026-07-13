export default [
  {
    id: '4.1',
    title: 'Flux Create',
    duration: '5 min',
    kind: 'demo',
    summary: [
      "Everything in Section 3 bridged existing data (a list, an array, a stream) into a Flux. This section covers the missing piece: emitting items programmatically, on your own terms, until some condition of your choosing is met — rather than from a pre-existing source.",
      "Flux.create() accepts a Consumer<FluxSink<T>>. The FluxSink it hands you exposes next(item) to emit a value and complete() to signal you're done — the same vocabulary as onNext()/onComplete(), just renamed for this context. Inside that lambda, you have complete freedom: a simple loop that calls sink.next() ten times, or a do-while loop that keeps generating random country names and emitting each one until it happens to generate 'Canada,' at which point it calls sink.complete().",
    ],
    code: `Flux.create(sink -> {
    sink.next(1);
    sink.next(2);
    sink.complete();
}).subscribe(Util.subscriber());
// 1, 2, then complete

Flux.create(sink -> {
    for (int i = 0; i < 10; i++) {
        sink.next(Util.faker().country().name());
    }
    sink.complete();
}).subscribe(Util.subscriber());

// Keep emitting until a specific value shows up — full control, your condition:
Flux.<String>create(sink -> {
    String country;
    do {
        country = Util.faker().country().name();
        sink.next(country);
    } while (!country.equalsIgnoreCase("Canada"));
    sink.complete();
}).subscribe(Util.subscriber());`,
    note: {
      label: 'Worth reading carefully',
      text: "Flux.create() hands you full manual control over emission — which is powerful, but comes with some important fine print about default behavior covered over the next few lectures.",
    },
  },
  {
    id: '4.2',
    title: 'Flux Create — Refactor',
    duration: '4 min',
    kind: 'demo',
    summary: [
      "Cramming complex business logic directly into the Flux.create() lambda hurts readability once that logic grows past a couple of lines. The alternative: implement Consumer<FluxSink<T>> as its own class, stash the FluxSink reference the moment it's handed over, and expose a public method that emits through it whenever called — from anywhere in the surrounding code.",
      "This is a deliberately minimal example rather than production-grade code: there's no null-check on the sink before using it, and no completion signal at all, because whether and when to complete depends entirely on the actual requirement (emit until a counter hits some limit, for instance). The structural idea — separate the sink-holding class from the code that decides when to call it — is the part worth keeping.",
    ],
    code: `public class NameGenerator implements Consumer<FluxSink<String>> {
    private FluxSink<String> sink;

    @Override
    public void accept(FluxSink<String> sink) {
        this.sink = sink; // Flux.create() calls this exactly once, up front
    }

    public void generate() {
        sink.next(Util.faker().name().firstName());
        // complex logic can live across as many private methods as needed —
        // call sink.next() from wherever it's ready, whenever it's ready
    }
}

var generator = new NameGenerator();
Flux<String> flux = Flux.create(generator);
flux.subscribe(Util.subscriber());

for (int i = 0; i < 10; i++) {
    generator.generate(); // each call pushes exactly one more item downstream
}
// no completion signal here on purpose — add one (e.g. a counter that
// triggers sink.complete() past some threshold) if your use case needs it`,
  },
  {
    id: '4.3',
    title: 'Flux Sink — Thread Safety',
    duration: '8 min',
    kind: 'demo',
    summary: [
      "A FluxSink is genuinely thread-safe — multiple threads can call next() on the same sink concurrently, and every item still arrives at the Subscriber safely and sequentially. Proving that starts by proving the opposite first: a plain ArrayList is not thread-safe. Ten threads each adding 1,000 items to a shared ArrayList should total 10,000, but running it repeatedly produces wildly inconsistent, always-too-low counts (6175, then 6113, then 3799 on successive runs) — a textbook race condition.",
      "Rerunning the same experiment through a FluxSink-based NameGenerator instead — ten threads all calling generator.generate() 1,000 times each, with the sink's own onNext callback appending to the list rather than the threads touching the list directly — consistently produces exactly 10,000 every single time.",
      "The mechanism: once a FluxSink accepts an item from any thread, it never loses it, and it delivers everything to the downstream Subscriber sequentially, one at a time — never in parallel, no matter how many threads fed it concurrently. That internal serialization is exactly what the plain ArrayList was missing.",
    ],
    code: `// NOT thread-safe — concurrent adds to a plain ArrayList lose data:
List<Integer> list = new ArrayList<>();
Runnable task = () -> {
    for (int i = 0; i < 1000; i++) list.add(i);
};
for (int i = 0; i < 10; i++) {
    Thread.ofPlatform().start(task); // 10 threads x 1000 adds = 10,000 expected
}
Util.sleepSeconds(2);
System.out.println(list.size()); // often far below 10,000 — a race condition

// Thread-safe — every thread emits through the SAME FluxSink instead of
// touching the list directly; the sink serializes delivery internally:
List<String> names = new ArrayList<>();
var generator = new NameGenerator();
Flux.create(generator).subscribe(names::add);

Runnable genTask = () -> {
    for (int i = 0; i < 1000; i++) generator.generate();
};
for (int i = 0; i < 10; i++) {
    Thread.ofPlatform().start(genTask);
}
Util.sleepSeconds(2);
System.out.println(names.size()); // consistently 10,000, every run`,
    note: {
      label: 'What actually changed',
      text: 'The ArrayList itself is still not thread-safe in either version. What changed is that the threads never touch it directly — they all hand data to the sink, and the sink alone is responsible for delivering to the Subscriber, one item at a time, in a serialized order.',
    },
  },
  {
    id: '4.4',
    title: 'Flux Create — Default Behavior',
    duration: '8 min',
    kind: 'demo',
    summary: [
      "A behavior that catches almost everyone off guard the first time: by default, Flux.create() does not wait for the Subscriber to request anything. Subscribing to a create()-based Flux that logs and emits 10 names inside a for loop prints all ten 'generated' log lines immediately — before request() has been called even once.",
      "This isn't laziness broken; it's intentional design. Everything emitted before it's requested gets buffered into an internal, unbounded queue. From there, the Subscriber just pulls from the queue whenever it does request — request(2) hands back the first two buffered items, another request(2) hands back the next two, and so on. Once cancel() is called, that's final: the remaining buffered items are simply discarded, and no further request() calls have any effect, even though data is technically still sitting in the queue.",
      "Whether upfront production is good or bad genuinely depends on the use case — it's the same tradeoff as cooking all of today's meals in the morning versus cooking each one fresh when hunger strikes. Sometimes producing everything eagerly actually is the more efficient choice. The one real risk: since the queue is unbounded, a producer that's far faster than its consumer can in principle grow that queue toward an OutOfMemoryError — this is exactly what 'backpressure' refers to, and it gets a dedicated section later in the course.",
    ],
    code: `Flux<String> flux = Flux.create(sink -> {
    for (int i = 0; i < 10; i++) {
        var name = Util.faker().name().firstName();
        log.info("Generated {}", name);
        sink.next(name);
    }
    sink.complete();
});

var subscriber = new SubscriberImpl<String>();
flux.subscribe(subscriber);
// ALL 10 "Generated ..." lines print immediately — before request() is
// ever called. Everything gets buffered in an unbounded internal queue.

subscriber.getSubscription().request(2); // first 2 items, straight from the queue
Util.sleepSeconds(2);
subscriber.getSubscription().request(2); // next 2, still from the queue
subscriber.getSubscription().cancel();
subscriber.getSubscription().request(2); // no-op — cancelled is final, even
                                          // though 6 more items sit buffered`,
    note: {
      label: 'The open question this sets up',
      text: "An unbounded queue plus a producer faster than its consumer is exactly what backpressure means in practice. Reactive programming has real tools for this — they get a dedicated section of their own later in the course.",
    },
  },
  {
    id: '4.5',
    title: 'Flux Create — Emit On Demand',
    duration: '3 min',
    kind: 'demo',
    summary: [
      "If the eager, queue-everything default from the previous lecture isn't what a use case needs, FluxSink exposes a way to flip it: sink.onRequest(callback) registers a callback that fires with the exact amount requested every time the Subscriber calls request(n) — production only ever happens in response to actual demand.",
      "Inside that callback, a loop bounded by the requested amount (and checked against sink.isCancelled()) produces exactly as many items as were asked for, no more. Requesting 2 produces exactly 2; requesting 2 more produces exactly 2 more; after cancel(), the isCancelled() check short-circuits the loop entirely, so nothing further gets produced even if request() is called again afterward.",
    ],
    code: `Flux<String> flux = Flux.create(sink -> {
    sink.onRequest(requested -> {
        for (long i = 0; i < requested && !sink.isCancelled(); i++) {
            sink.next(Util.faker().name().firstName());
        }
    });
});

var subscriber = new SubscriberImpl<String>();
flux.subscribe(subscriber);
// nothing generated yet — onRequest's callback hasn't fired

subscriber.getSubscription().request(2); // generates exactly 2, on demand
subscriber.getSubscription().request(2); // generates 2 more, on demand
subscriber.getSubscription().cancel();
subscriber.getSubscription().request(2); // isCancelled() short-circuits — nothing generated`,
  },
  {
    id: '4.6',
    title: 'Flux Sink — Usecases',
    duration: '4 min',
    kind: 'theory',
    summary: [
      "An important scoping note: Flux.create()/FluxSink is designed around a single-subscriber usage pattern. Multiple independent subscribers on a create()-based Flux aren't really the intended shape — later sections cover the tools for genuinely multi-subscriber scenarios (hot publishers, sinks) if that need comes up.",
      "The motivating scenario for FluxSink specifically: imagine a getProductInformation(productId, userId) method serving high concurrent traffic, where a new business requirement asks you to also record which user viewed which product for future promotional emails — without slowing down the read path itself with an extra synchronous insert on every request.",
      "The fix: every concurrent request emits a (userId, productId) pair into a shared, thread-safe FluxSink instead of writing to the database inline, and immediately proceeds to look up and return the product. A single dedicated Subscriber on that sink handles the actual database inserts, completely decoupled from the read path's response time. Many threads safely feeding one sink, one subscriber handling the resulting stream — that's the single-subscriber pattern this section built toward.",
    ],
    note: {
      label: 'The core idea',
      text: 'Many concurrent threads can safely emit into one shared FluxSink; one Subscriber processes what comes out. That decoupling — fast read path, separately-handled side effect — is the practical reason FluxSink exists.',
    },
  },
  {
    id: '4.7',
    title: 'Take Operators',
    duration: '8 min',
    kind: 'demo',
    summary: [
      "A quick but necessary detour before Flux.generate(), since the take family gets used constantly from here on. take(n) is Flux's equivalent of Stream's limit(n) — Flux.range(1, 10).take(3) only ever lets 3 values through, even though the source could produce ten.",
      "Watching it through two named log() calls (one above take(), one below) reveals exactly how it works mechanically: take() is itself a processor — a Subscriber to what's above it, a Publisher to what's below. The downstream subscriber requests unbounded, but take() only ever forwards a request for 3 to the upstream range(). The moment the third item passes through, take() calls cancel() on its upstream Subscription (it got everything it needed) and independently calls onComplete() on its own downstream (it fulfilled its contract of exactly 3) — two distinct signals, firing for two different reasons.",
      "takeWhile(predicate) and takeUntil(predicate) both stop based on a condition rather than a count, but in opposite senses. takeWhile keeps emitting WHILE the predicate holds, and stops (excluding) the first item where it doesn't — takeWhile(i -> i < 5) on range(1,10) yields 1, 2, 3, 4. takeUntil keeps emitting UNTIL the predicate becomes true, but INCLUDES the item that made it true — takeUntil(i -> i < 5) on the same range yields just 1, because the very first item already satisfies i < 5, so it stops immediately after including it.",
    ],
    code: `Flux.range(1, 10)
    .take(3)
    .subscribe(Util.subscriber());
// 1, 2, 3, then complete

Flux.range(1, 10)
    .log("upstream")
    .take(3)
    .log("downstream")
    .subscribe(Util.subscriber());
// downstream requests unbounded; take() only ever requests 3 from upstream.
// After the 3rd item, take() cancels upstream AND completes downstream —
// two separate signals, both visible in the two logs

Flux.range(1, 10)
    .takeWhile(i -> i < 5)
    .subscribe(Util.subscriber());
// 1, 2, 3, 4 — stops (and excludes) the first item that fails the condition

Flux.range(1, 10)
    .takeUntil(i -> i < 5)
    .subscribe(Util.subscriber());
// just 1 — stops as soon as the condition becomes true, but INCLUDES the
// item that satisfied it; i < 5 is already true at i=1, so it stops there`,
    note: {
      label: 'take() cancels; takeWhile/takeUntil complete naturally',
      text: "take(n) always sends an explicit cancel() upstream once it has what it needs. takeWhile/takeUntil don't cancel anything themselves — they just stop passing items through and complete downstream once their condition is met.",
    },
  },
  {
    id: '4.8',
    title: 'Flux Generate',
    duration: '8 min',
    kind: 'demo',
    summary: [
      "Flux.generate() looks superficially similar to create() — both accept a lambda that gets a sink — but the sink type is different (SynchronousSink<T> instead of FluxSink<T>), and that difference carries a hard rule: calling sink.next() more than once inside a single invocation of the lambda throws an error. A SynchronousSink permits at most one emission per call.",
      "The mental model flips entirely from create(). With create(), you own the loop — you decide how many times to call next(), regardless of downstream demand. With generate(), Reactor owns the loop: your lambda gets invoked once per item the downstream actually requests. Without any take() or similar limiter, calling sink.next() unconditionally inside generate() runs forever, because with no other bound, the implicit downstream demand is Long.MAX_VALUE. Chaining .take(4) makes the lambda run exactly four times — downstream demand, quite literally, drives how many times your code executes.",
      "The lambda's own signals still end things early regardless of demand: calling sink.complete() or sink.error() inside it stops the sequence immediately, the same way a downstream cancel() would.",
    ],
    code: `Flux.generate(sink -> {
    sink.next(1);
    sink.next(2); // throws: "More than one call to onNext" — a SynchronousSink
                  // allows exactly one emission per lambda invocation
    sink.complete();
}).subscribe(Util.subscriber());

// Correct: exactly one emission per invocation
Flux.generate(sink -> sink.next(1))
    .take(4)                       // caps downstream demand at 4 —
    .subscribe(Util.subscriber()); // ...so the lambda runs exactly 4 times
// without .take(4), this would run forever: no bound means unbounded demand

Flux.generate(sink -> {
    sink.next(1);
    sink.complete(); // stops immediately regardless of downstream demand
}).subscribe(Util.subscriber());`,
    note: {
      label: 'create() vs. generate() — who owns the loop',
      text: "With create(), you write the loop and decide how many times to emit, ignoring downstream demand if you want. With generate(), Reactor writes the loop — your lambda runs exactly once per requested item, and 'one call, one item' is enforced.",
    },
  },
  {
    id: '4.9',
    title: 'Flux Generate — Emit Until',
    duration: '3 min',
    kind: 'demo',
    summary: [
      "Two equally valid ways to implement 'keep generating random country names until Canada shows up' with generate(). Option one: check the condition inside the lambda itself, calling sink.complete() the moment the generated value happens to be Canada.",
      "Option two: leave the generator lambda unconditional (just keep emitting a random country every time it's invoked) and let takeUntil(country -> country.equalsIgnoreCase(\"Canada\")) — the operator from two lectures back — own the stopping condition instead. Both approaches produce identical behavior; which one reads more cleanly is mostly a matter of where the stopping logic conceptually belongs in a given use case.",
    ],
    code: `// Option 1: the generator decides when to stop
Flux.generate(sink -> {
    var country = Util.faker().country().name();
    sink.next(country);
    if (country.equalsIgnoreCase("Canada")) {
        sink.complete();
    }
}).subscribe(Util.subscriber());

// Option 2: the generator stays unconditional; takeUntil() owns the stopping logic
Flux.generate(sink -> sink.next(Util.faker().country().name()))
    .takeUntil(country -> country.equalsIgnoreCase("Canada"))
    .subscribe(Util.subscriber());`,
  },
  {
    id: '4.10',
    title: 'Flux Generate — State Problem',
    duration: '3 min',
    kind: 'demo',
    summary: [
      "A new requirement — stop after at most 10 countries, OR when Canada shows up, whichever happens first — exposes a real limitation. The instinct is to add a counter, but declaring int counter = 0 inside the lambda resets it to zero on every single invocation, so it can never actually accumulate across calls.",
      "Moving the counter outside the lambda (a field, or an AtomicInteger to be threadsafe about it) technically works, but introduces a different problem: that state now lives outside the generator entirely, where nothing stops other code from reading or mutating it unexpectedly. Neither option is clean, and this is deliberately left unresolved here — Flux.generate() itself provides the actual answer in the next lecture.",
    ],
    code: `// BROKEN — resets to 0 on every single lambda invocation, so it never
// actually counts anything:
Flux.generate(sink -> {
    int counter = 0; // always starts at 0 here — this is a fresh local each call
    var country = Util.faker().country().name();
    sink.next(country);
    counter++;
    if (counter == 10 || country.equalsIgnoreCase("Canada")) {
        sink.complete();
    }
}).subscribe(Util.subscriber());
// Result: never stops at 10 — only ever stops if Canada happens to come up

// Moving state outside the lambda "works" but now nothing scopes it to
// just this generator — anything else could read or mutate it too:
AtomicInteger counter = new AtomicInteger(0);
// ...not a clean fix. Flux.generate() has a proper answer for this — next lecture.`,
  },
  {
    id: '4.11',
    title: 'Flux Generate — State Supplier',
    duration: '6 min',
    kind: 'demo',
    summary: [
      "The single-argument Flux.generate() used so far is completely stateless by design — which is a real problem for anything that needs to carry state across invocations, like a counter, or a genuinely expensive resource such as an open database connection that shouldn't be reopened on every single emission.",
      "A second overload solves this properly: Flux.generate(Supplier<S> stateSupplier, BiFunction<S, SynchronousSink<T>, S> generator). The Supplier runs exactly once, producing an initial state object — a starting counter value, a freshly opened connection, anything. That state gets passed into the generator function alongside the sink on every invocation, and whatever the function returns becomes the state for the next call. The counter, or the open connection, now genuinely persists between calls, scoped entirely to this one generator.",
      "A third argument adds a cleanup step — a Consumer<S> invoked exactly once, when the sequence ends for any reason: normal completion, an error, or the downstream cancelling. That's the natural home for closing a connection or file handle that the state supplier opened.",
    ],
    code: `// generate(Supplier<S> stateSupplier, BiFunction<S, SynchronousSink<T>, S> generator)
Flux.generate(
    () -> 0,                                    // initial state, created ONCE
    (counter, sink) -> {
        var country = Util.faker().country().name();
        sink.next(country);
        int next = counter + 1;
        if (next == 10 || country.equalsIgnoreCase("Canada")) {
            sink.complete();
        }
        return next; // becomes "counter" on the NEXT invocation
    }
).subscribe(Util.subscriber());
// emits up to 10 countries — stops sooner if Canada comes up first

// A third argument adds cleanup, invoked exactly once when the sequence
// ends (complete, error, or cancel) — the natural place to release a resource:
Flux.generate(
    () -> openConnection(),           // called once
    (connection, sink) -> {
        sink.next(connection.readNextRow());
        return connection;            // reuse the SAME connection every call
    },
    connection -> connection.close()  // called once, on completion/error/cancel
).subscribe(Util.subscriber());`,
    note: {
      label: 'Three-part shape to remember',
      text: 'Supplier<S> (runs once, builds initial state) -> BiFunction<S, SynchronousSink<T>, S> (runs per requested item, returns the next state) -> optional Consumer<S> (runs once, on any terminal signal, for cleanup).',
    },
  },
  {
    id: '4.12',
    title: '*** Assignment ***',
    duration: '1 min',
    kind: 'assignment',
    summary: [
      "Implement a FileReaderService whose read(Path) method emits a file's content one line at a time as a Flux<String>. The requirements mirror everything covered in this section: no filesystem work happens until there's a subscriber, exactly as many lines get produced as the downstream actually demands, the sequence stops the moment the subscriber cancels, and the file gets properly closed once the read is done, however it ends.",
      "Flux.generate() with its state-supplier-plus-cleanup overload is very obviously suited to this shape — open the file once (state), read one line per invocation, close the file once at the end — but as with the earlier assignments, any implementation that satisfies the actual requirements is a valid answer.",
    ],
  },
  {
    id: '4.13',
    title: 'Assignment Solution',
    duration: '10 min',
    kind: 'solution',
    summary: [
      "The three-part Flux.generate() overload maps almost one-to-one onto the requirement. The state supplier opens a BufferedReader via Files.newBufferedReader(path) and logs that the file was opened. The generator function calls reader.readLine() inside a try/catch (a checked IOException forces this): a non-null line gets logged and emitted via sink.next(); a null line means end-of-file, so sink.complete() fires instead; any exception gets routed to sink.error() rather than thrown.",
      "The cleanup consumer closes the reader and logs that it did, and fires exactly once regardless of whether the sequence ended via completion, an error, or the subscriber cancelling early.",
      "Testing confirms every requirement: calling read(path) with no subscriber touches nothing on disk at all. Subscribing with the default (unbounded) subscriber reads clean through all 10,000 lines in the test file, hits the end-of-file null, completes, and closes exactly once. Chaining .take(6) opens the file, reads exactly 6 lines, then completes and closes — the generator only ran 6 times because that's all downstream demanded. Chaining .takeUntil(line -> line.equals(\"line 17\")) reads through line 17 and stops there, regardless of the file actually containing 10,000 lines — the service itself has no idea how many lines will be read; that decision belongs entirely to whoever subscribes.",
    ],
    code: `public class FileReaderServiceImpl implements FileReaderService {
    private static final Logger log = LoggerFactory.getLogger(FileReaderServiceImpl.class);

    @Override
    public Flux<String> read(Path path) {
        return Flux.generate(
            () -> openFile(path),
            this::readLine,
            this::closeFile
        );
    }

    private BufferedReader openFile(Path path) throws IOException {
        log.info("Opening file");
        return Files.newBufferedReader(path);
    }

    private BufferedReader readLine(BufferedReader reader, SynchronousSink<String> sink) {
        try {
            String line = reader.readLine();
            if (line == null) {
                sink.complete(); // end of file — nothing left to emit
            } else {
                log.info("Reading line: {}", line);
                sink.next(line);
            }
        } catch (Exception e) {
            sink.error(new RuntimeException(e));
        }
        return reader;
    }

    private void closeFile(BufferedReader reader) {
        try {
            reader.close();
            log.info("Closed file");
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}

var service = new FileReaderServiceImpl();
Path path = Path.of("src/main/resources/section04/file.txt"); // 10,000 lines

service.read(path).subscribe(Util.subscriber());
// opens once, reads all 10,000 lines, completes on the end-of-file null, closes once

service.read(path).take(6).subscribe(Util.subscriber());
// opens, reads exactly 6 lines, completes, closes — the generator ran 6 times, no more

service.read(path)
    .takeUntil(line -> line.equals("line 17"))
    .subscribe(Util.subscriber());
// opens, reads through "line 17", completes, closes — stops there regardless
// of the file having 10,000 lines total`,
    note: {
      label: 'The design worth noticing',
      text: "FileReaderService.read(Path) never accepts a line count or any stopping condition. It just describes HOW to open, read, and close — WHEN to stop is entirely the subscriber's decision, expressed through take()/takeUntil()/cancel(). That separation is what makes it genuinely reusable.",
    },
  },
  {
    id: '4.14',
    title: 'Summary',
    duration: '3 min',
    kind: 'summary',
    summary: [
      "Both create() and generate() emit items programmatically rather than from a pre-existing source, but they sit at opposite ends of a control spectrum. create() hands you a FluxSink once and gets out of the way — you own the loop, you can emit as many items as you want regardless of downstream demand, and the sink is thread-safe, so many threads can safely share it (the single-subscriber pattern from earlier in this section).",
      "generate() hands you a SynchronousSink on every invocation, but the loop belongs to Reactor — your lambda runs once per unit of downstream demand, and you're limited to exactly one emission per call. Because there's only ever one logical caller driving each invocation, thread-sharing isn't applicable to it the way it is to create()'s sink.",
      "generate()'s three-argument overload — initial state, per-call generator, cleanup — is what makes it genuinely powerful for wrapping resources like file handles or database connections into a reusable, generic utility: the FileReaderService from this section's assignment has no idea how many lines will be read or when; that decision belongs entirely downstream, expressed through take()/takeUntil()/cancel(), while the service itself just handles the open/read/close mechanics correctly no matter what's asked of it.",
    ],
    keyPoints: [
      "create() — you own the loop, ignore downstream demand if you want, thread-safe sink for multi-threaded producers, buffers eagerly by default (fixable via onRequest()).",
      "generate() — Reactor owns the loop, exactly one emission per invocation, invocation count driven directly by downstream demand.",
      "generate()'s state-supplier-plus-cleanup overload is the pattern for wrapping any open/use/close resource into a demand-driven, reusable Flux.",
    ],
  },
]
