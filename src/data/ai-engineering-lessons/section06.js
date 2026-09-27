export default [
  {
    id: '6.1',
    title: 'From Word Embeddings to Contextual Representations',
    duration: '10 min',
    kind: 'theory',
    summary: [
      'Before a model can do anything with text, text has to become numbers. This lesson traces that evolution briefly, because understanding what earlier approaches got wrong is what makes the modern approach (and the attention mechanism in 6.2) feel motivated rather than arbitrary.',
      '<em>Bag-of-words</em> represents a document as word counts, discarding all order and context — "dog bites man" and "man bites dog" produce identical representations. <em>TF-IDF</em> improves this slightly by down-weighting common words and up-weighting rare, distinctive ones, but still discards order and still has no notion of meaning — "good" and "great" are as unrelated to TF-IDF as "good" and "table."',
      '<em>Word2Vec</em>-style <em>static embeddings</em> fixed the meaning problem: each word gets a fixed vector, trained so that words appearing in similar contexts end up with similar vectors — this is where "good" and "great" finally end up close together in vector space, and where the dot product from Section 3.1 becomes directly useful (similar words have high cosine similarity). But these embeddings are still <em>static</em> — the word "bank" gets the exact same vector whether it means a riverbank or a financial institution, since the vector is looked up per-word, with no awareness of surrounding context.',
      '<em>Contextual embeddings</em> — the representations transformers produce, covered starting in 6.2 — solve this by computing a word\'s vector fresh each time, based on the specific sentence it appears in. "Bank" in "river bank" and "bank" in "savings bank" get different vectors, because the surrounding words differ. This context-sensitivity is the single biggest capability jump this lesson sequence builds toward.',
      'Before any embedding step happens, text must be <em>tokenized</em> — split into units (words, sub-words, or characters) the model operates on — and mapped to a fixed <em>vocabulary</em> of known tokens. Modern LLMs use <em>subword tokenization</em> (covered again in 6.5), which handles rare and unseen words gracefully by breaking them into smaller known pieces rather than failing on anything outside a fixed word list.',
    ],
    keyPoints: [
      'Bag-of-words / TF-IDF: word counts, no order, no meaning — "good" and "great" look as unrelated as "good" and "table."',
      'Static embeddings (Word2Vec-style): fixed vector per word, similar words end up close in vector space — but the same word always gets the same vector regardless of context.',
      '<strong>Contextual embeddings</strong>: a word\'s vector is computed fresh per sentence, based on surrounding context — "bank" means something different depending on what\'s around it, and the vector reflects that.',
      'Tokenization splits text into model-processable units before any embedding happens; modern LLMs use subword tokenization to handle rare/unseen words gracefully.',
      'This progression — bag-of-words → static embeddings → contextual embeddings — is the motivation for everything covered from 6.2 onward.',
    ],
    code: `# Illustrating the core limitation static embeddings have, that
# contextual embeddings (built via attention, next lesson) solve.

# A STATIC embedding lookup — same vector regardless of context:
static_embeddings = {
    "bank": [0.2, 0.8, -0.1],  # one fixed vector, no matter the sentence
}

sentence_a = "I sat by the river bank"
sentence_b = "I deposited money at the bank"

vector_a = static_embeddings["bank"]  # identical vector
vector_b = static_embeddings["bank"]  # identical vector — this is the problem

print(vector_a == vector_b)  # True — but these two "bank"s mean different things

# A CONTEXTUAL embedding (conceptually — real computation is in 6.2) would
# instead compute a DIFFERENT vector for each occurrence, informed by
# neighboring words like "river" versus "deposited" and "money":
#
#   contextual_vector("bank", context="river bank")      -> leans toward "landform"
#   contextual_vector("bank", context="deposited money")  -> leans toward "institution"
`,
    codeLabel: 'python',
    mermaid: `flowchart LR
    BOW["Bag-of-words / TF-IDF (no order, no meaning)"] --> SE["Static embeddings (Word2Vec-style: meaning, no context)"]
    SE --> CE["Contextual embeddings (transformers: meaning AND context)"]`,
    note: {
      label: 'KEY INSIGHT',
      text: 'The word "bank" needing two different vectors depending on its sentence is the single clearest illustration of why static embeddings weren\'t enough — it\'s the exact problem the attention mechanism in 6.2 was designed to solve.',
      tone: 'green',
    },
    quiz: {
      question: 'Using a static (Word2Vec-style) embedding, the word "bank" in "river bank" and "savings bank" gets the same vector. Why is this a limitation?',
      options: [
        { label: 'It isn\'t a limitation — the word is spelled the same in both cases', correct: false },
        { label: 'The word means something different in each sentence, but a static embedding has no mechanism to reflect that — the vector is looked up per-word with no awareness of context', correct: true },
        { label: 'Static embeddings cannot represent any words that appear in multiple contexts', correct: false },
        { label: 'This only affects rare words, not common ones like "bank"', correct: false },
      ],
      explanation: 'A static embedding assigns exactly one vector per word in the vocabulary, looked up independent of the surrounding sentence — so a genuinely ambiguous word gets one blended or arbitrary representation regardless of which meaning is actually intended in a given sentence. This is precisely the gap contextual embeddings close.',
    },
  },
  {
    id: '6.2',
    title: 'Self-Attention and the Query-Key-Value Mechanism',
    duration: '15 min',
    kind: 'theory',
    summary: [
      '<em>Self-attention</em> is the mechanism that computes a contextual embedding (6.1) for each word by letting every word "look at" every other word in the sentence and decide how much attention to pay to each one — this is the core innovation behind every transformer-based model, including every LLM covered in this course.',
      'Each input token is projected into three vectors via learned weight matrices: a <em>Query</em> (what this token is "looking for"), a <em>Key</em> (what this token "offers" to others looking), and a <em>Value</em> (the actual content this token contributes if attended to). This Q/K/V split is not intuitive on first encounter, but it maps onto something familiar: think of it as a lookup system — the Query is your search term, Keys are the index entries being matched against, and Values are the content you retrieve once a match scores high (the same query/candidate/result shape as the similarity search from Section 3.1).',
      'The attention computation itself: take the dot product (Section 3.1) between a token\'s Query and every token\'s Key — this produces a similarity score for how relevant each other token is. Divide by the square root of the key dimension (this is the "scaled" in "scaled dot-product attention" — it keeps the scores in a numerically stable range as dimensions grow), then apply softmax (5.1) to turn those scores into a probability distribution that sums to 1. Finally, use those probabilities to compute a weighted sum of every token\'s Value vector — tokens that scored high attention contribute more to the result.',
      'The formula, <code>Attention(Q, K, V) = softmax(QK^T / sqrt(d_k)) @ V</code>, is exactly this sequence of operations you\'ve already seen individually: dot product (3.1), scaling, softmax (5.1), and a weighted sum (matrix multiplication, 3.1). Nothing here is a new mathematical primitive — attention is a specific, motivated composition of primitives from earlier in this course.',
      '<strong>Practical guidance:</strong> when debugging why an LLM or RAG system seems to "ignore" relevant context in a long prompt, attention is the mental model to reach for — every token\'s influence on the output is literally a learned, context-dependent weighting, and very long contexts or unusual phrasing can shift where that weighting lands in ways that are hard to predict from the prompt text alone.',
    ],
    keyPoints: [
      'Self-attention lets every token "look at" every other token and weight how much to attend to each — this is how a contextual embedding (6.1) actually gets computed.',
      'Each token is projected into a <strong>Query</strong> (what it\'s looking for), <strong>Key</strong> (what it offers to be matched against), and <strong>Value</strong> (content contributed if attended to).',
      'Attention score = dot product of Query and Key, scaled by sqrt(key dimension) for numerical stability, then softmax to produce weights that sum to 1.',
      'The final output per token is a weighted sum of every token\'s Value vector, weighted by those attention scores.',
      'The full formula — Attention(Q,K,V) = softmax(QK^T / sqrt(d_k)) @ V — composes dot product, scaling, softmax, and weighted sum: all primitives already covered in Sections 3 and 5.',
    ],
    code: `import numpy as np

def softmax(x, axis=-1):
    exp_x = np.exp(x - np.max(x, axis=axis, keepdims=True))
    return exp_x / exp_x.sum(axis=axis, keepdims=True)

def scaled_dot_product_attention(Q, K, V):
    d_k = K.shape[-1]
    scores = Q @ K.T / np.sqrt(d_k)      # dot product, scaled — Section 3.1's math
    weights = softmax(scores)             # Section 5.1's math
    output = weights @ V                  # weighted sum of Values
    return output, weights

# 4 tokens, each projected to Q/K/V vectors of dimension 8 (toy size).
seq_len, d_k = 4, 8
Q = np.random.randn(seq_len, d_k)
K = np.random.randn(seq_len, d_k)
V = np.random.randn(seq_len, d_k)

output, attention_weights = scaled_dot_product_attention(Q, K, V)
print("attention weights (each row sums to 1):\\n", attention_weights.round(2))
print("output shape:", output.shape)  # (4, 8) — one contextual vector per token
`,
    codeLabel: 'python',
    mermaid: `flowchart TB
    T["Token embeddings"] --> Q["Project to Query"]
    T --> K["Project to Key"]
    T --> V["Project to Value"]
    Q --> D["Dot product Q with every Key"]
    K --> D
    D --> S["Scale by sqrt(d_k)"]
    S --> SM["Softmax"]
    SM --> W["Weighted sum of Values"]
    V --> W
    W --> O["Contextual output per token"]`,
    note: {
      label: 'KEY INSIGHT',
      text: 'Every operation inside attention — dot product, scaling, softmax, weighted sum — is something you already implemented separately in Sections 3 and 5; attention is their specific, motivated combination, not a new primitive.',
      tone: 'green',
    },
    quiz: {
      question: 'In scaled dot-product attention, why are the raw QK^T scores divided by sqrt(d_k) before applying softmax?',
      options: [
        { label: 'To make the Query and Key vectors the same length', correct: false },
        { label: 'To keep the scores in a numerically stable range as the key dimension grows, preventing softmax from becoming overly peaked or unstable', correct: true },
        { label: 'It has no mathematical purpose and is only a historical convention', correct: false },
        { label: 'To convert the scores into a probability distribution directly, without needing softmax', correct: false },
      ],
      explanation: 'As the key dimension d_k grows, the dot product\'s magnitude tends to grow with it (more terms summed), which can push softmax into regions where its gradient is very small or its output becomes overly concentrated on one token. Dividing by sqrt(d_k) counteracts this scaling effect, keeping the score distribution well-behaved before softmax is applied.',
    },
    crossRefs: ['6.1', '3.1', '5.1'],
  },
  {
    id: '6.3',
    title: 'Multi-Head Attention & Positional Encoding',
    duration: '10 min',
    kind: 'concept',
    summary: [
      'A single attention computation (6.2) learns one particular way of relating tokens to each other. <em>Multi-head attention</em> runs several independent attention computations ("heads") in parallel, each with its own learned Q/K/V projections, then concatenates their outputs — in practice, different heads often specialize in different kinds of relationships (one head might track grammatical subject-verb agreement, another might track long-range topical relevance), though this specialization emerges from training rather than being explicitly assigned.',
      'A pure attention mechanism has no inherent notion of word order — the formula in 6.2 would produce the same result for "the cat sat on the mat" and a scrambled version of the same words, since attention only looks at content similarity, not position. <em>Positional encoding</em> fixes this by adding a position-dependent signal to each token\'s embedding before attention runs, giving the model information about where each token sits in the sequence.',
      '<em>Causal masking</em> is a specific constraint applied in decoder-style models (the architecture behind most modern LLMs, covered in 6.4): when generating text one token at a time, a token must only attend to itself and earlier tokens, never to tokens that come after it — otherwise the model could "see the future" during training in a way it never can during actual generation. This is implemented by masking out (setting to negative infinity, before softmax) the attention scores for any position that comes after the current one.',
      'Multi-head attention and positional encoding together are what let a transformer process an entire sequence in parallel (unlike older recurrent architectures, which processed one token at a time in order) while still capturing both rich token relationships and their positions — this parallelism is a major reason transformers scale so much more efficiently to long sequences and large training sets than their predecessors.',
      '<strong>Practical guidance:</strong> "context window" (how many tokens a model can attend over at once, covered again in 6.5) is fundamentally limited by how attention and positional encoding are set up for a given model — this is why context length is a fixed architectural property of a model, not something you can casually configure past its trained limit.',
    ],
    keyPoints: [
      '<strong>Multi-head attention</strong>: several independent attention computations run in parallel, each potentially specializing in different token relationships, then combined.',
      'Attention alone has no notion of word order — <strong>positional encoding</strong> adds position information to each token\'s embedding before attention runs.',
      '<strong>Causal masking</strong> (in decoder-style models) prevents a token from attending to future tokens — required so training matches how generation actually happens, one token at a time.',
      'Multi-head attention plus positional encoding lets a transformer process a whole sequence in parallel, unlike older recurrent architectures that processed tokens one at a time in order.',
      'A model\'s context window length is an architectural property tied to how it was trained with positional encoding — not a freely adjustable setting.',
    ],
    code: `import numpy as np

def causal_mask(seq_len):
    """Returns a mask: 0 where attention is allowed, -inf where it's forbidden
    (i.e. attending to a future token)."""
    mask = np.triu(np.ones((seq_len, seq_len)), k=1) * -1e9
    return mask

def masked_attention_scores(Q, K):
    d_k = K.shape[-1]
    scores = Q @ K.T / np.sqrt(d_k)
    scores = scores + causal_mask(seq_len=Q.shape[0])  # forbid attending forward
    return scores

seq_len, d_k = 5, 8
Q = np.random.randn(seq_len, d_k)
K = np.random.randn(seq_len, d_k)

scores = masked_attention_scores(Q, K)
print("raw scores with causal mask applied (upper triangle is -inf-ish):")
print(scores.round(1))
# After softmax, the masked positions collapse to ~0 probability —
# token 0 can only attend to token 0; token 4 can attend to tokens 0-4.
`,
    codeLabel: 'python',
    mermaid: `flowchart LR
    E["Token embeddings"] --> PE["+ Positional encoding"]
    PE --> H1["Attention head 1"]
    PE --> H2["Attention head 2"]
    PE --> H3["Attention head 3 (...)"]
    H1 --> C["Concatenate heads"]
    H2 --> C
    H3 --> C
    C --> O["Combined contextual output"]`,
    note: {
      label: 'WHY THIS MATTERS',
      text: 'Causal masking is why an LLM can\'t "peek ahead" while generating — each new token is produced using only the tokens generated (or provided) so far, which is exactly how autoregressive generation (6.5) works.',
      tone: 'green',
    },
    quiz: {
      question: 'A decoder-style LLM is generating text one token at a time. Why does it need causal masking during training, given that it only sees earlier tokens when actually generating?',
      options: [
        { label: 'Causal masking is unnecessary — training and generation naturally match without it', correct: false },
        { label: 'Without causal masking, training would let the model attend to future tokens it will never have access to at generation time, teaching it a shortcut that doesn\'t exist in the real generation setting', correct: true },
        { label: 'Causal masking is only needed to speed up training, not for correctness', correct: false },
        { label: 'Causal masking replaces the need for positional encoding entirely', correct: false },
      ],
      explanation: 'During training, the full target sequence is available in memory, so without masking the model could trivially "cheat" by attending to tokens that come after the one it\'s predicting — a shortcut unavailable during actual generation, where future tokens don\'t exist yet. Masking forces training to match the real, one-token-at-a-time generation constraint.',
    },
    crossRefs: ['6.2'],
  },
  {
    id: '6.4',
    title: 'Encoder, Decoder & Encoder-Decoder Architectures',
    duration: '10 min',
    kind: 'concept',
    summary: [
      'The attention mechanism (6.2, 6.3) can be assembled into three different overall architectures, each suited to a different kind of task — knowing which is which explains why, for example, a "BERT-style" model and "GPT-style" model behave so differently despite sharing the same core mechanism.',
      '<em>Encoder-only</em> models (e.g. BERT) process the entire input at once with no causal masking — every token can attend to every other token, including ones that come after it. This bidirectional view makes encoder-only models well suited to tasks that need to understand a complete input: classification, extracting embeddings for semantic search (the embeddings used throughout Section 8\'s RAG systems often come from encoder-style models), or filling in a masked word using context from both directions.',
      '<em>Decoder-only</em> models (e.g. the GPT family, and most modern general-purpose LLMs) use causal masking (6.3) and are trained to predict the next token given only everything before it. This autoregressive setup — generate one token, feed it back in, generate the next — is what makes decoder-only models naturally suited to open-ended text generation, and is the architecture behind essentially every LLM you\'ll call via API in Sections 7 through 13.',
      '<em>Encoder-decoder</em> models (e.g. the original Transformer, T5) use an encoder to build a full bidirectional representation of an input, then a decoder that generates output autoregressively while also attending back to the encoder\'s representation via <em>cross-attention</em>. This structure suits tasks with a clear input/output transformation, like translation or summarization, where you want to fully understand the input before generating a different kind of output.',
      '<strong>Practical guidance:</strong> when you see "embedding model" versus "generation model" in Section 8\'s RAG architecture, this is exactly this distinction — embedding models are typically encoder-style (understand and represent, don\'t generate), while the LLM that produces the final answer is decoder-style (generate, given the retrieved context as input).',
    ],
    keyPoints: [
      '<strong>Encoder-only</strong> (e.g. BERT): bidirectional attention, no causal mask — suited to understanding tasks like classification and producing embeddings for search.',
      '<strong>Decoder-only</strong> (e.g. GPT-family): causal masking, autoregressive next-token prediction — the architecture behind most modern general-purpose LLMs used via API.',
      '<strong>Encoder-decoder</strong> (e.g. T5): encoder builds a full input representation, decoder generates output autoregressively while cross-attending to it — suited to input-to-output transformation tasks like translation.',
      'The embedding models used for RAG retrieval (Section 8) are typically encoder-style; the LLM producing the final generated answer is typically decoder-style.',
      'Architecture choice follows directly from the task: understanding-only → encoder; open-ended generation → decoder; structured transformation → encoder-decoder.',
    ],
    code: `# Conceptual comparison — not runnable code, but the shape of each architecture's
# attention pattern, since that's the actual distinguishing factor.

# ENCODER-ONLY (e.g. BERT-style): every token attends to every other token.
# attention_mask = all zeros (no restriction) — fully bidirectional.

# DECODER-ONLY (e.g. GPT-style): causal mask from 6.3 — token i only attends
# to tokens 0..i.
# attention_mask[i][j] = 0 if j <= i else -inf

# ENCODER-DECODER (e.g. T5-style): encoder is bidirectional (like BERT),
# decoder is causal (like GPT) PLUS a cross-attention layer where the
# decoder's Queries attend to the ENCODER's Keys/Values, not just its own:
#
#   decoder_output = CrossAttention(
#       Q=decoder_hidden_states,
#       K=encoder_output,
#       V=encoder_output,
#   )
#
# This is how the decoder "looks back" at the fully-processed input while
# generating output autoregressively.
`,
    codeLabel: 'python',
    mermaid: `flowchart TB
    subgraph Encoder-only
    EA["Bidirectional attention: every token sees every token"]
    end
    subgraph Decoder-only
    DA["Causal attention: token i sees only tokens 0..i"]
    end
    subgraph Encoder-decoder
    ED1["Encoder: bidirectional"] --> ED2["Decoder: causal + cross-attention to encoder output"]
    end`,
    note: {
      label: 'WHEN TO USE',
      text: 'If you need a fixed-size vector representing a whole document\'s meaning (for search or classification), reach for an encoder-style model; if you need to generate open-ended text, reach for a decoder-style model — this single distinction covers almost every model-choice decision in this course.',
      tone: 'green',
    },
    quiz: {
      question: 'A RAG system needs an embedding model to represent documents for similarity search, and separately an LLM to generate the final natural-language answer. Which architecture style is each typically drawn from?',
      options: [
        { label: 'Both are typically decoder-only models', correct: false },
        { label: 'The embedding model is typically encoder-style (bidirectional understanding); the answer-generating LLM is typically decoder-style (autoregressive generation)', correct: true },
        { label: 'Both are typically encoder-decoder models', correct: false },
        { label: 'The choice of architecture has no bearing on which task a model is suited for', correct: false },
      ],
      explanation: 'Producing a fixed representation of a document\'s full meaning for search benefits from bidirectional attention (encoder-style), since there\'s no generation involved — while producing open-ended generated text is exactly what decoder-only, autoregressive, causally-masked models are built for. This is why RAG systems typically pair an encoder-style embedding model with a decoder-style LLM.',
    },
    crossRefs: ['6.2', '6.3'],
  },
  {
    id: '6.5',
    title: 'Inside a Large Language Model: Tokens, Logits & Sampling',
    duration: '12 min',
    kind: 'concept',
    summary: [
      'This lesson traces the complete path from raw text input to generated text output in a decoder-only LLM (6.4), tying together tokenization (6.1), embeddings, attention (6.2, 6.3), and the softmax operation (5.1) into one end-to-end pipeline.',
      'Text is first split by a <em>tokenizer</em> into <em>tokens</em> — not always whole words; subword tokenization (e.g. Byte-Pair Encoding) breaks rare or unfamiliar words into smaller familiar pieces, so the model never encounters a completely unknown word, only unfamiliar combinations of known subword pieces. Each token maps to an integer <em>token ID</em>, which is looked up in an embedding table to produce the token\'s initial vector — this is the input to the transformer\'s stack of attention layers (6.2, 6.3).',
      'After passing through many transformer blocks, the model produces a vector for the next position, which is projected (via one more learned matrix) into a score — a <em>logit</em> — for every token in the entire vocabulary (often 50,000–100,000+ possible tokens). Softmax (5.1) turns these logits into a probability distribution over the vocabulary: "given everything so far, how likely is each possible next token?"',
      '<em>Sampling</em> decides how to actually pick the next token from that distribution. <em>Temperature</em> reshapes the distribution before sampling — low temperature sharpens it toward the highest-probability tokens (more deterministic, more repetitive), high temperature flattens it (more random, more creative, more prone to incoherence). <em>Top-k</em> restricts sampling to only the k highest-probability tokens; <em>top-p</em> (nucleus sampling) instead includes just enough top tokens for their combined probability to reach a threshold p, adapting the candidate pool size to how confident the distribution is at that step.',
      '<strong>Hallucination</strong>, in this framing, isn\'t a bug where the model "looks something up wrong" — there is no lookup. At each step, the model is sampling from a learned probability distribution over plausible-sounding next tokens; if the training data or context doesn\'t constrain that distribution enough around a specific fact, a fluent but factually wrong continuation can still be highly probable. This is precisely the gap RAG (Section 8) is designed to close — by injecting retrieved factual context directly into the input the model conditions on, narrowing that distribution toward what\'s actually true.',
    ],
    keyPoints: [
      'Tokenizer → token IDs → embedding lookup → transformer blocks (attention + feedforward) → logits over the whole vocabulary → softmax → probability distribution.',
      'Subword tokenization means an LLM never encounters a truly unknown word — only unfamiliar combinations of known subword pieces.',
      '<strong>Temperature</strong> reshapes the distribution\'s sharpness; <strong>top-k</strong>/<strong>top-p</strong> restrict which tokens are eligible to be sampled at all.',
      'Hallucination is fluent, high-probability sampling that happens to be factually wrong — not a retrieval failure, since there is no retrieval happening inside the base model.',
      'RAG (Section 8) addresses hallucination by narrowing the model\'s next-token distribution using retrieved factual context as additional input, rather than by fixing the sampling mechanism itself.',
    ],
    code: `import numpy as np

def softmax(logits):
    exp_logits = np.exp(logits - np.max(logits))
    return exp_logits / exp_logits.sum()

def sample_with_temperature(logits, temperature=1.0, top_k=None):
    scaled_logits = logits / temperature       # reshape distribution sharpness
    probs = softmax(scaled_logits)

    if top_k is not None:
        top_k_idx = np.argsort(probs)[-top_k:]  # keep only top-k candidates
        mask = np.zeros_like(probs)
        mask[top_k_idx] = probs[top_k_idx]
        probs = mask / mask.sum()               # renormalize over the reduced set

    return np.random.choice(len(probs), p=probs)

# Toy vocabulary of 6 tokens with raw logits for "the next word after 'The cat sat on the'"
vocab = ["mat", "roof", "moon", "purple", "xylophone", "and"]
logits = np.array([4.5, 3.8, 1.2, -1.0, -3.5, 2.9])

low_temp_choice = sample_with_temperature(logits, temperature=0.3)
high_temp_choice = sample_with_temperature(logits, temperature=1.8)
top_k_choice = sample_with_temperature(logits, temperature=1.0, top_k=2)

print("low temperature (more deterministic):", vocab[low_temp_choice])
print("high temperature (more random):", vocab[high_temp_choice])
print("top-k=2 (only 'mat' or 'roof' eligible):", vocab[top_k_choice])
`,
    codeLabel: 'python',
    mermaid: `flowchart LR
    T["Text"] --> TK["Tokenizer"]
    TK --> ID["Token IDs"]
    ID --> EM["Embedding lookup"]
    EM --> TB["Transformer blocks (attention + feedforward)"]
    TB --> LG["Logits over vocabulary"]
    LG --> SM["Softmax"]
    SM --> SA["Sampling (temperature / top-k / top-p)"]
    SA --> NT["Next token"]
    NT -->|feed back in| TK`,
    note: {
      label: 'KEY INSIGHT',
      text: 'Hallucination is the model sampling a fluent, high-probability-but-wrong continuation — not a failed lookup. This is exactly why RAG (Section 8) works by changing what the model conditions on, not by changing how sampling itself works.',
      tone: 'green',
    },
    quiz: {
      question: 'An LLM confidently generates a factually incorrect date in its answer. Which statement best describes what happened mechanically?',
      options: [
        { label: 'The model looked up the date in an internal database and retrieved the wrong entry', correct: false },
        { label: 'The model sampled a token sequence that was fluent and high-probability given its training and the provided context, but happened not to match the true fact', correct: true },
        { label: 'A tokenization error caused the date to be corrupted', correct: false },
        { label: 'The temperature setting was set to exactly 0', correct: false },
      ],
      explanation: 'There is no internal lookup step in a base LLM — every output token, including a date, is sampled from a learned probability distribution shaped by training data and the current context. If that distribution isn\'t sufficiently constrained toward the correct fact, a plausible-sounding but wrong answer can still be highly probable — which is precisely the failure mode RAG is designed to reduce by supplying grounding context.',
    },
    crossRefs: ['6.4', '6.1', '6.2', '6.3', '5.1'],
  },
  {
    id: '6.6',
    title: 'Lab: Implementing Scaled Dot-Product Attention',
    duration: '20 min',
    kind: 'assignment',
    summary: [
      'This lab asks you to implement the full scaled dot-product attention mechanism from 6.2 — including causal masking from 6.3 — in PyTorch, and verify it against a known reference computation. Unlike 6.2\'s NumPy walkthrough, this version uses PyTorch tensors and is structured as a reusable module, closer to how you\'d actually encounter attention inside a real model implementation.',
      'Implement it as an <code>nn.Module</code> that takes Query, Key, and Value tensors (already projected — the projection matrices themselves are out of scope for this lab) and an optional causal mask flag, and returns both the attention output and the attention weights (useful for later inspecting which tokens a model attended to, a common debugging technique referenced again in Section 9.7\'s agent observability lesson).',
      'Verify your implementation two ways: first, confirm the attention weights for each query position sum to 1 (a property of softmax); second, with the causal mask enabled, confirm that position <code>i</code>\'s attention weights are exactly zero for every position after <code>i</code> — if either check fails, the bug is almost always in the masking step or an incorrect transpose in the QK^T computation.',
      'A reference solution follows below. Build and test your own implementation, including both verification checks, before comparing.',
    ],
    keyPoints: [
      'Implement Attention(Q,K,V) = softmax(QK^T / sqrt(d_k) [+ causal mask]) @ V as a reusable PyTorch module.',
      'Return both the output and the attention weights — the weights themselves are useful for later debugging and observability work.',
      'Verify: attention weights for each position must sum to exactly 1 (a softmax property).',
      'Verify: with causal masking enabled, weights for any future position must be exactly zero.',
      'A failed verification almost always traces back to the masking step or a transpose error in the QK^T computation.',
    ],
    code: `import torch
import torch.nn as nn
import torch.nn.functional as F


class ScaledDotProductAttention(nn.Module):
    def forward(self, Q, K, V, causal=False):
        d_k = K.shape[-1]
        scores = Q @ K.transpose(-2, -1) / (d_k ** 0.5)

        if causal:
            seq_len = Q.shape[-2]
            mask = torch.triu(torch.ones(seq_len, seq_len), diagonal=1).bool()
            scores = scores.masked_fill(mask, float("-inf"))

        weights = F.softmax(scores, dim=-1)
        output = weights @ V
        return output, weights


# --- Build and verify ---
torch.manual_seed(0)
seq_len, d_k = 5, 8
Q = torch.randn(seq_len, d_k)
K = torch.randn(seq_len, d_k)
V = torch.randn(seq_len, d_k)

attention = ScaledDotProductAttention()
output, weights = attention(Q, K, V, causal=True)

# Verification 1: each row of weights sums to 1
row_sums = weights.sum(dim=-1)
assert torch.allclose(row_sums, torch.ones(seq_len), atol=1e-5), "weights don't sum to 1"

# Verification 2: causal mask — no weight leaks to future positions
upper_triangle = torch.triu(weights, diagonal=1)
assert torch.allclose(upper_triangle, torch.zeros_like(upper_triangle)), "causal mask leaking"

print("both verification checks passed")
print("attention weights:\\n", weights.round(decimals=3))
`,
    codeLabel: 'python',
    note: {
      label: 'DECISION POINT',
      text: 'If verification check 2 fails (future positions have non-zero weight), check whether the mask was applied to the scores BEFORE softmax, not after — masking after softmax leaves the leaked probability mass in place instead of removing it.',
      tone: 'green',
    },
    quiz: {
      question: 'Your causal-masked attention implementation fails the verification check — some future positions have non-zero attention weight. Where is the bug most likely located?',
      options: [
        { label: 'The Query and Key projection matrices were initialized incorrectly', correct: false },
        { label: 'The mask was applied to the raw scores AFTER softmax rather than before it, so the already-computed probabilities weren\'t actually zeroed out', correct: true },
        { label: 'The value dimension d_k is too small for masking to work', correct: false },
        { label: 'PyTorch does not support causal masking without a custom CUDA kernel', correct: false },
      ],
      explanation: 'Masking must set the disallowed positions to negative infinity BEFORE softmax, so that softmax itself produces zero probability there. Applying the mask after softmax would need to renormalize the remaining probabilities to still sum to 1, which naive post-softmax masking usually fails to do correctly — leaving leaked probability mass on supposedly-forbidden positions.',
    },
    crossRefs: ['6.2', '6.3'],
  },
]
