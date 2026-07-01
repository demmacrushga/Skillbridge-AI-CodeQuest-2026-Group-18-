package com.skillbridge.auth.exception;

public class InvalidRegistrationRoleException extends RuntimeException {

    public InvalidRegistrationRoleException(String role) {
        super("Role '" + role + "' is not allowed for self-registration");
    }
}
