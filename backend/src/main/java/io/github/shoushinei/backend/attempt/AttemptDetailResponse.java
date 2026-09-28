package io.github.shoushinei.backend.attempt;

import java.util.List;

// 1件を開いたときに返す形。概要 ＋ 1問ずつの結果とメモ
public record AttemptDetailResponse(
        AttemptResponse summary,
        List<Item> items) {

    public record Item(int questionNo, boolean correct, String selected, String memo) {
        static Item from(AttemptItem i) {
            return new Item(i.getQuestionNo(), i.isCorrect(), i.getSelected(), i.getMemo());
        }
    }

    static AttemptDetailResponse from(Attempt a) {
        return new AttemptDetailResponse(
                AttemptResponse.from(a),
                a.getItems().stream().map(Item::from).toList());
    }
}