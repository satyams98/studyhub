export default [
  {
    id: '3.1',
    title: 'Flux — Just',
    duration: '3 min',
    kind: 'demo',
    summary: [
      "Flux mirrors Mono's just() factory exactly, except it accepts any number of arguments, not just one. Flux.just(1) behaves like Mono.just(1) in miniature — one item, then complete. The interesting part is what happens once more than one value is passed in.",
      "Flux.just(\"Sam\", \"Mike\", \"Priya\") creates a publisher that emits all three values in order via onNext(), then calls onComplete() once — the same subscribe() overloads from the Mono lectures (custom Subscriber, or the functional lambda forms) all work identically here.",
    ],
    code: `Flux<Integer> single = Flux.just(1);
single.subscribe(Util.subscriber()); // "Received 1", then complete

Flux<String> names = Flux.just("Sam", "Mike", "Priya");
names.subscribe(Util.subscriber()); // "Sam", "Mike", "Priya", then complete`,
  },
  {
    id: '3.2',
    title: 'Flux — Multiple Subscribers',
    duration: '2 min',
    kind: 'demo',
    summary: [
      "A single Flux can be subscribed to more than once — each Subscriber gets its own independent run through the same six values, with no interference between them. That much is unsurprising.",
      "What's worth internalizing is that filter() and map() — the exact same operations from Java's Stream API — slot in per-subscriber before subscribe() is called. One subscriber can see every item; another can filter down to just the even numbers via filter(i -> i % 2 == 0); a third can transform each item with map() before it ever reaches onNext(). If a filter condition matches nothing at all, that subscriber still gets a clean onComplete() — just with zero items beforehand, exactly like Mono.empty()'s behavior.",
    ],
    code: `Flux<Integer> flux = Flux.just(1, 2, 3, 4, 5, 6);

flux.subscribe(Util.subscriber("subscriber-1"));   // 1, 2, 3, 4, 5, 6, complete

flux.filter(i -> i % 2 == 0)
    .subscribe(Util.subscriber("subscriber-2"));    // 2, 4, 6, complete

flux.map(i -> i + "A")
    .subscribe(Util.subscriber("subscriber-3"));    // "1A", "2A", ... "6A", complete

flux.filter(i -> i > 7)
    .subscribe(Util.subscriber("subscriber-4"));    // nothing matches — just complete`,
  },
  {
    id: '3.3',
    title: 'Flux — From Array / List',
    duration: '1 min',
    kind: 'demo',
    summary: [
      "Two more bridging factory methods, both straightforward: Flux.fromIterable() accepts anything implementing Iterable — a List, a Set, whatever collection you already have — and emits its elements in order. Flux.fromArray() does the same for a plain Java array.",
    ],
    code: `List<String> list = List.of("A", "B", "C");
Flux.fromIterable(list).subscribe(Util.subscriber()); // A, B, C, complete

Integer[] array = {1, 2, 3, 4, 5, 6};
Flux.fromArray(array).subscribe(Util.subscriber());   // 1, 2, 3, 4, 5, 6, complete`,
  },
  {
    id: '3.4',
    title: 'Flux — From Stream',
    duration: '3 min',
    kind: 'demo',
    summary: [
      "Flux.fromStream() converts a java.util.stream.Stream into a Flux — but there's a genuine trap here worth slowing down for. Subscribing to the same Flux twice, when it was built from a single Stream instance, works fine for the first subscriber and throws an error for the second: \"stream has already been operated upon or closed.\"",
      "This has nothing to do with Reactor. It's plain Java: a Stream is single-use by design — once something has consumed it (a forEach, a collect, or in this case a Flux subscription), calling any operation on that same Stream instance again throws IllegalStateException. Reactor is just surfacing a limitation that was already there.",
      "The fix mirrors the from-supplier pattern used throughout the Mono section: instead of handing Flux.fromStream() an already-built Stream, hand it a Supplier<Stream<T>> — commonly just a method reference like list::stream. Now a fresh Stream gets created for every single subscription, and any number of subscribers can safely attach.",
    ],
    code: `List<Integer> list = List.of(1, 2, 3, 4);

// BAD — the same Stream instance can only be consumed once:
Stream<Integer> stream = list.stream();
Flux<Integer> flux = Flux.fromStream(stream);

flux.subscribe(Util.subscriber("sub-1")); // works: 1, 2, 3, 4, complete
flux.subscribe(Util.subscriber("sub-2")); // ERROR: stream has already been operated upon or closed

// GOOD — hand Flux a Supplier<Stream<T>> so a fresh stream opens per subscriber:
Flux<Integer> safeFlux = Flux.fromStream(list::stream);
safeFlux.subscribe(Util.subscriber("sub-1")); // works
safeFlux.subscribe(Util.subscriber("sub-2")); // also works — independent fresh stream`,
    note: {
      label: 'Not a Reactor bug',
      text: 'java.util.stream.Stream is single-use in plain Java — this exact error happens with a bare forEach() called twice on the same stream, with no Reactor involved at all.',
    },
  },
  {
    id: '3.5',
    title: 'Flux — Range',
    duration: '2 min',
    kind: 'demo',
    summary: [
      "Flux.range(start, count) is worth thinking of as reactive programming's version of a for loop: the first argument is the starting number, the second is how many items to emit from there — not an end value. Flux.range(1, 10) emits 1 through 10; Flux.range(3, 10) emits 3 through 12, not 3 through 10.",
      "Chaining .map() over a range turns it into a quick way to generate N of something — the lecture's own mini-assignment is generating ten random first names by mapping each emitted index through the faker library and discarding the index itself.",
    ],
    code: `Flux.range(1, 10).subscribe(Util.subscriber());  // 1 through 10, then complete
Flux.range(3, 10).subscribe(Util.subscriber());  // 3 through 12 — start at 3, emit 10 items

// Using range as a generator loop: 10 random first names
Flux.range(1, 10)
    .map(i -> Util.faker().name().firstName())
    .subscribe(Util.subscriber());`,
  },
  {
    id: '3.6',
    title: 'Log Operator',
    duration: '8 min',
    kind: 'demo',
    summary: [
      "In a real pipeline, a Publisher and Subscriber are rarely directly connected — there's often a long chain of operators in between (this course calls them processors: things that act as both a Subscriber to what's upstream and a Publisher to what's downstream). When something in a long chain isn't behaving as expected, log() is the debugging tool.",
      "log() is itself just a processor that does almost nothing except print every signal that passes through it in both directions: it logs the moment it receives a Subscription from upstream, logs the actual request(n) amount the downstream Subscriber asked for, logs every onNext() value as it passes through, and logs the terminal onComplete()/onError() signal.",
      "Placement matters. A log() placed before a map() only sees pre-transformation values; a log() placed after it sees the transformed output. Chaining two log() calls around an operator — and naming each one via log(\"some-name\") — makes it possible to see exactly what a specific operator did to the data as it flowed through, which is the whole point of the tool.",
    ],
    code: `Flux.range(1, 5)
    .log()
    .subscribe(Util.subscriber());
// Prints, in order: onSubscribe received -> request(unbounded) seen ->
// onNext(1) through onNext(5) -> onComplete

// Reducing the requested amount changes what log() reports:
var subscriber = new DefaultSubscriber<Integer>("bounded") {
    // requesting only 3 instead of Long.MAX_VALUE
};
Flux.range(1, 5)
    .log()
    .subscribe(/* a subscriber that calls subscription.request(3) */);
// log() reports request(3) instead of request(unbounded), and only 3 onNext
// calls happen — no onComplete, since range() could still produce more

// Naming logs lets you tell which operator did what:
Flux.range(1, 5)
    .log("before-map")
    .map(i -> Util.faker().name().firstName())
    .log("after-map")
    .subscribe(Util.subscriber());`,
    note: {
      label: 'What log() is really for',
      text: "log() is a no-op processor whose only job is visibility — it passes every value through unchanged while printing the request/onNext/onComplete traffic flowing past it. Placement in the chain determines what it can see.",
    },
  },
  {
    id: '3.7',
    title: 'Flux Vs List',
    duration: '7 min',
    kind: 'demo',
    summary: [
      "The same requirement — generate N names, each one deliberately simulated as taking a full second — implemented two ways makes the responsiveness argument concrete rather than theoretical. The traditional version returns List<String>: nothing is visible on screen for the entire duration (10 names = 10 seconds of blank screen), then everything appears at once.",
      "The reactive version returns Flux<String> built from Flux.range(1, count).map(i -> generateName()): names appear one at a time, roughly every second, as each one finishes generating — the exact same underlying work, but the user sees continuous progress instead of a frozen screen.",
      "The more important difference shows up with early cancellation. Using a raw Subscriber (so the Subscription is accessible directly), requesting just 3 names and being satisfied with what came back lets you call cancel() and stop the producer from doing any more work. The List-returning version has no equivalent — it's all-or-nothing: either wait for the complete list or get nothing at all.",
    ],
    code: `public class NameGenerator {
    private static String generateName() {
        Util.sleepSeconds(1); // pretend each name is expensive to produce
        return Util.faker().name().firstName();
    }

    // Traditional: nothing visible until every name is ready
    public static List<String> getNamesList(int count) {
        return IntStream.rangeClosed(1, count)
            .mapToObj(i -> generateName())
            .toList();
    }

    // Reactive: names stream out one at a time, as each becomes ready
    public static Flux<String> getNamesFlux(int count) {
        return Flux.range(1, count)
            .map(i -> generateName());
    }
}

System.out.println(NameGenerator.getNamesList(10));
// blank screen for ~10 seconds, then all 10 names print at once

NameGenerator.getNamesFlux(10).subscribe(Util.subscriber());
// a name appears roughly every second, as it's generated

// Early cancellation — only possible with the reactive version:
var subscriber = new SubscriberImpl();
NameGenerator.getNamesFlux(10).subscribe(subscriber);
subscriber.getSubscription().request(3);
// happy with these 3 names? stop the producer from doing any more work:
subscriber.getSubscription().cancel();`,
  },
  {
    id: '3.8',
    title: 'ChatGPT vs Gemini',
    duration: '3 min',
    kind: 'theory',
    summary: [
      "A live side-by-side comparison of two chat assistants makes the List-vs-Flux distinction visceral rather than abstract. Asked to write code for the first 1,001 prime numbers, one assistant visibly builds its entire answer before showing anything — the interface just sits there, and clicking stop early discards the whole in-progress answer. That's List-like behavior: the whole result or nothing.",
      "The other assistant starts streaming tokens back almost immediately, and clicking stop actually stops it mid-answer, keeping whatever had already streamed out. That's Flux-like behavior: a continuous stream of small emissions instead of one large batch.",
      "The responsiveness difference matters beyond just feeling snappier. If a question was phrased ambiguously, seeing the first few tokens of a response reveals a misunderstanding early — letting you cancel and rephrase immediately, instead of waiting for an entire answer to build only to discover afterward that it addressed the wrong thing entirely.",
    ],
    note: {
      label: 'The takeaway',
      text: "This isn't really about which chatbot is 'better.' It's that a streamed response gives you the option to react early — cancel, adjust, redirect — the same option a Flux subscriber has and a List producer never does.",
    },
  },
  {
    id: '3.9',
    title: '*** FAQ *** — Are Mono & Flux Data Structures?',
    duration: '1 min',
    kind: 'faq',
    summary: [
      "A distinction worth being precise about: List, Set, and Map are data structures — they hold a finite amount of data in memory, the way a water container holds a finite volume of water. Mono and Flux are not data structures in that sense at all.",
      "They're closer to a pipe than a container: a mechanism for transferring data from one place to another efficiently, without ever storing the full set of it in memory at once. That's precisely why a Flux can represent a genuinely infinite stream (a live price feed that never stops) in a way no List ever could — a List has to hold everything at once; a pipe just has to keep moving whatever's currently flowing through it.",
    ],
    note: {
      label: 'Container vs. pipe',
      text: 'A List stores a finite amount of data. A Flux transfers data — potentially an unbounded amount of it — without ever holding the whole set in memory at once. That distinction is why Flux can model infinite streams and List fundamentally cannot.',
    },
  },
  {
    id: '3.10',
    title: 'Flux — Non-Blocking IO Stream Demo',
    duration: '5 min',
    kind: 'demo',
    summary: [
      "The demo service exposes a streaming endpoint (/demo02/name-stream) that pushes a random name roughly every 500 milliseconds. Notably, the browser-based Swagger UI can't render this properly — it doesn't know how to display an ongoing stream — but that's purely a UI limitation, not a sign anything is broken; reactor-netty handles it correctly.",
      "The client-side code barely changes from the earlier single-value demo: instead of ending the chain with .next() to collapse the response down to one item, leaving it as .asString() keeps the full Flux<String> of however many messages the server decides to send. Multiple independent subscribers each receive their own full copy of the stream, and — consistent with everything from Section 2 — one single thread handles all of it.",
      "The string type used throughout this course's demos is just for convenience. In a real application, this same pattern applies to a Flux<Customer>, Flux<PurchaseOrder>, or any other domain object — Spring WebFlux is what handles the JSON deserialization into real Java types, which this reactor-netty-only setup deliberately skips to keep the focus on the reactive mechanics.",
    ],
    code: `public class ExternalServiceClient extends AbstractHttpClient {
    public Flux<String> getNames() {
        return httpClient.get()
            .uri("/demo02/name-stream")
            .responseContent()
            .asString(); // Flux<String> — no .next() this time; keep every message
    }
}

var client = new ExternalServiceClient();
client.getNames().subscribe(Util.subscriber());
Util.sleepSeconds(6); // the endpoint emits roughly 10 names, ~500ms apart

// Two independent subscribers each get their own full stream of names:
client.getNames().subscribe(Util.subscriber("sub-1"));
client.getNames().subscribe(Util.subscriber("sub-2"));`,
  },
  {
    id: '3.11',
    title: 'Flux — Interval',
    duration: '3 min',
    kind: 'demo',
    summary: [
      "Flux.interval(Duration) emits an incrementing counter (0, 1, 2, 3...) on a fixed schedule — the tool of choice any time a requirement is shaped like 'do something every N milliseconds' rather than 'process this fixed batch of data.'",
      "Like the earlier non-blocking demos, subscribing and immediately letting the program exit shows nothing at all — interval() runs on its own internal timer thread, so the main thread races past it with no results to show. Blocking the main thread briefly (purely for demo purposes) reveals the ticks actually arriving on schedule.",
      "The one genuinely important behavioral note: Flux.interval() never completes on its own. It's designed to run forever unless something explicitly cancels the Subscription. Left unmanaged in a real application, that's a resource leak waiting to happen — always pair an interval-based Flux with a clear cancellation condition. Mapping the tick value through faker.name().firstName() (discarding the counter itself) turns the raw ticker into 'generate a name every 500ms.'",
    ],
    code: `Flux.interval(Duration.ofMillis(500))
    .subscribe(Util.subscriber());
// Exits immediately with no output — the timer runs on its own thread,
// and the main thread doesn't stick around to observe it

Flux.interval(Duration.ofMillis(500))
    .subscribe(Util.subscriber());
Util.sleepSeconds(5); // NOW: 0, 1, 2, 3, 4, 5... roughly every 500ms

// interval() never completes on its own — cancel() is the only way out:
var subscriber = new SubscriberImpl();
Flux.interval(Duration.ofMillis(500)).subscribe(subscriber);
Util.sleepSeconds(3);
subscriber.getSubscription().cancel(); // without this, it runs forever

// Generating a name every 500ms instead of a raw counter:
Flux.interval(Duration.ofMillis(500))
    .map(tick -> Util.faker().name().firstName())
    .subscribe(Util.subscriber());`,
    note: {
      label: 'It never stops on its own',
      text: "Unlike range() or fromIterable(), interval() has no natural end — it keeps ticking forever unless cancel() is called explicitly. Always pair it with a clear stopping condition in real code.",
    },
  },
  {
    id: '3.12',
    title: 'Flux — Empty / Error',
    duration: '1 min',
    kind: 'demo',
    summary: [
      "Flux.empty() and Flux.error(Throwable) work exactly like their Mono counterparts, just for the many-item type. Flux.empty() routes straight to onComplete() with zero prior onNext() calls — the correct way to represent 'nothing to give' without ever emitting a null. Flux.error() routes straight to onError(), skipping onNext() and onComplete() entirely.",
    ],
    code: `Flux.empty().subscribe(Util.subscriber());
// onComplete only — no items, no error

Flux.error(new RuntimeException("oops")).subscribe(Util.subscriber());
// onError("oops") — no items, no completion`,
  },
  {
    id: '3.13',
    title: 'Flux — Defer',
    duration: '1 min',
    kind: 'demo',
    summary: [
      "Everything covered so far in this section creates a Flux immediately — building it is a cheap, lightweight operation, exactly as it was for Mono. Flux.defer() exists for the same rare case Mono.defer() covers: when even the creation step itself is expensive enough that you want it postponed until subscription.",
      "The pattern is identical: wrap the entire Flux-creation call in a Supplier<Flux<T>>. If a list needs to be built programmatically at subscription time rather than upfront, wrapping Flux.fromIterable(buildList()) in Flux.defer(() -> ...) delays the whole thing — both the list construction and the Flux creation — until someone actually subscribes.",
    ],
    code: `// EAGER — buildList() runs the instant this line executes, zero subscribers required:
Flux<Integer> eager = Flux.fromIterable(buildList());

// LAZY — defer() wraps the entire creation step in a Supplier<Flux<T>>:
Flux<Integer> deferred = Flux.defer(() -> Flux.fromIterable(buildList()));
// nothing runs until subscription actually happens`,
  },
  {
    id: '3.14',
    title: 'Mono/Flux Conversion',
    duration: '4 min',
    kind: 'demo',
    summary: [
      "Occasionally a library's API shape doesn't match what you have on hand — a method expects a Flux<String> but your existing code produces a Mono<String>. Flux.from(Publisher<T>) bridges any Publisher (which a Mono is) into a Flux, letting an incompatible signature compile and behave correctly.",
      "The conversion preserves the underlying signal exactly: a Mono.just(\"Sam\") becomes a Flux emitting \"Sam\" then completing; a Mono.empty() becomes a Flux.empty(); a Mono.error(...) becomes an equivalent Flux.error(...). Nothing about the semantics changes — only the type.",
      "The reverse direction — Flux down to Mono — only makes sense by deliberately picking one item out of a potentially multi-item stream. Flux's own .next() operator (Stream's findFirst() equivalent) takes just the first emitted value and wraps it as a Mono. Mono.from(Publisher<T>) does the same thing from the other side, accepting any Publisher — including a Flux — and again taking just its first value.",
    ],
    code: `// A library method that only accepts Flux<String>:
private static void save(Flux<String> names) {
    names.subscribe(Util.subscriber());
}

private static Mono<String> getUsername(int userId) {
    return switch (userId) {
        case 1 -> Mono.just("Sam");
        case 2 -> Mono.empty();
        default -> Mono.error(new RuntimeException("Invalid input"));
    };
}

// save(getUsername(1)) does not compile — Mono<String> isn't a Flux<String>.
// Flux.from() accepts any Publisher<T> and bridges it:
save(Flux.from(getUsername(1))); // "Sam", then complete
save(Flux.from(getUsername(2))); // complete only
save(Flux.from(getUsername(3))); // error: "Invalid input"

// The other direction — Flux to Mono — means picking one item deliberately:
Flux<Integer> range = Flux.range(1, 10);

Mono<Integer> firstOnly = range.next();     // Flux's own operator
Mono<Integer> viaFrom   = Mono.from(range); // equivalent — Mono.from() accepts any Publisher<T>`,
  },
  {
    id: '3.15',
    title: '*** Assignment ***',
    duration: '2 min',
    kind: 'assignment',
    summary: [
      "A stock-trading simulation using the demo service's /demo02/stock-stream endpoint, which emits a price between $80 and $120 roughly every 500 milliseconds for 20 seconds, then completes on its own.",
      "The rules: start with a $1,000 balance and zero shares. Every time the price drops below $90, buy exactly one share if the balance allows it. Once the price rises above $110, sell every share currently held in one go, cancel the subscription (there's no reason to keep observing once you've exited the position), and print the resulting profit.",
      "As with the earlier file-service assignment, there's no single correct structure here — a custom Subscriber implementation that tracks quantity and balance as instance state is one natural shape, but the actual requirement is just the buy/sell/cancel/profit behavior working correctly.",
    ],
    note: {
      label: 'The mechanics to get right',
      text: 'price < 90 and enough balance -> buy 1 share. price > 110 and holding shares -> sell everything, then cancel(). Print balance minus the original $1,000 as the profit once you exit.',
    },
  },
  {
    id: '3.16',
    title: 'Assignment Solution',
    duration: '12 min',
    kind: 'solution',
    summary: [
      "One approach: a getPriceChanges() method on the external service client hits /demo02/stock-stream and parses each response string to an int, returning Flux<Integer> instead of Flux<String>. A dedicated StockPriceObserver implements Subscriber<Integer> directly (rather than using the generic DefaultSubscriber) specifically because it needs to hold mutable state — quantity and balance — across every onNext() call.",
      "onSubscribe() requests Long.MAX_VALUE immediately and stashes the Subscription for later. onNext(price) contains the entire trading rule: if the price is below 90 and the balance can cover it, increment quantity and decrement balance by the price; if the price is above 110 and quantity is greater than zero, add quantity times price back to the balance, zero out the quantity, log the profit (balance minus the original 1000), and call subscription.cancel() to stop observing.",
      "Running it against the live 20-second price stream (blocking the demo's main thread that long, purely to observe the result) shows the full lifecycle: a handful of buys as the price dips below 90, then a sell-everything-and-cancel the moment it crosses 110, with the realized profit logged right before the cancellation.",
    ],
    code: `public class StockPriceObserver implements Subscriber<Integer> {
    private static final Logger log = LoggerFactory.getLogger(StockPriceObserver.class);
    private int quantity = 0;
    private int balance = 1000;
    private Subscription subscription;

    @Override
    public void onSubscribe(Subscription subscription) {
        this.subscription = subscription;
        subscription.request(Long.MAX_VALUE);
    }

    @Override
    public void onNext(Integer price) {
        if (price < 90 && balance >= price) {
            quantity++;
            balance -= price;
            log.info("Bought at {} — quantity {}, balance {}", price, quantity, balance);
        } else if (price > 110 && quantity > 0) {
            log.info("Selling {} shares at {}", quantity, price);
            balance += quantity * price;
            quantity = 0;
            log.info("Profit: {}", balance - 1000);
            subscription.cancel();
        }
    }

    @Override
    public void onError(Throwable throwable) {
        log.error("Error: {}", throwable.getMessage());
    }

    @Override
    public void onComplete() {
        log.info("Completed");
    }
}

var client = new ExternalServiceClient();
client.getPriceChanges().subscribe(new StockPriceObserver());
Util.sleepSeconds(20); // block long enough to observe the full 20-second run`,
  },
  {
    id: '3.17',
    title: 'Summary',
    duration: '2 min',
    kind: 'summary',
    summary: [
      "Flux emits 0, 1, or N items followed by onComplete or onError — and can represent a genuinely never-ending stream depending on the source. This section's factory methods aren't exhaustive (more advanced construction options come later in the course), but they cover the common case of bridging existing in-memory data or existing code into a Flux.",
      "The toolkit: Flux.just() for arbitrary literal values, fromIterable()/fromArray()/fromStream() for existing collections and arrays (remembering that fromStream() needs a Supplier<Stream<T>> to support more than one subscriber), range() as a reactive for-loop, and interval() for periodic emission on a schedule (which never completes on its own).",
      "Flux.from(Publisher<T>) and Mono.from(Publisher<T>)/.next() cover converting between the two shapes when an API boundary demands it, and Flux.defer() delays even the Flux-creation step itself for the rare case where that's genuinely expensive.",
    ],
    keyPoints: [
      'just(), fromIterable(), fromArray(), fromStream() — bridge existing data into a Flux; fromStream() needs a Supplier for multi-subscriber safety.',
      'range(start, count) — a reactive for-loop; interval(duration) — periodic emission that never completes on its own.',
      'Flux.from()/Mono.from()/.next() — convert between Mono and Flux at an API boundary; defer() — delay the creation step itself when needed.',
    ],
  },
]
