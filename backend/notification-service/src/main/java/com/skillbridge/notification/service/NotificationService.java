package com.skillbridge.notification.service;

import com.skillbridge.notification.dto.request.IngestNotificationRequest;
import com.skillbridge.notification.dto.request.UpdatePreferencesRequest;
import com.skillbridge.notification.dto.response.NotificationResponse;
import com.skillbridge.notification.dto.response.PreferencesResponse;
import com.skillbridge.notification.dto.response.PushTokenResponse;
import com.skillbridge.notification.dto.response.ReadAllResponse;
import com.skillbridge.notification.dto.response.UnreadCountResponse;

import java.util.List;
import java.util.UUID;

public interface NotificationService {

    List<NotificationResponse> getMyNotifications(UUID userId);

    UnreadCountResponse getUnreadCount(UUID userId);

    NotificationResponse markRead(UUID userId, UUID notificationId);

    ReadAllResponse markAllRead(UUID userId);

    NotificationResponse ingestNotification(IngestNotificationRequest request);

    PushTokenResponse registerPushToken(UUID userId, String token);

    void deregisterPushToken(UUID userId, String token);

    PreferencesResponse getPreferences(UUID userId);

    PreferencesResponse updatePreferences(UUID userId, UpdatePreferencesRequest request);
}
