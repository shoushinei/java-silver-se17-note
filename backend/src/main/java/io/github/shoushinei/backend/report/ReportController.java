package io.github.shoushinei.backend.report;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class ReportController {

    private final ReportService service;

    public ReportController(ReportService service) {
        this.service = service;
    }

    // GET /api/attempts/3/report ── JSON ではなく、そのままコピーできるテキストで返す
    @GetMapping(value = "/api/attempts/{id}/report", produces = "text/plain;charset=UTF-8")
    public String report(@PathVariable Long id) {
        return service.report(id);
    }
}