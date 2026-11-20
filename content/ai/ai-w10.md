---
id: ai-w10
title: Image Processing & Convolutional Networks
week: Week 10
summary: Images as arrays and color channels, filters and transformations, convolution and pooling, CNN architectures, building an image classifier, augmentation, transfer learning and fine-tuning, evaluation and an object-detection overview.
builds_on: ai-w8, ai-w7
leads_to: ai-p2
---

Computer vision turned deep learning into a revolution: AlexNet won ImageNet in 2012 by a huge margin. This week goes from pixels to convolutional networks to **transfer learning**, the practical way to build accurate image models with little data. The NumPy convolution code runs right here. Train real CNNs in Colab with a GPU.

# Lesson: Images as arrays (25 min)

A digital image is a grid of **pixels**:
- **Grayscale**: a 2-D array (H × W) of intensities, usually 0–255 (uint8) or 0–1 (float).
- **Color (RGB)**: a 3-D array (H × W × 3), one channel each for red, green and blue. PyTorch uses **channels-first**: (C × H × W), and batches are (N × C × H × W).
- Other color spaces: **HSV** (separates the hue, which is useful for color-based segmentation) and **grayscale** conversion (≈ 0.299R + 0.587G + 0.114B, weighted by human sensitivity).

```python
import numpy as np
img = np.zeros((6, 6, 3), dtype=np.uint8)
img[1:5, 1:5] = [255, 0, 0]                       # a red square
img[2:4, 2:4] = [255, 255, 255]                   # with a white centre
gray = (0.299 * img[..., 0] + 0.587 * img[..., 1] + 0.114 * img[..., 2]).round().astype(int)
print(img.shape, img.dtype)
print(gray)
```

### Classic transformations

- **Geometric**: resize (interpolation), crop, flip, rotate, affine/perspective warps.
- **Photometric**: brightness, contrast, gamma, histogram equalization.
- **Normalization for models**: scale to [0,1], then standardize per channel with the dataset's mean and std (ImageNet: mean ≈ [0.485, 0.456, 0.406], std ≈ [0.229, 0.224, 0.225]).

Libraries: **Pillow** (I/O), **OpenCV** (`cv2`, classic vision), **torchvision.transforms** (model pipelines).

> [!recap]
> - An image is an H×W(×C) array. PyTorch expects N×C×H×W.
> - Normalize inputs exactly as the pretrained model expects.

# Lesson: Convolution, filters and pooling (35 min)

A **convolution** slides a small **kernel** (say 3×3) across the image. At each position it computes the dot product between the kernel and the patch under it. Different kernels detect different patterns:

```python
import numpy as np

def conv2d(img, k):
    kh, kw = k.shape
    H, W = img.shape
    out = np.zeros((H - kh + 1, W - kw + 1))
    for i in range(out.shape[0]):
        for j in range(out.shape[1]):
            out[i, j] = np.sum(img[i:i + kh, j:j + kw] * k)   # dot product of kernel and patch
    return out

img = np.zeros((7, 7)); img[:, 3:] = 1.0              # left half dark, right half bright
sobel_x = np.array([[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]])   # vertical-edge detector
blur = np.ones((3, 3)) / 9
print("edges:\n", conv2d(img, sobel_x))
print("blurred row:", conv2d(img, blur)[0].round(2))
```

The Sobel kernel lights up exactly at the vertical edge. Classic computer vision **hand-designed** kernels like these (blur, sharpen, edge detection). **CNNs learn the kernels from data.**

### Key ideas of convolutional layers

- **Local connectivity**: each output looks at a small neighbourhood.
- **Weight sharing**: the same kernel is used everywhere, so there are far fewer parameters than in a dense layer, and a cat is detected no matter where it is (**translation equivariance**).
- **Channels**: a layer has many kernels, and each produces a **feature map**. Kernels span all input channels.
- **Stride** (step size) and **padding** (adding zeros around the border) control the output size:

$$\text{out} = \left\lfloor \frac{\text{in} + 2p - k}{s} \right\rfloor + 1$$

