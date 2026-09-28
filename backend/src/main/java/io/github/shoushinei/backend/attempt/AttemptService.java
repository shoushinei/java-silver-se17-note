package io.github.shoushinei.backend.attempt;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

// 受験記録の「処理」の置き場所。コントローラは受け取りと返事だけにする
@Service
public class AttemptService {

    private final AttemptRepository repository;

    public AttemptService(AttemptRepository repository) {
        this.repository = repository;
    }

    @Transactional
    public AttemptDetailResponse create(AttemptRequest req) {
        int score = (int) req.items().stream().filter(AttemptRequest.Item::correct).count();
        Attempt attempt = new Attempt(req.examId(), score, req.items().size(), req.durationSec());
        for (AttemptRequest.Item i : req.items()) {
            attempt.addItem(i.questionNo(), i.correct(), i.selected());
        }
        return AttemptDetailResponse.from(repository.save(attempt));   // items も一緒に保存される
    }

    @Transactional(readOnly = true)
    public List<AttemptResponse> list() {
        return repository.findAllByOrderByTakenAtDesc().stream()
                .map(AttemptResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public AttemptDetailResponse get(Long id) {
        return AttemptDetailResponse.from(find(id));    // items はここで読み込まれる
    }

    @Transactional
    public AttemptDetailResponse.Item updateMemo(Long id, int questionNo, String memo) {
        AttemptItem item = find(id).getItems().stream()
                .filter(i -> i.getQuestionNo() == questionNo)
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "question " + questionNo + " not found in attempt " + id));
        item.changeMemo(memo);            // save を呼ばなくても、終わるときに自動で UPDATE される
        return AttemptDetailResponse.Item.from(item);
    }

    @Transactional
    public void delete(Long id) {
        repository.delete(find(id));      // items も一緒に消える
    }

    private Attempt find(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "attempt " + id + " not found"));
    }
}