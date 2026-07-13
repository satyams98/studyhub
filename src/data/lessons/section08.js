export default [
  {
    id: '8.1',
    title: 'Introduction',
    duration: '4 min',
    kind: 'theory',
    summary: [
      "This entire section is explicitly marked optional — skipping it costs little if backpressure genuinely never shows up in your own use cases, but understanding it is what makes the 'non-blocking backpressure' phrase from the Reactive Streams definition back in Section 1 actually mean something concrete.",
      "The problem in one sentence: a producer generating 1,000 items per second feeding a consumer that can only process 1 item per second has nowhere for the other 999 to go, every single second. If the producer keeps producing regardless, items pile up somewhere — and 'somewhere' eventually means an OutOfMemoryError or genuinely unpredictable behavior. Backpressure handling is whatever mechanism keeps that from happening — either the producer slowing itself down, or some intermediate strategy deciding what to do with the excess.",
    ],
    note: {
      label: 'The core problem, restated',
      text: 'Fast producer + slow consumer = items accumulate somewhere with nowhere safe to go. Everything in this section is a different answer to "what happens to the excess?"',
    },
  },
  {
    id: '8.2',
    title: 'Automatic Backpressure Handling',
    duration: '11 min',
    kind: 'demo',
    summary: [
      "A Flux.generate()-based producer with no stopping condition at all — no take(), no counter, nothing — paired with a deliberately slow consumer (a mapped task that sleeps for a second) sets up the base case. Splitting production and consumption across separate schedulers (subscribeOn for the producer, publishOn for the consumer) removes the safety of everything running on one thread, so the actual pressure between the two sides can surface.",
      "The result is genuinely surprising the first time you see it: the producer generates exactly 256 items and then simply stops — automatically, with nothing in the code telling it to. That number comes from Reactor's own internal queue: Queues.SMALL_BUFFER_SIZE, sized to whichever is larger of 256 or a reactor.bufferSize.small system property, with an enforced floor of 16.",
      "Setting that property down to the minimum (16) makes the underlying mechanism directly observable: the producer fills the queue to 16 items and stops completely. Once the consumer has drained roughly 75% of the queue (about 12 items), the producer resumes — refilling exactly enough to hit 16 again — then stops once more, repeating this fill-drain-refill cycle indefinitely. This is Reactor's own internal queue managing the handoff between two independently-scheduled threads: fill until full, pause, wait for 75% to drain, resume, repeat.",
    ],
    code: `Flux<Integer> flux = Flux.generate(
        () -> 1,
        (state, sink) -> {
            log.info("Generating {}", state);
            sink.next(state);
            return state + 1;
        })
    .cast(Integer.class);

private static String timeConsumingTask(int value) {
    Util.sleepSeconds(1); // deliberately slow consumer
    return "processed " + value;
}

flux.subscribeOn(Schedulers.parallel())
    .publishOn(Schedulers.boundedElastic())
    .map(SomeClass::timeConsumingTask)
    .subscribe(Util.subscriber());
Util.sleepSeconds(60);
// No take(), no stopping condition — this "should" run forever. Instead,
// the producer generates exactly 256 items and then just stops on its
// own, waiting for the slow consumer to catch up.

// 256 comes from Reactor's internal queue size, with an enforced floor of 16:
System.setProperty("reactor.bufferSize.small", "16");
// Now the SAME pipeline stops after exactly 16 items instead of 256 — small
// enough to watch the pattern repeat: producer fills the queue to 16, stops
// entirely, waits for ~75% of it to drain (~12 items), resumes producing
// exactly enough to refill it, and stops again — over and over.`,
    note: {
      label: "This is generate()'s automatic handling — create() doesn't have it",
      text: "Flux.generate() understands downstream demand natively, which is exactly why this works with zero extra code. Flux.create() has no such awareness — that gap, and what to do about it, is the rest of this section.",
    },
  },
  {
    id: '8.3',
    title: 'Limit Rate',
    duration: '5 min',
    kind: 'demo',
    summary: [
      "limitRate(n) lets a consumer explicitly tell an upstream producer 'don't hand me more than n unconsumed items at a time,' regardless of how large the internal queue actually is. Chaining .limitRate(5) onto the same producer/consumer setup from the previous lecture caps in-flight production at 5 instead of the full 256 (or 16) queue size — visibly slowing the whole pipeline down to something closer to the consumer's actual pace.",
      "A quick apparent oddity in the console output — seeing two items generated back-to-back rather than a clean one-for-one pace — turns out to be a logging-order artifact rather than a real problem: the first item is picked up by the consuming operator essentially instantly (leaving the small buffer briefly empty), which is exactly what triggers production of the second item right away.",
    ],
    code: `flux
    .subscribeOn(Schedulers.parallel())
    .publishOn(Schedulers.boundedElastic())
    .limitRate(5) // "never hand me more than 5 unconsumed items at a time"
    .map(SomeClass::timeConsumingTask)
    .subscribe(Util.subscriber());
// production caps at 5 in-flight items instead of the full internal queue
// size, refilling roughly one at a time as the consumer finishes each item`,
  },
  {
    id: '8.4',
    title: 'Back Pressure With Multiple Subscribers',
    duration: '3 min',
    kind: 'demo',
    summary: [
      "Attaching two independent subscribers to the same producer — one slow (with limitRate(5) and the sleeping consumer task) and one fast (with a plain .take(100) and no throttling at all) — confirms that backpressure handling is entirely per-subscriber, not shared across a cold publisher's independent streams.",
      "The fast subscriber races through all 100 items essentially immediately, completely unaffected by the slow subscriber's throttling. The slow subscriber's producer, meanwhile, keeps pacing itself independently based on its own consumer's actual speed — each stream manages its own backpressure in complete isolation from the other.",
    ],
    code: `Flux<Integer> flux = /* same producer as before */;

flux.subscribeOn(Schedulers.parallel())
    .limitRate(5)
    .map(SomeClass::timeConsumingTask)
    .subscribe(Util.subscriber("slow-subscriber"));

flux.subscribeOn(Schedulers.parallel()) // its own independent cold stream
    .take(100)
    .subscribe(Util.subscriber("fast-subscriber"));
// fast-subscriber finishes almost immediately, unthrottled. slow-subscriber's
// stream continues pacing itself entirely independently, based only on its
// own consumer's speed — no interaction between the two at all`,
  },
  {
    id: '8.5',
    title: 'Flux Create — Back Pressure Problem',
    duration: '9 min',
    kind: 'demo',
    summary: [
      "The automatic handling from earlier in this section is specific to Flux.generate() — it genuinely understands downstream demand because Reactor itself controls the loop. Flux.create() has no such awareness; you control the loop, and by default it has no idea how much the downstream actually wants.",
      "Rebuilding the same slow-consumer setup with a Flux.create()-based producer (deliberately paced to roughly 20 items/second against a consumer doing roughly 1/second) exposes the gap directly: the first 16 items get through cleanly, and then... nothing. The consumer log falls completely silent, even though the producer keeps right on logging 'Generating 17', 'Generating 18', all the way to 500 — it never learns to slow down, because create()'s sink simply keeps accepting next() calls into an internal queue that's already full, silently declining to hand anything further to the subscriber.",
      "The tempting fix — adding .limitRate(1) to explicitly tell the producer to slow down — actually makes things worse, not better: now only the very first item gets through cleanly at all. limitRate() communicates a signal that a demand-aware producer like generate() can act on; Flux.create() simply doesn't listen to that signal the same way, because it was never built to.",
    ],
    code: `Flux<Integer> flux = Flux.create(sink -> {
    for (int i = 1; i <= 500 && !sink.isCancelled(); i++) {
        log.info("Generating {}", i);
        sink.next(i);
        Util.sleep(Duration.ofMillis(50)); // producer: ~20 items/second
    }
    sink.complete();
});

flux.subscribeOn(Schedulers.parallel())
    .publishOn(Schedulers.boundedElastic())
    .doOnNext(i -> log.info("Received {}", i)) // consumer-side visibility
    .map(SomeClass::timeConsumingTask)          // consumer: ~1 item/second
    .subscribe(Util.subscriber());
// "Received 1" through "Received 16" print cleanly, then NOTHING further —
// even though the producer keeps logging "Generating 17", "Generating 18"...
// all the way to 500. create() has no idea how much downstream wants; it
// just keeps producing into an already-full internal queue.

flux.limitRate(1) // tempting fix — makes it WORSE, not better
    .subscribe(Util.subscriber());
// now only the very FIRST item gets through cleanly — limitRate() signals
// a demand-aware producer to slow down; create() simply doesn't act on it`,
    note: {
      label: 'The actual gap this section exists to close',
      text: "generate() is demand-aware by construction. create() is not, by design — it hands you full manual control instead. That control means the responsibility for handling excess production shifts to you, via the strategies covered in the rest of this section.",
    },
  },
  {
    id: '8.6',
    title: 'Buffer Strategy',
    duration: '5 min',
    kind: 'demo',
    summary: [
      "onBackpressureBuffer() inserts an operator that acts as an in-memory holding area between an over-producing upstream and a slower downstream — accepting everything the producer emits and storing it until the consumer is ready for it, rather than letting the queue simply fill and stall the way the previous lecture's raw create() did.",
      "Applied to the same 500-item create()-based producer, items now flow to the consumer steadily, one per second, all the way through — instead of stalling after 16. The buffer is unbounded by default, which makes this strategy well-suited to occasional spikes with a consumer that reliably catches up over time (a click-stream with a busy afternoon and a quiet overnight, for instance) — but a genuinely and permanently slower consumer will simply grow that buffer without bound.",
    ],
    code: `flux
    .onBackpressureBuffer() // unbounded in-memory queue between producer and consumer
    .subscribeOn(Schedulers.parallel())
    .publishOn(Schedulers.boundedElastic())
    .doOnNext(i -> log.info("Received {}", i))
    .map(SomeClass::timeConsumingTask)
    .subscribe(Util.subscriber());
// "Received 1", 2, 3, 4... now arrive steadily, one per second, all the
// way through — onBackpressureBuffer() absorbs the excess into memory
// instead of letting the internal queue simply fill and stall`,
  },
  {
    id: '8.7',
    title: 'Error Strategy',
    duration: '4 min',
    kind: 'demo',
    summary: [
      "onBackpressureError() takes the opposite approach from buffering: rather than absorbing excess production, it actively monitors whether the producer is emitting more than was actually requested, and the moment it detects that, sends an error downstream and a cancel signal upstream — a hard, immediate stop instead of any attempt to hold or discard the overflow.",
      "Watching it run shows the exact trigger: the first item or two flow through cleanly (matching what was actually requested), but as soon as the producer emits an item beyond what's currently requested — the receiver being 'overrun by more signals than expected,' in Reactor's own terminology — the whole sequence terminates immediately with that error.",
    ],
    code: `flux
    .onBackpressureError() // watches for the producer outrunning actual requests
    .subscribeOn(Schedulers.parallel())
    .publishOn(Schedulers.boundedElastic())
    .doOnNext(i -> log.info("Received {}", i))
    .map(SomeClass::timeConsumingTask)
    .subscribe(Util.subscriber());
// the moment the producer emits more items than were actually requested,
// onBackpressureError() sends an error downstream AND cancels upstream —
// an immediate hard stop, no buffering or dropping attempted at all`,
  },
  {
    id: '8.8',
    title: 'Fixed Size Buffer Strategy',
    duration: '2 min',
    kind: 'demo',
    summary: [
      "onBackpressureBuffer(n) is a hybrid of the two previous strategies: it behaves like a genuine buffer up to n items, absorbing that many into memory just like the unbounded version — but the moment an (n+1)th item arrives while the buffer is already full, it switches to the error strategy's behavior, sending an error downstream and cancelling upstream.",
      "With a capacity of 10, the first item flows through immediately, items 2 through 11 fill the buffer, and the arrival of a 12th item while that buffer is still full is exactly what triggers the error — the buffer isn't 'the 11th item fails,' it's 'once the buffer is genuinely full, the very next arrival is what fails.'",
    ],
    code: `flux
    .onBackpressureBuffer(10) // bounded buffer — holds at most 10 items
    .subscribeOn(Schedulers.parallel())
    .publishOn(Schedulers.boundedElastic())
    .doOnNext(i -> log.info("Received {}", i))
    .map(SomeClass::timeConsumingTask)
    .subscribe(Util.subscriber());
// buffer + error hybrid: absorbs up to 10 items into memory, but the
// arrival of an 11th item while the buffer is already full triggers the
// same error-and-cancel behavior as onBackpressureError()`,
  },
  {
    id: '8.9',
    title: 'Drop Strategy',
    duration: '8 min',
    kind: 'demo',
    summary: [
      "onBackpressureDrop() takes a fundamentally different approach: rather than buffering excess items or erroring out, it only lets through whatever the downstream has genuinely requested at that moment, and silently discards everything else the producer emits in between requests — no accumulation, no error, just data loss for anything unrequested.",
      "Pairing it with limitRate(1) (so exactly one request is pending at a time) and a log() call for visibility shows the mechanism directly: while item 1 is being processed downstream, the producer keeps right on emitting 2, 3, 4, 5... with no matching request for any of them, and onBackpressureDrop() discards every single one. Only once the consumer finishes item 1 and a new request goes out does onBackpressureDrop() let through whichever item the producer happens to be emitting at that exact moment — which, because time has passed, is likely to be a much higher number, not a clean continuation.",
      "This trades data completeness for staying current and never falling behind or crashing — appropriate whenever seeing every single value isn't actually required, only whatever's genuinely current when you're ready to look.",
    ],
    code: `flux
    .log()
    .onBackpressureDrop()
    .subscribeOn(Schedulers.parallel())
    .publishOn(Schedulers.boundedElastic())
    .limitRate(1)
    .map(SomeClass::timeConsumingTask)
    .subscribe(Util.subscriber());
// onBackpressureDrop() only lets through items matching an ACTUAL pending
// request — with limitRate(1) requesting one at a time, everything the
// fast producer emits WHILE item 1 is still being processed (2, 3, 4, 5...)
// is silently discarded. Once a new request finally goes out, whichever
// item the producer happens to be emitting right then gets through —
// likely a much higher number, not a clean continuation from where it left off`,
  },
  {
    id: '8.10',
    title: 'Latest Strategy',
    duration: '4 min',
    kind: 'demo',
    summary: [
      "onBackpressureLatest() is nearly identical to onBackpressureDrop(), with exactly one difference: instead of discarding every unrequested item outright, it continuously holds onto just the single most recently produced one — overwriting that held value every time a newer item arrives — so that whenever the next downstream request finally shows up, it's answered with the freshest available value rather than nothing at all.",
      "Watching it run: as items 3, 4, 5, 6... arrive with no pending request, each one replaces the previously-held 'latest' item rather than all being discarded. When a request finally does arrive, whatever item happened to be held at that exact moment (say, item 19) is what gets delivered — genuinely the most current value available, just not necessarily the very next one in sequence.",
    ],
    code: `flux
    .onBackpressureLatest() // like drop, but always keeps the MOST RECENT unrequested item
    .subscribeOn(Schedulers.parallel())
    .publishOn(Schedulers.boundedElastic())
    .limitRate(1)
    .map(SomeClass::timeConsumingTask)
    .subscribe(Util.subscriber());
// identical dropping behavior to onBackpressureDrop(), except instead of
// discarding every unrequested item, it holds onto just the SINGLE latest
// one — continuously overwritten as newer items arrive — so the next
// downstream request is answered with the freshest value available`,
  },
  {
    id: '8.11',
    title: 'Flux Create — Overflow Strategy',
    duration: '1 min',
    kind: 'demo',
    summary: [
      "All four strategies covered in this section (plus a fifth, IGNORE, which does exactly nothing) are also available directly as a second argument to Flux.create() itself — Flux.create(sink -> {...}, FluxSink.OverflowStrategy.LATEST) — rather than chaining them on as a separate operator afterward.",
      "The tradeoff is about scope: specifying the strategy inside create() applies that one strategy uniformly to every subscriber of that Flux. Chaining the strategy on as its own operator (as done throughout this section) instead lets each individual subscriber pick a different strategy for the exact same underlying producer — one subscriber using buffer, another using latest, off the same source.",
    ],
    code: `// Passed directly as a second argument to create():
Flux.create(sink -> { /* ... */ }, FluxSink.OverflowStrategy.LATEST);
// applies ONE strategy uniformly to every subscriber of this Flux

// Chained as a separate operator instead: each subscriber can choose its
// OWN strategy for the same underlying producer
Flux<Integer> shared = Flux.create(sink -> { /* ... */ });
shared.onBackpressureBuffer().subscribe(Util.subscriber("buffered"));
shared.onBackpressureLatest().subscribe(Util.subscriber("latest-only"));`,
  },
  {
    id: '8.12',
    title: 'Summary',
    duration: '3 min',
    kind: 'summary',
    summary: [
      "A pipeline running entirely on one thread (no subscribeOn/publishOn) never actually experiences backpressure, because production and consumption are inherently synchronized by sharing one thread. The problem only surfaces once separate schedulers let a producer genuinely outrun its consumer — at which point excess items need somewhere defined to go, or the result is the 'unpredictable behavior, possibly an OutOfMemoryError' outcome this whole section exists to prevent.",
      "Flux.generate() handles this automatically, because it's demand-aware by construction — Reactor's own internal queue fills, pauses production entirely once full, and resumes once roughly 75% has drained, with zero extra code required. Flux.create() has no equivalent built-in awareness, which is exactly why this section's strategies exist: buffer (accumulate everything, useful for occasional spikes with a consumer that eventually catches up), error (hard-stop the moment production outruns actual demand), the bounded buffer+error hybrid (cushion up to a fixed size, then hard-stop), drop (discard anything unrequested, keeping the system current at the cost of completeness), and latest (drop, but always retain the single freshest unrequested value).",
      "None of these strategies are the 'right' default choice universally — each trades completeness, memory use, and failure behavior differently, and the right one depends entirely on whether a use case can tolerate data loss, needs every value eventually delivered, or genuinely can't afford unbounded memory growth.",
    ],
    keyPoints: [
      'Backpressure only becomes a real risk once separate schedulers let production genuinely outrun consumption.',
      "Flux.generate() handles it automatically via Reactor's internal queue (fill, pause at full, resume at ~75% drained).",
      'Flux.create() has no built-in demand awareness — hence the explicit strategies: buffer, error, bounded buffer+error, drop, latest.',
      'Buffer/error trade memory risk for completeness; drop/latest trade completeness for staying current and bounded.',
    ],
  },
]
