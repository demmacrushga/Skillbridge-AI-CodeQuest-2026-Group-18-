package com.skillbridge.mockinterview.exception;

public class SessionAlreadyCompletedException extends RuntimeException {

    public SessionAlreadyCompletedException(String message) {
        super(message);
    }
}
