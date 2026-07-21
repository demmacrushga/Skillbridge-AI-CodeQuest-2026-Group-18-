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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NotificationServiceImplTest {

    @Mock NotificationRepository notificationRepository;
    @Mock PushTokenRepository pushTokenRepository;
    @Mock NotificationPreferenceRepository preferenceRepository;
    @Mock ExpoPushClient expoPushClient;

    NotificationServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new NotificationServiceImpl(notificationRepository, pushTokenRepository,
                preferenceRepository, expoPushClient);
    }

    @Test
    void getMyNotificationsReturnsNewest100() {
        UUID userId = UUID.randomUUID();
        Notification n = notification(userId, NotificationType.CHALLENGE_SCORED, "t", "b", false);
        when(notificationRepository.findTop100ByUserIdOrderByCreatedAtDesc(userId)).thenReturn(List.of(n));

        List<NotificationResponse> result = service.getMyNotifications(userId);
        assertThat(result).hasSize(1);
        assertThat(result.get(0).title()).isEqualTo("t");
    }

    @Test
    void getUnreadCountReturnsCount() {
        UUID userId = UUID.randomUUID();
        when(notificationRepository.countByUserIdAndReadFalse(userId)).thenReturn(5L);

        UnreadCountResponse result = service.getUnreadCount(userId);
        assertThat(result.unread()).isEqualTo(5);
    }

    @Test
    void markReadFlipsFlag() {
        UUID userId = UUID.randomUUID();
        UUID notifId = UUID.randomUUID();
        Notification n = notification(userId, NotificationType.CHALLENGE_SCORED, "t", "b", false);
        when(notificationRepository.findByIdAndUserId(notifId, userId)).thenReturn(Optional.of(n));
        when(notificationRepository.save(n)).thenReturn(n);

        NotificationResponse result = service.markRead(userId, notifId);
        assertThat(result.read()).isTrue();
    }

    @Test
    void markReadOnForeignIdThrowsNotFound() {
        UUID userId = UUID.randomUUID();
        UUID notifId = UUID.randomUUID();
        when(notificationRepository.findByIdAndUserId(notifId, userId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.markRead(userId, notifId))
                .isInstanceOf(NotificationNotFoundException.class);
    }

    @Test
    void markAllReadReturnsUpdatedCount() {
        UUID userId = UUID.randomUUID();
        when(notificationRepository.markAllReadByUserId(userId)).thenReturn(3);

        ReadAllResponse result = service.markAllRead(userId);
        assertThat(result.marked()).isEqualTo(3);
    }

    @Test
    void ingestNotificationPersistsAndAttemptsPush() {
        UUID userId = UUID.randomUUID();
        IngestNotificationRequest request = new IngestNotificationRequest(userId,
                NotificationType.CHALLENGE_SCORED, "Your submission was scored", "You scored 85.50");
        PushToken token = PushToken.builder().id(UUID.randomUUID()).userId(userId)
                .token("ExponentPushToken[abc]").active(true).registeredAt(Instant.now()).build();

        when(notificationRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        when(preferenceRepository.findByUserId(userId)).thenReturn(Optional.empty());
        when(pushTokenRepository.findByUserIdAndActiveTrue(userId)).thenReturn(List.of(token));

        NotificationResponse result = service.ingestNotification(request);
        assertThat(result.read()).isFalse();
        assertThat(result.title()).isEqualTo("Your submission was scored");

        ArgumentCaptor<List<PushToken>> captor = ArgumentCaptor.forClass(List.class);
        verify(expoPushClient).send(captor.capture(), any(), any());
        assertThat(captor.getValue()).hasSize(1);
    }

    @Test
    void ingestNotificationMutedTypeDoesNotPush() {
        UUID userId = UUID.randomUUID();
        IngestNotificationRequest request = new IngestNotificationRequest(userId,
                NotificationType.MENTORSHIP_MESSAGE, "New message", "Hello");
        NotificationPreference pref = NotificationPreference.builder()
                .id(UUID.randomUUID()).userId(userId).pushEnabled(true)
                .mutedTypes(Set.of(NotificationType.MENTORSHIP_MESSAGE)).updatedAt(Instant.now()).build();

        when(notificationRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        when(preferenceRepository.findByUserId(userId)).thenReturn(Optional.of(pref));

        service.ingestNotification(request);
        verify(expoPushClient, never()).send(any(), any(), any());
    }

    @Test
    void registerPushTokenCreatesNewToken() {
        UUID userId = UUID.randomUUID();
        when(pushTokenRepository.findByToken("ExponentPushToken[abc]")).thenReturn(Optional.empty());
        when(pushTokenRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        PushTokenResponse result = service.registerPushToken(userId, "ExponentPushToken[abc]");
        assertThat(result.token()).isEqualTo("ExponentPushToken[abc]");
        assertThat(result.active()).isTrue();
    }

    @Test
    void registerPushTokenReassignsExistingToken() {
        UUID userId = UUID.randomUUID();
        UUID otherUser = UUID.randomUUID();
        PushToken existing = PushToken.builder().id(UUID.randomUUID()).userId(otherUser)
                .token("ExponentPushToken[abc]").active(false).registeredAt(Instant.now()).build();
        when(pushTokenRepository.findByToken("ExponentPushToken[abc]")).thenReturn(Optional.of(existing));
        when(pushTokenRepository.save(existing)).thenReturn(existing);

        PushTokenResponse result = service.registerPushToken(userId, "ExponentPushToken[abc]");
        assertThat(result.token()).isEqualTo("ExponentPushToken[abc]");
        assertThat(result.active()).isTrue();
        assertThat(existing.getUserId()).isEqualTo(userId);
    }

    @Test
    void deregisterPushTokenDeletesByTokenAndUserId() {
        UUID userId = UUID.randomUUID();
        service.deregisterPushToken(userId, "ExponentPushToken[abc]");
        verify(pushTokenRepository).deleteByTokenAndUserId("ExponentPushToken[abc]", userId);
    }

    @Test
    void getPreferencesReturnsDefaultsWhenAbsent() {
        UUID userId = UUID.randomUUID();
        when(preferenceRepository.findByUserId(userId)).thenReturn(Optional.empty());

        PreferencesResponse result = service.getPreferences(userId);
        assertThat(result.pushEnabled()).isTrue();
        assertThat(result.mutedTypes()).isEmpty();
    }

    @Test
    void updatePreferencesReplacesValues() {
        UUID userId = UUID.randomUUID();
        NotificationPreference pref = NotificationPreference.defaults(userId);
        when(preferenceRepository.findByUserId(userId)).thenReturn(Optional.of(pref));
        when(preferenceRepository.save(pref)).thenReturn(pref);

        PreferencesResponse result = service.updatePreferences(userId,
                new UpdatePreferencesRequest(false, Set.of(NotificationType.OPPORTUNITY_MATCH)));
        assertThat(result.pushEnabled()).isFalse();
        assertThat(result.mutedTypes()).containsExactly(NotificationType.OPPORTUNITY_MATCH);
    }

    private Notification notification(UUID userId, NotificationType type, String title, String body, boolean read) {
        return Notification.builder()
                .id(UUID.randomUUID()).userId(userId).type(type).title(title).body(body)
                .read(read).createdAt(Instant.now()).build();
    }
}
