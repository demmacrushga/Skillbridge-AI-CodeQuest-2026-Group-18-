package com.skillbridge.portfolio.dto.request;

import jakarta.validation.constraints.Size;
import org.hibernate.validator.constraints.URL;

public record PortfolioItemUpdateRequest(
        @Size(max = 255, message = "title must be 255 characters or fewer") String title,
        String description,
        @URL(message = "externalUrl must be a valid URL") String externalUrl,
        Integer displayOrder
) {}
