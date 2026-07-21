package com.skillbridge.mentorship.service;

import com.skillbridge.mentorship.client.NotificationClient;
import com.skillbridge.mentorship.dto.request.SendMessageRequest;
import com.skillbridge.mentorship.dto.request.SendRequestRequest;
import com.skillbridge.mentorship.dto.request.UpsertProfileRequest;
import com.skillbridge.mentorship.dto.response.AlumniSearchResponse;
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
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class MentorshipServiceImpl implements MentorshipService {

    private final com.skillbridge.mentorship.repository.AlumniProfileRepository profileRepository;
    private final com.skillbridge.mentorship.repository.MentorshipRequestRepository requestRepository;
    private final com.skillbridge.mentorship.repository.MentorshipPairRepository pairRepository;
    private final com.skillbridge.mentorship.repository.MessageRepository messageRepository;
    private final AlumniSearchService searchService;
    private final NotificationClient notificationClient;

    // ── US1: Alumni profile ─────────────────────────────────────────────

    @Override
    @Transactional(readOnly = true)
    public ProfileResponse getProfile(UUID userId) {
        AlumniProfile profile = profileRepository.findByUserId(userId)
                .orElseThrow(() -> new ProfileNotFoundException("Profile not found"));
        return toProfileResponse(profile);
    }

    @Override
    @Transactional
    public ProfileResponse upsertProfile(UUID userId, UpsertProfileRequest request) {
        AlumniProfile profile = profileRepository.findByUserId(userId)
                .orElseGet(() -> {
                    AlumniProfile p = new AlumniProfile();
                    p.setUserId(userId);
                    return p;
                });

        profile.setCurrentRole(trimToNull(request.currentRole()));
        profile.setCompany(trimToNull(request.company()));
        profile.setIndustry(trimToNull(request.industry()));
        profile.setCareerInterests(normalizeTags(request.careerInterests()));
        profile.setBio(trimToNull(request.bio()));
        profile.setAvailable(request.available());
        profile.setUpdatedAt(Instant.now());

        return toProfileResponse(profileRepository.save(profile));
    }

    // ── US2: Alumni discovery ───────────────────────────────────────────

    @Override
    @Transactional(readOnly = true)
    public AlumniSearchResponse searchAlumni(List<String> interests, String industry) {
        return new AlumniSearchResponse(
                searchService.search(profileRepository.findByAvailableTrue(), interests, industry));
    }

    // ── US3: Mentorship requests (student side) ─────────────────────────

    @Override
    @Transactional
    public RequestResponse sendRequest(UUID studentId, SendRequestRequest request) {
        AlumniProfile target = profileRepository.findByUserId(request.alumniId())
                .filter(AlumniProfile::isAvailable)
                .orElseThrow(() -> new RequestNotFoundException("Alumni profile not found"));

        if (requestRepository.existsByStudentIdAndAlumniIdAndStatus(studentId, target.getUserId(), RequestStatus.PENDING)) {
            throw new DuplicateRequestException("A pending request to this alumnus already exists");
        }
        if (pairRepository.existsByStudentIdAndAlumniIdAndStatus(studentId, target.getUserId(), PairStatus.ACTIVE)) {
            throw new DuplicateRequestException("An active mentorship with this alumnus already exists");
        }

        MentorshipRequest req = new MentorshipRequest();
        req.setStudentId(studentId);
        req.setAlumniId(target.getUserId());
        req.setMessage(trimToNull(request.message()));

        MentorshipRequest saved;
        try {
            saved = requestRepository.saveAndFlush(req);
        } catch (DataIntegrityViolationException e) {
            // race backstop: partial unique index on (student_id, alumni_id) WHERE PENDING
            throw new DuplicateRequestException("A pending request to this alumnus already exists");
        }

        try {
            notificationClient.notify(
                    saved.getAlumniId(),
                    "MENTORSHIP_REQUEST_RECEIVED",
                    "New mentorship request",
                    "A student has requested your mentorship.");
        } catch (Exception e) {
            log.warn("Failed to send mentorship request notification: {}", e.getMessage());
        }

        return toRequestResponse(saved);
    }

    @Override
    @Transactional
    public RequestResponse cancelRequest(UUID studentId, UUID requestId) {
        MentorshipRequest req = requestRepository.findByIdAndStudentId(requestId, studentId)
                .orElseThrow(() -> new RequestNotFoundException("Request not found"));
        if (req.getStatus() != RequestStatus.PENDING) {
            throw new RequestAlreadyResolvedException("Request has already been resolved");
        }
        req.setStatus(RequestStatus.CANCELLED);
        req.setRespondedAt(Instant.now());
        return toRequestResponse(requestRepository.save(req));
    }

    @Override
    @Transactional(readOnly = true)
    public List<RequestResponse> getMyRequests(UUID studentId) {
        return requestRepository.findByStudentIdOrderByCreatedAtDesc(studentId).stream()
                .map(this::toRequestResponse)
                .toList();
    }

    // ── US4: Responding (alumni side) ───────────────────────────────────

    @Override
    @Transactional(readOnly = true)
    public List<RequestResponse> getIncomingRequests(UUID alumniId) {
        return requestRepository.findByAlumniIdAndStatusOrderByCreatedAtDesc(alumniId, RequestStatus.PENDING).stream()
                .map(this::toRequestResponse)
                .toList();
    }

    @Override
    @Transactional
    public PairResponse acceptRequest(UUID alumniId, UUID requestId) {
        MentorshipRequest req = findOwnedPendingRequest(alumniId, requestId);
        req.setStatus(RequestStatus.ACCEPTED);
        req.setRespondedAt(Instant.now());
        requestRepository.save(req);

        MentorshipPair pair = new MentorshipPair();
        pair.setStudentId(req.getStudentId());
        pair.setAlumniId(req.getAlumniId());
        pair.setRequestId(req.getId());
        MentorshipPair saved = pairRepository.save(pair);
        try {
            notificationClient.notify(
                    req.getStudentId(),
                    "MENTORSHIP_REQUEST_ACCEPTED",
                    "Request accepted",
                    "Your mentorship request was accepted — you can start chatting now.");
        } catch (Exception e) {
            log.warn("Failed to send mentorship accepted notification: {}", e.getMessage());
        }
        return toPairResponse(saved);
    }

    @Override
    @Transactional
    public RequestResponse declineRequest(UUID alumniId, UUID requestId) {
        MentorshipRequest req = findOwnedPendingRequest(alumniId, requestId);
        req.setStatus(RequestStatus.DECLINED);
        req.setRespondedAt(Instant.now());
        MentorshipRequest saved = requestRepository.save(req);
        try {
            notificationClient.notify(
                    req.getStudentId(),
                    "MENTORSHIP_REQUEST_DECLINED",
                    "Request declined",
                    "Your mentorship request was declined. You can request another mentor anytime.");
        } catch (Exception e) {
            log.warn("Failed to send mentorship declined notification: {}", e.getMessage());
        }
        return toRequestResponse(saved);
    }

    private MentorshipRequest findOwnedPendingRequest(UUID alumniId, UUID requestId) {
        MentorshipRequest req = requestRepository.findByIdAndAlumniId(requestId, alumniId)
                .orElseThrow(() -> new RequestNotFoundException("Request not found"));
        if (req.getStatus() != RequestStatus.PENDING) {
            throw new RequestAlreadyResolvedException("Request has already been resolved");
        }
        return req;
    }

    // ── US6: Pairs ──────────────────────────────────────────────────────

    @Override
    @Transactional(readOnly = true)
    public List<PairResponse> getMyPairs(UUID userId) {
        return pairRepository.findAllByParticipant(userId).stream()
                .map(this::toPairResponse)
                .toList();
    }

    @Override
    @Transactional
    public PairResponse endPair(UUID userId, UUID pairId) {
        MentorshipPair pair = findParticipantPair(userId, pairId);
        if (pair.getStatus() == PairStatus.ACTIVE) {
            pair.setStatus(PairStatus.ENDED);
            pair.setEndedAt(Instant.now());
            pair = pairRepository.save(pair);
        }
        return toPairResponse(pair);
    }

    // ── US5: Messaging ──────────────────────────────────────────────────

    @Override
    @Transactional
    public ThreadResponse getThread(UUID userId, UUID pairId) {
        MentorshipPair pair = findParticipantPair(userId, pairId);
        List<Message> messages = messageRepository.findByPairIdOrderBySentAtAsc(pair.getId());

        Instant now = Instant.now();
        for (Message m : messages) {
            if (m.getReadAt() == null && !m.getSenderId().equals(userId)) {
                m.setReadAt(now);
            }
        }
        messageRepository.saveAll(messages);

        return new ThreadResponse(pair.getId(), pair.getStatus(),
                messages.stream().map(this::toMessageResponse).toList());
    }

    @Override
    @Transactional
    public MessageResponse sendMessage(UUID userId, UUID pairId, SendMessageRequest request) {
        MentorshipPair pair = findParticipantPair(userId, pairId);
        if (pair.getStatus() != PairStatus.ACTIVE) {
            throw new PairEndedException("This mentorship has ended — the thread is read-only");
        }
        Message message = new Message();
        message.setPair(pair);
        message.setSenderId(userId);
        message.setBody(request.body().trim());
        Message saved = messageRepository.save(message);

        UUID recipientId = pair.getStudentId().equals(userId) ? pair.getAlumniId() : pair.getStudentId();
        try {
            notificationClient.notify(
                    recipientId,
                    "MENTORSHIP_MESSAGE",
                    "New message",
                    preview(saved.getBody()));
        } catch (Exception e) {
            log.warn("Failed to send mentorship message notification: {}", e.getMessage());
        }

        return toMessageResponse(saved);
    }

    private String preview(String body) {
        if (body == null || body.length() <= 120) {
            return body;
        }
        return body.substring(0, 120) + "…";
    }

    private MentorshipPair findParticipantPair(UUID userId, UUID pairId) {
        return pairRepository.findByIdAndParticipant(pairId, userId)
                .orElseThrow(() -> new PairNotFoundException("Mentorship not found"));
    }

    // ── Mapping & normalization ─────────────────────────────────────────

    /**
     * Trim, collapse internal whitespace, dedupe case-insensitively keeping
     * the first occurrence's casing (same treatment as matching-service skills).
     */
    static List<String> normalizeTags(List<String> tags) {
        Map<String, String> byKey = new LinkedHashMap<>();
        for (String tag : tags) {
            String cleaned = tag.trim().replaceAll("\\s+", " ");
            if (cleaned.isEmpty()) {
                continue;
            }
            byKey.putIfAbsent(cleaned.toLowerCase(java.util.Locale.ROOT), cleaned);
        }
        return List.copyOf(byKey.values());
    }

    private static String trimToNull(String s) {
        if (s == null) {
            return null;
        }
        String trimmed = s.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private ProfileResponse toProfileResponse(AlumniProfile p) {
        return new ProfileResponse(p.getId(), p.getUserId(), p.getCurrentRole(), p.getCompany(),
                p.getIndustry(), p.getCareerInterests(), p.getBio(), p.isAvailable(), p.getUpdatedAt());
    }

    private RequestResponse toRequestResponse(MentorshipRequest r) {
        return new RequestResponse(r.getId(), r.getStudentId(), r.getAlumniId(), r.getMessage(),
                r.getStatus(), r.getCreatedAt(), r.getRespondedAt());
    }

    private PairResponse toPairResponse(MentorshipPair p) {
        return new PairResponse(p.getId(), p.getStudentId(), p.getAlumniId(), p.getStatus(),
                p.getStartedAt(), p.getEndedAt());
    }

    private MessageResponse toMessageResponse(Message m) {
        return new MessageResponse(m.getId(), m.getPair().getId(), m.getSenderId(), m.getBody(),
                m.getSentAt(), m.getReadAt());
    }
}
