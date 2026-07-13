export default [
  {
    id: '2.1',
    title: 'Project Setup',
    duration: '2 min',
    kind: 'setup',
    summary: [
      "A quick housekeeping lecture before the real work starts: set up a Maven (or Gradle) project targeting Java 17+ and add the core dependencies you'll use throughout the course — reactor-core (the Reactive Streams implementation), reactor-netty (for the non-blocking HTTP demos later), a logging backend, the datafaker library for generating realistic test data, and JUnit + reactor-test for testing.",
      "One habit worth adopting immediately: don't just watch these lectures — code alongside them. Reactive programming is a different enough mental model that passively watching leaves gaps a hands-on rep would have caught.",
    ],
    keyPoints: [
      'Core dependency: reactor-core — the Reactive Streams implementation used throughout the course.',
      'reactor-netty adds non-blocking HTTP client capability for the external-service demos.',
      'reactor-test ships dedicated tools for testing publishers, since a publisher only produces once something subscribes.',
    ],
  },
  {
    id: '2.2',
    title: 'Publisher/Subscriber Implementation — Part 1',
    duration: '7 min',
    kind: 'demo',
    summary: [
      "Before reaching for Reactor's Mono and Flux, it's worth hand-rolling a Publisher and Subscriber against the raw java.util.concurrent.Flow (Reactive Streams) interfaces. You won't do this in production — Reactor already is the implementation — but building it once by hand makes every later abstraction click.",
      "The running example: a Publisher that hands out customer email addresses, and a Subscriber that 'sends' promotional emails (really just logs them to the console). A SubscriberImpl stores the Subscription it receives in onSubscribe so a demo class can call request() on it later, and simply logs whatever arrives via onNext/onError/onComplete.",
      "The PublisherImpl's job, by contrast, is almost nothing: when subscribe() is called, it creates a SubscriptionImpl (passing it a reference to the Subscriber so the two can talk), and hands that Subscription to the Subscriber via onSubscribe(). The Publisher's entire responsibility is introducing the two sides — the actual item-emitting logic lives in the Subscription, built out in the next lecture.",
    ],
    code: `public class SubscriberImpl implements Subscriber<String> {
    private static final Logger log = LoggerFactory.getLogger(SubscriberImpl.class);
    private Subscription subscription;

    @Override
    public void onSubscribe(Subscription subscription) {
        this.subscription = subscription;
    }

    @Override
    public void onNext(String email) {
        log.info("Received email: {}", email);
    }

    @Override
    public void onError(Throwable throwable) {
        log.error("Error: {}", throwable.getMessage());
    }

    @Override
    public void onComplete() {
        log.info("Completed");
    }

    public Subscription getSubscription() {
        return subscription;
    }
}

public class PublisherImpl implements Publisher<String> {
    @Override
    public void subscribe(Subscriber<? super String> subscriber) {
        var subscription = new SubscriptionImpl(subscriber);
        subscriber.onSubscribe(subscription);
    }
}`,
    keyPoints: [
      'The Subscriber stores its Subscription in onSubscribe() so calling code can request()/cancel() later.',
      "The Publisher's only job is to create a Subscription linking itself to the Subscriber and hand it over via onSubscribe().",
      'Item production itself is delegated entirely to the Subscription — built out next.',
    ],
  },
  {
    id: '2.3',
    title: 'Publisher/Subscriber Implementation — Part 2',
    duration: '5 min',
    kind: 'demo',
    summary: [
      "With the handshake in place, SubscriptionImpl is where the actual contract lives. It holds a reference to the Subscriber, a backing list of emails to emit, and two bits of state: how many items have been emitted so far, and whether the Subscription has been cancelled.",
      "request(n) is the heart of it: if already cancelled, do nothing. Otherwise emit up to n items via onNext() — but never more than what's left in the source — and call onComplete() the moment the source runs dry. cancel() simply flips the cancelled flag, which request() checks first, so a well-behaved Publisher stops producing the instant a Subscriber walks away.",
      "This is the piece that makes the earlier claims concrete: 'never emit more than requested,' 'stop on cancel,' 'call onComplete exactly once when exhausted' — none of that is magic, it's just an if-check and a loop bound.",
    ],
    code: `public class SubscriptionImpl implements Subscription {
    private static final Logger log = LoggerFactory.getLogger(SubscriptionImpl.class);
    private final Subscriber<? super String> subscriber;
    private final List<String> emails = List.of(
        "a@x.com", "b@x.com", "c@x.com", "d@x.com", "e@x.com",
        "f@x.com", "g@x.com", "h@x.com", "i@x.com"
    );
    private int emitted = 0;
    private boolean cancelled = false;

    public SubscriptionImpl(Subscriber<? super String> subscriber) {
        this.subscriber = subscriber;
    }

    @Override
    public void request(long n) {
        if (cancelled) return;

        for (long i = 0; i < n && emitted < emails.size(); i++, emitted++) {
            subscriber.onNext(emails.get(emitted));
        }
        if (emitted >= emails.size()) {
            subscriber.onComplete();
        }
    }

    @Override
    public void cancel() {
        this.cancelled = true;
        log.info("Subscriber cancelled");
    }
}`,
    keyPoints: [
      'request(n) never emits more than n items, and never more than the source actually has.',
      'onComplete() fires exactly once, the moment the backing source is exhausted.',
      'cancel() sets a flag that request() checks first — cancellation stops future emission immediately.',
    ],
  },
  {
    id: '2.4',
    title: 'Publisher/Subscriber Demo',
    duration: '8 min',
    kind: 'demo',
    summary: [
      "Time to validate every rule from Section 1 against the hand-rolled implementation. First: subscribing alone does nothing — no request(), no items, confirmed by running it and seeing no output at all.",
      "Next: request(3) with only 2 items available in the source correctly emits only 2 and calls onComplete() — a Publisher never manufactures data it doesn't have. Requesting repeatedly in batches (3, wait, 3, wait, 3...) demonstrates a Subscriber pulling data incrementally rather than demanding everything up front.",
      "Cancellation is next: request 3 items, then cancel(), then request 3 more — the second request produces nothing, because cancel() already flipped the flag. Finally, error handling is added deliberately: if a single request() ever asks for more than 10 items, treat that as invalid input and call onError(). The first version of this had a bug — after onError(), the code kept accepting further requests, which violates the terminal-signal rule. The fix: cancel() is called internally the moment onError() fires, so nothing can follow it.",
    ],
    code: `var publisher = new PublisherImpl();
var subscriber = new SubscriberImpl();
publisher.subscribe(subscriber);
// Nothing happens yet — subscribing alone doesn't trigger emission.

subscriber.getSubscription().request(3);   // emits 3 items
Thread.sleep(Duration.ofSeconds(2));
subscriber.getSubscription().request(3);   // emits 3 more
Thread.sleep(Duration.ofSeconds(2));
subscriber.getSubscription().request(3);   // emits the last 3, then onComplete()

// --- cancellation ---
subscriber.getSubscription().request(3);
Thread.sleep(Duration.ofSeconds(2));
subscriber.getSubscription().cancel();
subscriber.getSubscription().request(3);   // no-op — already cancelled

// --- error path: requesting more than 10 in one call is treated as invalid ---
subscriber.getSubscription().request(11);  // triggers onError("Validation failed")
subscriber.getSubscription().request(3);   // no-op — the Subscription is already terminal`,
    note: {
      label: 'The bug worth noticing',
      text: "The first pass let request() keep working after onError() fired — a spec violation. The fix was to set the cancelled flag as part of sending the error, so the terminal signal actually terminates things.",
    },
  },
  {
    id: '2.5',
    title: 'Mono / Flux — Introduction',
    duration: '3 min',
    kind: 'theory',
    summary: [
      "Reactive Streams is the specification; Reactor is an implementation — the same relationship Hibernate has to JPA. Reactor gives the Publisher interface two concrete shapes: Mono and Flux.",
      "Mono emits 0 or 1 item, followed by onComplete or onError — never both, and never more than one item. If it emits an item, that's a success; there's no 'partial success with an error after' case for a single-item publisher. Zero items is completely normal too — querying a database for customer ID 123 and finding no such row isn't an error, it's just onComplete with nothing emitted first.",
      "Flux emits 0 to N items — potentially an infinite stream (think: a live Bitcoin price feed). A Subscriber pulls from it in batches (request 3, then request 5, and so on), and the stream ends the same two ways Mono's does: onComplete when the source is exhausted, or onError if something goes wrong along the way — plus the Subscriber can always cancel() early.",
    ],
    keyPoints: [
      'Mono = 0 or 1 item, then onComplete or onError — the shape for single request/response calls.',
      'Flux = 0 to N items, potentially unbounded — the shape for streams.',
      'Zero items is a normal outcome for either type, not an error.',
    ],
  },
  {
    id: '2.6',
    title: 'Why We Need Mono!',
    duration: '2 min',
    kind: 'theory',
    summary: [
      "If Flux can already emit 0 to N items, why bother with a separate Mono type? Convenience and honesty about intent: when you know for certain a call returns at most one result, Mono says so in the type signature. Spring Data JPA already does this in the non-reactive world — findById() returns Optional<Customer> (0 or 1), while findByFirstName() returns List<Customer> (could be many). Spring's reactive repositories mirror that exactly: Mono<Customer> for lookups by a unique key, Flux<Customer> when more than one result is possible.",
      "Both types are equally non-blocking and asynchronous — that's not the distinction. The real difference is that Flux, as a genuine stream, needs a much larger surface area: windowing, batching, grouping, and backpressure-handling operators that a single-item Mono simply has no use for. Mono stays lightweight precisely because none of that machinery applies to it.",
    ],
    keyPoints: [
      'Mono<T> and Flux<T> mirror Optional<T> and List<T> from the blocking world.',
      'Both are equally non-blocking — the difference is stream machinery, not concurrency semantics.',
      "Flux needs backpressure and batching operators because it's a real stream; Mono doesn't, because it can only ever emit one item.",
    ],
  },
  {
    id: '2.7',
    title: 'Stream Lazy Behavior',
    duration: '3 min',
    kind: 'theory',
    summary: [
      "A short detour into plain Java, because it sets up the exact mental model Reactor uses. Java 8 Streams are lazy by default: calling Stream.of(1).peek(i -> log.info(\"Received {}\", i)) prints nothing at all, because peek() is an intermediate operation — nothing executes until a terminal operation (toList(), forEach(), etc.) is attached.",
      "Mono and Flux behave identically, and for the same reason: building a reactive pipeline just describes what should happen. Nothing actually runs until a Subscriber shows up (the reactive equivalent of a terminal operator). Every 'nothing happened when I ran this' moment in the upcoming lectures traces back to this one idea.",
    ],
    code: `Stream.of(1)
      .peek(i -> log.info("Received {}", i));
// Nothing is printed — peek() is intermediate, no terminal op attached.

Stream.of(1)
      .peek(i -> log.info("Received {}", i))
      .toList(); // toList() is terminal — NOW "Received 1" prints`,
    note: {
      label: 'Why this matters here',
      text: "Mono and Flux are lazy for the same reason Java Streams are: describing a pipeline and executing it are two different steps. The 'terminal operator' in reactive programming is subscribing.",
    },
  },
  {
    id: '2.8',
    title: 'Mono Just',
    duration: '8 min',
    kind: 'demo',
    summary: [
      "Mono.just(T) is the simplest possible factory method: wrap a value you already have sitting in memory into a publisher. Mono.just(\"win\") returns a Mono<String>; printing it directly just shows MonoJust (toString()'s output) — the value itself is never revealed until something subscribes and requests.",
      "Passing a custom SubscriberImpl and subscribing produces no output either, because subscribing alone doesn't request. Only after calling subscriber.getSubscription().request(10) does the value actually arrive, followed immediately by onComplete — Mono really does stop at one item, no matter how many were requested.",
      "The real use case for just(): bridging a value already in memory into an API that expects a Publisher<T> — an R2DBC repository's save(Publisher<T> entity) method, for instance. If a value is already sitting in application memory (not coming from a database or a remote call), Mono.just(value) is the quickest way to hand it to a library that only accepts publisher types.",
    ],
    code: `Mono<String> mono = Mono.just("win");
System.out.println(mono); // prints "MonoJust" — not the value itself

var subscriber = new SubscriberImpl();
mono.subscribe(subscriber);
// Still nothing printed — subscribing alone doesn't request.

subscriber.getSubscription().request(10);
// NOW: "Received win" followed by "Completed"

// The real use case: bridging an in-memory value into a Publisher-typed API,
// e.g. an R2DBC repository method shaped like save(Publisher<String> value)
someLibraryMethod(Mono.just("win"));`,
  },
  {
    id: '2.9',
    title: 'Mono Subscribe — Overloaded Methods',
    duration: '7 min',
    kind: 'demo',
    summary: [
      "subscribe() is heavily overloaded, and each overload trades explicitness for convenience. Passing just a Consumer<T> (onNext behavior only) means you never see the onComplete signal printed — not because it didn't happen, but because you didn't ask to be told. Add a second Consumer<Throwable> parameter for error handling and a Runnable for the complete signal, and both fire as expected.",
      "A subtlety worth internalizing: none of these lambda-based overloads require you to call request() manually. The moment you provide any onNext behavior at all, Reactor takes that as 'you want the value' and automatically calls request(Long.MAX_VALUE) on your behalf inside its own internal subscriber. That's the reactor team's own convention — mirrored in DefaultSubscriber a couple of lectures ahead. If you do want manual control over request(), there's a fourth overload that also hands you the Subscription directly.",
      "Chaining an operator like map() before subscribing works exactly as it would on a Java Stream: the transformation only ever runs when a value actually flows through, and any exception thrown inside it (dividing by zero, for instance) is routed to the error handler rather than crashing the pipeline.",
    ],
    code: `Mono<Integer> mono = Mono.just(1);

// onNext only — reactor auto-requests Long.MAX_VALUE for you here
mono.subscribe(value -> log.info("Received {}", value));

// onNext + onError + onComplete
mono.subscribe(
    value -> log.info("Received {}", value),
    error -> log.info("Error: {}", error.getMessage()),
    () -> log.info("Completed")
);

// onNext + onError + onComplete + manual control via the Subscription
mono.subscribe(
    value -> log.info("Received {}", value),
    error -> log.info("Error: {}", error.getMessage()),
    () -> log.info("Completed"),
    subscription -> subscription.request(1)
);

// map() only runs the transformation once a value actually flows
mono.map(v -> "A" + v)
    .subscribe(value -> log.info("Received {}", value)); // "Received A1"

// an exception thrown inside map() is routed to onError, not thrown outward
mono.map(v -> v / 0)
    .subscribe(
        value -> log.info("Received {}", value),
        error -> log.info("Error: {}", error.getMessage())
    );`,
  },
  {
    id: '2.10',
    title: 'Creating Default Subscriber',
    duration: '6 min',
    kind: 'demo',
    summary: [
      "Writing out a full lambda triple for every single demo would slow the whole course down, so this lecture builds a small piece of shared infrastructure: a generic DefaultSubscriber<T> that follows Reactor's own convention of calling request(Long.MAX_VALUE) inside onSubscribe(), then logs whatever arrives.",
      "One extra field earns its place here: a name. Later demos will regularly attach two or more Subscribers to the same Publisher — knowing which one received which item (and which didn't) matters, so DefaultSubscriber takes a name and prefixes every log line with it. A small Util class exposes two static factory overloads — one that defaults the name to an empty string for single-subscriber demos, and one that accepts a name explicitly.",
    ],
    code: `public class DefaultSubscriber<T> implements Subscriber<T> {
    private static final Logger log = LoggerFactory.getLogger(DefaultSubscriber.class);
    private final String name;

    public DefaultSubscriber(String name) {
        this.name = name;
    }

    @Override
    public void onSubscribe(Subscription subscription) {
        subscription.request(Long.MAX_VALUE); // mirrors Reactor's own default
    }

    @Override
    public void onNext(T item) {
        log.info("{} received {}", name, item);
    }

    @Override
    public void onError(Throwable throwable) {
        log.error("{} received error: {}", name, throwable.getMessage());
    }

    @Override
    public void onComplete() {
        log.info("{} received complete", name);
    }
}

public class Util {
    public static <T> Subscriber<T> subscriber() {
        return subscriber("");
    }

    public static <T> Subscriber<T> subscriber(String name) {
        return new DefaultSubscriber<>(name);
    }
}

// two independent subscribers on two independent Mono instances
Mono.just("win").subscribe(Util.subscriber("subscriber-1"));
Mono.just("win").subscribe(Util.subscriber("subscriber-2"));`,
    note: {
      label: 'Used constantly from here on',
      text: "Util.subscriber() and Util.subscriber(name) show up in almost every remaining demo in this course — it's the shared scaffolding that keeps the focus on the operator being taught rather than boilerplate.",
    },
  },
  {
    id: '2.11',
    title: 'Mono — Empty / Error',
    duration: '3 min',
    kind: 'demo',
    summary: [
      "Two more factory methods round out the basic Mono toolkit. Mono.empty() is reactive programming's answer to null — a way to tell a Subscriber 'I genuinely have nothing to give you' without ever passing an actual null reference through the pipeline. It results in onComplete() firing directly, with onNext() never called at all.",
      "Mono.error(Throwable) does the opposite: it routes straight to onError() instead of ever attempting onNext() or onComplete(). A getUsername(int) example ties both together in one switch expression — user ID 1 returns a real value via Mono.just(), user ID 2 returns Mono.empty() (no such user, but not an error), and anything else returns Mono.error(new RuntimeException(\"Invalid input\")) to signal an actual problem.",
    ],
    code: `private Mono<String> getUsername(int userId) {
    return switch (userId) {
        case 1 -> Mono.just("Sam");
        case 2 -> Mono.empty();                                  // no data — not an error
        default -> Mono.error(new RuntimeException("Invalid input"));
    };
}

getUsername(1).subscribe(Util.subscriber()); // "Sam", then complete
getUsername(2).subscribe(Util.subscriber()); // complete only — onNext never called
getUsername(3).subscribe(Util.subscriber()); // error: "Invalid input"`,
    keyPoints: [
      'Mono.empty() completes with zero items — the reactive replacement for returning null.',
      'Mono.error(Throwable) routes straight to onError(), skipping onNext() and onComplete() entirely.',
    ],
  },
  {
    id: '2.12',
    title: 'On Error Dropped — Problem',
    duration: '1 min',
    kind: 'faq',
    summary: [
      "A common early panic moment: subscribing to a Mono.error(...) using only a Consumer<T> (the onNext-only overload) throws reactor.core.Exceptions$ErrorCallbackNotImplemented at runtime, with a log line about 'operator called default onErrorDropped'.",
      "It's not a bug — it's Reactor telling you exactly what happened: the publisher sent an error signal, but you never told it what to do with errors, so it has nowhere to route the exception and has to surface it loudly rather than silently swallow it. The fix is simply to provide a second Consumer<Throwable> argument — even if all it does is log a warning and move on.",
    ],
    code: `// This throws Exceptions$ErrorCallbackNotImplemented at runtime:
Mono.error(new RuntimeException("boom"))
    .subscribe(value -> log.info("Received {}", value));

// Providing an error handler — even a minimal one — fixes it:
Mono.error(new RuntimeException("boom"))
    .subscribe(
        value -> log.info("Received {}", value),
        error -> log.warn("Ignoring error: {}", error.getMessage())
    );`,
    note: {
      label: 'Reading the message',
      text: "\"default onErrorDropped\" isn't a crash you caused by accident — it's Reactor refusing to let an error vanish silently. Any publisher that might error needs an explicit error handler.",
    },
  },
  {
    id: '2.13',
    title: 'Mono — From Supplier',
    duration: '4 min',
    kind: 'demo',
    summary: [
      "Mono.just(value) evaluates its argument immediately, before subscription — which is fine when the value is already sitting in memory, but a real problem when producing that value requires actual computation. A sum(List<Integer>) method that logs when it runs makes this visible: Mono.just(sum(numbers)) logs the 'finding sum' line the instant that statement executes, whether or not anyone ever subscribes.",
      "Mono.fromSupplier(() -> sum(numbers)) fixes this by wrapping the computation in a Supplier, deferring it until subscription actually happens. This is the general rule for delaying any expensive computation: wherever you'd write Mono.just(expensiveCall()), write Mono.fromSupplier(() -> expensiveCall()) instead — same idea Java 8's Supplier<T> was introduced for.",
    ],
    code: `private static int sum(List<Integer> numbers) {
    log.info("Finding the sum of {}", numbers); // proves exactly when this runs
    return numbers.stream().mapToInt(Integer::intValue).sum();
}

List<Integer> numbers = List.of(1, 2, 3);

// EAGER: sum() runs immediately — even with zero subscribers, because
// Mono.just() evaluates its argument before subscription ever happens
Mono<Integer> eager = Mono.just(sum(numbers));

// LAZY: nothing runs until someone actually subscribes
Mono<Integer> lazy = Mono.fromSupplier(() -> sum(numbers));
lazy.subscribe(Util.subscriber()); // sum() runs right now, not before`,
  },
  {
    id: '2.14',
    title: 'Mono — From Callable',
    duration: '3 min',
    kind: 'demo',
    summary: [
      "Mono.fromCallable() looks almost identical to fromSupplier() and defers execution the same way, but the two accept different functional interfaces. Supplier<T>.get() declares no exceptions at all — only unchecked ones can escape it. Callable<T>.call(), introduced decades earlier for ExecutorService tasks, explicitly declares throws Exception.",
      "That difference matters the moment your underlying logic throws a checked exception. Wrap a method that throws IOException in Mono.fromCallable(...) and the compiler is satisfied immediately. Try the same thing with Mono.fromSupplier(...) and the compiler complains that the checked exception must be handled — forcing a try/catch you didn't actually want. When wrapping code that already declares checked exceptions, reach for fromCallable() instead.",
    ],
    code: `// Supplier<T> — get() declares no exceptions; only unchecked ones escape
// Callable<T> — call() declares "throws Exception"

private static int sumChecked(List<Integer> numbers) throws IOException {
    return numbers.stream().mapToInt(Integer::intValue).sum();
}

// Callable accepts a checked-exception-throwing method reference directly:
Mono<Integer> viaCallable = Mono.fromCallable(() -> sumChecked(numbers));

// Mono.fromSupplier(() -> sumChecked(numbers)) would NOT compile as-is —
// Supplier's get() has no throws clause, so the checked exception must be
// caught and rethrown as unchecked before it can be passed in.`,
  },
  {
    id: '2.15',
    title: 'Mono — From Runnable',
    duration: '6 min',
    kind: 'demo',
    summary: [
      "Mono.fromRunnable() is the companion to fromSupplier() the way Mono.empty() is the companion to Mono.just(): use it when you want to emit nothing, but only after some method invocation has actually run. If nothing needs to happen first, Mono.empty() is enough; if something must run before signaling 'no data,' wrap it in fromRunnable().",
      "The motivating example: an e-commerce getProductName(productId) method. When the product exists, it returns Mono.fromSupplier(() -> faker.commerce().productName()). When it doesn't, the business team still wants to know which product IDs customers are asking for that aren't in stock — so instead of returning Mono.empty() directly, the code calls notifyBusinessOfMissingProduct(productId) inside a Mono.fromRunnable(), so that notification only fires when someone actually subscribes (never as a side effect of merely calling the method).",
      "Like most factory methods in this section, this one isn't mandatory. If a use case for it never comes up in your own codebase, that's completely fine — Reactor supports a lot of edge cases across many kinds of projects, and you're not obligated to use every tool on the shelf.",
    ],
    code: `private Mono<String> getProductName(int productId) {
    if (productId == 1) {
        return Mono.fromSupplier(() -> faker.commerce().productName());
    }
    // notify the business only when someone actually subscribes —
    // never as a side effect of just calling this method
    return Mono.fromRunnable(() -> notifyBusinessOfMissingProduct(productId));
}

private static void notifyBusinessOfMissingProduct(int productId) {
    log.info("Notifying business: unavailable product {}", productId);
}

getProductName(1).subscribe(Util.subscriber()); // a random product name, then complete
getProductName(2).subscribe(Util.subscriber()); // logs the notification, then complete (no item)`,
  },
  {
    id: '2.16',
    title: 'Mono — From Future',
    duration: '5 min',
    kind: 'demo',
    summary: [
      "Mono.fromFuture() bridges an existing CompletableFuture<T> into the Mono world — useful if you already have async code built on Java's own concurrency utilities. A getName() method backed by CompletableFuture.supplyAsync() plugs straight into Mono.fromFuture(getName()).",
      "There's a sharp gotcha here though: CompletableFuture is eager by design. supplyAsync() starts its background work the instant it's called, on the common ForkJoinPool, regardless of whether the resulting Mono ever gets a subscriber. Commenting out the .subscribe() call still prints the 'generating name' log line — proof that the work ran anyway.",
      "The fix mirrors the from-supplier pattern exactly: instead of Mono.fromFuture(getName()), defer the whole CompletableFuture creation inside a Supplier — Mono.fromFuture(() -> getName()). Now nothing runs until subscription actually happens.",
    ],
    code: `private static CompletableFuture<String> getName() {
    return CompletableFuture.supplyAsync(() -> {
        log.info("Generating name");
        return faker.name().firstName();
    });
}

// EAGER — supplyAsync() starts running the moment getName() is CALLED,
// whether or not the resulting Mono ever gets a subscriber:
Mono<String> eager = Mono.fromFuture(getName());

// LAZY — defer the whole CompletableFuture creation behind a Supplier:
Mono<String> lazy = Mono.fromFuture(() -> getName());
lazy.subscribe(Util.subscriber());

// Note: CompletableFuture runs on its own thread pool (the common
// ForkJoinPool by default), so the calling thread needs to wait around
// long enough to observe the result in a plain main() demo:
Util.sleepSeconds(1);`,
    note: {
      label: 'Watch for this everywhere',
      text: "Any type that isn't Reactor-native (CompletableFuture is the classic example) tends to be eager by default. Wrapping its *creation* in a Supplier, not just its result, is what actually restores laziness.",
    },
  },
  {
    id: '2.17',
    title: 'Publisher — Create Vs Execute',
    duration: '4 min',
    kind: 'faq',
    summary: [
      "A clarification lecture prompted by a question that comes up across experience levels: 'You said Mono.fromSupplier delays execution — so why does my log statement at the top of the method still print immediately?'",
      "The answer is that creating a publisher and executing its business logic are two separate things. A method that builds and returns a Mono is just constructing a lightweight object — any log statement written directly in that method's body (outside the supplier lambda) runs the instant the method is called, same as any ordinary Java method call. The actual delayed work is only whatever's inside the Supplier/Callable/Runnable passed to the factory method.",
      "Adding a 3-second sleep inside the supplier proves the point: calling the method returns instantly (only the publisher was built), while subscribing to the result triggers the full 3-second wait. Publisher construction is cheap and immediate; publisher execution is what gets deferred.",
    ],
    code: `private static Mono<String> getName() {
    log.info("Enter the method"); // runs the instant getName() is CALLED — no laziness here
    return Mono.fromSupplier(() -> {
        Util.sleepSeconds(3);     // this part only runs when someone SUBSCRIBES
        return faker.name().firstName();
    });
}

getName();
// prints "Enter the method" immediately and returns right away —
// building the Mono is cheap; nothing waits 3 seconds yet

getName().subscribe(Util.subscriber());
// prints "Enter the method" immediately, THEN waits 3 seconds before
// the name is produced — now the supplier body has actually run`,
  },
  {
    id: '2.18',
    title: 'Mono — Defer',
    duration: '5 min',
    kind: 'demo',
    summary: [
      "The previous lecture drew a line between 'creating a publisher' (cheap, immediate) and 'executing its logic' (deferrable). Mono.defer() exists for the rare case where even the creation step itself is expensive enough to want deferred.",
      "A createPublisher() method that itself sleeps for a second before returning Mono.just(...) demonstrates the problem: calling it directly pays that 1-second cost immediately, with zero subscribers required — because it's just a normal Java method call, and normal method calls execute the instant they're invoked.",
      "Mono.defer(() -> createPublisher()) wraps the entire creation call in a Supplier<Mono<T>>. Now the line exits instantly with no publisher built at all; only when a Subscriber shows up does defer() actually invoke createPublisher(), build the real Mono, and subscribe to it on the caller's behalf. This is a genuinely rare need — most publisher construction is cheap — but the tool exists for when it isn't.",
    ],
    code: `private static Mono<Integer> createPublisher() {
    log.info("Creating publisher");
    Util.sleepSeconds(1); // pretend building the Mono itself is expensive
    return Mono.just(42);
}

// EAGER: pays the 1-second cost immediately — this is a normal method call,
// and normal method calls execute the instant they're invoked
Mono<Integer> eager = createPublisher();

// LAZY: Mono.defer() wraps the *creation itself* in a Supplier<Mono<T>>
Mono<Integer> deferred = Mono.defer(() -> createPublisher());
// exits instantly — createPublisher() hasn't run at all yet

deferred.subscribe(Util.subscriber());
// only now does createPublisher() actually run and produce the value`,
  },
  {
    id: '2.19',
    title: 'What About Data From Remote Service?',
    duration: '3 min',
    kind: 'theory',
    summary: [
      "Every factory method covered so far — just, empty, error, fromSupplier, fromCallable, fromRunnable, fromFuture — answers the same question: 'how do I become a Publisher for something else to consume?' None of them are suitable for actually fetching data from a database or a remote service, because a plain Supplier is still a synchronous, blocking call under the hood.",
      "Fetching remotely means reaching for real non-blocking drivers: Spring WebFlux for HTTP, R2DBC for relational databases (Postgres, MySQL, H2, and more), and reactive drivers for Redis, MongoDB, Elasticsearch, and Kafka. There's a chicken-and-egg problem baked into learning order, though: WebFlux assumes you already know reactive programming, so it can't be the starting point — this course exists specifically to remove that prerequisite gap first.",
      "To make the remaining demos realistic without jumping ahead to WebFlux, the course brings in just the reactor-netty dependency — the low-level, non-blocking HTTP client that WebFlux itself is built on — to simulate real remote calls against a small demo service.",
    ],
  },
  {
    id: '2.20',
    title: 'External Services',
    duration: '3 min',
    kind: 'setup',
    summary: [
      "A small standalone Spring Boot jar is provided to act as a stand-in remote service, exposing a handful of endpoints through Swagger at http://localhost:7070. The one used in this section is GET /demo01/product/{id} — given a product ID from 1 to 100, it returns a product name.",
      "The endpoint deliberately adds a one-second artificial delay before responding, specifically to make the upcoming non-blocking-IO demo convincing — real HTTP calls in production are genuinely slow relative to CPU work, and a fast fake service wouldn't show the difference non-blocking IO makes.",
    ],
    code: `GET http://localhost:7070/demo01/product/81
--> "product name is product81"   (deliberately delayed ~1s to simulate real latency)`,
    codeLabel: 'HTTP',
  },
  {
    id: '2.21',
    title: 'Non-Blocking IO Client',
    duration: '10 min',
    kind: 'demo',
    summary: [
      "reactor-netty is the low-level library Spring WebFlux itself is built on — WebFlux just wraps it with a lot of convenience (serialization, deserialization, routing) that this course intentionally skips so the underlying mechanics stay visible.",
      "An AbstractHttpClient base class configures a shared HttpClient pointed at the demo service's base URL, deliberately overriding its LoopResources to use exactly one worker thread instead of Netty's default of one thread per CPU core. That's a deliberate teaching choice, not a real recommendation — it exists to prove, in the next lecture, that a single thread can genuinely handle a large number of concurrent requests without blocking.",
      "ExternalServiceClient extends that base and exposes getProductName(int). The response initially comes back as a Flux<ByteBuffer> — the raw, low-level shape a byte stream takes before any deserialization. Calling .asString() converts that to Flux<String>, and since exactly one product name is expected per request, .next() takes just the first value and converts the whole thing into a Mono<String> (the reactive equivalent of Stream's findFirst()).",
    ],
    code: `public abstract class AbstractHttpClient {
    private static final String BASE_URL = "http://localhost:7070";
    protected final HttpClient httpClient;

    protected AbstractHttpClient() {
        LoopResources loopResources = LoopResources.create(
            "http-client", 1, true   // name prefix, 1 worker thread, daemon thread
        );
        this.httpClient = HttpClient.create()
            .runOn(loopResources)
            .baseUrl(BASE_URL);
    }
}

public class ExternalServiceClient extends AbstractHttpClient {
    public Mono<String> getProductName(int productId) {
        return httpClient.get()
            .uri("/demo01/product/" + productId)
            .responseContent()   // Flux<ByteBuffer> — raw bytes off the wire
            .asString()          // Flux<String>
            .next();             // take the first value -> Mono<String>
    }
}`,
    note: {
      label: 'Why only one worker thread',
      text: "Deliberately capping LoopResources to a single thread is a teaching device, not production advice — it sets up the next lecture's point that one thread can juggle a huge number of concurrent, non-blocking requests without ever sitting blocked.",
    },
  },
  {
    id: '2.22',
    title: 'Non-Blocking IO — Demo',
    duration: '7 min',
    kind: 'demo',
    summary: [
      "A single call to getProductName(1).subscribe(Util.subscriber()) exits immediately with no visible output — the request is non-blocking, so the main thread races past it. Adding a couple of seconds of sleep afterward (purely for this demo — never in real production code) reveals the response once it arrives.",
      "The real payoff shows up scaling the demo up: firing 5, then 50, then 100 requests in a for loop — one call to getProductName() and subscribe() per iteration — and every single response comes back within roughly one second total, using exactly one thread the entire time. Sequential blocking code making the same 100 calls would need either 100 seconds (waiting for each response before starting the next) or 100 separate threads to run them in parallel.",
      "One thing that trips people up: responses don't arrive in request order. Sending IDs 1 through 5 doesn't guarantee receiving them back in that order — all five requests go out over the network at roughly the same instant, and whichever response the remote service returns first is delivered first. This isn't a Reactor quirk or a Java quirk; any language doing genuinely concurrent non-blocking IO shows the same behavior, because network timing simply doesn't guarantee ordering.",
    ],
    code: `var client = new ExternalServiceClient();

log.info("Starting");
for (int i = 1; i <= 100; i++) {
    client.getProductName(i).subscribe(Util.subscriber());
}
Util.sleepSeconds(2); // only to observe results in this demo — never do this in production

// Result: all 100 responses arrive in roughly one second total,
// handled by a single worker thread, in whatever order the network
// happens to deliver them — not necessarily 1, 2, 3, 4, 5...`,
    note: {
      label: 'Response order is not request order',
      text: "Firing requests 1-5 and receiving them back as, say, 3, 1, 5, 2, 4 is completely normal for non-blocking IO. All requests go out near-simultaneously; whichever response the network delivers first arrives first. If strict ordering matters for a use case, that has to be handled explicitly — later sections cover options for it.",
    },
  },
  {
    id: '2.23',
    title: '*** FAQ *** — How Event Loop Works',
    duration: '3 min',
    kind: 'faq',
    summary: [
      "A simplified mental model for what actually happens behind reactor-netty's single event-loop thread. Picture one thread and two queues: an outbound queue of requests waiting to be sent, and an inbound queue of responses that have arrived but haven't been handled yet.",
      "The event-loop thread continuously checks the outbound queue: if there's a task, it sends that request and immediately moves on to the next one — it never sits idle waiting for a reply. This is how a hundred requests can all go out 'at once': the thread fires request 1, doesn't wait, fires request 2, doesn't wait, and so on, like throwing a hundred balls in the air roughly simultaneously rather than one at a time.",
      "Separately, whenever the OS notifies the thread that a response has actually arrived, that response lands in the inbound queue, and the thread picks it up and delivers it to whichever Subscriber is waiting for it. Because sending and receiving happen independently and asynchronously, the order responses arrive in has no fixed relationship to the order requests were sent in — which is exactly the behavior observed in the previous lecture's demo.",
    ],
    note: {
      label: 'Mental model to keep',
      text: "One thread, two queues: outbound (things waiting to be sent) and inbound (things that arrived and are waiting to be delivered). The thread never blocks on either — it just keeps cycling through both queues as work appears.",
    },
  },
  {
    id: '2.24',
    title: '*** FAQ *** — Why We Should NOT Use Block',
    duration: '2 min',
    kind: 'faq',
    summary: [
      "Every Mono and Flux exposes a .block() method that does exactly what it sounds like: it subscribes internally and parks the calling thread until a value (or completion, or error) actually arrives, returning the plain value directly instead of a publisher.",
      "The problem is exactly what you'd expect: calling client.getProductName(id).block() inside the same 100-iteration for loop from the earlier demo turns it back into fully sequential code. Each iteration now waits for its response before the loop can advance to the next one — the non-blocking benefit is completely erased, and the total time returns to roughly 100 seconds instead of roughly 1.",
      "block() genuinely has a legitimate home: unit tests, where getting a plain value back to assert against is more convenient than dealing with a publisher, and that test code never ships to production. Inside actual application code under src/main/java, it shouldn't appear. The claim that 'virtual threads make blocking fine now' is only partially true — it doesn't hold once Flux and real streaming data enter the picture, where blocking still defeats the point entirely.",
    ],
    code: `// Blocking version — turns 100 concurrent, non-blocking calls back into
// 100 fully sequential ones:
for (int i = 1; i <= 100; i++) {
    String product = client.getProductName(i).block(); // waits here every time
    log.info(product);
}
// Total time: back to roughly 100 seconds, not roughly 1.`,
    note: {
      label: "block() is a test tool, not a production one",
      text: "Reach for block() freely inside unit tests, where returning a plain value is convenient and the code never ships. Inside src/main/java, it should not appear — it throws away the entire benefit of the reactive stack.",
    },
  },
  {
    id: '2.25',
    title: 'Why Reactive Netty?',
    duration: '1 min',
    kind: 'theory',
    summary: [
      "A fair question: why lean on reactor-netty instead of writing non-blocking IO directly with Java's own AsynchronousSocketChannel? The honest answer is that it's genuinely possible, but genuinely painful — connect to the remote host, register a callback for when the connection completes, build the request manually as raw bytes, send it through a ByteBuffer, register another callback to read the eventual response, and handle every step's failure case separately.",
      "reactor-netty exists specifically to absorb all of that low-level callback wiring. Underneath the simple httpClient.get().uri(...).responseContent() calls used in this section, it's still registering exactly that kind of callback chain — routing successful responses through onNext()/onComplete() and failures through onError() — but none of that complexity leaks into the code actually being written.",
    ],
  },
  {
    id: '2.26',
    title: '*** Assignment ***',
    duration: '2 min',
    kind: 'assignment',
    summary: [
      "Build a small FileService with three operations: read a file's contents, write content to a file, and delete a file — using everything covered in this section so far. The interface shape: read(fileName) returns Mono<String>, write(fileName, content) returns Mono<Void>, and delete(fileName) returns Mono<Void>.",
      "Two requirements matter more than the exact implementation: none of the three methods should do any actual filesystem work until something subscribes, and any failure (a missing file, for instance) needs to be communicated through onError() rather than thrown as a raw exception or swallowed silently. You can safely assume the files involved are small enough to read fully into memory — no need to worry about out-of-memory scenarios. java.nio.file.Files and java.nio.file.Path have everything needed; no third-party dependency required.",
      "There's no single correct implementation here — as long as the laziness and error-signaling requirements hold, the internal approach is entirely up to you. The next lecture walks through one possible solution, which may look quite different from what you build, and that's fine.",
    ],
    code: `public interface FileService {
    Mono<String> read(String fileName);
    Mono<Void> write(String fileName, String content);
    Mono<Void> delete(String fileName);
}`,
    note: {
      label: 'The two requirements that actually matter',
      text: 'No filesystem work happens until a Subscriber shows up, and every failure is communicated via onError() — not a thrown exception, not silence. Everything else about the implementation is your call.',
    },
  },
  {
    id: '2.27',
    title: 'Assignment Solution',
    duration: '7 min',
    kind: 'solution',
    summary: [
      "One approach, working under the assumption that files live under src/main/resources/section02: read(fileName) wraps Files.readString(path) in Mono.fromCallable() — fromCallable() rather than fromSupplier() specifically because readString() declares a checked IOException.",
      "write() and delete() both return Mono<Void>, so there's no value to hand back — only a completion signal once the work is done. Both wrap a small private helper method (which does the actual Files.writeString()/Files.delete() call inside a try/catch, converting any checked exception to a RuntimeException) in Mono.fromRunnable(), which is exactly the 'do some work, then emit nothing' pattern from earlier in this section.",
      "Testing confirms the laziness requirement directly: calling fileService.read(\"file.txt\") with no .subscribe() attached produces no error and touches nothing on disk, even though the file doesn't exist — because nothing has executed yet. Only once a subscriber is attached does the missing-file IOException actually surface through onError().",
    ],
    code: `public class FileServiceImpl implements FileService {
    private static final Path BASE_PATH = Path.of("src/main/resources/section02");

    @Override
    public Mono<String> read(String fileName) {
        return Mono.fromCallable(() -> Files.readString(BASE_PATH.resolve(fileName)));
    }

    @Override
    public Mono<Void> write(String fileName, String content) {
        return Mono.fromRunnable(() -> writeFile(fileName, content));
    }

    @Override
    public Mono<Void> delete(String fileName) {
        return Mono.fromRunnable(() -> deleteFile(fileName));
    }

    private void writeFile(String fileName, String content) {
        try {
            Files.writeString(BASE_PATH.resolve(fileName), content);
            log.info("Created file {}", fileName);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    private void deleteFile(String fileName) {
        try {
            Files.delete(BASE_PATH.resolve(fileName));
            log.info("Deleted file {}", fileName);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}

// read() uses fromCallable() (not fromSupplier()) because Files.readString()
// declares a checked IOException — Callable's call() allows that, Supplier's
// get() does not.`,
  },
  {
    id: '2.28',
    title: 'What About Unit Testing?',
    duration: '1 min',
    kind: 'faq',
    summary: [
      "A deliberate choice worth explaining: this course doesn't add a unit-testing segment to every single section, even though testing reactive code has its own real challenges (a publisher only produces when subscribed to, so tests need their own subscription-aware tooling like StepVerifier from reactor-test).",
      "The reasoning mirrors how Java itself is usually taught — classes and interfaces come first, testing comes once the underlying concepts are actually familiar. Bolting testing onto every section before the core mental model of publishers and subscribers has settled would slow down the concepts that actually need the room to land first.",
    ],
  },
  {
    id: '2.29',
    title: 'Summary',
    duration: '2 min',
    kind: 'summary',
    summary: [
      "Reactive programming exists to handle I/O more efficiently. Reactive Streams is the specification; Reactor is an implementation providing two Publisher shapes — Mono (0 or 1 item, ideal for single request/response calls, no backpressure concerns) and Flux (0 to potentially infinite items, covered starting next section).",
      "The core visualization habit carries forward from Section 1: anything supplying data is a Publisher, anything consuming it is a Subscriber — a database read, an external service call, a file read, all fit the same mental model.",
      "The factory-method toolkit built up in this section: just() for values already in memory, empty()/error() for signaling 'nothing' or 'something went wrong' directly, fromSupplier()/fromCallable() for deferring a computation (Callable when it throws checked exceptions, Supplier when it doesn't), fromRunnable() for deferring a side effect that emits nothing, fromFuture() for bridging an existing CompletableFuture, and defer() for the rare case where even publisher construction itself needs deferring.",
    ],
    keyPoints: [
      'Mono = 0 or 1 item — single request/response, no backpressure concerns.',
      'Flux = 0 to N (possibly infinite) items — the subject of the next section.',
      'just() for in-memory values; fromSupplier()/fromCallable()/fromRunnable()/fromFuture() for deferring computation, checked exceptions, side effects, and futures respectively; defer() for deferring publisher creation itself.',
    ],
  },
]
