"""Fairness metrics computation: Statistical Parity (ΔSP) and Equal Opportunity (ΔEO)."""
import numpy as np
from collections import defaultdict


def compute_statistical_parity(predictions, sensitive_attrs, positive_label=1):
    """
    Compute Statistical Parity Difference (ΔSP).
    
    ΔSP = |P(Ŷ=1 | A=a) − P(Ŷ=1 | A=b)| for all pairs of groups a, b
    Returns the maximum disparity across all group pairs.
    
    Args:
        predictions: list of predicted labels (0 or 1)
        sensitive_attrs: list of sensitive attribute values (e.g., age groups)
        positive_label: the positive class label
    
    Returns:
        float: ΔSP value (lower is better, 0 = perfect parity)
    """
    groups = defaultdict(list)
    for pred, attr in zip(predictions, sensitive_attrs):
        groups[attr].append(pred)
    
    if len(groups) < 2:
        return 0.0
    
    rates = {}
    for group, preds in groups.items():
        if len(preds) > 0:
            rates[group] = sum(1 for p in preds if p == positive_label) / len(preds)
        else:
            rates[group] = 0.0
    
    rate_values = list(rates.values())
    if not rate_values:
        return 0.0
    
    return max(rate_values) - min(rate_values)


def compute_equal_opportunity(predictions, labels, sensitive_attrs, positive_label=1):
    """
    Compute Equal Opportunity Difference (ΔEO).
    
    ΔEO = |TPR(A=a) − TPR(A=b)| for all pairs of groups a, b
    Returns the maximum disparity across all group pairs.
    
    Args:
        predictions: list of predicted labels
        labels: list of true labels
        sensitive_attrs: list of sensitive attribute values
        positive_label: the positive class label
    
    Returns:
        float: ΔEO value (lower is better, 0 = perfect equality)
    """
    groups = defaultdict(lambda: {"tp": 0, "fn": 0})
    
    for pred, label, attr in zip(predictions, labels, sensitive_attrs):
        if label == positive_label:
            if pred == positive_label:
                groups[attr]["tp"] += 1
            else:
                groups[attr]["fn"] += 1
    
    if len(groups) < 2:
        return 0.0
    
    tprs = {}
    for group, counts in groups.items():
        total_positive = counts["tp"] + counts["fn"]
        if total_positive > 0:
            tprs[group] = counts["tp"] / total_positive
        else:
            tprs[group] = 0.0
    
    tpr_values = list(tprs.values())
    if not tpr_values:
        return 0.0
    
    return max(tpr_values) - min(tpr_values)


def compute_per_group_accuracy(predictions, labels, sensitive_attrs):
    """
    Compute accuracy per demographic group.
    
    Returns:
        dict: {group_name: accuracy}
    """
    groups = defaultdict(lambda: {"correct": 0, "total": 0})
    
    for pred, label, attr in zip(predictions, labels, sensitive_attrs):
        groups[attr]["total"] += 1
        if pred == label:
            groups[attr]["correct"] += 1
    
    result = {}
    for group, counts in groups.items():
        if counts["total"] > 0:
            result[group] = round(counts["correct"] / counts["total"], 4)
        else:
            result[group] = 0.0
    
    return result


def evaluate_fairness(predictions, labels, patients, sensitive_attr="ethnicity"):
    """
    Full fairness evaluation for a set of predictions.
    
    Args:
        predictions: list of predicted disease IDs or labels
        labels: list of true disease IDs or labels
        patients: list of patient dicts with demographic info
        sensitive_attr: which attribute to evaluate ("ethnicity", "age_group", "sex")
    
    Returns:
        dict with sp_difference, eo_difference, per_group_accuracy, fairness_gap
    """
    # Binarize predictions for SP/EO computation (correct vs incorrect)
    binary_preds = [1 if p == l else 0 for p, l in zip(predictions, labels)]
    binary_labels = [1] * len(labels)  # All should ideally be correct
    
    sensitive_values = [getattr(p, sensitive_attr, "Unknown") if hasattr(p, sensitive_attr) 
                        else p.get(sensitive_attr, "Unknown") for p in patients]
    
    sp = compute_statistical_parity(binary_preds, sensitive_values)
    eo = compute_equal_opportunity(binary_preds, binary_labels, sensitive_values)
    per_group = compute_per_group_accuracy(predictions, labels, sensitive_values)
    
    accuracies = list(per_group.values())
    fairness_gap = max(accuracies) - min(accuracies) if accuracies else 0.0
    
    return {
        "sp_difference": round(sp, 4),
        "eo_difference": round(eo, 4),
        "per_group_accuracy": per_group,
        "fairness_gap": round(fairness_gap, 4)
    }
