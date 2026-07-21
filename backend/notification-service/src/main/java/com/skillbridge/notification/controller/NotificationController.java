package com.skillbridge.notification.controller;

import com.skillbridge.notification.dto.request.DeletePushTokenRequest;
import com.skillbridge.notification.dto.request.RegisterPushTokenRequest;
import com.skillbridge.notification.dto.request.UpdatePreferencesRequest;
import com.skillbridge.notification.dto.response.NotificationResponse;
import com.skillbridge.notification.dto.response.PreferencesResponse;
import com.skillbridge.notification.dto.response.PushTokenResponse;
import com.skillbridge.notification.dto.response.ReadAllResponse;
import com.skillbridge.notification.dto.response.UnreadCountResponse;
import com.skillbridge.notification.security.JwtUserDetails;
import com.skillbridge.notification.service.NotificationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/notification")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;

    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        return ResponseEntity.ok(Map.of("status", "UP"));
    }

    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<NotificationResponse>> getMyNotifications(@AuthenticationPrincipal JwtUserDetails user) {
        return ResponseEntity.ok(notificationService.getMyNotifications(user.userId()));
    }

    @GetMapping("/unread-count")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<UnreadCountResponse> getUnreadCount(@AuthenticationPrincipal JwtUserDetails user) {
        return ResponseEntity.ok(notificationService.getUnreadCount(user.userId()));
    }

    @PostMapping("/{notificationId}/read")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<NotificationResponse> markRead(
            @PathVariable UUID notificationId,
            @AuthenticationPrincipal JwtUserDetails user) {
        return ResponseEntity.ok(notificationService.markRead(user.userId(), notificationId));
    }

    @PostMapping("/read-all")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ReadAllResponse> markAllRead(@AuthenticationPrincipal JwtUserDetails user) {
        return ResponseEntity.ok(notificationService.markAllRead(user.userId()));
    }

    @PostMapping("/push-tokens")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<PushTokenResponse> registerPushToken(
            @Valid @RequestBody RegisterPushTokenRequest request,
            @AuthenticationPrincipal JwtUserDetails user) {
        PushTokenResponse response = notificationService.registerPushToken(user.userId(), request.token());
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @DeleteMapping("/push-tokens")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Void> deregisterPushToken(
            @Valid @RequestBody DeletePushTokenRequest request,
            @AuthenticationPrincipal JwtUserDetails user) {
        notificationService.deregisterPushToken(user.userId(), request.token());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/preferences")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<PreferencesResponse> getPreferences(@AuthenticationPrincipal JwtUserDetails user) {
        return ResponseEntity.ok(notificationService.getPreferences(user.userId()));
    }

    @PutMapping("/preferences")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<PreferencesResponse> updatePreferences(
            @Valid @RequestBody UpdatePreferencesRequest request,
            @AuthenticationPrincipal JwtUserDetails user) {
        return ResponseEntity.ok(notificationService.updatePreferences(user.userId(), request));
    }
}