- **Parameters** in a conv layer: $(k \cdot k \cdot C_{in} + 1) \cdot C_{out}$.

### Pooling

**Max pooling** (2×2, stride 2) keeps the strongest activation in each window. It halves the spatial size, adds a little translation invariance and reduces computation. **Global average pooling** at the end turns each feature map into one number before the classifier.

### The feature hierarchy

Early layers learn edges and colors, middle layers learn textures and parts, and deep layers learn objects (Zeiler & Fergus, 2014). Each layer's **receptive field** grows with depth.

> [!recap]
> - Convolution = a sliding dot product. CNNs *learn* the kernels.
> - Local connectivity + weight sharing make them efficient and translation-equivariant.
> - Size formula: ⌊(in + 2p − k)/s⌋ + 1. Pooling downsamples.

# Lesson: CNN architectures and building a classifier (30 min)

The standard pattern: **[Conv → BatchNorm → ReLU] × n → Pool**, repeated with more channels and smaller spatial size, then global pooling → a linear classifier.

```python norun
import torch
from torch import nn

class SmallCNN(nn.Module):
    def __init__(self, n_classes=10):
        super().__init__()
        def block(cin, cout):
            return nn.Sequential(nn.Conv2d(cin, cout, 3, padding=1), nn.BatchNorm2d(cout), nn.ReLU(),
                                 nn.Conv2d(cout, cout, 3, padding=1), nn.BatchNorm2d(cout), nn.ReLU(),
                                 nn.MaxPool2d(2))
        self.features = nn.Sequential(block(3, 32), block(32, 64), block(64, 128))   # 32→16→8→4
        self.head = nn.Sequential(nn.AdaptiveAvgPool2d(1), nn.Flatten(), nn.Dropout(0.3), nn.Linear(128, n_classes))
    def forward(self, x):
        return self.head(self.features(x))

model = SmallCNN()
print(model(torch.randn(8, 3, 32, 32)).shape)   # torch.Size([8, 10]) for CIFAR-10-sized input
```

Train it with the same loop as week 7: CrossEntropyLoss, AdamW and a schedule. On CIFAR-10, a model like this reaches about 85% with augmentation.

### Milestone architectures

| Model | Year | Key idea |
|---|---|---|
| LeNet-5 | 1998 | Conv + pool for digits |
| AlexNet | 2012 | Deep CNN on GPUs, ReLU, dropout; won ImageNet |
| VGG | 2014 | Simple stacks of 3×3 convs |
| **ResNet** | 2015 | **Residual connections** $y = F(x) + x$ make 100+ layer nets trainable |
| MobileNet / EfficientNet | 2017–19 | Efficient for phones; scaling depth, width and resolution together |
| Vision Transformer (ViT) | 2020 | Images as sequences of patches + self-attention |

A small, runnable stand-in: digit images with scikit-learn's MLP (no convolution, but the same supervised setup):

```python
from sklearn.datasets import load_digits
from sklearn.model_selection import train_test_split
from sklearn.neural_network import MLPClassifier
from sklearn.metrics import classification_report
X, y = load_digits(return_X_y=True)                 # 8×8 images flattened to 64 features
X_tr, X_te, y_tr, y_te = train_test_split(X / 16.0, y, stratify=y, random_state=0)
mlp = MLPClassifier(hidden_layer_sizes=(128,), max_iter=400, random_state=0).fit(X_tr, y_tr)
print("test accuracy:", round(mlp.score(X_te, y_te), 3))
```

> [!recap]
> - Conv-BN-ReLU blocks, pooling, global pooling + linear head.
> - ResNet's residual connections enabled very deep networks. ViT brings transformers to vision.

# Lesson: Augmentation, transfer learning and evaluation (35 min)

### Data augmentation

Create realistic variations of the **training** images so the model learns invariances: random crops, flips, small rotations, color jitter, and advanced methods like RandAugment, MixUp and CutMix.

