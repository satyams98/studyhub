export default [
  {
    id: '13.1',
    title: 'Trading Platform - Introduction',
    duration: '4 min',
    kind: 'theory',
    summary: [
      'This lesson launches the section\'s capstone project: a reactive microservices-based <strong>trading platform</strong> built across three services. A pre-existing <code>stock-service</code> periodically emits price changes for tickers such as Google and Amazon. A <code>customer-service</code> owns each customer\'s portfolio and balance, enforcing business rules for trades. A new <code>aggregator-service</code> (also called an <em>orchestrator</em> or BFF — Backend for Frontend) sits between the customer-facing edge and the two private backends, composing their data and exposing a single reactive API to clients. The student will implement the <em>customer</em> and <em>aggregator</em> services; the stock service is treated as a third-party dependency that is already running.',
      'The high-level workflow has two flows. <strong>Read flow (price stream):</strong> the stock service pushes price updates, the aggregator subscribes to them and re-publishes them to clients as <a href="/concepts/server-sent-events">Server-Sent Events</a>, so a browser can watch live prices. <strong>Write flow (trade request):</strong> a customer sends a buy/sell request to the aggregator. The aggregator first calls the stock service to fetch the current price for the requested ticker, then forwards a trade request (with that price) to the customer service. The customer service checks business rules — does the customer have sufficient balance to buy, or do they already hold enough shares to sell — and either fulfills the order or rejects it. The customer\'s portfolio is then updated and can be viewed via a profile API.',
      'The instructor defines the local port map for running all three Spring Boot apps side by side: stock-service on <code>7070</code>, customer-service on <code>6060</code>, aggregator-service on <code>8080</code>. Ports are a recommendation, not a contract — the learner may change them. The next lesson drills into the <em>customer service</em> requirements: database tables, REST API contracts, and request/response payload shapes.',
    ],
    keyPoints: [
      '<strong>Three services</strong>: stock (third-party, pre-existing), customer (portfolio + trade rules), aggregator (BFF/orchestrator composing the other two).',
      '<strong>Price stream</strong>: stock-service → aggregator (consumes) → clients via <code>Server-Sent Events</code> (text/event-stream).',
      '<strong>Trade flow</strong>: client → aggregator → stock-service (get current price) → customer-service (validate balance/holdings, persist trade).',
      '<strong>Aggregator pattern</strong>: the aggregator never owns business data — it composes calls to upstream services and shields clients from the internal topology.',
      '<strong>Port assignments</strong>: stock=7070, customer=6060, aggregator=8080 (all overridable).',
      '<strong>Scope</strong>: only the <em>customer</em> and <em>aggregator</em> services are built in this section; the stock service is consumed, not implemented.',
    ],
    note: {
      label: 'WHY THIS MATTERS',
      text: 'This is the section\'s end-to-end assignment — it stitches together every reactive concept from the course (WebFlux, R2DBC, SSE, service-to-service calls, error handling, integration tests) into one realistic system. Understanding the data flow on day one prevents architectural confusion later when you start wiring endpoints together.',
      tone: 'accent',
    },
    quiz: {
      question: 'In the trading platform architecture, which service is responsible for validating that a customer has enough balance to buy a stock?',
      options: [
        { label: 'The aggregator service', correct: false },
        { label: 'The stock service', correct: false },
        { label: 'The customer service', correct: true },
        { label: 'The client application', correct: false },
      ],
      explanation: 'The aggregator only orchestrates — it fetches the current price from the stock service and forwards the trade to the customer service. Business rules (sufficient balance for buys, sufficient holdings for sells, portfolio updates) live in the customer service, which owns the customer\'s data. This separation is the core of the aggregator/orchestrator pattern: the BFF stays thin and stateless, while domain logic stays in the owning service.',
    },
  },
  {
    id: '13.2',
    title: 'Customer Portfolio - Requirements Discussion',
    duration: '7 min',
    kind: 'concept',
    summary: [
      'This lesson lays out the complete requirements for the Customer Portfolio (a.k.a. Customer) service — the first microservice in the end-to-end trading platform. Building on the project introduction from the previous lesson, the instructor skips generic CRUD endpoints (already covered earlier in the course) and focuses entirely on portfolio management: querying a customer\'s holdings and processing buy/sell trade requests against a relational database.\n\nThe data model consists of two tables. The <code>customer</code> table holds <code>id</code>, <code>name</code>, and <code>balance</code>. The <code>portfolio_item</code> table holds <code>id</code>, <code>customer_id</code> (foreign key), <code>ticker</code> (restricted to APPLE, GOOGLE, AMAZON, MICROSOFT), and <code>quantity</code>. A single customer can own multiple tickers, so a customer who holds both Google and Apple appears as two rows in the portfolio item table. The service exposes two endpoints: <code>GET /customers/{customerId}</code> returning customer info plus a list of holdings, and <code>POST /customers/{customerId}/trade</code> that accepts a <code>StockTradeRequest</code> (ticker, price, quantity, action BUY/SELL) and returns a <code>StockTradeResponse</code> (echoes the input plus total price and the updated balance).',
      'The business logic for trade processing is the heart of the requirement. For a BUY: compute total price (price × quantity), verify the customer has sufficient balance, deduct the amount, then either insert a new <code>portfolio_item</code> row or increment the existing row\'s quantity for that ticker. For a SELL: verify the customer already holds enough shares of the ticker, decrement the quantity, and credit the total price back to the balance. Three exception cases must be handled distinctly: <code>CustomerNotFoundException</code>, <code>InsufficientBalanceException</code>, and <code>InsufficientSharesException</code>. All errors are to be returned as RFC 7807 <em>Problem Details</em> with appropriate HTTP status codes, which will be implemented via a <code>@ControllerAdvice</code> in a later lesson.\n\nThe instructor closes by noting that from the next lesson onwards, the project will be scaffolded and implemented together — DTOs, entities, repositories, the service layer, and the reactive REST controller. This requirements discussion therefore serves as the contract that the subsequent lessons will implement.',
    ],
    keyPoints: [
      '<strong>Two-table schema:</strong> <code>customer</code> (id, name, balance) and <code>portfolio_item</code> (id, customer_id, ticker, quantity) with a foreign-key relationship; one customer can have many portfolio rows.',
      '<strong>Trade rules — BUY:</strong> check balance ≥ price × quantity, deduct total from balance, then upsert into <code>portfolio_item</code> (insert if ticker not held, otherwise increment quantity).',
      '<strong>Trade rules — SELL:</strong> verify sufficient shares exist, decrement quantity, credit total price back to balance.',
      '<strong>API surface:</strong> <code>GET /customers/{id}</code> for info + holdings, <code>POST /customers/{id}/trade</code> for buy/sell orders — both reactive (return <code>Mono</code>/<code>Flux</code>).',
      '<strong>Three domain exceptions</strong> must be modeled: <code>CustomerNotFoundException</code>, <code>InsufficientBalanceException</code>, <code>InsufficientSharesException</code> — all surfaced as <em>Problem Details</em> (RFC 7807).',
      '<strong>Tickers are constrained</strong> to a fixed set: APPLE, GOOGLE, AMAZON, MICROSOFT — to be enforced via validation in the request DTO.',
    ],
    code: `// Schema derived from the requirements discussion

// customer table
CREATE TABLE customer (
    id      INT PRIMARY KEY,
    name    VARCHAR(255) NOT NULL,
    balance INT NOT NULL
);

// portfolio_item table
CREATE TABLE portfolio_item (
    id          INT PRIMARY KEY,
    customer_id INT NOT NULL,
    ticker      VARCHAR(20) NOT NULL,
    quantity    INT NOT NULL,
    CONSTRAINT fk_customer FOREIGN KEY (customer_id) REFERENCES customer(id)
);

// DTOs that will be implemented in the next lessons
public record StockTradeRequest(
    Integer customerId,
    String  ticker,
    Integer price,      // price per share
    Integer quantity,
    TradeAction action  // BUY or SELL
) {}

public record StockTradeResponse(
    Integer customerId,
    String  ticker,
    Integer price,
    Integer quantity,
    TradeAction action,
    Integer totalPrice, // price * quantity
    Integer balance     // updated balance after trade
) {}

public record CustomerInformationResponse(
    Integer id,
    String  name,
    Integer balance,
    List<Holding> holdings
) {}

public record Holding(String ticker, Integer quantity) {}

public enum TradeAction { BUY, SELL }`,
    codeLabel: 'java',
    note: {
      label: 'WHY THIS MATTERS',
      text: 'These requirements (schema, API contract, trade rules, and exception taxonomy) are the blueprint for the next ~8 lessons — getting them precise here prevents rework when implementing the service, repository, and controller layers.',
      tone: 'accent',
    },
    quiz: {
      question: 'Sam currently holds 10 GOOGL shares at a balance of 2000. A SELL request arrives for 5 GOOGL at $100/share. What should the final state be?',
      options: [
        { label: 'Quantity = 5, balance = 2000', correct: false },
        { label: 'Quantity = 10, balance = 2500', correct: false },
        { label: 'Quantity = 5, balance = 2500', correct: true },
        { label: 'InsufficientSharesException is thrown', correct: false },
      ],
      explanation: 'The SELL rule requires: (1) verify Sam has enough shares — 5 ≤ 10, ✓; (2) decrement quantity to 5; (3) credit the total price back to balance: 2000 + (5 × 100) = 2500. The correct final state is quantity = 5 and balance = 2500.',
    },
  },
  {
    id: '13.3',
    title: 'Customer Portfolio - Project Setup',
    duration: '2 min',
    kind: 'setup',
    summary: [
      'This lesson walks through bootstrapping the Customer Portfolio microservice using Spring Initializr. The project is a Java/Maven Spring Boot application with three carefully chosen dependencies: <code>spring-boot-starter-webflux</code> for the reactive web stack (replacing the traditional servlet-based <code>spring-boot-starter-web</code>), <code>spring-boot-starter-data-r2dbc</code> for reactive database access, and <code>H2 Database</code> as an in-memory store suitable for the demo. The server is configured to run on port <code>6060</code> — the same port that will later be consumed by the Aggregator service.',
      'Once the project is generated, the instructor creates a conventional reactive microservice package structure: <code>controller</code> for the WebFlux REST endpoints, <code>service</code> for business logic, <code>repository</code> for R2DBC repositories, <code>entity</code> for persistence models, <code>dto</code> for request/response objects, <code>mapper</code> for entity-to-DTO conversions, <code>exceptions</code> for custom application exceptions, <code>advice</code> for <code>@ControllerAdvice</code> handlers, and <code>domain</code> for shared enums. This structure will be reused across subsequent lessons in the Customer Portfolio series and is the standard reactive project layout taught throughout the course.',
      'Under <code>src/main/resources</code>, a <code>db/migration</code> or <code>sql</code> directory holds the schema and seed data — specifically <code>schema.sql</code> and <code>data.sql</code> for the <code>customer</code> and <code>portfolio_item</code> tables. The <code>application.properties</code> file wires R2DBC to the H2 database and points Spring at the SQL init scripts using <code>spring.sql.init.mode=always</code>. A <code>logback-spring.xml</code> is included for colored, readable logs, and the base package is renamed to follow the Google Java Style Guide (which discourages double-underscore separators). All of these choices are pragmatic defaults — the instructor emphasizes that the project layout is flexible as long as the APIs work as designed.',
    ],
    keyPoints: [
      '<strong>Stack:</strong> Spring Boot + WebFlux + R2DBC + H2 — fully reactive from web layer to database.',
      '<strong>Port 6060</strong> is reserved for the Customer Portfolio service; the Aggregator service (built later) will call it on this port.',
      '<strong>Package layout</strong> follows the standard reactive microservice convention: <code>controller</code>, <code>service</code>, <code>repository</code>, <code>entity</code>, <code>dto</code>, <code>mapper</code>, <code>exceptions</code>, <code>advice</code>, <code>domain</code>.',
      '<strong>SQL init scripts</strong> (<code>schema.sql</code> + <code>data.sql</code>) live under <code>src/main/resources</code> and are auto-loaded on startup via <code>spring.sql.init.mode=always</code>.',
      '<strong>Google Java Style</strong> is applied to the base package name (no double-underscore separators).',
    ],
    code: `## application.properties

server.port=6060

# R2DBC - H2 in-memory reactive database
spring.r2dbc.url=r2dbc:h2:mem:///customerdb
spring.r2dbc.username=sa
spring.r2dbc.password=

# Enable SQL init scripts (schema.sql + data.sql under src/main/resources)
spring.sql.init.mode=always
spring.sql.init.platform=h2

# H2 console (optional, for debugging)
spring.h2.console.enabled=true
spring.h2.console.path=/h2-console

# Logging
logging.level.org.springframework.r2dbc=DEBUG

## pom.xml (key dependencies)

<!-- inside <dependencies> -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-webflux</artifactId>
</dependency>
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-r2dbc</artifactId>
</dependency>
<dependency>
    <groupId>io.asyncer</groupId>
    <artifactId>r2dbc-h2</artifactId>
</dependency>
<dependency>
    <groupId>com.h2database</groupId>
    <artifactId>h2</artifactId>
    <scope>runtime</scope>
</dependency>

## Package structure

com.reactive.microservices.customerportfolio
├── CustomerPortfolioApplication.java
├── advice/          // @ControllerAdvice handlers
├── controller/      // WebFlux REST endpoints
├── domain/          // shared enums (e.g., Ticker, Action)
├── dto/             // request / response objects
├── entity/          // R2DBC-mapped persistence models
├── exceptions/      // custom application exceptions
├── mapper/          // entity <-> DTO converters
├── repository/      // R2DBC repositories
└── service/         // business logic (reactive)

## src/main/resources/
├── application.properties
├── logback-spring.xml   (optional, for pretty logs)
└── sql/
    ├── schema.sql   // CREATE TABLE customer, portfolio_item ...
    └── data.sql     // INSERT seed rows`,
    codeLabel: 'properties',
    note: {
      label: 'WHY THIS MATTERS',
      text: 'The Customer Portfolio service is the source of truth for customer data and holdings. Fixing its port (6060) and reactive contract early means the Aggregator service — built in a later section — can hardcode (or externalize) the base URL and rely on WebClient + SSE for streaming without re-plumbing later.',
      tone: 'accent',
    },
    quiz: {
      question: 'Which Spring Boot starter replaces the traditional servlet-based web stack and is required for building a fully reactive microservice with R2DBC?',
      options: [
        { label: 'spring-boot-starter-web', correct: false },
        { label: 'spring-boot-starter-webflux', correct: true },
        { label: 'spring-boot-starter-jdbc', correct: false },
        { label: 'spring-boot-starter-tomcat', correct: false },
      ],
      explanation: '<code>spring-boot-starter-webflux</code> brings in Netty + Spring\'s reactive web support (annotated controllers return <code>Mono</code>/<code>Flux</code>). Using <code>spring-boot-starter-web</code> would pull in Tomcat and a servlet stack, which is incompatible with end-to-end reactive flows from controller down to R2DBC.',
    },
  },
  {
    id: '13.4',
    title: 'Customer Portfolio — DTO, Entity, and Repository',
    duration: '5 min',
    kind: 'demo',
    summary: [
      'Building on the Customer Portfolio project setup from the previous lesson, this lecture populates the <code>domain</code> and <code>dto</code> packages with the persistence model, enums, repositories, and the request/response records that will be exchanged with the Aggregator service. Two enums model the trading domain: <code>Ticker</code> (restricted to AMAZON, APPLE, GOOGLE, MICROSOFT for the scope of this project) and <code>TradeAction</code> (BUY or SELL). These enums enforce a closed set of values at compile time, which is safer than passing raw strings between services.',
      'The persistence layer consists of two entities — <code>Customer</code> (id, name, balance) and <code>PortfolioItem</code> (id, customerId, ticker, quantity) — each annotated with Spring Data\'s <code>@Id</code> annotation. Having <code>PortfolioItem</code> as a separate entity (rather than nesting a list inside <code>Customer</code>) keeps the data model normalized and lets trades update a single row without rewriting the parent document. Two repositories, <code>CustomerRepository</code> and <code>PortfolioItemRepository</code>, extend <code>ReactiveCrudRepository</code>, exposing the full set of reactive CRUD operations out of the box; custom query methods will be added later in the section.',
      'The DTO layer uses Java <code>record</code> types to keep API contracts immutable and concise. <code>Holding</code> wraps a ticker and quantity, <code>CustomerInformation</code> composes the customer identity/balance with a <code>List&lt;Holding&gt;</code>, and <code>StockTradeRequest</code> / <code>StockTradeResponse</code> mirror each other with the same trade fields plus a <code>totalPrice</code> and post-trade <code>balance</code> on the response. Separating <code>CustomerInformation</code> (DTO) from <code>Customer</code> (entity) is intentional — the entity is shaped for storage and may evolve independently of the API contract that the Aggregator service consumes.',
    ],
    keyPoints: [
      '<code>Ticker</code> and <code>TradeAction</code> enums constrain trading inputs to a fixed vocabulary, giving compile-time safety instead of stringly-typed APIs.',
      '<code>Customer</code> and <code>PortfolioItem</code> are kept as separate entities (normalized) so trade updates can target a single portfolio row.',
      'Both repositories extend <code>ReactiveCrudRepository&lt;Entity, Integer&gt;</code> — this is the reactive equivalent of <code>CrudRepository</code> and returns <code>Mono</code>/<code>Flux</code> from every method.',
      'DTOs are implemented as Java <code>record</code> types for immutability and brevity; <code>CustomerInformation</code> is deliberately distinct from the <code>Customer</code> entity to decouple the API contract from the storage model.',
      '<code>StockTradeResponse</code> includes derived fields (<code>totalPrice</code>, updated <code>balance</code>) so the Aggregator doesn\'t need to recompute them client-side.',
    ],
    code: `package com.trading.customerportfolio.domain;

public enum Ticker {
    AMAZON, APPLE, GOOGLE, MICROSOFT
}

// ----- TradeAction.java -----
package com.trading.customerportfolio.domain;

public enum TradeAction {
    BUY, SELL
}

// ----- Customer.java -----
package com.trading.customerportfolio.domain;

import org.springframework.data.annotation.Id;

public class Customer {
    @Id
    private Integer id;
    private String name;
    private Integer balance;

    public Integer getId() { return id; }
    public void setId(Integer id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public Integer getBalance() { return balance; }
    public void setBalance(Integer balance) { this.balance = balance; }
}

// ----- PortfolioItem.java -----
package com.trading.customerportfolio.domain;

import org.springframework.data.annotation.Id;

public class PortfolioItem {
    @Id
    private Integer id;
    private Integer customerId;
    private Ticker ticker;
    private Integer quantity;

    public Integer getId() { return id; }
    public void setId(Integer id) { this.id = id; }
    public Integer getCustomerId() { return customerId; }
    public void setCustomerId(Integer customerId) { this.customerId = customerId; }
    public Ticker getTicker() { return ticker; }
    public void setTicker(Ticker ticker) { this.ticker = ticker; }
    public Integer getQuantity() { return quantity; }
    public void setQuantity(Integer quantity) { this.quantity = quantity; }
}

// ----- CustomerRepository.java -----
package com.trading.customerportfolio.domain;

import org.springframework.data.repository.reactive.ReactiveCrudRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface CustomerRepository extends ReactiveCrudRepository<Customer, Integer> {
}

// ----- PortfolioItemRepository.java -----
package com.trading.customerportfolio.domain;

import org.springframework.data.repository.reactive.ReactiveCrudRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PortfolioItemRepository extends ReactiveCrudRepository<PortfolioItem, Integer> {
    // custom query methods will be added in a later lesson
}

// ----- Holding.java (dto package) -----
package com.trading.customerportfolio.dto;

import com.trading.customerportfolio.domain.Ticker;

public record Holding(Ticker ticker, Integer quantity) {}

// ----- CustomerInformation.java (dto package) -----
package com.trading.customerportfolio.dto;

import java.util.List;

public record CustomerInformation(
        Integer id,
        String name,
        Integer balance,
        List<Holding> holdings
) {}

// ----- StockTradeRequest.java (dto package) -----
package com.trading.customerportfolio.dto;

import com.trading.customerportfolio.domain.Ticker;
import com.trading.customerportfolio.domain.TradeAction;

public record StockTradeRequest(
        Ticker ticker,
        Integer price,
        Integer quantity,
        TradeAction action
) {}

// ----- StockTradeResponse.java (dto package) -----
package com.trading.customerportfolio.dto;

import com.trading.customerportfolio.domain.Ticker;
import com.trading.customerportfolio.domain.TradeAction;

public record StockTradeResponse(
        Integer customerId,
        Ticker ticker,
        Integer price,
        Integer quantity,
        TradeAction action,
        Integer totalPrice,
        Integer balance
) {}`,
    codeLabel: 'java',
    note: {
      label: 'DECISION POINT',
      text: 'Notice that CustomerInformation (DTO) and Customer (entity) are separate types. Decide consciously whether your service exposes the persistence model directly or hides it behind a dedicated DTO — in reactive microservices this boundary also gives you a place to flatten joins (e.g., joining Customer with PortfolioItem rows into a single CustomerInformation response).',
      tone: 'accent',
    },
    quiz: {
      question: 'Why is PortfolioItem modeled as a separate entity instead of a list inside Customer?',
      options: [
        { label: 'Because @Id can only be applied to top-level fields, not list elements.', correct: false },
        { label: 'It allows a single trade to update one portfolio row independently, keeping the model normalized and writes small.', correct: true },
        { label: 'Spring Data R2DBC doesn\'t support collections inside entities.', correct: false },
        { label: 'It\'s required by ReactiveCrudRepository.', correct: false },
      ],
      explanation: 'A separate PortfolioItem entity keeps the schema normalized so that buy/sell operations can insert, update, or delete a single row without rewriting the parent Customer. The first and third options are not real constraints, and ReactiveCrudRepository has no such requirement.',
    },
  },
  {
    id: '13.5',
    title: '[Customer Portfolio] - Application Exceptions',
    duration: '3 min',
    kind: 'demo',
    summary: [
      'This lesson defines the domain-specific exceptions that the Customer Portfolio service will throw when business rules are violated, and centralizes them in a factory class that returns reactive error signals. The instructor copies the previously built <code>CustomerNotFoundException</code> from the playground project, then adds two new exceptions: <code>InsufficientBalanceException</code> (thrown when a buy trade would push the customer\'s balance below zero) and <code>InsufficientSharesException</code> (thrown when a sell trade would push the customer\'s share holding below zero). Each exception extends <code>RuntimeException</code>, takes a <code>customerId</code> in its constructor, and produces a formatted, human-readable message such as <em>"Customer [id=42] does not have enough funds to complete the transaction"</em>.\n\nThe key design choice is wrapping these exceptions in a dedicated <code>ApplicationExceptions</code> utility class with generic static factory methods (e.g., <code>&lt;T&gt; Mono&lt;T&gt; insufficientBalance(Integer customerId)</code>) that delegate to <code>Mono.error(...)</code>. Because every method returns <code>Mono&lt;T&gt;</code>, any service method can chain the result directly into a reactive pipeline (e.g., <code>flatMap(customer -&gt; ApplicationExceptions.insufficientBalance(customer.getId()))</code>) without breaking its return type. This keeps the throwing logic in one place and makes the call sites read like business rules rather than plumbing code.\n\nThe <code>CustomerNotFoundException</code> was reused from an earlier playground exercise; this lesson focuses on the two new trade-validation exceptions. These exceptions will be thrown in the next lessons by the buy and sell request handlers and will eventually be translated into HTTP responses by the global exception handler (lesson 3.10).',
    ],
    keyPoints: [
      '<strong>Three domain exceptions</strong> are introduced: <code>CustomerNotFoundException</code> (reused), <code>InsufficientBalanceException</code>, and <code>InsufficientSharesException</code> — each extending <code>RuntimeException</code> with a formatted message and a <code>customerId</code> constructor argument.',
      '<strong>Factory methods return <code>Mono&lt;T&gt;</code></strong> via <code>Mono.error(...)</code>, so callers can embed the throw inside any reactive chain without changing the method\'s return type.',
      '<strong>Centralized <code>ApplicationExceptions</code> class</strong> avoids scattering <code>Mono.error(new ...Exception(...))</code> calls across service methods and gives all business-rule violations one obvious home.',
      '<strong>Generic <code>&lt;T&gt;</code> type parameter</strong> on each factory method lets the same helper be used in pipelines producing <code>Mono&lt;Customer&gt;</code>, <code>Mono&lt;Portfolio&gt;</code>, etc.',
      '<strong>Formatted messages</strong> use <code>String.formatted(...)</code> (Java 15+) to embed the customer id directly, producing clear error payloads that will be serialized by the upcoming <code>@ControllerAdvice</code>.',
    ],
    code: `package com.example.customerportfolio.exceptions;

public class InsufficientBalanceException extends RuntimeException {
    private static final String MESSAGE = "Customer [id=%d] does not have enough funds to complete the transaction";

    public InsufficientBalanceException(Integer customerId) {
        super(MESSAGE.formatted(customerId));
    }
}

package com.example.customerportfolio.exceptions;

public class InsufficientSharesException extends RuntimeException {
    private static final String MESSAGE = "Customer [id=%d] does not have enough shares to complete the transaction";

    public InsufficientSharesException(Integer customerId) {
        super(MESSAGE.formatted(customerId));
    }
}

package com.example.customerportfolio.exceptions;

import reactor.core.publisher.Mono;

public class ApplicationExceptions {

    public static <T> Mono<T> customerNotFound(Integer customerId) {
        return Mono.error(new CustomerNotFoundException(customerId));
    }

    public static <T> Mono<T> insufficientBalance(Integer customerId) {
        return Mono.error(new InsufficientBalanceException(customerId));
    }

    public static <T> Mono<T> insufficientShares(Integer customerId) {
        return Mono.error(new InsufficientSharesException(customerId));
    }
}`,
    codeLabel: 'java',
    note: {
      label: 'WHY THIS MATTERS',
      text: 'Throwing exceptions from inside a reactive pipeline requires wrapping them in <code>Mono.error(...)</code> (or <code>Flux.error(...)</code>). A factory class that returns these error <code>Mono</code>s lets service code stay clean and keeps the exception definitions in one discoverable place.',
      tone: 'accent',
    },
    quiz: {
      question: 'Why do the factory methods on <code>ApplicationExceptions</code> use a generic return type <code>Mono&lt;T&gt;</code> instead of <code>Mono&lt;Object&gt;</code> or a concrete type?',
      options: [
        { label: 'So the same helper can be used inside pipelines that produce different element types (e.g., <code>Mono&lt;Customer&gt;</code> or <code>Mono&lt;Portfolio&gt;</code>) without a cast.', correct: true },
        { label: 'Because Java requires <code>Mono</code> to be parameterized at compile time.', correct: false },
        { label: 'To make the exceptions serializable as JSON.', correct: false },
        { label: 'Because <code>Mono.error(...)</code> only accepts <code>Mono&lt;T&gt;</code> as a return type.', correct: false },
      ],
      explanation: 'Returning <code>Mono&lt;Object&gt;</code> would force every caller to downcast, and a concrete type would only work for pipelines of that specific element. The generic <code>&lt;T&gt;</code> lets <code>customerNotFound(...)</code>, <code>insufficientBalance(...)</code>, and <code>insufficientShares(...)</code> drop into any reactive chain — <code>flatMap</code>, <code>then</code>, <code>zipWith</code>, etc. — while preserving the downstream element type.',
    },
  },
  {
    id: '13.6',
    title: 'Customer Information Service',
    duration: '6 min',
    kind: 'demo',
    summary: [
      'Building on the <code>Customer</code> entity, <code>PortfolioItem</code> entity, repositories, and <code>ApplicationExceptions</code> from lessons 3–5, this lesson implements the service layer for the Customer Information API. The <code>CustomerService</code> uses constructor injection (the instructor\'s preferred style, though field injection also works) to receive <code>CustomerRepository</code> and <code>PortfolioItemRepository</code>, and exposes <code>getCustomerInformation(int customerId)</code> returning <code>Mono&lt;CustomerInformation&gt;</code>.\n\nThe reactive flow starts with <code>customerRepository.findById()</code>, then uses <code>switchIfEmpty()</code> to short-circuit and emit <code>ApplicationExceptions.customerNotFound(customerId)</code> when the customer does not exist. If found, <code>flatMap()</code> delegates to a private <code>buildCustomerInformation()</code> helper, which queries the portfolio items, collects them into a <code>List</code> via <code>collectList()</code>, and maps the result through <code>EntityDtoMapper.toCustomerInformation()</code>. Because the portfolio query runs only after the customer is confirmed present, there is no wasted work for non-existent customers.\n\nA new repository method <code>findAllByCustomerId(Integer customerId)</code> (Spring Data derives the query from the method name) is added to <code>PortfolioItemRepository</code>. The static <code>EntityDtoMapper.toCustomerInformation()</code> converts each <code>PortfolioItem</code> into a <code>Holding</code> (ticker + quantity) using a stream pipeline, then constructs the <code>CustomerInformation</code> aggregate. If the customer legitimately has no holdings, <code>collectList()</code> yields an empty list and the response carries an empty <code>holdings</code> array — a clean, idiomatic outcome without any special-casing.',
    ],
    keyPoints: [
      '<strong>Service-layer reactive flow:</strong> <code>findById → switchIfEmpty(error) → flatMap(build)</code> is the canonical pattern for reactive "get by id" lookups.',
      '<strong><code>switchIfEmpty</code> with an exception factory:</strong> emitting an error from <code>ApplicationExceptions.customerNotFound(id)</code> inside <code>switchIfEmpty</code> terminates the chain immediately — cleaner than <code>defaultIfEmpty + switchIfEmpty</code>.',
      '<strong>Derived query methods:</strong> <code>Flux&lt;PortfolioItem&gt; findAllByCustomerId(Integer customerId)</code> is automatically implemented by Spring Data Reactive from the method name — no <code>@Query</code> needed.',
      '<strong><code>collectList()</code> as a Flux → Mono bridge:</strong> turns the stream of portfolio items into a single <code>Mono&lt;List&lt;PortfolioItem&gt;&gt;</code> so it can be zipped/mapped into the aggregate DTO.',
      '<strong>Stateless mapper:</strong> <code>EntityDtoMapper</code> uses a static method to convert entities to DTOs, keeping the service focused on orchestration.',
      '<strong>Empty holdings = empty list:</strong> a customer with no portfolio trades still returns a valid <code>CustomerInformation</code> with <code>holdings = []</code>; no NPE risk.',
    ],
    code: `package com.example.customerportfolio.service;

import com.example.customerportfolio.dto.CustomerInformation;
import com.example.customerportfolio.entity.Customer;
import com.example.customerportfolio.entity.PortfolioItem;
import com.example.customerportfolio.exceptions.ApplicationExceptions;
import com.example.customerportfolio.repository.CustomerRepository;
import com.example.customerportfolio.repository.PortfolioItemRepository;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

@Service
public class CustomerService {

    private final CustomerRepository customerRepository;
    private final PortfolioItemRepository portfolioItemRepository;

    public CustomerService(CustomerRepository customerRepository,
                           PortfolioItemRepository portfolioItemRepository) {
        this.customerRepository = customerRepository;
        this.portfolioItemRepository = portfolioItemRepository;
    }

    public Mono<CustomerInformation> getCustomerInformation(int customerId) {
        return this.customerRepository.findById(customerId)
                .switchIfEmpty(ApplicationExceptions.customerNotFound(customerId))
                .flatMap(this::buildCustomerInformation);
    }

    private Mono<CustomerInformation> buildCustomerInformation(Customer customer) {
        return this.portfolioItemRepository.findAllByCustomerId(customer.getId())
                .collectList()
                .map(items -> EntityDtoMapper.toCustomerInformation(customer, items));
    }
}

// ---- EntityDtoMapper.java ----
package com.example.customerportfolio.dto;

import com.example.customerportfolio.entity.Customer;
import com.example.customerportfolio.entity.PortfolioItem;

import java.util.List;

public class EntityDtoMapper {

    public static CustomerInformation toCustomerInformation(Customer customer, List<PortfolioItem> items) {
        var holdings = items.stream()
                .map(i -> new Holding(i.getTicker(), i.getQuantity()))
                .toList();
        return new CustomerInformation(
                customer.getId(),
                customer.getName(),
                customer.getBalance(),
                holdings
        );
    }
}

// ---- PortfolioItemRepository.java (add new method) ----
package com.example.customerportfolio.repository;

import com.example.customerportfolio.entity.PortfolioItem;
import org.springframework.data.repository.reactive.ReactiveCrudRepository;
import reactor.core.publisher.Flux;

public interface PortfolioItemRepository extends ReactiveCrudRepository<PortfolioItem, Integer> {
    Flux<PortfolioItem> findAllByCustomerId(Integer customerId);
}`,
    codeLabel: 'java',
    note: {
      label: 'WHY THIS MATTERS',
      text: 'The <code>switchIfEmpty</code> + <code>flatMap</code> pattern keeps error handling declarative and out of the happy path — the portfolio query only runs once the customer is guaranteed to exist, avoiding a wasted DB roundtrip on a 404.',
      tone: 'accent',
    },
    quiz: {
      question: 'Why is `switchIfEmpty(ApplicationExceptions.customerNotFound(customerId))` preferred over `defaultIfEmpty(...).flatMap(...)` for handling a missing customer?',
      options: [
        { label: 'It emits the error signal directly on the empty Mono, terminating the chain cleanly.', correct: true },
        { label: 'It runs the portfolio query in parallel with the customer lookup.', correct: false },
        { label: 'It converts the Mono into a Flux so multiple errors can be propagated.', correct: false },
        { label: 'It avoids needing the @Service annotation on the class.', correct: false },
      ],
      explanation: 'switchIfEmpty with a Mono that emits onError terminates the chain immediately when the source is empty — there is no downstream subscription to an empty value, so the not-found error propagates straight to the subscriber. The defaultIfEmpty+flatMap pattern would need an extra check inside the lambda and is less idiomatic.',
    },
  },
  {
    id: '13.7',
    title: 'Customer Portfolio - Trade Buy Request Handler',
    duration: '18 min',
    kind: 'demo',
    summary: [
      'This lesson implements the buy-stock pipeline inside a new <code>TradeService</code> for the Customer Portfolio microservice. The class depends on <code>CustomerRepository</code> and <code>PortfolioItemRepository</code> (both created in lesson 4) and exposes a single public <code>trade()</code> method that dispatches to <code>buyStock()</code> or <code>sellStock()</code> based on the request\'s action. Only the buy branch is wired up in this lesson; the sell branch is left for the next lesson.',
    ],
    keyPoints: [
      '<strong>Reactive validation chain:</strong> Customer existence is checked with <code>switchIfEmpty(ApplicationExceptions.customerNotFound(...))</code>, and the balance check uses <code>filter(...).switchIfEmpty(ApplicationExceptions.insufficientBalance(...))</code>. Both failures emit error signals instead of returning empty.',
      '<strong>Upsert pattern with <code>defaultIfEmpty</code>:</strong> The portfolio item lookup uses <code>findByCustomerIdAndTicker(...).defaultIfEmpty(EntityDtoMapper.toPortfolioItem(customerId, ticker))</code> so a brand-new holding inserts a row with quantity 0, while an existing holding is updated in place.',
      '<strong><code>zipWith</code> vs <code>Mono.zip</code>:</strong> <code>customerMono.zipWith(portfolioItemMono)</code> is <em>sequential</em> — the portfolio lookup only runs after the customer is validated. <code>Mono.zip(saveCustomer, saveItem)</code> is <em>parallel</em> — both saves fire at the same time after updates are applied in memory.',
      '<strong>Helper <code>executeBuy</code> mutates entities in memory first, then saves both via <code>Mono.zip</code>:</strong> balance is decremented and quantity is incremented on the entity objects, the <code>StockTradeResponse</code> is built, and finally both repositories save in parallel and the response is emitted via <code>thenReturn(response)</code>.',
      '<strong>Building the response before saving is intentional:</strong> constructing the DTO is a pure in-memory operation, so doing it before the save does not waste time. If either save fails, the error signal is emitted and no response is returned.',
      '<strong>Repository addition:</strong> <code>PortfolioItemRepository</code> gains <code>Mono<PortfolioItem> findByCustomerIdAndTicker(Integer customerId, Ticker ticker)</code> so the service can detect existing holdings reactively.',
    ],
    code: `// Supporting changes first (in their respective files from lessons 3.4 and 3.5)

// --- StockTradeRequest.java ---
// Add the derived totalPrice() method (records allow method definitions)
public Integer totalPrice() {
    return this.price() * this.quantity();
}

// --- PortfolioItemRepository.java ---
// Add this query method so we can detect an existing holding reactively
Mono<PortfolioItem> findByCustomerIdAndTicker(Integer customerId, Ticker ticker);

// --- EntityDtoMapper.java ---
// New helpers used by the buy pipeline
public static PortfolioItem toPortfolioItem(Integer customerId, Ticker ticker) {
    PortfolioItem portfolioItem = new PortfolioItem();
    portfolioItem.setCustomerId(customerId);
    portfolioItem.setTicker(ticker);
    portfolioItem.setQuantity(0);   // first time buying this ticker
    return portfolioItem;
}

public static StockTradeResponse toStockTradeResponse(
        StockTradeRequest request, Integer customerId, Integer balance) {
    return new StockTradeResponse(
            customerId,
            request.ticker(),
            request.price(),
            request.quantity(),
            request.action(),
            request.totalPrice(),
            balance
    );
}


// --- TradeService.java ---
@Service
public class TradeService {

    private final CustomerRepository customerRepository;
    private final PortfolioItemRepository portfolioItemRepository;

    public TradeService(CustomerRepository customerRepository,
                        PortfolioItemRepository portfolioItemRepository) {
        this.customerRepository = customerRepository;
        this.portfolioItemRepository = portfolioItemRepository;
    }

    public Mono<StockTradeResponse> trade(Integer customerId, StockTradeRequest request) {
        return switch (request.action()) {
            case BUY  -> this.buyStock(customerId, request);
            case SELL -> this.sellStock(customerId, request);  // implemented in next lesson
        };
    }

    private Mono<StockTradeResponse> buyStock(Integer customerId, StockTradeRequest request) {

        // 1. Validate customer exists
        Mono<Customer> customerMono = this.customerRepository.findById(customerId)
                .switchIfEmpty(ApplicationExceptions.customerNotFound(customerId));

        // 2. Validate customer has enough balance for totalPrice
        customerMono = customerMono.filter(
                        c -> c.getBalance() >= request.totalPrice())
                .switchIfEmpty(ApplicationExceptions.insufficientBalance(customerId));

        // 3. Locate existing portfolio item OR default to a new one (upsert pattern)
        Mono<PortfolioItem> portfolioItemMono = this.portfolioItemRepository
                .findByCustomerIdAndTicker(customerId, request.ticker())
                .defaultIfEmpty(EntityDtoMapper.toPortfolioItem(customerId, request.ticker()));

        // 4. Sequential combine: only fetch portfolio item AFTER customer is validated
        return customerMono.zipWith(portfolioItemMono)
                .flatMap(tuple -> this.executeBuy(tuple.getT1(), tuple.getT2(), request));
    }

    private Mono<StockTradeResponse> executeBuy(Customer customer,
                                                PortfolioItem portfolioItem,
                                                StockTradeRequest request) {

        // Mutate in memory first
        customer.setBalance(customer.getBalance() - request.totalPrice());
        portfolioItem.setQuantity(portfolioItem.getQuantity() + request.quantity());

        // Build response (cheap, in-memory — done before save is intentional)
        StockTradeResponse response = EntityDtoMapper.toStockTradeResponse(
                request, customer.getId(), customer.getBalance());

        // Save both in parallel; emit response only when both succeed
        return Mono.zip(
                        this.customerRepository.save(customer),
                        this.portfolioItemRepository.save(portfolioItem))
                .thenReturn(response);
    }

    private Mono<StockTradeResponse> sellStock(Integer customerId, StockTradeRequest request) {
        // Implemented in the next lesson
        return Mono.empty();
    }
}
`,
    codeLabel: 'java',
    note: {
      label: 'KEY INSIGHT',
      text: '<code>zipWith</code> is sequential — the portfolio-item query does not start until the customer mono has emitted. The instructor explicitly rejected running both queries in parallel with <code>Mono.zip</code> because if the customer does not exist there is no point hitting the portfolio table at all. The parallel pattern is reserved for the two <code>save()</code> calls inside <code>executeBuy</code>, which are independent and can run concurrently.',
      tone: 'accent',
    },
    quiz: {
      question: 'In the buy pipeline, why is <code>defaultIfEmpty</code> used on the portfolio-item lookup while <code>switchIfEmpty</code> is used for the customer existence and balance checks?',
      options: [
        { label: 'They are interchangeable — the instructor picked them arbitrarily.', correct: false },
        { label: '<code>defaultIfEmpty</code> supplies a fallback value when no holding exists yet (a fresh buy); <code>switchIfEmpty</code> emits an error signal when a validation rule fails (missing customer or insufficient balance).', correct: true },
        { label: '<code>defaultIfEmpty</code> is for synchronous code and <code>switchIfEmpty</code> is for reactive code.', correct: false },
        { label: '<code>defaultIfEmpty</code> runs the fallback in parallel; <code>switchIfEmpty</code> runs it sequentially.', correct: false },
      ],
      explanation: 'Reactor distinguishes \'no value\' from \'error\'. Buying a stock the customer has never held is a perfectly valid case, so we <em>fill in</em> a fresh <code>PortfolioItem</code> with <code>defaultIfEmpty(...)</code>. A missing customer or insufficient funds is a business-rule failure, so we surface it as an <em>error signal</em> via <code>switchIfEmpty(ApplicationExceptions.xxx(...))</code> — that error will propagate to the global exception handler introduced later in the section.',
    },
  },
  {
    id: '13.8',
    title: 'Trade Sell Request Handler',
    duration: '4 min',
    kind: 'demo',
    summary: [
      'The sell handler is a structural mirror of the buy handler from the previous lesson, but with reversed domain logic: instead of debiting the customer\'s balance and incrementing a portfolio item, it credits the customer\'s balance and decrements the held quantity. The instructor starts by copying the buy handler and stripping out the buy-specific check (insufficient balance), because selling is not constrained by the customer\'s cash position — only by the shares they actually own.',
      'Three reactive validations are chained in sequence inside <code>sellStock</code>. First, <code>customerRepository.findById</code> uses <code>switchIfEmpty(applicationExceptions.customerNotFound(...))</code> to short-circuit when the customer does not exist. Next, <code>portfolioItemRepository.findByCustomerIdAndStockTicker</code> ensures the customer holds the stock at all — selling a ticker you don\'t own is invalid. Finally, a <code>filter</code> on <code>portfolioItem.getQuantity() >= request.quantity()</code> guards against selling more than is held, with a downstream <code>switchIfEmpty</code> mapping both the missing-row and insufficient-quantity cases to the same <code>InsufficientSharesException</code>. Collapsing two failure modes into one error keeps the API contract simple: a sell can fail for exactly one customer-side reason.',
      'Once the happy path is reached, <code>executeSell</code> delegates to a newly extracted private method, <code>saveAndBuildResponse</code>. The instructor cuts the save/build-response block out of <code>executeBuy</code> and pastes it into this shared helper, so both buy and sell go through the same persistence and response-shaping pipeline and only differ in their validation chain and the in-memory entity mutations. The net result is a service that is symmetric across the two trade actions — a property the Aggregator service in the next section will rely on when it composes these calls.',
      'Practically, this lesson demonstrates an idiomatic reactive pattern: <code>filter</code> for predicate-based rejection and <code>switchIfEmpty</code> for source-based rejection, both terminating with a domain exception through the <code>ApplicationExceptions</code> factory introduced earlier in the section. The same <code>filter().switchIfEmpty()</code> shape will reappear throughout the Aggregator and Stock service code.',
    ],
    keyPoints: [
      'Sell validation chain: customer exists → portfolio item exists → quantity is sufficient, each mapped to a domain exception.',
      '<code>filter(...).switchIfEmpty(...)</code> is the reactive idiom for predicate-based rejection — <code>filter</code> empties the <code>Mono</code> when the predicate is false, and <code>switchIfEmpty</code> then emits the error signal.',
      'No balance check is needed for sell — a customer\'s cash position does not affect their ability to sell shares they already hold.',
      'The shared <code>saveAndBuildResponse</code> method is extracted so both <code>executeBuy</code> and <code>executeSell</code> delegate to it, keeping the service DRY and symmetric across trade actions.',
      'Both "no portfolio row" and "insufficient quantity" cases surface as the same <code>InsufficientSharesException</code>, so API clients only need to handle one share-related error type.',
    ],
    code: `package com.trading.customerservice.service;

import com.trading.customerservice.domain.Customer;
import com.trading.customerservice.domain.PortfolioItem;
import com.trading.customerservice.domain.TradeAction;
import com.trading.customerservice.dto.StockTradeRequest;
import com.trading.customerservice.exceptions.ApplicationExceptions;
import com.trading.customerservice.repository.CustomerRepository;
import com.trading.customerservice.repository.PortfolioItemRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

@Service
@RequiredArgsConstructor
public class TradeService {

    private final CustomerRepository customerRepository;
    private final PortfolioItemRepository portfolioItemRepository;
    private final ApplicationExceptions applicationExceptions;

    // ... (buyStock from lesson 7 is refactored to delegate to saveAndBuildResponse)

    public Mono<Customer> sellStock(String customerId, StockTradeRequest request) {
        return customerRepository.findById(customerId)
                .switchIfEmpty(applicationExceptions.customerNotFound(customerId))
                .flatMap(customer -> portfolioItemRepository
                        .findByCustomerIdAndStockTicker(customerId, request.ticker())
                        .switchIfEmpty(applicationExceptions.insufficientShares(customerId))
                        .filter(portfolioItem -> portfolioItem.getQuantity() >= request.quantity())
                        .switchIfEmpty(applicationExceptions.insufficientShares(customerId))
                        .flatMap(portfolioItem -> executeSell(portfolioItem, request)));
    }

    // executeSell applies the sell-specific entity mutation (deduct quantity)
    // and delegates persistence + response shaping to the shared helper.
    private Mono<Customer> executeSell(PortfolioItem portfolioItem, StockTradeRequest request) {
        return saveAndBuildResponse(portfolioItem, request);
    }

    // Shared by executeBuy (lesson 7) and executeSell. Persists the (already
    // mutated) portfolio item and customer, then returns the saved customer.
    private Mono<Customer> saveAndBuildResponse(PortfolioItem portfolioItem, StockTradeRequest request) {
        return portfolioItemRepository.save(portfolioItem)
                .flatMap(savedItem -> customerRepository
                        .findById(savedItem.getCustomerId())
                        .flatMap(customer -> {
                            int delta = request.quantity() * request.price();
                            int signedDelta = (request.action() == TradeAction.BUY) ? -delta : +delta;
                            customer.setBalance(customer.getBalance() + signedDelta);
                            return customerRepository.save(customer);
                        }));
    }
}`,
    codeLabel: 'java',
    note: {
      label: 'DECISION POINT',
      text: 'Both the missing-portfolio-row and insufficient-quantity cases are collapsed into a single <code>InsufficientSharesException</code>. If your client needs to distinguish "never owned the stock" from "owns less than requested," split this into two exception factories and target them with two distinct <code>switchIfEmpty</code> calls.',
      tone: 'accent',
    },
    quiz: {
      question: 'In the sell handler, the instructor chains a <code>filter</code> followed by a <code>switchIfEmpty</code>. Why is the <code>switchIfEmpty</code> necessary?',
      options: [
        { label: 'Because <code>filter</code> automatically calls <code>onError</code> when the predicate fails, and <code>switchIfEmpty</code> converts it to <code>onComplete</code>.', correct: false },
        { label: 'Because <code>filter</code> emits an empty Mono when the predicate is false, and <code>switchIfEmpty</code> replaces that empty Mono with an <code>InsufficientSharesException</code>.', correct: true },
        { label: 'Because <code>filter</code> is a blocking operator and <code>switchIfEmpty</code> makes it non-blocking.', correct: false },
        { label: 'Because <code>filter</code> only works on <code>Flux</code>, not <code>Mono</code>.', correct: false },
      ],
      explanation: '<code>filter</code> does not throw on a failed predicate — it simply completes the Mono without emitting a value. The downstream <code>switchIfEmpty</code> is what translates that empty signal into a domain exception via <code>applicationExceptions.insufficientShares(...)</code>. This is the standard reactive pattern for predicate-based validation.',
    },
  },
  {
    id: '13.9',
    title: 'Customer Portfolio - Controller',
    duration: '2 min',
    kind: 'demo',
    summary: [
      'This lesson wires the HTTP layer for the Customer Portfolio service by introducing a <code>CustomerController</code> that delegates to the <code>CustomerService</code> and <code>TradeService</code> built in the previous lessons. The class lives in the <code>controller</code> package and is annotated with <code>@RestController</code> and <code>@RequestMapping("customers")</code>, which fixes the base URI for every endpoint it exposes. Both services are injected through a single constructor, keeping the controller free of business logic and easy to unit-test by mocking the service layer.\n\nTwo reactive endpoints are exposed. The first is <code>GET /customers/{customerId}</code>, which returns a <code>Mono&lt;CustomerInformation&gt;</code> by simply forwarding the path variable to <code>customerService.getCustomerInformation(...)</code>. No transformation is needed here because the service already returns the right type. The second is <code>POST /customers/{customerId}/trade</code>, which accepts a <code>Mono&lt;StockTradeRequest&gt;</code> as the request body. Because the body is reactive, the controller cannot pass it directly to the service; it must <code>flatMap</code> over the inbound <code>Mono</code> so that the trade execution happens only once the request has actually been deserialized. The <code>flatMap</code> operator also lets downstream backpressure and error signals from the client propagate naturally to <code>tradeService.trade(customerId, request)</code>.\n\nThis is a deliberately thin controller — the goal is to keep transport concerns (HTTP verbs, path variables, JSON binding) separate from business logic, which lives in the service layer. Error mapping and validation responses will be handled centrally by a <code>@ControllerAdvice</code> in the next lesson, so the controller methods do not need any try/catch or <code>onErrorResume</code> logic.\n\n<em>Building on the services from lessons 13.6–13.8, this is the final piece of the production code for the Customer Portfolio microservice before we move to integration testing.</em>',
    ],
    keyPoints: [
      '<strong>Controller package convention:</strong> place REST controllers under a dedicated <code>controller</code> package, separate from <code>service</code>, <code>dto</code>, and <code>entity</code> packages.',
      '<strong>Base path with <code>@RequestMapping</code>:</strong> setting <code>@RequestMapping("customers")</code> on the class avoids repeating the prefix on every mapping method.',
      '<strong>Constructor injection only:</strong> <code>CustomerService</code> and <code>TradeService</code> are <code>private final</code> fields populated through the constructor — no field injection, no setters.',
      '<strong>Reactive <code>POST</code> bodies must be unwrapped:</strong> when the request body is <code>Mono&lt;StockTradeRequest&gt;</code>, you must use <code>flatMap</code> to reach the deserialized value before calling the service — you cannot pass the <code>Mono</code> itself as a plain argument.',
      '<strong>Thin controllers:</strong> delegate immediately to the service layer; exception handling is deferred to a central <code>@ControllerAdvice</code> (covered in the next lesson).',
    ],
    code: `package com.example.customerportfolio.controller;

import com.example.customerportfolio.dto.CustomerInformation;
import com.example.customerportfolio.dto.StockTradeRequest;
import com.example.customerportfolio.dto.StockTradeResponse;
import com.example.customerportfolio.service.CustomerService;
import com.example.customerportfolio.service.TradeService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("customers")
public class CustomerController {

    private final CustomerService customerService;
    private final TradeService tradeService;

    public CustomerController(CustomerService customerService, TradeService tradeService) {
        this.customerService = customerService;
        this.tradeService = tradeService;
    }

    @GetMapping("/{customerId}")
    public Mono<CustomerInformation> getCustomerInformation(@PathVariable Integer customerId) {
        return customerService.getCustomerInformation(customerId);
    }

    @PostMapping("/{customerId}/trade")
    public Mono<StockTradeResponse> trade(@PathVariable Integer customerId,
                                          @RequestBody Mono<StockTradeRequest> requestMono) {
        return requestMono
                .flatMap(request -> tradeService.trade(customerId, request));
    }
}
`,
    codeLabel: 'java',
    note: {
      label: 'KEY INSIGHT',
      text: 'When a controller method receives a reactive request body (<code>Mono&lt;StockTradeRequest&gt;</code>), the handler must <code>flatMap</code> over it before invoking the service. This defers execution until Spring has actually deserialized the JSON, and it lets backpressure, cancellation, and errors from the client side flow through to the downstream reactive pipeline.',
      tone: 'accent',
    },
    quiz: {
      question: 'Why does the <code>trade</code> endpoint use <code>requestMono.flatMap(request -&gt; tradeService.trade(...))</code> instead of passing the <code>Mono&lt;StockTradeRequest&gt;</code> directly to the service?',
      options: [
        { label: 'Because @RequestBody cannot bind a Mono type at all.', correct: false },
        { label: 'Because the service signature expects a concrete StockTradeRequest, not a Mono, and we must wait for deserialization before executing the trade.', correct: true },
        { label: 'Because flatMap is the only way to return a Mono from a controller.', correct: false },
        { label: 'Because @PathVariable requires a flatMap for primitive types.', correct: false },
      ],
      explanation: '<code>tradeService.trade(...)</code> is designed to operate on a fully deserialized <code>StockTradeRequest</code>, not on a publisher. <code>flatMap</code> subscribes to the incoming <code>Mono</code> and applies the lambda only when (and if) an item is emitted, which lets Spring\'s body deserialization happen lazily inside the reactive pipeline. Passing the <code>Mono</code> directly would force a blocking <code>block()</code> or break the service contract.',
    },
  },
  {
    id: '13.10',
    title: 'Exception Handler',
    duration: '3 min',
    kind: 'demo',
    summary: [
      'Building on the three custom exceptions created in the previous lesson (CustomerNotFoundException, InsufficientBalanceException, InsufficientSharesException), this lesson wires them into a centralized Spring MVC exception handler using <code>@ControllerAdvice</code>. Instead of letting exceptions bubble up as generic 500 errors, the handler translates each domain exception into a structured, standards-based error response that the Aggregator service (and any client) can parse reliably.\n\nThe implementation uses Spring 6\'s <code>ProblemDetail</code> class, which implements RFC 7807 (Problem Details for HTTP APIs). Each <code>@ExceptionHandler</code> method returns a <code>ProblemDetail</code> built from an HTTP status and the exception\'s message. To keep the handlers DRY, a private <code>buildProblemDetail</code> helper accepts the status, exception, and a <code>Consumer&lt;ProblemDetail&gt;</code> that customizes the response (e.g., setting the <code>title</code> or adding a documentation URL as a custom property). This pattern — the same one used in the playground project\'s functional endpoints — cleanly separates the boilerplate of constructing a problem detail from the per-exception customization.\n\nThe three mappings are: <code>CustomerNotFoundException</code> → 404 Not Found, <code>InsufficientBalanceException</code> → 400 Bad Request, and <code>InsufficientSharesException</code> → 400 Bad Request. The titles are normalized to capitalized form (e.g., "Insufficient Balance") so the response is presentation-ready for API consumers.',
    ],
    keyPoints: [
      '<strong>@ControllerAdvice</strong> centralizes cross-cutting exception handling across all <code>@RestController</code>s in the application, keeping controllers free of try/catch noise.',
      '<code>ProblemDetail</code> (Spring 6 / Spring Boot 3) is the recommended way to return RFC 7807-compliant error responses — it auto-serializes to JSON with fields like <code>type</code>, <code>title</code>, <code>status</code>, and <code>detail</code>.',
      'A private <code>buildProblemDetail(status, ex, consumer)</code> helper eliminates boilerplate and lets each handler customize only the fields that matter (title, custom property URLs, etc.).',
      '<code>CustomerNotFoundException</code> maps to <strong>404 NOT_FOUND</strong>; both <code>InsufficientBalanceException</code> and <code>InsufficientSharesException</code> map to <strong>400 BAD_REQUEST</strong> because they represent client-side validation failures (the request itself is malformed for the current state).',
      'The <code>Consumer&lt;ProblemDetail&gt;</code> lambda pattern is the same one previously used with functional endpoints, keeping the codebase stylistically consistent across the project.',
    ],
    code: `package com.vinsguru.customerportfolio.advice;

import com.vinsguru.customerportfolio.exception.CustomerNotFoundException;
import com.vinsguru.customerportfolio.exception.InsufficientBalanceException;
import com.vinsguru.customerportfolio.exception.InsufficientSharesException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;

import java.util.function.Consumer;

@ControllerAdvice
public class ApplicationExceptionHandler {

    @ExceptionHandler(CustomerNotFoundException.class)
    public ProblemDetail handleException(CustomerNotFoundException ex) {
        return buildProblemDetail(HttpStatus.NOT_FOUND, ex, problem -> {
            problem.setTitle("Customer Not Found");
        });
    }

    @ExceptionHandler(InsufficientBalanceException.class)
    public ProblemDetail handleException(InsufficientBalanceException ex) {
        return buildProblemDetail(HttpStatus.BAD_REQUEST, ex, problem -> {
            problem.setTitle("Insufficient Balance");
            problem.setProperty("documentation", "https://example.com/docs/insufficient-balance");
        });
    }

    @ExceptionHandler(InsufficientSharesException.class)
    public ProblemDetail handleException(InsufficientSharesException ex) {
        return buildProblemDetail(HttpStatus.BAD_REQUEST, ex, problem -> {
            problem.setTitle("Insufficient Shares");
        });
    }

    private ProblemDetail buildProblemDetail(HttpStatus status, Exception ex, Consumer<ProblemDetail> consumer) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, ex.getMessage());
        consumer.accept(problem);
        return problem;
    }
}`,
    codeLabel: 'java',
    note: {
      label: 'KEY INSIGHT',
      text: 'Returning a <code>ProblemDetail</code> from an <code>@ExceptionHandler</code> method is the idiomatic Spring 6 way to emit RFC 7807 error responses. Spring serializes it to JSON with standard fields (<code>type</code>, <code>title</code>, <code>status</code>, <code>detail</code>, <code>instance</code>) automatically — no manual <code>ResponseEntity</code> building required.',
      tone: 'accent',
    },
    quiz: {
      question: 'A user tries to SELL shares they don\'t own. Which HTTP status should the <code>ApplicationExceptionHandler</code> return for the resulting <code>InsufficientSharesException</code>?',
      options: [
        { label: '404 Not Found', correct: false },
        { label: '400 Bad Request', correct: true },
        { label: '409 Conflict', correct: false },
        { label: '500 Internal Server Error', correct: false },
      ],
      explanation: '<code>InsufficientSharesException</code> is a client-side validation failure — the request is syntactically valid but violates a business rule given the current state (the user doesn\'t own enough shares). 400 Bad Request is the correct semantic mapping, matching the handler in this lesson. 409 Conflict could be argued in some REST styles, but the project consistently uses 400 for all business-rule violations raised by the trade handlers.',
    },
  },
  {
    id: '13.11',
    title: 'Customer Portfolio Integration Tests - Part 1',
    duration: '7 min',
    kind: 'demo',
    summary: [
      'Before writing any test code, the instructor first boots the <code>CustomerPortfolioApplication</code> to confirm the whole stack (entity, repository, service, controller, exception handler from lessons 13.4–13.10) wires together without errors. A quick smoke test at the JVM level catches obvious bean-wiring or configuration mistakes before you invest time in finer-grained tests.',
      'The integration test class uses <code>@SpringBootTest</code> together with <code>@AutoConfigureWebTestClient</code> so that a fully configured <code>WebTestClient</code> is auto-wired and can hit the real controller layer (no mocks). The first test simply calls <code>GET /customers/81</code>, asserts a <code>200 OK</code>, and dumps the raw response body via <code>consumeWith(...).log.info(...)</code> — a useful debugging step that you can strip away once assertions replace the print.',
      'To keep the test class DRY (Don\'t Repeat Yourself), the instructor extracts two private helpers — <code>getCustomer(customerId, expectedStatus)</code> and <code>trade(customerId, request, expectedStatus)</code> — that return <code>WebTestClient.BodyContentSpec</code>. Returning the <code>BodyContentSpec</code> (instead of consuming it) lets every test method chain its own <code>jsonPath(...)</code> assertions onto the same call.',
      'The <code>customerInformation</code> test validates customer 1 (Sam) with a balance of <code>10000</code> and an empty <code>holdings</code> array. The <code>buyAndSell</code> test issues a <code>StockTradeRequest</code> for <code>GOOG</code> at price 100 × quantity 5 = 500 against customer 2\'s portfolio and asserts the resulting balance is <code>9500</code> (10000 − 500). The instructor deliberately runs the test once with <code>10001</code> to prove the assertion would fail with the wrong expected value, then restores it to <code>9500</code>.',
    ],
    keyPoints: [
      '<strong>Smoke-test first:</strong> start the app once to catch bean-wiring/configuration errors before writing any tests.',
      '<code>@SpringBootTest</code> + <code>@AutoConfigureWebTestClient</code> auto-wires a <code>WebTestClient</code> that drives the real Spring MVC / WebFlux controller layer — no mocking of HTTP infrastructure.',
      'Return <code>WebTestClient.BodyContentSpec</code> from helper methods so each test can append its own <code>jsonPath(...)</code> assertions without re-issuing the HTTP call.',
      '<code>consumeWith(e -> log.info(new String(e.getResponseBody())))</code> is a quick way to inspect the actual JSON payload while building a test.',
      'Sanity-check assertions by deliberately using a wrong expected value (e.g. <code>10001</code> instead of <code>10000</code>) — if the test still passes, the assertion is broken.',
    ],
    code: `package com.reactive.microservices.customerportfolio;

import com.reactive.microservices.customerportfolio.domain.TradeAction;
import com.reactive.microservices.customerportfolio.dto.StockTradeRequest;
import org.junit.jupiter.api.Test;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.reactive.AutoConfigureWebTestClient;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.test.web.reactive.server.WebTestClient;

@SpringBootTest
@AutoConfigureWebTestClient
class CustomerPortfolioApplicationTests {

    private static final Logger log = LoggerFactory.getLogger(CustomerPortfolioApplicationTests.class);

    @Autowired
    private WebTestClient client;

    @Test
    void customerInformation() {
        getCustomer(1, HttpStatus.OK)
                .jsonPath("$.name").isEqualTo("Sam")
                .jsonPath("$.balance").isEqualTo(10000)
                .jsonPath("$.holdings").isEmpty();
    }

    @Test
    void buyAndSell() {
        // buy 5 shares of GOOG @ 100 for customer 2 -> balance should be 10000 - 500 = 9500
        var buyRequest = new StockTradeRequest("GOOG", 100, 5, TradeAction.BUY);
        trade(2, buyRequest, HttpStatus.OK)
                .jsonPath("$.balance").isEqualTo(9500);

        // (sell test will be added in Part 2)
    }

    // --- reusable helpers ---

    private WebTestClient.BodyContentSpec getCustomer(Integer customerId, HttpStatus expectedStatus) {
        return client.get()
                .uri("/customers/{customerId}", customerId)
                .exchange()
                .expectStatus().isEqualTo(expectedStatus)
                .expectBody();
    }

    private WebTestClient.BodyContentSpec trade(Integer customerId, StockTradeRequest request, HttpStatus expectedStatus) {
        return client.post()
                .uri("/customers/{customerId}/trade", customerId)
                .bodyValue(request)
                .exchange()
                .expectStatus().isEqualTo(expectedStatus)
                .expectBody();
    }
}`,
    codeLabel: 'java',
    note: {
      label: 'KEY INSIGHT',
      text: 'Return <code>BodyContentSpec</code> (not <code>EntityExchangeResult&lt;byte[]&gt;</code>) from your test helpers so every test method can chain its own <code>jsonPath</code> assertions against the same HTTP call without duplicating boilerplate.',
      tone: 'accent',
    },
    quiz: {
      question: 'In the buyAndSell test, customer 2 starts with a balance of 10000 and the test posts a StockTradeRequest for GOOG at price 100 with quantity 5. What balance should the test assert after a successful BUY?',
      options: [
        { label: '10000', correct: false },
        { label: '9500', correct: true },
        { label: '9000', correct: false },
        { label: '10500', correct: false },
      ],
      explanation: 'A BUY deducts (price × quantity) = 100 × 5 = 500 from the customer\'s balance, so 10000 − 500 = 9500. The transcript shows the instructor running the test with 10001 on purpose to prove the assertion fails with a wrong value, then settling on 9500.',
    },
  },
  {
    id: '13.12',
    title: '@Transactional - H2 DB Warning',
    duration: '1 min',
    kind: 'faq',
    summary: [
      'When running integration tests with @Transactional and the R2DBC H2 driver, a noisy warning may appear in the logs. The instructor clarifies this is a known bug in the R2DBC H2 driver — it is <em>not</em> a functional issue and the transactional behavior works correctly. There is already an open GitHub issue tracking it, so it will likely be resolved in a future driver release.\n\nIf the warning is too distracting during test runs, you can suppress it through logging configuration. By setting the relevant logger to <code>OFF</code> in <code>application.properties</code> or <code>logback-spring.xml</code>, the message is silenced. This is purely a cosmetic fix — the application logic and transaction management are unaffected.\n\nThis lesson exists as a heads-up so learners don\'t get sidetracked chasing a non-issue. Focus remains on the integration tests themselves rather than the driver warning.',
    ],
    keyPoints: [
      '<strong>The H2 + @Transactional warning is cosmetic</strong> — transactions work correctly; it\'s a known R2DBC H2 driver bug with an open GitHub issue.',
      '<strong>Suppression is optional</strong> — you can safely ignore the warning or silence it via logging level configuration.',
      'Suppression can be done in <code>application.properties</code> using <code>logging.level.&lt;logger&gt;=OFF</code> or equivalently in <code>logback-spring.xml</code>.',
      '<strong>Don\'t conflate this with a real problem</strong> — the integration test assertions and transaction rollbacks in Part 1 and Part 2 are unaffected.',
      'If you watch later recordings after the bug is fixed, the warning may no longer appear at all.',
    ],
    code: `# Suppress the noisy R2DBC H2 transaction warning in application.properties
# (temporary workaround — the warning is a known driver bug, not a real issue)
logging.level.io.r2dbc.h2=OFF`,
    codeLabel: 'properties',
    note: {
      label: 'WARNING',
      text: 'If you see a warning related to @Transactional from the R2DBC H2 driver during integration tests, it is a known driver bug, not a problem with your code. Transactions still work correctly.',
      tone: 'accent',
    },
    quiz: {
      question: 'The R2DBC H2 driver warning that appears when using @Transactional indicates:',
      options: [
        { label: 'A critical bug that breaks transaction management', correct: false },
        { label: 'A known driver bug that can be safely ignored or suppressed via logging', correct: true },
        { label: 'A misconfiguration of Spring\'s reactive transaction manager', correct: false },
        { label: 'An incompatibility between @Transactional and R2DBC', correct: false },
      ],
      explanation: 'The warning is a known cosmetic bug in the R2DBC H2 driver (with an open GitHub issue). Transactional behavior works correctly — the message is misleading. You can ignore it or suppress it by setting the logger level to OFF in your logging configuration.',
    },
  },
  {
    id: '13.13',
    title: 'Customer Portfolio Integration Tests – Part 2',
    duration: '11 min',
    kind: 'demo',
    summary: [
      'Building on the integration test scaffolding from Part 1, this lesson walks through the end-to-end test scenarios for the Customer Portfolio service. The instructor extends the test class to cover the happy path for repeated buy and sell requests, then drills into the error paths: missing customer, insufficient balance, and insufficient shares. The goal is to assert not just the HTTP status, but the actual business state of the customer (balance, total price, holding quantity) using both strongly-typed record binding and JSONPath expressions on the response body.\n\nThe repeated buy scenario validates an important invariant: when the same customer trades the same ticker twice, the service must update the existing <code>PortfolioItem</code> rather than insert a duplicate. The instructor sends two buy requests (5 + 10 shares of Google at $100) and then reads <code>GET /customers/2</code>, asserting via <code>$.holdings.length()</code> that only one entry exists, and via <code>$.holdings[0].quantity</code> that it is 15. Sell requests follow the symmetric pattern — balance is credited and quantity is decremented, dropping to 0 when the full position is sold. Crucially, the instructor notes that the holdings entry is preserved at quantity 0 rather than deleted, matching the domain rule that positions are soft-cleared.\n\nThe error-path tests use the ProblemDetail response produced by the <code>@ControllerAdvice</code> from lesson 13.10. <code>GET /customers/10</code> and a trade request for the same non-existent id both return 404 with <code>$.detail == "Customer with id 10 not found"</code>, confirming that the same exception is mapped consistently across endpoints. Insufficient balance (customer 3 tries to buy 101 shares at $100, exceeding the $10,000 seed) returns 400 with a funds-specific message, and selling a share the customer does not own returns 400 with a shares-specific message. The instructor intentionally introduces a wrong assertion (expected 14, actual 15) mid-run to demonstrate the test failure output before correcting it.',
    ],
    keyPoints: [
      'Repeated buys/sells for the same <code>ticker</code> must <strong>update</strong> the existing <code>PortfolioItem</code>, not insert duplicates — verified via <code>$.holdings.length()</code> on the customer response.',
      'Selling the full position sets <code>quantity</code> to <strong>0</strong> but the <code>PortfolioItem</code> row is preserved; the service treats positions as soft-cleared.',
      '<code>WebTestClient</code> supports mixing strongly-typed <code>expectBody(CustomerInformation.class)</code> assertions with raw <code>jsonPath(...)</code> checks on the same chain, which is useful for both state and shape validation.',
      '<code>$.holdings[0].ticker</code> and <code>$.holdings[0].quantity</code> demonstrate JSONPath array indexing for inspecting the first holding.',
      'Error paths return Spring\'s <code>ProblemDetail</code> body — assert on <code>$.detail</code> rather than the whole body to keep tests resilient to RFC 7807 field changes.',
      'The same <code>CustomerNotFoundException</code> is raised whether the trigger is a <code>GET /customers/{id}</code> or a trade request, so the 404 + detail assertion can be shared between the two tests.',
    ],
    code: `package com.vinsguru.customerportfolio.integration;

import com.vinsguru.customerportfolio.domain.Ticker;
import com.vinsguru.customerportfolio.dto.CustomerInformation;
import com.vinsguru.customerportfolio.dto.StockTradeRequest;
import com.vinsguru.customerportfolio.dto.TradeAction;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.reactive.server.WebTestClient;

// ... (CustomerRepository / @BeforeEach data seeding from Part 1)

@SpringBootTest
class CustomerPortfolioIntegrationTest {

    @Autowired
    private WebTestClient webTestClient;

    @Test
    void buyAndSellUpdatesHoldings() {
        // 1) First buy: 5 shares of Google @ $100 => balance 9500, holding totalPrice 500
        var buyRequest1 = new StockTradeRequest(Ticker.GOOGLE, 100, 5, TradeAction.BUY);
        var response1 = this.webTestClient.post()
                .uri("/customers/2/trade")
                .bodyValue(buyRequest1)
                .exchange()
                .expectStatus().isOk()
                .expectBody(CustomerInformation.class)
                .returnResult();

        CustomerInformation customer1 = response1.getResponseBody();
        assert customer1 != null;
        assert customer1.balance() == 9500;
        assert customer1.holdings().stream()
                .filter(h -> h.ticker().equals(Ticker.GOOGLE))
                .findFirst().get().totalPrice() == 500;

        // 2) Second buy for the same ticker => existing holding updated, NOT duplicated
        var buyRequest2 = new StockTradeRequest(Ticker.GOOGLE, 100, 10, TradeAction.BUY);
        this.webTestClient.post()
                .uri("/customers/2/trade")
                .bodyValue(buyRequest2)
                .exchange()
                .expectStatus().isOk();

        // Verify holdings state: exactly one entry, ticker GOOGLE, quantity 15
        this.webTestClient.get()
                .uri("/customers/2")
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.holdings").isNotEmpty()
                .jsonPath("$.holdings.length()").isEqualTo(1)
                .jsonPath("$.holdings[0].ticker").isEqualTo("GOOGLE")
                .jsonPath("$.holdings[0].quantity").isEqualTo(15);

        // 3) Sell 5 @ $110 => balance 9050, totalPrice 550
        var sellRequest1 = new StockTradeRequest(Ticker.GOOGLE, 110, 5, TradeAction.SELL);
        this.webTestClient.post()
                .uri("/customers/2/trade")
                .bodyValue(sellRequest1)
                .exchange()
                .expectStatus().isOk()
                .expectBody(CustomerInformation.class);

        // 4) Sell 10 more @ $110 => balance 10150, holding.quantity drops to 0 (entry preserved)
        var sellRequest2 = new StockTradeRequest(Ticker.GOOGLE, 110, 10, TradeAction.SELL);
        this.webTestClient.post()
                .uri("/customers/2/trade")
                .bodyValue(sellRequest2)
                .exchange()
                .expectStatus().isOk();

        this.webTestClient.get()
                .uri("/customers/2")
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.holdings").isNotEmpty()
                .jsonPath("$.holdings.length()").isEqualTo(1)
                .jsonPath("$.holdings[0].ticker").isEqualTo("GOOGLE")
                .jsonPath("$.holdings[0].quantity").isEqualTo(0);
    }

    @Test
    void customerNotFound_returns404() {
        this.webTestClient.get()
                .uri("/customers/10")
                .exchange()
                .expectStatus().isNotFound()
                .expectBody()
                .jsonPath("$.detail").isEqualTo("Customer with id 10 not found");

        var tradeRequest = new StockTradeRequest(Ticker.GOOGLE, 100, 1, TradeAction.BUY);
        this.webTestClient.post()
                .uri("/customers/10/trade")
                .bodyValue(tradeRequest)
                .exchange()
                .expectStatus().isNotFound()
                .expectBody()
                .jsonPath("$.detail").isEqualTo("Customer with id 10 not found");
    }

    @Test
    void insufficientBalance_returns400() {
        // Customer 3 starts with $10,000. Buying 101 shares @ $100 = $10,100 should fail.
        var buyRequest = new StockTradeRequest(Ticker.GOOGLE, 100, 101, TradeAction.BUY);
        this.webTestClient.post()
                .uri("/customers/3/trade")
                .bodyValue(buyRequest)
                .exchange()
                .expectStatus().isBadRequest()
                .expectBody()
                .jsonPath("$.detail")
                .isEqualTo("customer 3 does not have enough funds to complete the transaction");
    }

    @Test
    void insufficientShares_returns400() {
        // Customer 3 has no Google holdings; selling 1 share must fail.
        var sellRequest = new StockTradeRequest(Ticker.GOOGLE, 100, 1, TradeAction.SELL);
        this.webTestClient.post()
                .uri("/customers/3/trade")
                .bodyValue(sellRequest)
                .exchange()
                .expectStatus().isBadRequest()
                .expectBody()
                .jsonPath("$.detail")
                .isEqualTo("customer 3 does not have enough shares to complete the transaction");
    }
}`,
    codeLabel: 'java',
    note: {
      label: 'KEY INSIGHT',
      text: 'Asserting the <em>shape</em> of the response (list size, array indices) is what catches the silent duplicate-insert bug — a status-200 test would pass even if the service inserted a new holding for every buy.',
      tone: 'accent',
    },
    quiz: {
      question: 'A customer holds 10 shares of Google and then submits a SELL request for all 10 at the current price. What should the test assert about the holdings list afterward?',
      options: [
        { label: 'The holdings array is now empty — the Google entry is deleted once quantity hits 0.', correct: false },
        { label: 'The holdings array still contains one Google entry, with quantity = 0 (the row is preserved).', correct: true },
        { label: 'The holdings array is null because the customer no longer owns any shares.', correct: false },
        { label: 'The test should not assert on holdings after a full sell — only on the balance.', correct: false },
      ],
      explanation: 'The service implements a soft-clear policy: a portfolio item is updated in place, and its quantity is set to 0 rather than being removed. Asserting length() == 1 with quantity == 0 verifies this contract and would fail if a future refactor switched to hard-deletes.',
    },
  },
  {
    id: '13.14',
    title: '[Aggregator] - Introduction',
    duration: '8 min',
    kind: 'concept',
    summary: [
      'The aggregator service is the public-facing entry point for clients in the trading platform. Rather than letting users call the <code>stock-service</code> and <code>customer-service</code> directly, it sits in front of both, orchestrates calls between them, and exposes a single, cohesive API surface. This is a classic <em>API gateway / aggregator</em> pattern — the aggregator holds no business logic of its own; it knows how to compose the downstream services.',
      'Three APIs are defined. <strong>(1) GET /customer/price-stream</strong> proxies the stock service\'s SSE <code>/stock/price-stream</code> endpoint and re-emits the <code>Flux&lt;PriceUpdate&gt;</code> to the browser so users can watch live price changes. <strong>(2) GET /customer/{customerId}/portfolio</strong> delegates straight to the customer service\'s customer-information endpoint and returns the result. <strong>(3) POST /customer/trade</strong> accepts a minimal body containing only <code>ticker</code>, <code>action</code>, and <code>quantity</code> — the aggregator first asks the stock service for the current price, then constructs a full <code>StockTradeRequest</code> (using the price it just fetched plus the <code>customerId</code> from the URL), and forwards it to the customer service.',
      'Validation responsibility is split deliberately. The aggregator performs only the cheap, syntactic checks it can do itself — non-blank <code>ticker</code>, valid <code>action</code>, <code>quantity &gt; 0</code> — and rejects bad requests with a 400 immediately. Anything that requires domain knowledge (does the customer exist? do they have enough balance? enough shares?) is the customer service\'s job, so the aggregator does not duplicate it.',
      'Error propagation is asymmetric because the two downstreams behave differently. The stock service never returns 4xx, so the aggregator only needs to handle a 404 from the customer service (customer not found) by re-throwing its own <code>CustomerNotFoundException</code> and letting the global handler render a <code>ProblemDetail</code>. For 4xx responses from the customer service on the trade endpoint, the aggregator must extract the human-readable <code>detail</code> from the returned <code>ProblemDetail</code> body and surface that exact message back to the client, so the caller learns <em>why</em> the trade was rejected (e.g. insufficient balance/shares) rather than getting a generic error.',
    ],
    keyPoints: [
      '<strong>Aggregator is a thin orchestrator</strong> — no business logic, only composition of stock-service and customer-service calls.',
      '<strong>Three public APIs:</strong> <code>GET /customer/price-stream</code> (SSE proxy), <code>GET /customer/{customerId}/portfolio</code> (delegate), <code>POST /customer/trade</code> (compose).',
      '<strong>Trade request body is minimal:</strong> only <code>ticker</code>, <code>action</code>, <code>quantity</code> — the current price is looked up from the stock service before forwarding to the customer service.',
      '<strong>Validation split:</strong> aggregator does syntactic checks (blank fields, quantity &gt; 0) and returns 400; customer service owns domain validation (balance, holdings, customer existence).',
      '<strong>Error handling split:</strong> stock service is assumed not to throw 4xx; customer-service 404 → re-throw as <code>CustomerNotFoundException</code>; customer-service 400 → extract <code>detail</code> from <code>ProblemDetail</code> and forward verbatim.',
    ],
    note: {
      label: 'KEY INSIGHT',
      text: 'The aggregator\'s value is not in new logic but in owning the cross-service choreography — it knows <em>when</em> to call which service and <em>how</em> to translate downstream errors into a single, consistent API for clients.',
      tone: 'accent',
    },
    quiz: {
      question: 'A POST /customer/trade request arrives with a valid ticker, action, and quantity, but the customer has insufficient balance. Which component is responsible for detecting this and producing the error response?',
      options: [
        { label: 'The aggregator, because it owns the public trade API', correct: false },
        { label: 'The stock service, because it provides the price used in the trade', correct: false },
        { label: 'The customer service, because balance checks are domain logic', correct: true },
        { label: 'Spring\'s @ControllerAdvice in the aggregator, automatically', correct: false },
      ],
      explanation: 'Balance and holdings are domain rules that only the customer service can evaluate, so it returns a 400 with a ProblemDetail explaining the failure. The aggregator\'s job is to forward that detail verbatim — duplicating the check would create two sources of truth for business rules.',
    },
  },
  {
    id: '13.15',
    title: '[Aggregator] - Project Setup',
    duration: '4 min',
    kind: 'setup',
    summary: [
      'This lesson bootstraps a new Spring Boot project for the <code>aggregator-service</code>, which will sit in front of the customer and stock microservices and expose a unified trading API. The project is created via <em>Spring Initializr</em> with <code>spring-webflux</code> as the only dependency for now; testing libraries (JUnit, Mockito, WireMock) will be added later when integration tests are introduced. The instructor changes the base package to follow the aggregator\'s naming convention and creates a standard layered structure with <code>domain</code>, <code>exceptions</code>, and similar packages.\n\nTo avoid rebuilding common types, the instructor copies the <code>Customer</code> and <code>Holding</code> DTOs and the <code>CustomerException</code> / <code>ApplicationExceptions</code> classes from the customer service into the aggregator, then updates their package declarations to the aggregator\'s namespace. He explicitly drops <code>TotalPrice</code> because the aggregator will compute prices differently. He also notes that in a real codebase these shared models would live in a dedicated Maven module (he links to a blog post on <em>vinayselva.com</em> describing this pattern), but for course simplicity everything is duplicated.\n\nThree new aggregator-specific DTOs are then created: a <code>TradeRequest</code> record capturing <code>ticker</code>, <code>tradeAction</code>, and <code>quantity</code> (the unified payload clients will POST to the aggregator); a <code>PriceUpdate</code> Java record representing a single SSE tick from the stock service stream (ticker, integer price, <code>LocalDateTime</code>); and a <code>StockPriceResponse</code> record for the one-shot stock price endpoint. Using Java <code>record</code>s is idiomatic for immutable DTOs in modern Java and pairs naturally with reactive streaming.',
    ],
    keyPoints: [
      '<strong>Spring Initializr</strong> setup: <code>spring-webflux</code> is the sole dependency; test dependencies are deferred to the integration-test lessons.',
      'Shared DTOs (<code>Customer</code>, <code>Holding</code>) and exception classes are <strong>copied</strong> from the customer service and re-packaged under the aggregator\'s namespace — a shortcut; in production, extract these into a shared Maven module.',
      '<code>TotalPrice</code> is intentionally <strong>not</strong> copied because the aggregator will compute pricing on the fly by calling the stock service.',
      'New <strong>aggregator-specific</strong> DTOs are introduced: <code>TradeRequest</code> (unified trade payload from clients), <code>PriceUpdate</code> (SSE tick from stock stream), and <code>StockPriceResponse</code> (single stock price response).',
      'Java <code>record</code>s are used for the new DTOs, providing immutability, equals/hashCode, and accessors out of the box — a natural fit for reactive, value-oriented payloads.',
    ],
    code: `// Trade request received by the aggregator from external clients
package com.aggregator.domain;

import com.aggregator.domain.TradeAction;

public record TradeRequest(String ticker, TradeAction tradeAction, Integer quantity) {}

// One tick from the stock service's Server-Sent Events price stream
package com.aggregator.domain;

import java.time.LocalDateTime;

public record PriceUpdate(String ticker, Integer price, LocalDateTime time) {}

// Response for a one-shot stock price query (no timestamp needed)
package com.aggregator.domain;

public record StockPriceResponse(String ticker, Integer price) {}

// Trade action enum
package com.aggregator.domain;

public enum TradeAction { BUY, SELL }

// Customer & Holding DTOs copied from customer service and re-packaged
// (package renamed from com.customer.domain.* to com.aggregator.domain.*)
package com.aggregator.domain;

import java.util.List;

public record Customer(Integer id, String name, Integer balance, List<Holding> holdings) {}

// (Holding record also copied and re-packaged)
// package com.aggregator.domain;
// public record Holding(String ticker, Integer quantity) {}

// Exceptions copied from customer service and re-packaged
// package com.aggregator.exceptions;
// public class CustomerException extends RuntimeException { ... }
// package com.aggregator.exceptions;
// public class ApplicationExceptions { ... }`,
    codeLabel: 'java',
    note: {
      label: 'WHY THIS MATTERS',
      text: 'The aggregator is a thin orchestration layer that fans out to customer and stock services, so its DTOs are the union of payloads those services expose plus the unified trade API exposed to clients. Reusing shared DTOs is pragmatic for a tutorial; in production, factor them into a shared module to avoid drift.',
      tone: 'accent',
    },
    quiz: {
      question: 'Why is the TotalPrice DTO intentionally NOT copied from the customer service into the aggregator?',
      options: [
        { label: 'Because TotalPrice is an entity, not a DTO.', correct: false },
        { label: 'Because the aggregator will compute total portfolio value on the fly by calling the stock service for current prices.', correct: true },
        { label: 'Because TotalPrice is not used in reactive streams.', correct: false },
        { label: 'Because it was deprecated in the latest Spring Boot version.', correct: false },
      ],
      explanation: 'The aggregator fetches live prices from the stock service and combines them with the customer\'s holdings to compute total portfolio value dynamically, so a static TotalPrice DTO is unnecessary and would become stale.',
    },
  },
  {
    id: '13.16',
    title: 'Request Validator',
    duration: '4 min',
    kind: 'demo',
    summary: [
      'The Aggregator service reuses the same input-validation pattern established in the Customer Portfolio project: a custom exception, a factory class that produces reactive error signals, and a <code>RequestValidator</code> that exposes a <code>UnaryOperator&lt;Mono&lt;TradeRequest&gt;&gt;</code> so it can be slotted into a service\'s reactive pipeline. The target DTO is the <code>TradeRequest</code> record (containing <code>ticker</code>, <code>action</code>, and <code>quantity</code>) that was introduced during the Aggregator\'s project setup.',
      'First, a domain-specific exception is created: <code>InvalidTradeRequestException extends RuntimeException</code>. It exists purely to give the global <code>@ControllerAdvice</code> (covered later in the section) a precise type to map to HTTP 400, and to keep error semantics explicit. <code>ApplicationExceptions</code> then exposes static helpers — <code>missingTicker()</code>, <code>missingTradeAction()</code>, and <code>invalidQuantity()</code> — each returning a <code>Mono&lt;Throwable&gt;</code> built with <code>Mono.error(...)</code>. Returning the error as a <code>Mono</code> (rather than a thrown exception) lets the validator compose it directly with <code>switchIfEmpty</code> downstream.',
      'The <code>RequestValidator</code> defines three <code>Predicate&lt;TradeRequest&gt;</code> fields — <code>hasTicker</code>, <code>hasAction</code>, and <code>isValidQuantity</code> — that mirror the DTO\'s required fields. Its public <code>validate()</code> method returns a <code>UnaryOperator</code> that wraps an incoming <code>Mono&lt;TradeRequest&gt;</code> with a chain of <code>filter(...).switchIfEmpty(...)</code> calls. Each <code>filter</code> either lets the request through or empties the <code>Mono</code>, and the corresponding <code>switchIfEmpty</code> converts that empty signal into the typed validation error. Services can therefore apply validation simply by composing <code>.transform(RequestValidator.validate())</code>, keeping the service method bodies free of imperative null checks.',
    ],
    keyPoints: [
      'The Aggregator mirrors the Customer Portfolio validation pattern: custom exception + <code>ApplicationExceptions</code> factory + <code>RequestValidator</code> with predicates.',
      '<code>InvalidTradeRequestException extends RuntimeException</code> — a marker type that the future <code>@ControllerAdvice</code> will map to HTTP 400.',
      '<code>ApplicationExceptions</code> methods return <code>Mono&lt;Throwable&gt;</code> so they plug directly into <code>switchIfEmpty</code> without extra wrapping.',
      '<code>filter(...).switchIfEmpty(Mono.error(...))</code> is the idiomatic reactive way to short-circuit a stream on a failed precondition — <code>filter</code> drops the value, <code>switchIfEmpty</code> replaces the empty signal with an error.',
      'The validator is exposed as a <code>UnaryOperator&lt;Mono&lt;TradeRequest&gt;&gt;</code> so it can be applied with <code>Mono.transform(...)</code> anywhere in the service chain.',
    ],
    code: `package com.example.aggregator.exceptions;

public class InvalidTradeRequestException extends RuntimeException {
    public InvalidTradeRequestException(String message) {
        super(message);
    }
}

// ----------------------------------------------------------------

package com.example.aggregator.exceptions;

import reactor.core.publisher.Mono;

public class ApplicationExceptions {

    public static Mono<Throwable> missingTicker() {
        return Mono.error(new InvalidTradeRequestException("Ticker is required"));
    }

    public static Mono<Throwable> missingTradeAction() {
        return Mono.error(new InvalidTradeRequestException("TradeAction is required"));
    }

    public static Mono<Throwable> invalidQuantity() {
        return Mono.error(new InvalidTradeRequestException("Quantity should be greater than zero"));
    }
}

// ----------------------------------------------------------------

package com.example.aggregator.validator;

import com.example.aggregator.dto.TradeRequest;
import com.example.aggregator.exceptions.ApplicationExceptions;
import reactor.core.publisher.Mono;

import java.util.Objects;
import java.util.function.Predicate;
import java.util.function.UnaryOperator;

public class RequestValidator {

    private static final Predicate<TradeRequest> hasTicker =
            dto -> Objects.nonNull(dto.ticker());

    private static final Predicate<TradeRequest> hasAction =
            dto -> Objects.nonNull(dto.action());

    private static final Predicate<TradeRequest> isValidQuantity =
            dto -> Objects.nonNull(dto.quantity()) && dto.quantity() > 0;

    public static UnaryOperator<Mono<TradeRequest>> validate() {
        return mono -> mono
                .filter(hasTicker)
                .switchIfEmpty(ApplicationExceptions.missingTicker())
                .filter(hasAction)
                .switchIfEmpty(ApplicationExceptions.missingTradeAction())
                .filter(isValidQuantity)
                .switchIfEmpty(ApplicationExceptions.invalidQuantity());
    }
}

// ----------------------------------------------------------------
// TradeRequest.java (record introduced during the Aggregator project setup)
// ----------------------------------------------------------------
package com.example.aggregator.dto;

public record TradeRequest(String ticker, TradeAction action, Integer quantity) {}`,
    codeLabel: 'java',
    note: {
      label: 'KEY INSIGHT',
      text: 'Returning a <code>Mono&lt;Throwable&gt;</code> from <code>ApplicationExceptions</code> instead of a raw exception lets the validator compose errors declaratively with <code>switchIfEmpty</code> — no try/catch, no imperative <code>if</code> blocks in service code.',
      tone: 'accent',
    },
    quiz: {
      question: 'In the RequestValidator, why is the chain written as `mono.filter(predicate).switchIfEmpty(Mono.error(...))` rather than `mono.flatMap(dto -> predicate.test(dto) ? Mono.just(dto) : Mono.error(...))`?',
      options: [
        { label: 'Because switchIfEmpty runs faster than flatMap and is the preferred operator for any branching logic.', correct: false },
        { label: 'filter drops the value without erroring, and switchIfEmpty converts that empty signal into a typed error — this keeps the pipeline declarative and avoids recreating the Mono on each validation step.', correct: true },
        { label: 'filter and switchIfEmpty are the only operators that work with Predicate in Project Reactor.', correct: false },
        { label: 'flatMap cannot be used with a Predicate, so filter is required by the type system.', correct: false },
      ],
      explanation: 'The filter + switchIfEmpty combination is the idiomatic Project Reactor pattern for short-circuiting on a failed precondition. `filter` quietly drops items that fail the predicate (emitting an empty Mono), and `switchIfEmpty` lets you substitute an alternative publisher — in this case `Mono.error(...)` — when the filter empties the stream. This avoids wrapping each step in a `flatMap` with an explicit ternary, and it preserves the original request object without rebuilding the Mono on every check.',
    },
  },
  {
    id: '13.17',
    title: 'Stock Service Client',
    duration: '2 min',
    kind: 'demo',
    summary: [
      'The aggregator service needs a client to talk to the stock service for two distinct use cases: fetching the current price for a single ticker and consuming a continuous stream of price updates. To encapsulate this communication, a <code>StockServiceClient</code> is created under the <code>client</code> package. It is annotated with <code>@Component</code> for now, but the instructor notes that the WebClient wiring will later be moved into a <code>@Configuration</code> class as an explicit <code>@Bean</code> — this is a common pattern for keeping infrastructure clients testable and configurable without relying on component scanning for the WebClient itself.',
      'The <code>StockServiceClient</code> holds a <code>WebClient</code> injected via constructor. The first method, <code>getStockPrice(String ticker)</code>, returns <code>Mono&lt;StockPriceResponse&gt;</code> by issuing a GET to <code>/stock/{ticker}</code> and using <code>bodyToMono(...)</code> — appropriate because a single HTTP response yields a single value. The second method, <code>getPriceUpdates()</code>, returns <code>Flux&lt;PriceUpdate&gt;</code> by hitting <code>/stock/price-stream</code> with an <code>APPLICATION_NDJSON</code> accept header, then using <code>bodyToFlux(...)</code>. The ndjson (Newline-Delimited JSON) media type tells the server to keep the response open and emit one JSON object per line, which <code>bodyToFlux</code> can deserialize into an unbounded reactive stream.',
      'The key takeaway is the symmetry between the response shape and the reactive type: a finite, single-item HTTP response maps to <code>Mono</code> with <code>bodyToMono</code>, while a long-lived streaming response maps to <code>Flux</code> with <code>bodyToFlux</code>. The <code>accept(MediaType.APPLICATION_NDJSON)</code> header is the contract that tells the stock service to switch from a one-shot response to a chunked, line-delimited stream — the same underlying HTTP chunked transfer encoding seen in SSE, but using ndjson framing for easier JSON parsing on the client side.',
    ],
    keyPoints: [
      '<strong><code>StockServiceClient</code></strong> lives in the <code>client</code> package and wraps a <code>WebClient</code> for all stock-service communication.',
      '<strong>Finite vs streaming responses</strong>: <code>getStockPrice</code> uses <code>bodyToMono(StockPriceResponse.class)</code> for a single price; <code>getPriceUpdates</code> uses <code>bodyToFlux(PriceUpdate.class)</code> for the continuous stream.',
      '<strong>ndjson for streaming</strong>: the price-stream endpoint is consumed with <code>accept(MediaType.APPLICATION_NDJSON)</code>, letting the client receive a long-lived stream of newline-delimited JSON objects.',
      '<strong>Temporary <code>@Component</code></strong>: the class is annotated <code>@Component</code> for now, but the <code>WebClient</code> bean itself will be defined in a <code>@Configuration</code> class in a later lesson.',
    ],
    code: `package com.aggregator.client;

import com.aggregator.dto.PriceUpdate;
import com.aggregator.dto.StockPriceResponse;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@Component
public class StockServiceClient {

    private final WebClient client;

    public StockServiceClient(WebClient client) {
        this.client = client;
    }

    public Mono<StockPriceResponse> getStockPrice(String ticker) {
        return this.client.get()
                .uri("/stock/{ticker}", ticker)
                .retrieve()
                .bodyToMono(StockPriceResponse.class);
    }

    public Flux<PriceUpdate> getPriceUpdates() {
        return this.client.get()
                .uri("/stock/price-stream")
                .accept(MediaType.APPLICATION_NDJSON)
                .retrieve()
                .bodyToFlux(PriceUpdate.class);
    }
}
`,
    codeLabel: 'java',
    note: {
      label: 'WHY THIS MATTERS',
      text: 'Encapsulating every stock-service call behind a single client class keeps the aggregator decoupled from raw WebClient usage and gives you a single seam to mock during integration tests — which the section\'s later MockServer lessons will rely on heavily.',
      tone: 'accent',
    },
    quiz: {
      question: 'Why does getPriceUpdates() use APPLICATION_NDJSON and bodyToFlux, while getStockPrice() uses the default accept type and bodyToMono?',
      options: [
        { label: 'ndjson is just a newer JSON format — both endpoints could use bodyToMono without any difference.', correct: false },
        { label: 'The price-stream endpoint keeps the HTTP response open and emits one JSON object per newline indefinitely, so the client must accept ndjson and deserialize each line reactively into a Flux.', correct: true },
        { label: 'bodyToFlux is faster than bodyToMono and is preferred for performance reasons.', correct: false },
        { label: 'APPLICATION_NDJSON enables HTTP/2 server push for the stream.', correct: false },
      ],
      explanation: 'The price-stream endpoint is a long-lived chunked response where each line is a separate JSON object. APPLICATION_NDJSON advertises that the client can parse each line independently, and bodyToFlux is required to emit a new item to the subscriber for every parsed line. bodyToMono would block waiting for the response to complete — which it never will — so it would never emit a value.',
    },
  },
  {
    id: '13.18',
    title: '[Aggregator] - Hot Price Stream',
    duration: '5 min',
    kind: 'demo',
    summary: [
      'Building on the <code>StockServiceClient</code> from the previous lesson, this lesson transforms the upstream price stream into a <strong>hot publisher</strong> so the aggregator can broadcast price changes to every connected user from a single subscription, rather than opening one SSE connection per user. A hot publisher emits the same items to all subscribers — critical here because Google at $100 is the same for every customer, unlike the per-user <code>customerPortfolio</code> flux which is inherently user-specific.',
      'The conversion to a hot publisher uses three pieces: (1) a <strong>lazy-initialized</strong> <code>Flux</code> field created only on the first call to <code>priceUpdatesStream()</code> so the upstream subscription happens exactly once, (2) the <code>.cache(1)</code> operator which buffers the most recent emission and replays it to any late subscriber (so a user who connects after the last tick still sees the current price immediately), and (3) a <code>Retry.fixedDelay(100, Duration.ofSeconds(1))</code> wrapper with a <code>doBeforeRetry</code> hook that logs failures, because a long-running aggregator would otherwise be permanently broken the first time the stock service restarts and terminates the SSE stream with an error signal.',
      'Because an error signal ends a <code>Flux</code> permanently and an empty/null signal means the stream died, the <code>retryWhen</code> logic attempts to re-establish the upstream connection up to 100 times with a 1-second back-off. The <code>doBeforeRetry</code> hook simply logs <code>failure().getMessage()</code> to the console so operators can see why reconnections are happening. This combination — lazy init + <code>cache</code> + retry — is the canonical pattern for turning a cold client-side stream into a resilient, multiplexed server-side hot publisher.',
    ],
    keyPoints: [
      '<strong>Hot vs cold publisher</strong>: price stream is global and identical for every user, so a single hot subscription is more efficient than one cold subscription per user.',
      '<code>.cache(1)</code> buffers the most recent emission so late subscribers immediately receive the latest price instead of waiting for the next tick.',
      '<strong>Lazy initialization</strong> (null-check pattern on the <code>Flux</code> field) guarantees the upstream <code>StockServiceClient.priceUpdatesStream()</code> is subscribed to exactly once for the lifetime of the application context.',
      '<code>Retry.fixedDelay(100, Duration.ofSeconds(1))</code> from <code>reactor.util.retry</code> re-establishes the SSE connection up to 100 times with a 1-second back-off after the upstream terminates with an error.',
      '<code>doBeforeRetry</code> is a side-effect hook — it runs <em>before</em> each retry attempt, making it the right place for logging without affecting the retry decision.',
      'After an error signal, a <code>Flux</code> is permanently dead, so <code>retryWhen</code> must sit <em>downstream</em> of the client call and <em>upstream</em> of <code>.cache()</code> so the cached hot publisher gets a fresh source.',
    ],
    code: `package com.example.aggregator.service;

import com.example.aggregator.client.StockServiceClient;
import com.example.aggregator.dto.PriceUpdate;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.util.retry.Retry;

import java.time.Duration;

@Service
public class StockService {

    private Flux<PriceUpdate> flux;
    private final StockServiceClient client;

    public StockService(StockServiceClient client) {
        this.client = client;
    }

    public Flux<PriceUpdate> priceUpdatesStream() {
        if (this.flux == null) {
            this.flux = this.getPriceUpdates()
                    .retryWhen(this.retryLogic())
                    .cache(1);          // keep only the most recent emission for late subscribers
        }
        return this.flux;
    }

    // Private so the upstream is subscribed to exactly once (lazy + cache make it hot)
    private Flux<PriceUpdate> getPriceUpdates() {
        return this.client.priceUpdatesStream(); // SSE stream from lesson 13.17
    }

    private Retry retryLogic() {
        return Retry.fixedDelay(100, Duration.ofSeconds(1))
                .doBeforeRetry(s -> System.out.println(
                        "Stock service price stream call failed: "
                                + s.failure().getMessage()
                ));
    }
}`,
    codeLabel: 'java',
    note: {
      label: 'WHY THIS MATTERS',
      text: 'Without the hot-publisher conversion, every connected user would open their own SSE connection to the stock service — N users means N subscriptions and N copies of every price tick. Caching the last value and broadcasting from a single subscription scales O(1) instead of O(N).',
      tone: 'accent',
    },
    quiz: {
      question: 'Why must .retryWhen() be placed downstream of the stock service call but upstream of .cache(1)?',
      options: [
        { label: 'So that the retry can replace the cached value each time it fires', correct: false },
        { label: 'So that a failed upstream re-establishes a fresh Flux that the cache operator then buffers — keeping the hot publisher alive for all subscribers', correct: true },
        { label: 'Because .cache() cannot be applied to a Flux that has not yet produced any items', correct: false },
        { label: 'It does not matter — they are commutative operators in Reactor', correct: false },
      ],
      explanation: 'Placement matters: retryWhen must wrap the cold client call so a terminated upstream can be re-subscribed. If retryWhen sat downstream of .cache(), the cached hot publisher would itself terminate on the first error and no retry could revive it. Putting retryWhen between the client call and .cache(1) means every successful resubscription produces a new live source that the cache operator buffers for all current and future subscribers.',
    },
  },
  {
    id: '13.19',
    title: 'Customer Service Client',
    duration: '7 min',
    kind: 'demo',
    summary: [
      'The <code>CustomerServiceClient</code> is the Aggregator\'s gateway to the Customer Portfolio microservice. Built as a Spring <code>@Component</code> in the <code>client</code> package, it receives a shared <code>WebClient</code> via constructor injection (the same bean that will later be configured with the Customer Service base URL). It exposes two reactive methods: <code>getCustomerInformation(int customerId)</code> performs a GET to <code>/customers/{customerId}</code> and returns <code>Mono&lt;CustomerInformation&gt;</code>, while <code>trade(int customerId, StockTradeRequest request)</code> performs a POST to <code>/customers/{customerId}/trade</code> with the request as the body and returns <code>Mono&lt;StockTradeResponse&gt;</code>.\n\nUnlike the Stock Service client (which is assumed to be error-free), the Customer Service returns meaningful HTTP errors — <code>404 Not Found</code> when the customer doesn\'t exist, and <code>400 Bad Request</code> for invalid trades (insufficient shares, insufficient balance, etc.). The client uses <code>onErrorResume</code> to translate these transport-level errors into domain exceptions. <code>WebClientResponseException.NotFound</code> is mapped directly to <code>ApplicationExceptions.customerNotFound(customerId)</code> for both the GET and the POST. <code>WebClientResponseException.BadRequest</code> is routed through a private <code>handleException</code> helper.\n\nThe <code>handleException</code> helper uses <code>ex.getResponseBodyAs(ProblemDetail.class)</code> to deserialize the RFC 7807 problem detail body that the Customer Service emits. It extracts the <code>detail</code> field (which carries the human-readable reason like "customer does not have enough shares") and falls back to the exception\'s own message if the body is null. The extracted message is then wrapped via <code>ApplicationExceptions.invalidTradeRequest(message)</code>, which returns a <code>Mono</code> that errors out — effectively propagating the domain exception up the reactive pipeline.',
    ],
    keyPoints: [
      '<strong>Constructor-injected <code>WebClient</code>:</strong> the client bean is not newed up — it receives the shared <code>WebClient</code>, which will be configured with the Customer Service base URL in a later configuration lesson.',
      '<strong>Two endpoints:</strong> <code>getCustomerInformation</code> (GET <code>/customers/{id}</code>) and <code>trade</code> (POST <code>/customers/{id}/trade</code>) — the only two calls the Aggregator makes to the Customer Portfolio service.',
      '<strong>Error translation with <code>onErrorResume</code>:</strong> <code>WebClientResponseException.NotFound</code> → <code>ApplicationExceptions.customerNotFound(customerId)</code>; <code>BadRequest</code> → <code>handleException</code> helper.',
      '<strong>Problem Detail extraction:</strong> <code>ex.getResponseBodyAs(ProblemDetail.class)</code> deserializes the RFC 7807 body so the <code>detail</code> field (e.g. "insufficient balance") is preserved into the domain exception\'s message.',
      '<strong>Domain exceptions, not transport exceptions:</strong> callers of this client never see <code>WebClientResponseException</code> — only <code>CustomerNotFoundException</code> or <code>InvalidTradeRequestException</code>, which keeps the service layer HTTP-agnostic.',
    ],
    code: `package com.aggregator.client;

import com.aggregator.dto.CustomerInformation;
import com.aggregator.dto.StockTradeRequest;
import com.aggregator.dto.StockTradeResponse;
import com.aggregator.exceptions.ApplicationExceptions;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ProblemDetail;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import reactor.core.publisher.Mono;

@Component
public class CustomerServiceClient {

    private static final Logger log = LoggerFactory.getLogger(CustomerServiceClient.class);

    private final WebClient client;

    public CustomerServiceClient(WebClient client) {
        this.client = client;
    }

    public Mono<CustomerInformation> getCustomerInformation(int customerId) {
        return this.client.get()
                .uri("/customers/{customerId}", customerId)
                .retrieve()
                .bodyToMono(CustomerInformation.class)
                .onErrorResume(WebClientResponseException.NotFound.class, ex ->
                        ApplicationExceptions.customerNotFound(customerId));
    }

    public Mono<StockTradeResponse> trade(int customerId, StockTradeRequest request) {
        return this.client.post()
                .uri("/customers/{customerId}/trade", customerId)
                .bodyValue(request)
                .retrieve()
                .bodyToMono(StockTradeResponse.class)
                .onErrorResume(WebClientResponseException.NotFound.class, ex ->
                        ApplicationExceptions.customerNotFound(customerId))
                .onErrorResume(WebClientResponseException.BadRequest.class, this::handleException);
    }

    private <T> Mono<T> handleException(WebClientResponseException.BadRequest ex) {
        var pd = ex.getResponseBodyAs(ProblemDetail.class);
        var message = pd != null ? pd.getDetail() : ex.getMessage();
        log.debug("Customer service problem detail: {}", pd);
        return ApplicationExceptions.invalidTradeRequest(message);
    }
}`,
    codeLabel: 'java',
    note: {
      label: 'KEY INSIGHT',
      text: 'Translating transport exceptions into domain exceptions at the client boundary is what keeps the Aggregator\'s service layer free of HTTP concerns. By the time a controller calls <code>customerServiceClient.trade(...)</code>, any failure arrives as a typed <code>InvalidTradeRequestException</code> with a human-readable message — the <code>WebClientResponseException</code> never leaks upward.',
      tone: 'accent',
    },
    quiz: {
      question: 'When the Customer Service returns 400 Bad Request for an invalid trade (e.g. insufficient balance), what message ends up inside the resulting domain exception?',
      options: [
        { label: 'The HTTP status text "Bad Request"', correct: false },
        { label: 'The <code>detail</code> field of the ProblemDetail body returned by the Customer Service', correct: true },
        { label: 'The stack trace of the WebClientResponseException', correct: false },
        { label: 'A generic "Invalid trade request" string with no specifics', correct: false },
      ],
      explanation: 'The <code>handleException</code> helper calls <code>ex.getResponseBodyAs(ProblemDetail.class)</code> to deserialize the RFC 7807 body, then reads its <code>detail</code> field — which is the human-readable reason the Customer Service included (e.g. "customer does not have enough shares"). That string is passed into <code>ApplicationExceptions.invalidTradeRequest(message)</code>, preserving the actual reason for the failure.',
    },
  },
  {
    id: '13.20',
    title: '[Aggregator] - Customer Portfolio Service',
    duration: '5 min',
    kind: 'demo',
    summary: [
      'The <code>CustomerPortfolioService</code> is the orchestration layer of the Aggregator service. It composes calls to <code>StockServiceClient</code> (built in lesson 17) and <code>CustomerServiceClient</code> (built in lesson 19) to implement the two main use-cases exposed by the aggregator: looking up a customer\'s portfolio and executing a trade.',
      'For the read-side, the service is intentionally thin — <code>getCustomerInformation(Integer customerId)</code> simply delegates to <code>customerServiceClient.getCustomerInformation(...)</code> and returns the resulting <code>Mono&lt;CustomerInformation&gt;</code>. No additional transformation is needed because the client already emits the canonical DTO the Aggregator\'s API will return to its own callers.',
      'The trade-side is where orchestration becomes interesting. <code>trade(Integer customerId, TradeRequest request)</code> must first ask the stock service for the current price of the requested ticker, then enrich the incoming <code>TradeRequest</code> with that price to produce a <code>StockTradeRequest</code>, and finally forward the enriched request to the customer service. This pipeline is built reactively: <code>stockServiceClient.getPrice(request.ticker())</code> returns a <code>Mono&lt;StockPriceResponse&gt;</code>, <code>.map(price -&gt; toStockTradeRequest(request, price))</code> synchronously projects the price into a <code>StockTradeRequest</code>, and <code>.flatMap(...)</code> switches from the price stream to the customer-service trade call, returning a <code>Mono&lt;StockTradeResponse&gt;</code>. The private <code>toStockTradeRequest</code> helper centralises the DTO mapping so the public method reads as a clean three-step pipeline.',
    ],
    keyPoints: [
      '<code>CustomerPortfolioService</code> is the <strong>orchestration layer</strong> — it composes the two reactive clients (stock + customer) that were built in lessons 17 and 19.',
      '<code>getCustomerInformation</code> is a pass-through delegation returning <code>Mono&lt;CustomerInformation&gt;</code> from the customer client.',
      'The <code>trade</code> method follows a reactive pipeline: <code>getPrice</code> → <code>.map</code> to enrich the request with the live price → <code>.flatMap</code> to call <code>customerServiceClient.trade(...)</code>.',
      '<code>.map</code> is used for synchronous transformation (price → <code>StockTradeRequest</code>), while <code>.flatMap</code> is required for the second step because switching to another asynchronous <code>Mono</code> requires flattening.',
      'A private <code>toStockTradeRequest(TradeRequest, Integer)</code> helper isolates the DTO mapping logic and keeps the public pipeline readable.',
      'Both dependencies are injected via constructor and the class is annotated with <code>@Service</code> so Spring manages its lifecycle.',
    ],
    code: `package com.aggregator.service;

import com.aggregator.client.CustomerServiceClient;
import com.aggregator.client.StockServiceClient;
import com.aggregator.dto.CustomerInformation;
import com.aggregator.dto.StockTradeRequest;
import com.aggregator.dto.StockTradeResponse;
import com.aggregator.dto.TradeRequest;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

@Service
public class CustomerPortfolioService {

    private final StockServiceClient stockServiceClient;
    private final CustomerServiceClient customerServiceClient;

    public CustomerPortfolioService(StockServiceClient stockServiceClient,
                                    CustomerServiceClient customerServiceClient) {
        this.stockServiceClient = stockServiceClient;
        this.customerServiceClient = customerServiceClient;
    }

    public Mono<CustomerInformation> getCustomerInformation(Integer customerId) {
        return this.customerServiceClient.getCustomerInformation(customerId);
    }

    public Mono<StockTradeResponse> trade(Integer customerId, TradeRequest request) {
        return this.stockServiceClient.getPrice(request.ticker())
                .map(price -> this.toStockTradeRequest(request, price))
                .flatMap(stockTradeRequest ->
                        this.customerServiceClient.trade(customerId, stockTradeRequest));
    }

    private StockTradeRequest toStockTradeRequest(TradeRequest request, Integer price) {
        return new StockTradeRequest(
                request.ticker(),
                price,
                request.quantity(),
                request.action()
        );
    }
}`,
    codeLabel: 'java',
    note: {
      label: 'KEY INSIGHT',
      text: 'The trade pipeline is the textbook reactive-orchestration pattern: a synchronous projection (price → StockTradeRequest) is expressed with .map, but the second hop to customerServiceClient.trade returns a Mono, so a switch between asynchronous streams is required and .flatMap is the only operator that can do that without nesting.',
      tone: 'accent',
    },
    quiz: {
      question: 'In the trade() method, why is .flatMap used for the call to customerServiceClient.trade(...) instead of .map?',
      options: [
        { label: 'Because .map would wrap the resulting Mono<StockTradeResponse> inside another Mono, producing Mono<Mono<StockTradeResponse>>.', correct: true },
        { label: 'Because .map only works on Flux, not Mono.', correct: false },
        { label: 'Because flatMap is the only operator that supports method references.', correct: false },
        { label: 'Because customerServiceClient.trade returns a Flux instead of a Mono.', correct: false },
      ],
      explanation: '.map applies a synchronous function to the emitted value, so passing a function that returns Mono<StockTradeResponse> would yield Mono<Mono<StockTradeResponse>>. .flatMap flattens the inner Mono so the pipeline stays as Mono<StockTradeResponse>, which is what the controller upstream needs to subscribe to.',
    },
  },
  {
    id: '13.21',
    title: 'Exposing Trade Platform APIs',
    duration: '5 min',
    kind: 'demo',
    summary: [
      'This lesson wires up the aggregator\'s HTTP layer by creating two REST controllers that expose the unified trading platform APIs to clients. The goal is for the aggregator to present the same URL surface as the underlying customer and stock microservices, so it can transparently act as the single entry point for the frontend.\n\nThe <code>CustomerPortfolioController</code> handles two endpoints under the <code>/customer</code> base path: a <code>GET /{customerId}</code> that delegates straight to <code>CustomerPortfolioService.getCustomerInformation()</code>, and a <code>POST /{customerId}/trade</code> that takes a <code>Mono&lt;StockTradeRequest&gt;</code>, runs it through the <code>RequestValidator</code> (from lesson 16) using <code>request.transform(RequestValidator::validate)</code>, then chains a <code>flatMap</code> into <code>customerPortfolioService.trade()</code>. The <code>transform</code> + <code>flatMap</code> pattern is important here — validation must run on the request <em>before</em> the service call, and any validation failure propagates as a reactive error that the upcoming <code>@ControllerAdvice</code> (lesson 22) will translate to an HTTP response.\n\nThe <code>StockPriceStreamController</code> is intentionally thinner: it injects <code>StockServiceClient</code> directly and exposes <code>GET /stock/price-stream</code> with <code>produces = MediaType.TEXT_EVENT_STREAM_VALUE</code> (SSE — Server-Sent Events), returning a <code>Flux&lt;PriceUpdate&gt;</code>. The instructor calls out an architectural preference: normally external service clients should be wrapped by a service class, and the controller should only depend on services — not on clients — to keep room for orchestration logic. For the price stream he makes an exception because there is no extra work to do, but he flags that for the trade flow the service layer (<code>CustomerPortfolioService</code>) is the right home for any future cross-service coordination.',
    ],
    keyPoints: [
      '<strong>Aggregator as gateway</strong>: the controller paths (<code>/customer/{id}</code>, <code>/customer/{id}/trade</code>, <code>/stock/price-stream</code>) mirror the downstream services so the aggregator is a drop-in replacement for the frontend.',
      '<strong>Validation placement</strong>: <code>request.transform(RequestValidator::validate)</code> validates <em>before</em> the service call, and <code>flatMap</code> only runs the trade if validation passes — a failed validation becomes a reactive error in the Mono.',
      '<strong>Architectural rule of thumb</strong>: controllers depend on services, services depend on external clients — only skip the service layer for very thin pass-throughs like the SSE price stream.',
      '<strong>SSE content type</strong>: <code>MediaType.TEXT_EVENT_STREAM_VALUE</code> tells Spring to keep the connection open and stream <code>Flux&lt;PriceUpdate&gt;</code> items as SSE events to the browser/client.',
      '<strong>Constructor injection</strong>: both controllers receive their single dependency via constructor — keeping them easy to test and consistent with the rest of the codebase.',
    ],
    code: `package com.example.aggregator.controller;

import com.example.aggregator.dto.CustomerInformation;
import com.example.aggregator.dto.StockTradeRequest;
import com.example.aggregator.dto.StockTradeResponse;
import com.example.aggregator.service.CustomerPortfolioService;
import com.example.aggregator.validator.RequestValidator;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/customer")
public class CustomerPortfolioController {

    private final CustomerPortfolioService customerPortfolioService;

    public CustomerPortfolioController(CustomerPortfolioService customerPortfolioService) {
        this.customerPortfolioService = customerPortfolioService;
    }

    @GetMapping("/{customerId}")
    public Mono<CustomerInformation> getCustomerInformation(@PathVariable Integer customerId) {
        return this.customerPortfolioService.getCustomerInformation(customerId);
    }

    @PostMapping("/{customerId}/trade")
    public Mono<StockTradeResponse> trade(@PathVariable Integer customerId,
                                          @RequestBody Mono<StockTradeRequest> request) {
        return request
                .transform(RequestValidator::validate)
                .flatMap(validatedRequest ->
                        this.customerPortfolioService.trade(customerId, validatedRequest));
    }
}

// ----------------------------------------------------------------------

package com.example.aggregator.controller;

import com.example.aggregator.client.StockServiceClient;
import com.example.aggregator.dto.PriceUpdate;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Flux;

@RestController
@RequestMapping("/stock")
public class StockPriceStreamController {

    private final StockServiceClient stockServiceClient;

    public StockPriceStreamController(StockServiceClient stockServiceClient) {
        this.stockServiceClient = stockServiceClient;
    }

    @GetMapping(value = "/price-stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<PriceUpdate> priceUpdatesStream() {
        return this.stockServiceClient.priceUpdateStream();
    }
}`,
    codeLabel: 'java',
    note: {
      label: 'WHY THIS MATTERS',
      text: 'Keeping the controller paths identical to the underlying microservices means the frontend (or any consumer) can be pointed at the aggregator with zero code changes — the aggregator is a transparent gateway. The trade endpoint also demonstrates the reactive validation pattern: failing input is represented as an error signal in the Mono, which the next lesson\'s @ControllerAdvice will convert into a proper HTTP error response.',
      tone: 'accent',
    },
    quiz: {
      question: 'In CustomerPortfolioController.trade(), why is RequestValidator.validate() applied via request.transform(...) before the flatMap into the service call?',
      options: [
        { label: 'To convert the Mono<StockTradeRequest> into a Mono<CustomerInformation> so the service can accept it.', correct: false },
        { label: 'To run validation on the request Mono first; if validation throws, the Mono completes with an error and the flatMap (and therefore the service call) never executes.', correct: true },
        { label: 'Because Spring\'s @Valid annotation doesn\'t work on Mono request bodies, so the validator is the only way to check input.', correct: false },
        { label: 'To ensure the trade runs only after the customer information GET call completes successfully.', correct: false },
      ],
      explanation: 'request.transform(RequestValidator::validate) operates on the reactive stream itself, so a thrown validation exception becomes an error signal in the Mono. The subsequent flatMap only fires on a successfully validated request, and the @ControllerAdvice introduced in the next lesson will translate that error signal into a 4xx HTTP response — so invalid trades never reach the downstream services.',
    },
  },
  {
    id: '13.22',
    title: 'Aggregator - @ControllerAdvice for Global Error Handling',
    duration: '1 min',
    kind: 'demo',
    summary: [
      'Because the Aggregator is a separate Spring Boot microservice, its <code>@ControllerAdvice</code> lives in its own codebase — it cannot share the one from the Customer Portfolio service. The exception handler from lesson 10 is copied into the <code>aggregator</code> service\'s <code>advice</code> package and then trimmed down: the <code>CustomerNotFoundException</code> handler is deleted (the Aggregator delegates to the Customer service over HTTP rather than calling it in-process, so it never throws that exception directly), and only the <code>InvalidTradeException</code> handler is retained. The Aggregator\'s request validator (lesson 16) throws <code>InvalidTradeException</code> when the incoming trade body is malformed, so this advice converts that into a clean HTTP 400 response.',
    ],
    keyPoints: [
      'Each Spring Boot microservice needs its own <code>@ControllerAdvice</code> because advice beans are scoped to a single application context — they don\'t cross service boundaries.',
      'The Aggregator only needs to handle <code>InvalidTradeException</code> (thrown locally by the request validator) because downstream errors like <code>CustomerNotFoundException</code> come back as 4xx responses from the Customer service and are handled by the WebClient\'s <code>onStatus</code> pipeline.',
      'Using <code>ProblemDetail</code> (RFC 7807) keeps the error response shape consistent with the Customer Portfolio service, so API consumers get a predictable error contract from both services.',
      'The optional custom message shown in the lesson is a minor stylistic choice — <code>ex.getMessage()</code> is sufficient and avoids hardcoding strings in the handler.',
    ],
    code: `package com.aggregator.advice;

import com.aggregator.exception.InvalidTradeException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;

@ControllerAdvice
public class ApplicationExceptionHandler {

    @ExceptionHandler(InvalidTradeException.class)
    public ResponseEntity<ProblemDetail> handleInvalidTradeException(InvalidTradeException ex) {
        ProblemDetail problemDetail = ProblemDetail.forStatusAndDetail(
                HttpStatus.BAD_REQUEST,
                ex.getMessage()
        );
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(problemDetail);
    }
}
`,
    codeLabel: 'java',
    note: {
      label: 'WHY THIS MATTERS',
      text: 'In a microservices architecture, each service owns its own error-translation layer. The Aggregator never throws CustomerNotFoundException itself — that comes back from the Customer service — so its advice is intentionally narrower than the Customer Portfolio\'s.',
      tone: 'accent',
    },
    quiz: {
      question: 'Why does the Aggregator\'s @ControllerAdvice only handle InvalidTradeException and not CustomerNotFoundException?',
      options: [
        { label: 'Because CustomerNotFoundException is caught by WebClient and rethrown as a different type', correct: true },
        { label: 'Because the Aggregator service does not depend on the Customer service', correct: false },
        { label: 'Because Spring only allows one @ExceptionHandler per @ControllerAdvice class', correct: false },
        { label: 'Because InvalidTradeException is the only checked exception in the project', correct: false },
      ],
      explanation: 'The Aggregator calls the Customer service over HTTP via WebClient, so a missing customer surfaces as a 4xx response from the downstream service, not as a locally thrown CustomerNotFoundException. The Aggregator\'s advice only needs to translate the exceptions it throws itself — namely InvalidTradeException from its request validator.',
    },
  },
  {
    id: '13.23',
    title: 'Aggregator - Configuration',
    duration: '3 min',
    kind: 'demo',
    summary: [
      'With the service client classes already in place from the previous lessons, this lesson wires them up as Spring beans so the Aggregator application can autowire and use them. The instructor creates a <code>ServiceClientsConfig</code> class in the <code>config</code> package, annotated with <code>@Configuration</code>, and defines one <code>@Bean</code> method per service client — <code>customerServiceClient</code> and <code>stockServiceClient</code>. Each method receives a base URL string injected from <code>application.properties</code> using <code>@Value("${customer.service.url}")</code> and <code>@Value("${stock.service.url}")</code> respectively.\n\nTo avoid duplicating the <code>WebClient.builder().baseUrl(...).build()</code> call in both bean methods, a private helper method <code>createWebClient(String baseUrl)</code> is extracted. This is a textbook application of the DRY principle — both client beans share the same WebClient construction logic. The instructor also adds a <code>System.out.println</code> for the incoming base URL before the WebClient is created, giving a quick debugging signal at startup to confirm the right URL is being injected from the environment.\n\nThe corresponding <code>application.properties</code> entries point the Aggregator at the two downstream services running on different ports (<code>6060</code> for the Customer Portfolio service and <code>7070</code> for the Stock service). After the application starts cleanly, the lesson pivots toward writing integration tests — the natural next step now that the wiring is complete and verified.',
    ],
    keyPoints: [
      '<code>@Configuration</code> + <code>@Bean</code> methods are the idiomatic way to manually wire service clients that take constructor arguments like a pre-configured <code>WebClient</code>.',
      '<code>@Value("${property.name}")</code> on a <code>@Bean</code> method parameter injects externalized configuration from <code>application.properties</code>, keeping environment-specific URLs out of code.',
      'A private helper method <code>createWebClient(String baseUrl)</code> centralizes the <code>WebClient</code> construction so both client beans reuse the same setup logic instead of duplicating it.',
      'Logging the resolved base URL at startup is a cheap debugging aid — it confirms property resolution and the target environment at a glance.',
      '<strong>application.properties</strong> binds the Aggregator to the Customer service at port <code>6060</code> and the Stock service at port <code>7070</code>; update these to match your local environment.',
    ],
    code: `package com.example.aggregator.config;

import com.example.aggregator.client.CustomerServiceClient;
import com.example.aggregator.client.StockServiceClient;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.reactive.function.client.WebClient;

@Configuration
public class ServiceClientsConfig {

    @Bean
    public CustomerServiceClient customerServiceClient(
            @Value("\${customer.service.url}") String baseUrl) {
        System.out.println("Customer Service Base URL: " + baseUrl);
        return new CustomerServiceClient(createWebClient(baseUrl));
    }

    @Bean
    public StockServiceClient stockServiceClient(
            @Value("\${stock.service.url}") String baseUrl) {
        System.out.println("Stock Service Base URL: " + baseUrl);
        return new StockServiceClient(createWebClient(baseUrl));
    }

    private WebClient createWebClient(String baseUrl) {
        return WebClient.builder()
                .baseUrl(baseUrl)
                .build();
    }
}

// resources/application.properties
// customer.service.url=http://localhost:6060
// stock.service.url=http://localhost:7070`,
    codeLabel: 'java',
    note: {
      label: 'WHY THIS MATTERS',
      text: 'The Aggregator is a pure orchestrator — it owns no business state and calls the Customer and Stock services over HTTP. Exposing the service clients as Spring beans here means every component (controllers, portfolio service) can simply @Autowire them without knowing how the WebClient was constructed or where the URLs came from.',
      tone: 'accent',
    },
    quiz: {
      question: 'Why does the instructor extract a private createWebClient(String baseUrl) helper instead of inlining WebClient.builder().baseUrl(...) inside each @Bean method?',
      options: [
        { label: 'Because Spring requires WebClient beans to be created in a private method.', correct: false },
        { label: 'To keep the configuration DRY — both client beans share the same WebClient construction logic, avoiding duplication and making future changes (e.g. adding common filters) a single-line edit.', correct: true },
        { label: 'Because @Value cannot be used on @Bean method parameters without a helper.', correct: false },
        { label: 'Because WebClient is a final class and must be wrapped.', correct: false },
      ],
      explanation: 'Extracting createWebClient is a DRY (Don\'t Repeat Yourself) refactor. Both CustomerServiceClient and StockServiceClient need a WebClient pointed at their respective base URLs, so the builder call is shared. If you later needed to add a common header filter, a timeout, or an exchange filter function, you would change it in one place. The other options are incorrect: @Value works fine on @Bean parameters, WebClient is not final, and Spring imposes no such requirement on private helper methods.',
    },
  },
  {
    id: '13.24',
    title: 'MockServer - Introduction',
    duration: '6 min',
    kind: 'theory',
    summary: [
      'The next set of lessons will focus on writing integration tests for the <code>aggregator</code> service, which depends on two external services — <code>customer-service</code> and <code>stock-service</code>. Unlike the customer portfolio tests (which talked to a real H2 database), aggregator tests cannot assume those two services are running. The solution is to mock the downstream services so the aggregator can be tested in isolation, using <code>WebTestClient</code> to send requests and verify responses against whatever the mock returns.',
      'MockServer (<a href="https://www.mock-server.com">mock-server.com</a>) is the tool chosen for this job. It is not a reactive-specific tool — it is a generic HTTP mocking library, so the same patterns used for Spring MVC mocking apply here. It allows you to start a server on a free port, define expectations (request matchers + responses), and simulate a wide range of behaviors including path parameters, query parameters, cookies, delays, connection drops, and error codes.',
      'For Spring Boot integration tests, MockServer integrates via a <code>Spring TestExecutionListener</code>. You add the dependency to <code>pom.xml</code>, annotate your test class with <code>@MockServerTest</code>, and a <code>MockServerClient</code> bean is automatically injected — no <code>@Autowired</code> or constructor injection needed. The server starts on a random free port, and that port is exposed as the property <code>mockServerPort</code> so the application under test can be configured to call it.',
      'The core API for writing expectations is <code>mockServerClient.when(request()).respond(response())</code>. The request matcher can match by HTTP method, path (literal or regex), query parameters, headers, cookies, or body. If no expectation matches, MockServer returns a 404 by default. Expectations can also simulate non-happy-path scenarios — e.g., 10-second delays to mimic a slow upstream, or dropped connections — which makes it useful for testing resilience and timeout behavior, not just the golden path.',
    ],
    keyPoints: [
      '<strong>Why MockServer is needed:</strong> The aggregator calls two downstream services (<code>customer-service</code>, <code>stock-service</code>). Keeping them running during tests is impractical, so they are replaced with a single MockServer instance that simulates both.',
      '<strong>Generic, not reactive:</strong> MockServer is an HTTP-level mocking tool. Whatever you used for Spring MVC mocking can be reused here — no special reactive APIs to learn.',
      '<strong>Spring Boot integration:</strong> Add the <code>mockserver-spring-test</code> dependency, annotate the test class with <code>@MockServerTest</code>, and a <code>MockServerClient</code> is auto-injected. No <code>@Autowired</code> required.',
      '<strong>Random free port:</strong> The mock listens on a free port; read it via the <code>mockServerPort</code> property and inject it into the application\'s base URL so it talks to the mock instead of the real services.',
      '<strong>Expectations API:</strong> <code>client.when(request()).respond(response())</code> — the request matcher can match on method, path (including regex), query params, headers, cookies, and body. Unmatched requests get 404 by default.',
      '<strong>Beyond happy-path:</strong> MockServer can simulate delays, connection drops, and error responses, making it useful for testing timeouts, retries, and error handling in addition to normal flows.',
    ],
    code: `<!-- pom.xml -->
<dependency>
    <groupId>org.mock-server</groupId>
    <artifactId>mockserver-spring-test</artifactId>
    <version>5.15.0</version>
    <scope>test</scope>
</dependency>

// Example test class — MockServerClient is auto-injected, no @Autowired needed
@MockServerTest
class CustomerPortfolioIT {

    @Autowired
    private WebTestClient webTestClient;

    // MockServerClient is injected automatically by the @MockServerTest listener;
    // access the random port via the \`mockServerPort\` property when needed.
}`,
    codeLabel: 'java',
    note: {
      label: 'WHY THIS MATTERS',
      text: 'Integration tests for the aggregator cannot depend on real downstream services being up — that\'s slow, flaky, and requires network access. MockServer gives you a deterministic, in-process stand-in so each test controls exactly what customer-service and stock-service return.',
      tone: 'accent',
    },
    quiz: {
      question: 'When using @MockServerTest in a Spring Boot integration test, how is the MockServerClient instance made available to the test class?',
      options: [
        { label: 'It is injected automatically by the Spring TestExecutionListener — no @Autowired or constructor injection required.', correct: true },
        { label: 'You must declare a @Bean of type MockServerClient in a @TestConfiguration class.', correct: false },
        { label: 'You call MockServerClient.startClient(port) manually in a @BeforeEach method.', correct: false },
        { label: 'It is provided as a static field on the MockServer class and must be referenced statically.', correct: false },
      ],
      explanation: 'The @MockServerTest annotation registers a Spring TestExecutionListener that starts a MockServer on a free port and registers a MockServerClient bean in the application context. The bean is injected like any other Spring bean — the instructor emphasizes that no @Autowired is technically needed, though in practice Spring will still resolve the dependency automatically. The key point is that the listener, not your test code, is responsible for lifecycle management.',
    },
  },
  {
    id: '13.25',
    title: '[Aggregator] - Integration Test - Setup',
    duration: '3 min',
    kind: 'setup',
    summary: [
      'The Aggregator service depends on two external services — customer-service and stock-service. For integration tests we cannot rely on those services being available, so we substitute them with a single MockServer instance that runs on a random port. This lesson lays the scaffolding that every Aggregator integration test in this section will extend.',
      'The first step is adding the MockServer Spring Test dependency to <code>pom.xml</code>. The <code>mockserver-spring-test</code> library provides the <code>@MockServerTest</code> annotation, which automatically boots a MockServer before the Spring context starts, captures the assigned port in the <code>mockServerPort</code> property, and makes a <code>MockServerClient</code> available for expectation setup.',
      'We create an abstract base class <code>AbstractIntegrationTest</code> in the <code>com.vins.guru.aggregator.test</code> package. It is annotated with <code>@SpringBootTest</code> (to bootstrap the full application context), <code>@AutoConfigureWebTestClient</code> (to inject a <code>WebTestClient</code> for calling our reactive endpoints), and <code>@MockServerTest</code> (to start the embedded mock server). Two <code>protected</code> fields — <code>MockServerClient</code> and <code>WebTestClient</code> — are exposed so concrete test classes can both configure stubs and exercise the API.',
      'Finally, the base class overrides the <code>customer.service.url</code> and <code>stock.service.url</code> properties that the Aggregator\'s <code>WebClient</code> builders use at startup. Instead of pointing at the real <code>6060</code>/<code>7070</code> ports, both URLs are redirected to <code>http://localhost:${mockServerPort}</code>. This ensures every outbound call the Aggregator makes during a test lands on the embedded MockServer, which the test itself controls — giving us fully isolated, deterministic integration tests.',
    ],
    keyPoints: [
      '<strong>External service isolation:</strong> Integration tests for the Aggregator must not depend on the real customer-service or stock-service being up — MockServer replaces both.',
      '<strong><code>@MockServerTest</code>:</strong> Auto-configures a MockServer, exposes its port via the <code>mockServerPort</code> property, and wires a <code>MockServerClient</code> for stub setup.',
      '<strong>Abstract base class pattern:</strong> <code>AbstractIntegrationTest</code> centralizes the <code>@SpringBootTest</code>, <code>@AutoConfigureWebTestClient</code>, and <code>@MockServerTest</code> setup so individual test classes stay focused on scenario logic.',
      '<strong>Property redirection:</strong> <code>customer.service.url</code> and <code>stock.service.url</code> are overridden to <code>http://localhost:${mockServerPort}</code> so all reactive <code>WebClient</code> calls hit the embedded mock instead of real services.',
      '<strong><code>protected</code> fields:</strong> <code>mockServerClient</code> (for setting <code>.expect()</code> / <code>.when()</code> stubs) and <code>client</code> (for <code>WebTestClient</code> request assertions) are inherited by every concrete test.',
    ],
    code: `package com.vins.guru.aggregator.test;

import org.mockserver.client.MockServerClient;
import org.mockserver.springtest.MockServerTest;
import org.springframework.boot.test.autoconfigure.web.reactive.AutoConfigureWebTestClient;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.reactive.server.WebTestClient;

@SpringBootTest(properties = {
        "customer.service.url=http://localhost:\${mockServerPort}",
        "stock.service.url=http://localhost:\${mockServerPort}"
})
@AutoConfigureWebTestClient
@MockServerTest
public abstract class AbstractIntegrationTest {

    protected MockServerClient mockServerClient;
    protected WebTestClient client;
}`,
    codeLabel: 'java',
    note: {
      label: 'WHY THIS MATTERS',
      text: 'By funnelling both downstream URLs through ${mockServerPort}, a single MockServer instance can impersonate both customer-service and stock-service — keeping the Aggregator\'s WebClient builders untouched while tests remain fully deterministic and offline.',
      tone: 'accent',
    },
    quiz: {
      question: 'Why are customer.service.url and stock.service.url both set to http://localhost:${mockServerPort} in AbstractIntegrationTest?',
      options: [
        { label: 'To share the MockServer between multiple test classes', correct: false },
        { label: 'To make the Aggregator\'s WebClient call a single embedded MockServer that the test controls, instead of the real downstream services', correct: true },
        { label: 'Because ${mockServerPort} is the default port MockServer always uses', correct: false },
        { label: 'To enable load balancing between customer-service and stock-service during the test', correct: false },
      ],
      explanation: '${mockServerPort} is the property that @MockServerTest writes with whatever port the embedded MockServer binds to. Pointing both downstream URLs at it lets one MockServer instance answer for both services, isolating the Aggregator from any real infrastructure during tests.',
    },
  },
  {
    id: '13.26',
    title: 'Mocking the Customer Service',
    duration: '13 min',
    kind: 'demo',
    summary: [
      'Building on the <code>AbstractIntegrationTest</code> set up in the previous lesson, this lesson focuses on mocking the <strong>Customer Service</strong> so the Aggregator\'s <em>customer information</em> API can be tested in isolation. The instructor creates a dedicated <code>CustomerInformationTest</code> class (rather than cramming every API test into one file) that extends <code>AbstractIntegrationTest</code> and registers a MockServer expectation for the path <code>/customers/1</code>. When the Aggregator\'s <code>WebClient</code> subsequently calls the Customer Service during the test, MockServer intercepts the call and returns a pre-canned response.',
      'The mock is built with <code>MockServerClient</code> and MockServer\'s own <code>HttpRequest</code>/<code>HttpResponse</code> types — <em>not</em> Spring\'s <code>HttpRequest</code> or <code>MediaType</code>. This distinction is a common stumbling block because Spring\'s types are auto-imported in any Spring project. A <code>when(...).respond(...)</code> chain wires the matcher (method + path) to the response (status 200, JSON body, <code>MediaType.APPLICATION_JSON</code>). The test then invokes the Aggregator endpoint through <code>WebTestClient</code> and prints the resulting <code>CustomerInformation</code> DTO to confirm the round-trip works.',
      'The lesson introduces two production-quality refinements. First, <code>ConfigurationProperties.mockServer().disableLogging(true)</code> is added to a <code>@BeforeAll</code> hook in the abstract base class to silence MockServer\'s extremely verbose default output, which prints every received request and matched expectation during each test. Second, hard-coding JSON literals in the test class is replaced with external files under <code>src/test/resources/customer-service/</code>. A <code>customer-information-200.json</code> file (named after the HTTP status it represents) contains the response body, and a <code>resourceToString(...)</code> helper — built on <code>Path</code> + <code>Files.readString(...)</code> — loads the file at test time. The pattern scales naturally: a <code>-404.json</code> variant can be added later for failure scenarios.',
    ],
    keyPoints: [
      'MockServer matches on <code>org.mockserver.model.HttpRequest</code> / <code>HttpResponse</code> — not Spring\'s equivalents — and uses its own <code>MediaType</code> class.',
      'A <code>when(request()).respond(response())</code> chain on <code>MockServerClient</code> wires a path matcher (e.g. <code>/customers/1</code>) to a canned response with an explicit status code and <code>Content-Type: application/json</code>.',
      '<code>ConfigurationProperties.mockServer().disableLogging(true)</code> in a <code>@BeforeAll</code> hook silences MockServer\'s per-request trace logs, which are invaluable for debugging but far too noisy to leave on in every test run.',
      'Externalising mock bodies to <code>src/test/resources/&lt;service-name&gt;/&lt;fixture&gt;-&lt;status-code&gt;.json</code> keeps tests readable and makes it trivial to add success/failure variants (e.g. <code>-200.json</code>, <code>-404.json</code>).',
      'A <code>resourceToString(relativePath)</code> helper in the abstract test class uses <code>Path.of("src/test/resources")</code> + <code>Files.readString(...)</code> to load fixture files; relative paths are resolved against the <code>customer-service</code> directory.',
      'Unmocked paths return HTTP 404 from MockServer by default, which propagates through the Aggregator and surfaces as a <code>CustomerNotFoundException</code> — a useful way to validate error handling without writing extra mock expectations.',
    ],
    code: `// === AbstractIntegrationTest (additions) =========================================
// File: aggregator/src/test/java/com/example/aggregator/AbstractIntegrationTest.java

import org.junit.jupiter.api.BeforeAll;
import org.mockserver.configuration.ConfigurationProperties;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.reactive.server.WebTestClient;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
abstract class AbstractIntegrationTest {

    protected static final Path TEST_RESOURCES_PATH = Path.of("src/test/resources");

    protected static WebTestClient client;   // initialised by subclass or @LocalServerPort + WebTestClient.bindToServer()

    @BeforeAll
    static void setup() {
        ConfigurationProperties.mockServer().disableLogging(true);
    }

    /** Loads a JSON fixture from src/test/resources/{relativePath} as a String. */
    protected static String resourceToString(String relativePath) throws IOException {
        return Files.readString(TEST_RESOURCES_PATH.resolve(relativePath));
    }
}


// === CustomerInformationTest ===================================================
// File: aggregator/src/test/java/com/example/aggregator/customer/CustomerInformationTest.java

package com.example.aggregator.customer;

import com.example.aggregator.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.mockserver.client.MockServerClient;
import org.mockserver.model.HttpRequest;
import org.mockserver.model.HttpResponse;
import org.mockserver.model.MediaType;          // NOTE: org.mockserver.model.MediaType, NOT Spring's

class CustomerInformationTest extends AbstractIntegrationTest {

    private final MockServerClient mockServerClient = new MockServerClient("localhost", mockServerPort());

    @Test
    void customerInformation() throws Exception {
        // 1. Register expectation on MockServer
        mockServerClient
            .when(HttpRequest.request().path("/customers/1"))
            .respond(HttpResponse.response()
                .withStatusCode(200)
                .withContentType(MediaType.APPLICATION_JSON)
                .withBody(resourceToString("customer-service/customer-information-200.json")));

        // 2. Call the Aggregator, which will in turn call the (mocked) Customer Service
        client.get().uri("/customers/1")
            .exchange()
            .expectBody()
            .consumeWith(e -> System.out.println(new String(e.getResponseBody())));
    }
}


// === Fixture ====================================================================
// File: aggregator/src/test/resources/customer-service/customer-information-200.json

{
  "id": 1,
  "name": "Sam",
  "balance": 10000,
  "holdings": [
    { "ticker": "", "quantity": 0 }
  ]
}`,
    codeLabel: 'java',
    note: {
      label: 'WARNING',
      text: 'MockServer ships its own <code>HttpRequest</code>, <code>HttpResponse</code> and <code>MediaType</code> classes under <code>org.mockserver.model</code>. Importing Spring\'s <code>MediaType</code> by accident compiles fine but causes the mock to register the wrong content type, and downstream services will reject the response.',
      tone: 'accent',
    },
    quiz: {
      question: 'Why does the instructor move the mock JSON body out of the test class and into a file under src/test/resources?',
      options: [
        { label: 'MockServer cannot read string literals passed to withBody(...).', correct: false },
        { label: 'It keeps the test readable, and the same fixture (e.g. -200.json) can be reused across multiple tests including future failure scenarios like -404.json.', correct: true },
        { label: 'JSON files under src/test/resources are automatically loaded by Spring\'s ObjectMapper.', correct: false },
        { label: 'It is required by the @SpringBootTest annotation to discover test resources.', correct: false },
      ],
      explanation: 'Hard-coding JSON inside the test class makes long bodies unreadable and forces duplication. Externalising fixtures (one file per scenario, named with the status code) keeps tests short and lets a single fixture be reused by multiple tests, while making it trivial to add a failure variant such as customer-information-404.json later.',
    },
  },
  {
    id: '13.27',
    title: '[Aggregator] - Integration Tests - Customer Information API Test',
    duration: '5 min',
    kind: 'demo',
    summary: [
      'For the 404 case, the helper tells MockServer to respond with status 404 and a body loaded from <code>customer-not-found.json</code>, which contains a Spring problem-detail payload with <code>detail: "Customer ID 1 is not found"</code>. The test then asserts <code>$.detail</code> matches that exact string. The lesson also highlights a practical observation: the first test run can appear slow because MockServer is torn down as part of the test lifecycle, so a few hundred milliseconds of shutdown time is normal. The pattern established here is the foundation for the remaining integration tests in the section.',
    ],
    keyPoints: [
      'Two private helpers keep the tests readable: <code>getCustomerInformation(HttpStatus)</code> chains <code>expectStatus()</code> and returns the body content for further JSON-path assertions, and <code>mockCustomerInformation(path, code)</code> configures MockServer for the downstream customer service call.',
      'In full-mocking mode the customer ID can be hard-coded because every test fully controls the downstream response, unlike partial-mocking tests where the ID is part of the input.',
      'Spring\'s <code>WebTestClient</code> supports fluent <code>jsonPath(...)</code> assertions on the returned <code>BodyContentSpec</code>, including <code>.isNotEmpty()</code> for collections like <code>$.holdings</code>.',
      'For error scenarios MockServer can serve a JSON body from a classpath file (e.g. <code>customer-not-found.json</code>) so the test verifies the problem-detail <code>detail</code> field is propagated correctly through the aggregator.',
      'MockServer shutdown at the end of a test can add a few hundred milliseconds, which is expected and not a sign of a real failure.',
    ],
    code: `package com.example.aggregator;

import com.example.aggregator.utils.FileReader;
import org.junit.jupiter.api.Test;
import org.mockserver.client.MockServerClient;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.test.web.reactive.server.WebTestClient;

import static com.example.aggregator.TestUtil.CUSTOMER_ID;
import static org.mockserver.model.HttpResponse.response;
import static org.mockserver.model.RequestDefinitionBuilder.request;

class CustomerInformationTest extends AbstractIntegrationTest {

    @Autowired
    private MockServerClient mockServerClient;

    private static final String AGGREGATOR_PATH = "/customer/" + CUSTOMER_ID;
    private static final String CUSTOMER_SERVICE_PATH = "/customers/" + CUSTOMER_ID;

    @Test
    void customerInformation() {
        // happy path: MockServer returns 200 with the expected customer JSON body
        mockCustomerInformation(CUSTOMER_SERVICE_PATH, 200);

        getCustomerInformation(HttpStatus.OK)
                .jsonPath("$.id").isEqualTo(1)
                .jsonPath("$.name").isEqualTo("Sam")
                .jsonPath("$.balance").isEqualTo(10_000)
                .jsonPath("$.holdings").isNotEmpty();
    }

    @Test
    void customerNotFound() {
        // 404 case: MockServer returns 404 with a problem-detail body loaded from disk
        mockCustomerInformation(CUSTOMER_SERVICE_PATH, 404);

        getCustomerInformation(HttpStatus.NOT_FOUND)
                .jsonPath("$.detail").isEqualTo("Customer ID " + CUSTOMER_ID + " is not found");
    }

    // --- helpers ---

    private WebTestClient.BodyContentSpec getCustomerInformation(HttpStatus expectedStatus) {
        return webTestClient.get()
                .uri(AGGREGATOR_PATH)
                .exchange()
                .expectStatus().isEqualTo(expectedStatus)
                .expectBody();
    }

    private void mockCustomerInformation(String path, int responseCode) {
        mockServerClient
                .when(request().withPath(path))
                .respond(response()
                        .withStatusCode(responseCode)
                        .withBody(FileReader.read("json/customer-not-found.json")));
    }
}`,
    codeLabel: 'java',
    note: {
      label: 'KEY INSIGHT',
      text: 'Because this test class is fully mocking the downstream customer service, the customer ID is a constant rather than a test parameter, so a single helper that returns a `WebTestClient.BodyContentSpec` can be reused across every test in the class — JSON-path assertions are simply chained on its return value.',
      tone: 'accent',
    },
    quiz: {
      question: 'In the aggregator integration test, why does the helper `getCustomerInformation(HttpStatus expectedStatus)` not take a customer ID parameter?',
      options: [
        { label: 'Because Java\'s type system cannot pass an int through a generic method.', correct: false },
        { label: 'Because the test is full-mocking the downstream customer service, so a single hard-coded customer id (1) is sufficient for every test.', correct: true },
        { label: 'Because WebTestClient does not support variable URIs.', correct: false },
        { label: 'Because the customer service rejects any id other than 1.', correct: false },
      ],
      explanation: 'Full-mocking means MockServer is programmed to return whatever response the test wants, so there is no need to vary the customer id per test. A single id (1) is used, and the helper method is therefore simpler and reusable across both the 200 and 404 test cases.',
    },
  },
  {
    id: '13.28',
    title: 'Integration Tests - Stock Service Stream API Test',
    duration: '4 min',
    kind: 'demo',
    summary: [
      'This lesson adds an integration test for the aggregator\'s stock price streaming endpoint. Building on the <code>AbstractIntegrationTest</code> base and the <code>WebTestClient</code> set up in lesson 13.25, the instructor creates a new test class <code>StockPriceStreamTest</code> that mocks the downstream stock service using <code>MockServer</code> (introduced in lesson 13.24) and validates the streamed <code>PriceUpdate</code> events emitted by the aggregator.',
      'The mock response is stored as a JSON Lines (NDJSON) file at <code>src/test/resources/stock-service/stock-price-stream-200.jsonl</code>. Because each line of the file is a self-contained JSON object representing a single <code>PriceUpdate</code> event, MockServer streams them to the aggregator one by one — simulating the real stock service pushing price ticks. Example file content: <code>{"ticker":"AMZN","price":53,"time":"2022-01-01T12:00:01"}</code> on line 1, <code>...,"price":54,"time":"2022-01-01T12:00:02"}</code> on line 2, and <code>...,"price":55,"time":"2022-01-01T12:00:03"}</code> on line 3. The response content type is set to <code>application/x-ndjson</code> (Spring\'s <code>MediaType.APPLICATION_NDJSON</code>) — NOT <code>application/json</code>, since the response is a stream of JSON objects separated by newlines rather than a single JSON array.',
      'On the test side, the request is made with <code>accept(MediaType.TEXT_EVENT_STREAM)</code> (SSE) because the aggregator wraps the upstream stream as Server-Sent Events. Because the response is a stream, the test cannot use <code>expectBody</code>; instead, it calls <code>.returnResult(PriceUpdate.class).getResponseBody()</code> to obtain a <code>Flux&lt;PriceUpdate&gt;</code>. A <code>doOnNext</code> logs each price update for visibility, and <code>StepVerifier</code> is used to assert that the three emitted prices are exactly 53, 54, and 55 in order, ending with <code>verifyComplete()</code>. The same <code>priceStream</code> path used in production is hit on the aggregator, demonstrating that the full chain (aggregator → stock client → mocked upstream) is exercised end-to-end.',
    ],
    keyPoints: [
      '<strong>JSON Lines (NDJSON)</strong> mock files let MockServer simulate a streaming source — one JSON object per line, no commas between lines.',
      'The mock <strong>content type</strong> must be <code>application/x-ndjson</code> (Spring\'s <code>MediaType.APPLICATION_NDJSON</code>) for streaming, not <code>application/json</code>.',
      'For streaming responses, use <code>returnResult(T.class).getResponseBody()</code> to obtain a <code>Flux&lt;T&gt;</code> instead of <code>expectBody()</code>.',
      'The <strong>client request</strong> sets <code>Accept: text/event-stream</code> (SSE) because the aggregator exposes price updates as Server-Sent Events.',
      '<code>StepVerifier</code> with chained <code>assertNext</code> calls is the idiomatic way to assert ordered reactive emissions, terminated by <code>verifyComplete()</code>.',
    ],
    code: `package com.example.aggregator;

import org.junit.jupiter.api.Test;
import org.mockserver.model.HttpRequest;
import org.mockserver.model.HttpResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.MediaType;
import org.springframework.test.web.reactive.server.WebTestClient;
import reactor.test.StepVerifier;

import static org.junit.jupiter.api.Assertions.assertEquals;

class StockPriceStreamTest extends AbstractIntegrationTest {

    private static final Logger log = LoggerFactory.getLogger(StockPriceStreamTest.class);

    @Autowired
    private WebTestClient client;

    @Test
    void priceStream() {
        // Load the NDJSON mock body from test resources
        var responseBody = new ClassPathResource("stock-service/stock-price-stream-200.jsonl");

        // Mock the downstream stock-service endpoint
        mockServerClient
            .when(HttpRequest.request().withPath("/stock-price-stream"))
            .respond(HttpResponse.response(responseBody)
                .withStatusCode(200)
                .withContentType(MediaType.APPLICATION_NDJSON));   // application/x-ndjson

        // Call the aggregator's stock-price-stream endpoint as SSE
        client.get()
            .uri("/stock-price-stream")
            .accept(MediaType.TEXT_EVENT_STREAM)                    // text/event-stream
            .exchange()
            .expectStatus().is2xxSuccessful()
            .returnResult(PriceUpdate.class)                       // streaming response → Flux<PriceUpdate>
            .getResponseBody()
            .doOnNext(price -> log.info("received price: {}", price))
            .as(StepVerifier::create)
            .assertNext(price -> assertEquals(53, price.price()))
            .assertNext(price -> assertEquals(54, price.price()))
            .assertNext(price -> assertEquals(55, price.price()))
            .verifyComplete();
    }
}
`,
    codeLabel: 'java',
    note: {
      label: 'KEY INSIGHT',
      text: 'Because the response is a continuous stream, WebTestClient\'s standard expectBody() cannot be used — returnResult(T.class).getResponseBody() hands back a Flux<T> that you can then drive with StepVerifier, the standard tool for asserting ordered reactive emissions.',
      tone: 'accent',
    },
    quiz: {
      question: 'Why is the mock response content type set to application/x-ndjson instead of application/json?',
      options: [
        { label: 'Because MockServer rejects application/json for any streaming endpoint.', correct: false },
        { label: 'Because the response is a stream of newline-delimited JSON objects, not a single JSON document, and the aggregator/server expects this media type for SSE-style price ticks.', correct: true },
        { label: 'Because Spring\'s WebClient cannot decode application/json responses.', correct: false },
        { label: 'Because NDJSON compresses better than regular JSON.', correct: false },
      ],
      explanation: 'NDJSON (application/x-ndjson) is the standard media type for streams where each line is an independent JSON object. The aggregator forwards each price update as soon as it arrives from the upstream service, so the wire format is line-delimited, not a single JSON array. Setting application/json would imply a complete, parseable JSON document and is incorrect for streaming.',
    },
  },
  {
    id: '13.29',
    title: '[Aggregator] - Integration Tests - Customer Trade API Test',
    duration: '18 min',
    kind: 'demo',
    summary: [
      'This lesson extends the Aggregator integration test suite with coverage for the trade endpoint. The test class builds on the MockServer-based harness established in lessons 27 and 28, so the WebTestClient, MockServerClient, and file-reading helpers are already wired in. The trade flow is more interesting than the read-only customer information flow because the Aggregator must call the Stock Service to fetch a price and then forward that exact price to the Customer Service — and the test needs to prove the price is actually forwarded correctly, not silently dropped or replaced.',
      'The success test (`tradeSuccess`) follows the same pattern used earlier: a `mockCustomerTrade` helper accepts a resource path and a status code, then wires up a MockServer expectation for `POST /customers/{customerId}/trade`. The key new technique is using MockServer\'s `regex()` body matcher to assert that the body sent by the Aggregator contains the price returned by the Stock Service. The instructor writes a regex that matches anywhere in the JSON body — `.*"price":110.*` — so the test fails if the Aggregator forgets to pass through the stock price. A 200 JSON body is then returned for the customer response, and the test asserts via JSON path that fields like `balance` and `totalPrice` are forwarded back to the caller.',
      'The failure test (`tradeFailure`) reuses `mockCustomerTrade` with status 400 and a problem-detail JSON body. The Aggregator is expected to propagate the 400 and the detail message unchanged. Finally, three input-validation tests exercise the Aggregator\'s own validator from lesson 16 — missing ticker, missing action, and negative quantity — and confirm that the Aggregator returns 400 with the appropriate validation message. These cases do not need any MockServer expectations because validation happens in the Aggregator before any downstream call.',
      'The instructor intentionally skips buy/sell distinction and quantity adjustments in the Aggregator (those are handled by the Customer Portfolio service), so the test does not parameterize on action. The lesson closes by running the full test suite and pointing out that additional cases (such as a 404 from the downstream service) could be added following the same pattern.',
    ],
    keyPoints: [
      '<strong>MockServer <code>regex()</code> body matcher</strong> is used to assert that the Aggregator forwards the stock price into the customer trade request — this catches the subtle bug of the Aggregator sending <code>price: 0</code> instead of the real price.',
      'A reusable <code>mockCustomerTrade(path, statusCode)</code> helper keeps the test class readable and lets the success and failure tests share the same expectation setup with only the path and status code changing.',
      'The aggregator\'s trade endpoint calls <strong>Stock Service first, then Customer Service</strong>, so both downstream services must be mocked, but the Stock Service mock is identical between success and failure cases — only the Customer Service mock changes.',
      'Input-validation tests do not need any MockServer expectations because validation runs in the Aggregator before any downstream call is made.',
      '<strong>Buy/sell/quantity</strong> transformations live in the Customer Portfolio service, not the Aggregator, so the trade test only needs to verify that the correct price is forwarded — not how the trade is ultimately applied.',
    ],
    code: `package com.aggregator.integration;

import com.aggregator.domain.Ticker;
import com.aggregator.domain.TradeAction;
import com.aggregator.dto.TradeRequest;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import reactor.test.StepVerifier;

class CustomerTradeTest extends AbstractIntegrationTest {

    // ... (WebTestClient, MockServerClient, and resource-loading helpers from lesson 27)

    // Helper: POST /customers/{customerId}/trade and return the response spec
    private ResponseSpec sendTrade(TradeRequest tradeRequest, HttpStatus expectedStatus) {
        return this.webTestClient
                .post()
                .uri("/customers/{customerId}/trade", 1)
                .bodyValue(tradeRequest)
                .exchange()
                .expectStatus().isEqualTo(expectedStatus);
    }

    // Helper: mock the Customer Service /customers/{customerId}/trade endpoint
    private void mockCustomerTrade(String responseFile, int responseCode) {
        String responseBody = readResource("classpath:mock/" + responseFile);
        mockServerClient
                .when(
                    org.mockserver.model.HttpRequest.request()
                            .withMethod("POST")
                            .withPath("/customers/1/trade")
                            .withBody(org.mockserver.matchers.MatchType.ONLY_MATCHING_FIELDS,
                                    org.mockserver.model.JsonBody.json("{}"))
                )
                .respond(
                    org.mockserver.model.HttpResponse.response(responseBody)
                            .withStatusCode(responseCode)
                            .withContentType(MediaType.APPLICATION_JSON)
                );
    }

    @Test
    void tradeSuccess() {
        // 1. Mock Stock Service: GET /stock/GOOG -> 200 with price 110
        String stockResponseBody = readResource("classpath:mock/stock-price-200.json");
        mockServerClient
                .when(
                    org.mockserver.model.HttpRequest.request()
                            .withMethod("GET")
                            .withPath("/stock/GOOG")
                )
                .respond(
                    org.mockserver.model.HttpResponse.response(stockResponseBody)
                            .withStatusCode(200)
                            .withContentType(MediaType.APPLICATION_JSON)
                );

        // 2. Mock Customer Service: POST /customers/1/trade must contain "price":110 in the body
        String customerResponseBody = readResource("classpath:mock/customer-trade-200.json");
        mockServerClient
                .when(
                    org.mockserver.model.HttpRequest.request()
                            .withMethod("POST")
                            .withPath("/customers/1/trade")
                            .withBody(".*\"price\":110.*")      // <-- regex verifies the price is forwarded
                )
                .respond(
                    org.mockserver.model.HttpResponse.response(customerResponseBody)
                            .withStatusCode(200)
                            .withContentType(MediaType.APPLICATION_JSON)
                );

        // 3. Send the trade request through the Aggregator
        TradeRequest tradeRequest = new TradeRequest(Ticker.GOOG, TradeAction.BUY, 2);

        sendTrade(tradeRequest, HttpStatus.OK)
                .expectBody()
                .jsonPath("$.balance").isEqualTo(9780)
                .jsonPath("$.totalPrice").isEqualTo(220);
    }

    @Test
    void tradeFailure() {
        // Stock Service mock is unchanged (always 200 / price 110)
        // ... (same stock mock as tradeSuccess)

        // Customer Service returns 400 with a problem detail
        mockCustomerTrade("customer-trade-400.json", 400);

        TradeRequest tradeRequest = new TradeRequest(Ticker.GOOG, TradeAction.BUY, 2);

        sendTrade(tradeRequest, HttpStatus.BAD_REQUEST)
                .expectBody()
                .jsonPath("$.detail").isEqualTo("Customer does not have enough balance for the trade");
    }

    // --- Input validation tests (no MockServer expectations needed) ---

    @Test
    void missingTicker() {
        TradeRequest tradeRequest = new TradeRequest(null, TradeAction.BUY, 2);
        sendTrade(tradeRequest, HttpStatus.BAD_REQUEST)
                .expectBody()
                .jsonPath("$.detail").isEqualTo("ticker is required");
    }

    @Test
    void missingAction() {
        TradeRequest tradeRequest = new TradeRequest(Ticker.GOOG, null, 2);
        sendTrade(tradeRequest, HttpStatus.BAD_REQUEST)
                .expectBody()
                .jsonPath("$.detail").isEqualTo("trade action is required");
    }

    @Test
    void invalidQuantity() {
        TradeRequest tradeRequest = new TradeRequest(Ticker.GOOG, TradeAction.BUY, -2);
        sendTrade(tradeRequest, HttpStatus.BAD_REQUEST)
                .expectBody()
                .jsonPath("$.detail").isEqualTo("quantity should be positive");
    }
}`,
    codeLabel: 'java',
    note: {
      label: 'KEY INSIGHT',
      text: 'The <code>regex()</code> body matcher in MockServer is the only way to verify that the Aggregator correctly forwards the price from the Stock Service into the Customer Service request — without it, a bug that hard-codes <code>price: 0</code> would silently pass the test.',
      tone: 'accent',
    },
    quiz: {
      question: 'Your aggregator forwards the stock price into the customer trade request. Which MockServer feature lets you assert that the price value is actually present in the body sent to the customer service?',
      options: [
        { label: 'Exact string match with body()', correct: false },
        { label: 'MatchType.STRICT with a full JSON literal', correct: false },
        { label: 'regex() body matcher with a pattern like .*"price":110.*', correct: true },
        { label: 'MatchType.ONLY_MATCHING_FIELDS on the request body', correct: false },
      ],
      explanation: 'The regex() body matcher lets you assert a partial pattern in the JSON body, so you can verify that a specific field/value combination is present (e.g., "price":110) without hard-coding the entire request body. Exact matches and STRICT mode would require knowing the full body, and ONLY_MATCHING_FIELDS checks structural shape rather than specific values.',
    },
  },
  {
    id: '13.30',
    title: 'End-to-End Demo via Postman',
    duration: '6 min',
    kind: 'demo',
    summary: [
      'This final demo brings the entire reactive microservices project to life by exercising the aggregator service through Postman. Three services are started before testing: the customer service on port 6060, the external (stock) service on port 7070, and the aggregator service on port 8080. The aggregator acts as the single client-facing entry point, so every request from Postman targets <code>localhost:8080</code>, while cross-service calls (aggregator → customer, aggregator → stock) happen transparently behind the scenes.',
      'The demo walks through several scenarios in sequence. <strong>Customer information lookup</strong> returns Sam with a starting balance of $10,000 and empty holdings; an unknown ID returns a 404 with a problem-detail body. <strong>Trade validation</strong> is exercised in both layers: a sell with quantity <code>-1</code> is rejected immediately by the aggregator\'s request validator (using the Bean Validation logic from lesson 16), while a valid-shaped sell that the customer has no holdings to satisfy is rejected by the customer service with a domain-specific error message. <strong>Fund and holding checks</strong> are confirmed by attempting a buy that exceeds the available balance ("customer does not have enough funds").',
      'A successful buy of 10 Google shares at price $122 updates both the holdings and the balance. Subsequent buys (2 more Google, then 5 Apple) reflect in the customer information response, and the price per share visibly changes between calls — proof that the aggregator is fetching a fresh price from the stock service for every trade. The sell path is tested symmetrically: attempting to sell 20 shares when only 12 are held is rejected, then selling 6 succeeds and raises the balance, and selling the remaining 6 returns the customer to a zero Google holding. By the end, Sam\'s balance has grown by $145 from the starting $10,000, demonstrating the full buy/sell round-trip across the reactive stack.',
      'Finally, the price stream is verified directly in a browser (or via curl) by hitting <code>http://localhost:8080/start/price/stream</code>. The streaming response delivers a continuous feed of price updates from the external stock service, confirming that the hot publisher from lesson 18 is wired through the aggregator and exposed correctly to clients. Together, these tests validate the complete end-to-end flow: validation, reactive client calls, persistence via R2DBC, error propagation through <code>@ControllerAdvice</code>, and SSE-based streaming.',
    ],
    keyPoints: [
      '<strong>Start order matters:</strong> external/stock service → customer service (6060) → aggregator (8080) so all dependencies are available.',
      '<strong>Aggregator is the single entry point:</strong> every Postman call goes to <code>localhost:8080</code>; the aggregator fans out to the customer and stock services reactively.',
      '<strong>Two-layer validation:</strong> shape/syntactic checks (e.g., negative quantity) fail at the aggregator; business-rule checks (insufficient holdings/funds) fail at the customer service and are mapped to proper HTTP responses via <code>@ControllerAdvice</code>.',
      '<strong>Fresh prices per trade:</strong> the buy/sell flow calls the stock service each time, so the price visible in responses can change between requests — expected behaviour, not a bug.',
      '<strong>Price stream endpoint</strong> <code>GET /start/price/stream</code> returns an SSE stream of price updates and can be verified with a browser or <code>curl</code>.',
      '<strong>Add logging liberally</strong> when running the system locally — the instructor recommends scattering log statements across services to make cross-service debugging tractable.',
    ],
    code: `curl http://localhost:8080/start/price/stream`,
    codeLabel: 'terminal',
    note: {
      label: 'WHY THIS MATTERS',
      text: 'This is the single end-to-end sanity check that proves every layer — validation, reactive webclient calls, R2DBC persistence, error mapping, and SSE streaming — is wired correctly. If any of the 30 lessons in the section has a wiring bug, it surfaces here.',
      tone: 'accent',
    },
    quiz: {
      question: 'When you POST a trade request with a negative quantity, which service rejects it first?',
      options: [
        { label: 'The external stock service, because the price is unknown', correct: false },
        { label: 'The customer service, because the holdings check fails', correct: false },
        { label: 'The aggregator service, via its request validator (Bean Validation)', correct: true },
        { label: 'The database, via a CHECK constraint', correct: false },
      ],
      explanation: 'Negative quantity is a syntactic/shape violation handled by the aggregator\'s request validator (lesson 16) before the request ever reaches the customer service. Domain violations like \'not enough holdings\' or \'not enough funds\' are caught by the customer service and mapped to errors by @ControllerAdvice.',
    },
  },
]
