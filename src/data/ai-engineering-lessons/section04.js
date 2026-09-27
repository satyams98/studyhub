export default [
  {
    id: '4.1',
    title: 'The Supervised Learning Workflow: Train, Validate, Test',
    duration: '10 min',
    kind: 'theory',
    summary: [
      'Classical ML gets a compressed, conceptual treatment in this course — enough to reason about a model\'s behavior and defend a modeling choice in an interview, not enough to become a specialist. <em>Supervised learning</em> means learning a mapping from inputs (features) to known outputs (labels) using examples where both are already known; <em>unsupervised learning</em> (covered in 4.4) finds structure in data with no labels at all.',
      'A model\'s <em>parameters</em> are the values it learns from data (e.g. the weights in a linear regression); its <em>hyperparameters</em> are the settings you choose before training (e.g. how many trees in a random forest). This distinction matters because parameters come from the training process itself, while hyperparameters have to be chosen and tuned by you, usually via the validation set.',
      'Splitting data into <em>train</em>, <em>validation</em>, and <em>test</em> sets exists to answer three different questions honestly: train fits the parameters; validation tunes hyperparameters and compares models without touching the final judge; test — touched exactly once, at the very end — estimates how the chosen model will perform on genuinely unseen data. <em>Cross-validation</em> (typically k-fold) makes the train/validation split more robust by rotating which portion of the data is held out, averaging the result across folds, which matters most when you don\'t have much data to spare.',
      '<em>Overfitting</em> is when a model learns the training data\'s noise, not its underlying pattern — performing well on training data but poorly on new data. <em>Underfitting</em> is the opposite: the model is too simple to capture the real pattern, performing poorly everywhere. The <em>bias-variance trade-off</em> names this tension: high-bias models underfit (too simple), high-variance models overfit (too sensitive to the specific training set); most model tuning is, at its core, moving along this trade-off.',
      '<strong>Common pitfall:</strong> touching the test set more than once — checking test performance, tweaking the model, checking test performance again. Each look leaks information about the test set into your modeling decisions, quietly turning "test performance" into an optimistic estimate rather than an honest one.',
    ],
    keyPoints: [
      '<strong>Parameters</strong> are learned from data; <strong>hyperparameters</strong> are chosen by you before training.',
      'Train fits the model; <strong>validation</strong> tunes hyperparameters and compares candidates; <strong>test</strong> is touched exactly once, at the end.',
      '<strong>Cross-validation</strong> rotates the held-out portion across folds — more robust than a single train/validation split, especially with limited data.',
      'Overfitting: learns training noise, fails on new data. Underfitting: too simple to capture the real pattern, fails everywhere.',
      'Touching the test set more than once leaks information into your decisions — treat it as single-use.',
    ],
    code: `from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.linear_model import LogisticRegression

# First split: carve out the test set — touched only once, at the very end.
X_temp, X_test, y_temp, y_test = train_test_split(
    X, y, test_size=0.15, random_state=42, stratify=y
)

# Second split: train vs. validation, from the remaining data.
X_train, X_val, y_train, y_val = train_test_split(
    X_temp, y_temp, test_size=0.2, random_state=42, stratify=y_temp
)

model = LogisticRegression(max_iter=1000)

# Cross-validation on the training portion — more robust than one fixed split
# for choosing between candidate models or hyperparameters.
cv_scores = cross_val_score(model, X_train, y_train, cv=5)
print(f"CV accuracy: {cv_scores.mean():.3f} ± {cv_scores.std():.3f}")

model.fit(X_train, y_train)
val_accuracy = model.score(X_val, y_val)
print(f"Validation accuracy: {val_accuracy:.3f}")

# Only after model/hyperparameter decisions are FINAL:
test_accuracy = model.score(X_test, y_test)
print(f"Test accuracy (single use): {test_accuracy:.3f}")
`,
    codeLabel: 'python',
    mermaid: `flowchart TB
    A["Full dataset"] --> B["Test set (touched once, at the end)"]
    A --> C["Train + Validation pool"]
    C --> D["Train set: fit parameters"]
    C --> E["Validation set: tune hyperparameters, compare models"]
    D --> F["Trained model"]
    E --> F
    F --> B`,
    note: {
      label: 'COMMON PITFALL',
      text: 'If you find yourself checking test-set performance more than once during model development, you\'ve already broken the test set\'s purpose — treat any repeated check as a signal to reserve a fresh test set.',
      tone: 'accent',
    },
    quiz: {
      question: 'A data scientist checks test-set accuracy, tweaks a hyperparameter, checks test-set accuracy again, and repeats this several times before finalizing a model. What is the main problem with this workflow?',
      options: [
        { label: 'There is no problem — this is the correct way to tune hyperparameters', correct: false },
        { label: 'Repeatedly checking the test set leaks information about it into modeling decisions, making the final test score an overly optimistic estimate', correct: true },
        { label: 'The test set becomes too small after repeated use', correct: false },
        { label: 'This workflow is fine as long as random_state is fixed', correct: false },
      ],
      explanation: 'The validation set exists specifically so hyperparameter tuning and model comparison never touch the test set — repeatedly checking test performance and adjusting based on it means the final reported test score no longer reflects genuinely unseen data, since decisions were implicitly optimized against it.',
    },
  },
  {
    id: '4.2',
    title: 'Regression, Classification & the Metrics That Matter',
    duration: '12 min',
    kind: 'concept',
    summary: [
      '<em>Linear regression</em> predicts a continuous number by fitting a weighted sum of features; <em>logistic regression</em>, despite the name, is a classification method — it predicts the probability of a class by passing that same weighted sum through a sigmoid function to squash it into a 0–1 range.',
      'For classification, <em>accuracy</em> (fraction correct) is the most intuitive metric and also the most commonly misused one: on an imbalanced dataset (say, 1% of transactions are fraudulent), a model that always predicts "not fraud" gets 99% accuracy while being completely useless. This is why <em>precision</em> (of predicted positives, how many were actually positive) and <em>recall</em> (of actual positives, how many were caught) matter — and why the right balance between them depends entirely on the cost of each type of mistake.',
      'The <em>confusion matrix</em> (true positives, false positives, true negatives, false negatives) is the source all these metrics are computed from, and it\'s worth looking at directly rather than only at derived numbers — it shows exactly which kind of mistake a model makes most. <em>F1 score</em> is the harmonic mean of precision and recall, useful as a single number when you need to balance both but don\'t have a specific reason to favor one.',
      '<em>ROC-AUC</em> measures how well a model ranks positive examples above negative ones across all possible classification thresholds, making it threshold-independent — useful for comparing models, less useful for deciding an actual operating threshold in production, where precision/recall at a specific chosen threshold matters more.',
      '<strong>The metric-selection question that actually matters:</strong> for fraud detection, missing a fraudulent transaction (a false negative) is usually far more costly than flagging a legitimate one for review (a false positive) — so recall is prioritized over precision, even at the cost of more false alarms. For a spam filter, the opposite is often true: a false positive (blocking a real email) is more costly than a false negative (one spam email getting through), so precision is prioritized. There is no universally "best" metric — only the one that matches the real cost of each mistake.',
    ],
    keyPoints: [
      'Linear regression predicts continuous values; logistic regression predicts class probabilities via a sigmoid, despite the name.',
      'Accuracy is misleading on imbalanced data — a model can score high while being useless.',
      '<strong>Precision</strong>: of predicted positives, how many were correct. <strong>Recall</strong>: of actual positives, how many were caught.',
      'The confusion matrix is the source of all these metrics — look at it directly to see which mistake type dominates.',
      'Metric choice should match the real-world cost of false positives vs. false negatives — there is no single "best" metric independent of context.',
    ],
    code: `from sklearn.metrics import (
    confusion_matrix, precision_score, recall_score, f1_score, roc_auc_score
)
from sklearn.linear_model import LogisticRegression

model = LogisticRegression(max_iter=1000).fit(X_train, y_train)
y_pred = model.predict(X_val)
y_proba = model.predict_proba(X_val)[:, 1]

tn, fp, fn, tp = confusion_matrix(y_val, y_pred).ravel()
print(f"TP={tp}  FP={fp}  FN={fn}  TN={tn}")

precision = precision_score(y_val, y_pred)
recall = recall_score(y_val, y_pred)
f1 = f1_score(y_val, y_pred)
auc = roc_auc_score(y_val, y_proba)

print(f"precision={precision:.3f}  recall={recall:.3f}  f1={f1:.3f}  auc={auc:.3f}")

# Why accuracy alone is misleading on imbalanced data (99% negative class):
baseline_accuracy = (y_val == 0).mean()
print(f"'always predict negative' baseline accuracy: {baseline_accuracy:.3f}")
# A high number here does NOT mean the baseline is good — it means accuracy
# is the wrong metric for this class distribution.
`,
    codeLabel: 'python',
    note: {
      label: 'DECISION POINT',
      text: 'Before picking a metric, ask "what does a false negative cost versus a false positive, in this specific application?" — the answer decides whether to prioritize recall, precision, or balance them with F1.',
      tone: 'green',
    },
    quiz: {
      question: 'A fraud-detection model achieves 99.2% accuracy on a dataset where only 0.8% of transactions are actually fraudulent. Is this a strong result?',
      options: [
        { label: 'Yes — 99.2% accuracy is a strong result by any standard', correct: false },
        { label: 'Not necessarily — a model that always predicts "not fraud" would also score around 99.2% accuracy on this class distribution while catching zero fraud', correct: true },
        { label: 'No — accuracy is never a valid metric for any classification task', correct: false },
        { label: 'It depends only on the F1 score, which cannot be inferred from accuracy alone', correct: false },
      ],
      explanation: 'On a dataset this imbalanced, a trivial "always predict the majority class" model achieves nearly the same accuracy while being useless — accuracy alone can\'t distinguish a genuinely good fraud detector from one that catches nothing. Precision and recall (or F1, or recall specifically, given fraud\'s asymmetric cost) are needed to judge this properly.',
    },
  },
  {
    id: '4.3',
    title: 'Trees, Ensembles & Gradient Boosting',
    duration: '10 min',
    kind: 'concept',
    summary: [
      'A <em>decision tree</em> makes predictions by asking a sequence of yes/no questions about feature values, splitting the data at each step to make the resulting groups as "pure" (homogeneous in label) as possible. A single tree is easy to interpret but prone to overfitting — it can keep splitting until it perfectly memorizes the training data.',
      '<em>Random forests</em> address this by training many trees on different random subsets of the data and features, then averaging their predictions. Individual trees overfit in different, largely uncorrelated ways, so averaging cancels out much of that noise — this ensemble idea (many weak, diverse models combined outperform one strong model) reappears constantly in ML.',
      '<em>Gradient boosting</em> (implemented by libraries like XGBoost) builds trees sequentially rather than independently: each new tree is trained specifically to correct the errors of the ensemble built so far. This typically outperforms random forests on structured/tabular data and is a common default choice for classical ML competitions and production tabular-data models.',
      'Basic explainability matters once a model moves past a simple linear one: <em>feature importance</em> (how much each feature contributed to the model\'s splits, on average) gives a quick, rough sense of what the model relies on; <em>SHAP</em> values go further, attributing each individual prediction\'s outcome to specific feature contributions for that specific example — useful when you need to explain why the model made one particular decision, not just what it generally relies on.',
      '<strong>Practical guidance:</strong> when choosing among these for a new tabular-data problem, gradient boosting (XGBoost/LightGBM) is a reasonable default to try first; a single decision tree is mainly useful when interpretability matters more than accuracy (e.g. explaining a decision to a non-technical stakeholder using the actual tree structure).',
    ],
    keyPoints: [
      'A decision tree splits data via a sequence of feature-based yes/no questions; prone to overfitting on its own.',
      '<strong>Random forest</strong>: many independently-trained trees averaged together — diverse overfitting patterns cancel out.',
      '<strong>Gradient boosting</strong>: trees trained sequentially, each correcting the previous ensemble\'s errors — usually the strongest classical-ML default for tabular data.',
      '<strong>Feature importance</strong>: overall reliance on a feature across the whole model. <strong>SHAP</strong>: per-prediction attribution, explaining one specific decision.',
      'For a new tabular-data problem, gradient boosting is a reasonable first thing to try; a single tree trades accuracy for interpretability.',
    ],
    code: `import xgboost as xgb
from sklearn.ensemble import RandomForestClassifier
import shap

# Random forest — many independent trees, averaged
rf = RandomForestClassifier(n_estimators=200, random_state=42)
rf.fit(X_train, y_train)
print("random forest val accuracy:", rf.score(X_val, y_val))

# Gradient boosting — trees trained sequentially to correct prior errors
xgb_model = xgb.XGBClassifier(n_estimators=200, max_depth=4, learning_rate=0.1)
xgb_model.fit(X_train, y_train)
print("xgboost val accuracy:", xgb_model.score(X_val, y_val))

# Feature importance — overall reliance across the whole model
importances = xgb_model.feature_importances_
top_features = sorted(zip(feature_names, importances), key=lambda x: -x[1])[:5]
print("top 5 features:", top_features)

# SHAP — per-prediction explanation for one specific example
explainer = shap.TreeExplainer(xgb_model)
shap_values = explainer.shap_values(X_val.iloc[[0]])
print("SHAP contribution for this single prediction:", shap_values)
`,
    codeLabel: 'python',
    note: {
      label: 'WHEN TO USE',
      text: 'Reach for feature importance when you need a general sense of what the model relies on; reach for SHAP when someone asks "why did the model flag THIS specific customer?"',
      tone: 'green',
    },
    quiz: {
      question: 'A stakeholder asks why one specific customer was flagged as high churn-risk by a gradient-boosted model, not why the model generally makes decisions. Which tool answers this question?',
      options: [
        { label: 'Overall feature importance from the trained model', correct: false },
        { label: 'SHAP values computed for that specific customer\'s prediction', correct: true },
        { label: 'The random forest\'s out-of-bag error estimate', correct: false },
        { label: 'The model\'s overall cross-validation accuracy', correct: false },
      ],
      explanation: 'Feature importance describes the model\'s overall reliance on features on average — it can\'t answer a question about one individual prediction. SHAP values attribute a single prediction\'s outcome to specific feature contributions for that one example, which is exactly what a "why THIS customer" question needs.',
    },
  },
  {
    id: '4.4',
    title: 'Unsupervised Learning: Clustering & Dimensionality Reduction',
    duration: '10 min',
    kind: 'concept',
    summary: [
      'Unsupervised learning finds structure in data with no labels to learn from. This course covers it at a conceptual, "know what problem it solves" level, since most AI-engineering product work leans on supervised methods and pretrained embeddings far more than on unsupervised clustering built from scratch.',
      '<em>K-means clustering</em> groups data points into a chosen number (<code>k</code>) of clusters by iteratively assigning each point to its nearest cluster center, then recomputing centers as the average of their assigned points, until the assignments stop changing. It requires choosing <code>k</code> in advance and assumes roughly round, similarly-sized clusters — a poor fit for oddly-shaped or very different-sized groups.',
      '<em>DBSCAN</em> instead groups points based on density (how many neighbors sit within a small distance), which lets it find clusters of arbitrary shape and automatically treat sparse, isolated points as noise — without needing to specify the number of clusters in advance. It trades that flexibility for sensitivity to its own two hyperparameters (neighborhood radius and minimum point count).',
      '<em>PCA (Principal Component Analysis)</em> solves a different problem: reducing the number of features/dimensions in a dataset while keeping as much of the meaningful variation as possible, by finding the directions along which the data varies most and projecting onto those. This is useful for visualizing high-dimensional data in 2–3 dimensions, or for reducing dimensionality before feeding data into a model that struggles with too many features.',
      '<strong>Practical guidance:</strong> if you find yourself reaching for clustering in an AI-engineering context, it\'s more often to explore/segment a dataset during analysis (e.g. "are there natural customer segments in this usage data?") than as a production model component — production systems in this course lean on retrieval and supervised methods instead.',
    ],
    keyPoints: [
      '<strong>K-means</strong>: requires choosing k in advance, assumes round/similar-sized clusters, iteratively recenters.',
      '<strong>DBSCAN</strong>: density-based, finds arbitrary cluster shapes and marks outliers as noise automatically, without needing k.',
      '<strong>PCA</strong>: reduces dimensionality by projecting onto the directions of greatest variation — useful for visualization and for simplifying inputs to another model.',
      'Clustering is most often used for exploratory analysis and segmentation, less often as a production model component in this course\'s scope.',
      'None of these require mathematical derivation to use effectively — knowing what problem each solves is the practical bar for this course.',
    ],
    code: `from sklearn.cluster import KMeans, DBSCAN
from sklearn.decomposition import PCA

# K-means: requires choosing k up front
kmeans = KMeans(n_clusters=4, random_state=42, n_init=10)
customer_segments = kmeans.fit_predict(usage_features)

# DBSCAN: no k required, finds arbitrary-shaped clusters, flags noise as -1
dbscan = DBSCAN(eps=0.5, min_samples=5)
labels = dbscan.fit_predict(usage_features)
n_noise_points = (labels == -1).sum()
print(f"DBSCAN found {len(set(labels)) - (1 if -1 in labels else 0)} clusters, "
      f"{n_noise_points} noise points")

# PCA: project high-dimensional usage_features down to 2D purely for visualization
pca = PCA(n_components=2)
projected = pca.fit_transform(usage_features)
print("variance explained by first 2 components:", pca.explained_variance_ratio_)
`,
    codeLabel: 'python',
    note: {
      label: 'WHEN TO USE',
      text: 'Reach for DBSCAN over K-means when you don\'t know how many natural groups exist in the data, or when clusters are likely to be irregularly shaped — K-means will force round clusters even where none naturally exist.',
      tone: 'green',
    },
    quiz: {
      question: 'You want to segment customers by usage pattern but have no prior idea how many natural segments exist, and suspect some customers are simply outliers rather than belonging to any group. Which algorithm fits best?',
      options: [
        { label: 'K-means, since it always produces clean, well-defined clusters', correct: false },
        { label: 'DBSCAN, since it doesn\'t require specifying the number of clusters and explicitly flags outliers as noise', correct: true },
        { label: 'PCA, since it is a clustering algorithm', correct: false },
        { label: 'Linear regression, since it can be adapted for clustering', correct: false },
      ],
      explanation: 'DBSCAN is the right fit precisely because it doesn\'t require pre-specifying a cluster count and naturally separates outliers as noise rather than forcing them into a cluster. K-means would require guessing k in advance and would force every point into some cluster, including outliers. PCA is a dimensionality-reduction technique, not a clustering algorithm.',
    },
  },
  {
    id: '4.5',
    title: 'Lab: Building and Evaluating a Churn Prediction Model',
    duration: '25 min',
    kind: 'assignment',
    summary: [
      'This lab is the Section 4 capstone: a complete, defensible classical-ML pipeline from raw data to a documented final model, using techniques from every prior lesson in this section plus the data-handling skills from Section 2.',
      'Follow the full sequence: EDA and cleaning (Section 2 skills), feature engineering (encoding, scaling), an honest train/validation/test split (4.1), a baseline model to beat (a simple logistic regression, or even "always predict majority class" as a floor), then compare multiple models (4.2, 4.3), cross-validate and tune hyperparameters, evaluate with metrics that match the real cost of false positives vs. false negatives for churn prediction specifically, and finish with a short explainability pass (4.3).',
      'For churn prediction specifically, consider the metric question directly: a false negative (missing a customer who will churn) costs a lost customer and lost revenue; a false positive (flagging a customer who wouldn\'t have churned) costs an unnecessary retention offer. Decide, and state in your write-up, which mistake is more expensive for a hypothetical business, and choose your evaluation metric (and classification threshold) accordingly — don\'t default to accuracy without justifying it.',
      'The README/write-up is a required deliverable, not optional polish: explain why you chose your final model, why you chose your metric, where the model fails (which segment of customers does it predict worst?), whether you checked for and found any data leakage, and what you would try next given more time. Being able to answer these questions is the actual skill this lab is testing — the code is the vehicle for it.',
      'A reference solution structure follows below, using a synthetic telecom-style churn dataset. Build and evaluate your own version before comparing.',
    ],
    keyPoints: [
      'Full pipeline: EDA → cleaning → feature engineering → honest split → baseline → multiple models → cross-validation → tuning → evaluation → explainability.',
      'Choose your evaluation metric based on the real cost of false positives vs. false negatives for churn specifically — justify the choice explicitly.',
      'A baseline model (even a trivial one) establishes the floor any "real" model needs to beat to be worth using.',
      'The written explanation — why this model, why this metric, where it fails — is a required deliverable, not an afterthought.',
      'Check explicitly for data leakage (e.g. a feature that\'s only available after the churn event already happened) before trusting a suspiciously high score.',
    ],
    code: `import pandas as pd
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
import xgboost as xgb
from sklearn.metrics import classification_report, roc_auc_score

# --- Load & clean (Section 2 skills) ---
df = pd.read_csv("telecom_churn.csv")
df = df.drop_duplicates(subset="customer_id")
df["tenure_months"] = df["tenure_months"].fillna(df["tenure_months"].median())
df = pd.get_dummies(df, columns=["contract_type", "payment_method"])

# --- Honest split ---
X = df.drop(columns=["customer_id", "churned"])
y = df["churned"]
X_temp, X_test, y_temp, y_test = train_test_split(X, y, test_size=0.15, stratify=y, random_state=42)
X_train, X_val, y_train, y_val = train_test_split(X_temp, y_temp, test_size=0.2, stratify=y_temp, random_state=42)

# --- Baseline ---
baseline_accuracy = (y_val == 0).mean()
print(f"baseline (always predict no-churn): {baseline_accuracy:.3f} accuracy")

# --- Compare models ---
models = {
    "logistic_regression": LogisticRegression(max_iter=1000),
    "random_forest": RandomForestClassifier(n_estimators=200, random_state=42),
    "xgboost": xgb.XGBClassifier(n_estimators=200, max_depth=4),
}

for name, model in models.items():
    cv_scores = cross_val_score(model, X_train, y_train, cv=5, scoring="recall")
    print(f"{name}: CV recall = {cv_scores.mean():.3f} ± {cv_scores.std():.3f}")

# --- Final model, chosen for RECALL given churn's asymmetric cost ---
final_model = xgb.XGBClassifier(n_estimators=200, max_depth=4).fit(X_train, y_train)
y_pred = final_model.predict(X_val)
print(classification_report(y_val, y_pred))
print("val AUC:", roc_auc_score(y_val, final_model.predict_proba(X_val)[:, 1]))

# --- Explainability + write-up happen after this: which segment does the
#     model predict worst? Any leakage? What would you try next? ---
`,
    codeLabel: 'python',
    note: {
      label: 'DECISION POINT',
      text: 'Justify your choice of primary metric explicitly in the write-up — for churn, recall is often prioritized over precision since a missed churner is usually costlier than an unnecessary retention offer, but state this as a deliberate choice, not a default.',
      tone: 'green',
    },
    quiz: {
      question: 'A churn model achieves 96% accuracy but a recall of only 0.20 — it catches just 1 in 5 customers who actually churn. Is this model ready to ship?',
      options: [
        { label: 'Yes — 96% accuracy is a strong result', correct: false },
        { label: 'Not necessarily — if missing a churning customer is costly to the business, a recall of 0.20 means the model is failing at its actual purpose despite high accuracy', correct: true },
        { label: 'Accuracy and recall always move together, so this combination is not possible', correct: false },
        { label: 'The model should be shipped as long as cross-validation scores were consistent', correct: false },
      ],
      explanation: 'High accuracy alongside low recall is a classic sign of class imbalance — the model likely predicts "no churn" for most customers, which is right often enough to inflate accuracy while missing 80% of actual churners. Whether this is acceptable depends entirely on the real cost of a missed churner versus a false alarm, which the write-up is meant to make explicit rather than defaulting to the accuracy number.',
    },
    crossRefs: ['4.1', '4.2', '4.3', '4.4', '2.1', '2.2', '2.3', '2.4'],
  },
]
