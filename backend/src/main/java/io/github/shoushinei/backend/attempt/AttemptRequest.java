package io.github.shoushinei.backend.attempt;

import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

// 画面から受け取る JSON の形。得点と問題数は items から数えるので、送らせない
public record AttemptRequest(
        @NotBlank String examId,
        @Min(0) int durationSec,
        @NotEmpty List<@Valid Item> items) {

    public record Item(
            @Positive int questionNo,
            boolean correct,
            @NotNull String selected) {
    }
}