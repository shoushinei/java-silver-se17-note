package io.github.shoushinei.backend.attempt;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

// 中身は書かない。Spring が実装を自動で作る
public interface AttemptRepository extends JpaRepository<Attempt, Long> {

    // メソッド名から SQL が作られる（新しい順に全件）
    List<Attempt> findAllByOrderByTakenAtDesc();
}