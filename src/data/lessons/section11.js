export default [
  {
    id: '11.1',
    title: 'Introduction',
    duration: '2 min',
    kind: 'theory',
    summary: [
      "A Publisher's terminal signals — onComplete and onError — have meant exactly one thing throughout this entire course: the sequence is over, no more data is coming. repeat() and retry() are the two operators that change that specific rule, in two different directions.",
      "repeat() automatically resubscribes to the same publisher the instant it sees onComplete, asking it to produce again. retry() does the equivalent thing for onError instead — resubscribing after a failure rather than after a success. Same underlying idea (turn a terminal signal into a trigger to try again), applied to opposite outcomes.",
    ],
  },
  {
    id: '11.2',
    title: 'Repeat — Part 1',
    duration: '6 min',
    kind: 'demo',
    summary: [
      "A Mono<String> wrapping a random country-name generator makes the base case concrete: subscribing gives exactly one country, then completes, as any Mono should. Wanting a second country might naturally suggest subscribing to the same Mono a second time — and in this in-memory example, that appears to work fine.",
      "It's a genuinely bad habit to build on, though: for a real non-blocking I/O call, subscribing to the same Mono three separate times fires three requests essentially simultaneously, all at once — not the sequential 'one, then the next' behavior actually wanted. repeat() solves this properly: chaining .repeat() resubscribes automatically and only once onComplete has actually fired for the current subscription, guaranteeing genuinely sequential re-requests rather than concurrent ones.",
      "repeat() with no argument runs indefinitely; repeat(n) resubscribes exactly n additional times beyond the original, for n+1 total emissions. A detail worth noticing: adding repeat() to a Mono changes its type to Flux — a subscriber that might now receive more than one item genuinely can't be represented as a Mono anymore, regardless of what the original publisher was.",
    ],
    code: `Mono<String> countryMono = Mono.fromSupplier(() -> Util.faker().country().name());

countryMono.subscribe(Util.subscriber());
// one random country, then complete — a plain Mono, exactly as expected

// A BAD instinct — subscribing again manually "works" here only because
// everything is in-memory. For real non-blocking I/O, this fires THREE
// CONCURRENT requests all at once, not three sequential ones:
countryMono.subscribe(Util.subscriber());
countryMono.subscribe(Util.subscriber());
countryMono.subscribe(Util.subscriber());

countryMono
    .repeat() // resubscribes indefinitely, every time onComplete fires
    .subscribe(Util.subscriber());
// keeps producing country names forever — be ready to stop this

countryMono
    .repeat(3) // 3 ADDITIONAL repeats beyond the original
    .subscribe(Util.subscriber());
// 4 country names total: 1 original + 3 repeats

// Notice the TYPE change: Mono<String> becomes Flux<String> the moment
// repeat() is added — a publisher that might now emit more than one item
// can no longer be represented as a Mono`,
  },
  {
    id: '11.3',
    title: 'Repeat — Part 2',
    duration: '7 min',
    kind: 'demo',
    summary: [
      "repeat() cleanly respects a downstream cancel() the same way any other operator would — chaining .takeUntil(c -> c.equalsIgnoreCase(\"Canada\")) after .repeat() means repeating continues indefinitely until Canada finally shows up, at which point cancellation propagates upstream through repeat() and stops it cleanly, exactly like the earlier country-hunting examples from Section 3 and Section 4.",
      "Beyond a fixed count, repeat() also accepts a BooleanSupplier — 'keep repeating for as long as this returns true' — a more flexible stopping condition than a simple integer when the actual logic is more involved than a plain counter.",
      "repeatWhen(Function<Flux<Long>, Publisher<?>>) is the tool for adding a delay between repeats instead of resubscribing the instant onComplete fires — genuinely important for not hammering a real remote API on every single completion. Each completion becomes a trigger signal flowing through the function provided; delaying that trigger flux (via delayElements(), for instance) delays each subsequent repeat by the same amount, and chaining a take(n) onto that same trigger flux caps how many repeats can ever actually happen. And repeat() isn't Mono-exclusive — a Flux repeated with repeat(n) simply replays its full sequence n additional times, remaining a Flux throughout.",
    ],
    code: `private static Mono<String> getCountryName() {
    return Mono.fromSupplier(() -> Util.faker().country().name());
}

getCountryName()
    .repeat()
    .takeUntil(c -> c.equalsIgnoreCase("Canada"))
    .subscribe(Util.subscriber());
// repeats indefinitely until "Canada" shows up, then stops cleanly —
// repeat() respects a downstream cancel() like any other operator

// repeat() also accepts a BooleanSupplier instead of a fixed count:
var counter = new AtomicInteger(0);
getCountryName()
    .repeat(() -> counter.incrementAndGet() < 3)
    .subscribe(Util.subscriber());

// repeatWhen() adds a delay between repeats, instead of resubscribing
// the instant onComplete fires:
getCountryName()
    .repeatWhen(flux -> flux.delayElements(Duration.ofSeconds(2)))
    .subscribe(Util.subscriber());
Util.sleepSeconds(10);
// each completion becomes a trigger, delayed by 2 seconds, before the
// next repeat actually happens

getCountryName()
    .repeatWhen(flux -> flux.delayElements(Duration.ofSeconds(2)).take(2))
    .subscribe(Util.subscriber());
// repeats exactly twice, 2 seconds apart, then stops — the inner take(2)
// caps how many trigger signals repeatWhen() ever receives

// repeat() works on Flux too — a Flux just stays a Flux:
Flux.just(1, 2, 3)
    .repeat(3)
    .subscribe(Util.subscriber());
// 1,2,3, 1,2,3, 1,2,3, 1,2,3 — the original run, plus 3 full repeats`,
    note: {
      label: 'The real-world motivation',
      text: "If a remote endpoint only ever supports request/response (Mono) rather than pushing live updates itself, repeat() is how you turn periodic re-asking into a genuine Flux of updates — 'give me the latest,' asked again and again, without writing a manual polling loop.",
    },
  },
  {
    id: '11.4',
    title: 'Retry',
    duration: '11 min',
    kind: 'demo',
    summary: [
      "retry() mirrors repeat() exactly, but resubscribes on onError instead of onComplete. A deliberately flaky Mono — one that throws for its first two attempts and only succeeds on the third — makes the base case concrete: with no retry logic at all, the first (and only) attempt simply fails. Chaining .retry(2) resubscribes up to 2 additional times after a failure, and on the third overall attempt, it finally succeeds.",
      "retryWhen(Retry) is the generally more capable form, built around Reactor's own Retry spec rather than a plain count. Retry.fixedDelay(maxAttempts, delay) adds a real pause between attempts (instead of retrying instantly), and .doBeforeRetry(signal -> ...) gives visibility into exactly when and why each retry fires — genuinely useful in production logs, since a plain retry() would otherwise hide every intermediate failure from view entirely.",
      "A Retry spec's .filter(Predicate<Throwable>) makes retrying selective by exception type — critically important in a real microservices setting, where a 500 Internal Server Error genuinely might succeed on a retry (a load balancer routing to a healthier instance), but a 400 Bad Request never will, no matter how many times it's retried. Filtering out exceptions that shouldn't trigger a retry lets those pass straight through to the subscriber immediately instead of wasting attempts on a request that's fundamentally never going to succeed.",
      "When every retry attempt is genuinely exhausted, Reactor by default wraps the final failure in its own RetryExhaustedException, with the real cause nested inside. .onRetryExhaustedThrow((spec, signal) -> signal.failure()) lets you hand back that original exception directly instead, if the wrapper adds nothing useful for callers.",
    ],
    code: `private static Mono<String> getCountryName() {
    var attempt = new AtomicInteger(0);
    return Mono.fromSupplier(() -> {
        if (attempt.incrementAndGet() < 3) {
            throw new RuntimeException("simulated failure");
        }
        return Util.faker().country().name();
    });
}

getCountryName().subscribe(Util.subscriber());
// always fails here — nothing resubscribes to let the attempt counter climb

getCountryName()
    .retry(2) // up to 2 additional attempts after a failure
    .subscribe(Util.subscriber());
// fails, resubscribes, fails again, resubscribes, SUCCEEDS on the 3rd
// attempt overall — retry() resubscribes on ERROR, where repeat() resubscribes on COMPLETE

// retryWhen() with a Retry spec — fixed delay, plus visibility:
getCountryName()
    .retryWhen(Retry.fixedDelay(2, Duration.ofSeconds(1))
        .doBeforeRetry(signal -> log.info("Retrying — {}", signal.failure().getMessage())))
    .subscribe(Util.subscriber());
Util.sleepSeconds(10);
// same 2-retry behavior as retry(2), but with a 1-second delay between
// attempts and explicit logging of exactly when and why each retry fires

// Retry selectively, by exception TYPE:
getCountryName()
    .retryWhen(Retry.fixedDelay(2, Duration.ofSeconds(1))
        .filter(throwable -> throwable.getClass().equals(RuntimeException.class)))
    .subscribe(Util.subscriber());
// only retries for exactly RuntimeException — anything else passes
// straight through to the subscriber immediately, no retry attempted at
// all (a 400 Bad Request genuinely shouldn't be retried the way a 500 might be)

// Handing back the ORIGINAL exception instead of Reactor's wrapper:
getCountryName() // still failing after every retry in this scenario
    .retryWhen(Retry.fixedDelay(2, Duration.ofSeconds(1))
        .onRetryExhaustedThrow((spec, signal) -> signal.failure()))
    .subscribe(Util.subscriber());
// subscriber receives the ORIGINAL exception directly, not Reactor's
// default RetryExhaustedException wrapper`,
    note: {
      label: 'Not every error deserves a retry',
      text: "A 500 Internal Server Error might genuinely succeed on retry (a different, healthier server instance). A 400 Bad Request never will — the request itself is the problem. filter() on a Retry spec is how you avoid wasting attempts retrying something that's fundamentally never going to work.",
    },
  },
  {
    id: '11.5',
    title: 'External Services — Repeat & Retry — Implementation',
    duration: '11 min',
    kind: 'demo',
    summary: [
      "A more realistic version of both operators against the demo service's endpoints — one that always returns a random country name, and two product endpoints deliberately built to fail: one always returns a 400 Bad Request, the other randomly alternates between success and a 500 Internal Server Error.",
      "A genuinely important detail surfaces here: reactor-netty, being deliberately low-level, has no built-in concept of what a 400 or 500 status code actually means — that interpretation is exactly what Spring WebFlux normally handles automatically underneath. Working directly with reactor-netty means switching on response.status().code() manually and explicitly converting non-2xx responses into custom exceptions (a ClientError for 400s, a ServerError for anything else) via Flux.error(), rather than getting that translation for free.",
      "With that groundwork in place, repeat() and retry() apply exactly as covered in the previous lectures, but against genuine HTTP calls instead of an in-memory Mono: client.getCountry() is called exactly once in the code, and .repeat().takeUntil(...) is what turns that single call into however many real HTTP requests it actually takes to see \"Canada\" — directly confirmed by watching the demo service's own request log climb alongside the client's. A reusable retryOnServerError() helper wraps Retry.fixedDelay() with a filter scoped specifically to ServerError (never ClientError, since a bad request will never succeed no matter how many times it's retried) — correctly refusing to retry the always-400 endpoint at all, while automatically and successfully riding out the randomly-500ing one.",
    ],
    code: `public class ClientError extends RuntimeException {
    public ClientError(String message) { super(message); }
}

public class ServerError extends RuntimeException {
    public ServerError(String message) { super(message); }
}

public class ExternalServiceClient extends AbstractHttpClient {
    public Mono<String> getCountry() {
        return httpClient.get()
            .uri("/demo06/country")
            .response(this::toResponse)
            .next();
    }

    public Mono<String> getProductName(int productId) {
        return httpClient.get()
            .uri("/demo06/product/" + productId)
            .response(this::toResponse)
            .next();
    }

    // reactor-netty has no built-in idea of what a status code MEANS —
    // interpreting it ourselves is our own responsibility here:
    private Flux<String> toResponse(HttpClientResponse response, ByteBufFlux byteBufFlux) {
        return switch (response.status().code()) {
            case 200 -> byteBufFlux.asString();
            case 400 -> Flux.error(new ClientError("Bad request"));
            default -> Flux.error(new ServerError("Server error"));
        };
    }
}

var client = new ExternalServiceClient();

// REPEAT — one call in the code, repeat() drives however many real
// HTTP requests it actually takes:
client.getCountry()
    .repeat()
    .takeUntil(c -> c.equalsIgnoreCase("Canada"))
    .subscribe(Util.subscriber());
Util.sleepSeconds(60);
// genuinely only ONE call to client.getCountry() in the code — repeat()
// turns it into as many real requests as needed to eventually see "Canada"

// RETRY — scoped specifically to ServerError, never ClientError:
private static Retry retryOnServerError() {
    return Retry.fixedDelay(20, Duration.ofSeconds(1))
        .filter(throwable -> ServerError.class.equals(throwable.getClass()))
        .doBeforeRetry(signal -> log.info("Retrying — {}", signal.failure().getMessage()));
}

client.getProductName(1) // always returns 400 Bad Request
    .retryWhen(retryOnServerError())
    .subscribe(Util.subscriber());
// fails immediately with ClientError, NO retry attempted — filter()
// correctly excludes it since it's not a ServerError

client.getProductName(2) // randomly succeeds or returns 500
    .retryWhen(retryOnServerError())
    .subscribe(Util.subscriber());
Util.sleepSeconds(10);
// retries automatically on the random 500s, roughly once per second,
// until the endpoint happens to succeed — genuine resilience against a
// realistically flaky downstream service`,
    note: {
      label: 'reactor-netty vs. Spring WebFlux',
      text: "This manual status-code handling is exactly the kind of boilerplate Spring WebFlux normally absorbs for you. Working directly with reactor-netty (as this course does, to keep the underlying mechanics visible) means owning that translation yourself.",
    },
  },
]
