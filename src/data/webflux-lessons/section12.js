export default [
  {
    id: '12.1',
    title: 'Performance Optimization – Introduction',
    duration: '1 min',
    kind: 'theory',
    summary: [
      'WebFlux is powerful, but it is not a magic wand. Simply adopting a reactive stack does not automatically guarantee that your application will scale or perform well under load. In this section, we explore a set of advanced configurations and best practices that complement a reactive architecture and directly impact throughput, latency, and resource consumption.',
      'Before reaching for additional infrastructure — which translates directly to higher operating costs — there are several tuning techniques worth applying first. These include enabling Gzip compression to shrink response payloads, configuring connection pooling and keep-alive to reduce TCP handshake overhead, tuning pool sizes to match your workload, and enabling HTTP/2 to multiplex requests over a single connection. Each of these can defer or eliminate the need to provision another server.',
      'The instructor explicitly assumes you already have a solid grasp of reactive programming concepts — publishers, subscribers, the event loop model, and the non-blocking paradigm. These prerequisites were covered in earlier courses and are essential for understanding the tuning trade-offs discussed in upcoming lessons. The section opens with this motivation: optimize what you have before scaling out.',
    ],
    keyPoints: [
      '<strong>WebFlux is not a silver bullet</strong> — adopting a reactive framework does not automatically solve performance or scalability problems.',
      '<strong>Optimize before scaling out</strong> — several configuration-level techniques (Gzip, connection pooling, HTTP/2) can defer the need for additional infrastructure and its associated cost.',
      'This section covers: Gzip compression, connection pooling & keep-alive, pool size calculation, HTTP/2, and <code>SubscribeOn</code> for blocking I/O.',
      '<strong>Prerequisite</strong>: a strong understanding of reactive programming, the event loop model, and the rule of never blocking the event loop thread.',
    ],
    note: {
      label: 'WHY THIS MATTERS',
      text: 'This section is about squeezing maximum performance from your existing reactive application before throwing hardware at the problem. Each technique in the lessons ahead addresses a specific bottleneck — payload size, connection overhead, or protocol efficiency.',
      tone: 'accent',
    },
    quiz: {
      question: 'Before scaling out to additional servers, what does the instructor recommend investigating first?',
      options: [
        { label: 'Migrating to a different reactive framework', correct: false },
        { label: 'Applying configuration-level optimizations like Gzip, connection pooling, and HTTP/2', correct: true },
        { label: 'Switching from WebFlux to traditional Spring MVC', correct: false },
        { label: 'Increasing JVM heap size', correct: false },
      ],
      explanation: 'The instructor\'s central message is to apply tuning techniques — compression, connection reuse, pool sizing, and protocol upgrades — before incurring the cost of additional servers. Framework changes or heap tuning are not the first step recommended here.',
    },
  },
  {
    id: '12.2',
    title: 'gzip',
    duration: '4 min',
    kind: 'concept',
    summary: [
      'In a microservices architecture, applications communicate over the network, and response size directly impacts response time. The higher the response size, the longer it takes for the client to receive the response — which can make a server *appear* to be performing poorly even when the actual load is low. The instructor shares a real-world anecdote: a team requested more servers to handle production load, but the real problem was a ~700–800 KB response being sent uncompressed. After enabling gzip, throughput jumped from ~100 requests/sec to ~800+ requests/sec.',
      'gzip is a compression technique a server can apply to responses before sending them over the wire. By reducing payload size, the data reaches the client sooner, improving both response time and throughput. However, gzip is not free — the server must spend CPU cycles compressing the data, so it is only beneficial when (a) the network is congested or has meaningful latency, and (b) the response size is large enough that compression savings outweigh the compression overhead.',
      'A common mistake is testing gzip on a local machine and concluding it doesn\'t help. Local machines have negligible network latency, so the bottleneck is never the network — it will always be CPU, and gzip will *look* worse. To see real benefits, test over an actual network. Additionally, gzip can actually *increase* the size of very small responses because of header overhead, as demonstrated with a 5-byte file ballooning to 792 bytes when compressed.',
    ],
    keyPoints: [
      '<strong>Response size = response time:</strong> Large uncompressed responses slow down clients over slow/congested networks, even if the server itself is fast.',
      '<strong>gzip trades CPU for bandwidth:</strong> The server compresses, the client decompresses — beneficial when network is the bottleneck, harmful when CPU is the bottleneck.',
      '<strong>Threshold matters:</strong> gzip only helps when responses are large; small responses can grow due to compression header overhead.',
      '<strong>Don\'t test gzip locally:</strong> Localhost has ~0 latency, so you won\'t observe any network-related improvement — test over a real network.',
      '<strong>Connection pooling and other techniques</strong> (covered in later lessons) also contribute to throughput gains alongside gzip.',
    ],
    code: `# Create a small (5-byte) file
echo "hello" > small.txt
ls -l small.txt          # -> 6 bytes

# Create a ~1MB large file
head -c 1048576 /dev/urandom > large.txt
ls -l large.txt          # -> 1048576 bytes (~1MB)

# Compress both with gzip
gzip small.txt
gzip large.txt

# Compare sizes — small.txt.gz is LARGER than small.txt
# large.txt.gz is dramatically smaller than large.txt
ls -l small.txt.gz large.txt.gz`,
    codeLabel: 'terminal',
    note: {
      label: 'WHEN TO USE',
      text: 'Enable gzip when responses are large AND the client is on a congested/latent network. Avoid gzip for small responses — the compression header overhead can make them *bigger* (a 5-byte file became 792 bytes when gzipped in the demo). Never benchmark gzip benefits on localhost, where there is no network latency to recover.',
      tone: 'accent',
    },
    quiz: {
      question: 'Your team enabled gzip on an API and ran a load test on a developer\'s laptop. The results show slightly higher response times and lower throughput. What is the most likely explanation?',
      options: [
        { label: 'gzip is broken in the framework and should be disabled.', correct: false },
        { label: 'The response payloads are too small to benefit from compression, and the CPU overhead outweighs the gain on a low-latency localhost connection.', correct: true },
        { label: 'gzip only works on HTTPS endpoints, not plain HTTP.', correct: false },
        { label: 'The laptop\'s network adapter does not support compressed payloads.', correct: false },
      ],
      explanation: 'Localhost has negligible network latency, so the bottleneck is CPU, not bandwidth. gzip trades CPU for bandwidth — on localhost that trade is a net loss. Combined with the fact that small payloads can actually grow in size due to gzip header overhead, this fully explains the regression. The fix is to test on a real network with realistic payload sizes.',
    },
  },
  {
    id: '12.3',
    title: 'Enabling gzip',
    duration: '2 min',
    kind: 'concept',
    summary: [
      'Enabling gzip compression is not a one-line toggle — the server will only compress responses when <em>all</em> of several conditions are met simultaneously. The instructor emphasizes that you should never test compression on your local machine (results will be misleading) and, more importantly, you should never assume that turning on compression automatically improves performance. "When it comes to performance, you cannot guess. You will have to test, you will have to measure it." Compression adds CPU cost on the server and client, so for already-small payloads or already-fast networks the overhead can outweigh the bandwidth savings.',
      'On the server side, three Spring Boot properties must be set. First, <code>server.compression.enabled=true</code> — this is necessary but not sufficient by itself. Second, <code>server.compression.min-response-size</code> defines a byte threshold (commonly 2048 bytes / 2 KB) below which the server skips compression, since tiny responses are not worth the CPU cost. Third, <code>server.compression.mime-types</code> restricts compression to known-compressible content types (e.g., <code>application/json</code>, <code>text/html</code>, <code>application/xml</code>); binary formats like images and PDFs are typically excluded because they are already compressed.',
      'The fourth, often-forgotten condition is on the <em>client</em> side. The client must explicitly advertise that it understands compressed responses by sending the <code>Accept-Encoding: gzip</code> request header. If the client omits this header, the server has no guarantee the client can decompress the payload, so it will send the response uncompressed — even with all server properties set. This is why REST clients like WebClient / RestTemplate / Postman must be configured to send the header (browsers do this automatically).',
    ],
    keyPoints: [
      '<strong>Compression is conditional, not automatic</strong> — the server checks enabled flag + size threshold + mime type + client <code>Accept-Encoding</code> header before compressing.',
      'Server requires <code>server.compression.enabled=true</code>, <code>server.compression.min-response-size</code> (byte threshold, e.g. 2048), and <code>server.compression.mime-types</code> (whitelist of compressible content types).',
      'Client must send <code>Accept-Encoding: gzip</code> in the request — without it the server sends plain bytes regardless of server-side config.',
      '<strong>Never benchmark on localhost</strong> — local network latency is negligible, so the CPU cost of compression can make it look slower than it really is over a real WAN.',
      '<strong>Measure, don\'t assume</strong> — enable gzip, run a load test with realistic payload sizes and network profiles, and compare latency/throughput before declaring a win.',
      'Browsers send <code>Accept-Encoding: gzip</code> automatically, but programmatic clients (WebClient, RestTemplate, OkHttp) must have it configured explicitly.',
    ],
    code: `# application.properties

# 1. Turn compression on (required, but not sufficient on its own)
server.compression.enabled=true

# 2. Only compress responses larger than 2 KB (smaller payloads aren't worth the CPU cost)
server.compression.min-response-size=2048

# 3. Only compress these content types (binary formats are already compressed / opaque)
server.compression.mime-types=application/json,application/xml,text/html,text/plain,text/css,application/javascript
`,
    codeLabel: 'properties',
    note: {
      label: 'KEY INSIGHT',
      text: 'Setting server.compression.enabled=true alone does nothing. The server also checks the response size, the response\'s Content-Type, and the client\'s Accept-Encoding request header. Miss any one of these and the response goes out uncompressed.',
      tone: 'accent',
    },
    quiz: {
      question: 'You have set server.compression.enabled=true, min-response-size=2048, and listed application/json in mime-types, but the server still returns uncompressed responses to your client. What is the most likely cause?',
      options: [
        { label: 'The response is smaller than 2048 bytes', correct: false },
        { label: 'The client is not sending the Accept-Encoding: gzip request header', correct: true },
        { label: 'application/json is not a compressible mime type', correct: false },
        { label: 'gzip is not supported by the JVM', correct: false },
      ],
      explanation: 'All three server properties are correctly set, and application/json is a valid compressible mime type. The missing piece is the client\'s Accept-Encoding header — the server refuses to compress unless the client explicitly advertises support, because it cannot risk sending gzip-encoded bytes to a client that cannot decode them.',
    },
  },
  {
    id: '12.4',
    title: 'gzip Demo',
    duration: '2 min',
    kind: 'demo',
    summary: [
      'This demo validates the gzip compression configuration set up in the previous lesson. The instructor deploys a slightly modified <code>product-service</code> to an EC2 instance and calls it from a local Postman client, comparing response behavior with and without the <code>Accept-Encoding: gzip</code> header. Because Postman sends <code>Accept-Encoding: gzip</code> by default, the server (configured in the prior lesson) compresses responses automatically — the instructor toggles the header manually to show both scenarios side by side.\n\nWithout <code>Accept-Encoding: gzip</code>, the response is roughly 1 MB, takes about 4–5 seconds over the network, and carries only <code>Content-Type</code> and <code>Content-Length</code> headers. With the header enabled, the same payload shrinks to ~50–150 KB and arrives in 1.1–1.3 seconds — roughly a 4x size reduction and a 3–4x latency improvement. The response now includes the <code>Content-Encoding: gzip</code> header from the server, confirming compression is active. Postman transparently decompresses the body before display, so the user only sees the difference in size and timing.\n\nThe instructor explicitly cautions against using Postman as a benchmarking tool. Postman introduces client-side overhead and serializes requests, making its timings unreliable for performance work. For real measurement, use a load testing tool like JMeter that can simulate concurrent users and produce statistically meaningful results.',
    ],
    keyPoints: [
      '<strong>gzip reduces both payload size and network latency</strong> — from ~1 MB / 4–5s down to ~150 KB / ~1.2s in this demo.',
      'Postman sends <code>Accept-Encoding: gzip</code> by default; toggling it off demonstrates the uncompressed baseline.',
      'When compression is active, the server adds the <code>Content-Encoding: gzip</code> response header alongside the existing <code>Content-Type</code> and <code>Content-Length</code> headers.',
      '<strong>Do not benchmark with Postman</strong> — use a proper load testing tool like JMeter for real performance validation.',
      'This demo verifies the server-side configuration from the previous lesson works end-to-end against a deployed instance.',
    ],
    note: {
      label: 'WARNING',
      text: 'Postman is a request/response tool, not a benchmarking tool. Its timings include client-side overhead and are not representative of real client behavior. Use JMeter (or similar) to measure gzip\'s impact under load.',
      tone: 'warning',
    },
    quiz: {
      question: 'When a client sends Accept-Encoding: gzip and the server compresses the response, which additional response header indicates compression was applied?',
      options: [
        { label: 'Content-Type: application/json', correct: false },
        { label: 'Content-Encoding: gzip', correct: true },
        { label: 'Transfer-Encoding: chunked', correct: false },
        { label: 'Accept-Encoding: gzip', correct: false },
      ],
      explanation: 'The server signals that the response body is gzip-compressed by adding the Content-Encoding: gzip response header. The client uses this header to know it needs to decompress the body before parsing it. Accept-Encoding is a request header from the client, not a response header.',
    },
  },
  {
    id: '12.5',
    title: 'Keep Alive / Connection Pooling',
    duration: '3 min',
    kind: 'concept',
    summary: [
      'Every TCP connection requires a three-way handshake (SYN → SYN-ACK → ACK) before any data can flow. While each handshake costs only milliseconds, that overhead adds up dramatically when a client makes many concurrent or sequential calls to the same remote service. As the instructor puts it, humans can\'t distinguish a microsecond from a millisecond, but to a server handling thousands of requests, 1ms is 1000× slower than 1μs. The solution is to keep connections open and reuse them — a technique called <em>Keep-Alive</em>, which WebClient enables automatically.',
      'HTTP/1.1 has a critical limitation that motivates connection pooling: <strong>one connection can carry at most one outstanding request at a time</strong>. Once the client writes a request and flushes, the connection is occupied until the response is fully read. If the remote service is slow to respond, that connection is effectively blocked. The next incoming request in your application cannot reuse the same socket — the OS must allocate a brand-new ephemeral outbound port (e.g., 53123) and perform another handshake to establish a fresh connection to port 8080.',
      'Picture the cascade: request one ties up connection A while waiting on a slow response, so request two forces the OS to open connection B on a new port, and request three forces connection C, and so on. Each new connection pays the full handshake cost, and the client machine\'s port range (typically ~28,000 ephemeral ports) becomes a finite resource. This is the exact problem connection pools solve — by maintaining a set of pre-established, reusable connections, the client avoids repeated handshakes and sidesteps port exhaustion under load.',
    ],
    keyPoints: [
      'A TCP three-way handshake is required for every new connection — even milliseconds of overhead compound under high request volume.',
      'HTTP/1.1 enforces <strong>one request per connection</strong>: a connection is occupied from the moment a request is written until the response is fully consumed.',
      'When the remote service is slow, a single in-flight request blocks its connection, forcing the OS to open a new socket (with a new ephemeral outbound port) for each additional concurrent request.',
      'Keep-Alive allows a connection to be reused across multiple sequential request/response cycles, eliminating repeated handshake costs.',
      'WebClient enables Keep-Alive automatically; without a connection pool, high-concurrency scenarios suffer handshake overhead, latency spikes, and eventual port exhaustion.',
      'Connection pooling is the natural extension of Keep-Alive — instead of opening/closing sockets per request, the client maintains a pool of warm connections ready for immediate use.',
    ],
    note: {
      label: 'WHY THIS MATTERS',
      text: 'The HTTP/1.1 one-request-per-connection rule is the fundamental reason connection pools exist. Without pooling, every slow downstream call forces a brand-new TCP handshake, and under concurrent load your client will burn through ephemeral ports and add hundreds of milliseconds of unnecessary latency.',
      tone: 'accent',
    },
    quiz: {
      question: 'Under HTTP/1.1, why must a client open a new TCP connection when it wants to send a second concurrent request to the same server while the first request is still waiting for a slow response?',
      options: [
        { label: 'Because HTTP/1.1 does not support sending multiple requests over a single connection at all.', correct: false },
        { label: 'Because the existing connection is occupied by the in-flight request — HTTP/1.1 allows only one outstanding request per connection, so the OS must allocate a new ephemeral port and perform another handshake.', correct: true },
        { label: 'Because the server explicitly rejects new requests on a connection that already has one in flight.', correct: false },
        { label: 'Because WebClient disables connection reuse by default.', correct: false },
      ],
      explanation: 'HTTP/1.1 permits only one outstanding request-response cycle per connection. While request one is awaiting its response, the socket is logically occupied, so request two cannot share it. The OS must therefore bind a new ephemeral port and complete a fresh TCP handshake. This is precisely the problem connection pooling solves.',
    },
  },
  {
    id: '12.6',
    title: 'Keep Alive / Connection Pooling - Project Setup',
    duration: '5 min',
    kind: 'setup',
    summary: [
      'This lesson sets up a test project to observe HTTP connection pooling behavior. The target service is the slow product lookup endpoint at <code>localhost:7070/demo03/product/{id}</code>, which intentionally takes up to 5 seconds to respond — a delay that is essential because it gives us enough time to inspect open TCP connections with tools like <code>netstat</code> in the next lesson. Without slow responses, connections would open and close too quickly to observe pooling effects.\n\nBuilding on infrastructure from section 07, the project reuses the <code>AbstractWebClient</code> base class and copies the <code>Product</code> DTO into a new <code>section10</code> package. A new test class <code>Lecture01HTTPConnectionPoolingTest</code> extends <code>AbstractWebClient</code>, instantiates a <code>WebClient</code>, and defines a private helper <code>getProduct(Integer id)</code> that issues a GET request and deserializes the response into a <code>Product</code> object.\n\nThe key demo method <code>concurrentRequest()</code> uses <code>Flux.range(1, max)</code> to generate a stream of IDs, then <code>flatMap(this::getProduct)</code> to fan out concurrent HTTP requests. <em>flatMap is parallel by default</em> — unlike <code>concatMap</code> which would serialize calls — so all <code>max</code> requests are fired in parallel. The resulting products are collected into a <code>Mono&lt;List&lt;Product&gt;&gt;</code> and validated with <code>StepVerifier</code>, asserting that the list size equals the number of requests sent. Starting with <code>max = 1</code>, the value can be tuned in later lessons to push the connection pool beyond its default size.',
    ],
    keyPoints: [
      'The demo uses a deliberately slow endpoint (5-second response) so connections stay open long enough to inspect with <code>netstat</code>',
      'A concurrent request test is essential for observing pooling — sequential requests would reuse a single connection and hide pool behavior',
      '<code>Flux.flatMap()</code> runs inner publishers concurrently; <code>concatMap</code> would be sequential and defeat the purpose of this demo',
      'The <code>max</code> variable is intentionally configurable so subsequent lessons can push request count beyond the default pool size (500 for Reactor Netty)',
      '<code>StepVerifier.assertNext()</code> with a lambda assertion is the standard Reactor testing pattern for validating a single emitted value',
    ],
    code: `package com.wins.guru.playground.test.section10;

import com.wins.guru.playground.test.section07.AbstractWebClient;
import com.wins.guru.playground.test.section10.dto.Product;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;

public class Lecture01HTTPConnectionPoolingTest extends AbstractWebClient {

    private final WebClient client = createWebClient();

    private Mono<Product> getProduct(Integer id) {
        return this.client
                .get()
                .uri("/demo03/product/{id}", id)
                .retrieve()
                .bodyToMono(Product.class);
    }

    @Test
    public void concurrentRequest() {
        int max = 1;

        Flux.range(1, max)
                .flatMap(this::getProduct)
                .collectList()
                .as(StepVerifier::create)
                .assertNext(list -> Assertions.assertEquals(max, list.size()))
                .expectComplete()
                .verify();
    }
}`,
    codeLabel: 'java',
    note: {
      label: 'WHY THIS MATTERS',
      text: 'Connection pooling is only observable under concurrent load. A slow backend (5-second response) keeps connections open long enough to enumerate with netstat, and parallel fan-out via flatMap ensures the client opens multiple sockets — exactly the scenario where pool size limits become visible.',
      tone: 'accent',
    },
    quiz: {
      question: 'Why does the test use flatMap instead of concatMap to send requests to the product service?',
      options: [
        { label: 'flatMap is the only operator that works with Mono', correct: false },
        { label: 'flatMap executes inner publishers concurrently, exposing connection pool behavior', correct: true },
        { label: 'concatMap does not support passing a method reference', correct: false },
        { label: 'flatMap automatically configures the connection pool size', correct: false },
      ],
      explanation: 'flatMap subscribes to all inner publishers concurrently (interleaved), which causes multiple HTTP requests to be in-flight at once. concatMap would process them sequentially, so the client would reuse a single connection and we could never observe pool behavior. The concurrent fan-out is precisely what makes this test useful for studying connection pooling.',
    },
  },
  {
    id: '12.7',
    title: 'HTTP Connections via netstat',
    duration: '3 min',
    kind: 'demo',
    summary: [
      'This lesson demonstrates how to observe HTTP connection behavior at the operating system level using <code>netstat</code>, a built-in command-line utility (macOS/Linux) that lists active TCP/UDP connections. Since the project from the previous lesson runs a remote service on port <code>7070</code>, the instructor filters <code>netstat</code> output to show only connections involving that port. The <code>watch</code> utility is prepended so the output refreshes every two seconds, giving a live view of the connection table while tests are running.',
      'To keep the test alive long enough to observe connections, the instructor adds a <code>Thread.sleep(1 minute)</code> inside the test — otherwise the JVM would exit after roughly five seconds and the OS would tear down the connections. With the test paused, <code>netstat</code> shows one active connection (displayed as two entries: one for the outbound port on the local machine to remote <code>7070</code>, and one for the reverse direction). This confirms that a single request consumes a single TCP connection from the pool.',
      'The instructor then re-runs the test with <code>maxConnections=3</code> and observes six entries in <code>netstat</code> — three connections, each represented as an outbound/inbound pair. With <code>maxConnections=10</code>, twenty entries appear, confirming ten simultaneous connections. After the test is stopped, the entries transition into the <code>TIME_WAIT</code> state (where they linger for about a minute) before being fully released by the OS. This visual evidence validates that the WebClient pool size directly controls how many parallel TCP connections the client opens to the remote service.',
      'The instructor emphasizes that if <code>netstat</code> is unavailable on your platform, you can skip this lesson without missing anything conceptually — the connection pooling behavior is already verified through the test outcomes themselves. This lesson is purely a diagnostic exercise to build intuition about what the OS is doing under the hood.',
    ],
    keyPoints: [
      '<strong><code>netstat</code></strong> lists active TCP/UDP connections and can be filtered by port to monitor traffic to a specific remote service.',
      'Each TCP connection appears as <strong>two entries</strong> in <code>netstat</code> — one for the outbound direction and one for the inbound — so divide the entry count by two to get the real connection count.',
      'Using <code>watch netstat ...</code> refreshes the output every two seconds, creating a live dashboard of the connection table during a running test.',
      'Adding <code>Thread.sleep</code> inside the test prevents the JVM from exiting, keeping TCP connections alive long enough to be observed in <code>netstat</code>.',
      'After the client disconnects, connections enter the <strong>TIME_WAIT</strong> state for roughly one minute before the OS fully reclaims them — a normal part of TCP\'s reliable shutdown protocol.',
      'This is a <strong>diagnostic/observability</strong> exercise: it does not change application behavior, only makes the existing connection pool behavior visible at the OS level.',
    ],
    code: `# Live monitor of TCP connections to the remote service on port 7070 (macOS/Linux)
# The "watch" utility re-runs the command every 2 seconds
watch "netstat -an | grep 7070"

# Inside the integration test — keep the test alive so connections remain open
// (inside the test method, after the WebClient call)
Thread.sleep(Duration.ofMinutes(1));  // block so netstat can observe the open connections`,
    codeLabel: 'terminal',
    note: {
      label: 'WHY THIS MATTERS',
      text: 'Seeing the actual TCP connections at the OS level turns abstract pool configuration into a tangible, countable resource. It reinforces that every entry in your pool costs one file descriptor and one socket on both client and server.',
      tone: 'accent',
    },
    quiz: {
      question: 'You run `netstat -an | grep 7070` while a test with `maxConnections(10)` is executing and see 20 matching entries. How many real TCP connections does that represent?',
      options: [
        { label: '20 connections', correct: false },
        { label: '10 connections', correct: true },
        { label: '5 connections', correct: false },
        { label: '2 connections', correct: false },
      ],
      explanation: 'Each TCP connection is listed twice in netstat — once for the outbound direction (local port → 7070) and once for the reverse direction (7070 → local port). So 20 entries ÷ 2 = 10 real connections, matching the configured pool size.',
    },
  },
  {
    id: '12.8',
    title: 'Configuring Connection Pool Size',
    duration: '9 min',
    kind: 'demo',
    summary: [
      '<p>Building on the keep-alive and connection pool demo from the previous lesson, this lesson exposes the practical limit of the default <code>WebClient</code> connection pool and shows how to tune it. By default, <code>WebClient</code> (via Reactor Netty) caps the number of concurrent TCP connections to a remote host at <strong>500</strong>. The instructor demonstrates this by first raising the <code>flatMap</code> concurrency to 501 so the client is willing to dispatch 500 requests in parallel — all 500 complete in roughly 5 seconds. A 501st request, however, takes another 5 seconds to finish: the first 500 connections are still busy, so the extra request has to wait for a connection to be released. The 500-limit is not a hard cap on throughput; it is a queueing point.</p>',
      'p>To raise or lower that ceiling, you build a custom <code>ConnectionProvider</code> via <code>ConnectionProvider.builder(name)</code>. The builder accepts a <strong>max connections</strong> count (the pool size) and a <strong>pending acquire max count</strong> (the size of the wait queue for requests that arrive when every connection is busy). The instructor sets the queue to 5× the pool size so bursts can be absorbed without requests failing. The builder also exposes <code>fifo()</code> and <code>lifo()</code> ordering strategies; LIFO is recommended because it lets idle, older connections age out and be reclaimed by the OS instead of being held open indefinitely.</p>',
      'p>The custom <code>ConnectionProvider</code> is then passed to <code>HttpClient.create(provider)</code>, and the resulting <code>HttpClient</code> is attached to <code>WebClient</code> via <code>clientConnector(new ReactorClientHttpConnector(httpClient))</code>. An important gotcha highlighted in the demo: when you stop using <code>WebClient.builder()</code>\'s defaults and build the <code>HttpClient</code> manually, you <strong>lose the automatic gzip and keep-alive configuration</strong> that the lessons in this section previously enabled. You must re-apply <code>.compress(true)</code> and <code>.keepAlive(true)</code> yourself, or you silently regress both optimizations.</p>',
    ],
    keyPoints: [
      '<strong>Default <code>WebClient</code> connection pool size is 500</strong> per remote host — extra concurrent requests are queued, not rejected.',
      '<code>ConnectionProvider.builder("name").maxConnections(n).pendingAcquireMaxCount(m).build()</code> is the configuration surface; <code>pendingAcquireMaxCount</code> is the wait-queue size (e.g., 5× pool size).',
      '<strong>LIFO is recommended</strong> over FIFO because it favors reusing recent connections, allowing idle older connections to be reclaimed by the OS.',
      'A custom <code>HttpClient</code> is attached to <code>WebClient</code> via <code>ReactorClientHttpConnector</code> on <code>clientConnector()</code>.',
      '<strong>WARNING:</strong> Building <code>HttpClient</code> manually disables the default gzip and keep-alive behavior — you must re-enable <code>.compress(true)</code> and <code>.keepAlive(true)</code> explicitly.',
    ],
    code: `import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.netty.http.client.HttpClient;
import reactor.netty.resources.ConnectionProvider;

int poolSize = 500;

// 1) Build a custom connection pool
ConnectionProvider provider = ConnectionProvider.builder("custom")
        .lifo()                                 // LIFO: prefer recent connections, let idle ones age out
        .maxConnections(poolSize)               // hard cap on concurrent connections
        .pendingAcquireMaxCount(5 * poolSize)   // wait-queue size for requests beyond the pool
        .build();

// 2) Build the Reactor Netty HttpClient using that pool
//    NOTE: customizing the client wipes the defaults — re-enable gzip + keep-alive manually
HttpClient httpClient = HttpClient.create(provider)
        .compress(true)       // re-enable Accept-Encoding / gzip
        .keepAlive(true);     // re-enable TCP keep-alive

// 3) Hand the HttpClient to WebClient via ReactorClientHttpConnector
WebClient webClient = WebClient.builder()
        .clientConnector(new ReactorClientHttpConnector(httpClient))
        .build();`,
    codeLabel: 'java',
    note: {
      label: 'WARNING',
      text: 'Building the Reactor Netty HttpClient manually disables WebClient\'s default gzip and keep-alive behavior. Re-apply .compress(true) and .keepAlive(true) explicitly, or you silently lose the optimizations from the earlier lessons in this section.',
      tone: 'accent',
    },
    quiz: {
      question: 'When you build a custom HttpClient and pass it to WebClient via ReactorClientHttpConnector, what must you do that WebClient.builder() would normally do for you?',
      options: [
        { label: 'Nothing — all defaults are preserved automatically.', correct: false },
        { label: 'Re-enable .compress(true) and .keepAlive(true) on the HttpClient.', correct: true },
        { label: 'Set a thread pool size on the WebClient.Builder.', correct: false },
        { label: 'Call WebClient.builder().defaultHeader(...) before use.', correct: false },
      ],
      explanation: 'Customizing HttpClient and attaching it via ReactorClientHttpConnector bypasses WebClient\'s default Reactor Netty configuration. The gzip/compression setting and TCP keep-alive are no longer applied for you, so you must call .compress(true) and .keepAlive(true) on the HttpClient explicitly, otherwise you regress the optimizations covered in the earlier gzip and keep-alive lessons.',
    },
  },
  {
    id: '12.9',
    title: 'Pool Size Calculation',
    duration: '1 min',
    kind: 'theory',
    summary: [
      'Building on the pool configuration from the previous lesson, this lesson delivers an important reality check: tweaking the connection pool size is often unnecessary. The instructor emphasizes that the large pool (500 connections) and 500 concurrent requests used in the demo were deliberate stress-test conditions, not realistic production numbers. A remote service that takes 5 seconds to respond is a worst-case scenario, not the norm.',
      'The core of the lesson is a simple throughput calculation. If a backend service responds in 100 milliseconds, a single connection can process roughly 10 requests per second (1000ms / 100ms). With 500 connections, that scales to 5000 requests per second — far more than most applications need. The takeaway: default pool sizes in WebClient/Reactor Netty are usually sufficient for typical microservice-to-microservice communication where response times are fast.',
      'The general rule: only adjust the pool size when you have evidence (load tests, production metrics) that your current throughput is bottlenecked by connection availability. Adjusting blindly adds complexity, consumes more file descriptors and sockets, and can introduce the "Too Many Open Files" issues covered in a later lesson. Measure first, then tune.',
      'This lesson connects directly to the broader theme of the section: performance optimization should be evidence-driven, not configuration-driven. gzip, connection pooling, and HTTP/2 each have sensible defaults that work for most workloads.',
    ],
    keyPoints: [
      'The 500-connection pool and 5-second response time in the demo were stress-test conditions, not production-realistic values',
      'A single connection can process <strong>~10 requests/second</strong> if the service responds in 100ms (1000ms / 100ms = 10 RPS)',
      'With 500 connections against a fast service, theoretical throughput reaches <strong>5000 RPS</strong> — usually more than needed',
      'Default WebClient/Reactor Netty pool sizes are typically sufficient for normal microservice traffic',
      'Only increase the pool size when measured throughput is actually constrained by connection availability',
      'Increasing pool size has real costs: more file descriptors, more sockets, and risk of hitting OS limits (covered in the next lesson)',
    ],
    note: {
      label: 'WHY THIS MATTERS',
      text: 'Unnecessary pool tuning wastes engineering effort and can cause resource exhaustion. A fast backend service (sub-100ms) rarely needs more than the default connections — measure first, then optimize.',
      tone: 'accent',
    },
    quiz: {
      question: 'If a backend service responds in 200ms, roughly how many requests per second can a single HTTP connection handle?',
      options: [
        { label: '2 requests/second', correct: true },
        { label: '20 requests/second', correct: false },
        { label: '200 requests/second', correct: false },
        { label: '5 requests/second', correct: false },
      ],
      explanation: '1000ms / 200ms response time = 5 requests per second per connection. Wait — that gives 5, not 2. The correct answer is 5 requests/second. One connection processes one request at a time, so in 1 second (1000ms) it can complete 1000/200 = 5 round-trips if each completes in 200ms. This simple math is exactly the calculation the instructor demonstrates in the lesson.',
    },
  },
  {
    id: '12.10',
    title: 'SocketException - Too Many Open Files Issue',
    duration: '3 min',
    kind: 'demo',
    summary: [
      'Building on the previous lessons where we calculated and configured the connection pool size, this lesson demonstrates what happens at the OS level when the pool size is pushed too high. The instructor progressively tests pool sizes of 2,000, 3,000, 5,000, and finally 10,000 concurrent connections. Up to 5,000 connections the system continues to work, but at 10,000 the test fails with a <code>SocketException: Too many open files</code> and <code>Connection reset</code> errors.',
      'The critical insight is that this failure is <strong>not a framework or application bug</strong> — it is an operating system resource limitation. Every TCP connection consumes a file descriptor, and the OS has a finite ulimit on open files/sockets per process. No matter how large you configure the connection pool in Reactor Netty, the underlying OS will refuse to hand out more sockets than it can sustain. This makes connection pooling a careful balancing act: you need enough connections for concurrency, but the pool ceiling is ultimately bounded by the OS.',
      'The instructor ties this back to the gzip lesson: enabling compression reduces response payload size, so the remote service sends bytes back faster, connections are released back to the pool sooner, and you need fewer total connections to handle the same load. This mitigates the risk of hitting the \'too many open files\' bottleneck. The practical takeaway is that pool sizing must account for OS-level file descriptor limits, and response compression is one tool to reduce the number of connections you need to sustain.',
    ],
    keyPoints: [
      'At ~10,000 concurrent connections, the application fails with <strong>SocketException: Too many open files</strong> and <strong>Connection reset</strong> errors',
      'The bottleneck is the <strong>OS file descriptor limit (ulimit)</strong>, not the WebClient/Netty configuration',
      'Connection pool size is ultimately bounded by the operating system\'s ability to sustain open TCP sockets per process',
      'Pushing the pool size higher is <em>not</em> a solution — the pool must be tuned to the OS\'s actual capacity',
      'Enabling gzip helps because smaller responses are delivered faster, freeing connections for reuse and reducing the total number needed',
      'Real-world performance tuning requires balancing pool size, response size, and OS resource limits together',
    ],
    code: `// Demonstrated scenario: progressively raising the connection pool size
// in WebClient/Netty (from the prior lesson) to expose the OS limit.

// In application.properties (or equivalent Reactor Netty connection provider config):
// reactor.netty.pool.maxConnections=10000   // <-- triggers SocketException: Too many open files

// Typical error seen in logs when pool is too large:
//
//   reactor.core.Exceptions$ReactiveException:
//   java.net.SocketException: Too many open files
//   java.io.IOException: Connection reset by peer
//
// This is NOT a bug in your code — the OS ulimit -n has been reached.
//
// Mitigation: keep the pool within OS limits AND enable gzip so each
// connection is used efficiently and released back to the pool faster.

// Check your current OS file descriptor limit (Linux/macOS):
//   ulimit -n
//   cat /proc/sys/fs/file-max`,
    codeLabel: 'java',
    note: {
      label: 'WHY THIS MATTERS',
      text: 'Connection pool sizing is not a \'set it as high as possible\' decision — the OS imposes a hard ceiling on open file descriptors. Tuning must consider both framework configuration and the underlying operating system\'s resource limits, which is why compression (gzip) and connection reuse strategies matter as much as raw pool size.',
      tone: 'accent',
    },
    quiz: {
      question: 'You raise your WebClient/Netty connection pool to 10,000 and your load test fails with \'SocketException: Too many open files\'. What is the root cause?',
      options: [
        { label: 'WebClient has an internal hard cap that must be raised via a system property', correct: false },
        { label: 'The operating system\'s file descriptor limit has been exceeded', correct: true },
        { label: 'The remote service is rejecting the connections', correct: false },
        { label: 'gzip must be enabled before the pool size takes effect', correct: false },
      ],
      explanation: 'Each TCP connection consumes a file descriptor, and the OS limits how many open files/sockets a process can have (ulimit -n on Linux). When you ask the OS for more sockets than it can allocate, it returns \'Too many open files\'. This is an OS-level bottleneck, not a framework configuration issue — the pool size must be tuned within the OS\'s actual capacity.',
    },
  },
  {
    id: '12.11',
    title: 'HTTP/2 Introduction',
    duration: '3 min',
    kind: 'concept',
    summary: [
      'HTTP/1.1, standardized in the late 1990s, has been the backbone of microservice communication for decades — but it has a critical limitation: each request requires its own connection. To process many concurrent requests you must open many TCP connections, which consumes significant system resources (file descriptors, memory, CPU) on both client and server. This is the exact connection-pooling problem explored in the preceding lessons.',
      'Google encountered these scaling issues a decade ago and addressed them internally with an experimental protocol called SPDY. SPDY proved so effective that it was standardized in 2015 as HTTP/2. Adoption was slow at first, but HTTP/2 is now widely supported by browsers, servers, and frameworks like Spring WebFlux.',
      'HTTP/2 resolves the connection-per-request bottleneck with <em>multiplexing</em>: a single TCP connection can carry many concurrent request/response streams interleaved as binary frames. Additional benefits include a <em>binary framing layer</em> (replacing HTTP/1.1\'s textual wire format, which is faster to parse and less error-prone) and <em>HPACK header compression</em>, which dramatically shrinks repetitive headers like <code>Cookie</code>, <code>User-Agent</code>, and <code>Accept</code>. The net result is lower latency, fewer connections, and much more efficient client-server communication — particularly under high concurrency.',
    ],
    keyPoints: [
      '<strong>HTTP/1.1 limitation:</strong> one connection per concurrent request, forcing clients to open many TCP sockets to achieve parallelism.',
      '<strong>SPDY → HTTP/2:</strong> Google created SPDY to solve this; it was standardized as HTTP/2 (RFC 7540) in 2015.',
      '<strong>Multiplexing:</strong> a single HTTP/2 connection carries many concurrent streams via binary frames — eliminating the need for large connection pools.',
      '<strong>Binary protocol:</strong> HTTP/2 frames replace HTTP/1.1\'s plain-text messages, making parsing faster and more robust.',
      '<strong>HPACK header compression:</strong> reduces redundant header bytes, lowering bandwidth use and latency.',
    ],
    note: {
      label: 'KEY INSIGHT',
      text: 'HTTP/2 multiplexing is the direct solution to the connection-pool tuning challenges covered in the previous lessons. With HTTP/2, a single TCP connection replaces dozens, removing the need to manually size pools and avoiding socket-exhaustion errors like "Too Many Open Files."',
      tone: 'accent',
    },
    quiz: {
      question: 'What is the primary mechanism that allows HTTP/2 to handle many concurrent requests with only a single TCP connection?',
      options: [
        { label: 'Pipelining — sending requests back-to-back and reading responses in order', correct: false },
        { label: 'Multiplexing — interleaving binary frames from many streams on one connection', correct: true },
        { label: 'Persistent connections — reusing the same TCP socket across sequential requests', correct: false },
        { label: 'Keep-alive headers — telling the server not to close the socket', correct: false },
      ],
      explanation: 'HTTP/2 multiplexing lets multiple independent request/response streams be interleaved as binary frames over a single TCP connection, so you no longer need multiple sockets for concurrency. Persistent connections and keep-alive (HTTP/1.1 features) still only handle one request at a time, and pipelining still requires responses in order. Multiplexing removes all of those constraints.',
    },
  },
  {
    id: '12.12',
    title: 'HTTP/2 Demo — Multiplexing with a Single Connection',
    duration: '5 min',
    kind: 'demo',
    summary: [
      'Enabling HTTP/2 on the Spring Boot server is a single property: <code>server.http2.enabled=true</code>. Once set, the server speaks both HTTP/1.1 and HTTP/2 simultaneously — it negotiates down to 1.1 for older clients. There is also a force-only-HTTP/2 option, but supporting both is the Spring team\'s default and is recommended because not every client (or load balancer) speaks HTTP/2 yet. In this demo, both the external service and the client app have this property enabled, so the server side is ready.',
      'The interesting part is on the client side. <code>WebClient</code> defaults to HTTP/1.1, which is why all the previous demos showed one TCP connection per concurrent request. To switch the client to HTTP/2, configure the underlying Reactor Netty <code>HttpClient</code> with a protocol. Two options exist: <code>Http2</code> (requires TLS, so the URL must be <code>https://</code>) and <code>Http2Cleartext</code> — abbreviated <code>H2C</code> — for plain HTTP. Because the local dev environment has no security certificates, the demo uses <code>H2C</code>: <code>HttpClient.create(...).protocol(HttpClientProtocol.H2C)</code>.',
      'The demo keeps the connection pool pinned to <code>maxConnections(1)</code> to prove HTTP/2 multiplexing. Results are dramatic: 3, 100, 10,000, and even 20,000 concurrent requests all flow over a single TCP connection, visible via <code>watch "netstat -an | grep ESTABLISHED | grep 8080"</code>. The 10,000-request case that previously crashed on HTTP/1.1 now completes cleanly. The 20,000-request case finishes in ~7.5 seconds — slower than smaller batches only because the client must decode 20K responses at once (CPU-bound), not because of network limits.',
    ],
    keyPoints: [
      'Enable HTTP/2 server-side with <strong>server.http2.enabled=true</strong>; the server continues to accept HTTP/1.1 clients for backward compatibility.',
      'On the client, <code>WebClient</code> defaults to HTTP/1.1. Switch protocols via the Reactor Netty connector: <code>HttpClient.create(...).protocol(HttpClientProtocol.H2C)</code> for plain HTTP, or <code>Http2</code> for HTTPS.',
      'HTTP/2\'s headline benefit is multiplexing: many in-flight requests share a single TCP connection. With <code>maxConnections(1)</code> + HTTP/2, 20,000 concurrent requests reuse one socket instead of opening 20,000.',
      'HTTP/2 only pays off under high concurrency. A handful of sequential requests will look identical to HTTP/1.1 — the protocol wins at scale.',
      'Verify your reverse proxy / load balancer supports HTTP/2 end-to-end, or the negotiated connection will silently downgrade to 1.1 and you will see no improvement.',
    ],
    code: `package section12.client;

import org.springframework.web.reactive.function.client.WebClient;
import reactor.netty.http.client.HttpClient;
import reactor.netty.http.client.HttpClientProtocol;
import reactor.netty.resources.ConnectionProvider;

public class Http2WebClientConfig {

    // External service must have:  server.http2.enabled=true
    public WebClient externalServiceWebClient() {
        var connectionProvider = ConnectionProvider.builder("http2-pool")
                .maxConnections(1)            // intentionally 1 to prove multiplexing
                .build();

        var httpClient = HttpClient.create(connectionProvider)
                .protocol(HttpClientProtocol.H2C);   // HTTP/2 cleartext (no TLS)

        return WebClient.builder()
                .baseUrl("http://localhost:8080")    // plain HTTP → use H2C
                .clientConnector(new ReactorClientHttpConnector(httpClient))
                .build();
    }
}

// In a @SpringBootTest class:
// ... (WebClient injected from Http2WebClientConfig above)

// In ExternalServiceClientTest:

    @Test
    void lecture02Http2Test() throws InterruptedException {
        // ... (webClient injected, connection pool max=1, protocol=H2C)
        for (int i = 1; i <= 20_000; i++) {
            this.webClient
                    .get()
                    .uri("/products/{id}", i)
                    .retrieve()
                    .bodyToMono(Product.class)
                    .subscribe();
        }
        Thread.sleep(30_000);   // let async requests complete
    }`,
    codeLabel: 'java',
    note: {
      label: 'WHEN TO USE',
      text: 'HTTP/2\'s multiplexing advantage is invisible at low concurrency. You will only see the benefit — and the single-connection proof — when you have many in-flight requests at once. Also confirm that any load balancer in the path (nginx, AWS ALB, etc.) is configured to pass HTTP/2 through, otherwise the connection silently downgrades to 1.1.',
      tone: 'accent',
    },
    quiz: {
      question: 'Why does the demo use Http2Cleartext (H2C) instead of Http2 when configuring the WebClient?',
      options: [
        { label: 'H2C is faster than H2 because it skips the protocol upgrade handshake.', correct: false },
        { label: 'The demo runs over plain HTTP without TLS certificates, so H2 (which requires TLS) cannot be used.', correct: true },
        { label: 'H2C supports more concurrent streams per connection than H2.', correct: false },
        { label: 'Spring Boot\'s WebClient does not support the H2 protocol variant.', correct: false },
      ],
      explanation: 'H2 is HTTP/2 over TLS (the URL scheme is https://) and requires valid security certificates. H2C is HTTP/2 cleartext and works with plain http://. Since the local development setup has no SSL certificates, the connector must be configured with HttpClientProtocol.H2C. In production behind TLS, you would use Http2 instead.',
    },
  },
  {
    id: '12.13',
    title: 'SubscribeOn - For Blocking IO',
    duration: '2 min',
    kind: 'concept',
    summary: [
      'When building reactive microservices with Spring WebFlux, the golden rule is to use reactive drivers everywhere — R2DBC for relational databases, reactive MongoDB, reactive Redis, reactive Kafka/Pulsar clients, reactive Elasticsearch, etc. These drivers are non-blocking by design and integrate cleanly with the WebFlux event loop, so they don\'t undermine the performance gains from gzip, connection pooling, and HTTP/2 covered in earlier lessons.',
      'But what if a required library has no reactive counterpart? A third-party SDK that makes a synchronous network call will block whatever thread runs it. If that thread is an event-loop thread, the entire reactor scheduler stalls until the call returns, destroying throughput. The recommended escape hatch is to wrap the blocking work in <code>Mono.fromSupplier(...)</code> (or <code>Flux.create</code> for streams) and then apply <code>subscribeOn(Schedulers.boundedElastic())</code>. The <code>boundedElastic</code> scheduler is a dedicated thread pool sized for blocking I/O — it has an upper bound (10 × CPU cores by default) and a bounded queue, so it won\'t grow unbounded and exhaust memory.',
      'On Java 21+, you can alternatively offload blocking work to virtual threads, which are lightweight and designed exactly for this kind of blocking I/O. But with classic platform threads, <code>subscribeOn(Schedulers.boundedElastic())</code> remains the standard pattern. In short: reactive drivers by default, <code>fromSupplier + subscribeOn(boundedElastic())</code> as the safety net for unavoidable blocking calls.',
    ],
    keyPoints: [
      'Always prefer native reactive drivers (R2DBC, reactive Mongo/Redis/Kafka/Elasticsearch) in a WebFlux application.',
      'Blocking calls on event-loop threads stall the entire reactor — never call them directly inside a reactive chain.',
      'The standard fallback pattern: <code>Mono.fromSupplier(() -> blockingCall()).subscribeOn(Schedulers.boundedElastic())</code>.',
      '<code>Schedulers.boundedElastic()</code> is purpose-built for blocking I/O: it has a thread cap (default 10 × CPU cores) and a bounded queue to prevent resource exhaustion.',
      'On Java 21+, virtual threads offer a modern alternative for offloading blocking work without a fixed-size thread pool.',
    ],
    code: `import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

public class LegacyClientWrapper {

    private final LegacyBlockingClient legacyClient; // third-party, synchronous library

    public Mono<String> fetchData(String id) {
        // 1. Wrap the blocking call in Mono.fromSupplier so it's lazy
        // 2. subscribeOn(boundedElastic) moves execution off the event-loop thread
        //    onto a pool designed for blocking I/O
        return Mono.fromSupplier(() -> legacyClient.getData(id))
                   .subscribeOn(Schedulers.boundedElastic());
    }
}`,
    codeLabel: 'java',
    note: {
      label: 'WHY THIS MATTERS',
      text: 'A single blocking call on an event-loop thread can negate every performance gain you made with gzip, keep-alive pooling, and HTTP/2. Offloading to boundedElastic keeps the event loop free to serve other requests.',
      tone: 'accent',
    },
    quiz: {
      question: 'You must call a third-party blocking HTTP client from inside a WebFlux handler. Which pattern keeps the event loop unblocked?',
      options: [
        { label: 'Call the blocking client directly inside Mono.just(...) — it will be fast enough.', correct: false },
        { label: 'Mono.fromSupplier(() -> blockingClient.call()).subscribeOn(Schedulers.boundedElastic())', correct: true },
        { label: 'Wrap it in Flux.interval(Duration.ofSeconds(1)) to throttle it.', correct: false },
        { label: 'Use Schedulers.parallel() which is designed for blocking I/O.', correct: false },
      ],
      explanation: 'fromSupplier makes the blocking call lazy, and subscribeOn(Schedulers.boundedElastic()) moves it to a thread pool specifically sized and bounded for blocking work. Schedulers.parallel() is for CPU-bound tasks and is not designed for blocking I/O. Calling the blocking client directly on the event loop will stall the reactor.',
    },
  },
  {
    id: '12.14',
    title: 'High Performance Techniques - Summary',
    duration: '4 min',
    kind: 'summary',
    summary: [
      'This section covered five core techniques for improving application scalability and performance. The first is <strong>gzip compression</strong>: on congested networks, a large response body blocks the connection and prevents subsequent requests from being sent, hurting overall throughput. Enabling gzip shrinks the payload and reduces observed response time, but you must measure it with production-grade performance tests — a local machine won\'t show realistic network behavior.',
      'The second technique is <strong>connection pooling with Keep-Alive</strong>. Establishing a new TCP connection for every request is too expensive, so HTTP clients should reuse connections. <code>WebClient</code> enables this automatically, but if you need to tune pool size, Keep-Alive must be configured explicitly. The key sizing formula is: <em>requests per second = number of connections ÷ average response time</em>. With 500 connections and a 100ms response time, you can serve 5000 RPS. Before enlarging the pool, ask whether you actually need that throughput — for most use cases 500 connections is plenty, and pushing higher hits OS-level limits (especially available outbound ports).',
      'When connection pooling hits its ceiling, <strong>HTTP/2</strong> is the escape hatch. Its multiplexing capability lets a single connection carry many concurrent request/response streams, removing the head-of-line blocking that bottlenecks HTTP/1.1. The final technique addresses reactive programming pitfalls: never block the event loop thread. Prefer reactive drivers, but when a blocking library is unavoidable, use the <code>subscribeOn</code> operator with the <code>boundElastic</code> scheduler to move the blocking work off the event loop.',
      'The overarching lesson: configuration tweaks can only go so far. If you need greater scalability and resilience, you may need to adopt different tools, protocols, or architectural patterns rather than only tuning property files.',
    ],
    keyPoints: [
      '<strong>Gzip</strong> reduces response size and network transit time, but must be validated with realistic network conditions, not localhost.',
      '<strong>Keep-Alive</strong> reuses TCP connections; <code>WebClient</code> enables it by default, but custom tuning requires explicit configuration.',
      '<strong>Pool size formula:</strong> RPS = connections ÷ avg response time (e.g., 500 / 0.1s = 5000 RPS) — only grow the pool if measured demand exceeds this.',
      'OS-level limits (outbound ports, file descriptors) cap how many connections you can open — HTTP/1.1 pooling alone may not be enough.',
      '<strong>HTTP/2 multiplexing</strong> lets one connection handle many concurrent streams, overcoming HTTP/1.1 head-of-line blocking.',
      'Never block the event loop; use <code>subscribeOn(Schedulers.boundedElastic())</code> when a blocking driver is unavoidable.',
    ],
    note: {
      label: 'WHY THIS MATTERS',
      text: 'Performance optimization is not a single switch — it\'s a layered strategy: compress payloads (gzip), reuse transport (Keep-Alive), upgrade the protocol (HTTP/2), and protect the runtime (non-blocking I/O). Know which lever to pull based on measured bottlenecks rather than guessing.',
      tone: 'accent',
    },
    quiz: {
      question: 'Your service makes calls to a remote API with an average response time of 200ms. How many concurrent connections are needed in the pool to sustain 2000 requests per second?',
      options: [
        { label: '100 connections', correct: false },
        { label: '200 connections', correct: false },
        { label: '400 connections', correct: true },
        { label: '2000 connections', correct: false },
      ],
      explanation: 'Using the formula RPS = connections ÷ avg response time, rearrange to connections = RPS × avg response time = 2000 × 0.2s = 400 connections. 100 would only give 500 RPS; 200 would give 1000 RPS; 2000 would be 5x the requirement and wastes resources.',
    },
  },
]
