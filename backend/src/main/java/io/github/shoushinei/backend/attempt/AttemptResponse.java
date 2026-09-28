package io.github.shoushinei.backend.attempt;

import java.time.LocalDateTime;

// 画面へ返す JSON の形。表の列と分けておくと、列を変えても返す形を保てる
public record AttemptResponse(
        Long id,
        String examId,
        LocalDateTime takenAt,
        int score,
        int total,
        int percent,
        int durationSec) {

    static AttemptResponse from(Attempt a) {
        return new AttemptResponse(a.getId(), a.getExamId(), a.getTakenAt(),
                a.getScore(), a.getTotal(), a.getScore() * 100 / a.getTotal(), a.getDurationSec());
    }
}