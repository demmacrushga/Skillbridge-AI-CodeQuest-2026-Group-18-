package com.skillbridge.career;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cache.annotation.EnableCaching;

@SpringBootApplication
@EnableCaching
public class CareerServiceApplication {
    public static void main(String[] args) {
        SpringApplication.run(CareerServiceApplication.class, args);
    }
}
