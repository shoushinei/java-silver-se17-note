package io.github.shoushinei.backend.attempt;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;

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

    // 1（受験）対 多（問題）。保存・削除は受験と一緒に行う
    @OneToMany(mappedBy = "attempt", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("questionNo")
    private List<AttemptItem> items = new ArrayList<>();

    protected Attempt() { }       // JPA が DB から読み込むときに使う

    public Attempt(String examId, int score, int total, int durationSec) {
        this.examId = examId;
        this.takenAt = LocalDateTime.now();
        this.score = score;
        this.total = total;
        this.durationSec = durationSec;
    }

    // 問題を1つ足す。子から親への矢印も、ここで一緒に張る
    void addItem(int questionNo, boolean correct, String selected) {
        items.add(new AttemptItem(this, questionNo, correct, selected));
    }

    public Long getId() { return id; }
    public String getExamId() { return examId; }
    public LocalDateTime getTakenAt() { return takenAt; }
    public int getScore() { return score; }
    public int getTotal() { return total; }
    public int getDurationSec() { return durationSec; }
    public List<AttemptItem> getItems() { return items; }
}