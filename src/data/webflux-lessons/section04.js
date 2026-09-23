export default [
  {
    id: '4.1',
    title: 'R2DBC vs JDBC - Introduction',
    duration: '12 min',
    kind: 'theory',
    summary: [
      'This lesson introduces a performance comparison between Spring Data R2DBC (reactive) and Spring Data JPA (blocking). The instructor has prepared a separate benchmark project with two Maven modules — one using JPA and one using R2DBC — both querying the same PostgreSQL database containing a <code>customer</code> table with 10 million records. The goal is to measure two dimensions: <em>throughput</em> (how many tasks complete per unit time) and <em>resource efficiency</em> (how much CPU and memory each driver consumes).',
      'A critical point is <em>fair test design</em>. The instructor warns against common mistakes that invalidate results: chaining multiple applications together (so a slow downstream service masks driver performance), running long-running queries (which tests the database engine, not the driver), and using JMeter against a full web stack when you only want to compare the data-access layer. The benchmark isolates the data-access layer directly in <code>CommandLineRunner</code> classes, avoiding HTTP overhead entirely.',
      'The throughput test fires 100,000 <code>findById</code> lookups using <code>Flux.range(1, 100_000).flatMap(...)</code>. The reactive module uses R2DBC\'s non-blocking driver; the JPA module uses an <code>ExecutorService</code> with a thread pool sized to 256 — matching Reactor\'s default <code>flatMap</code> concurrency of 256 — to keep the comparison fair. Each test runs 10 iterations to account for JVM cold-start warmup. The efficiency test calls <code>findAll()</code> to stream all 10 million records, printing progress at every 1-million-record milestone.',
      'The project is fully reproducible via Docker Compose (which starts PostgreSQL and auto-inserts 10 million rows) and a Makefile that builds and runs each module with flags like <code>--efficiencyTest=true</code> or <code>--throughputTest=true</code>. The instructor emphasizes this is a watch-only demo — students should observe the results and can replicate or customize the benchmark after completing the course.',
    ],
    keyPoints: [
      '<strong>Isolate the variable under test</strong>: compare only the data-access drivers, not entire application chains or web layers.',
      'Avoid long-running queries for driver comparisons — those test the database engine, not the driver\'s resource efficiency.',
      'The throughput test uses <code>Flux.range(1, 100_000).flatMap(repository::findById)</code> to issue 100,000 concurrent lookups.',
      'JPA\'s blocking model requires an <code>ExecutorService</code> for concurrency; the pool is sized to 256 to match Reactor\'s default <code>flatMap</code> concurrency.',
      'Tests run 10 iterations to warm up the JVM and observe consistency, mitigating Java\'s cold-start problem.',
      'The efficiency test streams all 10 million rows via <code>findAll()</code>, printing progress every 1 million records.',
    ],
    code: `java`,
    codeLabel: 'java',
    note: {
      label: 'WHY THIS MATTERS',
      text: 'A fair benchmark must isolate the variable under test. Chaining multiple applications or adding HTTP layers introduces noise that masks the real difference between R2DBC\'s non-blocking driver and JDBC\'s thread-per-request model.',
      tone: 'accent',
    },
    quiz: {
      question: 'Why does the JPA benchmark module use a thread pool of exactly 256 for its ExecutorService?',
      options: [
        { label: '256 is the maximum number of connections PostgreSQL accepts by default', correct: false },
        { label: '256 matches Reactor\'s default flatMap concurrency, making the comparison with R2DBC fair', correct: true },
        { label: '256 is the optimal thread pool size for all JDBC applications', correct: false },
        { label: '256 is required by the JPA specification for concurrent reads', correct: false },
      ],
      explanation: 'Reactor\'s flatMap operator processes up to 256 concurrent inner publishers by default. To ensure the JPA module handles the same level of concurrency as the R2DBC module, the thread pool is sized to match this default.',
    },
  },
  {
    id: '4.2',
    title: 'Throughput and Efficiency Performance Test',
    duration: '10 min',
    kind: 'demo',
    summary: [
      'Building on the environment from the previous lesson, we run two benchmark tests to compare R2DBC and JDBC: a <em>throughput test</em> (100,000 <code>SELECT customer WHERE id = ?</code> queries) and an <em>efficiency test</em> (a single <code>SELECT * FROM customer</code> returning 10 million rows). Both modules are packaged via <code>mvn clean package</code> and executed with identical JVM memory limits to ensure a fair comparison.',
      'In the throughput test, the reactive R2DBC module consistently completes 100,000 queries in ~2 seconds (~50,000 queries/second), while the traditional JDBC module takes ~3.9 seconds (~25,000 queries/second). Enabling Java 21 virtual threads in the JDBC module does <em>not</em> improve its throughput — it still finishes in ~3.9 seconds. R2DBC achieves double the throughput using fewer database connections, demonstrating the efficiency of the reactive non-blocking driver.',
      'The efficiency test reveals a dramatic difference in memory usage. Loading all 10 million customer rows with JDBC requires 6 GB of heap; reducing to 4 GB causes a <code>java.lang.OutOfMemoryError: Java heap space</code>. The reactive R2DBC module, by contrast, streams the same 10 million rows successfully with 4 GB, then 1 GB, then 500 MB, and even 200 MB of heap. Because R2DBC streams results reactively rather than materializing the entire result set in memory, it avoids loading all rows simultaneously.',
      'The instructor acknowledges these results may seem too good to be true and promises a detailed explanation of <em>how</em> R2DBC achieves this in the next lesson.',
    ],
    keyPoints: [
      '<strong>Throughput:</strong> R2DBC processes ~50,000 queries/sec vs JDBC\'s ~25,000 queries/sec — roughly 2× faster with fewer DB connections.',
      '<strong>Virtual threads do not help JDBC throughput</strong> in this scenario — the bottleneck is the blocking I/O model, not thread scheduling overhead.',
      '<strong>Efficiency (memory):</strong> JDBC needs 6 GB heap to load 10 million rows; 4 GB causes <code>OutOfMemoryError</code>.',
      '<strong>R2DBC streams results</strong>, loading 10 million rows with as little as 200 MB heap — the entire result set is never held in memory at once.',
      'Both tests use identical JVM memory allocations and the same database state to ensure a fair comparison.',
      'The dramatic memory advantage of R2DBC stems from its reactive streaming model, explained in the next lesson.',
    ],
    code: `# Makefile targets used to run the benchmarks

# Throughput test: 100,000 SELECT-by-id queries
# Reactive R2DBC — ~2 sec, ~50,000 queries/sec
reactive-throughput-test:
	java -Xmx1000m -jar reactive/target/reactive-app.jar \
	  --throughput-test=true

# Traditional JDBC — ~3.9 sec, ~25,000 queries/sec (no virtual threads)
traditional-throughput-test:
	java -Xmx1000m -jar traditional/target/traditional-app.jar \
	  --throughput-test=true --virtual-thread-executor=false

# Traditional JDBC with virtual threads — still ~3.9 sec, no improvement
traditional-throughput-test-vt:
	java -Xmx1000m -jar traditional/target/traditional-app.jar \
	  --throughput-test=true --virtual-thread-executor=true

# Efficiency test: SELECT * FROM customer (10 million rows)
# Traditional JDBC — succeeds with 6 GB, fails with 4 GB (OutOfMemoryError)
traditional-efficiency-test-6gb:
	java -Xmx6000m -jar traditional/target/traditional-app.jar \
	  --efficiency-test=true

traditional-efficiency-test-4gb:
	java -Xmx4000m -jar traditional/target/traditional-app.jar \
	  --efficiency-test=true
# Result: java.lang.OutOfMemoryError: Java heap space

# Reactive R2DBC — succeeds with 4 GB, 1 GB, 500 MB, even 200 MB
reactive-efficiency-test-200mb:
	java -Xmx200m -jar reactive/target/reactive-app.jar \
	  --efficiency-test=true
# Result: Successfully loads all 10,000,000 rows`,
    codeLabel: 'makefile',
    note: {
      label: 'KEY INSIGHT',
      text: 'Virtual threads improve concurrency for blocking I/O but do not reduce per-request memory footprint. R2DBC\'s advantage is not just non-blocking I/O — its reactive streaming model keeps only a small window of rows in memory at any time, which is why it can load 10 million records in 200 MB while JDBC needs 6 GB.',
      tone: 'accent',
    },
    quiz: {
      question: 'Why does enabling Java 21 virtual threads in the JDBC module NOT improve its throughput in the 100,000-query test?',
      options: [
        { label: 'Virtual threads require a special JDBC driver to work correctly', correct: false },
        { label: 'The bottleneck is the blocking I/O model and connection usage, not thread scheduling overhead', correct: true },
        { label: 'Virtual threads are only compatible with R2DBC, not JDBC', correct: false },
        { label: 'The JVM memory limit of 1 GB is too low for virtual threads to activate', correct: false },
      ],
      explanation: 'Virtual threads help when the bottleneck is thread count/scheduling (e.g., many concurrent blocking calls waiting on I/O). In this throughput test, the JDBC driver still uses blocking connections and holds them for the duration of each query. The bottleneck is the blocking I/O pattern itself and connection pool limits — not the number of OS threads — so virtual threads provide no measurable improvement.',
    },
  },
  {
    id: '4.3',
    title: 'How R2DBC Works',
    duration: '5 min',
    kind: 'concept',
    summary: [
      'Building on the performance test from the previous lesson, where the traditional JDBC approach required over 4 GB of memory while the reactive R2DBC approach worked fine with just 100–200 MB, this lesson explains the fundamental architectural difference. When <code>repository.findAll()</code> is called in a traditional (JDBC) setup, the driver issues <code>SELECT * FROM customer</code> and attempts to materialize <em>all</em> 10 million rows into a single in-memory <code>List</code> before returning. If the JVM heap is insufficient, the application fails with an <code>OutOfMemoryError</code>. The reactive approach, by contrast, never tries to build a giant list.',
      'The reactive driver treats the result as a <code>Flux</code> — a pipe through which data flows, not a data structure that holds everything. As rows arrive over the database connection as a stream of bytes, the R2DBC driver decodes them into <code>Customer</code> entities incrementally and pushes them into an internal queue (typically holding a small, finite number of items — around 256 in Project Reactor\'s default <code>Flux</code> prefetch). Consumers drain items from this queue at their own processing speed.',
      'The key mechanism is <strong>backpressure</strong> — a concept from reactive programming where a slow consumer signals upstream to reduce the emission rate. Because the database connection is a TCP connection, when the reactive driver\'s internal queue fills up, the TCP receive buffer becomes full. The database detects this through TCP flow control (packet acknowledgement) and simply stops sending more data until the consumer catches up. Most major databases (PostgreSQL, Oracle, SQL Server, MongoDB) natively understand this TCP-level backpressure — it\'s the same mechanism you see when a SQL IDE like Oracle SQL Developer fetches 500 rows first and only loads more when you scroll down.',
      'The net result: the reactive approach only ever needs enough memory to hold the small bounded queue (e.g., 256 items), regardless of whether the table has 1,000 or 10 million rows. The traditional approach needs memory proportional to the total result set. This is why R2DBC is non-blocking and resource-efficient — it streams data and applies backpressure based on consumer processing speed rather than eagerly materializing everything.',
    ],
    keyPoints: [
      'Traditional JDBC <code>findAll()</code> eagerly materializes the entire result set into a <code>List</code>, requiring heap memory proportional to the number of rows.',
      'R2DBC returns a <code>Flux</code> — a stream/pipe, not a collection — so rows are decoded and delivered incrementally as they arrive.',
      'Project Reactor\'s <code>Flux</code> maintains an internal bounded queue (default prefetch ~256 items) — the memory footprint stays small and constant regardless of table size.',
      '<strong>Backpressure</strong> flows through TCP flow control: when the consumer\'s queue fills, the TCP receive buffer fills, and the database stops sending data until the consumer catches up.',
      'Most databases (PostgreSQL, Oracle, SQL Server, MongoDB) natively support TCP-level backpressure — the same mechanism IDEs use to fetch rows in batches when scrolling.',
      'R2DBC\'s efficiency comes from being non-blocking and stream-oriented: it never tries to hold all rows in memory at once.',
    ],
    code: `java`,
    codeLabel: 'java',
    note: {
      label: 'KEY INSIGHT',
      text: 'The memory difference isn\'t about R2DBC being "magic" — it\'s about eager vs. lazy materialization. JDBC builds the full list before returning; R2DBC streams rows through a bounded queue with backpressure, so memory stays constant regardless of result set size.',
      tone: 'accent',
    },
    quiz: {
      question: 'When using R2DBC to query a table with 10 million rows, why does the application memory stay small (e.g., ~200 MB) regardless of result size?',
      options: [
        { label: 'R2DBC only fetches the first 256 rows and ignores the rest', correct: false },
        { label: 'R2DBC streams rows through a bounded internal queue, and TCP backpressure tells the database to pause sending when the queue is full', correct: true },
        { label: 'R2DBC compresses the result set before loading it into memory', correct: false },
        { label: 'R2DBC executes the query in multiple small batches automatically without developer configuration', correct: false },
      ],
      explanation: 'R2DBC\'s Flux maintains a small bounded queue (e.g., 256 items). When the consumer is slow and the queue fills, the TCP receive buffer fills, which signals the database via TCP flow control to stop sending. The database resumes only when the consumer drains items. This keeps memory constant regardless of table size.',
    },
  },
  {
    id: '4.4',
    title: 'FAQ - Can I Use Spring Data JPA?',
    duration: '3 min',
    kind: 'faq',
    summary: [
      'R2DBC is still maturing — at the time of recording, features like batch insert are not yet implemented and are only on the roadmap. Before committing to R2DBC in production, you should benchmark it against your actual workload rather than relying on general claims. Pick your top 5–10 most frequent queries, replay them under realistic load using both the JDBC and R2DBC modules, and compare. Tools like New Relic, JConsole, pgAdmin, and <code>netstat</code> can help you monitor throughput, resource usage, and connection behavior.',
      'If R2DBC underperforms in your tests, you are not stuck. You can continue using Spring Data JPA inside a Spring WebFlux application — the two are compatible. The key is to avoid blocking the Netty event loop threads that WebFlux relies on. You do this by wrapping JPA repository calls in <code>Mono.fromSupplier()</code> and offloading them to a dedicated thread pool using <code>subscribeOn(Schedulers.boundedElastic())</code>.',
      '<code>Schedulers.boundedElastic()</code> is a scheduler designed specifically for wrapping blocking I/O calls within reactive pipelines. Unlike the default event-loop scheduler, it maintains a bounded thread pool that can grow and shrink, preventing unbounded thread creation while safely isolating blocking operations. By subscribing on this scheduler, the JPA call executes on a worker thread, and the event loop remains free to handle other requests. No other configuration changes are needed — your existing JPA repositories, entities, and transaction management work as-is.',
    ],
    keyPoints: [
      'R2DBC is still evolving; features like <strong>batch insert</strong> are not yet available — check the roadmap before adopting.',
      'Always benchmark R2DBC vs JDBC against your own production queries; don\'t rely on generic internet claims.',
      'Spring Data JPA <strong>can</strong> be used in WebFlux — wrap blocking calls in <code>Mono.fromSupplier()</code> and apply <code>subscribeOn(Schedulers.boundedElastic())</code>.',
      '<code>boundedElastic</code> is purpose-built for blocking I/O: it provides a capped, elastic thread pool so event-loop threads stay free.',
      'Use monitoring tools (New Relic, JConsole, pgAdmin, <code>netstat</code>) to measure real-world performance and connection usage.',
    ],
    code: `import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

@Service
public class CustomerService {

    private final CustomerRepository customerRepository; // Spring Data JPA repository

    public CustomerService(CustomerRepository customerRepository) {
        this.customerRepository = customerRepository;
    }

    // Wrapping a blocking JPA call inside a reactive pipeline.
    // subscribeOn(boundedElastic()) moves the execution to a dedicated
    // thread pool so the Netty event loop is never blocked.
    public Mono<Customer> findById(Long id) {
        return Mono.fromSupplier(() -> customerRepository.findById(id).orElseThrow())
                   .subscribeOn(Schedulers.boundedElastic());
    }

    public Mono<Customer> save(Customer customer) {
        return Mono.fromSupplier(() -> customerRepository.save(customer))
                   .subscribeOn(Schedulers.boundedElastic());
    }
}`,
    codeLabel: 'java',
    note: {
      label: 'WHEN TO USE',
      text: 'If R2DBC lacks a feature you need (e.g., batch insert) or underperforms in your benchmarks, fall back to JPA inside WebFlux using boundedElastic. This gives you the reactive web stack without abandoning the mature JPA ecosystem.',
      tone: 'accent',
    },
    quiz: {
      question: 'Why must you use subscribeOn(Schedulers.boundedElastic()) when calling a JPA repository from a WebFlux handler?',
      options: [
        { label: 'To automatically convert JPA queries into non-blocking R2DBC queries', correct: false },
        { label: 'To execute the blocking JPA call on a separate thread pool so the Netty event loop is not blocked', correct: true },
        { label: 'To enable Spring Data JPA to return Flux and Mono types natively', correct: false },
        { label: 'To reduce the number of database connections required by the application', correct: false },
      ],
      explanation: 'JPA is a blocking API. In WebFlux, the event-loop threads handle many concurrent requests, so blocking any one of them degrades overall throughput. subscribeOn(Schedulers.boundedElastic()) offloads the blocking call to a dedicated, bounded thread pool, keeping the event loop free.',
    },
  },
  {
    id: '4.5',
    title: 'Reactive Manifesto',
    duration: '3 min',
    kind: 'concept',
    summary: [
      'The Reactive Manifesto defines four interconnected principles for building systems—called <em>reactive systems</em> or <em>reactive microservices</em>—that meet modern demands for responsiveness, resilience, and scalability. The four principles are: <strong>Responsive</strong>, <strong>Resilient</strong>, <strong>Elastic</strong>, and <strong>Message-Driven</strong>. They are interdependent: if a system lacks resilience, it cannot remain responsive under failure; if it is not elastic, it cannot remain responsive under varying load.',
      '<strong>Responsive</strong> means the system reacts quickly to user input. In the throughput tests from earlier lessons, a traditional JDBC approach blocked for 10–15 seconds while collecting 10 million records, whereas the R2DBC reactive approach began streaming results within a second. This is analogous to how ChatGPT streams tokens incrementally instead of hanging until the entire response is ready.',
      '<strong>Resilient</strong> means the system stays responsive even when failures occur—failures are expected in distributed systems and are handled as signals within the reactive pipeline rather than propagating as unhandled exceptions. In Section 01, when the product service crashed, the error was contained and handled gracefully instead of cascading a 500 error to the caller. <strong>Elastic</strong> means the system stays responsive under varying workloads and resource constraints—even with limited memory (e.g., 200 MB heap), the reactive pipeline processed 10 million records without choking. <strong>Message-Driven</strong> means components communicate via asynchronous message passing with non-blocking streaming, applying backpressure when needed to avoid overwhelming consumers.',
      'Together, these principles promote architectures suited for distributed systems, cloud computing, and real-time data processing—exactly the scenarios where traditional blocking I/O models break down.',
    ],
    keyPoints: [
      'The Reactive Manifesto defines four interdependent principles: <strong>Responsive</strong>, <strong>Resilient</strong>, <strong>Elastic</strong>, and <strong>Message-Driven</strong>.',
      '<strong>Responsive</strong>: the system answers quickly—R2DBC streamed 10M records within a second vs. JDBC blocking for 10–15 seconds.',
      '<strong>Resilient</strong>: failures are treated as signals in the reactive pipeline, not cascaded as 500 errors—demonstrated in the Section 01 product service crash.',
      '<strong>Elastic</strong>: the system stays responsive under varying load and limited resources (e.g., processing 10M records with only 200 MB heap).',
      '<strong>Message-Driven</strong>: components communicate asynchronously via non-blocking streams with backpressure to regulate flow.',
    ],
    note: {
      label: 'KEY INSIGHT',
      text: 'The four Reactive Manifesto principles are not independent checkboxes—they form a dependency chain. A system that is not message-driven cannot apply backpressure; without backpressure it cannot be elastic; without elasticity and resilience it cannot remain responsive. This is why reactive programming frameworks like Project Reactor treat all four as a single cohesive design philosophy.',
      tone: 'accent',
    },
    quiz: {
      question: 'In the context of the Reactive Manifesto, why can a system that lacks resilience not be considered truly responsive?',
      options: [
        { label: 'Because resilience and responsiveness are the same principle', correct: false },
        { label: 'Because a system that crashes or cascades errors during failures cannot guarantee quick responses at all times', correct: true },
        { label: 'Because resilience only applies to database connections, not user-facing APIs', correct: false },
        { label: 'Because responsiveness requires elastic scaling, not failure handling', correct: false },
      ],
      explanation: 'Responsiveness means the system responds quickly in all conditions, including during failures. If a system is not resilient, a single component failure can cascade and cause the entire system to hang or return errors, violating the responsiveness guarantee.',
    },
  },
]
