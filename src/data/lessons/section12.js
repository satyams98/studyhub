export default [
  {
    id: '12.1',
    title: 'Introduction',
    duration: '3 min',
    kind: 'theory',
    summary: [
      "Every publisher built so far — Mono.fromSupplier, Flux.generate, Flux.create, Flux.range, Flux.interval — is created through a factory method and only actually does anything once a subscriber shows up. Something has been genuinely missing from the toolkit: a way to emit data completely manually, on demand, whenever a piece of code decides to — no loop, no range, no interval driving it, and critically, no requirement that a subscriber even exist yet.",
      "Sinks are exactly that tool. Created via a small set of factory methods, a Sink acts as both a producer and a subscriber at once — genuinely a processor, in the vocabulary from Section 5. Through one side, arbitrary code (from any thread, any class) can push data in; through the other side, it behaves like an ordinary Mono or Flux that anything can subscribe to.",
      "This makes sinks a genuinely useful integration point between otherwise-unrelated parts of an application: one class can emit an event without directly calling methods on whatever classes care about that event — those interested classes simply subscribe to the sink's exposed Mono/Flux and react, with no direct coupling between the emitter and the reactors.",
    ],
  },
  {
    id: '12.2',
    title: 'Sink One — Try Emit',
    duration: '5 min',
    kind: 'demo',
    summary: [
      "Sinks.one() creates a sink that can carry at most one value — inherently a Mono-shaped sink, mirroring Mono's own 0-or-1-item contract. Sinks.many() (covered starting a few lectures ahead) is the Flux-shaped counterpart for multiple values.",
      "Calling sink.asMono() exposes the sink's output side as an ordinary Mono anything can subscribe to. Subscribing before anything has been emitted produces no output at all — a Sinks.One doesn't auto-complete on subscription the way Mono.empty() would; a value (or an explicit empty/error signal) has to be pushed through the sink's input side before the subscriber sees anything. tryEmitValue(...), tryEmitEmpty(), and tryEmitError(...) are the three ways to do that, mirroring Mono.just()/empty()/error() from Section 2 almost exactly, just invoked imperatively rather than declared upfront.",
      "A genuinely important property: this is inherently a hot-style publisher. Multiple subscribers attached to the same sink's Mono all receive the exact same emitted value — no .share() needed, because there's only ever one underlying producer to begin with. And emission doesn't require a subscriber to already exist; emitting first and subscribing afterward works exactly the same as subscribing first.",
    ],
    code: `Sinks.One<String> sink = Sinks.one();
Mono<String> mono = sink.asMono();

mono.subscribe(Util.subscriber());
// nothing happens yet — unlike Mono.empty(), a Sinks.One doesn't
// auto-complete; something has to be emitted through it explicitly

sink.tryEmitValue("hi");
// NOW the subscriber receives "hi", followed immediately by onComplete

// Multiple subscribers all receive the SAME value — inherently hot,
// no .share() required:
Sinks.One<String> sink2 = Sinks.one();
Mono<String> mono2 = sink2.asMono();
mono2.subscribe(Util.subscriber("Sam"));
mono2.subscribe(Util.subscriber("Mike"));
sink2.tryEmitValue("hi");
// both Sam and Mike receive "hi" — no subscriber is even required at the
// moment of emission; emitting first and subscribing later also works fine

// Equivalent ways to signal "nothing" or "an error":
Sinks.one().tryEmitEmpty();                          // straight to onComplete
Sinks.one().tryEmitError(new RuntimeException("boom")); // straight to onError`,
  },
  {
    id: '12.3',
    title: 'Sink One — Emit Failure Handler',
    duration: '6 min',
    kind: 'demo',
    summary: [
      "Alongside tryEmitValue(), Sinks.One also exposes emitValue(value, EmitFailureHandler), where the handler is a lambda receiving a SignalType and an EmitResult, and returning a boolean deciding whether Reactor should retry the emission. Critically, this handler is only ever invoked when the emission genuinely fails — a successful emission never triggers it at all.",
      "Deliberately emitting a second value on a sink that's already terminated (having already emitted its one allowed value) makes the failure case concrete: the handler fires with EmitResult.FAIL_TERMINATED, which means exactly what it says — this sink already completed, and there is fundamentally nothing to retry. Returning true here would tell Reactor to keep retrying an emission that can genuinely never succeed, producing an actual infinite loop — false is the only sensible answer for a FAIL_TERMINATED result.",
      "tryEmitValue() and emitValue() differ in exactly this dimension: tryEmitValue() attempts the emission and silently does nothing further if it fails — a 'best effort, don't tell me if it didn't work' contract. emitValue() insists on an explicit answer for what to do about a failure, via the handler. The genuinely useful case for this distinction becomes clear in the thread-safety lecture just ahead.",
    ],
    code: `Sinks.One<String> sink = Sinks.one();
sink.asMono().subscribe(Util.subscriber());

sink.emitValue("hi", (signalType, emitResult) -> {
    log.info("{} - {}", signalType, emitResult);
    return false; // false = don't retry, true = retry the emission
});
// this handler only fires on FAILURE — here the emission succeeds
// cleanly, so nothing gets logged at all

// Emitting a SECOND value on an already-terminated sink:
sink.emitValue("hello", (signalType, emitResult) -> {
    log.info("{} - {}", signalType, emitResult); // ON_NEXT - FAIL_TERMINATED
    return false; // correct — this sink already completed; retrying can never succeed
});

// Returning true here is a genuine mistake — it retries an emission that
// can NEVER succeed on an already-terminated sink, looping forever:
sink.emitValue("hello", (signalType, emitResult) -> true); // do not do this`,
  },
  {
    id: '12.4',
    title: 'Sink Types',
    duration: '3 min',
    kind: 'theory',
    summary: [
      "Beyond Sinks.one() (at most one value, any number of subscribers, values stored so late subscribers still get them), Sinks.many() offers several flavors, and picking the right one matters specifically because managing multiple independent subscribers with potentially different processing speeds is genuinely tricky, and Reactor gives you the choice of how much of that complexity to take on.",
      "unicast() supports multiple emitted values but strictly one subscriber, ever — the simplest option when only a single consumer is ever needed, avoiding all multi-subscriber coordination entirely. multicast() supports multiple values and multiple subscribers, but late subscribers only ever see values emitted after they joined — the movie-theater behavior from Section 6, applied here. replay() also supports multiple values and multiple subscribers, but additionally retains history so late subscribers can see everything that happened before they joined.",
    ],
    keyPoints: [
      'Sinks.one() — at most one value, any number of subscribers, value retained for late joiners.',
      'Sinks.many().unicast() — multiple values, exactly one subscriber ever.',
      "Sinks.many().multicast() — multiple values, multiple subscribers, late joiners see only NEW values (movie-theater behavior).",
      'Sinks.many().replay() — multiple values, multiple subscribers, late joiners see history too.',
    ],
  },
  {
    id: '12.5',
    title: 'Sink Many — Unicast',
    duration: '5 min',
    kind: 'demo',
    summary: [
      "Sinks.many().unicast().onBackpressureBuffer() creates a many-valued sink backed by an unbounded queue by default (a bounded custom queue can be supplied instead if that's preferred). Calling sink.asFlux() exposes the output side as an ordinary Flux.",
      "tryEmitNext(value) is the many-valued equivalent of tryEmitValue() — callable repeatedly, in a loop or scattered across arbitrary code, with none of the automatic completion behavior Sinks.One had (calling tryEmitComplete()/tryEmitError() explicitly is what actually ends a many-valued sink).",
      "Emitting several values before any subscriber exists and only subscribing afterward confirms the buffering behavior directly: the eventual subscriber receives everything that was emitted while it wasn't yet listening. Attempting to add a second subscriber to the same unicast sink, though, produces an immediate error for that second subscriber — unicast() genuinely means at most one subscriber, full stop, with no exception for a first subscriber that already left.",
    ],
    code: `Sinks.Many<String> sink = Sinks.many().unicast().onBackpressureBuffer();
Flux<String> flux = sink.asFlux();

sink.tryEmitNext("hi");
sink.tryEmitNext("how are you");
sink.tryEmitNext("?");

flux.subscribe(Util.subscriber("Sam")); // joining "late" — after emission — still works
// Sam receives all three messages — a unicast sink buffers everything
// (unbounded, by default) until its one and only subscriber shows up

flux.subscribe(Util.subscriber("Mike")); // a SECOND subscriber
// Mike receives an error immediately — unicast() means AT MOST ONE
// subscriber, ever; Sam already claimed that slot`,
  },
  {
    id: '12.6',
    title: 'Sink Many — Thread Safety',
    duration: '8 min',
    kind: 'demo',
    summary: [
      "A direct test, in the style of Section 4's FluxSink thread-safety demo: feed a deliberately non-thread-safe ArrayList from 1000 CompletableFuture tasks, each calling sink.tryEmitNext(i) on a shared sink. The result is consistently, disappointingly inconsistent — well under 1000 items, varying run to run.",
      "This is a genuinely important nuance in Reactor's own documented claim that sinks are 'thread-safe.' They are, in the sense that concurrent access won't corrupt internal state — but tryEmitNext() specifically is not internally synchronized, and fails fast rather than safely queuing when multiple threads collide on it at the same instant. The responsibility for handling that collision explicitly falls on the caller.",
      "The fix: emitNext(value, EmitFailureHandler) instead of tryEmitNext(), with a handler that specifically checks for EmitResult.FAIL_NON_SERIALIZED — Reactor's name for exactly this 'another thread was emitting at the same instant' collision — and returns true to retry only in that specific case. With that in place, the same 1000-thread test consistently produces exactly 1000 items, every single run.",
    ],
    code: `Sinks.Many<Integer> sink = Sinks.many().unicast().onBackpressureBuffer();
Flux<Integer> flux = sink.asFlux();

List<Integer> results = new ArrayList<>(); // deliberately not thread-safe, to isolate the sink itself
flux.subscribe(results::add);

for (int i = 0; i < 1000; i++) {
    var j = i;
    CompletableFuture.runAsync(() -> sink.tryEmitNext(j)); // many threads, one shared sink
}
Util.sleepSeconds(2);
System.out.println(results.size()); // inconsistent — often well under 1000

// FIX: emitNext() + a handler that retries specifically on the
// concurrency-collision failure code:
Sinks.Many<Integer> sink2 = Sinks.many().unicast().onBackpressureBuffer();
List<Integer> results2 = new ArrayList<>();
sink2.asFlux().subscribe(results2::add);

for (int i = 0; i < 1000; i++) {
    var j = i;
    CompletableFuture.runAsync(() ->
        sink2.emitNext(j, (signalType, emitResult) ->
            emitResult == Sinks.EmitResult.FAIL_NON_SERIALIZED));
}
Util.sleepSeconds(2);
System.out.println(results2.size()); // consistently 1000, every run`,
    note: {
      label: '"Thread-safe" has a specific, narrow meaning here',
      text: "Sinks won't corrupt their own internal state under concurrent access, but tryEmitNext() fails fast on a collision rather than queuing safely. emitNext() with a handler checking FAIL_NON_SERIALIZED is the actual fix for genuinely safe concurrent emission.",
    },
  },
  {
    id: '12.7',
    title: 'Sink Many — Multicast',
    duration: '7 min',
    kind: 'demo',
    summary: [
      "Sinks.many().multicast().onBackpressureBuffer() supports multiple subscribers on the same sink — Sam and Mike, subscribing before anything is emitted, both receive every message emitted afterward. A third subscriber (Jake) joining after messages have already been emitted, though, only sees whatever's emitted from that point forward — confirming multicast()'s movie-theater behavior directly: late means missing what already played.",
      "A genuinely surprising wrinkle, though: emitting messages before ANY subscriber exists at all behaves differently from emitting after subscribers already exist. Those pre-subscriber messages have nowhere to go yet, so they sit in the (bounded, by default sized like Section 8's internal queues) buffer — and whichever subscriber happens to be the very FIRST one to ever subscribe receives all of that backlog in full. Any subsequent subscriber, even one joining moments later, does not get that same backlog — only whichever first subscriber claimed it.",
      "This 'warm-up' behavior is specifically about the very first subscriber claiming whatever built up before anyone existed — it's not a general late-joiner replay mechanism, and it's easy to mistake for one if the sequence of subscribe-then-emit vs. emit-then-subscribe isn't tracked carefully.",
    ],
    code: `Sinks.Many<String> sink = Sinks.many().multicast().onBackpressureBuffer();
Flux<String> flux = sink.asFlux();

flux.subscribe(Util.subscriber("Sam"));
flux.subscribe(Util.subscriber("Mike"));
sink.tryEmitNext("hi");
sink.tryEmitNext("how are you");
sink.tryEmitNext("?");

Util.sleepSeconds(2);
flux.subscribe(Util.subscriber("Jake")); // joining late
sink.tryEmitNext("new message");
// Sam and Mike get everything. Jake only gets "new message" — multicast()
// does not replay past messages to late subscribers

// The "warm-up" wrinkle — emitting BEFORE any subscriber exists behaves
// differently than emitting after subscribers already exist:
Sinks.Many<String> sink2 = Sinks.many().multicast().onBackpressureBuffer();
Flux<String> flux2 = sink2.asFlux();

sink2.tryEmitNext("hi");            // emitted with ZERO subscribers present
sink2.tryEmitNext("how are you");
sink2.tryEmitNext("?");
Util.sleepSeconds(2);
flux2.subscribe(Util.subscriber("Sam"));  // the FIRST subscriber ever
flux2.subscribe(Util.subscriber("Mike")); // joins moments later
sink2.tryEmitNext("new message");
// Sam gets ALL FOUR messages — those first 3 had nowhere to go and sat in
// the buffer, claimed entirely by whichever subscriber arrives FIRST.
// Mike, joining moments after Sam, only gets "new message"`,
  },
  {
    id: '12.8',
    title: 'Sink Many — Multicast — Direct Best Effort',
    duration: '9 min',
    kind: 'demo',
    summary: [
      "A genuinely realistic problem: two subscribers on the same multicast sink, one fast (Sam) and one deliberately slow (Mike, via delayElements()). Shrinking the buffer (via the same reactor.bufferSize.small property from Section 8) makes the problem surface quickly: once Mike's slowness fills the shared queue, FAIL_OVERFLOW starts appearing — and critically, it affects delivery to BOTH subscribers, not just the slow one. Sam's fast performance gets dragged down by Mike's slowness, purely because they share one underlying buffer.",
      "Simply enlarging the buffer only delays the same problem rather than fixing the actual coupling between the two subscribers' speeds. multicast().directBestEffort() is the real fix: it prioritizes whichever subscriber can actually keep up, delivering to it cleanly, and simply lets a slow subscriber miss messages it can't process fast enough — decoupling one subscriber's speed from another's entirely.",
      "If losing Mike's messages outright isn't acceptable, the fix from Section 8 still applies here: give Mike his own dedicated .onBackpressureBuffer() on his own subscription, so his slowness is absorbed entirely on his side, with zero effect on Sam's delivery speed.",
    ],
    code: `System.setProperty("reactor.bufferSize.small", "16"); // shrink the queue to surface the problem

Sinks.Many<Integer> sink = Sinks.many().multicast().onBackpressureBuffer();
Flux<Integer> flux = sink.asFlux();

flux.subscribe(Util.subscriber("Sam"));                                          // fast
flux.delayElements(Duration.ofMillis(200)).subscribe(Util.subscriber("Mike"));   // deliberately slow

for (int i = 1; i <= 100; i++) {
    var result = sink.tryEmitNext(i);
    log.info("{} - {}", i, result);
}
Util.sleepSeconds(10);
// FAIL_OVERFLOW appears quickly — Mike's slowness fills the shared queue,
// and past that point NEITHER subscriber can be safely delivered to —
// Sam's fast performance is dragged down purely by sharing a buffer with Mike

// THE FIX — directBestEffort(): prioritize whoever can keep up
Sinks.Many<Integer> sink2 = Sinks.many().multicast().directBestEffort();
Flux<Integer> flux2 = sink2.asFlux();

flux2.subscribe(Util.subscriber("Sam"));
flux2.delayElements(Duration.ofMillis(200)).subscribe(Util.subscriber("Mike"));

for (int i = 1; i <= 100; i++) {
    sink2.tryEmitNext(i);
}
// Sam receives all 100 cleanly. Mike, being too slow, misses almost
// everything — but Sam's performance is no longer held hostage by Mike's

// If Mike's messages genuinely can't be lost, decouple him with his OWN
// dedicated buffer instead:
flux2.onBackpressureBuffer()
    .delayElements(Duration.ofMillis(200))
    .subscribe(Util.subscriber("Mike"));
// Mike now gets every message too, just later — buffered on HIS side
// only, with zero effect on Sam's delivery speed`,
  },
  {
    id: '12.9',
    title: 'Sink Many — Multicast — Direct All Or Nothing',
    duration: '3 min',
    kind: 'demo',
    summary: [
      "directAllOrNothing() takes the exact opposite tradeoff from directBestEffort(): rather than prioritizing whichever subscriber can keep up, it enforces that every subscriber must be able to receive a given message, or none of them get it at all.",
      "Running the same fast-Sam/slow-Mike setup with directAllOrNothing() shows both subscribers receiving exactly one message and then nothing further — the instant any single subscriber can't keep up, delivery halts for everyone simultaneously, not just the slow one.",
    ],
    code: `Sinks.Many<Integer> sink = Sinks.many().multicast().directAllOrNothing();
Flux<Integer> flux = sink.asFlux();

flux.subscribe(Util.subscriber("Sam"));
flux.delayElements(Duration.ofMillis(200)).subscribe(Util.subscriber("Mike")); // slow

for (int i = 1; i <= 100; i++) {
    sink.tryEmitNext(i);
}
// Sam and Mike each receive exactly ONE message, then nothing further —
// every subscriber must be able to receive a message, or NONE of them
// get it. The opposite tradeoff from directBestEffort()'s
// "prioritize whoever's fastest".`,
  },
  {
    id: '12.10',
    title: 'Sink Many — Replay',
    duration: '4 min',
    kind: 'demo',
    summary: [
      "Sinks.many().replay().all() answers directly to multicast()'s limitation: it retains every emitted value in an unbounded internal store specifically so late subscribers can receive the full history, not just future values. Rerunning the exact Sam/Mike/Jake scenario from the multicast lecture with replay() instead shows Jake receiving all four messages — the three that happened before he joined, plus the new one — where multicast() would have given him only the last one.",
      "replay().limit(n) caps how much history gets retained for late joiners instead of keeping everything — replay().limit(1) means a late subscriber only ever sees the single most recent value at the moment they join, not the full backlog. limit() also accepts a Duration instead of a count, for a 'only replay the last N minutes' style requirement instead of a fixed item count.",
    ],
    code: `Sinks.Many<String> sink = Sinks.many().replay().all(); // unbounded — replay EVERYTHING
Flux<String> flux = sink.asFlux();

flux.subscribe(Util.subscriber("Sam"));
flux.subscribe(Util.subscriber("Mike"));
sink.tryEmitNext("hi");
sink.tryEmitNext("how are you");
sink.tryEmitNext("?");

Util.sleepSeconds(2);
flux.subscribe(Util.subscriber("Jake")); // joining late
sink.tryEmitNext("new message");
// Jake receives ALL FOUR messages — replay() is exactly the case where a
// late subscriber SHOULD see everything that already happened

// replay().limit(n) caps retained history instead of keeping everything:
Sinks.Many<String> sink2 = Sinks.many().replay().limit(1); // only the MOST RECENT item
Flux<String> flux2 = sink2.asFlux();
flux2.subscribe(Util.subscriber("Sam"));
sink2.tryEmitNext("hi");
sink2.tryEmitNext("how are you");
sink2.tryEmitNext("?");
Util.sleepSeconds(1);
flux2.subscribe(Util.subscriber("Jake")); // joins late
sink2.tryEmitNext("new message");
// Jake sees only "?" (the single most recent item when he joined) and
// "new message" — not the full history`,
  },
  {
    id: '12.11',
    title: 'Summary',
    duration: '2 min',
    kind: 'summary',
    summary: [
      "Sinks fill a genuine gap: a way to emit data completely manually, on demand, without a loop, range, or interval driving it — created via factory methods and acting as both producer and subscriber, making them a clean integration point between otherwise-unrelated parts of an application.",
      "Sinks.one() carries at most one value with any number of subscribers, retaining it for late joiners — the Mono-shaped option. Sinks.many() covers several flavors for multiple values: unicast() for exactly one subscriber, ever; multicast() for multiple subscribers where late joiners only see new values (the movie-theater behavior); and replay() for multiple subscribers where late joiners see full (or capped) history too.",
      "tryEmitXxx() methods are a best-effort, no-questions-asked contract; emitXxx() methods pair with an explicit EmitFailureHandler for genuinely safe concurrent emission — a real distinction worth remembering whenever a sink is shared across multiple threads.",
    ],
    keyPoints: [
      'Sinks.one() — at most one value, retained for late joiners, any number of subscribers.',
      'Sinks.many().unicast() / multicast() / replay() — multiple values, differing in subscriber count and late-joiner visibility.',
      'directBestEffort() prioritizes fast subscribers over slow ones; directAllOrNothing() blocks everyone if any subscriber falls behind.',
      'tryEmitXxx() is best-effort; emitXxx() + an EmitFailureHandler checking FAIL_NON_SERIALIZED is the actual thread-safe path for concurrent emission.',
    ],
  },
  {
    id: '12.12',
    title: '*** Assignment ***',
    duration: '3 min',
    kind: 'assignment',
    summary: [
      "Simulate a single Slack-style chat room (multiple rooms are explicitly out of scope) where members can be added at any time, and whatever any member says is delivered to every other member currently in the room. A member joining after conversation has already happened should see the full history of everything said before they joined.",
      "The suggested flow: create a room, add two members (Sam and Jake), have them exchange a few messages, wait a few seconds, add a third member (Mike) who should immediately see the entire prior conversation, and then have Mike post a message that the earlier members receive in turn. As with every assignment in this course, the specific class structure is entirely up to the implementer — only the described behavior matters.",
    ],
  },
  {
    id: '12.13',
    title: 'Assignment Solution',
    duration: '12 min',
    kind: 'solution',
    summary: [
      "SlackMember holds a name and a Consumer<String> message handler (set internally by whatever room it joins), exposing says(message) to post and a private receives(message) to log incoming messages. A small SlackMessage record (sender, message) carries a formatForDelivery(receiver) helper for consistent output formatting.",
      "SlackRoom is where the sink lives: a Sinks.many().replay().all()-backed sink, chosen specifically because the requirement calls for late joiners to see full history — exactly what replay() (rather than multicast()) is for. addMember() logs the join, subscribes that member to the room's shared Flux (filtering out messages where the sender equals the receiver, so members don't get an echo of their own messages back), and wires the member's message consumer to call back into the room's own postMessage() — which is just sink.tryEmitNext(new SlackMessage(sender, message)).",
      "Running the suggested flow confirms every piece of the requirement: Sam and Jake's early exchange flows correctly between just the two of them, and Mike — joining several seconds later — immediately receives the entire prior conversation via replay(), then participates normally from that point on, with all messages except each sender's own reaching every other member.",
    ],
    code: `public class SlackMember {
    private final String name;
    private Consumer<String> messageConsumer;

    public SlackMember(String name) {
        this.name = name;
    }

    public String getName() {
        return name;
    }

    void setMessageConsumer(Consumer<String> messageConsumer) {
        this.messageConsumer = messageConsumer;
    }

    public void says(String message) {
        messageConsumer.accept(message);
    }

    private void receives(String message) {
        log.info(message);
    }
}

record SlackMessage(String sender, String message) {
    private static final String FORMAT = "%s to %s: %s";

    public String formatForDelivery(String receiver) {
        return FORMAT.formatted(sender, receiver, message);
    }
}

public class SlackRoom {
    private final String name;
    private final Sinks.Many<SlackMessage> sink;
    private final Flux<SlackMessage> flux;

    public SlackRoom(String name) {
        this.name = name;
        this.sink = Sinks.many().replay().all(); // late joiners see full history
        this.flux = sink.asFlux();
    }

    public void addMember(SlackMember member) {
        log.info("{} joined the room {}", member.getName(), name);
        subscribeToRoomMessages(member);
        member.setMessageConsumer(message -> postMessage(member.getName(), message));
    }

    private void subscribeToRoomMessages(SlackMember member) {
        flux
            .filter(msg -> !msg.sender().equals(member.getName())) // no echo of a member's own message
            .map(msg -> msg.formatForDelivery(member.getName()))
            .subscribe(member::receives);
    }

    private void postMessage(String sender, String message) {
        sink.tryEmitNext(new SlackMessage(sender, message));
    }
}

var room = new SlackRoom("reactor");
var sam = new SlackMember("Sam");
var jake = new SlackMember("Jake");

room.addMember(sam);
room.addMember(jake);

sam.says("Hi all");
Util.sleepSeconds(4);
jake.says("Hey");
sam.says("Just wanted to say hi");

Util.sleepSeconds(4);
var mike = new SlackMember("Mike");
room.addMember(mike); // immediately sees the full conversation history via replay()
mike.says("Hey guys, glad to be here");`,
  },
]
