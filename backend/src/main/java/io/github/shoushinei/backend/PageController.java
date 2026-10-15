package io.github.shoushinei.backend;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

import jakarta.servlet.http.HttpServletRequest;

// 教材・模擬試験・使い方のページ（../docs/）を、このサーバーから配信するための補助。
// /note/ や /exams/02/ のように「/」で終わるアドレスを、その中の index.html に回す（GitHub Pages と同じ動き）。
// トップ（/）は Spring Boot が docs/index.html をそのまま返すので、ここには書かない。
// @RestController ではなく @Controller なので、戻り値は「返す中身」ではなく「次に行く先」になる
@Controller
public class PageController {

    @GetMapping({"/note/", "/guide/", "/about/", "/exams/", "/exams/{examId}/"})
    public String index(HttpServletRequest request) {
        return "forward:" + request.getRequestURI() + "index.html";
    }
}