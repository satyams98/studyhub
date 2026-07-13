export default [
  {
    id: '6.1',
    title: 'Introduction',
    duration: '4 min',
    kind: 'theory',
    summary: [
      "Every publisher covered so far in this course has been cold, and it's worth naming the pattern explicitly now that it's second nature: when two Subscribers attach to the same cold Flux, they each get their own completely independent data stream. Cancelling one has zero effect on the other. Netflix is the canonical real-world example — you and a friend can both start the same movie at the same time from different locations, but you're watching two entirely separate video streams; pausing yours doesn't pause theirs.",
      "A hot publisher breaks that assumption in a genuinely surprising way: there's exactly one data producer shared by every Subscriber, and in some configurations it can start emitting before any Subscriber even shows up. The real-world analogue is a TV channel or a movie theater — the broadcast happens on its own schedule; showing up late means missing whatever already aired, because there's only one shared stream, not one per viewer.",
      "This directly contradicts the 'nothing happens until you subscribe' rule from Section 1 — and that's genuinely intentional for hot publishers, not a violation worth panicking over. Real use cases for this get covered later in the section.",
    ],
    note: {
      label: 'Cold vs. hot, in one line',
      text: 'Cold: every Subscriber gets its own independent stream (Netflix). Hot: every Subscriber shares one stream that may already be running (a TV broadcast).',
    },
  },
  {
    id: '6.2',
    title: 'Flux Sink — Issue Discussion',
    duration: '5 min',
    kind: 'demo',
    summary: [
      "Section 4 left an open thread: Flux.create() with a shared Consumer<FluxSink<T>> was explicitly called out as a single-subscriber pattern, without fully explaining why multiple subscribers break it. This lecture makes the breakage visible directly.",
      "Adding a log statement inside NameGenerator's accept(FluxSink<String>) method — the one that stashes the sink reference — and then subscribing twice to the same Flux.create(generator) reveals it prints twice. Flux.create() invokes that Consumer once per subscription, handing over a brand new FluxSink each time, and NameGenerator's single sink field simply gets overwritten by the second call. The first subscriber's sink reference is gone entirely — silently replaced, not queued or duplicated.",
      "The practical consequence: calling generator.generate() after both subscriptions only ever reaches the second subscriber, because that's the only sink the generator instance still holds a reference to. This is the actual mechanism behind 'Flux.create() with a shared sink only works for one subscriber' — not a special rule to memorize, just a direct consequence of one mutable field getting overwritten.",
    ],
    code: `public class NameGenerator implements Consumer<FluxSink<String>> {
    private FluxSink<String> sink;

    @Override
    public void accept(FluxSink<String> sink) {
        log.info("Got a flux sink");
        this.sink = sink; // each new subscription overwrites this field entirely
    }

    public void generate() {
        sink.next(Util.faker().name().firstName());
    }
}

var generator = new NameGenerator();
Flux<String> flux = Flux.create(generator);

flux.subscribe(Util.subscriber("subscriber-1"));
flux.subscribe(Util.subscriber("subscriber-2"));
// "Got a flux sink" prints TWICE — Flux.create() calls accept() once per
// subscription, and the second call silently overwrites the first sink

generator.generate();
// only subscriber-2 ever sees this — the generator's single sink field
// only ever points at the most recently created sink`,
    note: {
      label: 'The actual mechanism, not just a rule',
      text: "It's not that Flux.create() 'doesn't support' multiple subscribers as some kind of policy — it's that a shared, mutable sink reference gets silently overwritten on every new subscription. Next lecture covers the fix.",
    },
  },
  {
    id: '6.3',
    title: 'Hot Publisher',
    duration: '9 min',
    kind: 'demo',
    summary: [
      "A movieStream() method built with Flux.generate() — logging 'Received the request' on every invocation specifically to count how many times it actually runs — sets up a clean before/after comparison. Two subscribers, Sam joining immediately and Mike joining 3 seconds later, attach to the exact same Flux instance.",
      "Without any modification, the log prints twice, and Mike starts from scene 1 while Sam is already on scene 3 or 4 — this is still a cold publisher underneath, behaving exactly like two independent Netflix streams, regardless of how it's dressed up narratively as a 'movie theater.'",
      "Adding a single .share() call changes everything: the log now prints only once, meaning there's genuinely one producer now. Mike, joining 3 seconds late, simply misses the scenes that already played and picks up wherever the shared stream currently is — exactly like walking into a real movie theater partway through. Cancelling early (one viewer calling take(n) to leave after a few scenes) only affects that one viewer; the shared stream keeps running for whoever's left, and only actually stops once every subscriber has left.",
    ],
    code: `private static Flux<String> movieStream() {
    return Flux.generate(
            () -> 1,
            (sceneNumber, sink) -> {
                log.info("Received the request"); // watch how many times THIS actually runs
                var scene = "Movie scene " + sceneNumber;
                log.info("Playing {}", scene);
                sink.next(scene);
                return sceneNumber + 1;
            })
        .cast(String.class)
        .take(10)
        .delayElements(Duration.ofSeconds(1));
}

// WITHOUT .share() — still cold. "Received the request" logs TWICE.
// Mike (joining 3s late) starts from scene 1 while Sam is already ahead —
// two fully independent streams, Netflix-style:
Flux<String> movieFlux = movieStream();
movieFlux.subscribe(Util.subscriber("Sam"));
Util.sleepSeconds(3);
movieFlux.subscribe(Util.subscriber("Mike"));
Util.sleepSeconds(12);

// WITH .share() — genuinely hot. "Received the request" logs ONCE.
// Mike joins mid-stream and simply misses whatever already played:
Flux<String> movieFlux = movieStream().share();
movieFlux.subscribe(Util.subscriber("Sam"));
Util.sleepSeconds(3);
movieFlux.subscribe(Util.subscriber("Mike")); // starts wherever the shared stream currently is
Util.sleepSeconds(12);`,
  },
  {
    id: '6.4',
    title: 'Hot Publisher — Ref Count',
    duration: '3 min',
    kind: 'demo',
    summary: [
      "share() isn't a distinct mechanism — it's shorthand for .publish().refCount(1): start producing once at least 1 subscriber is present, and stop automatically once the subscriber count drops back to zero. Spelling it out with refCount(n) directly exposes a configurable minimum: refCount(2) means the movie won't start until both Sam and Mike have joined, matching a hypothetical 'we need at least two people in the theater' requirement.",
      "A subtlety worth knowing: once the subscriber count drops to zero and later climbs back up, the stream doesn't resume where it left off — it restarts completely fresh, from the very first item. This is called re-subscription. If Sam watches one scene and leaves, dropping the count to zero, the whole thing stops; when Mike shows up later, it starts over from scene 1 for him, not from wherever Sam had gotten to.",
    ],
    code: `// .share() is exactly equivalent to:
Flux<String> movieFlux = movieStream().publish().refCount(1);

// refCount(2) waits for a minimum of 2 subscribers before starting at all:
Flux<String> movieFlux = movieStream().publish().refCount(2);
// neither Sam nor Mike sees anything until BOTH have subscribed

// Re-subscription: dropping to zero subscribers and getting a new one
// later restarts from scratch — not from where it left off:
Flux<String> movieFlux = movieStream().publish().refCount(1);
// Sam joins, watches 1 scene, leaves -> count hits 0 -> playback STOPS
// Mike joins later -> count back to 1 -> starts fresh from scene 1, not
// wherever Sam had left off`,
    note: {
      label: 'share() = publish().refCount(1)',
      text: 'refCount(n) generalizes what share() does — n is the minimum subscriber count required to (re)start production, and dropping below it stops the stream entirely until enough subscribers return.',
    },
  },
  {
    id: '6.5',
    title: 'Hot Publisher — Auto Connect',
    duration: '4 min',
    kind: 'demo',
    summary: [
      "publish().autoConnect(1) starts under the same condition as refCount(1) — at least one subscriber required — but behaves differently once running: it never stops, even if every single subscriber leaves. That's the one meaningful difference between the two: refCount can stop and restart; autoConnect, once started, just keeps going regardless of who's watching.",
      "autoConnect(0) removes the starting condition entirely — production begins the instant the line of code runs, with zero subscribers required, and continues indefinitely. This is the truest match for the TV-channel analogy: broadcasting happens on its own schedule whether or not anyone's tuned in, and anyone who joins simply starts wherever the broadcast currently is.",
    ],
    code: `// autoConnect(1): starts like refCount(1), but never stops once started,
// even after every subscriber leaves:
Flux<String> movieFlux = movieStream().publish().autoConnect(1);
// Sam and Mike both leave — the movie just keeps playing to nobody

// autoConnect(0): starts immediately, no subscribers required at all —
// a genuine broadcast:
Flux<String> movieFlux = movieStream().publish().autoConnect(0);
// starts the moment this line runs; Sam and Mike each join mid-stream,
// already missing whatever aired before they tuned in`,
  },
  {
    id: '6.6',
    title: 'Hot Publisher — Replay / Cache',
    duration: '7 min',
    kind: 'demo',
    summary: [
      "autoConnect(0) has a real gap that shows up clearly with a stock-price example instead of a movie: a late subscriber sees absolutely nothing until the next new value happens to be emitted. For a TV channel, that's fine — you just watch whatever's currently airing. For a stock price, it's a real problem: joining and seeing nothing until the price happens to change next means you don't actually know the current price at all.",
      "replay(n) (used in place of publish()) fixes exactly this by caching the n most recently emitted values specifically for late subscribers. replay(1) caches just the single most recent value — a late subscriber immediately receives the current price the moment they join, and then continues receiving every subsequent update alongside everyone else, no waiting required.",
      "This generalizes cleanly to any 'the current state matters, not just future changes' scenario: a live game score, a live auction price, a live leaderboard — anywhere a newcomer needs to know 'what is it right now' immediately rather than waiting for the next change.",
    ],
    code: `private static Flux<Integer> stockStream() {
    return Flux.create(sink -> {
        while (true) {
            int price = Util.faker().number().numberBetween(10, 100);
            log.info("Emitting price {}", price);
            sink.next(price);
            Util.sleepSeconds(3);
        }
    });
}

// autoConnect(0) alone: a late subscriber sees NOTHING until the NEXT
// price change — they have no idea what the current price actually is:
Flux<Integer> stockFlux = stockStream().publish().autoConnect(0);
stockFlux.subscribe(Util.subscriber("Sam"));  // sees nothing until the next emission
Util.sleepSeconds(4);
stockFlux.subscribe(Util.subscriber("Mike")); // same problem

// replay(1) caches the most recent value specifically for late joiners:
Flux<Integer> stockFlux = stockStream().replay(1).autoConnect(0);
stockFlux.subscribe(Util.subscriber("Sam"));  // immediately gets the CURRENT price
Util.sleepSeconds(4);
stockFlux.subscribe(Util.subscriber("Mike")); // also immediately gets the CURRENT price
// both then receive every subsequent price change together`,
  },
  {
    id: '6.7',
    title: 'Flux Sink — Multiple Subscribers',
    duration: '2 min',
    kind: 'demo',
    summary: [
      "With hot vs. cold now fully explained, the fix for Section 4's single-subscriber Flux.create() limitation is almost anticlimactic: chain .share() (or .publish().autoConnect(...)) onto the FluxSink-based Flux, exactly as done for the movie stream example. Nothing about NameGenerator itself needs to change.",
      "With .share() added, both subscribers now receive identical items from a single shared sink — since it's genuinely one hot stream now, not two independent cold ones each silently overwriting the generator's sink field.",
    ],
    code: `var generator = new NameGenerator();
Flux<String> flux = Flux.create(generator).share(); // the actual one-line fix

flux.subscribe(Util.subscriber("subscriber-1"));
flux.subscribe(Util.subscriber("subscriber-2"));

generator.generate();
// NOW both subscribers receive the same name — one shared sink, one
// shared stream, exactly the fix the single-subscriber limitation needed`,
  },
  {
    id: '6.8',
    title: 'Summary',
    duration: '4 min',
    kind: 'summary',
    summary: [
      "Cold publishers give each Subscriber its own dedicated, independent data producer — the default behavior for everything in this course so far, and the right choice whenever data is genuinely specific to one requester: a food-delivery order's status updates are for that customer's order, not a shared broadcast.",
      "Hot publishers share one producer across every Subscriber, and — depending on configuration — can even run without any Subscriber present at all. The right choice whenever the same data needs to reach many consumers simultaneously: a news feed, live weather, a stock ticker, an election results feed. None of that is user-specific; it's identical for everyone watching.",
      "share() (= publish().refCount(1)) is the natural starting point: delay work until at least one subscriber shows up, and stop automatically once nobody's left — refCount(n) generalizes the minimum. publish().autoConnect(n) behaves the same way at startup but never stops once running, even at zero subscribers; autoConnect(0) is a true broadcast that starts immediately regardless of subscribers. replay(n) layers a small cache of the n most recent values on top of any of these, specifically so late subscribers can see current state immediately instead of waiting for the next change.",
    ],
    keyPoints: [
      'Cold = one independent stream per subscriber (the default, and the right choice for request-specific data).',
      'Hot = one shared stream for every subscriber (the right choice for broadcast-style data).',
      "share()/refCount(n) — starts once n subscribers are present, stops (and restarts fresh) when the count drops below n.",
      'publish().autoConnect(n) — starts the same way, but never stops once running; autoConnect(0) is a true always-on broadcast.',
      'replay(n) — caches the n most recent values so late subscribers see current state immediately, not just future changes.',
    ],
  },
  {
    id: '6.9',
    title: '*** Assignment ***',
    duration: '5 min',
    kind: 'assignment',
    summary: [
      "A shared order stream (via a demo endpoint standing in for something like a Kafka topic) needs to be consumed by two independent services simultaneously, without triggering two separate remote calls — the defining hot-publisher requirement of this whole section. Messages arrive as plain colon-delimited strings (item:category:price:quantity) rather than JSON, so parsing is part of the exercise.",
      "RevenueService tracks running revenue per category in a simple in-memory map, updating it as orders arrive, and separately exposes its own Flux that emits a full snapshot of that map every 2 seconds. InventoryService does the same for stock levels, starting every category at 500 units and deducting each order's quantity as it's consumed.",
      "The one hard requirement tying this back to the section's theme: both services must consume the exact same underlying order stream, shared (hot), rather than each independently triggering its own call to the external service.",
    ],
    note: {
      label: 'The requirement this assignment is actually testing',
      text: 'Two independent consumers, one underlying network call. If your solution calls the external order-stream endpoint twice, the hot-publisher setup is missing somewhere.',
    },
  },
  {
    id: '6.10',
    title: 'Assignment Solution',
    duration: '12 min',
    kind: 'solution',
    summary: [
      "The external service client parses each raw message into an Order record (category, price, quantity — ignoring the item field, which isn't needed), logs it via doOnNext() for visibility, and — critically — chains .publish().refCount(2) so the underlying HTTP stream only starts once both consumers are actually subscribed, and is shared between them rather than fetched twice.",
      "That shared Flux<Order> is cached in a field and lazily created on first access, so repeated calls to the exposed orderStream() method all return the same underlying hot publisher rather than building a new one each time.",
      "RevenueService and InventoryService both implement a small shared OrderProcessor-style contract: a consume(Order) method that updates an internal Map<String, Integer>, and a stream() method returning their own Flux.interval(Duration.ofSeconds(2)).map(tick -> map.toString()) snapshot feed. Both subscribe to the exact same client.orderStream() — satisfying the two-subscribers-one-source requirement — while independently exposing their own downstream feeds for whoever wants to observe revenue or inventory in real time.",
    ],
    code: `record Order(String category, int price, int quantity) {}

public class ExternalServiceClient extends AbstractHttpClient {
    private Flux<Order> orderFlux;

    private Flux<Order> getOrderStream() {
        return httpClient.get()
            .uri("/demo04/orders-stream")
            .responseContent()
            .asString()
            .map(this::parse)
            .doOnNext(order -> log.info("Order: {}", order))
            .publish()
            .refCount(2); // starts only once both consumers have subscribed
    }

    private Order parse(String message) {
        String[] parts = message.split(":");
        return new Order(parts[1], Integer.parseInt(parts[2]), Integer.parseInt(parts[3]));
    }

    public Flux<Order> orderStream() {
        if (this.orderFlux == null) {
            this.orderFlux = getOrderStream();
        }
        return this.orderFlux;
    }
}

public class RevenueService {
    private final Map<String, Integer> revenueByCategory = new HashMap<>();

    public void consume(Order order) {
        int current = revenueByCategory.getOrDefault(order.category(), 0);
        revenueByCategory.put(order.category(), current + order.price());
    }

    public Flux<String> stream() {
        return Flux.interval(Duration.ofSeconds(2))
            .map(tick -> revenueByCategory.toString());
    }
}

public class InventoryService {
    private final Map<String, Integer> inventoryByCategory = new HashMap<>();

    public void consume(Order order) {
        int current = inventoryByCategory.getOrDefault(order.category(), 500);
        inventoryByCategory.put(order.category(), current - order.quantity());
    }

    public Flux<String> stream() {
        return Flux.interval(Duration.ofSeconds(2))
            .map(tick -> inventoryByCategory.toString());
    }
}

var client = new ExternalServiceClient();
var inventoryService = new InventoryService();
var revenueService = new RevenueService();

client.orderStream().subscribe(inventoryService::consume);
client.orderStream().subscribe(revenueService::consume); // same shared stream, second subscriber

inventoryService.stream().subscribe(Util.subscriber("inventory"));
revenueService.stream().subscribe(Util.subscriber("revenue"));

Util.sleepSeconds(30);`,
  },
]
