package com.skillbridge.notification.service;

import com.skillbridge.notification.dto.request.IngestNotificationRequest;
import com.skillbridge.notification.dto.request.UpdatePreferencesRequest;
import com.skillbridge.notification.dto.response.NotificationResponse;
import com.skillbridge.notification.dto.response.PreferencesResponse;
import com.skillbridge.notification.dto.response.PushTokenResponse;
import com.skillbridge.notification.dto.response.ReadAllResponse;
import com.skillbridge.notification.dto.response.UnreadCountResponse;
import com.skillbridge.notification.entity.Notification;
import com.skillbridge.notification.entity.NotificationPreference;
import com.skillbridge.notification.entity.NotificationType;
import com.skillbridge.notification.entity.PushToken;
import com.skillbridge.notification.exception.NotificationNotFoundException;
import com.skillbridge.notification.repository.NotificationPreferenceRepository;
import com.skillbridge.notification.repository.NotificationRepository;
import com.skillbridge.notification.repository.PushTokenRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@Service
public class NotificationServiceImpl implements NotificationService {

    private static final Logger log = LoggerFactory.getLogger(NotificationServiceImpl.class);

    private final NotificationRepository notificationRepository;
    private final PushTokenRepository pushTokenRepository;
    private final NotificationPreferenceRepository preferenceRepository;
    private final ExpoPushClient expoPushClient;

    public NotificationServiceImpl(NotificationRepository notificationRepository,
                                   PushTokenRepository pushTokenRepository,
                                   NotificationPreferenceRepository preferenceRepository,
                                   ExpoPushClient expoPushClient) {
        this.notificationRepository = notificationRepository;
        this.pushTokenRepository = pushTokenRepository;
        this.preferenceRepository = preferenceRepository;
        this.expoPushClient = expoPushClient;
    }

    @Override
    @Transactional(readOnly = true)
    public List<NotificationResponse> getMyNotifications(UUID userId) {
        return notificationRepository.findTop100ByUserIdOrderByCreatedAtDesc(userId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public UnreadCountResponse getUnreadCount(UUID userId) {
        return new UnreadCountResponse(notificationRepository.countByUserIdAndReadFalse(userId));
    }

    @Override
    @Transactional
    public NotificationResponse markRead(UUID userId, UUID notificationId) {
        Notification notification = notificationRepository.findByIdAndUserId(notificationId, userId)
                .orElseThrow(() -> new NotificationNotFoundException("Notification not found"));
        notification.setRead(true);
        return toResponse(notificationRepository.save(notification));
    }

    @Override
    @Transactional
    public ReadAllResponse markAllRead(UUID userId) {
        return new ReadAllResponse(notificationRepository.markAllReadByUserId(userId));
    }

    @Override
    @Transactional
    public NotificationResponse ingestNotification(IngestNotificationRequest request) {
        Notification notification = Notification.builder()
                .id(UUID.randomUUID())
                .userId(request.userId())
                .type(request.type())
                .title(request.title())
                .body(request.body())
                .read(false)
                .createdAt(Instant.now())
                .build();
        Notification saved = notificationRepository.save(notification);

        if (isPushEligible(request.userId(), request.type())) {
            List<PushToken> activeTokens = pushTokenRepository.findByUserIdAndActiveTrue(request.userId());
            if (!activeTokens.isEmpty()) {
                try {
                    expoPushClient.send(activeTokens, request.title(), request.body());
                } catch (Exception e) {
                    log.warn("Push delivery failed for notification id={}: {}", saved.getId(), e.getMessage());
                }
            }
        }

        return toResponse(saved);
    }

    @Override
    @Transactional
    public PushTokenResponse registerPushToken(UUID userId, String token) {
        Optional<PushToken> existing = pushTokenRepository.findByToken(token);
        if (existing.isPresent()) {
            PushToken pushToken = existing.get();
            pushToken.setUserId(userId);
            pushToken.setActive(true);
            pushToken.setRegisteredAt(Instant.now());
            return toResponse(pushTokenRepository.save(pushToken));
        }

        PushToken newToken = PushToken.builder()
                .id(UUID.randomUUID())
                .userId(userId)
                .token(token)
                .active(true)
                .registeredAt(Instant.now())
                .build();
        return toResponse(pushTokenRepository.save(newToken));
    }

    @Override
    @Transactional
    public void deregisterPushToken(UUID userId, String token) {
        pushTokenRepository.deleteByTokenAndUserId(token, userId);
    }

    @Override
    @Transactional(readOnly = true)
    public PreferencesResponse getPreferences(UUID userId) {
        return preferenceRepository.findByUserId(userId)
                .map(this::toResponse)
                .orElseGet(() -> new PreferencesResponse(true, new HashSet<>()));
    }

    @Override
    @Transactional
    public PreferencesResponse updatePreferences(UUID userId, UpdatePreferencesRequest request) {
        NotificationPreference preference = preferenceRepository.findByUserId(userId)
                .orElseGet(() -> NotificationPreference.defaults(userId));
        preference.setPushEnabled(request.pushEnabled());
        preference.setMutedTypes(new HashSet<>(request.mutedTypes()));
        return toResponse(preferenceRepository.save(preference));
    }

    private boolean isPushEligible(UUID userId, NotificationType type) {
        PreferencesResponse prefs = getPreferences(userId);
        if (!prefs.pushEnabled()) {
            return false;
        }
        if (prefs.mutedTypes() != null && prefs.mutedTypes().contains(type)) {
            return false;
        }
        return true;
    }

    private NotificationResponse toResponse(Notification notification) {
        return new NotificationResponse(
                notification.getId(),
                notification.getType(),
                notification.getTitle(),
                notification.getBody(),
                notification.isRead(),
                notification.getCreatedAt()
        );
    }

    private PushTokenResponse toResponse(PushToken token) {
        return new PushTokenResponse(
                token.getToken(),
                token.isActive(),
                token.getRegisteredAt()
        );
    }

    private PreferencesResponse toResponse(NotificationPreference preference) {
        return new PreferencesResponse(
                preference.isPushEnabled(),
                preference.getMutedTypes() != null ? preference.getMutedTypes() : new HashSet<>()
        );
    }
}
