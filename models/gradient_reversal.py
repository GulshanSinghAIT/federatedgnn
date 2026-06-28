"""
Gradient Reversal Layer for adversarial debiasing.

Used in FairGNN: during backprop, gradients are reversed when flowing
through this layer so the encoder is trained to maximize adversary loss
(i.e. produce embeddings that do not predict sensitive attribute).
"""

from __future__ import annotations

import torch
import torch.nn as nn
from torch.autograd import Function


class GradientReversalFunction(Function):
    """Forward: identity. Backward: negate gradient and scale by lambda."""

    @staticmethod
    def forward(ctx, x: torch.Tensor, alpha: float) -> torch.Tensor:
        ctx.alpha = alpha
        return x.view_as(x)

    @staticmethod
    def backward(ctx, grad_output: torch.Tensor):
        # Reverse gradient: encoder gets -alpha * grad_from_adversary, so minimizing
        # L_total = L_pred - alpha*L_adv pushes encoder to maximize L_adv (debiasing).
        return -ctx.alpha * grad_output, None


def gradient_reverse(x: torch.Tensor, alpha: float = 1.0) -> torch.Tensor:
    """Apply gradient reversal: forward pass unchanged, backward negates and scales gradient."""
    return GradientReversalFunction.apply(x, alpha)


class GradientReversalLayer(nn.Module):
    """Module wrapper for gradient reversal with configurable alpha."""

    def __init__(self, alpha: float = 1.0):
        super().__init__()
        self.alpha = alpha

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return gradient_reverse(x, self.alpha)
