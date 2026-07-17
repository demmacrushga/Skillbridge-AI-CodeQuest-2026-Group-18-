package com.skillbridge.mockinterview.exception;

public class QuestionAlreadyAnsweredException extends RuntimeException {

    public QuestionAlreadyAnsweredException(String message) {
        super(message);
    }
}
