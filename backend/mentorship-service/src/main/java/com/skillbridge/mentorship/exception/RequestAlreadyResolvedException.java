package com.skillbridge.mentorship.exception;

public class RequestAlreadyResolvedException extends RuntimeException {
    public RequestAlreadyResolvedException(String message) {
        super(message);
    }
}
