package com.skillbridge.portfolio.exception;

public class PortfolioItemNotFoundException extends RuntimeException {
    public PortfolioItemNotFoundException(String message) {
        super(message);
    }
}
