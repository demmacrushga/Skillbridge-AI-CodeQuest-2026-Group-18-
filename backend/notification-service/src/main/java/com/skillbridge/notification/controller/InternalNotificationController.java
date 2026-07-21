package com.skillbridge.notification.controller;

import com.skillbridge.notification.dto.request.IngestNotificationRequest;
import com.skillbridge.notification.dto.response.NotificationResponse;
import com.skillbridge.notification.service.NotificationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/notification/internal")
@RequiredArgsConstructor
public class InternalNotificationController {

    private final NotificationService notificationService;

    @PostMapping("/notify")
    @PreAuthorize("hasRole('INTERNAL')")
    public ResponseEntity<NotificationResponse> ingestNotification(
            @Valid @RequestBody IngestNotificationRequest request) {
        NotificationResponse response = notificationService.ingestNotification(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }
}
