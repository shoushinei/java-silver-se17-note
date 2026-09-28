package io.github.shoushinei.backend;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

import jakarta.servlet.http.HttpServletRequest;

// ノートと模擬試験のページ（../docs/）を、このサーバーから配信するための補助。
// /exams/02/ のように「/」で終わるアドレスを、その中の index.html に回す（GitHub Pages と同じ動き）。
// @RestController ではなく @Controller なので、戻り値は「返す中身」ではなく「次に行く先」になる
@Controller
public class PageController {

    @GetMapping({"/exams/", "/exams/{examId}/"})
    public String index(HttpServletRequest request) {
        return "forward:" + request.getRequestURI() + "index.html";
    }
}