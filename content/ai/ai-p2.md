---
id: ai-p2
title: Project: Deep Learning Capstone
week: Week 11
kind: project
summary: Train, evaluate and ship a deep-learning model for text or images using transfer learning, with an honest evaluation and a small demo.
builds_on: ai-w10, ai-w9, ai-w8
leads_to: ag-w1, fs-w1
---

The final AI project shows you can take a deep-learning problem from data to a working demo. Choose **one track**. Use Google Colab or Kaggle Notebooks for free GPUs.

# Project: Deep learning, end to end

### Track A: Text, a support-ticket classifier

- Data: a public dataset (e.g. Banking77 intents on Hugging Face Datasets), or your own collected texts.
- Baseline: TF-IDF + logistic regression (week 9).
- Model: fine-tune a small transformer (`distilbert-base-uncased` or a multilingual model if you include Persian), using Hugging Face `transformers`.
- Compare it with **zero-shot prompting** of an LLM on the same test set (this previews Agentic week 1).

### Track B: Images, a domain classifier

- Data: 5–20 classes (plants, food dishes, product types, defect vs OK). At least 100 images per class.
- Baseline: a frozen pretrained backbone + logistic regression on its embeddings.
- Model: fine-tuned ResNet/EfficientNet (week 10), with augmentation and early stopping.

### Requirements for both tracks

1. **Data card**: source, license, class balance, splits (stratified; no near-duplicates across splits) and known biases.
2. **Experiments table**: at least 4 runs (baseline, frozen, fine-tuned, plus one ablation such as no augmentation or a different LR) with metrics on the validation set.
3. **Final test evaluation**, once: macro-F1, the confusion matrix and per-class metrics.
4. **Error analysis**: 15 misclassified examples, grouped into failure types.
5. **Demo**: a small **Gradio** or **Streamlit** app (or a FastAPI endpoint) that loads the saved model and predicts from user input.
6. **Model card**: the intended use, out-of-scope uses, metrics, limitations and ethical considerations.

## Milestones

- [ ] Pick a track and a dataset; write the data card and split strategy
- [ ] Baseline model and metrics
- [ ] Transfer learning: frozen → fine-tuned, logged in the experiments table
- [ ] One ablation experiment and its interpretation
- [ ] Final test evaluation + error analysis
- [ ] Gradio/Streamlit demo working locally or on Hugging Face Spaces
- [ ] Model card and a README with how to reproduce the results

## Rubric

| Criterion | Weight |
|---|---|
| Correct methodology: splits, baselines, single test use | 25% |
| Modeling: transfer learning done well, tuned, ablation | 25% |
| Evaluation and error analysis depth | 20% |
| Working demo | 15% |
| Documentation: data card, model card, reproducibility | 15% |

## Stretch goals

- Track A: try a **sentence-embedding + logistic regression** approach and compare its cost and speed with fine-tuning.
- Track B: export to **ONNX**, and measure CPU latency before and after quantization.
- Deploy the demo with Docker (DevOps week 4, Full-Stack week 12).

# Sources

- [Hugging Face: Fine-tune a pretrained model (Transformers docs)](https://huggingface.co/docs/transformers/training)
- [Gradio quickstart](https://www.gradio.app/guides/quickstart)
- Mitchell et al. (2019), "Model Cards for Model Reporting", arXiv:1810.03993
- Gebru et al. (2021), "Datasheets for Datasets", *Communications of the ACM*
