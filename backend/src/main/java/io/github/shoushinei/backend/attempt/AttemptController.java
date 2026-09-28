package io.github.shoushinei.backend.attempt;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;

@RestController
@RequestMapping("/api/attempts")          // このクラスのメソッドは、すべて /api/attempts から始まる
public class AttemptController {

    private final AttemptService service;

    public AttemptController(AttemptService service) {
        this.service = service;
    }

    record MemoRequest(@Size(max = 2000) String memo) { }

    // POST /api/attempts ── 1回分を、60問の結果ごと保存する
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public AttemptDetailResponse create(@Valid @RequestBody AttemptRequest req) {
        return service.create(req);
    }

    // GET /api/attempts ── 新しい順に全件（概要だけ）
    @GetMapping
    public List<AttemptResponse> list() {
        return service.list();
    }

    // GET /api/attempts/3 ── 1件を、問題ごとの結果とメモつきで
    @GetMapping("/{id}")
    public AttemptDetailResponse get(@PathVariable Long id) {
        return service.get(id);
    }

    // PUT /api/attempts/3/items/7/memo ── 問7のメモを書き換える
    @PutMapping("/{id}/items/{questionNo}/memo")
    public AttemptDetailResponse.Item updateMemo(@PathVariable Long id, @PathVariable int questionNo,
                                                 @Valid @RequestBody MemoRequest req) {
        return service.updateMemo(id, questionNo, req.memo());
    }

    // DELETE /api/attempts/3 ── 1件消す（問題ごとの記録も一緒に）
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        service.delete(id);
    }
}