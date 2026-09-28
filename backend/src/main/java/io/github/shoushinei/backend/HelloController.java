package io.github.shoushinei.backend;

import java.time.LocalDateTime;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HelloController {

    record Hello(String message, LocalDateTime time) {}

    @GetMapping("/api/hello")
    public Hello hello() {
        return new Hello("hello", LocalDateTime.now());
    }
}