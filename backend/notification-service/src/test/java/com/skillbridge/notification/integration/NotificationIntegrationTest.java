package com.skillbridge.notification.integration;

import com.skillbridge.notification.dto.request.IngestNotificationRequest;
import com.skillbridge.notification.dto.request.RegisterPushTokenRequest;
import com.skillbridge.notification.dto.request.UpdatePreferencesRequest;
import com.skillbridge.notification.dto.response.NotificationResponse;
import com.skillbridge.notification.dto.response.PreferencesResponse;
import com.skillbridge.notification.dto.response.PushTokenResponse;
import com.skillbridge.notification.entity.NotificationType;
import com.skillbridge.notification.repository.NotificationRepository;
import com.skillbridge.notification.repository.PushTokenRepository;
import com.skillbridge.notification.service.NotificationService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest(properties = {
        "jwt.secret=dGVzdC1zZWNyZXQtZm9yLWludGVncmF0aW9uLXRlc3RzLW1pbi0zMi1ieXRlcy1sb25n",
        "notification.internal-token=valid-internal-token",
        "expo.push-url=http://localhost:9/unreachable"
})
class NotificationIntegrationTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @Autowired NotificationService service;
    @Autowired NotificationRepository notificationRepository;
    @Autowired PushTokenRepository pushTokenRepository;

    @Test
    void ingestNotificationPersistsUnread() {
        UUID userId = UUID.randomUUID();
        IngestNotificationRequest request = new IngestNotificationRequest(userId,
                NotificationType.CHALLENGE_SCORED, "Your submission was scored", "You scored 85.50");

        NotificationResponse response = service.ingestNotification(request);
        assertThat(response.read()).isFalse();

        assertThat(service.getMyNotifications(userId)).hasSize(1);
        assertThat(service.getUnreadCount(userId).unread()).isEqualTo(1);
    }

    @Test
    void markReadAndReadAll() {
        UUID userId = UUID.randomUUID();
        service.ingestNotification(new IngestNotificationRequest(userId,
                NotificationType.CHALLENGE_SCORED, "t1", "b1"));
        service.ingestNotification(new IngestNotificationRequest(userId,
                NotificationType.CHALLENGE_SCORED, "t2", "b2"));

        NotificationResponse first = service.getMyNotifications(userId).get(0);
        service.markRead(userId, first.id());
        assertThat(service.getUnreadCount(userId).unread()).isEqualTo(1);

        service.markAllRead(userId);
        assertThat(service.getUnreadCount(userId).unread()).isEqualTo(0);
    }

    @Test
    void pushTokenReassignsAcrossUsers() {
        String token = "ExponentPushToken[shared]";
        UUID userA = UUID.randomUUID();
        UUID userB = UUID.randomUUID();

        PushTokenResponse first = service.registerPushToken(userA, token);
        assertThat(first.active()).isTrue();
        assertThat(pushTokenRepository.findByToken(token)).isPresent();

        PushTokenResponse second = service.registerPushToken(userB, token);
        assertThat(second.active()).isTrue();
        assertThat(pushTokenRepository.findByToken(token).orElseThrow().getUserId()).isEqualTo(userB);

        service.deregisterPushToken(userB, token);
        assertThat(pushTokenRepository.findByToken(token)).isEmpty();
    }

    @Test
    void preferencesFullReplace() {
        UUID userId = UUID.randomUUID();
        PreferencesResponse defaults = service.getPreferences(userId);
        assertThat(defaults.pushEnabled()).isTrue();
        assertThat(defaults.mutedTypes()).isEmpty();

        PreferencesResponse updated = service.updatePreferences(userId,
                new UpdatePreferencesRequest(false, Set.of(NotificationType.MENTORSHIP_MESSAGE)));
        assertThat(updated.pushEnabled()).isFalse();
        assertThat(updated.mutedTypes()).containsExactly(NotificationType.MENTORSHIP_MESSAGE);

        assertThat(service.getPreferences(userId).mutedTypes()).containsExactly(NotificationType.MENTORSHIP_MESSAGE);
    }

    @Test
    void mutedTypeSkipsPushButStillStoresNotification() {
        UUID userId = UUID.randomUUID();
        service.updatePreferences(userId,
                new UpdatePreferencesRequest(true, Set.of(NotificationType.MENTORSHIP_MESSAGE)));
        service.registerPushToken(userId, "ExponentPushToken[muted-test]");

        NotificationResponse response = service.ingestNotification(new IngestNotificationRequest(userId,
                NotificationType.MENTORSHIP_MESSAGE, "New message", "Hello"));

        assertThat(response.read()).isFalse();
        assertThat(service.getUnreadCount(userId).unread()).isEqualTo(1);
    }

    @Test
    void listCappedAt100ButCountCoversAll() {
        UUID userId = UUID.randomUUID();
        for (int i = 0; i < 105; i++) {
            service.ingestNotification(new IngestNotificationRequest(userId,
                    NotificationType.CHALLENGE_SCORED, "t" + i, "b" + i));
        }

        List<NotificationResponse> list = service.getMyNotifications(userId);
        assertThat(list).hasSize(100);
        assertThat(service.getUnreadCount(userId).unread()).isEqualTo(105);
    }
}
