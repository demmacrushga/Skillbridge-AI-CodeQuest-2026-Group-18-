package com.skillbridge.career.exception;

public class CareerPathNotFoundException extends RuntimeException {
    public CareerPathNotFoundException(String name) {
        super("Career path not found: " + name);
    }
}
