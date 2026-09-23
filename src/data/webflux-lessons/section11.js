export default [
  {
    id: '11.1',
    title: 'Introduction to Server-Sent Events (SSE)',
    duration: '4 min',
    kind: 'theory',
    summary: [
      'Server-Sent Events (SSE) solve a common problem in real-time applications: when a browser needs continuous updates (stock prices, election results, live scores), the traditional approach is HTTP polling — the client repeatedly calls the backend asking "any updates yet?" This wastes resources when there are no updates, creating unnecessary load on the server. SSE flips this model: the server pushes events to the browser only when there is new data, eliminating wasteful polling cycles.',
      'SSE is a one-way communication channel from server to browser over a standard HTTP connection. Browsers implement the <code>EventSource</code> API, which expects responses in a specific text format (<code>text/event-stream</code> media type). This is distinct from <code>application/stream+json</code>, which is used for service-to-service reactive streaming. In Spring WebFlux, an SSE endpoint returns a <code>Flux</code> with <code>produces = MediaType.TEXT_EVENT_STREAM_VALUE</code>, and the framework handles encoding each emitted item into the SSE wire format the browser expects.',
      'For this section\'s business scenario, we extend the existing product service so that whenever a new product is added, the server pushes a notification to interested users\' browsers. The challenge is detecting <em>when</em> a product is created and broadcasting it. The solution uses a <strong>Sink</strong> — a Reactor construct that acts as both a publisher and a subscriber. Multiple threads can emit items into one end of the sink (e.g., when a POST request creates a product), while the other end exposes a <code>Flux</code> that SSE subscribers observe. This decouples event production from consumption and is the backbone of the streaming pipeline we will build across the upcoming lessons.',
    ],
    keyPoints: [
      '<strong>Polling is wasteful:</strong> clients repeatedly requesting updates creates unnecessary server load when no new data exists.',
      '<strong>SSE is server-to-browser push:</strong> a one-way channel where the server sends events only when updates occur, using <code>text/event-stream</code> media type.',
      '<strong>Browser <code>EventSource</code> API</strong> expects a specific SSE wire format — use <code>MediaType.TEXT_EVENT_STREAM_VALUE</code> for browser-facing endpoints, not <code>application/stream+json</code>.',
      '<strong>Sinks bridge imperative and reactive worlds:</strong> they allow multiple threads to push items into a <code>Flux</code> that reactive subscribers can observe.',
      '<strong>Business scenario:</strong> notify users whenever a new product is added to the product service, using a sink to emit product events that are streamed via SSE.',
    ],
    note: {
      label: 'WHY THIS MATTERS',
      text: 'SSE is the simplest real-time push mechanism for browser applications because it works over plain HTTP without needing WebSocket upgrade handshakes or custom protocols. It is ideal for one-way notifications like new-product alerts, live scores, or price updates.',
      tone: 'accent',
    },
    quiz: {
      question: 'Which media type should a Spring WebFlux endpoint declare to produce a stream that a browser\'s EventSource API can consume?',
      options: [
        { label: 'application/json', correct: false },
        { label: 'application/stream+json', correct: false },
        { label: 'text/event-stream', correct: true },
        { label: 'application/octet-stream', correct: false },
      ],
      explanation: 'Browsers implement the SSE specification via the EventSource API, which expects responses encoded as text/event-stream. The application/stream+json media type is designed for service-to-service reactive streaming, not for direct browser consumption.',
    },
  },
  {
    id: '11.2',
    title: 'Sink Configuration',
    duration: '3 min',
    kind: 'demo',
    summary: [
      'Building on the project structure from earlier sections, this lesson sets up the foundational infrastructure for real-time product streaming. The instructor creates a new package <code>section09</code> and copies the existing <code>ProductService</code> and <code>ProductDTO</code> into it, establishing a clean workspace for the SSE implementation.',
      'Within <code>section09</code>, a <code>config</code> sub-package is created containing an <code>ApplicationConfig</code> class annotated with <code>@Configuration</code>. This class defines a Spring bean for a Reactor <code>Sink.Many&lt;ProductDTO&gt;</code> — the conduit through which product events will be pushed to subscribers in subsequent lessons.',
      'The specific sink type chosen is <code>Sink.Many.replay()</code> with a <code>limit(1)</code> configuration. A <em>replay sink</em> caches emitted items so that late subscribers still receive previously sent messages. By limiting the replay buffer to one, only the most recently emitted product is replayed to any subscriber that joins after it was sent — a common pattern for streaming the latest state of a value (similar to a <em>BehaviorSubject</em> in RxJava terminology).',
    ],
    keyPoints: [
      '<strong>Sink.Many</strong> is used because we need to emit multiple messages over time to multiple subscribers, as opposed to <code>Sink.One</code> which emits a single value.',
      '<code>Sink.Many.replay(limit)</code> caches emitted items so late subscribers receive previously sent messages — essential for real-time streaming scenarios where clients connect mid-stream.',
      '<code>.limit(1)</code> on the replay sink ensures only the <em>last</em> emitted item is replayed to late joiners, keeping memory usage minimal while still providing the latest state.',
      'The sink is exposed as a Spring <code>@Bean</code> so it can be injected wherever events need to be published or consumed.',
    ],
    code: `package com.example.playground.section09.config;

import com.example.playground.section09.dto.ProductDTO;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import reactor.core.publisher.Sink;

@Configuration
public class ApplicationConfig {

    @Bean
    public Sink.Many<ProductDTO> productSink() {
        // Replay the last emitted item to late subscribers
        return Sink.many().replay().limit(1);
    }
}`,
    codeLabel: 'java',
    note: {
      label: 'WHEN TO USE',
      text: 'Use <code>Sink.Many.replay().limit(1)</code> when you want late subscribers to immediately receive the most recent value upon subscription — ideal for streaming the latest price or state. Use <code>Sink.Many.multicast()</code> instead if late subscribers should only receive items emitted <em>after</em> they subscribe.',
      tone: 'accent',
    },
    quiz: {
      question: 'Why is Sink.Many.replay().limit(1) chosen over Sink.Many.multicast() for this product streaming scenario?',
      options: [
        { label: 'multicast cannot handle multiple subscribers', correct: false },
        { label: 'replay with limit(1) ensures late subscribers immediately receive the most recently emitted product', correct: true },
        { label: 'replay is the only Sink.Many variant that supports backpressure', correct: false },
        { label: 'limit(1) prevents any items from being emitted', correct: false },
      ],
      explanation: 'A multicast sink only delivers items emitted <em>after</em> a subscriber joins, so late subscribers would miss the latest product. <code>replay().limit(1)</code> caches the most recent item and replays it to each new subscriber, ensuring they always start with the current state.',
    },
  },
  {
    id: '11.3',
    title: 'Emitting Items via Sink',
    duration: '3 min',
    kind: 'demo',
    summary: [
      'With the <code>Sinks.Many&lt;ProductDTO&gt;</code> configured in the previous lesson, the service layer now needs to use it to broadcast newly saved products. The <code>ProductService</code> autowires the sink and exposes two key methods: <code>saveProduct</code> for persisting a product and <code>productStream</code> for subscribing to the live stream of saved products.',
      'The <code>saveProduct</code> method accepts a <code>Mono&lt;ProductDTO&gt;</code>, maps it to an entity via <code>EntityMapper</code>, flatMaps through the repository to persist it, then maps the saved entity back to a DTO. The critical addition is a <code>doOnNext</code> hook after the DTO conversion that calls <code>this.sink.tryEmitNext(productDTO)</code> using a method reference. This pushes every newly saved product into the sink, making it available to all subscribers of the stream.',
      'The <code>productStream</code> method simply returns <code>this.sink.asFlux()</code>. Because <code>Sinks.Many</code> can be exposed as a <code>Flux</code>, any consumer (such as an SSE endpoint) can subscribe and receive items that are emitted after their subscription. The sink acts as a bridge between the request-response save operation and the streaming consumer.',
      '<code>tryEmitNext</code> is used instead of <code>emitNext</code> because it does not throw an exception if emission fails (e.g., if the sink\'s buffer is full or there are no subscribers). In this use case, if no one is listening when a product is saved, we simply discard that emission rather than failing the save operation — which is the desired behavior.',
    ],
    keyPoints: [
      'Autowire the <code>Sinks.Many&lt;ProductDTO&gt;</code> into the service to emit and stream product events.',
      'Use <code>doOnNext</code> in the save pipeline to call <code>sink.tryEmitNext(dto)</code> after the product is persisted and mapped back to DTO.',
      '<code>tryEmitNext</code> is non-throwing — it returns an <code>EmitResult</code> and silently handles cases with no subscribers or a full buffer.',
      'Expose the sink as a <code>Flux</code> via <code>sink.asFlux()</code> so consumers can subscribe to the live stream of saved products.',
      'The sink decouples the producer (save request) from the consumer (streaming subscriber), following a publisher-subscriber pattern.',
    ],
    code: `package com.example.section09.service;

import com.example.section09.dto.ProductDTO;
import com.example.section09.entity.Product;
import com.example.section09.mapper.EntityMapper;
import com.example.section09.repository.ProductRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.core.publisher.Sinks;

@Service
public class ProductService {

    private final ProductRepository repository;
    private final EntityMapper entityMapper;
    private final Sinks.Many<ProductDTO> sink;

    @Autowired
    public ProductService(ProductRepository repository,
                          EntityMapper entityMapper,
                          Sinks.Many<ProductDTO> sink) {
        this.repository = repository;
        this.entityMapper = entityMapper;
        this.sink = sink;
    }

    public Mono<ProductDTO> saveProduct(Mono<ProductDTO> mono) {
        return mono
                .map(entityMapper::toEntity)
                .flatMap(repository::save)
                .map(entityMapper::toDTO)
                .doOnNext(this.sink::tryEmitNext);
    }

    public Flux<ProductDTO> productStream() {
        return this.sink.asFlux();
    }
}`,
    codeLabel: 'java',
    note: {
      label: 'KEY INSIGHT',
      text: 'The <code>doOnNext</code> hook is a side-effect operator — it fires after the item passes through but does not alter the pipeline\'s return value. This makes it ideal for fire-and-forget emissions to the sink without affecting the save response.',
      tone: 'accent',
    },
    quiz: {
      question: 'Why is tryEmitNext used instead of emitNext in the saveProduct pipeline?',
      options: [
        { label: 'tryEmitNext is faster because it skips buffer checks', correct: false },
        { label: 'tryEmitNext does not throw an exception if emission fails, so a failed emission won\'t break the save operation', correct: true },
        { label: 'emitNext is deprecated in newer Reactor versions', correct: false },
        { label: 'tryEmitNext automatically retries emission until a subscriber connects', correct: false },
      ],
      explanation: 'emitNext throws an exception if emission fails (e.g., no subscribers or buffer full). tryEmitNext returns an EmitResult instead, so the save operation completes successfully even if no one is currently listening to the stream.',
    },
  },
  {
    id: '11.4',
    title: 'Exposing Streaming API',
    duration: '3 min',
    kind: 'demo',
    summary: [
      'With the <code>Sink</code> configured and the service emitting items (from the previous two lessons), the next step is to expose these streams over HTTP. The controller needs two endpoints: a standard POST endpoint to create products, and a GET endpoint that streams new products to clients as they are emitted.',
      'The POST endpoint (<code>/products</code>) follows the usual reactive pattern — it accepts a <code>Mono&lt;ProductDto&gt;</code> as the request body and passes it directly to <code>service.saveProduct()</code>. Because the service returns a <code>Mono&lt;ProductDto&gt;</code>, the controller simply returns it, letting Spring WebFlux handle the subscription and serialization.',
      'The streaming endpoint (<code>/products/stream</code>) returns a <code>Flux&lt;ProductDto&gt;</code> from <code>service.productStream()</code>. The critical detail is annotating it with <code>produces = MediaType.TEXT_EVENT_STREAM_VALUE</code>. This tells Spring to use Server-Sent Events (SSE) as the response format, where each <code>ProductDto</code> item emitted by the <code>Flux</code> is serialized as an individual SSE <code>data:</code> field. Without this media type, Spring would attempt to serialize the <code>Flux</code> as a single JSON array and close the connection immediately rather than keeping it open for streaming.',
    ],
    keyPoints: [
      'The streaming endpoint must specify <code>produces = MediaType.TEXT_EVENT_STREAM_VALUE</code> to enable SSE format.',
      'A POST endpoint for creating products feeds items into the <code>Sink</code> (via the service), which the streaming endpoint then emits to connected clients.',
      'The controller methods are thin wrappers — they delegate directly to the service, which manages the <code>Sink</code> and reactive streams.',
      'SSE keeps the HTTP connection open, sending each <code>Flux</code> item as a separate <code>data:</code> event rather than buffering everything into one response.',
    ],
    code: `package com.example.section11.controller;

import com.example.section09.dto.ProductDto;
import com.example.section11.service.ProductService;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("products")
public class ProductController {

    private final ProductService service;

    public ProductController(ProductService service) {
        this.service = service;
    }

    @PostMapping
    public Mono<ProductDto> saveProduct(@RequestBody Mono<ProductDto> mono) {
        return this.service.saveProduct(mono);
    }

    @GetMapping(value = "stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<ProductDto> productStream() {
        return this.service.productStream();
    }
}`,
    codeLabel: 'java',
    note: {
      label: 'KEY INSIGHT',
      text: 'The <code>produces = MediaType.TEXT_EVENT_STREAM_VALUE</code> annotation is what transforms a normal reactive endpoint into an SSE endpoint. Without it, Spring WebFlux treats the <code>Flux</code> as a single JSON array response, closing the connection after all items are collected — defeating the purpose of streaming.',
      tone: 'accent',
    },
    quiz: {
      question: 'What happens if you omit `produces = MediaType.TEXT_EVENT_STREAM_VALUE` from the streaming endpoint?',
      options: [
        { label: 'Spring collects all Flux items and returns them as a single JSON array, closing the connection after the first emission batch', correct: true },
        { label: 'The endpoint throws an error immediately because Flux cannot be serialized without SSE', correct: false },
        { label: 'The endpoint works identically — SSE is the default for Flux return types', correct: false },
        { label: 'The endpoint returns only the first item and discards the rest', correct: false },
      ],
      explanation: 'Without the SSE media type, Spring WebFlux defaults to application/json and treats the Flux as a collection to be serialized into a JSON array. It buffers items and closes the connection, rather than keeping it open to stream items as they arrive. The TEXT_EVENT_STREAM_VALUE media type instructs Spring to use the SSE format, sending each item as a separate event.',
    },
  },
  {
    id: '11.5',
    title: 'SSE Demo',
    duration: '3 min',
    kind: 'demo',
    summary: [
      'With the streaming API, sink, and product service all wired together from the previous lessons, this lesson demonstrates the full SSE flow end-to-end. The instructor starts the Spring Boot application and opens a browser tab to <code>http://localhost:8080/products/stream</code>. Initially the page appears blank — this is expected behavior because the <code>Flux</code> backed by the <code>Sinks.Many</code> only emits items when new data is pushed into the sink, and no products have been submitted yet.',
      'To trigger a stream event, the instructor uses Postman to <code>POST</code> a new product (<code>name: "iPhone"</code>, <code>price: 100</code>) to <code>http://localhost:8080/products</code>. The moment the POST completes, the browser tab receiving the SSE stream immediately displays the JSON payload of the newly created product. Repeating the process with a second product (<code>"Mac Pro"</code>, <code>$200</code>) produces a second event in the same browser tab, confirming that every client subscribed to the stream receives every emitted item in real time.',
      'As a fallback for environments where the browser doesn\'t render SSE properly, the instructor demonstrates using <code>curl</code> from the terminal: <code>curl http://localhost:8080/products/stream</code>. The terminal output shows the last emitted message (e.g., the Mac Pro payload), and when a third product (<code>"Apple Watch"</code>, <code>$300</code>) is POSTed via Postman, the <code>curl</code> client receives that event as well. This confirms the setup works across multiple concurrent client types — browsers, <code>curl</code>, or any HTTP client that supports SSE.',
    ],
    keyPoints: [
      'The SSE endpoint <code>/products/stream</code> stays open and silent until a product is POSTed — a blank browser tab is normal, not an error.',
      'Each <code>POST /products</code> triggers <code>sink.tryEmitNext()</code> (from the previous lesson), which pushes the new product to <strong>all</strong> connected SSE subscribers.',
      'Multiple concurrent clients (browser, <code>curl</code>, Postman) can subscribe to the same stream simultaneously and all receive the same events.',
      '<code>curl http://localhost:8080/products/stream</code> is a reliable alternative when browsers don\'t render SSE output correctly.',
      'SSE uses a single long-lived HTTP connection per client; the server never closes the connection, which is why events appear incrementally rather than as a single response.',
    ],
    code: `curl http://localhost:8080/products/stream

# POST a new product to trigger an SSE event (e.g., via Postman or curl):
curl -X POST http://localhost:8080/products \
  -H "Content-Type: application/json" \
  -d '{"name": "iPhone", "description": "iPhone", "price": 100}'

# Each connected SSE client (browser, curl, etc.) immediately receives:
# data:{"id":...,"name":"iPhone","description":"iPhone","price":100}
#`,
    codeLabel: 'terminal',
    note: {
      label: 'WHY THIS MATTERS',
      text: 'Seeing a blank browser tab on first load is the most common point of confusion for developers new to SSE. The stream is alive and working — it simply has no data to send until the sink receives an emission.',
      tone: 'accent',
    },
    quiz: {
      question: 'You open http://localhost:8080/products/stream in your browser and see a blank page. What is the most likely explanation?',
      options: [
        { label: 'The SSE endpoint is broken and returning an empty response.', correct: false },
        { label: 'The connection is open and waiting — no products have been emitted to the sink yet.', correct: true },
        { label: 'You need to refresh the page to initialize the stream.', correct: false },
        { label: 'The browser doesn\'t support SSE and you must use Postman instead.', correct: false },
      ],
      explanation: 'A blank page is normal behavior. The Flux backed by Sinks.Many only emits items when tryEmitNext is called (i.e., when a product is POSTed). The connection is alive and open; it simply has no events to deliver yet.',
    },
  },
  {
    id: '11.6',
    title: 'Price Filter Implementation',
    duration: '5 min',
    kind: 'demo',
    summary: [
      'Building on the streaming API from the previous lesson, this lesson adds two new requirements: automatic product generation and price-based filtering. Instead of manually posting products via Postman, a <code>CommandLineRunner</code> generates a new product every second with a random price between 1 and 100. Users can then subscribe to the stream and specify a maximum price, receiving only products at or below that threshold.',
      'The auto-generation is handled by a <code>DataSetupService</code> in the <code>section09</code> package. It uses <code>Flux.range(1, 1000)</code> delayed by one second per element, maps each index to a <code>ProductDTO</code> with a generated name and random price, then flat-maps into <code>productService.saveProduct()</code>. Calling <code>subscribe()</code> at the end kicks off the pipeline so products flow into the <code>Sink</code> (configured in earlier lessons) as soon as the application starts.',
      'Price filtering is implemented directly in the SSE controller endpoint. A <code>@PathVariable</code> named <code>maxPrice</code> is added to the streaming endpoint, and a simple <code>filter</code> operator is applied to the product <code>Flux</code> — only products whose price is less than or equal to <code>maxPrice</code> pass through. This leverages the fact that <code>filter</code> is applied per-subscriber, so each connected client gets its own independent filter without affecting other subscribers or the shared <code>Sink</code>.',
    ],
    keyPoints: [
      '<strong>CommandLineRunner</strong> runs automatically on application startup, making it ideal for seeding demo data without manual intervention.',
      '<code>Flux.range(1, 1000).delayElements(Duration.ofSeconds(1))</code> emits 1000 items at one-second intervals, simulating a live data feed.',
      'The <code>filter</code> operator on a <code>Flux</code> is applied per-subscriber, so each SSE client can filter independently without impacting others.',
      'Using <code>@PathVariable</code> for <code>maxPrice</code> lets each client specify its own price threshold via the URL.',
      '<code>ThreadLocalRandom.current().nextInt(1, 101)</code> generates a random price between 1 and 100 inclusive.',
    ],
    code: `package com.example.section09.service;

import com.example.section09.dto.ProductDTO;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Flux;

import java.time.Duration;
import java.util.concurrent.ThreadLocalRandom;

@Component
public class DataSetupService implements CommandLineRunner {

    private final ProductService productService;

    public DataSetupService(ProductService productService) {
        this.productService = productService;
    }

    @Override
    public void run(String... args) {
        Flux.range(1, 1000)
            .delayElements(Duration.ofSeconds(1))
            .map(i -> new ProductDTO(
                null,
                "product-" + i,
                ThreadLocalRandom.current().nextInt(1, 101) // random price 1–100
            ))
            .flatMap(productService::saveProduct)
            .subscribe();
    }
}

// === Controller with price filter ===
package com.example.section09.controller;

import com.example.section09.dto.ProductDTO;
import com.example.section09.service.ProductService;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Flux;

@RestController
public class ProductController {

    private final ProductService productService;

    public ProductController(ProductService productService) {
        this.productService = productService;
    }

    @GetMapping(value = "/products/{maxPrice}", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<ProductDTO> getProductStream(@PathVariable Integer maxPrice) {
        return productService.productStream()
            .filter(product -> product.price() <= maxPrice);
    }
}`,
    codeLabel: 'java',
    note: {
      label: 'KEY INSIGHT',
      text: 'The <code>filter</code> operator is applied per-subscriber on the shared <code>Flux</code>, so each SSE client receives only products matching its own price threshold — without any server-side per-client state management.',
      tone: 'accent',
    },
    quiz: {
      question: 'Why does applying <code>filter</code> in the controller allow different SSE clients to receive different subsets of products from the same <code>Sink</code>?',
      options: [
        { label: 'The Sink creates a separate copy of all products for each subscriber, so filters are independent.', correct: false },
        { label: 'Reactive streams are cold, so each subscriber triggers a new data generation pipeline with its own filter.', correct: false },
        { label: 'Each subscriber to the shared Flux gets its own downstream chain, so operators like filter are evaluated independently per subscriber.', correct: true },
        { label: 'The filter modifies the Sink itself, blocking non-matching products from being emitted.', correct: false },
      ],
      explanation: 'When multiple clients subscribe to the same hot Flux from a Sink, each subscriber gets its own downstream operator chain. The filter is applied in each subscriber\'s pipeline independently, so one client filtering for maxPrice=50 and another for maxPrice=80 each see only their matching products without affecting the Sink or other subscribers.',
    },
  },
  {
    id: '11.7',
    title: 'Adding UI',
    duration: '3 min',
    kind: 'demo',
    summary: [
      'This lesson adds a simple HTML front-end to consume the SSE price stream built in the previous lessons. The file <code>index.html</code> is placed under <code>src/main/resources/static/</code> so that Spring Boot serves it automatically at the root URL. The UI provides a text input where the user enters a maximum price (e.g., $50), a <strong>Notify Me</strong> button to start the stream, and a <strong>Stop</strong> button to disconnect.',
      'The JavaScript function <code>observeProducts()</code> reads the price from the input field and opens an <code>EventSource</code> connection to <code>/product-stream/{price}</code> — the SSE endpoint exposed earlier. <code>EventSource</code> is the browser\'s built-in API for consuming Server-Sent Events over HTTP; it maintains a persistent connection and fires <code>onmessage</code> each time the server pushes a new event. In the callback, the incoming product JSON is parsed and appended as a new row in an HTML table. Clicking <strong>Stop</strong> calls <code>source.close()</code>, terminating the SSE connection and stopping further updates.',
      'This UI demonstrates the client-side counterpart to Spring WebFlux\'s <code>Flux&lt;Product&gt;</code> stream: the server pushes items reactively, and the browser reacts to each event asynchronously without polling. No frameworks or build tools are needed — just plain HTML and vanilla JavaScript, which is sufficient because the <code>EventSource</code> API handles reconnection and event parsing natively.',
    ],
    keyPoints: [
      'Place <code>index.html</code> in <code>src/main/resources/static/</code> for Spring Boot to auto-serve it as static content',
      'The browser\'s <code>EventSource</code> API is the standard client-side mechanism for consuming SSE (<code>text/event-stream</code>) endpoints',
      '<code>EventSource.onmessage</code> fires for each server-pushed event — append DOM elements inside this callback to display streamed data in real time',
      'Call <code>source.close()</code> to cleanly disconnect from the SSE stream when the user no longer wants updates',
      'The price value from the input is appended to the URL path (e.g., <code>/product-stream/50</code>), matching the <code>@PathVariable</code> on the server-side controller method',
    ],
    code: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Product Price Stream</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        input, button { padding: 8px; margin: 5px; }
        table { border-collapse: collapse; width: 100%; margin-top: 15px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <h2>Product Price Notifier</h2>
    <div>
        <label>Max Price ($):</label>
        <input type="number" id="priceInput" placeholder="e.g., 50" />
        <button onclick="observeProducts()">Notify Me</button>
        <button onclick="stopObserving()">Stop</button>
    </div>
    <table id="productTable">
        <thead>
            <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Price</th>
            </tr>
        </thead>
        <tbody id="productBody"></tbody>
    </table>

    <script>
        let source = null;

        function observeProducts() {
            const price = document.getElementById('priceInput').value;
            if (!price) {
                alert('Please enter a maximum price');
                return;
            }

            // Clear previous rows
            document.getElementById('productBody').innerHTML = '';

            // Open SSE connection to the server-side Flux<Product> stream
            source = new EventSource('/product-stream/' + price);

            // Fired each time the server pushes a new Product event
            source.onmessage = function (event) {
                const product = JSON.parse(event.data);
                const tbody = document.getElementById('productBody');
                const row = '<tr><td>' + product.id + '</td>'
                          + '<td>' + product.name + '</td>'
                          + '<td>$' + product.price + '</td></tr>';
                tbody.insertAdjacentHTML('beforeend', row);
            };
        }

        function stopObserving() {
            if (source) {
                source.close();
                source = null;
            }
        }
    </script>
</body>
</html>`,
    codeLabel: 'html',
    note: {
      label: 'WHY THIS MATTERS',
      text: 'The <code>EventSource</code> API is what makes SSE practical on the client side — it handles the persistent HTTP connection, automatic reconnection, and event parsing for you, so the UI stays simple without needing WebSocket libraries or polling logic.',
      tone: 'green',
    },
    quiz: {
      question: 'What happens when the user clicks the Stop button in the UI?',
      options: [
        { label: 'The server stops emitting items to all connected clients', correct: false },
        { label: 'The client-side EventSource connection is closed, so no further events are received by this browser', correct: true },
        { label: 'The server-side Flux is cancelled and the sink is destroyed', correct: false },
        { label: 'Nothing — the stream continues and rows keep appending', correct: false },
      ],
      explanation: '<code>source.close()</code> only closes the browser\'s SSE connection. The server-side Flux and sink remain active for other clients. The server does not know about individual client disconnections unless it detects the cancelled subscription signal.',
    },
  },
  {
    id: '11.8',
    title: 'Price Filter Demo via UI',
    duration: '2 min',
    kind: 'demo',
    summary: [
      'With the application running and the data setup service continuously generating products, we can now demonstrate the price filter feature through the browser UI. Opening two browser windows pointed at <code>localhost:8080</code> simulates two distinct users connecting to the SSE stream simultaneously.',
      'Each user configures a different price threshold in their UI — one sets a maximum of $80 and the other sets $50. As products flow through the shared <code>Sinks.Many</code>, the per-subscriber <code>filter</code> operator (added in the previous lesson) ensures each user only receives items matching their individual criteria. For example, a product priced at $63 appears for the $80-threshold user but is filtered out for the $50-threshold user, while a $3 product appears for both.',
      'Users can also stop their stream at any time by clicking the stop button in the UI, which cancels their subscription. This cleanly disconnects them from the SSE endpoint without affecting other active subscribers — demonstrating the independent, per-connection nature of reactive streams.',
    ],
    keyPoints: [
      'Opening multiple browser windows simulates concurrent SSE subscribers, each with independent filter criteria.',
      'The per-subscriber <code>filter</code> operator ensures that each user only receives products below their specified price threshold — e.g., a $63 product reaches the $80 user but not the $50 user.',
      'Clicking stop cancels the individual subscription without disrupting other users\' streams, showcasing the independent lifecycle of each reactive subscriber.',
      'The shared <code>Sinks.Many</code> broadcasts all products; filtering happens downstream per subscriber, so no user\'s threshold affects another\'s stream.',
    ],
    code: `// No new code in this lesson — the demo validates the UI and filter logic built in lessons 6 and 7.
// The relevant client-side filter request and server-side filter chain are shown below for reference.

// --- Client-side (index.html) ---
// User enters a max price and the EventSource connects to the filtered SSE endpoint:
const eventSource = new EventSource(\`/products/stream?maxPrice=\${maxPriceInput.value}\`);

eventSource.onmessage = (event) => {
    const product = JSON.parse(event.data);
    appendProductToTable(product);
};

// Stop button closes the connection:
document.getElementById('stopButton').addEventListener('click', () => {
    eventSource.close();
});

// --- Server-side (ProductController.java) ---
// ... (SSE endpoint from lesson 4, with filter added in lesson 6)
@GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
public Flux<Product> streamProducts(@RequestParam double maxPrice) {
    return productSink.asFlux()
        .filter(product -> product.getPrice() < maxPrice);
}`,
    codeLabel: 'java',
    note: {
      label: 'WHY THIS MATTERS',
      text: 'This demo validates that filtering happens per-subscriber, not globally. Because the filter operator is applied inside the controller method on the Flux returned to each caller, every connected client receives its own personalized stream from the same shared Sinks.Many.',
      tone: 'green',
    },
    quiz: {
      question: 'Why does a product priced at $63 appear for the user with a $80 threshold but NOT for the user with a $50 threshold?',
      options: [
        { label: 'The Sinks.Many only emits products to the first subscriber', correct: false },
        { label: 'The filter operator is applied per-subscriber on each individual Flux, so each user\'s threshold is evaluated independently', correct: true },
        { label: 'The server caches each user\'s last seen price and skips duplicates', correct: false },
        { label: 'The browser\'s EventSource automatically filters events based on the URL parameter', correct: false },
      ],
      explanation: 'The filter operator is applied inside the controller method on the Flux returned to each caller. Each subscriber gets its own filtered Flux derived from the shared Sinks.Many, so the $80 user receives the $63 product while the $50 user\'s filter rejects it.',
    },
  },
  {
    id: '11.9',
    title: 'Integration Tests',
    duration: '5 min',
    kind: 'demo',
    summary: [
      'This lesson demonstrates how to write an integration test for the SSE streaming endpoint built earlier in this section. The test uses <code>WebTestClient</code> to consume the <code>/product-stream</code> endpoint with a <code>maxPrice</code> query parameter, validating that the server correctly streams <code>ProductDTO</code> objects whose prices respect the filter.',
      'A critical challenge with testing infinite streams is that the test must be <em>deterministic</em> and <em>terminate</em>. Since the SSE endpoint pushes data continuously, the test cannot wait forever. The solution is to apply <code>take(3)</code> to limit the <code>Flux</code> to the first three elements, then <code>collectList()</code> to aggregate them into a <code>List&lt;ProductDTO&gt;</code> that can be asserted with <code>StepVerifier</code>.',
      'The test relies on the <code>DataSetupService</code> (which seeds product data on application startup) to provide products for validation. In a real-world scenario without a data setup service, you would need to POST products as part of the test setup before consuming the stream. The assertions verify that exactly three products are received and that every product\'s price is less than or equal to the <code>maxPrice</code> of 80.',
    ],
    keyPoints: [
      'Use <code>@AutoConfigureWebTestClient</code> with <code>@SpringBootTest</code> to test reactive SSE endpoints',
      'Always specify <code>MediaType.TEXT_EVENT_STREAM</code> in the <code>accept()</code> header when consuming SSE endpoints',
      'Use <code>take(n)</code> on the infinite <code>Flux</code> to make the test deterministic and prevent it from running forever',
      'Combine <code>collectList()</code> with <code>StepVerifier.create()</code> to assert on the aggregated results of a bounded stream',
      'Validate the price filter by asserting <code>allMatch(p -&gt; p.getPrice() &lt;= maxPrice)</code> on the collected product list',
    ],
    code: `package com.wins.guru.playground.test.section09;

import com.wins.guru.playground.section03.dto.ProductDTO;
import org.junit.jupiter.api.Test;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.reactive.server.WebTestClient;
import reactor.test.StepVerifier;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
@TestPropertySource(properties = "section=section09")
@org.springframework.boot.test.autoconfigure.web.reactive.AutoConfigureWebTestClient
public class ServerSentEventsTest {

    private static final Logger log = LoggerFactory.getLogger(ServerSentEventsTest.class);

    @Autowired
    private WebTestClient client;

    @Test
    public void serverSentEvents() {
        // Consume the SSE endpoint with a maxPrice filter
        var fluxResult = client.get()
                .uri("/product-stream?maxPrice=80")
                .accept(MediaType.TEXT_EVENT_STREAM)
                .exchange()
                .expectStatus().is2xxSuccessful()
                .returnResult(ProductDTO.class)
                .getResponseBody();

        // Take only the first 3 items to make the test deterministic,
        // collect them into a list, then verify with StepVerifier
        StepVerifier.create(
                fluxResult
                        .take(3)
                        .doOnNext(product -> log.info("received: {}", product))
                        .collectList()
        )
                .assertNext(list -> {
                    assertEquals(3, list.size());
                    assertTrue(list.stream().allMatch(p -> p.getPrice() <= 80));
                })
                .expectComplete()
                .verify();
    }
}`,
    codeLabel: 'java',
    note: {
      label: 'KEY INSIGHT',
      text: 'Infinite reactive streams must be bounded in tests using <code>take(n)</code> before collecting or asserting. Without this, the test would hang indefinitely waiting for a stream that never completes.',
      tone: 'accent',
    },
    quiz: {
      question: 'Why is <code>take(3)</code> essential in this integration test before calling <code>collectList()</code>?',
      options: [
        { label: 'It limits the Flux to 3 items so the test terminates deterministically instead of waiting forever for an infinite stream', correct: true },
        { label: 'It filters out products with a price greater than 3', correct: false },
        { label: 'It converts the Flux into a Mono that emits exactly 3 items', correct: false },
        { label: 'It is required by StepVerifier to work with collectList()', correct: false },
      ],
      explanation: 'The SSE endpoint produces an infinite Flux. Without <code>take(3)</code>, <code>collectList()</code> would never complete because it waits for <code>onComplete()</code>, which never arrives. <code>take(3)</code> cancels the upstream subscription after 3 items and emits <code>onComplete()</code>, allowing <code>collectList()</code> to produce a Mono<List> that StepVerifier can assert on.',
    },
  },
]
