package com.skillbridge.notification.controller;

import com.skillbridge.notification.dto.request.IngestNotificationRequest;
import com.skillbridge.notification.dto.response.NotificationResponse;
import com.skillbridge.notification.entity.NotificationType;
import com.skillbridge.notification.service.NotificationService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class InternalNotificationControllerUnitTest {

    @Mock NotificationService notificationService;
    @InjectMocks InternalNotificationController controller;

    private static final Instant NOW = Instant.now();

    @Test
    void ingestNotificationReturnsCreated() {
        UUID userId = UUID.randomUUID();
        NotificationResponse response = new NotificationResponse(UUID.randomUUID(),
                NotificationType.CHALLENGE_SCORED, "Your submission was scored", "You scored 85.50", false, NOW);
        when(notificationService.ingestNotification(any(IngestNotificationRequest.class))).thenReturn(response);

        ResponseEntity<NotificationResponse> result = controller.ingestNotification(
                new IngestNotificationRequest(userId, NotificationType.CHALLENGE_SCORED,
                        "Your submission was scored", "You scored 85.50"));

        assertThat(result.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(result.getBody().type()).isEqualTo(NotificationType.CHALLENGE_SCORED);
    }
}
