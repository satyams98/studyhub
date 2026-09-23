export default [
  {
    id: '9.1',
    title: 'WebClient - Introduction',
    duration: '5 min',
    kind: 'theory',
    summary: [
      '<code>WebClient</code> is Spring\'s non-blocking, reactive HTTP client — essentially a reactive replacement for <code>RestTemplate</code>. It is built on top of Reactor Netty (the same HTTP client engine used throughout reactive Spring), meaning every request and response flows through the reactive pipeline without blocking any thread. Once a <code>WebClient</code> instance is built, it is both <em>immutable</em> and <em>thread-safe</em>, so a single instance can be safely shared across multiple services and threads.',
      'The recommended pattern is to create one <code>WebClient</code> bean per external service dependency, configured with a base URL. For example, if your application talks to a product service and a payment service, you would configure two separate <code>WebClient</code> beans — each with its own base URL, default headers, and timeout settings. These beans are then injected into service classes wherever HTTP calls are needed. If you ever need to modify an already-built client (e.g., change the base URL or add a filter), you call <code>mutate()</code> on the existing instance to get a new builder, make your changes, and call <code>build()</code> to produce a new immutable client.',
      'Making requests follows a fluent builder API. For a GET, you call <code>client.get().uri("/products/1").retrieve()</code> — the path is appended to the configured base URL automatically. The <code>retrieve()</code> method triggers the actual HTTP exchange in a non-blocking fashion. You then decode the response body using <code>bodyToMono()</code> (for a single object) or <code>bodyToFlux()</code> (for a stream of objects). For POST requests, you use <code>client.post().uri(...).bodyValue(product).retrieve()</code>, where <code>bodyValue()</code> serializes an in-memory object as the request body. Beyond the <code>retrieve()</code> call, everything is standard Reactor — map, flatMap, and other operators compose the pipeline as usual.',
      'Throughout this section, the lessons will interact with an external demo service running on <code>localhost:7070</code>. This is the same standalone JAR used in the first section of the course. The demo service exposes a variety of REST endpoints under the <em>demo02</em> category — products, customers, and more — which will serve as targets for <code>WebClient</code> requests. Ensure this JAR is running before proceeding to the hands-on lessons.',
    ],
    keyPoints: [
      '<code>WebClient</code> is Spring\'s non-blocking, reactive alternative to <code>RestTemplate</code>, built on Reactor Netty.',
      'A built <code>WebClient</code> is <strong>immutable and thread-safe</strong> — create one bean per external service and share it freely.',
      'Use <code>mutate()</code> on an existing client to derive a new builder, modify settings, and <code>build()</code> a fresh instance.',
      'Use <code>bodyToMono()</code> for a single response object and <code>bodyToFlux()</code> for a streaming response of multiple objects.',
      'The external demo service on <code>localhost:7070</code> (demo02 endpoints) will be used for all hands-on practice in this section.',
    ],
    code: `java`,
    codeLabel: 'java',
    note: {
      label: 'WHY THIS MATTERS',
      text: 'RestTemplate is blocking — every call ties up a thread for the entire duration of the HTTP exchange. WebClient eliminates that bottleneck by running entirely on the reactive event loop, making it essential for high-throughput microservice communication.',
      tone: 'accent',
    },
    quiz: {
      question: 'You need to change the base URL of an already-built WebClient instance. What is the correct approach?',
      options: [
        { label: 'Call setBaseUrl() on the existing WebClient instance', correct: false },
        { label: 'Call mutate() on the existing instance, then baseUrl("...").build() to create a new client', correct: true },
        { label: 'Create a brand new WebClient.fromScratch() and reconfigure everything from scratch', correct: false },
        { label: 'WebClient base URLs cannot be changed after construction', correct: false },
      ],
      explanation: 'WebClient is immutable, so you cannot modify it in place. The mutate() method returns a new builder seeded with the existing client\'s configuration, allowing you to override specific settings (like baseUrl) and then build() a fresh immutable instance.',
    },
  },
  {
    id: '9.2',
    title: 'Project Setup',
    duration: '3 min',
    kind: 'setup',
    summary: [
      'To explore <code>WebClient</code> without building a full production service, we use test classes as a playground. Under <code>src/test/java</code>, in package <code>com.winsguru.playground.test</code>, we create a new package <code>section07</code> and an abstract class <code>AbstractWebClient</code>. This class is not for testing — it provides shared utility methods that concrete demo classes will extend.',
      'The abstract class exposes a <code>createWebClient</code> method that accepts a <code>Consumer&lt;WebClient.Builder&gt;</code>, allowing each demo to customize the builder (e.g., headers, codecs) as needed. A convenience overload passes a no-op consumer so demos can use default settings when no customization is required. The base URL is set to <code>http://localhost:7070/demo02</code>, matching the running demo service\'s Swagger spec.',
      'A generic helper method <code>print</code> wraps a <code>Consumer&lt;T&gt;</code> intended for use with <code>doOnNext</code>. It logs each emitted item at INFO level, making it easy to inspect responses during demos without writing repetitive logging code in every example.',
    ],
    keyPoints: [
      'Test classes are used as a playground for <code>WebClient</code> demos — no actual assertions are written in this section.',
      '<code>createWebClient</code> accepts a <code>Consumer&lt;WebClient.Builder&gt;</code> for per-demo customization of the client builder.',
      'The base URL <code>http://localhost:7070/demo02</code> is set once in the abstract class so all demos share it.',
      'The <code>print</code> helper returns a <code>Consumer&lt;T&gt;</code> for use with <code>doOnNext</code>, logging each emitted item.',
      'An overloaded <code>createWebClient</code> with no arguments supplies a no-op consumer for default configuration.',
    ],
    code: `package com.winsguru.playground.test.section07;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.function.Consumer;

public abstract class AbstractWebClient {

    private static final Logger log = LoggerFactory.getLogger(AbstractWebClient.class);

    private static final String BASE_URL = "http://localhost:7070/demo02";

    protected WebClient createWebClient() {
        return createWebClient(builder -> {});
    }

    protected WebClient createWebClient(Consumer<WebClient.Builder> consumer) {
        var builder = WebClient.builder()
                .baseUrl(BASE_URL);
        consumer.accept(builder);
        return builder.build();
    }

    protected <T> Consumer<T> print() {
        return item -> log.info("received: {}", item);
    }
}`,
    codeLabel: 'java',
    note: {
      label: 'WHY THIS MATTERS',
      text: 'Centralizing WebClient creation in an abstract base class avoids repeating boilerplate configuration across every demo. The Consumer-based design lets each lesson customize the client without duplicating setup code.',
      tone: 'accent',
    },
    quiz: {
      question: 'Why does createWebClient accept a Consumer<WebClient.Builder> instead of just returning a pre-configured WebClient?',
      options: [
        { label: 'To allow each demo to further customize the builder (e.g., add headers or codecs) before the client is built', correct: true },
        { label: 'Because WebClient.Builder cannot be used without a Consumer', correct: false },
        { label: 'To enforce that every demo must configure a base URL manually', correct: false },
        { label: 'Because WebClient does not have a build() method', correct: false },
      ],
      explanation: 'The Consumer gives each demo class a hook to customize the builder — adding default headers, codecs, or other settings — before build() is called. The no-arg overload handles the case where no customization is needed.',
    },
  },
  {
    id: '9.3',
    title: 'Simple GET',
    duration: '4 min',
    kind: 'demo',
    summary: [
      'Building on the project setup from the previous lesson, we now make our first WebClient request. The test class extends <code>AbstractWebClientTest</code>, which provides a pre-configured <code>WebClient</code> instance (available via <code>this.client</code>) with a base URL already set. The target endpoint is <code>/lecture-01/product/{id}</code>, which accepts a product ID between 1 and 100 and returns a JSON object with <code>id</code>, <code>description</code>, and <code>price</code> fields. The external service intentionally takes about one second per request — it is a slow service by design.',
      'To represent the response, we create a Java <code>record</code> called <code>Product</code> in a <code>dev</code> package. Java records are ideal here because they provide immutable data carriers with automatic constructor, accessor, <code>equals</code>, <code>hashCode</code>, and <code>toString</code> methods — all without boilerplate. The record has three fields: <code>Integer id</code>, <code>String description</code>, and <code>Integer price</code>.',
      'The WebClient call chain is straightforward: <code>client.get().uri("/lecture-01/product/1").retrieve().bodyToMono(Product.class)</code>. The <code>retrieve()</code> method initiates the response extraction, and <code>bodyToMono</code> decodes the JSON body into a <code>Mono&lt;Product&gt;</code>. We use <code>bodyToMono</code> because we expect a single object; <code>bodyToFlux</code> would be used for collections (covered in a later lesson). We add <code>doOnNext</code> to print the product when it arrives.',
      'A critical point: <strong>nothing happens until you subscribe</strong>. The <code>Mono</code> is lazy — the HTTP request is not sent when the chain is declared, only when <code>subscribe()</code> is called. However, because the test method completes immediately after subscribing, the JVM can exit before the asynchronous response arrives. To observe the result, we block the test thread with <code>Thread.sleep(Duration.ofSeconds(2))</code> — two seconds is enough because the service takes ~1 second per call. In a real reactive application you would not block; this is purely for demonstration purposes in a test context.',
    ],
    keyPoints: [
      'Use <code>client.get().uri(path).retrieve().bodyToMono(Class.class)</code> for a single-object JSON response.',
      '<strong>Nothing happens until you subscribe</strong> — the HTTP request is only sent when <code>subscribe()</code> is called on the <code>Mono</code>.',
      'Use <code>bodyToMono</code> for a single item and <code>bodyToFlux</code> for multiple items (e.g., arrays/collections).',
      'Java <code>record</code> types are a clean way to represent immutable JSON response bodies without boilerplate.',
      'In test/demo contexts, <code>Thread.sleep</code> prevents the JVM from exiting before the async response arrives — never do this in production reactive code.',
      'The external demo service is intentionally slow (~1 second per request) to simulate real-world latency.',
    ],
    code: `package com.example.dev;

public record Product(Integer id, String description, Integer price) {
}

// --- Test class ---
package com.example;

import com.example.dev.Product;
import org.testng.annotations.Test;
import java.time.Duration;

public class Lecture01Test extends AbstractWebClientTest {

    @Test
    public void simpleGet() throws InterruptedException {
        this.client
            .get()
            .uri("/lecture-01/product/1")
            .retrieve()
            .bodyToMono(Product.class)
            .doOnNext(System.out::println)
            .subscribe();

        // Block to allow the async request to complete before the JVM exits.
        // The demo service takes ~1 second per call.
        Thread.sleep(Duration.ofSeconds(2));
    }
}

// ... (AbstractWebClientTest from lesson 9.2 provides the pre-configured WebClient instance)`,
    codeLabel: 'java',
    note: {
      label: 'WARNING',
      text: 'Calling <code>subscribe()</code> does not block the calling thread — the request is sent asynchronously. If the main thread exits before the response arrives, you will see no output. This is why <code>Thread.sleep</code> is used here, but in production reactive code you should compose the Mono into your pipeline instead of blocking.',
      tone: 'accent',
    },
    quiz: {
      question: 'You write the WebClient chain <code>client.get().uri(...).retrieve().bodyToMono(Product.class).doOnNext(System.out::println)</code> but forget to call <code>subscribe()</code>. What happens?',
      options: [
        { label: 'The request is sent but the response is not printed', correct: false },
        { label: 'No HTTP request is sent at all', correct: true },
        { label: 'A compile error occurs because the chain is incomplete', correct: false },
        { label: 'The request is sent and the response is printed automatically', correct: false },
      ],
      explanation: 'In Project Reactor, a <code>Mono</code> is lazy. The HTTP request is only triggered when someone subscribes to the <code>Mono</code>. Without <code>subscribe()</code>, the entire chain is just a declaration — no network call is ever made.',
    },
  },
  {
    id: '9.4',
    title: 'Non-blocking Concurrent Requests',
    duration: '4 min',
    kind: 'demo',
    summary: [
      'Building on the simple GET request from the previous lesson, this demo shows how WebClient handles many concurrent requests without blocking. WebClient is a wrapper around Reactor Netty, which uses an event-loop model with one thread per CPU core. Because the thread never blocks waiting for a response, a single thread can juggle dozens or hundreds of in-flight requests simultaneously.',
      'The demo sends 100 GET requests in a <code>for</code> loop, each fetching a different product by ID. Each remote call takes up to one second on the server side. In a traditional blocking model, 100 sequential requests on a single thread would take ~100 seconds. With WebClient, all 100 requests are fired off and their responses arrive at roughly the same time — within about one second — because the event-loop thread issues a request, moves on to the next, and only picks up each response when it becomes available.',
      'The log output confirms that the same thread (e.g., <code>reactor-http-nio-2</code>) processes responses for multiple different product IDs concurrently. This is the essence of non-blocking I/O: the thread is never idle waiting for a single response, so a small number of threads can achieve very high throughput.',
      'Note that WebClient returns a <code>Mono</code> (a reactive publisher). Nothing happens until you subscribe — the HTTP request is only sent when the <code>Mono</code> is subscribed to. In the demo, calling <code>.subscribe()</code> inside the loop triggers each request immediately, allowing all 100 to be in-flight at once.',
    ],
    keyPoints: [
      'WebClient wraps Reactor Netty, which uses an event-loop model with <strong>one thread per CPU core</strong> — not a thread-per-request model.',
      'Because calls are non-blocking, a single thread can handle hundreds of concurrent in-flight requests simultaneously.',
      '100 sequential blocking calls at 1 second each would take ~100 seconds; 100 non-blocking calls complete in ~1 second.',
      'The same <code>reactor-http-nio</code> thread processes responses for multiple product IDs — proof that the thread is reused across concurrent requests.',
      'Nothing is sent until you subscribe to the returned <code>Mono</code> — subscription triggers the actual HTTP request.',
    ],
    code: `package com.example.webclientdemo;

import org.junit.jupiter.api.Test;
import org.springframework.web.reactive.function.client.WebClient;

import com.example.webclientdemo.dto.Product;

import reactor.core.publisher.Mono;

class WebClientDemoTest {

    private final WebClient webClient = WebClient.create("http://localhost:7070");

    @Test
    void concurrentRequests() throws InterruptedException {
        for (int i = 1; i <= 100; i++) {
            Mono<Product> mono = webClient.get()
                    .uri("/products/{id}", i)
                    .retrieve()
                    .bodyToMono(Product.class);

            mono.subscribe(product -> {
                System.out.println("Thread: " + Thread.currentThread().getName()
                        + " | Product: " + product);
            });
        }

        // Give the async requests time to complete
        Thread.sleep(2000);
    }
}`,
    codeLabel: 'java',
    note: {
      label: 'KEY INSIGHT',
      text: 'The event-loop thread issues a request, immediately moves on to the next, and processes each response only when it arrives. This is why 100 one-second calls finish in ~1 second instead of ~100 seconds — the thread is never blocked waiting.',
      tone: 'accent',
    },
    quiz: {
      question: 'In the demo, 100 requests each taking 1 second on the server complete in ~1 second total. What makes this possible with WebClient?',
      options: [
        { label: 'WebClient spawns a new thread for each request', correct: false },
        { label: 'The event-loop thread fires all requests without blocking, then processes responses as they arrive', correct: true },
        { label: 'WebClient caches responses from previous identical requests', correct: false },
        { label: 'The server processes requests in parallel, so WebClient just waits', correct: false },
      ],
      explanation: 'Reactor Netty uses a small number of event-loop threads (one per CPU core). Each thread issues a request and immediately moves on — it never blocks waiting for a response. When a response arrives, the same thread picks it up and processes it. This non-blocking model lets a single thread handle hundreds of concurrent in-flight requests.',
    },
  },
  {
    id: '9.5',
    title: 'How Event Loop Works',
    duration: '3 min',
    kind: 'concept',
    summary: [
      'This optional lesson explains the internal mechanics of how WebClient achieves non-blocking I/O using an event loop model. If you studied the Java Reactive Programming course, the concept is identical — a single thread per CPU core continuously processes tasks from queues rather than blocking on individual responses.',
      'When you submit multiple concurrent requests (e.g., fetching product IDs 1, 2, 3, ... in a loop), they are placed into an <em>outbound queue</em>. The event loop thread picks the first request, sends it over the network, and <strong>immediately</strong> moves on to the next task — it does <em>not</em> wait for the response. This is the core of non-blocking I/O: the thread keeps itself busy dispatching requests rather than sitting idle.',
      'As responses arrive from the remote service, the operating system notifies the application via a callback (leveraging OS-level mechanisms like <code>epoll</code> on Linux or <code>kqueue</code> on macOS). The event loop thread places these responses into an <em>inbound queue</em>. Responses may arrive out of order — product ID 2 might return before product ID 1 — because network latency is unpredictable. The thread processes inbound responses as they come, interleaving them with new outbound requests.',
      'The key takeaway: you do not need hundreds of threads to handle hundreds of concurrent requests. With WebClient and the reactive event loop, one thread per CPU core can dispatch and manage thousands of simultaneous I/O operations by never blocking on any single one.',
    ],
    keyPoints: [
      'The event loop uses <strong>one thread per CPU core</strong> — no thread pool scaling with request count',
      'Outbound requests are queued and dispatched without waiting for responses, keeping the thread fully utilized',
      'Responses arrive asynchronously into an <em>inbound queue</em> and may come back in <strong>any order</strong> due to network variability',
      'The OS notifies the application when data is ready (via mechanisms like <code>epoll</code>/<code>kqueue</code>), eliminating the need for blocking <code>read()</code> calls',
      'This model allows a small number of threads to handle thousands of concurrent connections — the foundation of reactive non-blocking I/O',
    ],
    note: {
      label: 'KEY INSIGHT',
      text: 'The event loop\'s power comes from never blocking: the thread dispatches a request and immediately moves on. This is why a single thread can manage thousands of concurrent I/O operations — it spends zero time waiting.',
      tone: 'accent',
    },
    quiz: {
      question: 'In the event loop model, what does the thread do immediately after sending a request to a remote service?',
      options: [
        { label: 'Waits for the response before sending the next request', correct: false },
        { label: 'Moves on to the next task in the outbound queue without waiting', correct: true },
        { label: 'Spawns a new thread to handle the response', correct: false },
        { label: 'Blocks until the OS notifies it that data is ready', correct: false },
      ],
      explanation: 'The thread never blocks waiting for a response. It dispatches the request and immediately picks up the next task from the queue. Responses are handled asynchronously when the OS notifies the application that data has arrived.',
    },
  },
  {
    id: '9.6',
    title: 'URI Variables',
    duration: '3 min',
    kind: 'demo',
    summary: [
      'So far in our WebClient requests we have been building URIs through plain string concatenation — for example, <code>"http://localhost:8080/lecture01/product/" + id</code>. While this works for trivial cases, real-world URLs can be long and complex, making string concatenation hard to read and error-prone. WebClient provides overloaded <code>uri()</code> methods that accept URI templates with placeholder variables, similar to Spring MVC\'s <code>@PathVariable</code> pattern.',
      'There are two main styles. The <strong>positional (index-based)</strong> approach uses <code>{}</code> placeholders in the template string and substitutes values in order — the first argument replaces the first placeholder, the second argument replaces the second, and so on. The <strong>named (map-based)</strong> approach uses named placeholders like <code>{lectureId}</code> and a <code>Map&lt;String, Object&gt;</code> that maps each placeholder name to its value. The named approach is more explicit and less prone to argument-order mistakes.',
      'In this demo, we refactor the concurrent GET request from the previous lesson to use a URI template with a single positional variable. Instead of concatenating the product ID, we pass <code>productId</code> as a separate argument to <code>.uri()</code>. WebClient internally expands the template before sending the request, producing the same final URL but with cleaner, more maintainable code.',
    ],
    keyPoints: [
      'String concatenation for URIs is fine for simple cases but becomes unwieldy for long or complex URLs.',
      'Positional URI variables use <code>{}</code> placeholders; values are substituted in the order they appear as arguments.',
      'Named URI variables use a <code>Map&lt;String, Object&gt;</code> keyed by placeholder name, which is more readable and less error-prone.',
      'WebClient handles template expansion internally — the final HTTP request URL is identical regardless of which approach you use.',
      'URI templates follow the same <code>{placeholder}</code> syntax as Spring MVC\'s <code>@PathVariable</code>.',
    ],
    code: `package com.example.webclientdemo;

import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Flux;

@Service
public class ProductClient {

    private final WebClient client;

    public ProductClient(WebClient.Builder builder) {
        this.client = builder.baseUrl("http://localhost:8080").build();
    }

    // ... (concurrent request setup from lesson 9.4)

    public Flux<Product> getProductsConcurrently() {
        Flux<Integer> productIds = Flux.range(1, 5);

        return productIds.flatMap(productId ->
                client.get()
                        // URI template with a positional variable
                        .uri("/lecture01/product/{id}", productId)
                        .retrieve()
                        .bodyToMono(Product.class)
        );
    }

    // Named (map-based) alternative — same result, more explicit
    public Flux<Product> getProductsConcurrentlyNamed() {
        Flux<Integer> productIds = Flux.range(1, 5);

        return productIds.flatMap(productId -> {
            java.util.Map<String, Object> uriVariables = java.util.Map.of("id", productId);

            return client.get()
                    .uri("/lecture01/product/{id}", uriVariables)
                    .retrieve()
                    .bodyToMono(Product.class);
        });
    }
}`,
    codeLabel: 'java',
    note: {
      label: 'WHEN TO USE',
      text: 'Prefer URI templates over string concatenation whenever a URL has path variables — they are more readable, less error-prone, and handle URL-encoding automatically. Use the named (map-based) form when there are two or more variables to avoid argument-ordering mistakes.',
      tone: 'green',
    },
    quiz: {
      question: 'You need to call GET /users/{userId}/orders/{orderId} with two path variables. Which approach is least prone to argument-ordering bugs?',
      options: [
        { label: 'Positional: .uri("/users/{}/orders/{}", userId, orderId)', correct: false },
        { label: 'Named: .uri("/users/{userId}/orders/{orderId}", Map.of("userId", userId, "orderId", orderId))', correct: true },
        { label: 'String concatenation: "/users/" + userId + "/orders/" + orderId', correct: false },
        { label: 'All three are equally safe', correct: false },
      ],
      explanation: 'The named (map-based) approach explicitly maps each placeholder name to its value, eliminating any ambiguity about argument order. Positional variables rely on the order of varargs, which is easy to swap by accident. String concatenation offers no template safety and skips automatic URL-encoding.',
    },
  },
  {
    id: '9.7',
    title: 'Streaming GET',
    duration: '4 min',
    kind: 'demo',
    summary: [
      'This lesson demonstrates how to consume a streaming endpoint using WebClient. The remote service exposes <code>/lecture02/product-stream</code>, which emits ten <code>Product</code> objects sequentially with a 500-millisecond delay between each item. Unlike the single-object GET in lesson 3, here we use <code>bodyToFlux</code> instead of <code>bodyToMono</code> because the response is a continuous stream of multiple items rather than one discrete response.',
      'A key challenge with reactive, non-blocking code in a test context is that the calling thread exits immediately without waiting for the stream to complete. Instead of using <code>Thread.sleep()</code> (a blocking anti-pattern), we attach a <code>StepVerifier</code> to the flux purely as a synchronization mechanism — it blocks the test thread until the upstream sends a completion or error signal. The <code>then()</code> operator is used to discard the actual data items and forward only the terminal signal to the <code>StepVerifier</code>, so we don\'t need to assert on every individual product.',
      'Because a stream can potentially be infinite or long-running, WebClient gives the consumer the ability to cancel early. By applying the <code>take(Duration)</code> operator, you can limit consumption to a specific time window — for example, <code>take(Duration.ofSeconds(3))</code> collects whatever items arrive in the first three seconds and then automatically cancels the upstream subscription. The remote service is notified of this cancellation, which is important for resource cleanup in reactive back-pressure-aware systems.',
    ],
    keyPoints: [
      'Use <code>bodyToFlux(Product.class)</code> for streaming responses (multiple items); use <code>bodyToMono</code> for single-item responses.',
      'Avoid <code>Thread.sleep()</code> in reactive tests — use <code>StepVerifier</code> to block until the stream completes or errors.',
      'The <code>then()</code> operator discards data items and forwards only the completion/error signal downstream, useful when you only care about stream termination.',
      'Use <code>take(Duration.ofSeconds(n))</code> to consume a stream for a limited time window and automatically cancel the upstream subscription afterward.',
      'Stream cancellation propagates back to the remote service, which can clean up resources accordingly.',
    ],
    code: `package com.example.webclientdemo.lecture02;

import com.example.webclientdemo.AbstractWebClient;
import com.example.webclientdemo.entity.Product;
import org.junit.jupiter.api.Test;
import reactor.test.StepVerifier;

import java.time.Duration;

public class Lecture02FluxTest extends AbstractWebClient {

    @Test
    public void streamingResponse() {
        this.client
                .get()
                .uri("/lecture02/product-stream")
                .retrieve()
                .bodyToFlux(Product.class)
                .doOnNext(System.out::println)
                .then()
                .as(StepVerifier::create)
                .expectComplete()
                .verify();
    }

    @Test
    public void streamingResponseWithTimeLimit() {
        this.client
                .get()
                .uri("/lecture02/product-stream")
                .retrieve()
                .bodyToFlux(Product.class)
                .take(Duration.ofSeconds(3))
                .doOnNext(System.out::println)
                .then()
                .as(StepVerifier::create)
                .expectComplete()
                .verify();
    }
}`,
    codeLabel: 'java',
    note: {
      label: 'WHY THIS MATTERS',
      text: 'Streaming endpoints blur the line between request-response and event-driven communication. Mastering <code>bodyToFlux</code> and time-based cancellation lets you build consumers that handle real-time data feeds efficiently without blocking threads or leaking resources.',
      tone: 'accent',
    },
    quiz: {
      question: 'You are consuming a potentially infinite stream of stock price updates via WebClient. You want to process updates for exactly 10 seconds and then stop. Which operator should you apply to the flux?',
      options: [
        { label: 'take(10)', correct: false },
        { label: 'take(Duration.ofSeconds(10))', correct: true },
        { label: 'delayElements(Duration.ofSeconds(10))', correct: false },
        { label: 'timeout(Duration.ofSeconds(10))', correct: false },
      ],
      explanation: '<code>take(Duration.ofSeconds(10))</code> subscribes to the flux, collects all items emitted within the 10-second window, and then automatically cancels the upstream subscription. <code>take(10)</code> limits by item count, not time. <code>timeout</code> would emit an error if no item arrives within the duration, rather than gracefully stopping after a fixed window.',
    },
  },
  {
    id: '9.8',
    title: 'POST - Body Publisher vs Body Value',
    duration: '5 min',
    kind: 'demo',
    summary: [
      'This lesson demonstrates how to send POST requests using WebClient, focusing on two different methods for providing the request body: <code>bodyValue()</code> and <code>body()</code>. The demo uses a remote endpoint (<code>lecture03-product</code>) that accepts a <code>Product</code> and takes one second to respond with the created entity. Because the concepts mirror what was already covered with <code>WebTestClient</code> in earlier sections, the focus here is strictly on the mechanics of the two body-supply methods.',
      'The <code>bodyValue()</code> method is used when you already have the object in memory. You simply pass the <code>Product</code> instance directly, and WebClient handles serialization. This is the straightforward, synchronous-data approach — you have the data, you send it.',
      'The <code>body()</code> method is used when the request body comes from a <em>reactive publisher</em> (e.g., a <code>Mono&lt;Product&gt;</code> returned by a repository). Instead of blocking to extract the value, you pass the publisher and the element type class (<code>Product.class</code>) so WebClient can subscribe to the publisher and serialize whatever it emits. In the demo, a <code>Mono</code> delayed by one second simulates a slow data source; combined with the remote service\'s one-second processing time, the total elapsed time is two seconds — all without blocking any thread.',
      'The key insight is that <code>body()</code> keeps the entire pipeline non-blocking end-to-end. The request body is not materialized until the publisher emits, which means WebClient sends the POST request body asynchronously whenever the data becomes available.',
    ],
    keyPoints: [
      'Use <code>bodyValue(Object)</code> when the request body object is already available in memory.',
      'Use <code>body(Publisher, Class)</code> when the request body comes from a reactive source like a <code>Mono</code> or <code>Flux</code>.',
      'With <code>body()</code>, WebClient subscribes to the publisher and sends the request only when the publisher emits an item.',
      'The demo\'s two-second total time (1s publisher delay + 1s server processing) confirms the pipeline remains fully non-blocking.',
      'Both methods produce a <code>Mono&lt;Product&gt;</code> response via <code>.retrieve().bodyToMono(Product.class)</code>.',
    ],
    code: `package com.example.webclientdemo.section07;

import com.example.webclientdemo.AbstractWebClient;
import com.example.webclientdemo.dto.Product;
import com.example.webclientdemo.dto.Response;
import org.junit.jupiter.api.Test;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;

import java.time.Duration;

public class Lecture03PostTest extends AbstractWebClient {

    // ... (client and productRepository inherited from AbstractWebClient)

    @Test
    public void postBodyValue() {
        Product product = new Product(null, "iPhone", 1000);

        Mono<Response> responseMono = this.client
                .post()
                .uri("lecture03-product")
                .bodyValue(product)
                .retrieve()
                .bodyToMono(Response.class)
                .doOnNext(System.out::println);

        StepVerifier.create(responseMono)
                .expectNextCount(1)
                .verifyComplete();
    }

    @Test
    public void postBodyPublisher() {
        // Simulate a slow data source (e.g., a repository query) emitting after 1 second
        Mono<Product> productMono = Mono.fromSupplier(() -> new Product(null, "iPhone", 1000))
                .delayElement(Duration.ofSeconds(1));

        Mono<Response> responseMono = this.client
                .post()
                .uri("lecture03-product")
                .body(productMono, Product.class)
                .retrieve()
                .bodyToMono(Response.class)
                .doOnNext(System.out::println);

        // Total time: 1s (publisher delay) + 1s (server processing) = 2s
        StepVerifier.create(responseMono)
                .expectNextCount(1)
                .verifyComplete();
    }
}`,
    codeLabel: 'java',
    note: {
      label: 'WHEN TO USE',
      text: 'Use <code>bodyValue()</code> when you already have the object in hand; use <code>body()</code> when the data arrives asynchronously from a reactive source. Choosing <code>bodyValue()</code> with a blocked publisher result defeats the non-blocking pipeline.',
      tone: 'accent',
    },
    quiz: {
      question: 'You need to POST a Product to a remote service, but the Product is returned asynchronously from a reactive repository as Mono<Product>. Which method should you use to set the request body?',
      options: [
        { label: 'bodyValue(productMono.block())', correct: false },
        { label: 'body(productMono, Product.class)', correct: true },
        { label: 'bodyValue(productMono, Product.class)', correct: false },
        { label: 'body(productMono.block(), Product.class)', correct: false },
      ],
      explanation: 'The body() method accepts a Publisher and the element type class, allowing WebClient to subscribe to the Mono and send the request body when it emits — keeping the pipeline fully non-blocking. Calling block() would defeat the purpose of using WebClient.',
    },
  },
  {
    id: '9.9',
    title: 'Default Headers Configuration / Override',
    duration: '6 min',
    kind: 'demo',
    summary: [
      'When a remote service requires a header like <code>callerId</code> on every request, you can configure it once at the <code>WebClient.Builder</code> level using <code>defaultHeader</code>. This ensures every request sent through that client instance automatically includes the header — ideal for identifying the calling service (e.g., <code>callerId: order-service</code>) without repeating it on each call.',
      'If a specific request needs a different value for that same header, you can override the default per-request using <code>.header("callerId", "new-value")</code> in the request chain. The per-request value takes precedence over the builder-level default, so the remote service sees the overridden value.',
      'For setting multiple headers dynamically, <code>WebClient.Builder</code> provides a <code>defaultHeaders(Consumer<HttpHeaders>)</code> method. You pass a <code>Map</code> of header names to values and iterate over it inside the consumer, calling <code>headers.setAll(map)</code> or setting entries individually. This approach is useful when header values are determined at runtime or loaded from configuration.',
    ],
    keyPoints: [
      '<strong>Default headers</strong> are set on <code>WebClient.Builder</code> via <code>defaultHeader(name, value)</code> and apply to every request made by that client instance.',
      'Per-request <code>.header(name, value)</code> overrides any default header with the same name for that single request.',
      'Use <code>defaultHeaders(Consumer&lt;HttpHeaders&gt;)</code> to batch-set multiple headers, optionally from a <code>Map</code> via <code>headers.setAll(map)</code>.',
      'The remote service logs confirm which headers were actually received — useful for verifying override behavior.',
      'Without the required <code>callerId</code> header, the demo endpoint returns <code>400 Bad Request</code> — error handling is covered in a later lesson.',
    ],
    code: `package com.example.webclientdemo.section07;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.test.StepVerifier;

import java.util.Map;

public class Lecture04HeaderTest extends AbstractWebClient {

    private final String endpoint = "/demo02/lecture04/product/{id}";

    @Test
    void defaultHeader() {
        // Builder configured with a default callerId header
        WebClient client = WebClient.builder()
                .baseUrl(BASE_URL)
                .defaultHeader("callerId", "order-service")
                .build();

        client.get()
                .uri(endpoint, 1)
                .retrieve()
                .bodyToMono(String.class)
                .as(StepVerifier::create)
                .expectNextCount(1)
                .verifyComplete();
    }

    @Test
    void overrideHeader() {
        // Default header set on the builder
        WebClient client = WebClient.builder()
                .baseUrl(BASE_URL)
                .defaultHeader("callerId", "order-service")
                .build();

        // Override callerId for this specific request only
        client.get()
                .uri(endpoint, 1)
                .header("callerId", "new-value")
                .retrieve()
                .bodyToMono(String.class)
                .as(StepVerifier::create)
                .expectNextCount(1)
                .verifyComplete();
    }

    @Test
    void defaultHeadersWithMap() {
        Map<String, String> headerMap = Map.of(
                "callerId", "new-value",
                "some-key", "some-value"
        );

        // Set multiple default headers from a map using a Consumer<HttpHeaders>
        WebClient client = WebClient.builder()
                .baseUrl(BASE_URL)
                .defaultHeaders(headers -> headers.setAll(headerMap))
                .build();

        client.get()
                .uri(endpoint, 1)
                .retrieve()
                .bodyToMono(String.class)
                .as(StepVerifier::create)
                .expectNextCount(1)
                .verifyComplete();
    }
}`,
    codeLabel: 'java',
    note: {
      label: 'WHEN TO USE',
      text: 'Use <code>defaultHeader</code> for values that are constant across all requests to a service (like caller identity). Use per-request <code>.header()</code> when only certain calls need a different value, avoiding the need to create a separate WebClient instance.',
      tone: 'accent',
    },
    quiz: {
      question: 'You set <code>defaultHeader("callerId", "order-service")</code> on the WebClient builder, then on a specific request you add <code>.header("callerId", "vip-client")</code>. What value does the remote service receive for <code>callerId</code> on that request?',
      options: [
        { label: '"order-service" — builder defaults always win', correct: false },
        { label: '"vip-client" — per-request headers override builder defaults', correct: true },
        { label: 'Both values are sent as a comma-separated list', correct: false },
        { label: 'The request fails with a duplicate header error', correct: false },
      ],
      explanation: 'Per-request headers specified in the request chain take precedence over default headers set on the WebClient.Builder. The remote service sees only "vip-client" for that request, while other requests using the same client still send "order-service".',
    },
  },
  {
    id: '9.10',
    title: 'Remote Service - Error Handling',
    duration: '9 min',
    kind: 'demo',
    summary: [
      'When a remote service returns an error (e.g., 400 Bad Request or 500 Internal Server Error), WebClient emits an error signal downstream. By default, this signal carries a <code>WebClientResponseException</code> containing the HTTP status, headers, and body of the failed response. The calculator endpoint used here expects two path variables and an <code>X-Operation</code> header; omitting or invalidating the header causes the service to return a <a href="https://datatracker.ietf.org/doc/html/rfc7807">RFC 7807 Problem Detail</a> JSON object describing the error.',
      'Because the error flows through the reactive pipeline, you can apply standard Project Reactor operators to handle it. <code>onErrorReturn</code> lets you substitute a default value so the subscriber never sees the error. By passing a specific exception class to <code>onErrorReturn</code>, you can return different defaults for different error types — for example, one fallback for <code>WebClientResponseException.BadRequest</code> and another for <code>WebClientResponseException.InternalServerError</code>. Multiple <code>onErrorReturn</code> calls can be chained to cover each scenario.',
      'Sometimes you need to inspect the actual error payload rather than just swallowing the error. The <code>doOnError</code> operator accepts a <code>Consumer&lt;Throwable&gt;</code> and is triggered whenever the matching exception type fires. Inside it, you can call <code>exception.getResponseBodyAs(ProblemDetail.class)</code> to deserialize the remote service\'s error body into a typed <code>ProblemDetail</code> object (from <code>org.springframework.http</code>), giving you access to the title, status, and detail fields for logging or custom logic.',
    ],
    keyPoints: [
      'A non-2xx response from the remote service causes WebClient to emit a <code>WebClientResponseException</code> downstream, wrapping the status, headers, and body.',
      '<code>onErrorReturn</code> substitutes a fallback value, preventing the error from propagating to the subscriber.',
      'Passing an exception class to <code>onErrorReturn</code> (e.g., <code>WebClientResponseException.BadRequest.class</code>) lets you provide different fallbacks per error type.',
      '<code>doOnError</code> is a side-effect operator for inspecting or logging the exception without altering the pipeline\'s data flow.',
      '<code>exception.getResponseBodyAs(ProblemDetail.class)</code> decodes the error response body into a typed <code>ProblemDetail</code> for structured access to the error details.',
    ],
    code: `package com.example.section07;

import org.junit.jupiter.api.Test;
import org.springframework.http.ProblemDetail;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import reactor.test.StepVerifier;

public class Lecture05ErrorResponseTest extends AbstractWebClient {

    private final WebClient client = createWebClient();

    public record CalculatorResponse(Integer first, Integer second, String operation, Double result) {}

    @Test
    public void handlingError() {
        client.get()
                .uri("{base}/lecture05/calculator/{a}/{b}", "http://localhost:7070", 10, 20)
                .header("X-Operation", "*")
                .retrieve()
                .bodyToMono(CalculatorResponse.class)
                // Side-effect: log the ProblemDetail when any WebClientResponseException occurs
                .doOnError(WebClientResponseException.class,
                        ex -> {
                            ProblemDetail problemDetail = ex.getResponseBodyAs(ProblemDetail.class);
                            if (problemDetail != null) {
                                System.out.println("Problem Detail: " + problemDetail);
                            }
                        })
                // Fallback for 400 Bad Request
                .onErrorReturn(WebClientResponseException.BadRequest.class,
                        new CalculatorResponse(null, null, null, -1.0))
                // Fallback for 500 Internal Server Error
                .onErrorReturn(WebClientResponseException.InternalServerError.class,
                        new CalculatorResponse(null, null, null, Double.NaN))
                // Generic fallback for any other error
                .onErrorReturn(new CalculatorResponse(0, 0, "none", 0.0))
                .as(StepVerifier::create)
                .expectNextMatches(response -> response.result() == -1.0)
                .verifyComplete();
    }
}`,
    codeLabel: 'java',
    note: {
      label: 'KEY INSIGHT',
      text: 'WebClient does not throw exceptions in the traditional sense — it emits error signals through the reactive pipeline. This means all error handling is composable using Reactor operators, giving you fine-grained control over fallbacks and side-effects without try/catch blocks.',
      tone: 'accent',
    },
    quiz: {
      question: 'You want to log the full error body from a failed remote call without consuming or altering the error signal. Which operator should you use?',
      options: [
        { label: 'onErrorReturn', correct: false },
        { label: 'onErrorResume', correct: false },
        { label: 'doOnError', correct: true },
        { label: 'onErrorMap', correct: false },
      ],
      explanation: 'doOnError is a side-effect operator that lets you inspect or log the exception (e.g., via getResponseBodyAs) without changing the error signal that continues downstream. onErrorReturn and onErrorResume replace the error with a fallback value, while onErrorMap transforms the exception into a different one.',
    },
  },
  {
    id: '9.11',
    title: 'Retrieve vs Exchange',
    duration: '5 min',
    kind: 'demo',
    summary: [
      'Throughout this section we have used <code>retrieve()</code> for making requests, which is the high-level, recommended API. <code>retrieve()</code> gives you a typed response body directly — you call <code>bodyToMono()</code> or <code>bodyToFlux()</code> and handle errors with <code>onStatus()</code> or reactive error operators. However, when you need lower-level access to the full <code>ClientResponse</code> — such as inspecting status codes, headers, or cookies before deciding how to decode the body — you should use the <code>exchangeToMono()</code> (or <code>exchangeToFlux()</code>) method instead.',
      'The original <code>exchange()</code> method was deprecated because it was easy to forget to release the response body, causing connection leaks. Spring replaced it with <code>exchangeToMono()</code> and <code>exchangeToFlux()</code>, which guarantee the response is released after the provided function completes. Inside the lambda, you receive a <code>ClientResponse</code> and must return a <code>Mono</code> (or <code>Flux</code>) that represents your decoded result.',
      'This lesson demonstrates a <code>decode</code> helper that inspects the status code from the <code>ClientResponse</code>. For a 400 error, the remote service returns a <em>Problem Detail</em> (RFC 9457) JSON object rather than the normal domain object, so the code branches: on error it decodes to <code>ProblemDetail</code>, logs it, and emits <code>Mono.empty()</code> to satisfy the return type; on success it decodes normally to <code>CalculatorResponse</code> via <code>bodyToMono()</code>. This pattern gives you full control over how different status codes map to different deserialization strategies.',
    ],
    keyPoints: [
      '<strong><code>retrieve()</code></strong> is the high-level, recommended API for most use cases — use it when you just need the body and standard error handling.',
      '<strong><code>exchangeToMono()</code> / <code>exchangeToFlux()</code></strong> give you direct access to the <code>ClientResponse</code> for inspecting headers, cookies, and status codes before decoding.',
      'The old <code>exchange()</code> method was deprecated due to resource-leak risks — always use the newer <code>exchangeToMono</code>/<code>exchangeToFlux</code> variants.',
      'Inside the exchange lambda, you <em>must</em> return a <code>Mono</code> or <code>Flux</code> — use <code>Mono.empty()</code> when you have nothing to emit (e.g., after logging an error body).',
      'Different status codes can map to different body types — e.g., 400 errors decode to <code>ProblemDetail</code> while 2xx responses decode to your domain object.',
    ],
    code: `package com.example.webclientdemo;

import org.junit.jupiter.api.Test;
import org.springframework.http.ProblemDetail;
import org.springframework.web.reactive.function.client.ClientResponse;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;

public class ExchangeTest {

    private final WebClient client = WebClient.builder()
            .baseUrl("http://localhost:8080")
            .build();

    @Test
    void exchange_errorCase() {
        Mono<CalculatorResponse> result = client.get()
                .uri("/calculator/invalid")
                .exchangeToMono(this::decode);

        StepVerifier.create(result)
                .expectComplete()
                .verify();
    }

    @Test
    void exchange_successCase() {
        Mono<CalculatorResponse> result = client.get()
                .uri("/calculator/add?a=10&b=20")
                .exchangeToMono(this::decode);

        StepVerifier.create(result)
                .expectNext(new CalculatorResponse(30))
                .expectComplete()
                .verify();
    }

    private Mono<CalculatorResponse> decode(ClientResponse clientResponse) {
        System.out.println("Status code: " + clientResponse.statusCode());

        if (clientResponse.statusCode().is4xxClientError()) {
            // Remote service returns ProblemDetail (RFC 9457) on errors
            return clientResponse.bodyToMono(ProblemDetail.class)
                    .doOnNext(problem -> System.out.println("Problem detail: " + problem))
                    .then(Mono.empty());
        }

        if (clientResponse.statusCode().isError()) {
            // Handle 5xx or any other error without decoding the body
            return Mono.empty();
        }

        // Success case — decode normally to domain object
        return clientResponse.bodyToMono(CalculatorResponse.class);
    }
}`,
    codeLabel: 'java',
    note: {
      label: 'WHEN TO USE',
      text: 'Prefer <code>retrieve()</code> for standard request/response flows. Reach for <code>exchangeToMono()</code> only when you need to inspect status codes, headers, or cookies before deciding how to decode the body — for example, when different status codes return different response body types.',
      tone: 'accent',
    },
    quiz: {
      question: 'Why was the original exchange() method deprecated in favor of exchangeToMono() / exchangeToFlux()?',
      options: [
        { label: 'It did not support non-blocking I/O', correct: false },
        { label: 'It was easy to forget to release the response body, causing connection leaks', correct: true },
        { label: 'It could not handle streaming responses', correct: false },
        { label: 'It required manual serialization of request bodies', correct: false },
      ],
      explanation: 'The original exchange() method left responsibility for releasing the ClientResponse to the developer, which frequently led to connection leaks. The newer exchangeToMono() and exchangeToFlux() variants automatically release the response after the provided function completes.',
    },
  },
  {
    id: '9.12',
    title: 'Query Params',
    duration: '5 min',
    kind: 'demo',
    summary: [
      'This lesson demonstrates how to append query parameters to a URI when using <code>WebClient</code>. The target endpoint is the calculator service, but unlike the path-variable approach used in earlier lessons, this endpoint expects <code>first</code>, <code>second</code>, and <code>operation</code> as query parameters (e.g., <code>/calculator?first=10&second=20&operation=+</code>).',
      'Spring\'s <code>UriBuilder</code> is the idiomatic way to construct such URIs without manually concatenating strings. By calling <code>uri(builder -&gt; builder.path(...).queryParam(...).build(...))</code>, you separate the path template from the query-param template and let the builder handle encoding. The template placeholders (e.g., <code>{first}</code>) are resolved positionally by the values passed to <code>build()</code>.',
      'An alternative to positional arguments is passing a <code>Map&lt;String, Object&gt;</code> to <code>build()</code>. This resolves placeholders by key name rather than by position, which is more self-documenting and less error-prone when the number of parameters grows. If a key is missing or misspelled, the builder throws a clear <code>IllegalArgumentException</code> at runtime (e.g., “Map has no value for \'second\'”), making debugging straightforward compared to silent positional mismatches.',
    ],
    keyPoints: [
      'Use <code>UriBuilder</code> (via the lambda overload of <code>uri()</code>) to construct URIs with query parameters instead of manual string concatenation.',
      'Template placeholders like <code>{first}</code> in <code>queryParam</code> are resolved positionally by the varargs passed to <code>build()</code>.',
      'Passing a <code>Map&lt;String, Object&gt;</code> to <code>build()</code> resolves placeholders by key name, which is safer and more readable for many parameters.',
      'If a map key is missing, the builder throws a descriptive <code>IllegalArgumentException</code> — a meaningful error that aids debugging.',
      'Query parameters are automatically URL-encoded by the builder (e.g., <code>+</code> or spaces are handled correctly).',
    ],
    code: `package com.example.webclient.lecture06;

import com.example.webclient.AbstractClient;
import com.example.webclient.dto.CalculatorResponse;
import org.junit.jupiter.api.Test;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.test.StepVerifier;

import java.util.Map;

public class QueryParamsTest extends AbstractClient {

    private final WebClient webClient = createWebClient();

    @Test
    public void uriBuilderVariablesTest() {
        var path = "/calculator";

        // Positional: values are matched to placeholders in order
        var uri = webClient.get()
                .uri(builder -> builder
                        .path(path)
                        .queryParam("first", "{first}")
                        .queryParam("second", "{second}")
                        .queryParam("operation", "{operation}")
                        .build(10, 20, "+"))
                .retrieve()
                .bodyToMono(CalculatorResponse.class)
                .doOnNext(System.out::println);

        StepVerifier.create(uri)
                .expectNextCount(1)
                .verifyComplete();
    }

    @Test
    public void uriBuilderMapTest() {
        var path = "/calculator";

        // Map-based: values are matched to placeholders by key name
        Map<String, Object> variables = Map.of(
                "first", 10,
                "second", 20,
                "operation", "*"
        );

        var uri = webClient.get()
                .uri(builder -> builder
                        .path(path)
                        .queryParam("first", "{first}")
                        .queryParam("second", "{second}")
                        .queryParam("operation", "{operation}")
                        .build(variables))
                .retrieve()
                .bodyToMono(CalculatorResponse.class)
                .doOnNext(System.out::println);

        StepVerifier.create(uri)
                .expectNextCount(1)
                .verifyComplete();
    }
}`,
    codeLabel: 'java',
    note: {
      label: 'WHEN TO USE',
      text: 'Prefer the Map-based approach when you have more than two or three query parameters — key-based resolution is far less fragile than positional arguments, and missing keys produce clear runtime errors instead of silent value swaps.',
      tone: 'accent',
    },
    quiz: {
      question: 'You are building a URI with three query-param placeholders but accidentally pass only two values to the positional `build(10, 20)` call. What happens?',
      options: [
        { label: 'The builder silently substitutes null for the missing third value.', correct: false },
        { label: 'The builder throws an IllegalArgumentException because the number of values does not match the number of placeholders.', correct: true },
        { label: 'The builder ignores the unmatched placeholder and removes it from the URI.', correct: false },
        { label: 'The request is sent with the literal placeholder text in the URL.', correct: false },
      ],
      explanation: 'UriBuilder validates that every template placeholder has a corresponding value. If the counts mismatch, it throws an IllegalArgumentException rather than silently producing a malformed URI.',
    },
  },
  {
    id: '9.13',
    title: 'Basic Auth',
    duration: '3 min',
    kind: 'demo',
    summary: [
      'Basic Authentication is sometimes used for service-to-service communication — for example, when an order service calls a payment service and needs to send credentials. With Basic Auth, the username and password are concatenated as <code>username:password</code>, Base64-encoded, and sent in the <code>Authorization</code> header using the <code>Basic</code> scheme (e.g., <code>Authorization: Basic amF2YTpzZWNyZXQ=</code>). The instructor notes this is not a recommendation to use Basic Auth, but rather a demonstration of how to configure it with WebClient if your remote service requires it.',
      'The demo uses a remote endpoint that expects the username <code>java</code> and password <code>secret</code>. Without credentials, the service responds with HTTP 401 Unauthorized. WebClient provides a convenient method <code>HttpHeaders.setBasicAuth(String username, String password)</code> that handles the Base64 encoding and header formatting automatically.',
      'To apply the credentials, use the <code>defaultHeaders</code> builder method, which accepts a <code>Consumer&lt;HttpHeaders&gt;</code>. Inside the consumer, call <code>headers.setBasicAuth("java", "secret")</code>. This sets the Authorization header on every request made by that WebClient instance. The console output confirms the encoded credentials are being sent correctly, and the service returns a successful response instead of 401.',
    ],
    keyPoints: [
      'Basic Auth sends Base64-encoded <code>username:password</code> in the <code>Authorization</code> header with the <code>Basic</code> scheme.',
      'Use <code>HttpHeaders.setBasicAuth(username, password)</code> to automatically encode credentials — no manual Base64 needed.',
      'Apply credentials via <code>.defaultHeaders(headers -> headers.setBasicAuth("java", "secret"))</code> on the WebClient builder.',
      'Without proper credentials, the remote service returns HTTP 401 Unauthorized.',
      'Basic Auth is sometimes used for service-to-service authentication, though it is not the most secure option — consider Bearer Auth or OAuth2 for production systems.',
    ],
    code: `package com.example.webclientdemo.section07;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.test.StepVerifier;

public class BasicAuthTest extends AbstractWebClient {

    @Test
    public void basicAuth() {
        WebClient client = WebClient.builder()
                .baseUrl("http://localhost:7070/demo01/lecture07")
                .defaultHeaders(headers -> headers.setBasicAuth("java", "secret"))
                .build();

        client.get()
                .retrieve()
                .bodyToMono(String.class)
                .as(StepVerifier::create)
                .expectNextMatches(body -> body.contains("product"))
                .verifyComplete();
    }
}`,
    codeLabel: 'java',
    note: {
      label: 'WHEN TO USE',
      text: 'Basic Auth is acceptable for simple service-to-service calls behind a secure network, but for production systems consider Bearer Auth or OAuth2 token-based authentication for better security and credential rotation.',
      tone: 'accent',
    },
    quiz: {
      question: 'Which WebClient builder method is used to set Basic Auth credentials so they apply to every request?',
      options: [
        { label: '.defaultHeaders(headers -> headers.setBasicAuth("user", "pass"))', correct: true },
        { label: '.auth("user:pass")', correct: false },
        { label: '.header("Authorization", "Basic user:pass")', correct: false },
        { label: '.basicAuth("user", "pass")', correct: false },
      ],
      explanation: 'WebClient doesn\'t have a dedicated .basicAuth() builder method. Instead, use defaultHeaders with a Consumer<HttpHeaders> and call headers.setBasicAuth(username, password), which handles the Base64 encoding and proper header formatting automatically.',
    },
  },
  {
    id: '9.14',
    title: 'Bearer Auth',
    duration: '3 min',
    kind: 'demo',
    summary: [
      'Building on the Basic Auth configuration from the previous lesson, Bearer (token-based) authentication follows the same pattern but uses the <code>Authorization</code> header with a <code>Bearer</code> scheme instead of <code>Basic</code>. This is the most common authentication method for modern APIs that use JWT or OAuth2 access tokens.',
      'The approach reuses the <code>defaultHeader</code> configuration on the <code>WebClient.Builder</code>. Instead of encoding credentials, you simply pass the raw token string prefixed with <code>Bearer </code>. The remote service validates the token and returns <code>401 Unauthorized</code> if the token is missing, malformed, or invalid.',
      'The test mirrors the Basic Auth test structure: it calls a dedicated endpoint that requires Bearer authentication, verifies a successful response with the correct token, and confirms that a <code>401</code> is returned when the token is omitted or incorrect.',
    ],
    keyPoints: [
      'Bearer auth uses the <code>Authorization</code> header with the scheme <code>Bearer &lt;token&gt;</code> — no Base64 encoding needed unlike Basic auth',
      'Reuse <code>WebClient.Builder.defaultHeader()</code> to set the token once for all requests',
      'A missing or invalid token results in a <code>401 Unauthorized</code> response from the protected endpoint',
      'Bearer tokens are typically JWTs or OAuth2 access tokens obtained from an authorization server',
    ],
    code: `package com.example.webclientdemo.bearer;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.test.StepVerifier;

public class BearerAuthTest {

    private static final String BEARER_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" +
            ".eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIn0" +
            ".SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";

    @Test
    void bearerAuth() {
        WebClient client = WebClient.builder()
                .baseUrl("http://localhost:8080")
                .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + BEARER_TOKEN)
                .build();

        client.get()
                .uri("/lectures/8")
                .retrieve()
                .bodyToMono(String.class)
                .as(StepVerifier::create)
                .expectNextMatches(body -> body.contains("success"))
                .verifyComplete();
    }

    @Test
    void bearerAuth_invalidToken() {
        WebClient client = WebClient.builder()
                .baseUrl("http://localhost:8080")
                .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer invalid-token")
                .build();

        client.get()
                .uri("/lectures/8")
                .retrieve()
                .bodyToMono(String.class)
                .as(StepVerifier::create)
                .expectError()
                .verify();
    }
}`,
    codeLabel: 'java',
    note: {
      label: 'WHEN TO USE',
      text: 'Use Bearer auth when your API relies on JWT or OAuth2 tokens. Unlike Basic auth, the token is not re-encoded — you pass it verbatim after the \'Bearer \' prefix. For tokens that expire, consider using an ExchangeFilterFunction to refresh tokens automatically (covered in the next lesson).',
      tone: 'accent',
    },
    quiz: {
      question: 'What is the key difference between configuring Basic auth and Bearer auth on a WebClient?',
      options: [
        { label: 'Bearer auth requires Base64-encoding the token, just like Basic auth encodes credentials', correct: false },
        { label: 'Bearer auth passes the raw token string after \'Bearer \' with no encoding, while Basic auth Base64-encodes username:password', correct: true },
        { label: 'Bearer auth uses a custom header instead of the Authorization header', correct: false },
        { label: 'Bearer auth requires a separate ExchangeFilterFunction; it cannot be set via defaultHeader', correct: false },
      ],
      explanation: 'Basic auth encodes \'username:password\' in Base64 under the Basic scheme. Bearer auth simply passes the token as-is after the \'Bearer \' prefix in the same Authorization header — no encoding needed.',
    },
  },
  {
    id: '9.15',
    title: 'Exchange Filter Function',
    duration: '8 min',
    kind: 'demo',
    summary: [
      'An <code>ExchangeFilterFunction</code> is to outgoing requests what a <code>WebFilter</code> is to incoming requests in WebFlux. While a <code>WebFilter</code> handles cross-cutting concerns for requests arriving at your application (auth, logging, monitoring), an <code>ExchangeFilterFunction</code> applies the same concept to requests <em>leaving</em> your application via <code>WebClient</code>. This is ideal for concerns like generating tokens, adding tracing headers, or logging before the request hits the remote service.',
      'The key motivation is that static default headers (covered in lesson 9.9) don\'t work when you need a <em>fresh</em> token on every request. You also don\'t want to scatter token-generation logic across every service class that injects the <code>WebClient</code> bean. By centralizing this logic in a filter function, the <code>WebClient</code> itself becomes responsible for ensuring the token is generated and attached before each call, keeping service classes clean.',
      '<code>ExchangeFilterFunction</code> is a functional interface receiving the current <code>ClientHttpRequest</code> and the next <code>ExchangeFunction</code> in the chain. A critical detail is that the <code>ClientHttpRequest</code> is <em>immutable</em> — calling <code>request.getHeaders().set(...)</code> throws <code>UnsupportedOperationException</code>. Instead, you must use <code>ClientRequest.from(request)</code> to create a builder from the existing request, modify the builder, build a new <code>ClientRequest</code>, and pass that to <code>next.exchange(...)</code>.',
      'The demo shows a <code>tokenGenerator()</code> filter that generates a bearer token, prints it for verification, builds a modified request with the token in the <code>Authorization</code> header, and forwards it. When the <code>WebClient</code> is built, the filter is registered via <code>.filter(tokenGenerator())</code>. Running five requests in a loop confirms that a new token is generated and sent for each individual call.',
    ],
    keyPoints: [
      '<strong>ExchangeFilterFunction</strong> is the <code>WebClient</code> equivalent of WebFlux\'s <code>WebFilter</code>, handling cross-cutting concerns for <em>outgoing</em> requests.',
      'The <code>ClientHttpRequest</code> passed to the filter is <strong>immutable</strong> — use <code>ClientRequest.from(request)</code> to create a mutable builder, modify it, and build a new request.',
      'The filter is a functional interface: <code>(request, next) -&gt; next.exchange(modifiedRequest)</code> — always forward to the next <code>ExchangeFunction</code> in the chain.',
      'Register filters on the <code>WebClient.Builder</code> using <code>.filter(exchangeFilterFunction)</code> so they apply to every request sent by that client.',
      'Centralizing token generation in a filter prevents duplicating auth logic across multiple service classes that share the same <code>WebClient</code> bean.',
    ],
    code: `package com.example.webclientdemo.section07;

import org.junit.jupiter.api.Test;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.reactive.function.client.ClientRequest;
import org.springframework.web.reactive.function.client.ExchangeFilterFunction;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;

import java.util.List;

public class ExchangeFilterTest extends AbstractWebClient {

    private static final Logger log = LoggerFactory.getLogger(ExchangeFilterTest.class);

    // Generates a fresh bearer token on every request invocation
    private ExchangeFilterFunction tokenGenerator() {
        return (request, next) -> {
            // Generate a new token (in production, delegate to a utility/config class)
            String token = generateToken();
            log.info("Generated token: {}", token);

            // ClientHttpRequest is immutable — use ClientRequest.from() to create a builder
            ClientRequest modifiedRequest = ClientRequest.from(request)
                    .headers(headers -> headers.setBearerAuth(token))
                    .build();

            // Forward the modified request to the next filter in the chain
            return next.exchange(modifiedRequest);
        };
    }

    // Simulated token generation (replace with real auth-server call in production)
    private String generateToken() {
        return "Bearer " + System.currentTimeMillis();
    }

    @Test
    public void exchangeFilterTest() {
        List<Integer> productIds = List.of(1, 2, 3, 4, 5);

        WebClient client = WebClient.builder()
                .baseUrl("http://localhost:7070")
                // Attach the filter so every request gets a fresh token
                .filter(tokenGenerator())
                .build();

        Flux<Product> products = Flux.fromIterable(productIds)
                .flatMap(productId -> client.get()
                        .uri("/demo09/lecture09/product/{id}", productId)
                        .retrieve()
                        .bodyToMono(Product.class));

        StepVerifier.create(products)
                .expectNextCount(5)
                .verifyComplete();
    }
}`,
    codeLabel: 'java',
    note: {
      label: 'WARNING',
      text: 'The <code>ClientHttpRequest</code> object passed to the filter is immutable. Attempting to modify headers directly via <code>request.getHeaders().set(...)</code> will throw <code>UnsupportedOperationException</code>. Always use <code>ClientRequest.from(request)</code> to create a new builder.',
      tone: 'accent',
    },
    quiz: {
      question: 'Why must you use <code>ClientRequest.from(request)</code> inside an <code>ExchangeFilterFunction</code> instead of directly modifying the request\'s headers?',
      options: [
        { label: 'Because <code>ClientHttpRequest</code> is immutable and direct mutation throws <code>UnsupportedOperationException</code>', correct: true },
        { label: 'Because <code>ClientRequest.from()</code> is required to serialize the request body', correct: false },
        { label: 'Because the filter chain only accepts newly built requests, not existing ones', correct: false },
        { label: 'Because direct header modification would bypass the next <code>ExchangeFunction</code>', correct: false },
      ],
      explanation: 'The <code>ClientHttpRequest</code> passed into the filter is immutable. Calling <code>request.getHeaders().set(...)</code> throws <code>UnsupportedOperationException</code>. <code>ClientRequest.from(request)</code> creates a builder copied from the original request, allowing you to modify headers and build a new <code>ClientRequest</code> to pass to <code>next.exchange()</code>.',
    },
  },
  {
    id: '9.16',
    title: 'Assignment: Request Logging Exchange Filter Function',
    duration: '2 min',
    kind: 'assignment',
    summary: [
      'Create an <code>ExchangeFilterFunction</code> that logs the HTTP method and full URL of every outgoing request. This filter should not modify the request in any way — it simply intercepts the request, prints its method and URL, and then passes it unmodified to the next handler in the chain.',
      'The solution defines a filter named <code>requestLogger</code> that accepts the <code>ClientRequest</code> and <code>ExchangeFunction</code> as parameters. Before delegating to <code>next.exchange(request)</code>, it logs <code>request.method()</code> and <code>request.url()</code>. This filter is then attached to the <code>WebClient</code> builder alongside any existing filters (such as the bearer auth filter from the previous lesson), demonstrating that multiple filter functions can be chained together.',
    ],
    keyPoints: [
      'An <code>ExchangeFilterFunction</code> can observe a request without modifying it by passing the original <code>ClientRequest</code> directly to <code>next.exchange(request)</code>.',
      'Use <code>request.method()</code> and <code>request.url()</code> to access the HTTP method and full URI of the outgoing request.',
      'Multiple filter functions can be attached to a single <code>WebClient</code> — they execute in order, forming a filter chain.',
      'This pattern is useful for cross-cutting concerns like logging, metrics, and tracing without polluting business logic.',
    ],
    code: `package com.example.webclient.filters;

import org.springframework.web.reactive.function.client.ClientRequest;
import org.springframework.web.reactive.function.client.ExchangeFilterFunction;
import org.springframework.web.reactive.function.client.ExchangeFunction;
import org.springframework.web.reactive.function.client.WebClient;

public class WebClientConfig {

    // ExchangeFilterFunction that logs HTTP method and URL for every request
    ExchangeFilterFunction requestLogger = (ClientRequest request, ExchangeFunction next) -> {
        System.out.println("Request URL: " + request.method() + " " + request.url());
        return next.exchange(request);
    };

    public WebClient webClient() {
        return WebClient.builder()
                .baseUrl("https://api.example.com")
                // ... (bearer auth filter from lesson 9.14)
                .filter(requestLogger)
                .build();
    }
}`,
    codeLabel: 'java',
    note: {
      label: 'WHEN TO USE',
      text: 'Logging filters are invaluable in development for tracing outgoing requests, but in production consider using a logging framework with conditional log levels to avoid excessive output.',
      tone: 'accent',
    },
    quiz: {
      question: 'If your exchange filter function only needs to log the request without modifying it, what should it return?',
      options: [
        { label: 'next.exchange(request) with the original, unmodified request', correct: true },
        { label: 'A new ClientRequest built with modified headers', correct: false },
        { label: 'Mono.empty() to short-circuit the chain', correct: false },
        { label: 'next.exchange(request) only if logging succeeds, otherwise Mono.error()', correct: false },
      ],
      explanation: 'Since the filter does not modify the request, it should pass the original ClientRequest directly to next.exchange(request). This delegates to the next filter (or the actual HTTP call) without altering anything.',
    },
  },
  {
    id: '9.17',
    title: 'WebClient Attributes',
    duration: '4 min',
    kind: 'demo',
    summary: [
      'WebClient attributes allow you to pass key-value metadata alongside a request, making that data accessible to filter functions in the chain. This mirrors the concept of <code>ServerWebExchange</code> attributes in Spring WebFlux\'s server-side web filters, where one filter can share information with downstream filters or even controllers. With WebClient, the same mechanism lets one <code>ExchangeFilterFunction</code> communicate context to another, or lets a service class control filter behavior on a per-request basis.',
      'The practical motivation is reusability: a single configured <code>WebClient</code> bean is often injected into multiple service classes. One service might want request logging enabled, while another might not. Instead of creating separate <code>WebClient</code> beans or duplicating filter logic, you can attach an attribute at the call site and have the filter read it to decide whether to act. This keeps your WebClient configuration DRY while allowing per-request customization.',
      'In this demo, the existing <code>RequestLoggingFilter</code> (from the exchange filter function lesson) is modified to check a boolean attribute key <code>"enable-logging"</code>. The filter reads this attribute from the <code>ClientRequest</code> attributes map with a default of <code>false</code>, and only logs when the value is <code>true</code>. The service class then sets this attribute conditionally — in this case, enabling logging only for even-numbered product IDs — demonstrating fine-grained, per-request control over filter behavior without modifying the WebClient bean itself.',
    ],
    keyPoints: [
      'Attributes are a <code>Map&lt;String, Object&gt;</code> on <code>ClientRequest</code> that let filter functions share per-request context, analogous to <code>ServerWebExchange</code> attributes on the server side.',
      'A single <code>WebClient</code> bean can serve multiple service classes with different needs by using attributes to toggle or parameterize filter behavior at the call site.',
      'Use <code>request.attributes().getOrDefault(key, default)</code> inside an <code>ExchangeFilterFunction</code> to read per-request metadata and conditionally execute logic.',
      'Attributes are set per-request via <code>.attribute(key, value)</code> on the WebClient builder chain, keeping the shared WebClient bean unchanged.',
      'Common use cases include conditional logging, tracing IDs, correlation IDs, or feature flags passed from service classes to reusable filters.',
    ],
    code: `// ... (Product entity and WebClient bean from earlier lessons)

package section09.filter;

import org.springframework.web.reactive.function.client.ClientRequest;
import org.springframework.web.reactive.function.client.ExchangeFilterFunction;
import reactor.core.publisher.Mono;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class RequestLoggingFilter {

    private static final Logger log = LoggerFactory.getLogger(RequestLoggingFilter.class);

    public static ExchangeFilterFunction logRequest() {
        return (request, next) -> {
            Boolean isEnabled = (Boolean) request.attributes()
                    .getOrDefault("enable-logging", false);

            if (isEnabled) {
                log.info("Request: {} {}", request.method(), request.url());
            }

            return next.exchange(request);
        };
    }
}

// --- Service class using the attribute per-request ---

package section09.service;

import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;
import section09.entity.Product;

@Service
public class ProductService {

    private final WebClient webClient;

    public ProductService(WebClient webClient) {
        this.webClient = webClient;
    }

    public Mono<Product> getProductById(int productId) {
        return webClient.get()
                .uri("/products/{id}", productId)
                .attribute("enable-logging", productId % 2 == 0) // log only even-numbered products
                .retrieve()
                .bodyToMono(Product.class);
    }
}`,
    codeLabel: 'java',
    note: {
      label: 'WHEN TO USE',
      text: 'Use attributes when a single shared WebClient bean needs per-request customization of filter behavior — such as conditional logging, tracing, or feature flags — without creating separate WebClient instances or hardcoding logic inside filters.',
      tone: 'green',
    },
    quiz: {
      question: 'How does a filter function access a per-request attribute set via `.attribute(key, value)` on the WebClient chain?',
      options: [
        { label: 'Via `request.attributes().getOrDefault(key, default)`', correct: true },
        { label: 'Via `request.headers().get(key)`', correct: false },
        { label: 'Via a method parameter injected by Spring', correct: false },
        { label: 'Attributes are only available server-side, not in WebClient', correct: false },
      ],
      explanation: 'ClientRequest exposes a `Map<String, Object>` through `request.attributes()`. Filter functions call `getOrDefault` with a key and sensible default to read per-request metadata set at the call site. Headers are a separate mechanism and attributes are distinct from Spring-injected parameters.',
    },
  },
  {
    id: '9.18',
    title: 'Summary',
    duration: '5 min',
    kind: 'summary',
    summary: [
      '<code>WebClient</code> is Spring\'s reactive, non-blocking HTTP client built on top of Reactor Netty. It is immutable and thread-safe, which means a single instance can be shared across the application. The standard practice is to configure one <code>WebClient</code> bean per remote service dependency, pre-configured with a base URL and default headers (such as authentication tokens), and then inject it wherever outbound requests are needed. Because the client is immutable, any runtime configuration changes require calling <code>mutate()</code> to create a new builder, applying the changes, and calling <code>build()</code> to produce a new client instance.',
      'For simple GET requests, you chain <code>get().uri(...).retrieve()</code>, which triggers the request and handles the response. The <code>bodyToMono()</code> method decodes the response body into the target type, seamlessly integrating the result into your reactive pipeline. For URLs with path variables or query parameters, you should avoid manual string concatenation. Instead, use URI template variables (e.g., <code>uri("/path/{id}", id)</code>) or pass a map of key-value pairs to keep the code clean and maintainable.',
      'When sending data via POST or PUT, the choice between <code>bodyValue()</code> and <code>body()</code> depends on the source of the request body. <code>bodyValue()</code> is used for in-memory objects, while <code>body()</code> is used when the body is provided asynchronously as a <em>Publisher</em> (like a <code>Mono</code>), requiring you to specify both the publisher and the class type it emits. While <code>retrieve()</code> is the standard approach for fetching responses, the <code>exchangeToMono()</code> method provides lower-level access to the <code>ClientResponse</code>, allowing you to inspect status codes, headers, and cookies before deciding how to decode the body.',
      'Finally, <code>ExchangeFilterFunction</code> components handle cross-cutting concerns for outbound requests—such as logging, monitoring, and setting authentication tokens—similar to server-side <code>WebFilter</code>s. Attributes can be passed from service classes into the filter chain or shared between filters, allowing dynamic behavior modification based on contextual data passed at request time.',
    ],
    keyPoints: [
      '<strong>Single Bean Configuration:</strong> Create one immutable, thread-safe <code>WebClient</code> bean per external service, pre-configured with base URLs and default headers.',
      '<strong>Immutability & Mutation:</strong> Use <code>mutate()</code> to create a new builder if you need to modify configurations (like adding a specific header) without altering the original shared bean.',
      '<strong>Response Decoding:</strong> Use <code>retrieve().bodyToMono()</code> for standard requests, and <code>exchangeToMono()</code> when you need fine-grained access to status codes, headers, or cookies.',
      '<strong>Body Publishers:</strong> Use <code>bodyValue()</code> for synchronous, in-memory objects. Use <code>body()</code> with a <code>Publisher</code> and target class for asynchronous body generation.',
      '<strong>Cross-Cutting Concerns:</strong> Use <code>ExchangeFilterFunction</code> for logging, metrics, and auth on outbound requests, leveraging attributes to pass context between filters or from service classes.',
    ],
    code: `java`,
    codeLabel: 'WebClient Usage Recap',
    note: {
      label: 'WHY THIS MATTERS',
      text: 'WebClient\'s fluent, immutable design ensures thread safety and predictable behavior in high-concurrency reactive applications. By centralizing configuration in beans and using filters for cross-cutting concerns, you keep service classes focused purely on business logic.',
      tone: 'accent',
    },
    quiz: {
      question: 'You need to send a POST request where the request body is generated asynchronously and emitted by a Mono. Which method should you use to attach the body to the request?',
      options: [
        { label: 'bodyValue()', correct: false },
        { label: 'body()', correct: true },
        { label: 'retrieve()', correct: false },
        { label: 'exchangeToMono()', correct: false },
      ],
      explanation: 'bodyValue() is used for synchronous, in-memory objects. When the body is provided asynchronously as a Publisher (like a Mono), you must use body() and provide both the Publisher and the class type it emits.',
    },
  },
]
