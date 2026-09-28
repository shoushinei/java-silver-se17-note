package io.github.shoushinei.backend.question;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import tools.jackson.databind.ObjectMapper;

// 問題番号 → 正解・論点 の対応表。起動したときに1回だけ読み込んで、あとは使い回す
@Component
public class QuestionCatalog {

    private static final Logger log = LoggerFactory.getLogger(QuestionCatalog.class);

    private final QuestionFile file;

    // Path で直接受け取ると、Spring が「../」を含むパスを変換できずに起動が止まる。文字列で受け取って自分で変換する
    public QuestionCatalog(@Value("${app.questions-file}") String location, ObjectMapper mapper) {
        Path path = Path.of(location);
        if (!Files.exists(path)) {
            // 見つからなければ起動を止める。どこを探したかを出しておくと直しやすい
            throw new IllegalStateException("questions.json が見つかりません: " + path.toAbsolutePath());
        }
        this.file = mapper.readValue(path.toFile(), QuestionFile.class);
        int count = file.exams().values().stream().mapToInt(e -> e.questions().size()).sum();
        log.info("questions.json を読み込みました（{} 回ぶん・{} 問）", file.exams().size(), count);
    }

    public Optional<String> examTitle(String examId) {
        return Optional.ofNullable(file.exams().get(examId)).map(QuestionFile.Exam::title);
    }

    public Optional<QuestionFile.Question> find(String examId, int no) {
        QuestionFile.Exam exam = file.exams().get(examId);
        if (exam == null) return Optional.empty();
        return exam.questions().stream().filter(q -> q.no() == no).findFirst();
    }
}