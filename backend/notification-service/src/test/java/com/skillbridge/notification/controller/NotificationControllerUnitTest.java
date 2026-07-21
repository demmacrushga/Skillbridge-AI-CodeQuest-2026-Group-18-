package com.skillbridge.notification.controller;

import com.skillbridge.notification.dto.request.DeletePushTokenRequest;
import com.skillbridge.notification.dto.request.RegisterPushTokenRequest;
import com.skillbridge.notification.dto.request.UpdatePreferencesRequest;
import com.skillbridge.notification.dto.response.NotificationResponse;
import com.skillbridge.notification.dto.response.PreferencesResponse;
import com.skillbridge.notification.dto.response.PushTokenResponse;
import com.skillbridge.notification.dto.response.ReadAllResponse;
import com.skillbridge.notification.dto.response.UnreadCountResponse;
import com.skillbridge.notification.entity.NotificationType;
import com.skillbridge.notification.security.JwtUserDetails;
import com.skillbridge.notification.service.NotificationService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NotificationControllerUnitTest {

    @Mock NotificationService notificationService;
    @InjectMocks NotificationController controller;

    private static final UUID USER_ID = UUID.randomUUID();
    private static final JwtUserDetails USER = new JwtUserDetails(USER_ID, "user@knust.edu.gh", "STUDENT");
    private static final Instant NOW = Instant.now();

    @Test
    void healthReturnsUp() {
        ResponseEntity<java.util.Map<String, String>> response = controller.health();
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).containsEntry("status", "UP");
    }

    @Test
    void getMyNotificationsDelegatesToService() {
        when(notificationService.getMyNotifications(USER_ID)).thenReturn(List.of());
        ResponseEntity<List<NotificationResponse>> response = controller.getMyNotifications(USER);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    void getUnreadCountDelegatesToService() {
        when(notificationService.getUnreadCount(USER_ID)).thenReturn(new UnreadCountResponse(5));
        ResponseEntity<UnreadCountResponse> response = controller.getUnreadCount(USER);
        assertThat(response.getBody().unread()).isEqualTo(5);
    }

    @Test
    void markReadDelegatesToService() {
        UUID notifId = UUID.randomUUID();
        when(notificationService.markRead(USER_ID, notifId)).thenReturn(
                new NotificationResponse(notifId, NotificationType.CHALLENGE_SCORED, "t", "b", true, NOW));
        ResponseEntity<NotificationResponse> response = controller.markRead(notifId, USER);
        assertThat(response.getBody().read()).isTrue();
    }

    @Test
    void markAllReadDelegatesToService() {
        when(notificationService.markAllRead(USER_ID)).thenReturn(new ReadAllResponse(3));
        ResponseEntity<ReadAllResponse> response = controller.markAllRead(USER);
        assertThat(response.getBody().marked()).isEqualTo(3);
    }

    @Test
    void registerPushTokenReturnsCreated() {
        when(notificationService.registerPushToken(USER_ID, "ExponentPushToken[abc]"))
                .thenReturn(new PushTokenResponse("ExponentPushToken[abc]", true, NOW));
        ResponseEntity<PushTokenResponse> response = controller.registerPushToken(
                new RegisterPushTokenRequest("ExponentPushToken[abc]"), USER);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
    }

    @Test
    void deregisterPushTokenReturnsNoContent() {
        ResponseEntity<Void> response = controller.deregisterPushToken(
                new DeletePushTokenRequest("ExponentPushToken[abc]"), USER);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        verify(notificationService).deregisterPushToken(USER_ID, "ExponentPushToken[abc]");
    }

    @Test
    void getPreferencesDelegatesToService() {
        when(notificationService.getPreferences(USER_ID)).thenReturn(
                new PreferencesResponse(true, Set.of(NotificationType.MENTORSHIP_MESSAGE)));
        ResponseEntity<PreferencesResponse> response = controller.getPreferences(USER);
        assertThat(response.getBody().pushEnabled()).isTrue();
    }

    @Test
    void updatePreferencesDelegatesToService() {
        when(notificationService.updatePreferences(eq(USER_ID), any(UpdatePreferencesRequest.class)))
                .thenReturn(new PreferencesResponse(false, Set.of()));
        ResponseEntity<PreferencesResponse> response = controller.updatePreferences(
                new UpdatePreferencesRequest(false, Set.of()), USER);
        assertThat(response.getBody().pushEnabled()).isFalse();
    }
}
