package com.skillbridge.notification.controller;

import com.skillbridge.notification.config.SecurityConfig;
import com.skillbridge.notification.dto.request.IngestNotificationRequest;
import com.skillbridge.notification.dto.response.NotificationResponse;
import com.skillbridge.notification.entity.NotificationType;
import com.skillbridge.notification.security.InternalTokenFilter;
import com.skillbridge.notification.security.JwtService;
import com.skillbridge.notification.service.NotificationService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(InternalNotificationController.class)
@Import(SecurityConfig.class)
@TestPropertySource(properties = "notification.internal-token=valid-internal-token")
class InternalNotificationControllerTest {

    @Autowired MockMvc mockMvc;
    @MockBean NotificationService notificationService;
    @MockBean JwtService jwtService;

    private static final UUID USER_ID = UUID.randomUUID();
    private static final UUID NOTIF_ID = UUID.randomUUID();
    private static final Instant NOW = Instant.parse("2026-07-19T10:00:00Z");

    @Test
    void ingestWithValidTokenReturns201() throws Exception {
        when(notificationService.ingestNotification(any(IngestNotificationRequest.class)))
                .thenReturn(new NotificationResponse(NOTIF_ID, NotificationType.CHALLENGE_SCORED,
                        "Your submission was scored", "You scored 85.50", false, NOW));

        mockMvc.perform(post("/notification/internal/notify")
                        .header(InternalTokenFilter.INTERNAL_TOKEN_HEADER, "valid-internal-token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "userId": "%s",
                                  "type": "CHALLENGE_SCORED",
                                  "title": "Your submission was scored",
                                  "body": "You scored 85.50"
                                }
                                """.formatted(USER_ID)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(NOTIF_ID.toString()))
                .andExpect(jsonPath("$.type").value("CHALLENGE_SCORED"));
    }

    @Test
    void ingestWithoutTokenReturns401() throws Exception {
        mockMvc.perform(post("/notification/internal/notify")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void ingestWithInvalidTokenReturns401() throws Exception {
        mockMvc.perform(post("/notification/internal/notify")
                        .header(InternalTokenFilter.INTERNAL_TOKEN_HEADER, "wrong-token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void ingestWithBlankTitleReturns400() throws Exception {
        mockMvc.perform(post("/notification/internal/notify")
                        .header(InternalTokenFilter.INTERNAL_TOKEN_HEADER, "valid-internal-token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "userId": "%s",
                                  "type": "CHALLENGE_SCORED",
                                  "title": "  ",
                                  "body": "You scored 85.50"
                                }
                                """.formatted(USER_ID)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void ingestWithUnknownTypeReturns400() throws Exception {
        mockMvc.perform(post("/notification/internal/notify")
                        .header(InternalTokenFilter.INTERNAL_TOKEN_HEADER, "valid-internal-token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "userId": "%s",
                                  "type": "challenge_scored",
                                  "title": "Your submission was scored",
                                  "body": "You scored 85.50"
                                }
                                """.formatted(USER_ID)))
                .andExpect(status().isBadRequest());
    }
}
