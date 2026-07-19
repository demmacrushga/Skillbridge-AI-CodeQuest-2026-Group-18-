package com.skillbridge.matching.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

public record UpdateSkillsRequest(
        @NotNull @Size(max = 50) List<@NotBlank @Size(max = 150) String> skills) {
}
