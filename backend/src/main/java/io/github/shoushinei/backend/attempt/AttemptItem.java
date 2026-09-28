package io.github.shoushinei.backend.attempt;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;

// 1問ぶんの結果とメモ。表 attempt_item の1行
@Entity
public class AttemptItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)       // 多（この問題）対 1（受験）
    @JoinColumn(name = "attempt_id")         // 親を指す列の名前
    private Attempt attempt;

    private int questionNo;                  // 問題番号 1〜60
    private boolean correct;                 // 正解したか
    private String selected;                 // 選んだ選択肢 "A,C"。未回答は ""

    @Column(length = 2000)                   // 文字列の列は、何もしないと 255 文字まで
    private String memo;

    protected AttemptItem() { }

    AttemptItem(Attempt attempt, int questionNo, boolean correct, String selected) {
        this.attempt = attempt;
        this.questionNo = questionNo;
        this.correct = correct;
        this.selected = selected;
    }

    void changeMemo(String memo) {
        this.memo = memo;
    }

    public Long getId() { return id; }
    public int getQuestionNo() { return questionNo; }
    public boolean isCorrect() { return correct; }
    public String getSelected() { return selected; }
    public String getMemo() { return memo; }
}