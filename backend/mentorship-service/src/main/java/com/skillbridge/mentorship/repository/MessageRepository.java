package com.skillbridge.mentorship.repository;

import com.skillbridge.mentorship.entity.Message;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface MessageRepository extends JpaRepository<Message, UUID> {

    List<Message> findByPairIdOrderBySentAtAsc(UUID pairId);
}
