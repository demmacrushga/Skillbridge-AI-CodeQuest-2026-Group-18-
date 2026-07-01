package com.skillbridge.auth.security;

import com.skillbridge.auth.entity.User;
import com.skillbridge.auth.enums.Role;
import com.skillbridge.auth.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UsernameNotFoundException;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserDetailsServiceImplTest {

    @Mock UserRepository userRepository;
    @InjectMocks UserDetailsServiceImpl userDetailsService;

    @Test
    void loadUserByUsername_existingUser_returnsUser() {
        User user = buildUser();
        when(userRepository.findByEmail(user.getEmail())).thenReturn(Optional.of(user));

        UserDetails result = userDetailsService.loadUserByUsername(user.getEmail());

        assertThat(result).isEqualTo(user);
    }

    @Test
    void loadUserByUsername_unknownUser_throwsUsernameNotFoundException() {
        when(userRepository.findByEmail("missing@example.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> userDetailsService.loadUserByUsername("missing@example.com"))
                .isInstanceOf(UsernameNotFoundException.class);
    }

    @Test
    void loadUserById_existingUser_returnsUser() {
        User user = buildUser();
        when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));

        User result = userDetailsService.loadUserById(user.getId());

        assertThat(result).isEqualTo(user);
    }

    @Test
    void loadUserById_unknownUser_throwsUsernameNotFoundException() {
        UUID id = UUID.randomUUID();
        when(userRepository.findById(id)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> userDetailsService.loadUserById(id))
                .isInstanceOf(UsernameNotFoundException.class);
    }

    private User buildUser() {
        return User.builder()
                .id(UUID.randomUUID())
                .email("user@example.com")
                .passwordHash("$2a$10$hashed")
                .firstName("Test")
                .lastName("User")
                .role(Role.STUDENT)
                .build();
    }
}
