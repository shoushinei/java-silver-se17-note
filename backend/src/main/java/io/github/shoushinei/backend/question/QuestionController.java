package io.github.shoushinei.backend.question;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

// 対応表が読めているかを確かめるための API
@RestController
public class QuestionController {

    private final QuestionCatalog catalog;

    public QuestionController(QuestionCatalog catalog) {
        this.catalog = catalog;
    }

    // GET /api/exams/02/questions/7 ── 試験02 の問7 の正解と論点
    @GetMapping("/api/exams/{examId}/questions/{no}")
    public QuestionFile.Question get(@PathVariable String examId, @PathVariable int no) {
        return catalog.find(examId, no)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "exam " + examId + " question " + no + " not found"));
    }
}