package io.github.shoushinei.backend.report;

import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;

import io.github.shoushinei.backend.attempt.AttemptDetailResponse;
import io.github.shoushinei.backend.attempt.AttemptResponse;
import io.github.shoushinei.backend.attempt.AttemptService;
import io.github.shoushinei.backend.question.QuestionCatalog;
import io.github.shoushinei.backend.question.QuestionFile;

// 1回の受験記録と、問題の対応表を組み合わせて、生成AIに貼れるテキストを作る
@Service
public class ReportService {

    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");
    private static final int TOP = 10;      // 弱い論点は多い順に10個まで

    private final AttemptService attempts;
    private final QuestionCatalog catalog;

    public ReportService(AttemptService attempts, QuestionCatalog catalog) {
        this.attempts = attempts;
        this.catalog = catalog;
    }

    // 論点1つぶんの集計。どの問題で間違えたかを覚えておく
    record WeakTopic(String section, List<Integer> questionNos) { }

    public String report(Long attemptId) {
        AttemptDetailResponse detail = attempts.get(attemptId);   // 無ければここで 404
        AttemptResponse s = detail.summary();
        String examId = s.examId();

        StringBuilder out = new StringBuilder();

        // ── 見出し
        out.append(catalog.examTitle(examId).orElse("試験 " + examId))
           .append(" ／ ").append(s.takenAt().format(DATE))
           .append(" ／ ").append(s.score()).append(" / ").append(s.total())
           .append(" 問正解（").append(s.percent()).append("%）")
           .append(" ／ ").append(s.durationSec() / 60).append(" 分 ").append(s.durationSec() % 60).append(" 秒\n");

        List<AttemptDetailResponse.Item> wrong = detail.items().stream().filter(i -> !i.correct()).toList();
        List<AttemptDetailResponse.Item> memoOnCorrect = detail.items().stream()
                .filter(i -> i.correct() && hasMemo(i)).toList();

        if (wrong.isEmpty()) {
            out.append("\n全問正解でした。\n");
            return out.toString();
        }

        // ── 弱い論点：間違えた問題の論点（refs）を数える
        Map<String, WeakTopic> topics = new LinkedHashMap<>();
        for (AttemptDetailResponse.Item item : wrong) {
            for (QuestionFile.Ref ref : refs(examId, item.questionNo())) {
                topics.computeIfAbsent(ref.id(), id -> new WeakTopic(ref.section(), new ArrayList<>()))
                      .questionNos().add(item.questionNo());
            }
        }
        List<WeakTopic> ranked = topics.values().stream()
                .sorted(Comparator.comparingInt((WeakTopic t) -> t.questionNos().size()).reversed())
                .toList();

        out.append("\n■ 弱い論点（この回で間違えた問題の数。多い順）\n");
        for (int n = 0; n < Math.min(TOP, ranked.size()); n++) {
            WeakTopic t = ranked.get(n);
            out.append(n + 1).append(". ").append(t.section())
               .append(" …… ").append(t.questionNos().size()).append(" 問（")
               .append(joinQ(t.questionNos())).append("）\n");
        }
        if (ranked.size() > TOP) {
            out.append("   ほか ").append(ranked.size() - TOP).append(" 件\n");
        }

        // ── 間違えた問題を1問ずつ
        out.append("\n■ 間違えた問題（").append(wrong.size()).append(" 問）と自分のメモ\n");
        for (AttemptDetailResponse.Item item : wrong) {
            appendItem(out, examId, item);
        }

        // ── 正解したがメモを残した問題（勘で当たった問題など）
        if (!memoOnCorrect.isEmpty()) {
            out.append("\n■ 正解したが、メモを残した問題\n");
            for (AttemptDetailResponse.Item item : memoOnCorrect) {
                appendItem(out, examId, item);
            }
        }

        // ── 生成AIへのお願い
        out.append("""

                ■ お願い
                私は Java Silver SE 17（1Z0-825）の試験勉強をしています。上は模擬試験で間違えた問題の論点と、自分で書いたメモです。
                1. 弱い論点ごとに、なぜ間違えやすいのかを短く説明してください。メモから、私の勘違いが読み取れればそれも指摘してください。
                2. 弱い論点の上位3つについて、本番と同じ形式（コードを読んで結果を選ぶ5択）の練習問題を2問ずつ作ってください。
                3. 解答と解説は、問題をすべて出したあとにまとめてください。
                """);
        return out.toString();
    }

    private void appendItem(StringBuilder out, String examId, AttemptDetailResponse.Item item) {
        List<QuestionFile.Ref> refs = refs(examId, item.questionNo());
        String answer = catalog.find(examId, item.questionNo())
                .map(q -> String.join(",", q.answer()))
                .orElse("?");
        String selected = item.selected().isEmpty() ? "（未回答）" : item.selected();

        out.append("\nQ").append(item.questionNo());
        if (!refs.isEmpty()) out.append("  ").append(refs.get(0).section());
        out.append("\n");
        out.append("    選んだ: ").append(selected).append(" ／ 正解: ").append(answer).append("\n");
        for (QuestionFile.Ref ref : refs) {
            out.append("    論点: ").append(ref.point()).append("\n");
        }
        if (hasMemo(item)) {
            out.append("    メモ: ").append(item.memo().strip().replace("\n", "\n          ")).append("\n");
        }
    }

    private List<QuestionFile.Ref> refs(String examId, int no) {
        return catalog.find(examId, no).map(QuestionFile.Question::refs).orElse(List.of());
    }

    private static boolean hasMemo(AttemptDetailResponse.Item item) {
        return item.memo() != null && !item.memo().isBlank();
    }

    private static String joinQ(List<Integer> nos) {
        return String.join(", ", nos.stream().map(n -> "Q" + n).toList());
    }
}