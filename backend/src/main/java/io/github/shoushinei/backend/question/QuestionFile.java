package io.github.shoushinei.backend.question;

import java.util.List;
import java.util.Map;

// docs/exams/questions.json の形。JSON のキー名と、record のフィールド名をそろえる
public record QuestionFile(String description, Map<String, Exam> exams) {

    public record Exam(String title, List<Question> questions) { }

    public record Question(int no, List<String> answer, List<Ref> refs) { }

    // 論点1つ。id は "c5-s10"、section は "第5章 10「default / static / private」"
    public record Ref(String id, String section, String point) { }
}