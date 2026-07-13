export default [
  {
    id: '7.1',
    title: 'Introduction',
    duration: '1 min',
    kind: 'theory',
    summary: [
      "Reactor is a library sitting on top of genuinely low-level Java tools — raw threads, asynchronous socket channels — that are powerful but easy to misuse, the same way a chef's knife is a great tool in trained hands and a hazard otherwise. Reactor's entire job in this area is to make thread management safe and mostly invisible.",
      "The default behavior worth internalizing before anything else: whichever thread calls subscribe() ends up doing every single step of the pipeline — receiving the Subscription, sending the request, and executing every operator as data flows through. That's usually fine. This section covers what to do on the occasions it isn't — namely when it causes unwanted blocking or fails to use multiple CPUs effectively.",
    ],
  },
  {
    id: '7.2',
    title: 'Publisher/Subscriber — Default Thread — Demo',
    duration: '4 min',
    kind: 'demo',
    summary: [
      "A minimal Flux.create()-based producer with logging on both the emission side and the subscriber side makes the default-thread rule directly observable: every single log line — generation, emission, delivery — is printed by whichever thread called .subscribe(). By default in a plain main() method, that's the main thread, for every subscriber attached to it.",
      "Wrapping the same subscribe() call inside a Runnable and launching it on a brand-new Thread changes exactly one thing: now that new thread's name shows up on every log line instead of 'main.' The underlying rule doesn't change — whoever calls subscribe() does all the work, whether that's the main thread, a manually created thread, or (as the rest of this section covers) a thread borrowed from a scheduler.",
    ],
    code: `Flux<Integer> flux = Flux.create(sink -> {
    for (int i = 1; i <= 2; i++) {
        log.info("Generating {}", i);
        sink.next(i);
    }
    sink.complete();
});

flux.subscribe(Util.subscriber("subscriber-1"));
flux.subscribe(Util.subscriber("subscriber-2"));
// Every log line — generating, receiving, everything — is printed by the
// SAME thread: whichever one called .subscribe(). By default, that's "main".

Runnable task = () -> flux.subscribe(Util.subscriber("subscriber-1"));
Thread.ofPlatform().start(task);
// Now every line is printed by "Thread-0" instead of "main" — because
// THAT thread is the one that called subscribe(). Whoever subscribes does
// all the work, full stop.`,
  },
  {
    id: '7.3',
    title: 'Schedulers',
    duration: '3 min',
    kind: 'theory',
    summary: [
      "Manually creating and managing threads for every case where the default behavior isn't ideal is real overhead nobody wants to own by hand. Reactor's answer is Schedulers — pre-built, purpose-optimized thread pools, each suited to a specific kind of work.",
      "Schedulers.boundedElastic() is for time-consuming, blocking operations — network calls without a reactive driver, blocking file I/O, that kind of thing. Schedulers.parallel() is for CPU-intensive work specifically — its thread count is tied to the number of CPU cores, and the name is just a name; using it doesn't automatically parallelize anything on its own (that misconception gets its own dedicated lecture later). Schedulers.single() runs everything through exactly one thread, useful when race conditions are a real concern and strict sequential execution matters. Schedulers.immediate() is effectively a no-op — 'just keep using whatever thread is already running this.' Custom schedulers can also be built directly if none of the built-ins fit.",
      "Two operators actually apply a scheduler to a pipeline: subscribeOn and publishOn — different enough in behavior to each need a full lecture.",
    ],
    keyPoints: [
      'boundedElastic() — time-consuming/blocking operations (network calls without a reactive driver, blocking I/O).',
      'parallel() — CPU-intensive work; thread count tied to CPU core count. The name does not mean automatic parallelism.',
      'single() — exactly one thread; strict sequential execution.',
      'immediate() — no-op; keep using whatever thread is already running.',
    ],
  },
  {
    id: '7.4',
    title: 'Subscribe On',
    duration: '3 min',
    kind: 'theory',
    summary: [
      "subscribeOn is for the upstream side of a pipeline — everything from the point it appears in the chain, up toward the producer. The current thread (whatever called subscribe()) sets up the whole chain as usual — passing along the Subscription, sending the request — traveling upward through every operator exactly as before, until it hits a subscribeOn.",
      "At that point, the current thread's involvement effectively ends: it hands the rest of the job — producing data and pushing it back down through the entire chain — over to whatever scheduler subscribeOn specifies. From there on, that borrowed thread does everything: production, every operator, delivery to the subscriber.",
    ],
    note: {
      label: 'The mental model',
      text: "The calling thread travels UP the chain doing setup work until it hits subscribeOn. From that point on, a thread from the specified scheduler takes over completely — producing, transforming, and delivering everything.",
    },
  },
  {
    id: '7.5',
    title: 'Subscribe On — Demo',
    duration: '6 min',
    kind: 'demo',
    summary: [
      "Two doFirst() calls straddling a subscribeOn(Schedulers.boundedElastic()) make the handoff point visible directly: the doFirst() below subscribeOn in the chain (closer to the subscriber) still prints on the calling thread — subscribeOn hasn't been reached yet on the way up. Everything from that point onward — the actual data generation, every doOnNext(), and delivery to the subscriber — runs on a thread borrowed from boundedElastic instead.",
      "Wrapping the whole subscription in its own Runnable and launching it on a manually created thread changes only who does the setup-phase printing (that new thread's name shows up instead of main's) — subscribeOn's handoff to boundedElastic still happens exactly the same way regardless.",
      "Two independent subscribers, each launched on their own separate manually created thread, both still route through the same boundedElastic pool — each one simply borrows its own thread from that shared pool rather than sharing one.",
    ],
    code: `Flux.create(sink -> {
        log.info("Generating");
        sink.next(1);
        sink.next(2);
        sink.complete();
    })
    .doFirst(() -> log.info("first-one"))
    .subscribeOn(Schedulers.boundedElastic())
    .doFirst(() -> log.info("first-two"))
    .doOnNext(i -> log.info("value {}", i))
    .subscribe(Util.subscriber("subscriber-1"));
Util.sleepSeconds(2);

// "first-two" still prints on the CALLING thread (main, by default) — the
// calling thread executes everything ABOVE subscribeOn on its way up
// setting up the subscription. Once it crosses subscribeOn, EVERYTHING
// from there on (generating, emitting, doOnNext, delivering to the
// subscriber) runs on a thread borrowed from boundedElastic instead.

// Two independent subscribers, each on their own manually created thread,
// both still route through the SAME boundedElastic pool — each just
// borrows its own thread from that shared pool:
Thread.ofPlatform().start(() -> flux.subscribe(Util.subscriber("subscriber-1")));
Thread.ofPlatform().start(() -> flux.subscribe(Util.subscriber("subscriber-2")));`,
  },
  {
    id: '7.6',
    title: 'Multiple Subscribe On',
    duration: '7 min',
    kind: 'demo',
    summary: [
      "A pipeline can contain more than one subscribeOn call, but only one of them actually matters: the one closest to the producer (topmost in the chain) wins. The calling thread hands off exactly once, at the very first subscribeOn it crosses while traveling upward — every subsequent one further up the chain is simply never reached, because the handoff already happened.",
      "This isn't an arbitrary rule — it's deliberate, and genuinely useful for library authors. Someone who builds and exposes a reusable Flux — a library method — often understands that producer's specific concurrency needs far better than whoever ends up consuming it. Baking subscribeOn(Schedulers.boundedElastic()) directly into the exposed method locks in that choice: any subscribeOn() a caller adds afterward has no effect, because it's simply not the closest one to the producer.",
      "This connects directly back to the external service client used throughout the course — its own internal subscribeOn() (on the event-loop thread it manages) can't be overridden by consumer code, and that's intentional: the client author knows exactly which thread pool that particular I/O work needs.",
    ],
    code: `flux
    .subscribeOn(Schedulers.boundedElastic())
    .subscribeOn(Schedulers.newParallel("custom-pool"))
    .subscribe(Util.subscriber());
// Only ONE wins: whichever is CLOSEST TO THE PRODUCER (topmost in the
// chain) — here, "custom-pool", not boundedElastic. The calling thread
// hands off exactly once, at the FIRST subscribeOn it crosses traveling
// upstream — anything past that point is simply never reached.

// A library author locking in their own choice of thread pool:
public Flux<String> createFlux() {
    return Flux.create(sink -> { /* ... */ })
        .subscribeOn(Schedulers.boundedElastic()); // the library's own choice — final
}

// A caller's own subscribeOn() has no effect here — it's not the closest
// one to the producer, so it's simply overridden:
createFlux()
    .subscribeOn(Schedulers.parallel()) // ignored — createFlux() already claimed the thread
    .subscribe(Util.subscriber());`,
    note: {
      label: 'Closest-to-the-producer wins, and that is intentional',
      text: 'A library author who bakes their own subscribeOn() into an exposed method is deliberately protecting their own concurrency choices from being overridden by consumer code — not leaving a bug.',
    },
  },
  {
    id: '7.7',
    title: 'Scheduler — Immediate',
    duration: '1 min',
    kind: 'demo',
    summary: [
      "Schedulers.immediate() genuinely isn't a thread pool at all — it's a placeholder meaning 'don't switch threads, just keep using whatever's already running this.' Passing it as a subscribeOn() argument between two other schedulers leaves execution on whichever thread was already active at that point, unchanged.",
      "Its real purpose surfaces when a method signature requires a Scheduler argument but a particular call site genuinely doesn't want to change anything — the same role Function.identity() plays whenever a Function parameter is required but a true no-op is what's actually needed.",
    ],
    code: `flux
    .subscribeOn(Schedulers.boundedElastic())
    .subscribeOn(Schedulers.immediate()) // "just keep using whatever thread is already running this"
    .subscribe(Util.subscriber());
// immediate() is a no-op placeholder, not a real pool — useful whenever a
// method signature forces a Scheduler argument but you don't actually
// want to switch threads at that point.`,
  },
  {
    id: '7.8',
    title: 'Scheduler — Virtual Thread',
    duration: '2 min',
    kind: 'demo',
    summary: [
      "Project Reactor can back Schedulers.boundedElastic() with Java virtual threads instead of ordinary platform threads — appropriate specifically because boundedElastic is meant for blocking/I/O work, which is exactly the use case virtual threads are designed for. (Schedulers.parallel(), being CPU-bound work, is a poor fit for virtual threads and isn't affected by this at all.)",
      "As of this recording, it's opt-in rather than default: setting the system property reactor.schedulers.defaultBoundedElasticOnVirtualThreads to \"true\" switches boundedElastic() over to virtual threads. Thread.currentThread().isVirtual() confirms the difference directly — false without the property set, true with it.",
    ],
    code: `log.info("Is virtual? {}", Thread.currentThread().isVirtual()); // false, by default

System.setProperty("reactor.schedulers.defaultBoundedElasticOnVirtualThreads", "true");
// with this property set, Schedulers.boundedElastic() backs its threads
// with Java virtual threads instead of ordinary platform threads

flux.subscribeOn(Schedulers.boundedElastic())
    .doOnNext(i -> log.info("Is virtual? {}", Thread.currentThread().isVirtual())) // true
    .subscribe(Util.subscriber());`,
  },
  {
    id: '7.9',
    title: 'More On Schedulers',
    duration: '3 min',
    kind: 'theory',
    summary: [
      "A specific misconception worth correcting directly: attaching Schedulers.parallel() does not automatically split one subscriber's items across multiple threads for parallel processing. A single subscriber's items are still delivered sequentially, one at a time, by one borrowed thread — schedulers change which thread does the work, not how many threads work on a single subscriber's stream simultaneously.",
      "What actually happens with multiple subscribers on a cold publisher: each subscriber gets its own independent producer (as established back in Section 6), and each one borrows its own separate thread from the shared pool. Genuine per-item parallel processing within one subscriber's stream is a real, achievable thing — it's just a distinct, explicit technique covered later in this section, not something schedulers give you automatically.",
      "Default thread pool sizing is worth knowing loosely, not memorizing: parallel() sizes itself to the number of CPU cores (since only one thread genuinely runs per core at a time anyway), boundedElastic() defaults to roughly ten times the CPU core count (since blocked/idle threads are the expected normal state for that pool), single() is exactly one thread, and immediate() isn't a pool at all.",
    ],
    note: {
      label: 'The misconception, stated plainly',
      text: '"Using Schedulers.parallel() makes my one subscriber\'s items process in parallel automatically" is false. A scheduler changes which thread does sequential work — it does not, by itself, split one stream across multiple threads.',
    },
  },
  {
    id: '7.10',
    title: 'Publish On',
    duration: '4 min',
    kind: 'theory',
    summary: [
      "subscribeOn gives a producer's author control over which thread does the producing — appropriate, since they understand their own producer's needs. But once that choice is locked in, a consumer of that publisher inherits whatever thread the producer's author chose for everything, including the consumer's own downstream operators — which might not be what the consumer actually wants.",
      "publishOn exists to give the consumer side that same kind of control, but for downstream instead of upstream. Positioned anywhere in a chain, it doesn't affect anything happening above it — the current thread keeps doing setup and production exactly as it would without publishOn present. Only once data flows back down and reaches the publishOn does the handoff happen: everything from that point down to the subscriber runs on the scheduler publishOn specifies.",
      "The short version, worth memorizing directly: subscribeOn controls the thread for everything upstream (toward the producer); publishOn controls the thread for everything downstream (toward the subscriber) from where it's placed.",
    ],
  },
  {
    id: '7.11',
    title: 'Publish On — Demo',
    duration: '5 min',
    kind: 'demo',
    summary: [
      "Swapping the earlier subscribeOn demo's operator for publishOn(Schedulers.boundedElastic()) in the exact same position reveals the asymmetry directly. Both doFirst() calls — the one above publishOn and the one below it — now print on the same calling thread, and so does the actual data generation. publishOn genuinely doesn't touch anything happening on the way up.",
      "The handoff only happens once data starts flowing back down: the doOnNext() below publishOn, and delivery to the subscriber, run on boundedElastic instead of the calling thread — but the generation step itself, upstream of publishOn, stayed on the original thread the entire time.",
      "Multiple publishOn calls in one chain hand off repeatedly, in order, as data flows downward — each one taking over from where the previous one left off, right up until the final delivery to the subscriber.",
    ],
    code: `Flux.create(sink -> {
        log.info("Generating");
        sink.next(1);
        sink.next(2);
        sink.complete();
    })
    .doFirst(() -> log.info("first-one"))
    .publishOn(Schedulers.boundedElastic())
    .doFirst(() -> log.info("first-two"))
    .doOnNext(i -> log.info("value {}", i))
    .subscribe(Util.subscriber());
// UNLIKE subscribeOn: "first-two" AND the actual generation both still
// run on the CALLING thread — publishOn doesn't touch anything upstream
// of itself. Only once data flows back DOWN through publishOn does the
// handoff happen: "value 1"/"value 2" and delivery to the subscriber run
// on boundedElastic instead.

// Multiple publishOn calls hand off repeatedly, in order, as data flows down:
Flux.create(sink -> { sink.next(1); sink.next(2); sink.complete(); })
    .publishOn(Schedulers.parallel())          // takes over first
    .doOnNext(i -> log.info("after parallel: {}", i))
    .publishOn(Schedulers.boundedElastic())     // takes over next
    .subscribe(Util.subscriber());
// production: calling thread. First doOnNext: Schedulers.parallel().
// Final delivery to the subscriber: boundedElastic.`,
  },
  {
    id: '7.12',
    title: 'Blocking Event Loop — Issue Fix',
    duration: '7 min',
    kind: 'demo',
    summary: [
      "A genuinely important real-world failure mode: the reactor-netty event-loop thread from Section 2 is a scarce, precious resource specifically because it's supposed to be free to keep servicing many concurrent I/O requests. Chaining a slow, blocking-style .map(product -> process(product)) directly onto the client's result — where process() deliberately sleeps for a second to simulate CPU-heavy work — drags that same event-loop thread into doing the slow work itself.",
      "The measurable consequence: five requests that used to all complete in roughly one second (the whole point of the non-blocking client from Section 2) now take roughly five seconds — because the single event-loop thread that's supposed to be firing off requests and picking up responses is instead stuck running process() for one product before it can even look at the next response.",
      "The fix belongs to the client's author, not its consumers: adding .publishOn(Schedulers.boundedElastic()) inside getProductName() itself, right before the value is handed off, protects the event-loop thread from ever being pulled into whatever slow work a consumer chains on afterward. With that one line added inside the client, the exact same slow .map(process) from before goes right back to completing all five requests in roughly one second — because process() now runs on boundedElastic, never on the event loop.",
    ],
    code: `private static String process(String input) {
    Util.sleepSeconds(1); // simulate a slow, CPU-heavy transformation
    return input + " processed";
}

var client = new ExternalServiceClient();
for (int i = 1; i <= 5; i++) {
    client.getProductName(i)
        .map(ExternalServiceClientDemo::process) // BROKEN: runs on the event-loop thread!
        .doOnNext(msg -> log.info("Got: {}", msg))
        .subscribe(Util.subscriber());
}
Util.sleepSeconds(20);
// Takes ~5 seconds instead of ~1 — the single event-loop thread gets
// dragged into running process() for each response, leaving it no time
// to go pick up the NEXT response while it's busy.

// FIX — protect the event loop inside the CLIENT itself, before consumers
// ever get a chance to chain slow work onto the result:
public Mono<String> getProductName(int productId) {
    return httpClient.get()
        .uri("/demo01/product/" + productId)
        .responseContent()
        .asString()
        .next()
        .publishOn(Schedulers.boundedElastic()); // protects the event-loop thread
}
// Now client.getProductName(i).map(process) runs process() on
// boundedElastic, never on the event loop — all 5 responses complete in
// ~1 second again, regardless of what consumers do downstream.`,
    note: {
      label: 'Whose responsibility is this?',
      text: "If you're the author exposing a non-blocking client backed by a scarce thread (an event loop, a driver's I/O thread), protect that thread with publishOn() inside your own code — don't rely on every consumer remembering to do it correctly downstream.",
    },
  },
  {
    id: '7.13',
    title: 'Publish On + Subscribe On',
    duration: '5 min',
    kind: 'demo',
    summary: [
      "Both operators can appear in the same pipeline, and the combination is entirely predictable once each half is understood on its own: subscribeOn still hands off exactly once, upstream — the calling thread does its setup, crosses subscribeOn, and everything from there up (through the producer, back down to wherever publishOn appears) runs on subscribeOn's chosen scheduler.",
      "publishOn then hands off a second time, downstream of where it appears — everything past that point, down to the subscriber, runs on publishOn's chosen scheduler instead. Two independent handoffs, each governing a different half of the same pipeline, with no interaction or conflict between them.",
    ],
    code: `flux
    .subscribeOn(Schedulers.boundedElastic()) // upstream: production happens HERE
    .publishOn(Schedulers.parallel())          // downstream: delivery happens HERE
    .subscribe(Util.subscriber());
// subscribeOn hands off ONCE, upstream — everything from the producer down
// to the publishOn runs on boundedElastic. publishOn then hands off AGAIN,
// downstream — everything from that point down to the subscriber runs on
// Schedulers.parallel() instead. Two handoffs, two different halves of
// the same chain, no conflict between them.`,
  },
  {
    id: '7.14',
    title: 'Parallel Execution',
    duration: '7 min',
    kind: 'demo',
    summary: [
      "Genuine per-item parallel processing within a single subscriber's stream — as opposed to the sequential-by-default behavior everything else in this section has relied on — needs two specific operators used together: parallel() to split a sequence into logical 'rails,' and runOn(Scheduler) to specify which thread pool actually executes those rails concurrently. parallel() alone does nothing without runOn() telling it which scheduler to use.",
      "With Flux.range(1, 10).parallel().runOn(Schedulers.parallel()) in front of a deliberately slow per-item transformation, items that used to process one at a time now process as many at once as the scheduler has threads (one per CPU core, by default, for Schedulers.parallel()). parallel(n) lets you cap that concurrency explicitly — parallel(3) processes at most 3 items at a time regardless of how many CPU cores are actually available.",
      "sequential() merges the parallel rails back into a single ordinary Flux — useful when only one specific step genuinely benefits from parallelism and everything before or after it should go back to normal one-at-a-time processing. The section's closing recommendation is worth taking seriously: prefer genuinely non-blocking I/O (the reactive drivers, the reactor-netty approach from Section 2) for network calls specifically — parallel()/runOn() is for CPU-bound work, not a substitute for proper non-blocking I/O.",
    ],
    code: `private static int slowDouble(int i) {
    log.info("Time-consuming task");
    Util.sleepSeconds(1);
    return i * 2;
}

Flux.range(1, 10)
    .map(SomeClass::slowDouble)
    .subscribe(Util.subscriber());
// sequential — one item at a time, ~10 seconds total

Flux.range(1, 10)
    .parallel()                     // splits the sequence into logical "rails"
    .runOn(Schedulers.parallel())   // MUST specify which pool actually runs them
    .map(SomeClass::slowDouble)
    .subscribe(Util.subscriber());
Util.sleepSeconds(3);
// genuinely parallel — as many items processed simultaneously as
// Schedulers.parallel() has threads (one per CPU core, by default)

Flux.range(1, 10)
    .parallel(3)                    // cap concurrency explicitly: 3 at a time
    .runOn(Schedulers.parallel())
    .map(SomeClass::slowDouble)
    .subscribe(Util.subscriber());
Util.sleepSeconds(30);

// .sequential() merges the parallel rails back to normal — useful when
// only ONE step needs parallelism:
Flux.range(1, 10)
    .parallel()
    .runOn(Schedulers.parallel())
    .map(SomeClass::slowDouble)   // this step runs in parallel
    .sequential()                  // merge back to a normal, ordered Flux
    .map(i -> i + "-done")         // this step runs sequentially again
    .subscribe(Util.subscriber());`,
    note: {
      label: 'Prefer non-blocking I/O for network calls',
      text: "parallel()/runOn() is genuinely useful for CPU-bound work. For network calls specifically, prefer the non-blocking-I/O approach from Section 2 — Section 2's 100-concurrent-request demo used one single thread and finished in about a second, without any of this.",
    },
  },
  {
    id: '7.15',
    title: 'Summary',
    duration: '5 min',
    kind: 'summary',
    summary: [
      "Threading and concurrency are genuinely hard to get right by hand, even for experienced developers — Reactor's job throughout this section has been to simplify that without hiding the underlying model. Default behavior: whoever calls subscribe() does everything, and that's completely fine most of the time. The exception worth watching for is unintentionally blocking a thread that's supposed to stay free — like an event-loop thread meant only for I/O.",
      "Four built-in schedulers cover the common cases: boundedElastic() for blocking/network work, parallel() for CPU-bound work (sized to core count), single() for strict one-thread sequential execution, and immediate() as a genuine no-op. subscribeOn (upstream — controls who produces) and publishOn (downstream — controls who delivers) are the two operators that actually apply a scheduler; multiple subscribeOn calls collapse to whichever is closest to the producer (deliberately, so producer authors keep control of their own thread choices), while multiple publishOn calls each take effect in order as data flows down.",
      "Schedulers do not automatically parallelize a single subscriber's stream — each subscriber still gets processed sequentially, one borrowed thread at a time. Genuine per-item parallelism requires the explicit parallel() + runOn() pairing, with sequential() available to merge back to normal afterward. And for network calls specifically, prefer real non-blocking I/O over parallel threads — it's the more efficient tool for that particular job.",
    ],
    keyPoints: [
      'Default: whoever calls subscribe() executes the entire chain, on one thread.',
      'subscribeOn (upstream, closest-to-producer wins) vs. publishOn (downstream, each one applies in order) — the two scheduling operators.',
      'Schedulers do not parallelize one subscriber automatically — that needs the explicit parallel()+runOn() pairing.',
      'Protect scarce threads (event loops, driver I/O threads) with publishOn() inside your own exposed code, rather than trusting every consumer to do it correctly.',
      'Prefer real non-blocking I/O over parallel threads for network calls specifically.',
    ],
  },
]
