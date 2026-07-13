export default [
  {
    id: '10.1',
    title: 'Introduction',
    duration: '1 min',
    kind: 'theory',
    summary: [
      "Another explicitly optional section — genuinely useful specifically if reactive programming is being applied to message-queue-style workloads (Kafka, RabbitMQ, Pulsar, or any 'never-ending stream of individual messages' scenario), where processing items one at a time isn't efficient and grouping them into meaningful chunks is. If that's not a shape your own work needs, skipping ahead costs little.",
    ],
  },
  {
    id: '10.2',
    title: 'Buffer',
    duration: '9 min',
    kind: 'demo',
    summary: [
      "buffer() collects individual emissions into a List and hands that list to the subscriber as one unit — turning a Flux<T> into a Flux<List<T>>. Motivating scenario: a fast stream of user click/view events that shouldn't each trigger a separate, inefficient individual database insert — batching them and inserting once per batch is the more realistic approach.",
      "Called with no argument, buffer() waits for the ENTIRE source to complete (or Integer.MAX_VALUE items, whichever comes first) before emitting a single list — rarely what's actually wanted for a genuinely ongoing stream. buffer(n) collects every n items into a list instead; if the source completes with a partial batch still pending, that partial batch is still emitted rather than held forever. buffer(Duration) collects everything that arrives within a fixed time window instead of a fixed count — useful when the actual arrival rate is unpredictable but a steady reporting cadence is still wanted.",
      "A genuine gotcha worth knowing: buffer(n) genuinely waits for n items to complete a batch — concatenating a source with Flux.never() (a publisher that deliberately never emits and never completes, useful specifically for testing scenarios like this) shows that a partial batch stuck below the target count is held forever, never delivered, because there's no completion signal and no further items to ever complete it.",
    ],
    code: `private static Flux<String> eventStream() {
    return Flux.interval(Duration.ofMillis(200))
        .map(i -> "event" + (i + 1));
}

eventStream()
    .buffer(3) // collect every 3 items into one list
    .take(3)
    .subscribe(Util.subscriber());
// [event1, event2, event3], [event4, event5, event6], [event7, event8, event9]

eventStream()
    .buffer(Duration.ofMillis(500)) // collect everything arriving every 500ms
    .subscribe(Util.subscriber());
// a new list roughly every 500ms, containing however many items actually
// arrived in that window

// The gotcha: a partial batch below the target count is held forever if
// nothing ever arrives to complete it or signal completion:
eventStream()
    .take(10)
    .concatWith(Flux.never()) // never emits, never completes — a deliberate stall
    .buffer(3)
    .subscribe(Util.subscriber());
// [1,2,3], [4,5,6], [7,8,9] print fine — item 10 NEVER appears, because
// buffer(3) is still waiting for items 11 and 12 to complete that batch,
// and Flux.never() guarantees they'll never arrive

// buffer(count, maxWait) — whichever limit is hit FIRST wins:
eventStream()
    .take(10)
    .concatWith(Flux.never())
    .bufferTimeout(3, Duration.ofSeconds(1))
    .subscribe(Util.subscriber());
// [1,2,3], [4,5,6], [7,8,9], AND [10] — the stalled partial batch is
// finally delivered once 1 second passes, even without reaching count 3`,
  },
  {
    id: '10.3',
    title: '*** Assignment *** — Buffer',
    duration: '2 min',
    kind: 'assignment',
    summary: [
      "A self-contained assignment using a simulated book-order stream (no external service needed) emitting a random BookOrder — genre, title, price — roughly every 200 milliseconds via the faker library's book-related methods. The business is only interested in four specific genres out of however many the faker generates: science fiction, fantasy, suspense, thriller.",
      "The requirement: every 5 seconds, produce one revenue report summarizing total revenue for each of those genres, based only on whatever qualifying orders arrived during that specific 5-second window.",
    ],
  },
  {
    id: '10.4',
    title: 'Buffer — Assignment Solution',
    duration: '7 min',
    kind: 'solution',
    summary: [
      "The solution combines filter() (keeping only the four genres of interest) with buffer(Duration.ofSeconds(5)) to collect qualifying orders into 5-second batches, then maps each resulting List<BookOrder> through a generateReport() helper.",
      "That helper uses plain Java Stream machinery — Collectors.groupingBy(BookOrder::genre, Collectors.summingInt(BookOrder::price)) — to produce a Map<String, Integer> of total revenue per genre from the batch, wrapped in a small RevenueReport record alongside a timestamp. None of the actual aggregation logic needs Reactor at all; buffer() is only responsible for producing the right-sized, right-timed batches for that ordinary Stream-based logic to operate on.",
    ],
    code: `record BookOrder(String genre, String title, int price) {
    static BookOrder create() {
        var book = Util.faker().book();
        return new BookOrder(book.genre(), book.title(), Util.faker().number().numberBetween(10, 200));
    }
}

record RevenueReport(LocalTime time, Map<String, Integer> revenueByGenre) {}

private static Flux<BookOrder> orderStream() {
    return Flux.interval(Duration.ofMillis(200))
        .map(i -> BookOrder.create());
}

private static RevenueReport generateReport(List<BookOrder> orders) {
    var revenue = orders.stream()
        .collect(Collectors.groupingBy(
            BookOrder::genre,
            Collectors.summingInt(BookOrder::price)
        ));
    return new RevenueReport(LocalTime.now(), revenue);
}

Set<String> interestingGenres = Set.of("Science Fiction", "Fantasy", "Suspense", "Thriller");

orderStream()
    .filter(order -> interestingGenres.contains(order.genre()))
    .buffer(Duration.ofSeconds(5))
    .map(BookOrderDemo::generateReport)
    .subscribe(Util.subscriber());
Util.sleepSeconds(60);
// every 5 seconds: one RevenueReport summarizing total revenue per genre
// for whatever qualifying orders arrived during that window`,
  },
  {
    id: '10.5',
    title: 'Windowing',
    duration: '3 min',
    kind: 'theory',
    summary: [
      "window() looks similar to buffer() on the surface — both split a stream into chunks based on a count or a duration — but the actual mechanism is fundamentally different. buffer() accumulates items into a List and hands the whole list to the subscriber at once, after waiting for the batch to complete. window() opens an entirely new inner Flux for each chunk and delivers items to it immediately, one at a time, as they arrive — with the underlying subscriber itself effectively swapped out at each window boundary.",
      "The log-file analogy makes this concrete: a production application writing continuous logs doesn't accumulate an entire day's worth of log lines in memory before writing anything — it writes each line as it happens, into whichever file is currently open, and opens a fresh file at each new hour or day boundary. The file being written to is the 'subscriber' that keeps changing at each window boundary; the individual log lines are delivered immediately, not batched and delayed.",
    ],
    note: {
      label: 'buffer vs. window, in one line',
      text: 'buffer() waits, accumulates, then delivers one List per batch. window() delivers items immediately, one at a time, to a fresh inner Flux (and effectively a fresh subscriber) at each new chunk boundary.',
    },
  },
  {
    id: '10.6',
    title: 'Windowing — Demo',
    duration: '9 min',
    kind: 'demo',
    summary: [
      "window(5) on an event stream produces a Flux<Flux<String>> — a new inner Flux opens every 5 items — but simply nesting a subscribe() inside a subscribe() to consume it defeats the entire point: each window opens and closes essentially immediately, producing behavior indistinguishable from a plain, unwindowed stream. That's explicitly not the intended usage.",
      "The actual pattern: a processEvents(Flux<String>) helper that treats each inner window as a genuine, independent mini-stream — printing a marker character for every item it receives via doOnNext(), and a newline once that specific window's doOnComplete() fires — returned as a Mono<Void> via then(), since the caller only needs to know the window finished, not any individual value. Chaining .flatMap(EventWindowDemo::processEvents) onto window(5) is what actually subscribes to each inner window as it's created.",
      "Running it prints markers in visibly distinct rows, one row per window — direct visual confirmation that each window really is being handled as its own independent sub-stream rather than accumulated into a shared list. window() accepts a Duration exactly like buffer() does, splitting by time instead of count.",
    ],
    code: `private static Flux<String> eventStream() {
    return Flux.interval(Duration.ofMillis(500))
        .map(i -> "event" + (i + 1));
}

// Defeats the purpose — opens and closes each window basically immediately:
eventStream()
    .window(5)
    .subscribe(innerFlux -> innerFlux.subscribe(Util.subscriber()));

// The actual intended pattern — treat each window as its own mini-stream:
private static Mono<Void> processEvents(Flux<String> flux) {
    return flux
        .doOnNext(event -> System.out.print("* "))
        .doOnComplete(System.out::println) // new line once THIS window ends
        .then();
}

eventStream()
    .window(5)
    .flatMap(EventWindowDemo::processEvents)
    .subscribe(Util.subscriber());
Util.sleepSeconds(60);
// prints markers in visibly distinct rows — one row per window of 5 items,
// direct confirmation each window is its own independent sub-stream

// window() also accepts a Duration, splitting by time instead of count:
eventStream()
    .window(Duration.ofMillis(1800))
    .flatMap(EventWindowDemo::processEvents)
    .subscribe(Util.subscriber());`,
    note: {
      label: "This lecture's assignment",
      text: 'Using this exact event stream and window setup, write each window\'s events into its own numbered file (file1.txt, file2.txt, ...) under a resources directory — a new file opened per window, closed once that window completes.',
    },
  },
  {
    id: '10.7',
    title: 'Windowing — Assignment Solution',
    duration: '8 min',
    kind: 'solution',
    summary: [
      "A small FileWriter helper wraps a java.nio.file.Path and a BufferedWriter behind a private constructor plus createFile()/writeLine()/closeFile() methods — deliberately private, since the class exposes exactly one public entry point: a static create(Flux<String>, Path) factory method.",
      "That factory wires the file lifecycle directly into the Flux's own signals: doFirst() opens the file the moment the Flux is subscribed to, doOnNext() writes each incoming line, and doFinally() closes the file no matter how the Flux ends — completion, error, or cancellation all trigger it exactly once. The whole thing returns a Mono<Void> via then(), since callers only care that the file was written and closed correctly, not any individual line.",
      "Wiring it into the earlier window(5) setup — one AtomicInteger-based counter feeding a numbered filename per window, inside a flatMap() that calls FileWriter.create() for each inner window — produces a fresh file per 5-item window, each one opened, populated, and closed independently as the underlying event stream continues indefinitely.",
    ],
    code: `public class FileWriter {
    private final Path path;
    private BufferedWriter writer;

    private FileWriter(Path path) {
        this.path = path;
    }

    private void createFile() {
        try {
            this.writer = Files.newBufferedWriter(path);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    private void writeLine(String content) {
        try {
            writer.write(content);
            writer.newLine();
            writer.flush();
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    private void closeFile() {
        try {
            writer.close();
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    public static Mono<Void> create(Flux<String> flux, Path path) {
        var writer = new FileWriter(path);
        return flux
            .doFirst(writer::createFile)
            .doOnNext(writer::writeLine)
            .doFinally(signal -> writer.closeFile())
            .then();
    }
}

var counter = new AtomicInteger(1);
String fileNameFormat = "src/main/resources/section10/file%d.txt";

eventStream()
    .window(5)
    .flatMap(innerFlux -> FileWriter.create(
        innerFlux,
        Path.of(String.format(fileNameFormat, counter.getAndIncrement()))
    ))
    .subscribe(Util.subscriber());
Util.sleepSeconds(60);
// every 5 events opens a brand-new file (file1.txt, file2.txt, ...),
// writes exactly that window's events into it, and closes it once done`,
  },
  {
    id: '10.8',
    title: 'GroupBy',
    duration: '4 min',
    kind: 'theory',
    summary: [
      "groupBy() routes items to one of several inner fluxes based on a key derived from each item — a stream of colored balls grouped by color, say, would create one inner Flux per distinct color, with each ball routed to the flux matching its color as it arrives. The benefit: each group's inner flux can have its own specific operators attached — special handling for one category, none at all for another — instead of one giant chain of conditionals applying to everything indiscriminately.",
      "The critical, genuinely important difference from window(): window() only ever has exactly one inner Flux open at a time, closing the current one and opening the next on a fixed schedule. groupBy() opens one inner Flux per distinct key value and never closes any of them on its own — because a value belonging to any given key could, in principle, arrive again at any point in the future, and there's no way for groupBy() to know a particular key is truly finished.",
      "This has a direct practical consequence: groupBy() must be used with genuinely low-cardinality keys — a handful of categories, payment methods, or similar — never something like a customer's phone number, which would open an unbounded, ever-growing number of inner fluxes that never get cleaned up.",
    ],
    note: {
      label: 'The rule to actually remember',
      text: 'groupBy() opens one inner Flux per key and keeps every single one open indefinitely — there is no automatic cleanup. Only use it with a small, bounded, genuinely low-cardinality set of possible key values.',
    },
  },
  {
    id: '10.9',
    title: 'GroupBy — Demo',
    duration: '9 min',
    kind: 'demo',
    summary: [
      "Grouping Flux.range(1, 30) by i % 2 — odd vs. even — produces exactly two inner fluxes, wrapped in Reactor's own GroupedFlux type (which is literally just a Flux with one extra property: key()). A processGroup() helper logging 'received flux for key X' the first time each group appears, then logging every item that flows through it, makes a subtle point directly visible: that first log line prints exactly twice total — once per distinct key — never once per item, confirming groupBy() genuinely creates and reuses one inner flux per key rather than a new one per emission.",
      "The low-cardinality warning from the previous lecture becomes concrete and visible here: mapping every value to be even except for one deliberately injected odd value up front (via startWith(1)) creates an odd-key inner flux for that single value — and that inner flux never completes, even once the entire source itself completes. groupBy() genuinely has no way to know another odd value won't arrive eventually, so it simply leaves that inner flux open indefinitely, waiting for something that will never come.",
    ],
    code: `Flux.range(1, 30)
    .delayElements(Duration.ofSeconds(1))
    .groupBy(i -> i % 2) // key: 0 (even) or 1 (odd)
    .flatMap(GroupedFluxDemo::processGroup)
    .subscribe(Util.subscriber());
Util.sleepSeconds(60);

private static Mono<Void> processGroup(GroupedFlux<Integer, Integer> groupedFlux) {
    log.info("Received flux for key {}", groupedFlux.key());
    return groupedFlux
        .doOnNext(item -> log.info("key {} item {}", groupedFlux.key(), item))
        .then();
}
// "Received flux for key ..." prints exactly TWICE total — once per
// distinct key — never once per item. groupBy() reuses one inner flux per
// key rather than creating a new one for every emission.

// The low-cardinality problem, made concrete:
Flux.range(1, 30)
    .delayElements(Duration.ofSeconds(1))
    .map(i -> i * 2)   // every value now even — an odd key should never occur again
    .startWith(1)       // ...except this ONE odd value, injected up front
    .groupBy(i -> i % 2)
    .flatMap(gf -> gf.doOnComplete(() -> log.info("key {} completed", gf.key())))
    .subscribe(Util.subscriber());
Util.sleepSeconds(60);
// the even-key flux completes cleanly once the source does — but the
// odd-key flux, created for that single injected value, NEVER completes,
// because groupBy() can't know another odd value won't show up eventually.
// It stays open indefinitely, waiting.`,
  },
  {
    id: '10.10',
    title: '*** Assignment *** — GroupBy',
    duration: '3 min',
    kind: 'assignment',
    summary: [
      "A simulated purchase-order stream emits random orders (item, category, price — using faker's commerce methods) at a steady interval. Out of however many categories the faker actually generates, the business cares about exactly two: kids and automotive, and each has its own distinct business rule to apply.",
      "Automotive orders need a flat $100 added to their price. Kids orders trigger a buy-one-get-one promotion: for every kids order that arrives, an additional free order (price zero) should be emitted alongside the original. Everything outside these two categories should simply be filtered out before any of this processing happens.",
    ],
  },
  {
    id: '10.11',
    title: 'GroupBy — Assignment Solution',
    duration: '10 min',
    kind: 'solution',
    summary: [
      "The solution centers on a Map<String, UnaryOperator<Flux<PurchaseOrder>>> — one reusable transform-style operator per category, keyed by category name, mirroring the transform() pattern from Section 5. automotiveProcessing() is a simple map() adding $100 to the price. kidsProcessing() uses flatMap() combined with startWith() (the operator from earlier in this section): for each incoming kids order, it builds a Mono<PurchaseOrder> representing the free duplicate, converts it to a Flux, and prepends the original order via startWith() — so both the original and the free item flow downstream from a single incoming order.",
      "OrderProcessingService exposes two small public helpers: canProcess(order) — a predicate checking whether the processor map actually has an entry for that order's category, used to filter the stream down to just the two categories that matter — and getProcessor(category), handing back the right UnaryOperator for a given category key.",
      "The main pipeline reads as a clean sequence of everything covered across this whole section: filter() down to processable categories, groupBy(PurchaseOrder::category) to split into per-category inner fluxes, then flatMap() combined with transform() to dynamically pull and apply each group's own specific processor — attaching category-specific business logic to each inner flux entirely dynamically, based on its key.",
    ],
    code: `record PurchaseOrder(String item, String category, int price) {
    static PurchaseOrder create() {
        var commerce = Util.faker().commerce();
        return new PurchaseOrder(
            commerce.productName(),
            commerce.department(),
            Util.faker().number().numberBetween(10, 100)
        );
    }
}

public class OrderProcessingService {
    private static final Map<String, UnaryOperator<Flux<PurchaseOrder>>> PROCESSOR_MAP = Map.of(
        "kids", OrderProcessingService::kidsProcessing,
        "automotive", OrderProcessingService::automotiveProcessing
    );

    private static Flux<PurchaseOrder> automotiveProcessing(Flux<PurchaseOrder> flux) {
        return flux.map(po -> new PurchaseOrder(po.item(), po.category(), po.price() + 100));
    }

    private static Flux<PurchaseOrder> kidsProcessing(Flux<PurchaseOrder> flux) {
        return flux.flatMap(po -> getFreeKidsOrder(po).flux().startWith(po));
    }

    private static Mono<PurchaseOrder> getFreeKidsOrder(PurchaseOrder order) {
        return Mono.fromSupplier(() ->
            new PurchaseOrder(order.item() + " (free)", order.category(), 0));
    }

    public static boolean canProcess(PurchaseOrder order) {
        return PROCESSOR_MAP.containsKey(order.category());
    }

    public static UnaryOperator<Flux<PurchaseOrder>> getProcessor(String category) {
        return PROCESSOR_MAP.get(category);
    }
}

private static Flux<PurchaseOrder> orderStream() {
    return Flux.interval(Duration.ofMillis(200))
        .map(i -> PurchaseOrder.create());
}

orderStream()
    .filter(OrderProcessingService::canProcess)
    .groupBy(PurchaseOrder::category)
    .flatMap(groupedFlux -> groupedFlux.transform(
        OrderProcessingService.getProcessor(groupedFlux.key())
    ))
    .subscribe(Util.subscriber());
Util.sleepSeconds(60);
// filter down to kids/automotive only, group into two inner fluxes, then
// dynamically attach each category's own processor via transform() —
// automotive orders get +$100; kids orders get a free duplicate injected`,
  },
  {
    id: '10.12',
    title: 'Summary',
    duration: '2 min',
    kind: 'summary',
    summary: [
      "Three operators for dividing a long-running stream into manageable chunks, each suited to a different shape of requirement. buffer() collects items into a List and delivers the whole batch at once — good for genuinely batch-style processing like periodic bulk inserts. window() opens a fresh inner Flux per chunk and delivers items to it immediately as they arrive, with exactly one window ever open at a time — good for splitting one long stream into independently-processable sub-streams, like rotating log files.",
      "groupBy() opens one inner Flux per distinct key and keeps every single one open indefinitely (never automatically closing any of them), letting different categories of item each get their own tailored operator chain — but it demands genuinely low-cardinality keys, since every distinct key value means one more inner flux that stays open forever.",
    ],
    keyPoints: [
      'buffer() — accumulate into a List, deliver the whole batch at once (count- or duration-based).',
      'window() — open a fresh inner Flux per chunk, deliver items immediately; only ONE window open at a time.',
      'groupBy() — one inner Flux PER KEY, opened once and never auto-closed; requires genuinely low cardinality.',
    ],
  },
]