```python norun
from torchvision import transforms
train_tf = transforms.Compose([
    transforms.RandomResizedCrop(224, scale=(0.7, 1.0)),
    transforms.RandomHorizontalFlip(),
    transforms.ColorJitter(0.2, 0.2, 0.2),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
])
val_tf = transforms.Compose([transforms.Resize(256), transforms.CenterCrop(224), transforms.ToTensor(),
                             transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])])
```

Augment only the training data, and choose transformations that preserve the label: don't flip digits like 6 and 9!

### Transfer learning: the practical superpower

A model pretrained on ImageNet (1.2M images, 1,000 classes) has learned general visual features. Reuse it:

1. **Feature extraction**: freeze the backbone and train only a new final layer. Works with a few hundred images.
2. **Fine-tuning**: then unfreeze some or all layers and train with a **small learning rate** (e.g. 1e-4). Use lower rates for early layers ("discriminative learning rates").

```python norun
import torch
from torch import nn
from torchvision import models
model = models.resnet18(weights=models.ResNet18_Weights.DEFAULT)   # pretrained backbone
for p in model.parameters():
    p.requires_grad = False                                          # 1) freeze everything
model.fc = nn.Linear(model.fc.in_features, 5)                         # new head for 5 classes (trainable)
opt = torch.optim.AdamW(model.fc.parameters(), lr=1e-3)
# ...train a few epochs, then 2) unfreeze layer4 and fine-tune with lr=1e-4...
```

### Evaluating image classifiers

- Accuracy, plus a **per-class** precision/recall/F1 and a **confusion matrix** (which classes get confused?).
- **Top-5 accuracy** for many classes.
- **Look at the errors**: mislabeled data, ambiguous images, distribution shift (different cameras or lighting).
- **Grad-CAM** heat maps show where the model "looked". Watch out for **shortcut learning**, like a "wolf" detector that actually detects snow.

### Beyond classification: object detection

- **Detection** = classification + **bounding boxes** (x, y, w, h) for every object.
- **Two-stage** (Faster R-CNN): propose regions, then classify them. Accurate.
- **One-stage** (YOLO, SSD, RetinaNet): predict boxes and classes in one pass. Fast and real-time.
- Box quality uses **IoU** (intersection over union). Duplicate boxes are removed with **non-maximum suppression**. The metric is **mAP**.
- **Segmentation** labels every pixel (U-Net, Mask R-CNN).

> [!recap]
> - Augment only the training data, with label-preserving transforms.
> - Transfer learning: freeze → train the head → fine-tune with a small LR.
> - Per-class metrics, error analysis and Grad-CAM. Detection = boxes + classes, measured with IoU and mAP.

# Quiz

## A color image batch in PyTorch has which shape convention?
- [ ] (H, W, C, N)
- [x] (N, C, H, W)
- [ ] (C, N, H, W)
- [ ] (N, H, W) only
> Channels-first: batch, channels, height, width.

## A 3×3 convolution with padding 1 and stride 1 on a 32×32 input gives an output of:
- [ ] 30×30
- [x] 32×32
- [ ] 16×16
- [ ] 34×34
> (32 + 2·1 − 3)/1 + 1 = 32.

## Why do CNNs need far fewer parameters than dense layers on images?
- [ ] They ignore color
- [x] Local connectivity and weight sharing: the same small kernel is reused across all positions
- [ ] They use lower precision
- [ ] They skip training
> A 3×3×3→64 conv has 1,792 parameters, whatever the image size.

## What problem did ResNet's residual connections solve?
- [ ] Color distortion
- [x] Training very deep networks (gradients flow through the identity shortcuts)
- [ ] Overfitting on small data only
- [ ] Slow data loading
> y = F(x) + x makes it easy to learn near-identity mappings and helps gradients flow.

## You have 400 labeled images in 4 classes. The best first approach is:
- [ ] Train a large CNN from scratch
- [x] Transfer learning: a pretrained backbone with a new head, then gentle fine-tuning
- [ ] K-Means on raw pixels
- [ ] Linear regression on pixels
> Pretrained features make small datasets workable.

## Which augmentation is inappropriate for handwritten digit classification?
- [ ] Small rotations
- [ ] Slight shifts
- [x] Horizontal and vertical flips
- [ ] Small elastic distortions
> Flips can change the label (6 ↔ 9) or produce non-digits.

