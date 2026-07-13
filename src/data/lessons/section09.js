export default [
  {
    id: '9.1',
    title: 'Introduction',
    duration: '3 min',
    kind: 'theory',
    summary: [
      "Real microservices architectures rarely satisfy one request with one call to one downstream service. A product page on a shopping site typically aggregates a base product lookup with recommendations, shipping estimates, reviews, and pricing — each potentially its own network call, combined into one response for the front end.",
      "Everything covered so far in this course — Mono, Flux, and the operators built on top of them — handles a single publisher at a time perfectly well. This section is about the missing piece: how to combine multiple independent publishers into the specific order or shape a business requirement actually needs, whether that's sequential, parallel, or something more particular like 'wait for this one to fail before trying that one.'",
    ],
  },
  {
    id: '9.2',
    title: 'Start With',
    duration: '9 min',
    kind: 'demo',
    summary: [
      "startWith() connects two publishers of the same type into what looks, from the subscriber's point of view, like a single publisher — but the two sources aren't treated equally. The starting values (or starting publisher) are always exhausted completely first; only if the subscriber still wants more after that does the original producer ever get subscribed to at all.",
      "That last part is worth sitting with: if the subscriber's demand is fully satisfied by the starting values alone, the original producer is never touched — chaining .take(2) after .startWith(-1, 0) means the underlying producer is never even subscribed to, since two values already arrived before it would have had a chance to contribute anything.",
      "startWith() accepts arbitrary literal values, an Iterable, or another Publisher entirely — and multiple startWith() calls chain cleanly, read from the one closest to the subscriber outward. .startWith(producerTwo()).startWith(1000) means: 1000 first, then everything from producerTwo(), then finally everything from the original producer, in that specific order.",
    ],
    code: `private static Flux<Integer> producerOne() {
    return Flux.just(1, 2, 3)
        .doOnSubscribe(s -> log.info("Subscribing to producer one"))
        .delayElements(Duration.ofMillis(10));
}

producerOne().subscribe(Util.subscriber());
Util.sleepSeconds(3);
// 1, 2, 3, complete

producerOne()
    .startWith(-1, 0)
    .subscribe(Util.subscriber());
// -1, 0 (delivered immediately — no need to touch producerOne() yet),
// THEN 1, 2, 3, complete — producerOne() is only subscribed to once the
// starting values are exhausted

producerOne()
    .startWith(-1, 0)
    .take(2)
    .subscribe(Util.subscriber());
// -1, 0, complete — producerOne() is NEVER subscribed to at all; take(2)
// was already fully satisfied by the starting values alone

// Multiple startWith calls chain, read from closest-to-subscriber outward:
producerOne()
    .startWith(producerTwo())
    .startWith(1000)
    .subscribe(Util.subscriber());
// 1000, then everything from producerTwo(), then everything from producerOne()`,
    note: {
      label: 'The part worth remembering',
      text: "startWith()'s source is checked first, and the original producer is only ever touched if the subscriber's demand isn't already satisfied. That can mean a whole network call gets skipped entirely — which is exactly what the next lecture's cache example relies on.",
    },
  },
  {
    id: '9.3',
    title: 'Start With — Usecases',
    duration: '6 min',
    kind: 'demo',
    summary: [
      "A genuinely useful real-world pattern for startWith(): read-through caching. A NameGenerator whose generation step is deliberately expensive (a one-second sleep per name) stores every name it ever generates into a simple in-memory list acting as a stand-in for a cache like Redis.",
      "Calling .startWith(cache) on the expensive generator means every subscriber checks the cache first — for free, instantly — and only falls through to the genuinely expensive generation step once the cache genuinely runs out of items to satisfy the request. A first subscriber generating 2 fresh names takes the full ~2 seconds and grows the cache to size 2; a second subscriber requesting 2 names gets served entirely from that cache, instantly; a third subscriber requesting 3 gets 2 from cache and only pays the expensive cost for the 1 additional name actually needed.",
    ],
    code: `public class NameGenerator {
    private final List<String> cache = new ArrayList<>();

    public Flux<String> generateNames() {
        return Flux.generate(sink -> {
                log.info("Generating name"); // expensive — watch how often this runs
                Util.sleepSeconds(1);
                var name = Util.faker().name().firstName();
                cache.add(name);
                sink.next(name);
            })
            .startWith(cache); // serve from cache first; only fall through to
                                 // the expensive generator once it runs out
}

var generator = new NameGenerator();
generator.generateNames().take(2).subscribe(Util.subscriber("Sam"));   // 2 fresh names, ~2s
generator.generateNames().take(2).subscribe(Util.subscriber("Mike")); // fully cached — instant
generator.generateNames().take(3).subscribe(Util.subscriber("Jake")); // 2 cached + 1 freshly generated`,
  },
  {
    id: '9.4',
    title: 'Concat With',
    duration: '5 min',
    kind: 'demo',
    summary: [
      "concatWith() is the exact mirror of startWith(): the current producer runs to completion first, and only then does the concatenated one begin. Where startWith() reads 'this new thing first, then me,' concatWith() reads 'me first, then this new thing' — same underlying mechanism, opposite direction.",
      "One small API naming inconsistency worth just being aware of rather than fighting: unlike startWith(), which accepts arbitrary values, an Iterable, or a Publisher, concatWith() only accepts another Publisher — there's no equivalent taking loose values directly on the instance method. Flux.concat(...) is the static-factory equivalent for combining several publishers at once in a fixed order, functionally identical to chaining multiple concatWith() calls.",
      "The lazy-evaluation behavior from startWith() carries over symmetrically: chaining .take(2) after producerOne().concatWith(producerTwo()) never touches producerTwo() at all, because producerOne() alone already satisfies the request for 2 items.",
    ],
    code: `producerOne()
    .concatWith(producerTwo())
    .subscribe(Util.subscriber());
// producerOne() runs fully to completion FIRST, THEN producerTwo() begins —
// the exact reverse of startWith()'s reading order

// The static factory equivalent, for combining several publishers in order:
Flux.concat(producerOne(), producerTwo())
    .subscribe(Util.subscriber());
// identical result — producerOne() fully, then producerTwo()

producerOne()
    .concatWith(producerTwo())
    .take(2)
    .subscribe(Util.subscriber());
// 1, 2, complete — producerTwo() is NEVER subscribed to; producerOne()
// alone already satisfied the request for 2 items`,
  },
  {
    id: '9.5',
    title: 'Concat Delay Error',
    duration: '4 min',
    kind: 'demo',
    summary: [
      "The default behavior of concatenation with an error partway through is exactly what you'd expect: the moment any producer in the chain errors, the whole sequence terminates immediately, and anything concatenated after it is never reached at all — even producers that would have worked perfectly fine.",
      "Flux.concatDelayError() changes that specific behavior: every producer in the chain still gets its full turn to contribute items, in order, even if one of them errors partway through. The error itself is held back rather than propagated immediately, and only delivered to the subscriber at the very end, after every other producer has had its complete opportunity to emit.",
    ],
    code: `private static Flux<Integer> producerThree() {
    return Flux.error(new RuntimeException("oops"));
}

Flux.concat(producerOne(), producerThree(), producerTwo())
    .subscribe(Util.subscriber());
// 1, 2, 3, then error — the instant producerThree() errors, the whole
// sequence stops; producerTwo() is NEVER reached at all

Flux.concatDelayError(producerOne(), producerThree(), producerTwo())
    .subscribe(Util.subscriber());
// 1, 2, 3 (producerOne), then 51, 52, 53 (producerTwo) — EVERY producer
// still gets its full turn. The error from producerThree() is held back
// and only delivered at the very end, once everyone else has contributed`,
  },
  {
    id: '9.6',
    title: 'Merge',
    duration: '8 min',
    kind: 'demo',
    summary: [
      "Merge is a genuinely different shape from startWith/concatWith: rather than subscribing to producers one at a time in a fixed order, Flux.merge() subscribes to every producer simultaneously, the instant the merged result is subscribed to. Whichever producer emits first is what the subscriber sees first — there's no guaranteed ordering at all, and it can (and does) vary run to run.",
      "Cancellation works the same way, symmetrically: cancelling the merged stream cancels every underlying producer at once, not just whichever one happened to be supplying items at that moment. Chaining .take(2) onto three merged producers means all three get cancelled together the instant those 2 items are satisfied — regardless of which producer(s) actually supplied them.",
      "A small reusable UnaryOperator (built via transform(), the way Section 5 covered) makes the simultaneous-subscription behavior directly visible: wrapping each producer with logging before merging shows subscription to all three happening at essentially the same instant, confirming there's no sequential handshake happening anywhere.",
    ],
    code: `Flux.merge(producerOne(), producerTwo(), producerThree())
    .subscribe(Util.subscriber());
Util.sleepSeconds(3);
// all three producers are subscribed to SIMULTANEOUSLY — items arrive in
// whatever order each producer actually emits them, not the order they
// were listed in

// A reusable visibility helper, applied via transform():
public static <T> UnaryOperator<Flux<T>> fluxLogger(String name) {
    return flux -> flux
        .doOnSubscribe(s -> log.info("Subscribing to {}", name))
        .doOnCancel(() -> log.info("Cancelling {}", name))
        .doOnComplete(() -> log.info("{} completed", name));
}

Flux.merge(
        producerOne().transform(fluxLogger("producer-one")),
        producerTwo().transform(fluxLogger("producer-two")),
        producerThree().transform(fluxLogger("producer-three"))
    )
    .take(2)
    .subscribe(Util.subscriber());
// all three log "Subscribing to..." at essentially the same instant. The
// moment take(2) is satisfied, ALL THREE get cancelled together — not
// just whichever producer happened to supply the two items

// mergeWith() is the equivalent instance method, chainable the same way:
producerTwo().mergeWith(producerOne()).mergeWith(producerThree())
    .subscribe(Util.subscriber());
// identical behavior to Flux.merge(producerTwo(), producerOne(), producerThree())`,
  },
  {
    id: '9.7',
    title: 'Merge — Usecases',
    duration: '8 min',
    kind: 'demo',
    summary: [
      "The canonical real-world use case for merge is a scatter-gather pattern: a flight search aggregator (the Kayak/Skyscanner style of product) that has to query several independent airlines simultaneously for a given route, rather than one at a time, because a user won't wait for a dozen sequential airline calls before seeing any results at all.",
      "Each airline is modeled as its own independent Flux — different random item counts, different random delays, entirely independent of one another — standing in for genuinely separate downstream services with no relationship to each other beyond both producing the same Flight shape. A KayakService hides the actual fan-out entirely behind one simple getFlights() method, so callers never need to know how many airlines are involved.",
      "A second requirement makes this a great home for a lesser-known Flux overload: users shouldn't wait indefinitely for slow airlines to respond. take(Duration) — distinct from the count-based take(n) used everywhere else in this course — collects whatever arrives within a fixed time window and cancels everything else once that window closes, regardless of how many items came through.",
    ],
    code: `record Flight(String airline, int price) {}

private static Flux<Flight> emiratesFlights() {
    return Flux.range(1, Util.faker().number().numberBetween(2, 10))
        .delayElements(Duration.ofMillis(Util.faker().number().numberBetween(200, 1000)))
        .map(i -> new Flight("Emirates", Util.faker().number().numberBetween(300, 2000)));
}

private static Flux<Flight> qatarAirwaysFlights() {
    return Flux.range(1, Util.faker().number().numberBetween(3, 5))
        .delayElements(Duration.ofMillis(Util.faker().number().numberBetween(300, 800)))
        .map(i -> new Flight("Qatar Airways", Util.faker().number().numberBetween(400, 900)));
}

private static Flux<Flight> americanAirlinesFlights() {
    return Flux.range(1, Util.faker().number().numberBetween(5, 10))
        .delayElements(Duration.ofMillis(Util.faker().number().numberBetween(200, 1200)))
        .map(i -> new Flight("American Airlines", Util.faker().number().numberBetween(300, 1200)));
}

public class KayakService {
    public Flux<Flight> getFlights() {
        return Flux.merge(
                emiratesFlights(),
                qatarAirwaysFlights(),
                americanAirlinesFlights()
            )
            .take(Duration.ofSeconds(2)); // take(Duration), not take(n) — collect
                                            // whatever arrives within the time limit
    }
}

new KayakService().getFlights().subscribe(Util.subscriber());
Util.sleepSeconds(3);
// all three airlines are queried simultaneously; whichever flights respond
// within 2 seconds get delivered, and every airline is cancelled together
// the instant that window closes — slower responses are simply never seen`,
    note: {
      label: 'take(Duration) vs. take(n)',
      text: "This is a genuinely different overload from the count-based take() used throughout this course — it caps by TIME rather than item count, which is exactly the shape a 'don't make users wait forever' requirement needs.",
    },
  },
  {
    id: '9.8',
    title: 'Zip',
    duration: '9 min',
    kind: 'demo',
    summary: [
      "zip() looks superficially similar to merge() at first glance but solves a genuinely different problem: instead of taking whatever arrives from any producer, it waits for every producer involved to each contribute one item, then combines all of them together into a single combined result — a Tuple containing one value from each source.",
      "The car-assembly analogy makes this concrete: one producer supplies body frames, another supplies engines, a third supplies tires — each at its own independent rate. Building one complete car needs exactly one of each part; zip() is what pairs them up, one-to-one, in the order each producer happens to emit.",
      "The genuinely important constraint: if any single producer runs out before the others (in this example, only 3 engines exist against 5 body frames and 10 sets of tires), the whole sequence stops there — exactly 3 complete cars get built, and the leftover 2 body frames and 7 sets of tires are simply never used, because there's no way to build a car missing an engine. This is entirely different from merge's take-whatever-comes behavior: zip is genuinely all-or-nothing per combination, capped by whichever source is the scarcest.",
    ],
    code: `record Car(String bodyFrame, String engine, String tires) {}

private static Flux<String> getBodyFrames() {
    return Flux.range(1, 5)
        .map(i -> "body-frame-" + i)
        .delayElements(Duration.ofMillis(100));
}

private static Flux<String> getEngines() {
    return Flux.range(1, 3) // only 3 available — this becomes the bottleneck
        .map(i -> "engine-" + i)
        .delayElements(Duration.ofMillis(200));
}

private static Flux<String> getTires() {
    return Flux.range(1, 10)
        .map(i -> "tires-" + i)
        .delayElements(Duration.ofMillis(75));
}

Flux.zip(getBodyFrames(), getEngines(), getTires())
    .subscribe(tuple -> log.info("Tuple: {}", tuple));
Util.sleepSeconds(5);
// zip() waits for ALL THREE producers to each contribute one item before
// combining anything — one body frame + one engine + one set of tires =
// one Tuple3, delivered only once every producer has contributed its item

Flux.zip(getBodyFrames(), getEngines(), getTires())
    .map(t -> new Car(t.getT1(), t.getT2(), t.getT3()))
    .subscribe(Util.subscriber());
// exactly 3 Car objects, even with 5 body frames and 10 sets of tires
// available — capped entirely by whichever producer runs out first`,
    note: {
      label: 'zip vs. merge, in one line',
      text: "merge() takes whatever arrives, in whatever order, from any producer. zip() waits for EVERY producer to contribute before emitting anything, and stops the moment any one of them can't.",
    },
  },
  {
    id: '9.9',
    title: 'Zip — Assignment',
    duration: '6 min',
    kind: 'assignment',
    summary: [
      "A practical version of the car-assembly pattern: a demo service exposes three separate endpoints for the same product ID — name, review, and price — each taking its usual one second to respond. The task: build one aggregated Product object per product ID by calling all three concurrently and combining the results, hiding all three calls behind a single client method so callers never see the fan-out underneath.",
      "The core of the solution is Mono.zip() (the single-item counterpart to Flux.zip(), following the exact same all-three-or-nothing rule) combining three independent Mono<String> calls into a Tuple3, immediately mapped into a proper Product record. Looping over ten product IDs and calling this one aggregated method ten times fires 30 individual HTTP requests in total, but because each product's three calls run concurrently via zip() (and different products' calls all run concurrently with each other too), the actual wall-clock time barely increases at all compared to fetching a single product.",
    ],
    code: `record Product(String name, String review, String price) {}

public class ExternalServiceClient extends AbstractHttpClient {
    public Mono<Product> getProduct(int productId) {
        return Mono.zip(
                get("/demo05/product/" + productId),
                get("/demo05/review/" + productId),
                get("/demo05/price/" + productId)
            )
            .map(t -> new Product(t.getT1(), t.getT2(), t.getT3()));
    }

    private Mono<String> get(String path) {
        return httpClient.get()
            .uri(path)
            .responseContent()
            .asString()
            .next();
    }
}

var client = new ExternalServiceClient();
for (int i = 1; i <= 10; i++) {
    client.getProduct(i).subscribe(Util.subscriber());
}
Util.sleepSeconds(2);
// each getProduct() call fires 3 requests SIMULTANEOUSLY (name, review,
// price); Mono.zip() waits for all 3 before assembling one Product.
// 10 products x 3 calls = 30 total requests, but concurrent rather than
// sequential — the wall-clock time stays close to ~1 second, not ~30`,
  },
  {
    id: '9.10',
    title: 'FlatMap — Introduction',
    duration: '9 min',
    kind: 'theory',
    summary: [
      "Every operator covered so far in this section — startWith, concatWith, merge, zip — combines producers that are genuinely independent of each other: known up front, callable in any order, with no producer needing information that only another producer can supply first.",
      "Real requirements often aren't shaped that way. Given a username, fetching that user's orders genuinely requires two sequential calls: first resolve the username to a user ID via a user service, then use that ID (which literally doesn't exist yet before step one completes) to query an order service. None of startWith/concatWith/merge/zip fit this — they all assume the set of producers is known upfront, not that one producer's very existence depends on another's result.",
      "Three small stand-in services set up the running example for the rest of this section: a UserService mapping usernames to user IDs, an OrderService returning a user's orders by ID (each user has a different number of orders, including zero for one user), and a PaymentService returning a user's balance by ID. Every method returns a Mono or Flux, standing in for genuinely separate, independent network calls — exactly the shape flatMap() is built to handle.",
    ],
    code: `record User(int id, String name) {}

public class UserService {
    private static final Map<String, Integer> USER_TABLE = Map.of(
        "Sam", 1, "Mike", 2, "Jake", 3
    );

    public static Flux<User> getAllUsers() {
        return Flux.fromIterable(USER_TABLE.entrySet())
            .map(entry -> new User(entry.getValue(), entry.getKey()));
    }

    public static Mono<Integer> getUserId(String userName) {
        return Mono.fromSupplier(() -> USER_TABLE.get(userName));
    }
}

record Order(int userId, String productName, int price) {}

public class OrderService {
    private static final Map<Integer, List<Order>> ORDER_TABLE = Map.of(
        1, List.of(new Order(1, "Keyboard", 45), new Order(1, "Monitor", 220)),
        2, List.of(new Order(2, "Desk", 300), new Order(2, "Chair", 150), new Order(2, "Lamp", 40)),
        3, List.of() // Jake has no orders at all
    );

    public static Flux<Order> getUserOrders(int userId) {
        return Flux.fromIterable(ORDER_TABLE.getOrDefault(userId, List.of()))
            .delayElements(Duration.ofMillis(500));
    }
}

public class PaymentService {
    private static final Map<Integer, Integer> BALANCE_TABLE = Map.of(1, 100, 2, 200, 3, 300);

    public static Mono<Integer> getUserBalance(int userId) {
        return Mono.fromSupplier(() -> BALANCE_TABLE.get(userId));
    }
}`,
    note: {
      label: 'The shape that breaks everything covered so far',
      text: "\"Get the user ID, THEN use it to get orders\" is a dependent, sequential call — the second call literally cannot be constructed before the first one resolves. That's a fundamentally different shape from the independent-producers case every prior operator in this section assumed.",
    },
  },
  {
    id: '9.11',
    title: 'Mono — flatMap',
    duration: '6 min',
    kind: 'demo',
    summary: [
      "The instinctive first attempt — .map(userId -> PaymentService.getUserBalance(userId)) — looks reasonable but produces a genuinely broken type: Mono<Mono<Integer>>, a Mono wrapping another Mono, rather than the Mono<Integer> actually wanted. Subscribing to that nested result hands the subscriber the inner Mono object itself as its one item, not an actual balance value.",
      "map() is the right tool for a simple in-memory transformation (turning a user ID into a greeting string, for instance) — but the moment the transformation itself produces another publisher, map() can't help, because it has no way to know it should subscribe to that inner publisher rather than just wrapping it.",
      "flatMap() is exactly that: it subscribes to the inner publisher on your behalf, takes whatever it emits, and forwards that directly — flattening Mono<Mono<Integer>> down to a proper Mono<Integer>. Chaining .flatMap(userId -> PaymentService.getUserBalance(userId)) after getUserId() produces the actual balance value directly, and the whole thing reads as a clean two-step dependent chain via method references.",
    ],
    code: `UserService.getUserId("Sam")
    .map(userId -> PaymentService.getUserBalance(userId)) // WRONG
    .subscribe(Util.subscriber());
// resulting type is Mono<Mono<Integer>>, not Mono<Integer> — the subscriber
// receives the INNER Mono object itself as its one item, not a balance

UserService.getUserId("Sam")
    .flatMap(userId -> PaymentService.getUserBalance(userId)) // RIGHT
    .subscribe(Util.subscriber());
// flatMap() subscribes to that inner Mono and forwards whatever IT emits —
// a proper Mono<Integer>; the subscriber receives 100 directly

UserService.getUserId("Mike")
    .flatMap(PaymentService::getUserBalance) // method reference form
    .subscribe(Util.subscriber());
// received 200`,
  },
  {
    id: '9.12',
    title: 'Mono — flatMapMany',
    duration: '5 min',
    kind: 'demo',
    summary: [
      "Attempting the same flatMap() pattern for the orders scenario — getUserId(name).flatMap(userId -> OrderService.getUserOrders(userId)) — genuinely fails to compile, and the reason is more than a style nitpick. Mono's flatMap() specifically assumes the inner publisher it subscribes to will itself behave like a Mono, emitting at most one item. OrderService.getUserOrders() returns a Flux — potentially many orders — which breaks that assumption outright.",
      "flatMapMany() exists for exactly this case: it explicitly acknowledges the inner publisher may emit many items, and the overall result correctly becomes a Flux<Order> rather than attempting (and failing) to squeeze it into a Mono.",
      "Running it for a user with zero orders (Jake, from the setup in 9.10) behaves exactly as expected for a genuinely empty Flux — no items, straight to a clean completion signal, no special-casing required anywhere.",
    ],
    code: `UserService.getUserId("Sam")
    .flatMap(userId -> OrderService.getUserOrders(userId)) // does NOT compile
    .subscribe(Util.subscriber());
// flatMap() assumes the inner publisher stays a Mono (at most one item) —
// but getUserOrders() returns a Flux, a genuine type mismatch

UserService.getUserId("Sam")
    .flatMapMany(userId -> OrderService.getUserOrders(userId)) // RIGHT
    .subscribe(Util.subscriber());
// flatMapMany() explicitly allows the inner publisher to emit many items —
// the overall result is Flux<Order>, not a Mono

UserService.getUserId("Mike").flatMapMany(OrderService::getUserOrders).subscribe(Util.subscriber());
// 3 orders for Mike

UserService.getUserId("Jake").flatMapMany(OrderService::getUserOrders).subscribe(Util.subscriber());
// Jake has zero orders — completes cleanly with nothing, like any other
// genuinely empty Flux`,
  },
  {
    id: '9.13',
    title: 'Flux — flatMap',
    duration: '7 min',
    kind: 'demo',
    summary: [
      "The same dependent-call pattern, but starting from a Flux instead of a Mono: get every user, then get each one's orders. Flux never had Mono's one-item assumption to begin with, so there's no separate flatMapMany() equivalent needed — Flux's own flatMap() already treats the inner publisher as potentially multi-item, by default.",
      "Chaining .flatMap(user -> OrderService.getUserOrders(user.id())) directly onto getAllUsers() produces every order from every user as one combined Flux<Order> — but watching it closely with the reusable logging transform from the merge lecture reveals something unexpected: subscriptions to each user's individual order-Flux all happen at nearly the same instant, not one user fully processed before the next begins.",
      "Orders from different users interleave in the actual output rather than arriving in clean, separate per-user blocks — which is a real behavior worth understanding rather than a bug, and it's exactly what the next lecture explains mechanically.",
    ],
    code: `UserService.getAllUsers()
    .flatMap(user -> OrderService.getUserOrders(user.id()))
    .subscribe(Util.subscriber());
Util.sleepSeconds(3);
// unlike Mono, Flux never had a one-item assumption — flatMap() here just
// always treats the inner publisher as potentially multi-item by default

// Visibility via the same reusable logger transform from the merge lecture:
UserService.getAllUsers()
    .flatMap(user -> OrderService.getUserOrders(user.id())
        .transform(fluxLogger("orders for user " + user.id())))
    .subscribe(Util.subscriber());
// subscriptions to EACH user's order-Flux happen at nearly the same
// instant — not one user fully processed before the next begins. Orders
// from different users interleave in the output rather than arriving in
// clean per-user blocks.`,
  },
  {
    id: '9.14',
    title: 'FlatMap — How It Works',
    duration: '6 min',
    kind: 'theory',
    summary: [
      "The interleaving from the previous lecture has a clean mechanical explanation: as each user ID arrives from the outer Flux, flatMap() immediately builds the corresponding inner publisher (OrderService.getUserOrders(thatId)) and subscribes to it right away — it never waits for one user's order-Flux to fully complete before moving on to construct the next one.",
      "This is genuinely a merge()-like behavior happening internally: flatMap() is effectively merging together as many inner publishers as have arrived so far from the outer sequence, delivering whatever any of them emits as soon as it emits it — exactly the same 'whoever responds first, wins' behavior Section 9.6 covered explicitly for merge().",
      "There's a real concurrency cap on how many inner publishers can be active at once: 256 by default (the same Queues.SMALL_BUFFER_SIZE origin as Section 8's internal queue sizing). flatMap() accepts an optional second argument to override that directly — dropping it to 1 makes it behave identically to concatMap() (fully sequential, one inner publisher at a time), while something like 2 or 3 caps concurrency at a specific, deliberate middle ground. Pushing this number very high is a real risk in practice — enough simultaneous outbound network calls can genuinely hit OS-level limits on concurrent TCP connections.",
    ],
    code: `// Concurrency = 1 forces fully sequential processing (identical to concatMap()):
UserService.getAllUsers()
    .flatMap(user -> OrderService.getUserOrders(user.id()), 1)
    .subscribe(Util.subscriber());
// one user's orders fully subscribed to, drained, and completed before
// the NEXT user's order-Flux is even created

// A deliberate middle ground — at most 2 inner publishers active at once:
UserService.getAllUsers()
    .flatMap(user -> OrderService.getUserOrders(user.id()), 2)
    .subscribe(Util.subscriber());`,
    note: {
      label: 'Be careful pushing concurrency very high',
      text: "flatMap()'s default cap of 256 concurrent inner publishers exists for a reason — pushing it much higher risks hitting OS-level limits on simultaneous outbound TCP connections for genuinely network-backed inner publishers.",
    },
  },
  {
    id: '9.15',
    title: 'FlatMap — Assignment',
    duration: '3 min',
    kind: 'assignment',
    summary: [
      "A direct refactor of the earlier zip-based product-fetching assignment (9.9): replace the manual for-loop over ten product IDs, each with its own separate subscription, with a single Flux.range(1, 10).flatMap(client::getProduct) pipeline instead.",
      "The behavioral difference is worth noticing directly: the for-loop version produced ten separate completion signals (one per individual Mono subscription); the Flux-based version produces exactly one, because it's genuinely one Flux subscription end to end rather than ten independent ones. Adjusting flatMap()'s concurrency argument (to something like 3) visibly throttles how many product fetches are in flight at once, exactly as covered in the previous lecture.",
    ],
    code: `Flux.range(1, 10)
    .flatMap(client::getProduct)
    .subscribe(Util.subscriber());
Util.sleepSeconds(2);
// same 10 products as the for-loop version, but now just ONE Flux
// subscription — notice only ONE completion signal total, not ten

Flux.range(1, 10)
    .flatMap(client::getProduct, 3) // cap at 3 concurrent product fetches
    .subscribe(Util.subscriber());
Util.sleepSeconds(20);
// products now arrive in visibly smaller batches — 3 in flight at a time,
// rather than up to 10 simultaneously`,
  },
  {
    id: '9.16',
    title: 'ConcatMap',
    duration: '2 min',
    kind: 'demo',
    summary: [
      "concatMap() is flatMap() with concurrency effectively locked at 1, expressed as its own named operator rather than a second argument: each inner publisher is fully subscribed to and drained before the next one is even created, guaranteeing strict, predictable per-source ordering in the output — at the direct cost of losing all concurrency.",
      "Swapping flatMap() for concatMap() in the user-orders pipeline eliminates the interleaving observed two lectures back entirely: each user's orders now arrive as a clean, separate block, one user fully finished before the next user's orders even begin fetching. The tradeoff is time — the whole sequence now takes roughly the sum of every individual user's delay, rather than however long the slowest single user took.",
    ],
    code: `UserService.getAllUsers()
    .concatMap(user -> OrderService.getUserOrders(user.id()))
    .subscribe(Util.subscriber());
Util.sleepSeconds(10);
// each user's orders arrive as a clean, separate block — no interleaving.
// Fully sequential: user 1's orders complete entirely before user 2's
// order-Flux is even created. Takes noticeably longer overall in exchange
// for strict, predictable per-user ordering.`,
  },
  {
    id: '9.17',
    title: 'Operator — Collect List',
    duration: '3 min',
    kind: 'demo',
    summary: [
      "collectList() converts a Flux<T> into a Mono<List<T>> — genuinely useful whenever a downstream consumer wants 'all the items, as one list' rather than a stream of individual emissions. The type change reflects the real semantic shift: once every item has been gathered into a list, there's exactly one thing being emitted, which is precisely what Mono represents.",
      "It's non-blocking despite superficially sounding like a 'wait for everything' operation — nothing about it parks a thread. It simply accumulates items internally as they arrive and hands the completed list to the subscriber only once the source Flux signals its own onComplete().",
      "That completion requirement is strict, though: if the source errors at any point instead of completing cleanly, collectList() delivers only the error — never a partial list containing whatever had been collected up to that point. A clean onComplete() from the source is a hard prerequisite for getting a list at all.",
    ],
    code: `Flux.range(1, 10)
    .collectList()
    .subscribe(Util.subscriber());
// a SINGLE List<Integer> containing all ten values, then complete —
// collectList() turns Flux<T> into Mono<List<T>>

Flux.range(1, 10)
    .concatWith(Mono.error(new RuntimeException("boom")))
    .collectList()
    .subscribe(Util.subscriber());
// error only — NOT a partial list plus an error. A clean onComplete from
// the source is required to ever get a list back at all`,
  },
  {
    id: '9.18',
    title: 'Operator — Then',
    duration: '6 min',
    kind: 'demo',
    summary: [
      "then() addresses a common need: sometimes a producer's individual emitted values genuinely don't matter — only whether the whole thing finished successfully or failed. A database driver's save operation might report a confirmation per record, but a caller often just wants to know 'did everything save, yes or no' without handling each individual confirmation.",
      "then() (no arguments) collapses any Flux<T> or Mono<T> down to a Mono<Void> — discarding every individual onNext() value entirely, and forwarding only the final onComplete() or onError() signal. All the intermediate detail disappears; only the pass/fail outcome remains.",
      "then(Publisher) does something related but distinct: genuine sequencing. Subscribing to two independent publishers separately (a save operation and a notification, say) doesn't guarantee any ordering between them — reactive code runs both roughly concurrently by default, so a notification could easily fire before the save it's supposedly confirming has actually finished. .then(sendNotification()) fixes this explicitly: wait for the first publisher's full completion, and only then subscribe to the second one — with the added guarantee that an error in the first means the second is never subscribed to at all.",
    ],
    code: `private static Flux<String> saveRecords(List<String> records) {
    return Flux.fromIterable(records)
        .delayElements(Duration.ofMillis(50))
        .doOnNext(r -> log.info("Saved {}", r));
}

saveRecords(List.of("A", "B", "C")).subscribe(Util.subscriber());
Util.sleepSeconds(2);
// "Saved A", "Saved B", "Saved C", complete — full detail on every save,
// possibly more than a caller actually wants

saveRecords(List.of("A", "B", "C"))
    .then()
    .subscribe(Util.subscriber());
// then() collapses Flux<String> to Mono<Void> — no individual results,
// just one completion (or error) signal once everything is done

private static Mono<Void> sendNotification() {
    return Mono.fromRunnable(() -> log.info("All records saved successfully"));
}

// WRONG — both publishers subscribed independently, no guaranteed order:
saveRecords(List.of("A", "B", "C")).subscribe(Util.subscriber());
sendNotification().subscribe(Util.subscriber());
// the notification may well log BEFORE the records finish saving

// RIGHT — then(Publisher) sequences explicitly: wait for full completion
// of the first, THEN subscribe to the second:
saveRecords(List.of("A", "B", "C"))
    .then(sendNotification())
    .subscribe(Util.subscriber());
// "Saved A", "Saved B", "Saved C", THEN "All records saved successfully" —
// and if saveRecords() errors instead of completing, sendNotification()
// is never subscribed to at all`,
  },
  {
    id: '9.19',
    title: '*** Assignment ***',
    duration: '6 min',
    kind: 'assignment',
    summary: [
      "The capstone assignment for this section: using the UserService/OrderService/PaymentService setup from 9.10, build one aggregated UserInformation object per user — combining that user's ID, name, balance, and full list of orders — for every user in the system.",
      "The solution layers together nearly everything covered in this section. For each individual user, Mono.zip() combines two genuinely independent per-user calls: the balance (already a Mono) and the orders (a Flux, first collapsed into a Mono<List<Order>> via collectList() specifically so it can participate in the zip at all). At the outer level, flatMap() is what actually connects 'for each user' to 'build their aggregated info' — since building that info is itself an asynchronous Mono-returning operation depending on that specific user's ID, exactly the dependent-call shape flatMap() exists for.",
      "The result: one pipeline exercising flatMap (dependent, per-item calls), zip (combining independent per-user calls), and collectList (flattening a Flux into something zip can consume) all at once — a solid synthesis of the whole section's material.",
    ],
    code: `record UserInformation(int userId, String userName, int balance, List<Order> orders) {}

private static Mono<UserInformation> getUserInformation(User user) {
    return Mono.zip(
            PaymentService.getUserBalance(user.id()),
            OrderService.getUserOrders(user.id()).collectList()
        )
        .map(t -> new UserInformation(user.id(), user.name(), t.getT1(), t.getT2()));
}

UserService.getAllUsers()
    .flatMap(GetUserInfoDemo::getUserInformation)
    .subscribe(Util.subscriber());
Util.sleepSeconds(3);
// for each user: balance and orders fetch CONCURRENTLY via zip() (orders
// collapsed from Flux<Order> to Mono<List<Order>> via collectList() so it
// can participate); flatMap() at the outer level subscribes to each
// per-user Mono as users arrive from getAllUsers()`,
  },
  {
    id: '9.20',
    title: 'Summary',
    duration: '3 min',
    kind: 'summary',
    summary: [
      "Real business requirements often need multiple network calls combined in a specific way — sometimes in order, sometimes simultaneously, sometimes only where one call depends on another's result. This section's operators cover the common shapes: startWith/concatWith for checking one source before falling through to another (a cache-then-database pattern, or vice versa), merge for a scatter-gather 'ask everyone, take whoever answers first' pattern, and zip for 'combine one item from each of several sources into one object, and only if every source can actually supply one.'",
      "flatMap() (and its Mono-specific sibling flatMapMany) is for the genuinely dependent case: an item arrives, and processing it requires creating and subscribing to another publisher — behaving internally like a merge across however many inner publishers are active at once, bounded by a configurable concurrency limit. concatMap() is the same idea with concurrency fixed at 1, trading speed for strict per-source ordering.",
      "collectList() and then() round out the toolkit for reshaping results: collapsing a Flux into a single Mono<List<T>> when a consumer wants everything as one list, or discarding individual results entirely down to a pure Mono<Void> success/failure signal — with then(Publisher) additionally providing genuine sequencing between two publishers that would otherwise run independently.",
    ],
    keyPoints: [
      'startWith/concatWith — check one source, fall through to another only if still needed (order matters, one direction each).',
      'merge — subscribe to everything simultaneously, take whatever arrives first (scatter-gather).',
      'zip — combine one item from EVERY source into one result; stops the moment any source runs out.',
      'flatMap/flatMapMany — for dependent, per-item calls; behaves like an internal merge across concurrently-active inner publishers (concurrency configurable).',
      'concatMap — flatMap with concurrency fixed at 1; strictly ordered, but fully sequential.',
      'collectList — Flux<T> to Mono<List<T>>; then()/then(Publisher) — discard results down to success/failure, with optional explicit sequencing.',
    ],
  },
]
