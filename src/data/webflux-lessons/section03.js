export default [
  {
    id: '3.1',
    title: 'R2DBC - Introduction',
    duration: '3 min',
    kind: 'theory',
    summary: [
      'R2DBC stands for <strong>Reactive Relational Database Connectivity</strong>, a specification designed for reactive programming — analogous to how JPA (Java Persistence API) is a specification for traditional synchronous database access. The two are distinct specifications with different goals: JPA prioritizes developer convenience with rich ORM features, while R2DBC prioritizes performance, scalability, and streaming with backpressure (the ability of a downstream consumer to signal an upstream producer to slow down, preventing memory overload).',
      'A key distinction is that R2DBC does <em>not</em> support JPA/Hibernate-style relationship annotations like <code>@OneToMany</code> or <code>@ManyToMany</code>. While these annotations are popular, they commonly introduce the N+1 query problem (where fetching N parent entities triggers N additional queries to load child collections) and carry performance overhead from Hibernate\'s lazy-loading machinery. R2DBC deliberately avoids this path, offering only simple entity-object mapping without the full ORM feature set.',
      'R2DBC has matured significantly and now supports major relational databases including PostgreSQL, MySQL, MariaDB, Oracle, SQL Server, and Google Cloud Spanner. This course uses the H2 in-memory database for learning exercises, with PostgreSQL demonstrated later for production-style scenarios.',
      'Spring Data R2DBC wraps the raw R2DBC specification with the familiar Spring Data abstraction. If you have used Spring Data JPA, the developer experience is nearly identical: you create a repository interface, define query methods by naming convention, and Spring auto-generates the SQL. The only difference is that return types are reactive — <code>Mono&lt;T&gt;</code> for a single record and <code>Flux&lt;T&gt;</code> for multiple records — instead of synchronous <code>Optional</code> or collection types.',
    ],
    keyPoints: [
      'R2DBC is a reactive specification for relational database access, parallel to how JPA is a synchronous specification — they are <strong>not</strong> the same thing.',
      'R2DBC focuses on <strong>performance, scalability, and streaming with backpressure</strong> rather than rich ORM features.',
      'R2DBC does <strong>not</strong> support <code>@OneToMany</code>, <code>@ManyToMany</code>, or other Hibernate-style relationship annotations — this is a deliberate design choice to avoid N+1 problems and ORM overhead.',
      'Supported databases include PostgreSQL, MySQL, MariaDB, Oracle, SQL Server, H2, and Cloud Spanner.',
      'Spring Data R2DBC provides the same repository-interface abstraction as Spring Data JPA; the only API difference is returning <code>Mono</code> or <code>Flux</code> instead of synchronous types.',
    ],
    note: {
      label: 'WHY THIS MATTERS',
      text: 'R2DBC\'s deliberate omission of relationship annotations forces you to write explicit queries for joins and associations. This trades convenience for control and performance — you avoid the hidden N+1 queries that Hibernate\'s lazy loading can silently introduce in production.',
      tone: 'accent',
    },
    quiz: {
      question: 'You are migrating a Spring Data JPA repository to Spring Data R2DBC. Which of the following will you need to change?',
      options: [
        { label: 'Replace @OneToMany and @ManyToMany annotations with R2DBC equivalents', correct: false },
        { label: 'Change repository method return types from synchronous types to Mono/Flux', correct: true },
        { label: 'Switch from a relational database to a NoSQL database', correct: false },
        { label: 'Rewrite all query method names to use a different naming convention', correct: false },
      ],
      explanation: 'Spring Data R2DBC uses the same repository abstraction and query method naming conventions as Spring Data JPA. The primary change is that return types become reactive (Mono for single results, Flux for multiple). R2DBC does not offer relationship annotation equivalents — you handle joins manually via custom queries.',
    },
  },
  {
    id: '3.2',
    title: 'Connection String',
    duration: '2 min',
    kind: 'concept',
    summary: [
      'R2DBC connection strings follow a standard URL format: <code>r2dbc:&lt;database-type&gt;://&lt;host&gt;:&lt;port&gt;/&lt;database-name&gt;</code>. For PostgreSQL, this looks like <code>r2dbc:postgresql://localhost:5432/mydb</code>, and for MySQL, <code>r2dbc:mysql://localhost:3306/mydb</code>. The format is consistent across database vendors — only the scheme prefix and default port change.',
      'In this course, the examples use H2, an in-memory database, whose R2DBC URL is <code>r2dbc:h2:mem:///testdb</code>. Spring Boot\'s auto-configuration can often infer the driver and set up the connection pool without any URL at all, but explicitly providing the URL gives you control over the database name and connection parameters.',
      'The three key properties for configuring an R2DBC connection in <code>application.properties</code> or <code>application.yml</code> are <code>spring.r2dbc.url</code>, <code>spring.r2dbc.username</code>, and <code>spring.r2dbc.password</code>. These mirror the traditional JDBC properties (<code>spring.datasource.*</code>) but use the <code>r2dbc</code> namespace to signal that the driver should be non-blocking.',
    ],
    keyPoints: [
      'R2DBC URL format: <code>r2dbc:&lt;vendor&gt;://&lt;host&gt;:&lt;port&gt;/&lt;database&gt;</code>',
      'Configure connections via <code>spring.r2dbc.url</code>, <code>spring.r2dbc.username</code>, and <code>spring.r2dbc.password</code>',
      'H2 in-memory URL: <code>r2dbc:h2:mem:///&lt;dbname&gt;</code>',
      'Spring Boot can auto-configure R2DBC without an explicit URL, but providing one is recommended for clarity',
      'R2DBC properties use the <code>spring.r2dbc.*</code> namespace, distinct from JDBC\'s <code>spring.datasource.*</code>',
    ],
    code: `# PostgreSQL
spring.r2dbc.url=r2dbc:postgresql://localhost:5432/mydb
spring.r2dbc.username=postgres
spring.r2dbc.password=secret

# MySQL
# spring.r2dbc.url=r2dbc:mysql://localhost:3306/mydb
# spring.r2dbc.username=root
# spring.r2dbc.password=secret

# H2 (in-memory, used in this course)
# spring.r2dbc.url=r2dbc:h2:mem:///testdb
# spring.r2dbc.username=sa
# spring.r2dbc.password=`,
    codeLabel: 'properties',
    note: {
      label: 'KEY INSIGHT',
      text: 'The <code>r2dbc</code> scheme in the URL is what tells Spring Boot to use a reactive driver instead of a blocking JDBC driver. This single property switches the entire data layer to non-blocking I/O.',
      tone: 'accent',
    },
    quiz: {
      question: 'Which property is used to specify the R2DBC connection URL in Spring Boot?',
      options: [
        { label: 'spring.datasource.url', correct: false },
        { label: 'spring.r2dbc.url', correct: true },
        { label: 'spring.r2dbc.connection-string', correct: false },
        { label: 'spring.reactive.url', correct: false },
      ],
      explanation: 'R2DBC connections use the <code>spring.r2dbc.*</code> namespace. <code>spring.datasource.url</code> is for traditional JDBC (blocking) connections, while <code>spring.r2dbc.url</code> configures the reactive driver.',
    },
  },
  {
    id: '3.3',
    title: 'Project Setup',
    duration: '7 min',
    kind: 'setup',
    summary: [
      'This lesson sets up the database schema and Spring Boot configuration for the R2DBC section. The schema consists of three tables: <code>customer</code> (id, name, email), <code>product</code> (id, description, price), and <code>customer_order</code> (order_id as UUID primary key, customer_id foreign key, product_id foreign key, amount, order_date). The <code>customer_order</code> table links customers to the products they purchased, recording the price paid at the time of purchase — important because product prices in the <code>product</code> table may change over time, but the order record preserves what the customer actually paid.',
      'A SQL initialization file (<code>data.sql</code>) is placed under <code>src/main/resources/sql/</code>. It drops and recreates all three tables at startup, then inserts seed data into each. The drop-and-recreate approach is intentional: throughout this section, integration tests will mutate table rows, so having the schema and data rebuilt on each application start ensures a clean, predictable state. The file also inserts sample order records simulating purchases (e.g., Sam buys iPhone 20, Mike buys a product, Jake buys a product).',
      'Because the playground project accumulates code across multiple course sections, Spring\'s component scan and R2DBC repository scan could find duplicate bean definitions (e.g., two <code>ProductRepository</code> classes from different sections) and fail to start. To prevent this, the main application class is configured with <code>@SpringBootApplication(scanBasePackages = ...)</code> and <code>@EnableR2dbcRepositories(basePackages = ...)</code>, both pointing to a package path driven by an <code>application.properties</code> value. This isolates each section\'s beans so only the current section\'s classes are loaded.',
      'The <code>application.properties</code> file sets <code>section=02</code> (or <code>section02</code>), which feeds into the base package path <code>com.winsgroup.playground.${section}</code>. A separate Spring SQL initialization property (<code>spring.sql.init.data-locations</code>) tells Spring Boot to load the <code>data.sql</code> file from the custom <code>sql/</code> subdirectory. Without this property, Spring Boot would not auto-detect the file since it resides in a non-default location.',
    ],
    keyPoints: [
      'Three tables are created: <code>customer</code>, <code>product</code>, and <code>customer_order</code> — the order table uses a UUID primary key and foreign keys to both customer and product.',
      'The <code>data.sql</code> file drops and recreates tables on every startup to ensure a clean state for integration tests.',
      '<code>@SpringBootApplication(scanBasePackages = "com.winsgroup.playground.${section}")</code> limits component scanning to the current section\'s package, preventing bean conflicts across sections.',
      '<code>@EnableR2dbcRepositories(basePackages = "com.winsgroup.playground.${section}")</code> must be added separately because R2DBC does not use the standard Spring Data scan configuration.',
      '<code>spring.sql.init.data-locations=classpath:sql/data.sql</code> is required because the SQL file is in a custom subdirectory, not the default resources root.',
    ],
    code: `java`,
    codeLabel: 'java',
    note: {
      label: 'WHY THIS MATTERS',
      text: 'Isolating each section\'s beans via <code>scanBasePackages</code> is essential in a cumulative playground project. Without it, Spring would find duplicate repository definitions from different sections and throw a bean conflict exception on startup.',
      tone: 'accent',
    },
    quiz: {
      question: 'Why must <code>@EnableR2dbcRepositories(basePackages = ...)</code> be specified separately from <code>@SpringBootApplication(scanBasePackages = ...)</code>?',
      options: [
        { label: 'R2DBC repositories are not discovered by Spring\'s standard component scan and require their own annotation with an explicit base package.', correct: true },
        { label: 'It is optional; R2DBC repositories are always auto-discovered from the main application\'s scan base packages.', correct: false },
        { label: 'It is needed to enable transaction management for R2DBC.', correct: false },
        { label: 'It is required to specify the database connection URL.', correct: false },
      ],
      explanation: 'Spring Data R2DBC maintains its own repository scanning configuration independent of the standard <code>@ComponentScan</code> / <code>scanBasePackages</code> mechanism. If you only set <code>scanBasePackages</code> on <code>@SpringBootApplication</code>, R2DBC repositories will still be scanned from the default package, potentially picking up unwanted duplicates. You must explicitly configure <code>@EnableR2dbcRepositories(basePackages = ...)</code> to restrict where R2DBC looks for repository interfaces.',
    },
  },
  {
    id: '3.4',
    title: 'Spring Data - Crash Course',
    duration: '3 min',
    kind: 'theory',
    summary: [
      'Spring Data\'s core abstraction maps a database table to a Java entity class and a repository interface. The entity class represents a single row in the table — by convention the class name matches the table name, but if it doesn\'t, you annotate the class with <code>@Table</code> to specify the actual table name. This tells Spring Data R2DBC which table the entity maps to.',
      'For CRUD operations, Spring Data provides <code>ReactiveCrudRepository</code>, a generic interface parameterized by the entity type and the primary key type. You create your own repository interface by extending it — for example, <code>UserRepository extends ReactiveCrudRepository&lt;User, Integer&gt;</code>. The interface comes with built-in reactive methods like <code>findAll()</code>, <code>save()</code>, <code>delete()</code>, and <code>findById()</code> that return <code>Flux</code> or <code>Mono</code>.',
      'You never write an implementation class. At runtime, the Spring Data R2DBC module generates a proxy class that implements your repository interface. When you call <code>userRepository.findAll()</code>, Spring inspects the entity type, resolves the table name (from the class name or <code>@Table</code> annotation), and executes the appropriate SQL — e.g., <code>SELECT * FROM customer</code> — returning the results as a reactive <code>Flux&lt;User&gt;</code>.',
      'This crash course applies equally to the <code>Customer</code> entity we will create in the next lesson. The same pattern — entity class + repository interface extending <code>ReactiveCrudRepository</code> — is all you need to get full reactive CRUD support without writing a single line of SQL or implementation code.',
    ],
    keyPoints: [
      'An <strong>entity class</strong> represents a single row in a database table; by convention the class name matches the table name, but <code>@Table</code> can override it.',
      '<code>ReactiveCrudRepository&lt;T, ID&gt;</code> is the core Spring Data R2DBC interface — parameterized by entity type <code>T</code> and primary key type <code>ID</code>.',
      'You only define the repository <strong>interface</strong>; Spring Data R2DBC generates a proxy implementation at runtime.',
      'Built-in methods like <code>findAll()</code>, <code>save()</code>, <code>findById()</code>, and <code>delete()</code> return reactive types (<code>Flux</code> / <code>Mono</code>) — no SQL required for basic operations.',
      'Spring auto-generates SQL by resolving the table name from the entity class (or its <code>@Table</code> annotation) and the operation implied by the method name.',
    ],
    code: `package com.example.section03.entity;

import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Table;

// When the class name differs from the table name,
// use @Table to specify the actual table name.
// If the class were named Customer matching the table,
// the annotation would be unnecessary.
@Table("customer")
public class User {

    @Id
    private Integer id;
    private String name;
    private String email;

    public User() {
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
}
`,
    codeLabel: 'java',
    note: {
      label: 'KEY INSIGHT',
      text: 'Spring Data R2DBC\'s repository pattern eliminates boilerplate by generating a proxy implementation at runtime. You define only the interface, and Spring resolves table names, generates SQL, and wraps results in reactive types automatically.',
      tone: 'accent',
    },
    quiz: {
      question: 'If you name your entity class `User` but the database table is `customer`, what must you do so Spring Data R2DBC generates correct SQL?',
      options: [
        { label: 'Nothing — Spring auto-detects the table name from the database schema', correct: false },
        { label: 'Annotate the class with @Table("customer") to explicitly map the entity to the table', correct: true },
        { label: 'Rename the repository interface to CustomerRepository', correct: false },
        { label: 'Add a @Query annotation to every repository method', correct: false },
      ],
      explanation: 'When the class name doesn\'t match the table name, Spring Data R2DBC would look for a table named \'user\' by default. The @Table annotation (from org.springframework.data.relational.core.mapping) overrides this default and tells Spring which actual table the entity maps to.',
    },
  },
  {
    id: '3.5',
    title: 'Customer Entity / Repository',
    duration: '5 min',
    kind: 'demo',
    summary: [
      'With the project setup and Spring Data crash course behind us, this lesson creates the core domain objects for the section: the <code>Customer</code> entity and the <code>CustomerRepository</code> interface. The entity is placed in a <code>section02.entity</code> package and the repository in <code>section02.repository</code>, both under the base package <code>com.vinsguru.playground</code>. The <code>Customer</code> class maps to the <code>customer</code> table with three columns: <code>id</code>, <code>name</code>, and <code>email</code>.',
      'Spring Data R2DBC uses a convention-over-configuration approach: if the class name matches the table name and field names match column names, no explicit mapping annotations are needed. The instructor adds <code>@Table</code> and <code>@Column</code> annotations for demonstration, but the only strictly required annotation is <code>@Id</code> (from <code>org.springframework.data.annotation</code>), which marks the primary key field. Without <code>@Id</code>, Spring Data R2DBC cannot identify the entity\'s primary key and repository save/update operations will fail.',
      'The <code>CustomerRepository</code> is a simple interface extending <code>ReactiveCrudRepository&lt;Customer, Integer&gt;</code>. This gives us reactive CRUD methods out of the box — <code>save</code> returns <code>Mono&lt;Customer&gt;</code>, <code>findAll</code> returns <code>Flux&lt;Customer&gt;</code>, <code>findById</code> returns <code>Mono&lt;Customer&gt;</code>, <code>count</code> returns <code>Mono&lt;Long&gt;</code>, and <code>deleteById</code> returns <code>Mono&lt;Void&gt;</code>. The <code>@Repository</code> annotation is added for good practice. The return types follow a clear pattern: <code>Flux</code> for zero-or-more results, <code>Mono</code> for single results or completion signals.',
      'Finally, an <code>AbstractTest</code> base class is created under <code>src/test/java</code> in the <code>com.vinsguru.playground.test.section02</code> package. This abstract class carries the <code>@SpringBootTest</code> annotation and sets the <code>section</code> property to <code>section02</code> via <code>@TestPropertySource</code>. This mirrors the pattern from section 01: by setting <code>section=section02</code>, the application\'s package-based bean loading picks up only the classes under the <code>section02</code> package, keeping tests isolated and fast.',
    ],
    keyPoints: [
      '<code>@Id</code> from <code>org.springframework.data.annotation</code> is the only mandatory annotation — without it, Spring Data R2DBC cannot identify the primary key',
      '<code>@Table</code> and <code>@Column</code> are optional — needed only when the Java class/field names differ from the database table/column names',
      '<code>ReactiveCrudRepository&lt;T, ID&gt;</code> provides reactive CRUD methods: <code>Flux</code> for multi-result queries, <code>Mono</code> for single-result operations',
      'The <code>section</code> test property controls which package\'s beans are loaded, keeping each section\'s tests isolated',
      'Standard getters/setters and <code>toString</code> are sufficient — Lombok is optional but convenient',
    ],
    code: `java`,
    codeLabel: 'java',
    note: {
      label: 'KEY INSIGHT',
      text: 'Unlike JPA/Hibernate, Spring Data R2DBC does not auto-generate IDs by default. The @Id annotation marks the primary key, but you must handle ID generation (e.g., database AUTO_INCREMENT) at the database level or via a custom strategy.',
      tone: 'accent',
    },
    quiz: {
      question: 'Which annotation is strictly required on the Customer entity for Spring Data R2DBC to function correctly?',
      options: [
        { label: '@Table', correct: false },
        { label: '@Id', correct: true },
        { label: '@Column', correct: false },
        { label: '@Entity', correct: false },
      ],
      explanation: '@Id (from org.springframework.data.annotation) is mandatory — it tells Spring Data R2DBC which field is the primary key. @Table and @Column are optional (only needed when names don\'t match), and @Entity is a JPA annotation, not used in R2DBC.',
    },
  },
  {
    id: '3.6',
    title: 'Step Verifier - Crash Course',
    duration: '5 min',
    kind: 'concept',
    summary: [
      '<code>StepVerifier</code> is a testing utility provided by Project Reactor (via <code>reactor-test</code>) that lets you assert against the signals emitted by a <em>reactive publisher</em> — <code>Mono</code> or <code>Flux</code>. Because reactive streams are asynchronous and lazy, traditional assertions don\'t work; you need a subscriber that <em>verifies</em> each signal in order. This is essential for the upcoming lessons where we test R2DBC repository methods that return <code>Mono</code> and <code>Flux</code> types.',
      'The workflow is straightforward: first obtain a publisher (e.g., a repository method call), then pass it to <code>StepVerifier.create(publisher)</code> to build a verification chain. You assert each emitted item with <code>expectNext(...)</code> in the exact order it arrives. For large numbers of items, use <code>expectNextCount(n)</code> instead of chaining dozens of <code>expectNext</code> calls. After asserting all expected items, you specify what terminal signal you anticipate: <code>expectComplete()</code> for a successful stream or <code>expectError()</code> for a failure.',
      'The final and most easily forgotten step is <code>verify()</code>. Without it, nothing actually subscribes to the publisher and no assertions run — the test silently passes without testing anything. A convenient shorthand is to use the <code>as(StepVerifier::create)</code> operator available on <code>Mono</code> and <code>Flux</code>, which lets you chain the verifier inline with the publisher pipeline.',
    ],
    keyPoints: [
      '<code>StepVerifier</code> (from <code>reactor-test</code>) is the standard way to test Project Reactor publishers like <code>Mono</code> and <code>Flux</code>.',
      'Use <code>expectNext(value)</code> to assert each emitted item in order; use <code>expectNextCount(n)</code> when many items are expected.',
      'After asserting items, specify the terminal signal with <code>expectComplete()</code> or <code>expectError()</code>.',
      '<strong>Always call <code>verify()</code></strong> at the end — it subscribes to the publisher and actually executes the assertions.',
      '<code>Mono</code> and <code>Flux</code> have an <code>as(StepVerifier::create)</code> method for inline chaining of the verifier.',
    ],
    code: `import org.junit.jupiter.api.Test;
import reactor.core.publisher.Flux;
import reactor.test.StepVerifier;

public class StepVerifierCrashCourseTest {

    @Test
    void verifyFluxItemsAndCompleteSignal() {
        // The publisher under test — could be a repository or service method
        Flux<Integer> publisher = Flux.just(1, 2);

        StepVerifier
                .create(publisher)
                .expectNext(1)          // assert first emitted item
                .expectNext(2)          // assert second emitted item
                .expectComplete()       // assert the publisher completes successfully
                .verify();              // subscribes and runs the assertions
    }

    @Test
    void verifyFluxWithCountAndCompleteSignal() {
        // For publishers emitting many items, use expectNextCount instead
        Flux<Integer> publisher = Flux.range(1, 100);

        StepVerifier
                .create(publisher)
                .expectNextCount(100)   // assert 100 items are emitted
                .expectComplete()
                .verify();
    }

    @Test
    void verifyUsingAsOperatorInline() {
        // Mono and Flux provide an as() operator for inline StepVerifier chaining
        Flux.just(1, 2)
                .as(StepVerifier::create)
                .expectNext(1)
                .expectNext(2)
                .expectComplete()
                .verify();
    }
}`,
    codeLabel: 'java',
    note: {
      label: 'WARNING',
      text: 'Forgetting to call <code>verify()</code> is the most common StepVerifier mistake — without it, the publisher is never subscribed to and no assertions are actually evaluated, resulting in a test that passes vacuously.',
      tone: 'accent',
    },
    quiz: {
      question: 'You write a StepVerifier chain with <code>expectNext(1)</code>, <code>expectNext(2)</code>, and <code>expectComplete()</code> but forget to call <code>verify()</code>. What happens?',
      options: [
        { label: 'The test fails because the publisher was not subscribed', correct: false },
        { label: 'The test passes without actually evaluating any assertions', correct: true },
        { label: 'The test throws a runtime exception', correct: false },
        { label: 'The test blocks indefinitely waiting for items', correct: false },
      ],
      explanation: 'Without <code>verify()</code>, StepVerifier never subscribes to the publisher, so none of the <code>expectNext</code> or <code>expectComplete</code> assertions are ever checked. The test framework sees no failures and reports a pass, making it a false positive.',
    },
  },
  {
    id: '3.7',
    title: 'CRUD Using Repository - Part 1',
    duration: '9 min',
    kind: 'demo',
    summary: [
      'Building on the <code>CustomerRepository</code> and <code>StepVerifier</code> covered in earlier lessons, this lesson demonstrates basic reactive CRUD operations. We create a test class that autowires the repository and uses <code>StepVerifier</code> to verify results. The <code>findAll</code> method returns a <code>Flux&lt;Customer&gt;</code> — since <code>data.sql</code> inserts ten records, we assert <code>expectNextCount(10)</code> followed by <code>expectComplete</code>. The <code>findById</code> method returns a <code>Mono&lt;Customer&gt;</code>, which we validate with <code>assertNext</code> using JUnit\'s <code>Assertions.assertEquals</code> to check the customer name.',
      'When <code>findById</code> is called with a non-existent ID (e.g., 25), the <code>Mono</code> completes empty — it does <em>not</em> emit an error. If your <code>StepVerifier</code> chain expects an <code>onNext</code> signal but receives <code>onComplete</code> instead, the test fails with a mismatch. This is an important behavioral difference between reactive empty signals and traditional null returns.',
      'Beyond standard CRUD methods, Spring Data R2DBC supports <strong>derived query methods</strong> — the same convention-based query derivation as Spring Data JPA. Adding a method like <code>findByName(String name)</code> to the repository interface causes Spring to automatically generate <code>SELECT * FROM customer WHERE name = :name</code> at runtime. The only reactive-specific difference is that return types must be <code>Flux</code> or <code>Mono</code> rather than <code>List</code> or <code>Optional</code>.',
      'The lesson concludes with a mini-assignment: expose a method to find customers whose email ends with a given suffix (e.g., <code>EndingWith</code>). Using the Spring Data query method keyword <code>EndingWith</code>, the method <code>findByEmailEndingWith(String email)</code> generates a SQL <code>LIKE</code> query with a trailing wildcard. The test verifies that searching for <code>ke@gmail.com</code> returns Mike and Jake in insertion order.',
    ],
    keyPoints: [
      '<strong>findAll</strong> returns <code>Flux&lt;Customer&gt;</code>; use <code>expectNextCount(n)</code> to assert the number of emitted items.',
      '<strong>findById</strong> returns <code>Mono&lt;Customer&gt;</code>; use <code>assertNext</code> with <code>Assertions.assertEquals</code> to validate the entity.',
      'A non-existent ID produces an <strong>empty Mono</strong> (completes without emitting) — not an error. <code>StepVerifier</code> will fail if it expects <code>onNext</code> but only receives <code>onComplete</code>.',
      'Spring Data R2DBC supports <strong>derived query methods</strong> (e.g., <code>findByName</code>, <code>findByEmailEndingWith</code>) just like Spring Data JPA — the framework auto-generates the SQL.',
      'Query method keywords like <code>EndingWith</code> translate to SQL <code>LIKE \'%suffix\'</code> queries. See the <a href="https://docs.spring.io/spring-data/relational/reference/r2dbc/repositories/query-methods.html">Spring Data query method reference</a> for the full keyword list.',
      'Reactive repositories differ from blocking ones only in return types: <code>Flux</code> for multiple results, <code>Mono</code> for single or empty results.',
    ],
    code: `java`,
    codeLabel: 'java',
    note: {
      label: 'KEY INSIGHT',
      text: 'An empty Mono (no matching record) emits onComplete <em>without</em> onNext. Always design your StepVerifier expectations to account for the empty case — use expectComplete() without expectNext/assertNext when querying for potentially non-existent records.',
      tone: 'accent',
    },
    quiz: {
      question: 'You call findById(999) for a non-existent customer and write StepVerifier.create(repository.findById(999)).assertNext(c -> assertEquals("Bob", c.getName())).expectComplete().verify(). What happens?',
      options: [
        { label: 'The test passes because the Mono completes successfully.', correct: false },
        { label: 'The test fails because assertNext expects an onNext signal but the Mono completes empty.', correct: true },
        { label: 'The test throws a NullPointerException at runtime.', correct: false },
        { label: 'The test fails because findById throws an exception for missing IDs.', correct: false },
      ],
      explanation: 'A reactive findById with no matching record returns an empty Mono — it emits onComplete immediately without any onNext signal. Since assertNext consumes an onNext item, the StepVerifier fails reporting that it expected onNext but received onComplete. To handle the empty case, omit assertNext and use expectComplete() directly.',
    },
  },
  {
    id: '3.8',
    title: 'CRUD Using Repository - Part 2',
    duration: '5 min',
    kind: 'concept',
    summary: [
      '[Content generation failed - raw transcript available in source folder]',
    ],
  },
  {
    id: '3.9',
    title: 'CRUD Using Repository - Part 3',
    duration: '5 min',
    kind: 'demo',
    summary: [
      'This lesson focuses on the update operation in a reactive R2DBC pipeline. A key conceptual point is that while reactive programming encourages pure functions and immutability, database tables are inherently mutable — records get inserted, updated, and deleted. Since an entity object represents a single row in that table, it is perfectly acceptable to mutate the entity within a reactive pipeline. The instructor cautions against blindly applying functional purity everywhere without understanding the context.',
      'To mutate an entity retrieved from the reactive pipeline, the <code>doOnNext</code> operator is used. <code>doOnNext</code> is a side-effect operator that fires for each emitted item, allowing you to modify the entity (e.g., call <code>setName</code>) at the moment the data arrives. This is the reactive equivalent of the traditional <code>customer.setName(...)</code> pattern. Importantly, even though the pipeline may span multiple schedulers and thread pools, operators for a given item are invoked <em>sequentially</em>, never concurrently — so you do not need to worry about thread-safety for mutable state within a single reactive chain.',
      'The update flow demonstrated is: fetch a customer by name using <code>findByName</code>, mutate the name inside <code>doOnNext</code>, then persist the change using <code>flatMap</code> with <code>repository.save()</code>. <code>flatMap</code> is required here (not <code>map</code>) because <code>save()</code> returns a <code>Mono</code> — nesting a <code>Mono</code> inside another <code>Mono</code> with <code>map</code> would yield <code>Mono&lt;Mono&lt;Customer&gt;&gt;</code>, which is not what we want. The test verifies that after saving, the returned customer\'s name equals the updated value.',
      'This pattern — fetch, mutate via <code>doOnNext</code>, save via <code>flatMap</code> — is the canonical reactive CRUD update workflow when using Spring Data R2DBC repositories. It preserves non-blocking I/O while allowing straightforward entity mutation.',
    ],
    keyPoints: [
      'Database tables and their entity representations are mutable by nature — mutating an entity in a reactive pipeline is acceptable and expected.',
      'Use <code>doOnNext</code> to apply side-effect mutations (like <code>setName</code>) to entities emitted by the reactive pipeline.',
      'Reactive operators for a single item execute <strong>sequentially</strong>, never concurrently — no extra thread-safety work is needed for mutable state within one chain.',
      'Use <code>flatMap</code> (not <code>map</code>) when calling <code>repository.save()</code>, because <code>save()</code> returns a <code>Mono</code> and you want to avoid <code>Mono&lt;Mono&lt;T&gt;&gt;</code> nesting.',
      'The canonical update flow is: <code>findByName</code> → <code>doOnNext</code> (mutate) → <code>flatMap</code> (save) → <code>StepVerifier</code> assertion.',
    ],
    code: `@Test
void updateCustomer() {
    // ... (Customer entity and CustomerRepository from lesson 3.5)

    this.repository.findByName("ethan")
            .doOnNext(customer -> customer.setName("noel"))
            .flatMap(customer -> this.repository.save(customer))
            .doOnNext(customer -> System.out.println(customer))
            .as(StepVerifier::create)
            .assertNext(c -> Assertions.assertEquals("noel", c.getName()))
            .verifyComplete();
}`,
    codeLabel: 'java',
    note: {
      label: 'KEY INSIGHT',
      text: 'Reactive pipelines execute operators for a single item sequentially, never concurrently. This means you can safely mutate entity state inside operators like doOnNext without worrying about race conditions within that chain.',
      tone: 'accent',
    },
    quiz: {
      question: 'When calling repository.save(customer) inside a reactive pipeline, why must you use flatMap instead of map?',
      options: [
        { label: 'Because map is not available on Mono', correct: false },
        { label: 'Because save() returns a Mono<Customer>, and using map would result in Mono<Mono<Customer>> instead of Mono<Customer>', correct: true },
        { label: 'Because flatMap runs on a separate thread', correct: false },
        { label: 'Because map does not support side effects', correct: false },
      ],
      explanation: 'map performs a synchronous 1-to-1 transformation, so wrapping a Mono-returning call inside map nests the Mono, producing Mono<Mono<Customer>>. flatMap asynchronously flattens the inner Mono, giving you the unwrapped Mono<Customer> that StepVerifier can consume directly.',
    },
  },
  {
    id: '3.10',
    title: 'R2DBC - Show SQL',
    duration: '2 min',
    kind: 'demo',
    summary: [
      'Unlike Spring Data JPA — which provides the <code>spring.jpa.show-sql=true</code> property to log generated SQL — R2DBC has no equivalent built-in flag. This is because R2DBC bypasses Hibernate entirely and interacts with the database driver directly, so there is no ORM-level SQL generation layer to hook into.',
      'To see the SQL statements R2DBC executes (such as <code>CREATE TABLE</code>, <code>DROP TABLE</code>, <code>DELETE FROM customer WHERE customer_id = $1</code>), you can enable <code>DEBUG</code>-level logging for the <code>org.springframework.data.r2dbc</code> package. This is done by setting a logging property in your test class or <code>application.properties</code>.',
      'The instructor demonstrates this in the abstract test class (used as a shared base for all repository tests in this section) by adding a logging-level property. After enabling it, running the tests reveals all SQL statements in the console output — useful for debugging query generation and verifying that derived repository methods produce the expected SQL. The property is removed afterward since it is only needed temporarily.',
    ],
    keyPoints: [
      'R2DBC has no <code>show-sql</code> equivalent — that property is JPA/Hibernate-specific.',
      'Enable <code>DEBUG</code> logging on <code>org.springframework.data.r2dbc</code> to see executed SQL statements.',
      'This is a logging-level change, not a framework feature flag — it works because Spring Data R2DBC logs queries at <code>DEBUG</code> level.',
      'Useful for verifying that derived repository methods generate the SQL you expect.',
      'Can be set in <code>application.properties</code> or directly in a test class for temporary debugging.',
    ],
    code: `# In application.properties (or application-test.properties)
logging.level.org.springframework.data.r2dbc=DEBUG

# --- Alternatively, as a JVM system property in an abstract test class ---
# AbstractIntegrationTest.java

import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;

@SpringBootTest
@TestPropertySource(properties = {
    "logging.level.org.springframework.data.r2dbc=DEBUG"
})
public abstract class AbstractIntegrationTest {
    // ... shared test configuration (e.g., R2DBC connection setup)
}`,
    codeLabel: 'properties',
    note: {
      label: 'WHEN TO USE',
      text: 'Enable R2DBC DEBUG logging when you need to verify that derived repository methods or custom @Query annotations produce the expected SQL — then remove it to keep test output clean.',
      tone: 'accent',
    },
    quiz: {
      question: 'Why can\'t you use spring.jpa.show-sql=true to see SQL statements in an R2DBC project?',
      options: [
        { label: 'Because R2DBC uses a different driver that doesn\'t support SQL logging', correct: false },
        { label: 'Because show-sql is a JPA/Hibernate property and R2DBC bypasses Hibernate entirely, interacting with the database driver directly', correct: true },
        { label: 'Because the property name is spring.r2dbc.show-sql, not spring.jpa.show-sql', correct: false },
        { label: 'Because R2DBC doesn\'t execute SQL — it uses a NoSQL-style protocol', correct: false },
      ],
      explanation: 'The spring.jpa.show-sql property is specific to JPA/Hibernate\'s SQL generation layer. R2DBC does not use Hibernate at all — it communicates with the database driver directly — so the property has no effect. Instead, you enable DEBUG logging on org.springframework.data.r2dbc to see executed statements.',
    },
  },
  {
    id: '3.11',
    title: 'Assignment - Price Range Query Method',
    duration: '5 min',
    kind: 'assignment',
    summary: [
      'Building on the Customer entity and repository from earlier lessons, this assignment asks you to create a <code>Product</code> entity and a <code>ProductRepository</code>. The <code>Product</code> entity should have an <code>Integer id</code> (primary key), a <code>String description</code>, and an <code>Integer price</code>. The repository must include a derived query method that retrieves all products whose price falls within a given range (inclusive).',
      'The solution uses Spring Data R2DBC\'s derived query method naming convention: <code>findByPriceBetween(int from, int to)</code>. Since multiple products can match the range, the return type is <code>Flux&lt;Product&gt;</code>. The test verifies the query by requesting products priced between 5 and 2000, expecting exactly three results, and printing each product via <code>doOnNext</code>.',
      'This exercise reinforces how Spring Data R2DBC parses method names into SQL <code>WHERE price BETWEEN ? AND ?</code> clauses automatically — no <code>@Query</code> annotation needed. The <code>StepVerifier</code> test pattern (covered in the crash course lesson) is used to assert the count and completion of the reactive stream.',
    ],
    keyPoints: [
      'Create a <code>Product</code> entity with <code>@Id</code> on the <code>id</code> field, plus <code>description</code> and <code>price</code> fields',
      'Extend <code>ReactiveCrudRepository&lt;Product, Integer&gt;</code> to get reactive CRUD operations',
      'Use the derived query method <code>findByPriceBetween(int from, int to)</code> returning <code>Flux&lt;Product&gt;</code>',
      'Spring Data R2DBC auto-generates the SQL <code>BETWEEN</code> clause from the method name — no manual SQL required',
      'Test with <code>StepVerifier</code> using <code>expectNextCount(3)</code> and <code>verifyComplete()</code>',
    ],
    code: `package com.example.section03.entity;

import org.springframework.data.annotation.Id;

public class Product {

    @Id
    private Integer id;
    private String description;
    private Integer price;

    public Product() {
    }

    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public Integer getPrice() {
        return price;
    }

    public void setPrice(Integer price) {
        this.price = price;
    }

    @Override
    public String toString() {
        return "Product{" +
                "id=" + id +
                ", description='" + description + '\'' +
                ", price=" + price +
                '}';
    }
}
`,
    codeLabel: 'java',
    note: {
      label: 'WHEN TO USE',
      text: 'Derived query methods like <code>findByPriceBetween</code> are ideal for simple field-level conditions. For complex joins or multi-table queries, you\'ll need the <code>@Query</code> annotation covered in later lessons.',
      tone: 'accent',
    },
    quiz: {
      question: 'What should the return type of `findByPriceBetween(int from, int to)` be in the ProductRepository?',
      options: [
        { label: 'Mono<Product>', correct: false },
        { label: 'Flux<Product>', correct: true },
        { label: 'List<Product>', correct: false },
        { label: 'Mono<List<Product>>', correct: false },
      ],
      explanation: 'A price range query can return zero, one, or many products, so the return type must be `Flux<Product>` (a stream of 0..N items). `Mono<Product>` would only work for single-result queries like `findById`.',
    },
  },
  {
    id: '3.12',
    title: 'Pageable',
    duration: '3 min',
    kind: 'demo',
    summary: [
      'When dealing with large datasets, fetching all records at once is impractical. Spring Data R2DBC supports pagination through the <code>Pageable</code> interface, allowing you to request chunks of data sorted by a specific field — for example, "give me the first 3 products sorted by price ascending." This mirrors the pagination support you may already know from Spring Data JPA.',
      'To use pagination, add a method to your <code>ProductRepository</code> that accepts a <code>Pageable</code> parameter and returns a <code>Flux&lt;Product&gt;</code>. The method name can be <code>findBy</code> or <code>findAllBy</code> — both behave identically when the only parameter is <code>Pageable</code>. Be sure to import <code>Pageable</code> from <code>org.springframework.data.domain</code>, not <code>java.awt.print</code>, which also has a class with that name.',
      'Since <code>Pageable</code> is an interface, you create instances using <code>PageRequest.of(pageNumber, pageSize, sort)</code>. Page numbers are <em>zero-indexed</em>: page 0 is the first page, page 1 is the second, and so on. You can chain a <code>Sort.by(...)</code> to control ordering. In the test, <code>StepVerifier</code> assertions verify that the first page (sorted by ascending price) returns products priced at 200, 250, and 300 respectively, confirming both the sort and the page boundary are working correctly.',
    ],
    keyPoints: [
      'Use <code>org.springframework.data.domain.Pageable</code> — not <code>java.awt.print.Pageable</code> — to avoid a confusing import mistake.',
      '<code>findBy(Pageable)</code> and <code>findAllBy(Pageable)</code> are equivalent; both return a <code>Flux&lt;Product&gt;</code> limited to the requested page.',
      'Create <code>Pageable</code> instances with <code>PageRequest.of(page, size, sort)</code> — page numbers are <strong>zero-indexed</strong>.',
      'Combine pagination with <code>Sort.by("price").ascending()</code> to get ordered chunks of data.',
      'In <code>StepVerifier</code>, use <code>assertNext</code> for each expected item to verify field values, then <code>verifyComplete()</code>.',
    ],
    code: `java`,
    codeLabel: 'ProductRepository.java — pagination method',
    note: {
      label: 'WARNING',
      text: 'Page numbers are zero-indexed — page 0 is the first page. Requesting page 1 skips the first chunk entirely, which is a common off-by-one mistake when wiring up UI pagination controls.',
      tone: 'accent',
    },
    quiz: {
      question: 'You want the first 5 products sorted by price descending. Which PageRequest call is correct?',
      options: [
        { label: 'PageRequest.of(1, 5, Sort.by("price").descending())', correct: false },
        { label: 'PageRequest.of(0, 5, Sort.by("price").descending())', correct: true },
        { label: 'PageRequest.of(0, 5, Sort.by("price").ascending())', correct: false },
        { label: 'PageRequest.of(5, 0, Sort.by("price").descending())', correct: false },
      ],
      explanation: 'Page numbers are zero-indexed, so the first page is 0. The second argument is page size (5), and Sort.by("price").descending() gives highest-to-lowest ordering.',
    },
  },
  {
    id: '3.13',
    title: 'What About Complex Queries?',
    duration: '3 min',
    kind: 'concept',
    summary: [
      'R2DBC intentionally does not provide JPA-style relationship annotations like <code>@OneToMany</code> or <code>@ManyToMany</code>. Instead, it stays lean and focuses on performance and scalability by preferring simple, explicit SQL statements for complex queries and joins. This design choice avoids the hidden N+1 query problem and lazy-loading pitfalls common in ORM-based frameworks.',
      'There are two primary ways to execute custom or complex SQL with R2DBC. The first is using the familiar repository interface with Spring Data\'s <code>@Query</code> annotation, where you write raw SQL directly. The second is using the <code>DatabaseClient</code> API, which offers a fluent, programmatic approach for building and executing queries. We will explore the <code>@Query</code> approach first, then move to <code>DatabaseClient</code>.',
      'To demonstrate joins and complex queries, we need a second entity and repository. We introduce a <code>CustomerOrder</code> entity with fields for <code>orderId</code> (UUID primary key), <code>customerId</code>, <code>productId</code>, <code>amount</code>, and <code>orderDate</code>. For the <code>orderDate</code> field, we use <code>java.time.Instant</code> — the preferred type for storing UTC timestamps. The legacy <code>java.sql.Date</code> and <code>java.sql.Time</code> types should be avoided in favor of modern Java time types (<code>LocalDate</code>, <code>LocalTime</code>, <code>OffsetTime</code>, <code>Instant</code>) depending on your precision and timezone needs.',
    ],
    keyPoints: [
      'R2DBC does <strong>not</strong> support <code>@OneToMany</code> or <code>@ManyToMany</code> annotations — it deliberately avoids ORM-style relationship mapping.',
      'Complex queries and joins are handled via explicit SQL using either <code>@Query</code> on a repository or the <code>DatabaseClient</code> API.',
      'Use <code>java.time.Instant</code> for UTC timestamps; avoid legacy <code>java.sql.Date</code> types in favor of modern Java time API (<code>LocalDate</code>, <code>LocalTime</code>, <code>Instant</code>).',
      'A separate <code>CustomerOrderRepository</code> is created to keep the existing <code>CustomerRepository</code> clean and to manage the new <code>customer_order</code> table.',
    ],
    code: `package com.example.section03.entity;

import org.springframework.data.annotation.Id;
import java.time.Instant;
import java.util.UUID;

public class CustomerOrder {

    @Id
    private UUID orderId;

    private Integer customerId;

    private Integer productId;

    private Integer amount;

    private Instant orderDate;

    public UUID getOrderId() {
        return orderId;
    }

    public void setOrderId(UUID orderId) {
        this.orderId = orderId;
    }

    public Integer getCustomerId() {
        return customerId;
    }

    public void setCustomerId(Integer customerId) {
        this.customerId = customerId;
    }

    public Integer getProductId() {
        return productId;
    }

    public void setProductId(Integer productId) {
        this.productId = productId;
    }

    public Integer getAmount() {
        return amount;
    }

    public void setAmount(Integer amount) {
        this.amount = amount;
    }

    public Instant getOrderDate() {
        return orderDate;
    }

    public void setOrderDate(Instant orderDate) {
        this.orderDate = orderDate;
    }
}
`,
    codeLabel: 'java',
    note: {
      label: 'KEY INSIGHT',
      text: 'R2DBC\'s lack of relationship annotations is a feature, not a limitation — it forces you to write explicit SQL, giving you full control over query performance and avoiding the N+1 problem that plagues lazy-loading ORMs.',
      tone: 'accent',
    },
    quiz: {
      question: 'Which Java type should you use for an order timestamp stored in UTC with R2DBC?',
      options: [
        { label: 'java.sql.Date', correct: false },
        { label: 'java.time.Instant', correct: true },
        { label: 'java.util.Date', correct: false },
        { label: 'java.sql.Timestamp', correct: false },
      ],
      explanation: 'java.time.Instant is the preferred type for UTC timestamps in R2DBC. The java.sql.* and java.util.Date types are legacy and should be avoided in modern reactive applications.',
    },
  },
  {
    id: '3.14',
    title: 'Join Query Using @Query',
    duration: '5 min',
    kind: 'demo',
    summary: [
      'This lesson demonstrates how to perform a cross-table join in Spring Data R2DBC using a custom <code>@Query</code> annotation. The task is to find all products ordered by a given customer name — for example, "find the products ordered by Sam." This requires joining three tables: <code>customer</code>, <code>customer_order</code>, and <code>product</code>. The query first looks up the customer by name, then traverses through the <code>customer_order</code> join table to collect associated product IDs, and finally fetches the corresponding <code>product</code> records.',
      'Spring Data R2DBC\'s derived query methods (like <code>findByPriceBetween</code> from the previous assignment) cannot express multi-table joins. For any query spanning multiple entities, you must write the SQL explicitly using <code>@Query</code>. The instructor uses a Java text block (triple-quote <code>"""</code>) to provide a readable multi-line SQL statement. A named parameter (<code>:name</code>) is used in the WHERE clause and is bound at runtime from the method argument. The return type is <code>Flux&lt;Product&gt;</code> because the result maps directly to the <code>Product</code> entity — R2DBC maps each row to the specified domain type automatically.',
      'The test validates the query by searching for products ordered by "Mike," who is seeded in the test database with two products: iPhone 20 and Mac Pro. A <code>StepVerifier</code> asserts that exactly two <code>Product</code> elements are emitted. The instructor also notes interest in verifying that the SQL is actually executed with the parameter correctly substituted — which can be confirmed by enabling SQL logging (covered in the earlier "Show SQL" lesson).',
    ],
    keyPoints: [
      'Use <code>@Query</code> with a raw SQL string when a query spans multiple tables — derived query methods cannot express joins.',
      'Java text blocks (<code>"""..."""</code>) make multi-line SQL readable inside repository method annotations.',
      'Named parameters (e.g., <code>:name</code>) in the SQL are bound from method arguments at runtime by Spring Data R2DBC.',
      'The return type of the repository method determines how each row is mapped — <code>Flux&lt;Product&gt;</code> maps each result row to a <code>Product</code> entity.',
      'Explicit joins (using <code>JOIN ... ON</code>) and implicit joins (comma-separated tables in <code>FROM</code>) are both acceptable; choose whichever you find more readable.',
    ],
    code: `package section03.repository;

import org.springframework.data.r2dbc.repository.Query;
import org.springframework.data.repository.reactive.ReactiveCrudRepository;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Flux;
import section03.entity.Product;

// ... (Customer entity, Product entity, and CustomerOrder entity from earlier lessons)

@Repository
public interface CustomerOrderRepository extends ReactiveCrudRepository<CustomerOrder, Long> {

    @Query("""
            SELECT p.*
            FROM product p
            JOIN customer_order co ON p.id = co.product_id
            JOIN customer c ON co.customer_id = c.id
            WHERE c.name = :name
            """)
    Flux<Product> getProductsOrderedByCustomer(String name);
}`,
    codeLabel: 'java',
    note: {
      label: 'WHY THIS MATTERS',
      text: 'R2DBC is not an ORM — it does not manage lazy-loaded associations or entity graphs like JPA/Hibernate. Every join must be written as explicit SQL, which gives you full control but means you are responsible for the query logic.',
      tone: 'accent',
    },
    quiz: {
      question: 'Why must you use @Query with raw SQL for this join instead of a derived method name like findByCustomerName?',
      options: [
        { label: 'Derived method names in Spring Data R2DBC can only query a single table and cannot express joins across multiple tables', correct: true },
        { label: 'Derived method names are not supported in R2DBC at all', correct: false },
        { label: 'Joins require a transaction, and @Query automatically opens one', correct: false },
        { label: 'Derived methods return Mono while joins require Flux', correct: false },
      ],
      explanation: 'Spring Data R2DBC derives SQL from method names for single-table queries only. Any query that spans multiple tables (joins) must be expressed as explicit SQL via @Query, since R2DBC has no concept of entity associations or lazy loading like JPA does.',
    },
  },
  {
    id: '3.15',
    title: 'Projection',
    duration: '4 min',
    kind: 'demo',
    summary: [
      'Building on the join query from the previous lesson, we now tackle a scenario where the result set combines fields from multiple tables — customer name, order ID, product description, amount paid, and order date — into a single row. This combined view is called a <em>projection</em>. Rather than mapping results to a full entity, we create a lightweight Java record (a DTO) to represent each row. Java 17 records are ideal here because they provide immutable, boilerplate-free carriers for exactly the columns we need.',
      'The query filters by product description (e.g., "iPhone 20") and orders results by amount in descending order. The repository method returns <code>Flux&lt;OrderDetails&gt;</code>, and we use <code>@Query</code> with named parameters to bind the product description. In the test, we verify that the two matching orders come back in the correct descending order — 975 first, then 950 — using <code>StepVerifier</code> with <code>assertNext</code> for each row.',
      'This approach demonstrates that R2DBC projections are not limited to entity classes. Any Java record can serve as the return type for a repository method, as long as the column aliases in the SQL query match the record component names. This is essential for read-heavy operations where fetching full entities would be wasteful.',
    ],
    keyPoints: [
      'A <strong>projection</strong> maps selected columns from a join query into a custom DTO rather than a full entity.',
      'Java 17 <code>record</code> types are perfect for DTOs — they\'re immutable, concise, and Spring Data R2DBC maps query results to them automatically.',
      'Column aliases in the SQL query (e.g., <code>c.name AS customer_name</code>) must match the record\'s component names for automatic mapping.',
      'The repository method returns <code>Flux&lt;OrderDetails&gt;</code> with <code>@Query</code> annotation, just like entity-based queries.',
      'Use <code>assertNext</code> in <code>StepVerifier</code> to validate each projected row individually, checking field values in the expected order.',
    ],
    code: `java`,
    codeLabel: 'OrderDetails record, repository method, and test',
    note: {
      label: 'KEY INSIGHT',
      text: 'Spring Data R2DBC can map query results to any Java record — not just @Table-annotated entities — as long as the SQL column aliases match the record component names. This makes records perfect for read-only projections across joined tables.',
      tone: 'accent',
    },
    quiz: {
      question: 'When using a Java record as a projection return type in a Spring Data R2DBC repository, what must be true for automatic mapping to work?',
      options: [
        { label: 'The record must be annotated with @Table', correct: false },
        { label: 'The SQL column aliases must match the record\'s component names', correct: true },
        { label: 'The record must implement Serializable', correct: false },
        { label: 'The record must have a no-args constructor', correct: false },
      ],
      explanation: 'Spring Data R2DBC maps query result columns to record components by name. If your SQL query aliases a column as `customer_name`, the record must have a component named `customerName` (snake_case is automatically converted to camelCase). No @Table annotation or special interface is needed for projection DTOs.',
    },
  },
  {
    id: '3.16',
    title: 'R2DBC Database Client',
    duration: '5 min',
    kind: 'demo',
    summary: [
      'While Spring Data R2DBC repositories (covered in earlier lessons) are convenient for standard CRUD operations and custom <code>@Query</code> methods, they are not the only way to interact with the database. Spring also provides the <code>DatabaseClient</code> interface (from <code>org.springframework.r2dbc.core</code>), which is a lightweight, fluent API for executing arbitrary SQL statements — SELECT, INSERT, UPDATE, or DELETE — without needing a repository at all.',
      'The <code>DatabaseClient</code> API follows a builder pattern with two main stages: <strong>input binding</strong> and <strong>output mapping</strong>. For input, you call <code>.sql("...")</code> with your query string, then use <code>.bind("paramName", value)</code> for each named parameter (or <code>.bind(index, value)</code> for positional binding). For output, you call <code>.map(row -> ...)</code> to project each returned <code>Row</code> into a domain object. Finally, you choose a terminal method: <code>.one()</code> for a single required row, <code>.first()</code> for the first row (empty if none), or <code>.all()</code> which returns a <code>Flux&lt;T&gt;</code> of all matching rows.',
      'In this demo, the instructor reuses the same join query from the <code>CustomerOrderRepository</code> <code>@Query</code> method (lesson 3.14) but executes it through <code>DatabaseClient</code> instead. The query joins <code>customer</code>, <code>product</code>, and <code>r2db_order</code> tables, filtering by a product description. The <code>.bind("description", "iPhone 20")</code> call supplies the parameter, <code>.map(row -> new OrderDetails(...))</code> projects each row into the <code>OrderDetails</code> projection class (defined in lesson 3.15), and <code>.all()</code> returns the results as a reactive <code>Flux</code>. A <code>StepVerifier</code> (introduced in lesson 3.6) validates the results.',
    ],
    keyPoints: [
      '<code>DatabaseClient</code> (<code>org.springframework.r2dbc.core.DatabaseClient</code>) is a fluent, non-blocking alternative to repositories for executing arbitrary SQL.',
      'Use <code>.sql("...")</code> to provide the query, <code>.bind(name, value)</code> for input parameters, and <code>.map(row -> ...)</code> to project result rows into domain objects.',
      'Terminal methods: <code>.one()</code> returns <code>Mono&lt;T&gt;</code> (exactly one), <code>.first()</code> returns <code>Mono&lt;T&gt;</code> (first or empty), <code>.all()</code> returns <code>Flux&lt;T&gt;</code> (all rows).',
      '<code>DatabaseClient</code> works with any SQL — not just SELECT — making it suitable for INSERT, UPDATE, and DELETE operations that don\'t map cleanly to repository methods.',
      'Named parameters in the SQL string use <code>:paramName</code> syntax (e.g., <code>:description</code>), matching the name passed to <code>.bind()</code>.',
    ],
    code: `package com.example.section03;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.r2dbc.core.DatabaseClient;
import reactor.test.StepVerifier;

public class Lecture16DatabaseClientTest extends AbstractTest {

    @Autowired
    private DatabaseClient databaseClient;

    @Test
    public void databaseClientTest() {
        var query = """
            SELECT c.name AS customer_name,
                   p.description AS product_description,
                   o.amount AS order_amount
            FROM customer c
            JOIN r2db_order o ON c.id = o.customer_id
            JOIN product p ON p.id = o.product_id
            WHERE p.description = :description
            """;

        this.databaseClient.sql(query)
                .bind("description", "iPhone 20")
                .map(row -> new OrderDetails(
                        row.get("customer_name", String.class),
                        row.get("product_description", String.class),
                        row.get("order_amount", Integer.class)
                ))
                .all()
                .as(StepVerifier::create)
                .assertNext(orderDetails -> {
                    assert orderDetails.customerName() != null;
                    assert orderDetails.productDescription() != null;
                    assert orderDetails.orderAmount() != null;
                })
                .verifyComplete();
    }
}`,
    codeLabel: 'java',
    note: {
      label: 'WHEN TO USE',
      text: 'Reach for <code>DatabaseClient</code> when a query doesn\'t fit the repository pattern — for example, dynamic SQL, complex multi-table joins with custom projections, or bulk DML operations. For standard entity CRUD and simple derived/query methods, repositories remain the simpler choice.',
      tone: 'accent',
    },
    quiz: {
      question: 'You need to execute a complex SELECT with multiple named parameters and return all matching rows as a Flux. Which DatabaseClient terminal method should you call?',
      options: [
        { label: '.one()', correct: false },
        { label: '.first()', correct: false },
        { label: '.all()', correct: true },
        { label: '.fetch()', correct: false },
      ],
      explanation: '<code>.all()</code> returns a <code>Flux&lt;T&gt;</code> emitting every matching row. <code>.one()</code> expects exactly one row (errors on zero or multiple), and <code>.first()</code> returns only the first row as a <code>Mono</code>. There is no <code>.fetch()</code> terminal method in DatabaseClient.',
    },
  },
  {
    id: '3.17',
    title: 'Summary',
    duration: '2 min',
    kind: 'summary',
    summary: [
      'This section covered <strong>R2DBC</strong> (Reactive Relational Database Connectivity), a specification designed for non-blocking, reactive access to relational databases. Unlike JPA, R2DBC is built from the ground up for reactive streams, meaning it integrates naturally with Project Reactor\'s <code>Flux</code> and <code>Mono</code> types. Spring Data R2DBC wraps this specification with familiar Spring Data abstractions — repositories, query derivation, projections, and pagination — making the developer experience consistent with blocking Spring Data modules while remaining fully reactive under the hood.',
      'Throughout the section, we built a <code>Customer</code> entity and repository, practicing CRUD operations with <code>StepVerifier</code> to test reactive flows. We explored derived query methods (like the price-range assignment), pagination with <code>Pageable</code>, and custom queries using <code>@Query</code> with raw SQL for joins and projections. We also looked at the <code>DatabaseClient</code> for lower-level control when repository abstractions aren\'t enough.',
      'A key takeaway is what R2DBC <em>does not</em> provide: there are no JPA-style relationship annotations like <code>@OneToMany</code> or <code>@ManyToMany</code>. Complex joins and associations must be written as raw SQL, typically via <code>@Query</code> or the <code>DatabaseClient</code>. This is a deliberate trade-off — R2DBC prioritizes performance, scalability, and efficient resource utilization through stream-oriented data consumption with backpressure, rather than the convenience of ORM-style object graphs.',
    ],
    keyPoints: [
      '<strong>R2DBC</strong> is a reactive alternative to JDBC — it is a separate specification, not part of JPA.',
      'Spring Data R2DBC provides familiar abstractions: derived query methods, <code>Pageable</code>, projections, and <code>@Query</code>.',
      'No relationship annotations (<code>@OneToMany</code>, <code>@ManyToMany</code>) — use raw SQL for joins and complex queries.',
      'R2DBC focuses on performance and scalability via non-blocking, stream-oriented data consumption with backpressure support.',
      'Use <code>StepVerifier</code> to test reactive repository methods, asserting on <code>Mono</code> and <code>Flux</code> emissions.',
      'For scenarios beyond repository abstractions, the <code>DatabaseClient</code> offers direct SQL execution with reactive result mapping.',
    ],
    note: {
      label: 'KEY INSIGHT',
      text: 'R2DBC trades the convenience of JPA\'s ORM annotations for the performance and scalability of non-blocking, backpressure-aware data access. If you need complex joins, write raw SQL — there is no lazy-loading object graph to rescue you.',
      tone: 'accent',
    },
    quiz: {
      question: 'You need to model a one-to-many relationship between Customer and Order in a Spring Data R2DBC application. Which approach should you use?',
      options: [
        { label: 'Annotate the Customer entity with @OneToMany and map the orders collection', correct: false },
        { label: 'Write a @Query with raw SQL to fetch joined data, or use DatabaseClient', correct: true },
        { label: 'Use @ManyToOne on the Order entity — R2DBC supports it', correct: false },
        { label: 'Switch to Spring Data JPA for this entity only', correct: false },
      ],
      explanation: 'R2DBC does not support JPA relationship annotations like @OneToMany or @ManyToOne. You must write raw SQL using @Query or DatabaseClient to perform joins and map the results manually.',
    },
  },
]
