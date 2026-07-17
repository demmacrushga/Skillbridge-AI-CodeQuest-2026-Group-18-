package com.skillbridge.portfolio.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

public record BatchCreateItemsRequest(
        @NotNull(message = "items is required")
        @Size(min = 1, max = 50, message = "items must contain 1–50 entries")
        @Valid
        List<PortfolioItemRequest> items
) {}
