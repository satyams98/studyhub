export default [
  {
    id: '5.1',
    title: 'Introduction',
    duration: '3 min',
    kind: 'theory',
    summary: [
      "Operators are decorators — the same relationship a shot of espresso has to an Americano (add water), a flat white (add steamed milk), or a latte (add milk foam on top of that). Each addition changes the drink without changing what it fundamentally is: still coffee, just decorated with more ingredients based on preference.",
      "A Publisher works the same way. Flux.range(1, 10) is the espresso; chaining .filter(evenOnly) is one ingredient, .map(times100) is another. Every operator you add returns a new instance — a new Java object — which is exactly what you need to remember to subscribe to (or keep a reference to) rather than the original, undecorated publisher.",
      "This section starts building out the operator vocabulary in earnest — filter and map were unavoidable earlier because they're identical to Java Stream's own operators, but the reactive-specific ones (handle, the do-hooks, error handling, timeout, transform, and more) are what actually let you build a real business pipeline in a declarative, readable style.",
    ],
    code: `Flux.range(1, 10)
    .filter(i -> i % 2 == 0)   // decorator #1
    .map(i -> i * 100)         // decorator #2
    .subscribe(Util.subscriber());
// Each operator call returns a brand-new Flux instance — always subscribe
// to (or keep a reference to) the final, fully-decorated pipeline, not an
// intermediate one.`,
  },
  {
    id: '5.2',
    title: 'Operator — Handle',
    duration: '7 min',
    kind: 'demo',
    summary: [
      "handle() behaves like filter() and map() fused into one operator — useful the moment a requirement doesn't cleanly separate into 'keep this or drop it' plus 'transform this' as two independent steps. The motivating (deliberately odd) requirement: given Flux.range(1, 10), turn 1 into -2, drop 4 entirely, turn 7 into an error, and pass everything else through unchanged.",
      "handle() accepts a BiConsumer<T, SynchronousSink<R>> — the same SynchronousSink vocabulary from Flux.generate(): call sink.next() to emit (a transformed value, or the original value unchanged), call sink.error() to signal a problem, or simply do nothing at all for a value you want silently dropped.",
      "One practical wrinkle: because handle() can't always infer your target type precisely, the result often comes back as Flux<Object> rather than Flux<Integer>. Chaining .cast(Integer.class) right after resolves that when you know the concrete type.",
    ],
    code: `Flux.range(1, 10)
    .handle((Integer item, SynchronousSink<Integer> sink) -> {
        switch (item) {
            case 1 -> sink.next(-2);                            // 1 becomes -2
            case 4 -> { /* emit nothing for 4 — silently dropped */ }
            case 7 -> sink.error(new RuntimeException("oops")); // 7 becomes an error
            default -> sink.next(item);                          // everything else, unchanged
        }
    })
    .cast(Integer.class) // handle() often can't infer the exact type — cast if you need Flux<Integer>
    .subscribe(Util.subscriber());
// -2, 2, 3, (4 skipped), 5, 6, then error("oops") — 8, 9, 10 never arrive,
// because after an error, nothing follows

// Remove the case 7 branch and the same pipeline runs cleanly to completion:
// -2, 2, 3, (4 skipped), 5, 6, 7, 8, 9, 10, complete`,
    note: {
      label: 'Remember: every operator returns a new instance',
      text: "flux.handle(...) doesn't mutate flux — it returns a new Flux. Subscribing to the original flux instead of the result of .handle(...) is a common early mistake, and it silently skips whatever behavior you just added.",
    },
  },
  {
    id: '5.3',
    title: 'Operator — Handle Assignment',
    duration: '1 min',
    kind: 'demo',
    summary: [
      "A quick reimplementation of the familiar 'generate random countries until Canada shows up' requirement, this time using handle() instead of a condition baked into Flux.generate() itself — reinforcing that the same requirement often has more than one clean operator-based solution.",
    ],
    code: `Flux.generate(sink -> sink.next(Util.faker().country().name()))
    .handle((String country, SynchronousSink<String> sink) -> {
        sink.next(country);
        if (country.equalsIgnoreCase("Canada")) {
            sink.complete();
        }
    })
    .subscribe(Util.subscriber());
// keeps emitting random countries until Canada shows up, then stops`,
  },
  {
    id: '5.4',
    title: 'Do Hooks / Callbacks',
    duration: '20 min',
    kind: 'demo',
    summary: [
      "Reactor ships a whole family of do* hooks — doFirst, doOnSubscribe, doOnRequest, doOnNext, doOnComplete, doOnError, doOnTerminate, doOnCancel, doOnDiscard, doFinally — none of which change the values flowing through the pipeline (doOnNext is really the only one that's ever used for mutation, and even that's a special case covered next lecture). Their entire purpose is visibility: run some side effect at a very specific, well-defined moment in the signal's lifecycle.",
      "The genuinely important part is the execution order, and it runs in two different directions depending on the signal. Subscription-related signals (doFirst, onSubscribe, request) travel from the subscriber upward toward the producer — so of two stacked doFirst() calls, the one closest to the subscriber in the chain actually executes first, which reads backwards on the page from how the code is written top-to-bottom. Data-related signals (onNext, onComplete, onError, onTerminate) travel the opposite direction, from the producer down toward the subscriber, in the same order they appear in the code.",
      "doOnCancel fires only on an explicit cancel — never as a side effect of complete or error, and only for whichever operator actually issued the cancel() upstream (a downstream operator's own cancellation doesn't propagate as a signal further downstream). doOnDiscard fires for any item the producer emitted that never actually reached the subscriber — commonly because a cancel() happened mid-stream and the producer kept producing anyway. doFinally fires exactly once at the very end, no matter which of complete, error, or cancel caused that end.",
      "One especially instructive detail: chaining .take(n) after a plain Flux.create()-based producer that ignores downstream demand reveals the discard mechanism directly — the producer keeps emitting past what take() actually wanted, and every one of those extra, unconsumed items shows up in doOnDiscard.",
    ],
    code: `Flux.create(sink -> {
        log.info("Producer begins");
        for (int i = 0; i < 4; i++) sink.next(i);
        sink.complete();
        log.info("Producer ends");
    })
    .doFirst(() -> log.info("doFirst-1"))
    .doOnSubscribe(s -> log.info("doOnSubscribe-1"))
    .doOnRequest(n -> log.info("doOnRequest-1: {}", n))
    .doOnNext(i -> log.info("doOnNext-1: {}", i))
    .doOnComplete(() -> log.info("doOnComplete-1"))
    .doOnTerminate(() -> log.info("doOnTerminate-1"))
    .doFinally(signal -> log.info("doFinally-1: {}", signal))
    .doFirst(() -> log.info("doFirst-2"))
    .doOnSubscribe(s -> log.info("doOnSubscribe-2"))
    .doOnRequest(n -> log.info("doOnRequest-2: {}", n))
    .doOnNext(i -> log.info("doOnNext-2: {}", i))
    .doOnComplete(() -> log.info("doOnComplete-2"))
    .doOnTerminate(() -> log.info("doOnTerminate-2"))
    .doFinally(signal -> log.info("doFinally-2: {}", signal))
    .subscribe(Util.subscriber());

// Order on a normal run, top-to-bottom in time:
//   doFirst-2, doFirst-1                     <- subscription-side: bottom-to-top
//   doOnSubscribe-1, doOnSubscribe-2         <- subscription object travels top-to-bottom
//   doOnRequest-1, doOnRequest-2             <- the request(n) itself travels top-to-bottom
//   Producer begins
//   doOnNext-1: 0, doOnNext-2: 0  (repeats for 0, 1, 2, 3)
//   doOnComplete-1, doOnTerminate-1, doOnComplete-2, doOnTerminate-2
//   doFinally-2, doFinally-1
//   Producer ends

// take(2) on the same eager Flux.create() producer reveals discards directly:
Flux.create(sink -> {
        for (int i = 0; i < 4; i++) sink.next(i); // produces all 4 regardless of demand
        sink.complete();
    })
    .doOnNext(i -> log.info("doOnNext: {}", i))
    .doOnCancel(() -> log.info("doOnCancel"))
    .doOnDiscard(Object.class, o -> log.info("Discarded: {}", o))
    .take(2)
    .subscribe(Util.subscriber());
// receives 0 and 1, then take(2) cancels upstream — but the producer had
// already emitted 2 and 3 regardless of the cancel, so both show up as
// discarded rather than delivered`,
    note: {
      label: 'Two different directions, same chain',
      text: "Subscription setup (doFirst/onSubscribe/request) flows from subscriber toward producer — read the chain bottom-to-top for those. Data (onNext/onComplete/onError) flows from producer toward subscriber — read the chain top-to-bottom for those instead.",
    },
  },
  {
    id: '5.5',
    title: 'Operator — doOnNext Clarification',
    duration: '3 min',
    kind: 'faq',
    summary: [
      "A specific worry worth addressing directly: some developers see doOnNext() used to mutate an object and immediately object — 'mutation is bad!' The nuance that gets lost: immutability being generally good doesn't make all mutation bad. Functional programming prefers pure functions with no side effects, and that's a fine default to reach for — but entity objects (a Customer, an Order) are inherently mutable by design in most Java codebases, reactive or not.",
      "In blocking code, mutating a fetched entity is completely ordinary: repository.findById(123) returns an Optional<Customer> synchronously, and you call customer.setAge(10) right there, in line, because you already have the object in hand. Reactive code can't do that — Mono<Customer> doesn't hand you the customer synchronously, so there's no 'right there, in line' moment to mutate at.",
      "doOnNext() is exactly that moment, deferred to when the value actually arrives: reactiveRepository.findById(123).doOnNext(customer -> customer.setAge(10)).flatMap(repository::save). Reactor also guarantees the mutation happens safely on whichever single thread delivers that particular item — no other thread races in to touch the same object concurrently.",
    ],
    note: {
      label: 'The actual nuance',
      text: 'Immutability being a good general default does not make every mutation wrong. Entity objects are mutable by design; doOnNext() is simply where that mutation has to happen once the value only becomes available asynchronously.',
    },
  },
  {
    id: '5.6',
    title: 'Operator — Delay Elements',
    duration: '3 min',
    kind: 'demo',
    summary: [
      "delayElements(Duration) paces out delivery of an existing sequence — Flux.range(1, 10).delayElements(Duration.ofSeconds(1)) delivers one item per second instead of all ten immediately. Like interval() and other timer-based operators, it runs on its own thread, so observing it in a plain main() demo means blocking the main thread long enough to watch it happen.",
      "The natural (and wrong) assumption is that delayElements() must be buffering all ten values internally and drip-feeding them out on a timer. Adding log() either side of it proves otherwise: without the delay, the log shows request(unbounded) — range() is asked for everything immediately. With delayElements() in the chain, the log instead shows request(1), repeated once per second. It isn't holding data back after the fact; it's genuinely pacing how much it asks the upstream for, one item at a time, on schedule.",
    ],
    code: `Flux.range(1, 10)
    .delayElements(Duration.ofSeconds(1))
    .subscribe(Util.subscriber());
Util.sleepSeconds(12); // ~10 items, ~1 second apart

// What's actually happening underneath, made visible via log():
Flux.range(1, 10)
    .log()
    .subscribe(Util.subscriber());
// request(unbounded) — range() is asked for everything at once, immediately

Flux.range(1, 10)
    .delayElements(Duration.ofSeconds(1))
    .log()
    .subscribe(Util.subscriber());
// request(1), repeated once per second — delayElements() is genuinely
// pacing its OWN requests upstream, not buffering and drip-feeding`,
  },
  {
    id: '5.7',
    title: 'Subscribe',
    duration: '1 min',
    kind: 'demo',
    summary: [
      "A quick reminder that subscribe() accepts the onNext/onError/onComplete lambdas directly, inline, as an alternative to passing a reusable Util.subscriber() instance — purely a readability choice with no behavioral difference. Under the hood it still auto-requests Long.MAX_VALUE exactly the way the lambda-based Mono overloads did back in Section 2; you're just choosing to write the callbacks at the call site instead of reusing shared scaffolding.",
    ],
    code: `Flux.range(1, 3)
    .subscribe(
        value -> log.info("Received {}", value),
        error -> log.error("Error: {}", error.getMessage()),
        () -> log.info("Completed")
    );
// Behaviorally identical to .subscribe(Util.subscriber()) — just spelled
// out inline instead of delegated to a shared helper`,
  },
  {
    id: '5.8',
    title: 'Error Handling — Part 1',
    duration: '7 min',
    kind: 'demo',
    summary: [
      "The reactive equivalent of a try/catch block starts with onErrorReturn(fallbackValue): when the upstream errors, substitute a hardcoded value and let the sequence complete normally instead of propagating the exception. A deliberately-broken map() (dividing by zero at i == 5) proves the base case — without a handler, the sequence delivers 1 through 4 then dies on the error, with 6 through 10 never arriving.",
      "Placement in the chain is not cosmetic — it changes what the operator can actually see. onErrorReturn() only catches errors from its own immediate upstream. Placed above the failing map() instead of below it, its upstream is just range() (which never errors), so the exception from map() sails right past it uncaught. The safe default is placing error-handling operators as close to the final subscribe() as the requirement allows.",
      "Multiple onErrorReturn() calls can target different exception types by class, each catching only its own type and letting everything else fall through to the next — a form of typed exception handling that reads almost like a switch statement. Everything demonstrated here for Flux works identically for Mono; none of it is Flux-specific.",
    ],
    code: `Flux.range(1, 10)
    .map(i -> i == 5 ? 10 / 0 : i) // deliberately throws ArithmeticException at i=5
    .subscribe(Util.subscriber());
// 1, 2, 3, 4, then error — nothing after 5, ever

Flux.range(1, 10)
    .map(i -> i == 5 ? 10 / 0 : i)
    .onErrorReturn(-1)
    .subscribe(Util.subscriber());
// 1, 2, 3, 4, -1, complete — the fallback value replaces the error entirely

// PLACEMENT MATTERS — this only catches errors from ITS OWN upstream:
Flux.range(1, 10)
    .onErrorReturn(-1)              // upstream here is just range() — never errors
    .map(i -> i == 5 ? 10 / 0 : i)  // this still throws, and nothing downstream catches it
    .subscribe(Util.subscriber());
// still errors — keep error handlers close to the final subscribe()

// Matching by exception type — each call handles only its own class:
Flux.range(1, 10)
    .map(i -> i == 5 ? 10 / 0 : i)
    .onErrorReturn(IllegalArgumentException.class, -1)
    .onErrorReturn(ArithmeticException.class, -2)
    .subscribe(Util.subscriber());
// -2 — matches ArithmeticException specifically`,
  },
  {
    id: '5.9',
    title: 'Error Handling — Part 2',
    duration: '6 min',
    kind: 'demo',
    summary: [
      "onErrorReturn() only ever produces a hardcoded value. When the actual requirement is 'call a different service on failure' — a real fallback publisher, not a constant — onErrorResume(Function<Throwable, Publisher<T>>) is the tool: it receives the exception and returns a whole new Mono or Flux to switch over to.",
      "Chaining several onErrorResume() calls, each scoped to a specific exception type via an overload that accepts the exception class first, builds a genuinely realistic fallback chain: try the primary service, fall back to service A on one kind of failure, fall back to service B on any other kind of failure, and add one final untyped onErrorResume() as a catch-all default in case even the last fallback itself fails.",
      "This composes cleanly precisely because each fallback is just another Publisher — which might itself be a real, independently-fallible network call — rather than a static value.",
    ],
    code: `private static Mono<Integer> fallback() {
    return Mono.fromSupplier(() -> Util.faker().number().numberBetween(10, 100));
}

Flux.range(1, 10)
    .map(i -> i == 5 ? 10 / 0 : i)
    .onErrorResume(throwable -> fallback())
    .subscribe(Util.subscriber());
// 1, 2, 3, 4, <some random 10-99>, complete — a real fallback Publisher,
// not just a static value

// A realistic multi-service fallback chain, each scoped to an exception type:
Flux.range(1, 10)
    .map(i -> i == 5 ? 10 / 0 : i)
    .onErrorResume(ArithmeticException.class, e -> fallbackOne())
    .onErrorResume(RuntimeException.class, e -> fallbackTwo())
    .onErrorResume(e -> Mono.just(-5)) // last-resort default if fallbackTwo() itself fails
    .subscribe(Util.subscriber());`,
    note: {
      label: 'onErrorReturn vs onErrorResume',
      text: 'onErrorReturn() answers with a hardcoded value. onErrorResume() answers with a whole new Publisher — which can be a real network call to a fallback service, potentially fallible in its own right.',
    },
  },
  {
    id: '5.10',
    title: 'Error Handling — Part 3',
    duration: '1 min',
    kind: 'demo',
    summary: [
      "onErrorComplete() is the simplest of the error operators: it swallows the error entirely and makes the sequence look exactly like it completed normally, with whatever items had already arrived before the error and nothing more. No fallback value, no fallback publisher — just 'pretend this ended cleanly.' Useful specifically when a Subscriber genuinely doesn't want to be bothered with exception details at all, only a clean stop.",
    ],
    code: `Flux.range(1, 10)
    .map(i -> i == 5 ? 10 / 0 : i)
    .onErrorComplete()
    .subscribe(Util.subscriber());
// 1, 2, 3, 4, complete — the error is swallowed entirely; nothing about
// it is visible to the subscriber beyond a normal onComplete()`,
  },
  {
    id: '5.11',
    title: 'Error Handling — Part 4',
    duration: '2 min',
    kind: 'demo',
    summary: [
      "Every error-handling operator so far ends the sequence one way or another — a value, a fallback publisher, or a clean completion, but always terminal. onErrorContinue((throwable, item) -> ...) is different: it's the one operator that lets the sequence genuinely keep going past the error, skipping just the item that caused it.",
      "The BiConsumer it accepts receives both the exception and the specific item that triggered it, and does whatever logging or side effect makes sense — the failing item itself is simply dropped, and everything after it in the source keeps flowing normally.",
    ],
    code: `Flux.range(1, 10)
    .map(i -> i == 5 ? 10 / 0 : i)
    .onErrorContinue((throwable, item) -> log.warn("Skipping {}: {}", item, throwable.getMessage()))
    .subscribe(Util.subscriber());
// 1, 2, 3, 4, (5 logged as skipped — never emitted), 6, 7, 8, 9, 10, complete`,
    note: {
      label: 'The one operator that keeps going',
      text: "onErrorReturn/onErrorResume/onErrorComplete all end the sequence. onErrorContinue() is the exception: it drops the offending item and lets everything downstream of it keep flowing.",
    },
  },
  {
    id: '5.12',
    title: 'Operator — Default If Empty',
    duration: '3 min',
    kind: 'demo',
    summary: [
      "The empty-value counterpart to onErrorReturn(): defaultIfEmpty(fallbackValue) supplies a hardcoded substitute only when the source completes with zero items — the reactive equivalent of Optional.orElse(). Mono.empty().defaultIfEmpty(-1) yields -1; a Flux filtered down to nothing yields the fallback in its place.",
      "It's genuinely conditional on actual emptiness, not just 'did a filter run' — filtering Flux.range(1,10) down to values greater than 9 still lets 10 through, so defaultIfEmpty() never fires; the real value is delivered as normal.",
    ],
    code: `Mono.<Integer>empty()
    .defaultIfEmpty(-1)
    .subscribe(Util.subscriber());
// -1, complete

Flux.range(1, 10)
    .filter(i -> i > 11)      // nothing passes — genuinely empty
    .defaultIfEmpty(50)
    .subscribe(Util.subscriber());
// 50, complete

Flux.range(1, 10)
    .filter(i -> i > 9)       // 10 passes — no longer empty
    .defaultIfEmpty(50)
    .subscribe(Util.subscriber());
// 10, complete — defaultIfEmpty() never fires; at least one real item got through`,
  },
  {
    id: '5.13',
    title: 'Operator — Switch If Empty',
    duration: '2 min',
    kind: 'demo',
    summary: [
      "switchIfEmpty() is to defaultIfEmpty() what onErrorResume() is to onErrorReturn(): instead of substituting a hardcoded value on empty, it switches over to an entirely different Publisher. Filtering a range down to nothing and chaining .switchIfEmpty(Flux.range(100, 3)) produces 100, 101, 102 in place of nothing at all.",
      "The realistic use case: a cache-then-database lookup pattern. Check Redis for a cached value first; if that Mono comes back empty, switchIfEmpty() transparently falls through to a second Mono that queries the actual database instead — one network call, and only if it's empty, a second one.",
    ],
    code: `Flux.range(1, 10)
    .filter(i -> i > 10)                  // empty
    .switchIfEmpty(Flux.range(100, 3))    // an entirely different fallback PUBLISHER
    .subscribe(Util.subscriber());
// 100, 101, 102, complete

// Realistic shape: cache first, database only if the cache is empty
Mono<String> productName = redisCache.get(productId)
    .switchIfEmpty(database.findProductName(productId));`,
  },
  {
    id: '5.14',
    title: 'Operator — Timeout',
    duration: '7 min',
    kind: 'demo',
    summary: [
      "Network calls that don't fail outright but just take too long need a different tool than error handling alone — timeout(Duration) caps how long you're willing to wait for a Publisher to emit anything (a value, a completion, or an error) before treating the silence itself as a failure.",
      "A getProductName() method that deliberately delays 3 seconds demonstrates the base case: chaining .timeout(Duration.ofSeconds(1)) means that if nothing arrives within one second, a TimeoutException fires through the normal onError() path — which means every error-handling operator from earlier in this section works on it unchanged. Chaining .onErrorReturn(\"fallback\") after the timeout turns a slow call into a clean fallback value with no special casing needed.",
      "timeout() also has an overload that accepts a fallback Publisher directly, without needing a separate onErrorResume() call: timeout(duration, fallbackPublisher). And because everything in Reactor stays lazy by default, the fallback publisher is only ever subscribed to if the primary genuinely times out — confirmed by placing a doFirst() log on the fallback and observing it never fires when the primary responds quickly enough.",
    ],
    code: `private static Mono<String> getProductName() {
    return Mono.fromSupplier(() -> Util.faker().commerce().productName())
        .delayElement(Duration.ofSeconds(3)); // simulate a slow remote call
}

getProductName().subscribe(Util.subscriber());
Util.sleepSeconds(5); // arrives after ~3 seconds, no timeout applied

getProductName()
    .timeout(Duration.ofSeconds(1))
    .subscribe(Util.subscriber());
// error: TimeoutException — nothing arrived within 1 second

getProductName()
    .timeout(Duration.ofSeconds(1))
    .onErrorReturn("fallback")
    .subscribe(Util.subscriber());
// "fallback" — a timeout's error is just another error, handled the usual way

// timeout() also accepts a fallback Publisher directly:
getProductName()
    .timeout(Duration.ofSeconds(1), getProductNameFromFallbackService())
    .subscribe(Util.subscriber());
// the fallback service is only ever subscribed to if the primary exceeds
// 1 second — if the primary responds in time, the fallback never runs at all`,
  },
  {
    id: '5.15',
    title: 'Operator — Multiple Timeouts',
    duration: '3 min',
    kind: 'demo',
    summary: [
      "A reusable Mono built elsewhere in a codebase (maybe by someone else, or inside a shared method you don't control) might already have its own timeout() baked in. Nothing stops you from layering a second, tighter timeout() on top when you subscribe — model.timeout(Duration.ofMillis(200)) works without ever touching the original code.",
      "The rule that matters: the timeout closest to your subscriber always wins for shrinking the window, but a downstream timeout can never grant more time than an upstream one already allows. Wrapping the same Mono in .timeout(Duration.ofSeconds(5)) when the upstream itself only allows 1 second doesn't get you 5 seconds — the upstream still cuts things off at its own 1-second limit regardless of what you ask for downstream.",
    ],
    code: `// A Mono built elsewhere, with its own internal timeout already applied:
Mono<String> model = getProductNameFromFallbackService();

// Layering a tighter timeout on top, without touching the original code:
model.timeout(Duration.ofMillis(200))
     .subscribe(Util.subscriber());
// errors within 200ms — your timeout is closer to the subscriber, so it wins

// But you CANNOT use a downstream timeout to grant MORE time than an
// upstream timeout already allows:
model.timeout(Duration.ofSeconds(5))
     .subscribe(Util.subscriber());
// still bound by whatever timeout the upstream Mono already enforces —
// a downstream timeout can only shrink the window, never extend it`,
  },
  {
    id: '5.16',
    title: 'Operator — Transform',
    duration: '10 min',
    kind: 'demo',
    summary: [
      "Real business pipelines tend to accumulate repeated operator sequences across otherwise-unrelated flows — the same handful of validation or logging steps showing up near-identically in an order-create pipeline, a modify-order pipeline, and a cancel-order pipeline. transform() exists to extract that repetition into something reusable, effectively letting you build your own custom operator.",
      "transform() accepts a Function<Flux<T>, Publisher<R>> — or, when the input and output types match, the same idea can be expressed more simply as a UnaryOperator<Flux<T>>: a static method that takes a Flux, chains whatever steps should be reused, and returns the result. Once written, that method plugs into any pipeline via .transform(theMethod()) regardless of the specific item type flowing through — a Flux<Customer> and a completely unrelated Flux<PurchaseOrder> can both use the exact same reusable transform.",
      "Because it's just a method reference or lambda, it composes naturally with a runtime flag: passing addDebugger() when some debug-enabled condition is true and Function.identity() (a no-op passthrough) when it's false toggles the extra behavior on or off without touching the pipeline itself.",
    ],
    code: `record Customer(int id, String name) {}
record PurchaseOrder(String productName, int quantity) {}

private static Flux<Customer> getCustomers() {
    return Flux.range(1, 3)
        .map(i -> new Customer(i, Util.faker().name().firstName()));
}

private static Flux<PurchaseOrder> getPurchaseOrders() {
    return Flux.range(1, 5)
        .map(i -> new PurchaseOrder(Util.faker().commerce().productName(), i * 10));
}

// Extract repeated steps into a reusable UnaryOperator<Flux<T>>:
private static <T> UnaryOperator<Flux<T>> addDebugger() {
    return flux -> flux
        .doOnNext(item -> log.info("Item: {}", item))
        .doOnComplete(() -> log.info("Done"));
}

// Works identically across totally unrelated item types:
getCustomers().transform(addDebugger()).subscribe(Util.subscriber());
getPurchaseOrders().transform(addDebugger()).subscribe(Util.subscriber());

// Toggle it at runtime with Function.identity() as the no-op case:
boolean debugEnabled = true; // e.g. sourced from a system property
getCustomers()
    .transform(debugEnabled ? addDebugger() : Function.identity())
    .subscribe(Util.subscriber());`,
  },
  {
    id: '5.17',
    title: '*** Assignment ***',
    duration: '2 min',
    kind: 'assignment',
    summary: [
      "Build a client whose getProductName(productId) method fully hides three layers of resilience behind one simple call: hit the primary product service first; if it takes longer than 2 seconds, fall back to a timeout-fallback service; if either one comes back empty, fall back to a separate empty-fallback service. Callers should just write client.getProductName(1) with zero awareness that any of this handling exists underneath.",
      "The demo service exposes three endpoints under /demo03/ for exactly this: the primary product endpoint, a timeout-fallback endpoint, and an empty-fallback endpoint — all accepting the same product ID pattern used throughout the course.",
    ],
    note: {
      label: 'The design constraint that matters',
      text: 'All of the timeout and empty handling has to live inside the client itself. The caller should only ever see client.getProductName(id) — no timeout(), onErrorResume(), or switchIfEmpty() visible at the call site.',
    },
  },
  {
    id: '5.18',
    title: 'Assignment Solution',
    duration: '4 min',
    kind: 'solution',
    summary: [
      "One approach: a single private helper method builds a Mono<String> for any given path plus product ID, and the public getProductName() method chains three operators from this section on top of the default-path call — .timeout(Duration.ofSeconds(2)) to cap the wait, .onErrorResume() to fall through to the timeout-fallback path on a timeout, and .switchIfEmpty() to fall through to the empty-fallback path if either call came back empty.",
      "Running it against product IDs 1 through 4 against the demo service walks through every branch: product 1 returns immediately from the primary service; product 2's primary call returns empty, so the empty-fallback handles it; product 3's primary call times out, so the timeout-fallback handles it; product 4 both times out AND finds the timeout-fallback empty, so it falls all the way through to the empty-fallback as the final resort.",
    ],
    code: `public class ExternalServiceClient extends AbstractHttpClient {
    private static final String DEFAULT_PATH = "/demo03/product/";
    private static final String TIMEOUT_PATH = "/demo03/timeout-fallback/";
    private static final String EMPTY_PATH = "/demo03/empty-fallback/";

    public Mono<String> getProductName(int productId) {
        return getProductName(DEFAULT_PATH, productId)
            .timeout(Duration.ofSeconds(2))
            .onErrorResume(e -> getProductName(TIMEOUT_PATH, productId))
            .switchIfEmpty(getProductName(EMPTY_PATH, productId));
    }

    private Mono<String> getProductName(String path, int productId) {
        return httpClient.get()
            .uri(path + productId)
            .responseContent()
            .asString()
            .next();
    }
}

var client = new ExternalServiceClient();
for (int i = 1; i <= 4; i++) {
    client.getProductName(i).subscribe(Util.subscriber());
}
Util.sleepSeconds(5);
// product 1: returns immediately from the primary service
// product 2: primary is empty -> empty-fallback handles it
// product 3: primary times out -> timeout-fallback handles it
// product 4: primary times out AND timeout-fallback is empty -> empty-fallback is the last resort`,
  },
  {
    id: '5.19',
    title: 'Summary',
    duration: '1 min',
    kind: 'summary',
    summary: [
      "Operators are processors: simultaneously a Subscriber to whatever's upstream and a Publisher to whatever's downstream, acting as the path data flows through rather than storage the data sits in. This section covered handle() (filter+map fused), the do* family of visibility hooks (and the direction each type of signal travels through a chain), error handling (onErrorReturn/onErrorResume/onErrorComplete/onErrorContinue, each trading off differently between simplicity and control), empty handling (defaultIfEmpty/switchIfEmpty), timeout() for slow-but-not-failing calls, and transform() for building genuinely reusable, type-agnostic pipeline steps.",
      "This isn't the full operator vocabulary — a few more important ones (particularly around combining publishers and batching) get dedicated sections of their own later in the course.",
    ],
    keyPoints: [
      'handle() = filter + map in one step, using the same SynchronousSink vocabulary as generate().',
      'do* hooks never change values (except doOnNext for legitimate entity mutation) — they exist purely for visibility, and travel in different directions depending on signal type.',
      'onErrorReturn (hardcoded value) / onErrorResume (fallback publisher) / onErrorComplete (swallow entirely) / onErrorContinue (skip and keep going) — four different tradeoffs for handling errors.',
      'defaultIfEmpty (hardcoded value) / switchIfEmpty (fallback publisher) — the empty-signal equivalents of the two most common error handlers.',
      'timeout() turns "too slow" into a normal error signal, composable with everything else; transform() extracts repeated steps into a reusable, type-agnostic operator.',
    ],
  },
]
