export default [
  {
    id: '13.1',
    title: 'Introduction',
    duration: '3 min',
    kind: 'theory',
    summary: [
      "Context is Reactor's answer to a genuinely tricky problem: how do you attach request-scoped metadata to a reactive pipeline without threading it through every single method parameter, and without reaching for something as dangerous as ThreadLocal (which reactive code can't safely rely on anyway, since a single logical request routinely hops across multiple threads over its lifetime via subscribeOn/publishOn). Anyone who's used ThreadLocal in traditional code can think of Context as a safer relative — genuinely safe to use specifically because it's immutable, unlike ThreadLocal's mutable, thread-pinned state.",
      "The analogy that makes it click: an HTTP request has a body and query parameters for its actual data, but also headers for metadata about the request — authentication tokens, trace IDs, and the like — that shouldn't have to be threaded through the actual business logic as extra parameters. Context plays exactly that role for a reactive pipeline: a subscriber can attach additional information when it subscribes, and any producer or operator anywhere in that pipeline can read it, without a single method signature anywhere needing to change to accommodate it.",
      "This becomes genuinely valuable specifically once a pipeline is built from several producers combined together — a startWith() here, a concatWith() there, the kind of multi-producer pipeline Section 9 covered extensively. Rather than updating every individual producer's method signature to accept some new piece of request-scoped data, that data can be attached once, as Context, and read by whichever part of the pipeline actually needs it — a clean way to handle cross-cutting concerns like authentication, rate limiting, or monitoring without polluting the core business logic of every producer involved.",
    ],
    note: {
      label: 'Genuinely optional, and genuinely advanced',
      text: "This entire section is marked optional in the original course, and this lecture is presented as the only one recorded — an introduction to the concept for anyone curious enough to explore Context further on their own. Everything covered up through Sinks in the previous section represents the complete core curriculum.",
    },
  },
]
