package io.github.shoushinei.backend.attempt;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/attempts")          // このクラスのメソッドは、すべて /api/attempts から始まる
public class AttemptController {

    private final AttemptRepository repository;

    // Spring がリポジトリを渡してくれる（コンストラクタ・インジェクション）
    public AttemptController(AttemptRepository repository) {
        this.repository = repository;
    }

    // POST /api/attempts ── 1件保存する
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)   // 成功したら 201 Created を返す
    public AttemptResponse create(@Valid @RequestBody AttemptRequest req) {
        Attempt saved = repository.save(
                new Attempt(req.examId(), req.score(), req.total(), req.durationSec()));
        return AttemptResponse.from(saved);
    }

    // GET /api/attempts ── 新しい順に全件
    @GetMapping
    public List<AttemptResponse> list() {
        return repository.findAllByOrderByTakenAtDesc().stream()
                .map(AttemptResponse::from)
                .toList();
    }

    // GET /api/attempts/3 ── 1件。無ければ 404
    @GetMapping("/{id}")
    public AttemptResponse get(@PathVariable Long id) {
        return repository.findById(id)
                .map(AttemptResponse::from)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "attempt " + id + " not found"));
    }
}