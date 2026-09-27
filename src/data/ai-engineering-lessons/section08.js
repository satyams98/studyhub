export default [
  {
    id: '8.1',
    title: 'The RAG Architecture: From Documents to Answers',
    duration: '12 min',
    kind: 'theory',
    summary: [
      'Section 6.5 ended on hallucination: an LLM samples fluent, plausible text from a learned distribution, with no guarantee that distribution is anchored to specific facts it wasn\'t trained on or has since forgotten the details of. <em>Retrieval-Augmented Generation (RAG)</em> addresses this directly — instead of hoping the model already knows an answer, you retrieve relevant source material at query time and hand it to the model as part of its input, so it generates an answer <em>grounded</em> in that material rather than purely from its training data.',
      'The full pipeline has two phases. <em>Ingestion</em> (done once, ahead of time, and re-run when documents change): documents are split into <em>chunks</em> (8.2), each chunk is converted into an embedding vector (using an encoder-style model, per Section 6.4) via the dot-product-based similarity math from Section 3.1, and stored in a <em>vector database</em> (8.3) alongside the original chunk text. <em>Query time</em> (done for every user request): the user\'s question is embedded the same way, the vector database returns the most similar stored chunks (a similarity search, exactly as covered in 3.1 and 6.1), those chunks are inserted into a prompt alongside the question, and the LLM generates an answer conditioned on that retrieved context.',
      'This architecture reframes the LLM\'s job: instead of "recall this fact from training," it becomes "read this provided context and answer using it" — a task LLMs are generally much more reliable at, since the relevant facts are now explicitly present in the input the model conditions on (per 6.5\'s framing of how sampling works), rather than needing to be reconstructed from patterns learned during training.',
      'RAG is not "fine-tuning at query time," and it\'s worth being precise about the distinction from 7.6: fine-tuning changes model weights permanently based on training examples; RAG changes nothing about the model itself and instead changes what\'s in the prompt for a specific request. This is exactly why RAG handles frequently-updating information so much more gracefully than fine-tuning (7.6\'s refund-policy example) — updating a RAG system\'s knowledge means updating documents in a database, not retraining anything.',
      '<strong>Common pitfall:</strong> treating RAG as a solved problem once the basic pipeline works end-to-end. Every stage — chunking (8.2), the vector index itself (8.3), retrieval quality (8.4), and whether the final answer is actually grounded in what was retrieved (8.5) — can silently degrade output quality in its own distinct way, which is why the rest of this section treats each stage as its own topic rather than one monolithic "RAG" lesson.',
    ],
    keyPoints: [
      'RAG grounds an LLM\'s answer in retrieved source material at query time, rather than relying purely on facts implicitly encoded during training.',
      'Two phases: <strong>ingestion</strong> (chunk → embed → store, done ahead of time) and <strong>query time</strong> (embed the question → retrieve similar chunks → generate an answer conditioned on them).',
      'RAG reframes the LLM\'s task from "recall a fact" to "read provided context and answer using it" — generally a more reliable task for an LLM to perform.',
      'RAG changes what\'s in the prompt, not the model\'s weights — unlike fine-tuning, this is why RAG handles frequently-changing information far more gracefully.',
      'Every RAG stage (chunking, indexing, retrieval, grounding) can degrade independently — the rest of this section treats each as a distinct topic worth its own scrutiny.',
    ],
    code: `# The RAG pipeline's two phases, at the level of what calls happen where —
# concrete implementations of each step appear in Lessons 8.2-8.6.

# --- INGESTION (run once, or whenever documents change) ---
def ingest_documents(documents: list[str], vector_db, embed_model):
    for doc in documents:
        chunks = chunk_document(doc)                      # Lesson 8.2
        for chunk in chunks:
            vector = embed_model.embed(chunk)              # encoder-style model, Section 6.4
            vector_db.store(vector=vector, text=chunk, metadata={"source": doc[:50]})


# --- QUERY TIME (run for every user request) ---
def answer_question(question: str, vector_db, embed_model, llm) -> str:
    query_vector = embed_model.embed(question)
    retrieved_chunks = vector_db.similarity_search(query_vector, top_k=5)  # Lessons 8.3-8.4

    context = "\\n\\n".join(chunk.text for chunk in retrieved_chunks)
    prompt = f"""Answer the question using ONLY the context below. If the context
doesn't contain the answer, say so — do not guess.

Context:
{context}

Question: {question}"""

    return llm.generate(prompt)   # LLM reads provided context, per 6.5's framing
`,
    codeLabel: 'python',
    mermaid: `flowchart TB
    subgraph "Ingestion (once, ahead of time)"
    D["Documents"] --> CH["Chunking"]
    CH --> EM["Embed each chunk"]
    EM --> VS["Store in vector database"]
    end
    subgraph "Query time (every request)"
    Q["User question"] --> QE["Embed question"]
    QE --> R["Retrieve similar chunks"]
    VS --> R
    R --> P["Build prompt: question + retrieved context"]
    P --> L["LLM generates grounded answer"]
    end`,
    note: {
      label: 'KEY INSIGHT',
      text: 'RAG doesn\'t make the model "know more" — it changes what facts are present in the prompt the model conditions on, which is why updating a RAG system\'s knowledge means updating a database, not retraining a model.',
      tone: 'green',
    },
    quiz: {
      question: 'A company\'s internal RAG system needs to reflect a policy change that happened this morning. What needs to happen for the system to answer correctly about the new policy?',
      options: [
        { label: 'The underlying LLM needs to be fine-tuned or retrained with the new policy text', correct: false },
        { label: 'The updated policy document needs to be re-ingested (chunked, embedded, and stored) into the vector database — no model retraining is needed', correct: true },
        { label: 'Nothing — the LLM will automatically know about the change', correct: false },
        { label: 'The temperature parameter needs to be adjusted to reflect the new policy', correct: false },
      ],
      explanation: 'Because RAG grounds answers in retrieved documents rather than the model\'s trained-in knowledge, updating what the system "knows" is a matter of updating the document store (re-ingesting the changed policy) — the model itself never needs to be retrained, which is exactly the advantage RAG has over fine-tuning for frequently-changing information.',
    },
    crossRefs: ['6.5'],
  },
  {
    id: '8.2',
    title: 'Chunking Strategies and Their Trade-offs',
    duration: '10 min',
    kind: 'concept',
    summary: [
      'A whole document is almost always too large to embed and retrieve as one unit — it needs to be split into smaller <em>chunks</em> first. <em>Chunking</em> sits earlier in the pipeline than it might seem to deserve attention, but chunk quality has an outsized effect on everything downstream: a badly-chunked document produces embeddings that represent a confusing mix of unrelated content, which degrades retrieval no matter how good the vector index or the LLM is.',
      '<em>Fixed-size chunking</em> splits text into chunks of a set length (e.g. 500 tokens), optionally with some overlap between consecutive chunks so that content near a chunk boundary isn\'t split away from its context entirely. It\'s simple and predictable, but can slice a chunk boundary directly through the middle of a sentence or a coherent idea, degrading both the chunk\'s embedding quality and its usefulness if retrieved on its own.',
      '<em>Recursive chunking</em> tries to split along natural structural boundaries first (paragraphs, then sentences, then words, only as a last resort) while still respecting an approximate target size — this generally produces more coherent chunks than pure fixed-size splitting, since it avoids cutting through a sentence or paragraph unless the size constraint truly forces it.',
      '<em>Semantic chunking</em> goes further, splitting based on where the meaning of the text actually shifts (e.g. by embedding individual sentences and splitting where consecutive sentences\' embeddings diverge significantly) rather than any fixed structural or length rule — this can produce the most coherent chunks but at higher computational cost during ingestion, since it requires embedding at a finer granularity before finalizing chunk boundaries.',
      '<strong>Practical guidance:</strong> chunk size is a trade-off, not something to maximize or minimize: very small chunks retrieve precisely but may lack enough surrounding context to be individually useful or coherent; very large chunks carry more context but dilute a chunk\'s embedding with less-relevant surrounding text, making it harder for a query to match the specific relevant portion. Start with recursive chunking at a few hundred tokens with modest overlap as a reasonable default, and only move to semantic chunking if evaluation (8.5) reveals boundary-cutting as a specific, measured problem.',
    ],
    keyPoints: [
      'Chunk quality has an outsized effect on retrieval quality — a badly-chunked document degrades everything downstream regardless of index or model quality.',
      '<strong>Fixed-size chunking</strong>: simple, predictable, but can cut through a sentence or idea mid-way, degrading embedding coherence.',
      '<strong>Recursive chunking</strong>: splits along natural structural boundaries (paragraph → sentence → word) first, respecting size only as a secondary constraint — generally more coherent than fixed-size.',
      '<strong>Semantic chunking</strong>: splits where meaning actually shifts, using sentence-level embeddings — most coherent, highest ingestion-time cost.',
      'Chunk size is a trade-off between precision (small chunks) and context (large chunks) — start with a moderate default and adjust based on measured evaluation results, not intuition.',
    ],
    code: `import re

def fixed_size_chunk(text: str, chunk_size: int = 500, overlap: int = 50) -> list[str]:
    words = text.split()
    chunks = []
    start = 0
    while start < len(words):
        end = start + chunk_size
        chunks.append(" ".join(words[start:end]))
        start = end - overlap   # step back by 'overlap' so boundary context isn't lost
    return chunks


def recursive_chunk(text: str, target_size: int = 500) -> list[str]:
    """Splits along paragraph boundaries first, falling back to sentences
    only for paragraphs that still exceed the target size."""
    paragraphs = text.split("\\n\\n")
    chunks = []
    buffer = ""

    for para in paragraphs:
        if len(buffer.split()) + len(para.split()) <= target_size:
            buffer += ("\\n\\n" if buffer else "") + para
        else:
            if buffer:
                chunks.append(buffer)
            if len(para.split()) > target_size:
                # paragraph itself too large — fall back to sentence splitting
                sentences = re.split(r'(?<=[.!?]) +', para)
                buffer = ""
                for sentence in sentences:
                    if len(buffer.split()) + len(sentence.split()) <= target_size:
                        buffer += (" " if buffer else "") + sentence
                    else:
                        chunks.append(buffer)
                        buffer = sentence
            else:
                buffer = para

    if buffer:
        chunks.append(buffer)
    return chunks
`,
    codeLabel: 'python',
    mermaid: `flowchart LR
    D["Document"] --> P{"Fits within target size?"}
    P -->|yes| C1["Chunk = whole paragraph"]
    P -->|no| S{"Split by sentence"}
    S -->|fits now| C2["Chunk = grouped sentences"]
    S -->|still too large| W["Fall back to word-level split"]`,
    note: {
      label: 'WHEN TO USE',
      text: 'Prefer recursive chunking over fixed-size as your default — it costs almost nothing extra to implement and generally avoids the "sliced mid-sentence" problem that degrades embedding quality.',
      tone: 'green',
    },
    quiz: {
      question: 'A RAG system uses fixed-size chunking with no overlap, and a chunk boundary happens to fall in the middle of a critical sentence explaining a refund policy\'s key exception. What is the likely consequence?',
      options: [
        { label: 'No consequence — chunk boundaries never affect embedding quality', correct: false },
        { label: 'The sentence is split across two chunks, likely degrading both chunks\' embeddings and making it less likely either chunk is retrieved as clearly relevant to a question about that exception', correct: true },
        { label: 'The vector database will automatically repair the split sentence', correct: false },
        { label: 'This only matters if semantic chunking is used instead of fixed-size chunking', correct: false },
      ],
      explanation: 'When a chunk boundary cuts through a sentence, neither resulting chunk contains the complete idea — each chunk\'s embedding represents a partial, less coherent piece of text, which can reduce how well either chunk matches a relevant query, or in the worst case scatter the important exception across two chunks that are each individually less obviously relevant to retrieve. This is exactly the failure mode recursive or semantic chunking are designed to reduce.',
    },
  },
  {
    id: '8.3',
    title: 'Vector Indexing: HNSW, ANN Search & Distance Metrics',
    duration: '12 min',
    kind: 'concept',
    summary: [
      'A brute-force similarity search — computing the dot product or cosine similarity (3.1) between a query vector and every single stored vector — works fine for a few thousand chunks, but becomes too slow to run per-query once a document store grows into the millions. Vector databases solve this using <em>Approximate Nearest Neighbor (ANN)</em> search: trading a small amount of retrieval accuracy for a large speedup, by not exhaustively comparing against every stored vector.',
      '<em>HNSW (Hierarchical Navigable Small World)</em> is the most widely used ANN algorithm behind modern vector databases. Conceptually, it builds a multi-layered graph connecting similar vectors to each other, with sparser, longer-range connections at higher layers and denser, short-range connections at lower layers — a search starts at the top (sparse) layer, quickly navigates toward the right general neighborhood, then descends through progressively denser layers to refine the result, similar in spirit to how a highway system lets you quickly get to the right city (top layer) before using local streets (bottom layer) to reach a specific address.',
      'This graph structure means HNSW search is much faster than brute-force comparison against every vector, at the cost of occasionally missing the single mathematically-closest vector in favor of one that\'s "close enough" — this is the "approximate" in Approximate Nearest Neighbor, and it\'s a deliberate, tunable trade-off (most HNSW implementations expose parameters controlling this speed/accuracy trade-off directly).',
      '<em>Distance metrics</em> determine what "similar" means during the search itself: cosine similarity (3.1) and dot product are the most common for text embeddings, since embedding direction typically encodes meaning (per 3.4\'s reasoning); Euclidean distance is used less often for text embeddings specifically, for the same reason 3.4 covered (magnitude sensitivity). <em>Metadata filtering</em> lets a query combine vector similarity with exact-match conditions on structured fields (e.g. "similar to this query, AND published after 2025, AND from the \'billing\' document category") — critical for real applications where relevance isn\'t purely semantic.',
      '<strong>Practical guidance:</strong> you will not implement HNSW from scratch in this course — the goal is to reason correctly about its behavior: if retrieval quality seems to degrade specifically at very large document-store scale, or if a query returns a plausible-but-not-quite-best match, the ANN speed/accuracy trade-off (adjustable via the vector database\'s configuration) is the first thing to investigate, before assuming the embeddings or chunking are at fault.',
    ],
    keyPoints: [
      'Brute-force similarity search doesn\'t scale to millions of vectors — <strong>ANN (Approximate Nearest Neighbor)</strong> search trades a small accuracy loss for a large speed gain.',
      '<strong>HNSW</strong>: a multi-layer graph of similar vectors, searched top-down from sparse long-range connections to dense local ones — conceptually like using a highway system before local streets.',
      '"Approximate" means occasionally returning a close-enough match rather than the mathematically single closest vector — a deliberate, tunable trade-off, not a bug.',
      'Cosine similarity/dot product are standard distance metrics for text embeddings (direction encodes meaning); Euclidean distance is less common for the same magnitude-sensitivity reason covered in 3.4.',
      '<strong>Metadata filtering</strong> combines vector similarity with exact-match conditions on structured fields — essential for real applications where relevance isn\'t purely semantic.',
    ],
    code: `# Conceptual illustration of an ANN speed/accuracy trade-off parameter —
# actual vector databases (Pinecone, Qdrant, pgvector, etc.) expose this
# via their own specific configuration, but the SHAPE of the trade-off
# is the same across implementations.

# Brute-force search (exact, but O(n) per query):
def brute_force_search(query_vector, all_vectors, top_k=5):
    scores = [cosine_similarity(query_vector, v) for v in all_vectors]
    ranked = sorted(range(len(scores)), key=lambda i: -scores[i])
    return ranked[:top_k]   # exact answer, but scans every vector

# HNSW-style ANN search (conceptual) — trades some accuracy for speed by
# only exploring a limited number of graph nodes ("ef_search") rather
# than the entire vector set:
def hnsw_style_search(query_vector, hnsw_index, top_k=5, ef_search=50):
    # ef_search controls how many candidates are explored during search —
    # HIGHER ef_search: slower, more accurate (closer to brute-force result)
    # LOWER ef_search: faster, more likely to miss the true single-best match
    return hnsw_index.search(query_vector, k=top_k, ef=ef_search)

# The practical takeaway: if retrieval seems to be missing an obviously
# relevant chunk at large scale, checking the index's speed/accuracy
# parameter (like ef_search) is a reasonable first diagnostic step —
# before assuming the chunking or embedding model is at fault.
`,
    codeLabel: 'python',
    mermaid: `flowchart TB
    Q["Query vector"] --> L3["Top layer: sparse, long-range connections"]
    L3 --> L2["Middle layer: moderate density"]
    L2 --> L1["Bottom layer: dense, local connections"]
    L1 --> R["Approximate nearest neighbors"]`,
    note: {
      label: 'WHEN TO USE',
      text: 'If retrieval quality degrades specifically as your document store grows very large, check the vector database\'s ANN speed/accuracy configuration before assuming the chunking or embedding model regressed.',
      tone: 'green',
    },
    quiz: {
      question: 'A vector database using HNSW occasionally returns a chunk that is very similar but not mathematically the single closest match to a query, especially at large scale. Is this necessarily a bug?',
      options: [
        { label: 'Yes — a vector database should always return the exact closest match', correct: false },
        { label: 'No — this is the expected, deliberate behavior of Approximate Nearest Neighbor search, which trades a small amount of accuracy for a much faster search at scale', correct: true },
        { label: 'Yes, but only if cosine similarity is used instead of Euclidean distance', correct: false },
        { label: 'No, but only because the chunking strategy must be at fault', correct: false },
      ],
      explanation: 'HNSW and other ANN algorithms are explicitly designed to trade a small amount of accuracy (occasionally missing the single truly-closest vector) for a dramatic speed improvement over brute-force search at large scale — this is the intended, tunable behavior of "approximate" search, not a malfunction, and the trade-off is usually adjustable via the index\'s configuration.',
    },
    crossRefs: ['3.1', '3.4'],
  },
  {
    id: '8.4',
    title: 'Hybrid Search and Reranking',
    duration: '10 min',
    kind: 'concept',
    summary: [
      'Vector (semantic) similarity search, on its own, has a specific weakness: it can miss an exact keyword or identifier that matters a great deal to the user but doesn\'t carry much semantic "weight" — a query for a specific error code, product SKU, or exact legal clause number might retrieve semantically related content while missing the one chunk that contains the literal exact term the user actually needs.',
      '<em>Hybrid search</em> combines vector (dense) search with traditional keyword-based (sparse) search — such as BM25, a well-established statistical keyword-relevance ranking method — running both and combining their results, so a query benefits from both semantic understanding and exact-term matching. The two result sets are typically combined with a weighted scoring formula or a rank-fusion method, tunable toward favoring one search type over the other depending on the domain (a legal or code-search application might weight sparse/keyword search more heavily than a general FAQ system would).',
      '<em>Reranking</em> addresses a different problem: the initial retrieval (whether vector, keyword, or hybrid) is optimized to be fast over a large document store, which usually means it\'s a less precise ranking than would be ideal. A <em>reranker</em> — typically a separate, more computationally expensive model — takes the top handful of initially-retrieved candidates (say, the top 20–50) and re-scores them with a more careful, more accurate relevance judgment, reordering them before only the final top few (say, 3–5) are actually passed to the LLM.',
      'This two-stage pattern — fast, approximate initial retrieval over the whole store, followed by expensive, precise reranking over just the initial candidates — is a common efficient design across search systems generally, not unique to RAG: doing the expensive step only on a small pre-filtered set keeps the whole pipeline fast even though the reranker itself would be too slow to run over the entire document store directly.',
      '<strong>Practical guidance:</strong> add hybrid search when evaluation (8.5) reveals the system missing queries that reference exact terms, codes, or identifiers; add reranking when evaluation reveals that the correct chunk is being retrieved but not ranked highly enough among the initial candidates to make it into the final context sent to the LLM — these are two distinct failure modes with two distinct fixes, not interchangeable "improve retrieval" levers.',
    ],
    keyPoints: [
      'Vector search alone can miss exact terms (error codes, SKUs, identifiers) that carry high user importance but low semantic "weight."',
      '<strong>Hybrid search</strong> combines dense (vector) and sparse (keyword, e.g. BM25) search, tunable toward whichever the domain favors.',
      '<strong>Reranking</strong>: a more expensive, more precise model re-scores the initial candidates (e.g. top 20-50) to reorder them before only the final few reach the LLM.',
      'Fast-approximate-retrieval-then-precise-reranking is a common efficient pattern in search systems generally, not unique to RAG.',
      'Hybrid search and reranking fix two distinct failure modes (missing exact terms vs. correct chunk ranked too low) — diagnose which one you have before applying either fix.',
    ],
    code: `def hybrid_search(query: str, query_vector, vector_db, keyword_index, top_k=20, alpha=0.5):
    """alpha controls the weight given to vector search vs. keyword search —
    tune per domain (higher alpha favors semantic search, lower favors exact terms)."""
    vector_results = vector_db.similarity_search(query_vector, top_k=top_k)
    keyword_results = keyword_index.bm25_search(query, top_k=top_k)  # sparse/keyword search

    combined_scores = {}
    for rank, result in enumerate(vector_results):
        combined_scores[result.id] = combined_scores.get(result.id, 0) + alpha * (1 / (rank + 1))
    for rank, result in enumerate(keyword_results):
        combined_scores[result.id] = combined_scores.get(result.id, 0) + (1 - alpha) * (1 / (rank + 1))

    ranked_ids = sorted(combined_scores, key=combined_scores.get, reverse=True)
    return ranked_ids[:top_k]


def rerank(query: str, candidate_chunks: list[str], reranker_model, final_top_k=5):
    """A more expensive model re-scores just the candidates from the initial
    retrieval — NOT the whole document store, which is what keeps this efficient."""
    scores = reranker_model.score_pairs([(query, chunk) for chunk in candidate_chunks])
    ranked = sorted(zip(candidate_chunks, scores), key=lambda x: -x[1])
    return [chunk for chunk, score in ranked[:final_top_k]]


# --- Full two-stage pipeline ---
candidates = hybrid_search(query, query_vector, vector_db, keyword_index, top_k=25)
final_chunks = rerank(query, candidates, reranker_model, final_top_k=5)
# final_chunks is what actually goes into the LLM prompt, per Lesson 8.1
`,
    codeLabel: 'python',
    mermaid: `flowchart LR
    Q["Query"] --> V["Vector search (dense)"]
    Q --> K["Keyword search (sparse, e.g. BM25)"]
    V --> C["Combined candidate set"]
    K --> C
    C --> RR["Reranker: precise re-scoring"]
    RR --> F["Final top few chunks to LLM"]`,
    note: {
      label: 'DECISION POINT',
      text: 'If evaluation shows queries with exact codes/identifiers failing, add hybrid search. If it shows the right chunk is retrieved but ranked too low to make the final cut, add reranking instead — these fix different problems.',
      tone: 'green',
    },
    quiz: {
      question: 'Evaluation reveals that for a specific class of queries, the correct chunk IS present somewhere in the initial top-25 retrieved candidates, but rarely makes it into the final top-5 sent to the LLM. Which fix is most directly targeted at this problem?',
      options: [
        { label: 'Switching from vector search to pure keyword search', correct: false },
        { label: 'Adding a reranking step to re-score and reorder the initial candidates more precisely before selecting the final top-5', correct: true },
        { label: 'Increasing the chunk size used during ingestion', correct: false },
        { label: 'Reducing the number of documents in the vector database', correct: false },
      ],
      explanation: 'Since the correct chunk is already being retrieved (it\'s in the top-25), the problem is specifically in how those candidates are ranked before the final cut — reranking directly addresses this by applying a more precise, more expensive scoring pass to just those candidates. Hybrid search would help if the chunk were missing from retrieval entirely, which isn\'t the case described here.',
    },
    crossRefs: ['8.1'],
  },
  {
    id: '8.5',
    title: 'Evaluating RAG: Recall, Faithfulness & Groundedness',
    duration: '12 min',
    kind: 'concept',
    summary: [
      'A RAG system can fail at two distinct stages, and evaluating "does it give good answers" without distinguishing between them makes debugging much harder: <em>retrieval</em> can fail (the right information was never found), or <em>generation</em> can fail (the right information was retrieved, but the LLM didn\'t use it correctly, ignored it, or contradicted it). Good RAG evaluation measures both stages separately.',
      'Retrieval-quality metrics answer "did we find the right chunks?" <em>Recall</em> measures what fraction of the actually-relevant chunks were retrieved at all; <em>precision</em> measures what fraction of retrieved chunks were actually relevant; <em>MRR (Mean Reciprocal Rank)</em> specifically rewards ranking the first relevant result as high as possible, which matters because later-ranked chunks are more likely to be truncated out of the final context sent to the LLM (recall 8.4\'s reranking discussion).',
      'Generation-quality metrics answer a different question: "given what was retrieved, did the LLM produce a good answer?" <em>Answer relevance</em> asks whether the generated answer actually addresses the question asked; <em>faithfulness</em> (or <em>groundedness</em>) asks whether every claim in the generated answer is actually supported by the retrieved context — this specifically catches the case where an LLM, even with correct context provided, still adds an unsupported or fabricated detail not present in that context, which is a distinct failure from simply retrieving the wrong chunks.',
      'Building a small evaluation set — a list of representative questions, each with an expected answer and, ideally, the expected source chunk(s) that should have been retrieved — lets you measure all of these metrics concretely rather than relying on spot-checking a few examples by hand. A common practical technique for scoring faithfulness and answer relevance at scale is <em>LLM-as-judge</em>: using a separate LLM call, given the question, the retrieved context, and the generated answer, to score whether the answer is supported by the context — imperfect, but far more scalable than manual review for tracking these metrics over time as the system changes.',
      '<strong>Practical guidance:</strong> when a RAG system gives a wrong answer, check retrieval metrics first (was the right chunk even retrieved?) before assuming a generation/faithfulness problem — the two failure modes require completely different fixes (8.2–8.4\'s chunking/indexing/reranking changes versus prompt changes emphasizing "answer only from the provided context"), and misdiagnosing which one occurred wastes effort on the wrong fix.',
    ],
    keyPoints: [
      'A RAG failure can originate at retrieval (wrong chunks found) or generation (right chunks found, but used poorly) — measure both stages separately, don\'t just judge the final answer.',
      'Retrieval metrics: <strong>recall</strong> (found how much of what\'s relevant), <strong>precision</strong> (how much of what was found is relevant), <strong>MRR</strong> (how high is the first relevant result ranked).',
      'Generation metrics: <strong>answer relevance</strong> (does the answer address the question) and <strong>faithfulness/groundedness</strong> (is every claim actually supported by the retrieved context, not fabricated).',
      'Build a small evaluation set (question, expected answer, expected source chunks) to measure these concretely rather than relying on spot-checking.',
      '<strong>LLM-as-judge</strong>: use a separate LLM call to score faithfulness/relevance at scale — imperfect but far more scalable than manual review.',
    ],
    code: `def evaluate_retrieval(eval_set, vector_db, embed_model, top_k=5):
    total_recall, total_mrr = 0, 0

    for item in eval_set:
        query_vector = embed_model.embed(item["question"])
        retrieved = vector_db.similarity_search(query_vector, top_k=top_k)
        retrieved_ids = {r.id for r in retrieved}
        expected_ids = set(item["expected_source_ids"])

        recall = len(retrieved_ids & expected_ids) / len(expected_ids)
        total_recall += recall

        # MRR: reciprocal rank of the FIRST relevant chunk found, 0 if none found
        reciprocal_rank = 0
        for rank, r in enumerate(retrieved, start=1):
            if r.id in expected_ids:
                reciprocal_rank = 1 / rank
                break
        total_mrr += reciprocal_rank

    n = len(eval_set)
    return {"avg_recall": total_recall / n, "avg_mrr": total_mrr / n}


def llm_judge_faithfulness(question: str, context: str, generated_answer: str, judge_llm) -> dict:
    judge_prompt = f"""You are evaluating whether an answer is faithful to its source context.

Question: {question}
Context: {context}
Generated Answer: {generated_answer}

Is every claim in the Generated Answer directly supported by the Context?
Respond with JSON: {{"faithful": true/false, "unsupported_claims": ["..."]}}"""

    return judge_llm.generate_json(judge_prompt)


# --- Diagnostic order: check retrieval BEFORE assuming a generation problem ---
retrieval_scores = evaluate_retrieval(eval_set, vector_db, embed_model)
if retrieval_scores["avg_recall"] < 0.7:
    print("Retrieval is likely the bottleneck — check chunking (8.2) and indexing (8.3) first.")
else:
    print("Retrieval looks reasonable — investigate faithfulness/prompt-following next.")
`,
    codeLabel: 'python',
    mermaid: `flowchart TB
    F["Wrong final answer"] --> Q{"Was the right chunk retrieved?"}
    Q -->|no| RT["Retrieval problem: fix chunking (8.2), indexing (8.3), or add hybrid search/reranking (8.4)"]
    Q -->|yes| GN["Generation problem: fix prompt to emphasize grounding, or check for faithfulness failures"]`,
    note: {
      label: 'DECISION POINT',
      text: 'Always check retrieval recall before investigating faithfulness — a low recall score means the LLM never had a chance to give a grounded answer, no matter how good its prompt is.',
      tone: 'green',
    },
    quiz: {
      question: 'A RAG system gives a wrong answer to a question. Retrieval evaluation shows the correct source chunk WAS retrieved and included in the context. What does this tell you about where to focus debugging?',
      options: [
        { label: 'The problem must be in the vector database\'s indexing configuration', correct: false },
        { label: 'Since the correct information was available to the model, the problem is likely in generation — check faithfulness (is the model ignoring or contradicting the provided context) rather than retrieval', correct: true },
        { label: 'The chunking strategy needs to be redesigned', correct: false },
        { label: 'This means the evaluation set itself is incorrect', correct: false },
      ],
      explanation: 'If the correct chunk was successfully retrieved and included in the context, the retrieval stage worked as intended — the failure must be happening in how the LLM used that context, which is a faithfulness/generation problem rather than a retrieval problem. Fixes to chunking, indexing, or hybrid search wouldn\'t address a failure that occurs after retrieval has already succeeded.',
    },
    crossRefs: ['8.2', '8.3', '8.4'],
  },
  {
    id: '8.6',
    title: 'Lab: Building a Citation-Aware Document Q&A System',
    duration: '30 min',
    kind: 'assignment',
    summary: [
      'This lab assembles every piece from this section into the third of this course\'s five flagship portfolio projects: a working RAG system over uploaded PDF documents that answers questions and shows its sources — the "citation-aware" part matters as much as the answer itself, since a user should be able to verify a claim against the actual retrieved text rather than trusting the answer blindly.',
      'Build the ingestion pipeline first (8.1, 8.2): accept PDF uploads, extract text, chunk with the recursive strategy from 8.2, embed each chunk, and store both the embedding and the original chunk text (plus its source document and page number, for citation) in a vector store. Then build query time (8.1, 8.3, 8.4): embed the user\'s question, retrieve candidate chunks, and — for this lab, hybrid search and reranking are optional extensions rather than required, since a single vector search is a reasonable starting point to get the full pipeline working end-to-end first.',
      'The citation requirement changes the prompt design from 8.1\'s basic version: instruct the model to cite which specific retrieved chunk (by an ID or document/page reference you provide alongside each chunk in the prompt) supports each claim in its answer, and display those citations alongside the generated answer in your output — not just as an afterthought, but as a first-class part of the response the user actually sees and can click through to verify.',
      'Build a small evaluation set (8.5) of at least 10 questions with known expected answers and expected source chunks, and report retrieval recall and MRR, plus a faithfulness spot-check (either manual, or via the LLM-as-judge technique from 8.5) on at least a handful of generated answers. This evaluation harness, built here at project scale, is exactly what gets reused and extended for the full capstone in Section 13.2.',
    ],
    keyPoints: [
      'Full pipeline: PDF ingestion → chunking → embedding → vector storage (with source/page metadata) → query-time retrieval → citation-aware answer generation.',
      'Citations are a first-class part of the output, not an afterthought — the prompt must instruct the model to reference which specific chunk supports each claim.',
      'A single vector search (no hybrid search or reranking) is an acceptable starting point to get the full pipeline working end-to-end first.',
      'Build and report against a small evaluation set (8.5): retrieval recall/MRR at minimum, plus a faithfulness spot-check on generated answers.',
      'This is portfolio project #3 of this course\'s five flagship projects, and its evaluation harness is the direct basis for the Section 13 capstone\'s evaluation work.',
    ],
    code: `import fitz  # PyMuPDF, for PDF text extraction
from openai import OpenAI

client = OpenAI()

def extract_pdf_chunks(pdf_path: str) -> list[dict]:
    doc = fitz.open(pdf_path)
    chunks = []
    for page_num, page in enumerate(doc, start=1):
        text = page.get_text()
        page_chunks = recursive_chunk(text, target_size=400)  # from Lesson 8.2
        for chunk_text in page_chunks:
            chunks.append({"text": chunk_text, "source": pdf_path, "page": page_num})
    return chunks


def embed_and_store(chunks: list[dict], vector_db, embed_model):
    for i, chunk in enumerate(chunks):
        vector = embed_model.embed(chunk["text"])
        vector_db.store(
            id=f"{chunk['source']}-p{chunk['page']}-{i}",
            vector=vector,
            text=chunk["text"],
            metadata={"source": chunk["source"], "page": chunk["page"]},
        )


CITATION_PROMPT = """Answer the question using ONLY the numbered context chunks below.
For each claim in your answer, cite the chunk number that supports it, like [1] or [2].
If the context doesn't contain the answer, say so.

{numbered_context}

Question: {question}"""

def answer_with_citations(question: str, vector_db, embed_model) -> dict:
    query_vector = embed_model.embed(question)
    retrieved = vector_db.similarity_search(query_vector, top_k=5)

    numbered_context = "\\n\\n".join(
        f"[{i+1}] (source: {r.metadata['source']}, page {r.metadata['page']})\\n{r.text}"
        for i, r in enumerate(retrieved)
    )

    prompt = CITATION_PROMPT.format(numbered_context=numbered_context, question=question)
    response = client.chat.completions.create(
        model="gpt-4o-mini", messages=[{"role": "user", "content": prompt}]
    )

    return {
        "answer": response.choices[0].message.content,
        "sources": [{"source": r.metadata["source"], "page": r.metadata["page"]} for r in retrieved],
    }
`,
    codeLabel: 'python',
    note: {
      label: 'WHY THIS MATTERS',
      text: 'Displaying citations the user can click through to verify is what makes a RAG system trustworthy in practice — an answer without a visible, checkable source is asking for blind trust in a system that can still fail faithfulness checks.',
      tone: 'green',
    },
    quiz: {
      question: 'Why does this lab treat citations as a required part of the output rather than an optional nice-to-have?',
      options: [
        { label: 'Citations are only useful for academic writing, not product features', correct: false },
        { label: 'Because faithfulness failures (Section 8.5) can occur even with correct retrieval — visible, checkable citations let a user verify a claim rather than trust the answer blindly', correct: true },
        { label: 'Citations are required by the vector database\'s API', correct: false },
        { label: 'Without citations, chunking cannot be performed correctly', correct: false },
      ],
      explanation: 'Even a RAG system with strong retrieval can still generate an answer that subtly misrepresents or extends beyond its source context (a faithfulness failure, per 8.5) — showing exactly which chunk supposedly supports each claim gives the user a concrete way to verify that claim themselves, rather than needing to trust the system\'s output on faith. This is why the lab treats citations as core functionality, not decoration.',
    },
    crossRefs: ['8.1', '8.2', '8.5'],
  },
]
