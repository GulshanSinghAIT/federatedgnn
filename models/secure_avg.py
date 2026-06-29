"""
Secure aggregation (FedAvg / simulated SMPC) over model state dicts.

Implements the global update of Eq. (7) in the paper:
    theta_{t+1} = (1/N) * sum_i n_i * theta_i^(t),   N = sum_i n_i

Only model weights are combined here - never raw features, embeddings, labels,
or sensitive attributes. This mirrors a secure-aggregation protocol where the
honest-but-curious aggregator observes only the (optionally noised) averaged
parameters, not any individual hospital's contribution.
"""

from __future__ import annotations

from collections import OrderedDict
from typing import Sequence

import torch


def secure_average(
    weights_list: Sequence[OrderedDict],
    sample_counts: Sequence[int] | None = None,
    noise_sigma: float = 0.0,
) -> OrderedDict:
    """
    Weighted FedAvg over a list of state dicts.

    Parameters
    ----------
    weights_list : list[OrderedDict]
        One state_dict per hospital (already on CPU; see send_model_weights).
    sample_counts : list[int] | None
        n_i per hospital for sample-weighted averaging. If None, uniform.
    noise_sigma : float
        Std-dev of optional Gaussian noise added to the aggregate (SMPC/DP-style
        masking). 0 disables it. Noise is applied to floating-point tensors only.

    Returns
    -------
    OrderedDict
        Aggregated weights.
    """
    if not weights_list:
        return OrderedDict()

    n = len(weights_list)
    if sample_counts is None:
        sample_counts = [1] * n
    total = float(sum(sample_counts)) or 1.0
    fracs = [c / total for c in sample_counts]

    avg: OrderedDict = OrderedDict()
    for key in weights_list[0].keys():
        base = weights_list[0][key]
        if torch.is_floating_point(base):
            acc = torch.zeros_like(base, dtype=torch.float32)
            for frac, w in zip(fracs, weights_list):
                acc += frac * w[key].float()
            if noise_sigma > 0:
                acc += torch.randn_like(acc) * noise_sigma
            avg[key] = acc.to(base.dtype)
        else:
            # Non-float buffers (e.g. counters): take the first client's value.
            avg[key] = base.clone()
    return avg
