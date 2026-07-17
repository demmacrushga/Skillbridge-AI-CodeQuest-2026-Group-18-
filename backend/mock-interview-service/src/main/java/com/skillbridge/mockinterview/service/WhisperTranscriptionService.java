package com.skillbridge.mockinterview.service;

public interface WhisperTranscriptionService {
    String transcribe(byte[] audioBytes, String contentType);
}