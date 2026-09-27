export default [
  {
    id: '5.1',
    title: 'Neurons, Activations & Forward Propagation',
    duration: '10 min',
    kind: 'concept',
    summary: [
      'A neural network\'s basic unit, a <em>neuron</em>, does something simple: take a weighted sum of its inputs, add a bias term, and pass the result through an <em>activation function</em>. Stack many of these into layers, and layers into a network, and this simple building block is what underlies every deep learning model in this course — including, eventually, the transformer architecture behind LLMs.',
      'Without an activation function, stacking linear layers would collapse mathematically into a single linear layer no matter how many you stack — a weighted sum of a weighted sum is still just a weighted sum. Activation functions introduce non-linearity, which is what lets a network represent genuinely complex, non-linear patterns. <em>ReLU</em> (zero for negative inputs, identity for positive ones) is the modern default for hidden layers because it\'s cheap to compute and avoids some training difficulties older functions had; <em>sigmoid</em> squashes to (0,1) and is used for binary output probabilities; <em>softmax</em> generalizes sigmoid to multiple classes, producing a probability distribution that sums to 1 — this is exactly the operation used to turn an LLM\'s raw output into next-token probabilities (Section 6.5).',
      '<em>Forward propagation</em> is simply running an input through the network layer by layer, computing each layer\'s output from the previous one, until you reach the final output. This is the "inference" direction — the same direction a trained model runs in production. Training (covered next lesson) requires running this forward, then working backward to figure out how to adjust the weights.',
      'A network\'s "depth" (number of layers) and "width" (neurons per layer) are architectural choices, not learned — they\'re hyperparameters, in the same sense as a random forest\'s tree count from Section 4. Deeper networks can represent more complex functions but are harder to train (a problem addressed by techniques covered later, like residual connections and normalization, mentioned but not built from scratch in this course).',
      '<strong>Practical guidance:</strong> when reading a neural network diagram or PyTorch model definition, you should now be able to trace the shape of data through it — this is exactly what 5.3\'s PyTorch training loop and 6.2\'s attention mechanism will ask you to do.',
    ],
    keyPoints: [
      'A neuron: weighted sum of inputs, plus bias, through an activation function.',
      'Without a non-linear activation function, any number of stacked linear layers collapses to one linear layer.',
      '<strong>ReLU</strong>: modern default for hidden layers. <strong>Sigmoid</strong>: binary probability output. <strong>Softmax</strong>: multi-class probability distribution — the same operation LLMs use to produce next-token probabilities.',
      '<strong>Forward propagation</strong>: running input through the network layer by layer to produce an output — the same direction used at inference time in production.',
      'Depth and width are architectural hyperparameters chosen before training, not learned from data.',
    ],
    code: `import numpy as np

def relu(x):
    return np.maximum(0, x)

def softmax(x):
    exp_x = np.exp(x - np.max(x))  # subtract max for numerical stability
    return exp_x / exp_x.sum()

# A tiny 2-layer network's forward pass, by hand, for one input example.
x = np.array([0.5, -0.2, 0.1])          # 3 input features

W1 = np.random.randn(3, 4) * 0.1        # layer 1: 3 inputs -> 4 hidden units
b1 = np.zeros(4)
W2 = np.random.randn(4, 2) * 0.1        # layer 2: 4 hidden units -> 2 output classes
b2 = np.zeros(2)

# Forward propagation, one layer at a time:
z1 = x @ W1 + b1        # weighted sum + bias
a1 = relu(z1)            # activation — introduces non-linearity
z2 = a1 @ W2 + b2        # second layer's weighted sum + bias
output_probs = softmax(z2)  # turn raw scores into a probability distribution

print("hidden activations:", a1)
print("output probabilities:", output_probs, "-> sums to", output_probs.sum())
`,
    codeLabel: 'python',
    mermaid: `flowchart LR
    X["Input features"] --> L1["Layer 1: weighted sum + bias"]
    L1 --> A1["ReLU activation"]
    A1 --> L2["Layer 2: weighted sum + bias"]
    L2 --> SM["Softmax"]
    SM --> P["Output probabilities"]`,
    note: {
      label: 'KEY INSIGHT',
      text: 'Softmax turning raw scores into a probability distribution is the exact same operation an LLM uses at its final layer to decide the probability of every possible next token — you\'ll see this again in Section 6.5.',
      tone: 'green',
    },
    quiz: {
      question: 'A network stacks three linear layers with no activation function between any of them. What can be said about its representational power compared to a single linear layer?',
      options: [
        { label: 'It can represent strictly more complex functions than a single linear layer', correct: false },
        { label: 'It is mathematically equivalent to a single linear layer, regardless of how many linear layers are stacked', correct: true },
        { label: 'It becomes a classification model automatically', correct: false },
        { label: 'It can only be used for regression, never classification', correct: false },
      ],
      explanation: 'A weighted sum of a weighted sum (of a weighted sum...) is still just one weighted sum — without a non-linear activation function between layers, any number of stacked linear layers collapses mathematically to a single linear transformation. This is exactly why activation functions are essential, not optional, in a multi-layer network.',
    },
  },
  {
    id: '5.2',
    title: 'Backpropagation From First Principles',
    duration: '15 min',
    kind: 'theory',
    summary: [
      'This is the one lesson in this course where you will implement gradient computation by hand — everywhere else, an autograd system (PyTorch, Section 5.3) does it automatically. Doing it once, from scratch, is what makes autograd feel like automation of something you understand, rather than an opaque black box.',
      'The forward pass (5.1) computes a prediction and a loss (how wrong that prediction was). The <em>backward pass</em> then works backward through the network, layer by layer, computing how much each weight contributed to that loss — this is exactly the chain rule from Section 3.2 applied repeatedly: the gradient at any layer is the gradient flowing back from the layer after it, multiplied by that layer\'s own local derivative.',
      'Concretely, for a 2-layer network (Linear → ReLU → Linear → Softmax, matching 5.1\'s structure): compute the loss, then compute the gradient of the loss with respect to the final layer\'s output, then use the chain rule to push that gradient backward through the softmax, through the second linear layer, through the ReLU, and through the first linear layer — at each step, multiplying by that step\'s local derivative, exactly as covered conceptually in 3.2.',
      'Once every parameter\'s gradient is computed, the parameter update is the same gradient descent step from 3.2: move each weight a small step in the direction opposite its gradient. Repeating forward pass → loss → backward pass → update over many iterations is the entire training loop — everything from here through the rest of this course, including training an LLM, is this same loop at a much larger scale.',
      '<strong>Common pitfall:</strong> forgetting to zero out accumulated gradients between iterations (covered again in 5.3\'s PyTorch training loop) — gradients from a previous step silently adding to the current step\'s gradients produces wrong, usually much-too-large, parameter updates.',
    ],
    keyPoints: [
      'The backward pass applies the chain rule (3.2) repeatedly, working from the loss backward through each layer to that layer\'s parameters.',
      'Each layer\'s gradient = the gradient flowing back from the layer after it, multiplied by that layer\'s own local derivative.',
      'Forward pass → loss → backward pass → parameter update, repeated many times, is the entire training loop — at any scale, including training an LLM.',
      'Doing this by hand once (in this lesson) is what makes PyTorch\'s autograd (5.3) legible rather than a black box.',
      'Forgetting to zero gradients between iterations causes them to silently accumulate across steps — a common, hard-to-notice training bug.',
    ],
    code: `import numpy as np

def relu(x):
    return np.maximum(0, x)

def relu_derivative(x):
    return (x > 0).astype(float)

# Forward pass (same structure as 5.1)
x = np.array([[0.5, -0.2, 0.1]])          # shape (1, 3) — batch of 1 example
y_true = np.array([[1, 0]])                # true class: one-hot, class 0

W1 = np.random.randn(3, 4) * 0.1
b1 = np.zeros(4)
W2 = np.random.randn(4, 2) * 0.1
b2 = np.zeros(2)

z1 = x @ W1 + b1
a1 = relu(z1)
z2 = a1 @ W2 + b2
exp_z2 = np.exp(z2 - z2.max())
y_pred = exp_z2 / exp_z2.sum()             # softmax output

loss = -np.sum(y_true * np.log(y_pred + 1e-9))  # cross-entropy loss
print(f"loss: {loss:.4f}")

# --- Backward pass: chain rule, one layer at a time ---
# Gradient of cross-entropy + softmax combined (a well-known simplification):
dz2 = y_pred - y_true                       # shape (1, 2)
dW2 = a1.T @ dz2                            # gradient w.r.t. W2
db2 = dz2.sum(axis=0)

da1 = dz2 @ W2.T                            # push gradient back through W2
dz1 = da1 * relu_derivative(z1)             # push through ReLU's local derivative
dW1 = x.T @ dz1                             # gradient w.r.t. W1
db1 = dz1.sum(axis=0)

# --- Parameter update (gradient descent, from 3.2) ---
learning_rate = 0.1
W1 -= learning_rate * dW1
b1 -= learning_rate * db1
W2 -= learning_rate * dW2
b2 -= learning_rate * db2
`,
    codeLabel: 'python',
    mermaid: `flowchart LR
    L["Loss"] --> DZ2["Gradient at output layer"]
    DZ2 --> DW2["Gradient w.r.t. W2"]
    DZ2 --> DA1["Push back through W2"]
    DA1 --> DZ1["Push back through ReLU derivative"]
    DZ1 --> DW1["Gradient w.r.t. W1"]`,
    note: {
      label: 'WHY THIS MATTERS',
      text: 'Every line of this backward pass is the chain rule from Section 3.2 applied mechanically, one layer at a time — PyTorch\'s autograd (5.3) does exactly this automatically, for networks far too large to differentiate by hand.',
      tone: 'green',
    },
    quiz: {
      question: 'In the backward pass, why is the gradient da1 (with respect to the hidden layer\'s activations) computed as dz2 @ W2.T rather than some other operation?',
      options: [
        { label: 'It is an arbitrary implementation choice with no mathematical basis', correct: false },
        { label: 'It applies the chain rule: the gradient flowing back through a linear layer is the downstream gradient multiplied by that layer\'s weights (transposed to match dimensions)', correct: true },
        { label: 'It recomputes the forward pass in reverse order', correct: false },
        { label: 'It only works for classification, not regression, networks', correct: false },
      ],
      explanation: 'This is the chain rule in its matrix form: since z2 = a1 @ W2 + b2, the gradient of the loss with respect to a1 is the gradient with respect to z2, multiplied by W2 (transposed so the matrix dimensions align). This same pattern — downstream gradient times the local layer\'s weights — is how gradients propagate through any linear layer, regardless of the task.',
    },
  },
  {
    id: '5.3',
    title: 'PyTorch Tensors, Autograd & the Training Loop',
    duration: '12 min',
    kind: 'concept',
    summary: [
      'PyTorch\'s <code>Tensor</code> is conceptually a NumPy array (Section 2.1) with two additions: it can live on a GPU (<code>.to(\'cuda\')</code>) for much faster computation, and it can track the operations performed on it so gradients can be computed automatically — this second feature is <em>autograd</em>, and it\'s what replaces the manual backward pass you wrote in 5.2.',
      '<code>Dataset</code> and <code>DataLoader</code> handle batching and shuffling: a <code>Dataset</code> defines how to get one example by index, and a <code>DataLoader</code> wraps it to yield shuffled mini-batches automatically — training on batches rather than one example at a time (as 5.2\'s example did) is both faster (better hardware utilization) and produces more stable gradient estimates.',
      'An <code>nn.Module</code> is how you define a network\'s layers; calling the module on an input runs the forward pass automatically (you write <code>forward()</code>, PyTorch handles calling it). The three training-loop lines that matter most: <code>loss.backward()</code> triggers autograd to compute every parameter\'s gradient (exactly what you wrote by hand in 5.2, done automatically); <code>optimizer.step()</code> applies the parameter update (gradient descent, or a more sophisticated variant like Adam); <code>optimizer.zero_grad()</code> clears gradients before the next iteration — omitting this is the single most common PyTorch training bug, since gradients accumulate by default otherwise.',
      'The standard training loop structure — for each epoch, for each batch: forward pass, compute loss, zero gradients, backward pass, optimizer step — is worth memorizing as a fixed shape, since it barely changes across wildly different model architectures, including the CNN in 5.4 and, eventually, transformer-based models.',
      '<strong>Practical guidance:</strong> a separate validation loop (no <code>.backward()</code>, wrapped in <code>with torch.no_grad():</code>) after each epoch is standard practice — it measures generalization without accidentally computing or storing gradients you don\'t need, which wastes memory and can quietly increase GPU usage in production inference code if forgotten there too.',
    ],
    keyPoints: [
      'A PyTorch <code>Tensor</code> is a NumPy-like array with GPU support and automatic gradient tracking (autograd).',
      '<code>Dataset</code> + <code>DataLoader</code> handle batching and shuffling — training on mini-batches is faster and more stable than one example at a time.',
      '<code>loss.backward()</code> automates the manual backward pass from 5.2; <code>optimizer.step()</code> applies the update; <code>optimizer.zero_grad()</code> clears gradients before the next iteration.',
      'Forgetting <code>zero_grad()</code> is the most common PyTorch training bug — gradients silently accumulate across iterations otherwise.',
      'Wrap validation and inference code in <code>with torch.no_grad():</code> — no backward pass is needed, and skipping this wastes memory even outside training.',
    ],
    code: `import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader


class ChurnDataset(Dataset):
    def __init__(self, features, labels):
        self.features = torch.tensor(features, dtype=torch.float32)
        self.labels = torch.tensor(labels, dtype=torch.long)

    def __len__(self):
        return len(self.labels)

    def __getitem__(self, idx):
        return self.features[idx], self.labels[idx]


class SimpleClassifier(nn.Module):
    def __init__(self, input_dim, hidden_dim, num_classes):
        super().__init__()
        self.layer1 = nn.Linear(input_dim, hidden_dim)
        self.relu = nn.ReLU()
        self.layer2 = nn.Linear(hidden_dim, num_classes)

    def forward(self, x):
        return self.layer2(self.relu(self.layer1(x)))


train_loader = DataLoader(ChurnDataset(X_train, y_train), batch_size=32, shuffle=True)
val_loader = DataLoader(ChurnDataset(X_val, y_val), batch_size=32, shuffle=False)

model = SimpleClassifier(input_dim=X_train.shape[1], hidden_dim=16, num_classes=2)
loss_fn = nn.CrossEntropyLoss()
optimizer = torch.optim.Adam(model.parameters(), lr=0.01)

for epoch in range(10):
    model.train()
    for batch_x, batch_y in train_loader:
        optimizer.zero_grad()              # clear previous gradients — easy to forget
        predictions = model(batch_x)        # forward pass
        loss = loss_fn(predictions, batch_y)
        loss.backward()                     # autograd computes every gradient
        optimizer.step()                    # apply the parameter update

    model.eval()
    with torch.no_grad():                   # no gradients needed for validation
        val_correct = 0
        for batch_x, batch_y in val_loader:
            preds = model(batch_x).argmax(dim=1)
            val_correct += (preds == batch_y).sum().item()
        print(f"epoch {epoch}: val accuracy = {val_correct / len(y_val):.3f}")
`,
    codeLabel: 'python',
    mermaid: `flowchart LR
    F["Forward pass: model(batch)"] --> L["Compute loss"]
    L --> B["loss.backward()"]
    B --> S["optimizer.step()"]
    S --> Z["optimizer.zero_grad()"]
    Z -->|next batch| F`,
    note: {
      label: 'COMMON PITFALL',
      text: 'Omitting optimizer.zero_grad() causes gradients to accumulate across batches rather than reflecting only the current batch — this is the single most common PyTorch training bug and produces erratic, usually worsening, training.',
      tone: 'accent',
    },
    quiz: {
      question: 'A PyTorch training loop is missing the optimizer.zero_grad() call before each batch\'s backward pass. What is the most likely observed effect?',
      options: [
        { label: 'No effect — gradients are automatically cleared by loss.backward()', correct: false },
        { label: 'Training will be slightly slower but otherwise correct', correct: false },
        { label: 'Gradients accumulate across batches instead of reflecting only the current batch, typically causing erratic or worsening training', correct: true },
        { label: 'The model will fail to run at all and raise an exception', correct: false },
      ],
      explanation: 'By default, PyTorch accumulates gradients on each backward() call rather than resetting them — zero_grad() is what clears them before each new batch. Omitting it means each batch\'s gradient adds to all previous batches\' gradients, producing increasingly incorrect (usually much too large) parameter updates without raising any error.',
    },
  },
  {
    id: '5.4',
    title: 'Convolutional Networks for Image Data',
    duration: '10 min',
    kind: 'concept',
    summary: [
      'A plain feedforward network (5.1) treats an image as a flat list of pixel values, discarding all spatial structure — a pixel\'s neighbors carry no special meaning to it. <em>Convolutional networks</em> fix this by using small, learned filters (<em>kernels</em>) that slide across the image, each looking for a specific local pattern (an edge, a texture, eventually — in deeper layers — more complex shapes) regardless of where in the image it appears.',
      'A <em>convolution</em> operation applies a small kernel (e.g. 3×3 pixels) across the image, producing a <em>feature map</em> that highlights where that pattern was detected. <em>Stride</em> controls how far the kernel moves between applications (a stride of 2 skips every other position, producing a smaller output); <em>padding</em> adds a border of zeros so the kernel can be applied at the image\'s edges without shrinking the output unexpectedly.',
      '<em>Pooling</em> (typically max-pooling: keep only the largest value in each small region) reduces the feature map\'s size while keeping its most salient signal, making the network both more computationally efficient and somewhat tolerant of small shifts in where a pattern appears in the image.',
      'The key reason CNNs outperform plain MLPs for images is <em>parameter sharing</em>: the same small kernel is reused across the entire image, rather than learning a separate weight for every pixel position — this both drastically reduces the number of parameters to learn and builds in the correct assumption that "an edge is an edge" regardless of where it appears in the frame.',
      '<strong>Practical guidance:</strong> this course treats CNNs as a conceptual stop, not a deep architecture study — image classification is a smaller part of most AI-engineering product work than LLM-based systems, so 5.5\'s lab is the last time this course builds a CNN from scratch; everything from Section 6 onward focuses on the transformer architecture instead.',
    ],
    keyPoints: [
      'A convolution slides a small learned kernel across an image, detecting a local pattern regardless of position — unlike a flat feedforward layer.',
      '<strong>Stride</strong> controls how far the kernel moves each step; <strong>padding</strong> preserves output size at the image\'s edges.',
      '<strong>Pooling</strong> (typically max-pooling) shrinks the feature map while keeping its strongest signal, and adds tolerance to small positional shifts.',
      '<strong>Parameter sharing</strong> (the same kernel reused across the whole image) is the core reason CNNs need far fewer parameters than an equivalent flat feedforward layer on the same image.',
      'This course treats CNNs at a conceptual/practical level only — the architectural focus shifts to transformers from Section 6 onward.',
    ],
    code: `import torch
import torch.nn as nn

class SimpleCNN(nn.Module):
    def __init__(self, num_classes=10):
        super().__init__()
        self.conv1 = nn.Conv2d(in_channels=1, out_channels=16,
                                kernel_size=3, stride=1, padding=1)
        self.relu = nn.ReLU()
        self.pool = nn.MaxPool2d(kernel_size=2, stride=2)
        self.conv2 = nn.Conv2d(in_channels=16, out_channels=32,
                                kernel_size=3, stride=1, padding=1)
        self.fc = nn.Linear(32 * 7 * 7, num_classes)  # after two 2x poolings on 28x28 input

    def forward(self, x):
        x = self.pool(self.relu(self.conv1(x)))   # 28x28 -> 14x14 feature maps
        x = self.pool(self.relu(self.conv2(x)))   # 14x14 -> 7x7 feature maps
        x = x.view(x.size(0), -1)                  # flatten before the final linear layer
        return self.fc(x)

model = SimpleCNN(num_classes=10)
sample_batch = torch.randn(8, 1, 28, 28)  # 8 grayscale 28x28 images (e.g. MNIST)
output = model(sample_batch)
print(output.shape)  # torch.Size([8, 10]) — 10 class scores per image
`,
    codeLabel: 'python',
    mermaid: `flowchart LR
    I["Input image (28x28)"] --> C1["Conv layer + ReLU"]
    C1 --> P1["Max pooling (14x14)"]
    P1 --> C2["Conv layer + ReLU"]
    C2 --> P2["Max pooling (7x7)"]
    P2 --> FL["Flatten"]
    FL --> FC["Fully connected layer"]
    FC --> O["Class scores"]`,
    note: {
      label: 'WHY THIS MATTERS',
      text: 'Parameter sharing is the whole reason a CNN can process a 224x224 image with a manageable number of parameters — a fully-connected layer over the same raw pixels would need orders of magnitude more weights.',
      tone: 'green',
    },
    quiz: {
      question: 'Why does a convolutional network typically need far fewer parameters than a fully-connected feedforward network processing the same image?',
      options: [
        { label: 'Convolutional networks discard most of the image before processing it', correct: false },
        { label: 'The same small kernel is reused (shared) across every position in the image, instead of learning a separate weight per pixel position', correct: true },
        { label: 'Convolutional networks only work on grayscale images, which have fewer values than color images', correct: false },
        { label: 'Pooling layers eliminate the need for any learned parameters entirely', correct: false },
      ],
      explanation: 'Parameter sharing means one small kernel\'s weights are applied at every position across the image rather than learning an entirely separate weight for each pixel location — this is what makes CNNs parameter-efficient for image data, not any form of discarding information or being limited to grayscale.',
    },
  },
  {
    id: '5.5',
    title: 'Lab: Training an Image Classifier With PyTorch',
    duration: '25 min',
    kind: 'assignment',
    summary: [
      'This lab combines 5.3\'s training loop and 5.4\'s CNN architecture into a complete, evaluated image classification project — the second of this course\'s five flagship portfolio projects.',
      'Build the full pipeline: load MNIST or CIFAR-10 via a standard dataset loader, define the CNN from 5.4, train it using the loop structure from 5.3 across several epochs, then evaluate on a held-out test set with more than just accuracy — a confusion matrix reveals which specific classes the model confuses with each other, which a single accuracy number hides completely.',
      'Save the trained model\'s weights (<code>torch.save</code>) and write a small standalone inference script that loads them and classifies a single new image — this mirrors, in miniature, the "train once, serve repeatedly" split that Section 12 (MLOps) will build into a full production pattern.',
      'For the README: report final test accuracy, show the confusion matrix and name the most-confused class pair, and briefly compare training with the CNN from 5.4 against a plain feedforward network on the same data — quantifying, on your own data, the "why CNNs win for images" claim from 5.4 rather than taking it on faith.',
    ],
    keyPoints: [
      'Full pipeline: dataset loading → CNN definition → training loop → test-set evaluation → confusion matrix → saved model → inference script.',
      'A confusion matrix reveals which specific classes get confused with each other — information a single accuracy number cannot show.',
      'Save trained weights separately from the training script, and write a standalone inference script — this is the shape production model serving takes later in the course.',
      'Directly compare the CNN against a plain feedforward network on the same data to quantify, rather than assume, the architectural advantage from 5.4.',
      'This is portfolio project #2 of this course\'s five flagship projects.',
    ],
    code: `import torch
import torch.nn as nn
from torch.utils.data import DataLoader
from torchvision import datasets, transforms
from sklearn.metrics import confusion_matrix

transform = transforms.Compose([transforms.ToTensor()])
train_data = datasets.MNIST(root="./data", train=True, download=True, transform=transform)
test_data = datasets.MNIST(root="./data", train=False, download=True, transform=transform)

train_loader = DataLoader(train_data, batch_size=64, shuffle=True)
test_loader = DataLoader(test_data, batch_size=64, shuffle=False)

model = SimpleCNN(num_classes=10)   # from 5.4
optimizer = torch.optim.Adam(model.parameters(), lr=0.001)
loss_fn = nn.CrossEntropyLoss()

for epoch in range(5):
    model.train()
    for images, labels in train_loader:
        optimizer.zero_grad()
        loss = loss_fn(model(images), labels)
        loss.backward()
        optimizer.step()

# --- Evaluation: accuracy AND confusion matrix ---
model.eval()
all_preds, all_labels = [], []
with torch.no_grad():
    for images, labels in test_loader:
        preds = model(images).argmax(dim=1)
        all_preds.extend(preds.tolist())
        all_labels.extend(labels.tolist())

test_accuracy = sum(p == l for p, l in zip(all_preds, all_labels)) / len(all_labels)
print(f"test accuracy: {test_accuracy:.3f}")
print("confusion matrix:\\n", confusion_matrix(all_labels, all_preds))

# --- Save model, then a SEPARATE inference script would load it like this ---
torch.save(model.state_dict(), "mnist_cnn.pt")

# inference_script.py (separate file):
# model = SimpleCNN(num_classes=10)
# model.load_state_dict(torch.load("mnist_cnn.pt"))
# model.eval()
# prediction = model(single_image_tensor.unsqueeze(0)).argmax(dim=1)
`,
    codeLabel: 'python',
    note: {
      label: 'WHEN TO USE',
      text: 'Separating training code from a standalone inference script — loading only saved weights, not the training loop — is the pattern every production model-serving setup in Section 12 builds on.',
      tone: 'green',
    },
    quiz: {
      question: 'The trained classifier reports 94% overall test accuracy. What additional information does the confusion matrix provide that this single number does not?',
      options: [
        { label: 'Nothing — the confusion matrix is redundant once overall accuracy is known', correct: false },
        { label: 'Which specific pairs of classes the model confuses with each other most often', correct: true },
        { label: 'The exact number of training epochs that were used', correct: false },
        { label: 'The model\'s total parameter count', correct: false },
      ],
      explanation: 'A single accuracy figure says how often the model is right overall, but nothing about the pattern of its mistakes — the confusion matrix breaks this down per class pair, revealing (for example) that a model confuses "4" and "9" far more than any other digit pair, information that guides where to focus further improvement.',
    },
  },
]
