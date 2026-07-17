package com.skillbridge.portfolio.exception;

public class WebsiteFetchException extends RuntimeException {
    public WebsiteFetchException(String message) {
        super(message);
    }

    public WebsiteFetchException(String message, Throwable cause) {
        super(message, cause);
    }
}
