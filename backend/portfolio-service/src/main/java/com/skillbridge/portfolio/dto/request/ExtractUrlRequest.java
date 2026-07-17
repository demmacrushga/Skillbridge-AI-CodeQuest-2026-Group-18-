package com.skillbridge.portfolio.dto.request;

import jakarta.validation.constraints.NotBlank;
import org.hibernate.validator.constraints.URL;

public record ExtractUrlRequest(
        @NotBlank(message = "url is required")
        @URL(message = "url must be a valid URL")
        String url
) {}
