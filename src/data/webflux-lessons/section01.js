export default [
  {
    id: '1.1',
    title: 'Before You Enroll',
    duration: '7 min',
    kind: 'faq',
    summary: [
      'Spring WebFlux builds on reactive programming foundations established in a prerequisite course (Part 1). If you are not already comfortable with the reactive paradigm — Mono, Flux, operators, schedulers, backpressure — you should complete Part 1 first. The instructor is explicit: this course assumes fluency, not exposure. Without that foundation the rest of the course will not click, and you are encouraged to request a refund rather than push through blind. Roughly 80% of the course is hands-on, so weak fundamentals will surface immediately in the code you are expected to write.',
      'The course centers on the four principles of the Reactive Manifesto: <em>responsive</em>, <em>resilient</em>, <em>elastic</em>, and <em>message-driven</em>. Responsiveness is the anchor — reacting to user input without significant delay. The ChatGPT example illustrates the point: it does not wait 10 seconds to deliver a complete answer, it acknowledges immediately, streams chunks of text, and respects a stop button. That streaming behavior is precisely what reactive systems enable, and it is what the course teaches you to build with Spring WebFlux. The instructor emphasizes that no buzzword will be left undefined — each principle is demonstrated in code later in the course.',
      'The most important conceptual shift the course will drill into you is moving beyond the traditional request-response model. With Spring Web MVC, a client sends one request and the server returns one response. Spring WebFlux adds three more communication patterns: <code>server-streaming</code> (one request, many responses), <code>client-streaming</code> (many requests, one response), and <code>bidirectional streaming</code>. These four patterns are the lens through which the entire course is structured, and the first section will demonstrate them side-by-side with traditional MVC endpoints so the behavioral difference is impossible to miss.',
      'The course outline is fixed: reactive vs traditional APIs, R2DBC for reactive data access to relational databases, CRUD APIs with input validation and error handling, functional endpoints (a lightweight alternative to annotation-based controllers), WebFilters for request interception, the WebClient for inter-service HTTP, streaming patterns for both microservices and front-ends, an advanced WebFlux section with production-tested best practices, and finally a capstone project. The capstone is a multi-service stock trading system where a <code>stock-service</code> emits real-time price changes that a second service consumes and broadcasts to connected users who observe and react to the prices — a realistic scenario that exercises error handling, integration tests, and resilience patterns end to end over roughly three hours of build time.',
    ],
    keyPoints: [
      'Reactive programming fluency is a <strong>non-negotiable prerequisite</strong> — this course does not teach Mono, Flux, operators, or schedulers from scratch.',
      'The Reactive Manifesto defines four principles: <strong>responsive, resilient, elastic, message-driven</strong>; all Spring WebFlux design choices flow from them.',
      'Spring WebFlux supports <strong>four communication patterns</strong> — request-response, server-streaming, client-streaming, and bidirectional streaming — compared to a single pattern in Spring Web MVC.',
      'Expect roughly <strong>80% hands-on coding</strong>; conceptual lectures like this one are the minority.',
      'The capstone is a real-time <code>stock-price streaming microservice</code> that broadcasts price changes to subscribers and processes buy/sell events as part of a multi-service system.',
      'The first section will demonstrate the behavioral differences between reactive and traditional APIs by exposing sample endpoints side-by-side — a critical foundation before any deeper topic.',
    ],
    note: {
      label: 'WARNING',
      text: 'If you are not already comfortable with reactive programming (Mono, Flux, operators, schedulers, backpressure), do not start this course yet — finish Part 1 or an equivalent foundation course first. The instructor explicitly offers a refund rather than waste your time on material you cannot yet follow.',
      tone: 'accent',
    },
    quiz: {
      question: 'Which of the following is NOT one of the four principles of the Reactive Manifesto?',
      options: [
        { label: 'Responsive', correct: false },
        { label: 'Elastic', correct: false },
        { label: 'Idempotent', correct: true },
        { label: 'Message-driven', correct: false },
      ],
      explanation: 'The Reactive Manifesto defines four principles: Responsive, Resilient, Elastic, and Message-driven. Idempotency is a useful property — especially in messaging — but it is not one of the four manifesto principles. Knowing these four by heart will help you recognize them as recurring themes throughout the course.',
    },
  },
]
