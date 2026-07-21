package com.skillbridge.mentorship.integration;

import com.skillbridge.mentorship.dto.request.SendMessageRequest;
import com.skillbridge.mentorship.dto.request.SendRequestRequest;
import com.skillbridge.mentorship.dto.request.UpsertProfileRequest;
import com.skillbridge.mentorship.dto.response.PairResponse;
import com.skillbridge.mentorship.dto.response.RequestResponse;
import com.skillbridge.mentorship.dto.response.ThreadResponse;
import com.skillbridge.mentorship.entity.MentorshipRequest;
import com.skillbridge.mentorship.entity.PairStatus;
import com.skillbridge.mentorship.entity.RequestStatus;
import com.skillbridge.mentorship.exception.DuplicateRequestException;
import com.skillbridge.mentorship.repository.MentorshipRequestRepository;
import com.skillbridge.mentorship.service.MentorshipService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.dao.DataIntegrityViolationException;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.within;

/**
 * Constitution IV integration coverage for the stateful flows that
 * controller-slice tests cannot exercise: the partial unique index duplicate
 * guard, the accept-creates-pair transaction, and read-receipt stamping
 * against a real PostgreSQL schema (Flyway V1–V5 applied on startup).
 */
@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest(properties = "jwt.secret=dGVzdC1zZWNyZXQtZm9yLWludGVncmF0aW9uLXRlc3RzLW1pbi0zMi1ieXRlcy1sb25n")
class MentorshipIntegrationTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @Autowired MentorshipService service;
    @Autowired MentorshipRequestRepository requestRepository;

    private UUID newAlumnusWithProfile() {
        UUID alumniId = UUID.randomUUID();
        service.upsertProfile(alumniId, new UpsertProfileRequest(
                "Engineer", "Hubtel", "Fintech", List.of("fintech"), null, true));
        return alumniId;
    }

    @Test
    void partialUniqueIndexBlocksSecondPendingRequestAtTheDatabaseLevel() {
        UUID studentId = UUID.randomUUID();
        UUID alumniId = UUID.randomUUID();

        MentorshipRequest first = new MentorshipRequest();
        first.setStudentId(studentId);
        first.setAlumniId(alumniId);
        requestRepository.saveAndFlush(first);

        MentorshipRequest second = new MentorshipRequest();
        second.setStudentId(studentId);
        second.setAlumniId(alumniId);

        // bypasses the service-layer pre-check on purpose: the index itself must hold
        assertThatThrownBy(() -> requestRepository.saveAndFlush(second))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void serviceMapsDuplicatePendingToConflictAndCancelFreesTheSlot() {
        UUID studentId = UUID.randomUUID();
        UUID alumniId = newAlumnusWithProfile();

        RequestResponse first = service.sendRequest(studentId, new SendRequestRequest(alumniId, "Hi"));
        assertThatThrownBy(() -> service.sendRequest(studentId, new SendRequestRequest(alumniId, "again")))
                .isInstanceOf(DuplicateRequestException.class);

        service.cancelRequest(studentId, first.id());

        RequestResponse retry = service.sendRequest(studentId, new SendRequestRequest(alumniId, "take two"));
        assertThat(retry.status()).isEqualTo(RequestStatus.PENDING);
        assertThat(retry.id()).isNotEqualTo(first.id());
    }

    @Test
    void acceptTransactionStampsRequestAndCreatesActivePair() {
        UUID studentId = UUID.randomUUID();
        UUID alumniId = newAlumnusWithProfile();

        RequestResponse request = service.sendRequest(studentId, new SendRequestRequest(alumniId, null));
        PairResponse pair = service.acceptRequest(alumniId, request.id());

        assertThat(pair.status()).isEqualTo(PairStatus.ACTIVE);
        assertThat(requestRepository.findById(request.id()).orElseThrow().getStatus())
                .isEqualTo(RequestStatus.ACCEPTED);
        assertThat(service.getMyPairs(studentId)).extracting(PairResponse::id).contains(pair.id());
        assertThat(service.getMyPairs(alumniId)).extracting(PairResponse::id).contains(pair.id());
    }

    @Test
    void readReceiptsAreStampedTransactionallyOnThreadFetchByTheRecipient() {
        UUID studentId = UUID.randomUUID();
        UUID alumniId = newAlumnusWithProfile();
        RequestResponse request = service.sendRequest(studentId, new SendRequestRequest(alumniId, null));
        PairResponse pair = service.acceptRequest(alumniId, request.id());

        service.sendMessage(studentId, pair.id(), new SendMessageRequest("Hello mentor!"));

        // sender re-reads own thread: own message stays unread
        ThreadResponse senderView = service.getThread(studentId, pair.id());
        assertThat(senderView.messages().get(0).readAt()).isNull();

        // recipient fetches: stamped, and the stamp persists across fetches
        ThreadResponse recipientView = service.getThread(alumniId, pair.id());
        assertThat(recipientView.messages().get(0).readAt()).isNotNull();

        // PostgreSQL TIMESTAMPTZ rounds to microseconds; the in-memory stamp has nanos
        ThreadResponse again = service.getThread(studentId, pair.id());
        assertThat(again.messages().get(0).readAt())
                .isCloseTo(recipientView.messages().get(0).readAt(), within(1, ChronoUnit.MICROS));
    }
}
