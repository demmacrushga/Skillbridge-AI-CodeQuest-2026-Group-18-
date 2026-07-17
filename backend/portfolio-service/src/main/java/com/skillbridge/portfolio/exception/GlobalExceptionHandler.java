package com.skillbridge.portfolio.exception;

import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(
            MethodArgumentNotValidException ex, HttpServletRequest req) {
        List<Map<String, String>> fieldErrors = ex.getBindingResult()
                .getFieldErrors()
                .stream()
                .map(fe -> Map.of("field", fe.getField(), "message", fe.getDefaultMessage()))
                .toList();
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of(
                "timestamp", Instant.now().toString(),
                "status", 400,
                "error", "Bad Request",
                "message", "Validation failed",
                "path", req.getRequestURI(),
                "fieldErrors", fieldErrors
        ));
    }

    @ExceptionHandler({PortfolioItemNotFoundException.class, VerificationRequestNotFoundException.class})
    public ResponseEntity<Map<String, Object>> handleNotFound(RuntimeException ex, HttpServletRequest req) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(error(404, "Not Found", ex.getMessage(), req));
    }

    @ExceptionHandler(DuplicateVerificationException.class)
    public ResponseEntity<Map<String, Object>> handleConflict(DuplicateVerificationException ex, HttpServletRequest req) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(error(409, "Conflict", ex.getMessage(), req));
    }

    @ExceptionHandler(VerificationAlreadyResolvedException.class)
    public ResponseEntity<Map<String, Object>> handleAlreadyResolved(VerificationAlreadyResolvedException ex, HttpServletRequest req) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(error(409, "Conflict", ex.getMessage(), req));
    }

    @ExceptionHandler(AiServiceException.class)
    public ResponseEntity<Map<String, Object>> handleAiServiceException(AiServiceException ex, HttpServletRequest req) {
        log.error("AI service error at {}: {}", req.getRequestURI(), ex.getMessage());
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(
                error(503, "Service Unavailable", ex.getMessage(), req));
    }

    @ExceptionHandler(FileSizeExceededException.class)
    public ResponseEntity<Map<String, Object>> handleFileSizeExceeded(FileSizeExceededException ex, HttpServletRequest req) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(error(400, "Bad Request", ex.getMessage(), req));
    }

    @ExceptionHandler(UnsupportedFileTypeException.class)
    public ResponseEntity<Map<String, Object>> handleUnsupportedFileType(UnsupportedFileTypeException ex, HttpServletRequest req) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(error(400, "Bad Request", ex.getMessage(), req));
    }

    @ExceptionHandler(FileParsingException.class)
    public ResponseEntity<Map<String, Object>> handleFileParsing(FileParsingException ex, HttpServletRequest req) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(error(400, "Bad Request", ex.getMessage(), req));
    }

    @ExceptionHandler(WebsiteFetchException.class)
    public ResponseEntity<Map<String, Object>> handleWebsiteFetch(WebsiteFetchException ex, HttpServletRequest req) {
        return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(error(502, "Bad Gateway", ex.getMessage(), req));
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Map<String, Object>> handleForbidden(AccessDeniedException ex, HttpServletRequest req) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(error(403, "Forbidden", ex.getMessage(), req));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleGeneric(Exception ex, HttpServletRequest req) {
        log.error("Unhandled exception at {}", req.getRequestURI(), ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(
                error(500, "Internal Server Error", "An unexpected error occurred", req));
    }

    private Map<String, Object> error(int status, String error, String message, HttpServletRequest req) {
        return Map.of(
                "timestamp", Instant.now().toString(),
                "status", status,
                "error", error,
                "message", message,
                "path", req.getRequestURI()
        );
    }
}
