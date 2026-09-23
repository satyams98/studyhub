export default [
  {
    id: '5.1',
    title: 'Reactive CRUD APIs - Introduction',
    duration: '3 min',
    kind: 'theory',
    summary: [
      'This section focuses on building reactive CRUD REST APIs using Spring WebFlux on top of an existing <code>Customer</code> entity and repository. The APIs to be exposed include: get all customers, get customer by ID, create customer, update customer by ID, and delete customer by ID. When a requested ID is not present, the APIs will return appropriate HTTP error responses such as <code>404 Not Found</code> or <code>400 Bad Request</code>.',
      'The section deliberately scopes out error handling and input validation — those topics are covered in a later section. This keeps the learning progression incremental: first master the reactive CRUD flow end-to-end, then layer on validation and exception handling.',
      'To set up the project structure, a new package <code>com.winsgroup.playground.section03</code> is created with sub-packages for <code>controller</code>, <code>dto</code>, <code>entity</code>, <code>mapper</code>, <code>repository</code>, and <code>service</code>. The <code>Customer</code> entity and <code>CustomerRepository</code> from a previous section are copied into the new <code>entity</code> and <code>repository</code> packages respectively, with all package references updated to point to <code>section03</code> instead of the original section.',
    ],
    keyPoints: [
      'Expose reactive CRUD endpoints for <code>Customer</code>: GET all, GET by ID, POST create, PUT update by ID, DELETE by ID',
      'Project structure uses <code>com.winsgroup.playground.section03</code> with sub-packages: <code>controller</code>, <code>dto</code>, <code>entity</code>, <code>mapper</code>, <code>repository</code>, <code>service</code>',
      'Entity and repository are reused from a prior section — copy them into <code>section03</code> and update all package references',
      'Error handling and input validation are intentionally deferred to a later section for incremental learning',
      'When an entity ID is not found, return <code>404 Not Found</code> or <code>400 Bad Request</code> using <code>ResponseEntity</code>',
    ],
    code: `package com.winsgroup.playground.section03.entity;

import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Table;

@Table(name = "customer")
public class Customer {

    @Id
    private Integer id;
    private String name;
    private String email;

    public Customer() {
    }

    public Customer(Integer id, String name, String email) {
        this.id = id;
        this.name = name;
        this.email = email;
    }

    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }
}`,
    codeLabel: 'java',
    note: {
      label: 'WHY THIS MATTERS',
      text: 'Reusing the entity and repository from a prior section lets us focus entirely on the reactive service and controller layers. Copying them into a new package avoids cross-section coupling and keeps each section self-contained.',
      tone: 'accent',
    },
    quiz: {
      question: 'Why are error handling and input validation deliberately excluded from this section\'s CRUD APIs?',
      options: [
        { label: 'They are not supported by Spring WebFlux', correct: false },
        { label: 'To keep the learning progression incremental — master reactive CRUD first, then layer on validation and exception handling', correct: true },
        { label: 'Because reactive applications do not need input validation', correct: false },
        { label: 'Because the Customer entity does not have any fields that require validation', correct: false },
      ],
      explanation: 'The instructor explicitly defers error handling and input validation to a later section so learners can focus on the reactive CRUD flow first. This incremental approach avoids overwhelming the reader with too many concerns at once.',
    },
  },
  {
    id: '5.2',
    title: 'FAQ - Do We Need DTOs?',
    duration: '3 min',
    kind: 'faq',
    summary: [
      'A common question when building APIs is why create a DTO (Data Transfer Object) class when it often looks identical to the entity class — isn\'t that a violation of the DRY (Don\'t Repeat Yourself) principle? The short answer is that two classes with similar fields are not necessarily duplicates. A <code>Person</code>, a <code>School</code>, and a <code>Product</code> might all have a <code>name</code> field, but that does not mean one should extend the other. Each class represents a distinct concept with its own purpose and lifecycle.',
      'The entity class represents the <em>database table structure</em> — it maps directly to how data is persisted. The DTO represents the <em>API contract</em> — the data exchanged with clients. These are two separate concerns, and decoupling them provides significant flexibility. For example, a <code>Customer</code> entity might include a <code>password</code> field, but the corresponding DTO should exclude it for security reasons. You might store timestamps in UTC in the database but return local time in the API response.',
      'DTOs also enable API versioning. For the same entity, you can maintain multiple DTOs — a v1 DTO with an <code>email</code> field and a v2 DTO with an <code>emailAddress</code> field — supporting different clients simultaneously without changing the underlying table structure. Additionally, DTOs are the natural place for validation annotations (e.g., <code>@NotNull</code>, <code>@Size</code>) on inbound requests, keeping persistence and API-layer concerns cleanly separated.',
      'Ultimately, using DTOs is about <em>separation of concerns, flexibility, and maintainability</em> — not code reuse. If your use case is trivial and the entity and DTO truly are identical with no security, versioning, or validation concerns, you can skip the DTO. But in most real-world applications, the two diverge quickly.',
    ],
    keyPoints: [
      'An <strong>entity</strong> maps to the database table; a <strong>DTO</strong> maps to the API contract — they serve different purposes even when their fields overlap.',
      'DTOs prevent accidental exposure of sensitive fields (e.g., <code>password</code>) that exist in the entity but should never reach the client.',
      'Multiple DTOs for the same entity enable <strong>API versioning</strong> (e.g., v1 uses <code>email</code>, v2 uses <code>emailAddress</code>) without altering the database schema.',
      'Validation annotations (<code>@NotNull</code>, <code>@Size</code>, etc.) belong on DTOs, keeping input validation separate from persistence mapping.',
      'The principle at work is <strong>separation of concerns</strong>, not DRY — two classes with similar fields are not duplicates if they represent different layers of the application.',
    ],
    note: {
      label: 'WHEN TO USE',
      text: 'Use a DTO whenever your API contract differs from your persistence model — even slightly. If security, versioning, validation, or field transformation are concerns, the DTO earns its place immediately.',
      tone: 'green',
    },
    quiz: {
      question: 'Your Customer entity has fields: id, name, email, password, and createdAt. Your API should return customer data to clients. What is the most appropriate approach?',
      options: [
        { label: 'Return the entity directly — it already has all the fields, so no DTO is needed.', correct: false },
        { label: 'Create a CustomerDTO that excludes the password field and expose only that to clients.', correct: true },
        { label: 'Make the DTO extend the entity class to avoid duplicating fields.', correct: false },
        { label: 'Add @JsonIgnore to the password field on the entity and return the entity directly.', correct: false },
      ],
      explanation: 'A DTO that excludes the password field cleanly separates the API contract from the persistence model. Extending the entity couples the two layers and still exposes all fields. Using @JsonIgnore on the entity is a fragile workaround — it ties serialization concerns to the persistence layer and risks accidental exposure if the annotation is removed or bypassed.',
    },
  },
  {
    id: '5.3',
    title: 'DTO / Entity / Repository',
    duration: '3 min',
    kind: 'demo',
    summary: [
      'Building on the FAQ discussion about whether DTOs are needed, this lesson creates the concrete <code>CustomerDto</code> and a utility mapper class to convert between the DTO and the <code>Customer</code> entity. Using a Java <code>record</code> for the DTO keeps it immutable and concise, with three fields matching the entity: <code>Integer id</code>, <code>String name</code>, and <code>String email</code>.',
      'The <code>EntityDtoMapper</code> is a utility class with two static methods: <code>toEntity(CustomerDto)</code> converts a DTO into a <code>Customer</code> entity by copying fields, and <code>toDto(Customer)</code> converts an entity back into a DTO. Because these are pure transformation functions with no external dependencies, static methods are the simplest and most appropriate approach here — no need for a Spring-managed bean.',
      'The repository itself (<code>CustomerRepository</code>) was already established in earlier lessons as a <code>ReactiveCrudRepository</code>, so the focus here is strictly on the DTO and mapper. This separation of concerns — entity for persistence, DTO for API boundaries, mapper to bridge them — keeps the API contract clean and decoupled from the data model.',
    ],
    keyPoints: [
      'Use a Java <code>record</code> for the DTO to get immutability and concise syntax for free: <code>public record CustomerDto(Integer id, String name, String email) {}</code>',
      'The mapper class uses <strong>static methods</strong> since it holds no state and has no dependencies — no need to make it a Spring bean',
      '<code>EntityDtoMapper</code> provides two conversion directions: <code>toEntity(CustomerDto)</code> and <code>toDto(Customer)</code>',
      'Keeping DTO and entity separate decouples your API contract from your persistence model, allowing them to evolve independently',
    ],
    code: `// CustomerDto.java
package com.example.customers.dto;

public record CustomerDto(
    Integer id,
    String name,
    String email
) {}

// EntityDtoMapper.java
package com.example.customers.mapper;

import com.example.customers.dto.CustomerDto;
import com.example.customers.entity.Customer;

public class EntityDtoMapper {

    public static Customer toEntity(CustomerDto dto) {
        var customer = new Customer();
        customer.setId(dto.id());
        customer.setName(dto.name());
        customer.setEmail(dto.email());
        return customer;
    }

    public static CustomerDto toDto(Customer customer) {
        return new CustomerDto(
            customer.getId(),
            customer.getName(),
            customer.getEmail()
        );
    }
}

// Customer.java — entity from earlier lessons
package com.example.customers.entity;

import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Table;

@Table("customers")
public class Customer {
    @Id
    private Integer id;
    private String name;
    private String email;

    public Integer getId() { return id; }
    public void setId(Integer id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
}`,
    codeLabel: 'java',
    note: {
      label: 'KEY INSIGHT',
      text: 'Using a Java record for the DTO means field accessors are method-style (dto.id(), not dto.getId()), which is cleaner but differs from the entity\'s getter conventions. The mapper bridges these two styles.',
      tone: 'accent',
    },
    quiz: {
      question: 'Why are the methods in EntityDtoMapper declared static rather than as instance methods on a Spring bean?',
      options: [
        { label: 'Because static methods are faster at runtime', correct: false },
        { label: 'Because the mapper has no state or dependencies, so there\'s no need for Spring to manage it as a bean', correct: true },
        { label: 'Because Spring requires mappers to be static', correct: false },
        { label: 'Because only one DTO type exists in the application', correct: false },
      ],
      explanation: 'The mapper is a pure utility class — it holds no state and has no injected dependencies. Static methods are the simplest approach here. If the mapper later needed injected collaborators (e.g., for complex field resolution), it would make sense to convert it into a Spring-managed bean.',
    },
  },
  {
    id: '5.4',
    title: 'Service Class Implementation',
    duration: '9 min',
    kind: 'demo',
    summary: [
      'The service layer sits between the controller and repository, orchestrating business logic and translating between entities and DTOs. We create <code>CustomerService</code> in the service package, annotated with <code>@Service</code>, and inject <code>CustomerRepository</code> via constructor injection. The service exposes five operations: <code>getAllCustomers</code>, <code>getCustomerById</code>, <code>saveCustomer</code>, <code>updateCustomer</code>, and <code>deleteCustomerById</code>.',
      'The read operations are straightforward: <code>findAll()</code> returns a <code>Flux&lt;Customer&gt;</code> that we map to DTOs, and <code>findById()</code> returns a <code>Mono&lt;Customer&gt;</code> that we similarly map. The <code>saveCustomer</code> method accepts a <code>Mono&lt;CustomerDTO&gt;</code> as input — the caller provides a publisher, not a raw object. We map the DTO to an entity, then <code>flatMap</code> into <code>repository.save()</code> (which itself returns a <code>Mono</code>), and finally map the saved entity back to a DTO. The key insight is using <code>flatMap</code> instead of <code>map</code> whenever the inner operation returns another <code>Mono</code> or <code>Flux</code>, to avoid nesting publishers inside publishers.',
      'The <code>updateCustomer</code> method is the most involved. It takes a customer ID and a <code>Mono&lt;CustomerDTO&gt;</code> representing the new content. We first query the repository by ID to verify the customer exists (happy path). Then we <code>flatMap</code> to access the existing entity, <code>map</code> the incoming DTO to a new entity, use <code>doOnNext</code> to set the ID on the new entity (since the request body may not include it), save via the repository, and map the result back to a DTO. This is a full replacement (PUT semantics), not a partial patch.',
      'The <code>deleteCustomerById</code> method delegates directly to <code>repository.deleteById()</code>, which returns <code>Mono&lt;Void&gt;</code>. Input validation (checking name, email, etc.) is intentionally deferred — the focus here is on the reactive CRUD flow and the happy path.',
      'The <code>EntityDtoMapper</code> utility (created in the previous lesson) provides static methods <code>toDto</code> and <code>toEntity</code> for converting between <code>Customer</code> and <code>CustomerDTO</code>. Using method references like <code>EntityDtoMapper::toDto</code> keeps the reactive chain concise and readable.',
    ],
    keyPoints: [
      'Use <code>flatMap</code> when the inner operation returns a <code>Mono</code> or <code>Flux</code>; use <code>map</code> for synchronous transformations like DTO ↔ entity conversion',
      'The <code>saveCustomer</code> method accepts <code>Mono&lt;CustomerDTO&gt;</code> as input — the caller provides a publisher, not a raw object, keeping the entire chain reactive',
      'In <code>updateCustomer</code>, use <code>doOnNext</code> to set the ID on the new entity before saving, since the request body may not include it',
      '<code>deleteById</code> returns <code>Mono&lt;Void&gt;</code> — the service returns this directly without wrapping',
      'Input validation is deferred for now; the focus is on the reactive CRUD flow and happy path',
    ],
    code: `package section05.service;

import org.springframework.stereotype.Service;
import section03.entity.Customer;
import section03.repository.CustomerRepository;
import section05.dto.CustomerDTO;
import section05.dto.EntityDtoMapper;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@Service
public class CustomerService {

    private final CustomerRepository customerRepository;

    public CustomerService(CustomerRepository customerRepository) {
        this.customerRepository = customerRepository;
    }

    public Flux<CustomerDTO> getAllCustomers() {
        return this.customerRepository.findAll()
                .map(EntityDtoMapper::toDto);
    }

    public Mono<CustomerDTO> getCustomerById(String id) {
        return this.customerRepository.findById(id)
                .map(EntityDtoMapper::toDto);
    }

    public Mono<CustomerDTO> saveCustomer(Mono<CustomerDTO> customerDtoMono) {
        return customerDtoMono
                .map(EntityDtoMapper::toEntity)
                .flatMap(this.customerRepository::save)
                .map(EntityDtoMapper::toDto);
    }

    public Mono<CustomerDTO> updateCustomer(String id, Mono<CustomerDTO> customerDtoMono) {
        return this.customerRepository.findById(id)
                .flatMap(existingCustomer -> customerDtoMono
                        .map(EntityDtoMapper::toEntity)
                        .doOnNext(entity -> entity.setId(id))
                        .flatMap(this.customerRepository::save)
                        .map(EntityDtoMapper::toDto)
                );
    }

    public Mono<Void> deleteCustomerById(String id) {
        return this.customerRepository.deleteById(id);
    }
}`,
    codeLabel: 'java',
    note: {
      label: 'KEY INSIGHT',
      text: 'The choice between <code>map</code> and <code>flatMap</code> is central to reactive programming: use <code>map</code> for synchronous one-to-one transformations (DTO ↔ entity), and <code>flatMap</code> when the transformation itself returns a publisher (like <code>repository.save()</code>). Using <code>map</code> where <code>flatMap</code> is needed would wrap a Mono inside a Mono, creating <code>Mono&lt;Mono&lt;T&gt;&gt;</code> — which compiles but breaks the reactive chain.',
      tone: 'accent',
    },
    quiz: {
      question: 'In the saveCustomer method, why is flatMap used instead of map when calling repository.save()?',
      options: [
        { label: 'Because save() returns Mono<Customer>, and flatMap flattens the nested Mono to avoid Mono<Mono<Customer>>', correct: true },
        { label: 'Because flatMap performs the conversion between entity and DTO automatically', correct: false },
        { label: 'Because map cannot be used after another map in a reactive chain', correct: false },
        { label: 'Because flatMap executes synchronously while map is asynchronous', correct: false },
      ],
      explanation: 'The repository.save() method returns Mono<Customer>. If you used map, the result would be Mono<Mono<Customer>> — a publisher nested inside a publisher. flatMap subscribes to the inner Mono and flattens it, so the chain continues with Mono<Customer>.',
    },
  },
  {
    id: '5.5',
    title: 'Controller',
    duration: '5 min',
    kind: 'demo',
    summary: [
      'With the service layer in place from the previous lesson, the next step is to expose the CRUD operations over HTTP using a Spring WebFlux controller. The <code>CustomerController</code> is annotated with <code>@RestController</code> and mapped to the base path <code>/customers</code>. The <code>CustomerService</code> is injected via constructor injection (Spring\'s recommended approach for testability and immutability).',
      'Each endpoint delegates directly to the service and returns reactive types — <code>Flux&lt;CustomerDTO&gt;</code> for collections and <code>Mono&lt;CustomerDTO&gt;</code> for single results. Spring WebFlux handles the subscription and serialization automatically; the controller never blocks. The GET endpoints use <code>@PathVariable</code> for the customer ID, and the POST and PUT endpoints accept the request body as <code>Mono&lt;CustomerDTO&gt;</code> rather than a plain <code>CustomerDTO</code>.',
      'The decision to accept <code>Mono&lt;CustomerDTO&gt;</code> as the <code>@RequestBody</code> is deliberate: since the request body arrives from a remote client over the network, treating it as a <code>Publisher</code> (Mono) is the idiomatic reactive approach. This allows the full pipeline — from deserialization through service processing to response writing — to remain non-blocking. The instructor notes that this choice will be discussed in more detail in the upcoming FAQ lesson.',
      'This lesson focuses exclusively on the <em>happy path</em> — no HTTP status codes, error handling, or <code>ResponseEntity</code> wrappers are introduced yet. Those concerns are deferred to later lessons in the section, allowing the controller to stay clean and focused on routing and delegation.',
    ],
    keyPoints: [
      '<strong>@RestController</strong> with <code>@RequestMapping("/customers")</code> routes all customer-related requests to this controller',
      'Constructor injection is used for <code>CustomerService</code> — the recommended Spring approach for reactive components',
      'GET all returns <code>Flux&lt;CustomerDTO&gt;</code>; GET by ID, POST, PUT return <code>Mono&lt;CustomerDTO&gt;</code>; DELETE returns <code>Mono&lt;Void&gt;</code>',
      '<code>@RequestBody</code> parameters are typed as <code>Mono&lt;CustomerDTO&gt;</code> (a Publisher) rather than plain <code>CustomerDTO</code> — this will be explained in the next FAQ lesson',
      'No <code>ResponseEntity</code> or status code handling yet — this is the happy path only; error handling comes in later lessons',
    ],
    code: `package com.example.section05.controller;

import com.example.section05.dto.CustomerDTO;
import com.example.section05.service.CustomerService;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("customers")
public class CustomerController {

    private final CustomerService customerService;

    public CustomerController(CustomerService customerService) {
        this.customerService = customerService;
    }

    @GetMapping
    public Flux<CustomerDTO> allCustomers() {
        return this.customerService.getAllCustomers();
    }

    @GetMapping("{id}")
    public Mono<CustomerDTO> getCustomer(@PathVariable Integer id) {
        return this.customerService.getCustomerById(id);
    }

    @PostMapping
    public Mono<CustomerDTO> saveCustomer(@RequestBody Mono<CustomerDTO> customerMono) {
        return this.customerService.saveCustomer(customerMono);
    }

    @PutMapping("{id}")
    public Mono<CustomerDTO> updateCustomer(@PathVariable Integer id,
                                           @RequestBody Mono<CustomerDTO> customerMono) {
        return this.customerService.updateCustomer(id, customerMono);
    }

    @DeleteMapping("{id}")
    public Mono<Void> deleteCustomer(@PathVariable Integer id) {
        return this.customerService.deleteCustomerById(id);
    }
}`,
    codeLabel: 'java',
    note: {
      label: 'WHY THIS MATTERS',
      text: 'Accepting <code>Mono&lt;CustomerDTO&gt;</code> as the request body (instead of a plain object) keeps the entire request-to-response pipeline non-blocking. The controller never subscribes manually — Spring WebFlux subscribes at the framework level and handles backpressure automatically.',
      tone: 'accent',
    },
    quiz: {
      question: 'Why is the @RequestBody in the POST and PUT endpoints typed as Mono<CustomerDTO> instead of a plain CustomerDTO?',
      options: [
        { label: 'Because Spring WebFlux requires all request bodies to be reactive types', correct: false },
        { label: 'Because the request body arrives asynchronously from a remote client, and using a Publisher keeps the pipeline fully non-blocking', correct: true },
        { label: 'Because plain DTOs cannot be deserialized in WebFlux', correct: false },
        { label: 'Because Mono provides automatic error handling for invalid JSON', correct: false },
      ],
      explanation: 'While Spring WebFlux does support plain objects as request bodies, the idiomatic reactive approach is to accept a Publisher (Mono). Since the body comes from a remote client over the network, treating it as a Mono allows the entire chain — deserialization, service logic, and response writing — to remain non-blocking and composable.',
    },
  },
  {
    id: '5.6',
    title: 'FAQ - @RequestBody Mono<T> vs T',
    duration: '2 min',
    kind: 'faq',
    summary: [
      'When building a reactive controller, Spring WebFlux accepts <code>@RequestBody CustomerDto</code> and <code>@RequestBody Mono&lt;CustomerDto&gt;</code> interchangeably — both compile and work correctly. The difference lies in <em>when</em> the controller method is invoked relative to the arrival of the request body.',
      'With a plain <code>CustomerDto</code> parameter, Spring must buffer the entire incoming byte stream from the network, complete the TCP three-way handshake, and fully deserialize the bytes into a <code>CustomerDto</code> object <em>before</em> it can call your handler method. The method is blocked from invocation until the full payload is available.',
      'With <code>Mono&lt;CustomerDto&gt;</code>, Spring can invoke the handler method <em>immediately</em> — even before the full request body has arrived over the network. The <code>Mono</code> serves as a placeholder (a publisher) that will emit the deserialized object once the data is available. Since reactive handlers only <em>build</em> the pipeline during method invocation (the actual business logic runs later as operators on the pipeline), this means the framework can start assembling the reactive chain without waiting for the full payload.',
      'For simple CRUD endpoints the practical benefit is negligible — the pipeline operators won\'t execute until the data arrives anyway. The real advantage of the publisher-typed parameter becomes apparent in streaming scenarios, where the ability to begin processing before the full body is received enables true non-blocking, backpressure-aware pipelines.',
    ],
    keyPoints: [
      'Both <code>@RequestBody T</code> and <code>@RequestBody Mono&lt;T&gt;</code> work in WebFlux — the difference is <em>timing</em> of method invocation.',
      'Plain <code>T</code> forces Spring to fully buffer and deserialize the request body <strong>before</strong> invoking the handler method.',
      '<code>Mono&lt;T&gt;</code> allows the handler to be invoked <strong>immediately</strong>; the method receives a publisher that will emit the body later.',
      'Reactive handler methods only <em>build</em> the pipeline — actual operator logic executes when data flows through, so the timing difference is invisible for simple CRUD.',
      'The real advantage of publisher-typed parameters emerges in <strong>streaming</strong> scenarios covered later in the course.',
    ],
    code: `java`,
    codeLabel: 'java',
    note: {
      label: 'KEY INSIGHT',
      text: 'The choice between Mono<T> and T is about when Spring invokes your method, not whether the code works. With Mono<T>, the framework can start assembling the reactive pipeline before the full HTTP body arrives — a distinction that matters for streaming but not for typical CRUD.',
      tone: 'accent',
    },
    quiz: {
      question: 'In a WebFlux controller, what is the key difference between @RequestBody CustomerDto and @RequestBody Mono<CustomerDto>?',
      options: [
        { label: 'Mono<CustomerDto> is required for reactive controllers; plain CustomerDto will not compile', correct: false },
        { label: 'Plain CustomerDto forces Spring to fully buffer and deserialize the body before invoking the method, while Mono<CustomerDto> lets the method be invoked immediately with a publisher that emits the body later', correct: true },
        { label: 'There is no difference at all — Spring treats both identically at runtime', correct: false },
        { label: 'Mono<CustomerDto> disables HTTP content negotiation, so plain CustomerDto is always preferred', correct: false },
      ],
      explanation: 'Both approaches compile and work, but with a plain DTO type, Spring must collect all incoming bytes and deserialize them into the object before it can invoke your handler. With Mono<T>, the handler is invoked immediately and receives a publisher that will emit the deserialized object once the data arrives. For simple CRUD the practical effect is the same, but for streaming the publisher approach enables earlier pipeline assembly.',
    },
  },
  {
    id: '5.7',
    title: 'CRUD APIs Demo',
    duration: '5 min',
    kind: 'demo',
    summary: [
      'With the Customer entity, repository, service, and controller all in place from the prior lessons, this lesson is a manual end-to-end smoke test of every CRUD endpoint using Postman. Before starting the application, the instructor confirms that the Spring profile is set to <code>section03</code> in <code>application.properties</code> so the correct database schema and seed data are activated.',
      'The demo walks through five requests in sequence: <code>GET /customers</code> returns the full list, <code>GET /customers/2</code> returns a single customer, <code>POST /customers</code> with a JSON body creates a new customer (Marshall), <code>PUT /customers/11</code> updates Marshall\'s email, and <code>DELETE /customers/11</code> removes the record. Each request returns an HTTP 200 with the expected body, confirming the reactive pipeline is wired correctly end-to-end.',
      'A subtle but important issue surfaces at the end: after deleting customer 11, a subsequent <code>GET /customers/11</code> still returns HTTP 200 with an <em>empty body</em> instead of a 404. This happens because the service returns <code>Mono.empty()</code> when no customer is found, and the controller wraps it in a 200 response without distinguishing between "entity exists" and "entity missing." The instructor flags this as a problem to fix in upcoming lessons on <code>ResponseEntity</code> and 4xx error handling.',
    ],
    keyPoints: [
      'Set <code>spring.profiles.active=section03</code> in <code>application.properties</code> to use the correct database setup for this section.',
      'All five CRUD endpoints work end-to-end: GET all, GET by ID, POST create, PUT update, and DELETE.',
      'A <code>Mono.empty()</code> returned from the repository/service for a missing entity results in an HTTP 200 with an empty body — not a 404.',
      'Proper 4xx error handling (e.g., returning 404 for not-found) is deferred to the upcoming <code>ResponseEntity</code> lessons.',
      'Manual Postman testing is a valid first-pass verification, but integration tests with <code>WebTestClient</code> (covered later in this section) provide reproducible, automated coverage.',
    ],
    code: `# application.properties
spring.profiles.active=section03

# --- Postman request examples ---

# 1. Get all customers
# GET http://localhost:8080/customers
# Response: 200 OK — JSON array of all customers

# 2. Get customer by ID
# GET http://localhost:8080/customers/2
# Response: 200 OK — single customer JSON object

# 3. Create customer
# POST http://localhost:8080/customers
# Content-Type: application/json
# Body:
{
  "name": "Marshall",
  "email": "marshall@gmail.com"
}
# Response: 200 OK — created customer object

# 4. Update customer (ID 11 = newly created Marshall)
# PUT http://localhost:8080/customers/11
# Content-Type: application/json
# Body:
{
  "name": "Marshall",
  "email": "marshall@example.com"
}
# Response: 200 OK — updated customer object

# 5. Delete customer
# DELETE http://localhost:8080/customers/11
# Response: 200 OK

# 6. Verify deletion — GET by ID for a deleted customer
# GET http://localhost:8080/customers/11
# Response: 200 OK with EMPTY BODY  <-- problem to fix in later lessons`,
    codeLabel: 'properties',
    note: {
      label: 'WARNING',
      text: 'Returning <code>Mono.empty()</code> for a not-found entity produces an HTTP 200 with an empty body rather than a meaningful 404 response. This will be addressed in the upcoming lessons on <code>ResponseEntity</code> and 4xx error handling.',
      tone: 'accent',
    },
    quiz: {
      question: 'After deleting customer 11, a GET request to /customers/11 returns HTTP 200 with an empty body. What is the root cause of this behavior?',
      options: [
        { label: 'The controller throws an exception that Spring silently swallows, resulting in an empty 200.', correct: false },
        { label: 'The service returns Mono.empty() for a missing entity, and the controller passes it through as a 200 with no body.', correct: true },
        { label: 'The database still has a soft-deleted record, so the query succeeds but returns an empty JSON object.', correct: false },
        { label: 'Postman caches the previous successful response and replays it instead of sending a new request.', correct: false },
      ],
      explanation: 'When the repository finds no entity, the reactive chain completes with Mono.empty(). The controller does not differentiate between an existing entity and an empty Mono, so Spring WebFlux returns 200 with an empty body. The fix — covered in later lessons — is to use ResponseEntity to map an empty Mono to a 404 status.',
    },
  },
  {
    id: '5.8',
    title: 'Mono/Flux - ResponseEntity',
    duration: '5 min',
    kind: 'concept',
    summary: [
      'When a Spring WebFlux controller method returns a raw publisher like <code>Mono&lt;Customer&gt;</code> or <code>Flux&lt;Customer&gt;</code>, Spring subscribes to it and maps its signals to HTTP defaults: a data item or completion becomes <code>200 OK</code>, while an error signal becomes <code>500 Internal Server Error</code>. This is why a query for a non-existent customer currently returns <code>200 OK</code> with an empty body rather than a <code>404 Not Found</code> — Spring treats the empty <code>Mono</code> as a successful completion.',
      'To return meaningful status codes (404, 400, 429, etc.), wrap the payload in <code>Mono&lt;ResponseEntity&lt;T&gt;&gt;</code>. The <code>ResponseEntity</code> lets you set the status code, headers, and body, all delivered asynchronously once the <code>Mono</code> emits. This is the idiomatic approach for single-value, request/response-style communication in WebFlux.',
      '<code>Flux&lt;ResponseEntity&lt;T&gt;&gt;</code> does <em>not</em> make sense because an HTTP response carries exactly one status code and one set of headers — you cannot stream multiple status codes to the same client. If you need streaming, return a raw <code>Flux</code> (the status is 200 by default and each item is a stream chunk). If you need a custom status with a streaming body, use <code>ResponseEntity&lt;Flux&lt;T&gt;&gt;</code> — the status and headers are set once, and the body streams asynchronously.',
      'Spring WebFlux also supports <code>ResponseEntity&lt;Mono&lt;T&gt;&gt;</code> and <code>ResponseEntity&lt;Flux&lt;T&gt;&gt;</code>, where the status and headers are provided synchronously up front while the body arrives asynchronously. Nested generics like <code>Mono&lt;ResponseEntity&lt;Mono&lt;T&gt;&gt;&gt;</code> are technically possible but add unnecessary complexity. The practical guideline: use <code>Mono&lt;ResponseEntity&lt;T&gt;&gt;</code> for single-value responses with custom status codes, and keep raw <code>Flux</code> for streaming.',
    ],
    keyPoints: [
      'Returning a raw <code>Mono&lt;T&gt;</code> or <code>Flux&lt;T&gt;</code> defaults to <code>200 OK</code> on data/empty and <code>500</code> on error — no fine-grained status control.',
      'Use <code>Mono&lt;ResponseEntity&lt;T&gt;&gt;</code> to set custom status codes, headers, and body asynchronously for single-value responses.',
      '<code>Flux&lt;ResponseEntity&lt;T&gt;&gt;</code> is nonsensical — an HTTP response has exactly one status code and one header set, not one per stream element.',
      'For streaming with a custom status, use <code>ResponseEntity&lt;Flux&lt;T&gt;&gt;</code> (status/headers set once, body streams asynchronously).',
      '<code>ResponseEntity&lt;Mono&lt;T&gt;&gt;</code> is an alternative where status/headers are set synchronously and the body is deferred — but <code>Mono&lt;ResponseEntity&lt;T&gt;&gt;</code> keeps everything asynchronous and is simpler to reason about.',
    ],
    code: `package com.example.section05.controller;

import com.example.section05.dto.Customer;
import com.example.section05.service.CustomerService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Mono;

import java.util.Optional;

@RestController
@RequestMapping("/customers")
public class CustomerController {

    private final CustomerService service;

    public CustomerController(CustomerService service) {
        this.service = service;
    }

    // BEFORE: raw Mono — empty emission yields 200 OK with empty body
    // @GetMapping("/{id}")
    // public Mono<Customer> getCustomer(@PathVariable Integer id) {
    //     return service.getCustomerById(id);
    // }

    // AFTER: Mono<ResponseEntity> — full control over status code
    @GetMapping("/{id}")
    public Mono<ResponseEntity<Customer>> getCustomer(@PathVariable Integer id) {
        return service.getCustomerById(id)
                .map(ResponseEntity::ok)                          // 200 with body
                .defaultIfEmpty(ResponseEntity.notFound().build()); // 404 if empty
    }
}`,
    codeLabel: 'java',
    note: {
      label: 'KEY INSIGHT',
      text: 'An HTTP response has exactly one status line and one set of headers — it cannot be streamed element-by-element. This is why <code>Flux&lt;ResponseEntity&gt;</code> is invalid: each <code>ResponseEntity</code> would imply its own status code, which is impossible within a single HTTP response.',
      tone: 'accent',
    },
    quiz: {
      question: 'You need to return a list of all customers with a custom cache-control header. Which return type should your controller method use?',
      options: [
        { label: 'Flux<ResponseEntity<Customer>>', correct: false },
        { label: 'Mono<ResponseEntity<Flux<Customer>>>', correct: false },
        { label: 'ResponseEntity<Flux<Customer>>', correct: true },
        { label: 'Flux<Customer>', correct: false },
      ],
      explanation: 'Since the status code and headers are set once (synchronously) while the body streams asynchronously, ResponseEntity<Flux<Customer>> is the correct type. Flux<ResponseEntity<Customer>> is nonsensical because you cannot have multiple status codes in one HTTP response. A raw Flux<Customer> gives no control over headers or status.',
    },
  },
  {
    id: '5.9',
    title: 'Handling 4XX via ResponseEntity',
    duration: '3 min',
    kind: 'demo',
    summary: [
      'Building on the controller from the previous lesson, we now handle 4XX client errors by returning <code>ResponseEntity</code> with appropriate status codes. For <code>getCustomerById</code>, the return type changes from <code>Mono&lt;CustomerDTO&gt;</code> to <code>Mono&lt;ResponseEntity&lt;CustomerDTO&gt;&gt;</code>. The service returns an empty <code>Mono</code> when the customer is not found, so we chain <code>.map(ResponseEntity::ok)</code> for the success case and <code>.defaultIfEmpty(ResponseEntity.notFound().build())</code> for the 404 case.',
      'The same pattern applies to <code>updateCustomer</code>: if <code>findById</code> emits empty, the entire reactive chain is skipped, so <code>defaultIfEmpty</code> catches the not-found scenario. This works because the update flow is gated on a <code>findById</code> that emits the DTO only when the customer exists.',
      'The <code>deleteCustomer</code> endpoint is different. <code>deleteById</code> returns <code>Mono&lt;Void&gt;</code> — a completion signal — regardless of whether the entity existed. It emits empty on both successful deletion and not-found, so <code>defaultIfEmpty</code> would always trigger a 404. The naive approach is to first <code>findById</code> and then <code>delete</code>, but that issues two database queries. A more efficient single-query approach will be covered in the next lesson using <code>@Modifying</code>.',
    ],
    keyPoints: [
      'Change return types to <code>Mono&lt;ResponseEntity&lt;CustomerDTO&gt;&gt;</code> to convey HTTP status codes.',
      'Use <code>.map(ResponseEntity::ok)</code> to wrap the found DTO in a 200 OK response.',
      'Use <code>.defaultIfEmpty(ResponseEntity.notFound().build())</code> to return 404 when the <code>Mono</code> is empty.',
      '<code>deleteById</code> returns <code>Mono&lt;Void&gt;</code> which always completes empty — <code>defaultIfEmpty</code> cannot distinguish a successful delete from a not-found.',
      'A two-query approach (find-then-delete) works for delete but is suboptimal; the next lesson introduces a single-query solution.',
    ],
    code: `package com.example.customer.controller;

import com.example.customer.dto.CustomerDTO;
import com.example.customer.service.CustomerService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/customers")
public class CustomerController {

    private final CustomerService customerService;

    public CustomerController(CustomerService customerService) {
        this.customerService = customerService;
    }

    @GetMapping("/{id}")
    public Mono<ResponseEntity<CustomerDTO>> getCustomerById(@PathVariable String id) {
        return this.customerService.retrieveCustomer(id)
                .map(ResponseEntity::ok)
                .defaultIfEmpty(ResponseEntity.notFound().build());
    }

    @PutMapping("/{id}")
    public Mono<ResponseEntity<CustomerDTO>> updateCustomer(@PathVariable String id,
                                                           @RequestBody Mono<CustomerDTO> customerMono) {
        return this.customerService.updateCustomer(id, customerMono)
                .map(ResponseEntity::ok)
                .defaultIfEmpty(ResponseEntity.notFound().build());
    }

    // Naive two-query approach for delete — improved in the @Modifying Query lesson
    @DeleteMapping("/{id}")
    public Mono<ResponseEntity<Void>> deleteCustomer(@PathVariable String id) {
        return this.customerService.retrieveCustomer(id)
                .flatMap(customer -> this.customerService.deleteCustomer(id)
                        .then(Mono.fromSupplier(() -> ResponseEntity.noContent().<Void>build())))
                .defaultIfEmpty(ResponseEntity.notFound().build());
    }
}`,
    codeLabel: 'java',
    note: {
      label: 'WARNING',
      text: 'Do not use <code>defaultIfEmpty</code> directly on <code>deleteById</code>\'s <code>Mono&lt;Void&gt;</code> — it always completes empty, so you would always return 404 even for successful deletes.',
      tone: 'accent',
    },
    quiz: {
      question: 'Why can\'t you use <code>defaultIfEmpty(ResponseEntity.notFound().build())</code> directly on the result of <code>repository.deleteById(id)</code>?',
      options: [
        { label: 'deleteById throws an exception when the entity is not found', correct: false },
        { label: 'deleteById returns Mono<Void> which completes empty whether or not the entity existed, so defaultIfEmpty would always trigger', correct: true },
        { label: 'ResponseEntity.notFound() requires a body object to build successfully', correct: false },
        { label: 'deleteById returns a Flux, not a Mono, so defaultIfEmpty is not available', correct: false },
      ],
      explanation: 'Reactive <code>deleteById</code> returns <code>Mono&lt;Void&gt;</code> — a completion-only signal. It emits empty on both a successful delete and a not-found case, making it impossible to distinguish the two scenarios with <code>defaultIfEmpty</code> alone.',
    },
  },
  {
    id: '5.10',
    title: '@Modifying Query',
    duration: '4 min',
    kind: 'demo',
    summary: [
      'The default <code>deleteById</code> method provided by Spring Data Reactive repositories returns <code>Mono&lt;Void&gt;</code>, which makes it impossible to distinguish between a successful deletion and an attempt to delete a non-existent record — both simply complete without emitting a value. To fix this, we can define a custom query method in the repository annotated with <code>@Modifying</code>, which instructs Spring Data to return the number of affected rows instead of a void result.',
      'By annotating a custom repository method with both <code>@Query</code> and <code>@Modifying</code>, we can execute a delete statement and return <code>Mono&lt;Boolean&gt;</code> — <code>true</code> if one or more rows were affected, <code>false</code> if no matching record existed. The service layer then passes this <code>Mono&lt;Boolean&gt;</code> up to the controller, which uses a <code>filter</code> operator to gate the response: if <code>true</code>, it maps to a <code>204 No Content</code>; if <code>false</code>, the filter blocks emission and the <code>switchIfEmpty</code> branch returns <code>404 Not Found</code>.',
      'The instructor notes this is one of several valid approaches. An alternative is to call <code>findById</code>, chain a <code>flatMap</code> to <code>delete</code>, and use <code>switchIfEmpty</code> for the not-found case. The <code>@Modifying</code> query approach is chosen here to explore Spring WebFlux features, but either pattern is acceptable in production.',
    ],
    keyPoints: [
      '<strong>@Modifying</strong> tells Spring Data R2DBC to return affected-row metadata instead of <code>Void</code>, enabling <code>Mono&lt;Boolean&gt;</code> or <code>Mono&lt;Integer&gt;</code> return types.',
      'The default <code>deleteById</code> returns <code>Mono&lt;Void&gt;</code>, which cannot distinguish between "deleted successfully" and "record not found" — both complete silently.',
      'Using <code>filter(b -> b)</code> on a <code>Mono&lt;Boolean&gt;</code> blocks emission when the value is <code>false</code>, causing the downstream <code>switchIfEmpty</code> to trigger the 404 response.',
      '<code>ResponseEntity&lt;Void&gt;</code> with <code>.build()</code> produces an HTTP 204 No Content response with no body.',
      'Alternative approach: use <code>findById</code> + <code>switchIfEmpty</code> for the not-found case, then <code>flatMap</code> into <code>delete</code> — equally valid in production code.',
    ],
    code: `java`,
    codeLabel: 'CustomerRepository.java — custom @Modifying delete method',
    note: {
      label: 'DECISION POINT',
      text: 'The @Modifying query approach and the findById-then-delete approach both solve the same problem. Choose @Modifying for a single database round-trip; choose findById-then-delete when you need to inspect or log the entity before deleting.',
      tone: 'accent',
    },
    quiz: {
      question: 'Why does the default deleteById return Mono<Void>, and why is that problematic for REST API responses?',
      options: [
        { label: 'Mono<Void> completes silently on both success and not-found, so you cannot return a 404 when the record doesn\'t exist', correct: true },
        { label: 'Mono<Void> throws an exception when the record is not found, causing a 500 error', correct: false },
        { label: 'Mono<Void> is a reactive anti-pattern and should never be used in repositories', correct: false },
        { label: 'Mono<Void> returns false when the record is not found, but Spring WebFlux ignores it', correct: false },
      ],
      explanation: 'Mono<Void> emits no value and simply completes whether or not a row was deleted. Without a value to inspect, the controller cannot tell the difference between a successful deletion and a non-existent ID, making it impossible to return a proper 404 Not Found response.',
    },
  },
  {
    id: '5.11',
    title: 'Paginated Results',
    duration: '6 min',
    kind: 'demo',
    summary: [
      'With the core CRUD APIs complete, this lesson adds a new requirement: paginated customer retrieval. Returning a <code>Flux&lt;Customer&gt;</code> streams all customers, which is fine for small datasets but impractical when millions of records exist—especially for web-based UIs that need finite pages. Rather than modifying the existing streaming endpoint, a separate <code>/customers/paginated</code> endpoint is introduced so both approaches remain available for reference.',
      'The implementation follows the standard Spring Data pattern: the repository exposes a <code>findBy(Pageable)</code> method, the service wraps it with a <code>PageRequest</code> (adjusting for Spring\'s zero-based indexing if the client sends 1-based page numbers), and the controller accepts <code>@RequestParam</code> values for <code>page</code> and <code>size</code> with sensible defaults. The service uses <code>collectList()</code> to convert the <code>Flux</code> into a <code>Mono&lt;List&gt;</code>, and the controller returns <code>Mono&lt;List&lt;CustomerDTO&gt;&gt;</code> instead of a <code>Flux</code>.',
      'Returning just the page of results is often insufficient—clients frequently need the total record count for pagination UI controls. To provide this, the service zips the result list with <code>repository.count()</code> and wraps both in a <code>PageImpl</code>, which yields a <code>Page</code> object containing the page data, total elements, and total pages. This mirrors the approach documented in the instructor\'s blog on Spring Data JDBC pagination.',
    ],
    keyPoints: [
      'Use <code>findBy(Pageable)</code> in a reactive Spring Data repository to support pagination without writing custom queries.',
      'Spring\'s <code>PageRequest</code> is <strong>zero-indexed</strong> — if clients send page 1 for the first page, subtract 1 before passing to <code>PageRequest.of()</code>.',
      '<code>@RequestParam</code> with <code>defaultValue</code> makes page and size optional, so clients aren\'t forced to provide them on every request.',
      'Use <code>collectList()</code> to convert <code>Flux&lt;CustomerDTO&gt;</code> into <code>Mono&lt;List&lt;CustomerDTO&gt;&gt;</code> when a finite page (not a stream) is the desired response shape.',
      'To include total count metadata, zip the collected list with <code>repository.count()</code> and wrap in <code>new PageImpl&lt;&gt;(list, pageable, total)</code> — the resulting <code>Page</code> exposes <code>getTotalElements()</code> and <code>getTotalPages()</code>.',
    ],
    code: `package section03.repository;

import org.springframework.data.domain.Pageable;
import reactor.core.publisher.Flux;
import section03.entity.Customer;

public interface CustomerRepository extends ReactiveCrudRepository<Customer, Long> {

    // ... existing methods from earlier lessons ...

    Flux<Customer> findBy(Pageable pageable);
}
`,
    codeLabel: 'java',
    note: {
      label: 'WHEN TO USE',
      text: 'Return a Flux when clients should consume a continuous stream; return a Mono<List> or Mono<Page> when clients need bounded, paginated results — typical for web UIs with page navigation controls.',
      tone: 'accent',
    },
    quiz: {
      question: 'A client sends page=1 and size=3 expecting the first three customers. What must the service do before passing these values to PageRequest.of()?',
      options: [
        { label: 'Pass page and size directly to PageRequest.of(page, size)', correct: false },
        { label: 'Subtract 1 from page because PageRequest is zero-indexed: PageRequest.of(page - 1, size)', correct: true },
        { label: 'Subtract 1 from size because PageRequest is zero-indexed', correct: false },
        { label: 'Nothing — Spring automatically converts 1-based pages to 0-based internally', correct: false },
      ],
      explanation: 'Spring Data\'s PageRequest uses zero-based indexing, so page 1 from the client maps to index 0. The service must subtract 1 from the page number before calling PageRequest.of(). If passed directly, the client\'s page 1 would skip the first three records and return the second page.',
    },
  },
  {
    id: '5.12',
    title: 'CRUD APIs Demo',
    duration: '3 min',
    kind: 'demo',
    summary: [
      'This lesson is a hands-on Postman walkthrough verifying that every CRUD endpoint built in the preceding lessons behaves correctly. The application is started locally and each endpoint is exercised against a pre-loaded dataset of ten customers.',
      'The <code>GET /customers</code> endpoint returns all ten customers. The paginated variant <code>GET /customers/paginated</code> works with defaults (page 0, size 3), returning customers 1–3. Requesting <code>?page=2</code> returns customers 4–6, and combining <code>?page=2&size=5</code> returns customers 6–10, confirming that page and size parameters are wired correctly.',
      'Single-record lookups behave as expected: <code>GET /customers/10</code> returns a 200 with the customer body, while <code>GET /customers/11</code> (non-existent) returns a 404. A <code>POST</code> creates customer 11 (Marshall) with a 200, and a subsequent <code>PUT</code> updating Marshall\'s email to <em>example.com</em> succeeds. Attempting a <code>PUT</code> for non-existent customer 12 returns 404. Finally, <code>DELETE /customers/11</code> returns 200 on the first call and 404 on a repeat call, confirming the record was removed and that subsequent lookups correctly report not-found.',
      'No new code is introduced — this demo validates the controller, service, and repository layers working together end-to-end through HTTP.',
    ],
    keyPoints: [
      '<strong>GET all</strong> returns the full list; <strong>GET paginated</strong> respects <code>page</code> and <code>size</code> query parameters with sensible defaults.',
      '<strong>GET by ID</strong> returns 200 for existing records and 404 for non-existent ones, confirming <code>ResponseEntity</code> logic from lesson 5.8.',
      '<strong>POST</strong> creates a new customer and returns 200; <strong>PUT</strong> updates an existing customer or returns 404 if the ID doesn\'t exist.',
      '<strong>DELETE</strong> returns 200 on success and 404 when the target record has already been removed, proving idempotent not-found handling.',
    ],
    code: `// No new code in this lesson — this is a Postman verification demo.
//
// Endpoints verified (from prior lessons):
//
// GET    /customers                 → 200, Flux<CustomerResponse>
// GET    /customers/paginated?page=2&size=5 → 200, paginated results
// GET    /customers/{id}            → 200 or 404
// POST   /customers                  → 200, creates new customer
// PUT    /customers/{id}             → 200 or 404
// DELETE /customers/{id}             → 200 or 404
//
// Sample Postman session:
//   GET /customers                  → 10 customers
//   GET /customers/paginated        → customers 1, 2, 3 (page 0, size 3)
//   GET /customers/paginated?page=2 → customers 4, 5, 6
//   GET /customers/paginated?page=2&size=5 → customers 6, 7, 8, 9, 10
//   GET /customers/10               → 200 OK
//   GET /customers/11               → 404 Not Found
//   POST /customers (body: Marshall) → 200 OK, customer 11 created
//   PUT  /customers/11 (email update) → 200 OK
//   PUT  /customers/12               → 404 Not Found
//   DELETE /customers/11            → 200 OK
//   DELETE /customers/11            → 404 Not Found (already deleted)`,
    codeLabel: 'text',
    note: {
      label: 'WHY THIS MATTERS',
      text: 'Manual end-to-end verification through Postman catches integration issues — mismatched routes, wrong status codes, or broken pagination — before writing automated tests. It confirms the full reactive chain (controller → service → repository) works under real HTTP conditions.',
      tone: 'green',
    },
    quiz: {
      question: 'You call DELETE /customers/11 twice. The first call returns 200 and the second returns 404. What does this behavior confirm?',
      options: [
        { label: 'The delete operation is idempotent and subsequent lookups correctly report the record as gone', correct: true },
        { label: 'The delete operation failed on the first call', correct: false },
        { label: 'The controller is not handling reactive streams properly', correct: false },
        { label: 'Pagination is broken', correct: false },
      ],
      explanation: 'A 200 on the first DELETE confirms the record existed and was removed. The 404 on the second call confirms the record is no longer present, which is the correct behavior — the endpoint properly distinguishes between \'deleted successfully\' and \'nothing to delete.\'',
    },
  },
  {
    id: '5.13',
    title: 'WebTestClient - Introduction',
    duration: '4 min',
    kind: 'theory',
    summary: [
      'To test the reactive CRUD APIs built in the preceding lessons, we use <code>WebTestClient</code> — a testing utility designed specifically for writing non-blocking HTTP integration tests. While <code>WebClient</code> is the production client used under <code>src/main/java</code> to send real HTTP requests reactively, <code>WebTestClient</code> lives under <code>src/test/java</code> and wraps the same reactive infrastructure with assertion capabilities built in.',
      'The workflow is straightforward: Spring auto-injects a <code>WebTestClient</code> bean into the test class. You call methods like <code>get()</code>, <code>post()</code>, <code>put()</code>, or <code>delete()</code>, provide the URI via <code>uri()</code>, supply a request body with <code>bodyValue()</code> if needed, then call <code>exchange()</code> to actually send the request and receive the response. Unlike the reactive pipeline in production code, <code>exchange()</code> <em>blocks</em> until the response is available — which is acceptable and expected in a test context.',
      'After <code>exchange()</code>, you get a response you can assert against in a fluent, chainable style: check the status code (<code>expectStatus().isOk()</code>), verify headers (<code>expectHeader().contentType(MediaType.APPLICATION_JSON)</code>), deserialize the body into a DTO (<code>expectBody(CustomerDto.class)</code>), and then apply standard JUnit assertions on the deserialized object. This chaining makes the test read like a specification of the expected HTTP interaction.',
      'For responses with large or deeply nested JSON structures, <code>WebTestClient</code> also supports <strong>JSONPath</strong> expressions via <code>jsonPath()</code>. Instead of deserializing the entire body, you can navigate to a specific path (e.g., <code>$.store.book[0].author</code>) and assert on just that fragment. The <code>$</code> symbol represents the root JSON object, and you traverse downward using dot notation — useful when you only care about one field in a complex response.',
    ],
    keyPoints: [
      '<strong><code>WebTestClient</code></strong> is the testing counterpart to <code>WebClient</code> — use it under <code>src/test/java</code> for integration tests, never in production code.',
      'The <code>exchange()</code> method sends the request and blocks for the response — blocking is fine in tests but not in reactive production code.',
      'Assertions chain fluently after <code>exchange()</code>: <code>expectStatus()</code>, <code>expectHeader()</code>, <code>expectBody()</code> — each consuming a part of the response.',
      'Use <code>bodyValue(payload)</code> to attach a request body for POST/PUT requests; the client handles serialization automatically.',
      '<strong>JSONPath</strong> (<code>jsonPath("$.path.to.field")</code>) lets you assert on specific nested fields without deserializing the entire response body — <code>$</code> represents the JSON root object.',
    ],
    code: `java`,
    codeLabel: 'java',
    note: {
      label: 'WHY THIS MATTERS',
      text: 'WebTestClient lets you test the full HTTP layer — including routing, status codes, headers, and serialization — without starting a separate server. It binds directly to the application context, making tests fast and deterministic while still exercising the real controller and filter chain.',
      tone: 'accent',
    },
    quiz: {
      question: 'Why is it acceptable for WebTestClient\'s exchange() method to block, when blocking is an anti-pattern in reactive production code?',
      options: [
        { label: 'Because tests run in a separate thread pool that tolerates blocking', correct: false },
        { label: 'Because test code needs a concrete result to assert against, and blocking in src/test/java does not affect production runtime behavior', correct: true },
        { label: 'Because exchange() is non-blocking and only appears to block', correct: false },
        { label: 'Because WebTestClient uses a different threading model than WebClient', correct: false },
      ],
      explanation: 'In reactive production code, blocking a thread can starve the event loop and degrade throughput. But in tests (src/test/java), the goal is to obtain a concrete response and assert on it — there is no concurrent load to serve, so blocking until the response arrives is both safe and necessary for deterministic assertions.',
    },
  },
  {
    id: '5.14',
    title: 'Integration Testing - Part 1',
    duration: '8 min',
    kind: 'demo',
    summary: [
      'Building on the WebTestClient introduction from the previous lesson, this lesson begins writing actual integration tests for the reactive CRUD APIs. The test class is placed in a <code>section03</code> package under the test directory, mirroring the application\'s <code>section03</code> package structure. The class is annotated with <code>@SpringBootTest</code> (with <code>webEnvironment</code> activating the full application context) and <code>@AutoConfigureWebTestClient</code>, which tells Spring to inject a ready-to-use <code>WebTestClient</code> bean. Because the server starts on a random port during integration tests, you only provide the URI path (e.g., <code>/customers</code>) — Spring automatically resolves the base URL.',
      'The first test validates the <code>GET /customers</code> endpoint. After calling <code>client.get().uri("/customers").exchange()</code>, the test chains assertions: <code>expectStatus().is2xxSuccessful()</code> verifies the HTTP status, <code>expectHeader().contentType(MediaType.APPLICATION_JSON)</code> checks the response content type, and <code>expectBodyList(CustomerDTO.class)</code> deserializes the response into a list of DTOs. The <code>value()</code> consumer receives the deserialized list, where you can perform further assertions — in this case, verifying the list size is 10 and printing the results.',
      'The second test targets the paginated endpoint <code>GET /customers/paginated?page=3&size=2</code>. Instead of deserializing into Java objects, this test uses <strong>JsonPath</strong> assertions directly on the raw response body. The <code>consumeWith()</code> method captures the raw <code>EntityExchangeResult&lt;byte[]&gt;</code> for debugging — converting the byte array to a string prints the full JSON response. JsonPath expressions then validate the structure: <code>$..length()</code> checks the array has 2 items, <code>$[0].id</code> asserts the first item\'s ID is 5, and <code>$[1].id</code> asserts the second is 6. This approach is useful when you want to validate specific fields without mapping the entire response to domain objects.',
      'A key advantage of <code>@AutoConfigureWebTestClient</code> is that the <code>WebTestClient</code> handles the full HTTP round-trip internally — starting the server, binding to a random port, and resolving the complete URL from just the path. If an assertion fails (e.g., expecting ID 15 instead of the actual 5), the test output clearly shows the expected vs. actual values, making debugging straightforward.',
    ],
    keyPoints: [
      'Annotate the test class with <code>@SpringBootTest</code> and <code>@AutoConfigureWebTestClient</code> to get a configured <code>WebTestClient</code> bean injected automatically.',
      'With <code>@AutoConfigureWebTestClient</code>, provide only the URI path — Spring resolves the base URL from the random port the server starts on.',
      'Use <code>expectBodyList(CustomerDTO.class).hasSize(10)</code> to deserialize and assert the response as a typed list.',
      'Use <code>expectBody().jsonPath("$")</code> for JsonPath-based assertions on the raw JSON — ideal for validating specific fields like <code>$[0].id</code> without full deserialization.',
      '<code>consumeWith()</code> gives access to the raw <code>EntityExchangeResult&lt;byte[]&gt;</code> for debugging or logging the actual response body.',
      'JsonPath expression <code>$..length()</code> returns the number of elements in the response array — chain <code>.isEqualTo(2)</code> to assert the count.',
    ],
    code: `package com.calmwindsgroup.playground.section03;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.reactive.server.WebTestClient;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.reactive.AutoConfigureWebTestClient;

import com.calmwindsgroup.playground.section03.dto.CustomerDTO;

@SpringBootTest
@AutoConfigureWebTestClient
@TestPropertySource(properties = "spring.profiles.active=section03")
class CustomerServiceTest {

    @Autowired
    private WebTestClient client;

    @Test
    void allCustomers() {
        this.client
                .get()
                .uri("/customers")
                .exchange()
                .expectStatus().is2xxSuccessful()
                .expectHeader().contentType(MediaType.APPLICATION_JSON)
                .expectBodyList(CustomerDTO.class)
                .hasSize(10)
                .value(list -> System.out.println("Customers: `,
    codeLabel: 'java',
    note: {
      label: 'WHY THIS MATTERS',
      text: 'Integration tests with WebTestClient exercise the full Spring context — routing, controllers, services, and repositories — without needing to manually start a server or hardcode a port. This catches wiring and serialization issues that unit tests miss.',
      tone: 'green',
    },
    quiz: {
      question: 'When using @AutoConfigureWebTestClient in an integration test, why do you only need to provide the URI path (e.g., "/customers") instead of the full URL (e.g., "http://localhost:8080/customers")?',
      options: [
        { label: 'Because WebTestClient always defaults to localhost:8080', correct: false },
        { label: 'Because Spring starts the server on a random port and automatically resolves the base URL for the WebTestClient', correct: true },
        { label: 'Because the test doesn\'t actually make HTTP requests — it mocks the controller layer', correct: false },
        { label: 'Because the URI path is resolved from the application.properties file', correct: false },
      ],
      explanation: 'With @AutoConfigureWebTestClient, Spring Boot starts the application on a random port and configures the WebTestClient with the correct base URL automatically. This avoids port conflicts and ensures the client always points to the running server instance.',
    },
  },
  {
    id: '5.15',
    title: 'Integration Testing - Part 2',
    duration: '5 min',
    kind: 'demo',
    summary: [
      'Building on the <code>WebTestClient</code> setup from Part 1, this lesson adds integration tests for the remaining CRUD endpoints: get-by-id, create, delete, and update. Each test follows the same pattern — send a request via <code>WebTestClient</code>, verify the status code, and assert on the response body using JSON path expressions.',
      'The get-by-id test targets <code>/customers/1</code> and asserts that the returned JSON object (not an array) contains the expected <code>id</code>, <code>name</code>, and <code>email</code> fields. The instructor deliberately introduces a typo (<code>Same</code> instead of <code>Sam</code>) to confirm the test actually fails, reinforcing that assertions are meaningful.',
      'The create and delete operations are combined into a single test method. First, a POST sends a new <code>CustomerDto</code> (with <code>null</code> id) as the request body via <code>.bodyValue()</code>, then asserts the response contains the assigned id (11), the correct name (<code>Marshall</code>), and email. Immediately after, a DELETE to <code>/customers/11</code> removes the just-created record, and <code>expectBody().isEmpty()</code> verifies the empty response body.',
      'The update test sends a PUT to <code>/customers/10</code> with an updated name (<code>Noel</code>) and email, then asserts the response body reflects the changes while preserving the original id of 10. A key reminder: use PUT (not POST) for updates, and pass the request body with <code>.bodyValue()</code>.',
    ],
    keyPoints: [
      'Use <code>expectBody().jsonPath("$.id").isEqualTo(...)</code> for single-object responses; arrays from list endpoints use <code>$[0].field</code> notation.',
      '<code>.bodyValue()</code> is the idiomatic way to attach a request body for POST/PUT when the payload is a plain object (not a reactive type).',
      'Combine create + delete in one test to keep the database state clean — insert a record, verify it, then immediately delete it and verify the empty body.',
      'Always use the correct HTTP verb: POST for create, PUT for update. Mixing them up is a common source of test failures.',
      '<code>expectBody().isEmpty()</code> asserts that a DELETE (or any no-content) endpoint returns an empty response body.',
      'Deliberately breaking an assertion (e.g., changing <code>Sam</code> to <code>Same</code>) is a quick way to confirm the test is actually validating what you think it is.',
    ],
    code: `package com.example.section05.integration;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.reactive.server.WebTestClient;

// ... (WebTestClient setup from Part 1)

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class CustomerIntegrationTest {

    @Autowired
    private WebTestClient client;

    @Test
    void getCustomerById() {
        this.client.get()
                .uri("/customers/1")
                .exchange()
                .expectStatus().is2xxSuccessful()
                .expectBody()
                .jsonPath("$.id").isEqualTo(1)
                .jsonPath("$.name").isEqualTo("Sam")
                .jsonPath("$.email").isEqualTo("sam@gmail.com");
    }

    @Test
    void createAndDeleteCustomer() {
        // Create
        var newCustomer = new CustomerDto(null, "Marshall", "marshall@gmail.com");

        this.client.post()
                .uri("/customers")
                .bodyValue(newCustomer)
                .exchange()
                .expectStatus().is2xxSuccessful()
                .expectBody()
                .jsonPath("$.id").isEqualTo(11)
                .jsonPath("$.name").isEqualTo("Marshall")
                .jsonPath("$.email").isEqualTo("marshall@gmail.com");

        // Delete the record we just created
        this.client.delete()
                .uri("/customers/11")
                .exchange()
                .expectStatus().is2xxSuccessful()
                .expectBody().isEmpty();
    }

    @Test
    void updateCustomer() {
        var updatedCustomer = new CustomerDto(10, "Noel", "noel@gmail.com");

        this.client.put()
                .uri("/customers/10")
                .bodyValue(updatedCustomer)
                .exchange()
                .expectStatus().is2xxSuccessful()
                .expectBody()
                .jsonPath("$.id").isEqualTo(10)
                .jsonPath("$.name").isEqualTo("Noel")
                .jsonPath("$.email").isEqualTo("noel@gmail.com");
    }
}`,
    codeLabel: 'java',
    note: {
      label: 'WHEN TO USE',
      text: 'Combine create and delete in a single test when you want to avoid leaving test data in the database. This keeps each test self-cleaning without needing a separate teardown step.',
      tone: 'green',
    },
    quiz: {
      question: 'When testing a single-object GET endpoint (e.g., /customers/1) versus a list endpoint (e.g., /customers), how does the JSON path expression differ?',
      options: [
        { label: 'Single object uses $.field; list uses $[0].field', correct: true },
        { label: 'Both use $.field — WebTestClient auto-detects the structure', correct: false },
        { label: 'Single object uses $[0].field; list uses $.field', correct: false },
        { label: 'You must use expectBodyList for both', correct: false },
      ],
      explanation: 'A single-object response is a JSON object, so you access fields directly with $.field. A list response is a JSON array, so you index into it with $[0].field. Using the wrong notation will cause the JSON path assertion to fail.',
    },
  },
  {
    id: '5.16',
    title: 'Integration Testing - Part 3',
    duration: '3 min',
    kind: 'demo',
    summary: [
      'Building on the happy-path tests from the previous two lessons, this lesson adds tests for the <strong>customer-not-found</strong> error scenarios across GET, DELETE, and PUT endpoints. When a request targets a non-existent customer (e.g., id 11), the controller responds with a 404 status and an empty body — these tests verify that behavior.',
      'The GET test sends a request to <code>/customers/11</code> and asserts <code>is4xxClientError()</code> (or <code>isNotFound()</code> for an exact 404 check) followed by <code>expectBody().isEmpty()</code>. The DELETE test mirrors this exactly since it requires no request body. The PUT test follows the same status and body assertions but additionally requires a request body via <code>.bodyValue()</code>, since PUT semantics demand a full entity representation.',
      'The instructor demonstrates a common testing pitfall: using the broader <code>is4xxClientError()</code> assertion when the endpoint actually returns a specific 404. Switching to <code>isNotFound()</code> makes the test more precise and catches accidental status code changes. Finally, all tests are run together to confirm there are no side effects from test execution order — a reactive integration test suite must be idempotent regardless of which tests run first or last.',
    ],
    keyPoints: [
      'Test non-existent customer (id 11) for GET, DELETE, and PUT endpoints',
      'Use <code>isNotFound()</code> for precise 404 assertion instead of the broader <code>is4xxClientError()</code>',
      'Assert <code>expectBody().isEmpty()</code> to verify no body is returned for error responses',
      'PUT error tests still require <code>.bodyValue()</code> — the request body must be present even when the id doesn\'t exist',
      'Run the full test suite to verify no test-ordering side effects or shared-state contamination',
    ],
    code: `// ... (Customer entity, repository, service, and controller from lessons 5.3–5.5)
// ... (WebTestClient setup and happy-path tests from lessons 5.14–5.15)

@Test
void getCustomer_notFound() {
    this.client.get()
            .uri("/customers/11")
            .exchange()
            .expectStatus().isNotFound()
            .expectBody().isEmpty();
}

@Test
void deleteCustomer_notFound() {
    this.client.delete()
            .uri("/customers/11")
            .exchange()
            .expectStatus().isNotFound()
            .expectBody().isEmpty();
}

@Test
void putCustomer_notFound() {
    var updated = new Customer(null, "devo", "devo@gmail.com");

    this.client.put()
            .uri("/customers/11")
            .bodyValue(updated)
            .exchange()
            .expectStatus().isNotFound()
            .expectBody().isEmpty();
}`,
    codeLabel: 'java',
    note: {
      label: 'WARNING',
      text: 'Using <code>is4xxClientError()</code> instead of <code>isNotFound()</code> makes tests pass for any 4xx code (400, 403, 404, etc.), masking unintended status changes. Always assert the exact status code when the API contract specifies one.',
      tone: 'green',
    },
    quiz: {
      question: 'Why does the PUT not-found test require a <code>.bodyValue()</code> call even though the customer id doesn\'t exist?',
      options: [
        { label: 'The controller deserializes the body before checking if the customer exists', correct: true },
        { label: 'It is optional — the test would pass without it', correct: false },
        { label: 'WebTestClient requires a body for all PUT requests at the framework level', correct: false },
        { label: 'It triggers a different error code than 404', correct: false },
      ],
      explanation: 'Spring WebFlux reads and deserializes the request body as part of processing the PUT endpoint before the service layer checks whether the customer exists. Omitting the body would cause a 400 Bad Request for malformed/missing body content rather than the intended 404 Not Found, making the test validate the wrong scenario.',
    },
  },
  {
    id: '5.17',
    title: 'POST / PUT - Body Publisher vs Body Value',
    duration: '2 min',
    kind: 'faq',
    summary: [
      'In <code>WebTestClient</code> (and later <code>WebClient</code>), the <code>POST</code> and <code>PUT</code> request builders offer two methods for supplying a request body: <code>bodyValue()</code> and <code>body()</code>. The distinction hinges on whether you already hold a concrete object in memory or instead possess a <em>publisher</em> (<code>Mono</code> or <code>Flux</code>) that will asynchronously produce the value.',
      'Use <code>bodyValue(Object value)</code> when you have the actual object available right now — for example, a <code>CustomerDto</code> you constructed in a test. The object is already resolved in memory, so you simply hand it off and Spring handles the serialization.',
      'Use <code>body(Publisher<? extends T> publisher, Class<T> elementClass)</code> when the data arrives asynchronously as a reactive type — for instance, a <code>Mono&lt;CustomerDto&gt;</code> returned from a database call that might complete seconds later. Because the publisher hasn\'t emitted yet, you must also declare the element class (<code>CustomerDto.class</code>) so Spring knows how to serialize each emitted item. This pattern is essential in non-blocking pipelines where you never block to unwrap the publisher yourself.',
      'In the integration tests written so far, <code>bodyValue()</code> is sufficient because test fixtures are concrete objects. The <code>body()</code> variant becomes important when building real reactive client pipelines with <code>WebClient</code>, covered in a later section.',
    ],
    keyPoints: [
      '<code>bodyValue(Object)</code> — use when you already have a concrete, in-memory object like a <code>CustomerDto</code>.',
      '<code>body(Publisher, Class)</code> — use when you have a <code>Mono</code> or <code>Flux</code> that will asynchronously emit the value(s).',
      '<code>Mono</code> and <code>Flux</code> are <em>publisher types</em>, not plain objects — they represent values that arrive over time.',
      'When using <code>body()</code>, you must also pass the element class (e.g., <code>CustomerDto.class</code>) so the framework knows the type to serialize.',
      'For <code>WebTestClient</code> tests with static fixtures, <code>bodyValue()</code> is almost always the right choice.',
    ],
    code: `// === bodyValue() — you have the concrete object in hand ===

CustomerDto dto = new CustomerDto("John", "Doe", "john@example.com");

webTestClient.post()
    .uri("/customers")
    .bodyValue(dto)                    // object is already resolved
    .exchange()
    .expectStatus().isCreated();

// === body() — you have a publisher that will emit the object later ===

Mono<CustomerDto> dtoMono = customerRepository.findById("123")
    .map(c -> new CustomerDto(c.getFirstName(), c.getLastName(), c.getEmail()));

webTestClient.put()
    .uri("/customers/123")
    .body(dtoMono, CustomerDto.class)  // publisher + element type
    .exchange()
    .expectStatus().isOk();

// WebClient equivalent (used in later sections):
//
// webClient.post()
//     .uri("/customers")
//     .body(dtoMono, CustomerDto.class)
//     .retrieve()
//     .bodyToMono(Void.class);`,
    codeLabel: 'java',
    note: {
      label: 'WHEN TO USE',
      text: 'Use <code>bodyValue()</code> for concrete objects you already hold; use <code>body()</code> when the value comes from a reactive source like a database call or another service. Passing a <code>Mono</code> to <code>bodyValue()</code> will serialize the publisher itself, not the emitted value.',
      tone: 'accent',
    },
    quiz: {
      question: 'You have a Mono<CustomerDto> returned from a service call and you need to send it as the body of a POST request. Which method should you use?',
      options: [
        { label: 'bodyValue(dtoMono)', correct: false },
        { label: 'body(dtoMono, CustomerDto.class)', correct: true },
        { label: 'bodyValue(dtoMono.block())', correct: false },
        { label: 'body(dtoMono)', correct: false },
      ],
      explanation: 'Because the value is wrapped in a Mono (a publisher type), you must use body() and declare the element class so Spring knows how to serialize the emitted CustomerDto. Using bodyValue() would attempt to serialize the Mono itself, and calling block() defeats the reactive non-blocking model.',
    },
  },
  {
    id: '5.18',
    title: 'Summary',
    duration: '2 min',
    kind: 'summary',
    summary: [
      'This section covered building reactive CRUD APIs with Spring WebFlux, from entity and DTO design through repository, service, and controller layers. We used <code>Mono</code> for single-value responses and <code>Flux</code> for streaming collections, and learned to set HTTP status codes via <code>ResponseEntity</code> for 4XX and other response scenarios.',
      'A key design takeaway: <code>Flux&lt;ResponseEntity&gt;</code> is not practical because HTTP status codes are sent once at the beginning of a response — you cannot emit different status codes per element in a stream. For <code>Flux</code> return types, the status is effectively fixed (typically 200 OK). To communicate validation errors or bad-request scenarios for streaming endpoints, use a global exception handler (<code>@ControllerAdvice</code>) rather than <code>ResponseEntity</code>. This pattern will be covered in the next section on input validation and error handling.',
      'We also explored <code>WebTestClient</code> for writing reactive integration tests. The workflow is straightforward: build a request with the appropriate HTTP method and path, call <code>exchange()</code> to send it, then assert on the response. Responses can be decoded into specific DTO types for direct JUnit assertions, or you can use JSONPath expressions to verify individual fields without deserializing the entire body.',
    ],
    keyPoints: [
      'Use <code>Mono&lt;ResponseEntity&gt;</code> when you need to control HTTP status codes for single-value responses.',
      'Avoid <code>Flux&lt;ResponseEntity&gt;</code> — HTTP status codes are sent once per response, not per stream element; use <code>@ControllerAdvice</code> for error handling on streaming endpoints instead.',
      '<code>WebTestClient</code> provides a fluent API: method <code>&#8594;</code> URI <code>&#8594;</code> <code>exchange()</code> <code>&#8594;</code> assertions via <code>expectBody()</code> or JSONPath.',
      'Decode response bodies into DTOs with <code>expectBody(Class&lt;T&gt;)</code> for type-safe JUnit assertions, or use <code>expectBody().jsonPath(...)</code> for lightweight field checks.',
      'Input validation and structured error handling via <code>@ControllerAdvice</code> will be covered in the next section.',
    ],
    note: {
      label: 'KEY INSIGHT',
      text: 'HTTP status codes are a response-level concern, not a per-element concern. This is why Flux&lt;ResponseEntity&gt; is an anti-pattern — the status header is already sent before the first element is emitted, so only one status code can ever apply to the entire stream.',
      tone: 'accent',
    },
    quiz: {
      question: 'Why is Flux<ResponseEntity> impractical for controlling HTTP status codes?',
      options: [
        { label: 'Because WebFlux does not support ResponseEntity with Flux return types', correct: false },
        { label: 'Because HTTP status codes are sent once at the start of the response, so per-element status codes are impossible', correct: true },
        { label: 'Because Flux always defaults to 500 Internal Server Error', correct: false },
        { label: 'Because ResponseEntity is not serializable in reactive streams', correct: false },
      ],
      explanation: 'HTTP status codes are transmitted in the response header before any body content. Since a Flux emits multiple elements over time, the status code has already been sent by the time the first element is emitted — making per-element status codes impossible. Use @ControllerAdvice for error handling on streaming endpoints instead.',
    },
  },
]
