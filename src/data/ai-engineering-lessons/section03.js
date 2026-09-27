export default [
  {
    id: '3.1',
    title: 'Vectors, Matrices & the Dot Product',
    duration: '10 min',
    kind: 'concept',
    summary: [
      'This lesson is deliberately narrow: just enough linear algebra to make everything from Section 6 onward (embeddings, attention, RAG retrieval) feel mechanical rather than mysterious. A <em>vector</em> is an ordered list of numbers — an embedding is nothing more exotic than a vector of a few hundred or thousand floating-point numbers representing a piece of text\'s "meaning" in some learned space. A <em>matrix</em> is a 2D grid of numbers, and a batch of vectors stacked together is exactly a matrix.',
      'The <em>dot product</em> of two vectors — multiply corresponding elements, then sum — is the single most important operation in this entire course. It measures how much two vectors point in the same direction: a large positive dot product means "very similar," a value near zero means "unrelated," a negative value means "opposite." Every embedding similarity search, and the attention mechanism you\'ll implement in Section 6, is built on this one operation.',
      '<em>Matrix multiplication</em> is just many dot products at once: each element of the result is the dot product of a row from the first matrix and a column from the second. This is why matrix multiplication requires the inner dimensions to match (an <code>(m, k)</code> matrix times a <code>(k, n)</code> matrix) — each of those <code>k</code>-length rows and columns needs to line up for the dot products to be defined.',
      'The <em>norm</em> of a vector (its length, computed as the square root of the dot product of the vector with itself) matters because raw dot products are affected by vector length, not just direction — a longer vector produces a bigger dot product even pointing the same direction as a shorter one. <em>Cosine similarity</em> — the dot product divided by both norms — normalizes this out, comparing direction alone. This is why cosine similarity, not raw dot product, is the standard metric for comparing embeddings of different lengths.',
      '<strong>Practical guidance:</strong> when you see "similarity search" or "nearest neighbor" later in this course, mentally translate it to "compute dot products (or cosine similarities) between a query vector and many candidate vectors, keep the highest-scoring ones." That translation is the entire conceptual core of retrieval.',
    ],
    keyPoints: [
      'A vector is an ordered list of numbers; an embedding is a vector representing meaning in a learned space.',
      'The <strong>dot product</strong> measures directional similarity between two vectors — this single operation underlies embeddings, similarity search, and attention.',
      'Matrix multiplication is many dot products computed at once; inner dimensions must match for a reason (rows and columns being dotted must be the same length).',
      '<strong>Cosine similarity</strong> = dot product normalized by both vectors\' lengths — compares direction only, independent of magnitude.',
      '"Similarity search" always reduces to: compute dot products / cosine similarities against a query, keep the top-scoring candidates.',
    ],
    code: `import numpy as np

query = np.array([0.8, 0.1, 0.3])
candidates = np.array([
    [0.7, 0.2, 0.4],   # similar direction to query
    [-0.8, -0.1, -0.3],  # opposite direction
    [0.0, 0.9, 0.1],     # unrelated direction
])

# Raw dot product — affected by vector length, not just direction
dot_scores = candidates @ query
print("dot products:", dot_scores)

# Cosine similarity — normalizes out length, compares direction only
def cosine_similarity(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    a_norm = a / np.linalg.norm(a, axis=-1, keepdims=True)
    b_norm = b / np.linalg.norm(b)
    return a_norm @ b_norm

cos_scores = cosine_similarity(candidates, query)
print("cosine similarities:", cos_scores)

best_match_idx = np.argmax(cos_scores)
print("closest candidate:", candidates[best_match_idx])
`,
    codeLabel: 'python',
    mermaid: `flowchart LR
    Q["Query vector"] --> D["Dot product with each candidate"]
    C["Candidate vectors"] --> D
    D --> N["Normalize by vector norms"]
    N --> S["Cosine similarity scores"]
    S --> R["Rank and keep top matches"]`,
    note: {
      label: 'KEY INSIGHT',
      text: 'Every "search" over embeddings you\'ll build in this course — RAG retrieval, semantic search — is this same dot-product-and-rank operation, just at a much larger scale.',
      tone: 'green',
    },
    quiz: {
      question: 'Two embedding vectors point in nearly the same direction, but one has a much larger magnitude than the other. What happens to their raw dot product versus their cosine similarity?',
      options: [
        { label: 'Both the dot product and cosine similarity will be roughly the same', correct: false },
        { label: 'The raw dot product will be inflated by the larger magnitude, while cosine similarity stays high and accurately reflects the similar direction', correct: true },
        { label: 'Cosine similarity cannot be computed when magnitudes differ', correct: false },
        { label: 'The dot product will be near zero regardless of direction', correct: false },
      ],
      explanation: 'The dot product scales with both vectors\' magnitudes, so a longer vector inflates the score even at the same direction. Cosine similarity divides out both magnitudes, isolating directional similarity — which is why it, not the raw dot product, is the standard metric for comparing embeddings.',
    },
  },
  {
    id: '3.2',
    title: 'Gradients & the Chain Rule, Intuitively',
    duration: '10 min',
    kind: 'theory',
    summary: [
      'This lesson builds intuition, not derivation skill — you will not be asked to differentiate anything by hand in this course. What matters is understanding what a gradient <em>is</em> well enough that "gradient descent" and "backpropagation" (Section 5) stop being magic words.',
      'A <em>derivative</em> answers: if I nudge this input slightly, how much does the output change, and in which direction? A <em>gradient</em> is the same idea generalized to a function with many inputs — it\'s a vector pointing in the direction of steepest increase, one component per input variable. If a model has a million parameters, its gradient is a million-dimensional vector, one number per parameter, each saying "nudging this specific parameter this direction would increase the loss by roughly this much."',
      '<em>Gradient descent</em> follows directly from this: since the gradient points toward steepest <em>increase</em>, moving a parameter in the <em>opposite</em> direction of its gradient component decreases the loss. Repeat this for every parameter, a small step at a time, and the loss (roughly) decreases over many iterations. The "learning rate" is simply how big a step you take each time.',
      'The <em>chain rule</em> matters because a neural network is a chain of functions (input → layer 1 → layer 2 → ... → output → loss), and you need the gradient of the loss with respect to a parameter buried deep inside that chain. The chain rule says you can compute that by multiplying together the local derivatives of each function in the chain — which is exactly what backpropagation (Section 5.2) automates, one layer at a time, working backward from the loss.',
      '<strong>Practical guidance:</strong> when a training run in Section 5 fails to improve, or improves erratically, the vocabulary for reasoning about it is gradient-based: "the learning rate is too high, so it\'s overshooting" or "gradients are vanishing through many layers." You don\'t need to compute a gradient by hand to reason correctly about a system in these terms.',
    ],
    keyPoints: [
      'A derivative answers: how much does output change if input changes slightly, and in which direction?',
      'A <strong>gradient</strong> generalizes this to many inputs — one "how much and which direction" per parameter.',
      '<strong>Gradient descent</strong>: move each parameter opposite its gradient component, by a step size called the learning rate.',
      'The <strong>chain rule</strong> lets you compute a gradient through a chain of functions by multiplying local derivatives — this is what backpropagation automates.',
      'You can reason correctly about training problems (overshooting, vanishing gradients) using this vocabulary without ever deriving a gradient by hand.',
    ],
    code: `import numpy as np

# A tiny concrete example: minimize f(x) = (x - 3) ** 2 using gradient descent.
# The gradient of (x - 3)**2 with respect to x is 2*(x - 3) — provided here
# directly, since the point is the descent LOOP, not the differentiation.

def f(x):
    return (x - 3) ** 2

def gradient(x):
    return 2 * (x - 3)

x = 0.0            # starting guess
learning_rate = 0.1

for step in range(20):
    grad = gradient(x)
    x = x - learning_rate * grad   # move OPPOSITE the gradient
    if step % 5 == 0:
        print(f"step {step}: x={x:.4f}, f(x)={f(x):.4f}")

print(f"final x ≈ {x:.4f} (true minimum is at x = 3)")
`,
    codeLabel: 'python',
    mermaid: `flowchart LR
    X["Current parameter value"] --> G["Compute gradient"]
    G --> D["Step opposite the gradient direction"]
    D --> U["Updated parameter value"]
    U -->|repeat| X`,
    note: {
      label: 'WHEN TO USE',
      text: 'If a training loop in Section 5 diverges (loss increases instead of decreasing), the learning rate is almost always the first thing to check — it\'s likely too large, causing steps to overshoot the minimum.',
      tone: 'green',
    },
    quiz: {
      question: 'During gradient descent, the loss starts increasing wildly instead of decreasing after each step. What is the most likely cause?',
      options: [
        { label: 'The gradient was computed incorrectly and always points toward increase', correct: false },
        { label: 'The learning rate is too large, causing each step to overshoot past the minimum', correct: true },
        { label: 'Gradient descent cannot work on this type of function', correct: false },
        { label: 'The chain rule does not apply to this scenario', correct: false },
      ],
      explanation: 'A learning rate that\'s too large causes each parameter update to overshoot the minimum, potentially landing further from it than before — producing increasing rather than decreasing loss. This is one of the most common and most diagnosable training failures, and the first thing to check is step size, not the gradient computation itself.',
    },
  },
  {
    id: '3.3',
    title: 'Probability & Statistics for Model Evaluation',
    duration: '10 min',
    kind: 'concept',
    summary: [
      'The statistics you need for this course are the descriptive kind used to summarize and evaluate data and model behavior — not the inferential/hypothesis-testing machinery of formal statistics, which this course deliberately skips as unnecessary for building AI products.',
      '<em>Mean</em> and <em>median</em> both summarize "the center" of a set of values, but behave differently with outliers: mean is pulled toward extreme values, median is not. <em>Variance</em> and its square root, <em>standard deviation</em>, measure spread — how far values typically sit from the mean. When you later look at latency or cost metrics for an AI service, "average latency" alone hides whether that average comes from consistently-moderate requests or a mix of very-fast and very-slow ones; standard deviation (or better, percentiles like p95/p99) reveals that.',
      '<em>Correlation</em> measures how two variables move together, ranging from -1 (perfectly opposite) to +1 (perfectly together), with 0 meaning no linear relationship. It is easy to over-read correlation as causation — two variables can correlate strongly because a third, unobserved factor drives both.',
      'A <em>probability distribution</em> describes how likely different outcomes are. You will not need to work with distributions mathematically in this course, but you will need the vocabulary: LLM output sampling (Section 6.5) works by treating the model\'s output as a probability distribution over the vocabulary and drawing from it, and "temperature" is literally a parameter that reshapes that distribution\'s spread.',
      '<strong>Practical guidance:</strong> when evaluating a model or system later in this course, reach for percentiles (p50/p95/p99) over a single average whenever the distribution of outcomes matters — which, for latency and cost in a production AI system, it almost always does.',
    ],
    keyPoints: [
      '<strong>Mean</strong> is sensitive to outliers; <strong>median</strong> is not — check both when summarizing a metric.',
      '<strong>Standard deviation</strong> (or percentiles) reveals whether an average hides a wide spread of outcomes.',
      '<strong>Correlation</strong> ranges -1 to +1; a strong correlation does not establish causation.',
      'LLM sampling treats output as a probability distribution over possible next tokens — "temperature" reshapes that distribution\'s spread (covered fully in Section 6.5).',
      'Prefer p50/p95/p99 latency metrics over a single average for production AI systems — the tail matters more than the center for user experience.',
    ],
    code: `import numpy as np

latencies_ms = np.array([120, 130, 125, 140, 118, 2400, 128, 135, 122, 3100])

mean_latency = latencies_ms.mean()
median_latency = np.median(latencies_ms)
std_latency = latencies_ms.std()

p50, p95, p99 = np.percentile(latencies_ms, [50, 95, 99])

print(f"mean:   {mean_latency:.1f} ms")   # pulled high by the two slow outliers
print(f"median: {median_latency:.1f} ms")  # unaffected by the outliers
print(f"std:    {std_latency:.1f} ms")     # large — signals a wide, uneven spread
print(f"p50/p95/p99: {p50:.0f} / {p95:.0f} / {p99:.0f} ms")
# The mean alone would suggest a moderately slow service; the percentiles reveal
# that most requests are fast, but a small tail is dramatically slower — a very
# different (and more actionable) picture for debugging.
`,
    codeLabel: 'python',
    note: {
      label: 'DECISION POINT',
      text: 'When a single "average latency" number looks acceptable but users report a slow experience, check p95/p99 before anything else — a fine average often hides a bad tail.',
      tone: 'green',
    },
    quiz: {
      question: 'A service reports an average latency of 300ms, which seems fine, but users complain the app "sometimes freezes." What is the most useful next diagnostic step?',
      options: [
        { label: 'Trust the average and look elsewhere for the cause', correct: false },
        { label: 'Check the p95/p99 latency percentiles to see if a tail of much slower requests is hidden by the average', correct: true },
        { label: 'Recompute the mean using a different rounding method', correct: false },
        { label: 'Assume the complaints are unrelated to latency entirely', correct: false },
      ],
      explanation: 'A mean can look fine even when a meaningful fraction of requests are dramatically slower than the rest — percentiles (p95/p99) reveal that tail directly, which a single average number cannot. This is exactly the kind of "freezes sometimes" complaint pattern a mean-only view would miss.',
    },
  },
  {
    id: '3.4',
    title: 'Lab: Implementing Cosine Similarity and Euclidean Distance From Scratch',
    duration: '15 min',
    kind: 'assignment',
    summary: [
      'This lab makes the math from 3.1 concrete by implementing, from scratch in NumPy, the two distance/similarity metrics you will rely on for the rest of this course: cosine similarity and Euclidean distance. You already saw cosine similarity used in 3.1\'s code — here you implement it yourself and also add Euclidean distance, then reason about when each is the right choice.',
      '<em>Euclidean distance</em> measures straight-line distance between two points/vectors — <code>sqrt(sum((a - b) ** 2))</code>. Unlike cosine similarity, it is sensitive to magnitude: two vectors pointing the same direction but with very different lengths will have a large Euclidean distance despite being "similar" in direction. This is precisely why embedding-based similarity search almost always uses cosine similarity (or a magnitude-normalized dot product) rather than Euclidean distance — direction, not raw length, is what encodes meaning in most embedding spaces.',
      'Implement both functions without using any prebuilt distance function from a library — the goal is for the dot product and norm operations from 3.1 to become completely mechanical before you rely on a library\'s built-in version (e.g. <code>sklearn.metrics.pairwise.cosine_similarity</code>) in later sections.',
      'A reference solution follows below. Attempt your own implementation first, including handling the edge case of a zero vector (which makes cosine similarity undefined — division by zero) before checking against it.',
    ],
    keyPoints: [
      'Cosine similarity: direction-only comparison, magnitude normalized out — the standard for embedding similarity search.',
      'Euclidean distance: straight-line distance, sensitive to magnitude — appropriate when absolute position/scale matters, not just direction.',
      'A zero vector makes cosine similarity undefined (division by zero) — handle this edge case explicitly rather than letting it silently produce NaN.',
      'Implementing these by hand once makes every later "similarity search" and "nearest neighbor" concept fully mechanical rather than a black box.',
      'Prefer a well-tested library implementation (e.g. scikit-learn, FAISS) in real projects — this lab is for building intuition, not for production code.',
    ],
    code: `import numpy as np

def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        raise ValueError("Cosine similarity is undefined for a zero vector.")
    return float(np.dot(a, b) / (norm_a * norm_b))


def euclidean_distance(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.sqrt(np.sum((a - b) ** 2)))


# --- Verification ---
same_direction_short = np.array([1.0, 1.0])
same_direction_long = np.array([10.0, 10.0])   # same direction, much larger magnitude
different_direction = np.array([-1.0, 1.0])

print("cosine (same direction, different magnitude):",
      cosine_similarity(same_direction_short, same_direction_long))   # ~1.0 — direction matches
print("euclidean (same direction, different magnitude):",
      euclidean_distance(same_direction_short, same_direction_long))   # large — magnitude matters

print("cosine (different direction):",
      cosine_similarity(same_direction_short, different_direction))   # ~0.0 — orthogonal
`,
    codeLabel: 'python',
    note: {
      label: 'WHY THIS MATTERS',
      text: 'This is the exact reason vector databases in Section 8 default to cosine similarity (or normalized dot product) as their distance metric — embedding direction encodes meaning, and Euclidean distance would incorrectly penalize longer embeddings.',
      tone: 'green',
    },
    quiz: {
      question: 'Two document embeddings point in nearly the same direction but one has a much larger norm (magnitude) than the other. Using Euclidean distance to compare them, what result would you see, and is it a meaningful signal of dissimilarity?',
      options: [
        { label: 'A small distance, correctly indicating they are similar', correct: false },
        { label: 'A large distance, which would be misleading — the vectors are directionally similar despite the magnitude difference', correct: true },
        { label: 'Euclidean distance cannot be computed for vectors of different magnitude', correct: false },
        { label: 'The result would exactly match the cosine similarity score', correct: false },
      ],
      explanation: 'Euclidean distance is sensitive to magnitude, so a large difference in vector length produces a large distance even when the vectors point in nearly the same direction — this would be a misleading signal for embedding comparison, which is precisely why cosine similarity is preferred for that use case.',
    },
  },
]
