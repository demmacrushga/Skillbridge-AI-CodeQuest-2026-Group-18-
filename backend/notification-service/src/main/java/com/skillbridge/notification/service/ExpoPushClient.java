package com.skillbridge.notification.service;

import com.skillbridge.notification.entity.PushToken;

import java.util.List;

public interface ExpoPushClient {

    void send(List<PushToken> tokens, String title, String body);
}
