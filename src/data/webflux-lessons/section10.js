export default [
  {
    id: '10.1',
    title: 'Streaming - Introduction',
    duration: '2 min',
    kind: 'theory',
    summary: [
      'Traditional REST APIs follow a strict one-request, one-response model — you send a single request like <code>getCustomerById</code> or <code>createCustomer</code>, and the server returns a single response. This works well for most CRUD operations, but it is not optimal for every use case. With Project Reactor\'s <code>Flux</code> type (which emits 0 to N items, unlike <code>Mono</code> which emits 0 or 1), Spring WebFlux opens up three additional communication patterns that go beyond simple request-response.',
      'The first pattern is <em>server streaming</em>: the client sends one request and the server responds with a continuous stream of multiple items. Real-world examples include file downloads, live ride-tracking updates (e.g., "driver is 5 miles away… 3 miles away… 1 mile away"), or any scenario where the server pushes periodic updates so the client doesn\'t have to poll repeatedly. The second pattern is <em>client streaming</em>: the client sends a stream of requests and the server acknowledges with a single response. This fits scenarios like file uploads, heart-rate sensor data from wearable devices, or a driver\'s mobile device continuously reporting GPS coordinates.',
      'The third pattern is <em>bidirectional streaming</em>, where both client and server send streams of data simultaneously — essentially a combination of the first two patterns. Interactive applications like online multiplayer games and real-time chat systems fall into this category. Throughout this section, we will focus on implementing server streaming (download) and client streaming (upload) patterns using Spring WebFlux, culminating in a demo that uploads and downloads one million products.',
    ],
    keyPoints: [
      'Traditional request-response APIs return a single response per request — sufficient for CRUD but limiting for data-intensive or real-time scenarios.',
      '<strong>Server streaming</strong>: one request in, multiple streamed responses out — ideal for file downloads and live status updates (eliminates client polling).',
      '<strong>Client streaming</strong>: multiple streamed requests in, one response out — ideal for file uploads and continuous sensor/IoT data feeds.',
      '<strong>Bidirectional streaming</strong>: both sides stream simultaneously — ideal for chat, online games, and other interactive applications.',
      'Spring WebFlux leverages Reactor\'s <code>Flux</code> (0..N items) to enable all three streaming patterns on top of standard HTTP.',
      'This section will implement both upload (client streaming) and download (server streaming) APIs, demonstrated with a 1-million-product dataset.',
    ],
    note: {
      label: 'WHY THIS MATTERS',
      text: 'Streaming patterns eliminate the memory pressure and latency of buffering entire payloads. Instead of loading a million products into memory before sending or receiving, WebFlux processes items as they flow through the pipeline — keeping heap usage flat regardless of data volume.',
      tone: 'accent',
    },
    quiz: {
      question: 'You are building an API where a client uploads a large CSV file by sending rows one at a time, and the server responds with a single summary count when done. Which streaming pattern does this represent?',
      options: [
        { label: 'Server streaming', correct: false },
        { label: 'Client streaming', correct: true },
        { label: 'Bidirectional streaming', correct: false },
        { label: 'Traditional request-response', correct: false },
      ],
      explanation: 'Client streaming means the client sends multiple items (CSV rows) as a stream and the server returns a single response (the summary count). Server streaming is the inverse — one request, multiple responses. Bidirectional streaming involves streams from both sides simultaneously.',
    },
  },
  {
    id: '10.2',
    title: 'Uploading Million Products — Use Case',
    duration: '3 min',
    kind: 'concept',
    summary: [
      'This section focuses on service-to-service streaming for back-end communication. The motivating use case is uploading millions of products to a third-party e-commerce platform. The platform exposes a simple POST endpoint to create a single product, but calling it a million times is highly inefficient: each request re-establishes a connection, re-sends authentication tokens, and re-validates permissions, creating redundant overhead and unnecessary latency.',
      'The platform also enforces rate limiting based on plan tiers (basic, premium, etc.), so you cannot simply parallelize with thousands of threads. They cap concurrent requests — often to as few as 5 or 10 at a time — and reject or block excess traffic. This means you are forced to wait for earlier batches to complete before sending the next, adding idle wait time to an already slow process.',
      'A CSV file upload was considered as an alternative but has significant drawbacks. CSV cannot naturally represent complex, nested data structures like a product with thousands of reviews or intricate pricing models. Escaping commas and maintaining structure in flat CSV rows becomes error-prone and brittle.',
      'Streaming solves these problems elegantly: you establish a single connection, perform authentication and authorization once, and then continuously send JSON-encoded messages over that connection. The back-end server processes each message efficiently as it arrives. This eliminates per-request connection overhead, sidesteps rate-limiting on individual requests, and retains JSON\'s ability to represent deeply nested data structures.',
    ],
    keyPoints: [
      'Calling a single-item POST endpoint a million times wastes resources on repeated connection setup, token exchange, and permission validation.',
      'Rate limiting on the provider side caps concurrent requests (e.g., 5–10 at a time), making naive parallelism ineffective and forcing sequential wait times.',
      'CSV file uploads struggle with complex, nested data structures (e.g., products with thousands of reviews and layered pricing), requiring extensive escaping and flattening.',
      'Streaming establishes one authenticated connection and sends a continuous flow of messages, eliminating per-request overhead.',
      'JSON can be used within the stream to preserve rich, nested data structures that CSV cannot easily represent.',
    ],
    note: {
      label: 'WHY THIS MATTERS',
      text: 'Streaming is not just about performance — it fundamentally changes the communication contract between services from request-per-item to a persistent, authenticated channel that carries a continuous flow of structured data.',
      tone: 'accent',
    },
    quiz: {
      question: 'Why is naively parallelizing a million single-item POST requests ineffective against a rate-limited API?',
      options: [
        { label: 'The server will automatically scale to handle all parallel requests without limits', correct: false },
        { label: 'Rate limiting caps concurrent requests (e.g., 5–10), so excess requests are rejected or blocked, forcing you to wait anyway', correct: true },
        { label: 'Parallel requests bypass authentication, so they are rejected for security reasons', correct: false },
        { label: 'JSON cannot be sent in parallel, only sequentially', correct: false },
      ],
      explanation: 'Rate-limiting policies intentionally cap how many concurrent requests a client can make. Sending thousands of parallel requests will cause the server to reject or block the excess, so you gain no throughput advantage and still incur per-request connection and authentication overhead.',
    },
  },
  {
    id: '10.3',
    title: 'JSON Lines',
    duration: '3 min',
    kind: 'concept',
    summary: [
      'The traditional JSON array format wraps multiple objects inside square brackets (<code>[...]</code>). While this works well for small datasets, it has a critical limitation for large-scale streaming: the response is effectively <em>all-or-nothing</em>. If a server crashes after writing 999 of 1,000 products but before emitting the closing bracket, the client cannot parse the response at all — the entire payload is corrupt. Additionally, the parser must read the entire array into memory before it can begin processing, which becomes unsustainable when dealing with millions of records.',
      'JSON Lines (also called newline-delimited JSON or NDJSON) solves this by placing one self-contained, valid JSON object per line, with no enclosing array brackets. Because each line is independently parseable, a client can read and process records one at a time without holding the entire payload in memory. If the stream is interrupted after 999 products, the client has already successfully consumed those 999 records — no data is lost.',
      'This format is a natural fit for reactive streaming architectures, where backpressure and incremental processing are core principles. Major data-intensive platforms — including Google BigQuery, Shopify, Apache Spark, and several AWS services — rely on JSON Lines for bulk data transfer. Note that JSON arrays are not inherently bad; they remain appropriate for small, related collections (e.g., a product with a list of embedded reviews). The distinction is scale: use JSON arrays for bounded, nested data, and JSON Lines for high-volume, flat record streams.',
      'In the upcoming lessons, the product upload and download APIs will use JSON Lines to stream <code>Product</code> objects between the client and server, enabling true non-blocking, memory-efficient processing of one million records.',
    ],
    keyPoints: [
      '<strong>JSON arrays are all-or-nothing</strong>: a missing closing bracket makes the entire payload unparseable, even if most records were transmitted successfully.',
      '<strong>JSON Lines = one JSON object per line</strong>, no enclosing array brackets — also called newline-delimited JSON (NDJSON).',
      'Each line is <strong>independently parseable</strong>, enabling line-by-line processing without loading the full payload into memory.',
      'JSON Lines is ideal for <strong>streaming large datasets</strong> and is used by Google BigQuery, Shopify, Apache Spark, and AWS services.',
      'JSON arrays are still appropriate for <strong>small, nested, related data</strong> (e.g., a product with embedded reviews).',
    ],
    code: `// JSON Array Format — NOT suitable for streaming large datasets
[
  {"id": 1, "name": "Product A", "price": 10.00},
  {"id": 2, "name": "Product B", "price": 20.00},
  // ... imagine 1,000,000 products here ...
  {"id": 1000000, "name": "Product Z", "price": 99.99}
]
// Problem: Parser must read the ENTIRE array into memory before processing.
// If the stream is interrupted before the closing ']', the whole response is corrupt.

// JSON Lines Format (NDJSON) — ideal for streaming
{"id": 1, "name": "Product A", "price": 10.00}
{"id": 2, "name": "Product B", "price": 20.00}
{"id": 3, "name": "Product C", "price": 30.00}
// Each line is a self-contained, valid JSON object with no enclosing brackets.
// The client can parse and process each record independently as it arrives.`,
    codeLabel: 'json',
    note: {
      label: 'WHY THIS MATTERS',
      text: 'When streaming one million products, the JSON array format forces the client to buffer the entire response in memory before parsing — defeating the purpose of reactive streaming. JSON Lines lets each record be processed the moment it arrives, keeping memory usage flat regardless of dataset size.',
      tone: 'accent',
    },
    quiz: {
      question: 'A server is streaming 500,000 product records to a client using a JSON array format, but crashes after sending 499,999 records. What happens to the data the client received?',
      options: [
        { label: 'The client can parse all 499,999 records successfully since each is a complete JSON object.', correct: false },
        { label: 'The client cannot parse any of the data because the closing array bracket was never received.', correct: true },
        { label: 'The client can parse the first 250,000 records but not the rest.', correct: false },
        { label: 'The client automatically reconstructs the missing bracket and parses everything.', correct: false },
      ],
      explanation: 'In a JSON array, the opening \'[\' and closing \']\' brackets are required for valid parsing. Without the closing bracket, the JSON is malformed and the parser cannot process any of the records. This illustrates the all-or-nothing problem that JSON Lines solves — with NDJSON, each line is independently valid, so all 499,999 records would have been successfully consumed.',
    },
  },
  {
    id: '10.4',
    title: 'Project Setup',
    duration: '5 min',
    kind: 'setup',
    summary: [
      'This lesson sets up the foundational project structure for the entire section on reactive data streaming. Under the base package <code>com.winds.group.playground</code>, create a new sub-package <code>section08</code> with five child packages: <code>entity</code>, <code>repository</code>, <code>dto</code>, <code>mapper</code>, and <code>controller</code>. The <code>Product</code> entity and <code>ProductRepository</code> can be reused from earlier sections (e.g., section 02) with minimal modification — the repository is stripped down to just the base <code>ReactiveCrudRepository</code> interface with no custom query methods.',
      'The <code>Product</code> entity uses Spring Data\'s <code>@Id</code> annotation (from <code>org.springframework.data.annotation</code>, not <code>javax.persistence</code>) and includes fields for <code>id</code>, <code>name</code>, <code>description</code>, <code>price</code>, and <code>quantity</code>. A corresponding <code>ProductDto</code> mirrors these fields, and a <code>ProductMapper</code> utility class handles conversion between the two. The DTO and mapper are optional — you could work directly with the entity — but they follow the layered design pattern used throughout the course.',
      'The controller and service classes will be implemented in the next lesson. For now, the goal is to have the entity, repository, DTO, and mapper in place so that subsequent lessons can focus entirely on the streaming logic for uploading and downloading millions of products.',
    ],
    keyPoints: [
      'Create packages under <code>section08</code>: <code>entity</code>, <code>repository</code>, <code>dto</code>, <code>mapper</code>, <code>controller</code>',
      'Reuse the <code>Product</code> entity from earlier sections — use <code>@Id</code> from <code>org.springframework.data.annotation</code>',
      'Strip <code>ProductRepository</code> down to a bare <code>ReactiveCrudRepository&lt;Product, Integer&gt;</code> — no custom query methods needed',
      'DTO and mapper are optional but recommended for consistency with the course\'s layered architecture',
      'Controller and service classes are deferred to the next lesson',
    ],
    code: `package com.winds.group.playground.section08.entity;

import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Table;

@Table("product")
public class Product {

    @Id
    private Integer id;
    private String name;
    private String description;
    private Double price;
    private Integer quantity;

    public Product() {}

    public Product(Integer id, String name, String description, Double price, Integer quantity) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.price = price;
        this.quantity = quantity;
    }

    public Integer getId() { return id; }
    public void setId(Integer id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public Double getPrice() { return price; }
    public void setPrice(Double price) { this.price = price; }
    public Integer getQuantity() { return quantity; }
    public void setQuantity(Integer quantity) { this.quantity = quantity; }
}
`,
    codeLabel: 'java',
    note: {
      label: 'WHY THIS MATTERS',
      text: 'Having the entity, repository, DTO, and mapper ready before writing streaming logic lets you focus entirely on the reactive upload/download patterns without boilerplate distractions. This scaffolding is identical to what you\'d build for a non-reactive CRUD app — the reactive complexity lives entirely in the controller and service layers.',
      tone: 'accent',
    },
    quiz: {
      question: 'Which annotation should you use for the @Id field in a Spring Data R2DBC entity?',
      options: [
        { label: 'javax.persistence.Id', correct: false },
        { label: 'org.springframework.data.annotation.Id', correct: true },
        { label: 'jakarta.persistence.Id', correct: false },
        { label: 'org.springframework.data.relational.core.mapping.Id', correct: false },
      ],
      explanation: 'Spring Data R2DBC uses org.springframework.data.annotation.Id, not the JPA annotations from javax.persistence or jakarta.persistence. Mixing these up will cause the ID field to be ignored by R2DBC.',
    },
  },
  {
    id: '10.5',
    title: 'Product Service',
    duration: '3 min',
    kind: 'demo',
    summary: [
      'With the project structure and <code>Product</code> entity already in place from the setup lesson, we now build the <code>ProductService</code> that sits between the repository and the upcoming streaming controllers. The service is annotated with <code>@Service</code> and has the <code>ProductRepository</code> injected via constructor injection (Spring\'s recommended approach for reactive beans, since it avoids field injection and makes dependencies explicit).',
      'The <code>saveProducts</code> method accepts a <code>Flux&lt;ProductDTO&gt;</code> and returns a <code>Flux&lt;ProductDTO&gt;</code>. Internally, it maps each DTO to a <code>Product</code> entity using the <code>EntityDtoMapper</code>, passes the resulting <code>Flux&lt;Product&gt;</code> directly to <code>repository.saveAll()</code> (which accepts a <code>Publisher</code>), and then maps the saved entities back to DTOs. This is the reactive equivalent of a bulk save — but instead of collecting a list, the entire pipeline remains a lazy stream, so products flow through without buffering the entire dataset in memory.',
      'A second method, <code>getProductsCount</code>, simply delegates to <code>repository.count()</code>, returning a <code>Mono&lt;Long&gt;</code>. This will be used later to verify that all one million products were persisted after a streaming upload completes.',
    ],
    keyPoints: [
      '<strong>Reactive bulk save without buffering:</strong> Passing a <code>Flux</code> directly to <code>repository.saveAll(Publisher)</code> keeps the pipeline lazy — no intermediate <code>List</code> is materialized.',
      'The <code>Flux</code> is transformed <em>twice</em>: DTO → entity before saving, and entity → DTO after saving, using <code>EntityDtoMapper</code>.',
      '<code>repository.count()</code> returns <code>Mono&lt;Long&gt;</code> — a single asynchronous result, not a <code>Flux</code>.',
      'Constructor injection is preferred for reactive Spring beans to keep the component testable and dependencies immutable.',
    ],
    code: `package section05.service;

import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import section05.dto.ProductDTO;
import section05.entity.Product;
import section05.mapper.EntityDtoMapper;
import section05.repository.ProductRepository;

@Service
public class ProductService {

    private final ProductRepository repository;

    public ProductService(ProductRepository repository) {
        this.repository = repository;
    }

    public Flux<ProductDTO> saveProducts(Flux<ProductDTO> flux) {
        return flux
                .map(EntityDtoMapper::toEntity)
                .as(repository::saveAll)
                .map(EntityDtoMapper::toDto);
    }

    public Mono<Long> getProductsCount() {
        return repository.count();
    }
}`,
    codeLabel: 'java',
    note: {
      label: 'KEY INSIGHT',
      text: 'The <code>.as(repository::saveAll)</code> operator is a clean way to pass the entire <code>Flux</code> as a <code>Publisher</code> to the repository without breaking the reactive chain. It avoids the anti-pattern of subscribing manually or collecting into a list.',
      tone: 'accent',
    },
    quiz: {
      question: 'Why is passing a Flux directly to repository.saveAll() preferable to collecting the Flux into a List first?',
      options: [
        { label: 'It keeps the pipeline lazy and avoids buffering the entire dataset in memory', correct: true },
        { label: 'It is the only way to persist reactive data in Spring Data R2DBC', correct: false },
        { label: 'It automatically adds retry logic to each save operation', correct: false },
        { label: 'It converts the Flux into a Mono so only one product is saved at a time', correct: false },
      ],
      explanation: 'saveAll(Publisher) accepts the Flux directly, so products flow through the pipeline one at a time without materializing a full List in memory. This is critical for high-volume uploads like one million products.',
    },
  },
  {
    id: '10.6',
    title: 'Product Streaming Upload API',
    duration: '5 min',
    kind: 'demo',
    summary: [
      'With the <code>ProductService</code> from the previous lesson in place, we now expose the upload endpoint via a <code>ProductController</code>. The critical design choice is the <em>consumes</em> media type: instead of <code>application/json</code>, the endpoint declares <code>application/x-ndjson</code> (JSON Lines). This tells Spring to parse the request body as a stream of newline-delimited JSON objects rather than a single JSON document, which is what enables true reactive streaming of large payloads.',
      'Because the request body contains a stream of multiple <code>Product</code> objects (not a single object), the parameter type is <code>Flux&lt;Product&gt;</code> rather than <code>Mono&lt;Product&gt;</code>. The controller passes this incoming <code>Flux</code> directly to <code>productService.saveProducts()</code>, which returns a <code>Flux&lt;Product&gt;</code> of saved entities. Instead of streaming all saved products back to the client, the controller chains <code>.then()</code> to discard the saved results, then calls <code>productService.getProductsCount()</code> to return a single <code>UploadResponse</code> containing a confirmation ID and the total product count.',
      'For demonstration purposes, the controller adds logging: a <code>log.info("invoked")</code> at method entry to show when the handler is actually called, and a <code>doOnNext()</code> on the incoming <code>Flux</code> to print each product as it arrives. This will later reveal the reactive, non-blocking nature of the processing — items are logged as they flow through the pipeline rather than all at once.',
    ],
    keyPoints: [
      'Use <code>consumes = MediaType.APPLICATION_NDJSON_VALUE</code> to accept newline-delimited JSON streams instead of standard JSON.',
      'Use <code>Flux&lt;Product&gt;</code> (not <code>Mono</code>) as the <code>@RequestBody</code> type when expecting a streaming request with multiple items.',
      'The <code>.then()</code> operator discards the upstream <code>Flux</code> elements and switches to a downstream <code>Mono</code>, allowing the controller to return a single summary response.',
      '<code>doOnNext()</code> is a side-effect operator useful for logging each item as it passes through the pipeline without modifying the stream.',
      'The controller delegates all business logic to <code>ProductService</code> — it only orchestrates the flow and shapes the response.',
    ],
    code: `package section10.controller;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.util.UUID;

// ... (Product entity from lesson 10.5)
// ... (ProductService from lesson 10.5)

public record UploadResponse(String confirmationId, Long productsCount) {
}

@RestController
@RequestMapping("products")
public class ProductController {

    private static final Logger log = LoggerFactory.getLogger(ProductController.class);

    private final ProductService service;

    public ProductController(ProductService service) {
        this.service = service;
    }

    @PostMapping(value = "upload", consumes = MediaType.APPLICATION_NDJSON_VALUE)
    public Mono<UploadResponse> uploadProducts(@RequestBody Flux<Product> products) {
        log.info("invoked");
        products = products.doOnNext(p -> log.info("received: {}", p));
        return this.service.saveProducts(products)
                .then()
                .then(this.service.getProductsCount())
                .map(count -> new UploadResponse(UUID.randomUUID().toString(), count));
    }
}`,
    codeLabel: 'java',
    note: {
      label: 'KEY INSIGHT',
      text: 'The combination of <code>application/x-ndjson</code> and <code>Flux&lt;Product&gt;</code> is what makes this a true streaming upload — Spring does not buffer the entire request into memory. Each JSON line is parsed and emitted individually as it arrives over the network.',
      tone: 'accent',
    },
    quiz: {
      question: 'Why is Flux<Product> used as the @RequestBody type instead of Mono<Product>?',
      options: [
        { label: 'Because Mono cannot be used with @RequestBody', correct: false },
        { label: 'Because the request body contains a stream of multiple newline-delimited Product objects, not a single Product', correct: true },
        { label: 'Because Flux performs better than Mono for all POST requests', correct: false },
        { label: 'Because the response needs to contain multiple products', correct: false },
      ],
      explanation: 'Mono wraps a single value, while Flux wraps a stream of 0..N values. Since the NDJSON request body contains multiple Product objects (one per line), Flux<Product> is the correct reactive type to receive them.',
    },
  },
  {
    id: '10.7',
    title: 'Product Client',
    duration: '3 min',
    kind: 'demo',
    summary: [
      'With the product streaming upload API in place from the previous lesson, we now need a client to invoke it. This client will act as the sender — producing a <code>Flux&lt;Product&gt;</code> and transmitting it to the remote upload endpoint using Spring WebFlux\'s <code>WebClient</code>.',
      'The <code>WebClient</code> is created with a base URL pointing to the server (e.g., <code>http://localhost:8080</code>). A single method, <code>uploadProducts</code>, accepts a <code>Flux&lt;Product&gt;</code> and issues a POST request to <code>/products/upload</code>. The critical detail is setting the <code>Content-Type</code> header to <code>application/x-ndjson</code> (JSON Lines format), which tells the server that the body is a stream of newline-delimited JSON objects rather than a single JSON array.',
      'Because the request body is a reactive publisher (<code>Flux</code>) rather than an in-memory object, we must use <code>body()</code> — not <code>bodyValue()</code>. The <code>body()</code> method accepts the publisher and the element class (<code>Product.class</code>) so that <code>WebClient</code> knows how to serialize each emitted item. The server responds with a single <code>UploadResponse</code>, so we use <code>bodyToMono(UploadResponse.class)</code> to collect that single result.',
      'This client demonstrates the reactive end-to-end flow: a <code>Flux</code> of products is never fully materialized in memory. Instead, items are streamed one at a time through the HTTP connection, making it possible to upload millions of products without overwhelming either the client or the server.',
    ],
    keyPoints: [
      '<strong>WebClient</strong> is the non-blocking HTTP client in Spring WebFlux, used here to send a streaming POST request.',
      'Use <code>body()</code> (not <code>bodyValue()</code>) when the request body is a <code>Flux</code> or other reactive publisher — <code>bodyValue()</code> expects a concrete in-memory object.',
      'Setting <code>Content-Type: application/x-ndjson</code> signals JSON Lines format, so the server deserializes each line as a separate JSON object.',
      '<code>bodyToMono(UploadResponse.class)</code> collects the single server response — the server returns one summary object after processing the entire stream.',
    ],
    code: `package com.example.section08;

import org.springframework.http.MediaType;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

public class ProductClient {

    private final WebClient client;

    public ProductClient() {
        this.client = WebClient.builder()
                .baseUrl("http://localhost:8080")
                .build();
    }

    public Mono<UploadResponse> uploadProducts(Flux<Product> products) {
        return this.client.post()
                .uri("/products/upload")
                .contentType(MediaType.APPLICATION_NDJSON) // JSON Lines streaming format
                .body(products, Product.class)              // publisher + element class
                .retrieve()
                .bodyToMono(UploadResponse.class);          // single response from server
    }
}`,
    codeLabel: 'java',
    note: {
      label: 'KEY INSIGHT',
      text: 'The choice between body() and bodyValue() is the crux of reactive HTTP streaming: bodyValue() forces materialization of the entire payload in memory, while body() lets the publisher emit items lazily across the wire — enabling true streaming of arbitrarily large datasets.',
      tone: 'accent',
    },
    quiz: {
      question: 'Why do we use body() instead of bodyValue() when sending the Flux<Product> in the upload request?',
      options: [
        { label: 'bodyValue() does not support POST requests', correct: false },
        { label: 'bodyValue() requires the entire object to be in memory, but body() accepts a reactive publisher and streams items lazily', correct: true },
        { label: 'body() automatically sets the Content-Type header', correct: false },
        { label: 'bodyValue() only works with GET requests', correct: false },
      ],
      explanation: 'bodyValue() is designed for concrete, in-memory objects. Since our payload is a Flux (a reactive publisher), we must use body() so that items are serialized and transmitted as they are emitted, without collecting the entire stream into memory first.',
    },
  },
  {
    id: '10.8',
    title: 'Client Streaming Request - Demo',
    duration: '5 min',
    kind: 'demo',
    summary: [
      'This demo verifies that the streaming upload API built in the previous lessons is truly non-blocking and streams data incrementally. We create a test class (<code>ProductsUploadDownloadTest</code>) that instantiates the <code>ProductClient</code> and calls <code>uploadProducts</code> with a <code>Flux&lt;ProductDTO&gt;</code>. To prove the streaming behavior, the <code>Flux</code> is intentionally delayed using <code>delayElements</code> so items are emitted after a delay rather than all at once.',
      'In the first scenario, a single <code>ProductDTO</code> is emitted after a 10-second delay. When the test runs, the <code>uploadProducts</code> method is invoked immediately (the <em>invoked</em> log prints right away), but the server does not receive the product until 10 seconds later. This confirms that the client sends the request stream lazily — items are transmitted only as the <code>Flux</code> emits them, not buffered upfront.',
      'In the second scenario, <code>Flux.range(1, 10)</code> generates ten products, each delayed by 2 seconds via <code>delayElements(Duration.ofSeconds(2))</code>. The server logs show products arriving one every 2 seconds in a streaming fashion, while the client\'s <em>invoked</em> message prints only once at the start. The final <code>UploadResponse</code> reports the cumulative product count (e.g., 21, including pre-existing rows), confirming all ten items were persisted.',
      'The key takeaway: the client-side <code>Flux</code> drives the pace of transmission. Because the entire pipeline is reactive and non-blocking, the method invocation returns immediately while items flow through the HTTP connection as they are emitted — this is the essence of client-side streaming over HTTP.',
    ],
    keyPoints: [
      '<strong>Non-blocking invocation</strong>: <code>uploadProducts</code> returns a <code>Mono&lt;UploadResponse&gt;</code> immediately; it does not wait for all items to be sent before returning.',
      '<code>delayElements(Duration)</code> on the client <code>Flux</code> controls when each item is emitted and thus when the server receives it — proving items are streamed, not batched.',
      'The server logs <em>invoked</em> only once (when the stream connects), then receives individual products as they arrive — visible in the server-side <code>System.out</code> output.',
      '<code>StepVerifier</code> with <code>verifyComplete()</code> is used to block the test thread until the <code>Mono&lt;UploadResponse&gt;</code> completes, keeping the demo deterministic.',
      'The <code>UploadResponse</code> count reflects cumulative database rows, so pre-existing data inflates the number (e.g., 11 after one product, 21 after ten more).',
    ],
    code: `package com.example.section08.test;

import com.example.section08.dto.ProductDTO;
import com.example.section08.dto.UploadResponse;
import com.example.section08.client.ProductClient;
import org.junit.jupiter.api.Test;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import reactor.core.publisher.Flux;
import reactor.test.StepVerifier;

import java.time.Duration;

public class ProductsUploadDownloadTest {

    private static final Logger log = LoggerFactory.getLogger(ProductsUploadDownloadTest.class);

    private final ProductClient productClient = new ProductClient();

    @Test
    void uploadSingleProductDelayed() {
        Flux<ProductDTO> flux = Flux.just(
                new ProductDTO(null, "iPhone", 1000)
        )
        .delayElements(Duration.ofSeconds(10));

        this.productClient.uploadProducts(flux)
            .doOnNext(uploadResponse -> log.info("received: {}", uploadResponse))
            .then()
            .as(StepVerifier::create)
            .verifyComplete();
    }

    @Test
    void uploadTenProductsStreamed() {
        Flux<ProductDTO> flux = Flux.range(1, 10)
                .map(i -> new ProductDTO(null, "product-" + i, i))
                .delayElements(Duration.ofSeconds(2));

        this.productClient.uploadProducts(flux)
            .doOnNext(uploadResponse -> log.info("received: {}", uploadResponse))
            .then()
            .as(StepVerifier::create)
            .verifyComplete();
    }
}`,
    codeLabel: 'java',
    note: {
      label: 'KEY INSIGHT',
      text: 'The client <code>Flux</code> acts as the pacing mechanism for the entire upload. Because the reactive pipeline is lazy and non-blocking, items are transmitted over the HTTP connection only when emitted — not when the method is invoked.',
      tone: 'accent',
    },
    quiz: {
      question: 'Why does the server log "invoked" only once but receive products every 2 seconds in the ten-product demo?',
      options: [
        { label: 'The server buffers all products and processes them on a fixed 2-second schedule', correct: false },
        { label: 'The client method is invoked once to establish the stream, and items flow through as the Flux emits them with delayElements', correct: true },
        { label: 'The server polls the client every 2 seconds for new products', correct: false },
        { label: 'StepVerifier forces a 2-second delay between each product on the server side', correct: false },
      ],
      explanation: 'The client calls uploadProducts once, which establishes the HTTP streaming connection immediately. The Flux.range(1,10) with delayElements(2s) emits items one at a time every 2 seconds, and each emitted item is transmitted over the already-open connection. The server receives the stream invocation once, then processes items as they arrive.',
    },
  },
  {
    id: '10.9',
    title: '@RequestBody - Non-Blocking Clarification',
    duration: '3 min',
    kind: 'faq',
    summary: [
      'This lesson clarifies a question that often arises from the previous client-streaming demo: how can a single <code>POST</code> request carry multiple products without the server blocking until the entire body arrives? The answer lies in how Spring WebFlux handles a <code>@RequestBody</code> parameter typed as a <code>Publisher</code> (e.g., <code>Flux&lt;Product&gt;</code>). Instead of buffering the entire request body into memory before invoking the controller method, Spring decodes the incoming byte stream incrementally and emits each decoded element into the <code>Flux</code> as it arrives.',
      'In the previous demo, the client established a single HTTP connection via one <code>POST</code> request and then sent ten products spaced two seconds apart. The server\'s controller method was invoked <em>exactly once</em> — at connection setup time — and the <code>Log.info</code> statement inside it printed immediately, proving the method was not waiting for the body to fully arrive. The <code>Flux&lt;Product&gt;</code> parameter was then passed downstream to the service layer, which subscribed to it and processed items as they trickled in over the wire.',
      'This is the essence of non-blocking request-body reading: the framework accepts the connection, hands the controller a <code>Flux</code> that acts as a live conduit to the still-arriving bytes, and the reactive pipeline processes elements whenever the client emits them. Because the HTTP connection stays open, the client can stream millions of products through that single <code>POST</code> invocation — the server never holds the entire payload in memory, and backpressure flows naturally through the reactive chain.',
    ],
    keyPoints: [
      'A <code>@RequestBody Flux&lt;T&gt;</code> parameter lets Spring WebFlux read the request body incrementally rather than buffering it entirely before the controller method executes.',
      'The controller method is invoked <strong>once</strong> at connection setup — the <code>Log.info</code> printing immediately in the prior demo proves the server does not block on body arrival.',
      'The client reuses the same HTTP connection to send multiple elements over time; the server\'s <code>Flux</code> emits each decoded item as it arrives on the wire.',
      'This pattern enables uploading millions of records through a single <code>POST</code> request with constant memory usage on both client and server.',
      'Backpressure propagates through the open connection: if the server slows down, the reactive pipeline signals the client to pause sending.',
    ],
    note: {
      label: 'KEY INSIGHT',
      text: 'The HTTP/1.1 chunked transfer encoding keeps the connection open so a single POST can carry an unbounded stream of items. The @RequestBody Flux is a live pipe to those chunks, not a pre-loaded collection.',
      tone: 'accent',
    },
    quiz: {
      question: 'In the previous demo, why did the server\'s Log.info statement print before any product had arrived in the request body?',
      options: [
        { label: 'Because Spring buffers the body asynchronously and logs first', correct: false },
        { label: 'Because the controller method is invoked at connection setup with a Flux that acts as a live conduit, not a fully-materialized body', correct: true },
        { label: 'Because the client sent an empty body and products in a separate request', correct: false },
        { label: 'Because Mono logs are deferred until subscription', correct: false },
      ],
      explanation: 'When the @RequestBody is typed as a Publisher (Flux), Spring WebFlux invokes the controller method as soon as the connection is established, passing a Flux that will emit items as they arrive. The method does not wait for the entire body — hence the log prints immediately.',
    },
  },
  {
    id: '10.10',
    title: '1 Million Products Upload - Demo',
    duration: '3 min',
    kind: 'demo',
    summary: [
      'With the product service and client from the previous lessons in place, we now run the full end-to-end upload of one million products. The instructor removes the per-product <code>doOnNext</code> logging (printing every product to the console would be noisy and slow) and eliminates the artificial delay elements so the stream completes in a reasonable time.',
      'The client generates a <code>Flux</code> of one million <code>ProductData</code> objects and sends them via the streaming <code>POST</code> endpoint built in earlier lessons. The server receives each product and persists it. On the instructor\'s machine the upload completes in roughly 15 seconds, after which the database table contains 1,000,010 products (a few extra from earlier test runs).',
      'After the successful upload, the instructor previews the next assignment: build a download API that returns a <code>Flux&lt;ProductData&gt;</code> so clients can stream all million products back out of the database. A corresponding client method should also be exposed, but the client should <em>not</em> print every product to the console.',
    ],
    keyPoints: [
      'Remove per-item <code>doOnNext</code> logging and artificial delays before running large-volume streams — console I/O and sleeps dominate otherwise.',
      'The streaming upload sends one million <code>ProductData</code> objects through a single reactive <code>POST</code> request, completing in ~15 seconds.',
      'After the upload, the database contains over one million product rows, confirming the end-to-end pipeline works.',
      'The next step is an assignment to build a download endpoint returning <code>Flux&lt;ProductData&gt;</code> and a matching client method.',
    ],
    code: `// ProductUploadDemo — running the 1-million-product upload
// (ProductClient and ProductData from earlier lessons)

import reactor.core.publisher.Flux;

public class ProductUploadDemo {

    private final ProductClient productClient;

    public ProductUploadDemo(ProductClient productClient) {
        this.productClient = productClient;
    }

    public void runMillionProductUpload() {
        Flux<ProductData> products = Flux.range(1, 1_000_000)
                .map(i -> new ProductData("product-" + i, "description-" + i, i));

        productClient.uploadProducts(products)
                .blockLast(); // block until the entire stream is sent
    }
}

// ProductClient — streaming upload method (from previous lesson)
// public Mono<Void> uploadProducts(Flux<ProductData> products) {
//     return webClient.post()
//             .uri("/products/upload")
//             .body(products, ProductData.class)
//             .retrieve()
//             .bodyToMono(Void.class);
// }`,
    codeLabel: 'java',
    note: {
      label: 'WHY THIS MATTERS',
      text: 'Removing console logging and artificial delays is essential for benchmarking reactive streams. Console I/O is synchronous and can become the bottleneck, masking the true throughput of the reactive pipeline.',
      tone: 'green',
    },
    quiz: {
      question: 'Why should you remove doOnNext logging that prints every product before running a million-product upload?',
      options: [
        { label: 'Because doOnNext is not supported by Flux', correct: false },
        { label: 'Because printing to the console for every item introduces synchronous I/O overhead that dominates the stream\'s execution time', correct: true },
        { label: 'Because doOnNext changes the type of the Flux', correct: false },
        { label: 'Because doOnNext triggers backpressure automatically', correct: false },
      ],
      explanation: 'doOnNext is a side-effect operator that executes on each emitted item. When it performs console I/O for a million items, the synchronous blocking nature of System.out.println becomes the dominant cost, making it impossible to measure the real throughput of the reactive pipeline.',
    },
  },
  {
    id: '10.11',
    title: 'Assignment - Download API',
    duration: '3 min',
    kind: 'assignment',
    summary: [
      'Your assignment is to build the <em>download</em> counterpart to the upload API from earlier lessons. You need to expose a server endpoint that streams all products back to the client as a <code>Flux&lt;ProductDto&gt;</code>, and a client method that consumes that stream reactively. The server side is straightforward: the repository\'s <code>findAll()</code> already returns a <code>Flux&lt;Product&gt;</code>, so you map each entity to a DTO and return the flux. The controller exposes this as a GET endpoint that produces <code>APPLICATION_JSON</code>.',
      'On the client side, the key distinction to understand is the difference between <code>Content-Type</code> and <code>Accept</code> headers. <code>Content-Type</code> describes the format of the <em>request</em> body you are sending, while <code>Accept</code> tells the server what response format you are willing to <em>receive</em>. Since this is a download (response), you use <code>.accept(MediaType.APPLICATION_JSON)</code> on the WebClient request, not <code>.contentType()</code>. You then call <code>.retrieve()</code> and <code>.bodyToFlux(ProductDto.class)</code> to consume the response as a reactive stream rather than a buffered collection.',
      'The solution involves three components: a service method that maps the repository flux to DTOs, a controller endpoint annotated with <code>@GetMapping</code> and <code>produces = MediaType.APPLICATION_JSON_VALUE</code>, and a WebClient call using <code>.accept()</code> and <code>.bodyToFlux()</code>. This mirrors the upload pattern but inverts the streaming direction — the server now pushes data to the client through the reactive pipeline.',
    ],
    keyPoints: [
      'Use <code>repository.findAll()</code> which returns <code>Flux&lt;Product&gt;</code> and map each entity to a DTO with <code>.map(EntityDtoMapper::toDto)</code>',
      'Annotate the download endpoint with <code>@GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)</code> to signal streaming JSON output',
      'Use <code>.accept(MediaType.APPLICATION_JSON)</code> on WebClient for responses, <em>not</em> <code>.contentType()</code> which is for request bodies',
      'Call <code>.retrieve().bodyToFlux(ProductDto.class)</code> to consume the response as a reactive stream rather than a buffered list',
      'The download API is the inverse of the upload API: the server pushes data out via <code>Flux</code> instead of receiving it',
    ],
    code: `java`,
    codeLabel: 'ProductService.java — Service method returning all products as DTOs',
    note: {
      label: 'KEY INSIGHT',
      text: 'Content-Type describes what you\'re sending; Accept describes what you\'re willing to receive. Mixing them up is a common source of HTTP negotiation errors in reactive clients.',
      tone: 'accent',
    },
    quiz: {
      question: 'When building the WebClient call to download products as a stream, which header configuration is correct?',
      options: [
        { label: '.contentType(MediaType.APPLICATION_JSON) — because we are sending JSON', correct: false },
        { label: '.accept(MediaType.APPLICATION_JSON) — because we are willing to receive JSON', correct: true },
        { label: '.contentType(MediaType.APPLICATION_NDJSON) — because it\'s a streaming response', correct: false },
        { label: 'No header needed — the server decides the format automatically', correct: false },
      ],
      explanation: 'The Accept header tells the server what media type the client can handle in the response. Content-Type is used for the request body format, which isn\'t relevant here since this is a GET request with no body.',
    },
  },
  {
    id: '10.12',
    title: '1 Million Products Download - Demo',
    duration: '4 min',
    kind: 'demo',
    summary: [
      'With the download API and client implemented in the previous lessons, this demo verifies the end-to-end flow by downloading all one million products and writing them to a file. A utility <code>FileWriter</code> class (from the instructor\'s prior Reactive Programming course) is introduced to consume a <code>Flux&lt;String&gt;</code> and persist each line to a file at a given path, emitting a complete signal when finished.',
      'The test method calls the product client\'s <code>downloadProducts()</code> method, which returns a <code>Flux&lt;Product&gt;</code>. Since <code>FileWriter</code> expects a <code>Flux&lt;String&gt;</code>, each <code>Product</code> is converted using the <code>toString()</code> method. While an <code>ObjectMapper</code> could be used for proper JSON serialization, <code>toString()</code> keeps the demo simple and still produces readable output.',
      'The resulting <code>Flux&lt;String&gt;</code> is passed to <code>FileWriter.create()</code> along with a path (<code>products.txt</code> in the project root). Because <code>FileWriter.create()</code> returns <code>Mono&lt;Void&gt;</code> — completing only after the entire flux has been consumed and the file written — a <code>StepVerifier</code> with <code>expectComplete()</code> is used to block the test until the download finishes. After running the upload first (to populate the data store) and then the download test, the resulting <code>products.txt</code> contains all one million product entries.',
      'This demo validates the full reactive pipeline: the server streams products as JSON Lines, the client receives them as a <code>Flux</code>, and the <code>FileWriter</code> writes them to disk without buffering the entire dataset in memory. This is the hallmark of reactive backpressure — the consumer dictates the pace, and the server only produces data as fast as the file I/O can absorb it.',
    ],
    keyPoints: [
      '<strong>FileWriter utility</strong> consumes a <code>Flux&lt;String&gt;</code> and writes each element as a line to a file, returning <code>Mono&lt;Void&gt;</code> that completes when the flux is fully consumed.',
      'Convert <code>Flux&lt;Product&gt;</code> to <code>Flux&lt;String&gt;</code> using <code>.map(Product::toString)</code> — or use an <code>ObjectMapper</code> for proper JSON output in production code.',
      '<code>FileWriter.create()</code> returns <code>Mono&lt;Void&gt;</code>, so <code>StepVerifier.create(...).expectComplete().verify()</code> blocks until the entire download finishes.',
      'Always run the upload test first to populate the data store before testing the download.',
      'The entire 1-million-product download works without <code>OutOfMemoryError</code> because reactive streaming applies backpressure throughout the pipeline — data flows element-by-element, not as a single buffered batch.',
    ],
    code: `package com.example.section08;

import org.junit.jupiter.api.Test;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;

import java.nio.file.Path;

class ProductClientTest {

    private final ProductClient client = new ProductClient();

    @Test
    void downloadProducts() {
        // 1. Download products as Flux<Product> (client from lesson 10.7)
        Flux<Product> productFlux = client.downloadProducts();

        // 2. Convert to Flux<String> for the FileWriter
        Flux<String> stringFlux = productFlux.map(Product::toString);

        // 3. Write to a file in the project root directory
        Path path = Path.of("products.txt");
        Mono<Void> fileWriteMono = FileWriter.create(stringFlux, path);

        // 4. Verify the file write completes
        StepVerifier.create(fileWriteMono)
                .expectComplete()
                .verify();
    }
}`,
    codeLabel: 'java',
    note: {
      label: 'WHY THIS MATTERS',
      text: 'This demo proves the reactive download pipeline handles one million records without memory issues. Backpressure ensures the server only sends data as fast as the file I/O can write it, keeping heap usage flat regardless of dataset size.',
      tone: 'green',
    },
    quiz: {
      question: 'Why does FileWriter.create() return Mono<Void> instead of Flux<String>?',
      options: [
        { label: 'Because it transforms each String element into a void signal', correct: false },
        { label: 'Because it is a terminal operation that completes only after the entire Flux is consumed and the file is fully written', correct: true },
        { label: 'Because Mono<Void> is required by StepVerifier to work correctly', correct: false },
        { label: 'Because file I/O operations cannot emit elements in reactive streams', correct: false },
      ],
      explanation: 'FileWriter.create() consumes the entire Flux internally and writes each element to a file. It returns Mono<Void> as a completion signal — the Mono emits nothing and simply completes once all elements have been processed and the file is closed. This lets the caller wait for the full operation to finish without receiving intermediate values.',
    },
  },
  {
    id: '10.13',
    title: 'What About Bidirectional Streaming',
    duration: '3 min',
    kind: 'concept',
    summary: [
      'Having covered client streaming (upload) in earlier lessons and server streaming (download) in the assignment, the natural question is: what does bidirectional streaming look like in a reactive Spring WebFlux application? The answer is straightforward — it is simply a combination of both patterns working simultaneously over a single request.',
      'In the current upload API, the client sends a <code>Flux&lt;Product&gt;</code> and the server responds with a single <code>Mono&lt;Void&gt;</code> or <code>Mono&lt;String&gt;</code> once all products have been processed. To turn this into a bidirectional stream, you change the return type from a <code>Mono</code> to a <code>Flux&lt;Product&gt;</code>. As each product arrives from the client, the server processes it and immediately emits a response object back downstream — the client receives a continuous stream of acknowledgements rather than waiting for a single completion signal.',
      'This pattern is useful when you want real-time feedback during a bulk operation — for example, returning each saved product (with its generated ID) as it is persisted, so the client can track progress, display status, or handle failures per-item. The reactive pipeline handles both directions concurrently: products flow in on the request body while processed results flow out on the response body, all without blocking.',
    ],
    keyPoints: [
      'Bidirectional streaming combines client streaming (request body) and server streaming (response body) into a single reactive exchange.',
      'Change the handler return type from <code>Mono&lt;Void&gt;</code> to <code>Flux&lt;Product&gt;</code> to emit responses as each item is processed.',
      'Each incoming product triggers an immediate outgoing response — no need to wait for the entire stream to complete.',
      'Useful for real-time per-item feedback during bulk operations, such as returning saved entities with generated IDs.',
      'Spring WebFlux handles both directions concurrently via reactive back-pressure, so neither side blocks the other.',
    ],
    code: `java`,
    codeLabel: 'java',
    note: {
      label: 'KEY INSIGHT',
      text: 'Bidirectional streaming in WebFlux is not a new API — it emerges naturally when a handler accepts a Flux as input and returns a Flux as output. The reactive pipeline pipelines both directions simultaneously.',
      tone: 'accent',
    },
    quiz: {
      question: 'What single change turns the existing client-streaming upload endpoint into a bidirectional stream?',
      options: [
        { label: 'Change the return type from Mono<Void> to Flux<Product>', correct: true },
        { label: 'Add @ResponseBody to the handler method', correct: false },
        { label: 'Wrap the request body in a Flux.defer()', correct: false },
        { label: 'Switch from WebClient to RestClient', correct: false },
      ],
      explanation: 'Returning a Flux<Product> instead of a Mono causes the server to emit a response item for each product as it is processed, creating a continuous stream back to the client — the defining characteristic of bidirectional streaming.',
    },
  },
  {
    id: '10.14',
    title: 'Summary',
    duration: '2 min',
    kind: 'summary',
    summary: [
      'This section explored streaming communication patterns in Spring WebFlux, moving beyond the traditional request-response model. While <code>Mono</code> remains the right tool for single-request/single-response interactions, <code>Flux</code> enables efficient transfer of large datasets between services by streaming elements incrementally rather than buffering the entire payload in memory.',
      '',
      'We used <code>application/x-ndjson</code> (newline-delimited JSON) as the media type for our streaming endpoints. Each line is a self-contained JSON object, which lets the consumer parse and process records as they arrive — a natural fit for <code>Flux</code> publishers on both the server and client side.',
      '',
      'By declaring a <code>Flux</code> as a <code>@RequestBody</code> parameter, we signal to Spring that the request body should be consumed in a non-blocking, reactive fashion. The framework reads the incoming stream and emits elements to our handler as they become available, avoiding the need to materialize the entire request before processing begins. We demonstrated this with a one-million-product upload and a corresponding download, and briefly discussed how these same patterns extend to bidirectional streaming.',
    ],
    keyPoints: [
      'Use <code>Mono</code> for single-value request-response; use <code>Flux</code> when streaming large or continuous datasets.',
      '<code>application/x-ndjson</code> (newline-delimited JSON) pairs naturally with <code>Flux</code> — each line is an independent JSON object that can be parsed and processed as it arrives.',
      'Declaring a <code>Flux</code> as a <code>@RequestBody</code> tells Spring WebFlux to consume the request body in a non-blocking, reactive manner.',
      'Streaming uploads and downloads keep memory footprint low even for very large payloads (demonstrated with 1 million products).',
      'The same reactive streaming primitives can be extended to bidirectional (request and response stream) communication patterns.',
    ],
    note: {
      label: 'KEY INSIGHT',
      text: 'The choice between Mono and Flux mirrors the choice between loading an entire dataset into memory versus processing it element-by-element. For high-volume data transfer, Flux with NDJSON is the difference between a service that scales and one that runs out of heap.',
      tone: 'accent',
    },
    quiz: {
      question: 'Why is application/x-ndjson a better media type than application/json for streaming a large collection of objects via a Flux endpoint?',
      options: [
        { label: 'NDJSON objects are smaller in wire format than regular JSON objects', correct: false },
        { label: 'Each line is a complete JSON object, so the consumer can parse and emit records incrementally without waiting for the entire array to arrive', correct: true },
        { label: 'NDJSON supports compression by default whereas standard JSON does not', correct: false },
        { label: 'NDJSON is required by the WebFlux framework; standard JSON cannot be used with Flux', correct: false },
      ],
      explanation: 'Standard application/json wraps multiple objects in a single array, which means the parser must read the closing bracket before it can finalize the structure. With x-ndjson, every newline terminates a complete JSON object, allowing the consumer to parse and process each record the moment it arrives on the wire.',
    },
  },
]
