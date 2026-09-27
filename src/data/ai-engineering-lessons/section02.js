export default [
  {
    id: '2.1',
    title: 'NumPy Arrays, Broadcasting & Vectorization',
    duration: '10 min',
    kind: 'concept',
    summary: [
      'Every numerical operation in AI engineering — embeddings, similarity search, tensor math inside a model — ultimately reduces to array operations, and NumPy is the layer almost everything else (Pandas, PyTorch, scikit-learn) is built on or interoperates with. Getting comfortable with arrays, shape, and vectorization here pays off directly when you hit embeddings and attention later in this course.',
      'A NumPy <code>ndarray</code> is a fixed-type, multi-dimensional grid of values with a <code>shape</code> (its dimensions) and a <code>dtype</code> (the type of every element). Unlike a Python list, all elements share one type, which is what makes array operations fast — NumPy can operate on the whole block of memory at once instead of looping element by element in Python.',
      '<em>Vectorization</em> means expressing an operation as a whole-array operation instead of a Python <code>for</code> loop — <code>a + b</code> instead of iterating and adding element-by-element. <em>Broadcasting</em> is the rule set that lets NumPy apply an operation between arrays of different (but compatible) shapes without you manually reshaping them — e.g., adding a single row vector to every row of a matrix.',
      'The core broadcasting rule: comparing shapes from the rightmost dimension, two dimensions are compatible if they are equal, or one of them is 1. A shape of <code>(1000, 128)</code> and <code>(128,)</code> broadcast fine — the second is stretched across all 1000 rows. A shape of <code>(1000, 128)</code> and <code>(50,)</code> does not, and NumPy raises a <code>ValueError</code>.',
      '<strong>Common pitfall:</strong> silently getting a wrong-but-valid broadcast. If you meant to add a per-column value but your vector\'s shape broadcasts along rows instead, NumPy won\'t error — it will just compute something different from what you intended. Always print <code>.shape</code> when debugging unexpected numerical output.',
    ],
    keyPoints: [
      'An <code>ndarray</code> has a fixed <code>dtype</code> and a <code>shape</code>; this uniformity is what makes it fast.',
      '<strong>Vectorization</strong>: replace Python loops with whole-array operations for large speed gains.',
      '<strong>Broadcasting</strong>: NumPy compares shapes from the rightmost dimension; a dimension of 1 (or a missing dimension) stretches to match.',
      'A shape mismatch that still satisfies broadcasting rules will compute silently — check <code>.shape</code> when output looks wrong, not just when NumPy raises an error.',
      'Matrix multiplication (<code>@</code> or <code>np.matmul</code>) is distinct from element-wise multiplication (<code>*</code>) — mixing them up is a very common source of subtly wrong results.',
    ],
    code: `import numpy as np

# A batch of 3 embeddings, each of dimension 4 (toy size for illustration —
# real embeddings are typically 384–3072 dimensions).
embeddings = np.array([
    [0.1, 0.2, 0.3, 0.4],
    [0.5, 0.1, 0.0, 0.2],
    [0.9, 0.8, 0.7, 0.6],
])
print(embeddings.shape)  # (3, 4)

# Broadcasting: subtract the mean vector from every row without a loop.
mean_vector = embeddings.mean(axis=0)      # shape (4,)
centered = embeddings - mean_vector        # (3, 4) - (4,) broadcasts fine
print(centered.shape)                      # (3, 4)

# Vectorized vs. loop — same result, very different performance at scale:
def normalize_loop(arr):
    out = np.zeros_like(arr)
    for i in range(arr.shape[0]):
        norm = np.sqrt(np.sum(arr[i] ** 2))
        out[i] = arr[i] / norm
    return out

def normalize_vectorized(arr):
    norms = np.linalg.norm(arr, axis=1, keepdims=True)  # shape (3, 1)
    return arr / norms                                   # broadcasts over columns

assert np.allclose(normalize_loop(embeddings), normalize_vectorized(embeddings))
`,
    codeLabel: 'python',
    note: {
      label: 'WHY THIS MATTERS',
      text: 'The normalize_vectorized pattern above — norms with keepdims=True broadcasting back over the original array — is exactly the shape of code you\'ll write when normalizing embeddings before a cosine-similarity search.',
      tone: 'green',
    },
    quiz: {
      question: 'You have an array of shape (1000, 128) representing 1000 embeddings, and a single vector of shape (128,) representing a query embedding. What happens when you compute array - query_vector?',
      options: [
        { label: 'NumPy raises a ValueError because the shapes don\'t match', correct: false },
        { label: 'The query vector is broadcast and subtracted from every one of the 1000 rows, producing a (1000, 128) result', correct: true },
        { label: 'Only the first row of the array is affected', correct: false },
        { label: 'NumPy pads the query vector with zeros to match (1000, 128)', correct: false },
      ],
      explanation: 'Comparing shapes from the right, 128 matches 128, and the missing leading dimension on the query vector is treated as 1 and stretched to 1000 — so it broadcasts cleanly across every row. This is a normal, valid broadcast, not an error.',
    },
  },
  {
    id: '2.2',
    title: 'Pandas for Data Wrangling',
    duration: '12 min',
    kind: 'concept',
    summary: [
      'Pandas sits one layer above NumPy: a <code>DataFrame</code> is a labeled, 2D table (rows and named columns) built on top of NumPy arrays, and a <code>Series</code> is a single labeled column. Almost any real dataset you touch — logs, CSV exports, database dumps — arrives as something closer to a DataFrame\'s shape than a raw array, which is why Pandas is the default tool for the "before the model" part of any pipeline.',
      'The operations you\'ll use constantly are filtering (boolean indexing: <code>df[df[\'score\'] > 0.8]</code>), sorting, <code>groupby</code> (split a DataFrame by a column\'s values, apply an aggregation, combine the results back), and <code>merge</code>/<code>join</code> (combine two DataFrames on a shared key, exactly like a SQL join — <code>how=\'inner\'</code>, <code>\'left\'</code>, <code>\'outer\'</code> map directly to SQL join types you already know).',
      '<code>groupby</code> is worth understanding as a three-step mental model: <em>split</em> the data into groups by a key column, <em>apply</em> a function (mean, count, custom) to each group independently, <em>combine</code> the results into a new DataFrame or Series. This split-apply-combine pattern reappears constantly — e.g. later, computing average retrieval latency per document type is the same pattern.',
      'Datetime handling deserves specific attention: parse date columns explicitly with <code>pd.to_datetime</code> rather than leaving them as strings, since string dates sort and compare incorrectly (alphabetically, not chronologically) and silently produce wrong results in anything time-windowed — a very common, hard-to-notice bug.',
      '<strong>Common pitfall:</strong> chained indexing (<code>df[df.a > 0][\'b\'] = 1</code>) which triggers Pandas\' <code>SettingWithCopyWarning</code> and may silently fail to modify the original DataFrame. Use <code>.loc[]</code> for any assignment based on a boolean condition.',
    ],
    keyPoints: [
      'A <code>DataFrame</code> is a labeled 2D table built on NumPy arrays; a <code>Series</code> is one labeled column.',
      '<code>groupby</code> follows split → apply → combine — the same mental model applies to any "aggregate by category" task later in this course.',
      '<code>merge</code>/<code>join</code> map directly onto SQL join semantics (<code>inner</code>, <code>left</code>, <code>outer</code>) — nothing new to learn there beyond the syntax.',
      'Always <code>pd.to_datetime()</code> date columns explicitly; string dates compare alphabetically, not chronologically.',
      'Use <code>.loc[]</code> for conditional assignment — chained indexing (<code>df[cond][col] = x</code>) can silently fail to modify the original DataFrame.',
    ],
    code: `import pandas as pd

logs = pd.DataFrame({
    "query": ["reset password", "billing issue", "reset password", "api limits"],
    "response_time_ms": [420, 1830, 390, 610],
    "success": [True, False, True, True],
    "logged_at": ["2026-01-05", "2026-01-06", "2026-01-06", "2026-01-07"],
})

# Always parse dates explicitly — string comparison would sort these wrong.
logs["logged_at"] = pd.to_datetime(logs["logged_at"])

# split-apply-combine: average response time per query, successes only
success_only = logs.loc[logs["success"], :]                 # correct conditional filtering
avg_by_query = success_only.groupby("query")["response_time_ms"].mean()
print(avg_by_query)

# Correct conditional assignment — .loc avoids the SettingWithCopyWarning trap
logs.loc[logs["response_time_ms"] > 1000, "flag"] = "slow"
`,
    codeLabel: 'python',
    note: {
      label: 'COMMON PITFALL',
      text: 'df[df.a > 0][\'b\'] = 1 may raise SettingWithCopyWarning and not actually modify df — always write conditional assignment as df.loc[df.a > 0, \'b\'] = 1.',
      tone: 'accent',
    },
    quiz: {
      question: 'You need the average response time per distinct query type, but only for successful requests. Which Pandas approach is correct and idiomatic?',
      options: [
        { label: 'Loop over each row in Python, checking success and accumulating sums manually', correct: false },
        { label: 'logs.loc[logs["success"], :].groupby("query")["response_time_ms"].mean()', correct: true },
        { label: 'logs[logs.success == True]["query"].mean()', correct: false },
        { label: 'logs.groupby("response_time_ms")["query"].mean()', correct: false },
      ],
      explanation: 'Filtering with .loc[] for the successful rows, then grouping by query and averaging response_time_ms, is exactly the split-apply-combine pattern Pandas is built for. Looping manually works but defeats the purpose of using Pandas; grouping by response_time_ms instead of query gets the axes backwards.',
    },
    crossRefs: ['2.1'],
  },
  {
    id: '2.3',
    title: 'Handling Missing Data & Categorical Variables',
    duration: '10 min',
    kind: 'concept',
    summary: [
      'Real datasets are rarely complete, and how you handle missing values changes your results — sometimes silently. Pandas represents missing numeric data as <code>NaN</code> and missing object/string data variably; <code>df.isna().sum()</code> is the first command to run on any new dataset, before any other analysis, to see the shape of the problem.',
      'The three common strategies are: <em>drop</em> rows or columns with missing values (<code>dropna()</code> — safe when missingness is rare and random), <em>impute</em> a reasonable substitute value (mean/median for numeric columns, a placeholder category or the mode for categorical columns), or <em>flag</em> missingness itself as a feature (sometimes the fact that a value is missing is informative — e.g. a customer who never filled in a field may behave differently from one who did).',
      'Duplicate rows are a related, easy-to-miss issue — <code>df.duplicated()</code> flags exact duplicate rows, but partial duplicates (same customer ID, different timestamp) need a deliberate decision about which to keep, usually via <code>drop_duplicates(subset=..., keep=\'last\')</code>.',
      'Categorical variables need encoding before most ML algorithms can use them: <em>one-hot encoding</em> (<code>pd.get_dummies</code>) creates a binary column per category, appropriate for unordered categories with a manageable number of values; <em>label/ordinal encoding</em> assigns integers, appropriate only when categories have a genuine order (e.g. "low/medium/high"), since an unordered category encoded as 0/1/2 falsely implies 2 is "more" than 0 to a model that doesn\'t know better.',
      '<strong>Common pitfall:</strong> imputing missing values using statistics (mean, mode) computed from the <em>entire</em> dataset, including data that will later become your test set. This leaks test-set information into training — the imputation statistics should be computed on the training split only.',
    ],
    keyPoints: [
      'Run <code>df.isna().sum()</code> first on any new dataset — know the shape of the problem before deciding what to do about it.',
      'Three strategies: drop, impute (mean/median/mode), or flag missingness as its own feature.',
      '<code>drop_duplicates(subset=..., keep=...)</code> for partial duplicates — exact-duplicate detection alone often misses these.',
      'One-hot encode <strong>unordered</strong> categories; ordinal/label-encode only genuinely <strong>ordered</strong> categories.',
      '<strong>Data leakage warning:</strong> compute imputation statistics on the training split only, never on the full dataset before splitting.',
    ],
    code: `import pandas as pd

df = pd.DataFrame({
    "customer_id": [1, 2, 2, 3, 4],
    "plan": ["free", "pro", "pro", None, "enterprise"],
    "support_tickets": [2, None, 5, 1, 3],
})

# Step 1: know the shape of the problem
print(df.isna().sum())

# Step 2: partial duplicate handling — keep the latest record per customer
df = df.drop_duplicates(subset="customer_id", keep="last")

# Step 3: impute — median for numeric, explicit "unknown" category for categorical
# (In a real pipeline, this median comes from the TRAIN split only.)
df["support_tickets"] = df["support_tickets"].fillna(df["support_tickets"].median())
df["plan"] = df["plan"].fillna("unknown")

# Step 4: encode — "plan" is unordered, so one-hot encode it
df = pd.get_dummies(df, columns=["plan"], prefix="plan")
print(df)
`,
    codeLabel: 'python',
    note: {
      label: 'WARNING',
      text: 'Fit any imputation statistic (mean, median, mode) on the training split only — computing it on the full dataset before splitting leaks test information into training.',
      tone: 'accent',
    },
    quiz: {
      question: 'A categorical column "region" has values "North", "South", "East", "West" with no natural order. Which encoding is appropriate?',
      options: [
        { label: 'Label encode as 0, 1, 2, 3 in alphabetical order', correct: false },
        { label: 'One-hot encode into 4 binary columns', correct: true },
        { label: 'Drop the column entirely since it has more than 2 values', correct: false },
        { label: 'Convert to the count of rows in each region', correct: false },
      ],
      explanation: 'Since the categories have no inherent order, one-hot encoding avoids implying a false ordinal relationship (e.g. "West" being numerically "greater than" "North"). Label encoding is only appropriate when categories have genuine rank order.',
    },
  },
  {
    id: '2.4',
    title: 'Lab: End-to-End Exploratory Data Analysis Report',
    duration: '20 min',
    kind: 'assignment',
    summary: [
      'This lab takes a messy, realistic dataset through a full analysis pipeline: load, inspect, clean, transform, analyze, visualize, and explain. The goal is not any single technique from the previous three lessons — it\'s combining all of them into one coherent, well-documented workflow, which is the shape almost every future dataset you touch in this course (and in real work) will need.',
      'Work through the pipeline in order and resist the urge to jump straight to visualization: inspect first (shape, dtypes, missingness, duplicates), clean deliberately (documenting every drop/impute decision and why), then transform (encode categoricals, parse dates), and only then analyze and visualize.',
      'The written report at the end matters as much as the code — write down what you found, what decisions you made about missing data and why, and what the data does or doesn\'t support concluding. This habit of narrating decisions is what will make your Section 4 churn-prediction project (and every project after it) defensible when someone asks "why did you do it that way?"',
      'A reference solution structure follows below, using a synthetic subscription-usage dataset. Build your own version against a real dataset of your choosing before comparing.',
    ],
    keyPoints: [
      'Follow the pipeline in order: load → inspect → clean → transform → analyze → visualize → explain.',
      'Document every cleaning decision (why you dropped, imputed, or flagged something) — not just the code that does it.',
      'Inspect before you visualize — visualizing a dataset you haven\'t inspected produces charts that look fine but hide problems.',
      'The written explanation of your decisions is a deliverable in its own right, not an afterthought.',
      'This full-pipeline structure is exactly what you\'ll reuse for the Section 4 churn-prediction project.',
    ],
    code: `import pandas as pd
import matplotlib.pyplot as plt

# --- Load ---
df = pd.read_csv("subscription_usage.csv")

# --- Inspect ---
print(df.shape)
print(df.dtypes)
print(df.isna().sum())
print(df.duplicated().sum())

# --- Clean ---
df = df.drop_duplicates(subset="customer_id", keep="last")
df["monthly_usage_hours"] = df["monthly_usage_hours"].fillna(
    df["monthly_usage_hours"].median()
)
df["plan"] = df["plan"].fillna("unknown")

# --- Transform ---
df["signup_date"] = pd.to_datetime(df["signup_date"])
df = pd.get_dummies(df, columns=["plan"], prefix="plan")

# --- Analyze ---
churn_rate_by_month = (
    df.groupby(df["signup_date"].dt.to_period("M"))["churned"].mean()
)

# --- Visualize ---
churn_rate_by_month.plot(kind="line", title="Churn Rate by Signup Month")
plt.ylabel("Churn Rate")
plt.savefig("churn_by_month.png")

# --- Explain (write this as prose in your report, not as code comments) ---
# "Churn rate is highest among customers who signed up in Q1, correlating
#  with a pricing change in March. 4% of rows had missing usage data,
#  imputed with the column median since missingness appeared random
#  (no correlation with plan type or churn)."
`,
    codeLabel: 'python',
    note: {
      label: 'WHEN TO USE',
      text: 'Reach for this exact pipeline shape any time you\'re handed a new dataset — even a "quick look" benefits from inspecting before cleaning and cleaning before visualizing.',
      tone: 'green',
    },
    quiz: {
      question: 'Before visualizing churn rate by month, why does the lab insist on inspecting and cleaning the data first rather than plotting immediately?',
      options: [
        { label: 'Matplotlib requires cleaned data or it will crash', correct: false },
        { label: 'A chart built on unclean data (duplicates, missing values, unparsed dates) can look reasonable while silently misrepresenting the underlying pattern', correct: true },
        { label: 'It is a stylistic convention with no practical effect on the result', correct: false },
        { label: 'Visualization is only possible after one-hot encoding', correct: false },
      ],
      explanation: 'A chart doesn\'t announce that it was built on duplicated rows or string-typed dates sorted alphabetically — it just renders a plausible-looking but wrong result. Inspecting and cleaning first is what catches this before it reaches a conclusion.',
    },
    crossRefs: ['2.1', '2.2', '2.3'],
  },
]
