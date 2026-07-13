export default [
  {
    id: '2.1',
    title: 'Project Setup',
    duration: '3 min',
    kind: 'setup',
    summary: [
      'This section kicks off the hands-on exploration of Spring WebFlux and Spring Data R2DBC (reactive relational database access). Rather than building a production-grade application right away, we create a <em>playground project</em> — a sandbox environment dedicated to understanding how the reactive stack components work together. Roughly 80% of the upcoming lessons focus on learning and experimentation within this project before applying the knowledge to microservices with integration tests later in the course.',
      'The project is generated via Spring Initializr (start.spring.io) as a Maven project with Java 21 (Java 17 is the minimum). The key dependencies selected are <code>Spring Reactive Web</code> (which brings in Spring WebFlux, the reactive-stack web framework built on Project Reactor and Netty), <code>Spring Data R2DBC</code> (reactive relational database access using the Reactive Relational Database Connectivity API), and <code>H2 Database</code> (an in-memory database for quick prototyping). The project uses JAR packaging.',
      'Once generated, the project is imported into IntelliJ IDEA (or any preferred IDE). All code written throughout this playground project is committed to a GitHub repository that is maintained and updated as Spring Boot versions evolve. Learners are encouraged to code along in parallel and bookmark the repository for reference when encountering version-related differences.',
    ],
    keyPoints: [
      'Generate a Maven project from <a href="https://start.spring.io">start.spring.io</a> with Java 21 (minimum 17) and JAR packaging',
      'Select three dependencies: <strong>Spring Reactive Web</strong> (WebFlux), <strong>Spring Data R2DBC</strong>, and <strong>H2 Database</strong>',
      'Group ID <code>com.cummins.group</code>, artifact ID <code>flexplayground</code> — names can be customized',
      'This is a sandbox/playground project, not production code — the focus is on understanding the reactive stack',
      'All code lives in a GitHub repository that is periodically updated as Spring Boot versions change',
      '<strong>R2DBC</strong> stands for Reactive Relational Database Connectivity, bringing non-blocking data access to relational databases',
    ],
    note: {
      label: 'WHY THIS MATTERS',
      text: 'Using a playground project lets you experiment freely with WebFlux and R2DBC without the overhead of production concerns. The H2 in-memory database eliminates external setup, so you can focus entirely on understanding reactive data flow.',
      tone: 'accent',
    },
    quiz: {
      question: 'Which three dependencies should you select when generating the playground project from Spring Initializr?',
      options: [
        { label: 'Spring Web, Spring Data JPA, H2 Database', correct: false },
        { label: 'Spring Reactive Web, Spring Data R2DBC, H2 Database', correct: true },
        { label: 'Spring WebFlux, Spring Data MongoDB Reactive, PostgreSQL', correct: false },
        { label: 'Spring Reactive Web, Spring Data JDBC, MySQL', correct: false },
      ],
      explanation: 'The playground project uses Spring Reactive Web (WebFlux) for the reactive web stack, Spring Data R2DBC for reactive relational database access, and H2 as the in-memory database for prototyping. Spring Data JPA and Spring Web are blocking alternatives that do not belong in a reactive stack.',
    },
  },
  {
    id: '2.2',
    title: 'External Services',
    duration: '3 min',
    kind: 'setup',
    summary: [
      'To compare blocking (traditional) and reactive web stacks side by side, we need a realistic external dependency that simulates slow I/O. A pre-built Spring Boot JAR called <code>external-services.jar</code> acts as a product service running on port 7070. Its key endpoint — <code>GET /demo01/products</code> — generates up to ten products, each taking roughly one second to produce, so a full response takes about ten seconds. This latency simulates a slow remote service, which is exactly the scenario where reactive programming shines.',
      'The external service exposes a Swagger UI at <code>http://localhost:7070</code> where you can explore and test its endpoints. The <code>demo01</code> section contains the product endpoint we will call from our playground application. The response is a simple JSON array of product objects with <code>id</code>, <code>description</code>, and <code>price</code> fields.',
      'In our playground project, we will build two controllers: a traditional (blocking) controller and a reactive controller. Both will call the same product service endpoint and return the same data, allowing us to observe how each approach handles the ten-second latency differently. This side-by-side comparison is the foundation for understanding the architectural shift from blocking I/O to reactive web.',
    ],
    keyPoints: [
      'Run <code>external-services.jar</code> on port 7070 (configurable) to simulate a slow product service',
      'The endpoint <code>GET /demo01/products</code> returns up to 10 products, each taking ~1 second — total response time ~10 seconds',
      'Swagger UI is available at <code>http://localhost:7070</code> to explore and test endpoints',
      'Product JSON contains <code>id</code>, <code>description</code>, and <code>price</code> fields',
      'Our playground app will have two controllers — traditional and reactive — both calling the same external service for direct comparison',
    ],
    code: `# Start the external services JAR
java -jar external-services.jar

# The service starts on port 7070 by default.
# To change the port:
java -jar external-services.jar --server.port=8081

# Test the product endpoint (expect ~10 second response time):
curl http://localhost:7070/demo01/products

# Sample response:
# [
#   {"id":1,"description":"Product 1","price":1.0},
#   {"id":2,"description":"Product 2","price":2.0},
#   ...
#   {"id":10,"description":"Product 10","price":10.0}
# ]`,
    codeLabel: 'terminal',
    note: {
      label: 'WHY THIS MATTERS',
      text: 'The 10-second simulated latency is the crux of this entire section. When a blocking thread waits 10 seconds for a remote service, it occupies a server thread doing nothing. Reactive programming allows that thread to be released during the wait, which is why we need a slow service to see the difference.',
      tone: 'accent',
    },
    quiz: {
      question: 'Why does the external product service intentionally take ~10 seconds to respond?',
      options: [
        { label: 'To simulate a slow remote service so we can observe how blocking vs reactive stacks handle I/O wait time differently', correct: true },
        { label: 'Because the service is poorly optimized and we need to fix its performance', correct: false },
        { label: 'To test network timeout handling in our application', correct: false },
        { label: 'To generate a large response payload that stresses memory usage', correct: false },
      ],
      explanation: 'The 10-second delay simulates a realistic slow remote service. This is the key scenario where reactive programming\'s non-blocking I/O model differs from traditional blocking I/O — the reactive stack can release threads during the wait while the blocking stack cannot.',
    },
  },
  {
    id: '2.3',
    title: 'Traditional vs Reactive API',
    duration: '9 min',
    kind: 'demo',
    summary: [
      'Building on the external services from the previous lesson, this lesson creates two REST controllers side by side: one using traditional blocking I/O and one using reactive programming. Both expose a <code>/products</code> endpoint that calls the same external product service at <code>http://localhost:7070/demo01/products</code>, allowing a direct comparison of their behavior.',
      'The traditional controller uses Spring\'s <code>RestClient</code> (the modern synchronous replacement for <code>RestTemplate</code>) to fetch a <code>List&lt;Product&gt;</code>. Because the response is a generic list, a <code>ParameterizedTypeReference</code> is required to preserve type information at runtime (Java\'s type erasure prevents passing <code>List&lt;Product&gt;.class</code> directly). The call blocks the calling thread until the external service responds, then logs and returns the full list.',
      'The reactive controller uses <code>WebClient</code> (the reactive equivalent of <code>RestClient</code>) and returns a <code>Flux&lt;Product&gt;</code> instead of a <code>List</code>. A <code>Flux</code> represents 0..N asynchronous items — the pipeline is assembled immediately but no HTTP request is sent until something subscribes. The <code>doOnNext</code> operator logs each product as it arrives, illustrating the reactive callback style where items are processed individually as they flow through the pipeline rather than all at once after a blocking call completes.',
      'A <code>Product</code> Java record with <code>id</code>, <code>description</code>, and <code>price</code> fields serves as the shared data model. Both controllers use <code>baseUrl</code> on their respective HTTP clients so only the path (<code>/demo01/products</code>) is specified per request — this makes it easy to swap environments (dev, QA, prod) via configuration without changing endpoint paths.',
    ],
    keyPoints: [
      '<strong>RestClient</strong> is Spring\'s modern synchronous HTTP client (replacement for <code>RestTemplate</code>); <strong>WebClient</strong> is its reactive counterpart.',
      'Traditional controllers return <code>List&lt;Product&gt;</code> (blocking, all-at-once); reactive controllers return <code>Flux&lt;Product&gt;</code> (async, item-by-item stream).',
      'Use <code>ParameterizedTypeReference&lt;List&lt;Product&gt;&gt;</code> with <code>RestClient</code> to deserialize generic collections — needed because Java erases generic types at runtime.',
      'Use <code>bodyToFlux(Product.class)</code> with <code>WebClient</code> to convert the response into a reactive stream of individual items.',
      '<code>doOnNext</code> is a side-effect operator that fires for each item emitted by a <code>Flux</code> — useful for logging without consuming the stream.',
      'Setting <code>baseUrl</code> on the HTTP client separates host/port from endpoint paths, simplifying environment-specific configuration.',
    ],
    code: `package com.example.demo.section01;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestClient;

import java.util.List;

public record Product(Integer id, String description, Integer price) {}

// ==================== Traditional Controller ====================

@RestController
@RequestMapping("/traditional")
public class TraditionalWebController {

    private static final Logger logger = LoggerFactory.getLogger(TraditionalWebController.class);

    private final RestClient restClient;

    public TraditionalWebController() {
        this.restClient = RestClient.builder()
                .baseUrl("http://localhost:7070")
                .build();
    }

    @GetMapping("/products")
    public List<Product> getProducts() {
        List<Product> products = restClient.get()
                .uri("/demo01/products")
                .retrieve()
                .body(new ParameterizedTypeReference<List<Product>>() {});
        logger.info("Received response: {}", products);
        return products;
    }
}

// ==================== Reactive Controller ====================

import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Flux;

@RestController
@RequestMapping("/reactive")
public class ReactiveWebController {

    private static final Logger logger = LoggerFactory.getLogger(ReactiveWebController.class);

    private final WebClient webClient;

    public ReactiveWebController() {
        this.webClient = WebClient.builder()
                .baseUrl("http://localhost:7070")
                .build();
    }

    @GetMapping("/products")
    public Flux<Product> getProducts() {
        return webClient.get()
                .uri("/demo01/products")
                .retrieve()
                .bodyToFlux(Product.class)
                .doOnNext(product -> logger.info("Received: {}", product));
    }
}`,
    codeLabel: 'java',
    note: {
      label: 'KEY INSIGHT',
      text: 'The traditional controller blocks the servlet container thread for the entire duration of the external call, while the reactive controller returns a <code>Flux</code> immediately and processes items asynchronously as they arrive — freeing the thread to handle other requests.',
      tone: 'accent',
    },
    quiz: {
      question: 'Why must you use ParameterizedTypeReference<List<Product>> when calling RestClient.body() for a list response, but bodyToFlux(Product.class) works fine for WebClient?',
      options: [
        { label: 'WebClient doesn\'t suffer from type erasure because it uses reactive types internally', correct: false },
        { label: 'bodyToFlux extracts individual Product elements one at a time, so only the element type is needed — no generic List type to erase', correct: true },
        { label: 'RestClient is older and lacks built-in generic type support', correct: false },
        { label: 'It\'s a design oversight in Spring and both should accept List<Product>.class', correct: false },
      ],
      explanation: 'WebClient\'s bodyToFlux deserializes the response into a stream of individual Product elements, so only Product.class is needed. RestClient.body() must deserialize the entire JSON array into a List<Product> at once, and Java\'s type erasure means List<Product>.class doesn\'t exist at runtime — ParameterizedTypeReference captures the generic type information so the deserializer knows the element type.',
    },
  },
  {
    id: '2.4',
    title: 'Traditional vs Reactive API - Demo',
    duration: '6 min',
    kind: 'demo',
    summary: [
      'Building on the two controllers from the previous lesson, this demo sends real HTTP requests to both the traditional (<code>/traditional/products</code>) and reactive (<code>/reactive/products</code>) endpoints to observe how each handles a slow external service (port 7070, 10-second delay). The external service and the main application (port 8080) are both started, and <code>curl</code> is used as the client.',
      'When the traditional endpoint is called, the external service receives the request and takes 10 seconds to return all 10 products. The server-side console only prints the products <em>after</em> the entire list arrives. Critically, if the client cancels the request (e.g., <code>Ctrl+C</code> in curl) mid-flight, the traditional controller <em>continues processing</em> — the external service still completes its work and the server still prints all 10 products. The blocking pipeline is oblivious to client cancellation.',
      'The reactive endpoint behaves fundamentally differently. As each product arrives from the external service, the reactive controller prints it to the console immediately (via <code>doOnNext</code>) — there is no 10-second wait for the full batch. When the client cancels, the reactive pipeline <em>stops immediately</em>: no further products are printed, and the external service is also signaled to stop (via reactive back-pressure/cancellation propagation through the HTTP client).',
      'A notable detail: <code>curl</code> buffers output by default, so even though the reactive endpoint streams items, curl waits for the full response before printing. Using <code>curl -N</code> (no buffering) reveals the true streaming behavior — products appear one-by-one as they arrive. Browsers generally do not buffer in this way. Applying <code>-N</code> to the traditional endpoint makes no difference: it still waits the full 10 seconds and still ignores cancellation.',
    ],
    keyPoints: [
      '<strong>Blocking pipelines ignore client cancellation</strong>: even after <code>Ctrl+C</code>, the traditional controller and external service continue doing all the work.',
      '<strong>Reactive pipelines propagate cancellation</strong>: when the client disconnects, the reactive chain stops immediately and the downstream external service is also canceled.',
      '<strong>Streaming vs batching</strong>: the reactive controller prints each product as it arrives (<code>doOnNext</code>); the traditional controller waits for the complete list before doing anything.',
      '<code>curl -N</code> disables output buffering, making the streaming behavior visible in the terminal — without it, curl appears to wait for the full response.',
      'This demo visually confirms the core architectural difference: reactive pipelines are <em>lazy and cancellable</em>, while blocking pipelines are <em>eager and unstoppable</em> once started.',
    ],
    code: `terminal`,
    codeLabel: 'terminal',
    note: {
      label: 'KEY INSIGHT',
      text: 'The most important observation is cancellation propagation. In a reactive pipeline, when the client disconnects, the entire chain — including the upstream HTTP call to the external service — is signaled to stop. In a blocking pipeline, the server thread keeps running to completion regardless of whether anyone is listening to the response.',
      tone: 'accent',
    },
    quiz: {
      question: 'You call the reactive /reactive/products endpoint with `curl -N` and press Ctrl+C after 3 products have streamed. What happens on the server side?',
      options: [
        { label: 'The server continues processing all 10 products just like the traditional endpoint', correct: false },
        { label: 'The reactive pipeline stops immediately and the external service is also signaled to cancel', correct: true },
        { label: 'The reactive pipeline stops but the external service continues to completion', correct: false },
        { label: 'An exception is thrown on the server and the application crashes', correct: false },
      ],
      explanation: 'Reactive pipelines propagate cancellation signals upstream. When the client disconnects, the entire chain — including the HTTP client call to the external service — receives the cancel signal and stops. This is a fundamental difference from blocking pipelines, which continue processing to completion regardless of client cancellation.',
    },
  },
  {
    id: '2.5',
    title: 'Traditional vs Reactive API - Demo via Browser',
    duration: '2 min',
    kind: 'demo',
    summary: [
      'Building on the curl-based demo from the previous lesson, this lesson demonstrates the same two endpoints (<code>/reactive/products</code> and <code>/traditional/products</code>) through a browser instead. The key difference is that a browser introduces user-driven refresh behavior: when a user hits refresh while a request is still in flight, the browser cancels the previous request and issues a new one. This reveals a significant behavioral gap between the reactive and traditional approaches.',
      'When hitting the reactive endpoint and repeatedly refreshing, the reactive pipeline detects that the previous request was cancelled and immediately stops processing it — the upstream <code>Flux</code> subscription is disposed, so no further work is done for the abandoned request. The server focuses only on the newest request. This is a natural consequence of the reactive subscription model: cancellation propagates upstream through the operator chain, halting data flow from the external services.',
      'In contrast, when hitting the traditional endpoint and refreshing repeatedly, the server continues processing every previously submitted request to completion. Because the blocking servlet-thread model has no built-in mechanism to propagate client cancellation back through the service layer, each refresh spawns a new thread that runs to completion — even though the browser has already discarded the response. The result is wasted server resources: threads stay occupied, external service calls continue, and the server does progressively more work for responses nobody will read.',
    ],
    keyPoints: [
      'Browser refresh cancels the in-flight HTTP request and issues a new one — the reactive pipeline respects this cancellation and stops processing immediately.',
      'Reactive <code>Flux</code> subscriptions propagate cancellation upstream, halting further external service calls for the abandoned request.',
      'The traditional blocking model has no mechanism to propagate client cancellation, so every refresh spawns work that runs to completion regardless.',
      'Under repeated refreshes, the traditional server accumulates unnecessary thread usage and external service calls — wasted work for discarded responses.',
      'This demo visually illustrates the resource-efficiency advantage of reactive web: the server only does work that the client actually wants.',
    ],
    note: {
      label: 'KEY INSIGHT',
      text: 'Reactive pipelines propagate client cancellation upstream, so abandoned requests stop consuming server resources immediately. Blocking servlet threads, by contrast, run to completion even when the client has already moved on.',
      tone: 'accent',
    },
    quiz: {
      question: 'When a user repeatedly refreshes the browser while a request to the traditional endpoint is still in flight, what happens on the server side?',
      options: [
        { label: 'The server cancels the previous request and only processes the newest one, just like the reactive endpoint.', correct: false },
        { label: 'The server continues processing every previously submitted request to completion, wasting threads and external service calls.', correct: true },
        { label: 'The server queues all refresh requests and processes them sequentially after the first response arrives.', correct: false },
        { label: 'The server returns an error for all but the first request because the thread pool is exhausted.', correct: false },
      ],
      explanation: 'The traditional blocking model has no mechanism to propagate the browser\'s cancellation signal back through the service layer. Each refresh spawns a new request that runs to completion on its own thread, even though the browser has already discarded the previous response. The reactive model, by contrast, disposes the upstream subscription on cancellation, immediately halting further work.',
    },
  },
  {
    id: '2.6',
    title: 'Exposing Streaming API',
    duration: '3 min',
    kind: 'demo',
    summary: [
      'In the previous lessons, the reactive controller returned <code>Flux&lt;Product&gt;</code> with the default <code>application/json</code> content type. While the server processes items reactively as they arrive, the browser treats <code>application/json</code> as a single buffered response — it waits for the entire JSON array before displaying anything. To stream items to the browser one-by-one as they are emitted, we need a different content type.',
      'The solution is to set the <code>produces</code> attribute on the endpoint to <code>MediaType.TEXT_EVENT_STREAM_VALUE</code>. This maps to the <em>Server-Sent Events (SSE)</em> standard — a text-based protocol over HTTP where the server pushes data chunks to the client as they become available. SSE uses HTTP chunked transfer encoding under the hood, so the browser renders each event immediately rather than buffering the full response.',
      'The implementation is a one-line change: duplicate the existing reactive <code>products</code> endpoint, rename it to <code>productStream</code>, and add <code>produces = MediaType.TEXT_EVENT_STREAM_VALUE</code> to the <code>@GetMapping</code> annotation. The method body — returning the same <code>Flux&lt;Product&gt;</code> from the reactive service — stays unchanged. When you navigate to this new endpoint in the browser, each product appears on screen the moment it arrives from the upstream service, rather than all at once after a delay.',
    ],
    keyPoints: [
      'Default <code>application/json</code> responses are buffered by the browser — the client waits for the complete payload before rendering.',
      '<code>MediaType.TEXT_EVENT_STREAM_VALUE</code> (<em>Server-Sent Events</em>) tells the browser to treat the response as a stream, rendering each chunk as it arrives.',
      'Only the <code>produces</code> attribute changes — the method body returning <code>Flux&lt;Product&gt;</code> remains identical to the non-streaming reactive endpoint.',
      'SSE is a standard HTTP-based streaming protocol using chunked transfer encoding; no WebSocket or special client library is needed.',
      'A dedicated section later in the course covers SSE and streaming in greater depth.',
    ],
    code: `package com.example.section02.controller;

import com.example.section02.entity.Product;
import com.example.section02.service.ProductService;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Flux;

@RestController
@RequestMapping("/products")
public class ProductController {

    private final ProductService productService;

    public ProductController(ProductService productService) {
        this.productService = productService;
    }

    // ... existing endpoint from lesson 2.4
    @GetMapping
    public Flux<Product> products() {
        return productService.getProducts();
    }

    // NEW: streaming endpoint — same Flux, different content type
    @GetMapping(value = "/product-stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<Product> productStream() {
        return productService.getProducts();
    }
}`,
    codeLabel: 'java',
    note: {
      label: 'KEY INSIGHT',
      text: 'The reactive pipeline already streams items internally — the only thing preventing the browser from seeing them one-by-one was the content type. Switching to SSE unlocks the streaming behavior the Flux already provides.',
      tone: 'accent',
    },
    quiz: {
      question: 'Why does the browser buffer a reactive <code>Flux&lt;Product&gt;</code> response even though the server emits items one at a time?',
      options: [
        { label: 'The default application/json content type signals to the browser that the response is a single complete payload, so it waits for the entire body before rendering.', correct: true },
        { label: 'Flux inherently buffers all elements before returning them, so the server cannot stream items until the full list is ready.', correct: false },
        { label: 'The browser does not support HTTP chunked transfer encoding for JSON responses.', correct: false },
        { label: 'Spring WebFlux automatically converts Flux responses to blocking lists unless explicitly configured otherwise.', correct: false },
      ],
      explanation: 'The Flux itself streams items as they arrive, but the default content type (application/json) tells the browser to treat the response as a single document. Setting produces to text/event-stream makes the browser render each item as it arrives over the SSE stream.',
    },
  },
  {
    id: '2.7',
    title: 'Common Mistake Using Reactive Pipeline',
    duration: '4 min',
    kind: 'demo',
    summary: [
      'A frequent mistake developers make when adopting reactive programming is wrapping a traditional blocking call in <code>Flux.fromIterable()</code> and assuming the result is a truly reactive system. The instructor demonstrates this by copying a traditional blocking controller method — one that calls an external service synchronously via a <code>RestTemplate</code> or similar blocking client — and changing only the return type from <code>List&lt;Product&gt;</code> to <code>Flux&lt;Product&gt;</code>. The method still fetches all data eagerly and blocks the calling thread before the <code>Flux</code> is even created.',
      'Testing this endpoint with <code>curl</code> reveals two telltale problems. First, all ten products arrive at once rather than streaming incrementally — the data was collected synchronously before being wrapped. Second, when the client cancels the <code>curl</code> request mid-stream (e.g., via Ctrl+C), the server does not stop processing. This happens because the external service call happens <em>outside</em> the reactive pipeline. Cancellation signals propagate only through the reactive chain; since the blocking I/O is not part of that chain, the server cannot react to backpressure or cancellation.',
      'The instructor uses a plumbing analogy: imagine the remote data source as a water tank and the <code>Flux</code> as a pipeline connecting the tank to the consumer. One end attaches to the source, the other end lets the consumer drain data and stop the flow at will. If the data retrieval happens outside the pipeline (as in this anti-pattern), there is no pipe to send a stop signal through — the server keeps fetching data regardless of what the client does. This is why merely returning a <code>Flux</code> from a blocking method only keeps the compiler happy without delivering any reactive benefits.',
    ],
    keyPoints: [
      'Wrapping a blocking call\'s result in <code>Flux.fromIterable()</code> does <strong>not</strong> make code reactive — it only satisfies the return type.',
      'Cancellation and backpressure signals propagate only through the reactive pipeline; I/O performed outside the chain cannot be stopped.',
      'A truly reactive endpoint streams data incrementally and responds to client cancellation — if all data arrives at once, the pipeline is fake.',
      'Use a reactive HTTP client (e.g., <code>WebClient</code>) so that the external service call is part of the reactive pipeline and respects backpressure.',
      'Understanding the core pillars of reactive programming is essential before writing code — superficially using reactive types provides no real benefit.',
    ],
    code: `package com.example.traditionalvsreactive.controller;

import com.example.traditionalvsreactive.entity.Product;
import com.example.traditionalvsreactive.service.TraditionalProductService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Flux;

import java.util.List;

@RestController
@RequestMapping("/traditional/products")
public class TraditionalProductController {

    @Autowired
    private TraditionalProductService productService;

    // Original blocking endpoint — returns List<Product>
    @GetMapping
    public List<Product> getProducts() {
        return productService.getProductsBlocking(); // blocks the thread
    }

    // ❌ ANTI-PATTERN: wraps a blocking call in Flux — NOT truly reactive
    @GetMapping("/two")
    public Flux<Product> getProductsTwo() {
        List<Product> products = productService.getProductsBlocking(); // blocking I/O OUTSIDE the pipeline
        return Flux.fromIterable(products); // just wraps the already-fetched list
    }
}

// ✅ CORRECT APPROACH: use a reactive client so the call is part of the pipeline
//
// @GetMapping
// public Flux<Product> getProductsReactive() {
//     return webClient.get()
//         .uri("/products")
//         .retrieve()
//         .bodyToFlux(Product.class);  // I/O happens INSIDE the reactive pipeline
// }`,
    codeLabel: 'java',
    note: {
      label: 'WARNING',
      text: 'Returning Flux&lt;T&gt; does not automatically make your code reactive. If the data is fetched via a blocking client before the Flux is created, cancellation and backpressure signals cannot reach the source — the pipeline is purely cosmetic.',
      tone: 'accent',
    },
    quiz: {
      question: 'You see a controller method that calls a blocking REST client, collects results into a List, then returns Flux.fromIterable(list). What is the main problem?',
      options: [
        { label: 'The code won\'t compile because Flux.fromIterable requires a Set, not a List.', correct: false },
        { label: 'The external service call happens outside the reactive pipeline, so cancellation and backpressure signals cannot propagate to the data source.', correct: true },
        { label: 'There is no problem — wrapping the result in a Flux is all that\'s needed for reactive programming.', correct: false },
        { label: 'The Flux will automatically convert the blocking call to non-blocking at runtime.', correct: false },
      ],
      explanation: 'Flux.fromIterable simply wraps an already-completed collection. Since the blocking I/O happened before the Flux was created, it is outside the reactive pipeline. Cancellation signals from the client have no way to reach the external service, making the \'reactive\' return type purely cosmetic.',
    },
  },
  {
    id: '2.8',
    title: 'How Reactive Web Works - Step By Step',
    duration: '9 min',
    kind: 'concept',
    summary: [
      'Reactive web applications built with Spring WebFlux follow the publisher-subscriber pattern end to end. When a browser sends an HTTP request to a WebFlux controller that returns a <code>Flux&lt;Product&gt;</code>, the browser is effectively the subscriber and the application is the publisher. The subscription is not explicit — the TCP connection established by the HTTP request itself acts as the subscription mechanism. Spring Framework sits between the browser and the controller, and it is Spring that subscribes to the returned publisher on behalf of the client.',
      'The key insight is that the controller method does <em>no work</em> when it is invoked — it merely assembles the reactive pipeline and returns the publisher. The actual HTTP request to the downstream service (via <code>WebClient</code>, which wraps Reactor Netty) is only triggered when Spring subscribes to the returned <code>Flux</code>. As items are emitted (<code>onNext</code>), Spring writes each product to the HTTP response channel and flushes it immediately, so the browser receives data incrementally rather than waiting for the entire collection. For database access, R2DBC (Reactive Relational Database Connectivity) plays the same non-blocking role that <code>WebClient</code> plays for HTTP calls.',
      'Cancellation propagates through the entire chain. When the browser closes the connection, Spring detects it via a channel <code>onClose</code> callback and calls <code>subscription.cancel()</code> on the upstream publisher. This signals <code>WebClient</code> to close its connection to the downstream product service, which can in turn detect the closure and stop producing data. This contrasts sharply with a traditional blocking controller returning <code>List&lt;Product&gt;</code>: the thread must wait synchronously for the entire list to be assembled before anything can be written to the response, making early cancellation impossible and wasting resources. This is why return type matters in WebFlux — <code>Mono</code> or <code>Flux</code> enables streaming and cancellation; a plain <code>List</code> forces blocking behavior.',
    ],
    keyPoints: [
      'Spring Framework subscribes to the returned publisher (<code>Mono</code>/<code>Flux</code>) on behalf of the HTTP client — the browser does not subscribe directly.',
      'The controller method only <em>assembles</em> the reactive pipeline; no actual I/O happens until subscription occurs (lazy execution).',
      '<code>WebClient</code> (wrapping Reactor Netty) sends the downstream HTTP request only when subscribed to, and emits items as they arrive non-blockingly.',
      'Each emitted item is written to the HTTP response channel and flushed immediately, enabling streaming responses instead of buffering the entire payload.',
      'Cancellation propagates upstream: browser closes connection → Spring detects via <code>onClose</code> → <code>subscription.cancel()</code> → <code>WebClient</code> closes downstream connection → downstream service stops producing.',
      'Returning <code>List&lt;Product&gt;</code> in a WebFlux controller forces blocking behavior — the thread waits for the full list before writing anything, defeating the purpose of reactive web.',
    ],
    code: `java`,
    codeLabel: 'java',
    note: {
      label: 'KEY INSIGHT',
      text: 'The return type of your controller method is the single most important decision in a WebFlux application. Returning <code>Flux&lt;Product&gt;</code> enables lazy execution, streaming, and cancellation propagation; returning <code>List&lt;Product&gt;</code> collapses the entire pipeline into a blocking call that wastes the reactive runtime.',
      tone: 'accent',
    },
    quiz: {
      question: 'In a Spring WebFlux controller, what triggers the actual HTTP request to the downstream service via WebClient?',
      options: [
        { label: 'The moment the controller method is invoked by Spring\'s request router', correct: false },
        { label: 'When Spring subscribes to the Flux returned by the controller method', correct: true },
        { label: 'When the browser opens a TCP connection to the server', correct: false },
        { label: 'When WebClient is instantiated in the service layer', correct: false },
      ],
      explanation: 'The controller method only assembles the reactive pipeline and returns the publisher. No I/O occurs until someone subscribes. Spring Framework subscribes to the returned Flux on behalf of the browser, and only at that point does the subscription propagate upstream through WebClient, triggering the actual HTTP request to the downstream service.',
    },
  },
  {
    id: '2.9',
    title: 'FAQ - Should Entire Stack Be Reactive?',
    duration: '1 min',
    kind: 'faq',
    summary: [
      'A frequently asked question when adopting reactive programming is whether the <em>entire</em> stack must be reactive to get any benefit. The ideal scenario is a fully reactive end-to-end stack — this unlocks the complete potential of reactive streams, including continuous streaming with backpressure and maximal resource efficiency. However, in real-world architectures with multiple interconnected applications, a big-bang migration to Spring WebFlux on day one is rarely practical.',
      'The reality is that you will typically migrate one application at a time. If you have a system where one application has been migrated to Spring WebFlux while another remains on Spring MVC (blocking I/O), nothing breaks. The reactive application will still use system resources more efficiently — fewer threads serve more requests — and the blocking application continues to function exactly as before.',
      'This incremental approach is safe because reactive and blocking applications can communicate over standard HTTP without issue. The key insight is that you don\'t need an all-or-nothing commitment: you gain localized benefits immediately in the migrated application and can progressively migrate the rest of the stack over time to achieve full end-to-end reactive behavior.',
    ],
    keyPoints: [
      'A fully reactive stack is the <strong>ideal</strong> — it unlocks streaming, backpressure, and maximum resource efficiency.',
      'In practice, migrating one application at a time is the norm; a big-bang migration is rarely feasible.',
      'Mixing Spring WebFlux and Spring MVC applications is perfectly safe — they communicate over standard HTTP.',
      'A partially reactive architecture still delivers resource efficiency benefits in the migrated components.',
      'Progressive migration lets you incrementally move toward full reactive potential without disrupting existing services.',
    ],
    note: {
      label: 'WHEN TO USE',
      text: 'Adopt reactive programming incrementally. Start with the application that benefits most from non-blocking I/O (e.g., high-throughput, I/O-heavy services), then expand the reactive boundary outward as your team gains confidence.',
      tone: 'green',
    },
    quiz: {
      question: 'You have three microservices. You migrate one to Spring WebFlux and leave the other two on Spring MVC. What is the expected outcome?',
      options: [
        { label: 'The system breaks because reactive and blocking services cannot communicate with each other.', correct: false },
        { label: 'Nothing breaks; the migrated service uses resources more efficiently while the others continue working as before.', correct: true },
        { label: 'The entire system must be reactive to see any resource efficiency improvements.', correct: false },
        { label: 'The Spring MVC services will automatically become reactive when calling the WebFlux service.', correct: false },
      ],
      explanation: 'Reactive and blocking applications communicate over standard HTTP, so mixing them is safe. The migrated WebFlux service gains resource efficiency immediately, while the remaining Spring MVC services continue to function unchanged. Full benefits like end-to-end backpressure require the entire stack to be reactive, but partial migration still delivers localized gains.',
    },
  },
  {
    id: '2.10',
    title: 'Reactive Web is Resilient - Demo',
    duration: '6 min',
    kind: 'demo',
    summary: [
      'This demo contrasts how the traditional (blocking) and reactive (non-blocking) controllers behave when an external service crashes mid-request. The external service exposes a <code>/products/notorious</code> endpoint that behaves identically to <code>/products</code> — emitting one product per second for ten products — but intentionally crashes after four seconds. Both controllers are pointed at this notorious endpoint to observe failure behavior under realistic conditions (e.g., a downstream microservice crashing during processing).',
      'When the traditional controller calls the notorious endpoint, it blocks waiting to collect all products into a <code>List</code>. The external service crashes after four seconds, the JVM exits, and the controller returns a <code>500 Internal Server Error</code>. Because the blocking approach is <em>all-or-nothing</em>, the four products already emitted are lost — even a try/catch block could only return an empty list, not the partial data.',
      'The reactive controller, by contrast, streams products as they arrive. When the external service crashes, the client still receives the four products emitted before the failure. The connection closes with an error, but the partial response is already delivered. By applying Project Reactor\'s <code>onErrorComplete()</code> operator to the <code>Flux&lt;Product&gt;</code>, the error signal is converted to a complete signal, producing a clean, valid JSON array with the four products — no error, no broken response.',
      'The key takeaway is that reactive pipelines offer fine-grained resilience through operators like <code>onErrorComplete()</code>, <code>onErrorReturn()</code>, or <code>onErrorResume()</code>. You can choose to fail, return a fallback, or gracefully complete with partial data. The blocking approach cannot achieve this because it collects everything into a single <code>List</code> before responding — partial results are unreachable.',
    ],
    keyPoints: [
      'The <code>/products/notorious</code> endpoint emits one product per second but intentionally crashes after ~4 seconds, simulating a real downstream service failure.',
      'Traditional blocking controller returns <code>500 Internal Server Error</code> and loses all partial data because it collects the entire <code>List</code> before responding — it is all-or-nothing.',
      'Reactive controller streams products as they arrive, so the client receives the 4 products emitted before the crash even without any error handling.',
      '<code>onErrorComplete()</code> converts an error signal into a completion signal, producing a valid JSON array with partial data and no error response.',
      'Reactive operators (<code>onErrorComplete</code>, <code>onErrorReturn</code>, <code>onErrorResume</code>) enable fine-grained resilience strategies; the same flexibility is not available in the blocking model.',
      'If failing is the desired behavior, that is also easily achievable — reactive gives you the choice, not a mandate.',
    ],
    code: `java`,
    codeLabel: 'ReactiveWebController.java — applying onErrorComplete() for resilience',
    note: {
      label: 'KEY INSIGHT',
      text: 'The blocking model collects everything into a List before responding, making partial results unreachable on failure. The reactive model streams items as they arrive, so partial data is already with the client — operators like onErrorComplete() simply clean up the termination signal.',
      tone: 'accent',
    },
    quiz: {
      question: 'Why can the reactive controller return partial data when the external service crashes, but the traditional controller cannot?',
      options: [
        { label: 'The reactive controller uses a faster HTTP client that retrieves data before the crash', correct: false },
        { label: 'The reactive controller streams items as they arrive, so products emitted before the crash are already delivered to the client', correct: true },
        { label: 'The reactive controller caches responses locally and serves from cache on failure', correct: false },
        { label: 'The traditional controller does not support HTTP timeouts, so it waits indefinitely', correct: false },
      ],
      explanation: 'The blocking controller collects all items into a List before serializing the response — if the service crashes mid-stream, nothing has been sent yet. The reactive controller streams each item immediately as it arrives, so the client already has the products emitted before the crash. Operators like onErrorComplete() then convert the error signal into a clean completion, producing valid JSON.',
    },
  },
  {
    id: '2.11',
    title: 'Summary',
    duration: '1 min',
    kind: 'summary',
    summary: [
      'This section provided a foundational comparison between traditional blocking I/O (Spring MVC) and reactive (Spring WebFlux) web applications. Through a series of demos, we observed how a traditional API blocks its request thread while waiting for an external service to respond, whereas a reactive API frees the thread to handle other work during that wait. We also exposed a streaming endpoint to see how WebFlux can push data incrementally to the client rather than buffering the entire response.',
      'A critical lesson was the common mistake of calling <code>.block()</code> within a reactive pipeline, which defeats the purpose of non-blocking I/O and can lead to thread starvation. We then traced the reactive request lifecycle step by step to understand how the event loop and publisher-subscriber model keep the system efficient. Finally, a resilience demo showed how reactive applications can cancel in-flight work early when a client disconnects, avoiding wasted computation.',
      'With these motivations established, the upcoming sections shift to practical development: making database calls reactively, building CRUD APIs, and handling errors — all covered from scratch. If the reactive model does not fit your use case, the instructor notes this is a natural point to reconsider before diving deeper.',
    ],
    keyPoints: [
      '<strong>Responsive applications:</strong> WebFlux enables applications that react quickly by freeing threads during I/O waits rather than blocking them.',
      '<strong>Streaming support:</strong> Reactive endpoints can push data incrementally (e.g., via SSE or chunked transfer), providing a streaming response instead of buffering everything in memory.',
      '<strong>Early cancellation:</strong> When a client disconnects, the reactive pipeline can cancel upstream work automatically, avoiding unnecessary computation and saving system resources.',
      '<strong>Avoid <code>.block()</code>:</strong> Calling <code>.block()</code> inside a reactive chain reintroduces blocking behavior and undermines the non-blocking event-loop model.',
      '<strong>Efficient resource usage:</strong> The event-loop model with a small number of threads can handle high concurrency more efficiently than one-thread-per-request architectures.',
    ],
    note: {
      label: 'WHY THIS MATTERS',
      text: 'Reactive web is not a silver bullet — it shines when you need high concurrency with limited threads, streaming responses, or early cancellation. If your application is I/O-light or your team is unfamiliar with reactive paradigms, the added complexity may not be justified.',
      tone: 'accent',
    },
    quiz: {
      question: 'A user navigates away from a page that is loading a large streaming response from a reactive endpoint. What is the primary benefit WebFlux provides in this scenario compared to a traditional blocking API?',
      options: [
        { label: 'The response is cached so it loads instantly when the user returns.', correct: false },
        { label: 'The upstream work is cancelled automatically, freeing the thread and avoiding wasted computation.', correct: true },
        { label: 'The reactive pipeline retries the request automatically when the user reconnects.', correct: false },
        { label: 'The response is converted to a blocking call so the data is preserved.', correct: false },
      ],
      explanation: 'One of the key advantages of the reactive model is that when a client disconnects, the subscription is cancelled and the upstream publisher stops producing data. This means no unnecessary work is done and the thread is immediately available for other requests — something a traditional blocking API cannot do because the thread remains occupied until the I/O operation completes.',
    },
  },
]
