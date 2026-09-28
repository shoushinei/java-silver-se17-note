package io.github.shoushinei.backend.attempt;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;

// 画面から受け取る JSON の形
public record AttemptRequest(
        @NotBlank String examId,
        @Min(0) int score,
        @Positive int total,
        @Min(0) int durationSec) {
}