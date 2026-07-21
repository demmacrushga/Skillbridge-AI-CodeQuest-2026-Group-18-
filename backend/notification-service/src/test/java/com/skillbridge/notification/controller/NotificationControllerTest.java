package com.skillbridge.notification.controller;

import com.skillbridge.notification.config.SecurityConfig;
import com.skillbridge.notification.dto.response.NotificationResponse;
import com.skillbridge.notification.dto.response.PreferencesResponse;
import com.skillbridge.notification.dto.response.PushTokenResponse;
import com.skillbridge.notification.dto.response.ReadAllResponse;
import com.skillbridge.notification.dto.response.UnreadCountResponse;
import com.skillbridge.notification.entity.NotificationType;
import com.skillbridge.notification.security.JwtService;
import com.skillbridge.notification.security.JwtUserDetails;
import com.skillbridge.notification.service.NotificationService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(NotificationController.class)
@AutoConfigureMockMvc(addFilters = false)
@Import(SecurityConfig.class)
class NotificationControllerTest {

    @Autowired MockMvc mockMvc;
    @MockBean NotificationService notificationService;
    @MockBean JwtService jwtService;

    private static final UUID USER_ID = UUID.randomUUID();
    private static final UUID NOTIF_ID = UUID.randomUUID();
    private static final Instant NOW = Instant.parse("2026-07-19T10:00:00Z");

    private static final NotificationResponse SAMPLE_NOTIFICATION = new NotificationResponse(
            NOTIF_ID, NotificationType.CHALLENGE_SCORED, "Your submission was scored",
            "You scored 85.50", false, NOW);

    private void authenticate(UUID userId, String role) {
        JwtUserDetails principal = new JwtUserDetails(userId, "user@knust.edu.gh", role);
        var auth = new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities());
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    @AfterEach
    void clearAuth() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void healthIsPublic() throws Exception {
        mockMvc.perform(get("/notification/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));
    }

    @Test
    void getMyNotificationsReturns200() throws Exception {
        authenticate(USER_ID, "STUDENT");
        when(notificationService.getMyNotifications(USER_ID)).thenReturn(List.of(SAMPLE_NOTIFICATION));

        mockMvc.perform(get("/notification"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].id").value(NOTIF_ID.toString()))
                .andExpect(jsonPath("$[0].type").value("CHALLENGE_SCORED"))
                .andExpect(jsonPath("$[0].read").value(false));
    }

    @Test
    void getUnreadCountReturns200() throws Exception {
        authenticate(USER_ID, "STUDENT");
        when(notificationService.getUnreadCount(USER_ID)).thenReturn(new UnreadCountResponse(3));

        mockMvc.perform(get("/notification/unread-count"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.unread").value(3));
    }

    @Test
    void markReadReturns200() throws Exception {
        authenticate(USER_ID, "STUDENT");
        when(notificationService.markRead(USER_ID, NOTIF_ID))
                .thenReturn(new NotificationResponse(NOTIF_ID, NotificationType.CHALLENGE_SCORED,
                        "Your submission was scored", "You scored 85.50", true, NOW));

        mockMvc.perform(post("/notification/{id}/read", NOTIF_ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.read").value(true));
    }

    @Test
    void markAllReadReturns200() throws Exception {
        authenticate(USER_ID, "STUDENT");
        when(notificationService.markAllRead(USER_ID)).thenReturn(new ReadAllResponse(2));

        mockMvc.perform(post("/notification/read-all"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.marked").value(2));
    }

    @Test
    void registerPushTokenReturns201() throws Exception {
        authenticate(USER_ID, "STUDENT");
        when(notificationService.registerPushToken(eq(USER_ID), any()))
                .thenReturn(new PushTokenResponse("ExponentPushToken[abc]", true, NOW));

        mockMvc.perform(post("/notification/push-tokens")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"ExponentPushToken[abc]\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.token").value("ExponentPushToken[abc]"))
                .andExpect(jsonPath("$.active").value(true));
    }

    @Test
    void deregisterPushTokenReturns204() throws Exception {
        authenticate(USER_ID, "STUDENT");

        mockMvc.perform(delete("/notification/push-tokens")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"ExponentPushToken[abc]\"}"))
                .andExpect(status().isNoContent());
    }

    @Test
    void getPreferencesReturns200() throws Exception {
        authenticate(USER_ID, "STUDENT");
        when(notificationService.getPreferences(USER_ID))
                .thenReturn(new PreferencesResponse(true, Set.of(NotificationType.MENTORSHIP_MESSAGE)));

        mockMvc.perform(get("/notification/preferences"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pushEnabled").value(true))
                .andExpect(jsonPath("$.mutedTypes", hasSize(1)))
                .andExpect(jsonPath("$.mutedTypes[0]").value("MENTORSHIP_MESSAGE"));
    }

    @Test
    void updatePreferencesReturns200() throws Exception {
        authenticate(USER_ID, "STUDENT");
        when(notificationService.updatePreferences(eq(USER_ID), any()))
                .thenReturn(new PreferencesResponse(false, Set.of()));

        mockMvc.perform(put("/notification/preferences")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"pushEnabled\":false,\"mutedTypes\":[]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pushEnabled").value(false))
                .andExpect(jsonPath("$.mutedTypes", hasSize(0)));
    }
}
