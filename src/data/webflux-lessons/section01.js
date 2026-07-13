export default [
  {
    id: '1.1',
    title: 'Before You Enroll',
    duration: '7 min',
    kind: 'setup',
    summary: [
      'This course is <em>Part 2</em> in a series. It assumes you are already comfortable with reactive programming fundamentals — <code>Mono</code>, <code>Flux</code>, operators, backpressure, and the reactive execution model — as well as basic Spring Boot. If you have not studied Part 1 or an equivalent reactive programming course, the instructor recommends completing that first or requesting a refund.',
      'The course\'s goal is to make you proficient at building highly <em>responsive</em>, <em>resilient</em>, and <em>scalable</em> web applications using Spring WebFlux. These are not just buzzwords: they map directly to the four pillars of the <a href="https://www.reactivemanifesto.org/">Reactive Manifesto</a> — responsive, resilient, elastic, and message-driven. A real-world example of responsiveness is ChatGPT: when you ask a question, the system immediately acknowledges and streams the answer in chunks rather than making you wait for the entire response. If you click stop, it stops instantly. That immediacy — reacting to user input without significant delay — is the essence of a responsive system.',
      'Spring WebFlux differs fundamentally from the traditional Spring Web (MVC) module. While Spring MVC follows a strict request-response model (one request in, one response out), WebFlux supports four communication patterns: request-response, request-stream (one request, multiple streamed responses), stream-request (multiple streamed requests, one response), and bidirectional streaming (both directions). The first section of the course demonstrates these differences hands-on so you can see them in action rather than just hearing about them.',
      'The course is over 80% hands-on. Topics covered include: traditional vs. reactive API comparison, reactive data access with R2DBC for relational databases, CRUD APIs with input validation and error handling, functional endpoints (a lightweight alternative to annotation-based controllers), web filters for request interception, <code>WebClient</code> for inter-service HTTP calls, streaming between microservices, advanced WebFlux configuration and production best practices, and a final capstone project. The capstone involves a stock-trading system with real-time price streaming, a broadcast service, and user notifications — taking over three hours to build and integrating everything learned throughout the course.',
    ],
    keyPoints: [
      '<strong>Prerequisite:</strong> Solid understanding of reactive programming (<code>Mono</code>, <code>Flux</code>, operators, backpressure) and Spring Boot is required — this is Part 2 in a series.',
      'The course targets the four Reactive Manifesto principles: <em>responsive</em>, <em>resilient</em>, <em>elastic</em>, and <em>message-driven</em>.',
      'Spring WebFlux supports four communication models — request-response, request-stream, stream-request, and bidirectional streaming — whereas Spring MVC only supports request-response.',
      'Over 80% of the course is hands-on coding, including a capstone project simulating a real-time stock trading platform.',
      'Key topics: R2DBC data access, CRUD with validation/error handling, functional endpoints, web filters, <code>WebClient</code>, inter-service streaming, and advanced production configuration.',
    ],
    note: {
      label: 'WHY THIS MATTERS',
      text: 'Reactive programming is more than knowing <code>Mono</code> and <code>Flux</code> exist. Without understanding backpressure, threading models, and non-blocking execution, you risk building applications that appear to work but fail under load or behave unpredictably in production.',
      tone: 'accent',
    },
    quiz: {
      question: 'Which communication pattern is NOT available in traditional Spring MVC but IS available in Spring WebFlux?',
      options: [
        { label: 'Request-Response (one request, one response)', correct: false },
        { label: 'Request-Stream (one request, multiple streamed responses)', correct: true },
        { label: 'HTTP GET', correct: false },
        { label: 'JSON serialization', correct: false },
      ],
      explanation: 'Spring MVC strictly follows the request-response model. Spring WebFlux adds streaming patterns — request-stream, stream-request, and bidirectional streaming — enabling multiple messages to be sent over a single interaction, which is essential for real-time data use cases like stock price updates.',
    },
  },
]
