package com.skillbridge.mentorship.service;

import com.skillbridge.mentorship.client.NotificationClient;
import com.skillbridge.mentorship.dto.request.SendMessageRequest;
import com.skillbridge.mentorship.dto.request.SendRequestRequest;
import com.skillbridge.mentorship.dto.request.UpsertProfileRequest;
import com.skillbridge.mentorship.dto.response.MessageResponse;
import com.skillbridge.mentorship.dto.response.PairResponse;
import com.skillbridge.mentorship.dto.response.ProfileResponse;
import com.skillbridge.mentorship.dto.response.RequestResponse;
import com.skillbridge.mentorship.dto.response.ThreadResponse;
import com.skillbridge.mentorship.entity.AlumniProfile;
import com.skillbridge.mentorship.entity.MentorshipPair;
import com.skillbridge.mentorship.entity.MentorshipRequest;
import com.skillbridge.mentorship.entity.Message;
import com.skillbridge.mentorship.entity.PairStatus;
import com.skillbridge.mentorship.entity.RequestStatus;
import com.skillbridge.mentorship.exception.DuplicateRequestException;
import com.skillbridge.mentorship.exception.PairEndedException;
import com.skillbridge.mentorship.exception.PairNotFoundException;
import com.skillbridge.mentorship.exception.ProfileNotFoundException;
import com.skillbridge.mentorship.exception.RequestAlreadyResolvedException;
import com.skillbridge.mentorship.exception.RequestNotFoundException;
import com.skillbridge.mentorship.repository.AlumniProfileRepository;
import com.skillbridge.mentorship.repository.MentorshipPairRepository;
import com.skillbridge.mentorship.repository.MentorshipRequestRepository;
import com.skillbridge.mentorship.repository.MessageRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MentorshipServiceImplTest {

    @Mock AlumniProfileRepository profileRepository;
    @Mock MentorshipRequestRepository requestRepository;
    @Mock MentorshipPairRepository pairRepository;
    @Mock MessageRepository messageRepository;
    @Mock AlumniSearchService searchService;
    @Mock NotificationClient notificationClient;

    @InjectMocks MentorshipServiceImpl service;

    private static final UUID STUDENT_ID = UUID.randomUUID();
    private static final UUID ALUMNI_ID = UUID.randomUUID();

    private AlumniProfile availableProfile;

    @BeforeEach
    void setUp() {
        availableProfile = new AlumniProfile();
        availableProfile.setId(UUID.randomUUID());
        availableProfile.setUserId(ALUMNI_ID);
        availableProfile.setCareerInterests(List.of("fintech"));
        availableProfile.setAvailable(true);
    }

    // ── US1: profile ────────────────────────────────────────────────────

    @Test
    void upsertCreatesProfileOnFirstCall() {
        when(profileRepository.findByUserId(ALUMNI_ID)).thenReturn(Optional.empty());
        when(profileRepository.save(any(AlumniProfile.class))).thenAnswer(inv -> inv.getArgument(0));

        ProfileResponse response = service.upsertProfile(ALUMNI_ID, new UpsertProfileRequest(
                "Engineer", "Hubtel", "Fintech", List.of("fintech"), "bio", true));

        assertThat(response.userId()).isEqualTo(ALUMNI_ID);
        assertThat(response.available()).isTrue();
    }

    @Test
    void upsertReplacesExistingProfile() {
        availableProfile.setBio("old bio");
        when(profileRepository.findByUserId(ALUMNI_ID)).thenReturn(Optional.of(availableProfile));
        when(profileRepository.save(any(AlumniProfile.class))).thenAnswer(inv -> inv.getArgument(0));

        ProfileResponse response = service.upsertProfile(ALUMNI_ID, new UpsertProfileRequest(
                null, null, null, List.of("cloud"), null, false));

        assertThat(response.bio()).isNull();
        assertThat(response.careerInterests()).containsExactly("cloud");
        assertThat(response.available()).isFalse();
    }

    @Test
    void tagNormalizationDedupesCaseInsensitivelyKeepingFirstCasing() {
        assertThat(MentorshipServiceImpl.normalizeTags(
                List.of("  Backend   Engineering ", "backend engineering", "FINTECH", "fintech")))
                .containsExactly("Backend Engineering", "FINTECH");
    }

    @Test
    void getMissingProfileThrowsNotFound() {
        when(profileRepository.findByUserId(ALUMNI_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getProfile(ALUMNI_ID))
                .isInstanceOf(ProfileNotFoundException.class);
    }

    // ── US3: send/cancel requests ──────────────────────────────────────

    @Test
    void sendRequestHappyPath() {
        when(profileRepository.findByUserId(ALUMNI_ID)).thenReturn(Optional.of(availableProfile));
        when(requestRepository.existsByStudentIdAndAlumniIdAndStatus(STUDENT_ID, ALUMNI_ID, RequestStatus.PENDING)).thenReturn(false);
        when(pairRepository.existsByStudentIdAndAlumniIdAndStatus(STUDENT_ID, ALUMNI_ID, PairStatus.ACTIVE)).thenReturn(false);
        when(requestRepository.saveAndFlush(any(MentorshipRequest.class))).thenAnswer(inv -> inv.getArgument(0));

        RequestResponse response = service.sendRequest(STUDENT_ID, new SendRequestRequest(ALUMNI_ID, "  Hi!  "));

        assertThat(response.status()).isEqualTo(RequestStatus.PENDING);
        assertThat(response.message()).isEqualTo("Hi!");
    }

    @Test
    void sendRequestWithPendingDuplicateThrows409() {
        when(profileRepository.findByUserId(ALUMNI_ID)).thenReturn(Optional.of(availableProfile));
        when(requestRepository.existsByStudentIdAndAlumniIdAndStatus(STUDENT_ID, ALUMNI_ID, RequestStatus.PENDING)).thenReturn(true);

        assertThatThrownBy(() -> service.sendRequest(STUDENT_ID, new SendRequestRequest(ALUMNI_ID, null)))
                .isInstanceOf(DuplicateRequestException.class);
    }

    @Test
    void sendRequestWithActivePairThrows409() {
        when(profileRepository.findByUserId(ALUMNI_ID)).thenReturn(Optional.of(availableProfile));
        when(requestRepository.existsByStudentIdAndAlumniIdAndStatus(STUDENT_ID, ALUMNI_ID, RequestStatus.PENDING)).thenReturn(false);
        when(pairRepository.existsByStudentIdAndAlumniIdAndStatus(STUDENT_ID, ALUMNI_ID, PairStatus.ACTIVE)).thenReturn(true);

        assertThatThrownBy(() -> service.sendRequest(STUDENT_ID, new SendRequestRequest(ALUMNI_ID, null)))
                .isInstanceOf(DuplicateRequestException.class);
    }

    @Test
    void sendRequestUniqueConstraintRaceMapsTo409() {
        when(profileRepository.findByUserId(ALUMNI_ID)).thenReturn(Optional.of(availableProfile));
        when(requestRepository.existsByStudentIdAndAlumniIdAndStatus(STUDENT_ID, ALUMNI_ID, RequestStatus.PENDING)).thenReturn(false);
        when(pairRepository.existsByStudentIdAndAlumniIdAndStatus(STUDENT_ID, ALUMNI_ID, PairStatus.ACTIVE)).thenReturn(false);
        when(requestRepository.saveAndFlush(any(MentorshipRequest.class)))
                .thenThrow(new DataIntegrityViolationException("uq_request_pending"));

        assertThatThrownBy(() -> service.sendRequest(STUDENT_ID, new SendRequestRequest(ALUMNI_ID, null)))
                .isInstanceOf(DuplicateRequestException.class);
    }

    @Test
    void sendRequestNotifiesAlumni() {
        when(profileRepository.findByUserId(ALUMNI_ID)).thenReturn(Optional.of(availableProfile));
        when(requestRepository.existsByStudentIdAndAlumniIdAndStatus(STUDENT_ID, ALUMNI_ID, RequestStatus.PENDING)).thenReturn(false);
        when(pairRepository.existsByStudentIdAndAlumniIdAndStatus(STUDENT_ID, ALUMNI_ID, PairStatus.ACTIVE)).thenReturn(false);
        when(requestRepository.saveAndFlush(any(MentorshipRequest.class))).thenAnswer(inv -> inv.getArgument(0));

        service.sendRequest(STUDENT_ID, new SendRequestRequest(ALUMNI_ID, "Hi"));

        verify(notificationClient).notify(
                eq(ALUMNI_ID),
                eq("MENTORSHIP_REQUEST_RECEIVED"),
                eq("New mentorship request"),
                eq("A student has requested your mentorship."));
    }

    @Test
    void sendRequestNotificationFailureStillSucceeds() {
        when(profileRepository.findByUserId(ALUMNI_ID)).thenReturn(Optional.of(availableProfile));
        when(requestRepository.existsByStudentIdAndAlumniIdAndStatus(STUDENT_ID, ALUMNI_ID, RequestStatus.PENDING)).thenReturn(false);
        when(pairRepository.existsByStudentIdAndAlumniIdAndStatus(STUDENT_ID, ALUMNI_ID, PairStatus.ACTIVE)).thenReturn(false);
        when(requestRepository.saveAndFlush(any(MentorshipRequest.class))).thenAnswer(inv -> inv.getArgument(0));
        doThrow(new RuntimeException("down")).when(notificationClient).notify(any(), any(), any(), any());

        RequestResponse response = service.sendRequest(STUDENT_ID, new SendRequestRequest(ALUMNI_ID, "Hi"));

        assertThat(response.status()).isEqualTo(RequestStatus.PENDING);
    }

    @Test
    void sendRequestToUnavailableAlumnusThrows404() {
        availableProfile.setAvailable(false);
        when(profileRepository.findByUserId(ALUMNI_ID)).thenReturn(Optional.of(availableProfile));

        assertThatThrownBy(() -> service.sendRequest(STUDENT_ID, new SendRequestRequest(ALUMNI_ID, null)))
                .isInstanceOf(RequestNotFoundException.class);
    }

    @Test
    void sendRequestToUnknownAlumnusThrows404() {
        when(profileRepository.findByUserId(ALUMNI_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.sendRequest(STUDENT_ID, new SendRequestRequest(ALUMNI_ID, null)))
                .isInstanceOf(RequestNotFoundException.class);
    }

    @Test
    void cancelPendingRequestSucceeds() {
        MentorshipRequest req = pendingRequest();
        when(requestRepository.findByIdAndStudentId(req.getId(), STUDENT_ID)).thenReturn(Optional.of(req));
        when(requestRepository.save(any(MentorshipRequest.class))).thenAnswer(inv -> inv.getArgument(0));

        RequestResponse response = service.cancelRequest(STUDENT_ID, req.getId());

        assertThat(response.status()).isEqualTo(RequestStatus.CANCELLED);
        assertThat(response.respondedAt()).isNotNull();
    }

    @Test
    void cancelResolvedRequestThrows409() {
        MentorshipRequest req = pendingRequest();
        req.setStatus(RequestStatus.DECLINED);
        when(requestRepository.findByIdAndStudentId(req.getId(), STUDENT_ID)).thenReturn(Optional.of(req));

        assertThatThrownBy(() -> service.cancelRequest(STUDENT_ID, req.getId()))
                .isInstanceOf(RequestAlreadyResolvedException.class);
    }

    @Test
    void cancelSomeoneElsesRequestThrows404() {
        UUID requestId = UUID.randomUUID();
        when(requestRepository.findByIdAndStudentId(requestId, STUDENT_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.cancelRequest(STUDENT_ID, requestId))
                .isInstanceOf(RequestNotFoundException.class);
    }

    // ── US4: accept/decline ────────────────────────────────────────────

    @Test
    void acceptCreatesActivePairAndStampsRequest() {
        MentorshipRequest req = pendingRequest();
        when(requestRepository.findByIdAndAlumniId(req.getId(), ALUMNI_ID)).thenReturn(Optional.of(req));
        when(requestRepository.save(any(MentorshipRequest.class))).thenAnswer(inv -> inv.getArgument(0));
        when(pairRepository.save(any(MentorshipPair.class))).thenAnswer(inv -> inv.getArgument(0));

        PairResponse response = service.acceptRequest(ALUMNI_ID, req.getId());

        assertThat(response.status()).isEqualTo(PairStatus.ACTIVE);
        assertThat(response.studentId()).isEqualTo(STUDENT_ID);
        assertThat(response.alumniId()).isEqualTo(ALUMNI_ID);
        assertThat(req.getStatus()).isEqualTo(RequestStatus.ACCEPTED);
        assertThat(req.getRespondedAt()).isNotNull();

        ArgumentCaptor<MentorshipPair> pairCaptor = ArgumentCaptor.forClass(MentorshipPair.class);
        verify(pairRepository).save(pairCaptor.capture());
        assertThat(pairCaptor.getValue().getRequestId()).isEqualTo(req.getId());
    }

    @Test
    void declineStampsRequestAndCreatesNoPair() {
        MentorshipRequest req = pendingRequest();
        when(requestRepository.findByIdAndAlumniId(req.getId(), ALUMNI_ID)).thenReturn(Optional.of(req));
        when(requestRepository.save(any(MentorshipRequest.class))).thenAnswer(inv -> inv.getArgument(0));

        RequestResponse response = service.declineRequest(ALUMNI_ID, req.getId());

        assertThat(response.status()).isEqualTo(RequestStatus.DECLINED);
        verify(pairRepository, never()).save(any());
    }

    @Test
    void acceptRequestNotifiesStudent() {
        MentorshipRequest req = pendingRequest();
        when(requestRepository.findByIdAndAlumniId(req.getId(), ALUMNI_ID)).thenReturn(Optional.of(req));
        when(requestRepository.save(any(MentorshipRequest.class))).thenAnswer(inv -> inv.getArgument(0));
        when(pairRepository.save(any(MentorshipPair.class))).thenAnswer(inv -> inv.getArgument(0));

        service.acceptRequest(ALUMNI_ID, req.getId());

        verify(notificationClient).notify(
                eq(STUDENT_ID),
                eq("MENTORSHIP_REQUEST_ACCEPTED"),
                eq("Request accepted"),
                eq("Your mentorship request was accepted — you can start chatting now."));
    }

    @Test
    void declineRequestNotifiesStudent() {
        MentorshipRequest req = pendingRequest();
        when(requestRepository.findByIdAndAlumniId(req.getId(), ALUMNI_ID)).thenReturn(Optional.of(req));
        when(requestRepository.save(any(MentorshipRequest.class))).thenAnswer(inv -> inv.getArgument(0));

        service.declineRequest(ALUMNI_ID, req.getId());

        verify(notificationClient).notify(
                eq(STUDENT_ID),
                eq("MENTORSHIP_REQUEST_DECLINED"),
                eq("Request declined"),
                eq("Your mentorship request was declined. You can request another mentor anytime."));
    }

    @Test
    void acceptRequestNotificationFailureStillSucceeds() {
        MentorshipRequest req = pendingRequest();
        when(requestRepository.findByIdAndAlumniId(req.getId(), ALUMNI_ID)).thenReturn(Optional.of(req));
        when(requestRepository.save(any(MentorshipRequest.class))).thenAnswer(inv -> inv.getArgument(0));
        when(pairRepository.save(any(MentorshipPair.class))).thenAnswer(inv -> inv.getArgument(0));
        doThrow(new RuntimeException("down")).when(notificationClient).notify(any(), any(), any(), any());

        PairResponse response = service.acceptRequest(ALUMNI_ID, req.getId());

        assertThat(response.status()).isEqualTo(PairStatus.ACTIVE);
    }

    @Test
    void respondingToResolvedRequestThrows409() {
        MentorshipRequest req = pendingRequest();
        req.setStatus(RequestStatus.ACCEPTED);
        when(requestRepository.findByIdAndAlumniId(req.getId(), ALUMNI_ID)).thenReturn(Optional.of(req));

        assertThatThrownBy(() -> service.acceptRequest(ALUMNI_ID, req.getId()))
                .isInstanceOf(RequestAlreadyResolvedException.class);
        assertThatThrownBy(() -> service.declineRequest(ALUMNI_ID, req.getId()))
                .isInstanceOf(RequestAlreadyResolvedException.class);
    }

    @Test
    void respondingToOtherAlumnusRequestThrows404() {
        UUID requestId = UUID.randomUUID();
        when(requestRepository.findByIdAndAlumniId(requestId, ALUMNI_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.acceptRequest(ALUMNI_ID, requestId))
                .isInstanceOf(RequestNotFoundException.class);
    }

    // ── US5: messaging ─────────────────────────────────────────────────

    @Test
    void sendMessageOnActivePairSucceeds() {
        MentorshipPair pair = activePair();
        when(pairRepository.findByIdAndParticipant(pair.getId(), STUDENT_ID)).thenReturn(Optional.of(pair));
        when(messageRepository.save(any(Message.class))).thenAnswer(inv -> inv.getArgument(0));

        MessageResponse response = service.sendMessage(STUDENT_ID, pair.getId(), new SendMessageRequest("  hello  "));

        assertThat(response.body()).isEqualTo("hello");
        assertThat(response.readAt()).isNull();
        assertThat(response.senderId()).isEqualTo(STUDENT_ID);
    }

    @Test
    void sendMessageNotifiesCounterpart() {
        MentorshipPair pair = activePair();
        when(pairRepository.findByIdAndParticipant(pair.getId(), STUDENT_ID)).thenReturn(Optional.of(pair));
        when(messageRepository.save(any(Message.class))).thenAnswer(inv -> inv.getArgument(0));

        service.sendMessage(STUDENT_ID, pair.getId(), new SendMessageRequest("hello mentor"));

        verify(notificationClient).notify(
                eq(ALUMNI_ID),
                eq("MENTORSHIP_MESSAGE"),
                eq("New message"),
                eq("hello mentor"));
    }

    @Test
    void sendMessageNotifiesCounterpartWhenAlumniSends() {
        MentorshipPair pair = activePair();
        when(pairRepository.findByIdAndParticipant(pair.getId(), ALUMNI_ID)).thenReturn(Optional.of(pair));
        when(messageRepository.save(any(Message.class))).thenAnswer(inv -> inv.getArgument(0));

        service.sendMessage(ALUMNI_ID, pair.getId(), new SendMessageRequest("hello student"));

        verify(notificationClient).notify(
                eq(STUDENT_ID),
                eq("MENTORSHIP_MESSAGE"),
                eq("New message"),
                eq("hello student"));
    }

    @Test
    void sendMessageLongBodyIsPreviewed() {
        MentorshipPair pair = activePair();
        when(pairRepository.findByIdAndParticipant(pair.getId(), STUDENT_ID)).thenReturn(Optional.of(pair));
        when(messageRepository.save(any(Message.class))).thenAnswer(inv -> inv.getArgument(0));
        String body = "a".repeat(200);

        service.sendMessage(STUDENT_ID, pair.getId(), new SendMessageRequest(body));

        verify(notificationClient).notify(
                eq(ALUMNI_ID),
                eq("MENTORSHIP_MESSAGE"),
                eq("New message"),
                eq("a".repeat(120) + "…"));
    }

    @Test
    void sendMessageNotificationFailureStillSucceeds() {
        MentorshipPair pair = activePair();
        when(pairRepository.findByIdAndParticipant(pair.getId(), STUDENT_ID)).thenReturn(Optional.of(pair));
        when(messageRepository.save(any(Message.class))).thenAnswer(inv -> inv.getArgument(0));
        doThrow(new RuntimeException("down")).when(notificationClient).notify(any(), any(), any(), any());

        MessageResponse response = service.sendMessage(STUDENT_ID, pair.getId(), new SendMessageRequest("hello"));

        assertThat(response.body()).isEqualTo("hello");
    }

    @Test
    void sendMessageOnEndedPairThrows409() {
        MentorshipPair pair = activePair();
        pair.setStatus(PairStatus.ENDED);
        when(pairRepository.findByIdAndParticipant(pair.getId(), STUDENT_ID)).thenReturn(Optional.of(pair));

        assertThatThrownBy(() -> service.sendMessage(STUDENT_ID, pair.getId(), new SendMessageRequest("hi")))
                .isInstanceOf(PairEndedException.class);
    }

    @Test
    void getThreadMarksOnlyCounterpartUnreadMessagesRead() {
        MentorshipPair pair = activePair();
        Message fromStudentUnread = message(pair, STUDENT_ID, null);
        Instant alreadyRead = Instant.parse("2026-07-01T00:00:00Z");
        Message fromStudentRead = message(pair, STUDENT_ID, alreadyRead);
        Message ownMessage = message(pair, ALUMNI_ID, null);
        when(pairRepository.findByIdAndParticipant(pair.getId(), ALUMNI_ID)).thenReturn(Optional.of(pair));
        when(messageRepository.findByPairIdOrderBySentAtAsc(pair.getId()))
                .thenReturn(List.of(fromStudentUnread, fromStudentRead, ownMessage));

        ThreadResponse response = service.getThread(ALUMNI_ID, pair.getId());

        assertThat(fromStudentUnread.getReadAt()).isNotNull();
        assertThat(fromStudentRead.getReadAt()).isEqualTo(alreadyRead);
        assertThat(ownMessage.getReadAt()).isNull();
        assertThat(response.messages()).hasSize(3);
        assertThat(response.status()).isEqualTo(PairStatus.ACTIVE);
    }

    @Test
    void threadOnEndedPairIsStillReadable() {
        MentorshipPair pair = activePair();
        pair.setStatus(PairStatus.ENDED);
        when(pairRepository.findByIdAndParticipant(pair.getId(), STUDENT_ID)).thenReturn(Optional.of(pair));
        when(messageRepository.findByPairIdOrderBySentAtAsc(pair.getId())).thenReturn(List.of());

        assertThat(service.getThread(STUDENT_ID, pair.getId()).status()).isEqualTo(PairStatus.ENDED);
    }

    @Test
    void nonParticipantThreadAccessThrows404() {
        UUID outsider = UUID.randomUUID();
        UUID pairId = UUID.randomUUID();
        when(pairRepository.findByIdAndParticipant(pairId, outsider)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getThread(outsider, pairId))
                .isInstanceOf(PairNotFoundException.class);
        assertThatThrownBy(() -> service.sendMessage(outsider, pairId, new SendMessageRequest("hi")))
                .isInstanceOf(PairNotFoundException.class);
    }

    // ── US6: pairs ─────────────────────────────────────────────────────

    @Test
    void endActivePairSetsEndedAndTimestamp() {
        MentorshipPair pair = activePair();
        when(pairRepository.findByIdAndParticipant(pair.getId(), ALUMNI_ID)).thenReturn(Optional.of(pair));
        when(pairRepository.save(any(MentorshipPair.class))).thenAnswer(inv -> inv.getArgument(0));

        PairResponse response = service.endPair(ALUMNI_ID, pair.getId());

        assertThat(response.status()).isEqualTo(PairStatus.ENDED);
        assertThat(response.endedAt()).isNotNull();
    }

    @Test
    void endAlreadyEndedPairIsIdempotent() {
        MentorshipPair pair = activePair();
        pair.setStatus(PairStatus.ENDED);
        Instant endedAt = Instant.parse("2026-07-01T00:00:00Z");
        pair.setEndedAt(endedAt);
        when(pairRepository.findByIdAndParticipant(pair.getId(), STUDENT_ID)).thenReturn(Optional.of(pair));

        PairResponse response = service.endPair(STUDENT_ID, pair.getId());

        assertThat(response.status()).isEqualTo(PairStatus.ENDED);
        assertThat(response.endedAt()).isEqualTo(endedAt);
        verify(pairRepository, never()).save(any());
    }

    @Test
    void endingSomeoneElsesPairThrows404() {
        UUID pairId = UUID.randomUUID();
        when(pairRepository.findByIdAndParticipant(pairId, STUDENT_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.endPair(STUDENT_ID, pairId))
                .isInstanceOf(PairNotFoundException.class);
    }

    @Test
    void myPairsReturnsParticipantScopedList() {
        MentorshipPair pair = activePair();
        when(pairRepository.findAllByParticipant(STUDENT_ID)).thenReturn(List.of(pair));

        assertThat(service.getMyPairs(STUDENT_ID)).hasSize(1);
        assertThat(service.getMyPairs(STUDENT_ID).get(0).id()).isEqualTo(pair.getId());
    }

    @Test
    void myPairsIsEmptyForNonParticipant() {
        UUID outsider = UUID.randomUUID();
        when(pairRepository.findAllByParticipant(outsider)).thenReturn(List.of());

        assertThat(service.getMyPairs(outsider)).isEmpty();
    }

    // ── helpers ────────────────────────────────────────────────────────

    private MentorshipRequest pendingRequest() {
        MentorshipRequest req = new MentorshipRequest();
        req.setId(UUID.randomUUID());
        req.setStudentId(STUDENT_ID);
        req.setAlumniId(ALUMNI_ID);
        return req;
    }

    private MentorshipPair activePair() {
        MentorshipPair pair = new MentorshipPair();
        pair.setId(UUID.randomUUID());
        pair.setStudentId(STUDENT_ID);
        pair.setAlumniId(ALUMNI_ID);
        pair.setRequestId(UUID.randomUUID());
        return pair;
    }

    private Message message(MentorshipPair pair, UUID senderId, Instant readAt) {
        Message m = new Message();
        m.setId(UUID.randomUUID());
        m.setPair(pair);
        m.setSenderId(senderId);
        m.setBody("body");
        m.setReadAt(readAt);
        return m;
    }
}