## In object detection, what does IoU measure?
- [x] The overlap between the predicted and true boxes, divided by their union
- [ ] Inference speed
- [ ] Image resolution
- [ ] The number of objects
> IoU ≥ 0.5 is a common threshold for a "correct" detection.

# Exercise: Convolution output and parameters

Write two functions:
- `conv_out(size, k, stride=1, pad=0)`, which returns the output spatial size: ⌊(size + 2·pad − k)/stride⌋ + 1.
- `conv_params(k, c_in, c_out, bias=True)`, which returns the number of learnable parameters.

Then write `trace(shape, layers)`, where `shape = (C, H, W)` and `layers` is a list of `("conv", c_out, k, stride, pad)` or `("pool", k)` tuples (pooling has stride k and no padding). Return the list of output shapes after each layer.

## Starter

```python
def conv_out(size, k, stride=1, pad=0):
    pass

def conv_params(k, c_in, c_out, bias=True):
    pass

def trace(shape, layers):
    pass
```

## Tests

```python
ns = load()
assert ns["conv_out"](32, 3, 1, 1) == 32 and ns["conv_out"](32, 3, 2, 1) == 16 and ns["conv_out"](28, 5) == 24
assert ns["conv_params"](3, 3, 64) == 1792 and ns["conv_params"](3, 64, 64, bias=False) == 36864
shapes = ns["trace"]((3, 32, 32), [("conv", 32, 3, 1, 1), ("pool", 2), ("conv", 64, 3, 1, 1), ("pool", 2), ("conv", 128, 3, 2, 1)])
assert shapes == [(32, 32, 32), (32, 16, 16), (64, 16, 16), (64, 8, 8), (128, 4, 4)], shapes
```

## Solution

```python
def conv_out(size, k, stride=1, pad=0):
    return (size + 2 * pad - k) // stride + 1

def conv_params(k, c_in, c_out, bias=True):
    return (k * k * c_in + (1 if bias else 0)) * c_out

def trace(shape, layers):
    c, h, w = shape
    out = []
    for layer in layers:
        if layer[0] == "conv":
            _, c_out, k, s, p = layer
            c, h, w = c_out, conv_out(h, k, s, p), conv_out(w, k, s, p)
        else:
            _, k = layer
            h, w = conv_out(h, k, k), conv_out(w, k, k)
        out.append((c, h, w))
    return out
```

Tracing shapes on paper before you write the PyTorch code prevents most "size mismatch" errors.

# Exercise: Transfer learning in Colab

In Google Colab (Runtime → Change runtime type → GPU), fine-tune `resnet18` on a small 5-class dataset. You can use torchvision's `Flowers102` subset, or a folder of your own photos organized as `root/class_name/*.jpg` and loaded with `ImageFolder`. Record in your notes:
1. The accuracy with a frozen backbone (training only the head) after 5 epochs.
2. The accuracy after unfreezing `layer4` and fine-tuning with lr = 1e-4 for 5 more epochs.
3. The confusion matrix and 3 misclassified images, with your explanation for each.

## Hint

Use the `train_tf`/`val_tf` transforms from the lesson, `DataLoader(..., batch_size=32, shuffle=True)`, and the week 7 training loop. Only pass the parameters with `requires_grad=True` to the optimizer.

# Sources

- [Stanford CS231n: Convolutional Neural Networks for Visual Recognition (notes)](https://cs231n.github.io/convolutional-networks/)
- [PyTorch tutorial: Transfer Learning for Computer Vision](https://pytorch.org/tutorials/beginner/transfer_learning_tutorial.html)
- He et al. (2016), "Deep Residual Learning for Image Recognition", arXiv:1512.03385
- Dosovitskiy et al. (2021), "An Image is Worth 16x16 Words" (ViT), arXiv:2010.11929
- [torchvision: models and transforms documentation](https://pytorch.org/vision/stable/index.html)
- [fast.ai: Practical Deep Learning for Coders (free course)](https://course.fast.ai/)
