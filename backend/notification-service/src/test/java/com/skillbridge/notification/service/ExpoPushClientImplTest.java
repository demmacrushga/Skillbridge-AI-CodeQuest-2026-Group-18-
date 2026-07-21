package com.skillbridge.notification.service;

import com.skillbridge.notification.entity.PushToken;
import com.skillbridge.notification.repository.PushTokenRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class ExpoPushClientImplTest {

    RestClient.Builder restClientBuilder = RestClient.builder().baseUrl("http://localhost:9999");
    MockRestServiceServer mockServer = MockRestServiceServer.bindTo(restClientBuilder).build();
    RestClient restClient = restClientBuilder.build();
    PushTokenRepository pushTokenRepository = mock(PushTokenRepository.class);
    ExpoPushClientImpl client = new ExpoPushClientImpl(restClient, pushTokenRepository);

    @BeforeEach
    void reset() {
        mockServer.reset();
    }

    @Test
    void sendSuccessfulResponseDoesNotDeactivate() {
        UUID userId = UUID.randomUUID();
        PushToken token = PushToken.builder().id(UUID.randomUUID()).userId(userId)
                .token("ExponentPushToken[abc]").active(true).registeredAt(Instant.now()).build();

        mockServer.expect(requestTo("http://localhost:9999"))
                .andRespond(withSuccess("{\"data\":[{\"status\":\"ok\"}]}", MediaType.APPLICATION_JSON));

        client.send(List.of(token), "Title", "Body");
        verify(pushTokenRepository, never()).save(any());
    }

    @Test
    void sendDeviceNotRegisteredDeactivatesToken() {
        UUID userId = UUID.randomUUID();
        PushToken token = PushToken.builder().id(UUID.randomUUID()).userId(userId)
                .token("ExponentPushToken[dead]").active(true).registeredAt(Instant.now()).build();

        mockServer.expect(requestTo("http://localhost:9999"))
                .andRespond(withSuccess("""
                        {"data":[{"status":"error","details":{"error":"DeviceNotRegistered"}}]}
                        """, MediaType.APPLICATION_JSON));

        when(pushTokenRepository.save(token)).thenReturn(token);

        client.send(List.of(token), "Title", "Body");
        assertThat(token.isActive()).isFalse();
        verify(pushTokenRepository).save(token);
    }

    @Test
    void sendServerErrorIsLoggedAndSwallowed() {
        UUID userId = UUID.randomUUID();
        PushToken token = PushToken.builder().id(UUID.randomUUID()).userId(userId)
                .token("ExponentPushToken[abc]").active(true).registeredAt(Instant.now()).build();

        mockServer.expect(requestTo("http://localhost:9999"))
                .andRespond(withServerError());

        client.send(List.of(token), "Title", "Body");
        verify(pushTokenRepository, never()).save(any());
    }

    @Test
    void sendEmptyListDoesNothing() {
        client.send(List.of(), "Title", "Body");
        mockServer.verify();
    }
}
