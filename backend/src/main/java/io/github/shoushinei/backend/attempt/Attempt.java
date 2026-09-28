package io.github.shoushinei.backend.attempt;

import java.time.LocalDateTime;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;

// 1回分の受験。このクラスが、そのまま DB の表 attempt になる
@Entity
public class Attempt {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;              // 1, 2, 3 … と DB が自動で振る

    private String examId;        // "01" や "02"
    private LocalDateTime takenAt;
    private int score;            // 正解した数
    private int total;            // 問題数
    private int durationSec;      // かかった秒数

    protected Attempt() { }       // JPA が DB から読み込むときに使う

    public Attempt(String examId, int score, int total, int durationSec) {
        this.examId = examId;
        this.takenAt = LocalDateTime.now();
        this.score = score;
        this.total = total;
        this.durationSec = durationSec;
    }

    public Long getId() { return id; }
    public String getExamId() { return examId; }
    public LocalDateTime getTakenAt() { return takenAt; }
    public int getScore() { return score; }
    public int getTotal() { return total; }
    public int getDurationSec() { return durationSec; }
}